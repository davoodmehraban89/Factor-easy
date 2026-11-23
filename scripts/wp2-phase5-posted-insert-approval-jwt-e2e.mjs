import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// Issue238 / Phase5 source-status authorization hypothesis.
// This is ONLY a disposable Supabase stack / real Auth JWT test, never Production.
// An expected-product-RED marker reports a real persisted bypass, NOT a fix.
const api=String(process.env.API_URL||'').replace(/\/$/,'');
const anon=process.env.ANON_KEY,service=process.env.SERVICE_ROLE_KEY,db=process.env.DB_URL;
for(const [k,v] of Object.entries({API_URL:api,ANON_KEY:anon,SERVICE_ROLE_KEY:service,DB_URL:db}))
 assert.ok(v,'missing disposable local WP2 environment '+k);
for(const [label,url] of [['API_URL',api],['DB_URL',db]]){
 const host=new URL(url).hostname.toLowerCase();
 assert.ok(['localhost','127.0.0.1','::1','[::1]'].includes(host),
  'FINORA_PHASE5_NONLOCAL_BLOCK: refusing '+label+' endpoint');
}
const suffix=Date.now()+'-'+crypto.randomUUID().slice(0,8);
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
function sql(statement){
 const result=spawnSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-c',statement],{encoding:'utf8'});
 assert.equal(result.status,0,'local fixture SQL failed: '+(result.stderr||result.stdout).slice(-850));
}
async function createUser(label){
 const email='finora-phase5-post-'+label+'-'+suffix+'@example.test';
 const password='QA-'+crypto.randomUUID()+'-Aa9!';
 const response=await fetch(api+'/auth/v1/admin/users',{
  method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},
  body:JSON.stringify({email,password,email_confirm:true,user_metadata:{username:'q5p'+label+Date.now()}})
 });
 const body=await response.json();
 assert.equal(response.status,200,'local Auth user fixture failed: '+label);
 assert.ok(body.id,'missing actual Auth user ID');
 return {id:body.id,email,password};
}
async function jwt(user){
 const response=await fetch(api+'/auth/v1/token?grant_type=password',{
  method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},
  body:JSON.stringify({email:user.email,password:user.password})
 });
 const body=await response.json();
 assert.equal(response.status,200,'real Auth JWT login failed');
 assert.equal(body.user?.id,user.id,'JWT user identity mismatch');
 assert.ok(body.access_token,'Auth JWT missing');
 return body.access_token;
}
async function rest(path,token,init={}){
 return fetch(api+'/rest/v1/'+path,{
  ...init,headers:{apikey:anon,Authorization:'Bearer '+token,...(init.headers||{})}
 });
}
async function syncUpsert(token,org,collection,id,data){
 // Actual app sync channel: Auth user invokes SECURITY INVOKER RPC, not service-role SQL.
 return rest('rpc/finora_sync_records',token,{
  method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},
  body:JSON.stringify({p_organization_id:org,
   p_upserts:[{collection,id,data}],p_deletes:[]})
 });
}
const sameData=(a,b)=>JSON.stringify(Object.entries(a||{}).sort())===
 JSON.stringify(Object.entries(b||{}).sort());
function rec(org,owner,collection,id,data){
 return '('+[q(org),q(owner),q(collection),q(id),q(JSON.stringify(data))+'::jsonb'].join(',')+')';
}
async function getOwnerRow(org,collection,id,token){
 const r=await rest('records?select=organization_id,collection,id,data&organization_id=eq.'+
  encodeURIComponent(org)+'&collection=eq.'+encodeURIComponent(collection)+
  '&id=eq.'+encodeURIComponent(id),token);
 assert.equal(r.status,200,'genuine owner readback HTTP must be 200');
 return r.json();
}
let usersCreated=0;
try{
 const [owner,creator,editor]=await Promise.all([createUser('owner'),createUser('creator'),createUser('editor')]);
 usersCreated=3;
 const org=crypto.randomUUID(),member=crypto.randomUUID(),memberEditor=crypto.randomUUID();
 const company='QA5_COMPANY_'+suffix,warehouse='QA5_WAREHOUSE_'+suffix,product='QA5_PRODUCT_'+suffix;
 // The fixture retains the real max_users seat trigger and company quota.
 sql('insert into public.organizations(id,owner_user_id,name) values ('+
  q(org)+','+q(owner.id)+','+q('QA5 approved test organization')+');'+
  'update public.licenses set organization_id='+q(org)+',max_users=3 where user_id='+q(owner.id)+';'+
  'insert into public.organization_members(organization_id,user_id,status,is_owner) values ('+
  q(org)+','+q(owner.id)+','+q('active')+',true);'+
  'insert into public.organization_members(id,organization_id,user_id,status,is_owner) values ('+
  q(member)+','+q(org)+','+q(creator.id)+','+q('active')+',false),('+
  q(memberEditor)+','+q(org)+','+q(editor.id)+','+q('active')+',false);'+
  'insert into public.member_module_permissions(organization_id,member_id,module_key,capabilities,scope_type,scope_id,confidentiality_level) values ('+
  q(org)+','+q(member)+','+q('inventory')+",array['create']::text[],"+
  q('company')+','+q(company)+',0),('+
  q(org)+','+q(memberEditor)+','+q('inventory')+",array['read','create','edit']::text[],"+
  q('company')+','+q(company)+',0);');
 sql('insert into public.records(organization_id,owner_id,collection,id,data) values '+
  [
   rec(org,owner.id,'companies',company,{name:'QA5 local company'}),
   rec(org,owner.id,'warehouses',warehouse,{companyId:company,code:'QA5W',name:'Local warehouse'}),
   rec(org,owner.id,'products',product,{companyId:company,code:'QA5P',name:'Local product'})
  ].join(',')+';');
 const [ownerJwt,creatorJwt,editorJwt]=await Promise.all([jwt(owner),jwt(creator),jwt(editor)]);
 const cases=[
  {collection:'stockMovements',id:'QA5_POSTED_MOV_'+suffix,data:{
   ownerUserId:creator.id,companyId:company,warehouseId:warehouse,
   productId:product,kind:'adjustment_in',qty:5,unitCost:50,
   date:'1405/08/01',status:'posted',postedAt:'2026-11-23T00:00:00.000Z'
  }},
  {collection:'inventoryCounts',id:'QA5_POSTED_COUNT_'+suffix,data:{
   ownerUserId:creator.id,companyId:company,warehouseId:warehouse,
   productId:product,systemQty:5,physicalQty:8,difference:3,
   date:'1405/08/01',status:'posted',postedAt:'2026-11-23T00:00:00.000Z'
  }}
 ];
 const observations=[];
 for(const item of cases){
  assert.equal((await getOwnerRow(org,item.collection,item.id,ownerJwt)).length,0,
   'posted source ID must be absent before user attempt');
  // IMPORTANT: the *caller* is real non-owner user with inventory:create ONLY,
  // and no inventory:approve. Service-role and psql do not perform the attempt.
  const response=await rest('records',creatorJwt,{
   method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},
   body:JSON.stringify({organization_id:org,owner_id:creator.id,
    collection:item.collection,id:item.id,data:item.data})
  });
  const after=await getOwnerRow(org,item.collection,item.id,ownerJwt);
  const fixed=[401,403].includes(response.status)&&after.length===0;
  const broken=[201,204].includes(response.status)&&after.length===1
   &&after[0].organization_id===org&&after[0].collection===item.collection
   &&after[0].id===item.id
   &&Object.keys(after[0].data).length===Object.keys(item.data).length
   &&Object.entries(item.data).every(([key,value])=>after[0].data[key]===value);
  assert.ok(fixed||broken,
   'FINORA_PHASE5_POSTED_INSERT_THIRD_STATE: '+item.collection+
   ' direct POST HTTP '+response.status+' owner readback '+JSON.stringify(after));
  observations.push({collection:item.collection,status:response.status,
   result:fixed?'properly_denied':'posted_without_approval'});
 }
 const allDenied=observations.every(x=>x.result==='properly_denied');
 const allBroken=observations.every(x=>x.result==='posted_without_approval');
 assert.ok(allDenied||allBroken,
  'FINORA_PHASE5_POSTED_INSERT_PARTIAL_THIRD_STATE: '+JSON.stringify(observations));
 if(allBroken){
  console.log('FINORA_PHASE5_POSTED_INSERT_WITHOUT_APPROVE_EXPECTED_RED: real Auth JWT member with inventory:create (company scoped) and no inventory:approve directly created POSTED stockMovements AND inventoryCounts through PostgREST. Owner readback confirms both exact persisted posted records; PRODUCT SECURITY/LIFECYCLE DEFECT, NOT A FIX.');
 }else{
  console.log('FINORA_PHASE5_POSTED_INSERT_APPROVAL_PASS: non-owner inventory:create without inventory:approve denied direct posted source INSERT for both stockMovements and inventoryCounts, no persisted rows.');
 }
 console.log('FINORA_PHASE5_POSTED_INSERT_JWT_EVIDENCE: '+JSON.stringify(observations));
 // Second independent policy boundary: draft INSERT followed by UPDATE to posted.
 // Genuine editor JWT has scoped inventory:read/create/edit, but NO inventory:approve.
 // Read capability is present because PostgreSQL/PostgREST UPDATE needs row visibility.
 const transitions=[];
 for(const item of cases){
  const draftId=item.id+'_EDIT';
  const draftData={...item.data,ownerUserId:editor.id,status:'draft'};
  delete draftData.postedAt;
  const postedData={...draftData,status:'posted',postedAt:'2026-11-23T00:00:00.000Z'};
  assert.deepEqual(await getOwnerRow(org,item.collection,draftId,ownerJwt),[],
   'transition fixture must not exist before draft create');
  const draftCreate=await rest('records',editorJwt,{
   method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},
   body:JSON.stringify({organization_id:org,owner_id:editor.id,
    collection:item.collection,id:draftId,data:draftData})
  });
  assert.ok([201,204].includes(draftCreate.status),
   'FINORA_PHASE5_DRAFT_CREATE_FAILED: '+item.collection+' HTTP '+draftCreate.status);
  const before=await getOwnerRow(org,item.collection,draftId,ownerJwt);
  assert.equal(before.length,1,'editor-created draft must be visible to real owner');
  assert.deepEqual(before[0].data,draftData,'editor-created draft payload mismatch');
  const patchPath='records?organization_id=eq.'+encodeURIComponent(org)+
   '&collection=eq.'+encodeURIComponent(item.collection)+
   '&id=eq.'+encodeURIComponent(draftId);
  const update=await rest(patchPath,editorJwt,{
   method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},
   body:JSON.stringify({data:postedData})
  });
  const after=await getOwnerRow(org,item.collection,draftId,ownerJwt);
  const denied=[401,403].includes(update.status)&&after.length===1
   &&JSON.stringify(Object.entries(after[0].data).sort())===JSON.stringify(Object.entries(draftData).sort());
  const bypass=[200,204].includes(update.status)&&after.length===1
   &&JSON.stringify(Object.entries(after[0].data).sort())===JSON.stringify(Object.entries(postedData).sort());
  assert.ok(denied||bypass,
   'FINORA_PHASE5_POSTED_UPDATE_THIRD_STATE: '+item.collection+
   ' draft->posted PATCH HTTP '+update.status+' owner readback '+JSON.stringify(after));
  transitions.push({collection:item.collection,status:update.status,
   result:denied?'properly_denied':'posted_without_approval'});
 }
 const updateDenied=transitions.every(x=>x.result==='properly_denied');
 const updateBroken=transitions.every(x=>x.result==='posted_without_approval');
 assert.ok(updateDenied||updateBroken,
  'FINORA_PHASE5_POSTED_UPDATE_PARTIAL_THIRD_STATE: '+JSON.stringify(transitions));
 if(updateBroken){
  console.log('FINORA_PHASE5_POSTED_UPDATE_WITHOUT_APPROVE_EXPECTED_RED: real Auth JWT company-scoped member with inventory:read/create/edit and NO inventory:approve directly changed draft to POSTED in stockMovements AND inventoryCounts; owner readback confirms both. PRODUCT AUTHORIZATION/LIFECYCLE DEFECT, NOT FIX.');
 }else{
  console.log('FINORA_PHASE5_POSTED_UPDATE_APPROVAL_PASS: same non-approver JWT denied draft-to-posted UPDATE in both stock/count collections, and both draft rows preserved.');
 }
 console.log('FINORA_PHASE5_POSTED_UPDATE_JWT_EVIDENCE: '+JSON.stringify(transitions));

 // Third independent API entry: the generic sync RPC the real Finora client uses.
 // Do not confuse an RPC call via an Auth-issued user's JWT with an admin fixture.
 // Positive control: prove the create-only actor can actually use this SAME
 // RPC to save a lawful DRAFT before treating denied POSTED as approval safety.
 // INSERT ... ON CONFLICT DO UPDATE may instead require 'edit' unconditionally.
 const syncDraftControls=[];
 for(const item of cases){
  const id=item.id+'_SYNC_LEGIT_DRAFT';
  const draftData={...item.data,status:'draft'};
  delete draftData.postedAt;
  assert.deepEqual(await getOwnerRow(org,item.collection,id,ownerJwt),[],
   'sync create-only positive control must start absent');
  const response=await syncUpsert(creatorJwt,org,item.collection,id,draftData);
  const after=await getOwnerRow(org,item.collection,id,ownerJwt);
  const accepted=[200,201,204].includes(response.status)&&after.length===1
   &&after[0].organization_id===org&&after[0].collection===item.collection
   &&after[0].id===id&&sameData(after[0].data,draftData);
  const blocked=[401,403].includes(response.status)&&after.length===0;
  assert.ok(accepted||blocked,
   'FINORA_PHASE5_SYNC_RPC_DRAFT_POSITIVE_CONTROL_THIRD_STATE: '+item.collection+
   ' HTTP '+response.status+' readback '+JSON.stringify(after));
  let errorCode=null;
  if(blocked){
   const responseBody=await response.json().catch(()=>({}));
   errorCode=typeof responseBody.code==='string'?responseBody.code.slice(0,50):null;
  }
  syncDraftControls.push({collection:item.collection,status:response.status,
   result:accepted?'authorized_draft_saved':'create_only_draft_blocked',errorCode});
 }
 const syncDraftAllowed=syncDraftControls.every(x=>x.result==='authorized_draft_saved');
 const syncDraftBlocked=syncDraftControls.every(x=>x.result==='create_only_draft_blocked');
 assert.ok(syncDraftAllowed||syncDraftBlocked,
  'FINORA_PHASE5_SYNC_RPC_DRAFT_POSITIVE_CONTROL_PARTIAL: '+JSON.stringify(syncDraftControls));
 console.log(syncDraftAllowed
  ?'FINORA_PHASE5_SYNC_RPC_CREATE_ONLY_DRAFT_PASS: authorized non-owner inventory:create JWT can create BOTH legitimate draft stock/count records through finora_sync_records.'
  :'FINORA_PHASE5_SYNC_RPC_CREATE_ONLY_DRAFT_BLOCKED_EXPECTED_RED: inventory:create-only non-owner JWT can write directly to records but cannot save lawful DRAFT stock/count via generic finora_sync_records; a status-specific posted authorization PASS CANNOT be inferred from an identical denial of drafts.');
 console.log('FINORA_PHASE5_SYNC_RPC_CREATE_ONLY_DRAFT_EVIDENCE: '+JSON.stringify(syncDraftControls));

 const syncInserts=[];
 for(const item of cases){
  const id=item.id+'_SYNC_CREATE';
  assert.deepEqual(await getOwnerRow(org,item.collection,id,ownerJwt),[],
   'sync posted-insert fixture ID must be absent');
  const response=await syncUpsert(creatorJwt,org,item.collection,id,item.data);
  const after=await getOwnerRow(org,item.collection,id,ownerJwt);
  const denied=[401,403].includes(response.status)&&after.length===0;
  const bypass=[200,201,204].includes(response.status)&&after.length===1
   &&after[0].organization_id===org&&after[0].collection===item.collection
   &&after[0].id===id&&sameData(after[0].data,item.data);
  assert.ok(denied||bypass,
   'FINORA_PHASE5_SYNC_RPC_POSTED_INSERT_THIRD_STATE: '+item.collection+
   ' RPC HTTP '+response.status+' owner readback '+JSON.stringify(after));
  syncInserts.push({collection:item.collection,status:response.status,
   result:denied?'properly_denied':'posted_without_approval'});
 }
 const syncInsertDenied=syncInserts.every(x=>x.result==='properly_denied');
 const syncInsertBroken=syncInserts.every(x=>x.result==='posted_without_approval');
 assert.ok(syncInsertDenied||syncInsertBroken,
  'FINORA_PHASE5_SYNC_RPC_POSTED_INSERT_PARTIAL_THIRD_STATE: '+JSON.stringify(syncInserts));
 assert.ok(!(syncInsertBroken&&syncDraftBlocked),
  'FINORA_PHASE5_SYNC_RPC_POSTED_INSERT_UNEXPECTED_PRIVILEGE_INVERSION: posted accepted but draft blocked');
 if(syncInsertBroken){
  console.log('FINORA_PHASE5_SYNC_RPC_POSTED_INSERT_WITHOUT_APPROVE_EXPECTED_RED: genuine scoped inventory:create JWT posted BOTH Phase5 sources through generic sync; independently persisted; PRODUCT P0.');
 }else if(syncDraftAllowed){
  console.log('FINORA_PHASE5_SYNC_RPC_POSTED_INSERT_APPROVAL_PASS: same genuine creator-only JWT can save drafts but is specifically denied unauthorized posted upserts for both Phase5 sources.');
 }else{
  console.log('FINORA_PHASE5_SYNC_RPC_POSTED_INSERT_DENIED_INCONCLUSIVE: both unauthorized POSTED and lawful DRAFT RPC writes are denied to create-only JWT; do NOT infer independent approval enforcement from this blanket denial.');
 }
 console.log('FINORA_PHASE5_SYNC_RPC_POSTED_INSERT_JWT_EVIDENCE: '+JSON.stringify(syncInserts));

 const syncUpdates=[];
 for(const item of cases){
  const id=item.id+'_SYNC_EDIT';
  const draftData={...item.data,ownerUserId:editor.id,status:'draft'};
  delete draftData.postedAt;
  const postedData={...draftData,status:'posted',postedAt:'2026-11-23T00:00:00.000Z'};
  assert.deepEqual(await getOwnerRow(org,item.collection,id,ownerJwt),[],
   'sync draft-to-posted fixture ID must be absent');
  const draftCreate=await syncUpsert(editorJwt,org,item.collection,id,draftData);
  assert.ok([200,201,204].includes(draftCreate.status),
   'FINORA_PHASE5_SYNC_RPC_DRAFT_CREATE_FAILED: '+item.collection+
   ' HTTP '+draftCreate.status);
  const before=await getOwnerRow(org,item.collection,id,ownerJwt);
  assert.equal(before.length,1,'RPC draft must be visible via independent owner JWT');
  assert.ok(sameData(before[0].data,draftData),'RPC draft must preserve exact payload');
  const response=await syncUpsert(editorJwt,org,item.collection,id,postedData);
  const after=await getOwnerRow(org,item.collection,id,ownerJwt);
  const denied=[401,403].includes(response.status)&&after.length===1
   &&sameData(after[0].data,draftData);
  const bypass=[200,201,204].includes(response.status)&&after.length===1
   &&sameData(after[0].data,postedData);
  assert.ok(denied||bypass,
   'FINORA_PHASE5_SYNC_RPC_POSTED_UPDATE_THIRD_STATE: '+item.collection+
   ' RPC HTTP '+response.status+' owner readback '+JSON.stringify(after));
  syncUpdates.push({collection:item.collection,status:response.status,
   result:denied?'properly_denied':'posted_without_approval'});
 }
 const syncUpdateDenied=syncUpdates.every(x=>x.result==='properly_denied');
 const syncUpdateBroken=syncUpdates.every(x=>x.result==='posted_without_approval');
 assert.ok(syncUpdateDenied||syncUpdateBroken,
  'FINORA_PHASE5_SYNC_RPC_POSTED_UPDATE_PARTIAL_THIRD_STATE: '+JSON.stringify(syncUpdates));
 console.log(syncUpdateBroken
  ?'FINORA_PHASE5_SYNC_RPC_POSTED_UPDATE_WITHOUT_APPROVE_EXPECTED_RED: genuine company-scoped inventory:read/create/edit JWT WITHOUT approve converted BOTH stockMovements and inventoryCounts draft to posted through finora_sync_records; owner JWT verifies persisted status; PRODUCT DEFECT, NOT A FIX.'
  :'FINORA_PHASE5_SYNC_RPC_POSTED_UPDATE_APPROVAL_PASS: non-approver edit JWT denied draft-to-posted RPC for both Phase5 sources; owner JWT verifies original drafts unchanged.');
 console.log('FINORA_PHASE5_SYNC_RPC_POSTED_UPDATE_JWT_EVIDENCE: '+JSON.stringify(syncUpdates));
}finally{
 console.log('FINORA_PHASE5_POSTED_INSERT_DISPOSABLE: '+usersCreated+' temporary Auth users; local WP2 teardown owns this database.');
}
