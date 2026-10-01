const {test,expect}=require('@playwright/test');
test('Office C8 policy editor publishes a two-stage policy',async({page})=>{
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{
    const auth=document.getElementById('auth-screen');if(auth)auth.style.display='none';
    window.currentUser={organizationId:'11111111-1111-1111-1111-111111111111'};
    window.hasFinoraCapability=(moduleKey,capability)=>moduleKey==='office_automation'&&capability==='configure';
    window.__c8Calls=[];
    window.sb={rpc:async(name,args)=>{
      window.__c8Calls.push({name,args});
      if(name==='office_workflow_publish')return {data:2,error:null};
      if(name==='office_workflow_catalog')return {data:[{policy_key:'main_flow',version:2,title:'عنوان نسخه دوم',definition:{stages:[],edges:[]}}],error:null};
      return {data:null,error:{message:'unexpected rpc'}};
    }};
  });
  await page.addScriptTag({url:'http://127.0.0.1:4173/js/office-workflow.js'});
  await page.evaluate(()=>{const root=document.createElement('div');root.id='c8-root';document.body.append(root);window.officeWorkflowMountAdmin(root)});
  await page.getByLabel('کلید سیاست').fill('main_flow');
  await page.getByLabel('عنوان سیاست').fill('گردش اصلی');
  await page.getByRole('button',{name:'افزودن مرحله'}).click();
  await page.getByRole('button',{name:'افزودن مرحله'}).click();
  const rows=page.locator('.office-workflow-stage-row');
  await rows.nth(0).getByLabel('شناسه مرحله').fill('start');
  await rows.nth(0).getByLabel('عنوان مرحله').fill('شروع');
  await rows.nth(0).getByLabel('مرحله شروع').check();
  await rows.nth(1).getByLabel('شناسه مرحله').fill('done');
  await rows.nth(1).getByLabel('عنوان مرحله').fill('پایان');
  await rows.nth(1).getByLabel('مرحله پایان').check();
  await page.getByRole('button',{name:'افزودن انتقال'}).click();
  const edge=page.locator('.office-workflow-edge-row').first();
  await edge.getByLabel('شناسه انتقال').fill('submit');
  await edge.getByLabel('از مرحله').fill('start');
  await edge.getByLabel('به مرحله').fill('done');
  await edge.getByLabel('عنوان انتقال').fill('ارسال');
  await edge.getByLabel('مجوز لازم').selectOption('refer');
  await page.getByRole('button',{name:'انتشار نسخه'}).click();
  await expect(page.getByRole('status')).toContainText('نسخه 2 منتشر شد.');
  const rpcCalls=await page.evaluate(()=>window.__c8Calls);
  const publish=rpcCalls.find(x=>x.name==='office_workflow_publish');
  expect(publish.args.p_policy_key).toBe('main_flow');
  expect(publish.args.p_definition.stages).toHaveLength(2);
  expect(publish.args.p_definition.edges).toEqual([{id:'submit',from:'start',to:'done',label:'ارسال',capability:'refer'}]);
  await expect(page.locator('[data-role="catalog"]')).toContainText('عنوان نسخه دوم');
});
test('Office C8 policy publish control is authority-safe',async({page})=>{
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{
    const auth=document.getElementById('auth-screen');if(auth)auth.style.display='none';
    window.currentUser={organizationId:'22222222-2222-2222-2222-222222222222'};
    window.hasFinoraCapability=()=>false;
    window.sb={rpc:async()=>({data:[],error:null})};
  });
  await page.addScriptTag({url:'http://127.0.0.1:4173/js/office-workflow.js'});
  await page.evaluate(()=>{const root=document.createElement('div');root.id='c8-root';document.body.append(root);window.officeWorkflowMountAdmin(root)});
  await expect(page.getByRole('button',{name:'انتشار نسخه'})).toBeDisabled();
  await expect(page.locator('#c8-root')).toContainText('مرحله گردش، جایگزین ثبت دبیرخانه یا تأیید داخلی نامه نیست.');
});