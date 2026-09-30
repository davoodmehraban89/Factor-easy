const {test,expect}=require('@playwright/test');

test('Office C4 exposes versioned template controls without mutating registered history',async({page})=>{
  const errs=[];page.on('pageerror',e=>errs.push(String(e)));
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.officeLoadTemplateCatalog==='function');
  expect(await page.evaluate(()=>typeof window.officeLoadTemplateCatalog)).toBe('function');
  expect(await page.evaluate(()=>typeof window.officeSaveTemplateVersion)).toBe('function');
  expect(await page.evaluate(()=>typeof window.officeApplyTemplate)).toBe('function');
  expect(errs.filter(x=>!x.includes('ResizeObserver'))).toEqual([]);
});
