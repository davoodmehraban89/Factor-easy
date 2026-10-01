const {test,expect}=require('@playwright/test');

async function boot(page,{configure=true,create=true}={}){
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.requestsRender==='function'&&typeof window.requestD2PublishType==='function');
  await page.evaluate(({configure,create})=>{
    window.__d2={rpc:[],alerts:[],publishMode:'ok',createAttempts:0};
    window.alert=m=>window.__d2.alerts.push(String(m));
    currentUser={id:'11111111-1111-1111-1111-111111111111',email:'d2@example.test',organizationId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',organizationName:'D2 Org',isOrganizationOwner:false,commercialModules:['requests_workflow'],modulePermissions:[{module_key:'requests_workflow',capabilities:['read',...(configure?['configure']:[]),...(create?['create']:[])]}],modules:['requests_workflow'],subscription:{type:'lifetime',status:'active',endDate:'2099-01-01'}};
    const defs=[{id:'d1111111-1111-1111-1111-111111111111',organization_id:currentUser.organizationId,code:'PURCHASE',title:'درخواست خرید',category:'تدارکات',revision:2,active:true}];
    const versions=[{id:'v1111111-1111-1111-1111-111111111111',organization_id:currentUser.organizationId,request_type_id:defs[0].id,version_no:2,title:'درخواست خرید',category:'تدارکات',form_schema:{schemaVersion:1,fields:[{key:'f1',label:'شرح خرید',type:'text',required:true}]},published_at:'2026-10-01T00:00:00Z'}];
    const instances=[];\n    window.__d2.versions=versions;
    sb.from=(table)=>({select:()=>({eq:()=>({order:()=>Promise.resolve({data:table==='request_type_definitions'?defs:table==='request_type_versions'?versions:instances,error:null})})})});
    sb.rpc=async(name,args)=>{
      window.__d2.rpc.push({name,args:JSON.parse(JSON.stringify(args))});
      if(name==='request_publish_type_version'){
        if(window.__d2.publishMode==='stale')return {data:null,error:{message:'stale definition revision'}};
        return {data:[{request_type_id:defs[0].id,request_type_version_id:versions[0].id,workflow_version_id:'w1111111-1111-1111-1111-111111111111',version_no:3,definition_revision:3}],error:null};
      }
      if(name==='request_create_instance'){
        window.__d2.createAttempts++;
        if(window.__d2.createAttempts===1)return {data:null,error:{message:'network test failure'}};
        return {data:'r1111111-1111-1111-1111-111111111111',error:null};
      }
      return {data:null,error:null};
    };
    switchView('view-requests');
  },{configure,create});
}

test('D2 builder shows published state and publishes through server RPC',async({page})=>{
  await boot(page);
  await page.evaluate(()=>requestsRender('types'));
  await expect(page.locator('#view-requests')).toContainText('نسخه ۲');
  await page.evaluate(()=>requestD2EditType('d1111111-1111-1111-1111-111111111111'));
  await expect(page.locator('#request-d2-draft-state')).toContainText('منتشرشده');
  await page.fill('#request-d2-title','درخواست خرید اصلاح‌شده');
  await page.dispatchEvent('#request-d2-title','input');
  await expect(page.locator('#request-d2-draft-state')).toContainText('تغییرات منتشرنشده');
  await page.evaluate(()=>requestD2PublishType());
  await expect.poll(()=>page.evaluate(()=>window.__d2.rpc.filter(x=>x.name==='request_publish_type_version').length)).toBe(1);
  const call=await page.evaluate(()=>window.__d2.rpc.find(x=>x.name==='request_publish_type_version'));
  expect(call.args.p_expected_definition_revision).toBe(2);
  expect(call.args.p_form_schema.fields[0].label).toBe('شرح خرید');
});

test('D2 hides publishing for users without configure capability',async({page})=>{
  await boot(page,{configure:false});
  await page.evaluate(()=>requestsRender('types'));
  await expect(page.locator('#view-requests')).toContainText('دسترسی پیکربندی ندارید');
  await expect(page.locator('#request-d2-publish')).toHaveCount(0);
});

test('D2 retries create with the same idempotency key',async({page})=>{
  await boot(page);
  await page.evaluate(()=>requestsRender('new'));
  await page.selectOption('#request-d2-type-version','v1111111-1111-1111-1111-111111111111');
  await page.fill('.request-d2-value','یک لپ‌تاپ');
  await page.evaluate(()=>requestD2CreateInstance());
  await expect(page.locator('#request-d2-error')).toContainText('تلاش دوباره');
  await page.evaluate(()=>requestD2CreateInstance());
  await expect.poll(()=>page.evaluate(()=>window.__d2.rpc.filter(x=>x.name==='request_create_instance').length)).toBe(2);
  const keys=await page.evaluate(()=>window.__d2.rpc.filter(x=>x.name==='request_create_instance').map(x=>x.args.p_idempotency_key));
  expect(keys[0]).toBe(keys[1]);
});

test('D2 stale publish revision refreshes instead of overwriting',async({page})=>{
  await boot(page);
  await page.evaluate(async()=>{await requestsRender('types');requestD2EditType('d1111111-1111-1111-1111-111111111111');window.__d2.publishMode='stale';await requestD2PublishType()});
  const alerts=await page.evaluate(()=>window.__d2.alerts);
  expect(alerts.some(x=>x.includes('نسخه فرم در سرور تغییر کرده است'))).toBe(true);
  const call=await page.evaluate(()=>window.__d2.rpc.find(x=>x.name==='request_publish_type_version'));
  expect(call.args.p_expected_definition_revision).toBe(2);
});


test('D2 renders and serializes all supported immutable form field types',async({page})=>{
  await boot(page);
  await page.evaluate(()=>{
    window.__d2.versions[0].form_schema={schemaVersion:1,fields:[
      {key:'title',label:'عنوان',type:'text',required:true},
      {key:'amount',label:'مبلغ',type:'number',required:true},
      {key:'due',label:'تاریخ',type:'date',required:true},
      {key:'note',label:'شرح',type:'textarea',required:false},
      {key:'kind',label:'نوع',type:'select',required:true,options:['فوری','عادی']}
    ]};
  });
  await page.evaluate(()=>requestsRender('new'));
  await page.selectOption('#request-d2-type-version','v1111111-1111-1111-1111-111111111111');
  await expect(page.locator('.request-d2-value')).toHaveCount(5);
  await expect(page.locator('input[data-type="date"]')).toHaveAttribute('type','date');
  await expect(page.locator('select[data-type="select"] option')).toHaveCount(3);
  await page.fill('[data-key="title"]','خرید');
  await page.fill('[data-key="amount"]','1250.5');
  await page.fill('[data-key="due"]','2026-10-10');
  await page.fill('[data-key="note"]','تست');
  await page.selectOption('[data-key="kind"]','فوری');
  await page.evaluate(()=>requestD2CreateInstance());
  const call=await page.evaluate(()=>window.__d2.rpc.find(x=>x.name==='request_create_instance'));
  expect(call.args.p_values).toEqual({title:'خرید',amount:1250.5,due:'2026-10-10',note:'تست',kind:'فوری'});
});

test('D2 select option authoring is preserved in publish payload',async({page})=>{
  await boot(page);
  await page.evaluate(async()=>{await requestsRender('types');requestD2EditType('d1111111-1111-1111-1111-111111111111')});
  await page.selectOption('.request-d2-field select','select');
  await page.fill('.request-d2-options','فوری، عادی, ویژه');
  await page.evaluate(()=>requestD2PublishType());
  const call=await page.evaluate(()=>window.__d2.rpc.find(x=>x.name==='request_publish_type_version'));
  expect(call.args.p_form_schema.fields[0].type).toBe('select');
  expect(call.args.p_form_schema.fields[0].options).toEqual(['فوری','عادی','ویژه']);
});
