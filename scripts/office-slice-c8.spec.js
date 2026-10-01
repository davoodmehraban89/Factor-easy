const {test,expect}=require('@playwright/test');
async function isolatePolicyEditor(page){
  await page.addStyleTag({content:'#auth-screen,.app-root{display:none!important;pointer-events:none!important}#c8-root{display:block!important;position:relative!important;z-index:2147483647!important}'});
}
test('Office C8 policy editor publishes a two-stage policy',async({page})=>{
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await isolatePolicyEditor(page);
  await page.evaluate(()=>{
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
  await isolatePolicyEditor(page);
  await page.evaluate(()=>{
    window.currentUser={organizationId:'22222222-2222-2222-2222-222222222222'};
    window.hasFinoraCapability=()=>false;
    window.sb={rpc:async()=>({data:[],error:null})};
  });
  await page.addScriptTag({url:'http://127.0.0.1:4173/js/office-workflow.js'});
  await page.evaluate(()=>{const root=document.createElement('div');root.id='c8-root';document.body.append(root);window.officeWorkflowMountAdmin(root)});
  await expect(page.getByRole('button',{name:'انتشار نسخه'})).toBeDisabled();
  await expect(page.locator('#c8-root')).toContainText('مرحله گردش، جایگزین ثبت دبیرخانه یا تأیید داخلی نامه نیست.');
});

async function mountWorkflowPanel(page,rpcHandler){
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.addStyleTag({content:'#auth-screen,.app-root{display:none!important;pointer-events:none!important}#c8-root{display:block!important;position:relative!important;z-index:2147483647!important}'});
  await page.evaluate(()=>{const root=document.createElement('div');root.id='c8-root';document.body.append(root)});
  await page.evaluate((handlerSource)=>{
    window.currentUser={organizationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};
    window.__c8Calls=[];
    window.__c8RpcHandler=eval('('+handlerSource+')');
    window.sb={rpc:async(name,args)=>{window.__c8Calls.push({name,args});return window.__c8RpcHandler(name,args)}};
  },rpcHandler.toString());
  await page.addScriptTag({url:'http://127.0.0.1:4173/js/office-workflow.js'});
}

test('Office C8 correspondence panel renders stage, history and performs one transition',async({page})=>{
  await mountWorkflowPanel(page,(name,args)=>{
    if(name==='office_workflow_read')return {data:{instance:{instance_id:'30000000-0000-4000-8000-000000000001',stage_id:'review',revision:0},allowed_edges:[{id:'approve',label:'تأیید',from:'review',to:'done',capability:'approve'}],events:[{revision:0,event_type:'attach',to_stage_label:'<b>بررسی</b>',actor_id:'u1',created_at:'2026-10-01T10:00:00Z'}],next_after_revision:0},error:null};
    if(name==='office_workflow_transition')return {data:{instance_id:args.p_instance_id,stage_id:'done',revision:1,event_id:'e2'},error:null};
    return {data:null,error:{message:'unexpected '+name}};
  });
  await page.evaluate(()=>window.officeWorkflowOpen('LETTER-1',document.getElementById('c8-root')));
  await expect(page.locator('#c8-root')).toContainText('مرحله گردش، جایگزین ثبت دبیرخانه یا تأیید داخلی نامه نیست.');
  await expect(page.locator('#c8-root')).toContainText('<b>بررسی</b>');
  await expect(page.locator('#c8-root b')).toHaveCount(0);
  await page.getByRole('button',{name:'تأیید'}).click();
  const calls=await page.evaluate(()=>window.__c8Calls);
  const transition=calls.find(x=>x.name==='office_workflow_transition');
  expect(transition.args.p_expected_revision).toBe(0);
  expect(transition.args.p_edge_id).toBe('approve');
  expect(transition.args.p_request_id).toMatch(/^[0-9a-f-]{36}$/i);
  await expect(page.locator('#c8-root')).toContainText('مرحله فعلی: done');
});

test('Office C8 transition disables duplicate intent and refreshes stale revision without auto retry',async({page})=>{
  await mountWorkflowPanel(page,(name,args)=>{
    window.__reads=(window.__reads||0)+(name==='office_workflow_read'?1:0);
    if(name==='office_workflow_read')return {data:{instance:{instance_id:'30000000-0000-4000-8000-000000000002',stage_id:window.__reads>1?'done':'review',revision:window.__reads>1?1:0},allowed_edges:window.__reads>1?[]:[{id:'approve',label:'تأیید',from:'review',to:'done',capability:'approve'}],events:[],next_after_revision:window.__reads>1?1:0},error:null};
    if(name==='office_workflow_transition')return {data:null,error:{message:'stale workflow revision',code:'40001'}};
    return {data:null,error:{message:'unexpected'}};
  });
  await page.evaluate(()=>window.officeWorkflowOpen('LETTER-2',document.getElementById('c8-root')));
  const button=page.getByRole('button',{name:'تأیید'});
  await button.dblclick();
  await expect(page.locator('[role="status"]')).toContainText('تغییر هم‌زمان');
  const calls=await page.evaluate(()=>window.__c8Calls);
  expect(calls.filter(x=>x.name==='office_workflow_transition')).toHaveLength(1);
  expect(calls.filter(x=>x.name==='office_workflow_read')).toHaveLength(2);
  await expect(page.locator('#c8-root')).toContainText('مرحله فعلی: done');
});

test('Office C8 discards a late response after organization switch',async({page})=>{
  await mountWorkflowPanel(page,(name,args)=>new Promise(resolve=>setTimeout(()=>resolve({data:{instance:{instance_id:'30000000-0000-4000-8000-000000000003',stage_id:'secret',revision:0},allowed_edges:[],events:[],next_after_revision:0},error:null}),80)));
  await page.evaluate(()=>{window.__late=window.officeWorkflowOpen('LETTER-3',document.getElementById('c8-root'));setTimeout(()=>{window.currentUser.organizationId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},10)});
  await page.waitForTimeout(140);
  await expect(page.locator('#c8-root')).not.toContainText('secret');
});

test('Office C8 attach uses catalog selection and keeps one request id for the same pending intent',async({page})=>{
  await mountWorkflowPanel(page,(name,args)=>{
    if(name==='office_workflow_read')return {data:{instance:null,allowed_edges:[],events:[],next_after_revision:-1},error:null};
    if(name==='office_workflow_catalog')return {data:[{policy_key:'main',version:3,title:'گردش اصلی',definition:{stages:[],edges:[]}}],error:null};
    if(name==='office_workflow_attach')return {data:{instance_id:'30000000-0000-4000-8000-000000000004',stage_id:'start',revision:0,event_id:'e0'},error:null};
    return {data:null,error:{message:'unexpected'}};
  });
  await page.evaluate(()=>window.officeWorkflowOpen('LETTER-4',document.getElementById('c8-root')));
  await page.getByLabel('سیاست گردش').selectOption('main@3');
  await page.getByRole('button',{name:'اتصال گردش'}).dblclick();
  const calls=await page.evaluate(()=>window.__c8Calls);
  const attach=calls.filter(x=>x.name==='office_workflow_attach');
  expect(attach).toHaveLength(1);
  expect(attach[0].args.p_policy_key).toBe('main');
  expect(attach[0].args.p_policy_version).toBe(3);
  expect(attach[0].args.p_request_id).toMatch(/^[0-9a-f-]{36}$/i);
  await expect(page.locator('#c8-root')).toContainText('مرحله فعلی: start');
});