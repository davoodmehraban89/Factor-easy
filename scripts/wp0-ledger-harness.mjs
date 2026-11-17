// Disposable-only source baseline. No PostgreSQL URL, host, password or production option.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const run = (args, input) => spawnSync('docker', args, { cwd: root, env: {...process.env, DOCKER_HOST:'unix:///var/run/docker.sock', DOCKER_CONTEXT:'', DOCKER_TLS:'', DOCKER_TLS_VERIFY:'', DOCKER_CERT_PATH:''}, input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const requireSuccess = (result, label) => {
  if (result.status !== 0) throw new Error(`${label}: exit ${result.status}\n${result.stdout || ''}${result.stderr || ''}`);
  return result.stdout;
};

// All records/RLS/member/role definitions through the office evidence guard,
// followed by current identity and financial idempotency definitions. Later
// office/request-only schema is intentionally omitted, and recorded below.
export function ledgerMigrationFiles() {
  const late = new Set(['20261002080000','20261007165208','20261011174445','20261012080000']);
  return readdirSync(resolve(root, 'supabase/migrations')).filter(name => name.endsWith('.sql') &&
    (name < '20260930153001' || late.has(name.slice(0, 14)))).sort();
}

export async function withDisposableLedger(callback) {
  const name = `finora-wp0-ledger-${process.pid}`;
  const evidence = { scope: 'source-derived ledger baseline; NOT a production database clone', image: 'postgres:17-alpine', migrations: [], omittedMigrations: [], platformBootstrap: 'supabase/tests/wp0_platform_bootstrap.sql' };
  try {
    requireSuccess(run(['run', '--rm', '-d', '--name', name, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=finora_wp0', 'postgres:17-alpine']), 'start isolated PostgreSQL');
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (run(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'finora_wp0']).status === 0) { ready = true; break; }
      await new Promise(done => setTimeout(done, 100));
    }
    if (!ready) throw new Error('Disposable PostgreSQL did not become ready');
    const sql = (text) => run(['exec', '-i', name, 'psql', '-X', '-U', 'postgres', '-d', 'finora_wp0', '-v', 'ON_ERROR_STOP=1', '-P', 'pager=off'], text);
    const apply = (path) => requireSuccess(sql(readFileSync(resolve(root, path), 'utf8')), path);
    evidence.postgres = requireSuccess(sql("select version();"), 'PostgreSQL version').trim();
    evidence.imageDigest = JSON.parse(requireSuccess(run(['image', 'inspect', 'postgres:17-alpine', '--format', '{{json .RepoDigests}}']), 'image digest'));
    evidence.platformBootstrapSha256 = sha256(readFileSync(resolve(root,evidence.platformBootstrap)));
    apply(evidence.platformBootstrap);
    const files = ledgerMigrationFiles();
    evidence.omittedMigrations = readdirSync(resolve(root, 'supabase/migrations')).filter(name => name.endsWith('.sql') && !files.includes(name)).sort();
    for (const name of files) {
      const bytes = readFileSync(resolve(root, 'supabase/migrations', name));
      const source = bytes.toString('utf8');
      // Fifteen historic archives have a literal backslash+n at EOF. Only this
      // transport artifact is removed in memory. Tracked originals stay intact.
      const normalized = source.replace(/\\n\s*$/, '\n');
      requireSuccess(sql(normalized), `source migration ${name}`);
      evidence.migrations.push({ name, sourceSha256: sha256(bytes), appliedSha256: sha256(normalized), terminalLiteralNewlineRemoved: source !== normalized });
    }
    const context = { sql, apply, evidence, requireSuccess, root };
    return await callback(context);
  } finally {
    const result = run(['rm', '-f', name]);
    if (result.status !== 0 && !`${result.stderr}`.includes('No such container')) throw new Error('Could not remove disposable ledger container');
  }
}
