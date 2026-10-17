#!/usr/bin/env node
import {spawn} from 'node:child_process';
(async function main(){
 const U='abcd7777-7777-4777-8777-777777777777';
 const org=`(SELECT organization_id FROM public.organization_members WHERE user_id='${U}')`;
 function run(sql){
  return new Promise((resolve,reject)=>{
   const p=spawn('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres'],{env:{...process.env,PGPASSWORD:'postgres'},stdio:['pipe','pipe','pipe']});
   let stdout='',stderr='';
   p.stdout.on('data',x=>stdout+=x);p.stderr.on('data',x=>stderr+=x);
   p.on('error',reject);p.on('close',exit=>resolve({exit,stdout,stderr}));
   p.stdin.end(sql);
  });
 }
 function check(ok,name,diagnostic=''){
  console.log(JSON.stringify({name,pass:ok,diagnostic:String(diagnostic).slice(-180)}));
  if(!ok)throw Error(`FINORA_CONCURRENCY_${name}`);
 }
 const setup=`
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data)
VALUES('${U}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase1a-concurrency@example.invalid',now(),'{}'::jsonb);
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
SELECT organization_id,user_id,'companies','COMP_RACE','{"name":"Concurrent Test"}'::jsonb
FROM public.organization_members WHERE user_id='${U}';
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
SELECT organization_id,user_id,'fiscalYears','FY_RACE',
'{"companyId":"COMP_RACE","startDate":"1405/01/01","endDate":"1405/12/29","status":"open"}'::jsonb
FROM public.organization_members WHERE user_id='${U}';
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
SELECT organization_id,user_id,'accounts','RACE_ACC_'||n,
jsonb_build_object('companyId','COMP_RACE','postingAllowed',true,'active',true)
FROM public.organization_members CROSS JOIN generate_series(1,2) n
WHERE user_id='${U}';
INSERT INTO private.finora_phase1a_guard_modes(organization_id,mode)
SELECT organization_id,'enforce' FROM public.organization_members WHERE user_id='${U}';
COMMIT;`;
 const x=await run(setup);check(x.exit===0,'fixture',x.stderr);
 const auth=`SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${U}',true);`;
 const trans=q=>`BEGIN;\n${auth}\n${q}\nCOMMIT;`;
 const header=JSON.stringify({companyId:'COMP_RACE',fiscalYearId:'FY_RACE',date:'1405/07/24'});
 const lines=JSON.stringify([{accountId:'RACE_ACC_1',debit:1000,credit:0},{accountId:'RACE_ACC_2',debit:0,credit:1000}]);
 const draft=id=>`SELECT public.finora_journal_create_draft(${org},'${id}','${header}'::jsonb,'${lines}'::jsonb);`;
 const seed=await run(trans(`${draft('RACE_00001')}\n${draft('RACE_00002')}`));check(seed.exit===0,'drafts',seed.stderr);
 // Actual two-connection concurrent create with identical id and payload.
 const [dblA,dblB]=await Promise.all([
  run(trans(draft('RACE_DOUBLE_CLICK'))),
  run(trans(draft('RACE_DOUBLE_CLICK')))
 ]);
 check(dblA.exit===0&&dblB.exit===0,'simultaneous_duplicate_create',dblA.stderr+' '+dblB.stderr);
 const dblRows=await run(`SELECT
 (SELECT count(*) FROM public.records WHERE organization_id=${org}
 AND collection='journalVouchers' AND id='RACE_DOUBLE_CLICK')::text||','||
 (SELECT count(*) FROM public.records WHERE organization_id=${org}
 AND collection='journalLines' AND data->>'voucherId'='RACE_DOUBLE_CLICK')::text;`);
 check(dblRows.exit===0&&dblRows.stdout.trim()==='1,2',
  'concurrent_double_click_one_voucher_two_lines',dblRows.stdout);
 const [a,b]=await Promise.all([
  run(trans(`SELECT public.finora_journal_post(${org},'RACE_00001',1);`)),
  run(trans(`SELECT public.finora_journal_post(${org},'RACE_00002',1);`))
 ]);
 check(a.exit===0&&b.exit===0,'two_posts',a.stderr+' '+b.stderr);
 const numbered=await run(`SELECT string_agg(data->>'number',',' ORDER BY (data->>'number')::int) FROM public.records WHERE organization_id=${org} AND collection='journalVouchers' AND id IN ('RACE_00001','RACE_00002');`);
 check(numbered.exit===0&&numbered.stdout.trim()==='1,2','gapless_numbers',numbered.stdout);
 const third=await run(trans(`${draft('RACE_ORIGINAL')}\nSELECT public.finora_journal_post(${org},'RACE_ORIGINAL',1);`));check(third.exit===0,'original',third.stderr);
 const allocations=`(SELECT jsonb_agg(jsonb_build_object('lineId',id,'amount',600))
 FROM public.records WHERE organization_id=${org}
 AND collection='journalLines' AND data->>'voucherId'='RACE_ORIGINAL')`;
 const [r1,r2]=await Promise.all([
  run(trans(`SELECT public.finora_journal_reverse(${org},'RACE_ORIGINAL','RACE_REV_A','1405/07/24','Two partial overlapping reversals',2,${allocations});`)),
  run(trans(`SELECT public.finora_journal_reverse(${org},'RACE_ORIGINAL','RACE_REV_B','1405/07/24','Two partial overlapping reversals',2,${allocations});`))
 ]);
 const winners=[r1,r2].filter(x=>x.exit===0).length,blocked=[r1,r2].filter(x=>x.exit!==0&&x.stderr.includes('FINORA_REVERSAL_OVER_ALLOCATION')).length;
 check(winners===1&&blocked===1,'two_reversals_one_winner',r1.stderr+' '+r2.stderr);
 const count=await run(`SELECT count(*) FROM public.records WHERE organization_id=${org} AND collection='journalVouchers' AND data->>'sourceType'='reversal' AND data->>'sourceId'='RACE_ORIGINAL' AND data->>'status'='posted';`);
 check(count.exit===0&&count.stdout.trim()==='1','no_duplicate_reversals',count.stdout);
 const effective=await run(`SELECT effective_status FROM public.finora_journal_reversal_status
 WHERE organization_id=${org} AND voucher_id='RACE_ORIGINAL';`);
 check(effective.exit===0&&effective.stdout.trim()==='partially_reversed',
 'partial_status_from_view',effective.stdout);
 console.log('FINORA_STAGE1_TWO_CONNECTIONS_PASS');
})().catch(err=>{console.error(err);process.exitCode=1});
