const {test,expect}=require('@playwright/test');
test('Wave 5c full export is denied without organization-management authority',async({page})=>{
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof exportDataBlob==='function');
 const r=await page.evaluate(async()=>{let clicks=0,alerts=[];const oldCreate=document.createElement.bind(document),oldAlert=window.alert;window.requireFreshFinoraMembership=async()=>true;window.finoraCanManageOrganization=()=>false;document.createElement=(tag)=>{const el=oldCreate(tag);if(tag==='a')el.click=()=>clicks++;return el};window.alert=m=>alerts.push(String(m));try{await exportDataBlob()}finally{document.createElement=oldCreate;window.alert=oldAlert}return{clicks,alerts}});
 expect(r.clicks).toBe(0);expect(r.alerts.join(' ')).toContain('مجوز مدیریت سازمان');
});
test('Wave 5c restore is denied before reading file without organization-management authority',async({page})=>{
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof importDataBlob==='function');
 const r=await page.evaluate(async()=>{currentUser={id:'u1',organizationId:'o1',subscription:{status:'active',type:'lifetime'}};let alerts=[];const oldAlert=window.alert;window.alert=m=>alerts.push(String(m));window.requireFreshFinoraMembership=async()=>true;window.finoraCanManageOrganization=()=>false;const event={target:{value:'x',files:[new File(['{}'],'backup.json',{type:'application/json'})]}};try{await importDataBlob(event);return{value:event.target.value,alerts}}finally{window.alert=oldAlert}});
 expect(r.value).toBe('');expect(r.alerts.join(' ')).toContain('مجوز مدیریت سازمان');
});
