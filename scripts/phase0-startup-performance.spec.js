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
