const {test,expect}=require('@playwright/test');
const BASE=process.env.FINORA_TEST_BASE_URL||'http://127.0.0.1:4173/index.html';
const DRAFT='سلام، می‌خواهم یک مشکل در نرم‌افزار فینورا گزارش کنم.\nشرح مشکل:\nمراحل بازتولید:\nنتیجه مورد انتظار:\nنتیجه مشاهده‌شده:';
test.setTimeout(20000);

for(const width of [1440,390])for(const activation of ['click','keyboard']){
 test(`About bug report opens only a generic support draft: ${width} ${activation}`,async({page,context})=>{
  await page.setViewportSize({width,height:900});
  const outgoing=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Context routing covers the popup's FIRST navigation too. No real external
  // service receives even a GET; synthetic page stands in for the destination.
  await context.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin===new URL(BASE).origin)return route.continue();
   if(url.hostname==='wa.me'){
    outgoing.push({url:request.url(),method:request.method()});
    return route.fulfill({contentType:'text/html',body:'<title>Intercepted support draft</title>'});
   }
   return route.abort();
  });
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.FinoraStartupStatus?.extensionsReady&&window.FinoraStartupStatus?.authChecked);
  await page.evaluate(()=>{
   currentUser={id:'QA_SUPPORT_PRIVATE_SENTINEL',email:'private-sentinel@example.invalid',role:'user',isOrganizationOwner:true,organizationId:'QA_ORG',organizations:[],modules:['full_suite'],commercialModules:['full_suite'],modulePermissions:[],subscription:{type:'lifetime',status:'active',endDate:'2099-01-01'}};
   COLLS.forEach(k=>datastore[k]=[]);saveDatastore=()=>{};
   sb.from=()=>({select(){return this},eq(){return this},in(){return this},order(){return this},then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}});
   sb.rpc=async()=>({data:[],error:null});
   document.querySelector('#auth-screen').style.display='none';document.body.classList.remove('shell-panel-collapsed');refreshAllSurfaces();
  });
  const settings=width<=820?page.locator('.mobile-dock [data-view="view-settings"]'):page.locator('#module-rail [data-module="settings"]');
  await settings.click();
  const about=page.locator('#view-settings [data-finora-task="about"]');
  if(width>820)await page.locator('#module-panel-links [data-task="about"]').click();
  if(!await about.locator('.accordion-body').isVisible())await about.locator('.accordion-header').click();
  const link=about.getByRole('link',{name:'گزارش باگ در واتس‌اپ',exact:true});
  await expect(link).toBeVisible();
  const href=await link.getAttribute('href'),url=new URL(href);
  const existing=new URL(await about.locator('.btn-wa').getAttribute('href'));
  expect(url.origin+url.pathname).toBe(existing.origin+existing.pathname);
  expect(url.protocol).toBe('https:');expect(url.hostname).toBe('wa.me');
  expect([...url.searchParams.keys()]).toEqual(['text']);
  expect(url.searchParams.get('text')).toBe(DRAFT);
  expect(url.hash).toBe('');expect(href).not.toContain('PRIVATE_SENTINEL');
  await expect(link).toHaveAttribute('target','_blank');
  expect((await link.getAttribute('rel')).split(/\s+/)).toContain('noopener');
  await expect(link).not.toHaveAttribute('onclick',/.+/);
  await link.scrollIntoViewIfNeeded();
  const box=await link.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
  expect(outgoing).toEqual([]);expect(context.pages()).toHaveLength(1);
  const popupPromise=context.waitForEvent('page');
  if(activation==='keyboard'){
   await about.getByRole('button',{name:'بررسی آپدیت',exact:true}).focus();
   await page.keyboard.press('Tab');await expect(link).toBeFocused();await page.keyboard.press('Enter');
  }else await link.click();
  const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');
  expect(outgoing).toEqual([{url:href,method:'GET'}]);
  expect(await popup.evaluate(()=>window.opener===null)).toBe(true);
  expect(errors).toEqual([]);
  if(BASE.includes('_site')||BASE.includes(':4188')){
   expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  }
  await popup.close();
 });
}
