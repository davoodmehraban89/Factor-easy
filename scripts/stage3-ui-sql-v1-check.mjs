#!/usr/bin/env node
// Stage 3: independent SQL validator for actual, synthetic Chromium form output.
// Runs ONLY against disposable localhost Supabase CLI / PostgreSQL. Never hosted.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const TARGET='127.0.0.1', PORT='54322';
for(const key of ['SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD','SUPABASE_SERVICE_ROLE_KEY']){
 if(process.env[key])throw Error('FINORA_TEST_TARGET_PRODUCTION_FORBIDDEN '+key);
}
if(process.env.PGHOST && !['localhost',TARGET].includes(process.env.PGHOST))
 throw Error('FINORA_TEST_TARGET_PRODUCTION_FORBIDDEN PGHOST');
const sourceFile=process.argv[2]||'stage3-ui-fixtures.json';
const fixture=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
function check(value,kind){
 const sql='SELECT private.finora_phase1a_document_amounts('+
  quote(JSON.stringify(value))+'::jsonb,'+quote(kind)+')::text;';
 const out=spawnSync('psql',['-h',TARGET,'-p',PORT,'-U','postgres','-d','postgres',
  '-X','-qAt','-v','ON_ERROR_STOP=1','-c',sql],
  {encoding:'utf8',env:{...process.env,PGHOST:TARGET,PGPORT:PORT,PGPASSWORD:'postgres'},
   timeout:20000,maxBuffer:1024*1024});
 if(out.error)throw out.error;
 return {ok:out.status===0,value:out.status===0?JSON.parse((out.stdout||'').trim()):null,
  error:(out.stderr||'').slice(0,1600)};
}
function expectReject(kind,value,reason){
 const r=check(value,kind);
 if(r.ok||!r.error.includes(reason))
  throw Error('FINORA_STAGE3_NEGATIVE_FAILED '+kind+' '+reason+' '+JSON.stringify(r).slice(0,500));
}
function copy(v){return JSON.parse(JSON.stringify(v))}
let positives=0,negatives=0;
for(const kind of ['sale','purchase']){
 const src=fixture[kind];
 if(!src||!Array.isArray(src.items)||src.items.length!==1||
  src.currencyCode!=='IRR'||src.accountingVersion!==1||
  src.vatMode!=='with_vat'||src.vatType!=='percent'||src.discountType!=='fixed')
  throw Error('FINORA_STAGE3_UI_FIXTURE_MISSING_FIELDS '+kind);
 const pos=check(src,kind);
 const expected={net:src.subtotal-src.discount,vat:src.vat,total:src.grandTotal};
 if(!pos.ok||!pos.value||Object.keys(expected).some(k=>Number(pos.value[k])!==expected[k]))
  throw Error('FINORA_STAGE3_UI_SERVER_AMOUNT_MISMATCH '+kind+' '+JSON.stringify(pos).slice(0,500));
 positives++;
 const variants=[
  {name:'discount',reason:'FINORA_SOURCE_DISCOUNT_MISMATCH',edit:x=>{x.discountInput+=1}},
  {name:'vat',reason:'FINORA_SOURCE_VAT_MISMATCH',edit:x=>{x.vat+=1}},
  {name:'currency',reason:'FINORA_SOURCE_METHOD_OR_CURRENCY_UNSUPPORTED',edit:x=>{x.currencyCode='UNSUPPORTED_NON_RIAL'}},
  {name:'quantity',reason:'FINORA_SOURCE_ITEM_QUANTITY_INVALID',edit:x=>{x.items[0].qty=1.5}},
  {name:'line-total',reason:'FINORA_SOURCE_ITEM_TOTAL_MISMATCH',edit:x=>{x.items[0].lineTotal+=1}},
  {name:'payment',reason:'FINORA_SOURCE_METHOD_OR_CURRENCY_UNSUPPORTED',edit:x=>{x.paymentMethod='card'}}
 ];
 for(const v of variants){
  const altered=copy(src);v.edit(altered);
  expectReject(kind,altered,v.reason);negatives++;
 }
}
console.log('FINORA_STAGE3_UI_SQL_V1_PASS '+JSON.stringify({
 validation:'actual Playwright DOM source against real local SQL-v1 function',
 positives,negatives,server:'localhost only',historicalMutation:false
}));
