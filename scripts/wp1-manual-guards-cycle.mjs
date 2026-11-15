// Local source-derived Docker DB only; accepts no remote endpoint.
import {withDisposableLedger} from './wp0-ledger-harness.mjs';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const migration='20261104072719_wp1_manual_update_guards.sql';
const out=process.env.WP1_EVIDENCE_DIR||'docs/wp1/evidence/manual-update-guards';mkdirSync(out,{recursive:true});
const fixture=readFileSync('supabase/tests/wp1_manual_update_guards.sql','utf8');
await withDisposableLedger(async c=>{
 const steps=[];
 const run=(label,sql,red=false)=>{
  const result=c.sql(sql),output=(result.stdout||'')+(result.stderr||'');writeFileSync(out+'/'+label+'.log',output);
  if(red){assert.notEqual(result.status,0);const match=output.match(/WP1_MANUAL_GUARDS_MISSING: ([a-z0-9_,]+)/);assert.ok(match,'Unrelated RED failure');assert.equal(match[1].split(',').length,17,'Expected all 17 reproduced bypasses');}
  else c.requireSuccess(result,label);steps.push(label);return result;
 };
 const query=sql=>JSON.parse(run('snapshot','\\pset format unaligned\n\\pset tuples_only on\n'+sql).stdout.split('\n').find(line=>line.startsWith('{')));
 const catalog=()=>query(`select json_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl::text,'guards',(select coalesce(json_agg(pg_get_triggerdef(oid) order by tgname),'[]') from pg_trigger where tgrelid='public.records'::regclass and tgname like 'trg_finora_wp1_manual_header_%'),'helper',(select json_build_object('definition',pg_get_functiondef(h.oid),'acl',h.proacl::text) from pg_proc h join pg_namespace n on n.oid=h.pronamespace where n.nspname='private' and h.proname='finora_wp1_guard_manual_header')) from pg_proc p where p.oid='public.finora_journal_update_draft(uuid,text,bigint,jsonb,jsonb)'::regprocedure;`);
 const fingerprint=()=>query(`select json_build_object('posted',(select count(*) from public.records where collection='journalVouchers' and data->>'status'='posted'),'lines',(select count(*) from public.records where collection='journalLines'),'records',md5(coalesce((select string_agg(row_to_json(r)::text,'' order by organization_id,collection,id) from public.records r),'')),'audit',md5(coalesce((select string_agg(row_to_json(a)::text,'' order by id) from private.finora_phase1a_journal_audit a),'')),'counters',md5(coalesce((select string_agg(row_to_json(c)::text,'' order by organization_id,company_id,fiscal_year_id) from private.finora_wp1_company_counters c),'')),'modes',md5(coalesce((select string_agg(row_to_json(g)::text,'' order by organization_id) from private.finora_phase1a_guard_modes g),'')));`);
 const prior=readdirSync('supabase/migrations').filter(name=>(name.startsWith('2026101610')||name.includes('_wp1_'))&&name.endsWith('.sql')&&name<migration).sort();
 for(const name of prior)c.apply('supabase/migrations/'+name);
 const before=catalog();run('baseline-red',fixture,true);
 run('up1',readFileSync('supabase/migrations/'+migration,'utf8'));
 const after=catalog();assert.equal(after.acl,before.acl,'Update RPC grants changed');assert.equal(after.guards.length,2);assert.notEqual(after.definition,before.definition);
 run('green-retained',fixture.replace(/rollback;\s*$/i,'commit;'));
 const retained=fingerprint();assert.ok(retained.posted>=1&&retained.lines>=8,'Retained financial fixture missing');
 run('down',readFileSync('supabase/rollback/'+migration,'utf8'));
 assert.deepEqual(catalog(),before,'DOWN failed exact function/ACL/trigger restoration');assert.deepEqual(fingerprint(),retained,'DOWN changed financial records');
 run('down-red',fixture.replaceAll('e9000000','e9100000').replaceAll('wp1-manual-guards','wp1-manual-down'),true);
 assert.deepEqual(fingerprint(),retained,'RED proof changed existing history');
 run('up2',readFileSync('supabase/migrations/'+migration,'utf8'));
 assert.deepEqual(catalog(),after);assert.deepEqual(fingerprint(),retained,'UP changed history');
 run('green-up2',fixture.replaceAll('e9000000','e9200000').replaceAll('wp1-manual-guards','wp1-manual-up2'));
 const hashes=Object.fromEntries(['supabase/migrations/'+migration,'supabase/rollback/'+migration,'supabase/tests/wp1_manual_update_guards.sql'].map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')]));
 writeFileSync(out+'/result.json',JSON.stringify({result:'PASS',scope:'source-derived isolated DB; not real HTTP/JWT or production parity',steps,prior,retained,hashes},null,2)+'\n');
 console.log('PASS manual guards: 17 RED/GREEN negatives, compatibility, exact DOWN/UP restoration and retained history.');
});
