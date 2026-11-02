import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'finora-manifest-'));
const script = path.resolve('scripts/migration-manifest-check.mjs');
const run = () => spawnSync(process.execPath, [script], {
  env: {...process.env, FINORA_MANIFEST_ROOT: fixture}, encoding: 'utf8'
});
try {
  fs.mkdirSync(path.join(fixture, 'supabase'), {recursive: true});
  fs.cpSync('supabase/migrations', path.join(fixture, 'supabase/migrations'), {recursive: true});
  fs.copyFileSync('supabase/migration-manifest.json', path.join(fixture, 'supabase/migration-manifest.json'));
  const manifest = JSON.parse(fs.readFileSync('supabase/migration-manifest.json', 'utf8'));
  const snapshot = path.join(fixture, manifest.production_snapshot);
  fs.mkdirSync(path.dirname(snapshot), {recursive: true});
  fs.copyFileSync(manifest.production_snapshot, snapshot);
  const baseline = run();
  assert.equal(baseline.status, 0, baseline.stderr);
  assert.match(baseline.stdout, /NOT schema parity/);

  const file = path.join(fixture, 'supabase/migrations', manifest.repo_migrations[0].file);
  const bytes = fs.readFileSync(file);
  fs.appendFileSync(file, '\n-- unauthorized edit');
  assert.match(run().stderr, /Migration body changed/);
  fs.writeFileSync(file, bytes);
  fs.unlinkSync(file);
  assert.match(run().stderr, /Migration inventory drift/);
  fs.writeFileSync(file, bytes);

  const extra = path.join(fixture, 'supabase/migrations/20990101000000_unreviewed.sql');
  fs.writeFileSync(extra, 'select 1;');
  assert.match(run().stderr, /Migration inventory drift/);
  fs.unlinkSync(extra);
  const prod = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  prod.migrations.push({version: '20990101000000', name: 'unreviewed'});
  fs.writeFileSync(snapshot, JSON.stringify(prod));
  assert.match(run().stderr, /New\/unreviewed production-only migration drift/);
  console.log('PASS manifest mutations: changed body, missing file, added file, new production version rejected; known drift remains explicit.');
} finally {
  fs.rmSync(fixture, {recursive: true, force: true});
}
