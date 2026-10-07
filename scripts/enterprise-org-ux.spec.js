const {test,expect}=require('@playwright/test');

test('ELI-4 enterprise organization UX exposes typed tree and capacity dashboard',async({page})=>{
  const errs=[];page.on('pageerror',e=>errs.push(String(e)));
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.finoraCanManageOrganization==='function');
  await page.waitForFunction(()=>typeof window.renderEnterpriseOrganizationTree==='function'&&typeof window.refreshEnterpriseOrganizationDashboard==='function');
  expect(await page.evaluate(()=>typeof window.renderEnterpriseOrganizationTree)).toBe('function');
  expect(await page.evaluate(()=>typeof window.refreshEnterpriseOrganizationDashboard)).toBe('function');
  expect(await page.evaluate(()=>{
    currentUser={id:'module-admin',isOrganizationOwner:false,modulePermissions:[{module_key:'accounting',capabilities:['configure']}],commercialModules:['accounting']};
    return finoraCanManageOrganization();
  })).toBe(false);
  expect(errs.filter(x=>!x.includes('ResizeObserver'))).toEqual([]);
});
