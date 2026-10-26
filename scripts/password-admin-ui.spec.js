const {test,expect}=require('@playwright/test');
const BASE=process.env.FINORA_TEST_BASE_URL||'http://127.0.0.1:4173/index.html';
const ACTOR='11111111-1111-4111-8111-111111111111';
const TARGET='22222222-2222-4222-8222-222222222222';
const OTHER='33333333-3333-4333-8333-333333333333';
const ORG='44444444-4444-4444-8444-444444444444';
const MEMBER='55555555-5555-4555-8555-555555555555';

async function managerFixture(page,kind='global'){
 await page.route(/https:\/\/[^/]*supabase\.co\//,route=>route.abort());
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
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
