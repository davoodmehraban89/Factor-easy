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
 const [owner,creator]=await Promise.all([createUser('owner'),createUser('creator')]);
 usersCreated=2;
 const org=crypto.randomUUID(),member=crypto.randomUUID();
 const company='QA5_COMPANY_'+suffix,warehouse='QA5_WAREHOUSE_'+suffix,product='QA5_PRODUCT_'+suffix;
 // The fixture retains the real max_users seat trigger and company quota.
 sql('insert into public.organizations(id,owner_user_id,name) values ('+
  q(org)+','+q(owner.id)+','+q('QA5 approved test organization')+');'+
  'update public.licenses set organization_id='+q(org)+',max_users=2 where user_id='+q(owner.id)+';'+
  'insert into public.organization_members(organization_id,user_id,status,is_owner) values ('+
  q(org)+','+q(owner.id)+','+q('active')+',true);'+
  'insert into public.organization_members(id,organization_id,user_id,status,is_owner) values ('+
  q(member)+','+q(org)+','+q(creator.id)+','+q('active')+',false);'+
  'insert into public.member_module_permissions(organization_id,member_id,module_key,capabilities,scope_type,scope_id,confidentiality_level) values ('+
  q(org)+','+q(member)+','+q('inventory')+",array['create']::text[],"+
  q('company')+','+q(company)+',0);');
 sql('insert into public.records(organization_id,owner_id,collection,id,data) values '+
  [
   rec(org,owner.id,'companies',company,{name:'QA5 local company'}),
   rec(org,owner.id,'warehouses',warehouse,{companyId:company,code:'QA5W',name:'Local warehouse'}),
   rec(org,owner.id,'products',product,{companyId:company,code:'QA5P',name:'Local product'})
  ].join(',')+';');
 const [ownerJwt,creatorJwt]=await Promise.all([jwt(owner),jwt(creator)]);
 const cases=[
  {collection:'stockMovements',id:'QA5_POSTED_MOV_'+suffix,data:{
   ownerUserId:creator.id,companyId:company,warehouseId:warehouse,
   productId:product,kind:'adjustment_in',qty:5,unitCost:50,
   date:'1405/08/01',status:'posted',postedAt:'2026-11-23T00:00:00.000Z'
  }},
  {collection:'inventoryCounts',id:'QA5_POSTED_COUNT_'+suffix,data:{
   ownerUserId:creator.id,companyId:company,warehouseId:warehouse,
   productId:product,expectedQty:5,actualQty:8,diff:3,
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
}finally{
 console.log('FINORA_PHASE5_POSTED_INSERT_DISPOSABLE: '+usersCreated+' temporary Auth users; local WP2 teardown owns this database.');
}
