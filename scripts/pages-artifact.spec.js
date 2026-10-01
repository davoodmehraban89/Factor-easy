const {test,expect}=require('@playwright/test');
const {execFileSync}=require('node:child_process');

const base='http://127.0.0.1:4173/_site/';

test.beforeAll(()=>{
  execFileSync(process.execPath,['scripts/build-pages.mjs'],{stdio:'inherit'});
});

test('hardened Pages artifact loads without script/CSP console errors',async({page,request})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
  await page.goto(base,{waitUntil:'networkidle'});
  await expect(page.locator('#view-dashboard')).toHaveCount(1);
  await expect.poll(()=>page.evaluate(()=>window.FinoraHealth?.version||null)).toBe('1.0');
  expect(await page.evaluate(()=>window.parseFormattedNumber('۱٬۲۳۴٫۵۶'))).toBe(1234.56);
  expect(await page.evaluate(()=>window.parseFormattedNumber('١٢٫٥'))).toBe(12.5);
  const csp=await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp||'').not.toMatch(/script-src[^;]*'unsafe-inline'/i);
  const inline=await page.locator('[onclick],[onchange],[oninput],[onsubmit],[onblur],[onfocus]').evaluateAll(nodes=>nodes.map(el=>({tag:el.tagName,id:el.id||'',attrs:[...el.attributes].filter(a=>/^on/i.test(a.name)).map(a=>[a.name,a.value])})));
  if(inline.length)console.log('REMAINING_INLINE_HANDLERS='+JSON.stringify(inline));
  expect(inline).toEqual([]);
  const diag=await request.get(base+'diag.html');
  expect(diag.status()).toBe(404);
  expect(errors).toEqual([]);
});
