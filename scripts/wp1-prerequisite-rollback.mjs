// Generate conservative, data-preserving DOWN definitions on a disposable DB only.
// This is not a production migration executor and accepts no connection string.
import {withDisposableLedger} from './wp0-ledger-harness.mjs';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const generate=process.argv.includes('--generate');
const dir='docs/wp1/evidence/prerequisite-rollback';mkdirSync(dir,{recursive:true});
await withDisposableLedger(async c=>{
 const query=s=>{
  const r=c.sql('\\pset format unaligned\n\\pset tuples_only on\n'+s);
  c.requireSuccess(r,'catalog');return JSON.parse(r.stdout.split('\n').find(x=>x.startsWith('{')));
 };
 const catalog=()=>query(`select json_build_object('functions',coalesce((select json_object_agg(sig,json_build_object('definition',def,'grants',grants)) from (
 select p.oid,n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' sig,pg_get_functiondef(p.oid) def,
 (select coalesce(json_agg(case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end),'[]') from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.privilege_type='EXECUTE' and a.grantee<>p.proowner) grants
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f') f),'{}'),
 'triggers',coalesce((select json_object_agg(quote_ident(n.nspname)||'.'||quote_ident(t.relname)||'|'||quote_ident(g.tgname),pg_get_triggerdef(g.oid)) from pg_trigger g join pg_class t on t.oid=g.tgrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname in ('public','private') and not g.tgisinternal),'{}'));`);
 const migrations=readdirSync('supabase/migrations').filter(x=>x.startsWith('2026101610')&&x.endsWith('.sql')).sort();
 assert.equal(migrations.length,11);
 const baseline=catalog();
 for(const name of migrations){
  const before=catalog();c.requireSuccess(c.sql(readFileSync('supabase/migrations/'+name,'utf8')),name);const after=catalog();
  if(generate){
   const lines=['-- Conservative WP1 DOWN: restore prior definitions/ACLs; retain records, audit, counters, version columns and compatible indexes.','-- Generated from the source-derived disposable baseline. Production schema parity remains a separate gate.'];
   for(const [key,def] of Object.entries(after.triggers))if(before.triggers[key]!==def){const [table,trigger]=key.split('|');lines.push('DROP TRIGGER IF EXISTS '+trigger+' ON '+table+';');if(before.triggers[key])lines.push(before.triggers[key]+';');}
   for(const [sig,fn] of Object.entries(after.functions))if(JSON.stringify(before.functions[sig])!==JSON.stringify(fn)){
    if(before.functions[sig])lines.push(before.functions[sig].definition+';');
    lines.push('REVOKE ALL ON FUNCTION '+sig+' FROM PUBLIC,anon,authenticated,service_role;');
    for(const role of before.functions[sig]?.grants||[])lines.push('GRANT EXECUTE ON FUNCTION '+sig+' TO '+role+';');
   }
   // The newly exposed reversal view stays inert for data-preserving DOWN.
   if(name.includes('journal_rpc_surface'))lines.push('REVOKE ALL ON public.finora_journal_reversal_status FROM PUBLIC,anon,authenticated,service_role;');
   writeFileSync('supabase/rollback/'+name,lines.join('\n\n')+'\n');
  }
 }
 const correction=readdirSync('supabase/migrations').find(x=>x.includes('_wp1_'));
 c.requireSuccess(c.sql(readFileSync('supabase/migrations/'+correction,'utf8')),'correction UP');
 // Existing correction-cycle fixture posts a real voucher and snapshots retained rows.
 const seeded=spawnSync(process.execPath,['scripts/wp1-concurrency.mjs'],{env:{...process.env,WP1_CONTAINER:`finora-wp0-ledger-${process.pid}`},encoding:'utf8'});
 writeFileSync(dir+'/posted-reversal-seed.log',(seeded.stdout||'')+(seeded.stderr||''));
 c.requireSuccess(seeded,'seed actual posted vouchers and partial reversal');
 writeFileSync(dir+'/catalog-baseline.json',JSON.stringify(baseline,null,2)+'\n');
 // Seed separately from application Auth; only synthetic valid rows, no production values.
 c.requireSuccess(c.sql(`insert into auth.users(id,email,raw_user_meta_data) values('a1234567-0000-4000-8000-000000000001','rollback-all@example.invalid','{}');
 insert into private.finora_wp1_company_counters(organization_id,company_id,fiscal_year_id,last_no) select id,'RB_COMPANY','RB_YEAR',17 from public.organizations where owner_user_id='a1234567-0000-4000-8000-000000000001';`),'seed retained counter');
 const fingerprint=()=>query(`select json_build_object('posted_count',(select count(*) from public.records where collection='journalVouchers' and data->>'status'='posted'),'line_count',(select count(*) from public.records where collection='journalLines'),'audit_count',(select count(*) from private.finora_phase1a_journal_audit),'records',md5(coalesce((select string_agg(row_to_json(r)::text,'' order by organization_id,collection,id) from public.records r),'')), 'audit',md5(coalesce((select string_agg(row_to_json(r)::text,'' order by id) from private.finora_phase1a_journal_audit r),'')), 'counters',md5(coalesce((select string_agg(row_to_json(r)::text,'' order by organization_id,company_id,fiscal_year_id) from private.finora_wp1_company_counters r),'')));`);
 const before=fingerprint();assert.ok(before.posted_count>=4&&before.line_count>=8&&before.audit_count>0,'Financial history fixture is empty');
 c.requireSuccess(c.sql(readFileSync('supabase/rollback/'+correction,'utf8')),'correction DOWN');
 for(const name of [...migrations].reverse())c.requireSuccess(c.sql(readFileSync('supabase/rollback/'+name,'utf8')),name+' DOWN');
 assert.deepEqual(fingerprint(),before,'DOWN changed retained rows');
 const down=catalog();for(const [sig,fn] of Object.entries(baseline.functions))assert.deepEqual(down.functions[sig],fn,'Prior function/ACL not restored: '+sig);
 for(const [key,def] of Object.entries(baseline.triggers))assert.equal(down.triggers[key],def,'Prior trigger not restored: '+key);
 // New privileged functions may remain only inaccessible to application roles.
 for(const [sig,fn] of Object.entries(down.functions))if(!baseline.functions[sig])assert.equal(fn.grants.filter(x=>['PUBLIC','anon','authenticated','service_role'].includes(x)).length,0,'Unrevoked candidate API '+sig);
 for(const name of migrations)c.requireSuccess(c.sql(readFileSync('supabase/migrations/'+name,'utf8')),name+' UP again');
 c.requireSuccess(c.sql(readFileSync('supabase/migrations/'+correction,'utf8')),'correction UP again');
 assert.deepEqual(fingerprint(),before,'UP changed retained rows');
 c.requireSuccess(c.sql(readFileSync('supabase/tests/wp1_direct_write_regressions.sql','utf8')),'D1/D2 after full cycle');
 writeFileSync(dir+'/result.json',JSON.stringify({result:'PASS',prerequisites:migrations.length,baselineFunctionCount:Object.keys(baseline.functions).length,retained:before,scope:'conservative rollback preserves inert structures/indexes; NOT pristine schema or production parity'},null,2)+'\n');
 console.log('PASS eleven prerequisite DOWN/UP: baseline function ACLs/triggers restored, retained rows unchanged, D1/D2 enforced again.');
});
