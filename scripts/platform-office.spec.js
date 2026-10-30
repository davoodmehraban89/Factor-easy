const {test,expect}=require('@playwright/test');

test('modular launcher and office surfaces render from licensed modules',async({page})=>{
  const errs=[];page.on('pageerror',e=>errs.push(String(e)));
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.FINORA_MODULE_CATALOG&&typeof window.officeRender==='function'&&typeof window.requestsRender==='function'&&window.FinoraStartupStatus?.extensionsReady===true&&window.FinoraStartupStatus?.failedExtensionCount===0&&window.FinoraStartupStatus?.authChecked===true);
  await page.evaluate(()=>{currentUser={id:'platform-smoke',email:'platform@example.test',role:'admin',modules:['office_automation','requests_workflow'],subscription:{type:'lifetime',status:'active',endDate:'2099-01-01'}};['officeRegistries','correspondence','correspondenceAttachments','correspondenceReferrals','correspondenceAudit','requestTypes','requests','requestActions'].forEach(k=>datastore[k]=[]);applyLicensedModuleUI()});
  await page.evaluate(()=>{document.querySelector('#auth-screen').style.display='none'});
  await expect(page.locator('#module-rail [data-module="office"]')).toHaveCount(0);await expect(page.locator('#module-rail [data-module="requests"]')).toHaveCount(0);await expect(page.locator('[data-module="accounting"]')).toBeHidden();await expect(page.locator('[data-module="settings"]')).toBeVisible();
  await page.locator('#finora-module-launcher-toggle').click();
  await expect(page.locator('#finora-launcher-grid')).toContainText('اتوماسیون اداری');
  await expect(page.locator('#finora-launcher-grid')).toContainText('درخواست‌ها و فرایندها');
  await expect(page.locator('#finora-launcher-grid')).not.toContainText('حسابداری');
  await page.locator('#finora-launcher-grid').getByRole('button',{name:/اتوماسیون اداری/}).click();
  await expect(page.locator('#view-office')).toHaveClass(/active/);
  expect(await page.evaluate(()=>hasLicensedModule('office_automation'))).toBe(true);expect(await page.evaluate(()=>hasLicensedModule('accounting'))).toBe(false);
  await page.evaluate(()=>{switchView('view-office');officeRender('registries')});await expect(page.locator('#view-office')).toContainText('دفاتر دبیرخانه و شماره‌گذاری');await expect(page.locator('#view-office')).toContainText('اتمیک');
  await page.evaluate(()=>{switchView('view-office');officeRender('new')});await expect(page.locator('#office-files')).toHaveAttribute('accept',/application\/pdf/);await expect(page.locator('#view-office')).toContainText('OCR-ready');
  await page.evaluate(()=>{adminUsersCache=[{id:'platform-smoke',email:'platform@example.test',role:'admin',lic:{plan:'lifetime',status:'active',starts_at:'2026-01-01',ends_at:'2099-01-01',max_companies:1,modules:['office_automation','requests_workflow']}}];openLicenseEditModal('platform-smoke')});await expect(page.locator('#modal-license-modules')).toContainText('لایسنس کامل ERP');await expect(page.locator('#license-module-grid input[value="transport"]')).toBeDisabled();await expect(page.locator('#license-module-grid input[value="office_automation"]')).toBeChecked();
  expect(errs.filter(x=>!x.includes('ResizeObserver'))).toEqual([]);
});
