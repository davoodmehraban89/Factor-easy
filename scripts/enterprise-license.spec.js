const {test,expect}=require('@playwright/test');

test('ELI-1 named-user capacity and delegated core admin DOM contract',async({page})=>{
  const errs=[];page.on('pageerror',e=>errs.push(String(e)));
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.finoraCanManageOrganization==='function'&&window.FINORA_MODULE_CATALOG);

  await expect(page.locator('#modal-license-user-limit')).toHaveCount(1);
  await page.evaluate(()=>{
    adminUsersCache=[{id:'eli-admin',email:'admin@example.test',role:'admin',lic:{plan:'annual',status:'active',starts_at:'2026-01-01',ends_at:'2027-01-01',max_companies:5,max_users:300,modules:['accounting','treasury','office_automation']}}];
    openLicenseEditModal('eli-admin');
  });
  await expect(page.locator('#modal-license-user-limit')).toHaveValue('300');
  await expect(page.locator('#modal-license-company-limit')).toHaveValue('5');

  expect(await page.evaluate(()=>{
    currentUser={id:'delegated',isOrganizationOwner:false,commercialModules:['accounting'],modulePermissions:[{module_key:'core',capabilities:['read','configure']}]};
    return {manage:finoraCanManageOrganization(),coreConfigure:hasFinoraCapability('core','configure'),accounting:hasFinoraCapability('accounting','read')};
  })).toEqual({manage:true,coreConfigure:true,accounting:false});

  expect(await page.evaluate(()=>{
    currentUser={id:'module-admin',isOrganizationOwner:false,commercialModules:['accounting'],modulePermissions:[{module_key:'accounting',capabilities:['read','configure']}]};
    return {manage:finoraCanManageOrganization(),accountingConfigure:hasFinoraCapability('accounting','configure'),office:hasFinoraCapability('office_automation','read')};
  })).toEqual({manage:false,accountingConfigure:true,office:false});

  expect(errs.filter(x=>!x.includes('ResizeObserver'))).toEqual([]);
});
