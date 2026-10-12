// Phase 0 startup performance: never load a real owner session or read customer data.
const {test,expect}=require('@playwright/test');
const BASE=process.env.FINORA_TEST_BASE_URL||'http://127.0.0.1:4173/index.html';
const EXTENSIONS=[
 'organization-rbac.js','organization-invitations.js','organization-enterprise-ux.js',
 'platform-modules.js','office-automation.js','request-workflow-d2.js',
 'request-workflow-d3b.js','request-workflow-d3c.js','request-workflow-d4a.js',
 'office-rbac.js','office-mature.js','office-workflow.js',
 'organization-shell.js','taxpayer-print.js'
];

test('F0 startup downloads ordered extension scripts concurrently and still initializes login',async({page})=>{
 const started=[];
 // Simulate an affected ISP where each file has its own network round trip.
 await page.route('**/js/**',async route=>{
   const name=new URL(route.request().url()).pathname.split('/').pop();
   if(!EXTENSIONS.includes(name)){await route.continue();return;}
   started.push({name,ms:Date.now()});
   await new Promise(resolve=>setTimeout(resolve,170));
   await route.continue();
 });
 // A failed optional third-party spreadsheet/font CDN must not hold up login.
 await page.route('https://cdn.jsdelivr.net/**',route=>route.abort());
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>window.FinoraStartupStatus?.extensionCount),{timeout:15000}).toBe(14);
 const state=await page.evaluate(()=>window.FinoraStartupStatus);
 expect(state.failedExtensionCount,'No local extension should fail to load').toBe(0);
 expect(started.map(x=>x.name).sort()).toEqual(EXTENSIONS.slice().sort());
 const arrivalWindow=Math.max(...started.map(x=>x.ms))-Math.min(...started.map(x=>x.ms));
 console.info('F0 startup extension dispatch spread browser ms:',arrivalWindow);
 // Old waterfall loads 14 x 170ms sequentially; parallel dispatch is bounded.
 expect(arrivalWindow,'extension network requests should overlap').toBeLessThan(1200);
 await expect(page.locator('#auth-screen')).toBeVisible();
 expect(await page.evaluate(()=>typeof window.finoraLoadScript)).toBe('function');
 expect(await page.evaluate(()=>typeof XLSX)).toBe('undefined');
});

test('F0 startup is independent of optional spreadsheet CDN and keeps on-demand Excel guard',async({page})=>{
 await page.route('https://cdn.jsdelivr.net/**',route=>route.abort());
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>window.FinoraStartupStatus?.extensionCount),{timeout:15000}).toBe(14);
 await expect(page.locator('#auth-screen')).toBeVisible();
 expect(await page.evaluate(()=>typeof window.finoraDownloadConfiguredTemplate)).toBe('function');
 expect(await page.evaluate(()=>typeof window.XLSX)).toBe('undefined');
});

test('F0 login controls are actionable before a delayed non-auth deferred script completes',async({page})=>{
 const late='phase6-reporting.js';
 let lateFinished=false;
 await page.route('**/js/'+late+'*',async route=>{
   await new Promise(resolve=>setTimeout(resolve,3500));
   lateFinished=true;
   await route.continue();
 });
 const start=Date.now();
 await page.goto(BASE,{waitUntil:'commit'});
 await expect(page.locator('#auth-login-button')).toBeEnabled({timeout:3000});
 const readyMs=Date.now()-start;
 console.info('F0 login form enabled before late ERP script, elapsed ms:',readyMs);
 expect(lateFinished,'Login should not wait on optional ERP source file').toBe(false);
 await page.locator('#auth-email').fill('nobody@example.test');
 await page.locator('#auth-password').fill('qa-fixture-only');
 await expect(page.locator('#auth-email')).toHaveValue('nobody@example.test');
 await expect(page.locator('#auth-login-status')).toHaveAttribute('data-state','ready');
 // Never submit this fake identity to a real server in a startup smoke.
});

test('F0 login visibly reports a pending mocked sign-in and suppresses duplicate requests',async({page})=>{
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>window.FinoraStartupStatus?.authChecked),{timeout:15000}).toBe(true);
 await page.evaluate(()=>{
   window.finoraFixtureLoginCalls=0;
   sb.auth.signInWithPassword=async()=>{
     window.finoraFixtureLoginCalls+=1;
     return {data:{user:{id:'fixture-nonreal'}},error:null};
   };
   window.fetchCurrentUser=async()=>({id:'fixture-nonreal',email:'fixture@example.test',role:'accountant'});
   window.pullAll=()=>new Promise(()=>{}); // intentionally stalled fixture, zero DB activity
 });
 await page.locator('#auth-email').fill('fixture@example.test');
 await page.locator('#auth-password').fill('synthetic-fixture-only');
 await page.locator('#auth-login-button').click();
 await expect(page.locator('#auth-login-status')).toHaveAttribute('data-state','loading');
 await page.locator('#auth-login-button').click();
 await expect(page.locator('#auth-login-status')).toHaveAttribute('data-state','busy');
 expect(await page.evaluate(()=>window.finoraFixtureLoginCalls)).toBe(1);
 await expect(page.locator('#auth-screen')).toBeVisible();
});
