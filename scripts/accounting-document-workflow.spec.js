const {test,expect}=require('@playwright/test');

const BASE=process.env.FINORA_TEST_BASE_URL||'http://127.0.0.1:4173/index.html';
const USER='FINORA_F0_FIXTURE_ONLY';
const copy=value=>JSON.parse(JSON.stringify(value));
function fakeServer(){
 const records=new Map();
 for(const [collection,id,data] of [
  ['companies','QA_CO',{name:'شرکت آزمون ایزوله',entityType:'legal'}],
  ['contacts','QA_CONTACT',{name:'خریدار آزمایشی'}],
  ['products','QA_PROD',{name:'بلوک سیمانی',code:'BLK-001',unit:'عدد',sale_price:1500}],
  ['settings','main',{invoice_kind:'formal',vat_mode:'none',vat_rate:10,default_company_id:'QA_CO',currency_mode:'rial'}],
  ['fiscalYears','FY_QA',{name:'۱۴۰۵',startDate:'1405/01/01',endDate:'1405/12/29',status:'open'}],
  ['accounts','A_CASH',{code:'1101',title:'صندوق',systemRole:'cash_default',postingAllowed:true,active:true}],
  ['accounts','A_AR',{code:'1102',title:'دریافتنی',systemRole:'receivable_control',postingAllowed:true,active:true}],
  ['accounts','A_REV',{code:'4101',title:'درآمد فروش',systemRole:'revenue_default',postingAllowed:true,active:true}],
  ['accounts','A_VAT',{code:'2102',title:'مالیات',systemRole:'vat_payable',postingAllowed:true,active:true}],
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
 await page.waitForFunction(()=>typeof enterApp==='function'&&typeof commitSaveInvoice==='function'&&typeof pullAll==='function');
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
