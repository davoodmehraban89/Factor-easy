const { test, expect } = require('@playwright/test');
const base=process.env.FINORA_TEST_BASE||'http://127.0.0.1:4173/index.html';
test.beforeEach(async({page})=>{
  // Gateway response confirms transport only; no private data or user token.
  await page.route('**/rest/v1/',route=>route.fulfill({
    status:200,
    contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},
    body:'{}'
  }));
});
test('Login diagnostics distinguish a reachable auth service from password errors', async ({page})=>{
  await page.route('**/auth/v1/health', route=>route.fulfill({
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
  await page.route('**/auth/v1/health', route=>route.abort('failed'));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#auth-connectivity-check').click();
  await expect(page.locator('#auth-connectivity-result')).toHaveAttribute('data-status','auth-unreachable',{timeout:15000});
  await expect(page.locator('#auth-connectivity-result')).toContainText('AUTH_UNREACHABLE');
  expect(await page.locator('#auth-connectivity-result').textContent()).not.toContain('password');
});
test('Login diagnostics label HTTP server failures, not bad passwords', async ({page})=>{
  await page.route('**/auth/v1/health', route=>route.fulfill({status:503,headers:{'access-control-allow-origin':'*'},body:'unavailable'}));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#auth-connectivity-check').click();
  await expect(page.locator('#auth-connectivity-result')).toHaveAttribute('data-status','auth-http',{timeout:15000});
  await expect(page.locator('#auth-connectivity-result')).toContainText('AUTH_HTTP_503');
});

test('A failing manifest cannot falsely classify working login JS and Auth as SITE_UNREACHABLE',async({page})=>{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.route('**/manifest.json*',route=>route.fulfill({status:404,body:'missing'}));
  await page.route('**/auth/v1/health',route=>route.fulfill({
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
  await page.route('**/auth/v1/health',route=>route.fulfill({
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
  await page.route('**/auth/v1/health',route=>route.abort('failed'));
  await page.locator('#auth-connectivity-check').click();
  const output=page.locator('#auth-connectivity-result');
  await expect(output).toHaveAttribute('data-status','site-error',{timeout:15000});
  await expect(output).toContainText('SITE_JS_NETWORK_ERROR');
  await expect(output).toContainText('MANIFEST_NETWORK_ERROR');
  await expect(output).toContainText('AUTH_UNREACHABLE');
  expect(await output.textContent()).not.toMatch(/Bearer |password|access_token|apiKey/i);
});

test('Auth and static files can work while Supabase PostgREST data endpoint is unreachable',async({page})=>{
  await page.route('**/rest/v1/',route=>route.abort('failed'));
  await page.route('**/auth/v1/health',route=>route.fulfill({
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
  await page.route('**/rest/v1/',route=>route.fulfill({
    status:503,contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},body:'{}'
  }));
  await page.route('**/auth/v1/health',route=>route.fulfill({
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
