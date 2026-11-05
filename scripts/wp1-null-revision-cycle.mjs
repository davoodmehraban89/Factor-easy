// Local disposable source-derived DB only; accepts no remote connection.
import {withDisposableLedger} from './wp0-ledger-harness.mjs';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const migration='20261104214503_wp1_null_revision_guards.sql';
const out=process.env.WP1_EVIDENCE_DIR||'docs/wp1/evidence/null-revision';mkdirSync(out,{recursive:true});
const fixture=readFileSync('supabase/tests/wp1_null_revision_guards.sql','utf8');
await withDisposableLedger(async c=>{
 const steps=[];
 const run=(label,sql,red=false)=>{
  const r=c.sql(sql),log=(r.stdout||'')+(r.stderr||'');writeFileSync(out+'/'+label+'.log',log);
  if(red){assert.notEqual(r.status,0);assert.match(log,/WP1_NULL_REVISION_MISSING: update_null,delete_null,post_null,reverse_null\n/);}
  else c.requireSuccess(r,label);steps.push(label);return r;
 };
 const query=sql=>JSON.parse(run('snapshot','\\pset format unaligned\n\\pset tuples_only on\n'+sql).stdout.split('\n').find(x=>x.startsWith('{')));
 const catalog=()=>query(`select json_object_agg(n.nspname||'.'||p.proname,json_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl::text)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in ('finora_journal_update_draft','finora_journal_delete_draft','finora_journal_reverse')) or (n.nspname='private' and p.proname='finora_phase1a_post_core');`);
 const fingerprint=()=>query(`select json_build_object('posted',(select count(*) from public.records where collection='journalVouchers' and data->>'status'='posted'),'lines',(select count(*) from public.records where collection='journalLines'),'records',md5(coalesce((select string_agg(row_to_json(r)::text,'' order by organization_id,collection,id) from public.records r),'')),'audit',md5(coalesce((select string_agg(row_to_json(a)::text,'' order by id) from private.finora_phase1a_journal_audit a),'')),'counters',md5(coalesce((select string_agg(row_to_json(c)::text,'' order by organization_id,company_id,fiscal_year_id) from private.finora_wp1_company_counters c),'')));`);
 const prior=readdirSync('supabase/migrations').filter(f=>(f.startsWith('2026101610')||f.includes('_wp1_'))&&f.endsWith('.sql')&&f<migration).sort();
 for(const f of prior)c.apply('supabase/migrations/'+f);
 const before=catalog();assert.equal(Object.keys(before).length,4);run('baseline-red',fixture,true);
 run('up1',readFileSync('supabase/migrations/'+migration,'utf8'));const after=catalog();
 for(const key of Object.keys(before)){assert.equal(after[key].acl,before[key].acl);assert.equal(after[key].definition,before[key].definition.replace('.version<>p_expected_version','.version IS DISTINCT FROM p_expected_version'),'Unexpected function change: '+key);}
 run('green-retained',fixture.replace(/rollback;\s*$/i,'commit;'));const retained=fingerprint();assert.equal(retained.posted,3);assert.equal(retained.lines,6);
 run('down',readFileSync('supabase/rollback/'+migration,'utf8'));assert.deepEqual(catalog(),before);assert.deepEqual(fingerprint(),retained);
 run('down-red',fixture.replaceAll('ea000000','eb000000').replaceAll('wp1-null-revision','wp1-null-down'),true);assert.deepEqual(fingerprint(),retained);
 run('up2',readFileSync('supabase/migrations/'+migration,'utf8'));assert.deepEqual(catalog(),after);assert.deepEqual(fingerprint(),retained);
 run('green-up2',fixture.replaceAll('ea000000','ec000000').replaceAll('wp1-null-revision','wp1-null-up2'));assert.deepEqual(fingerprint(),retained);
 const hashes=Object.fromEntries(['supabase/migrations/'+migration,'supabase/rollback/'+migration,'supabase/tests/wp1_null_revision_guards.sql'].map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')]));
 writeFileSync(out+'/result.json',JSON.stringify({result:'PASS',scope:'source-derived isolated SQL; not production parity or HTTP/JWT acceptance',steps,prior,retained,hashes},null,2)+'\n');
 console.log('PASS NULL revision: four baseline bypasses, 16 rejected mutations, valid writes/replays, exact DOWN/UP and retained history.');
});
