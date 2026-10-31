const {test,expect}=require('@playwright/test');
test.setTimeout(15000);
const BASE=process.env.FINORA_TEST_BASE_URL||'http://127.0.0.1:4173/index.html';
async function fixture(page){
 await page.route(/https:\/\/[^/]*supabase\.co\//,r=>r.abort());
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.FinoraStartupStatus?.extensionsReady&&window.FinoraStartupStatus?.authChecked);
 await page.evaluate(()=>{
  currentUser={id:'QA_OWNER',role:'user',isOrganizationOwner:true,organizationId:'QA_ORG',organizationName:'سازمان آزمایشی',organizations:[],modules:['full_suite'],commercialModules:['full_suite'],modulePermissions:[],maxUsers:5,maxCompanies:3,subscription:{type:'lifetime',status:'active',endDate:'2099-01-01'}};
  COLLS.forEach(k=>datastore[k]=[]);saveDatastore=()=>{};
  sb.from=table=>({select(){return this},eq(){return this},in(){return this},order(){return this},then(resolve,reject){return Promise.resolve({data:table==='organization_members'?[{id:'QA_MEMBER',user_id:'QA_OWNER',status:'active',is_owner:true}]:[],error:null}).then(resolve,reject)}});
  sb.rpc=async(name)=>({data:name==='organization_capacity_summary'?{active_users:1,max_users:5,company_count:1,max_companies:3,modules:['full_suite'],status:'active'}:[],error:null});
  document.querySelector('#auth-screen').style.display='none';document.body.classList.remove('shell-panel-collapsed');refreshAllSurfaces();
 });
}
test('Settings exposes existing organization members, invitations and capacities',async({page})=>{
 await fixture(page);await page.locator('#module-rail [data-module="settings"]').click();
 await page.locator('#module-panel-links [data-task="organization-access"]').click();
 const modal=page.locator('#finora-org-access-modal.active');
 await expect(modal).toBeVisible();await expect(modal.locator('#org-invitation-card')).toContainText('دعوت کاربر جدید');
 await expect(modal.locator('#enterprise-org-dashboard')).toContainText('شرکت‌های حقوقی');
 await expect(modal.locator('#org-seat-summary')).toContainText('۵');
 await modal.getByRole('button',{name:'بستن',exact:true}).click();await expect(modal).toHaveCount(0);
});
test('Settings module chooser reaches organization and requests through real clicks',async({page})=>{
 await fixture(page);
 for(const [label,view] of [['منابع انسانی و حقوق','view-enterprise'],['درخواست‌ها و فرایندها','view-requests']]){
  await page.locator('#module-rail [data-module="settings"]').click();
  await page.locator('#module-panel-links [data-task="module-launcher"]').click();
  await page.locator('#finora-launcher-grid').getByRole('button',{name:new RegExp(label)}).click();
  await expect(page.locator('#'+view)).toHaveClass(/active/);
 }
});
test('permission refresh removes organization management entry and stale footer access',async({page})=>{
 await fixture(page);await page.locator('#module-rail [data-module="settings"]').click();
 await expect(page.locator('#finora-org-access-btn')).toBeVisible();
 await page.evaluate(()=>{currentUser.isOrganizationOwner=false;currentUser.modules=['accounting'];currentUser.commercialModules=['accounting'];refreshAllSurfaces()});
 await page.locator('#module-rail [data-module="settings"]').click();
 await expect(page.locator('#module-panel-links [data-task="organization-access"]')).toHaveCount(0);
 await expect(page.locator('#finora-org-access-btn')).toBeHidden();
 await page.locator('#module-panel-links [data-task="module-launcher"]').click();
 await expect(page.locator('#finora-launcher-grid')).not.toContainText('درخواست‌ها');
 await expect(page.locator('#finora-launcher-grid')).not.toContainText('منابع انسانی');
 await page.evaluate(()=>{window.__deniedQueries=0;sb.from=()=>{window.__deniedQueries++;throw Error('unexpected')};navigateShell('settings','view-settings','organization-access')});
 expect(await page.evaluate(()=>window.__deniedQueries)).toBe(0);
});
test('global admin without organization authority cannot open organization manager',async({page})=>{
 await fixture(page);
 await page.evaluate(()=>{currentUser.role='admin';currentUser.isOrganizationOwner=false;currentUser.organizationId=null;refreshAllSurfaces();window.__queries=0;sb.from=()=>{window.__queries++;throw Error('unexpected query')};window.alert=()=>{}});
 await page.locator('#module-rail [data-module="settings"]').click();
 await expect(page.locator('#module-panel-links [data-view="view-admin"]')).toHaveCount(1);
 await expect(page.locator('#module-panel-links [data-task="organization-access"]')).toHaveCount(0);
 await page.evaluate(()=>showOrganizationAccessManager());
 expect(await page.evaluate(()=>window.__queries)).toBe(0);
});
test('delegated organization configure manager retains invitations while module-only manager does not',async({page})=>{
 await fixture(page);
 await page.evaluate(()=>{currentUser.isOrganizationOwner=false;currentUser.modulePermissions=[{module_key:'core',capabilities:['configure']}];refreshAllSurfaces()});
 await page.locator('#module-rail [data-module="settings"]').click();
 await page.locator('#module-panel-links [data-task="organization-access"]').click();
 await expect(page.locator('#org-invitation-card')).toBeAttached();
 await page.locator('#finora-org-access-modal').getByRole('button',{name:'بستن',exact:true}).click();
 await page.evaluate(()=>{currentUser.modulePermissions=[{module_key:'office_automation',capabilities:['configure']}];refreshAllSurfaces()});
 await page.locator('#module-rail [data-module="settings"]').click();
 await page.locator('#module-panel-links [data-task="organization-access"]').click();
 await expect(page.locator('#finora-org-access-modal.active')).toBeVisible();
 await expect(page.locator('#org-invitation-card')).toHaveCount(0);
 await expect(page.locator('#enterprise-org-dashboard')).toHaveCount(0);
 await expect(page.locator('#org-member-email')).toHaveCount(0);
});
test('accounting and treasury licenses retain their organization workspace without HR access',async({page})=>{
 await fixture(page);
 for(const [module,task] of [['accounting','costing'],['treasury','treasury']]){
  await page.evaluate(module=>{currentUser.modules=[module];currentUser.commercialModules=[module];refreshAllSurfaces()},module);
  await page.locator('#module-rail [data-module="settings"]').click();
  await page.locator('#module-panel-links [data-task="module-launcher"]').click();
  await page.locator('#finora-launcher-grid').getByRole('button',{name:/سازمان/}).click();
  await expect(page.locator('#view-enterprise')).toHaveClass(/active/);
  await expect(page.locator('#module-panel-links .module-link.active')).toHaveAttribute('data-task',task);
  await expect(page.locator('#module-panel-links [data-task="employees"]')).toHaveCount(0);
  await expect(page.locator('#module-panel-links [data-task="group"]')).toHaveCount(0);
 }
});
