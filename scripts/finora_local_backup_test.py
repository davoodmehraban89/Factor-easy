#!/usr/bin/env python3
"""Offline contract tests with FAKE pg_dump/age/pg_restore executables.

These prove command and failure behavior; they do not prove real encryption or
production recovery. Real age and a disposable PostgreSQL restore are required.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().with_name("finora_local_backup.py")
RECIPIENT = "age1" + "q" * 58

DUMP = r'''#!/usr/bin/env python3
import os, sys
if not os.environ.get('PGPASSWORD') or os.environ.get('PGOPTIONS') != '-c default_transaction_read_only=on':
    sys.exit(8)
if '--format=custom' not in sys.argv or '--file=-' not in sys.argv:
    sys.exit(9)
if os.environ.get('FAKE_DUMP_FAIL'):
    sys.stdout.buffer.write(b'PARTIAL_FINANCIAL_PLAINTEXT')
    sys.exit(17)
sys.stdout.buffer.write(b'PGDMP_CUSTOM_FINANCIAL_PLAINTEXT_1234')
'''

AGE = r'''#!/usr/bin/env python3
import os, sys
argv = sys.argv
if '--decrypt' in argv:
    data = open(argv[-1], 'rb').read()
    if data.startswith(b'MOCK_CIPHERTEXT:'):
        sys.stdout.buffer.write(data[len(b'MOCK_CIPHERTEXT:'):][::-1])
        sys.exit(0)
    sys.exit(4)
if os.environ.get('FAKE_AGE_FAIL'):
    sys.exit(5)
try:
    output = argv[argv.index('--output')+1]
except ValueError:
    sys.exit(6)
data = sys.stdin.buffer.read()
with open(output, 'wb') as f:
    f.write(b'MOCK_CIPHERTEXT:' + data[::-1])
'''

RESTORE = r'''#!/usr/bin/env python3
import sys
value=sys.stdin.buffer.read()
if not value.startswith(b'PGDMP_CUSTOM_FINANCIAL_PLAINTEXT_'):
    sys.exit(7)
if '--list' in sys.argv:
    sys.exit(0)
if not any(x.startswith('--dbname=finora_restore_test_') for x in sys.argv):
    sys.exit(19)
sys.exit(0)
'''


class OfflineBackupContract(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.programs = self.root / "bin"
        self.programs.mkdir()
        for name, source in (("pg_dump", DUMP), ("age", AGE), ("pg_restore", RESTORE)):
            p = self.programs / name
            p.write_text(source)
            p.chmod(0o755)
        self.destination = self.root / "external-drive"
        self.secret = self.root / "PRIVATE-KEY-DO-NOT-COMMIT.txt"
        self.secret.write_text("AGE-SECRET-KEY-MOCK")
        self.env = dict(os.environ, FINORA_BACKUP_DB_PASSWORD="synthetic-only-password")

    def command(self, *args, overrides=None):
        env = dict(self.env)
        env.update(overrides or {})
        return subprocess.run([sys.executable, str(SCRIPT), *args], text=True,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, timeout=30)

    def do_backup(self, overrides=None):
        return self.command("backup", "--host", "db.example.invalid", "--user", "readbackup",
                            "--database", "postgres", "--output-dir", str(self.destination),
                            "--recipient", RECIPIENT, "--pg-dump", str(self.programs / "pg_dump"),
                            "--age", str(self.programs / "age"), overrides=overrides)

    def archive(self):
        files = list(self.destination.glob("*.dump.age"))
        self.assertEqual(len(files), 1)
        return files[0]

    def test_encrypted_archive_manifest_and_verify(self):
        result = self.do_backup()
        self.assertEqual(result.returncode, 0, result.stderr)
        archive = self.archive()
        ciphertext = archive.read_bytes()
        self.assertNotIn(b"FINANCIAL_PLAINTEXT", ciphertext)
        manifest = json.loads(Path(str(archive) + ".json").read_text())
        self.assertEqual(manifest["ciphertext_bytes"], len(ciphertext))
        checked = self.command("verify", "--backup", str(archive), "--identity", str(self.secret),
                               "--age", str(self.programs / "age"),
                               "--pg-restore", str(self.programs / "pg_restore"))
        self.assertEqual(checked.returncode, 0, checked.stderr)
        self.assertIn("NOT a successful restore test", checked.stdout)

    def test_dump_failure_deletes_ciphertext_and_manifest(self):
        failed = self.do_backup(overrides={"FAKE_DUMP_FAIL": "1"})
        self.assertEqual(failed.returncode, 1)
        self.assertIn("pg_dump failed", failed.stderr)
        self.assertFalse(list(self.destination.iterdir()))

    def test_age_failure_deletes_ciphertext_and_manifest(self):
        failed = self.do_backup(overrides={"FAKE_AGE_FAIL": "1"})
        self.assertEqual(failed.returncode, 1)
        self.assertFalse(list(self.destination.iterdir()))

    def test_integrity_tamper_detected(self):
        self.assertEqual(self.do_backup().returncode, 0)
        archive = self.archive()
        archive.write_bytes(archive.read_bytes() + b"TAMPERED")
        checked = self.command("verify", "--backup", str(archive), "--identity", str(self.secret),
                               "--age", str(self.programs / "age"),
                               "--pg-restore", str(self.programs / "pg_restore"))
        self.assertEqual(checked.returncode, 1)
        self.assertIn("size mismatch", checked.stderr)

    def test_restore_to_remote_or_ordinary_db_blocked(self):
        self.assertEqual(self.do_backup().returncode, 0)
        archive = self.archive()
        common = ("restore-test", "--backup", str(archive), "--identity", str(self.secret),
                  "--test-user", "postgres", "--age", str(self.programs / "age"),
                  "--pg-restore", str(self.programs / "pg_restore"))
        remote = self.command(*common, "--test-host", "hcsixhqbyuhpshfwqpjx.supabase.co",
                              "--test-database", "finora_restore_test_safe")
        self.assertEqual(remote.returncode, 1)
        self.assertIn("localhost", remote.stderr)
        production_name = self.command(*common, "--test-host", "127.0.0.1", "--test-database", "postgres")
        self.assertEqual(production_name.returncode, 1)
        self.assertIn("disposable", production_name.stderr)

    def test_disposable_local_restore_pipeline(self):
        self.assertEqual(self.do_backup().returncode, 0)
        result = self.command("restore-test", "--backup", str(self.archive()),
                              "--identity", str(self.secret), "--test-host", "127.0.0.1",
                              "--test-port", "5432", "--test-user", "postgres",
                              "--test-database", "finora_restore_test_disposable",
                              "--age", str(self.programs / "age"),
                              "--pg-restore", str(self.programs / "pg_restore"),
                              overrides={"FINORA_RESTORE_TEST_DB_PASSWORD": "testonly"})
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_reject_checkout_storage_and_invalid_recipient(self):
        in_repo = self.command("backup", "--host", "db.example.invalid", "--user", "postgres",
                               "--output-dir", str(SCRIPT.parent.parent / "unsafe-backups"),
                               "--recipient", RECIPIENT, "--pg-dump", str(self.programs / "pg_dump"),
                               "--age", str(self.programs / "age"))
        self.assertEqual(in_repo.returncode, 1)
        self.assertIn("checkout", in_repo.stderr)
        no_key = self.command("backup", "--host", "db.example.invalid", "--user", "postgres",
                              "--output-dir", str(self.destination), "--recipient", "not-a-real-key",
                              "--pg-dump", str(self.programs / "pg_dump"),
                              "--age", str(self.programs / "age"))
        self.assertEqual(no_key.returncode, 1)
        self.assertIn("age X25519", no_key.stderr)


if __name__ == "__main__":
    unittest.main()
