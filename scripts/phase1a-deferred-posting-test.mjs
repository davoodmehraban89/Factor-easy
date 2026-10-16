#!/usr/bin/env node
// Independently exercise deferred balance as a *trusted server* transaction.
// These are not browser writes; browser journal lifecycle writes are forbidden.
import {spawnSync} from 'node:child_process';
const UID='77777777-7777-4777-8777-777777777777';
const org="(select organization_id from public.organization_members where user_id='"+UID+"' limit 1)";
function rec(coll,id,data){
 return "INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES("+org+",'"+UID+"','"+coll+"','"+id+"','"+JSON.stringify(data).replace(/'/g,"''")+"'::jsonb);";
}
const meta={companyId:'TEST',fiscalYearId:'FY',date:'1405/07/24',number:'100',status:'draft'};
const setup="BEGIN; INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data) VALUES('"+UID+"','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase1a-def@example.invalid',now(),'{}'::jsonb);";
const voucher=(id,status)=>rec('journalVouchers',id,{...meta,status});
const line=(id,voucherId,debit,credit)=>rec('journalLines',id,{voucherId,companyId:'TEST',accountId:id,debit,credit});
const post=id=>"UPDATE public.records SET data=jsonb_set(data,'{status}','\"posted\"'::jsonb) WHERE organization_id="+org+" AND collection='journalVouchers' AND id='"+id+"';";
const cases=[
 {id:'posted-insert-no-lines-deferred',sql:[voucher('T100','posted')],blocked:true},
 {id:'draft-to-posted-one-line-deferred',sql:[voucher('T101','draft'),line('L101','T101',100,0),post('T101')],blocked:true},
 {id:'draft-to-posted-two-unbalanced-lines-deferred',sql:[voucher('T102','draft'),line('L102a','T102',100,0),line('L102b','T102',0,99),post('T102')],blocked:true},
 {id:'draft-to-posted-balanced-lines-deferred',sql:[voucher('T103','draft'),line('L103a','T103',100,0),line('L103b','T103',0,100),post('T103')],blocked:false}
];
let failures=0;
for(const scenario of cases){
 const sql=[setup,...scenario.sql,'SET CONSTRAINTS ALL IMMEDIATE;','ROLLBACK;'].join('\n')+'\n';
 const z=spawnSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres'],{input:sql,encoding:'utf8',env:{...process.env,PGPASSWORD:'postgres'},timeout:25000});
 const passed=scenario.blocked?(z.status!==0&&(z.stderr||'').includes('FINORA_UNBALANCED_POSTED_JOURNAL')):z.status===0;
 if(!passed)failures++;
 console.log(JSON.stringify({case:scenario.id,result:passed?'PASS':'FAIL',exit:z.status,diagnostic:(z.stderr||'').slice(0,180)}));
}
console.log(JSON.stringify({total:cases.length,passed:cases.length-failures,failed:failures}));
if(failures)process.exitCode=1;
