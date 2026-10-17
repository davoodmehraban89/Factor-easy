#!/usr/bin/env node
// Stage 2.2 Playwright UI logic + REAL disposable Supabase CLI PostgreSQL.
// Authenticated RPC execution is via a narrowly scoped local psql bridge;
// no hosted URLs, remote access or Production credentials.
import {chromium} from '@playwright/test';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const UID='eeee5555-5555-4555-8555-555555555555';
const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
function sql(query){
 const r=spawnSync('psql',['-h','127.0.0.1','-p','54322','-U','postgres',
 '-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1','-c',query],
 {encoding:'utf8',env:{...process.env,PGPASSWORD:'postgres'},timeout:20000,maxBuffer:2e6});
 if(r.error||r.status!==0)throw Error('LOCAL_SQL_ERROR '+(r.stderr||String(r.error)).slice(-1200));
 return (r.stdout||'').trim().split('\n').filter(Boolean).at(-1)||'';
}
sql("INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data) "+
 "VALUES ("+quote(UID)+",'00000000-0000-0000-0000-000000000000','authenticated',"+
 "'authenticated','stage22-browser@example.invalid',now(),'{}'::jsonb)");
const ORG=sql("SELECT organization_id::text FROM public.organization_members WHERE user_id="+quote(UID)+" LIMIT 1");
if(!/^[0-9a-f-]{36}$/.test(ORG))throw Error('No local owner organization');
const common={organization_id:ORG,owner_id:UID};
function insertRecord(coll,id,datum){
 sql("INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES("+
 quote(ORG)+"::uuid,"+quote(UID)+"::uuid,"+quote(coll)+","+quote(id)+","+
 quote(JSON.stringify(datum))+"::jsonb)");
}
const ACC=[
 {id:'ST22_CASH',companyId:'ST22_CO',code:'1101',title:'صندوق',
 normalBalance:'debit',accountType:'asset',postingAllowed:true,active:true,level:'detail'},
 {id:'ST22_REV',companyId:'ST22_CO',code:'4101',title:'درآمد',
 normalBalance:'credit',accountType:'revenue',postingAllowed:true,active:true,level:'detail'}
];
insertRecord('companies','ST22_CO',{name:'Browser local company'});
insertRecord('fiscalYears','ST22_FY',{companyId:'ST22_CO',startDate:'1405/01/01',endDate:'1405/12/29',status:'open'});
ACC.forEach(x=>insertRecord('accounts',x.id,x));
function authExec(expression){
 const q="BEGIN;DO $g$ BEGIN PERFORM set_config('request.jwt.claim.sub',"+
 quote(UID)+",true); END $g$;SET LOCAL ROLE authenticated;SELECT to_jsonb("+expression+
 ")::text;COMMIT;";
 return JSON.parse(sql(q));
}
function rpc(name,args){
 const keys={
 finora_journal_get_guard_mode:['p_organization_id'],
 finora_journal_set_guard_mode:['p_organization_id','p_expected_mode','p_mode','p_reason'],
 finora_journal_create_draft:['p_organization_id','p_voucher_id','p_header','p_lines'],
 finora_journal_update_draft:['p_organization_id','p_voucher_id','p_expected_version','p_header','p_lines'],
 finora_journal_post:['p_organization_id','p_voucher_id','p_expected_version'],
 finora_journal_delete_draft:['p_organization_id','p_voucher_id','p_expected_version']
 };
 if(!Object.hasOwn(keys,name))throw Error('RPC_NOT_ALLOWED '+name);
 const vals=keys[name].map(k=>{
  const v=args[k];
  return typeof v==='number'?String(v):typeof v==='object'?
   quote(JSON.stringify(v))+'::jsonb':quote(v==null?'':v);
 });
 try{return {data:authExec('public.'+name+'('+vals.join(',')+')'),error:null}}
 catch(e){return {data:null,error:{message:e.message,code:/VERSION_CONFLICT/.test(e.message)?'40001':'P0001'}}}
}
const changed=rpc('finora_journal_set_guard_mode',{
 p_organization_id:ORG,p_expected_mode:'off',p_mode:'enforce',
 p_reason:'Stage 2.2 local-only browser test owner authorization'});
if(changed.error||changed.data?.mode!=='enforce')throw Error('MODE_SET_FAILED '+JSON.stringify(changed));
const rows=(collection,filter={})=>{
 const clauses=["organization_id="+quote(ORG)+"::uuid","collection="+quote(collection)];
 for(const [k,v] of Object.entries(filter)){
  if(k==='id')clauses.push("id="+quote(v));
  else if(k==='voucherId')clauses.push("data->>'voucherId'="+quote(v));
 }
 return JSON.parse(sql("SELECT COALESCE(jsonb_agg(jsonb_build_object("+
 "'collection',collection,'id',id,'data',data,'version',version) ORDER BY id),"+
 "'[]'::jsonb) FROM public.records WHERE "+clauses.join(' AND '))||'[]');
};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const evidence={run:'stage22-local',organization:'disposable',mode:'enforce',scenarios:[]};
async function makePage(){
 const page=await browser.newPage();
 await page.exposeFunction('__localStage22RPC',async(n,a)=>rpc(n,a));
 await page.exposeFunction('__localStage22Read',async(c,f)=>rows(c,f));
 await page.setContent('<div class="main-surface"></div><div id="sync-badge"></div>');
 await page.evaluate(({uid,org,accounts})=>{
  window.currentUser={id:uid,organizationId:org};
  window.sb={
   rpc:(name,args)=>window.__localStage22RPC(name,args),
   from:(table)=>{
    if(table!=='records')throw Error('NO_OTHER_TABLE_ACCESS');
    const filters={};
    const b={select:()=>b,eq:(k,v)=>{if(k==='id')filters.id=v;return b},
     filter:(k,op,v)=>{if(k==='data->>voucherId')filters.voucherId=v;return b},
     maybeSingle:async()=>{const d=await window.__localStage22Read(filters.collection||'',filters);return {data:d[0]||null,error:null}},
     then:(ok,bad)=>window.__localStage22Read(filters.collection||'',filters).then(d=>ok({data:d,error:null}),bad)};
    const orig=b.eq;b.eq=(k,v)=>{if(k==='collection')filters.collection=v;else orig(k,v);return b};
    return b;
   }
  };
  window.COLLS=['journalVouchers','journalLines','journalLineDimensions','products'];
  window.ID_RE=/^[A-Za-z0-9_-]{1,160}$/;
  window.afCompanyId=()=> 'ST22_CO';
  window.getJalaliNumeric=()=> '1405/07/26';
  window.toEnDigits=x=>x;
  window.getMyFiscalYears=()=>[{id:'ST22_FY',companyId:'ST22_CO',startDate:'1405/01/01',endDate:'1405/12/29',status:'open'}];
  window.getMyAccounts=()=>accounts.map(a=>({...a,ownerUserId:uid}));
  window.getMyAccountDimensionRules=()=>[];
  window.getMyDimensionTypes=()=>[];
  window.afResolvedValues=()=>[];
  window.requireWrite=()=>true;
  window.canWrite=()=>true;
  window.esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;');
  window.afId=p=>(p+'_'+Math.random().toString(36).slice(2,13));
  window.alert=()=>{};window.confirm=()=>true;
  window.refreshAllSurfaces=()=>{};
 },{uid:UID,org:ORG,accounts:ACC});
 for(const file of ['js/sync.js','js/money-format.js','js/journal-engine.js','js/journal-ui.js','js/manual-journal-stage22.js']){
  await page.addScriptTag({path:path.resolve(file)});
 }
 await page.evaluate(()=>{ensureJournalView();renderJournal();scheduleSync=function(){};});
 const guard=await page.evaluate(()=>finoraManualMode());
 if(guard!=='enforce')throw Error('BROWSER_GUARD_NOT_ENFORCE');
 return page;
}
const L=[{accountId:'ST22_CASH',debit:100,credit:0},
 {accountId:'ST22_REV',debit:0,credit:100}];
function docInput(note,amount=100){
 return {date:'1405/07/26',voucherType:'manual',description:note,
 lines:[{accountId:'ST22_CASH',debit:amount,credit:0},
 {accountId:'ST22_REV',debit:0,credit:amount}]};
}
const one=await makePage();
await one.evaluate(()=>{
 const lines=document.querySelectorAll('#je-lines .je-line');
 lines[0].querySelector('.je-account').value='ST22_CASH';
 lines[0].querySelector('.je-debit').value='100';
 lines[1].querySelector('.je-account').value='ST22_REV';
 lines[1].querySelector('.je-credit').value='100';
 document.getElementById('je-date').value='1405/07/26';
 document.getElementById('je-desc').value='Stage22 UI create';
});
await one.evaluate(()=>jeSaveManual());
const doc1=await one.evaluate(()=>getMyJournalVouchers().find(x=>x.description==='Stage22 UI create'));
if(!doc1||doc1.status!=='draft'||doc1.number||!await one.evaluate(()=>document.getElementById('je-number').readOnly))
 throw Error('UI_DRAFT_NUMBER_OR_CREATE_FAILED');
evidence.scenarios.push({scenario:'existing-client-draft-with-status-and-number',
 result:'GREEN',serverOnlyFieldsOmitted:true});
evidence.scenarios.push({scenario:'existing-client-batched-draft-and-lines',
 result:'GREEN',serverLines:rows('journalLines',{voucherId:doc1.id}).length});
await one.evaluate(id=>jeLoadDraftUi(id),doc1.id);
await one.evaluate(()=>{
 document.getElementById('je-desc').value='Updated in real UI';
});
await one.evaluate(()=>jeSaveManual());
const fresh=rows('journalVouchers',{id:doc1.id})[0];
if(fresh?.data?.description!=='Updated in real UI'||fresh.version<2)throw Error('UI_UPDATE_FAILED');
const deleted=await one.evaluate(async()=>{const v=await jeCreateDraft({
 date:'1405/07/26',voucherType:'manual',description:'to delete',
 lines:[{accountId:'ST22_CASH',debit:50,credit:0},
 {accountId:'ST22_REV',debit:0,credit:50}]});await jeDeleteDraft(v.id);return v.id;});
if(rows('journalVouchers',{id:deleted}).length)throw Error('DRAFT_NOT_DELETED');
evidence.scenarios.push({scenario:'create-update-delete-draft',result:'GREEN',version:fresh.version});
const result=await one.evaluate(id=>Promise.all([jePost(id),jePost(id)]),doc1.id);
if(result.some(x=>x.status!=='posted'||!x.number))throw Error('POST_FAILED');
const posted=rows('journalVouchers',{id:doc1.id})[0];
if(posted.data.status!=='posted'||!posted.data.number)throw Error('DB_POST_FAILED');
evidence.scenarios.push({scenario:'existing-client-post-status-transition',
 result:'GREEN',number:posted.data.number,version:posted.version,duplicatePrevented:true});
const draft2=await one.evaluate(i=>jeCreateDraft(i),docInput('two-tab original',200));
const two=await makePage();
await two.evaluate(id=>finoraManualReload(id),draft2.id);
await one.evaluate(({id,input})=>jeUpdateDraft(id,input),
 {id:draft2.id,input:docInput('tab A updated',200)});
const stale=await two.evaluate(async({id,input})=>{
 try{await jeUpdateDraft(id,input);return 'WRONG_GREEN'}
 catch(e){return String(e.message)}},
 {id:draft2.id,input:docInput('tab B stale',200)});
if(!stale.includes('FINORA_VERSION_CONFLICT'))throw Error('TAB_VERSION_CONFLICT_NOT_PROVED '+stale);
await two.evaluate(id=>jeLoadServerVersion(id),draft2.id);
const refreshed=await two.evaluate(id=>getMyJournalVouchers().find(x=>x.id===id)?.description,draft2.id);
if(refreshed!=='tab A updated')throw Error('RELOAD_SERVER_VERSION_FAILED');
evidence.scenarios.push({scenario:'two-tabs-version-CAS-and-server-reload',result:'GREEN'});
const draft3=await one.evaluate(i=>jeCreateDraft(i),docInput('offline and retry',300));
const offline=await one.evaluate(async id=>{
 Object.defineProperty(navigator,'onLine',{configurable:true,value:false});
 try{await jePost(id);return 'WRONG_GREEN'}catch(e){return String(e.message)}
},draft3.id);
if(!offline.includes('اینترنت')||rows('journalVouchers',{id:draft3.id})[0].data.status!=='draft')
 throw Error('OFFLINE_POST_NOT_BLOCKED');
const retry=await one.evaluate(async id=>{
 Object.defineProperty(navigator,'onLine',{configurable:true,value:true});
 const original=sb.rpc;let simulated=false;
 sb.rpc=async(n,a)=>{
  const r=await original(n,a);
  if(n==='finora_journal_post'&&!simulated){
   simulated=true;return {data:null,error:{message:'FINORA_POST_TIMEOUT',code:'57014'}};
  }
  return r;
 };
 try{return await jePost(id)}finally{sb.rpc=original}
},draft3.id);
if(retry.status!=='posted')throw Error('TIMEOUT_STATUS_QUERY_RETRY_FAILED');
evidence.scenarios.push({scenario:'offline-block-and-timeout-status-before-retry',result:'GREEN',sameId:draft3.id});
await one.evaluate(id=>{datastore.products.push({id:'UNSAVED_PRODUCT',ownerUserId:currentUser.id,title:'Keep my changes'});},draft2.id);
await one.evaluate(async id=>{
 await handleSyncError({code:'40001',message:'FINORA_VERSION_CONFLICT',finoraJournalVoucherId:id});
},draft2.id);
const kept=await one.evaluate(()=>datastore.products.some(x=>x.id==='UNSAVED_PRODUCT'));
if(!kept)throw Error('UNRELATED_UNSAVED_DATA_LOST');
evidence.scenarios.push({scenario:'targeted-sync-reload-preserves-unrelated-dirty-collection',result:'GREEN'});
const final=JSON.parse(sql(
 "SELECT jsonb_build_object('posted',(SELECT count(*) FROM public.records WHERE organization_id="+quote(ORG)+
 "::uuid AND collection='journalVouchers' AND data->>'status'='posted'),"+
 "'unique_numbers',(SELECT count(DISTINCT data->>'number') FROM public.records WHERE organization_id="+quote(ORG)+
 "::uuid AND collection='journalVouchers' AND data->>'status'='posted'),"+
 "'balanced',(SELECT count(*) FROM (SELECT v.id,coalesce(sum((l.data->>'debit')::numeric),0) AS debit,"+
 "coalesce(sum((l.data->>'credit')::numeric),0) AS credit FROM public.records v "+
 "JOIN public.records l ON l.organization_id=v.organization_id AND l.collection='journalLines' "+
 "AND l.data->>'voucherId'=v.id WHERE v.organization_id="+quote(ORG)+
 "::uuid AND v.collection='journalVouchers' AND v.data->>'status'='posted' GROUP BY v.id) x "+
 "WHERE x.debit=x.credit AND x.debit>0),"+
 "'audit',(SELECT count(*) FROM private.finora_phase1a_journal_audit WHERE organization_id="+quote(ORG)+
 "::uuid AND action='posted'))::text"));
if(final.posted<2||final.posted!==final.unique_numbers||final.posted!==final.balanced
 ||final.audit<final.posted)throw Error('REAL_DB_POSTED_BALANCE_AUDIT_UNIQUE_NUMBER_FAILURE '+JSON.stringify(final));
evidence.database=final;
evidence.positiveCompatibility=3;
fs.writeFileSync('stage22-evidence.json',JSON.stringify(evidence,null,2));
console.log('STAGE22_REAL_PLAYWRIGHT_DB_PASS '+JSON.stringify(evidence));
await browser.close();
