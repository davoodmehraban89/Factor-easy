const {test,expect}=require('@playwright/test');
const BASE=process.env.FINORA_TEST_BASE_URL||'http://127.0.0.1:4173/index.html';
async function ready(page){
 await page.route('https://*.supabase.co/**',route=>route.abort());
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.FinoraStartupStatus?.authChecked&&window.FinoraStartupStatus?.extensionsReady);
}
for(const [failure,expected] of [
 [{message:'FINORA_ORGANIZATION_CONTEXT_UNAVAILABLE'},'BOOT_ORGANIZATION_UNAVAILABLE'],
 [{code:'42501',message:'permission denied synthetic-private-details'},'BOOT_ACCOUNT_ACCESS_DENIED'],
 [{code:'42703',message:'missing column synthetic-private-details'},'BOOT_ACCOUNT_SCHEMA'],
 [{code:'PGRST116',message:'no profile synthetic-private-details'},'BOOT_ACCOUNT_UNAVAILABLE'],
 [{message:'Failed to fetch synthetic-private-details'},'BOOT_ACCOUNT_NETWORK'],
 [{message:'unexpected synthetic-private-details'},'BOOT_ACCOUNT_READ_FAILED']
])test('account hydration reports safe actionable code '+expected,async({page})=>{
 await ready(page);const dialogs=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss()});
 await page.evaluate(failure=>{
  sb.auth.signInWithPassword=async()=>({data:{user:{id:'synthetic-user'}},error:null});
  fetchCurrentUser=async()=>{throw failure};
 },failure);
 await page.locator('#auth-email').fill('synthetic@example.test');await page.locator('#auth-password').fill('Synthetic!Password1');
 await page.locator('#auth-login-button').click();
 await expect(page.locator('#auth-login-status')).toContainText(expected);
 await expect(page.locator('#auth-login-status')).toHaveAttribute('data-state','error');
 await expect(page.locator('#auth-screen')).toBeVisible();
 expect(await page.evaluate(()=>currentUser)).toBe(null);
 expect(dialogs.join(' ')).not.toContain('synthetic-private-details');
 expect(await page.locator('#auth-login-status').textContent()).not.toContain('synthetic-private-details');
 if(expected!=='BOOT_ACCOUNT_NETWORK')expect(dialogs.join(' ')).not.toContain('اتصال اینترنت را بررسی');
});

test('invalid saved refresh token clears stale session and permits one manual password login through real SDK',async({page})=>{
 const session={access_token:'synthetic-access',refresh_token:'synthetic-refresh-new',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'synthetic-user',aud:'authenticated',email:'synthetic@example.test',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}};
 await page.addInitScript(session=>localStorage.setItem('sb-hcsixhqbyuhpshfwqpjx-auth-token',JSON.stringify({...session,refresh_token:'synthetic-revoked',expires_at:1})),session);
 const counts={refresh:0,password:0,other:0};
 await page.route('https://*.supabase.co/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/auth/v1/token'&&url.searchParams.get('grant_type')==='refresh_token'){
   counts.refresh++;return route.fulfill({status:400,contentType:'application/json',headers:{'x-supabase-api-version':'2024-01-01'},body:JSON.stringify({code:'refresh_token_not_found',message:'Invalid Refresh Token: Refresh Token Not Found'})});
  }
  if(url.pathname==='/auth/v1/token'&&url.searchParams.get('grant_type')==='password'){
   counts.password++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(session)});
  }
  counts.other++;await route.abort();
 });
 page.on('dialog',d=>d.dismiss());
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.FinoraStartupStatus?.authChecked&&window.FinoraStartupStatus?.extensionsReady);
 await expect(page.locator('#auth-screen')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem(FINORA_AUTH_STORAGE_KEY))).toBe(null);
 await page.evaluate(()=>{
  fetchCurrentUser=async()=>({id:'synthetic-user',role:'user',modules:['full_suite'],subscription:{type:'lifetime',status:'active',endDate:'2099-01-01'}});
  pullAll=async()=>{};maybeMigrateLegacyData=()=>{};maybeShowUserOnboarding=()=>{};
 });
 await page.locator('#auth-email').fill('synthetic@example.test');await page.locator('#auth-password').fill('Synthetic!Password1');
 await page.locator('#auth-login-button').click();await expect(page.locator('#auth-screen')).toBeHidden();
 expect(await page.evaluate(()=>currentUser?.id)).toBe('synthetic-user');
 expect(counts).toEqual({refresh:1,password:1,other:0});
});

test('real organization loader fails clearly when membership has no visible organization/license',async({page})=>{
 await ready(page);
 const message=await page.evaluate(async()=>{
  sb.from=table=>({select(){return this},eq(){return this},in(){return this},single(){return this},then(resolve,reject){return Promise.resolve({data:table==='profiles'?{id:'QA',role:'user'}:table==='organization_members'?[{id:'QM',organization_id:'QO',status:'active',is_owner:true}]:[],error:null}).then(resolve,reject)}});
  try{await fetchCurrentUser({id:'QA'});return 'unexpected-success'}catch(e){return e.message}
 });
 expect(message).toBe('FINORA_ORGANIZATION_CONTEXT_UNAVAILABLE');
});
