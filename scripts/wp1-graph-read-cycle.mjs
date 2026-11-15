// Source-derived disposable PostgreSQL only; no remote URL accepted.
import {withDisposableLedger} from './wp0-ledger-harness.mjs';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const migration='20261104220102_wp1_journal_graph_read.sql';
const out=process.env.WP1_EVIDENCE_DIR||'docs/wp1/evidence/graph-read';mkdirSync(out,{recursive:true});
const fixture=readFileSync('supabase/tests/wp1_journal_graph_read.sql','utf8');
await withDisposableLedger(async c=>{
 const steps=[];
 const run=(label,sql,red=false)=>{const r=c.sql(sql),log=(r.stdout||'')+(r.stderr||'');writeFileSync(out+'/'+label+'.log',log);if(red){assert.notEqual(r.status,0);assert.match(log,/WP1_GRAPH_RPC_MISSING/);}else c.requireSuccess(r,label);steps.push(label);return r;};
 const query=sql=>JSON.parse(run('snapshot','\\pset format unaligned\n\\pset tuples_only on\n'+sql).stdout.split('\n').find(x=>x.startsWith('{')));
 const catalog=()=>query(`select coalesce(json_object_agg(n.nspname||'.'||p.proname,json_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl::text)),'{}') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname='finora_journal_read_graph') or (n.nspname='private' and p.proname='finora_journal_graph_accessible');`);
 const fingerprint=()=>query(`select json_build_object('posted',(select count(*) from public.records where collection='journalVouchers' and data->>'status'='posted'),'lines',(select count(*) from public.records where collection='journalLines'),'records',md5(coalesce((select string_agg(row_to_json(r)::text,'' order by organization_id,collection,id) from public.records r),'')),'audit',md5(coalesce((select string_agg(row_to_json(a)::text,'' order by id) from private.finora_phase1a_journal_audit a),'')),'counters',md5(coalesce((select string_agg(row_to_json(c)::text,'' order by organization_id,company_id,fiscal_year_id) from private.finora_wp1_company_counters c),'')),'members',md5(coalesce((select string_agg(row_to_json(m)::text,'' order by id) from public.organization_members m),'')),'permissions',md5(coalesce((select string_agg(row_to_json(m)::text,'' order by id) from public.member_module_permissions m),'')));`);
 const prior=readdirSync('supabase/migrations').filter(f=>(f.startsWith('2026101610')||f.includes('_wp1_'))&&f.endsWith('.sql')&&f<migration).sort();for(const f of prior)c.apply('supabase/migrations/'+f);
 assert.deepEqual(catalog(),{});run('baseline-red',fixture,true);
 run('up1',readFileSync('supabase/migrations/'+migration,'utf8'));const after=catalog();assert.equal(Object.keys(after).length,2);
 run('green-retained',fixture.replace(/rollback;\s*$/i,'commit;'));const retained=fingerprint();assert.equal(retained.posted,3);assert.equal(retained.lines,1010);
 run('read-only-probe',String.raw`\timing on
select set_config('request.jwt.claim.sub','ed000000-0000-4000-8000-000000000001',false);
set role authenticated;
select 'large_graph' as probe,jsonb_array_length(public.finora_journal_read_graph((select id from public.organizations where owner_user_id='ed000000-0000-4000-8000-000000000001'),'GR_LARGE')->'records') as rows;
select 'posted_graph' as probe,public.finora_journal_read_graph((select id from public.organizations where owner_user_id='ed000000-0000-4000-8000-000000000001'),'GR_DOC')->>'effective_status' as status;
`);assert.deepEqual(fingerprint(),retained,'Read API changed records/audit/counters/members/permissions');
 run('definer-security',readFileSync('supabase/tests/wp1_phase1a_stage1_all_definer_security.sql','utf8'));
 run('down',readFileSync('supabase/rollback/'+migration,'utf8'));assert.deepEqual(catalog(),{});assert.deepEqual(fingerprint(),retained);
 run('down-red',fixture,true);assert.deepEqual(fingerprint(),retained);
 run('up2',readFileSync('supabase/migrations/'+migration,'utf8'));assert.deepEqual(catalog(),after);assert.deepEqual(fingerprint(),retained);
 run('green-up2',fixture.replaceAll('ed000000','ee000000').replaceAll('wp1-graph-','wp1-graph-up2-'));assert.deepEqual(fingerprint(),retained);
 const hashes=Object.fromEntries(['supabase/migrations/'+migration,'supabase/rollback/'+migration,'supabase/tests/wp1_journal_graph_read.sql'].map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')]));
 writeFileSync(out+'/result.json',JSON.stringify({result:'PASS',scope:'source-derived SQL, not real Auth/JWT/PostgREST, schema parity or performance acceptance',steps,prior,retained,hashes},null,2)+'\n');
 console.log('PASS graph read: RLS/full-graph checks,1003-row graph,statuses,corruption,security audit,exact DOWN/UP and unchanged history/permissions.');
});
