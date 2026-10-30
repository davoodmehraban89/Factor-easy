const { test, expect } = require('@playwright/test');
const base=process.env.FINORA_TEST_BASE||'http://127.0.0.1:4173/index.html';
const healthRoot=/\/auth\/v1\/health(?:\?.*)?$/;
const restRoot=/\/rest\/v1\/(?:\?.*)?$/;
test.beforeEach(async({page})=>{
  await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
  // Gateway response confirms transport only; no private data or user token.
  await page.route(restRoot,route=>route.fulfill({
    status:200,
    contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},
    body:'{}'
  }));
});
test('Login diagnostics distinguish a reachable auth service from password errors', async ({page})=>{
  await page.route(healthRoot, route=>route.fulfill({
    status:200, contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},
    body:JSON.stringify({name:'GoTrue'})
  }));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#auth-connectivity-check').click();
  await expect(page.locator('#auth-connectivity-result')).toHaveAttribute('data-status','ok',{timeout:15000});
  await expect(page.locator('#auth-connectivity-result')).toContainText('AUTH_OK');
  await expect(page.locator('#auth-email')).toBeVisible();
  await expect(page.locator('#auth-password')).toBeVisible();
});
test('Login diagnostics label upstream unreachable without exposing credentials', async ({page})=>{
  await page.route(healthRoot, route=>route.abort('failed'));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#auth-connectivity-check').click();
  await expect(page.locator('#auth-connectivity-result')).toHaveAttribute('data-status','auth-unreachable',{timeout:15000});
  await expect(page.locator('#auth-connectivity-result')).toContainText('AUTH_UNREACHABLE');
  expect(await page.locator('#auth-connectivity-result').textContent()).not.toContain('password');
});
test('Login diagnostics label HTTP server failures, not bad passwords', async ({page})=>{
  await page.route(healthRoot, route=>route.fulfill({status:503,headers:{'access-control-allow-origin':'*'},body:'unavailable'}));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#auth-connectivity-check').click();
  await expect(page.locator('#auth-connectivity-result')).toHaveAttribute('data-status','auth-http',{timeout:15000});
  await expect(page.locator('#auth-connectivity-result')).toContainText('AUTH_HTTP_503');
});

test('A failing manifest cannot falsely classify working login JS and Auth as SITE_UNREACHABLE',async({page})=>{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.route('**/manifest.json*',route=>route.fulfill({status:404,body:'missing'}));
  await page.route(healthRoot,route=>route.fulfill({
    status:200,contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},
    body:'{"name":"GoTrue"}'
  }));
  await page.locator('#auth-connectivity-check').click();
  const output=page.locator('#auth-connectivity-result');
  await expect(output).toHaveAttribute('data-status','site-warning',{timeout:15000});
  await expect(output).toContainText('SITE_JS_OK');
  await expect(output).toContainText('MANIFEST_HTTP_404');
  await expect(output).toContainText('AUTH_OK');
  await expect(output).not.toContainText('SITE_UNREACHABLE');
});

test('Critical JS read fails but manifest and Auth are healthy: report failed asset precisely',async({page})=>{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.route('**/js/login-connectivity.js*',route=>route.abort('failed'));
  await page.route(healthRoot,route=>route.fulfill({
    status:200,contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},
    body:'{"name":"GoTrue"}'
  }));
  await page.locator('#auth-connectivity-check').click();
  const output=page.locator('#auth-connectivity-result');
  await expect(output).toHaveAttribute('data-status','site-error',{timeout:15000});
  await expect(output).toContainText('SITE_JS_NETWORK_ERROR');
  await expect(output).toContainText('MANIFEST_OK');
  await expect(output).toContainText('AUTH_OK');
});

test('Both site resources and Auth unreachable: report independent failures without exposing user data',async({page})=>{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.route('**/js/login-connectivity.js*',route=>route.abort('failed'));
  await page.route('**/manifest.json*',route=>route.abort('failed'));
  await page.route(healthRoot,route=>route.abort('failed'));
  await page.locator('#auth-connectivity-check').click();
  const output=page.locator('#auth-connectivity-result');
  await expect(output).toHaveAttribute('data-status','site-error',{timeout:15000});
  await expect(output).toContainText('SITE_JS_NETWORK_ERROR');
  await expect(output).toContainText('MANIFEST_NETWORK_ERROR');
  await expect(output).toContainText('AUTH_UNREACHABLE');
  expect(await output.textContent()).not.toMatch(/Bearer |password|access_token|apiKey/i);
});

test('Preflight comparison keeps standard Auth and REST failures when simple health responds',async({page})=>{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.clock.install();
  await page.evaluate(()=>{
    window.finoraTestProbeRequests=[];
    window.fetch=(input,init={})=>{
      const url=new URL(String(input));
      window.finoraTestProbeRequests.push({
        path:url.pathname,
        diagnosticId:url.searchParams.get('finora_diag'),
        simple:url.searchParams.has('apikey'),
        publicKeyMatches:url.searchParams.get('apikey')===SUPABASE_KEY,
        headerNames:[...new Headers(init.headers).keys()],
        credentials:init.credentials,
        method:init.method||'GET'
      });
      if(url.hostname.endsWith('.supabase.co')){
        if(url.searchParams.has('apikey'))return Promise.resolve(new Response('{"name":"GoTrue"}',{status:200}));
        return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));
      }
      return Promise.resolve(new Response('{}',{status:200}));
    };
  });
  await page.locator('#auth-connectivity-check').click();
  await page.clock.fastForward(12001);
  const output=page.locator('#auth-connectivity-result');
  await expect(output).toHaveAttribute('data-status','auth-unreachable');
  await expect(output).toContainText('AUTH_TIMEOUT');
  await expect(output).toContainText('REST_TIMEOUT');
  await expect(output).toContainText('SIMPLE_HTTP_200');
  await expect(output).toContainText('ساده');
  await expect(output).not.toContainText(/(?:^|[ |(])AUTH_OK(?:[ |)]|$)/);
  await expect(page.locator('#auth-connectivity-check')).toBeEnabled();
  const {report,requests}=await page.evaluate(()=>({report:window.FinoraLoginConnectivityReport,requests:window.finoraTestProbeRequests}));
  expect(report).toBeTruthy();
  expect(report.probes.AUTH.code).toBe('AUTH_TIMEOUT');
  expect(report.probes.REST.code).toBe('REST_TIMEOUT');
  expect(report.probes.SIMPLE.code).toBe('SIMPLE_HTTP_200');
  expect(report.durationMs).toBeGreaterThanOrEqual(12000);
  expect(report.durationMs).toBeLessThanOrEqual(12050);
  expect(requests).toHaveLength(5);
  expect(requests.every(request=>request.diagnosticId===report.id&&request.method==='GET')).toBe(true);
  const simple=requests.filter(request=>request.simple);
  expect(simple).toHaveLength(1);
  expect(simple[0]).toMatchObject({path:'/auth/v1/health',publicKeyMatches:true,headerNames:[],credentials:'omit'});
});

test('Preflight comparison supplemental failure cannot override healthy ordinary endpoints',async({page})=>{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{
    window.fetch=async(input)=>{
      const url=new URL(String(input));
      if(url.searchParams.has('apikey'))throw new TypeError('Failed to fetch');
      return new Response('{}',{status:url.pathname==='/rest/v1/'?401:200});
    };
  });
  await page.locator('#auth-connectivity-check').click();
  const output=page.locator('#auth-connectivity-result');
  await expect(output).toHaveAttribute('data-status','ok');
  await expect(output).toContainText('AUTH_OK');
  await expect(output).toContainText('REST_HTTP_401');
  await expect(output).toContainText('SIMPLE_UNREACHABLE');
  const report=await page.evaluate(()=>window.FinoraLoginConnectivityReport);
  expect(report).toBeTruthy();
  expect(report.probes.SIMPLE.code).toBe('SIMPLE_UNREACHABLE');
});

test('Preflight comparison report excludes credentials query values bodies and raw errors',async({page})=>{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#auth-email').fill('diagnostic-private@example.test');
  await page.locator('#auth-password').fill('password-private-sentinel');
  await page.evaluate(()=>{
    history.replaceState({},'',location.pathname+'?access_token=location-private-sentinel');
    window.fetch=async(input)=>{
      if(new URL(String(input)).pathname==='/rest/v1/')throw new TypeError('raw-private-sentinel diagnostic-private@example.test password-private-sentinel');
      return new Response('{"access_token":"body-private-sentinel"}',{status:200});
    };
  });
  await page.locator('#auth-connectivity-check').click();
  await expect(page.locator('#auth-connectivity-result')).toHaveAttribute('data-status','rest-unreachable');
  const report=await page.evaluate(()=>window.FinoraLoginConnectivityReport);
  expect(report).toBeTruthy();
  expect(Object.keys(report).sort()).toEqual(['checkedAt','durationMs','id','origin','probes','version']);
  expect(report.version).toBe('20261026-preflight-compare-v5');
  expect(report.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  expect(report.id).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
  expect(report.origin).toBe(new URL(base).origin);
  expect(Object.keys(report.probes).sort()).toEqual(['AUTH','MANIFEST','REST','SIMPLE','SITE_JS']);
  for(const probe of Object.values(report.probes)){
    expect(Object.keys(probe).sort()).toEqual(['code','durationMs']);
    expect(probe.durationMs).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(probe.durationMs)).toBe(true);
  }
  expect(JSON.stringify(report)).not.toMatch(/diagnostic-private|password-private|location-private|body-private|raw-private|sb_publishable_|apikey|access_token|Bearer|headers/i);
  expect(await page.locator('#auth-connectivity-result').textContent()).not.toMatch(/diagnostic-private|password-private|location-private|body-private|raw-private|sb_publishable_/i);
});

test('Preflight comparison clears an earlier report before an offline attempt',async({page})=>{
  await page.route(healthRoot,route=>route.fulfill({status:200,body:'{}'}));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#auth-connectivity-check').click();
  await expect(page.locator('#auth-connectivity-result')).toHaveAttribute('data-status','ok');
  expect(await page.evaluate(()=>window.FinoraLoginConnectivityReport)).toBeTruthy();
  await page.evaluate(()=>{
    Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});
    window.finoraTestOfflineRequests=0;
    window.fetch=()=>{window.finoraTestOfflineRequests++;return Promise.reject(new TypeError('Must not fetch offline'));};
  });
  await page.locator('#auth-connectivity-check').click();
  await expect(page.locator('#auth-connectivity-result')).toHaveAttribute('data-status','offline');
  expect(await page.evaluate(()=>window.FinoraLoginConnectivityReport)).toBeNull();
  expect(await page.evaluate(()=>window.finoraTestOfflineRequests)).toBe(0);
});

test('Preflight comparison never puts a non-publishable key into a query',async()=>{
  const fs=require('node:fs'),vm=require('node:vm');
  const out={textContent:'',dataset:{}},button={disabled:false},requests=[];
  const crypto=require('node:crypto');
  const window={location:{origin:'https://diagnostic.example.test'},crypto};
  const context=vm.createContext({
    window,crypto,
    document:{baseURI:'https://diagnostic.example.test/index.html',getElementById:id=>id==='auth-connectivity-result'?out:button},
    navigator:{onLine:true},
    SUPABASE_URL:'https://diagnostic-supabase.example.test',SUPABASE_KEY:'sb_secret_private_fixture',
    URL,Headers,AbortController,performance,setTimeout,clearTimeout,
    fetch:async(input)=>{requests.push(String(input));return new Response('{}',{status:200});}
  });
  await vm.runInContext(fs.readFileSync(require('node:path').resolve('js/login-connectivity.js'),'utf8')+'\ncheckAuthConnectivity();',context);
  expect(requests.some(url=>new URL(url).searchParams.has('apikey'))).toBe(false);
  expect(context.window.FinoraLoginConnectivityReport?.probes?.SIMPLE?.code).toBe('SIMPLE_SKIPPED');
  expect(JSON.stringify(context.window.FinoraLoginConnectivityReport)).not.toContain('sb_secret_private_fixture');
  expect(out.dataset.status).toBe('ok');
});

test('Auth and static files can work while Supabase PostgREST data endpoint is unreachable',async({page})=>{
  await page.route(restRoot,route=>route.abort('failed'));
  await page.route(healthRoot,route=>route.fulfill({
    status:200,contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},body:'{"name":"GoTrue"}'
  }));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#auth-connectivity-check').click();
  const output=page.locator('#auth-connectivity-result');
  await expect(output).toHaveAttribute('data-status','rest-unreachable',{timeout:15000});
  await expect(output).toContainText('SITE_JS_OK');
  await expect(output).toContainText('AUTH_OK');
  await expect(output).toContainText('REST_UNREACHABLE');
});
test('A 503 data gateway response remains distinct from good Auth service',async({page})=>{
  await page.route(restRoot,route=>route.fulfill({
    status:503,contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},body:'{}'
  }));
  await page.route(healthRoot,route=>route.fulfill({
    status:200,contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},body:'{"name":"GoTrue"}'
  }));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#auth-connectivity-check').click();
  const output=page.locator('#auth-connectivity-result');
  await expect(output).toHaveAttribute('data-status','rest-unreachable',{timeout:15000});
  await expect(output).toContainText('AUTH_OK');
  await expect(output).toContainText('REST_HTTP_503');
});

for(const scenario of [
  {failed:'/auth/v1/health',stalled:'/rest/v1/',expected:'AUTH_UNREACHABLE',timeout:'REST_TIMEOUT'},
  {failed:'/js/login-connectivity.js',stalled:'/auth/v1/health',expected:'SITE_JS_NETWORK_ERROR',timeout:'AUTH_TIMEOUT'}
])test('An immediate '+scenario.expected+' remains distinct when another probe times out',async({page})=>{
  await page.route('https://cdn.jsdelivr.net/**',route=>route.abort());
  await page.route(healthRoot,route=>route.fulfill({status:200,body:'{}'}));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.clock.install();
  await page.evaluate(({failed,stalled})=>{
    window.fetch=(input,init={})=>{
      const url=String(input);
      if(url.includes(failed))return Promise.reject(new TypeError('Failed to fetch'));
      if(url.includes(stalled))return new Promise((resolve,reject)=>{
        init.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true});
      });
      return Promise.resolve(new Response('{}',{status:200}));
    };
  },scenario);
  await page.locator('#auth-connectivity-check').click();
  await page.clock.fastForward(12001);
  const output=page.locator('#auth-connectivity-result');
  await expect(output).toContainText(scenario.expected);
  await expect(output).toContainText(scenario.timeout);
  await expect(page.locator('#auth-connectivity-check')).toBeEnabled();
  expect(await output.textContent()).not.toMatch(/Bearer |password|access_token|apiKey/i);
});
