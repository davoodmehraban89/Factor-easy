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

test('Slow final CSP dispatcher keeps login usable without loading legacy ERP scripts',async({page})=>{
  let delayedDispatcherReleased=false;
  const unexpectedLegacyRequests=[];
  const initiatorTrace=[];
  const session=await page.context().newCDPSession(page);
  await session.send('Network.enable');
  session.on('Network.requestWillBeSent',event=>{
    if(!/\/enterprise-iran(?:-v2)?\.js(?:\?|$)/.test(event.request.url))return;
    initiatorTrace.push({
      path:new URL(event.request.url).pathname,
      type:event.type||'unknown',
      initiatorType:event.initiator?.type||'unknown',
      stack:(event.initiator?.stack?.callFrames||[]).slice(0,3).map(frame=>({
        file:String(frame.url||'').split('?')[0].replace(/^https?:\/\/[^/]+/,''),
        line:frame.lineNumber,
        name:frame.functionName
      }))
    });
  });
  const standaloneScripts=new Set([
    'enterprise-iran.js','enterprise-iran-v2.js','accounting-foundation.js',
    'journal-engine.js','admin.js','organization-rbac.js','taxpayer-print.js'
  ]);
  page.on('request',req=>{
    const filename=new URL(req.url()).pathname.split('/').at(-1);
    if(standaloneScripts.has(filename))unexpectedLegacyRequests.push({filename,type:req.resourceType()});
  });
  // The owner's Chrome waterfall showed this bottom-of-body CSP dispatcher
  // unusually slow. A delayed response is used; an HTTP 304 is not treated
  // as a failed script, and no authenticated account or finance data is used.
  await page.route('**/js/generated-dynamic-handlers.js',async route=>{
    await new Promise(resolve=>setTimeout(resolve,4500));
    delayedDispatcherReleased=true;
    await route.continue();
  });
  await page.goto(base,{waitUntil:'commit'});
  await expect(page.locator('#auth-login-button')).toBeEnabled({timeout:3500});
  const early=await page.evaluate(()=>({
    documentState:document.readyState,
    authReady:window.FinoraStartupStatus?.authFormReady,
    staticHandlers:window.FinoraLoginActionsBound,
    authVisible:getComputedStyle(document.getElementById('auth-screen')).display!=='none'
  }));
  expect(early).toMatchObject({
    documentState:'loading',
    authReady:true,
    staticHandlers:true,
    authVisible:true
  });
  expect(delayedDispatcherReleased,'The auth form must not await the bottom dispatcher').toBe(false);
  const prompt=page.waitForEvent('dialog').then(async dialog=>{
    expect(dialog.message()).toContain('ایمیل');
    await dialog.dismiss();
  });
  await Promise.all([page.locator('#auth-login-button').click(),prompt]);
  await page.waitForLoadState('domcontentloaded',{timeout:15000});
  await expect.poll(()=>page.evaluate(()=>window.FinoraStartupStatus?.extensionsReady),{timeout:15000}).toBe(true);
  expect(delayedDispatcherReleased).toBe(true);
  if(unexpectedLegacyRequests.length)console.log('LEGACY_PAGES_REQUEST_TRACE='+JSON.stringify(initiatorTrace));
  expect(unexpectedLegacyRequests,'Published Pages must not refetch already bundled ERP source modules; CDP '+JSON.stringify(initiatorTrace)).toEqual([]);
  expect(await page.locator('#auth-screen').isVisible()).toBe(true);
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


test('Published Pages invoice product and buyer filters stay scoped and do not persist draft edits',async({page})=>{
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.FinoraLoginActionsBound===true&&
    typeof window.applyLicensedModuleUI==='function'&&
    typeof window.finoraRefreshSearchableSelect==='function'&&
    typeof window.renderContacts==='function'&&
    window.FinoraStartupStatus?.extensionsReady===true,{timeout:20000});
  const initial=await page.evaluate(()=>{
    // All records are synthetic and live ONLY in this local browser process.
    const uid='qa-pages-selectors';
    currentUser={id:uid,role:'accountant',modules:['full_suite'],
      subscription:{type:'lifetime',status:'active',endDate:'2099-01-01'}};
    const product=(id,name,unit,price,ownerUserId=uid)=>({
      id,ownerUserId,code:id,name,spec:'آزمایشی',unit,sale_price:price
    });
    datastore.settings=[{ownerUserId:uid,default_company_id:'QA_CO',ui_theme:'light'}];
    datastore.companies=[{id:'QA_CO',ownerUserId:uid,name:'شرکت آزمون مستقل'}];
    datastore.products=[
      product('QA_P10','بلوک سبک ۱۰','عدد',11000),
      product('QA_P15','بلوک سبک ۱۵','بسته',15000),
      product('QA_H1','هارد آزمایشی','عدد',20000),
      product('OTHER_P','بلوک محرمانه','عدد',1,'OTHER_USER')
    ];
    datastore.contacts=[
      {id:'QA_C1',ownerUserId:uid,name:'شرکت آزمایشی الف',role:'customer',balance:0},
      {id:'QA_C2',ownerUserId:uid,name:'شرکت آزمایشی ب',role:'both',balance:0},
      {id:'QA_C3',ownerUserId:uid,name:'آزمایش شخص حقیقی',role:'customer',balance:0},
      {id:'OTHER_C',ownerUserId:'OTHER_USER',name:'شرکت محرمانه',role:'customer',balance:0}
    ];
    datastore.invoices=[];datastore.purchases=[];
    document.querySelector('#auth-screen').style.display='none';
    applyLicensedModuleUI();
    renderContacts();
    finoraEnsureInitialInvoiceRow();
    const goods=document.querySelector('#invoice-items-table-body .row-product-select');
    const buyer=document.querySelector('#invoice-contact-id');
    if(!goods||!buyer)throw new Error('Missing invoice product/customer controls');
    finoraRefreshSearchableSelect(goods);
    finoraRefreshSearchableSelect(buyer);
    window.__qaPersistedWrites=0;
    window.saveDatastore=()=>{
      window.__qaPersistedWrites++;
      throw new Error('Unexpected saveDatastore during filter-only QA');
    };
    return {goods:goods.value,buyer:buyer.value,
      products:[...goods.options].filter(o=>o.value).map(o=>o.value),
      customers:[...buyer.options].filter(o=>o.value).map(o=>o.value)};
  });
  expect(initial.products).toEqual(['QA_P10','QA_P15','QA_H1']);
  expect(initial.customers).toEqual(['QA_C1','QA_C2','QA_C3']);
  await page.locator('#module-rail [data-module="commerce"]').click();
  await expect(page.locator('#view-invoices')).toHaveClass(/active/);
  await expect(page.locator('#module-panel-title')).toHaveText('بازرگانی');

  const productSelect=page.locator('#invoice-items-table-body .row-product-select').first();
  const productInput=productSelect.locator('xpath=..').locator('.finora-combobox-input');
  await productInput.click();
  await productInput.fill('بلوک');
  const productList=page.locator('body > .finora-combobox-list:visible');
  await expect(productList.locator('[role="option"]')).toHaveCount(2);
  await expect(productList).not.toContainText('محرمانه');
  expect(await page.evaluate(()=>{
    const sel=document.querySelector('#invoice-items-table-body .row-product-select');
    return [...sel.options].filter(o=>o.value).map(o=>({id:o.value,unit:o.dataset.unit,price:o.dataset.price}));
  })).toEqual([
    {id:'QA_P10',unit:'عدد',price:'11000'},
    {id:'QA_P15',unit:'بسته',price:'15000'},
    {id:'QA_H1',unit:'عدد',price:'20000'}
  ]);
  await productInput.press('Escape');
  await expect(productSelect).toHaveValue(initial.goods);

  const buyerSelect=page.locator('#invoice-contact-id');
  const buyerInput=buyerSelect.locator('xpath=..').locator('.finora-combobox-input');
  await buyerInput.click();
  await buyerInput.fill('شرکت');
  const buyerList=buyerSelect.locator('xpath=..').locator('.finora-combobox-list');
  await expect(buyerList.locator('[role="option"]')).toHaveCount(2);
  await expect(buyerList).not.toContainText('محرمانه');
  await expect(buyerSelect).toHaveValue(initial.buyer);
  await buyerInput.press('Escape');

  const final=await page.evaluate(()=>({
    saves:window.__qaPersistedWrites,
    productId:document.querySelector('#invoice-items-table-body .row-product-select').value,
    buyerId:document.querySelector('#invoice-contact-id').value,
    invoices:datastore.invoices.length,
    crossUserProduct:getMyProducts().some(p=>p.id==='OTHER_P'),
    crossUserBuyer:getMyContacts().some(c=>c.id==='OTHER_C')
  }));
  expect(final).toEqual({
    saves:0,productId:initial.goods,buyerId:initial.buyer,invoices:0,
    crossUserProduct:false,crossUserBuyer:false
  });
  expect(pageErrors).toEqual([]);
});
