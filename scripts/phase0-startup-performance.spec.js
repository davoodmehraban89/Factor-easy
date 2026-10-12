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

test('F0 login controls are actionable before a delayed non-auth extension completes',async({page})=>{
 const late='office-workflow.js';
 let lateFinished=false;
 await page.route('**/js/'+late+'*',async route=>{
   await new Promise(resolve=>setTimeout(resolve,3500));
   lateFinished=true;
   await route.continue();
 });
 const start=Date.now();
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#auth-login-button')).toBeEnabled({timeout:3000});
 const readyMs=Date.now()-start;
 console.info('F0 login form enabled before late ERP script, elapsed ms:',readyMs);
 expect(lateFinished,'Login should not wait on optional ERP extension').toBe(false);
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

test('F0 auth transport times out stalled requests without affecting other Supabase endpoints',async({page})=>{
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(async()=>{
   const original=window.fetch,called=[];
   window.fetch=(input,init={})=>new Promise((resolve,reject)=>{
     called.push({url:String(input),signal:!!init.signal});
     if(!String(input).includes('/auth/v1/'))return resolve({ok:true});
     init.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true});
   });
   try{
     let timedOut=false;
     try{await finoraBoundedAuthFetch('https://example.test/auth/v1/token',{},40);}
     catch(err){timedOut=err.name==='AbortError';}
     await finoraBoundedAuthFetch('https://example.test/rest/v1/records',{},40);
     return {timedOut,called};
   }finally{window.fetch=original;}
 });
 expect(result.timedOut).toBe(true);
 expect(result.called).toEqual([
   {url:'https://example.test/auth/v1/token',signal:true},
   {url:'https://example.test/rest/v1/records',signal:false}
 ]);
});


test('F0 restored session with stalled company data returns actionable error instead of endless loading',async({page})=>{
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>window.FinoraStartupStatus?.authChecked),{timeout:15000}).toBe(true);
 const actual=await page.evaluate(async()=>{
   window.fetchCurrentUser=async()=>({id:'synthetic-restore',email:'fixture@example.test',role:'accountant'});
   window.pullAll=async()=>new Promise(()=>{}); // Intentionally unresolved read only, no account/database write.
   await enterApp({id:'synthetic-restore'},{timeoutMs:60});
   return {
     state:document.getElementById('auth-login-status').dataset.state,
     message:document.getElementById('auth-login-status').textContent,
     visible:getComputedStyle(document.getElementById('auth-screen')).display,
     currentUser:currentUser
   };
 });
 expect(actual.state).toBe('error');
 expect(actual.message).toContain('بیش از حد');
 expect(actual.visible).toBe('flex');
 expect(actual.currentUser).toBe(null);
 await expect(page.locator('#auth-connectivity-check')).toBeEnabled();
});

test('F0 cancelled company records read cannot apply a late partial datastore snapshot',async({page})=>{
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>window.FinoraStartupStatus?.authChecked),{timeout:15000}).toBe(true);
 const unchanged=await page.evaluate(async()=>{
   const originalFrom=sb.from;
   const originalUser=currentUser;
   currentUser={id:'fixture-read-only'};
   const before=datastore;
   const controller=new AbortController();
   sb.from=()=>({
     select(){return this;},order(){return this;},range(){return this;},
     abortSignal(){return this;},
     then(resolve){setTimeout(()=>resolve({data:[{collection:'products',id:'dummy',data:{name:'should-not-commit'}}],error:null}),75);}
   });
   try{
     const pending=pullAll({signal:controller.signal}).catch(()=>{});
     // Abort synchronously, before the deliberately late thenable resolves.
     // A tiny delayed abort introduces unrelated CI scheduling variability.
     controller.abort();
     await pending;
     await new Promise(resolve=>setTimeout(resolve,110));
     return {
       sameSnapshot:datastore===before,
       noDummyRecord:!(datastore.products||[]).some(p=>p.id==='dummy'),
       noDummySnapshot:!syncSnap.has('products|dummy'),
       aborted:controller.signal.aborted,
       runtimeHasCancelGuard:String(pullAll).includes('FINORA_LOGIN_READ_TIMEOUT')

     };
   }finally{
     sb.from=originalFrom;currentUser=originalUser;
   }
 });
 expect(unchanged).toEqual({sameSnapshot:true,noDummyRecord:true,noDummySnapshot:true,aborted:true,runtimeHasCancelGuard:true});
});


test('F0 organization-scoped record hydration respects abort and tenant boundary',async({page})=>{
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>window.FinoraStartupStatus?.authChecked),{timeout:15000}).toBe(true);
 const observed=await page.evaluate(async()=>{
   const originalFrom=sb.from,oldUser=currentUser,previous=datastore;
   let requestedOrganization='';
   currentUser={id:'fixture-user',organizationId:'org-fixture'};
   const controller=new AbortController();
   sb.from=()=>({
     select(){return this;},order(){return this;},range(){return this;},
     eq(field,value){if(field==='organization_id')requestedOrganization=value;return this;},
     abortSignal(){return this;},
     then(resolve){setTimeout(()=>resolve({data:[{collection:'products',id:'never-commit',data:{name:'fixture'}}],error:null}),80);}
   });
   try{
     const task=pullAll({signal:controller.signal}).catch(()=>{});
     controller.abort();
     await task;
     await new Promise(resolve=>setTimeout(resolve,120));
     return {
       selectedTenant:requestedOrganization,
       preserved:datastore===previous,
       noLeakedDummy:!(datastore.products||[]).some(x=>x.id==='never-commit'),
       noStaleSnapshot:!syncSnap.has('products|never-commit')
     };
   }finally{sb.from=originalFrom;currentUser=oldUser;}
 });
 expect(observed).toEqual({selectedTenant:'org-fixture',preserved:true,noLeakedDummy:true,noStaleSnapshot:true});
});

test('F0 bootstrap timeout reports ACCOUNT_CONTEXT without email, token or private profile',async({page})=>{
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>window.FinoraStartupStatus?.authChecked),{timeout:15000}).toBe(true);
 const output=await page.evaluate(async()=>{
   window.fetchCurrentUser=()=>new Promise(()=>{});
   await enterApp({id:'synthetic-account'}, {timeoutMs:65});
   return document.getElementById('auth-login-status').textContent;
 });
 expect(output).toContain('BOOT_ACCOUNT_CONTEXT');
 expect(output).toContain('بیش از حد');
 expect(output).not.toMatch(/synthetic-account|@|Bearer |password|access_token/i);
});

test('F0 bootstrap timeout reports TENANT_RECORDS when profile has already resolved',async({page})=>{
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>window.FinoraStartupStatus?.authChecked),{timeout:15000}).toBe(true);
 const output=await page.evaluate(async()=>{
   window.fetchCurrentUser=async()=>({id:'synthetic-tenant',role:'accountant',fullName:'Not Public'});
   window.pullAll=()=>new Promise(()=>{});
   await enterApp({id:'synthetic-tenant'}, {timeoutMs:65});
   return document.getElementById('auth-login-status').textContent;
 });
 expect(output).toContain('BOOT_TENANT_RECORDS');
 expect(output).toContain('بیش از حد');
 expect(output).not.toMatch(/synthetic-tenant|Not Public|Bearer |password|access_token/i);
});
