// Local Docker-only negative proof and data-preserving UP/DOWN/UP.
import {withDisposableLedger} from './wp0-ledger-harness.mjs';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const migration='20261104020908_wp1_reversal_dimensions.sql';
const out=process.env.WP1_EVIDENCE_DIR||'docs/wp1/evidence/reversal-dimensions';
mkdirSync(out,{recursive:true});
const fixture=readFileSync('supabase/tests/wp1_reversal_dimensions.sql','utf8');
await withDisposableLedger(async c=>{
 const steps=[];
 const run=(label,sql,expectedFailure=false)=>{
  const result=c.sql(sql),output=(result.stdout||'')+(result.stderr||'');
  writeFileSync(out+'/'+label+'.log',output);
  if(expectedFailure){assert.notEqual(result.status,0,'Missing expected RED');assert.match(output,/WP1_REVERSAL_DIMENSIONS_LOST: DIM_FULL_REVERSED/);}
  else c.requireSuccess(result,label);
  steps.push(label);return result;
 };
 const query=sql=>{
  const result=run('snapshot', '\\pset format unaligned\n\\pset tuples_only on\n'+sql);
  return JSON.parse(result.stdout.split('\n').find(line=>line.startsWith('{')));
 };
 const catalog=()=>query(`select json_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl::text) from pg_proc p where p.oid='public.finora_journal_reverse(uuid,text,text,text,text,bigint,jsonb)'::regprocedure;`);
 const fingerprint=()=>query(`select json_build_object('vouchers',(select count(*) from public.records where collection='journalVouchers' and data->>'status'='posted'),'lines',(select count(*) from public.records where collection='journalLines'),'dimensions',(select count(*) from public.records where collection='journalLineDimensions'),'records',md5(coalesce((select string_agg(row_to_json(r)::text,'' order by organization_id,collection,id) from public.records r),'')),'audit',md5(coalesce((select string_agg(row_to_json(a)::text,'' order by id) from private.finora_phase1a_journal_audit a),'')),'counters',md5(coalesce((select string_agg(row_to_json(c)::text,'' order by organization_id,company_id,fiscal_year_id) from private.finora_wp1_company_counters c),'')));`);
 const prior=readdirSync('supabase/migrations').filter(name=>(name.startsWith('2026101610')||name.includes('_wp1_'))&&name.endsWith('.sql')&&name<migration).sort();
 for(const name of prior)c.apply('supabase/migrations/'+name);
 const before=catalog();
 run('baseline-red',fixture,true);
 run('up1',readFileSync('supabase/migrations/'+migration,'utf8'));
 const after=catalog();assert.equal(after.acl,before.acl,'UP changed existing RPC grants');
 assert.notEqual(after.definition,before.definition,'UP did not change reversal implementation');
 run('green-retained',fixture.replace(/ROLLBACK;\s*$/,'COMMIT;'));
 const retained=fingerprint();assert.ok(retained.vouchers>=5&&retained.lines>=14&&retained.dimensions>=14,'Empty retained-history fixture');
 run('down',readFileSync('supabase/rollback/'+migration,'utf8'));
 assert.deepEqual(catalog(),before,'DOWN did not restore exact prior function/ACL');
 assert.deepEqual(fingerprint(),retained,'DOWN changed history');
 run('down-red',fixture.replaceAll('b6000000','b6100000').replaceAll('wp1-dim-','wp1-down-dim-'),true);
 assert.deepEqual(fingerprint(),retained,'Failed DOWN regression changed retained history');
 run('up2',readFileSync('supabase/migrations/'+migration,'utf8'));
 assert.deepEqual(catalog(),after,'UP again changed implementation/grants');
 assert.deepEqual(fingerprint(),retained,'UP changed history');
 run('green-up2',fixture.replaceAll('b6000000','b6200000').replaceAll('wp1-dim-','wp1-up2-dim-'));
 const hashes=Object.fromEntries(['supabase/migrations/'+migration,'supabase/rollback/'+migration,'supabase/tests/wp1_reversal_dimensions.sql'].map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')]));
 writeFileSync(out+'/result.json',JSON.stringify({result:'PASS',scope:'source-derived disposable PostgreSQL; no production parity or JWT acceptance',steps,prior,retained,hashes},null,2)+'\n');
 console.log('PASS reversal dimensions RED/GREEN, exact prior definition/ACL DOWN, retained history, UP again.');
});
