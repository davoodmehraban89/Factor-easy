import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=process.env.FINORA_MANIFEST_ROOT||process.cwd();
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const manifest=read('supabase/migration-manifest.json');
const files=fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
assert.deepEqual(files,manifest.repo_migrations.map(x=>x.file),'Migration inventory drift: review and update manifest explicitly');
for(const row of manifest.repo_migrations){
 assert.match(row.file,/^\d{14}_[A-Za-z0-9_]+\.sql$/);
 const bytes=fs.readFileSync(path.join(root,'supabase/migrations',row.file));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256,'Migration body changed: '+row.file);
}
const repo=new Set(files.map(f=>f.split('_')[0]));
assert.equal(repo.size,files.length,'Duplicate migration version');
const prod=new Set(read(manifest.production_snapshot).migrations.map(r=>r.version));
const prodOnly=[...prod].filter(v=>!repo.has(v)).sort(),repoOnly=[...repo].filter(v=>!prod.has(v)).sort();
assert.deepEqual(prodOnly,manifest.unreconciled_production_only,'New/unreviewed production-only migration drift');
assert.deepEqual(repoOnly,manifest.unreconciled_repository_only,'New/unreviewed repository-only migration drift');
console.log('PASS committed archive manifest: '+files.length+' files; body hashes verified.');
console.log('UNRECONCILED migration ledger: '+prodOnly.length+' production-only / '+repoOnly.length+' repository-only versions. This is NOT schema parity or deployment approval.');
