const {test,expect}=require('@playwright/test');
test('Office C5 exposes internal approval controls',async({page})=>{
 const errs=[];page.on('pageerror',e=>errs.push(String(e)));
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.officeLoadApprovalQueue==='function');
 expect(await page.evaluate(()=>typeof window.officeRequestApproval)).toBe('function');
 expect(await page.evaluate(()=>typeof window.officeActOnApproval)).toBe('function');
 expect(errs.filter(x=>!x.includes('ResizeObserver'))).toEqual([]);
});
