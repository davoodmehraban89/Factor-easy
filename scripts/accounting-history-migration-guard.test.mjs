import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {findPostedToDraftRewrites,findUnsafePublicJournalIdentityRpcs,auditMigrationDiff} from './accounting-history-migration-guard.mjs';

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


// Exact shapes adapted from the unmerged PR219 candidate. These text fixtures
// are never migrated or executed: they exercise the SECURITY workflow guard.
const exposedPr219IdentityFunctions=String.raw`
CREATE OR REPLACE FUNCTION public.finora_journal_allocate_identity(
 p_org uuid,p_company text,p_fy text,p_voucher text,p_actor uuid DEFAULT auth.uid()
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $identity$
BEGIN
 INSERT INTO public.finora_journal_document_registry(organization_id,company_id,voucher_id,created_by)
 VALUES(p_org,p_company,p_voucher,p_actor);
 RETURN '{}'::jsonb;
END $identity$;
CREATE OR REPLACE FUNCTION public.finora_journal_post_identity(
 p_org uuid,p_voucher text,p_actor uuid DEFAULT auth.uid()
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $identity$
BEGIN
 UPDATE public.finora_journal_document_registry
 SET state='posted',posted_by=p_actor WHERE organization_id=p_org AND voucher_id=p_voucher;
 RETURN '{}'::jsonb;
END $identity$;
CREATE OR REPLACE FUNCTION public.finora_journal_delete_identity(
 p_org uuid,p_voucher text,p_actor uuid DEFAULT auth.uid()
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $identity$
BEGIN
 UPDATE public.finora_journal_document_registry
 SET state='deleted',deleted_by=p_actor WHERE organization_id=p_org AND voucher_id=p_voucher;
 RETURN '{}'::jsonb;
END $identity$;
GRANT EXECUTE ON FUNCTION public.finora_journal_allocate_identity(uuid,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finora_journal_post_identity(uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finora_journal_delete_identity(uuid,text,uuid) TO authenticated;
`;

test('PR219-shaped public identity RPCs trigger actor, registry-post and phantom-allocation review',()=>{
 const issues=findUnsafePublicJournalIdentityRpcs(exposedPr219IdentityFunctions);
 assert.equal(issues.length,5);
 assert.equal(issues.filter(x=>x.reason.includes('p_actor')).length,3);
 assert.equal(issues.filter(x=>x.reason.includes('registry-only posted')).length,1);
 assert.equal(issues.filter(x=>x.reason.includes('persisted voucher')).length,1);
 assert.ok(issues.every(x=>x.kind==='identity-rpc'&&Number.isInteger(x.line)));
});

test('safe private identity implementation and public canonical post wrapper do not trigger heuristic',()=>{
 const safe=String.raw`
CREATE OR REPLACE FUNCTION private.finora_journal_allocate_identity(p_org uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN UPDATE public.finora_journal_document_registry SET state='posted'; END $$;
CREATE OR REPLACE FUNCTION public.finora_journal_post_identity(p_org uuid,p_voucher text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN public.finora_journal_post(p_org,p_voucher,1); END $$;
GRANT EXECUTE ON FUNCTION public.finora_journal_post_identity(uuid,text) TO authenticated;
`;
 assert.deepEqual(findUnsafePublicJournalIdentityRpcs(safe),[]);
 assert.deepEqual(findUnsafePublicJournalIdentityRpcs(
  exposedPr219IdentityFunctions.split('\n').map(s=>'-- '+s).join('\n')),[]);
});

test('PR migration base-to-head diff blocks exposed candidate RPCs; clean version passes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'finora-identity-tripwire-'));
 const run=args=>{
  const r=spawnSync('git',args,{cwd:dir,encoding:'utf8',timeout:15000});
  assert.equal(r.status,0,r.stderr||r.error?.message);
  return r.stdout.trim();
 };
 const cli=fileURLToPath(new URL('./accounting-history-migration-guard.mjs',import.meta.url));
 try{
  mkdirSync(join(dir,'supabase','migrations'),{recursive:true});
  run(['init','-q']);
  run(['config','user.email','qa@example.invalid']);
  run(['config','user.name','Finora QA']);
  writeFileSync(join(dir,'supabase','migrations','000_baseline.sql'),'SELECT 1;');
  run(['add','.']);run(['commit','-qm','baseline']);
  const base=run(['rev-parse','HEAD']);
  writeFileSync(join(dir,'supabase','migrations','001_public_identity.sql'),exposedPr219IdentityFunctions);
  run(['add','.']);run(['commit','-qm','unsafe identity RPC']);
  let report=auditMigrationDiff({base,cwd:dir});
  assert.equal(report.inspected,1);
  assert.equal(report.violations.length,5);
  assert.ok(report.violations.every(x=>x.file==='supabase/migrations/001_public_identity.sql'));
  const blocked=spawnSync(process.execPath,[cli],{cwd:dir,encoding:'utf8',
   env:{...process.env,FINORA_MIGRATION_BASE_SHA:base}});
  assert.equal(blocked.status,1);
  assert.match(blocked.stderr,/FINORA_IDENTITY_RPC_MIGRATION_BLOCKED/);
  // A private trusted internal helper and normal public journal post wrapper
  // do not require publicly callable identity-state transitions.
  writeFileSync(join(dir,'supabase','migrations','001_public_identity.sql'),
   "CREATE FUNCTION private.safe_identity() RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;");
  run(['add','.']);run(['commit','-qm','remove exposed identity helper']);
  report=auditMigrationDiff({base,cwd:dir});
  assert.equal(report.inspected,1);
  assert.deepEqual(report.violations,[]);
  const allowed=spawnSync(process.execPath,[cli],{cwd:dir,encoding:'utf8',
   env:{...process.env,FINORA_MIGRATION_BASE_SHA:base}});
  assert.equal(allowed.status,0,allowed.stderr);
  assert.match(allowed.stdout,/FINORA_IDENTITY_RPC_MIGRATION_TRIPWIRE_PASS/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
