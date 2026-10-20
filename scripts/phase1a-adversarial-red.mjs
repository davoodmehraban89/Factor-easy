#!/usr/bin/env node
// Isolated Supabase CLI red-first adversarial tests. NEVER point at Production.
// Uses synthetic auth.users and SET ROLE authenticated, real RLS and real RPC.
// Each test runs inside a transaction which is always rolled back on disconnect.
import {spawnSync} from 'node:child_process';
const USER_A='11111111-1111-4111-8111-111111111111';
const USER_B='22222222-2222-4222-8222-222222222222';
const ORG_A="(select organization_id from public.organization_members where user_id='"+USER_A+"' limit 1)";
const ORG_B="(select organization_id from public.organization_members where user_id='"+USER_B+"' limit 1)";
const seed=[
 "begin;",
 "insert into auth.users (id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data) values",
 " ('"+USER_A+"','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase1a-a@example.invalid',now(),'{}'::jsonb),",
 " ('"+USER_B+"','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase1a-b@example.invalid',now(),'{}'::jsonb);",
 "insert into private.finora_phase1a_guard_modes(organization_id,mode) select organization_id,'enforce' from public.organization_members where user_id in ('"+USER_A+"','"+USER_B+"');",
].join('\n');
function rec(org,uid,coll,id,data){
 return "insert into public.records(organization_id,owner_id,collection,id,data) values ("+org+",'"+uid+"','"+coll+"','"+id+"','"+JSON.stringify(data).replace(/'/g,"''")+"'::jsonb);";
}
const draft = {companyId:'COMP1',fiscalYearId:'FY1',date:'1405/07/24',number:'50',status:'draft',totalDebit:100,totalCredit:0};
const posted = {...draft,status:'posted',number:'51',totalDebit:100,totalCredit:100,postedAt:'2026-10-16T09:00:00Z'};
const jl=(id,voucherId,debit,credit)=>rec(ORG_A,USER_A,'journalLines',id,{voucherId,companyId:'COMP1',accountId:'ACC1',debit,credit});
const tests=[
 {id:'draft-to-posted-unbalanced', setup:[rec(ORG_A,USER_A,'journalVouchers','V001',draft),jl('L001','V001',100,0)], act:"update public.records set data=jsonb_set(data,'{status}','\"posted\"'::jsonb) where collection='journalVouchers' and id='V001';", policy:'block'},
 {id:'direct-insert-posted',act:rec(ORG_A,USER_A,'journalVouchers','V002',posted),policy:'block'},
 {id:'sync-direct-status-number-postedAt',setup:[rec(ORG_A,USER_A,'journalVouchers','V003',draft)],act:"select public.finora_sync_records(jsonb_build_array(jsonb_build_object('collection','journalVouchers','id','V003','data',jsonb_build_object('status','posted','number','999','postedAt','2026-10-16T09:00:00Z','companyId','COMP1','fiscalYearId','FY1','date','1405/07/24'))),'[]'::jsonb,"+ORG_A+");",policy:'block'},
 {id:'direct-insert-line-under-posted',setup:[rec(ORG_A,USER_A,'journalVouchers','V004',posted),jl('L004a','V004',100,0),jl('L004b','V004',0,100)],act:jl('L004c','V004',1,0),policy:'block'},
 {id:'direct-insert-dimension-under-posted',setup:[rec(ORG_A,USER_A,'journalVouchers','V005',posted),jl('L005a','V005',100,0),jl('L005b','V005',0,100)],act:rec(ORG_A,USER_A,'journalLineDimensions','LD005',{voucherId:'V005',journalLineId:'L005a',dimensionTypeId:'DT1',dimensionValueId:'DV1'}),policy:'block'},
 {id:'cross-org-voucher-id',setup:[rec(ORG_B,USER_B,'journalVouchers','CROSS01',posted)],act:jl('CROSSJL','CROSS01',5,0),policy:'block'},
 {id:'negative-rials',act:jl('BADNEG','NOTPOSTED',-1,0),policy:'block'},
 {id:'fractional-rials',act:jl('BADDEC','NOTPOSTED',1.5,0),policy:'block'},
 {id:'string-rials',act:jl('BADSTR','NOTPOSTED','100',0),policy:'block'},
 {id:'null-rials',act:jl('BADNULL','NOTPOSTED',null,0),policy:'block'},
 {id:'legacy-two-arg-sync',act:"select public.finora_sync_records('[{\"collection\":\"settings\",\"id\":\"main\",\"data\":{\"phase1aSynthetic\":true}}]'::jsonb,'[]'::jsonb);",policy:'allow'}
];
let fail=0,blocked=0,allowed=0,infra=0;
for(const x of tests){
 const start=[seed,...(x.setup||[])];
 const sql=[...start,"set local role authenticated;","select set_config('request.jwt.claim.sub','"+USER_A+"',true);",x.act,"rollback;"].join('\n')+'\n';
 const r=spawnSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres'],{input:sql,env:{...process.env,PGPASSWORD:'postgres'},encoding:'utf8',timeout:25000});
 const denied=r.status!==0, diagnostic=(r.stderr||'').split('\n').filter(Boolean).slice(-3).join(' ').slice(0,180);
 // After the fix, financial prohibitions must report a specific FINORA_ validation error.
 const targeted=/FINORA_/i.test(r.stderr||'');
 let status;
 if(x.policy==='block' && denied && targeted){status='PASS guarded';blocked++}
 else if(x.policy==='allow'&&!denied){status='PASS compatible';allowed++}
 else if(x.policy==='block'&&!denied){status='RED write accepted';fail++}
 else if(x.policy==='allow'&&denied){status='RED legacy compatibility broken';fail++}
 else{status='INFRA/OTHER ERROR (not an acceptable guard)';infra++;fail++}
 console.log(JSON.stringify({case:x.id,result:status,exit:r.status,diagnostic}));
}
console.log(JSON.stringify({total:tests.length,blocked,allowed,fail,infra}));
if(fail)process.exitCode=1;
