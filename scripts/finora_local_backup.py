#!/usr/bin/env python3
"""Finora offline-custody PostgreSQL backups. No plaintext archive is written to disk.

Requirements: Python 3.10+, PostgreSQL client pg_dump/pg_restore matching the
server major version, and age (https://age-encryption.org/).
The backup recipient is public. The age identity/private key never leaves the
owner's trusted restore machine. No production restore command exists.
"""
from __future__ import annotations

import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import threading
from datetime import datetime, timezone

VERSION = 1
DEFAULT_DB = "postgres"
TEST_DB_PREFIX = "finora_restore_test_"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


class BackupError(RuntimeError):
    pass


def safe_executable(value: str) -> str:
    found = shutil.which(value)
    if not found:
        raise BackupError(f"Required executable not found: {value}")
    return found


def validate_port(value: int) -> int:
    if not 1 <= value <= 65535:
        raise BackupError("Database port must be between 1 and 65535")
    return value


def ensure_outside_checkout(destination: Path) -> Path:
    dest = destination.expanduser().resolve()
    checkout = Path(__file__).resolve().parent.parent
    if dest == checkout or checkout in dest.parents:
        raise BackupError("Refusing backup storage inside source-code checkout")
    dest.mkdir(parents=True, exist_ok=True)
    if not dest.is_dir():
        raise BackupError("Backup destination is not a directory")
    return dest


def verify_public_recipient(recipient: str) -> str:
    if not re.fullmatch(r"age1[023456789acdefghjklmnpqrstuvwxyz]{40,120}", recipient):
        raise BackupError("Expected an age X25519 public recipient beginning with age1")
    return recipient


def database_environment(args: argparse.Namespace) -> dict[str, str]:
    password = os.environ.get("FINORA_BACKUP_DB_PASSWORD")
    if not password:
        if not sys.stdin.isatty():
            raise BackupError("No database password: set FINORA_BACKUP_DB_PASSWORD securely")
        password = getpass.getpass("Production database password (not saved): ")
    if not password:
        raise BackupError("Empty database password is not allowed")
    if not args.host or not args.user or not args.database:
        raise BackupError("Database host, user, and database are required")
    env = os.environ.copy()
    env.update({
        "PGHOST": args.host,
        "PGPORT": str(validate_port(args.port)),
        "PGUSER": args.user,
        "PGDATABASE": args.database,
        "PGPASSWORD": password,
        "PGSSLMODE": "require",
        "PGCONNECT_TIMEOUT": "15",
        "PGOPTIONS": "-c default_transaction_read_only=on",
    })
    return env


def checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        while chunk := fh.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _read_stderr(proc: subprocess.Popen, target: list[bytes]) -> None:
    try:
        target.append(proc.stderr.read() if proc.stderr else b"")
    except OSError:
        target.append(b"")


def backup(args: argparse.Namespace) -> Path:
    recipient = verify_public_recipient(args.recipient)
    dest = ensure_outside_checkout(Path(args.output_dir))
    pg_dump = safe_executable(args.pg_dump)
    age = safe_executable(args.age)
    env = database_environment(args)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    name = f"finora-postgres-{timestamp}-{secrets.token_hex(4)}.dump.age"
    final = dest / name
    partial = dest / (name + ".partial")
    manifest = dest / (name + ".json")
    manifest_temp = dest / (name + ".json.partial")
    dump_proc = None
    age_proc = None
    dump_errors: list[bytes] = []
    try:
        # pg_dump's custom format is sent directly to age, never to a plaintext file.
        dump_proc = subprocess.Popen(
            [pg_dump, "--format=custom", "--no-owner", "--no-acl", "--file=-", "--dbname=" + args.database],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env,
        )
        stderr_thread = threading.Thread(target=_read_stderr, args=(dump_proc, dump_errors), daemon=True)
        stderr_thread.start()
        age_proc = subprocess.Popen(
            [age, "--recipient", recipient, "--output", str(partial)],
            stdin=dump_proc.stdout, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
        )
        assert dump_proc.stdout is not None
        dump_proc.stdout.close()  # allow pg_dump to see a broken pipe if encryption exits
        _, age_stderr = age_proc.communicate()
        dump_code = dump_proc.wait()
        stderr_thread.join(timeout=5)
        if dump_code != 0:
            raise BackupError(f"pg_dump failed (exit {dump_code}); encrypted partial backup discarded")
        if age_proc.returncode != 0:
            raise BackupError(f"age encryption failed (exit {age_proc.returncode}); partial backup discarded")
        if not partial.is_file() or partial.stat().st_size == 0:
            raise BackupError("Encryption produced no archive")
        os.replace(partial, final)
        details = {
            "format": "finora-encrypted-pg-dump-v1",
            "created_utc": datetime.now(timezone.utc).isoformat(),
            "archive": name,
            "ciphertext_sha256": checksum(final),
            "ciphertext_bytes": final.stat().st_size,
            "compression": "pg_dump custom",
            "encryption": "age X25519",
            "scope": "PostgreSQL database; NOT Supabase Storage file bodies, Edge Function secrets, or off-site copies",
        }
        manifest_temp.write_text(json.dumps(details, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(manifest_temp, manifest)
        print(f"Encrypted backup created: {final}")
        print(f"Integrity manifest: {manifest}")
        print("Copy BOTH files to separate offline storage. Perform a sandbox restore before trusting the backup.")
        return final
    except Exception:
        for path in (partial, final, manifest_temp, manifest):
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass
        raise
    finally:
        if age_proc and age_proc.poll() is None:
            age_proc.kill()
            age_proc.wait()
        if dump_proc and dump_proc.poll() is None:
            dump_proc.kill()
            dump_proc.wait()
        # Do not retain production password in process environment after subprocesses finish.
        env.pop("PGPASSWORD", None)


def check_integrity(path: Path) -> dict:
    if not path.is_file() or not path.name.endswith(".dump.age"):
        raise BackupError("Expected an encrypted .dump.age archive")
    meta_path = path.with_name(path.name + ".json")
    if not meta_path.is_file():
        raise BackupError("Companion integrity manifest is missing")
    details = json.loads(meta_path.read_text(encoding="utf-8"))
    if details.get("format") != "finora-encrypted-pg-dump-v1" or details.get("archive") != path.name:
        raise BackupError("Integrity manifest does not match this archive")
    if details.get("ciphertext_bytes") != path.stat().st_size:
        raise BackupError("Encrypted backup size mismatch")
    if details.get("ciphertext_sha256") != checksum(path):
        raise BackupError("Encrypted backup SHA-256 mismatch")
    return details


def decrypt_into_process(path: Path, identity: Path, age: str, command: list[str], env: dict | None = None) -> None:
    # Never generate decrypted plaintext on disk, even for verification/restore tests.
    dec = subprocess.Popen([age, "--decrypt", "--identity", str(identity), str(path)],
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    err_parts: list[bytes] = []
    thread = threading.Thread(target=_read_stderr, args=(dec, err_parts), daemon=True)
    thread.start()
    consumer = None
    try:
        consumer = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
                                    stderr=subprocess.PIPE, env=env)
        assert dec.stdout is not None and consumer.stdin is not None
        broken = False
        while chunk := dec.stdout.read(256 * 1024):
            if not broken:
                try:
                    consumer.stdin.write(chunk)
                    consumer.stdin.flush()
                except BrokenPipeError:
                    broken = True
        try:
            consumer.stdin.close()
        except BrokenPipeError:
            pass
        consumer_stderr = consumer.stderr.read() if consumer.stderr else b""
        consumer_rc = consumer.wait()
        dec_rc = dec.wait()
        thread.join(timeout=5)
        if dec_rc != 0:
            raise BackupError("age decryption failed; backup is not usable with this identity")
        if consumer_rc != 0:
            raise BackupError(f"PostgreSQL archive reader/restore failed (exit {consumer_rc})")
    finally:
        if consumer and consumer.poll() is None:
            consumer.kill()
            consumer.wait()
        if dec.poll() is None:
            dec.kill()
            dec.wait()


def verify(args: argparse.Namespace) -> None:
    archive = Path(args.backup).expanduser().resolve()
    identity = Path(args.identity).expanduser().resolve()
    if not identity.is_file():
        raise BackupError("Age private identity file not found; never upload it to GitHub")
    check_integrity(archive)
    decrypt_into_process(archive, identity, safe_executable(args.age),
                         [safe_executable(args.pg_restore), "--list", "--format=custom"])
    print("Integrity hash, age decryption and PostgreSQL archive catalog: PASS")
    print("This is NOT a successful restore test. Restore to an isolated empty database next.")


def restore_test(args: argparse.Namespace) -> None:
    if args.test_host not in LOCAL_HOSTS:
        raise BackupError("Restore-test only permits localhost; remote/production targets are prohibited")
    if not re.fullmatch(r"finora_restore_test_[a-z0-9_]+", args.test_database):
        raise BackupError("Restore-test database must start with finora_restore_test_ and be disposable")
    archive = Path(args.backup).expanduser().resolve()
    identity = Path(args.identity).expanduser().resolve()
    if not identity.is_file():
        raise BackupError("Age private identity file not found")
    check_integrity(archive)
    if args.test_port < 1 or args.test_port > 65535:
        raise BackupError("Invalid local PostgreSQL test port")
    if not args.test_user:
        raise BackupError("Test database user required")
    password = os.environ.get("FINORA_RESTORE_TEST_DB_PASSWORD")
    if password is None and sys.stdin.isatty():
        password = getpass.getpass("LOCAL disposable database password (empty for trust auth): ")
    env = os.environ.copy()
    env.update({"PGHOST": args.test_host, "PGPORT": str(args.test_port),
                "PGUSER": args.test_user, "PGDATABASE": args.test_database,
                "PGSSLMODE": "prefer", "PGCONNECT_TIMEOUT": "5"})
    if password:
        env["PGPASSWORD"] = password
    else:
        env.pop("PGPASSWORD", None)
    # Production cannot be a target; no --clean or --create. Database must already
    # exist and be EMPTY and disposable; run with a dedicated local-only account.
    command = [safe_executable(args.pg_restore), "--exit-on-error", "--no-owner", "--no-acl",
               "--format=custom", "--dbname=" + args.test_database]
    decrypt_into_process(archive, identity, safe_executable(args.age), command, env=env)
    env.pop("PGPASSWORD", None)
    print("Isolated localhost PostgreSQL restore: PASS")
    print("Validate application-level rows, roles and RLS separately before marking operational recovery ready.")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="command", required=True)
    b = sub.add_parser("backup", help="Read PostgreSQL and encrypt directly to external/local storage")
    b.add_argument("--host", required=True, help="Production database host, not Supabase REST API URL")
    b.add_argument("--port", type=int, default=5432)
    b.add_argument("--user", required=True)
    b.add_argument("--database", default=DEFAULT_DB)
    b.add_argument("--output-dir", required=True)
    b.add_argument("--recipient", required=True, help="PUBLIC age1 recipient; never the private key")
    b.add_argument("--pg-dump", default="pg_dump")
    b.add_argument("--age", default="age")
    b.set_defaults(func=backup)
    v = sub.add_parser("verify", help="Verify ciphertext, decrypt in memory and inspect pg_restore archive TOC")
    v.add_argument("--backup", required=True)
    v.add_argument("--identity", required=True, help="Private age identity file stored outside repository")
    v.add_argument("--age", default="age")
    v.add_argument("--pg-restore", default="pg_restore")
    v.set_defaults(func=verify)
    t = sub.add_parser("restore-test", help="Restore ONLY to an existing empty localhost disposable database")
    t.add_argument("--backup", required=True)
    t.add_argument("--identity", required=True)
    t.add_argument("--test-host", default="127.0.0.1")
    t.add_argument("--test-port", type=int, default=5432)
    t.add_argument("--test-user", required=True)
    t.add_argument("--test-database", required=True)
    t.add_argument("--age", default="age")
    t.add_argument("--pg-restore", default="pg_restore")
    t.set_defaults(func=restore_test)
    args = p.parse_args(argv)
    try:
        args.func(args)
        return 0
    except (BackupError, OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"BACKUP ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
