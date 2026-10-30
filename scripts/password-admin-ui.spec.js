const {test,expect}=require('@playwright/test');
const BASE=process.env.FINORA_TEST_BASE_URL||'http://127.0.0.1:4173/index.html';
const PAGES_BASE=process.env.FINORA_TEST_PAGES_BASE||new URL('/_site/index.html',BASE).href;
const ACTOR='11111111-1111-4111-8111-111111111111';
const TARGET='22222222-2222-4222-8222-222222222222';
const OTHER='33333333-3333-4333-8333-333333333333';
const ORG='44444444-4444-4444-8444-444444444444';
const MEMBER='55555555-5555-4555-8555-555555555555';

async function managerFixture(page,kind='global',url=BASE){
 await page.route(/https:\/\/[^/]*supabase\.co\//,route=>route.abort());
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.FinoraStartupStatus?.authChecked===true&&window.FinoraStartupStatus?.extensionsReady===true);
 await page.evaluate(({kind,ACTOR,TARGET,OTHER,ORG,MEMBER})=>{
  document.getElementById('auth-screen').style.display='none';
  window.__recoveryCalls=[];window.__recoveryAlerts=[];
  window.confirm=()=>true;window.alert=message=>window.__recoveryAlerts.push(String(message));
  currentUser={id:ACTOR,role:kind==='global'?'admin':'user',organizationId:ORG,isOrganizationOwner:kind==='owner',modulePermissions:[],commercialModules:['full_suite'],subscription:{type:'lifetime',status:'active',endDate:'2099-01-01'}};
  const profiles=[{id:TARGET,email:'recipient@example.invalid',full_name:'آزمون بازیابی',role:'user',created_at:'2026-01-01'}];
  const tables={profiles,licenses:[],organization_members:[{id:MEMBER,user_id:TARGET,status:'active',is_owner:false},{id:'66666666-6666-4666-8666-666666666666',user_id:OTHER,status:'suspended',is_owner:false}],organization_roles:[],organization_role_permissions:[],organization_member_roles:[]};
  sb.from=table=>({select(){return this},eq(){return this},in(){return this},order(){return this},then(resolve,reject){return Promise.resolve({data:tables[table]||[],error:null}).then(resolve,reject)}});
  Object.defineProperty(sb,'functions',{configurable:true,value:{invoke:async(name,{body})=>{window.__recoveryCalls.push({name,body});return {data:{ok:true},error:null}}}});
 },{kind,ACTOR,TARGET,OTHER,ORG,MEMBER});
}

test('central user/license row sends only target Auth identity to the recovery endpoint',async({page})=>{
 await managerFixture(page);
 await page.evaluate(async()=>{navigateShell('settings','view-admin');await renderAdminPanel()});
 const button=page.locator('[data-recovery-user="'+TARGET+'"]');
 await expect(button).toHaveCount(1,{timeout:1500});
 await expect(button).toContainText('پیوند بازیابی');
 await button.click();
 await expect.poll(()=>page.evaluate(()=>window.__recoveryCalls)).toEqual([{name:'admin-user-management',body:{action:'send_recovery',user_id:TARGET}}]);
 expect(await page.evaluate(()=>window.__recoveryAlerts.join(' '))).toContain('پیوند');
});

test('global software admin assigns a new password from the central user row and secrets are cleared',async({page})=>{
 await managerFixture(page);
 await page.evaluate(async()=>{navigateShell('settings','view-admin');await renderAdminPanel()});
 const row=page.locator('#admin-users-table-body tr').filter({hasText:'recipient@example.invalid'});
 const button=row.locator('[data-reset-user="'+TARGET+'"]');
 await expect(button).toBeVisible();await button.click();
 await expect(page.locator('#modal-admin-reset-password')).toHaveClass(/active/);
 const secret='VeryStrong!NewPass123';
 await page.locator('#admin-reset-password').fill(secret);
 await page.locator('#admin-reset-password-confirm').fill(secret);
 await page.locator('#admin-reset-password-submit').click();
 await expect.poll(()=>page.evaluate(()=>window.__recoveryCalls)).toEqual([{name:'admin-user-management',body:{action:'set_password',user_id:TARGET,password:secret}}]);
 await expect(page.locator('#admin-password-reset-status')).toContainText('ثبت شد');
 await expect(page.locator('#admin-reset-password')).toHaveValue('');
 await expect(page.locator('#admin-reset-password-confirm')).toHaveValue('');
});

test('generated strict-CSP Pages central reset button opens and invokes the server action',async({page})=>{
 await managerFixture(page,'global',PAGES_BASE);
 await page.evaluate(async()=>{navigateShell('settings','view-admin');await renderAdminPanel()});
 const button=page.locator('[data-reset-user="'+TARGET+'"]');
 await expect(button).toBeVisible();await button.click();
 await expect(page.locator('#modal-admin-reset-password')).toHaveClass(/active/);
 const secret='VeryStrong!NewPass123';
 await page.locator('#admin-reset-password').fill(secret);
 await page.locator('#admin-reset-password-confirm').fill(secret);
 await page.locator('#admin-reset-password-submit').click();
 await expect.poll(()=>page.evaluate(()=>window.__recoveryCalls)).toEqual([{name:'admin-user-management',body:{action:'set_password',user_id:TARGET,password:secret}}]);
 await expect(page.locator('#admin-password-reset-status')).toContainText('ثبت شد');
});

test('central password form rejects mismatched and weak passwords before calling the server',async({page})=>{
 await managerFixture(page);
 await page.evaluate(async()=>{navigateShell('settings','view-admin');await renderAdminPanel()});
 await page.locator('[data-reset-user="'+TARGET+'"]').click();
 await page.locator('#admin-reset-password').fill('weak');
 await page.locator('#admin-reset-password-confirm').fill('different');
 await page.locator('#admin-reset-password-submit').click();
 await expect(page.locator('#admin-password-reset-status')).toContainText('حداقل ۱۲');
 await expect.poll(()=>page.evaluate(()=>window.__recoveryCalls)).toHaveLength(0);
 await page.locator('#admin-reset-password').fill('VeryStrong!NewPass123');
 await page.locator('#admin-reset-password-confirm').fill('VeryStrong!Other456');
 await page.locator('#admin-reset-password-submit').click();
 await expect(page.locator('#admin-password-reset-status')).toContainText('یکسان نیست');
 await expect.poll(()=>page.evaluate(()=>window.__recoveryCalls)).toHaveLength(0);
});

test('organization owner cannot render or invoke the central direct-password form',async({page})=>{
 await managerFixture(page,'owner');
 await expect(page.locator('#admin-users-table-body [data-reset-user]')).toHaveCount(0);
 await page.evaluate(async({TARGET})=>{await adminSetPassword();await adminOpenPasswordReset(TARGET);},{TARGET});
 expect(await page.evaluate(()=>window.__recoveryCalls)).toHaveLength(0);
 await expect(page.locator('#modal-admin-reset-password')).not.toHaveClass(/active/);
});

test('failed central password assignment shows no success and never echoes server details',async({page})=>{
 await managerFixture(page);
 await page.evaluate(async()=>{navigateShell('settings','view-admin');await renderAdminPanel()});
 await page.locator('[data-reset-user="'+TARGET+'"]').click();
 const secret='VeryStrong!NewPass123';
 await page.locator('#admin-reset-password').fill(secret);
 await page.locator('#admin-reset-password-confirm').fill(secret);
 await page.evaluate(()=>{sb.functions.invoke=async(name,{body})=>{window.__recoveryCalls.push({name,body});return {data:null,error:{message:'PRIVATE_PROVIDER_DETAIL',context:new Response(JSON.stringify({error:'password_assignment_failed',detail:'PRIVATE_SECRET'}),{status:502})}}};});
 await page.locator('#admin-reset-password-submit').click();
 await expect(page.locator('#admin-password-reset-status')).toContainText('نتوانست');
 const status=await page.locator('#admin-password-reset-status').innerText();
 expect(status).not.toContain('ثبت شد');
 expect(status).not.toContain('PRIVATE');
 expect(status).not.toContain(secret);
 await expect(page.locator('#admin-reset-password')).toHaveValue('');
 expect(await page.evaluate(()=>window.__recoveryCalls)).toHaveLength(1);
});

test('organization owner targets the active Auth user, never the membership UUID or inactive member',async({page})=>{
 await managerFixture(page,'owner');
 await page.evaluate(()=>showOrganizationAccessManager());
 const modal=page.locator('#finora-org-access-modal.active');
 await expect(modal.locator('[data-recovery-user="'+TARGET+'"]')).toHaveCount(1,{timeout:1500});
 await expect(modal.locator('[data-recovery-user="'+OTHER+'"]')).toHaveCount(0);
 await modal.locator('[data-recovery-user="'+TARGET+'"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__recoveryCalls)).toEqual([{name:'admin-user-management',body:{action:'send_recovery',user_id:TARGET,organization_id:ORG}}]);
 expect((await page.evaluate(()=>window.__recoveryCalls))[0].body.user_id).not.toBe(MEMBER);
});

test('ordinary member and foreign organization calls cannot invoke manager recovery',async({page})=>{
 await managerFixture(page,'member');
 expect(await page.evaluate(()=>typeof window.finoraSendUserRecovery)).toBe('function');
 await page.evaluate(async({TARGET,ORG})=>{await finoraSendUserRecovery(TARGET,ORG);currentUser.isOrganizationOwner=true;await finoraSendUserRecovery(TARGET,'77777777-7777-4777-8777-777777777777')},{TARGET,ORG});
 expect(await page.evaluate(()=>window.__recoveryCalls)).toHaveLength(0);
});

test('pending repeated sends and the successful-send cooldown invoke the server once',async({page})=>{
 await managerFixture(page);
 expect(await page.evaluate(()=>typeof window.finoraSendUserRecovery)).toBe('function');
 await page.evaluate(({TARGET})=>{
  sb.functions.invoke=(name,{body})=>{window.__recoveryCalls.push({name,body});return new Promise(resolve=>{window.__resolveRecovery=()=>resolve({data:{ok:true},error:null})})};
  window.__firstRecovery=finoraSendUserRecovery(TARGET);void finoraSendUserRecovery(TARGET);
 },{TARGET});
 expect(await page.evaluate(()=>window.__recoveryCalls)).toHaveLength(1);
 await page.evaluate(async({TARGET})=>{window.__resolveRecovery();await window.__firstRecovery;await finoraSendUserRecovery(TARGET)},{TARGET});
 expect(await page.evaluate(()=>window.__recoveryCalls)).toHaveLength(1);
});

test('server rejection shows a localized reason and never a false success or raw response',async({page})=>{
 await managerFixture(page);
 expect(await page.evaluate(()=>typeof window.finoraSendUserRecovery)).toBe('function');
 await page.evaluate(async({TARGET})=>{
  sb.functions.invoke=async()=>({data:null,error:{message:'raw-secret-token-error',context:new Response(JSON.stringify({error:'recovery_target_unavailable',extra:'raw-secret-token'}),{status:400,headers:{'content-type':'application/json'}})}});
  await finoraSendUserRecovery(TARGET);
 },{TARGET});
 const alerts=await page.evaluate(()=>window.__recoveryAlerts.join(' '));
 expect(alerts).toContain('ایمیل');
 expect(alerts).not.toContain('raw-secret');
 expect(alerts).not.toContain('ارسال شد');
});

test('a stalled manager request ends with an uncertain-result message and no immediate duplicate',async({page})=>{
 await managerFixture(page);
 expect(await page.evaluate(()=>typeof window.finoraSendUserRecovery)).toBe('function');
 await page.clock.install();
 await page.evaluate(({TARGET})=>{
  sb.functions.invoke=(name,{body})=>{window.__recoveryCalls.push({name,body});return new Promise(()=>{})};
  window.__firstRecovery=finoraSendUserRecovery(TARGET);
 },{TARGET});
 await page.clock.fastForward(21000);
 await expect.poll(()=>page.evaluate(()=>window.__recoveryAlerts.join(' '))).toContain('مشخص نیست');
 await page.evaluate(async({TARGET})=>{await window.__firstRecovery;await finoraSendUserRecovery(TARGET)},{TARGET});
 expect(await page.evaluate(()=>window.__recoveryCalls)).toHaveLength(1);
 expect(await page.evaluate(()=>window.__recoveryAlerts.join(' '))).not.toContain('ارسال شد');
});

test('a thrown transport error never leaks raw server details',async({page})=>{
 await managerFixture(page);
 await page.evaluate(async({TARGET})=>{
  sb.functions.invoke=async()=>{throw new Error('raw-secret-token-backend')};
  await finoraSendUserRecovery(TARGET);
 },{TARGET});
 const alerts=await page.evaluate(()=>window.__recoveryAlerts.join(' '));
 expect(alerts).not.toContain('raw-secret');
 expect(alerts).toContain('ایمیل');
});

test('a delegated core manager can assist an active member independently of paid license state',async({page})=>{
 await managerFixture(page,'member');
 await page.evaluate(async()=>{
  currentUser.modulePermissions=[{module_key:'core',capabilities:['configure']}];
  currentUser.subscription={type:'trial',status:'cancelled',endDate:'2020-01-01'};
  await showOrganizationAccessManager();
 });
 const button=page.locator('#finora-org-access-modal.active [data-recovery-user="'+TARGET+'"]');
 await expect(button).toBeVisible();
 await button.click();
 await expect.poll(()=>page.evaluate(()=>window.__recoveryCalls)).toEqual([{name:'admin-user-management',body:{action:'send_recovery',user_id:TARGET,organization_id:ORG}}]);
});

for(const outcome of ['success','failure'])test('central pending '+outcome+' cannot alter a reopened password dialog',async({page})=>{
 await managerFixture(page);
 await page.evaluate(async({OTHER})=>{
  navigateShell('settings','view-admin');await renderAdminPanel();
  adminUsersCache.push({id:OTHER,email:'other@example.invalid',role:'user'});
  sb.functions.invoke=(name,{body})=>{window.__recoveryCalls.push({name,body});return new Promise(resolve=>{window.__finishPasswordReset=resolve})};
 },{OTHER});
 await page.locator('[data-reset-user="'+TARGET+'"]').click();
 await page.locator('#admin-reset-password').fill('First!StrongPassword123');
 await page.locator('#admin-reset-password-confirm').fill('First!StrongPassword123');
 await page.locator('#admin-reset-password-submit').click();
 await page.locator('#modal-admin-reset-password button').filter({hasText:'بستن'}).click();
 await page.evaluate(({OTHER})=>adminOpenPasswordReset(OTHER),{OTHER});
 await page.locator('#admin-reset-password').fill('Second!StrongPassword123');
 await page.locator('#admin-reset-password-confirm').fill('Second!StrongPassword123');
 await page.evaluate(outcome=>window.__finishPasswordReset(outcome==='success'?{data:{ok:true},error:null}:{data:null,error:{message:'failed'}}),outcome);
 await expect(page.locator('#admin-reset-password-submit')).toBeEnabled();
 await expect(page.locator('#admin-password-reset-user')).toHaveText('other@example.invalid');
 await expect(page.locator('#admin-password-reset-status')).toBeEmpty();
 await expect(page.locator('#admin-reset-password')).toHaveValue('Second!StrongPassword123');
 await expect(page.locator('#admin-reset-password-confirm')).toHaveValue('Second!StrongPassword123');
 expect(await page.evaluate(()=>window.__recoveryCalls)).toHaveLength(1);
});

test('central password action rejects another submission while its request is pending',async({page})=>{
 await managerFixture(page);
 await page.evaluate(async({TARGET})=>{
  await renderAdminPanel();adminOpenPasswordReset(TARGET);
  sb.functions.invoke=(name,{body})=>{window.__recoveryCalls.push({name,body});return new Promise(resolve=>{window.__finishPasswordReset=resolve})};
  for(let i=0;i<2;i++){
   document.getElementById('admin-reset-password').value='Strong!Password123';
   document.getElementById('admin-reset-password-confirm').value='Strong!Password123';
   adminSetPassword();
  }
 },{TARGET});
 expect(await page.evaluate(()=>window.__recoveryCalls)).toHaveLength(1);
 await page.evaluate(()=>window.__finishPasswordReset({data:{ok:true},error:null}));
});
