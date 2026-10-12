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
