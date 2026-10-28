const {test,expect}=require('@playwright/test');
const BASE=process.env.FINORA_LOGIN_PAGES_BASE||'http://127.0.0.1:4173/_site/index.html';

async function syntheticLogin(page,{restoreSession=false,holdSessionCheck=false}={}){
  // Patch transport before core.js calls createClient; initAuthSystem, the CSP
  // handlers, organization hydration and records loading remain the real code.
  await page.addInitScript(({restoreSession,holdSessionCheck})=>{
    const fixture=window.finoraLoginFixture={passwordCalls:0,profileReads:[],recordReads:0,writes:0};
    const sessionCheck=holdSessionCheck?new Promise(resolve=>{window.finoraReleaseSessionCheck=resolve;}):Promise.resolve();
    let sdk;
    Object.defineProperty(window,'supabase',{
      configurable:true,
      get(){return sdk;},
      set(value){
        sdk=value;
        const create=value.createClient;
        value.createClient=function(...args){
          const client=create.apply(this,args);
          client.auth.getSession=async()=>{
            await sessionCheck;
            return {data:{session:restoreSession?{user:{id:'fixture-restored'}}:null},error:null};
          };
          client.auth.signInWithPassword=async()=>{
            fixture.passwordCalls++;
            return {data:{user:{id:'fixture-password'}},error:null};
          };
          client.rpc=async()=>{fixture.writes++;throw new Error('Unexpected fixture write');};
          client.from=table=>{
            const filters={};
            let single=false;
            const query={
              select(){return this;},in(){return this;},order(){return this;},range(){return this;},abortSignal(){return this;},
              eq(key,value){filters[key]=value;return this;},
              single(){single=true;return this;},
              then(resolve){
                const uid=filters.id||filters.user_id||'fixture-password';
                let rows=[];
                if(table==='profiles'){
                  fixture.profileReads.push(uid);
                  rows=[{id:uid,email:'fixture@example.test',full_name:'Synthetic Login',role:'accountant'}];
                }else if(table==='organization_members'){
                  rows=[{id:'fixture-membership',user_id:uid,organization_id:'fixture-org',status:'active',is_owner:true}];
                }else if(table==='organizations'){
                  rows=[{id:'fixture-org',name:'Synthetic Company',status:'active'}];
                }else if(table==='licenses'){
                  rows=[{organization_id:'fixture-org',plan:'lifetime',status:'active',starts_at:'2026-01-01',ends_at:'2099-01-01',modules:['full_suite'],max_companies:5,max_users:5}];
                }else if(table==='records')fixture.recordReads++;
                return Promise.resolve(resolve({data:single?rows[0]:rows,error:null}));
              }
            };
            return query;
          };
          return client;
        };
      }
    });
  },{restoreSession,holdSessionCheck});
  // Defense in depth: a fixture must never send credentials or read a real tenant.
  await page.route('https://*.supabase.co/**',route=>route.abort('blockedbyclient'));
  await page.route('https://cdn.jsdelivr.net/**',route=>route.abort('blockedbyclient'));
  await page.route('https://cdnjs.cloudflare.com/**',route=>route.abort('blockedbyclient'));
  page.on('dialog',dialog=>dialog.dismiss());
}

async function holdBundle(page,name){
  let release,arrived;
  const held=new Promise(resolve=>{release=resolve;});
  const requested=new Promise(resolve=>{arrived=resolve;});
  await page.route('**/js/finora-pages-'+name+'.js*',async route=>{
    arrived();
    await held;
    await route.continue();
  });
  return {release,requested};
}

async function submitPassword(page){
  await page.locator('#auth-email').fill('fixture@example.test');
  await page.locator('#auth-password').fill('synthetic-password-only');
  await page.locator('#auth-login-button').click({noWaitAfter:true});
}

test('Pages login does not wait for a separate recovery script download',async({page})=>{
  await syntheticLogin(page);
  let release;
  const held=new Promise(resolve=>{release=resolve;});
  const recoveryRequests=[];
  await page.route('**/js/password-recovery.js*',async route=>{
    recoveryRequests.push(route.request().url());
    await held;
    await route.continue().catch(()=>{});
  });
  try{
    await page.goto(BASE,{waitUntil:'commit'});
    await expect(page.locator('#auth-login-button')).toBeEnabled({timeout:2500});
    expect(await page.evaluate(()=>({
      bound:window.FinoraLoginActionsBound,
      ready:window.FinoraStartupStatus?.authFormReady,
      recovery:typeof window.finoraRequestPasswordRecovery,
      active:window.FinoraPasswordRecovery?.active
    }))).toEqual({bound:true,ready:true,recovery:'function',active:false});
    await submitPassword(page);
    await expect(page.locator('#auth-screen')).toBeHidden({timeout:15000});
    expect(await page.evaluate(()=>({user:currentUser?.id,...window.finoraLoginFixture})))
      .toEqual({user:'fixture-password',passwordCalls:1,profileReads:['fixture-password'],recordReads:1,writes:0});
    expect(recoveryRequests).toEqual([]);
  }finally{release();}
});

test('Pages preload and execute one core URL versioned from its complete auth content',async({page,request})=>{
  await syntheticLogin(page);
  const coreRequests=[];
  page.on('request',req=>{if(new URL(req.url()).pathname.endsWith('/core.js'))coreRequests.push(req.url());});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  const urls=await page.evaluate(()=>({
    preload:document.querySelector('link[rel="preload"][href*="/core.js"]')?.href,
    script:document.querySelector('script[src*="/core.js"]')?.src
  }));
  expect(urls.preload).toBe(urls.script);
  const response=await request.get(urls.script);
  expect(response.ok()).toBe(true);
  const hash=require('node:crypto').createHash('sha256').update(await response.body()).digest('hex').slice(0,16);
  expect(new URL(urls.script).searchParams.get('v')).toBe(hash);
  expect(coreRequests).toEqual([urls.script]);
});

for(const bundle of ['business','accounting']){
  test('early successful Pages login survives a slow '+bundle+' bundle before company-read timeout starts',async({page})=>{
    await syntheticLogin(page);
    await page.clock.install();
    const asset=await holdBundle(page,bundle);
    await page.goto(BASE,{waitUntil:'commit'});
    await asset.requested;
    await expect(page.locator('#auth-login-button')).toBeEnabled();
    expect(await page.evaluate(()=>document.readyState)).toBe('loading');
    await submitPassword(page);
    await expect(page.locator('#auth-login-status')).toHaveAttribute('data-state','loading');
    // The credentials have already succeeded. A slow local ERP download must
    // not consume the separate 25-second account/data-read deadline.
    await page.clock.fastForward(26000);
    expect(await page.evaluate(()=>({
      status:document.getElementById('auth-login-status').dataset.state,
      profileReads:window.finoraLoginFixture.profileReads,
      user:currentUser
    }))).toEqual({status:'loading',profileReads:[],user:null});
    await expect(page.locator('#auth-screen')).toBeVisible();
    asset.release();
    await expect(page.locator('#auth-screen')).toBeHidden({timeout:15000});
    expect(await page.evaluate(()=>({
      user:currentUser?.id,
      organization:currentUser?.organizationId,
      license:currentUser?.subscription?.type,
      ...window.finoraLoginFixture
    }))).toEqual({user:'fixture-password',organization:'fixture-org',license:'lifetime',passwordCalls:1,profileReads:['fixture-password'],recordReads:1,writes:0});
  });
}

test('stalled Pages assets expire visibly without late entry and a fresh click recovers after download',async({page})=>{
  await syntheticLogin(page);
  await page.clock.install();
  const asset=await holdBundle(page,'accounting');
  await page.goto(BASE,{waitUntil:'commit'});
  await asset.requested;
  await expect(page.locator('#auth-login-button')).toBeEnabled();
  await submitPassword(page);
  await page.clock.fastForward(46000);
  await expect(page.locator('#auth-login-status')).toHaveAttribute('data-state','error');
  await expect(page.locator('#auth-login-status')).toContainText('BOOT_APP_ASSETS');
  expect(await page.evaluate(()=>({user:currentUser,profileReads:window.finoraLoginFixture.profileReads})))
    .toEqual({user:null,profileReads:[]});
  asset.release();
  await expect.poll(()=>page.evaluate(()=>window.FinoraStartupStatus?.extensionsReady),{timeout:15000}).toBe(true);
  await expect(page.locator('#auth-screen')).toBeVisible();
  await expect(page.locator('#auth-login-status')).toHaveAttribute('data-state','error');
  expect(await page.evaluate(()=>window.finoraLoginFixture.profileReads)).toEqual([]);
  await submitPassword(page);
  await expect(page.locator('#auth-screen')).toBeHidden({timeout:15000});
  expect(await page.evaluate(()=>({user:currentUser?.id,...window.finoraLoginFixture})))
    .toEqual({user:'fixture-password',passwordCalls:2,profileReads:['fixture-password'],recordReads:1,writes:0});
});

test('cached-session restoration owns the login attempt while early password clicks are ignored',async({page})=>{
  await syntheticLogin(page,{restoreSession:true});
  const asset=await holdBundle(page,'accounting');
  await page.goto(BASE,{waitUntil:'commit'});
  await asset.requested;
  await expect(page.locator('#auth-login-button')).toBeEnabled();
  await expect(page.locator('#auth-login-status')).toHaveAttribute('data-state','loading');
  await submitPassword(page);
  expect(await page.evaluate(()=>window.finoraLoginFixture.passwordCalls)).toBe(0);
  await expect(page.locator('#auth-login-status')).toHaveAttribute('data-state','busy');
  asset.release();
  await expect(page.locator('#auth-screen')).toBeHidden({timeout:15000});
  expect(await page.evaluate(()=>({user:currentUser?.id,...window.finoraLoginFixture})))
    .toEqual({user:'fixture-restored',passwordCalls:0,profileReads:['fixture-restored'],recordReads:1,writes:0});
});

test('early password click waits for the pending initial session check then continues once without another click',async({page})=>{
  await syntheticLogin(page,{restoreSession:true,holdSessionCheck:true});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#auth-login-button')).toBeEnabled();
  await submitPassword(page);
  expect(await page.evaluate(()=>window.finoraLoginFixture.passwordCalls)).toBe(0);
  await expect(page.locator('#auth-login-status')).toHaveAttribute('data-state','loading');
  expect(await page.evaluate(()=>({user:currentUser,profileReads:window.finoraLoginFixture.profileReads})))
    .toEqual({user:null,profileReads:[]});
  await page.evaluate(()=>window.finoraReleaseSessionCheck());
  await expect(page.locator('#auth-screen')).toBeHidden({timeout:15000});
  expect(await page.evaluate(()=>({user:currentUser?.id,...window.finoraLoginFixture})))
    .toEqual({user:'fixture-password',passwordCalls:1,profileReads:['fixture-password'],recordReads:1,writes:0});
});

test('Pages downloads its pinned extension bundle before slow accounting finishes and executes it once',async({page})=>{
  await syntheticLogin(page);
  const requested=[];
  page.on('request',request=>{
    if(new URL(request.url()).pathname.endsWith('/finora-extension-bundle.js'))requested.push(request.url());
  });
  await page.route('**/js/finora-extension-bundle.js*',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:await response.text()+'\n;window.finoraFixtureBundleExecutions=(window.finoraFixtureBundleExecutions||0)+1;'});
  });
  const asset=await holdBundle(page,'accounting');
  await page.goto(BASE,{waitUntil:'commit'});
  await asset.requested;
  await expect(page.locator('#auth-login-button')).toBeEnabled();
  expect(await page.evaluate(()=>document.readyState)).toBe('loading');
  await expect.poll(()=>requested.length,{timeout:1500}).toBe(1);
  expect(requested[0]).toMatch(/finora-extension-bundle\.js\?v=[0-9a-f]{16}$/);
  expect(await page.evaluate(()=>window.finoraFixtureBundleExecutions||0)).toBe(0);
  asset.release();
  await expect.poll(()=>page.evaluate(()=>window.FinoraStartupStatus?.extensionsReady),{timeout:15000}).toBe(true);
  expect(await page.evaluate(()=>({
    executions:window.finoraFixtureBundleExecutions,
    failures:window.FinoraStartupStatus.failedExtensionCount,
    scripts:document.querySelectorAll('script[src*="finora-extension-bundle.js"]').length
  }))).toEqual({executions:1,failures:0,scripts:1});
  expect(requested).toHaveLength(1);
});

test('early successful credentials cannot open the workspace when a required Pages bundle fails',async({page})=>{
  await syntheticLogin(page);
  let release;
  const held=new Promise(resolve=>{release=resolve;});
  await page.route('**/js/finora-pages-accounting.js*',async route=>{await held;await route.abort('failed');});
  await page.goto(BASE,{waitUntil:'commit'});
  await expect(page.locator('#auth-login-button')).toBeEnabled();
  await submitPassword(page);
  release();
  await expect(page.locator('#auth-login-status')).toContainText('BOOT_APP_ASSETS_FAILED',{timeout:15000});
  await expect(page.locator('#auth-screen')).toBeVisible();
  expect(await page.evaluate(()=>({user:currentUser,writes:window.finoraLoginFixture.writes}))).toEqual({user:null,writes:0});
});
