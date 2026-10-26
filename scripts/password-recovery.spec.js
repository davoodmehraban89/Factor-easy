const {test,expect}=require('@playwright/test');
const BASE=process.env.FINORA_PASSWORD_BASE||process.env.FINORA_TEST_BASE_URL||'http://127.0.0.1:4173/index.html';
const PAGES=process.env.FINORA_LOGIN_PAGES_BASE||'http://127.0.0.1:4173/_site/index.html';
const BOB='11111111-1111-4111-8111-111111111111',ALICE='22222222-2222-4222-8222-222222222222';
function token(id){const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');return enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:id,exp:4102444800,session_id:'session-'+id,aud:'authenticated'})+'.synthetic-signature';}
function user(id){return {id,email:id===BOB?'recovery@example.test':'existing@example.test',aud:'authenticated',role:'authenticated',created_at:'2026-01-01T00:00:00Z',user_metadata:{has_password:true,full_name:'Synthetic Recovery'}};}
function session(id){return {access_token:token(id),refresh_token:'synthetic-refresh-'+id,token_type:'bearer',expires_in:3600,expires_at:4102444800,user:user(id)};}
function callback(base,access=token(BOB)){return base+'?finora_recovery=1#type=recovery&access_token='+encodeURIComponent(access)+'&refresh_token=synthetic-recovery-refresh&expires_in=3600&token_type=bearer';}
async function fixture(page,{existing=false,invalid=false,updateError=false}={}){
 const calls={recover:[],recoveryRedirects:[],updates:[],logouts:[],profiles:0,records:0,writes:0};
 await page.addInitScript(({existing,saved})=>{if(existing)localStorage.setItem('sb-hcsixhqbyuhpshfwqpjx-auth-token',JSON.stringify(saved));},{existing,saved:session(ALICE)});
 await page.route('https://*.supabase.co/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();
  const json=(status,data)=>route.fulfill({status,headers:{'x-supabase-api-version':'2024-01-01','access-control-expose-headers':'x-supabase-api-version'},contentType:'application/json',body:JSON.stringify(data)});
  if(path==='/auth/v1/recover'){
   calls.recover.push(request.postDataJSON());calls.recoveryRedirects.push(url.searchParams.get('redirect_to'));return json(200,{});
  }
  if(path==='/auth/v1/user'){
   const uid=request.headers().authorization?.includes(token(ALICE))?ALICE:BOB;
   if(method==='GET')return invalid&&uid===BOB?json(401,{code:'bad_jwt',msg:'unsafe-private-error-value'}):json(200,user(uid));
   if(method==='PUT'){
    calls.updates.push({uid,...request.postDataJSON()});
    if(updateError)return json(422,{code:'weak_password',msg:'unsafe-private-error-value'});
    return json(200,user(uid));
   }
  }
  if(path==='/auth/v1/logout'){calls.logouts.push(request.headers().authorization);return route.fulfill({status:204,body:''});}
  if(path.startsWith('/rest/v1/')){
   const table=path.split('/').pop();
   if(method!=='GET'){calls.writes++;return json(403,{message:'Unexpected synthetic write'});}
   const uid=request.headers().authorization?.includes(token(ALICE))?ALICE:BOB;
   let data=[];
   if(table==='profiles'){calls.profiles++;data=[{id:uid,email:user(uid).email,full_name:'Synthetic Recovery',role:'accountant'}];}
   if(table==='organization_members')data=[{id:'synthetic-member',organization_id:'synthetic-org',user_id:uid,status:'active',is_owner:true}];
   if(table==='organizations')data=[{id:'synthetic-org',name:'Synthetic Company',status:'active'}];
   if(table==='licenses')data=[{organization_id:'synthetic-org',plan:'lifetime',status:'active',starts_at:'2026-01-01',ends_at:'2099-01-01',modules:['full_suite'],max_companies:5,max_users:5}];
   if(table==='records')calls.records++;
   return json(200,request.headers().accept?.includes('vnd.pgrst.object')?data[0]:data);
  }
  return route.abort('blockedbyclient');
 });
 await page.route('https://cdn.jsdelivr.net/**',route=>route.abort('blockedbyclient'));
 await page.route('https://cdnjs.cloudflare.com/**',route=>route.abort('blockedbyclient'));
 page.on('dialog',dialog=>dialog.dismiss());
 return calls;
}

test('Forgot Password validates email and sends one account-neutral implicit recovery request',async({page})=>{
 const calls=await fixture(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#auth-forgot-password')).toBeEnabled();
 await page.locator('#auth-email').fill('invalid');await page.locator('#auth-forgot-password').click();
 await expect(page.locator('#auth-login-status')).toContainText('ایمیل معتبر');expect(calls.recover).toHaveLength(0);
 await page.locator('#auth-email').fill('Unknown@Example.test');
 await page.locator('#auth-forgot-password').click();await page.locator('#auth-forgot-password').click();
 await expect(page.locator('#auth-login-status')).toContainText('اگر حسابی');
 expect(calls.recover).toEqual([{email:'unknown@example.test',code_challenge:null,code_challenge_method:null,gotrue_meta_security:{}}]);
 expect(calls.recoveryRedirects).toEqual(['https://factoreasy.ir/?finora_recovery=1']);
 expect(calls.profiles).toBe(0);expect(calls.writes).toBe(0);
});

test('A stalled recovery request times out and restores usable login controls',async({page})=>{
 const calls=await fixture(page);
 let release,arrived;const held=new Promise(r=>{release=r}),requested=new Promise(r=>{arrived=r});
 await page.route('https://*.supabase.co/auth/v1/recover*',async route=>{
  arrived();await held;await route.fulfill({status:200,contentType:'application/json',body:'{}'}).catch(()=>{});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#auth-forgot-password')).toBeEnabled();
 await page.clock.install();await page.locator('#auth-email').fill('recovery@example.test');
 await page.locator('#auth-forgot-password').click();await requested;
 await expect(page.locator('#auth-forgot-password')).toBeDisabled();
 await page.clock.fastForward(12100);
 await expect(page.locator('#auth-login-status')).toContainText('انجام نشد');
 await expect(page.locator('#auth-forgot-password')).toBeEnabled();
 await expect(page.locator('#auth-login-button')).toBeEnabled();
 expect(calls.profiles).toBe(0);expect(calls.updates).toHaveLength(0);release();
});

test('Implicit recovery link opens required password panel without hydrating financial workspace',async({page})=>{
 const calls=await fixture(page);
 await page.goto(callback(BASE),{waitUntil:'domcontentloaded'});
 await expect(page.locator('#auth-recovery-container')).toBeVisible();
 await expect(page.locator('#auth-recovery-submit')).toBeEnabled();
 await expect(page.locator('#auth-form-container')).toBeHidden();
 expect(new URL(page.url()).hash).toBe('');
 expect(calls.profiles).toBe(0);expect(calls.records).toBe(0);
 await page.evaluate(()=>enterApp({id:'should-not-hydrate'}));
 expect(calls.profiles).toBe(0);expect(calls.records).toBe(0);
 await expect(page.locator('#auth-screen')).toBeVisible();
});

test('Invalid recovery link never uses a different cached account to change a password',async({page})=>{
 const calls=await fixture(page,{existing:true,invalid:true});
 await page.goto(callback(BASE),{waitUntil:'domcontentloaded'});
 await expect(page.locator('#auth-recovery-status')).toContainText('معتبر نیست');
 await expect(page.locator('#auth-recovery-submit')).toBeDisabled();
 await page.evaluate(()=>finoraSaveRecoveredPassword());
 expect(calls.updates).toHaveLength(0);expect(calls.profiles).toBe(0);expect(calls.records).toBe(0);
 expect(await page.locator('body').innerText()).not.toContain('unsafe-private-error-value');
});

test('Recovery marker alone cannot turn a cached session into a password reset',async({page})=>{
 const calls=await fixture(page,{existing:true});
 await page.goto(BASE+'?finora_recovery=1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#auth-recovery-status')).toContainText('معتبر نیست');
 await expect(page.locator('#auth-recovery-submit')).toBeDisabled();
 expect(calls.profiles).toBe(0);expect(calls.updates).toHaveLength(0);
});

test('Verified recovery survives reload only for the same validated account',async({page})=>{
 const calls=await fixture(page);
 await page.goto(callback(BASE),{waitUntil:'domcontentloaded'});
 await expect(page.locator('#auth-recovery-submit')).toBeEnabled();
 await page.reload();
 await expect(page.locator('#auth-recovery-submit')).toBeEnabled();
 expect(calls.profiles).toBe(0);expect(calls.records).toBe(0);
 await page.evaluate(saved=>localStorage.setItem('sb-hcsixhqbyuhpshfwqpjx-auth-token',JSON.stringify(saved)),session(ALICE));
 await page.reload();
 await expect(page.locator('#auth-recovery-submit')).toBeDisabled();
 await expect(page.locator('#auth-recovery-status')).toContainText('معتبر نیست');
 expect(calls.profiles).toBe(0);
});

test('An unsupported fresh callback discards an earlier valid recovery proof',async({page})=>{
 const calls=await fixture(page);
 await page.goto(callback(BASE),{waitUntil:'domcontentloaded'});
 await expect(page.locator('#auth-recovery-submit')).toBeEnabled();
 await page.goto(callback(BASE).replace('type=recovery','type=signup'),{waitUntil:'domcontentloaded'});
 await expect(page.locator('#auth-recovery-status')).toContainText('معتبر نیست');
 await expect(page.locator('#auth-recovery-submit')).toBeDisabled();
 expect(new URL(page.url()).hash).toBe('');
 expect(calls.updates).toHaveLength(0);expect(calls.profiles).toBe(0);
});

test('Recovery validates password, suppresses double submit and enters the verified account once',async({page})=>{
 const calls=await fixture(page);
 await page.goto(callback(BASE),{waitUntil:'domcontentloaded'});
 await expect(page.locator('#auth-recovery-submit')).toBeEnabled();
 await page.locator('#auth-recovery-password').fill('weak');await page.locator('#auth-recovery-confirm').fill('weak');
 await page.locator('#auth-recovery-submit').click();
 await expect(page.locator('#auth-recovery-status')).toContainText('۸ کاراکتر');expect(calls.updates).toHaveLength(0);
 await page.locator('#auth-recovery-password').fill('NewPassword123');await page.locator('#auth-recovery-confirm').fill('Different123');
 await page.locator('#auth-recovery-submit').click();
 await expect(page.locator('#auth-recovery-status')).toContainText('یکسان');expect(calls.updates).toHaveLength(0);
 await page.locator('#auth-recovery-confirm').fill('NewPassword123');
 await page.evaluate(()=>{finoraSaveRecoveredPassword();finoraSaveRecoveredPassword();});
 await expect(page.locator('#auth-screen')).toBeHidden({timeout:15000});
 expect(calls.updates).toEqual([{uid:BOB,password:'NewPassword123',data:{has_password:true},code_challenge:null,code_challenge_method:null}]);
 expect(await page.evaluate(()=>currentUser.id)).toBe(BOB);
 expect(new URL(page.url()).searchParams.has('finora_recovery')).toBe(false);
 await expect(page.locator('#auth-recovery-password')).toHaveValue('');
 await expect(page.locator('#auth-recovery-confirm')).toHaveValue('');
 expect(calls.writes).toBe(0);
});

test('Rejected password update stays in recovery without exposing raw provider error',async({page})=>{
 const calls=await fixture(page,{updateError:true});
 await page.goto(callback(BASE),{waitUntil:'domcontentloaded'});
 await expect(page.locator('#auth-recovery-submit')).toBeEnabled();
 await page.locator('#auth-recovery-password').fill('NewPassword123');await page.locator('#auth-recovery-confirm').fill('NewPassword123');
 await page.locator('#auth-recovery-submit').click();
 await expect(page.locator('#auth-recovery-status')).toContainText('شرایط امنیتی');
 await expect(page.locator('#auth-screen')).toBeVisible();
 expect(calls.updates).toHaveLength(1);expect(calls.profiles).toBe(0);
 expect(await page.locator('body').innerText()).not.toContain('unsafe-private-error-value');
});

test('Another tab changing the account while recovery is checked cannot update that account',async({page})=>{
 const calls=await fixture(page);
 await page.goto(callback(BASE),{waitUntil:'domcontentloaded'});
 await expect(page.locator('#auth-recovery-submit')).toBeEnabled();
 await page.locator('#auth-recovery-password').fill('NewPassword123');await page.locator('#auth-recovery-confirm').fill('NewPassword123');
 await page.evaluate(saved=>{
  const getUser=sb.auth.getUser.bind(sb.auth);
  sb.auth.getUser=async(...args)=>{const result=await getUser(...args);localStorage.setItem('sb-hcsixhqbyuhpshfwqpjx-auth-token',JSON.stringify(saved));return result;};
 },session(ALICE));
 await page.locator('#auth-recovery-submit').click();
 await expect(page.locator('#auth-recovery-status')).toContainText('معتبر نیست');
 await expect(page.locator('#auth-recovery-submit')).toBeDisabled();
 expect(calls.updates).toHaveLength(0);expect(calls.profiles).toBe(0);
});

test('A session change after the final check cannot redirect the password mutation',async({page})=>{
 const calls=await fixture(page);
 await page.goto(callback(BASE),{waitUntil:'domcontentloaded'});
 await expect(page.locator('#auth-recovery-submit')).toBeEnabled();
 await page.locator('#auth-recovery-password').fill('NewPassword123');await page.locator('#auth-recovery-confirm').fill('NewPassword123');
 await page.evaluate(saved=>{
  const getSession=sb.auth.getSession.bind(sb.auth);
  sb.auth.getSession=async()=>{const result=await getSession();localStorage.setItem('sb-hcsixhqbyuhpshfwqpjx-auth-token',JSON.stringify(saved));return result;};
 },session(ALICE));
 await page.locator('#auth-recovery-submit').click();
 await expect(page.locator('#auth-form-container')).toBeVisible();
 await expect(page.locator('#auth-login-status')).toContainText('رمز جدید ذخیره شد');
 expect(calls.updates).toEqual([{uid:BOB,password:'NewPassword123',data:{has_password:true},code_challenge:null,code_challenge_method:null}]);
 expect(calls.profiles).toBe(0);expect(calls.records).toBe(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sb-hcsixhqbyuhpshfwqpjx-auth-token')).user.id)).toBe(ALICE);
});

test('Recovery proof cannot authorize a later session for the same account',async({page})=>{
 const calls=await fixture(page);
 await page.goto(callback(BASE),{waitUntil:'domcontentloaded'});
 await expect(page.locator('#auth-recovery-submit')).toBeEnabled();
 const later=session(BOB),parts=later.access_token.split('.');
 const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString());payload.session_id='later-unrelated-session';
 parts[1]=Buffer.from(JSON.stringify(payload)).toString('base64url');later.access_token=parts.join('.');
 await page.evaluate(saved=>localStorage.setItem('sb-hcsixhqbyuhpshfwqpjx-auth-token',JSON.stringify(saved)),later);
 await page.locator('#auth-recovery-password').fill('NewPassword123');await page.locator('#auth-recovery-confirm').fill('NewPassword123');
 await page.locator('#auth-recovery-submit').click();
 await expect(page.locator('#auth-recovery-status')).toContainText('معتبر نیست');
 await expect(page.locator('#auth-recovery-submit')).toBeDisabled();
 expect(calls.updates).toHaveLength(0);expect(calls.profiles).toBe(0);
});

test('Cancel recovery preserves another account that signed in in a different tab',async({page})=>{
 const calls=await fixture(page);
 await page.goto(callback(BASE),{waitUntil:'domcontentloaded'});
 await expect(page.locator('#auth-recovery-submit')).toBeEnabled();
 await page.evaluate(saved=>localStorage.setItem('sb-hcsixhqbyuhpshfwqpjx-auth-token',JSON.stringify(saved)),session(ALICE));
 await page.locator('#auth-recovery-cancel').click();
 await expect(page.locator('#auth-form-container')).toBeVisible();
 expect(calls.logouts).toHaveLength(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sb-hcsixhqbyuhpshfwqpjx-auth-token')).user.id)).toBe(ALICE);
 expect(calls.updates).toHaveLength(0);expect(calls.profiles).toBe(0);
});

test('Cancel logout remains pinned to recovery when the persistent account changes after its check',async({page})=>{
 const calls=await fixture(page);
 await page.goto(callback(BASE),{waitUntil:'domcontentloaded'});
 await expect(page.locator('#auth-recovery-submit')).toBeEnabled();
 await page.evaluate(saved=>{
  const getSession=sb.auth.getSession.bind(sb.auth);
  sb.auth.getSession=async()=>{const result=await getSession();localStorage.setItem('sb-hcsixhqbyuhpshfwqpjx-auth-token',JSON.stringify(saved));return result;};
 },session(ALICE));
 await page.locator('#auth-recovery-cancel').click();
 await expect(page.locator('#auth-form-container')).toBeVisible();
 expect(calls.logouts).toEqual(['Bearer '+token(BOB)]);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sb-hcsixhqbyuhpshfwqpjx-auth-token')).user.id)).toBe(ALICE);
 expect(calls.updates).toHaveLength(0);expect(calls.profiles).toBe(0);
});

test('Cancel stays disabled until a pending recovery exchange has finished',async({page})=>{
 const calls=await fixture(page);
 let release,arrived;const held=new Promise(r=>{release=r}),requested=new Promise(r=>{arrived=r});
 await page.route('https://*.supabase.co/auth/v1/user',async route=>{
  if(route.request().method()!=='GET')return route.fallback();
  arrived();await held;return route.fallback();
 });
 await page.goto(callback(BASE),{waitUntil:'domcontentloaded'});await requested;
 await expect(page.locator('#auth-recovery-cancel')).toBeDisabled();
 await page.evaluate(()=>finoraCancelPasswordRecovery());
 await expect(page.locator('#auth-recovery-container')).toBeVisible();
 release();await expect(page.locator('#auth-recovery-submit')).toBeEnabled();
 await expect(page.locator('#auth-recovery-cancel')).toBeEnabled();
 expect(calls.profiles).toBe(0);expect(calls.updates).toHaveLength(0);
});

test('Cancel a verified recovery clears only its local session and prevents automatic re-entry',async({page})=>{
 const calls=await fixture(page);
 await page.goto(callback(BASE),{waitUntil:'domcontentloaded'});
 await expect(page.locator('#auth-recovery-submit')).toBeEnabled();
 await page.locator('#auth-recovery-cancel').click();
 await expect(page.locator('#auth-form-container')).toBeVisible();
 expect(calls.logouts).toEqual(['Bearer '+token(BOB)]);
 expect(await page.evaluate(()=>localStorage.getItem('sb-hcsixhqbyuhpshfwqpjx-auth-token'))).toBeNull();
 expect(new URL(page.url()).searchParams.has('finora_recovery')).toBe(false);
 await page.reload();await expect(page.locator('#auth-login-button')).toBeEnabled();
 await expect(page.locator('#auth-screen')).toBeVisible();
 expect(calls.profiles).toBe(0);expect(calls.updates).toHaveLength(0);
});

test('Strict CSP recovery form is ready while a required business bundle is held',async({page})=>{
 const calls=await fixture(page);
 let release,arrived;const held=new Promise(r=>{release=r}),requested=new Promise(r=>{arrived=r});
 await page.route('**/js/finora-pages-business.js*',async route=>{arrived();await held;await route.continue();});
 await page.goto(callback(PAGES),{waitUntil:'commit'});await requested;
 await expect(page.locator('#auth-recovery-submit')).toBeEnabled();
 await expect(page.locator('#auth-recovery-container')).toBeVisible();
 expect(calls.profiles).toBe(0);expect(calls.records).toBe(0);
 release();await page.waitForLoadState('domcontentloaded');
});
