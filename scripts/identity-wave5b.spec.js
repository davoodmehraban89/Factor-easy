const {test,expect}=require('@playwright/test');
test('Wave 5b export fails closed when fresh membership is denied',async({page})=>{
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof exportDataBlob==='function');
 const result=await page.evaluate(async()=>{let clicks=0,alerts=[];const oldCreate=document.createElement.bind(document),oldAlert=window.alert;window.alert=m=>alerts.push(String(m));window.requireFreshFinoraMembership=async()=>false;document.createElement=(tag)=>{const el=oldCreate(tag);if(tag==='a')el.click=()=>{clicks++};return el};try{await exportDataBlob()}finally{document.createElement=oldCreate;window.alert=oldAlert}return {clicks,alerts}});
 expect(result.clicks).toBe(0);expect(result.alerts.join(' ')).toContain('عضویت سازمانی');
});
test('Wave 5b known revocation clears tenant memory and stale user',async({page})=>{
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof revalidateFinoraMembership==='function');
 const result=await page.evaluate(async()=>{
  currentUser={id:'u1',organizationId:'org-revoked',username:'seat'};datastore.products=[{id:'p1',ownerUserId:'u1'}];syncSnap.set('products|p1','x');localStorage.setItem(STORAGE_KEY,'secret-cache');
  const oldFrom=sb.from,oldSignOut=sb.auth.signOut;let signedOut=0;
  sb.from=()=>({select(){return this},eq(){return this},then(resolve){resolve({data:[],error:null})}});
  sb.auth.signOut=async()=>{signedOut++;return {error:null}};
  try{const ok=await revalidateFinoraMembership({sensitive:true});return {ok,signedOut,user:currentUser,products:datastore.products.length,snap:syncSnap.size,legacy:localStorage.getItem(STORAGE_KEY),lock:!!document.getElementById('finora-membership-lock')}}finally{sb.from=oldFrom;sb.auth.signOut=oldSignOut}
 });
 expect(result).toEqual({ok:false,signedOut:1,user:null,products:0,snap:0,legacy:null,lock:true});
});
