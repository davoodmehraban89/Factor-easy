const {test,expect}=require('@playwright/test');
const BASE=process.env.FINORA_TEST_BASE_URL||'http://127.0.0.1:4173/index.html';
async function boot(page){
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof renderDashboard==='function'&&typeof openDashboardFinanceKpi==='function'&&typeof finoraCloseTopModal==='function');
 await page.evaluate(()=>{
   currentUser={id:'UI_QA_ONLY',role:'admin',fullName:'QA',organizationId:'ORG_QA',maxUsers:2,subscription:{status:'active',type:'lifetime'}};
   datastore.companies=[{id:'CO_QA',ownerUserId:'UI_QA_ONLY',name:'شرکت تست'}];
   datastore.settings=[{ownerUserId:'UI_QA_ONLY',default_company_id:'CO_QA',currency_mode:'rial'}];
   datastore.accounts=[{id:'A100',ownerUserId:'UI_QA_ONLY',companyId:'CO_QA',code:'1101',title:'بانک آزمایشی',accountType:'asset',systemRole:'bank',postingAllowed:true}];
   datastore.journalVouchers=[{id:'V_QA_1',ownerUserId:'UI_QA_ONLY',companyId:'CO_QA',number:'JV-001',date:'۱۴۰۵/۰۷/۱۹',description:'ورود نقدی تست',status:'posted',totalDebit:250000,totalCredit:250000,createdAt:'2026-10-11T12:00:00Z'}];
   datastore.journalLines=[{id:'L_QA_1',ownerUserId:'UI_QA_ONLY',voucherId:'V_QA_1',accountId:'A100',debit:250000,credit:0,description:'بانک'}];
   window.P6Reports={financials:()=>({assets:250000}),rollup:()=>[{accountId:'A100',code:'1101',title:'بانک آزمایشی',accountType:'asset',systemRole:'bank',debit:250000,credit:0,balance:250000}],ledger:()=>[{id:'L_QA_1',voucherId:'V_QA_1',voucher:{id:'V_QA_1',number:'JV-001',date:'۱۴۰۵/۰۷/۱۹',status:'posted'},description:'بانک',debit:250000,credit:0}]};
   window.jeCashAccount=()=>({id:'A100'});
   document.querySelector('#auth-screen').style.display='none';
   renderDashboard();
 });
}
test('all representative close buttons, dynamically rendered dialogs and backdrop dismiss without reload',async({page})=>{
 await boot(page);
 await page.evaluate(()=>{
   const d=document.createElement('div');d.id='finora-org-access-modal';d.className='modal-backdrop active';
   d.innerHTML='<div class="modal-card"><h3>مدیریت دسترسی سازمان</h3><button type="button" id="qa-close">بستن</button></div>';
   document.body.appendChild(d);
 });
 await page.locator('#qa-close').click();
 await expect(page.locator('#finora-org-access-modal')).not.toHaveClass(/active/);
 await page.evaluate(()=>document.querySelector('#finora-org-access-modal').classList.add('active'));
 await page.locator('#finora-org-access-modal').click({position:{x:5,y:5}});
 await expect(page.locator('#finora-org-access-modal')).not.toHaveClass(/active/);
 await page.evaluate(()=>{const d=document.querySelector('#finora-org-access-modal');d.classList.add('active');d.querySelector('button').textContent='✕ بستن';});
 await page.locator('#qa-close').click();
 await expect(page.locator('#finora-org-access-modal')).not.toHaveClass(/active/);
});
test('dashboard cash/assets cards drill to accounts, rows to ledger, recent voucher opens document',async({page})=>{
 await boot(page);
 const assets=page.locator('#kpi-assets-sum').locator('xpath=ancestor::*[contains(@class,"fin-kpi-card")]');
 await expect(assets).toHaveAttribute('role','button');
 await assets.click();
 await expect(page.locator('#finora-drill-modal.active')).toBeVisible();
 await expect(page.locator('#finora-drill-modal #finora-drill-title')).toHaveText('جزئیات دارایی‌ها');
 await expect(page.locator('#finora-drill-modal')).toContainText('بانک آزمایشی');
 await page.locator('#finora-drill-modal .finora-open-account').click();
 await expect(page.locator('#finora-drill-title')).toContainText('گردش حساب');
 await expect(page.locator('#finora-drill-modal')).toContainText('JV-001');
 await page.locator('#finora-drill-modal .finora-open-voucher').click();
 await expect(page.locator('#finora-drill-title')).toContainText('جزئیات سند');
 await expect(page.locator('#finora-drill-modal')).toContainText('۲۵۰٬۰۰۰');
 await page.locator('#finora-drill-modal button').filter({hasText:'بستن'}).click();
 await expect(page.locator('#finora-drill-modal')).not.toHaveClass(/active/);
 const cash=page.locator('#kpi-cash-sum').locator('xpath=ancestor::*[contains(@class,"fin-kpi-card")]');
 await cash.focus();await page.keyboard.press('Enter');
 await expect(page.locator('#finora-drill-title')).toContainText('نقد و بانک');
 await page.locator('#finora-drill-modal button').filter({hasText:'بستن'}).click();
 const recent=page.locator('#dashboard-recent-journals tr').first();
 await expect(recent).toHaveAttribute('role','button');
 await recent.click();
 await expect(page.locator('#finora-drill-title')).toContainText('جزئیات سند');
 await page.locator('#finora-voucher-register-open').click();
 await expect(page.locator('#view-journal')).toHaveClass(/active/);
});


test('F0-02 commerce tab navigates away from accounting and exposes invoice, product and contact links',async({page})=>{
  // Synthetic local UI test. No real Supabase session or financial writes.
  await boot(page);
  await page.waitForFunction(()=>typeof window.applyLicensedModuleUI==='function'&&typeof window.openModule==='function');
  await page.evaluate(()=>{currentUser.modules=['full_suite'];applyLicensedModuleUI();});
  const rail=page.locator('#module-rail');
  await rail.locator('[data-module="accounting"]').click();
  await expect(page.locator('#view-accounting-foundation')).toHaveClass(/active/);
  await expect(page.locator('#module-panel-title')).toHaveText('حسابداری');
  await expect(page.locator('#module-panel-links')).toContainText('ثبت سند حسابداری');
  await rail.locator('[data-module="commerce"]').click();
  await expect(page.locator('#view-invoices')).toHaveClass(/active/);
  await expect(page.locator('#module-panel-title')).toHaveText('بازرگانی');
  await expect(page.locator('#module-panel-links')).toContainText('فاکتورها');
  await expect(page.locator('#module-panel-links')).toContainText('کالا و خدمات');
  await expect(page.locator('#module-panel-links')).toContainText('اشخاص');
  await expect(page.locator('#module-panel-links [data-view="view-journal"]')).toHaveCount(0);
  await expect(rail.locator('[data-module="commerce"]')).toHaveClass(/active/);
  await page.locator('#module-panel-links [data-view="view-products"]').click();
  await expect(page.locator('#view-products')).toHaveClass(/active/);
  await page.locator('#module-panel-links [data-view="view-invoices"]').click();
  await expect(page.locator('#view-invoices')).toHaveClass(/active/);
  await expect(page.locator('#module-panel-title')).toHaveText('بازرگانی');
});
