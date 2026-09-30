const {test,expect}=require('@playwright/test');

test('Office C2 exposes actionable referral work queue',async({page})=>{
  const errs=[];page.on('pageerror',e=>errs.push(String(e)));
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.officeLoadReferralQueue==='function');
  expect(await page.evaluate(()=>typeof window.officeLoadReferralQueue)).toBe('function');
  expect(await page.evaluate(()=>typeof window.officeActOnReferral)).toBe('function');
  expect(await page.evaluate(()=>typeof window.officeReferralWorkQueue)).toBe('function');
  expect(errs.filter(x=>!x.includes('ResizeObserver'))).toEqual([]);
});
