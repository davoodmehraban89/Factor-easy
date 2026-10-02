const {test,expect}=require('@playwright/test');
test('Finora login renders premium ERP branding and real icon assets',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
 await expect(page).toHaveTitle('نرم‌افزار ERP سازمانی فینورا');
 await expect(page.locator('#auth-screen .auth-shell')).toBeVisible();
 await expect(page.locator('.auth-visual')).toBeVisible();
 await expect(page.locator('.auth-brand h1')).toHaveText('نرم‌افزار ERP سازمانی فینورا');
 await expect(page.locator('#auth-email')).toBeVisible();await expect(page.locator('#auth-password')).toBeVisible();
 const logo=page.locator('.auth-brand-logo');await expect(logo).toBeVisible();expect(await logo.evaluate(el=>el.naturalWidth)).toBeGreaterThan(0);
 const href=await page.locator('link[rel="icon"]').getAttribute('href');expect(href).toContain('finora-favicon-32.png');
});
test('Finora login remains focused and usable on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.auth-visual')).toBeHidden();await expect(page.locator('.auth-card')).toBeVisible();await expect(page.locator('#auth-email')).toBeVisible();
});
