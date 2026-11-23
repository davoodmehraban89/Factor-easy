import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// Issue223: real Auth-issued JWT / PostgREST against disposable local WP2 ONLY.
// This proves organization RLS and posted source immutability, NOT the active-
// company read model, stock posting approval, valuation, or live-host security.
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
 const [a,b]=await Promise.all([createUser('a'),createUser('b')]);
 users.push(a,b);
 const orgA=crypto.randomUUID(),orgB=crypto.randomUUID();
 const ca1='QA223_CO_A1_'+suffix,ca2='QA223_CO_A2_'+suffix,cb='QA223_CO_B_'+suffix;
 const whA1='QA223_WH_A1_'+suffix,whA2='QA223_WH_A2_'+suffix,whB='QA223_WH_B_'+suffix;
 const product='QA223_PRODUCT_'+suffix;
 const movementA1='QA223_MOV_A1_'+suffix,movementA2='QA223_MOV_A2_'+suffix;
 const movementB='QA223_MOV_B_'+suffix,countA='QA223_COUNT_A_'+suffix,countB='QA223_COUNT_B_'+suffix;
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
 const coA=countData(a.id,ca1,whA1,5),coB=countData(b.id,cb,whB,7);
 sql('insert into public.organizations(id,owner_user_id,name) values '+
  '('+quote(orgA)+','+quote(a.id)+','+quote('QA223 org A')+'),'+
  '('+quote(orgB)+','+quote(b.id)+','+quote('QA223 org B')+');'+
  'update public.licenses set organization_id='+quote(orgA)+',max_companies=2 where user_id='+quote(a.id)+';'+
  'update public.licenses set organization_id='+quote(orgB)+' where user_id='+quote(b.id)+';'+
  'insert into public.organization_members(organization_id,user_id,status,is_owner) values '+
  '('+quote(orgA)+','+quote(a.id)+','+quote('active')+',true),'+
  '('+quote(orgB)+','+quote(b.id)+','+quote('active')+',true);');
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
  [orgB,b.id,'inventoryCounts',countB,coB]
 ];
 sql('insert into public.records(organization_id,owner_id,collection,id,data) values '+
  seed.map(row=>record(...row)).join(',')+';');
 const [jwtA,jwtB]=await Promise.all([login(a),login(b)]);
 for(const [collection,aid,bid,oldData] of [
  ['stockMovements',movementA1,movementB,mvA1],
  ['inventoryCounts',countA,countB,coA]
 ]){
  const own=await rows(collection,aid,jwtA);
  assert.equal(own.length,1,'A JWT cannot see own '+collection);
  assert.deepEqual(own[0].data,oldData,'own posted '+collection+' fixture mismatch');
  assert.deepEqual(await rows(collection,aid,jwtB),[],
   'FINORA_ISSUE223_CROSS_ORG_READ_BYPASS: B JWT read A '+collection);
  assert.equal((await rows(collection,bid,jwtB)).length,1,
   'B JWT cannot see own '+collection);
  assert.deepEqual(await rows(collection,bid,jwtA),[],
   'FINORA_ISSUE223_CROSS_ORG_READ_BYPASS: A JWT read B '+collection);
  const injected=await rest('records?select=id',jwtB,{
   method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},
   body:JSON.stringify({organization_id:orgA,owner_id:b.id,collection,
    id:'QA223_INJECT_'+collection+'_'+suffix,data:{...oldData,status:'draft'}})
  });
  assert.ok([401,403].includes(injected.status),
   'FINORA_ISSUE223_FOREIGN_INSERT_ALLOWED: '+collection+' HTTP '+injected.status);
  await attemptForeignPatch(collection,aid,orgA,jwtB);
  await attemptForeignDelete(collection,aid,orgA,jwtB);
  assert.deepEqual((await rows(collection,aid,jwtA))[0].data,oldData,
   'foreign JWT changed or removed posted '+collection);
  await attemptOwnPostedMutation(collection,aid,jwtA,oldData);
  assert.deepEqual((await rows(collection,aid,jwtA))[0].data,oldData,
   'FINORA_ISSUE223_POSTED_IMMUTABILITY_BYPASS: '+collection);
 }
 // Current SQL tenant boundary is organization, not active-company. This is
 // EXPECTED for the legitimate same-owner A1/A2 accountant; client selection
 // and company-specific posting authorization are separate acceptance gates.
 const sameOrg=await rows('stockMovements',movementA2,jwtA);
 assert.equal(sameOrg.length,1,'authorized same-org owner must see company A2');
 assert.equal(sameOrg[0].data.companyId,ca2);
 assert.deepEqual(await rows('stockMovements',movementA2,jwtB),[],
  'foreign organization can see A2 stock movement');
 const crossOrg=await rest('records?select=id,data&collection=eq.stockMovements',jwtA);
 assert.equal(crossOrg.status,200);
 const orgRows=await crossOrg.json();
 assert.deepEqual(orgRows.map(x=>x.id).sort(),[movementA1,movementA2].sort(),
  'A JWT stock records must include authorized A1/A2 and exclude B');
 console.log('WP2_PHASE5_STOCK_JWT_ISOLATION_PASS: Auth-issued JWT A/B read, forbidden cross-org insert/update/delete, readback unchanged for posted stockMovements/inventoryCounts; same-org A1/A2 visible by design.');
 console.log('WP2_PHASE5_POSTED_IMMUTABILITY_PASS: posted stockMovements and inventoryCounts reject same-owner JWT data PATCH and DELETE; original rows intact.');
 console.log('WP2_PHASE5_ACTIVE_COMPANY_NOT_RLS_SCOPE: database JWT protects organizations; PR242 active-company Kardex/browser errors remain separate product P0.');
}finally{
 console.log('WP2_PHASE5_QA_DISPOSABLE: '+users.length+' temporary Auth fixture users; disposable local Supabase workflow handles teardown.');
}
