const {test,expect}=require('@playwright/test');

test('ELI-2 role grants merge with direct grants and role UI stays core-admin only',async({page})=>{
  const errs=[];page.on('pageerror',e=>errs.push(String(e)));
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.hasFinoraCapability==='function'&&typeof window.finoraCanManageOrganization==='function');

  expect(await page.evaluate(()=>{
    currentUser={id:'role-user',isOrganizationOwner:false,commercialModules:['accounting'],modulePermissions:[
      {source:'direct',module_key:'accounting',capabilities:['read']},
      {source:'role',module_key:'accounting',capabilities:['create']}
    ]};
    return {read:hasFinoraCapability('accounting','read'),create:hasFinoraCapability('accounting','create'),office:hasFinoraCapability('office_automation','read')};
  })).toEqual({read:true,create:true,office:false});

  expect(await page.evaluate(()=>{
    currentUser={id:'core-admin',isOrganizationOwner:false,commercialModules:['accounting'],modulePermissions:[{source:'role',module_key:'core',capabilities:['read','configure']}]};
    return finoraCanManageOrganization();
  })).toBe(true);

  expect(await page.evaluate(()=>{
    currentUser={id:'accounting-admin',isOrganizationOwner:false,commercialModules:['accounting'],modulePermissions:[{source:'role',module_key:'accounting',capabilities:['read','configure']}]};
    return finoraCanManageOrganization();
  })).toBe(false);

  expect(errs.filter(x=>!x.includes('ResizeObserver'))).toEqual([]);
});
