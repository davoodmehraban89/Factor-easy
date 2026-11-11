const {test,expect}=require('@playwright/test');
const BASE=process.env.FINORA_TEST_BASE_URL||'http://127.0.0.1:4173/index.html';

async function fixture(page){
  await page.route(/https:\/\/[^/]*supabase\.co\//,route=>route.abort());
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.FinoraStartupStatus?.extensionsReady&&window.FinoraStartupStatus?.authChecked);
  await page.evaluate(async()=>{
    window.__syncQA={calls:[],reads:0,alerts:[],mode:'audit',ack:'complete',error:null,rows:[{collection:'companies',id:'QA_CO',data:{name:'before'},version:4,organization_id:'QA_ORG'}]};
    window.alert=m=>__syncQA.alerts.push(String(m));
    currentUser={id:'QA_USER',organizationId:'QA_ORG'};
    sb.from=()=>{
      const q={select(){return q},eq(){return q},order(){return q},abortSignal(){return q},async range(){__syncQA.reads++;return {data:JSON.parse(JSON.stringify(__syncQA.rows)),error:null}}};return q;
    };
    sb.rpc=async(name,args)=>{
      __syncQA.calls.push({name,args:JSON.parse(JSON.stringify(args))});
      if(name==='finora_journal_get_guard_mode')return __syncQA.mode==='missing'?{error:{code:'PGRST202'},data:null}:{data:__syncQA.mode,error:null};
      if(__syncQA.switchTenant){currentUser={id:'OTHER',organizationId:'OTHER_ORG'};syncSnap.clear();syncSnap.set('companies|OTHER','new-tenant');return {data:null,error:null};}
      if(__syncQA.error)return {error:__syncQA.error,data:null};
      if(name==='finora_sync_records')return {data:null,error:null};
      return {error:null,data:{upserts:__syncQA.ack==='complete'?args.p_upserts.map(r=>({collection:r.collection,id:r.id,version:r.expected_version+1})):[],deletes:args.p_deletes}};
    };
    await pullAll();
  });
}

test('versioned sync saves only after complete acknowledgement without login probe',async({page})=>{
  await fixture(page);
  expect(await page.evaluate(()=>__syncQA.calls.length)).toBe(0);
  await page.evaluate(async()=>{datastore.companies[0].name='changed';await runSync()});
  await expect(page.locator('#sync-badge')).toContainText('ذخیره شد');
  expect(await page.evaluate(()=>({name:__syncQA.calls.at(-1).name,version:versionSnap.get('companies|QA_CO'),pending:syncPending}))).toEqual({name:'finora_sync_records_v2',version:5,pending:false});
});

for(const failure of ['partial-ack','conflict','forbidden'])test(`pending edits survive ${failure} with no success badge or reload`,async({page})=>{
  await fixture(page);
  await page.evaluate(async failure=>{
    if(failure==='partial-ack')__syncQA.ack='partial';
    else __syncQA.error={code:failure==='conflict'?'40001':'42501',message:'isolated rejection'};
    datastore.companies[0].name='unsaved';await runSync();
  },failure);
  await expect(page.locator('#sync-badge')).toContainText('ذخیره تأیید نشد');
  expect(await page.evaluate(()=>({name:datastore.companies[0].name,version:versionSnap.get('companies|QA_CO'),pending:syncPending,reads:__syncQA.reads,changed:computeDiff().up.length}))).toEqual({name:'unsaved',version:4,pending:true,reads:1,changed:1});
});

test('legacy schema remains usable with explicitly absent capability',async({page})=>{
  await fixture(page);
  await page.evaluate(async()=>{
    // Independent old-server tenant: no cached versioned capability or revision.
    currentUser={id:'LEGACY_USER',organizationId:'LEGACY_ORG'};
    delete __syncQA.rows[0].version;__syncQA.mode='missing';await pullAll();
    datastore.companies[0].name='legacy edit';await runSync();
  });
  await expect(page.locator('#sync-badge')).toContainText('ذخیره شد');
  expect(await page.evaluate(()=>__syncQA.calls.at(-1).name)).toBe('finora_sync_records');
});

test('late response cannot acknowledge an old organization inside a new one',async({page})=>{
  await fixture(page);
  await page.evaluate(async()=>{__syncQA.switchTenant=true;datastore.companies[0].name='changed';await runSync()});
  expect(await page.evaluate(()=>({old:syncSnap.has('companies|QA_CO'),other:syncSnap.get('companies|OTHER'),alerts:__syncQA.alerts.length}))).toEqual({old:false,other:'new-tenant',alerts:0});
  await expect(page.locator('#sync-badge')).not.toContainText('✔ ذخیره شد');
});

test('same-user organization transition never sends the previous snapshot',async({page})=>{
  await fixture(page);
  await page.evaluate(async()=>{
    datastore.companies[0].name='old organization private edit';
    currentUser={id:'QA_USER',organizationId:'NEW_ORG'};
    await runSync();
  });
  expect(await page.evaluate(()=>__syncQA.calls.length)).toBe(0);
  await expect(page.locator('#sync-badge')).toContainText('ذخیره تأیید نشد');
  expect(await page.evaluate(()=>datastore.companies[0].name)).toBe('old organization private edit');
});

test('identity refresh during a save ends with an unconfirmed badge and retained edits',async({page})=>{
  await fixture(page);
  await page.evaluate(async()=>{
    const original=sb.rpc;
    sb.rpc=async(name,args)=>{
      const result=await original(name,args);
      if(name==='finora_sync_records_v2')currentUser={...currentUser};
      return result;
    };
    datastore.companies[0].name='not acknowledged';syncPending=true;await runSync();
  });
  await expect(page.locator('#sync-badge')).toContainText('ذخیره تأیید نشد');
  expect(await page.evaluate(()=>({pending:syncPending,name:datastore.companies[0].name,version:versionSnap.get('companies|QA_CO')}))).toEqual({pending:true,name:'not acknowledged',version:4});
});

for(const outcome of ['merge','form-changed'])test(`journal graph ${outcome} preserves unrelated unsaved edits in real runtime`,async({page})=>{
  await fixture(page);
  const result=await page.evaluate(async outcome=>{
    __syncQA.rows.push({collection:'journalVouchers',id:'V',version:2,data:{id:'V',companyId:'QA_CO',status:'draft',description:'old'}});
    await pullAll();
    datastore.companies[0].name='unsaved';syncPending=true;scheduleSync(60000);
    const timer=syncTimer,company=datastore.companies[0];
    const view={companyId:'QA_CO',formId:'F',editRevision:0};
    const captured=finoraCaptureJournalRefresh('V',()=>view);
    sb.rpc=async(name,args)=>{
      __syncQA.calls.push({name,args});
      if(outcome==='form-changed')view.editRevision++;
      return {error:null,data:{organization_id:'QA_ORG',voucher_id:'V',effective_status:'partially_reversed',records:[{collection:'journalVouchers',id:'V',version:3,data:{id:'V',companyId:'QA_CO',status:'posted',description:'server'}}]}};
    };
    let status=null,error=null;
    try{status=(await finoraRefreshJournalGraph(captured)).effectiveStatus;}catch(e){error=e.code;}
    const response={status,error,description:datastore.journalVouchers.find(x=>x.id==='V').description,pending:syncPending,preserved:datastore.companies[0]===company&&syncTimer===timer,dirty:computeDiff().up.map(x=>x.key),rpc:__syncQA.calls.map(x=>x.name)};
    clearTimeout(syncTimer);return response;
  },outcome);
  expect(result).toEqual({status:outcome==='merge'?'partially_reversed':null,error:outcome==='merge'?null:'FINORA_GRAPH_VIEW_CHANGED',description:outcome==='merge'?'server':'old',pending:true,preserved:true,dirty:['companies|QA_CO'],rpc:['finora_journal_read_graph']});
});

test('organization hydration begun before graph refresh cannot overwrite its newer revision',async({page})=>{
  await fixture(page);
  const result=await page.evaluate(async()=>{
    __syncQA.rows.push({collection:'journalVouchers',id:'V',version:2,data:{id:'V',companyId:'QA_CO',status:'draft',description:'old'}});
    await pullAll();
    const original=sb.from;let release;
    const gate=new Promise(resolve=>release=resolve);
    sb.from=()=>{const q=original();q.range=async()=>{const data=JSON.parse(JSON.stringify(__syncQA.rows));await gate;return {error:null,data};};return q;};
    const pending=pullAll().then(()=>null,e=>e.code);
    sb.rpc=async()=>({error:null,data:{organization_id:'QA_ORG',voucher_id:'V',effective_status:'posted',records:[{collection:'journalVouchers',id:'V',version:3,data:{id:'V',companyId:'QA_CO',status:'posted',description:'new'}}]}});
    await finoraRefreshJournalGraph(finoraCaptureJournalRefresh('V',()=>({companyId:'QA_CO',formId:'F',editRevision:0})));
    release();const error=await pending;
    return {error,version:versionSnap.get('journalVouchers|V'),description:datastore.journalVouchers.find(x=>x.id==='V').description};
  });
  expect(result).toEqual({error:'FINORA_SYNC_CONTEXT_CHANGED',version:3,description:'new'});
});
