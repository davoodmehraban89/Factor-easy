const {test,expect}=require('@playwright/test');
const {PDFDocument}=require('pdf-lib');

const PHASE_A_RAIL=[
  ['dashboard','داشبورد'],['accounting','حسابداری'],['commerce','بازرگانی'],
  ['treasury','خزانه‌داری'],['inventory','انبار'],['projects','پیمان‌ها'],
  ['reports','گزارش‌ها'],['settings','تنظیمات']
];
async function phaseABrowser(page){
  // This fixture never authenticates against, reads, or writes a real tenant.
  await page.route(/https:\/\/[^/]*supabase\.co\//,route=>route.abort());
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.FinoraStartupStatus?.extensionsReady===true&&
    window.FinoraStartupStatus?.failedExtensionCount===0&&
    window.FinoraStartupStatus?.authChecked===true&&
    typeof window.applyLicensedModuleUI==='function'&&typeof window.purSave==='function',null,{timeout:20000});
  await page.evaluate(()=>{
    const uid='PHASE_A_LOCAL_ONLY';
    currentUser={id:uid,fullName:'آزمون ناوبری',role:'admin',isOrganizationOwner:true,
      organizationId:'QA_ORG',organizationName:'سازمان آزمون',maxCompanies:2,maxUsers:2,
      organizations:[{organization:{id:'QA_ORG',name:'سازمان آزمون'}},{organization:{id:'QA_ORG_2',name:'سازمان دوم'}}],
      modules:['full_suite'],commercialModules:['full_suite'],modulePermissions:[],
      subscription:{type:'lifetime',status:'active',endDate:'2099-01-01'}};
    COLLS.forEach(key=>datastore[key]=[]);
    datastore.companies=[{id:'QA_COMPANY',ownerUserId:uid,name:'شرکت آزمون'}];
    datastore.settings=[{ownerUserId:uid,default_company_id:'QA_COMPANY',ui_theme:'light',currency_mode:'rial'}];
    // Renderers may seed local master defaults. Persistence stays disconnected.
    window.saveDatastore=()=>{};
    document.querySelector('#auth-screen').style.display='none';
    document.body.classList.remove('shell-panel-collapsed');
    document.body.classList.add('is-admin');
    refreshAllSurfaces();applyLicensedModuleUI();
    document.querySelectorAll('.modal-backdrop.active').forEach(el=>el.classList.remove('active'));
  });
}
async function expectPhaseARail(page){
  const buttons=page.locator('#module-rail > button');
  await expect(buttons).toHaveCount(PHASE_A_RAIL.length);
  expect(await buttons.evaluateAll(nodes=>nodes.map(el=>[el.dataset.module,el.querySelector('b')?.textContent]))).toEqual(PHASE_A_RAIL);
  await expect(page.locator('#module-rail [data-module="assets"],#module-rail [data-module="enterprise"],#module-rail [data-module="office"],#module-rail [data-module="requests"]')).toHaveCount(0);
}

test('Phase A rail stays exact through organization refresh and real commerce/accounting/report navigation',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await phaseABrowser(page);
  await expectPhaseARail(page);
  for(let attempt=0;attempt<3;attempt++){
    await page.evaluate(()=>{refreshAllSurfaces();applyLicensedModuleUI()});
    await expectPhaseARail(page);
  }
  for(const id of ['finora-org-switch-btn','finora-org-access-btn']){
    await expect(page.locator('#'+id)).toBeVisible();
    await expect(page.locator('#module-rail #'+id)).toHaveCount(0);
    await expect(page.locator('#'+id)).toHaveCount(1);
  }
  const rail=page.locator('#module-rail'),panel=page.locator('#module-panel-links');
  await rail.locator('[data-module="commerce"]').click();
  const sale=panel.locator('[data-view="view-invoices"]');
  const purchase=panel.locator('[data-view="view-purchases"]');
  await expect(sale).toHaveText(/فاکتور فروش/);await expect(sale).toHaveCount(1);
  await expect(purchase).toHaveText(/فاکتور خرید/);await expect(purchase).toHaveCount(1);
  await purchase.click();
  await expect(page.locator('#view-purchases')).toHaveClass(/active/);
  await expect(page.locator('#pur-save-btn')).toBeVisible();
  await expect(page.locator('#view-invoices')).not.toHaveClass(/active/);
  await expect(purchase).toHaveClass(/active/);
  await expect(rail.locator('[data-module="commerce"]')).toHaveClass(/active/);
  await sale.click();
  await expect(page.locator('#view-invoices')).toHaveClass(/active/);
  await expect(page.locator('#view-purchases')).not.toHaveClass(/active/);
  await page.locator('#global-command-search').fill('فاکتور خرید');
  await expect(page.locator('#command-search-results .command-result')).toHaveCount(1);
  await page.locator('#command-search-results .command-result').click();
  await expect(page.locator('#view-purchases')).toHaveClass(/active/);
  await expect(page.locator('#module-panel-title')).toHaveText('بازرگانی');
  await rail.locator('[data-module="accounting"]').click();
  await panel.locator('[data-view="view-journal"][data-task="new"]').click();
  await expect(page.locator('#view-journal [data-finora-task="new"]')).toBeVisible();
  await expect(page.locator('#view-journal [data-finora-task="register"]')).toBeHidden();
  await panel.locator('[data-view="view-journal"][data-task="register"]').click();
  await expect(page.locator('#view-journal [data-finora-task="register"]')).toBeVisible();
  await expect(page.locator('#view-journal [data-finora-task="new"]')).toBeHidden();
  await panel.locator('[data-view="view-accounting-reports"][data-task="trial"]').click();
  await expect(page.locator('#view-accounting-reports')).toHaveClass(/active/);
  await expect(page.locator('#p6-reporting-root [data-finora-task="trial"]')).toBeVisible();
  await expect(page.locator('#p6-reporting-root [data-finora-task="ledger"]')).toBeHidden();
  await rail.locator('[data-module="reports"]').click();
  await panel.locator('[data-view="view-accounting-reports"][data-task="trial"]').click();
  await expect(page.locator('#view-accounting-reports')).toHaveClass(/active/);
  await expect(page.locator('#p6-reporting-root [data-finora-task="trial"]')).toBeVisible();
  await expect(rail.locator('[data-module="reports"]')).toHaveClass(/active/);
  await expect(page.locator('#module-panel-title')).toHaveText('گزارش‌ها');
  await rail.locator('[data-module="settings"]').click();
  await expect(panel.locator('[data-view="view-admin"]')).toHaveCount(1);
  await page.evaluate(()=>{currentUser.role='accountant';currentUser.isOrganizationOwner=false;refreshAllSurfaces();applyLicensedModuleUI()});
  await rail.locator('[data-module="settings"]').click();
  await expect(panel.locator('[data-view="view-admin"]')).toHaveCount(0);
  await expect(page.locator('#finora-org-switch-btn')).toBeVisible();
  await expectPhaseARail(page);
  expect(await page.evaluate(()=>['invoices','purchases','journalVouchers','journalLines'].map(key=>datastore[key].length))).toEqual([0,0,0,0]);
  expect(errors).toEqual([]);
});

test('Phase A visible licensed launcher preserves extra workspaces without adding rail items',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await phaseABrowser(page);
  const toggle=page.locator('#finora-module-launcher-toggle');
  await expect(toggle).toBeVisible();
  await expect(page.locator('#module-rail #finora-module-launcher-toggle')).toHaveCount(0);
  const launcher=page.locator('#finora-module-launcher'),grid=page.locator('#finora-launcher-grid');
  for(const [label,view] of [
    ['دارایی ثابت','view-assets'],['منابع انسانی و حقوق','view-enterprise'],
    ['اتوماسیون اداری','view-office'],['درخواست‌ها و فرایندها','view-requests']
  ]){
    await toggle.click();await expect(launcher).toHaveClass(/active/);
    await grid.getByRole('button',{name:new RegExp(label)}).click();
    await expect(launcher).not.toHaveClass(/active/);
    await expect(page.locator('#'+view)).toHaveClass(/active/);
    await expectPhaseARail(page);
  }
  await page.evaluate(()=>{switchView('view-dashboard');currentUser.modules=['accounting'];currentUser.commercialModules=['accounting'];applyLicensedModuleUI()});
  await toggle.click();
  await expect(grid.locator('button')).toHaveCount(1);
  await expect(grid).toContainText('حسابداری');
  for(const label of ['دارایی ثابت','منابع انسانی و حقوق','اتوماسیون اداری','درخواست‌ها و فرایندها','CRM','ناوگان','MRP'])await expect(grid).not.toContainText(label);
  expect(await page.evaluate(()=>({office:canAccessFinoraModule('office'),workflow:canAccessFinoraModule('requests')}))).toEqual({office:false,workflow:false});
  await grid.getByRole('button',{name:/حسابداری/}).click();
  await expect(page.locator('#view-accounting-foundation')).toHaveClass(/active/);
  expect(errors).toEqual([]);
});

test('Phase A omits an unavailable purchase command and restores it when its implementation returns',async({page})=>{
  await phaseABrowser(page);
  await page.evaluate(()=>{window.__phaseAPurSave=window.purSave;window.purSave=undefined});
  try{
    await page.locator('#module-rail [data-module="commerce"]').click();
    await expect(page.locator('#module-panel-links [data-view="view-purchases"]')).toHaveCount(0);
    await expect(page.locator('#module-panel-links [data-view="view-invoices"]')).toHaveCount(1);
    await page.locator('#global-command-search').fill('فاکتور خرید');
    await expect(page.locator('#command-search-results')).not.toContainText('فاکتور خرید');
    // Availability filters must not destroy the registered command catalog.
    expect(await page.evaluate(()=>FINORA_COMMANDS.some(command=>command.module==='commerce'&&command.view==='view-purchases'))).toBe(true);
  }finally{
    await page.evaluate(()=>{window.purSave=window.__phaseAPurSave;delete window.__phaseAPurSave});
  }
  await page.locator('#module-rail [data-module="commerce"]').click();
  await expect(page.locator('#module-panel-links [data-view="view-purchases"]')).toHaveCount(1);
});
test('real DOM shell and post-login smoke',async({page})=>{const errs=[];page.on('pageerror',e=>errs.push(String(e)));await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});await expect(page.locator('#auth-screen')).toBeVisible();await expect(page.locator('[data-module="projects"]')).toHaveCount(1);await expect(page.locator('[data-module="dashboard"]')).toContainText('داشبورد');await expect(page.locator('[data-module="home"]')).toHaveCount(0);await expect(page.locator('[data-module="catalog"]')).toHaveCount(0);await expect(page.locator('[data-module="erp"]')).toHaveCount(0);await expect(page.locator('#view-contracting')).toHaveCount(1);await expect(page.locator('[data-module="inventory"]')).toHaveCount(1);await expect(page.locator('#module-rail [data-module="assets"]')).toHaveCount(0);await expect(page.locator('#module-rail [data-module="enterprise"]')).toHaveCount(0);await page.waitForFunction(()=>typeof enterpriseRender==='function'&&window.FinoraStartupStatus?.extensionsReady===true&&window.FinoraStartupStatus?.failedExtensionCount===0&&window.FinoraStartupStatus?.authChecked===true);await expect(page.locator('#module-rail [data-module="enterprise"]')).toHaveCount(0);for(const id of ['view-inventory','view-assets','view-currency','view-data-center','view-integrations'])await expect(page.locator('#'+id)).toHaveCount(1);expect(await page.evaluate(()=>{const a=[...document.querySelectorAll('[id]')].map(x=>x.id),s=new Set(),d=[];for(const id of a){if(s.has(id))d.push(id);s.add(id)}return d})).toEqual([]);await page.evaluate(async()=>{fetchCurrentUser=async()=>({id:'smoke-user',email:'smoke@example.test',fullName:'Smoke Admin',username:'smoke',role:'admin',maxCompanies:1,subscription:{type:'lifetime',status:'active',endDate:'2099-01-01'}});pullAll=async()=>{datastore.settings=[{ownerUserId:'smoke-user',user_display_name:'Smoke Admin',professional_role:'accountant'}]};refreshAllSurfaces=()=>{window.__smokeRefresh=true};maybeMigrateLegacyData=()=>{window.__smokeMigrate=true};await enterApp({id:'smoke-user'});});await expect(page.locator('#auth-screen')).toBeHidden();await expect(page.locator('body')).toHaveClass(/is-admin/);await expect(page.locator('#logged-user-label')).toContainText('Smoke Admin');await expect(page.locator('#module-panel-handle')).toBeVisible();await expect(page.locator('[data-module="projects"] b')).toHaveText('پیمان‌ها');await expect(page.locator('.module-panel-head .panel-collapse')).toHaveCount(0);await page.evaluate(()=>toggleModulePanel());await expect(page.locator('body')).toHaveClass(/shell-panel-collapsed/);await expect(page.locator('#module-panel-handle')).toBeVisible();await expect(page.locator('#module-panel-handle')).toHaveAttribute('aria-expanded','false');await page.click('#module-panel-handle');await expect(page.locator('body')).not.toHaveClass(/shell-panel-collapsed/);await page.evaluate(()=>openModule('accounting','view-accounting-foundation','accounts'));await expect(page.locator('#module-panel-links')).toContainText('ساختار مالی');await expect(page.locator('#module-panel-links')).toContainText('ثبت و عملیات');await expect(page.locator('#module-panel-links')).toContainText('دفاتر و کنترل');await expect(page.locator('#module-panel-links')).toContainText('صورت‌های مالی و تحلیل');await expect(page.locator('#module-panel-links [data-task="accounts"]')).toHaveClass(/active/);await page.fill('#global-command-search','تراز آزمایشی');await expect(page.locator('#command-search-results')).toContainText('تراز آزمایشی');await expect(page.locator('#view-accounting-foundation [data-finora-task="accounts"]')).toBeVisible();await expect(page.locator('#view-accounting-foundation [data-finora-task="dimensions"]')).toBeHidden();await page.evaluate(()=>switchView('view-accounting-foundation'));await expect(page.locator('#view-accounting-foundation [data-finora-task="dimensions"]')).toBeVisible();await page.evaluate(()=>navigateShell('accounting','view-accounting-foundation','accounts'));await page.evaluate(()=>navigateShell('settings','view-settings','company'));await expect(page.locator('#view-settings [data-finora-task="company"]')).toBeVisible();await expect(page.locator('#view-settings [data-finora-task="account"]')).toBeHidden();await expect(page.locator('#company-legal-form')).toContainText('سهامی خاص');await expect(page.locator('#company-legal-form')).toContainText('با مسئولیت محدود');await page.selectOption('#company-entity-type','legal');await page.fill('#company-reg-input','SHOULD_CLEAR');await page.selectOption('#company-organization-role','holding_parent');await page.selectOption('#company-entity-type','natural');await page.evaluate(()=>handleCompanyEntityTypeChange());await expect(page.locator('#company-legal-form-box')).toBeHidden();await expect(page.locator('#company-sector-box')).toBeHidden();await expect(page.locator('#company-organization-box')).toBeHidden();await expect(page.locator('#company-registration-box')).toBeHidden();await expect(page.locator('#company-national-label')).toHaveText('کد ملی');expect(await page.inputValue('#company-reg-input')).toBe('');expect(await page.inputValue('#company-organization-role')).toBe('standalone');await page.selectOption('#company-entity-type','legal');await page.evaluate(()=>handleCompanyEntityTypeChange());await expect(page.locator('#company-legal-form-box')).toBeVisible();await expect(page.locator('#company-organization-box')).toBeVisible();await expect(page.locator('#company-registration-box')).toBeVisible();await expect(page.locator('#company-national-label')).toHaveText('شناسه ملی');await expect(page.locator('#company-organization-role')).toContainText('شرکت مادر / هلدینگ');await expect(page.locator('#company-organization-role')).toContainText('شرکت تابعه');await page.evaluate(()=>switchView('view-contacts'));await page.selectOption('#contact-entity-type','legal');await page.fill('#contact-economic-input','LEGAL-ONLY');await page.fill('#contact-reg-input','REG-ONLY');await page.selectOption('#contact-entity-type','natural');await expect(page.locator('#box-contact-economic')).toBeHidden();await expect(page.locator('#box-contact-reg')).toBeHidden();await expect(page.locator('#label-contact-national')).toHaveText('کد ملی');expect(await page.inputValue('#contact-economic-input')).toBe('');expect(await page.inputValue('#contact-reg-input')).toBe('');await page.evaluate(()=>navigateShell('enterprise','view-enterprise','compliance'));await expect(page.locator('#view-enterprise')).toContainText('رجیستری انطباق ایران');await expect(page.locator('#view-enterprise')).toContainText('IR-LABOR-24');await page.evaluate(()=>navigateShell('enterprise','view-enterprise','payroll'));await expect(page.locator('#view-enterprise')).toContainText('حقوق، بیمه و مالیات حقوق');await page.evaluate(()=>navigateShell('enterprise','view-enterprise','costing'));await expect(page.locator('#view-enterprise')).toContainText('ABC');await page.evaluate(()=>navigateShell('enterprise','view-enterprise','group'));await expect(page.locator('#view-enterprise')).toContainText('کنترل مدیریتی گروه');await page.evaluate(()=>navigateShell('accounting','view-journal','new'));await expect(page.locator('#view-journal [data-finora-task="new"]')).toBeVisible();await expect(page.locator('#view-journal [data-finora-task="register"]')).toBeHidden();await page.evaluate(()=>navigateShell('accounting','view-journal','register'));await expect(page.locator('#view-journal [data-finora-task="register"]')).toBeVisible();await expect(page.locator('#view-journal [data-finora-task="new"]')).toBeHidden();await page.evaluate(()=>navigateShell('accounting','view-accounting-reports','trial'));await expect(page.locator('#p6-reporting-root [data-finora-task="trial"]')).toBeVisible();await expect(page.locator('#p6-reporting-root [data-finora-task="ledger"]')).toBeHidden();expect(await page.evaluate(()=>({refresh:window.__smokeRefresh,migrate:window.__smokeMigrate,admin:canShowShellCommand({guard:'admin'})}))).toEqual({refresh:true,migrate:true,admin:true});await page.evaluate(()=>{saveDatastore=()=>{};datastore.companies=[{id:'C1',ownerUserId:'smoke-user',name:'Smoke Co'}];datastore.settings=[{ownerUserId:'smoke-user',default_company_id:'C1'}];datastore.products=[{id:'P1',ownerUserId:'smoke-user',companyId:'C1',code:'1',name:'Smoke Product',type:'good',unit:'عدد',buy_price:100,sale_price:150,stock:0}];for(const k of ['warehouses','stockMovements','inventoryCounts','fixedAssets','assetDepreciations','currencies','exchangeRates','costCenters','importBatches','integrationConnections','integrationOutbox','phase5Audit'])datastore[k]=[];switchView('view-inventory');p5Render('view-inventory');});await expect(page.locator('#view-journal')).toBeHidden();await page.evaluate(()=>{switchView('view-dashboard');renderDashboard();});await expect(page.locator('#kpi-assets-sum')).toHaveCount(1);await expect(page.locator('#dashboard-cashflow-chart svg')).toHaveCount(1);await expect(page.locator('#dashboard-recent-journals')).toHaveCount(1);await page.evaluate(()=>{switchView('view-accounting-foundation');renderAccountingFoundation();});await expect(page.locator('#view-accounting-foundation')).toContainText('ورود کدینگ از Excel');await expect(page.locator('#view-accounting-foundation')).toContainText('شناور ۴ قرارداد/پیمان');await page.evaluate(()=>navigateShell('enterprise','view-enterprise','compliance'));await expect(page.locator('#view-enterprise')).toContainText('رجیستری انطباق ایران');await expect(page.locator('#view-enterprise')).toContainText('IR-LABOR-24');await page.evaluate(()=>navigateShell('enterprise','view-enterprise','leave'));await expect(page.locator('#view-enterprise')).toContainText('حداکثر ۹ روز');await expect(page.locator('#af-account-type')).toHaveCount(1);await expect(page.locator('#af-account-search')).toHaveCount(1);await expect(page.locator('#af-account-level-filter')).toHaveCount(1);await expect(page.locator('#af-account-role')).toHaveCount(1);await expect(page.locator('#af-dim-source option[value="contract"]')).toHaveCount(1);await page.evaluate(()=>{switchView('view-inventory');p5Render('view-inventory');});await expect(page.locator('#p5-inventory-root')).toContainText('انبار اصلی');await expect(page.locator('#p5-inventory-root')).toContainText('Smoke Product');await page.evaluate(()=>{switchView('view-accounting-reports');P6Reports.render();});await expect(page.locator('#p6-reporting-root')).toContainText('تراز آزمایشی');await expect(page.locator('#p6-reporting-root')).toContainText('صورت جریان وجوه نقد');expect(await page.evaluate(()=>{const a=[...document.querySelectorAll('[id]')].map(x=>x.id),s=new Set(),d=[];for(const id of a){if(s.has(id))d.push(id);s.add(id)}return d})).toEqual([]);await page.evaluate(()=>{window.__FINORA_PRINT_TEST_MODE=true;window.print=()=>{};const items=Array.from({length:25},(_,i)=>({prodName:'Item '+(i+1),qty:1,unit:'عدد',price:100,lineTotal:100}));datastore.invoices=[{id:'PRINT_FORMAL',ownerUserId:'smoke-user',companyId:'C1',contactId:'',kind:'formal',number:'F-1',date:'1405/07/07',items,subtotal:2500,discount:0,vat:250,grandTotal:2750,paymentMethod:'cash'}];renderAndPrintDirect('PRINT_FORMAL');});await expect(page.locator('#printable-invoice .invoice-a4-page')).toHaveCount(3);expect(await page.locator('#dynamic-print-orientation').evaluate(el=>el.innerHTML.includes('A4 landscape'))).toBe(true);await expect(page.locator('#finora-print-frame')).toHaveCount(1);expect(await page.locator('#finora-print-frame').evaluate(f=>({paper:f.contentDocument.querySelector('#finora-print-document')?.dataset.paper,orientation:f.contentDocument.querySelector('#finora-print-document')?.dataset.orientation,appUi:f.contentDocument.querySelectorAll('.view-pane,.app-shell-nav,.module-panel,.topbar').length,pages:f.contentDocument.querySelectorAll('.invoice-a4-page').length}))).toEqual({paper:'A4',orientation:'landscape',appUi:0,pages:3});await page.emulateMedia({media:'print'});expect(await page.locator('#printable-invoice .invoice-a4-page').first().evaluate(el=>getComputedStyle(el).breakAfter)).toBe('page');await page.emulateMedia({media:'screen'});await page.evaluate(()=>{datastore.invoices[0].id='PRINT_NONFORMAL';datastore.invoices[0].kind='informal';renderAndPrintDirect('PRINT_NONFORMAL');});await expect(page.locator('#printable-invoice .invoice-a4-page')).toHaveCount(3);expect(await page.locator('#dynamic-print-orientation').evaluate(el=>el.innerHTML.includes('A5 landscape'))).toBe(true);expect(await page.locator('#finora-print-frame').evaluate(f=>({paper:f.contentDocument.querySelector('#finora-print-document')?.dataset.paper,orientation:f.contentDocument.querySelector('#finora-print-document')?.dataset.orientation,appUi:f.contentDocument.querySelectorAll('.view-pane,.app-shell-nav,.module-panel,.topbar').length,pages:f.contentDocument.querySelectorAll('.invoice-a4-page').length}))).toEqual({paper:'A5',orientation:'landscape',appUi:0,pages:3});expect(errs.filter(x=>!x.includes('ResizeObserver'))).toEqual([]);});


test('expired license browser enforcement',async({page})=>{const errs=[];page.on('pageerror',e=>errs.push(String(e)));await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});await expect.poll(()=>page.evaluate(()=>window.FinoraStartupStatus?.authChecked),{timeout:15000}).toBe(true);await page.evaluate(async()=>{window.__licenseAlerts=[];window.alert=m=>window.__licenseAlerts.push(String(m));fetchCurrentUser=async()=>({id:'expired-user',email:'expired@example.test',fullName:'Expired User',username:'expired',role:'user',subscription:{type:'monthly',status:'active',startDate:'2025-01-01',endDate:'2025-01-31'}});pullAll=async()=>{};refreshAllSurfaces=()=>{updateLicenseDisplay(currentUser)};maybeMigrateLegacyData=()=>{};await enterApp({id:'expired-user'});});await expect(page.locator('#auth-screen')).toBeHidden();await expect(page.locator('#user-license-status-badge')).toContainText('منقضی شده');expect(await page.evaluate(()=>canWrite())).toBe(false);expect(await page.evaluate(()=>requireWrite())).toBe(false);expect(await page.evaluate(()=>window.__licenseAlerts.some(x=>x.includes('منقضی')&&x.includes('امکان ثبت یا ویرایش')))).toBe(true);expect(errs.filter(x=>!x.includes('ResizeObserver'))).toEqual([]);});


test('isolated print document honors CSS paper size in Chromium PDF',async({page,context})=>{await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});const docs=await page.evaluate(()=>({a4:buildIsolatedPrintDocument('<div class="invoice-a4-page">FORMAL_ONLY</div>',{paper:'A4',orientation:'landscape',widthMm:297,heightMm:210,marginMm:5}),a5:buildIsolatedPrintDocument('<div class="invoice-a4-page">NONFORMAL_ONLY</div>',{paper:'A5',orientation:'landscape',widthMm:210,heightMm:148,marginMm:5})}));for(const [kind,html] of Object.entries(docs)){const p=await context.newPage();await p.setContent(html,{waitUntil:'domcontentloaded'});expect(await p.locator('body').innerText()).toContain(kind==='a4'?'FORMAL_ONLY':'NONFORMAL_ONLY');expect(await p.locator('.view-pane,.app-shell-nav,.module-panel,.topbar').count()).toBe(0);const pdf=await p.pdf({preferCSSPageSize:true,printBackground:true});const parsed=await PDFDocument.load(pdf);expect(parsed.getPageCount()).toBe(1);const {width:w,height:h}=parsed.getPage(0).getSize();expect(w).toBeGreaterThan(h);if(kind==='a4'){expect(w).toBeGreaterThan(830);expect(h).toBeGreaterThan(580);}else{expect(w).toBeGreaterThan(580);expect(w).toBeLessThan(620);expect(h).toBeGreaterThan(400);expect(h).toBeLessThan(440);}await p.close();}});
