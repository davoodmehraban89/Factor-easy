import {withDisposableLedger} from './wp0-ledger-harness.mjs';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const correction='20261102141933_wp1_ledger_scope_authority_hardening.sql';
const out=process.env.WP1_EVIDENCE_DIR||'/tmp/wp1-correction-cycle';
mkdirSync(out,{recursive:true});
await withDisposableLedger(async c=>{
 const steps=[];
 const run=(label,sql)=>{
  const r=c.sql(sql);writeFileSync(out+'/'+label+'.log',(r.stdout||'')+(r.stderr||''));
  c.requireSuccess(r,label);steps.push(label);return r;
 };
 for(const f of readdirSync('supabase/migrations').filter(x=>x.startsWith('2026101610')&&x.endsWith('.sql')).sort())c.apply('supabase/migrations/'+f);
 run('up1',readFileSync('supabase/migrations/'+correction,'utf8'));
 run('up1-negatives',readFileSync('supabase/tests/wp1_posting_negatives.sql','utf8'));
 run('up1-shadow',readFileSync('supabase/tests/wp1_shadow_and_constraint_contract.sql','utf8'));
 // Durable synthetic sentinel proves DOWN does not rewrite ledger rows/counters.
 run('seed-sentinel',`insert into auth.users(id,email,raw_user_meta_data) values('b4000000-0000-4000-8000-000000000001','wp1-cycle@example.invalid','{}');
 insert into private.finora_wp1_company_counters(organization_id,company_id,fiscal_year_id,last_no)
 select id,'WP1_CYCLE_C','WP1_CYCLE_Y',17 from public.organizations where owner_user_id='b4000000-0000-4000-8000-000000000001';
 insert into public.records(owner_id,organization_id,collection,id,data)
 select owner_user_id,id,'settings','WP1_CYCLE_SENTINEL','{"marker":"unchanged"}' from public.organizations where owner_user_id='b4000000-0000-4000-8000-000000000001';`);
 run('down',readFileSync('supabase/rollback/'+correction,'utf8'));
 run('down-contract',`do $$begin
 if private.finora_phase1a_mode('00000000-0000-0000-0000-000000000000')<>'off' then raise exception 'DOWN_MODE_NOT_RESTORED';end if;
 if not exists(select from public.records where id='WP1_CYCLE_SENTINEL' and data='{"marker":"unchanged"}'::jsonb) then raise exception 'DOWN_MUTATED_SENTINEL';end if;
 if not exists(select from private.finora_wp1_company_counters where company_id='WP1_CYCLE_C' and last_no=17) then raise exception 'DOWN_LOST_COUNTER_HISTORY';end if;
 end $$;`);
 const downNeg=c.sql(readFileSync('supabase/tests/wp1_posting_negatives.sql','utf8'));
 writeFileSync(out+'/down-negatives.log',(downNeg.stdout||'')+(downNeg.stderr||''));
 assert.notEqual(downNeg.status,0,'DOWN must restore vulnerable pre-correction behavior');
 // Require the previously reproduced defects, never an unrelated setup failure.
 assert.match(downNeg.stderr,/WP1_INVALID_POSTING_ACCEPTED: closed,wrong_company,wrong_year,currency/);
 steps.push('down-negative-observed');
 run('up2',readFileSync('supabase/migrations/'+correction,'utf8'));
 run('up2-negatives',readFileSync('supabase/tests/wp1_posting_negatives.sql','utf8'));
 run('up2-direct',readFileSync('supabase/tests/wp1_direct_write_regressions.sql','utf8'));
 run('up2-shadow',readFileSync('supabase/tests/wp1_shadow_and_constraint_contract.sql','utf8'));
 writeFileSync(out+'/cycle-result.json',JSON.stringify({scope:'correction migration only; prior eleven migrations remain installed; DOWN retains new counters/helpers and is not pristine schema rollback',result:'PASS',steps},null,2)+'\n');
 console.log('PASS WP1 correction UP/DOWN/UP; no ledger/history deletion; eleven prerequisite DOWN scripts NOT VERIFIED.');
});
