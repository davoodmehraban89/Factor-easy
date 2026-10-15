const {test,expect}=require('@playwright/test');
const {execFileSync}=require('node:child_process');

const base='http://127.0.0.1:4173/_site/';

test.beforeAll(()=>{
  execFileSync(process.execPath,['scripts/build-pages.mjs'],{stdio:'inherit'});
});

test('hardened Pages artifact loads without script/CSP console errors',async({page,request})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
  await page.goto(base,{waitUntil:'networkidle'});
  await expect(page.locator('#view-dashboard')).toHaveCount(1);
  await expect.poll(()=>page.evaluate(()=>window.FinoraHealth?.version||null)).toBe('1.0');
  expect(await page.evaluate(()=>window.parseFormattedNumber('۱٬۲۳۴٫۵۶'))).toBe(1234.56);
  expect(await page.evaluate(()=>window.parseFormattedNumber('١٢٫٥'))).toBe(12.5);
  const csp=await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp||'').not.toMatch(/script-src[^;]*'unsafe-inline'/i);
  const inline=await page.locator('[onclick],[onchange],[oninput],[onsubmit],[onblur],[onfocus]').evaluateAll(nodes=>nodes.map(el=>({tag:el.tagName,id:el.id||'',attrs:[...el.attributes].filter(a=>/^on/i.test(a.name)).map(a=>[a.name,a.value])})));
  if(inline.length)console.log('REMAINING_INLINE_HANDLERS='+JSON.stringify(inline));
  expect(inline).toEqual([]);
  const diag=await request.get(base+'diag.html');
  expect(diag.status()).toBe(404);
  expect(errors).toEqual([]);
});


test('Production CSP login and connectivity actions work while later ERP JS is still downloading',async({page})=>{
 let delayedModuleFinished=false;
 await page.route('**/js/finora-pages-accounting.js*',async route=>{
   await new Promise(resolve=>setTimeout(resolve,5000));
   delayedModuleFinished=true;
   await route.continue();
 });
 await page.route('**/auth/v1/health',route=>route.fulfill({
   status:200,
   contentType:'application/json',
   headers:{'access-control-allow-origin':'*','access-control-allow-headers':'apikey, authorization, content-type, x-client-info','access-control-allow-methods':'GET, OPTIONS'},
   body:'{"status":"ok"}'
 }));
 // The actual hardened Pages output removes inline onclick attributes.
 await page.goto(base,{waitUntil:'commit'});
 await expect(page.locator('#auth-connectivity-check')).toBeEnabled({timeout:4000});
 expect(await page.evaluate(()=>window.FinoraLoginActionsBound)).toBe(true);
 expect(delayedModuleFinished,'Login actions must be wired before slow ERP scripts').toBe(false);
 await page.locator('#auth-connectivity-check').click();
 await expect(page.locator('#auth-connectivity-result')).toContainText('AUTH_OK',{timeout:2500});
 expect(delayedModuleFinished,'Connectivity check must not await unrelated modules').toBe(false);
 const alertHandled=page.waitForEvent('dialog').then(async d=>{
   expect(d.message()).toContain('ایمیل');
   await d.dismiss();
 });
 await Promise.all([page.locator('#auth-login-button').click(),alertHandled]);
 expect(delayedModuleFinished).toBe(false);
});

test('Built Pages uses exactly one SHA-pinned local bundle for all 14 ERP extensions',async({page})=>{
  const requested=[];
  page.on('request',req=>{
    const path=new URL(req.url()).pathname;
    if(path.includes('finora-extension-bundle.js')||/\/(organization-rbac|request-workflow-d2|office-workflow|taxpayer-print)\.js$/.test(path))
      requested.push(path);
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>window.FinoraStartupStatus?.extensionsReady),{timeout:15000}).toBe(true);
  const state=await page.evaluate(()=>({
    ...window.FinoraStartupStatus,
    bundle:document.querySelector('script[src*="finora-extension-bundle.js"]')?.src||'',
    loaded:typeof window.FINORA_OFFICE_WORKFLOW_C8_UI_VERSION
  }));
  expect(state.extensionBundle).toBe(true);
  expect(state.extensionCount).toBe(14);
  expect(state.failedExtensionCount).toBe(0);
  expect(state.bundle).toMatch(/finora-extension-bundle\.js\?v=[0-9a-f]{16}$/);
  expect(state.loaded).toBe('string');
  expect(requested.filter(x=>x.endsWith('/finora-extension-bundle.js')).length).toBe(1);
  expect(requested.filter(x=>/\/(organization-rbac|request-workflow-d2|office-workflow|taxpayer-print)\.js$/.test(x))).toEqual([]);
});

test('A blocked production bundle fails closed and never exposes a partial financial workspace',async({page})=>{
  await page.route('**/js/finora-extension-bundle.js*',route=>route.abort('failed'));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>window.FinoraStartupStatus?.extensionsReady),{timeout:15000}).toBe(true);
  const output=await page.evaluate(async()=>{
    window.fetchCurrentUser=async()=>({id:'fixture-no-account',role:'accountant'});
    await enterApp({id:'fixture-no-account'}, {timeoutMs:500});
    return {
      status:document.getElementById('auth-login-status').textContent,
      loginVisible:getComputedStyle(document.getElementById('auth-screen')).display!=='none',
      currentUser:currentUser,
      failures:window.FinoraStartupStatus.failedExtensionCount
    };
  });
  expect(output.failures).toBe(14);
  expect(output.status).toContain('BOOT_APP_ASSETS_FAILED');
  expect(output.status).not.toContain('fixture-no-account');
  expect(output.loginVisible).toBe(true);
  expect(output.currentUser).toBe(null);
});

test('Built Pages loads exactly three ordered core groups instead of 38 blocking requests',async({page})=>{
 const names=['foundation','business','accounting'];
 const requests=[];
 page.on('request',r=>{if(new URL(r.url()).pathname.includes('/js/finora-pages-'))requests.push(new URL(r.url()).pathname);});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>window.FinoraStartupStatus?.extensionsReady),{timeout:15000}).toBe(true);
 const info=await page.evaluate(()=>({
   scripts:[...document.querySelectorAll('script[src*="finora-pages-"]')].map(el=>new URL(el.src).pathname.split('/').at(-1)),
   blockingFailed:window.FinoraStartupStatus.blockingPagesAssetFailed===true,
   loadedCore:typeof handleLogin,
   loadedAccounting:typeof window.finoraParseMoney==='function'||typeof window.parseFormattedNumber==='function'
 }));
 expect(info.scripts).toEqual(names.map(x=>'finora-pages-'+x+'.js'));
 expect(info.blockingFailed).toBe(false);
 expect(info.loadedCore).toBe('function');
 expect(info.loadedAccounting).toBe(true);
 expect(requests.map(x=>x.split('/').at(-1))).toEqual(names.map(x=>'finora-pages-'+x+'.js'));
 const html=await page.content();
 for(const legacy of ['js/admin.js','js/patches.js','js/accounting-foundation.js']){
   expect(html).not.toContain('<script src="'+legacy);
 }
});

test('A blocked required core Pages group prevents opening partial financial workspace',async({page})=>{
 await page.route('**/js/finora-pages-accounting.js*',route=>route.abort('failed'));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 const output=await page.evaluate(async()=>{
   window.fetchCurrentUser=async()=>({id:'fixture-person'});
   await enterApp({id:'fixture-person'},{timeoutMs:300});
   return {
     status:document.getElementById('auth-login-status').textContent,
     visible:getComputedStyle(document.getElementById('auth-screen')).display,
     user:currentUser,
     missing:window.FinoraStartupStatus.blockingPagesAssetFailed
   };
 });
 expect(output.missing).toBe(true);
 expect(output.status).toContain('BOOT_APP_ASSETS_FAILED');
 expect(output.status).not.toContain('fixture-person');
 expect(output.visible).toBe('flex');
 expect(output.user).toBe(null);
});


test('Published Pages CSP event bindings open Commerce and the top-bar sales invoice menu',async({page})=>{
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.FinoraLoginActionsBound===true&&
    typeof window.applyLicensedModuleUI==='function'&&
    window.FinoraStartupStatus?.extensionsReady===true,{timeout:20000});
  // Synthetic local only; no authenticated production session and no financial writes.
  await page.evaluate(()=>{
    currentUser={id:'qa-pages-navigation',role:'accountant',
      modules:['full_suite'],
      subscription:{type:'lifetime',status:'active',endDate:'2099-01-01'}};
    document.querySelector('#auth-screen').style.display='none';
    applyLicensedModuleUI();
  });
  const accounting=page.locator('#module-rail [data-module="accounting"]');
  const commerce=page.locator('#module-rail [data-module="commerce"]');
  await accounting.click();
  await expect(page.locator('#view-accounting-foundation')).toHaveClass(/active/);
  await commerce.click();
  await expect(page.locator('#view-invoices')).toHaveClass(/active/);
  await expect(page.locator('#module-panel-title')).toHaveText('بازرگانی');
  await expect(page.locator('#module-panel-links')).toContainText('فاکتورها');
  await expect(page.locator('#module-panel-links')).toContainText('کالا و خدمات');
  // On the hardened Pages build, onclick was replaced by generated CSP-safe handlers.
  // Testing raw source index.html alone cannot validate this event-wiring path.
  const quick=page.locator('#quick-create-toggle');
  await quick.click();
  await expect(quick).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#quick-create-menu')).toHaveClass(/open/);
  await page.locator('#quick-create-menu button').filter({hasText:'فاکتور فروش'}).click();
  await expect(page.locator('#view-invoices')).toHaveClass(/active/);
  await expect(page.locator('#quick-create-menu')).not.toHaveClass(/open/);
  await expect(quick).toHaveAttribute('aria-expanded','false');
  expect(pageErrors).toEqual([]);
});


test('Published Pages F0-02 invoice product and buyer search only use synthetic data without writes',async({page})=>{
  // No real Supabase session. The built Pages event binder + ERP bundles execute in Chromium.
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.FinoraStartupStatus?.extensionsReady===true&&
    typeof window.finoraRefreshSearchableSelect==='function'&&
    typeof window.addInvoiceItemRow==='function'&&
    typeof window.renderContacts==='function');
  await page.evaluate(()=>{
    currentUser={
      id:'F0-02-SYNTHETIC-ONLY',role:'accountant',modules:['full_suite'],
      subscription:{type:'lifetime',status:'active',endDate:'2099-01-01'}
    };
    datastore.companies=[
      {id:'QA_CO',ownerUserId:currentUser.id,name:'شرکت آزمون غیرواقعی'}
    ];
    datastore.settings=[{
      ownerUserId:currentUser.id,default_company_id:'QA_CO',
      currency_mode:'rial',vat_mode:'none',vat_rate:10
    }];
    datastore.products=[
      {id:'QA_B10',ownerUserId:currentUser.id,name:'بلوک سیمانی سبک',
        code:'B-10',spec:'ده سانت',unit:'عدد',sale_price:1700,buy_price:1200},
      {id:'QA_B15',ownerUserId:currentUser.id,name:'بلوک دیواری',
        code:'B-15',spec:'پانزده سانت',unit:'عدد',sale_price:2400,buy_price:2000},
      {id:'QA_H1',ownerUserId:currentUser.id,name:'هارد تستی',
        code:'H-1',spec:'ذخیره ساز',unit:'دستگاه',sale_price:4000,buy_price:2800},
      {id:'OTHER_SECRET',ownerUserId:'ANOTHER_TENANT',name:'بلوک غیرمجاز',
        code:'NOPE',spec:'نباید دیده شود',unit:'عدد',sale_price:1}
    ];
    datastore.contacts=[
      {id:'QA_BUY1',ownerUserId:currentUser.id,name:'شرکت خریدار آزمایشی',role:'customer'},
      {id:'QA_BUY2',ownerUserId:currentUser.id,name:'مشتری حقیقی آزمایشی',role:'customer'},
      {id:'QA_SUP',ownerUserId:currentUser.id,name:'شرکت تامین کننده آزمایشی',role:'supplier'},
      {id:'OTHER_PERSON',ownerUserId:'ANOTHER_TENANT',name:'شرکت بیگانه',role:'customer'}
    ];
    datastore.invoices=[];
    window.__qaBackupSaveDatastore=saveDatastore;
    window.__qaSaveCalls=0;
    saveDatastore=()=>{window.__qaSaveCalls++;throw Error('UNEXPECTED_FINANCIAL_WRITE')};
    document.getElementById('invoice-items-table-body').replaceChildren();
    renderContacts();
    addInvoiceItemRow();
    const buyer=document.getElementById('invoice-contact-id');
    finoraRefreshSearchableSelect(buyer);
    document.getElementById('auth-screen').style.display='none';
    applyLicensedModuleUI();
  });
  await page.locator('#module-rail [data-module="commerce"]').click();
  await expect(page.locator('#view-invoices')).toHaveClass(/active/);
  const row=page.locator('#invoice-items-table-body tr').first();
  const product=row.locator('.row-product-select');
  const productSearch=product.locator('xpath=..').locator('.finora-combobox-input');
  await productSearch.click();
  await productSearch.fill('بلوك');
  const productOptions=page.locator('body > .finora-combobox-list [role="option"]');
  await expect(productOptions).toHaveCount(2);
  await expect(page.locator('body > .finora-combobox-list')).not.toContainText('غیرمجاز');
  // Metadata must be available on *options* without clicking and changing a draft row.
  const metadata=await product.evaluate(select=>{
    const option=[...select.options].find(o=>o.value==='QA_B10');
    return {unit:option?.dataset.unit,price:option?.dataset.price,selected:select.value};
  });
  expect(metadata).toEqual({unit:'عدد',price:'1700',selected:''});
  await productSearch.press('Escape');
  const buyer=page.locator('#invoice-contact-id');
  const buyerSearch=buyer.locator('xpath=..').locator('.finora-combobox-input');
  const originalBuyer=await buyer.inputValue();
  await buyerSearch.click();
  await buyerSearch.fill('شرکت');
  const buyerOptions=buyer.locator('xpath=..').locator('.finora-combobox-list [role="option"]');
  await expect(buyerOptions).toHaveCount(1);
  await expect(buyerOptions).toContainText('خریدار آزمایشی');
  await expect(buyerOptions).not.toContainText('تامین کننده');
  // Typing filter must NEVER silently change the already selected option.
  await expect(buyer).toHaveValue(originalBuyer);
  await buyerSearch.press('Escape');
  const unchanged=await page.evaluate(()=>({
    saveCalls:window.__qaSaveCalls,invoiceCount:datastore.invoices.length,
    productSelection:document.querySelector('#invoice-items-table-body .row-product-select')?.value||'',
    buyerSelection:document.getElementById('invoice-contact-id')?.value||''
  }));
  expect(unchanged).toEqual({saveCalls:0,invoiceCount:0,productSelection:'',buyerSelection:originalBuyer});
  expect(errors).toEqual([]);
});
