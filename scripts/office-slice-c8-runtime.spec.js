const {test,expect}=require('@playwright/test');
async function boot(page,rpc){
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.addStyleTag({content:'#auth-screen,.app-root{display:none!important;pointer-events:none!important}#c8-runtime-root{display:block!important;position:relative!important;z-index:2147483647!important}'});
  await page.evaluate((rpcPlan)=>{
    window.currentUser={id:'11111111-1111-4111-8111-111111111111',organizationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};
    window.hasFinoraCapability=(m,c)=>m==='office_automation'&&['read','refer','approve','configure'].includes(c);
    window.__c8RuntimeCalls=[];window.__c8Plan=rpcPlan;
    window.sb={rpc:async(name,args)=>{window.__c8RuntimeCalls.push({name,args});const list=window.__c8Plan[name]||[];const next=list.shift();return next||{data:null,error:{message:'unexpected rpc '+name}}}};
    window.crypto.randomUUID=()=> '90000000-0000-4000-8000-000000000001';
  },rpc);
  await page.addScriptTag({url:'http://127.0.0.1:4173/js/office-workflow.js'});
  await page.evaluate(()=>{const root=document.createElement('div');root.id='c8-runtime-root';document.body.append(root)});
}
const readState={instance:{instance_id:'70000000-0000-4000-8000-000000000001',policy_key:'flow',policy_version:3,policy_title:'گردش <script>alert(1)</script>',stage_id:'review',stage_label:'بررسی <img src=x onerror=alert(1)>',revision:4},allowed_edges:[{id:'approve_it',from:'review',to:'done',label:'تأیید <b>نهایی</b>',capability:'approve'}],events:[{event_id:'e1',revision:0,event_type:'attach',edge_id:null,edge_label:null,from_stage_id:null,from_stage_label:null,to_stage_id:'start',to_stage_label:'شروع <svg/onload=alert(1)>',actor_id:'u1',note:null,created_at:'2026-10-01T00:00:00Z'},{event_id:'e2',revision:4,event_type:'transition',edge_id:'to_review',edge_label:'ارجاع <iframe>',from_stage_id:'start',from_stage_label:'شروع',to_stage_id:'review',to_stage_label:'بررسی',actor_id:'u1',note:'متن <script>x</script>',created_at:'2026-10-01T01:00:00Z'}],next_after_revision:4};

test('C8 runtime renders server text safely and transitions with expected revision',async({page})=>{
  await boot(page,{office_workflow_read:[{data:readState,error:null}],office_workflow_transition:[{data:{instance_id:readState.instance.instance_id,stage_id:'done',revision:5,event_id:'e3'},error:null},{data:null,error:{message:'unexpected second transition'}}]});
  await page.evaluate(()=>window.officeWorkflowMountRuntime(document.getElementById('c8-runtime-root'),'LETTER_1'));
  await expect(page.locator('#c8-runtime-root')).toContainText('بررسی <img src=x onerror=alert(1)>');
  await expect(page.locator('#c8-runtime-root script,#c8-runtime-root img,#c8-runtime-root iframe,#c8-runtime-root svg')).toHaveCount(0);
  page.once('dialog',d=>d.accept('یادداشت'));
  await page.getByRole('button',{name:'تأیید <b>نهایی</b>'}).click();
  const calls=await page.evaluate(()=>window.__c8RuntimeCalls);
  const transition=calls.find(x=>x.name==='office_workflow_transition');
  expect(transition.args.p_instance_id).toBe(readState.instance.instance_id);
  expect(transition.args.p_edge_id).toBe('approve_it');
  expect(transition.args.p_expected_revision).toBe(4);
  expect(transition.args.p_request_id).toBe('90000000-0000-4000-8000-000000000001');
});

test('C8 stale transition refreshes state and never blind-retries mutation',async({page})=>{
  const fresh={...readState,instance:{...readState.instance,revision:5,stage_id:'done',stage_label:'پایان'},allowed_edges:[]};
  await boot(page,{office_workflow_read:[{data:readState,error:null},{data:fresh,error:null}],office_workflow_transition:[{data:null,error:{code:'40001',message:'stale workflow revision'}}]});
  await page.evaluate(()=>window.officeWorkflowMountRuntime(document.getElementById('c8-runtime-root'),'LETTER_2'));
  page.once('dialog',d=>d.accept(''));
  await page.getByRole('button',{name:'تأیید <b>نهایی</b>'}).click();
  await expect(page.getByRole('status')).toContainText('اطلاعات تازه شد');
  const calls=await page.evaluate(()=>window.__c8RuntimeCalls);
  expect(calls.filter(x=>x.name==='office_workflow_transition')).toHaveLength(1);
  expect(calls.filter(x=>x.name==='office_workflow_read')).toHaveLength(2);
  await expect(page.locator('[data-role="workflow-edge-actions"] button')).toHaveCount(0);
});

test('C8 network retry reuses request id and read-only state exposes no mutation control',async({page})=>{
  await boot(page,{office_workflow_read:[{data:readState,error:null}],office_workflow_transition:[{data:null,error:{message:'Failed to fetch'}},{data:{instance_id:readState.instance.instance_id,stage_id:'done',revision:5,event_id:'e3'},error:null}]});
  await page.evaluate(()=>window.officeWorkflowMountRuntime(document.getElementById('c8-runtime-root'),'LETTER_3'));
  page.on('dialog',d=>d.accept('same note'));
  const button=page.getByRole('button',{name:'تأیید <b>نهایی</b>'});
  await button.click();await expect(page.getByRole('status')).toContainText('دوباره تلاش');await button.click();
  const calls=await page.evaluate(()=>window.__c8RuntimeCalls.filter(x=>x.name==='office_workflow_transition'));
  expect(calls).toHaveLength(2);expect(calls[0].args.p_request_id).toBe(calls[1].args.p_request_id);
  await page.evaluate(()=>{window.__c8Plan.office_workflow_read=[{data:{...window.__c8Plan.__unused,instance:null,allowed_edges:[],events:[],next_after_revision:-1},error:null}]});
});

test('C8 unattached correspondence offers policy attach and sends idempotency key',async({page})=>{
  await boot(page,{office_workflow_read:[{data:{instance:null,allowed_edges:[],events:[],next_after_revision:-1},error:null},{data:readState,error:null}],office_workflow_catalog:[{data:[{policy_key:'flow',version:3,title:'گردش اصلی',definition:{stages:[],edges:[]}}],error:null}],office_workflow_attach:[{data:{instance_id:readState.instance.instance_id,stage_id:'start',revision:0,event_id:'e0'},error:null}]});
  await page.evaluate(()=>window.officeWorkflowMountRuntime(document.getElementById('c8-runtime-root'),'LETTER_4'));
  await page.getByLabel('سیاست گردش').selectOption('flow::3');
  await page.getByRole('button',{name:'اتصال گردش'}).click();
  const calls=await page.evaluate(()=>window.__c8RuntimeCalls);
  const attach=calls.find(x=>x.name==='office_workflow_attach');
  expect(attach.args).toMatchObject({p_correspondence_id:'LETTER_4',p_policy_key:'flow',p_policy_version:3,p_request_id:'90000000-0000-4000-8000-000000000001'});
  await expect(page.locator('#c8-runtime-root')).toContainText('گردش <script>alert(1)</script>');
});
