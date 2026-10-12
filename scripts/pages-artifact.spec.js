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
 expect(requests).toEqual(names.map(x=>'/js/finora-pages-'+x+'.js'));
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
