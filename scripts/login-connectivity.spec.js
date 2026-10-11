const { test, expect } = require('@playwright/test');
const base=process.env.FINORA_TEST_BASE||'http://127.0.0.1:4173/index.html';
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
