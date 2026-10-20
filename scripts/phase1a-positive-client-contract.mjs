#!/usr/bin/env node
// POSITIVE legacy JS client contract -- must pass before any 1A deployment.
// IMPORTANT: synthetic organization must use guard mode enforce. A default-off
// fixture yields a false green and MUST NOT certify Stage 2 compatibility.
// Existing js/journal-engine.js creates draft with status/number, then posts
// by mutating status/postedAt. Authenticated/RLS path must remain operable
// through an approved server-controlled action contract, not raw field bypass.
import {spawnSync} from 'node:child_process';
const uid='99999999-9999-4999-8999-999999999999';
const org="(SELECT organization_id FROM public.organization_members WHERE user_id='"+uid+"' LIMIT 1)";
const q=s=>"'"+JSON.stringify(s).replace(/'/g,"''")+"'::jsonb";
const voucher={id:'POSITIVE_JV_1',companyId:'CO',fiscalYearId:'FY',date:'1405/07/24',status:'draft',number:'1',totalDebit:100,totalCredit:100,createdBy:uid};
const line=(id,debit,credit)=>({collection:'journalLines',id,data:{voucherId:voucher.id,companyId:'CO',accountId:id,debit,credit},expected_version:0});
const v={collection:'journalVouchers',id:voucher.id,data:voucher,expected_version:0};
const head=["BEGIN;","INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data) VALUES('"+uid+"','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase1a-positive@example.invalid',now(),'{}'::jsonb);","INSERT INTO private.finora_phase1a_guard_modes(organization_id,mode) SELECT organization_id,'enforce' FROM public.organization_members WHERE user_id='"+uid+"';","DO $guard$ BEGIN IF (SELECT mode FROM private.finora_phase1a_guard_modes WHERE organization_id=(SELECT organization_id FROM public.organization_members WHERE user_id='"+uid+"' LIMIT 1)) IS DISTINCT FROM 'enforce' THEN RAISE EXCEPTION 'FINORA_GUARD_NOT_ENFORCE'; END IF; RAISE NOTICE 'FINORA_GUARD_ENFORCE_CONFIRMED'; END $guard$;"].join('\n');
const rpc=(up)=>"SELECT public.finora_sync_records_v2("+q(up)+",'[]'::jsonb,"+org+");";
const scenarios=[
 {name:'existing-client-draft-with-status-and-number',body:[rpc([v])]},
 {name:'existing-client-batched-draft-and-lines',body:[rpc([v,line('JLA',100,0),line('JLB',0,100)])]},
 {name:'existing-client-post-status-transition',body:[
  "INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES("+org+",'"+uid+"','journalVouchers','"+voucher.id+"',"+q(voucher)+");",
  "INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES("+org+",'"+uid+"','journalLines','JLA',"+q(line('JLA',100,0).data)+");",
  "INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES("+org+",'"+uid+"','journalLines','JLB',"+q(line('JLB',0,100).data)+");",
  "SET LOCAL ROLE authenticated;",
  "SELECT set_config('request.jwt.claim.sub','"+uid+"',true);",
  "SELECT public.finora_sync_records_v2("+q([{collection:'journalVouchers',id:voucher.id,expected_version:1,data:{...voucher,status:'posted',postedAt:'2026-10-16T00:00:00Z'}}])+",'[]'::jsonb,"+org+");"
 ]}
];
let pass=0;
for(const s of scenarios){
 const role=s.name==='existing-client-post-status-transition'?[]:["SET LOCAL ROLE authenticated;","SELECT set_config('request.jwt.claim.sub','"+uid+"',true);"];
 const input=[head,...role,...s.body,'ROLLBACK;'].join('\n')+'\n';
 const p=spawnSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres'],{input,encoding:'utf8',env:{...process.env,PGPASSWORD:'postgres'},timeout:25000});
 const ok=p.status===0;
 if(ok)pass++;
 console.log(JSON.stringify({scenario:s.name,result:ok?'PASS':'RED compatibility failure',guardEnforceProved:(p.stderr||'').includes('FINORA_GUARD_ENFORCE_CONFIRMED'),exit:p.status,diagnostic:(p.stderr||'').split('\n').find(x=>/ERROR:/.test(x))?.slice(0,180)||''}));
}
console.log(JSON.stringify({clientContractTotal:scenarios.length,passed:pass,failed:scenarios.length-pass}));
if(pass!==scenarios.length)process.exitCode=1;
