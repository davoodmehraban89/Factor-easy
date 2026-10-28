const {test,expect}=require('@playwright/test');
const BASE=process.env.FINORA_BRANDING_BASE||'http://127.0.0.1:4173/index.html';
test.beforeEach(async({page})=>{
 await page.route('https://*.supabase.co/**',r=>r.abort());
 await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());
 await page.route('https://cdnjs.cloudflare.com/**',r=>r.abort());
});
test('Finora login renders premium ERP branding and real icon assets',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page).toHaveTitle('نرم‌افزار ERP سازمانی فینورا');
 await expect(page.locator('#auth-screen .auth-shell')).toBeVisible();
 await expect(page.locator('.auth-visual')).toBeVisible();
 await expect(page.locator('.auth-brand h1')).toHaveText('نرم‌افزار ERP سازمانی فینورا');
 await expect(page.locator('#auth-email')).toBeVisible();await expect(page.locator('#auth-password')).toBeVisible();
 const logo=page.locator('.auth-brand-logo');await expect(logo).toBeVisible();expect(await logo.evaluate(el=>el.naturalWidth)).toBeGreaterThan(0);
 const href=await page.locator('link[rel="icon"]').getAttribute('href');expect(href).toContain('finora-favicon-32.png');
});
test('Finora login remains focused and usable on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('.auth-visual')).toBeHidden();await expect(page.locator('.auth-card')).toBeVisible();await expect(page.locator('#auth-email')).toBeVisible();
});
for(const viewport of [{width:1366,height:650},{width:1024,height:600},{width:920,height:600}]){
 test('complete login fits short desktop '+viewport.width+'x'+viewport.height,async({page})=>{
  await page.setViewportSize(viewport);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#auth-login-button')).toBeEnabled();
  for(const selector of ['.auth-brand','.auth-google','#auth-email','#auth-password','.auth-actions','#auth-forgot-password','#auth-connectivity-check','.auth-signup','.auth-note']){
   const box=await page.locator('#auth-screen '+selector).first().boundingBox();
   expect(box,selector).toBeTruthy();
   expect(box.y,selector+' top').toBeGreaterThanOrEqual(0);
   expect(box.y+box.height,selector+' bottom').toBeLessThanOrEqual(viewport.height);
   expect(box.x,selector+' left').toBeGreaterThanOrEqual(0);
   expect(box.x+box.width,selector+' right').toBeLessThanOrEqual(viewport.width);
  }
  const login=await page.locator('#auth-form-container .auth-actions').boundingBox();
  const forgot=await page.locator('#auth-forgot-password').boundingBox();
  expect(forgot.y).toBeGreaterThanOrEqual(login.y+login.height);
 });
}
for(const viewport of [{width:1024,height:450},{width:680,height:400},{width:390,height:568}]){
 test('overflow login remains reachable from top to bottom '+viewport.width+'x'+viewport.height,async({page})=>{
  await page.setViewportSize(viewport);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#auth-login-button')).toBeEnabled();
  // A real diagnostic can grow after initial layout; neither end may be lost.
  await page.locator('#auth-connectivity-result').evaluate(el=>el.textContent=('پاسخ سرور طولانی شده است. ').repeat(20));
  await page.locator('#auth-screen').evaluate(el=>{el.scrollTop=0;});
  expect((await page.locator('.auth-brand').boundingBox()).y).toBeGreaterThanOrEqual(0);
  await page.locator('#auth-screen').evaluate(el=>{el.scrollTop=el.scrollHeight;});
  const note=await page.locator('.auth-note').boundingBox();
  expect(note.y).toBeGreaterThanOrEqual(0);
  expect(note.y+note.height).toBeLessThanOrEqual(viewport.height);
  expect(await page.locator('#auth-screen').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.locator('#auth-email').focus();
  await expect(page.locator('#auth-email')).toBeInViewport();
 });
}
