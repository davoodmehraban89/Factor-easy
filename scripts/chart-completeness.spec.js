const {test,expect}=require('@playwright/test');
const path=require('node:path');
async function legacyChart(page){
 await page.setContent('<main class="main-surface"></main>');
 await page.addScriptTag({content:`var currentUser={id:'owner'},settings={default_company_id:'C1'},companies=[{id:'C1',name:'نمونه'}],datastore={accounts:[],dimensionTypes:[],accountDimensionRules:[]};function getMySettings(){return settings}function getMyCompanies(){return companies}function requireWrite(){return true}function saveDatastore(){}function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}`});
 await page.addScriptTag({path:path.resolve('js/accounting-foundation.js')});
 await page.addScriptTag({path:path.resolve('js/accounting-foundation-ui.js')});
 await page.evaluate(()=>{afApplyTemplate('C1','trading');datastore.accounts=datastore.accounts.filter(a=>!AF_CHART_ADDITIONS.some(r=>r[0]===a.code));companies[0].accountingTemplate.chartVersion=3;ensureAccountingFoundationView();window.beforeChart=JSON.stringify(datastore.accounts)});
}
test('chart upgrade previews every addition and changes accounts only on explicit apply',async({page})=>{
 await legacyChart(page);await page.getByRole('button',{name:'پیش‌نمایش تکمیل کدینگ'}).click();
 await expect(page.locator('#af-chart-upgrade-preview')).toContainText('دارایی‌های غیرجاری');
 await expect(page.locator('#af-chart-upgrade-preview')).toContainText('استهلاک انباشته');
 expect(await page.evaluate(()=>JSON.stringify(datastore.accounts)===beforeChart)).toBe(true);
 await page.getByRole('button',{name:'افزودن حساب‌های پیش‌نمایش'}).click();
 await expect(page.locator('#af-chart-upgrade-preview')).toContainText('سوابق قبلی حفظ شدند');
 expect(await page.evaluate(()=>datastore.accounts.some(a=>a.code==='1201'))).toBe(true);
 const after=await page.evaluate(()=>JSON.stringify(datastore.accounts));await page.getByRole('button',{name:'پیش‌نمایش تکمیل کدینگ'}).click();
 await expect(page.locator('#af-chart-upgrade-preview')).toContainText('کامل است');
 expect(await page.evaluate(()=>JSON.stringify(datastore.accounts))).toBe(after);
});
test('conflicting custom account blocks all chart additions and escapes its title',async({page})=>{
 await legacyChart(page);await page.evaluate(()=>{datastore.accounts.push({id:'custom',ownerUserId:'owner',companyId:'C1',code:'1201',title:'<img src=x onerror=alert(1)>',level:'detail'});beforeChart=JSON.stringify(datastore.accounts)});
 await page.getByRole('button',{name:'پیش‌نمایش تکمیل کدینگ'}).click();await expect(page.locator('#af-chart-upgrade-preview')).toContainText('تعارض');
 await expect(page.getByRole('button',{name:'افزودن حساب‌های پیش‌نمایش'})).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.stringify(datastore.accounts)===beforeChart)).toBe(true);
});
test('switching active company after preview blocks application',async({page})=>{
 await legacyChart(page);await page.getByRole('button',{name:'پیش‌نمایش تکمیل کدینگ'}).click();
 await page.evaluate(()=>{settings.default_company_id='C2';companies.push({id:'C2'})});await page.getByRole('button',{name:'افزودن حساب‌های پیش‌نمایش'}).click();
 expect(await page.evaluate(()=>JSON.stringify(datastore.accounts)===beforeChart)).toBe(true);await expect(page.getByRole('button',{name:'افزودن حساب‌های پیش‌نمایش'})).toHaveCount(0);
});
