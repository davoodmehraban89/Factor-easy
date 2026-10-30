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
  ['settings','main',{invoice_kind:'pre_invoice',vat_mode:'none',vat_rate:10,default_company_id:'QA_CO',currency_mode:'rial'}],
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
async function authenticatedMockBrowser(page,companyId='QA_CO',url=BASE){
 await page.goto(url,{waitUntil:'domcontentloaded'});
 // Mock identity must be injected only after the async organization wrapper
 // and all ERP extensions have finished installing. Test-only readiness guard.
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
   switchView('view-invoices');
 });
 await expect(page.locator('#auth-screen')).toBeHidden();
 await expect(page.locator('#invoice-company-id')).toHaveValue(companyId);
 await expect(page.locator('#invoice-items-table-body .row-product-select').first().locator('option[value="QA_PROD"]')).toHaveCount(1);
}
async function fillInvoice(page,number,qty){
 // The native invoice-kind/contact selectors are hidden by the unified commercial combobox.
 // Drive their real DOM change handlers, not Playwright visibility on replaced native selects.
 await page.evaluate(()=>{
   for(const [id,value] of [['invoice-kind','pre_invoice'],['invoice-company-id','QA_CO'],['invoice-contact-id','QA_CONTACT']]){
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

test('F0-03 isolated invoice save → mock-server sync → reload → edit → reload → print',async({page})=>{
 const server=fakeServer();
 await installHarness(page,server);
 await authenticatedMockBrowser(page);
 await fillInvoice(page,'QA-PINV-0001',2);
 await expect(page.locator('#summary-grandtotal')).toContainText('۳٬۰۰۰');
 await page.evaluate(()=>commitSaveInvoice());
 await expect.poll(()=>remoteInvoices(server).length,{timeout:12000}).toBe(1);
 let first=remoteInvoices(server)[0];
 expect({number:first.number,kind:first.kind,subtotal:first.subtotal,total:first.grandTotal,qty:first.items[0].qty,price:first.items[0].price})
   .toEqual({number:'QA-PINV-0001',kind:'pre_invoice',subtotal:3000,total:3000,qty:2,price:1500});
 expect([...server.records.values()].filter(r=>r.collection==='journalVouchers')).toHaveLength(0);

 await page.reload({waitUntil:'domcontentloaded'});
 await authenticatedMockBrowser(page);
 const savedId=await page.evaluate(()=>getMyInvoices().find(i=>i.number==='QA-PINV-0001')?.id||'');
 expect(savedId).toMatch(/^INV_/);
 await page.evaluate(id=>editInvoice(id),savedId);
 await expect(page.locator('#edit-invoice-id')).toHaveValue(savedId);
 await expect(page.locator('#invoice-items-table-body .row-product-select').first()).toHaveValue('QA_PROD');
 await expect(page.locator('#invoice-items-table-body .row-quantity').first()).toHaveValue('2');
 await page.locator('#invoice-items-table-body .row-quantity').first().fill('3');
 await page.locator('#invoice-items-table-body .row-quantity').first().dispatchEvent('input');
 await page.evaluate(()=>commitSaveInvoice());
 await expect.poll(()=>remoteInvoices(server)[0]?.grandTotal,{timeout:12000}).toBe(4500);
 expect(remoteInvoices(server)).toHaveLength(1);
 expect(remoteInvoices(server)[0].id).toBe(savedId);

 await page.reload({waitUntil:'domcontentloaded'});
 await authenticatedMockBrowser(page);
 const reloaded=await page.evaluate(id=>getMyInvoices().find(x=>x.id===id),savedId);
 expect({count:reloaded.items.length,qty:reloaded.items[0].qty,total:reloaded.grandTotal})
   .toEqual({count:1,qty:3,total:4500});
 await page.evaluate(id=>renderAndPrintDirect(id),savedId);
 await expect(page.locator('#printable-invoice')).toContainText('QA-PINV-۰۰۰۱');
 await expect(page.locator('#printable-invoice')).toContainText('۴٬۵۰۰');
 await expect(page.locator('#printable-invoice')).not.toContainText('پیش‌نویس — غیرقطعی');
 await expect(page.frameLocator('#finora-print-frame').locator('#finora-print-document')).not.toContainText('پیش‌نویس — غیرقطعی');
 const printable=await page.locator('#printable-invoice').innerText();
 expect(printable).not.toMatch(/[0-9٠-٩]/);
});

test('F0-03 isolated transient RPC failure remains pending and retries without duplicate invoice',async({page})=>{
 const server=fakeServer();
 await installHarness(page,server);
 await authenticatedMockBrowser(page);
 await fillInvoice(page,'QA-PINV-RETRY',2);
 server.failNext=true;
 await page.evaluate(()=>commitSaveInvoice());
 await expect.poll(()=>server.failCount,{timeout:12000}).toBe(1);
 await expect.poll(()=>remoteInvoices(server).length,{timeout:16000}).toBe(1);
 expect(remoteInvoices(server)[0].number).toBe('QA-PINV-RETRY');
 expect(remoteInvoices(server)).toHaveLength(1);
 expect(server.rpcCount).toBeGreaterThanOrEqual(2);
 await page.reload({waitUntil:'domcontentloaded'});
 await authenticatedMockBrowser(page);
 expect(await page.evaluate(()=>getMyInvoices().filter(i=>i.number==='QA-PINV-RETRY').length)).toBe(1);
});

test('invoice defaults preserve zero VAT, document kind and every currency mode through save and session reload',async({page})=>{
 const server=fakeServer();
 await installHarness(page,server);
 await authenticatedMockBrowser(page);
 for(const values of [
  {invoice_kind:'formal',vat_mode:'with_vat',vat_rate:0,currency_mode:'custom',currency_custom:'واحد آزمایشی'},
  {invoice_kind:'pre_invoice',vat_mode:'none',vat_rate:10,currency_mode:'toman',currency_custom:''},
  {invoice_kind:'non_formal',vat_mode:'none',vat_rate:0,currency_mode:'rial',currency_custom:''}
 ]){
  await page.evaluate(values=>{
   switchView('view-settings');
   for(const [id,value] of Object.entries({'def-invoice-kind':values.invoice_kind,'def-vat-mode':values.vat_mode,'def-vat-rate':values.vat_rate,'def-currency-mode':values.currency_mode,'def-currency-custom':values.currency_custom}))document.getElementById(id).value=String(value);
   document.querySelector('[data-finora-task="invoice-defaults"] .btn-primary').click();
  },values);
  await expect.poll(()=>{
   const row=server.records.get('settings|main')?.data;
   return row&&Object.fromEntries(Object.keys(values).map(key=>[key,row[key]]));
  }).toEqual(values);
  await expect.poll(()=>page.evaluate(()=>syncPending||syncRunning)).toBe(false);
  await page.evaluate(()=>{sb.auth.signOut=async()=>({error:null});});
  await Promise.all([page.waitForEvent('load'),page.evaluate(()=>handleLogout())]);
  await expect(page.locator('#auth-screen')).toBeVisible();
  await authenticatedMockBrowser(page);
  const restored=await page.evaluate(()=>({
   invoice_kind:document.getElementById('def-invoice-kind').value,
   vat_mode:document.getElementById('def-vat-mode').value,
   vat_rate:parseFormattedNumber(document.getElementById('def-vat-rate').value),
   currency_mode:document.getElementById('def-currency-mode').value,
   currency_custom:document.getElementById('def-currency-custom').value,
   newInvoiceRate:parseFormattedNumber(document.getElementById('invoice-vat-rate-input').value)
  }));
  expect(restored).toMatchObject(values);
  if(values.invoice_kind!=='non_formal')expect(restored.newInvoiceRate).toBe(values.vat_rate);
 }
 expect(remoteInvoices(server)).toHaveLength(0);
 expect([...server.records.values()].filter(r=>['purchases','journalVouchers','journalLines'].includes(r.collection))).toHaveLength(0);
});

for(const [layout,url] of [['source',BASE],['published Pages',new URL('/_site/index.html',BASE).href]])
test(layout+': company Edit and Save buttons persist settings and active company through logout without applying a chart',async({page})=>{
 const server=fakeServer();
 Object.assign(server.records.get('settings|main').data,{professional_role:'accountant',user_display_name:'Company QA'});
 server.records.set('companies|QA_CO2',{collection:'companies',id:'QA_CO2',data:{name:'شرکت دوم آزمون',entity_type:'legal'}});
 await installHarness(page,server);
 await authenticatedMockBrowser(page,'QA_CO',url);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.evaluate(()=>navigateShell('settings','view-settings','company'));
 await page.locator('#companies-table-body [data-company-id="QA_CO"]').click();
 await expect(page.locator('#company-name-input')).toHaveValue('شرکت آزمون ایزوله');
 await expect(page.locator('#company-save-btn')).toBeDisabled();
 await page.locator('#company-phone-input').fill('02100000000');
 await expect(page.locator('#company-save-btn')).toBeEnabled();
 await page.locator('#company-edit-cancel-btn').click();
 await expect(page.locator('#company-name-input')).toHaveValue('');
 await page.locator('#companies-table-body [data-company-id="QA_CO"]').click();
 const form={
  'company-entity-type':'legal','company-sector':'cooperative','company-legal-form':'limited_liability',
  'company-organization-role':'standalone','company-parent-id':'','company-activity-type':'service',
  'company-name-input':'شرکت تنظیمات آزمون','company-phone-input':'02112345678',
  'company-national-input':'12345678901','company-economic-input':'123456789012',
  'company-reg-input':'12345','company-postal-input':'1234567890',
  'company-address-input':'نشانی ساختگی آزمون','company-footer-input':'متن پایانی آزمون'
 };
 await page.evaluate(form=>{
  for(const [id,value] of Object.entries(form)){const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}
  document.getElementById('company-accounting-template').value='empty';
 },form);
 await page.locator('#company-save-btn').click();
 await expect.poll(()=>server.records.get('companies|QA_CO')?.data.footer).toBe(form['company-footer-input']);
 await page.locator('#companies-table-body tr').filter({hasText:'شرکت دوم آزمون'}).getByRole('button',{name:'انتخاب',exact:true}).click();
 await expect.poll(()=>server.records.get('settings|main')?.data.default_company_id).toBe('QA_CO2');
 await expect.poll(()=>page.evaluate(()=>syncPending||syncRunning)).toBe(false);
 await page.evaluate(()=>{sb.auth.signOut=async()=>({error:null});});
 await Promise.all([page.waitForEvent('load'),page.evaluate(()=>handleLogout())]);
 await authenticatedMockBrowser(page,'QA_CO2',url);
 await page.evaluate(()=>navigateShell('settings','view-settings','company'));
 await page.locator('#companies-table-body [data-company-id="QA_CO"]').click();
 expect(await page.evaluate(()=>getMySettings().default_company_id)).toBe('QA_CO2');
 await expect(page.locator('#invoice-company-id')).toHaveValue('QA_CO2');
 expect(await page.evaluate(ids=>{
  return Object.fromEntries(ids.map(id=>[id,document.getElementById(id).value]));
 },Object.keys(form))).toEqual(form);
 const writes=server.rpcCount;
 await page.evaluate(()=>{currentUser.subscription.status='expired';updateCompanyFormAction();});
 await page.locator('#company-phone-input').fill('02199999999');
 await expect(page.locator('#company-save-btn')).toBeDisabled();
 await page.evaluate(()=>commitSaveCompany());
 expect(server.rpcCount).toBe(writes);
 expect(server.records.get('companies|QA_CO').data.phone).toBe(form['company-phone-input']);
 expect(errors).toEqual([]);
 expect([...server.records.values()].filter(r=>['accounts','invoices','purchases','journalVouchers','journalLines'].includes(r.collection))).toHaveLength(0);
});
