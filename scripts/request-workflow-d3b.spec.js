const {test,expect}=require('@playwright/test');

async function boot(page){
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.requestD3bAddStep==='function'&&typeof window.requestD3bOpenTimeline==='function');
 await page.evaluate(()=>{
  window.__d3b={rpc:[],alerts:[]};window.alert=m=>window.__d3b.alerts.push(String(m));
  currentUser={id:'11111111-1111-1111-1111-111111111111',email:'d3b@example.test',organizationId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',organizationName:'D3b Org',isOrganizationOwner:false,commercialModules:['requests_workflow'],modulePermissions:[{module_key:'requests_workflow',capabilities:['read','configure','create','edit','approve']}],modules:['requests_workflow'],subscription:{type:'lifetime',status:'active',endDate:'2099-01-01'}};
  const defs=[{id:'d1111111-1111-1111-1111-111111111111',organization_id:currentUser.organizationId,code:'PURCHASE',title:'درخواست خرید',category:'تدارکات',revision:2,active:true}];
  const versions=[{id:'v1111111-1111-1111-1111-111111111111',organization_id:currentUser.organizationId,request_type_id:defs[0].id,version_no:2,title:'درخواست خرید',category:'تدارکات',form_schema:{schemaVersion:1,fields:[{key:'f1',label:'مبلغ',type:'number',required:true}]},published_at:'2026-10-01T00:00:00Z'}];
  const workflows=[{id:'w1111111-1111-1111-1111-111111111111',organization_id:currentUser.organizationId,request_type_version_id:versions[0].id,workflow_schema:{schemaVersion:2,steps:[{key:'manager',title:'مدیر',mode:'sequential',requiredApprovals:1,requiredCapability:'approve'}]},published_at:'2026-10-01T00:00:00Z'}];
  const instances=[{id:'r1111111-1111-1111-1111-111111111111',organization_id:currentUser.organizationId,request_type_version_id:versions[0].id,requester_user_id:currentUser.id,status:'submitted',revision:2,updated_at:'2026-10-01T00:00:00Z'}];
  sb.from=(table)=>({select:()=>({eq:()=>({order:()=>Promise.resolve({data:table==='request_type_definitions'?defs:table==='request_type_versions'?versions:table==='request_workflow_versions'?workflows:instances,error:null})})})});
  sb.rpc=async(name,args)=>{window.__d3b.rpc.push({name,args:JSON.parse(JSON.stringify(args||{}))});if(name==='request_publish_type_version')return {data:[{request_type_id:defs[0].id,request_type_version_id:versions[0].id,workflow_version_id:workflows[0].id,version_no:3,definition_revision:3}],error:null};if(name==='request_workflow_timeline')return {data:{request:{id:instances[0].id,status:'submitted',revision:2},steps:[{key:'manager',title:'مدیر',index:1,mode:'sequential',state:'skipped',requiredApprovals:1,approvalsReceived:0,conditionMatched:false},{key:'finance',title:'مالی',index:2,mode:'parallel',state:'active',requiredApprovals:2,approvalsReceived:1,conditionMatched:true}],events:[]},error:null};return {data:null,error:null}};
  switchView('view-requests');
 });
}

test('D3b visual editor publishes ordered steps with a bounded condition',async({page})=>{
 await boot(page);await page.evaluate(async()=>{await requestsRender('types');await requestD2EditType('d1111111-1111-1111-1111-111111111111')});
 await expect(page.locator('#request-d3b-editor')).toBeVisible();
 await expect(page.locator('.request-d3b-step')).toHaveCount(1);
 await page.evaluate(()=>requestD3bAddStep());
 await expect(page.locator('.request-d3b-step')).toHaveCount(2);
 await page.fill('.request-d3b-step:nth-child(2) [data-d3b="key"]','finance');
 await page.fill('.request-d3b-step:nth-child(2) [data-d3b="title"]','مالی');
 await page.selectOption('.request-d3b-step:nth-child(2) [data-d3b="mode"]','parallel');
 await page.fill('.request-d3b-step:nth-child(2) [data-d3b="approvals"]','2');
 await page.selectOption('.request-d3b-step:nth-child(2) [data-d3b="condition-field"]','f1');
 await page.selectOption('.request-d3b-step:nth-child(2) [data-d3b="condition-op"]','gte');
 await page.fill('.request-d3b-step:nth-child(2) [data-d3b="condition-value"]','1000');
 await page.evaluate(()=>requestD3bPublishCombined());
 const call=await page.evaluate(()=>window.__d3b.rpc.find(x=>x.name==='request_publish_type_version'));
 expect(call.args.p_workflow_schema.schemaVersion).toBe(2);expect(call.args.p_workflow_schema.steps).toHaveLength(2);expect(call.args.p_workflow_schema.steps[1].condition).toEqual({field:'f1',op:'gte',value:1000});
 await expect(page.locator('#request-d3b-editor')).toBeVisible();
 await expect(page.locator('.request-d3b-step')).toHaveCount(2);
});

test('D3b renders a read-only timeline with skipped and active condition evidence',async({page})=>{
 await boot(page);await page.evaluate(()=>requestsRender('mine'));
 await expect(page.locator('#request-d3b-runtime')).toBeVisible();
 await page.evaluate(()=>requestD3bOpenTimeline('r1111111-1111-1111-1111-111111111111'));
 await expect(page.locator('#request-d3b-timeline')).toContainText('رد شده توسط شرط');
 await expect(page.locator('#request-d3b-timeline')).toContainText('فعال');
 await expect(page.locator('#request-d3b-timeline')).toContainText('۱ از ۲');
});
