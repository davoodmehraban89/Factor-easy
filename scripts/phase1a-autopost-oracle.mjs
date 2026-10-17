#!/usr/bin/env node
// FINORA Stage1 source oracle — independent JS arithmetic, isolated Postgres only.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const kind=process.argv[2],N=1000,seed=20261017;
if(kind!=='sale'&&kind!=='purchase')throw Error('Use sale or purchase');
let x=seed;const rand=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0};
const pick=n=>rand()%n,div=n=>Math.floor((n+50)/100);
const uid='aaaa1111-1111-4111-8111-111111111111';
const quote=z=>"'"+String(z).replaceAll("'","''")+"'";
const specs=[
 ['CASH','1101','cash_default','asset','debit'],
 ['AR','1102','receivable_control','asset','debit'],
 ['REV','4101','revenue_default','revenue','credit'],
 ['VATP','2102','vat_payable','liability','credit'],
 ['PUR','5101','purchase_default','expense','debit'],
 ['AP','2101','payable_control','liability','credit'],
 ['VATR','1108','vat_recoverable','asset','debit']];
const binds=Object.fromEntries(specs.map(a=>[a[2],a[0]]));
const samples=[];
for(let i=0;i<N;i++){
 const items=Array.from({length:1+pick(4)},()=>{const qty=1+pick(8),price=50+pick(6000);return{qty,price,lineTotal:qty*price}});
 const subtotal=items.reduce((s,z)=>s+z.lineTotal,0);
 const discountType=pick(2)?'percent':'fixed';
 const discountInput=discountType==='percent'?pick(21):pick(Math.max(1,Math.floor(subtotal/4)));
 const discount=Math.min(subtotal,discountType==='percent'?div(subtotal*discountInput):discountInput);
 const net=subtotal-discount,vatMode=pick(3)===0?'none':'with_vat';
 const vatType=pick(2)?'percent':'fixed';
 const vatRate=vatMode==='none'?0:vatType==='percent'?pick(20):1+pick(1000);
 const vat=vatMode==='none'?0:vatType==='percent'?div(net*vatRate):vatRate;
 const grandTotal=net+vat,paymentMethod=pick(2)?'credit':'cash';
 const source={companyId:'COMP_ORACLE',kind:vatMode==='none'?'non_formal':'formal',paymentMethod,
  items,subtotal,discount,discountType,discountInput,vatMode,vatType,vatRate,vat,grandTotal,
  accountingVersion:1,currencyCode:'IRR'};
 const lines=kind==='sale'?
  [{accountId:paymentMethod==='credit'?'AR':'CASH',debit:grandTotal,credit:0},
   {accountId:'REV',debit:0,credit:net},
   ...(vat?[{accountId:'VATP',debit:0,credit:vat}]:[])]:
  [{accountId:'PUR',debit:net,credit:0},
   ...(vat?[{accountId:'VATR',debit:vat,credit:0}]:[]),
   {accountId:paymentMethod==='credit'?'AP':'CASH',debit:0,credit:grandTotal}];
 samples.push({source,lines});
}
const sql=["\\set ON_ERROR_STOP on","BEGIN;"];
sql.push("INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data) VALUES("+quote(uid)+",'00000000-0000-0000-0000-000000000000','authenticated','authenticated','oracle@example.invalid',now(),'{}'::jsonb);");
sql.push("DO $t$ BEGIN PERFORM set_config('oracle.org',(SELECT organization_id::text FROM public.organization_members WHERE user_id="+quote(uid)+" LIMIT 1),true);END $t$;");
const org="current_setting('oracle.org')::uuid";
sql.push("INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES ("+org+","+quote(uid)+",'companies','COMP_ORACLE','{\"name\":\"Oracle Company\"}'::jsonb),("+org+","+quote(uid)+",'fiscalYears','FY_ORACLE','{\"companyId\":\"COMP_ORACLE\",\"startDate\":\"1405/01/01\",\"endDate\":\"1405/12/29\",\"status\":\"open\"}'::jsonb);");
for(const [id,accountCode,role,type,nature] of specs){
 const data={companyId:'COMP_ORACLE',postingAllowed:true,active:true,code:accountCode,
 title:'Oracle '+role,normalBalance:nature,accountType:type,systemRole:role,
 level:'detail',parentId:'PARENT'};
 sql.push("INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES ("+org+","+quote(uid)+",'accounts',"+quote(id)+","+quote(JSON.stringify(data))+"::jsonb);");
}
sql.push("INSERT INTO private.finora_phase1a_guard_modes(organization_id,mode) VALUES("+org+",'enforce');");
const coll=kind==='sale'?'invoices':'purchases';
const sourceRows=samples.map((z,i)=>"("+org+","+quote(uid)+","+quote(coll)+","+quote('SRC_'+kind+'_'+i)+","+quote(JSON.stringify(z.source))+"::jsonb)").join(",\n");
sql.push("INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES "+sourceRows+";");
sql.push("SET LOCAL ROLE authenticated;");
sql.push("DO $t$ BEGIN PERFORM set_config('request.jwt.claim.sub',"+quote(uid)+",true); IF private.finora_phase1a_mode("+org+")<>'enforce' THEN RAISE EXCEPTION 'FINORA_GUARD_NOT_ENFORCE';END IF;RAISE NOTICE 'FINORA_ORACLE_GUARD_ENFORCE_CONFIRMED';END $t$;");
sql.push("DO $t$ BEGIN PERFORM public.finora_phase1a_publish_role_assignments("+org+",'COMP_ORACLE',"+quote(JSON.stringify(binds))+"::jsonb,0,'Owner oracle mapping approved');END $t$;");
for(let i=0;i<N;i++){
 const src='SRC_'+kind+'_'+i;
 const header={companyId:'COMP_ORACLE',fiscalYearId:'FY_ORACLE',date:'1405/07/24',sourceType:kind,sourceId:src,sourceVersion:'1'};
 sql.push("SELECT jsonb_build_object('i',"+i+",'r',public.finora_journal_autopost("+org+","+quote('J_'+kind+'_'+i)+","+quote(coll)+","+quote(src)+","+quote(JSON.stringify(header))+"::jsonb,NULL));");
}
sql.push("DO $t$ BEGIN IF (SELECT count(*) FROM public.records WHERE organization_id="+org+" AND collection='journalVouchers' AND data->>'sourceType'="+quote(kind)+" AND data->>'status'='posted')<>"+N+" THEN RAISE EXCEPTION 'FINORA_ORACLE_COUNT_INVALID';END IF;END $t$;");
sql.push("ROLLBACK;");
const file=path.join(os.tmpdir(),'finora-oracle-'+kind+'-'+process.pid+'.sql');
fs.writeFileSync(file,sql.join('\n')+'\n');
const p=spawnSync('psql',['-X','-qAt','-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-f',file],{encoding:'utf8',env:{...process.env,PGPASSWORD:'postgres'},timeout:1800000,maxBuffer:15*1024*1024});
fs.rmSync(file,{force:true});
if(p.status!==0||p.error){console.error((p.stderr||'').slice(-5000));throw Error('ORACLE_DATABASE_FAILED '+String(p.error||p.status));}
if(!(p.stderr||'').includes('FINORA_ORACLE_GUARD_ENFORCE_CONFIRMED'))throw Error('GUARD_MODE_NOT_PROVEN');
const rows=(p.stdout||'').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s));
if(rows.length!==N)throw Error('ORACLE_ROW_COUNT '+rows.length);
const normalize=z=>z.map(l=>[l.accountId,l.debit,l.credit].join(':')).sort().join('|');
for(const row of rows){
 const actual=row.r?.computedLines,expected=samples[row.i]?.lines;
 if(!actual||!expected||row.r?.voucher?.status!=='posted'||row.r?.contractVersion!==1||normalize(actual)!==normalize(expected)){
  throw Error('ORACLE_MISMATCH '+JSON.stringify({index:row.i,actual,expected}));
 }
}
console.log(JSON.stringify({result:'INDEPENDENT_ORACLE_PASS',kind,seed,cases:N,guard:'enforce',serverGenerated:true,oracleLanguage:'JavaScript',accountCodes:'realistic'}));
