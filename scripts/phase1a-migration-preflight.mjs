#!/usr/bin/env node
// Offline CI preflight based on an explicitly dated READ-ONLY Production ledger
// snapshot. Never connects or writes to Production. NEVER authorizes db push.
import fs from 'node:fs';
import path from 'node:path';
const prod=JSON.parse(fs.readFileSync('supabase/tests/fixtures/phase1a_production_migration_versions_20261016.json','utf8')).versions;
const files=fs.readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort();
const local=files.map(x=>({version:x.split('_')[0],name:x.replace(/^[0-9]+_/,'').replace(/\.sql$/,'')}));
const prodSet=new Set(prod.map(x=>x.version));
const locSet=new Set(local.map(x=>x.version));
const onlyProd=prod.filter(x=>!locSet.has(x.version));
const onlyRepo=local.filter(x=>!prodSet.has(x.version));
const workflow=fs.readFileSync('.github/workflows/phase1a-supabase-parity.yml','utf8');
if(/^\s*supabase\s+db\s+push\b/m.test(workflow)){
 console.error('FATAL: db push cannot occur in 1A CI');process.exit(1);
}
const historic=fs.readFileSync('docs/FINORA_PHASE1A_MIGRATION_VERSION_DIFF_2026-10-16.md','utf8');
const approvedRemote=historic.split('## Production history entries absent from tracked files')[1].split('## Tracked repo files absent by exact filename')[0];
const approvedLocal=historic.split('## Tracked repo files absent by exact filename')[1].split('**Required before migration:**')[0];
const allowProd=new Set([...approvedRemote.matchAll(/\x60([0-9]{14})_[^\x60]+\.sql\x60/g)].map(m=>m[1]));
const allowLocal=new Set([...approvedLocal.matchAll(/\x60([0-9]{14})_[^\x60]+\.sql\x60/g)].map(m=>m[1]));
for(const v of ['20261007170000','20261016100000','20261016100500','20261016101000','20261016101500','20261016102000','20261016102500','20261016103000','20261016103100'])allowLocal.add(v);
const unexpectedProd=onlyProd.filter(x=>!allowProd.has(x.version));
const unexpectedLocal=onlyRepo.filter(x=>!allowLocal.has(x.version));
const terminal=files.filter(x=>fs.readFileSync(path.join('supabase/migrations',x)).toString().endsWith('\\n'));
const report={productionSnapshot:prod.length,repoFiles:local.length,matched:prod.length-onlyProd.length,onlyProduction:onlyProd,onlyRepository:onlyRepo,terminalLiteralBackslashN:terminal,unexpectedProd,unexpectedLocal,safeToPushToProduction:false,note:'Snapshot not real-time. Production db push remains blocked and requires fresh read-only preflight at cutover.'};
fs.writeFileSync('phase1a-migration-preflight.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({productionSnapshot:prod.length,repository:local.length,productionOnly:onlyProd.length,repoOnly:onlyRepo.length,unexpectedProd:unexpectedProd.length,unexpectedLocal:unexpectedLocal.length,terminalEscapes:terminal.length,productionPush:'PROHIBITED'}));
if(unexpectedProd.length||unexpectedLocal.length)process.exitCode=1;
