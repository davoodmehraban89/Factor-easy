import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {findPostedToDraftRewrites,auditMigrationDiff} from './accounting-history-migration-guard.mjs';

const dangerous219=String.raw`
DO $$
BEGIN
 UPDATE public.records
 SET data=(data-'postedAt'-'postedBy'-'reversalVoucherId'-'reversedAt')
       ||jsonb_build_object('status','draft','documentStatus','draft','accountingStatus','draft'),
     version=version+1
 WHERE organization_id=r.organization_id AND collection='journalVouchers' AND id=r.id;
END $$;
`;
const dangerous217=String.raw`
UPDATE public.records
 SET data=CASE WHEN collection='journalVouchers' THEN
 (data||jsonb_build_object('status','draft','lifecycleMigrationOriginalStatus',v_status)
 -'postedAt'-'postedBy') ELSE
 (data||jsonb_build_object('documentStatus','draft','accountingStatus','draft')) END
 WHERE organization_id=r.organization_id AND collection=r.collection AND id=r.id;
`;

test('rejects PR217/219-shaped blanket historical posted → draft rewrites',()=>{
 assert.equal(findPostedToDraftRewrites(dangerous219).length,1);
 assert.equal(findPostedToDraftRewrites(dangerous217).length,1);
 assert.equal(findPostedToDraftRewrites("UPDATE public.records SET data=jsonb_set(data,'{documentStatus}','\"draft\"') WHERE id='X';").length,1);
});

test('does not block new draft INSERT, unrelated updates or commented example SQL',()=>{
 const source=[
  "-- UPDATE public.records SET data=jsonb_build_object('status','draft');",
  "/* UPDATE public.records SET data=jsonb_build_object('status','draft'); */",
  "INSERT INTO public.records(organization_id,collection,id,data) VALUES ('o','journalVouchers','v',jsonb_build_object('status','draft'));",
  "UPDATE public.records SET data=jsonb_set(data,'{updatedAt}',to_jsonb(now())) WHERE id='DRAFT';"
 ].join('\n');
 assert.deepEqual(findPostedToDraftRewrites(source),[]);
});

test('only scans added/modified SQL migrations in base-to-head commit diff; blocks unsafe new SQL',()=>{
 const dir=mkdtempSync(join(tmpdir(),'finora-migration-tripwire-'));
 const run=(args,env={})=>{
  const r=spawnSync('git',args,{cwd:dir,encoding:'utf8',timeout:15000,env:{...process.env,...env}});
  assert.equal(r.status,0,r.stderr||r.error?.message);
  return r.stdout.trim();
 };
 const cli=fileURLToPath(new URL('./accounting-history-migration-guard.mjs',import.meta.url));
 try{
  mkdirSync(join(dir,'supabase','migrations'),{recursive:true});
  run(['init','-q']);
  run(['config','user.email','qa@example.invalid']);
  run(['config','user.name','Finora QA']);
  writeFileSync(join(dir,'supabase','migrations','000_safe.sql'),"INSERT INTO public.records(collection,id,data) VALUES ('journalVouchers','J',jsonb_build_object('status','draft'));");
  run(['add','.']);run(['commit','-qm','safe base']);
  const base=run(['rev-parse','HEAD']);
  writeFileSync(join(dir,'supabase','migrations','001_bad.sql'),dangerous219);
  run(['add','.']);run(['commit','-qm','dangerous migration']);
  let x=auditMigrationDiff({base,cwd:dir});
  assert.equal(x.inspected,1);assert.equal(x.violations.length,1);
  assert.equal(x.violations[0].file,'supabase/migrations/001_bad.sql');
  const rejected=spawnSync(process.execPath,[cli],{cwd:dir,encoding:'utf8',
    env:{...process.env,FINORA_MIGRATION_BASE_SHA:base}});
  assert.equal(rejected.status,1);
  assert.match(rejected.stderr,/FINORA_POSTED_HISTORY_DOWNGRADE_BLOCKED/);
  writeFileSync(join(dir,'supabase','migrations','001_bad.sql'),
    "UPDATE public.records SET updated_at=now() WHERE collection='journalVouchers';");
  run(['add','.']);run(['commit','-qm','remove unsafe mutation']);
  x=auditMigrationDiff({base,cwd:dir});
  assert.equal(x.inspected,1);assert.equal(x.violations.length,0);
  const accepted=spawnSync(process.execPath,[cli],{cwd:dir,encoding:'utf8',
    env:{...process.env,FINORA_MIGRATION_BASE_SHA:base}});
  assert.equal(accepted.status,0,accepted.stderr);
  assert.match(accepted.stdout,/FINORA_POSTED_HISTORY_MIGRATION_TRIPWIRE_PASS/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
