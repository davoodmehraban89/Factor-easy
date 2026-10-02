const {test,expect}=require('@playwright/test');

test('D3c adds SLA configuration and surfaces outbox/runtime operations',async({page})=>{
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.requestD3cCreateDelegation==='function');
 await page.evaluate(()=>{
  window.__d3c={rpc:[]};window.alert=()=>{};
  currentUser={id:'11111111-1111-1111-1111-111111111111',email:'owner@example.test',organizationId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',organizationName:'D3c Org',isOrganizationOwner:true,commercialModules:['requests_workflow'],modulePermissions:[{module_key:'requests_workflow',capabilities:['read','configure','create','edit','approve']}],modules:['requests_workflow'],subscription:{type:'lifetime',status:'active',endDate:'2099-01-01'}};
  const defs=[{id:'d1111111-1111-1111-1111-111111111111',organization_id:currentUser.organizationId,code:'OPS',title:'عملیات',category:'Workflow',revision:2,active:true}];
  const versions=[{id:'v1111111-1111-1111-1111-111111111111',organization_id:currentUser.organizationId,request_type_id:defs[0].id,version_no:2,title:'عملیات',category:'Workflow',form_schema:{schemaVersion:1,fields:[{key:'f1',label:'مبلغ',type:'number',required:true}]},published_at:'2026-10-01T00:00:00Z'}];
  const workflows=[{id:'w1111111-1111-1111-1111-111111111111',organization_id:currentUser.organizationId,request_type_version_id:versions[0].id,workflow_schema:{schemaVersion:2,steps:[{key:'approve',title:'تأیید',mode:'sequential',requiredApprovals:1,requiredCapability:'approve',slaHours:4},{key:'finance',title:'مالی',mode:'sequential',requiredApprovals:1,requiredCapability:'approve',slaHours:12}],onApproved:[{targetModule:'commerce',actionKey:'create_purchase_draft',payload:{}}]},published_at:'2026-10-01T00:00:00Z'}];
  const instances=[{id:'r1111111-1111-1111-1111-111111111111',organization_id:currentUser.organizationId,request_type_version_id:versions[0].id,requester_user_id:currentUser.id,status:'approved',revision:2,updated_at:'2026-10-01T00:00:00Z'}];
  const members=[{id:'m1',organization_id:currentUser.organizationId,user_id:currentUser.id,status:'active',is_owner:true},{id:'m2',organization_id:currentUser.organizationId,user_id:'55555555-5555-5555-5555-555555555555',status:'active',is_owner:false}];
  sb.from=(table)=>({select:()=>({eq:()=>({order:()=>Promise.resolve({data:table==='request_type_definitions'?defs:table==='request_type_versions'?versions:table==='request_workflow_versions'?workflows:table==='organization_members'?members:instances,error:null})})})});
  sb.rpc=async(name,args)=>{window.__d3c.rpc.push({name,args:JSON.parse(JSON.stringify(args||{}))});if(name==='request_publish_type_version')return {data:[{request_type_id:defs[0].id,request_type_version_id:versions[0].id,workflow_version_id:workflows[0].id,version_no:3,definition_revision:3}],error:null};if(name==='request_workflow_timeline')return {data:{request:{id:instances[0].id,status:'approved',revision:2},steps:[{key:'approve',title:'تأیید',index:1,mode:'sequential',state:'completed',requiredApprovals:1,approvalsReceived:1,conditionMatched:true,slaHours:4,dueAt:'2026-10-01T04:00:00Z',escalatedAt:null,escalationLevel:0}],events:[]},error:null};if(name==='request_outbox_status')return {data:[{targetModule:'commerce',actionKey:'create_purchase_draft',status:'pending',attempts:0,createdAt:'2026-10-01T01:00:00Z'}],error:null};if(name==='request_list_delegations')return {data:[],error:null};if(name==='request_escalate_overdue')return {data:0,error:null};return {data:null,error:null}};
  switchView('view-requests');
 });
 await page.evaluate(async()=>{await requestsRender('types');await requestD2EditType('d1111111-1111-1111-1111-111111111111')});
 await expect(page.locator('[data-d3c-sla]').nth(0)).toHaveValue('4');
 await expect(page.locator('[data-d3c-sla]').nth(1)).toHaveValue('12');
 await page.fill('[data-d3c-sla][data-d3c-step-key="approve"]','8');
 await page.evaluate(()=>requestD3bMoveStep(0,1));
 await expect(page.locator('[data-d3c-sla][data-d3c-step-key="approve"]')).toHaveValue('8');
 await expect(page.locator('[data-d3c-sla][data-d3c-step-key="finance"]')).toHaveValue('12');
 await page.evaluate(()=>requestD3bPublishCombined());
 const call=await page.evaluate(()=>window.__d3c.rpc.find(x=>x.name==='request_publish_type_version'));
 expect(call.args.p_workflow_schema.steps.find(x=>x.key==='approve').slaHours).toBe(8);
 expect(call.args.p_workflow_schema.steps.find(x=>x.key==='finance').slaHours).toBe(12);
 await page.evaluate(()=>requestsRender('mine'));
 await expect(page.locator('#request-d3c-ops')).toBeVisible();
 await page.selectOption('#request-d3c-delegate-user','55555555-5555-5555-5555-555555555555');
 await page.evaluate(()=>requestD3cCreateDelegation());
 const delegationCall=await page.evaluate(()=>window.__d3c.rpc.find(x=>x.name==='request_create_delegation'));
 expect(delegationCall.args.p_idempotency_key).toMatch(/^delegation-/);
 await page.evaluate(()=>requestD3bOpenTimeline('r1111111-1111-1111-1111-111111111111'));
 await expect(page.locator('#request-d3c-runtime-evidence')).toContainText('SLA');
 await expect(page.locator('#request-d3c-runtime-evidence')).toContainText('در انتظار ارسال');
});
