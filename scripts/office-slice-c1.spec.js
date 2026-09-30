const {test,expect}=require('@playwright/test');

test('Office C1 exposes server-authoritative read-evidence hook',async({page})=>{
  const errs=[];page.on('pageerror',e=>errs.push(String(e)));
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.officeMarkReadEvidence==='function');
  expect(await page.evaluate(()=>typeof window.officeMarkReadEvidence)).toBe('function');
  expect(errs.filter(x=>!x.includes('ResizeObserver'))).toEqual([]);
});
