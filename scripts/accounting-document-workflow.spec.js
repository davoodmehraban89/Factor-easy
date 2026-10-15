const {test,expect}=require('@playwright/test');

const BASE=process.env.FINORA_TEST_BASE_URL||'http://127.0.0.1:4173/index.html';
const USER='FINORA_F0_FIXTURE_ONLY';
const copy=value=>JSON.parse(JSON.stringify(value));
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
 ])records.set(collection+'|'+id,{collection,id,data:copy(data)});
 return {records,failNext:false,failCount:0,rpcCount:0};
}
function remoteInvoices(server){return [...server.records.values()].filter(r=>r.collection==='invoices').map(r=>copy(r.data));}

async function installHarness(page,server){
 await page.exposeFunction('qaF0Read',async()=>[...server.records.values()].map(copy));
 await page.exposeFunction('qaF0Write',async args=>{
   server.rpcCount++;
   if(server.failNext){server.failNext=false;server.failCount++;return {error:{message:'Network unavailable — isolated QA failure',code:'QA_NETWORK'}};}
   for(const row of args.p_upserts||[])server.records.set(row.collection+'|'+row.id,{collection:row.collection,id:row.id,data:copy(row.data)});
   for(const row of args.p_deletes||[])server.records.delete(row.collection+'|'+row.id);
   return {error:null};
 });
 await page.route(/https:\/\/[^/]*supabase\.co\//,route=>route.abort());
}
async function authenticatedMockBrowser(page){
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 // Login hydrate must wait until the organization account adapter and all ERP bundles
 // have installed their wrappers; otherwise this synthetic auth fixture races
 // production-like asynchronous module bootstrap and fails intermittently.
 await page.waitForFunction(()=>typeof enterApp==='function'&&typeof commitSaveInvoice==='function'&&
   typeof pullAll==='function'&&window.FinoraStartupStatus?.extensionsReady===true&&
   window.FinoraStartupStatus?.failedExtensionCount===0&&
   window.FinoraStartupStatus?.authChecked===true,{timeout:20000});
 await page.evaluate(async()=>{
   window.__FINORA_PRINT_TEST_MODE=true;
   window.__f0Alerts=[];
   window.alert=m=>window.__f0Alerts.push(String(m));
   window.confirm=()=>false;
   fetchCurrentUser=async()=>({id:'FINORA_F0_FIXTURE_ONLY',username:'qa-only',email:'qa@example.invalid',fullName:'QA F0',role:'admin',maxCompanies:2,subscription:{type:'lifetime',status:'active',endDate:'2099-12-31'}});
   maybeMigrateLegacyData=()=>{};
   sb.from=collection=>({
     select:()=>({
       order(){return this;},
       async range(from,to){const rows=(await window.qaF0Read()).filter(r=>r.collection).sort((a,b)=>a.collection.localeCompare(b.collection)||a.id.localeCompare(b.id));return {data:rows.slice(from,to+1),error:null};}
     })
   });
   sb.rpc=async(name,args)=>{
     if(name!=='finora_sync_records')throw Error('Unexpected RPC '+name);
     return await window.qaF0Write(args);
   };
   await enterApp({id:'FINORA_F0_FIXTURE_ONLY'});
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
 // Repeat post must be idempotent, and posted source cannot be edited or overwritten.
 await page.evaluate(x=>finalizeInvoiceDocument(x),id);
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
 expect(allVouchers.find(x=>x.id===originalVoucherId).data.status).toBe('reversed');
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
 expect(later.find(x=>x.id===originalVoucherId).data.status).toBe('reversed');
 const lines=[...server.records.values()].filter(x=>x.collection==='journalLines');
 for(const v of later){
  const subset=lines.filter(l=>l.data.voucherId===v.id);
  expect(subset.reduce((t,l)=>t+Number(l.data.debit||0),0)).toBe(subset.reduce((t,l)=>t+Number(l.data.credit||0),0));
 }
 // Reopening the same historical voucher again is blocked.
 const retry=await page.evaluate(async id=>{try{await reopenPostedInvoiceAsDraft(id,'تکرار');return 'unexpected'}catch(e){return String(e.message)}},originalId);
 expect(retry).not.toBe('unexpected');
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
 await expect.poll(()=>[...server.records.values()].filter(x=>x.collection==='journalVouchers').length,{timeout:13000}).toBe(2);
 expect(remoteInvoices(server)[0].id).toBe(invoiceId);
 expect(remoteInvoices(server)[0].grandTotal).toBe(original.grandTotal);
 const status=await page.evaluate(id=>invoiceDocumentStatus(getMyInvoices().find(x=>x.id===id)),invoiceId);
 expect(status).toBe('reversed');
 const bad=await page.evaluate(async id=>{try{await reopenPostedInvoiceAsDraft(id,'تکرار');return 'unexpected'}catch(e){return String(e.message)}},invoiceId);
 expect(bad).not.toBe('unexpected');
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
 const id=await page.evaluate(({number,qty})=>{
  const p={id:'PUR-QA-'+number,ownerUserId:'FINORA_F0_FIXTURE_ONLY',companyId:'QA_CO',number,date:'1405/07/19',supplierId:'QA_CONTACT',supplierName:'خریدار آزمایشی',paymentMethod:'cash',warehouseId:'',projectId:'',items:[{prodId:'QA_PROD',prodName:'بلوک سیمانی',qty,unit:'عدد',price:100,lineTotal:qty*100}],grandTotal:qty*100,vat:0,accountingVersion:1};
  datastore.purchases.push(p);jePostSourceRecord('purchase',p);return p.id;
 },{number,qty});
 await expect.poll(()=>remotePurchases(server).find(x=>x.id===id)?.journalVoucherId,{timeout:13000}).toBeTruthy();
 return id;
}
test('pilot purchase: posted to corrective draft to edited balanced repost via document manager',async({page})=>{
 const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
 const originalId=await createPostedPurchase(page,server);
 const first=remotePurchases(server).find(x=>x.id===originalId);
 expect(first.accountingStatus).toBe('posted');
 const voucher=first.journalVoucherId;
 const untouched=[...server.records.values()].filter(x=>x.collection==='journalLines'&&x.data.voucherId===voucher).map(copy);
 expect(await page.evaluate(()=>productMovement('QA_PROD').available)).toBe(2);
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
 await page.evaluate(id=>returnPostedPurchaseAsDraft(id,'تطبیق پیش‌نویس قدیمی'),originalId);
 await expect.poll(()=>remotePurchases(server).length,{timeout:14000}).toBe(2);
 const corrected=remotePurchases(server).find(x=>x.correctsPurchaseId===originalId);
 expect(corrected.documentStatus).toBe('draft');
 expect(corrected.journalVoucherId).toBeUndefined();
 expect(corrected.number).not.toBe(first.number);
 expect(await page.evaluate(()=>productMovement('QA_PROD').available)).toBe(0);
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
 const journal=[...server.records.values()].filter(x=>x.collection==='journalVouchers');
 expect(journal).toHaveLength(3);
 expect(journal.find(x=>x.id===voucher).data.status).toBe('reversed');
 expect(untouched).toEqual([...server.records.values()].filter(x=>x.collection==='journalLines'&&x.data.voucherId===voucher).map(copy));
 for(const v of journal){
  const lines=[...server.records.values()].filter(x=>x.collection==='journalLines'&&x.data.voucherId===v.id);
  expect(lines.reduce((s,l)=>s+Number(l.data.debit||0),0)).toBe(lines.reduce((s,l)=>s+Number(l.data.credit||0),0));
 }
 const retry=await page.evaluate(async id=>{try{await returnPostedPurchaseAsDraft(id,'تکرار');return 'unsafe'}catch(e){return String(e.message)}},originalId);
 expect(retry).not.toBe('unsafe');
 await page.reload({waitUntil:'domcontentloaded'});await authenticatedMockBrowser(page);
 expect(await page.evaluate(()=>productMovement('QA_PROD').available)).toBe(3);
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
 expect(vouchers).toHaveLength(3);expect(vouchers.find(v=>v.id===original.journalVoucherId).data.status).toBe('reversed');
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

test('treasury amendment in the same form preserves one record and same reference without on-open ledger writes',async({page})=>{
 const server=fakeServer();await installHarness(page,server);await authenticatedMockBrowser(page);
 const firstId=await createUiPayment(page,server);
 await page.waitForFunction(()=>!syncPending&&!syncRunning);
 const first=copy(remotePayments(server)[0]);
 const oldLines=[...server.records.values()].filter(x=>x.collection==='journalLines'&&x.data.voucherId===first.journalVoucherId).map(copy);
 const beforeRpc=server.rpcCount;
 await expect(page.locator('#payments-ledger tr')).toHaveCount(1);
 await page.evaluate(()=>navigateShell('accounting','view-journal','documents'));
 await expect(page.locator('#finora-treasury-document-management-body tr')).toHaveCount(1);
 await page.locator('#finora-treasury-document-management-body [data-doc-action="edit"]').click();
 await expect(page.locator('#pay-amount')).toHaveValue('1000');
 await expect(page.locator('#pay-reference')).toHaveValue('REF-ORIGINAL-001');
 await page.evaluate(()=>resetPaymentForm());
 expect(server.rpcCount).toBe(beforeRpc);
 expect([...server.records.values()].filter(x=>x.collection==='journalVouchers')).toHaveLength(1);
 expect(remotePayments(server)).toHaveLength(1);
 await page.locator('#payments-ledger button').first().click();
 await page.locator('#pay-amount').fill('1250');
 await page.locator('#pay-note').fill('اصلاح مبلغ');
 const beforeCorrectionRpc=server.rpcCount;
 await page.locator('#pay-save').click();
 await expect.poll(()=>remotePayments(server).filter(x=>x.correctsPaymentId===firstId&&x.accountingStatus==='posted').length,{timeout:18000}).toBe(1);
 await page.waitForFunction(()=>!syncPending&&!syncRunning);
 // Reversal + new source + repost must be a single server-side sync_records batch.
 expect(server.rpcCount-beforeCorrectionRpc).toBe(1);
 const original=remotePayments(server).find(p=>p.id===firstId);
 expect(original).toEqual(first);
 const amended=remotePayments(server).find(p=>p.correctsPaymentId===firstId);
 expect(amended.amount).toBe(1250);
 expect(amended.reference).toBe(first.reference);
 expect(amended.journalVoucherId).toBeTruthy();
 const vouchers=[...server.records.values()].filter(x=>x.collection==='journalVouchers');
 expect(vouchers).toHaveLength(3);
 expect(vouchers.find(x=>x.id===first.journalVoucherId).data.status).toBe('reversed');
 expect(oldLines).toEqual([...server.records.values()].filter(x=>x.collection==='journalLines'&&x.data.voucherId===first.journalVoucherId).map(copy));
 for(const v of vouchers){
  const lines=[...server.records.values()].filter(x=>x.collection==='journalLines'&&x.data.voucherId===v.id);
  expect(lines.reduce((n,x)=>n+Number(x.data.debit||0),0)).toBe(lines.reduce((n,x)=>n+Number(x.data.credit||0),0));
 }
 expect(await page.evaluate(()=>paymentVisibleRecords().map(x=>x.id))).toEqual([amended.id]);
 expect(await page.evaluate(()=>paymentEffectiveRecords().map(x=>x.amount))).toEqual([1250]);
 await page.evaluate(()=>navigateShell('accounting','view-journal','documents'));
 await expect(page.locator('#finora-treasury-document-management-body tr')).toHaveCount(1);
 await expect(page.locator('#finora-treasury-document-management-body')).toContainText('REF-ORIGINAL-001');
 await page.evaluate(()=>{switchView('view-payments');renderPayments()});
 await expect(page.locator('#payments-ledger tr')).toHaveCount(1);
 await expect(page.locator('#payments-ledger')).toContainText('۱٬۲۵۰');
 await expect(page.locator('#payments-ledger')).toContainText('REF-ORIGINAL-001');
 await page.reload({waitUntil:'domcontentloaded'});await authenticatedMockBrowser(page);
 await page.evaluate(()=>{switchView('view-payments');renderPayments()});
 await expect(page.locator('#payments-ledger tr')).toHaveCount(1);
 expect(await page.evaluate(()=>paymentEffectiveRecords().map(x=>x.amount))).toEqual([1250]);
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
