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
test('organization access opens a visible loading dialog and reports failed membership reads',async({page})=>{
 await fixture(page);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.evaluate(()=>{
  const base=sb.from;
  sb.from=table=>table!=='organization_members'?base(table):{select(){return this},eq(){return this},then(resolve,reject){return new Promise(done=>{window.__finishMembers=()=>done({data:null,error:{message:'PRIVATE_BACKEND_DETAIL'}})}).then(resolve,reject)}};
 });
 await page.locator('#module-rail [data-module="settings"]').click();
 await page.locator('#module-panel-links [data-task="organization-access"]').click();
 const modal=page.locator('#finora-org-access-modal.active');
 await expect(modal).toBeVisible();
 await expect(modal).toContainText('در حال دریافت');
 await page.evaluate(()=>window.__finishMembers());
 await expect(modal).toContainText('دریافت اطلاعات سازمان انجام نشد');
 await expect(modal).not.toContainText('PRIVATE_BACKEND_DETAIL');
 await expect(modal.getByRole('button',{name:'تلاش دوباره',exact:true})).toBeVisible();
 await modal.getByRole('button',{name:'بستن',exact:true}).click();
 await expect(modal).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('failed organization read can retry and load existing member and invitation controls',async({page})=>{
 await fixture(page);
 await page.evaluate(()=>{const base=sb.from;let fail=true;sb.from=table=>{if(table!=='organization_members'||!fail)return base(table);return {select(){return this},eq(){return this},then(resolve,reject){fail=false;return Promise.resolve({data:null,error:{message:'synthetic-error'}}).then(resolve,reject)}}}});
 await page.locator('#module-rail [data-module="settings"]').click();
 await page.locator('#module-panel-links [data-task="organization-access"]').click();
 await page.getByRole('button',{name:'تلاش دوباره',exact:true}).click();
 await expect(page.locator('#org-member-email')).toBeVisible();
 await expect(page.locator('#org-invitation-card')).toBeAttached();
 await expect(page.locator('#enterprise-org-dashboard')).toBeAttached();
});

test('closing a pending organization read prevents stale response replacing reopened panel',async({page})=>{
 await fixture(page);
 await page.evaluate(()=>{const base=sb.from;let first=true;sb.from=table=>{if(table!=='organization_members'||!first)return base(table);return {select(){return this},eq(){return this},then(resolve,reject){first=false;return new Promise(done=>window.__lateOrg=()=>done({data:null,error:{message:'old failure'}})).then(resolve,reject)}}}});
 await page.locator('#module-rail [data-module="settings"]').click();
 await page.locator('#module-panel-links [data-task="organization-access"]').click();
 await page.locator('#finora-org-access-modal').getByRole('button',{name:'بستن',exact:true}).click();
 await page.locator('#module-panel-links [data-task="organization-access"]').click();
 await expect(page.locator('#org-invitation-card')).toBeAttached();
 await page.evaluate(()=>window.__lateOrg());
 await expect(page.locator('#org-member-email')).toBeVisible();
 await expect(page.locator('#finora-org-access-modal')).not.toContainText('ORG_PANEL_READ_FAILED');
});

test('organization read has a bounded wait and stays closed after late completion',async({page})=>{
 await fixture(page);await page.clock.install();
 await page.evaluate(()=>{sb.from=()=>({select(){return this},eq(){return this},then(resolve,reject){return new Promise(()=>{}).then(resolve,reject)}})});
 await page.locator('#module-rail [data-module="settings"]').click();
 await page.locator('#module-panel-links [data-task="organization-access"]').click();
 await page.clock.runFor(20010);
 await expect(page.locator('#finora-org-access-modal')).toContainText('ORG_PANEL_READ_FAILED');
 await page.locator('#finora-org-access-modal').getByRole('button',{name:'بستن',exact:true}).click();
 await expect(page.locator('#finora-org-access-modal')).not.toHaveClass(/active/);
});

test('invitation read failure remains visible while existing member controls still load',async({page})=>{
 await fixture(page);
 await page.evaluate(()=>{const base=sb.from;sb.from=table=>table!=='organization_invitations'?base(table):{select(){return this},eq(){return this},order(){return this},then(resolve,reject){return Promise.resolve({data:null,error:{message:'private invitation error'}}).then(resolve,reject)}}});
 await page.locator('#module-rail [data-module="settings"]').click();
 await page.locator('#module-panel-links [data-task="organization-access"]').click();
 await expect(page.locator('#org-member-email')).toBeVisible();
 await expect(page.locator('#finora-org-access-modal')).toContainText('دریافت دعوت‌های سازمان انجام نشد');
 await expect(page.locator('#finora-org-access-modal')).not.toContainText('private invitation error');
 await expect(page.locator('#enterprise-org-dashboard')).toBeAttached();
});
