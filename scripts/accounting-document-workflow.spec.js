const {test,expect}=require('@playwright/test');

const BASE=process.env.FINORA_TEST_BASE_URL||'http://127.0.0.1:4173/index.html';
const USER='FINORA_F0_FIXTURE_ONLY';
const copy=value=>JSON.parse(JSON.stringify(value));
const {isDeepStrictEqual}=require('node:util');
// Do not allow an unexpected third product state to masquerade as expected P0 RED.
function assertKnownRedOrFixed(observed,knownBroken,required,label){
 if(isDeepStrictEqual(observed,knownBroken)||isDeepStrictEqual(observed,required))return;
 throw new Error('FINORA_ISSUE229_UNEXPECTED_PRODUCT_STATE '+label+' (not the known P0 RED): '+
  JSON.stringify({observed,knownBroken,required}));
}
test('P0 #229 sentinel rejects unexpected financial states before expected-RED markers',()=>{
 const broken={status:'posted',count:1,voucherStates:['posted']};
 const fixed={status:'draft',count:0,voucherStates:['draft']};
 expect(()=>assertKnownRedOrFixed(broken,broken,fixed,'fixture')).not.toThrow();
 expect(()=>assertKnownRedOrFixed(fixed,broken,fixed,'fixture')).not.toThrow();
 expect(()=>assertKnownRedOrFixed({status:'partial',count:2,voucherStates:['posted']},
  broken,fixed,'fixture')).toThrow(/FINORA_ISSUE229_UNEXPECTED_PRODUCT_STATE/);
 expect(()=>assertKnownRedOrFixed({status:'posted',count:1,voucherStates:['posted','orphan']},
  broken,fixed,'fixture')).toThrow(/FINORA_ISSUE229_UNEXPECTED_PRODUCT_STATE/);
});
function fakeServer(){
 const records=new Map();
 for(const [collection,id,data] of [
  ['companies','QA_CO',{name:'شرکت آزمون ایزوله',entityType:'legal'}],
  ['contacts','QA_CONTACT',{name:'خریدار آزمایشی',role:'both'}],
  ['products','QA_PROD',{name:'بلوک سیمانی',code:'BLK-001',unit:'عدد',sale_price:1500}],
  ['settings','main',{invoice_kind:'formal',vat_mode:'none',vat_rate:10,default_company_id:'QA_CO',currency_mode:'rial'}],
  ['fiscalYears','FY_QA',{name:'۱۴۰۵',startDate:'1405/01/01',endDate:'1405/12/29',status:'open'}],
  ['accounts','A_CASH',{code:'1101',title:'صندوق',systemRole:'cash_default',postingAllowed:true,active:true}],
  ['accounts','A_AR',{code:'1102',title:'دریافتنی',systemRole:'receivable_control',postingAllowed:true,active:true}],
  ['accounts','A_REV',{code:'4101',title:'درآمد فروش',systemRole:'revenue_default',postingAllowed:true,active:true}],
  ['accounts','A_VAT',{code:'2102',title:'مالیات',systemRole:'vat_payable',postingAllowed:true,active:true}],
  ['accounts','A_BUY',{code:'5101',title:'خرید',systemRole:'purchase_default',postingAllowed:true,active:true}],
  ['accounts','A_AP',{code:'2101',title:'پرداختنی',systemRole:'payable_control',postingAllowed:true,active:true}],
 ])records.set(collection+'|'+id,{collection,id,data:copy(data),version:1});
 return {records,failNext:false,failCount:0,rpcCount:0,reversalStatuses:[],reverseCount:0};
}
function remoteInvoices(server){return [...server.records.values()].filter(r=>r.collection==='invoices').map(r=>copy(r.data));}

test.beforeEach(async({page})=>{
 page.on('console',message=>{
  if(message.type()==='error'||message.text().includes('sync error'))
   console.log('FINORA_F0_BROWSER_CONSOLE',message.type(),message.text());
 });
 page.on('pageerror',error=>console.log('FINORA_F0_PAGE_ERROR',error.message));
});
test.afterEach(async({page},testInfo)=>{
 if(testInfo.status===testInfo.expectedStatus)return;
 try{
  const state=await page.evaluate(()=>({
   syncPending:typeof syncPending==='undefined'?null:syncPending,
   syncRunning:typeof syncRunning==='undefined'?null:syncRunning,
   syncFailCount:typeof syncFailCount==='undefined'?null:syncFailCount,
   currentOrg:typeof currentUser==='undefined'?null:currentUser?.organizationId,
   pendingDiff:typeof computeDiff==='function'?(()=>{const d=computeDiff();return {up:d.up.map(x=>x.key),del:d.del};})():null,
   alerts:window.__f0Alerts||[]
  }));
  console.log('FINORA_F0_FAILURE_DIAGNOSTICS',JSON.stringify(state));
 }catch(err){console.log('FINORA_F0_DIAGNOSTICS_UNAVAILABLE',String(err));}
});
async function installHarness(page,server){
 await page.exposeFunction('qaF0Read',async()=>[...server.records.values()].map(row=>({...copy(row),version:Number(row.version)||1})));
 await page.exposeFunction('qaF0Write',async args=>{
   server.rpcCount++;
   if(server.rpcCount<=3)console.log('FINORA_F0_RPC_TRACE',JSON.stringify({org:args.p_organization_id,upserts:(args.p_upserts||[]).map(x=>x.collection+'|'+x.id),deletes:(args.p_deletes||[]).map(x=>x.collection+'|'+x.id)}));
   if(server.failNext){server.failNext=false;server.failCount++;return {error:{message:'Network unavailable — isolated QA failure',code:'QA_NETWORK'}};}
   if(args.p_organization_id!=='QA_ORG')return {error:{message:'Unexpected organization scope',code:'QA_ORG_SCOPE'}};
   const upserts=[];
   for(const row of args.p_upserts||[]){
     const key=row.collection+'|'+row.id,current=server.records.get(key);
     const currentVersion=current?(Number(current.version)||1):0;
     const parentVoucherId=row.collection==='journalLines'?(row.data?.voucherId||current?.data?.voucherId):null;
     const parentVoucher=parentVoucherId?server.records.get('journalVouchers|'+parentVoucherId):null;
     if(row.collection==='journalVouchers'&&current&&current.data.status==='posted'&&['sale','purchase'].includes(current.data.sourceType))
       return {error:{message:'FINORA_POSTED_SOURCE_VOUCHER_IMMUTABLE',code:'23514'}};
     if(row.collection==='journalLines'&&parentVoucher&&parentVoucher.data.status==='posted'&&['sale','purchase'].includes(parentVoucher.data.sourceType))
       return {error:{message:'FINORA_POSTED_SOURCE_VOUCHER_IMMUTABLE',code:'23514'}};
     if(Number(row.expected_version||0)!==currentVersion){console.log('FINORA_F0_VERSION_CONFLICT',JSON.stringify({key,expected:row.expected_version,actual:currentVersion,rpcCount:server.rpcCount,upsertKeys:Object.keys(row),rpcKeys:Object.keys(args),rawExpectedVersion:row.expectedVersion}));return {error:{message:'FINORA_VERSION_CONFLICT',code:'40001'}};}
     const version=currentVersion+1;
     server.records.set(key,{collection:row.collection,id:row.id,data:copy(row.data),version});
     upserts.push({collection:row.collection,id:row.id,version});
   }
   const deletes=[];
   for(const row of args.p_deletes||[]){
     const key=row.collection+'|'+row.id,current=server.records.get(key);
     const currentVersion=current?(Number(current.version)||1):0;
     const parentVoucherId=row.collection==='journalLines'?current?.data?.voucherId:null;
     const parentVoucher=parentVoucherId?server.records.get('journalVouchers|'+parentVoucherId):null;
     if((row.collection==='journalVouchers'&&current?.data?.status==='posted'&&['sale','purchase'].includes(current.data.sourceType))||
        (row.collection==='journalLines'&&parentVoucher?.data?.status==='posted'&&['sale','purchase'].includes(parentVoucher.data.sourceType)))
       return {error:{message:'FINORA_POSTED_SOURCE_VOUCHER_IMMUTABLE',code:'23514'}};
     if(!current||Number(row.expected_version)!==currentVersion)return {error:{message:'FINORA_VERSION_CONFLICT',code:'40001'}};
     server.records.delete(key);deletes.push({collection:row.collection,id:row.id});
   }
   return {data:{upserts,deletes},error:null};
 });
 await page.exposeFunction('qaF0Reverse',async args=>{
   server.reverseCount=(server.reverseCount||0)+1;
   if(args.p_organization_id!=='QA_ORG')return {data:null,error:{message:'FINORA_ORG_FORBIDDEN',code:'42501'}};
   if(args.p_allocations!==null)return {data:null,error:{message:'FINORA_REVERSAL_ALLOCATION_INVALID',code:'23514'}};
   if(String(args.p_reason||'').trim().length<4)return {data:null,error:{message:'FINORA_REVERSAL_REASON_REQUIRED',code:'23514'}};
   const original=server.records.get('journalVouchers|'+args.p_original_id);
   if(!original||original.data.status!=='posted')return {data:null,error:{message:'FINORA_REVERSAL_SOURCE_NOT_POSTED',code:'23514'}};
   if(Number(original.version)!==Number(args.p_expected_version))return {data:null,error:{message:'FINORA_VERSION_CONFLICT',code:'40001'}};
   const fiscalYear=server.records.get('fiscalYears|'+original.data.fiscalYearId);
   if(!fiscalYear||fiscalYear.data.status==='locked'||args.p_date<fiscalYear.data.startDate||args.p_date>fiscalYear.data.endDate)
    return {data:null,error:{message:'FINORA_REVERSAL_FISCAL_DATE_INVALID',code:'23514'}};
   if((server.reversalStatuses||[]).some(x=>x.voucher_id===args.p_original_id))return {data:null,error:{message:'FINORA_VOUCHER_ALREADY_REVERSED',code:'23514'}};
   const originalLines=[...server.records.values()].filter(row=>row.collection==='journalLines'&&row.data.voucherId===args.p_original_id);
   if(!originalLines.length)return {data:null,error:{message:'FINORA_REVERSAL_LINES_MISSING',code:'23514'}};
   const reversalId=args.p_reversal_id,now=new Date().toISOString();
   const reversal={companyId:original.data.companyId,fiscalYearId:original.data.fiscalYearId,date:args.p_date,
    description:'برگشت سند '+(original.data.number||args.p_original_id),reference:original.data.reference||'',
    voucherType:'reversal',sourceType:'reversal',sourceId:args.p_original_id,reversesVoucherId:args.p_original_id,
    reversalReason:String(args.p_reason).trim(),reversalAllocations:null,
    number:String([...server.records.values()].filter(row=>row.collection==='journalVouchers').length+1),
    status:'posted',postedAt:now,postedBy:'FINORA_F0_FIXTURE_ONLY'};
   server.records.set('journalVouchers|'+reversalId,{collection:'journalVouchers',id:reversalId,data:copy(reversal),version:1});
   const reversalLines=originalLines.map((row,index)=>{
    const lineId=reversalId+'_L'+(index+1),data={voucherId:reversalId,companyId:original.data.companyId,
     fiscalYearId:original.data.fiscalYearId,accountId:row.data.accountId,
     debit:Number(row.data.credit||0),credit:Number(row.data.debit||0),
     description:'برگشت: '+String(row.data.description||''),reversesLineId:row.id};
    server.records.set('journalLines|'+lineId,{collection:'journalLines',id:lineId,data,version:1});
    return {...copy(data),id:lineId};
   });
   server.reversalStatuses=(server.reversalStatuses||[]).filter(x=>x.voucher_id!==args.p_original_id)
    .concat([{organization_id:'QA_ORG',voucher_id:args.p_original_id,effective_status:'reversed'}]);
   if(server.failReverseAfterCommit){server.failReverseAfterCommit=false;return {data:null,error:{message:'QA_NETWORK_AFTER_COMMIT',code:'QA_NETWORK'}};}
   return {data:{voucher:{...copy(reversal),id:reversalId,version:1},originalVoucherId:args.p_original_id,
    reversalLineIds:reversalLines.map(x=>x.id),replayed:false},error:null};
 });
 await page.exposeFunction('qaF0ReversalStatuses',async()=>copy(server.reversalStatuses||[]));
 await page.exposeFunction('qaF0AutoPost',async args=>{
   server.autoPostCount=(server.autoPostCount||0)+1;
   if(args.p_organization_id!=='QA_ORG')return {data:null,error:{message:'FINORA_ORG_FORBIDDEN',code:'42501'}};
   const sourceKey=args.p_source_collection+'|'+args.p_source_id;
   const sourceRow=server.records.get(sourceKey);
   if(!sourceRow)return {data:null,error:{message:'FINORA_SOURCE_NOT_COMMITTED_IN_ORG',code:'23503'}};
   const kind=args.p_header.sourceType;
   if(!['cash','credit'].includes(sourceRow.data.paymentMethod))return {data:null,error:{message:'FINORA_SOURCE_METHOD_OR_CURRENCY_UNSUPPORTED',code:'23514'}};
   const digitMap={'۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9','٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
   const normalizeDate=value=>String(value||'').replace(/[۰-۹٠-٩]/g,digit=>digitMap[digit]||digit);
   if(args.p_header.voucherType!==kind||normalizeDate(args.p_header.date)!==normalizeDate(sourceRow.data.date))return {data:null,error:{message:'FINORA_SOURCE_HEADER_MISMATCH',code:'23514'}};
   const prior=[...server.records.values()].find(row=>row.collection==='journalVouchers'&&row.data.sourceType===kind&&row.data.sourceId===args.p_source_id&&['posted','reversed'].includes(row.data.status));
   if(prior)return {data:{voucher:{...copy(prior.data),id:prior.id,version:Number(prior.version)||1},replayed:true},error:null};
   const amount=Number(sourceRow.data.grandTotal||0);
   if(!Number.isSafeInteger(amount)||amount<=0)return {data:null,error:{message:'FINORA_INVALID_RIAL_AMOUNT',code:'23514'}};
   const debitAccount=kind==='sale'?(sourceRow.data.paymentMethod==='credit'?'A_AR':'A_CASH'):'A_BUY';
   const creditAccount=kind==='sale'?'A_REV':(sourceRow.data.paymentMethod==='credit'?'A_AP':'A_CASH');
   for(const accountId of [debitAccount,creditAccount]){
    const account=server.records.get('accounts|'+accountId);
    if(!account||account.data.active===false||account.data.postingAllowed!==true)
     return {data:null,error:{message:'حساب موردنیاز در کدینگ فعال و قابل ثبت نیست: '+accountId,code:'23514'}};
   }
   const now=new Date().toISOString(),voucherId=args.p_voucher_id;
   const voucherNumber=String([...server.records.values()].filter(row=>row.collection==='journalVouchers'&&row.data.companyId===args.p_header.companyId&&row.data.fiscalYearId===args.p_header.fiscalYearId).length+1);
   const voucher={companyId:args.p_header.companyId,fiscalYearId:args.p_header.fiscalYearId,date:args.p_header.date,
     description:args.p_header.description,reference:args.p_header.reference,voucherType:args.p_header.voucherType,
     sourceType:kind,sourceId:args.p_source_id,sourceVersion:String(args.p_header.sourceVersion),
     number:voucherNumber,status:'posted',postedAt:now,postedBy:'FINORA_F0_FIXTURE_ONLY'};
   const updatedSource={...copy(sourceRow.data),journalVoucherId:voucherId,accountingStatus:'posted',
     accountingPostedAt:now,documentStatus:'posted',documentPostedAt:now,
     documentPostedBy:'FINORA_F0_FIXTURE_ONLY',documentVersion:Number(sourceRow.data.documentVersion||1),updatedAt:now};
   server.records.set(sourceKey,{collection:args.p_source_collection,id:args.p_source_id,data:updatedSource,version:(Number(sourceRow.version)||1)+1});
   server.records.set('journalVouchers|'+voucherId,{collection:'journalVouchers',id:voucherId,data:voucher,version:1});
   const lines=[
     {id:voucherId+'_L1',data:{voucherId,companyId:args.p_header.companyId,fiscalYearId:args.p_header.fiscalYearId,accountId:debitAccount,debit:amount,credit:0}},
     {id:voucherId+'_L2',data:{voucherId,companyId:args.p_header.companyId,fiscalYearId:args.p_header.fiscalYearId,accountId:creditAccount,debit:0,credit:amount}}
   ];
   for(const line of lines)server.records.set('journalLines|'+line.id,{collection:'journalLines',id:line.id,data:line.data,version:1});
   return {data:{voucher:{...copy(voucher),id:voucherId,version:1},computedLines:lines.map(line=>({...copy(line.data),id:line.id})),contractVersion:1,draftReplayed:false},error:null};
 });
 await page.route(/https:\/\/[^/]*supabase\.co\//,route=>route.abort());
}
async function authenticatedMockBrowser(page){
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 // Await the two explicit core login barriers; extension registration alone does not settle either promise.
 // The synthetic account must not race the organization entitlement wrapper.
 // Function availability precedes completion of asynchronously loaded ERP modules.
 await page.waitForFunction(()=>typeof enterApp==='function'&&typeof commitSaveInvoice==='function'&&
   typeof pullAll==='function'&&window.FinoraStartupStatus?.extensionsReady===true&&
   window.FinoraStartupStatus?.failedExtensionCount===0&&
   window.FinoraStartupStatus?.authChecked===true,{timeout:20000});
 await page.evaluate(()=>Promise.all([window.FinoraAppAssetsReady,window.FinoraOrganizationContextReady]));
 await page.evaluate(async()=>{
   window.__FINORA_PRINT_TEST_MODE=true;
   window.__f0Alerts=[];
   window.alert=m=>window.__f0Alerts.push(String(m));
   window.confirm=()=>false;
   fetchCurrentUser=async()=>({id:'FINORA_F0_FIXTURE_ONLY',organizationId:'QA_ORG',username:'qa-only',email:'qa@example.invalid',fullName:'QA F0',role:'admin',maxCompanies:2,subscription:{type:'lifetime',status:'active',endDate:'2099-12-31'}});
   maybeMigrateLegacyData=()=>{};
   sb.from=collection=>{
     if(collection==='finora_journal_reversal_status')return {select:()=>({eq:async()=>({data:await window.qaF0ReversalStatuses(),error:null})})};
     return {select:()=>({
       eq(){return this;},
       order(){return this;},
       async range(from,to){const rows=(await window.qaF0Read()).filter(r=>r.collection).sort((a,b)=>a.collection.localeCompare(b.collection)||a.id.localeCompare(b.id));return {data:rows.slice(from,to+1),error:null};}
     })};
   };
   window.requireFreshFinoraMembership=async()=>true;
   sb.rpc=async(name,args)=>{
     // Both deployed sync RPC entrypoints share the same transactional mock contract.
     if(name==='finora_sync_records_v2'||name==='finora_sync_records'){if((args?.p_upserts||[]).some(row=>!Object.prototype.hasOwnProperty.call(row,'expected_version')))console.error('FINORA_F0_MISSING_VERSION_RPC_CALLSITE',JSON.stringify({name,firstUpsert:(args?.p_upserts||[])[0],stack:new Error('sync RPC callsite').stack}));return await window.qaF0Write(args);}
     if(name==='finora_journal_autopost')return await window.qaF0AutoPost(args);
     if(name==='finora_journal_reverse')return await window.qaF0Reverse(args);
     throw Error('Unexpected RPC '+name);
   };
   await enterApp({id:'FINORA_F0_FIXTURE_ONLY'});
    const authState={display:getComputedStyle(document.getElementById('auth-screen')).display,status:document.getElementById('auth-login-status')?.textContent||'',userId:currentUser?.id||null,startup:window.FinoraStartupStatus};
    if(authState.display!=='none')throw new Error('QA_ENTER_APP_FAILED '+JSON.stringify(authState));
   document.querySelectorAll('.modal-backdrop.active').forEach(x=>x.classList.remove('active'));
   switchView('view-invoices');
 });
 await expect(page.locator('#auth-screen')).toBeHidden();
 await expect(page.locator('#invoice-company-id option[value="QA_CO"]')).toHaveCount(1);
 await expect(page.locator('#invoice-items-table-body .row-product-select').first().locator('option[value="QA_PROD"]')).toHaveCount(1);
}
async function fillInvoice(page,number,qty){
 // The native invoice-kind/contact selectors are hidden by the unified commercial combobox.
 // Drive their real DOM change handlers, not Playwright visibility on replaced native selects.
 await page.evaluate(()=>{
   for(const [id,value] of [['invoice-kind','formal'],['invoice-company-id','QA_CO'],['invoice-contact-id','QA_CONTACT']]){
     const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
   }
 });
 await page.locator('#invoice-number').fill(number);
 await page.locator('#invoice-date-input').fill('۱۴۰۵/۰۷/۱۹');
 await page.evaluate(()=>{
   const el=document.querySelector('#invoice-items-table-body .row-product-select');
   el.value='QA_PROD';el.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.locator('#invoice-items-table-body .row-quantity').first().fill(String(qty));
 await page.locator('#invoice-items-table-body .row-quantity').first().dispatchEvent('input');
}

test('invoice and purchase registers isolate companies selected in Settings; no ALL fallback or cross-company edit',async({page})=>{
 const server=fakeServer();
 const sale=(id,companyId,number)=>({companyId,kind:'non_formal',kindLabel:'غیررسمی',number,date:'1405/07/19',
  contactId:'QA_CONTACT',contactName:'طرف حساب آزمایشی',items:[{prodId:'QA_PROD',qty:1,price:1500}],grandTotal:1500,
  documentStatus:'draft',accountingStatus:'draft'});
 const purchase=(id,companyId,number)=>({companyId,number,date:'1405/07/19',supplierId:'QA_CONTACT',
  supplierName:'تأمین‌کننده آزمایشی',items:[{prodId:'QA_PROD',qty:1,price:100}],grandTotal:100,accountingStatus:'draft'});
 server.records.set('companies|QA_CO_B',{collection:'companies',id:'QA_CO_B',data:{name:'شرکت دوم آزمون'}});
 for(const [collection,id,data] of [
  ['invoices','INV_SCOPE_A',sale('INV_SCOPE_A','QA_CO','INV-COMPANY-A')],
  ['invoices','INV_SCOPE_B',sale('INV_SCOPE_B','QA_CO_B','INV-COMPANY-B')],
  ['invoices','INV_LEGACY_UNSCOPED',sale('INV_LEGACY_UNSCOPED','', 'INV-LEGACY')],
  ['purchases','PUR_SCOPE_A',purchase('PUR_SCOPE_A','QA_CO','PUR-COMPANY-A')],
  ['purchases','PUR_SCOPE_B',purchase('PUR_SCOPE_B','QA_CO_B','PUR-COMPANY-B')]
 ])server.records.set(collection+'|'+id,{collection,id,data});
 await installHarness(page,server);await authenticatedMockBrowser(page);
 const archive=page.locator('#invoice-archive-table-body');
 const purchases=page.locator('#pur-list-body');
 await expect(archive).toContainText('INV-COMPANY-A');
 await expect(archive).not.toContainText('INV-COMPANY-B');
 await expect(archive).not.toContainText('INV-LEGACY');
 await expect(purchases).toContainText('PUR-COMPANY-A');
 await expect(purchases).not.toContainText('PUR-COMPANY-B');
 await expect(page.locator('#filter-invoice-company')).toBeDisabled();
 await expect(page.locator('#filter-invoice-company option')).toHaveCount(1);
 await expect(page.locator('#filter-invoice-company option[value="ALL"]')).toHaveCount(0);
 await expect(page.locator('#invoice-company-id')).toBeDisabled();
 await expect(page.locator('#invoice-company-id')).toHaveValue('QA_CO');
 await page.evaluate(()=>navigateShell('accounting','view-journal','documents'));
 await expect(page.locator('#finora-document-management-body')).toContainText('INV-COMPANY-A');
 await expect(page.locator('#finora-document-management-body')).not.toContainText('INV-COMPANY-B');
 await expect(page.locator('#finora-purchase-document-management-body')).toContainText('PUR-COMPANY-A');
 await expect(page.locator('#finora-purchase-document-management-body')).not.toContainText('PUR-COMPANY-B');
 // A settings change refreshes all three surfaces without new login.
 await page.evaluate(()=>setDefaultCompany('QA_CO_B'));
 await expect(page.locator('#invoice-company-id')).toHaveValue('QA_CO_B');
 await expect(archive).toContainText('INV-COMPANY-B');
 await expect(archive).not.toContainText('INV-COMPANY-A');
 await expect(purchases).toContainText('PUR-COMPANY-B');
 await expect(purchases).not.toContainText('PUR-COMPANY-A');
 await expect(page.locator('#finora-document-management-body')).toContainText('INV-COMPANY-B');
 await expect(page.locator('#finora-document-management-body')).not.toContainText('INV-COMPANY-A');
 await expect(page.locator('#finora-purchase-document-management-body')).toContainText('PUR-COMPANY-B');
 await expect(page.locator('#finora-purchase-document-management-body')).not.toContainText('PUR-COMPANY-A');
 // Direct stale entrypoint cannot open an off-company draft.
 await page.evaluate(()=>{switchView('view-invoices');editInvoice('INV_SCOPE_A')});
 await expect(page.locator('#edit-invoice-id')).toHaveValue('');
 await page.evaluate(()=>{switchView('view-invoices');editInvoice('INV_SCOPE_B')});
 await expect(page.locator('#edit-invoice-id')).toHaveValue('INV_SCOPE_B');
 // Changing company while a form is open clears that edit context.
 await page.evaluate(()=>setDefaultCompany('QA_CO'));
 await expect(page.locator('#edit-invoice-id')).toHaveValue('');
 await expect(page.locator('#invoice-company-id')).toHaveValue('QA_CO');
 await expect(archive).toContainText('INV-COMPANY-A');
 await expect(archive).not.toContainText('INV-COMPANY-B');
 await expect(purchases).toContainText('PUR-COMPANY-A');
 await expect(purchases).not.toContainText('PUR-COMPANY-B');
 // Both originals are preserved in storage.
 expect(await page.evaluate(()=>getMyInvoices().filter(x=>x.id.startsWith('INV_SCOPE_')).length)).toBe(2);
 expect(await page.evaluate(()=>getMyPurchases().filter(x=>x.id.startsWith('PUR_SCOPE_')).length)).toBe(2);
 await page.waitForFunction(()=>!syncPending&&!syncRunning);
 await page.reload({waitUntil:'domcontentloaded'});await authenticatedMockBrowser(page);
 await expect(page.locator('#invoice-company-id')).toHaveValue('QA_CO');
 await expect(page.locator('#invoice-archive-table-body')).toContainText('INV-COMPANY-A');
 await expect(page.locator('#invoice-archive-table-body')).not.toContainText('INV-COMPANY-B');
});
test('formal invoice remains editable draft across server reload; explicit posting creates exactly one balanced voucher',async({page})=>{
 const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
 await fillInvoice(page,'FIN-DRAFT-001',2);
 await page.evaluate(()=>commitSaveInvoice());
 await expect.poll(()=>remoteInvoices(server).length,{timeout:13000}).toBe(1);
 expect(remoteInvoices(server)[0].accountingStatus).toBe('draft');
 expect([...server.records.values()].filter(x=>x.collection==='journalVouchers')).toHaveLength(0);
 const id=remoteInvoices(server)[0].id;
 // A saved formal draft prints its complete invoice; the print UI must not stamp it
 // as provisional. The underlying draft state and zero-posting invariant remain.
 await page.evaluate(x=>renderAndPrintDirect(x),id);
 await expect(page.locator('#printable-invoice')).toContainText('FIN-DRAFT-۰۰۱');
 await expect(page.locator('#printable-invoice')).toContainText('۳٬۰۰۰');
 await expect(page.locator('#printable-invoice')).not.toContainText('پیش‌نویس — غیرقطعی');
 await expect(page.locator('#printable-invoice [style*="rotate(-12deg)"]')).toHaveCount(0);
 const isolatedPrint=page.frameLocator('#finora-print-frame').locator('#finora-print-document');
 await expect(isolatedPrint).toContainText('FIN-DRAFT-۰۰۱');
 await expect(isolatedPrint).not.toContainText('پیش‌نویس — غیرقطعی');
 expect(remoteInvoices(server)[0].accountingStatus).toBe('draft');
 expect([...server.records.values()].filter(x=>x.collection==='journalVouchers')).toHaveLength(0);
 await page.reload({waitUntil:'domcontentloaded'});await authenticatedMockBrowser(page);
 await page.evaluate(x=>editInvoice(x),id);
 await expect(page.locator('#edit-invoice-id')).toHaveValue(id);
 await page.locator('#invoice-items-table-body .row-quantity').first().fill('3');
 await page.locator('#invoice-items-table-body .row-quantity').first().dispatchEvent('input');
 await page.evaluate(()=>commitSaveInvoice());
 await expect.poll(()=>remoteInvoices(server)[0]?.grandTotal,{timeout:13000}).toBe(4500);
 await page.evaluate(()=>navigateShell('accounting','view-journal','documents'));
 await expect(page.locator('#finora-document-management-body')).toContainText('FIN-DRAFT-001');
 await expect(page.locator('#finora-document-management-body')).toContainText('پیش‌نویس');
 await page.locator('#finora-document-management-body [data-doc-action="post"]').click();
 // Show a confirmation requiring explicit intent; no automatic posting on Save.
 await expect.poll(()=>remoteInvoices(server)[0].accountingStatus,{timeout:3000}).toBe('draft');
 await page.evaluate(()=>{window.confirm=()=>true});
 await page.locator('#finora-document-management-body [data-doc-action="post"]').click();
 await expect.poll(()=>remoteInvoices(server)[0]?.accountingStatus,{timeout:13000}).toBe('posted');
 const posted=remoteInvoices(server)[0];
 const vouchers=[...server.records.values()].filter(x=>x.collection==='journalVouchers');
 const lines=[...server.records.values()].filter(x=>x.collection==='journalLines');
 expect(vouchers).toHaveLength(1);
 expect(vouchers[0].data.status).toBe('posted');
 expect(lines.length).toBeGreaterThanOrEqual(2);
 expect(lines.reduce((t,x)=>t+Number(x.data.debit||0),0)).toBe(4500);
 expect(lines.reduce((t,x)=>t+Number(x.data.credit||0),0)).toBe(4500);
 expect(posted.journalVoucherId).toBe(vouchers[0].id);
 expect(server.autoPostCount).toBe(1);
 // Repeat post must be idempotent, and posted source cannot be edited or overwritten.
 await page.evaluate(x=>finalizeInvoiceDocument(x),id);
 expect(server.autoPostCount).toBe(1);
 expect([...server.records.values()].filter(x=>x.collection==='journalVouchers')).toHaveLength(1);
 await page.evaluate(x=>editInvoice(x),id);
 await expect(page.locator('#edit-invoice-id')).toHaveValue('');
 await page.reload({waitUntil:'domcontentloaded'});await authenticatedMockBrowser(page);
 const saved=await page.evaluate(x=>getMyInvoices().find(i=>i.id===x),id);
 expect(saved.documentStatus).toBe('posted');
 expect(saved.grandTotal).toBe(4500);
 expect(saved.documentVersion).toBe(2);
});
test('posted sale can be returned to an editable corrective draft; original voucher stays immutable and balances',async({page})=>{
 const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
 await fillInvoice(page,'PILOT-SALE-001',2);await page.evaluate(()=>commitSaveInvoice());
 await expect.poll(()=>remoteInvoices(server).length,{timeout:13000}).toBe(1);
 const originalId=remoteInvoices(server)[0].id;
 await page.evaluate(id=>finalizeInvoiceDocument(id),originalId);
 await expect.poll(()=>remoteInvoices(server)[0]?.accountingStatus,{timeout:13000}).toBe('posted');
 const before=remoteInvoices(server)[0],originalVoucherId=before.journalVoucherId;
 const originalLines=[...server.records.values()].filter(x=>x.collection==='journalLines'&&x.data.voucherId===originalVoucherId).map(copy);
 const result=await page.evaluate(id=>reopenPostedInvoiceAsDraft(id,'تصحیح تعداد پایلوت'),originalId);
 expect(server.reverseCount).toBe(1);
 expect(result).toBeTruthy();expect(result).not.toBe(originalId);
 await expect.poll(()=>remoteInvoices(server).length,{timeout:13000}).toBe(2);
 const after=remoteInvoices(server),original=after.find(i=>i.id===originalId),draft=after.find(i=>i.id===result);
 expect(original.grandTotal).toBe(3000);
 expect(original.journalVoucherId).toBe(originalVoucherId);
 expect(draft.correctsInvoiceId).toBe(originalId);
 expect(draft.documentStatus).toBe('draft');
 expect(draft.journalVoucherId).toBeUndefined();
 expect(draft.number).not.toBe(original.number);
 const allVouchers=[...server.records.values()].filter(x=>x.collection==='journalVouchers');
 expect(allVouchers).toHaveLength(2);
 expect(allVouchers.find(x=>x.id===originalVoucherId).data.status).toBe('posted');
 expect(server.reversalStatuses.find(x=>x.voucher_id===originalVoucherId)?.effective_status).toBe('reversed');
 const reversal=allVouchers.find(x=>x.id!==originalVoucherId);
 expect(reversal.data.status).toBe('posted');
 expect(originalLines).toEqual([...server.records.values()].filter(x=>x.collection==='journalLines'&&x.data.voucherId===originalVoucherId).map(copy));
 expect(await page.evaluate(id=>invoiceDocumentStatus(getMyInvoices().find(x=>x.id===id)),originalId)).toBe('reversed');
 // The replacement source uses the normal draft editor and preserves provenance.
 await page.evaluate(id=>editInvoice(id),result);
 await expect(page.locator('#edit-invoice-id')).toHaveValue(result);
 await page.locator('#invoice-items-table-body .row-quantity').first().fill('3');
 await page.locator('#invoice-items-table-body .row-quantity').first().dispatchEvent('input');
 await page.evaluate(()=>commitSaveInvoice());
 await expect.poll(()=>remoteInvoices(server).find(x=>x.id===result)?.grandTotal,{timeout:13000}).toBe(4500);
 await page.evaluate(id=>finalizeInvoiceDocument(id),result);
 await expect.poll(()=>remoteInvoices(server).find(x=>x.id===result)?.accountingStatus,{timeout:13000}).toBe('posted');
 const later=[...server.records.values()].filter(x=>x.collection==='journalVouchers');
 expect(later).toHaveLength(3);
 expect(later.find(x=>x.id===originalVoucherId).data.status).toBe('posted');
  expect(server.reversalStatuses.find(x=>x.voucher_id===originalVoucherId)?.effective_status).toBe('reversed');
 const lines=[...server.records.values()].filter(x=>x.collection==='journalLines');
 for(const v of later){
  const subset=lines.filter(l=>l.data.voucherId===v.id);
  expect(subset.reduce((t,l)=>t+Number(l.data.debit||0),0)).toBe(subset.reduce((t,l)=>t+Number(l.data.credit||0),0));
 }
 // Repeating the same correction is idempotent: return its existing draft without another reversal.
 const retry=await page.evaluate(id=>reopenPostedInvoiceAsDraft(id,'تکرار'),originalId);
 expect(retry).toBe(result);
 expect(server.reverseCount).toBe(1);
 await page.reload({waitUntil:'domcontentloaded'});await authenticatedMockBrowser(page);
 const persisted=await page.evaluate(id=>({old:invoiceDocumentStatus(getMyInvoices().find(x=>x.id===id)),drafts:getMyInvoices().filter(i=>i.correctsInvoiceId===id).map(i=>i.accountingStatus)}),originalId);
 expect(persisted.old).toBe('reversed');
 expect(persisted.drafts).toEqual(['posted']);
});

test('pilot manual journal correction permits draft edits, balanced repost and auditable cancellation',async({page})=>{
 const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
 const first=await page.evaluate(()=>{
  const v=jeCreateDraft({number:'8801',date:'1405/07/19',description:'ثبت آزمایشی',sourceType:'manual',
   lines:[{accountId:'A_CASH',debit:1000,credit:0},{accountId:'A_REV',debit:0,credit:1000}]});
  jePost(v.id);return v.id;
 });
 await expect.poll(()=>[...server.records.values()].filter(r=>r.collection==='journalVouchers').length,{timeout:13000}).toBe(1);
 const oldLineData=[...server.records.values()].filter(x=>x.collection==='journalLines'&&x.data.voucherId===first).map(copy);
 const ids=await page.evaluate(id=>{
  const out=jeReturnPostedToDraft(id,'اشتباه مبلغ آزمایشی','1405/07/19');
  return {draft:out.draft.id,reversal:out.reversal.id,old:out.original.id};
 },first);
 await page.evaluate(id=>jeUpdateDraft(id,{date:'1405/07/19',description:'اصلاح مبلغ به ۲۰۰۰',
  lines:[{accountId:'A_CASH',debit:2000,credit:0},{accountId:'A_REV',debit:0,credit:2000}]}),ids.draft);
 const details=await page.evaluate(({draft,old})=>{
  jePost(draft);return {old:getMyJournalVouchers().find(x=>x.id===old).status,new:getMyJournalVouchers().find(x=>x.id===draft).status,trial:jeTrialBalance()};
 },ids);
 expect(details.old).toBe('reversed');expect(details.new).toBe('posted');
 expect(details.trial.find(x=>x.accountId==='A_CASH').balance).toBe(2000);
 await page.evaluate(id=>jeCancelPostedManual(id,'ابطال بعد از تست','1405/07/19'),ids.draft);
 await expect.poll(()=>[...server.records.values()].filter(x=>x.collection==='journalVouchers').length,{timeout:13000}).toBe(4);
 const final=await page.evaluate(()=>jeTrialBalance());
 expect(final.reduce((sum,row)=>sum+row.debit-row.credit,0)).toBe(0);
 expect(final.find(x=>x.accountId==='A_CASH').balance).toBe(0);
 expect(oldLineData).toEqual([...server.records.values()].filter(x=>x.collection==='journalLines'&&x.data.voucherId===first).map(copy));
 const rows=[...server.records.values()].filter(x=>x.collection==='journalVouchers');
 expect(rows.find(x=>x.id===first).data.status).toBe('reversed');
 expect(rows.find(x=>x.id===ids.draft).data.status).toBe('reversed');
 await page.reload({waitUntil:'domcontentloaded'});await authenticatedMockBrowser(page);
 expect(await page.evaluate(()=>jeTrialBalance().find(x=>x.accountId==='A_CASH').balance)).toBe(0);
});

test('pilot cancellation preserves posted invoice record while only unposted drafts can be deleted',async({page})=>{
 const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
 await fillInvoice(page,'PILOT-CANCEL-001',2);await page.evaluate(()=>commitSaveInvoice());
 await expect.poll(()=>remoteInvoices(server).length,{timeout:13000}).toBe(1);
 const invoiceId=remoteInvoices(server)[0].id;
 await page.evaluate(id=>finalizeInvoiceDocument(id),invoiceId);
 const original=remoteInvoices(server)[0];
 expect(original.accountingStatus).toBe('posted');
 const blocked=await page.evaluate(id=>{try{deleteInvoicePilotDraft(id);return 'unexpected'}catch(e){return String(e.message)}},invoiceId);
 expect(blocked).not.toBe('unexpected');
 await page.evaluate(id=>cancelPostedInvoicePilot(id,'ابطال سند پایلوت'),invoiceId);
 expect(server.reverseCount).toBe(1);
 await expect.poll(()=>[...server.records.values()].filter(x=>x.collection==='journalVouchers').length,{timeout:13000}).toBe(2);
 expect(remoteInvoices(server)[0].id).toBe(invoiceId);
 expect(remoteInvoices(server)[0].grandTotal).toBe(original.grandTotal);
 const status=await page.evaluate(id=>invoiceDocumentStatus(getMyInvoices().find(x=>x.id===id)),invoiceId);
 expect(status).toBe('reversed');
 const bad=await page.evaluate(async id=>{try{await reopenPostedInvoiceAsDraft(id,'تکرار');return 'unexpected'}catch(e){return String(e.message)}},invoiceId);
 expect(bad).not.toBe('unexpected');
 expect(bad).toMatch(/ابطال|اصلاحیه/);
 expect(server.reverseCount).toBe(1);
 // A separate never-posted invoice may be deleted; posted history stays intact.
 await fillInvoice(page,'PILOT-DELETE-DRAFT-001',1);await page.evaluate(()=>commitSaveInvoice());
 await expect.poll(()=>remoteInvoices(server).length,{timeout:13000}).toBe(2);
 const draft=remoteInvoices(server).find(x=>x.number==='PILOT-DELETE-DRAFT-001');
 expect(draft).toBeTruthy();
 await page.evaluate(id=>deleteInvoicePilotDraft(id),draft.id);
 await expect.poll(()=>remoteInvoices(server).length,{timeout:13000}).toBe(1);
 expect(remoteInvoices(server)[0].id).toBe(invoiceId);
 expect([...server.records.values()].filter(x=>x.collection==='journalVouchers')).toHaveLength(2);
});

function remotePurchases(server){return [...server.records.values()].filter(x=>x.collection==='purchases').map(x=>copy(x.data));}
async function createPostedPurchase(page,server,number='PILOT-PUR-001',qty=2){
 const id=await page.evaluate(async({number,qty})=>{
  const p={id:'PUR-QA-'+number,ownerUserId:'FINORA_F0_FIXTURE_ONLY',companyId:'QA_CO',number,date:'1405/07/19',supplierId:'QA_CONTACT',supplierName:'خریدار آزمایشی',paymentMethod:'cash',warehouseId:'',projectId:'',items:[{prodId:'QA_PROD',prodName:'بلوک سیمانی',qty,unit:'عدد',price:100,lineTotal:qty*100}],subtotal:qty*100,discount:0,discountType:'fixed',discountInput:0,vat:0,vatMode:'none',vatType:'percent',vatRate:0,grandTotal:qty*100,accountingVersion:1,documentVersion:1,accountingStatus:'draft',documentStatus:'draft'};
  datastore.purchases.push(p);await finalizePurchasePilotDraft(p.id);return p.id;
 },{number,qty});
 await expect.poll(()=>remotePurchases(server).find(x=>x.id===id)?.journalVoucherId,{timeout:13000}).toBeTruthy();
 return id;
}
test('pilot purchase: posted to corrective draft to edited balanced repost via document manager',async({page})=>{
 const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
 const originalId=await createPostedPurchase(page,server);
 expect(server.autoPostCount).toBe(1);
 const first=remotePurchases(server).find(x=>x.id===originalId);
 expect(first.accountingStatus).toBe('posted');
 const voucher=first.journalVoucherId;
 const untouched=[...server.records.values()].filter(x=>x.collection==='journalLines'&&x.data.voucherId===voucher).map(copy);
 expect(await page.evaluate(()=>productMovement('QA_PROD').available)).toBe(2);
 expect(await page.evaluate(()=>productKardexRows('QA_PROD').reduce((n,x)=>n+x.qty,0))).toBe(2);
 await page.evaluate(()=>{
  window.confirm=()=>true;window.prompt=()=> 'اصلاح مقدار خرید';
  navigateShell('accounting','view-journal','documents');
 });
 await expect(page.locator('#finora-purchase-document-management-body')).toContainText('PILOT-PUR-001');
 await expect(page.locator('#finora-purchase-document-management-body button[data-doc-action="reopen"]')).toHaveCount(1);
 // Technical correction primitive remains available for pre-existing in-progress
 // drafts; the new employee UI correctly DOES NOT write on open.
 await page.locator('#finora-purchase-document-management-body button[data-doc-action="reopen"]').click();
 expect(remotePurchases(server)).toHaveLength(1);
 await page.evaluate(()=>purCancelEdit());
 await page.evaluate(()=>runSync());
 server.failReverseAfterCommit=true;
 const uncertain=await page.evaluate(async id=>{try{await returnPostedPurchaseAsDraft(id,'تطبیق پیش‌نویس قدیمی');return 'unexpected'}catch(e){return String(e.message)}},originalId);
 expect(uncertain).not.toBe('unexpected');
 await page.evaluate(id=>returnPostedPurchaseAsDraft(id,'تطبیق پیش‌نویس قدیمی'),originalId);
 expect(server.reverseCount).toBe(1);
 await expect.poll(()=>remotePurchases(server).length,{timeout:14000}).toBe(2);
 const corrected=remotePurchases(server).find(x=>x.correctsPurchaseId===originalId);
 expect(corrected.documentStatus).toBe('draft');
 expect(corrected.journalVoucherId).toBeUndefined();
 expect(corrected.number).not.toBe(first.number);
 expect(await page.evaluate(()=>productMovement('QA_PROD').available)).toBe(0);
 expect(await page.evaluate(()=>productKardexRows('QA_PROD').reduce((n,x)=>n+x.qty,0))).toBe(0);
 expect(await page.evaluate(id=>purchaseDocumentStatus(getMyPurchases().find(x=>x.id===id)),originalId)).toBe('reversed');
 // Internal API fixture made a technical draft without clicking the employee form.
 await page.evaluate(id=>purEdit(id),corrected.id);
 await expect(page.locator('#pur-edit-id')).toHaveValue(corrected.id);
 await page.locator('#pur-items-body .pur-qty').first().fill('3');
 await page.locator('#pur-items-body .pur-qty').first().dispatchEvent('input');
 await page.locator('#pur-save-btn').click();
 await expect.poll(()=>remotePurchases(server).find(x=>x.id===corrected.id)?.grandTotal,{timeout:14000}).toBe(300);
 expect(await page.evaluate(()=>productMovement('QA_PROD').available)).toBe(0);
 await page.evaluate(()=>navigateShell('accounting','view-journal','documents'));
 await expect(page.locator('#finora-purchase-document-management-body button[data-doc-action="post"]')).toHaveCount(1);
 await page.locator('#finora-purchase-document-management-body button[data-doc-action="post"]').click();
 await expect.poll(()=>remotePurchases(server).find(x=>x.id===corrected.id)?.accountingStatus,{timeout:14000}).toBe('posted');
 expect(await page.evaluate(()=>productMovement('QA_PROD').available)).toBe(3);
 expect(await page.evaluate(()=>productKardexRows('QA_PROD').reduce((n,x)=>n+x.qty,0))).toBe(3);
 const journal=[...server.records.values()].filter(x=>x.collection==='journalVouchers');
 expect(journal).toHaveLength(3);
 expect(journal.find(x=>x.id===voucher).data.status).toBe('posted');
  expect(server.reversalStatuses.find(x=>x.voucher_id===voucher)?.effective_status).toBe('reversed');
 expect(untouched).toEqual([...server.records.values()].filter(x=>x.collection==='journalLines'&&x.data.voucherId===voucher).map(copy));
 for(const v of journal){
  const lines=[...server.records.values()].filter(x=>x.collection==='journalLines'&&x.data.voucherId===v.id);
  expect(lines.reduce((s,l)=>s+Number(l.data.debit||0),0)).toBe(lines.reduce((s,l)=>s+Number(l.data.credit||0),0));
 }
 const retry=await page.evaluate(id=>returnPostedPurchaseAsDraft(id,'تکرار'),originalId);
 expect(retry).toBe(corrected.id);
 expect(server.reverseCount).toBe(1);
 await page.reload({waitUntil:'domcontentloaded'});await authenticatedMockBrowser(page);
 expect(await page.evaluate(()=>productMovement('QA_PROD').available)).toBe(3);
 expect(await page.evaluate(()=>productKardexRows('QA_PROD').reduce((n,x)=>n+x.qty,0))).toBe(3);
});

test('pilot purchase denies paid/consumed source; cancels unallocated posting without erasing old voucher',async({page})=>{
 const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
 const purchaseId=await createPostedPurchase(page,server,'PILOT-PUR-GUARDS');
 // A payment allocation blocks both corrective reopen and cancellation.
 const blockedPayment=await page.evaluate(async id=>{
  datastore.payments.push({id:'QA-SETTLE',ownerUserId:currentUser.id,companyId:'QA_CO',direction:'outbound',invoiceType:'purchase',invoiceId:id,amount:10});
  try{await cancelPostedPurchasePilot(id,'ابطال');return 'unsafe'}catch(e){return String(e.message)}
 },purchaseId);
 expect(blockedPayment).toMatch(/پرداخت/);
 await page.evaluate(()=>{datastore.payments=datastore.payments.filter(x=>x.id!=='QA-SETTLE');});
 // Consumption means stock would become negative after purchase reversal.
 const blockedStock=await page.evaluate(async id=>{
  const sale={id:'QA-USE',ownerUserId:currentUser.id,companyId:'QA_CO',kind:'formal',documentStatus:'posted',items:[{prodId:'QA_PROD',qty:2}],grandTotal:200};
  datastore.invoices.push(sale);
  try{await returnPostedPurchaseAsDraft(id,'اصلاح');return 'unsafe'}catch(e){return String(e.message)}
 },purchaseId);
 expect(blockedStock).toMatch(/موجودی/);
 await page.evaluate(()=>{datastore.invoices=datastore.invoices.filter(x=>x.id!=='QA-USE');});
 await page.evaluate(id=>cancelPostedPurchasePilot(id,'ابطال خرید آزمایشی'),purchaseId);
 expect(server.reverseCount).toBe(1);
 await expect.poll(()=>[...server.records.values()].filter(x=>x.collection==='journalVouchers').length,{timeout:14000}).toBe(2);
 expect(remotePurchases(server)).toHaveLength(1);
 const original=remotePurchases(server)[0];
 expect(original.id).toBe(purchaseId);
 expect(await page.evaluate(id=>purchaseDocumentStatus(getMyPurchases().find(x=>x.id===id)),purchaseId)).toBe('reversed');
 expect(await page.evaluate(()=>productMovement('QA_PROD').available)).toBe(0);
 expect(await page.evaluate(id=>{try{deletePurchasePilotDraft(id);return 'unsafe'}catch(e){return String(e.message)}},purchaseId)).not.toBe('unsafe');
});
test('seamless sale correction: opening and cancelling leaves ledger unchanged; saving retains visible identity, printing and audit',async({page})=>{
 const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
 await fillInvoice(page,'SAME-SALE-001',2);await page.evaluate(()=>commitSaveInvoice());
 await expect.poll(()=>remoteInvoices(server).length,{timeout:13000}).toBe(1);
 const id=remoteInvoices(server)[0].id;await page.evaluate(x=>finalizeInvoiceDocument(x),id);
 await expect.poll(()=>remoteInvoices(server)[0]?.accountingStatus,{timeout:13000}).toBe('posted');
 const original=copy(remoteInvoices(server)[0]),initialLines=[...server.records.values()].filter(x=>x.collection==='journalLines').map(copy);
 await page.evaluate(()=>navigateShell('accounting','view-journal','documents'));
 await expect(page.locator('#finora-document-management-body tr')).toHaveCount(1);
 await page.locator('#finora-document-management-body [data-doc-action="reopen"]').click();
 await expect(page.locator('#edit-invoice-id')).toHaveValue(id);
 await expect(page.locator('#invoice-number')).toHaveValue('SAME-SALE-001');
 expect([...server.records.values()].filter(x=>x.collection==='journalVouchers')).toHaveLength(1);
 await page.evaluate(()=>cancelInvoiceEdit());
 expect([...server.records.values()].filter(x=>x.collection==='journalVouchers')).toHaveLength(1);
 expect(remoteInvoices(server)).toHaveLength(1);
 await page.evaluate(x=>beginInvoiceAmendment(x),id);
 await page.locator('#invoice-items-table-body .row-quantity').first().fill('3');
 await page.locator('#invoice-items-table-body .row-quantity').first().dispatchEvent('input');
 await page.evaluate(()=>commitSaveInvoice());
 await expect.poll(()=>remoteInvoices(server).filter(x=>x.correctsInvoiceId===id&&x.accountingStatus==='posted').length,{timeout:20000}).toBe(1);
 expect(remoteInvoices(server)).toHaveLength(2);expect(remoteInvoices(server).find(x=>x.id===id)).toEqual(original);
 const current=remoteInvoices(server).find(x=>x.correctsInvoiceId===id);
 expect(current.grandTotal).toBe(4500);
 expect(current.number).not.toBe(original.number);
 const visible=await page.evaluate(()=>invoiceVisibleRecords().map(x=>({id:x.id,number:invoiceVisibleNumber(x)})));
 expect(visible).toEqual([{id:current.id,number:'SAME-SALE-001'}]);
 await page.evaluate(()=>navigateShell('accounting','view-journal','documents'));
 await expect(page.locator('#finora-document-management-body tr')).toHaveCount(1);
 await expect(page.locator('#finora-document-management-body')).toContainText('SAME-SALE-001');
 await expect(page.locator('#finora-document-management-body')).not.toContainText('-اصلاح');
 await page.evaluate(x=>renderAndPrintDirect(x),id);
 await expect(page.locator('#printable-invoice')).toContainText('SAME-SALE-۰۰۱');
 await expect(page.locator('#printable-invoice')).toContainText('۴٬۵۰۰');
 await expect(page.locator('#printable-invoice')).not.toContainText('-اصلاح');
 expect(initialLines).toEqual([...server.records.values()].filter(x=>x.collection==='journalLines'&&x.data.voucherId===original.journalVoucherId).map(copy));
 const vouchers=[...server.records.values()].filter(x=>x.collection==='journalVouchers');
 expect(vouchers).toHaveLength(3);expect(vouchers.find(v=>v.id===original.journalVoucherId).data.status).toBe('posted');
 expect(server.reversalStatuses.find(x=>x.voucher_id===original.journalVoucherId)?.effective_status).toBe('reversed');
 await page.reload({waitUntil:'domcontentloaded'});await authenticatedMockBrowser(page);
 await page.evaluate(()=>navigateShell('accounting','view-journal','documents'));
 await expect(page.locator('#finora-document-management-body tr')).toHaveCount(1);
 await expect(page.locator('#finora-document-management-body')).toContainText('SAME-SALE-001');
});

test('seamless purchase correction: same visible number, no write on opening, save and print corrected purchase',async({page})=>{
 const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
 const id=await createPostedPurchase(page,server,'SAME-PURCHASE-001',2);
 const initial=copy(remotePurchases(server).find(x=>x.id===id));const before=[...server.records.values()].filter(x=>x.collection==='journalVouchers');
 await page.evaluate(()=>navigateShell('accounting','view-journal','documents'));
 await expect(page.locator('#finora-purchase-document-management-body tr')).toHaveCount(1);
 await page.locator('#finora-purchase-document-management-body [data-doc-action="reopen"]').click();
 await expect(page.locator('#pur-edit-id')).toHaveValue(id);
 await expect(page.locator('#pur-number')).toHaveValue('SAME-PURCHASE-001');
 expect([...server.records.values()].filter(x=>x.collection==='journalVouchers')).toHaveLength(before.length);
 await page.evaluate(()=>purCancelEdit());
 expect(remotePurchases(server)).toHaveLength(1);
 await page.evaluate(x=>beginPurchaseAmendment(x),id);
 await page.locator('#pur-items-body .pur-qty').first().fill('3');
 await page.locator('#pur-items-body .pur-qty').first().dispatchEvent('input');
 await page.locator('#pur-save-btn').click();
 await expect.poll(()=>remotePurchases(server).filter(x=>x.correctsPurchaseId===id&&x.accountingStatus==='posted').length,{timeout:20000}).toBe(1);
 expect(remotePurchases(server).find(x=>x.id===id)).toEqual(initial);
 const current=remotePurchases(server).find(x=>x.correctsPurchaseId===id);
 expect(current.grandTotal).toBe(300);expect(current.number).not.toBe(initial.number);
 const visible=await page.evaluate(()=>purchaseVisibleRecords().map(x=>({id:x.id,number:purchaseVisibleNumber(x)})));
 expect(visible).toEqual([{id:current.id,number:'SAME-PURCHASE-001'}]);
 await page.evaluate(()=>navigateShell('accounting','view-journal','documents'));
 await expect(page.locator('#finora-purchase-document-management-body tr')).toHaveCount(1);
 await expect(page.locator('#finora-purchase-document-management-body')).toContainText('SAME-PURCHASE-001');
 await expect(page.locator('#finora-purchase-document-management-body')).not.toContainText('-اصلاح');
 await page.evaluate(x=>purPrint(x),id);
 await expect(page.locator('#finora-purchase-document-management-body')).toContainText('SAME-PURCHASE-001');
 expect(await page.evaluate(()=>productMovement('QA_PROD').available)).toBe(3);
 await page.reload({waitUntil:'domcontentloaded'});await authenticatedMockBrowser(page);
 await page.evaluate(()=>navigateShell('accounting','view-journal','documents'));
 await expect(page.locator('#finora-purchase-document-management-body tr')).toHaveCount(1);
});
function remotePayments(server){return [...server.records.values()].filter(x=>x.collection==='payments').map(x=>copy(x.data));}
async function createUiPayment(page,server,amount=1000,direction='inbound'){
 await page.evaluate(()=>{switchView('view-payments');renderPayments()});
 await page.locator('#pay-direction').selectOption(direction);
 await page.locator('#pay-contact').selectOption('QA_CONTACT');
 await page.locator('#pay-method').selectOption('bank');
 await page.locator('#pay-amount').fill(String(amount));
 await page.locator('#pay-reference').fill('REF-ORIGINAL-001');
 await page.evaluate(()=>commitSavePayment());
 await expect.poll(()=>remotePayments(server).length,{timeout:13000}).toBe(1);
 await expect.poll(()=>remotePayments(server)[0]?.accountingStatus,{timeout:13000}).toBe('posted');
 return remotePayments(server)[0].id;
}

test('treasury amendment edit form opens without on-open ledger writes or changing the original',async({page})=>{
 const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
 const firstId=await createUiPayment(page,server);
 await page.waitForFunction(()=>!syncPending&&!syncRunning);
 const first=copy(remotePayments(server).find(p=>p.id===firstId));
 const oldLines=[...server.records.values()].filter(x=>x.collection==='journalLines'&&x.data.voucherId===first.journalVoucherId).map(copy);
 const beforeRpc=server.rpcCount;
 await expect(page.locator('#payments-ledger tr')).toHaveCount(1);
 await page.evaluate(()=>navigateShell('accounting','view-journal','documents'));
 await expect(page.locator('#finora-treasury-document-management-body tr')).toHaveCount(1);
 await page.locator('#finora-treasury-document-management-body [data-doc-action="edit"]').click();
 await expect(page.locator('#pay-amount')).toHaveValue('1,000');
 await expect(page.locator('#pay-reference')).toHaveValue('REF-ORIGINAL-001');
 await page.evaluate(()=>resetPaymentForm());
 expect(server.rpcCount).toBe(beforeRpc);
 expect([...server.records.values()].filter(x=>x.collection==='journalVouchers')).toHaveLength(1);
 expect(remotePayments(server)).toEqual([first]);
 expect(oldLines).toEqual([...server.records.values()].filter(x=>x.collection==='journalLines'&&x.data.voucherId===first.journalVoucherId).map(copy));
});

for(const direction of ['inbound','outbound'])test('P0 #238 expected RED: '+direction+' treasury correction Save must leave the new linked journal DRAFT',async({page})=>{
 const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
 const firstId=await createUiPayment(page,server,1000,direction);
 await page.waitForFunction(()=>!syncPending&&!syncRunning);
 const first=copy(remotePayments(server).find(p=>p.id===firstId));
 const originalVoucher=copy(server.records.get('journalVouchers|'+first.journalVoucherId));
 const originalLines=[...server.records.values()].filter(x=>x.collection==='journalLines'&&x.data.voucherId===first.journalVoucherId).map(copy);
 if(first?.accountingStatus!=='posted'||originalVoucher?.data.status!=='posted'||originalLines.length<2)
  throw Error('Original posted treasury fixture invalid; NOT the expected correction Save RED');
 const sourceType=direction==='outbound'?'payment':'receipt';
 await page.locator('#payments-ledger button').first().click();
 await expect(page.locator('#pay-amount')).toHaveValue('1,000');
 await page.locator('#pay-amount').fill('1250');
 await page.locator('#pay-note').fill('اصلاح مبلغ');
 await page.locator('#pay-save').click();
 await expect.poll(()=>remotePayments(server).filter(p=>p.correctsPaymentId===firstId).length,{timeout:18000}).toBe(1);
 await page.waitForFunction(()=>!syncPending&&!syncRunning);
 const original=remotePayments(server).find(p=>p.id===firstId);
 const amended=remotePayments(server).find(p=>p.correctsPaymentId===firstId);
 if(!amended||amended.amount!==1250||amended.companyId!=='QA_CO'||amended.direction!==direction||
    amended.reference!==first.reference||!amended.journalVoucherId)
  throw Error('Treasury correction fixture invalid; NOT the expected product RED: '+JSON.stringify(amended));
 const vouchers=[...server.records.values()].filter(x=>x.collection==='journalVouchers');
 const linked=vouchers.find(x=>x.id===amended.journalVoucherId);
 const lines=[...server.records.values()].filter(x=>x.collection==='journalLines'&&x.data.voucherId===amended.journalVoucherId);
 const debit=lines.reduce((n,x)=>n+Number(x.data.debit||0),0);
 const credit=lines.reduce((n,x)=>n+Number(x.data.credit||0),0);
 const observed={
  originalSourceUnchanged:isDeepStrictEqual(original,first),
  originalVoucherStatus:vouchers.find(x=>x.id===first.journalVoucherId)?.data.status||'missing',
  originalLinesUnchanged:isDeepStrictEqual(originalLines,
   [...server.records.values()].filter(x=>x.collection==='journalLines'&&x.data.voucherId===first.journalVoucherId).map(copy)),
  correctionSourceStatus:amended.accountingStatus||'',
  correctionVoucherStatus:linked?.data.status||'missing',
  correctionLinkedToSource:!!linked&&linked.data.sourceType===sourceType&&linked.data.sourceId===amended.id,
  correctionHasReversalLink:!!amended.correctionReversalId,
  balancedCorrectionLines:lines.length>=2&&debit===credit&&debit===1250,
  correctionAlreadyPosted:vouchers.some(x=>x.data.status==='posted'&&x.data.sourceType===sourceType&&x.data.sourceId===amended.id),
  originalReversalVoucherCount:vouchers.filter(x=>x.data.voucherType==='reversal'&&x.data.sourceType==='reversal'&&x.data.sourceId===first.journalVoucherId).length,
  reversalVoucherPosted:vouchers.filter(x=>x.data.voucherType==='reversal'&&x.data.sourceType==='reversal'&&x.data.sourceId===first.journalVoucherId).every(x=>x.data.status==='posted'),
  voucherCount:vouchers.length,
  effectiveAmounts:await page.evaluate(()=>paymentEffectiveRecords().map(x=>x.amount))
 };
 const knownBroken={
  originalSourceUnchanged:true,originalVoucherStatus:'reversed',originalLinesUnchanged:true,
  correctionSourceStatus:'posted',correctionVoucherStatus:'posted',correctionLinkedToSource:true,
  correctionHasReversalLink:true,balancedCorrectionLines:true,correctionAlreadyPosted:true,
  originalReversalVoucherCount:1,reversalVoucherPosted:true,voucherCount:3,effectiveAmounts:[1250]
 };
 const required={
  originalSourceUnchanged:true,originalVoucherStatus:'reversed',originalLinesUnchanged:true,
  correctionSourceStatus:'draft',correctionVoucherStatus:'draft',correctionLinkedToSource:true,
  correctionHasReversalLink:true,balancedCorrectionLines:true,correctionAlreadyPosted:false,
  originalReversalVoucherCount:1,reversalVoucherPosted:true,voucherCount:3,effectiveAmounts:[]
 };
 assertKnownRedOrFixed(observed,knownBroken,required,'treasury-correction-'+direction);
 if(isDeepStrictEqual(observed,knownBroken))
  console.log('FINORA_ISSUE238_PAYMENT_CORRECTION_EXPECTED_RED '+direction+': correction Save immediately posts its new source-linked journal');
 test.fail(true,'#238 / ADR216: treasury correction Save must leave the new source-linked journal draft until independent accounting approval');
 expect(observed).toEqual(required);
});

test('treasury correction excludes cheque, linked settlements and locked periods; cancellation retains immutable history',async({page})=>{
 const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
 const id=await createUiPayment(page,server,450,'outbound');
 const noCheck=await page.evaluate(async id=>{
  const p=getMyPayments().find(x=>x.id===id);
  const saved=p.method;p.method='cheque';
  try{await paymentAmendPosted(id,{direction:p.direction,contactId:p.contactId,companyId:p.companyId,
   amount:400,method:'cash',invoiceId:'',invoiceType:'',reference:'x',note:'x'});return 'unsafe';}
  catch(e){return String(e.message)}
  finally{p.method=saved}
 },id);
 expect(noCheck).toMatch(/چک|تطبیق/);
 const linked=await page.evaluate(async id=>{
  const p=getMyPayments().find(x=>x.id===id);
  p.invoiceType='purchase';p.invoiceId='QA_LINKED';
  try{await paymentCancelPosted(id,'ابطال');return 'unsafe';}
  catch(e){return String(e.message)}
  finally{p.invoiceType='';p.invoiceId=''}
 },id);
 expect(linked).toMatch(/تسویه|فاکتور|تطبیق/);
 const locked=await page.evaluate(async id=>{
  const fy=getMyFiscalYears()[0],old=fy.status;
  fy.status='locked';
  try{await paymentCancelPosted(id,'ابطال');return 'unsafe';}
  catch(e){return String(e.message)}
  finally{fy.status=old}
 },id);
 expect(locked).toMatch(/قفل|سال مالی/);
 await page.evaluate(()=>{window.confirm=()=>true;window.prompt=()=> 'ابطال اشتباه آزمایشی';});
 await page.evaluate(id=>deletePayment(id),id);
 await expect.poll(()=>[...server.records.values()].filter(x=>x.collection==='journalVouchers').length,{timeout:15000}).toBe(2);
 expect(remotePayments(server)).toHaveLength(1);
 expect(remotePayments(server)[0].id).toBe(id);
 expect(await page.evaluate(id=>paymentPostingStatus(getMyPayments().find(x=>x.id===id)),id)).toBe('reversed');
 expect(await page.evaluate(()=>paymentEffectiveRecords().length)).toBe(0);
 await page.evaluate(()=>{switchView('view-payments');renderPayments()});
 await expect(page.locator('#payments-ledger')).toContainText('ابطال‌شده');
});

test('treasury amend rejection on lost RPC keeps protected original on server and no partial correction payload',async({page})=>{
 const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
 const id=await createUiPayment(page,server);
 await page.waitForFunction(()=>!syncPending&&!syncRunning);
 const before=copy(remotePayments(server)[0]);
 const vouchersBefore=[...server.records.values()].filter(x=>x.collection==='journalVouchers').map(x=>x.id);
 server.failNext=true;
 await page.evaluate(id=>editPayment(id),id);
 await page.locator('#pay-amount').fill('1800');
 await page.locator('#pay-save').click();
 await expect.poll(async()=>await page.evaluate(()=>window.__f0Alerts.some(x=>x.includes('اصلاح کامل نشد'))),{timeout:8000}).toBe(true);
 expect(server.failCount).toBe(1);
 // The RPC did not persist any subset of the combined financial diff.
 expect(remotePayments(server)).toEqual([before]);
 expect([...server.records.values()].filter(x=>x.collection==='journalVouchers').map(x=>x.id)).toEqual(vouchersBefore);
 // After uncertain acknowledgment, do not call the amend API again blindly.
});
test('cannot finalize draft if fiscal posting chart has no required account; draft remains intact',async({page})=>{
 const server=fakeServer();server.records.delete('accounts|A_REV');await installHarness(page,server);await authenticatedMockBrowser(page);
 await fillInvoice(page,'FIN-NO-REVENUE-ACCOUNT',2);await page.evaluate(()=>commitSaveInvoice());
 await expect.poll(()=>remoteInvoices(server).length,{timeout:13000}).toBe(1);
 const id=remoteInvoices(server)[0].id;
 const result=await page.evaluate(async x=>{try{await finalizeInvoiceDocument(x);return 'unexpected success'}catch(e){return String(e.message)}},id);
 expect(result).toMatch(/حساب|کدینگ/);
 expect(remoteInvoices(server)[0].accountingStatus).toBe('draft');
 expect([...server.records.values()].filter(x=>x.collection==='journalVouchers')).toHaveLength(0);
});


test('F2 validates formal invoice then saves a draft without posting any financial journal',async({page})=>{
 const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
 await page.keyboard.press('F2');
 expect(remoteInvoices(server)).toHaveLength(0);
 expect(await page.evaluate(()=>window.__f0Alerts.at(-1))).toMatch(/حداقل یک کالا|خدمت معتبر/);
 await fillInvoice(page,'F2-SAFE-DRAFT-001',2);
 await page.keyboard.press('F2');
 await expect.poll(()=>remoteInvoices(server).length,{timeout:14000}).toBe(1);
 const saved=remoteInvoices(server)[0];
 expect(saved.number).toBe('F2-SAFE-DRAFT-001');
 expect(saved.accountingStatus).toBe('draft');
 expect(saved.documentStatus).toBe('draft');
 expect([...server.records.values()].filter(x=>x.collection==='journalVouchers')).toHaveLength(0);
 await page.keyboard.press('F2');
 expect(remoteInvoices(server)).toHaveLength(1);
 expect([...server.records.values()].filter(x=>x.collection==='journalVouchers')).toHaveLength(0);
});

async function pastePaymentAmount(page,text){
 await page.context().grantPermissions(['clipboard-read','clipboard-write']);
 await page.evaluate(value=>navigator.clipboard.writeText(value),text);
 await page.locator('#pay-amount').focus();
 await page.keyboard.press('ControlOrMeta+A');
 await page.keyboard.press('ControlOrMeta+V');
}

for(const [script,typed,pasted] of [
 ['Latin','1234567','1,234,567'],
 ['Persian','۱۲۳۴۵۶۷','۱٬۲۳۴٬۵۶۷'],
 ['Arabic','١٢٣٤٥٦٧','١٬٢٣٤٬٥٦٧'],
]){
 test(`treasury amount groups ${script} typing and clipboard paste without changing numeric saved value`,async({page})=>{
  const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
  await page.evaluate(()=>{switchView('view-payments');renderPayments()});
  const amount=page.locator('#pay-amount');
  await amount.pressSequentially(typed);
  await expect(amount).toHaveValue('1,234,567');
  await pastePaymentAmount(page,pasted);
  await expect(amount).toHaveValue('1,234,567');
  await page.locator('#pay-contact').selectOption('QA_CONTACT');
  await page.locator('#pay-save').click();
  await expect.poll(()=>remotePayments(server).length,{timeout:13000}).toBe(1);
  expect(remotePayments(server)[0].amount).toBe(1234567);
  expect(remotePayments(server)[0].accountingStatus).toBe('posted');
 });
}

test('treasury amount editing groups an existing value and preserves numeric correction payload and original history',async({page})=>{
 const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
 const id=await createUiPayment(page,server,1234567.5);
 const original=copy(remotePayments(server)[0]);
 await page.locator('#payments-ledger button').first().click();
 await expect(page.locator('#pay-amount')).toHaveValue('1,234,567.5');
 await page.locator('#pay-save').click();
 await expect.poll(()=>remotePayments(server).find(x=>x.correctsPaymentId===id)?.amount,{timeout:18000}).toBe(1234567.5);
 const unchanged=remotePayments(server).find(x=>x.correctsPaymentId===id);
 expect(remotePayments(server).find(x=>x.id===id)).toEqual(original);
 await page.locator('#payments-ledger button').first().click();
 await pastePaymentAmount(page,'۲٬۳۴۵٬۶۷۸٫۵');
 await expect(page.locator('#pay-amount')).toHaveValue('2,345,678.5');
 await page.locator('#pay-save').click();
 await expect.poll(()=>remotePayments(server).find(x=>x.correctsPaymentId===unchanged.id)?.amount,{timeout:18000}).toBe(2345678.5);
 expect(remotePayments(server).find(x=>x.id===id)).toEqual(original);
});

test('treasury amount keeps negative and invalid pasted input rejectable with no payment or journal write',async({page})=>{
 const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
 await page.evaluate(()=>{switchView('view-payments');renderPayments()});
 await page.locator('#pay-contact').selectOption('QA_CONTACT');
 for(const value of ['-1,234','−۱٬۲۳۴','1,234oops','1.2.3','Infinity','1e6','']){
  await pastePaymentAmount(page,value);
  await page.evaluate(()=>{window.__f0Alerts=[]});
  await page.locator('#pay-save').click();
  expect(await page.evaluate(()=>window.__f0Alerts.length),value).toBe(1);
  expect(await page.evaluate(()=>datastore.payments.length)).toBe(0);
  expect(await page.evaluate(()=>datastore.journalVouchers.length)).toBe(0);
 }
 expect(remotePayments(server)).toEqual([]);
});

test('treasury amount grouping keeps the insertion caret while editing digits in the middle',async({page})=>{
 const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
 await page.evaluate(()=>{switchView('view-payments');renderPayments()});
 const amount=page.locator('#pay-amount');
 await amount.pressSequentially('1234567');
 await expect(amount).toHaveValue('1,234,567');
 await amount.press('Home');await amount.press('ArrowRight');
 await amount.pressSequentially('9');
 await expect(amount).toHaveValue('19,234,567');
 expect(await amount.evaluate(el=>el.selectionStart)).toBe(2);
});

for(const direction of ['outbound','inbound'])test('contact operational balance includes effective '+direction+' settlements once and isolates company',async({page})=>{
 const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
 await page.evaluate(({direction,USER})=>{
  const base={ownerUserId:USER,companyId:'QA_CO',contactId:'QA_CONTACT'};
  datastore.companies.push({id:'QA_OTHER',ownerUserId:USER,name:'Other company'});
  const voucher=(id,status='posted')=>({id,ownerUserId:USER,companyId:'QA_CO',status});
  datastore.journalVouchers.push(voucher('J_TRADE'),voucher('J_OLD','reversed'),voucher('J_NEW'),voucher('J_CANCEL','reversed'),{...voucher('J_FOREIGN'),companyId:'QA_OTHER'});
  const trade={...base,id:'TRADE',supplierId:'QA_CONTACT',kind:'formal',grandTotal:1000,paymentMethod:'credit',journalVoucherId:'J_TRADE',number:'TRADE-VALID'};
  datastore[direction==='outbound'?'purchases':'invoices']=[trade,{...trade,id:'DRAFT',number:'DRAFT-EXCLUDED',journalVoucherId:'',accountingStatus:'draft',documentStatus:'draft',grandTotal:99999},{...trade,id:'FOREIGN',number:'FOREIGN-EXCLUDED',companyId:'QA_OTHER',journalVoucherId:'J_FOREIGN',grandTotal:8000}];
  if(direction==='inbound')datastore.invoices.push({...trade,id:'PROFORMA',number:'PROFORMA-EXCLUDED',kind:'pre_invoice'});
  datastore.payments=[
   {...base,id:'ALLOC',direction,method:'bank',amount:200,invoiceType:direction==='outbound'?'purchase':'sale',invoiceId:'TRADE'},
   {...base,id:'OLD',direction,method:'bank',amount:600,journalVoucherId:'J_OLD'},
   {...base,id:'NEW',direction,method:'bank',amount:300,journalVoucherId:'J_NEW',correctsPaymentId:'OLD'},
   {...base,id:'CANCEL',direction,method:'bank',amount:700,journalVoucherId:'J_CANCEL'},
   {...base,id:'RAW-CHEQUE',direction,method:'cheque',amount:900},
   {...base,id:'OTHER',direction,method:'bank',amount:9000,companyId:'QA_OTHER'},
   {...base,id:'UNSCOPED',direction,method:'bank',amount:5555,companyId:''},
   {...base,id:'BADALLOC',direction,method:'bank',amount:6666,invoiceType:direction==='outbound'?'purchase':'sale',invoiceId:'FOREIGN'}
  ];
  datastore.cheques=[{...base,id:'CHQ',direction,amount:9999,status:'registered',contactName:'خریدار آزمایشی'}];
  window.__contactBefore=JSON.stringify([datastore.invoices,datastore.purchases,datastore.payments,datastore.journalVouchers,datastore.cheques]);
  switchView('view-contacts');renderContacts();
 },{direction,USER});
 const row=page.locator('#contacts-ledger-table-body tr').first();
 await expect(row.locator('td').nth(6)).toContainText('۵۰۰');
 await row.locator('td').nth(6).locator('button').click();
 const body=page.locator('#finora-drill-body');
 await expect(body.locator('[data-contact-net]')).toHaveAttribute('data-contact-net',direction==='outbound'?'-500':'500');
 await expect(body).not.toContainText('DRAFT-EXCLUDED');await expect(body).not.toContainText('FOREIGN-EXCLUDED');await expect(body).not.toContainText('PROFORMA-EXCLUDED');
 expect(await page.evaluate(()=>JSON.stringify([datastore.invoices,datastore.purchases,datastore.payments,datastore.journalVouchers,datastore.cheques])===window.__contactBefore)).toBe(true);
 await page.evaluate(({direction,USER})=>{
  datastore.journalVouchers.push({id:'J_CHEQUE',ownerUserId:USER,companyId:'QA_CO',status:'posted'});
  const scope={ownerUserId:USER,companyId:'QA_CO',contactId:'QA_CONTACT',direction,amount:100,journalVoucherId:'J_CHEQUE'};
  datastore.payments.push({...scope,id:'PAY_CHEQUE',method:'cheque'});
  datastore.cheques.push({...scope,id:'REGISTER_CHEQUE',status:'registered'});
  renderContacts();openContactLedger('QA_CONTACT');
 },{direction,USER});
 await expect(body.locator('[data-contact-net]')).toHaveAttribute('data-contact-net',direction==='outbound'?'-400':'400');
 await page.evaluate(()=>{closeFinoraDrill();getMySettings().default_company_id='QA_OTHER';renderContacts();openContactLedger('QA_CONTACT')});
 await expect(body.locator('[data-contact-net]')).toHaveAttribute('data-contact-net',direction==='outbound'?'1000':'-1000');
 await expect(body).toContainText(direction==='outbound'?'پیش‌پرداخت':'پیش‌دریافت');
});


test('contact operational balance reflects a saved unallocated supplier payment after reload',async({page})=>{
 const server=fakeServer();
 server.records.set('journalVouchers|J_PUR',{collection:'journalVouchers',id:'J_PUR',data:{companyId:'QA_CO',status:'posted'}});
 server.records.set('purchases|P_BAL',{collection:'purchases',id:'P_BAL',data:{companyId:'QA_CO',supplierId:'QA_CONTACT',number:'PUR-BAL',grandTotal:1000,paymentMethod:'credit',journalVoucherId:'J_PUR'}});
 await installHarness(page,server);await authenticatedMockBrowser(page);
 await page.evaluate(()=>{switchView('view-payments');renderPayments()});
 await page.locator('#pay-direction').selectOption('outbound');
 await page.locator('#pay-contact').selectOption('QA_CONTACT');
 await page.locator('#pay-method').selectOption('bank');
 await page.locator('#pay-amount').fill('450');
 await page.locator('#pay-save').click();
 await expect.poll(()=>remotePayments(server)[0]?.accountingStatus,{timeout:13000}).toBe('posted');
 await page.evaluate(()=>{switchView('view-contacts');renderContacts();openContactLedger('QA_CONTACT')});
 await expect(page.locator('[data-contact-net]')).toHaveAttribute('data-contact-net','-550');
 await expect(page.locator('#finora-drill-body')).toContainText('پرداخت — بدون تخصیص');
 await page.reload({waitUntil:'domcontentloaded'});await authenticatedMockBrowser(page);
 await page.evaluate(()=>openContactLedger('QA_CONTACT'));
 await expect(page.locator('[data-contact-net]')).toHaveAttribute('data-contact-net','-550');
 expect(remotePayments(server)).toHaveLength(1);
});


// Issue #229 / ADR0216: executable expected-RED acceptance contracts.
// test.fail is a transparent temporary xfail, NOT a product PASS. Remove
// annotations only after the linked-draft lifecycle works end-to-end.
test('P0 #229 expected RED: purchase Save must not auto-post',async({page})=>{
 const server=fakeServer();
 await installHarness(page,server);
 await authenticatedMockBrowser(page);
 await page.evaluate(()=>{
  switchView('view-purchases');
  refreshAllSurfaces();
  const supplier=document.getElementById('pur-supplier');
  if(!supplier?.querySelector('option[value="QA_CONTACT"]'))
   throw Error('QA supplier option missing: fixture setup failure, NOT accounting RED');
  supplier.value='QA_CONTACT';
  document.getElementById('pur-number').value='QA-ADR216-PUR-NO-AUTOPOST';
  document.getElementById('pur-date').value='1405/07/19';
  document.getElementById('pur-payment-method').value='credit';
  const row=document.querySelector('#pur-items-body tr');
  if(!row?.querySelector('.pur-prod option[value="QA_PROD"]'))
   throw Error('QA product option missing: fixture setup failure, NOT accounting RED');
  row.querySelector('.pur-prod').value='QA_PROD';
  row.querySelector('.pur-qty').value='2';
  row.querySelector('.pur-price').value='100';
  purRecalc();
 });
 await page.locator('#pur-save-btn').click();
 await expect.poll(()=>[...server.records.values()].filter(x=>x.collection==='purchases').length,
  {timeout:15000}).toBe(1);
 await expect.poll(()=>page.evaluate(()=>!document.getElementById('pur-save-btn').disabled),
  {timeout:15000}).toBe(true);
 const purchase=[...server.records.values()].find(x=>x.collection==='purchases');
 const vouchers=[...server.records.values()].filter(x=>x.collection==='journalVouchers');
 const observed={
  documentStatus:purchase?.data.documentStatus,
  accountingStatus:purchase?.data.accountingStatus,
  hasLinkedDraft:!!purchase?.data.journalVoucherId&&vouchers.some(v=>
   v.id===purchase.data.journalVoucherId&&v.data.status==='draft'),
  postedVouchers:vouchers.filter(v=>v.data.status==='posted').length,
  automaticPostCalls:server.autoPostCount||0
 };
 // CURRENT: posted, posted, no linked draft, one posted voucher, one autopost.
 // REQUIRED: business source + linked draft; no final number/posted voucher.
 assertKnownRedOrFixed(observed,{
  documentStatus:'posted',accountingStatus:'posted',hasLinkedDraft:false,
  postedVouchers:1,automaticPostCalls:1
 },{
  documentStatus:'draft',accountingStatus:'draft',hasLinkedDraft:true,
  postedVouchers:0,automaticPostCalls:0
 },'purchase-initial-save');
 test.fail(true,'#229: Save invokes automatic posting instead of persisted linked draft');
 expect(observed).toEqual({
  documentStatus:'draft',accountingStatus:'draft',hasLinkedDraft:true,
  postedVouchers:0,automaticPostCalls:0
 });
});


test('P0 #229 linked journal draft stays draft for both sales and purchases',async({page})=>{
 const server=fakeServer();
 await installHarness(page,server);
 await authenticatedMockBrowser(page);
 const observed=await page.evaluate(()=>{
  const ownerUserId=currentUser.id,companyId='QA_CO';
  const sale={id:'QA_SALE_LINK_DRAFT',ownerUserId,companyId,kind:'formal',
   journalVoucherId:'QA_SALE_JV_DRAFT',accountingStatus:'draft',documentStatus:'draft'};
  const purchase={id:'QA_PUR_LINK_DRAFT',ownerUserId,companyId,
   journalVoucherId:'QA_PUR_JV_DRAFT',accountingStatus:'draft',documentStatus:'draft'};
  const conflictingSale={...sale,id:'QA_SALE_LINK_CONFLICT',
   journalVoucherId:'QA_SALE_JV_CONFLICT',accountingStatus:'posted'};
  const conflictingPurchase={...purchase,id:'QA_PUR_LINK_CONFLICT',
   journalVoucherId:'QA_PUR_JV_CONFLICT',documentStatus:'posted'};
  const danglingSale={...sale,id:'QA_SALE_LINK_DANGLING',journalVoucherId:'QA_NOT_FOUND_SALE'};
  const danglingPurchase={...purchase,id:'QA_PUR_LINK_DANGLING',journalVoucherId:'QA_NOT_FOUND_PUR'};
  const partiallyReversedSale={...sale,id:'QA_SALE_PARTIAL',journalVoucherId:'QA_SALE_JV_PARTIAL',
   accountingStatus:'posted',documentStatus:'posted'};
  const partiallyReversedPurchase={...purchase,id:'QA_PUR_PARTIAL',journalVoucherId:'QA_PUR_JV_PARTIAL',
   accountingStatus:'posted',documentStatus:'posted'};
  datastore.invoices.push(sale,conflictingSale,danglingSale,partiallyReversedSale);
  datastore.purchases.push(purchase,conflictingPurchase,danglingPurchase,partiallyReversedPurchase);
  datastore.journalVouchers.push(
   {id:'QA_SALE_JV_DRAFT',ownerUserId,companyId,status:'draft',
    sourceType:'sale',sourceId:sale.id},
   {id:'QA_PUR_JV_DRAFT',ownerUserId,companyId,status:'draft',
    sourceType:'purchase',sourceId:purchase.id},
   {id:'QA_SALE_JV_CONFLICT',ownerUserId,companyId,status:'draft',
    sourceType:'sale',sourceId:conflictingSale.id},
   {id:'QA_PUR_JV_CONFLICT',ownerUserId,companyId,status:'draft',
    sourceType:'purchase',sourceId:conflictingPurchase.id},
   {id:'QA_SALE_JV_PARTIAL',ownerUserId,companyId,status:'posted',
    sourceType:'sale',sourceId:partiallyReversedSale.id},
   {id:'QA_PUR_JV_PARTIAL',ownerUserId,companyId,status:'posted',
    sourceType:'purchase',sourceId:partiallyReversedPurchase.id}
  );
  // Effective status can be partial while the immutable original remains posted.
  jeRpcEffectiveStatuses.set('QA_SALE_JV_PARTIAL','partially_reversed');
  jeRpcEffectiveStatuses.set('QA_PUR_JV_PARTIAL','partially_reversed');
  return {
   sale:invoiceDocumentStatus(sale),
   purchase:purchaseDocumentStatus(purchase),
   conflictingSale:invoiceDocumentStatus(conflictingSale),
   conflictingPurchase:purchaseDocumentStatus(conflictingPurchase),
   danglingSale:invoiceDocumentStatus(danglingSale),
   danglingPurchase:purchaseDocumentStatus(danglingPurchase),
   partiallyReversedSale:invoiceDocumentStatus(partiallyReversedSale),
   partiallyReversedPurchase:purchaseDocumentStatus(partiallyReversedPurchase),
   saleDirectEditPermitted:invoiceMayEdit(sale),
   purchaseDirectEditPermitted:(()=>{
    const before=document.getElementById('pur-edit-id')?.value||'';
    const prevAlert=window.alert;
    let warning='';
    window.alert=message=>{warning=String(message)};
    try{purEdit(purchase.id)}finally{window.alert=prevAlert}
    return (document.getElementById('pur-edit-id')?.value||'')!==before||
      !warning.includes('سند موقت متصل');
   })(),
   voucherStates:getMyJournalVouchers().filter(v=>v.id.endsWith('_JV_DRAFT')).map(v=>v.status)
  };
 });
 expect(observed).toEqual({
  sale:'draft',purchase:'draft',
  conflictingSale:'legacy_review',conflictingPurchase:'legacy_review',
  danglingSale:'legacy_review',danglingPurchase:'legacy_review',
  partiallyReversedSale:'posted',partiallyReversedPurchase:'posted',
  saleDirectEditPermitted:false,purchaseDirectEditPermitted:false,
  voucherStates:['draft','draft']
 });
});


test('P0 #229 linked journal drafts do not advertise unsupported source-only edit or finalize buttons',async({page})=>{
 const server=fakeServer();
 await installHarness(page,server);
 await authenticatedMockBrowser(page);
 const observed=await page.evaluate(()=>{
  const ownerUserId=currentUser.id,companyId='QA_CO';
  const sale={id:'QA_SALE_LINKED_UI',ownerUserId,companyId,number:'QA-SALE-LINKED-UI',
   companyName:'QA Company',contactId:'QA_CONTACT',contactName:'QA Customer',
   date:'1405/07/19',kind:'formal',kindLabel:'رسمی',items:[],grandTotal:170,
   journalVoucherId:'QA_SALE_JV_LINKED_UI',accountingStatus:'draft',documentStatus:'draft'};
  const purchase={id:'QA_PUR_LINKED_UI',ownerUserId,companyId,number:'QA-PUR-LINKED-UI',
   supplierId:'QA_CONTACT',supplierName:'QA Supplier',date:'1405/07/19',
   items:[],grandTotal:170,journalVoucherId:'QA_PUR_JV_LINKED_UI',
   accountingStatus:'draft',documentStatus:'draft'};
  datastore.invoices.push(sale);
  datastore.purchases.push(purchase);
  datastore.journalVouchers.push(
   {id:sale.journalVoucherId,ownerUserId,companyId,status:'draft',sourceType:'sale',sourceId:sale.id},
   {id:purchase.journalVoucherId,ownerUserId,companyId,status:'draft',sourceType:'purchase',sourceId:purchase.id}
  );
  switchView('view-purchases');
  refreshAllSurfaces();
  renderInvoices();
  const purRow=[...document.querySelectorAll('#pur-list-body tr')].find(tr=>tr.textContent.includes(purchase.number));
  const saleRow=[...document.querySelectorAll('#invoice-archive-table-body tr')].find(tr=>tr.textContent.includes(sale.number));
  if(!purRow||!saleRow)throw Error('Linked draft source rows missing from browser DOM; fixture failure');
  return {
   purchaseStatus:purchaseDocumentStatus(purchase),
   saleStatus:invoiceDocumentStatus(sale),
   purchaseMessage:purRow.textContent.includes('سند موقت متصل'),
   purchaseActions:[...purRow.querySelectorAll('button')].map(b=>b.getAttribute('onclick')||''),
   saleActions:[...saleRow.querySelectorAll('button')].map(b=>b.getAttribute('onclick')||'')
  };
 });
 expect(observed.purchaseStatus).toBe('draft');
 expect(observed.saleStatus).toBe('draft');
 expect(observed.purchaseMessage).toBe(true);
 expect(observed.purchaseActions).toEqual([expect.stringContaining('purPrint(')]);
 expect(observed.saleActions).toContainEqual(expect.stringContaining('renderAndPrintDirect('));
 expect(observed.saleActions).not.toContainEqual(expect.stringContaining('editInvoice('));
 expect(observed.saleActions).not.toContainEqual(expect.stringContaining('beginInvoiceAmendment('));
});


test('P0 #229 linked draft direct actions deny before confirm, sync or autopost',async({page})=>{
 const server=fakeServer();
 await installHarness(page,server);
 await authenticatedMockBrowser(page);
 const observed=await page.evaluate(async()=>{
  const ownerUserId=currentUser.id,companyId='QA_CO';
  const sale={id:'QA_SALE_LINK_ACTION',ownerUserId,companyId,kind:'formal',
   kindLabel:'رسمی',companyName:'QA Company',number:'QA-SALE-LINK-ACTION',
   contactId:'QA_CONTACT',contactName:'QA Customer',date:'1405/07/19',
   items:[],grandTotal:170,journalVoucherId:'QA_SALE_JV_LINK_ACTION',
   documentStatus:'draft',accountingStatus:'draft'};
  const purchase={id:'QA_PUR_LINK_ACTION',ownerUserId,companyId,
   number:'QA-PUR-LINK-ACTION',supplierId:'QA_CONTACT',supplierName:'QA Supplier',
   date:'1405/07/19',items:[],grandTotal:170,
   journalVoucherId:'QA_PUR_JV_LINK_ACTION',documentStatus:'draft',accountingStatus:'draft'};
  datastore.invoices.push(sale);datastore.purchases.push(purchase);
  datastore.journalVouchers.push(
   {id:sale.journalVoucherId,ownerUserId,companyId,status:'draft',
    sourceType:'sale',sourceId:sale.id},
   {id:purchase.journalVoucherId,ownerUserId,companyId,status:'draft',
    sourceType:'purchase',sourceId:purchase.id}
  );
  const snapshot=()=>JSON.stringify({
   sale:datastore.invoices.find(x=>x.id===sale.id),
   purchase:datastore.purchases.find(x=>x.id===purchase.id),
   journals:datastore.journalVouchers.filter(x=>x.id.endsWith('_JV_LINK_ACTION'))});
  const before=snapshot(),alerts=[];
  let confirmCalls=0,directDenial='';
  const previousConfirm=window.confirm,previousAlert=window.alert;
  window.confirm=()=>{confirmCalls++;return true;};
  window.alert=value=>alerts.push(String(value));
  try{
   try{await finalizeInvoiceDocument(sale.id)}catch(e){directDenial=String(e.message);}
   await finalizeInvoiceDocumentUi(sale.id);
   await purFinalizeUi(purchase.id);
   purDeleteDraftUi(purchase.id);
  }finally{window.confirm=previousConfirm;window.alert=previousAlert;}
  switchView('view-purchases');refreshAllSurfaces();renderInvoices();
  const saleRow=[...document.querySelectorAll('#invoice-archive-table-body tr')]
   .find(tr=>tr.textContent.includes(sale.number));
  const purchaseRow=[...document.querySelectorAll('#pur-list-body tr')]
   .find(tr=>tr.textContent.includes(purchase.number));
  if(!saleRow||!purchaseRow)throw Error('Linked draft action register row missing');
  return {confirmCalls,directDenial,alerts,unchanged:before===snapshot(),
   saleLabel:saleRow.textContent,purchaseLabel:purchaseRow.textContent};
 });
 expect(observed.confirmCalls).toBe(0);
 expect(observed.directDenial).toContain('سند موقت متصل');
 expect(observed.alerts.filter(x=>x.includes('قطعی‌سازی مستقل'))).toHaveLength(2);
 expect(observed.alerts.some(x=>x.includes('حذف سند موقت متصل'))).toBe(true);
 expect(observed.unchanged).toBe(true);
 expect(observed.saleLabel).toContain('پیش‌نویس متصل');
 expect(observed.saleLabel).not.toContain('پیش‌نویس قابل ویرایش');
 expect(observed.purchaseLabel).toContain('موقت متصل');
 expect(observed.purchaseLabel).not.toContain('موقت قابل اصلاح');
 expect(server.autoPostCount||0).toBe(0);
});


test('P0 #229 expected RED: formal sale Save must persist linked journal draft without posting',async({page})=>{
 const server=fakeServer();
 await installHarness(page,server);
 await authenticatedMockBrowser(page);
 await fillInvoice(page,'QA-ADR216-SALE-LINK-DRAFT',2);
 await page.evaluate(()=>commitSaveInvoice());
 await expect.poll(()=>remoteInvoices(server).length,{timeout:14000}).toBe(1);
 // A fixture failure is not allowed to masquerade as the expected accounting RED.
 await page.waitForFunction(()=>!syncPending&&!syncRunning);
 const source=remoteInvoices(server)[0];
 if(source.number!=='QA-ADR216-SALE-LINK-DRAFT'||source.kind!=='formal'||
    source.companyId!=='QA_CO'||source.grandTotal!==3000)
  throw Error('QA formal sale Save fixture invalid; NOT expected-red: '+JSON.stringify(source));
 const vouchers=[...server.records.values()].filter(row=>row.collection==='journalVouchers');
 const linked=vouchers.find(row=>row.id===source.journalVoucherId);
 const lines=[...server.records.values()].filter(row=>
  row.collection==='journalLines'&&row.data.voucherId===source.journalVoucherId);
 const debit=lines.reduce((sum,row)=>sum+Number(row.data.debit||0),0);
 const credit=lines.reduce((sum,row)=>sum+Number(row.data.credit||0),0);
 const observed={
  documentStatus:source.documentStatus,
  accountingStatus:source.accountingStatus,
  hasLinkedDraft:!!linked&&linked.data.status==='draft',
  linkedSourceMatches:!!linked&&linked.data.sourceType==='sale'&&linked.data.sourceId===source.id,
  draftHasNoFinalNumber:!!linked&&!linked.data.number,
  draftHasBalancedLines:lines.length>=2&&debit===credit&&debit===source.grandTotal,
  postedVouchers:vouchers.filter(row=>row.data.status==='posted').length,
  automaticPostCalls:server.autoPostCount||0
 };
 // CURRENT: source-only sale draft, no linked journal, no autopost.
 // REQUIRED ADR216: atomic source + linked journal draft, balanced lines, no final number.
 assertKnownRedOrFixed(observed,{
  documentStatus:'draft',accountingStatus:'draft',
  hasLinkedDraft:false,linkedSourceMatches:false,
  draftHasNoFinalNumber:false,draftHasBalancedLines:false,
  postedVouchers:0,automaticPostCalls:0
 },{
  documentStatus:'draft',accountingStatus:'draft',
  hasLinkedDraft:true,linkedSourceMatches:true,
  draftHasNoFinalNumber:true,draftHasBalancedLines:true,
  postedVouchers:0,automaticPostCalls:0
 },'sale-initial-save');
 test.fail(true,'#229 / ADR216: formal sale Save still lacks server-persisted linked journal draft');
 expect(observed).toEqual({
  documentStatus:'draft',accountingStatus:'draft',
  hasLinkedDraft:true,linkedSourceMatches:true,
  draftHasNoFinalNumber:true,draftHasBalancedLines:true,
  postedVouchers:0,automaticPostCalls:0
 });
});


test('P0 #229 expected RED: posted purchase correction Save must remain linked accounting draft',async({page})=>{
 const server=fakeServer();
 await installHarness(page,server);
 await authenticatedMockBrowser(page);
 const id=await createPostedPurchase(page,server,'QA-ADR216-CORRECTION-SAVE',2);
 const original=remotePurchases(server).find(p=>p.id===id);
 const originalVoucher=[...server.records.values()].find(r=>r.collection==='journalVouchers'&&r.id===original.journalVoucherId);
 if(original?.accountingStatus!=='posted'||originalVoucher?.data.status!=='posted')
  throw Error('Original posted purchase fixture invalid; NOT the expected correction Save RED');
 const originalSourceFingerprint=copy(original);
 const originalVoucherFingerprint=copy(originalVoucher);
 const originalLines=[...server.records.values()].filter(r=>r.collection==='journalLines'&&
  r.data.voucherId===original.journalVoucherId).map(copy);
 await page.evaluate(x=>beginPurchaseAmendment(x),id);
 await expect(page.locator('#pur-edit-id')).toHaveValue(id);
 await page.locator('#pur-items-body .pur-qty').first().fill('3');
 await page.locator('#pur-items-body .pur-qty').first().dispatchEvent('input');
 await page.locator('#pur-save-btn').click();
 // Await the actual completed Save path, not its intermediate locally inserted draft.
 await expect(page.locator('#pur-edit-id')).toHaveValue('',{timeout:22000});
 await expect.poll(()=>remotePurchases(server).filter(p=>p.correctsPurchaseId===id).length,
   {timeout:15000}).toBe(1);
 await page.waitForFunction(()=>!syncPending&&!syncRunning);
 const corrected=remotePurchases(server).find(p=>p.correctsPurchaseId===id);
 if(corrected?.grandTotal!==300||corrected?.companyId!=='QA_CO'||
    corrected?.correctionOriginalNumber!==original.number)
  throw Error('Correction Save fixture invalid; NOT the expected product RED: '+JSON.stringify(corrected));
 // A correction must never rewrite or destroy the original posted source/journal.
 expect(remotePurchases(server).find(p=>p.id===id)).toEqual(originalSourceFingerprint);
 expect([...server.records.values()].find(r=>r.collection==='journalVouchers'&&
  r.id===original.journalVoucherId)).toEqual(originalVoucherFingerprint);
 expect([...server.records.values()].filter(r=>r.collection==='journalLines'&&
  r.data.voucherId===original.journalVoucherId)).toEqual(originalLines);
 const vouchers=[...server.records.values()].filter(r=>r.collection==='journalVouchers');
 const linked=vouchers.find(r=>r.id===corrected.journalVoucherId);
 const lines=[...server.records.values()].filter(r=>r.collection==='journalLines'&&
  r.data.voucherId===corrected.journalVoucherId);
 const debit=lines.reduce((sum,r)=>sum+Number(r.data.debit||0),0);
 const credit=lines.reduce((sum,r)=>sum+Number(r.data.credit||0),0);
 const observed={
  documentStatus:corrected.documentStatus,
  accountingStatus:corrected.accountingStatus,
  hasSourceLinkedJournalDraft:!!linked&&linked.data.status==='draft',
  journalPointsToCorrection:!!linked&&linked.data.sourceType==='purchase'&&
   linked.data.sourceId===corrected.id,
  balancedDraftLines:lines.length>=2&&debit===credit&&debit===300,
  correctionAlreadyPosted:vouchers.some(r=>r.data.status==='posted'&&
   r.data.sourceType==='purchase'&&r.data.sourceId===corrected.id),
  originalReversalCount:server.reverseCount
 };
 // CURRENT: purchaseSaveSeamless directly calls finalizePurchasePilotDraft(newId)
 // on Save, bypassing independent accounting approval for the correction.
 assertKnownRedOrFixed(observed,{
  documentStatus:'posted',accountingStatus:'posted',
  hasSourceLinkedJournalDraft:false,journalPointsToCorrection:true,
  balancedDraftLines:true,correctionAlreadyPosted:true,originalReversalCount:1
 },{
  documentStatus:'draft',accountingStatus:'draft',
  hasSourceLinkedJournalDraft:true,journalPointsToCorrection:true,
  balancedDraftLines:true,correctionAlreadyPosted:false,originalReversalCount:1
 },'purchase-correction-save');
 test.fail(true,'#229 / ADR216: correcting posted purchase Save auto-finalizes the new source');
 expect(observed).toEqual({
  documentStatus:'draft',accountingStatus:'draft',
  hasSourceLinkedJournalDraft:true,journalPointsToCorrection:true,
  balancedDraftLines:true,correctionAlreadyPosted:false,originalReversalCount:1
 });
});


// Issue238 / ADR216 — real loaded-browser negative acceptance for non-sale
// financial producers. The Supabase fixture is synthetic: these tests prove
// the UI's client Save call chain, NOT real-JWT server authorization.
// A known broken state is an expected PRODUCT RED; an unknown third state is
// a genuine test failure; a fixed linked DRAFT is a regular passing test.
function issue238AssertKnownRedOrDraft(observed,broken,required,label){
 if(isDeepStrictEqual(observed,required))return;
 if(!isDeepStrictEqual(observed,broken))
  throw Error('FINORA_ISSUE238_UNEXPECTED_PRODUCT_STATE '+label+' '+JSON.stringify({observed,broken,required}));
 console.log('FINORA_ISSUE238_SAVE_EXPECTED_RED '+label+': Save already finalizes a source-linked journal');
 test.fail(true,'#238 / ADR216: '+label+' Save auto-posts instead of saving a linked accounting draft');
 expect(observed).toEqual(required);
}
function issue238JournalSnapshot(server,collection,kind){
 const sourceRows=[...server.records.values()].filter(r=>r.collection===collection&&r.data?.kind===kind||
  r.collection===collection&&r.data?.direction===kind);
 if(sourceRows.length!==1)throw Error('FINORA_ISSUE238_INVALID_FIXTURE '+collection+'/'+kind+' sourceRows='+sourceRows.length);
 const source=sourceRows[0],vouchers=[...server.records.values()].filter(r=>r.collection==='journalVouchers');
 const linked=vouchers.find(v=>v.id===source.data.journalVoucherId);
 const lines=[...server.records.values()].filter(r=>r.collection==='journalLines'&&r.data.voucherId===source.data.journalVoucherId);
 const debit=lines.reduce((sum,r)=>sum+Number(r.data.debit||0),0);
 const credit=lines.reduce((sum,r)=>sum+Number(r.data.credit||0),0);
 return {
  sourceStatus:source.data.accountingStatus||'',
  linkedDraft:!!linked&&linked.data.status==='draft',
  linkedPosted:!!linked&&linked.data.status==='posted',
  linkedToSource:!!linked&&linked.data.sourceId===source.id&&
   linked.data.sourceType===(collection==='payments'?(kind==='inbound'?'receipt':'payment'):kind),
  balanced:lines.length>=2&&debit===credit&&debit===Number(source.data.amount),
  postedCount:vouchers.filter(v=>v.data.status==='posted').length,
  voucherCount:vouchers.length
 };
}
const issue238KnownPosted={
 sourceStatus:'posted',linkedDraft:false,linkedPosted:true,linkedToSource:true,
 balanced:true,postedCount:1,voucherCount:1
};
const issue238RequiredDraft={
 sourceStatus:'draft',linkedDraft:true,linkedPosted:false,linkedToSource:true,
 balanced:true,postedCount:0,voucherCount:1
};

for(const direction of ['inbound','outbound'])test('P0 #238 expected RED: '+direction+' payment Save must leave balanced linked journal DRAFT',async({page})=>{
 const server=fakeServer();
 await installHarness(page,server);
 await authenticatedMockBrowser(page);
 await page.evaluate(dir=>{
  switchView('view-payments');renderPayments();
  for(const [id,value] of [['pay-direction',dir],['pay-contact','QA_CONTACT'],
   ['pay-method','bank'],['pay-amount','1200'],['pay-reference','ISSUE238-'+dir]]){
    const el=document.getElementById(id);
    if(!el)throw Error('FINORA_ISSUE238_PAYMENT_FORM_MISSING '+id);
    el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  commitSavePayment();
 },direction);
 await expect.poll(()=>[...server.records.values()].filter(r=>r.collection==='payments').length,
  {timeout:14000}).toBe(1);
 await page.waitForFunction(()=>!syncPending&&!syncRunning);
 const rows=[...server.records.values()].filter(r=>r.collection==='payments');
 if(rows[0]?.data.amount!==1200||rows[0]?.data.companyId!=='QA_CO'||rows[0]?.data.direction!==direction)
  throw Error('FINORA_ISSUE238_PAYMENT_FIXTURE_INVALID '+JSON.stringify(rows[0]?.data));
 const observed=issue238JournalSnapshot(server,'payments',direction);
 issue238AssertKnownRedOrDraft(observed,issue238KnownPosted,issue238RequiredDraft,'payment-'+direction);
});

for(const kind of ['expense','income'])test('P0 #238 expected RED: '+kind+' Save must leave balanced linked journal DRAFT',async({page})=>{
 const server=fakeServer();
 // The original sale/purchase fixture does not seed expense/income posting roles.
 for(const [id,code,title,role] of [
  ['A_EXP','6103','هزینه عمومی','expense_default'],
  ['A_OTHER','4201','سایر درآمد','other_income_default']
 ])server.records.set('accounts|'+id,{
  collection:'accounts',id,data:{code,title,systemRole:role,active:true,postingAllowed:true},version:1
 });
 await installHarness(page,server);
 await authenticatedMockBrowser(page);
 await page.evaluate(k=>{
  switchView('view-expenses');
  if(typeof window.commitSaveExpense!=='function')
   throw Error('FINORA_ISSUE238_EXPENSE_OVERRIDE_MISSING');
  for(const [id,value] of [['trx-kind-input',k],['trx-amount-input','1200'],
   ['trx-desc-input','ISSUE238 '+k]]){
    const el=document.getElementById(id);
    if(!el)throw Error('FINORA_ISSUE238_EXPENSE_FORM_MISSING '+id);
    el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  window.commitSaveExpense();
 },kind);
 await expect.poll(()=>[...server.records.values()].filter(r=>r.collection==='expenses').length,
  {timeout:14000}).toBe(1);
 await page.waitForFunction(()=>!syncPending&&!syncRunning);
 const rows=[...server.records.values()].filter(r=>r.collection==='expenses');
 if(rows[0]?.data.amount!==1200||rows[0]?.data.companyId!=='QA_CO'||rows[0]?.data.kind!==kind)
  throw Error('FINORA_ISSUE238_EXPENSE_FIXTURE_INVALID '+JSON.stringify(rows[0]?.data));
 const observed=issue238JournalSnapshot(server,'expenses',kind);
 issue238AssertKnownRedOrDraft(observed,issue238KnownPosted,issue238RequiredDraft,'expense-'+kind);
});

// #238 / ADR216: count-Save must not finalize valuation or operational stock.
// The browser uses the real loaded phase5 module and a synthetic sync server.
// Real database/JWT approval, inventory locking and duplicate-count safety need
// separate Codex-main E2E. Keep this expected RED strict and source-grounded.
test('P0 #238 expected RED: inventory count Save must persist pending stock and a balanced DRAFT valuation journal',async({page})=>{
 const server=fakeServer();
 // Genuine positive weighted-average valuation requires existing priced stock:
 // without an opening movement, weightedAverage(0, buy_price, []) returns 0.
 server.records.get('products|QA_PROD').data.buy_price=25;
 for(const [collection,id,data] of [
  ['warehouses','QA_WH',{companyId:'QA_CO',code:'MAIN',name:'انبار آزمون',active:true}],
  ['stockMovements','QA_OPEN',{companyId:'QA_CO',kind:'opening',productId:'QA_PROD',
   warehouseId:'QA_WH',qty:2,unitCost:25,date:'1405/07/19',status:'posted'}],
  ['accounts','QA_INVENTORY',{companyId:'QA_CO',code:'1103',title:'موجودی کالا',active:true,postingAllowed:true}],
  ['accounts','QA_INVENTORY_GAIN',{companyId:'QA_CO',code:'4201',title:'تعدیل افزایشی موجودی',active:true,postingAllowed:true}]
 ])server.records.set(collection+'|'+id,{collection,id,data:copy(data),version:1});
 await installHarness(page,server);
 await authenticatedMockBrowser(page);
 const before=await page.evaluate(()=>{
  if(typeof p5SaveCount!=='function'||typeof p5RenderInventory!=='function')
   throw Error('FINORA_ISSUE238_INVENTORY_RUNTIME_MISSING');
  switchView('view-inventory');
  p5RenderInventory();
  return {stock:p5Stock('QA_PROD','QA_WH'),averageCost:p5AverageCost('QA_PROD')};
 });
 expect(before).toEqual({stock:2,averageCost:25});
 await expect(page.locator('#p5-count-product option[value="QA_PROD"]')).toHaveCount(1);
 await expect(page.locator('#p5-count-wh option[value="QA_WH"]')).toHaveCount(1);
 await page.locator('#p5-count-product').selectOption('QA_PROD');
 await page.locator('#p5-count-wh').selectOption('QA_WH');
 await page.locator('#p5-count-qty').fill('5');
 await page.locator('#p5-inventory-root button[onclick="p5SaveCount()"]').click();
 await expect.poll(()=>[...server.records.values()].filter(r=>r.collection==='inventoryCounts').length,
  {timeout:15000}).toBe(1);
 await page.waitForFunction(()=>!syncPending&&!syncRunning);
 const counts=[...server.records.values()].filter(r=>r.collection==='inventoryCounts');
 const count=counts[0];
 const adjustments=[...server.records.values()].filter(r=>r.collection==='stockMovements'&&
  r.data.sourceType==='inventory_count'&&r.data.sourceId===count?.id);
 const move=adjustments[0];
 const vouchers=[...server.records.values()].filter(r=>r.collection==='journalVouchers');
 const linked=vouchers.find(r=>r.id===move?.data.journalVoucherId);
 const lines=[...server.records.values()].filter(r=>r.collection==='journalLines'&&
  r.data.voucherId===linked?.id);
 const debit=lines.reduce((n,r)=>n+Number(r.data.debit||0),0);
 const credit=lines.reduce((n,r)=>n+Number(r.data.credit||0),0);
 if(count?.data.companyId!=='QA_CO'||count.data.productId!=='QA_PROD'||
    count.data.warehouseId!=='QA_WH'||count.data.systemQty!==2||
    count.data.physicalQty!==5||count.data.difference!==3||
    move?.data.qty!==3||move.data.unitCost!==25||move.data.kind!=='adjustment_in')
  throw Error('FINORA_ISSUE238_INVENTORY_COUNT_FIXTURE_INVALID '+JSON.stringify({count:count?.data,move:move?.data}));
 const observed={
  countStatus:count.data.status||'missing',
  adjustmentStatus:move.data.status||'missing',
  valuationStatus:linked?.data.status||'missing',
  movementAccountingStatus:move.data.accountingStatus||'',
  countLinkedToJournal:!!linked&&count.data.journalVoucherId===linked.id,
  movementLinkedToJournal:!!linked&&move.data.journalVoucherId===linked.id,
  journalSourceMatches:!!linked&&linked.data.sourceType==='inventory_adjustment'&&
   linked.data.sourceId===move.id&&linked.data.companyId==='QA_CO',
  balancedValuation:lines.length===2&&debit===75&&credit===75,
  countCount:counts.length,adjustmentCount:adjustments.length,voucherCount:vouchers.length,
  postedJournalCount:vouchers.filter(v=>v.data.status==='posted').length,
  countPostedAt:!!count.data.postedAt,adjustmentPostedAt:!!move.data.postedAt,
  valuationPostedAt:!!linked?.data.postedAt,
  effectiveStock:await page.evaluate(()=>p5Stock('QA_PROD','QA_WH')),
  effectiveValuationLines:await page.evaluate(()=>
   jeLedgerRows().filter(x=>x.voucher?.sourceType==='inventory_adjustment').length)
 };
 const broken={
  countStatus:'posted',adjustmentStatus:'posted',valuationStatus:'posted',
  movementAccountingStatus:'posted',
  countLinkedToJournal:true,movementLinkedToJournal:true,journalSourceMatches:true,balancedValuation:true,
  countCount:1,adjustmentCount:1,voucherCount:1,postedJournalCount:1,
  countPostedAt:true,adjustmentPostedAt:true,valuationPostedAt:true,
  effectiveStock:5,effectiveValuationLines:2
 };
 const required={
  countStatus:'draft',adjustmentStatus:'draft',valuationStatus:'draft',
  movementAccountingStatus:'draft',
  countLinkedToJournal:true,movementLinkedToJournal:true,journalSourceMatches:true,balancedValuation:true,
  countCount:1,adjustmentCount:1,voucherCount:1,postedJournalCount:0,
  countPostedAt:false,adjustmentPostedAt:false,valuationPostedAt:false,
  effectiveStock:2,effectiveValuationLines:0
 };
 if(isDeepStrictEqual(observed,required))return;
 if(!isDeepStrictEqual(observed,broken))
  throw Error('FINORA_ISSUE238_INVENTORY_COUNT_THIRD_STATE '+JSON.stringify({observed,broken,required}));
 console.log('FINORA_ISSUE238_INVENTORY_COUNT_EXPECTED_RED: count Save immediately posts stock movement and balanced valuation journal');
 test.fail(true,'#238 / ADR216: inventory count Save must not finalize stock or journal without independent accounting approval');
 expect(observed).toEqual(required);
});

 
// #238: a linked DRAFT purchase with NO committed physical receiving document
// must not change effective Phase5 stock/weighted-average valuation. Compare the
// same authenticated loaded browser's Kardex and accounting read models. This is
// synthetic Supabase-backed UI evidence, NOT a real JWT warehouse transaction.
test('P0 #238 expected RED: draft purchase must not inflate Phase5 stock or weighted-average cost',async({page})=>{
 const server=fakeServer();
 server.records.get('products|QA_PROD').data.stock=0;
 server.records.get('products|QA_PROD').data.buy_price=25;
 const fixture=[
  ['warehouses','QA_WH',{companyId:'QA_CO',code:'MAIN',name:'انبار آزمایشی',active:true}],
  ['purchases','QA_PUR_POSTED',{companyId:'QA_CO',warehouseId:'QA_WH',date:'1405/07/21',
   number:'P-POSTED',documentStatus:'posted',accountingStatus:'posted',
   journalVoucherId:'QA_JV_POSTED',items:[{prodId:'QA_PROD',qty:2,price:50}],grandTotal:100}],
  ['purchases','QA_PUR_DRAFT',{companyId:'QA_CO',warehouseId:'QA_WH',date:'1405/07/22',
   number:'P-DRAFT',documentStatus:'draft',accountingStatus:'draft',
   journalVoucherId:'QA_JV_DRAFT',items:[{prodId:'QA_PROD',qty:3,price:100}],grandTotal:300}],
  ['journalVouchers','QA_JV_POSTED',{companyId:'QA_CO',fiscalYearId:'FY_QA',sourceType:'purchase',
   sourceId:'QA_PUR_POSTED',status:'posted',date:'1405/07/21',voucherType:'purchase',number:'1',
   postedAt:'2026-10-13T08:00:00.000Z'}],
  ['journalVouchers','QA_JV_DRAFT',{companyId:'QA_CO',fiscalYearId:'FY_QA',sourceType:'purchase',
   sourceId:'QA_PUR_DRAFT',status:'draft',date:'1405/07/22',voucherType:'purchase'}],
  ['journalLines','QA_POSTED_DR',{companyId:'QA_CO',fiscalYearId:'FY_QA',voucherId:'QA_JV_POSTED',
   accountId:'A_BUY',debit:100,credit:0}],
  ['journalLines','QA_POSTED_CR',{companyId:'QA_CO',fiscalYearId:'FY_QA',voucherId:'QA_JV_POSTED',
   accountId:'A_AP',debit:0,credit:100}],
  ['journalLines','QA_DRAFT_DR',{companyId:'QA_CO',fiscalYearId:'FY_QA',voucherId:'QA_JV_DRAFT',
   accountId:'A_BUY',debit:300,credit:0}],
  ['journalLines','QA_DRAFT_CR',{companyId:'QA_CO',fiscalYearId:'FY_QA',voucherId:'QA_JV_DRAFT',
   accountId:'A_AP',debit:0,credit:300}]
 ];
 for(const [collection,id,data] of fixture)
  server.records.set(collection+'|'+id,{collection,id,data:copy(data),version:1});
 // Validate the fixture financial graph before classifying the read-model RED.
 for(const [purchaseId,voucherId,amount,status] of [
  ['QA_PUR_POSTED','QA_JV_POSTED',100,'posted'],
  ['QA_PUR_DRAFT','QA_JV_DRAFT',300,'draft']
 ]){
  const p=server.records.get('purchases|'+purchaseId)?.data;
  const v=server.records.get('journalVouchers|'+voucherId)?.data;
  const lines=[...server.records.values()].filter(r=>r.collection==='journalLines'&&r.data.voucherId===voucherId);
  if(!p||!v||p.companyId!=='QA_CO'||p.warehouseId!=='QA_WH'||
   p.journalVoucherId!==voucherId||p.documentStatus!==status||
   v.sourceType!=='purchase'||v.sourceId!==purchaseId||v.status!==status||
   lines.length!==2||lines.reduce((s,r)=>s+Number(r.data.debit||0),0)!==amount||
   lines.reduce((s,r)=>s+Number(r.data.credit||0),0)!==amount)
   throw Error('FINORA_ISSUE238_DRAFT_PURCHASE_INVALID_GRAPH '+purchaseId);
 }
 if([...server.records.values()].some(r=>r.collection==='stockMovements'))
  throw Error('FINORA_ISSUE238_DRAFT_PURCHASE_UNEXPECTED_RECEIPT');
 await installHarness(page,server);
 await authenticatedMockBrowser(page);
 const observed=await page.evaluate(()=>{
  if(typeof p5Stock!=='function'||typeof p5AverageCost!=='function'||
   typeof productMovement!=='function'||typeof productKardexRows!=='function'||
   typeof purchaseDocumentStatus!=='function')
   throw Error('FINORA_ISSUE238_DRAFT_PURCHASE_MODULE_MISSING');
  switchView('view-inventory');
  p5RenderInventory();
  const purchases=getMyPurchases();
  const statuses=purchases.map(p=>[p.id,purchaseDocumentStatus(p)]).sort((a,b)=>a[0].localeCompare(b[0]));
  const rows=[...document.querySelectorAll('#p5-inventory-root table tbody tr')];
  const row=rows.find(r=>r.cells[0]?.textContent.includes('بلوک سیمانی')&&
   r.cells[1]?.textContent.includes('انبار آزمایشی'));
  if(!row)throw Error('FINORA_ISSUE238_DRAFT_PURCHASE_INVENTORY_ROW_MISSING');
  const parseCell=cell=>{
   const value=toEnDigits(cell.textContent).replace(/[٬,\s]/g,'');
   const number=Number(value);if(!Number.isFinite(number))
    throw Error('FINORA_ISSUE238_DRAFT_PURCHASE_BAD_UI_NUMBER '+value);
   return number;
  };
  const kardex=productKardexRows('QA_PROD').filter(x=>x.kind==='خرید');
  const balance=productMovement('QA_PROD');
  return {
   purchaseStatuses:statuses,
   postedPurchasedQty:balance.purchased,
   kardexPurchaseCount:kardex.length,
   kardexPurchaseQty:kardex.reduce((sum,x)=>sum+x.qty,0),
   inventoryEventSourceIds:p5OperationalEvents('QA_PROD','QA_WH')
    .filter(x=>x.source==='purchase').map(x=>x.sourceId).sort(),
   phase5EffectiveQty:p5Stock('QA_PROD','QA_WH'),
   phase5AverageCost:p5AverageCost('QA_PROD'),
   renderedQty:parseCell(row.cells[2]),
   renderedAverageCost:parseCell(row.cells[3])
  };
 });
 const shared={
  purchaseStatuses:[['QA_PUR_DRAFT','draft'],['QA_PUR_POSTED','posted']],
  postedPurchasedQty:2,kardexPurchaseCount:1,kardexPurchaseQty:2
 };
 const broken={...shared,
  inventoryEventSourceIds:['QA_PUR_DRAFT','QA_PUR_POSTED'],
  phase5EffectiveQty:5,phase5AverageCost:80,renderedQty:5,renderedAverageCost:80
 };
 const required={...shared,
  inventoryEventSourceIds:['QA_PUR_POSTED'],
  phase5EffectiveQty:2,phase5AverageCost:50,renderedQty:2,renderedAverageCost:50
 };
 if(isDeepStrictEqual(observed,required))return;
 if(!isDeepStrictEqual(observed,broken))
  throw Error('FINORA_ISSUE238_DRAFT_PURCHASE_THIRD_STATE '+JSON.stringify({observed,broken,required}));
 console.log('FINORA_ISSUE238_DRAFT_PURCHASE_STOCK_EXPECTED_RED: linked DRAFT purchase inflates Phase5 stock and cost, while posted-only Kardex excludes it');
 test.fail(true,'#238: DRAFT purchase without committed physical receipt must not alter Phase5 stock/valuation');
 expect(observed).toEqual(required);
});

// ADR216 / Issue238 cross-warehouse, cross-company stock projection sentinels.
// These are loaded-browser read-model tests, not live database RLS or inventory
// receiving/approval proofs. Costing *between* warehouses requires owner policy;
// cross-company purchase contamination is always forbidden.
function issue238SeedPostedPurchase(server,{id,companyId,warehouseId,qty,price}){
 const voucherId='QA_JV_'+id,amount=qty*price;
 const purchase={companyId,date:'1405/07/22',number:'PO-'+id,
  documentStatus:'posted',accountingStatus:'posted',journalVoucherId:voucherId,
  items:[{prodId:'QA_PROD',qty,price}],grandTotal:amount,
  ...(warehouseId?{warehouseId}:{})};
 const voucher={companyId,fiscalYearId:'FY_QA',sourceType:'purchase',
  sourceId:id,status:'posted',date:'1405/07/22',voucherType:'purchase',
  number:'PO-'+id,postedAt:'2026-10-13T08:00:00.000Z'};
 for(const [collection,key,data] of [
  ['purchases',id,purchase],['journalVouchers',voucherId,voucher],
  ['journalLines',voucherId+'_DR',{companyId,fiscalYearId:'FY_QA',voucherId,accountId:'A_BUY',debit:amount,credit:0}],
  ['journalLines',voucherId+'_CR',{companyId,fiscalYearId:'FY_QA',voucherId,accountId:'A_AP',debit:0,credit:amount}]
 ])server.records.set(collection+'|'+key,{collection,id:key,data:copy(data),version:1});
 const original=server.records.get('purchases|'+id)?.data;
 const posted=server.records.get('journalVouchers|'+voucherId)?.data;
 const lines=[...server.records.values()].filter(r=>r.collection==='journalLines'&&r.data.voucherId===voucherId);
 const debit=lines.reduce((s,r)=>s+Number(r.data.debit||0),0);
 const credit=lines.reduce((s,r)=>s+Number(r.data.credit||0),0);
 if(!original||!posted||posted.sourceId!==id||posted.companyId!==companyId||
  original.companyId!==companyId||original.journalVoucherId!==voucherId||
  posted.status!=='posted'||lines.length!==2||debit!==amount||credit!==amount)
  throw Error('FINORA_ISSUE238_WAREHOUSE_FIXTURE_GRAPH_INVALID '+id);
}
function issue238AssertProjection(observed,knownBroken,required,marker){
 if(isDeepStrictEqual(observed,required))return;
 if(!isDeepStrictEqual(observed,knownBroken))
  throw Error('FINORA_ISSUE238_WAREHOUSE_THIRD_STATE '+marker+' '+JSON.stringify({observed,knownBroken,required}));
 console.log(marker+': posted purchase inventory is projected to the wrong company or warehouse');
 test.fail(true,'#238 / inventory posting must respect company and warehouse scope');
 expect(observed).toEqual(required);
}

test('P0 #238 expected RED: posted purchase at a non-default warehouse must appear in that warehouse',async({page})=>{
 const server=fakeServer();
 server.records.get('products|QA_PROD').data.stock=0;
 server.records.get('products|QA_PROD').data.buy_price=25;
 for(const [id,name] of [['QA_WH','انبار اول آزمایشی'],['QA_WH2','انبار دوم آزمایشی']])
  server.records.set('warehouses|'+id,{collection:'warehouses',id,
   data:{companyId:'QA_CO',code:id,name,active:true},version:1});
 issue238SeedPostedPurchase(server,{id:'QA_PUR_W1',companyId:'QA_CO',warehouseId:'QA_WH',qty:2,price:50});
 issue238SeedPostedPurchase(server,{id:'QA_PUR_W2',companyId:'QA_CO',warehouseId:'QA_WH2',qty:3,price:100});
 await installHarness(page,server);await authenticatedMockBrowser(page);
 const observed=await page.evaluate(()=>{
  if(typeof p5Stock!=='function'||typeof p5OperationalEvents!=='function'||
   typeof productKardexRows!=='function'||typeof productMovement!=='function')
   throw Error('FINORA_ISSUE238_WAREHOUSE_MODULE_MISSING');
  switchView('view-inventory');p5RenderInventory();
  const purchaseStatuses=getMyPurchases().map(p=>[p.id,purchaseDocumentStatus(p)])
   .sort((a,b)=>a[0].localeCompare(b[0]));
  const rows=[...document.querySelectorAll('#p5-inventory-root table tbody tr')];
  const readWh=id=>{
   const name=getMyWarehouses().find(w=>w.id===id)?.name;
   const row=rows.find(r=>r.cells[0]?.textContent.includes('بلوک سیمانی')&&
    r.cells[1]?.textContent.includes(name));
   if(!row)throw Error('FINORA_ISSUE238_WAREHOUSE_UI_ROW_MISSING '+id);
   const text=toEnDigits(row.cells[2].textContent).replace(/[٬,\s]/g,'');
   if(!Number.isFinite(Number(text)))throw Error('FINORA_ISSUE238_WAREHOUSE_BAD_UI_QTY '+text);
   return Number(text);
  };
  return {
   activeCompany:afCompanyId(),defaultWarehouse:p5DefaultWarehouse()?.id,
   purchaseStatuses,
   companyPostedPurchased:productMovement('QA_PROD').purchased,
   kardexPostedPurchased:productKardexRows('QA_PROD')
    .filter(x=>x.kind==='خرید').reduce((s,x)=>s+x.qty,0),
   warehouseOneEventIds:p5OperationalEvents('QA_PROD','QA_WH')
    .filter(e=>e.source==='purchase').map(e=>e.sourceId).sort(),
   warehouseTwoEventIds:p5OperationalEvents('QA_PROD','QA_WH2')
    .filter(e=>e.source==='purchase').map(e=>e.sourceId).sort(),
   warehouseOneStock:p5Stock('QA_PROD','QA_WH'),
   warehouseTwoStock:p5Stock('QA_PROD','QA_WH2'),
   renderedWarehouseOneStock:readWh('QA_WH'),
   renderedWarehouseTwoStock:readWh('QA_WH2')
  };
 });
 const shared={activeCompany:'QA_CO',defaultWarehouse:'QA_WH',
  purchaseStatuses:[['QA_PUR_W1','posted'],['QA_PUR_W2','posted']],
  companyPostedPurchased:5,kardexPostedPurchased:5,
  warehouseOneEventIds:['QA_PUR_W1'],
  warehouseOneStock:2,renderedWarehouseOneStock:2
 };
 const broken={...shared,
  warehouseTwoEventIds:[],warehouseTwoStock:0,renderedWarehouseTwoStock:0};
 const required={...shared,
  warehouseTwoEventIds:['QA_PUR_W2'],warehouseTwoStock:3,renderedWarehouseTwoStock:3};
 issue238AssertProjection(observed,broken,required,'FINORA_ISSUE238_OTHER_WAREHOUSE_EXPECTED_RED');
});

test('P0 #238 expected RED: a different-company posted purchase without warehouse cannot contaminate active-company stock and cost',async({page})=>{
 const server=fakeServer();
 server.records.get('products|QA_PROD').data.stock=0;
 server.records.get('products|QA_PROD').data.buy_price=25;
 server.records.set('companies|QA_CO_B',{collection:'companies',id:'QA_CO_B',
  data:{name:'شرکت آزمایشی دیگر',entityType:'legal'},version:1});
 server.records.set('warehouses|QA_WH',{collection:'warehouses',id:'QA_WH',
  data:{companyId:'QA_CO',code:'MAIN',name:'انبار شرکت فعال',active:true},version:1});
 issue238SeedPostedPurchase(server,{id:'QA_PUR_OWN',companyId:'QA_CO',warehouseId:'QA_WH',qty:2,price:50});
 // Legacy purchase has no warehouseId; previous code substitutes ACTIVE default warehouse,
 // even when the purchase's companyId is different. Same owner, different company.
 issue238SeedPostedPurchase(server,{id:'QA_PUR_FOREIGN',companyId:'QA_CO_B',qty:4,price:200});
 if('warehouseId' in server.records.get('purchases|QA_PUR_FOREIGN').data)
  throw Error('FINORA_ISSUE238_CROSS_COMPANY_LEGACY_WAREHOUSE_SETUP_INVALID');
 await installHarness(page,server);await authenticatedMockBrowser(page);
 const observed=await page.evaluate(()=>{
  if(typeof p5Stock!=='function'||typeof p5AverageCost!=='function'||
   typeof productMovement!=='function'||typeof productKardexRows!=='function')
   throw Error('FINORA_ISSUE238_CROSS_COMPANY_MODULE_MISSING');
  switchView('view-inventory');p5RenderInventory();
  const status=getMyPurchases().map(p=>[p.id,p.companyId,purchaseDocumentStatus(p)])
   .sort((a,b)=>a[0].localeCompare(b[0]));
  const row=[...document.querySelectorAll('#p5-inventory-root table tbody tr')]
   .find(r=>r.cells[0]?.textContent.includes('بلوک سیمانی')&&
    r.cells[1]?.textContent.includes('انبار شرکت فعال'));
  if(!row)throw Error('FINORA_ISSUE238_CROSS_COMPANY_UI_ROW_MISSING');
  const parseCell=index=>{
   const input=toEnDigits(row.cells[index].textContent).replace(/[٬,\s]/g,'');
   const val=Number(input);
   if(!Number.isFinite(val))throw Error('FINORA_ISSUE238_CROSS_COMPANY_UI_NUM_INVALID '+index+' '+input);
   return val;
  };
  return {
   activeCompany:afCompanyId(),defaultWarehouse:p5DefaultWarehouse()?.id,
   sourceStatuses:status,
   postedPurchasedQty:productMovement('QA_PROD').purchased,
   kardexPurchaseQty:productKardexRows('QA_PROD')
    .filter(x=>x.kind==='خرید').reduce((s,x)=>s+x.qty,0),
   phase5EventIds:p5OperationalEvents('QA_PROD','QA_WH')
    .filter(e=>e.source==='purchase').map(e=>e.sourceId).sort(),
   phase5Stock:p5Stock('QA_PROD','QA_WH'),
   phase5AverageCost:p5AverageCost('QA_PROD'),
   renderedStock:parseCell(2),renderedAverageCost:parseCell(3)
  };
 });
 const shared={activeCompany:'QA_CO',defaultWarehouse:'QA_WH',
  sourceStatuses:[['QA_PUR_FOREIGN','QA_CO_B','legacy_review'],['QA_PUR_OWN','QA_CO','posted']],
  postedPurchasedQty:2,kardexPurchaseQty:2};
 const broken={...shared,
  phase5EventIds:['QA_PUR_FOREIGN','QA_PUR_OWN'],
  phase5Stock:6,phase5AverageCost:150,renderedStock:6,renderedAverageCost:150};
 const required={...shared,
  phase5EventIds:['QA_PUR_OWN'],
  phase5Stock:2,phase5AverageCost:50,renderedStock:2,renderedAverageCost:50};
 issue238AssertProjection(observed,broken,required,'FINORA_ISSUE238_CROSS_COMPANY_STOCK_EXPECTED_RED');
});


// Issue223: loaded-browser regression for manual stock movement company/status/sign.
// These cases reuse the existing authenticated synthetic Supabase fixture. They
// DO NOT establish PostgreSQL RLS or real inventory posting authorization.
// The current Kardex is company-aggregate, not a warehouse-specific stock card;
// therefore an internal transfer must contribute zero to its net movement.
// No presentation contract is imposed on whether a transfer displays 0 or two
// offsetting rows. Product stock recognition policy belongs to Codex-main.
const issue223Cases=[
 {key:'CROSS_COMPANY',name:'posted manual movement from another company must be excluded',
  movements:[['QA_223_FOREIGN','QA_CO_B','adjustment_in','posted','QA_WH_B',null,5]],
  broken:{stockW1:0,stockW2:0,scopedIds:[],kardexNet:5,foreignNet:5,draftNet:0,outNet:0,transferNet:0},
  required:{stockW1:0,stockW2:0,scopedIds:[],kardexNet:0,foreignNet:0,draftNet:0,outNet:0,transferNet:0}},
 {key:'DRAFT',name:'draft manual adjustment must not enter committed Kardex',
  movements:[['QA_223_DRAFT','QA_CO','adjustment_in','draft','QA_WH',null,3]],
  broken:{stockW1:0,stockW2:0,scopedIds:['QA_223_DRAFT'],kardexNet:3,foreignNet:0,draftNet:3,outNet:0,transferNet:0},
  required:{stockW1:0,stockW2:0,scopedIds:['QA_223_DRAFT'],kardexNet:0,foreignNet:0,draftNet:0,outNet:0,transferNet:0}},
 {key:'OUTBOUND_SIGN',name:'posted adjustment_out must subtract from aggregate Kardex',
  movements:[['QA_223_OPEN','QA_CO','opening','posted','QA_WH',null,5],
   ['QA_223_OUT','QA_CO','adjustment_out','posted','QA_WH',null,2]],
  broken:{stockW1:3,stockW2:0,scopedIds:['QA_223_OPEN','QA_223_OUT'],kardexNet:7,foreignNet:0,draftNet:0,outNet:2,transferNet:0},
  required:{stockW1:3,stockW2:0,scopedIds:['QA_223_OPEN','QA_223_OUT'],kardexNet:3,foreignNet:0,draftNet:0,outNet:-2,transferNet:0}},
 {key:'TRANSFER_NET',name:'posted internal transfer must net zero in company Kardex',
  movements:[['QA_223_OPEN','QA_CO','opening','posted','QA_WH',null,8],
   ['QA_223_TRANSFER','QA_CO','transfer','posted','QA_WH','QA_WH2',3]],
  broken:{stockW1:5,stockW2:3,scopedIds:['QA_223_OPEN','QA_223_TRANSFER'],kardexNet:11,foreignNet:0,draftNet:0,outNet:0,transferNet:3},
  required:{stockW1:5,stockW2:3,scopedIds:['QA_223_OPEN','QA_223_TRANSFER'],kardexNet:8,foreignNet:0,draftNet:0,outNet:0,transferNet:0}}
];
for(const spec of issue223Cases){
 test('P0 #223 expected RED: '+spec.name,async({page})=>{
  const server=fakeServer();
  server.records.get('products|QA_PROD').data.stock=0;
  for(const [collection,id,data] of [
   ['companies','QA_CO_B',{name:'شرکت مستقل QA B',entityType:'legal'}],
   ['warehouses','QA_WH',{companyId:'QA_CO',code:'A1',name:'انبار اول شرکت فعال',active:true}],
   ['warehouses','QA_WH2',{companyId:'QA_CO',code:'A2',name:'انبار دوم شرکت فعال',active:true}],
   ['warehouses','QA_WH_B',{companyId:'QA_CO_B',code:'B1',name:'انبار شرکت دیگر',active:true}]
  ])server.records.set(collection+'|'+id,{collection,id,data:copy(data),version:1});
  for(const [id,companyId,kind,status,warehouseId,toWarehouseId,qty] of spec.movements){
   if(!server.records.has('companies|'+companyId)||
      !server.records.has('warehouses|'+warehouseId)||
      server.records.get('warehouses|'+warehouseId).data.companyId!==companyId||
      (toWarehouseId&&server.records.get('warehouses|'+toWarehouseId)?.data.companyId!==companyId))
    throw Error('FINORA_ISSUE223_INVALID_COMPANY_WAREHOUSE_GRAPH '+id);
   if(!Number.isFinite(qty)||qty<=0||!['draft','posted'].includes(status))
    throw Error('FINORA_ISSUE223_INVALID_MOVEMENT '+id);
   const data={companyId,fiscalYearId:'FY_QA',productId:'QA_PROD',kind,status,
    warehouseId,toWarehouseId:toWarehouseId||'',qty,unitCost:50,
    date:'1405/07/21',reference:'ISSUE223 '+id,
    ...(status==='posted'?{postedAt:'2026-11-20T08:00:00.000Z'}:{})};
   server.records.set('stockMovements|'+id,{
    collection:'stockMovements',id,data:copy(data),version:1});
  }
  if([...server.records.values()].some(r=>['purchases','invoices'].includes(r.collection))||
     [...server.records.values()].filter(r=>r.collection==='stockMovements').length!==spec.movements.length)
   throw Error('FINORA_ISSUE223_FIXTURE_ISOLATION_INVALID');
  await installHarness(page,server);
  await authenticatedMockBrowser(page);
  const observed=await page.evaluate(()=>{
   if(typeof productKardexRows!=='function'||typeof p5Stock!=='function'||
      typeof getMyStockMovements!=='function'||typeof p5ManualEvents!=='function')
    throw Error('FINORA_ISSUE223_RUNTIME_MISSING');
   switchView('view-inventory');p5RenderInventory();
   if(afCompanyId()!=='QA_CO'||getMyCompanies().length!==2||
      getMyWarehouses().some(w=>w.companyId!=='QA_CO'))
    throw Error('FINORA_ISSUE223_COMPANY_SCOPE_INVALID');
   const movementRows=productKardexRows('QA_PROD');
   const seedRows=movementRows.filter(r=>String(r.doc).startsWith('QA_223_'));
   if(movementRows.length!==seedRows.length)
    throw Error('FINORA_ISSUE223_UNEXPECTED_KARDEX_SOURCE');
   const delta=id=>seedRows.filter(r=>r.doc===id).reduce((s,r)=>s+r.qty,0);
   return {stockW1:p5Stock('QA_PROD','QA_WH'),stockW2:p5Stock('QA_PROD','QA_WH2'),
    scopedIds:getMyStockMovements().map(m=>m.id).filter(id=>id.startsWith('QA_223_')).sort(),
    kardexNet:seedRows.reduce((s,r)=>s+r.qty,0),
    foreignNet:delta('QA_223_FOREIGN'),draftNet:delta('QA_223_DRAFT'),
    outNet:delta('QA_223_OUT'),transferNet:delta('QA_223_TRANSFER')};
  });
  if(isDeepStrictEqual(observed,spec.required))return;
  if(!isDeepStrictEqual(observed,spec.broken))
   throw Error('FINORA_ISSUE223_MANUAL_KARDEX_THIRD_STATE '+spec.key+' '+
    JSON.stringify({observed,broken:spec.broken,required:spec.required}));
  console.log('FINORA_ISSUE223_'+spec.key+'_EXPECTED_RED: known incorrect manual Kardex projection '+JSON.stringify(observed));
  test.fail(true,'#223 manual Kardex must scope company and posted status, preserve outbound sign and net internal transfers to zero');
  expect(observed).toEqual(spec.required);
 });
}
