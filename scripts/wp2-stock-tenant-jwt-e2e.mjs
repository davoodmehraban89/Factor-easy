import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// Issue223: real Auth-issued JWT / PostgREST against disposable local WP2 ONLY.
// Proves organization/company row scopes and posted-source immutability;
// NOT the active-company UI read model, stock approval, valuation, or live-host security.
const api=String(process.env.API_URL||'').replace(/\/$/,'');
const anon=process.env.ANON_KEY,service=process.env.SERVICE_ROLE_KEY,db=process.env.DB_URL;
for(const [key,value] of Object.entries({API_URL:api,ANON_KEY:anon,SERVICE_ROLE_KEY:service,DB_URL:db}))
 assert.ok(value,'missing disposable WP2 environment setting: '+key);
for(const [name,url] of [['API_URL',api],['DB_URL',db]]){
 const host=new URL(url).hostname.toLowerCase();
 assert.ok(['localhost','127.0.0.1','::1','[::1]'].includes(host),
  'FINORA_ISSUE223_NONLOCAL_BLOCK: '+name+' must be local');
}
const suffix=Date.now()+'-'+crypto.randomUUID().slice(0,8);
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
function sql(statement){
 const p=spawnSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-c',statement],{encoding:'utf8'});
 assert.equal(p.status,0,'disposable fixture SQL error: '+(p.stderr||p.stdout).slice(-700));
}
async function createUser(label){
 const email='finora-qa223-'+label+'-'+suffix+'@example.test';
 const password='QA-'+crypto.randomUUID()+'-Aa9!';
 const response=await fetch(api+'/auth/v1/admin/users',{
  method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},
  body:JSON.stringify({email,password,email_confirm:true,user_metadata:{username:'q223'+label+Date.now()}})
 });
 const data=await response.json();
 assert.equal(response.status,200,'disposable test-user fixture '+label+' failed');
 assert.ok(data.id,'Auth missing fixture user ID');
 return {id:data.id,email,password};
}
async function login(user){
 const r=await fetch(api+'/auth/v1/token?grant_type=password',{
  method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},
  body:JSON.stringify({email:user.email,password:user.password})
 });
 const data=await r.json();
 assert.equal(r.status,200,'disposable Auth login failed');
 assert.equal(data.user?.id,user.id,'Auth JWT user ID mismatch');
 assert.ok(data.access_token,'missing genuine Auth JWT');
 return data.access_token;
}
async function rest(path,jwt,init={}){
 return fetch(api+'/rest/v1/'+path,{
  ...init,headers:{apikey:anon,Authorization:'Bearer '+jwt,...(init.headers||{})}
 });
}
function record(organizationId,ownerId,collection,id,data){
 return '('+[quote(organizationId),quote(ownerId),quote(collection),quote(id),
  quote(JSON.stringify(data))+'::jsonb'].join(',')+')';
}
const path=(collection,id)=>'records?select=id,collection,organization_id,data,version&collection=eq.'+
 encodeURIComponent(collection)+'&id=eq.'+encodeURIComponent(id);
async function rows(collection,id,jwt){
 const r=await rest(path(collection,id),jwt);
 assert.equal(r.status,200,'readback must return status 200: '+collection);
 return r.json();
}
async function attemptForeignDelete(collection,id,organizationId,jwt){
 const r=await rest('records?organization_id=eq.'+organizationId+
  '&collection=eq.'+collection+'&id=eq.'+encodeURIComponent(id),jwt,{
   method:'DELETE',headers:{Prefer:'return=representation'}
 });
 assert.ok([200,204].includes(r.status),'foreign delete unexpected HTTP '+r.status);
 assert.deepEqual(await r.json().catch(()=>[]),[],'cross-tenant DELETE returned a modified row');
}
async function attemptForeignPatch(collection,id,organizationId,jwt){
 const r=await rest('records?organization_id=eq.'+organizationId+
  '&collection=eq.'+collection+'&id=eq.'+encodeURIComponent(id),jwt,{
   method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},
   body:JSON.stringify({data:{status:'draft',companyId:'QA_FORGED',qty:999}})
 });
 assert.ok([200,204].includes(r.status),'foreign update unexpected HTTP '+r.status);
 assert.deepEqual(await r.json().catch(()=>[]),[],'cross-tenant UPDATE returned a modified row');
}
async function attemptOwnPostedMutation(collection,id,jwt,oldData){
 const target='records?collection=eq.'+collection+'&id=eq.'+encodeURIComponent(id);
 const patched={...oldData,status:'draft',qty:999,actualQty:999};
 const update=await rest(target,jwt,{method:'PATCH',
  headers:{'Content-Type':'application/json',Prefer:'return=representation'},
  body:JSON.stringify({data:patched})});
 assert.ok(!update.ok,'FINORA_ISSUE223_POSTED_UPDATE_ALLOWED: '+collection+' HTTP '+update.status);
 const deletion=await rest(target,jwt,{method:'DELETE',
  headers:{Prefer:'return=representation'}});
 assert.ok(!deletion.ok,'FINORA_ISSUE223_POSTED_DELETE_ALLOWED: '+collection+' HTTP '+deletion.status);
}
const users=[];
try{
 const [a,b,c]=await Promise.all([createUser('a'),createUser('b'),createUser('c')]);
 users.push(a,b,c);
 const orgA=crypto.randomUUID(),orgB=crypto.randomUUID(),memberA=crypto.randomUUID();
 const ca1='QA223_CO_A1_'+suffix,ca2='QA223_CO_A2_'+suffix,cb='QA223_CO_B_'+suffix;
 const whA1='QA223_WH_A1_'+suffix,whA2='QA223_WH_A2_'+suffix,whB='QA223_WH_B_'+suffix;
 const product='QA223_PRODUCT_'+suffix;
 const movementA1='QA223_MOV_A1_'+suffix,movementA2='QA223_MOV_A2_'+suffix;
 const movementB='QA223_MOV_B_'+suffix,countA='QA223_COUNT_A_'+suffix,countA2='QA223_COUNT_A2_'+suffix,countB='QA223_COUNT_B_'+suffix;
 const movementData=(uid,companyId,warehouseId,qty)=>({
  ownerUserId:uid,companyId,warehouseId,productId:product,qty,unitCost:50,
  kind:'adjustment_in',status:'posted',date:'1405/07/21',
  postedAt:'2026-11-20T08:00:00.000Z'
 });
 const countData=(uid,companyId,warehouseId,qty)=>({
  ownerUserId:uid,companyId,warehouseId,productId:product,
  expectedQty:qty,actualQty:qty,diff:0,status:'posted',
  date:'1405/07/21',postedAt:'2026-11-20T08:00:00.000Z'
 });
 const mvA1=movementData(a.id,ca1,whA1,5),mvA2=movementData(a.id,ca2,whA2,3);
 const mvB=movementData(b.id,cb,whB,7);
 const coA=countData(a.id,ca1,whA1,5),coA2=countData(a.id,ca2,whA2,3),coB=countData(b.id,cb,whB,7);
 sql('insert into public.organizations(id,owner_user_id,name) values '+
  '('+quote(orgA)+','+quote(a.id)+','+quote('QA223 org A')+'),'+
  '('+quote(orgB)+','+quote(b.id)+','+quote('QA223 org B')+');'+
  'update public.licenses set organization_id='+quote(orgA)+',max_companies=2,max_users=2 where user_id='+quote(a.id)+';'+
  'update public.licenses set organization_id='+quote(orgB)+' where user_id='+quote(b.id)+';'+
  'insert into public.organization_members(organization_id,user_id,status,is_owner) values '+
  '('+quote(orgA)+','+quote(a.id)+','+quote('active')+',true),'+
  '('+quote(orgB)+','+quote(b.id)+','+quote('active')+',true);');
 // A real non-owner member receives only inventory:read for company A1.
 // The disposable organization license permits exactly owner A + member C.
 sql('insert into public.organization_members(id,organization_id,user_id,status,is_owner) values ('+
  quote(memberA)+','+quote(orgA)+','+quote(c.id)+','+quote('active')+',false);');
 sql('insert into public.member_module_permissions(organization_id,member_id,module_key,capabilities,scope_type,scope_id,confidentiality_level) values ('+
  quote(orgA)+','+quote(memberA)+','+quote('inventory')+",array['read']::text[],"+quote('company')+','+quote(ca1)+',0);');
 // The disposable fixture needs A's two companies: default license capacity is 1.
 // Raise only A's local test license to 2, without bypassing its DB trigger.
 const seed=[
  [orgA,a.id,'companies',ca1,{name:'Company A1'}],
  [orgA,a.id,'companies',ca2,{name:'Company A2'}],
  [orgB,b.id,'companies',cb,{name:'Company B'}],
  [orgA,a.id,'warehouses',whA1,{companyId:ca1,code:'WA1',name:'Warehouse A1',active:true}],
  [orgA,a.id,'warehouses',whA2,{companyId:ca2,code:'WA2',name:'Warehouse A2',active:true}],
  [orgB,b.id,'warehouses',whB,{companyId:cb,code:'WB1',name:'Warehouse B',active:true}],
  [orgA,a.id,'products',product,{name:'QA223 product',code:'QA223'}],
  [orgB,b.id,'products',product,{name:'QA223 product',code:'QA223'}],
  [orgA,a.id,'stockMovements',movementA1,mvA1],
  [orgA,a.id,'stockMovements',movementA2,mvA2],
  [orgB,b.id,'stockMovements',movementB,mvB],
  [orgA,a.id,'inventoryCounts',countA,coA],
  [orgA,a.id,'inventoryCounts',countA2,coA2],
  [orgB,b.id,'inventoryCounts',countB,coB]
 ];
 sql('insert into public.records(organization_id,owner_id,collection,id,data) values '+
  seed.map(row=>record(...row)).join(',')+';');
 const [jwtA,jwtB,jwtC]=await Promise.all([login(a),login(b),login(c)]);
 for(const [collection,aid,a2id,bid,oldData,oldData2] of [
  ['stockMovements',movementA1,movementA2,movementB,mvA1,mvA2],
  ['inventoryCounts',countA,countA2,countB,coA,coA2]
 ]){
  const own=await rows(collection,aid,jwtA);
  assert.equal(own.length,1,'A JWT cannot see own '+collection);
  assert.deepEqual(own[0].data,oldData,'own posted '+collection+' fixture mismatch');
  const ownerA2=await rows(collection,a2id,jwtA);
  assert.equal(ownerA2.length,1,'organization owner cannot see company A2 '+collection);
  assert.deepEqual(ownerA2[0].data,oldData2,'owner A2 '+collection+' fixture mismatch');
  assert.deepEqual(await rows(collection,aid,jwtB),[],
   'FINORA_ISSUE223_CROSS_ORG_READ_BYPASS: B JWT read A '+collection);
  assert.equal((await rows(collection,bid,jwtB)).length,1,
   'B JWT cannot see own '+collection);
  assert.deepEqual(await rows(collection,bid,jwtA),[],
   'FINORA_ISSUE223_CROSS_ORG_READ_BYPASS: A JWT read B '+collection);
  const scopedA1=await rows(collection,aid,jwtC);
  assert.equal(scopedA1.length,1,'company-scoped C cannot read A1 '+collection);
  assert.deepEqual(scopedA1[0].data,oldData,'C read unexpected A1 '+collection+' data');
  assert.deepEqual(await rows(collection,a2id,jwtC),[],
   'FINORA_ISSUE223_COMPANY_SCOPE_BYPASS: C read same-org company A2 '+collection);
  assert.deepEqual(await rows(collection,bid,jwtC),[],
   'FINORA_ISSUE223_COMPANY_SCOPE_CROSS_ORG_BYPASS: C read foreign org '+collection);
  const injected=await rest('records?select=id',jwtB,{
   method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},
   body:JSON.stringify({organization_id:orgA,owner_id:b.id,collection,
    id:'QA223_INJECT_'+collection+'_'+suffix,data:{...oldData,status:'draft'}})
  });
  assert.ok([401,403].includes(injected.status),
   'FINORA_ISSUE223_FOREIGN_INSERT_ALLOWED: '+collection+' HTTP '+injected.status);
  await attemptForeignPatch(collection,aid,orgA,jwtB);
  await attemptForeignDelete(collection,aid,orgA,jwtB);
  await attemptForeignPatch(collection,aid,orgA,jwtC);
  await attemptForeignDelete(collection,aid,orgA,jwtC);
  await attemptForeignPatch(collection,a2id,orgA,jwtC);
  await attemptForeignDelete(collection,a2id,orgA,jwtC);
  assert.deepEqual((await rows(collection,aid,jwtA))[0].data,oldData,
   'foreign JWT changed or removed posted '+collection);
  await attemptOwnPostedMutation(collection,aid,jwtA,oldData);
  assert.deepEqual((await rows(collection,aid,jwtA))[0].data,oldData,
   'FINORA_ISSUE223_POSTED_IMMUTABILITY_BYPASS: '+collection);
 }
 const readOnlyCreateId='QA223_READONLY_CREATE_'+suffix;
 const readOnlyCreate=await rest('records?select=id',jwtC,{
  method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},
  body:JSON.stringify({organization_id:orgA,owner_id:c.id,collection:'stockMovements',
   id:readOnlyCreateId,data:movementData(c.id,ca1,whA1,1)})
 });
 assert.ok([401,403].includes(readOnlyCreate.status),
  'FINORA_ISSUE223_READONLY_CREATE_ALLOWED: inventory:read member HTTP '+readOnlyCreate.status);
 assert.deepEqual(await rows('stockMovements',readOnlyCreateId,jwtA),[],
  'read-only inventory member created a stock movement');
 // Owners have organization-wide scope and legitimately see A1/A2. A delegated
 // member with company scope A1 sees A1 only; neither result is the UI selector.
 // Client active-company Kardex filtering remains a separate product acceptance gate.
 const sameOrg=await rows('stockMovements',movementA2,jwtA);
 assert.equal(sameOrg.length,1,'authorized same-org owner must see company A2');
 assert.equal(sameOrg[0].data.companyId,ca2);
 assert.equal((await rows('inventoryCounts',countA2,jwtA)).length,1,
  'organization owner must see company A2 inventory count');
 assert.deepEqual(await rows('stockMovements',movementA2,jwtB),[],
  'foreign organization can see A2 stock movement');
 const crossOrg=await rest('records?select=id,data&collection=eq.stockMovements',jwtA);
 assert.equal(crossOrg.status,200);
 const orgRows=await crossOrg.json();
 assert.deepEqual(orgRows.map(x=>x.id).sort(),[movementA1,movementA2].sort(),
  'A JWT stock records must include authorized A1/A2 and exclude B');
 const scopedRows=await rest('records?select=id&collection=eq.stockMovements',jwtC);
 assert.equal(scopedRows.status,200);
 assert.deepEqual((await scopedRows.json()).map(x=>x.id),[movementA1],
  'company-scoped inventory:read JWT must return only A1 rows');
 console.log('WP2_PHASE5_STOCK_JWT_ISOLATION_PASS: Auth-issued JWT A/B read, forbidden cross-org insert/update/delete, readback unchanged for posted stockMovements/inventoryCounts; owner A sees A1/A2.');
 console.log('WP2_PHASE5_POSTED_IMMUTABILITY_PASS: posted stockMovements and inventoryCounts reject same-owner JWT data PATCH and DELETE; original rows intact.');
 console.log('WP2_PHASE5_COMPANY_SCOPE_JWT_PASS: real Auth-issued non-owner C with inventory:read scoped to company A1 reads A1 stock/count rows and cannot read same-org A2 or foreign-org B.');
 console.log('WP2_PHASE5_READ_ONLY_MEMBER_CAPABILITY_PASS: scoped inventory:read member cannot create, patch or delete stock/count records; source readback unchanged.');
 console.log('WP2_PHASE5_ACTIVE_COMPANY_NOT_RLS_SCOPE: owner A legitimately sees A1/A2; delegated company-scoped C sees A1 only. PR242 active-company Kardex/UI filter remains a separate product P0.');
}finally{
 console.log('WP2_PHASE5_QA_DISPOSABLE: '+users.length+' temporary Auth fixture users; disposable local Supabase workflow handles teardown.');
}
