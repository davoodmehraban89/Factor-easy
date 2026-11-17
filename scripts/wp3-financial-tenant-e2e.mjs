import assert from 'node:assert/strict';

const api=process.env.API_URL,anon=process.env.ANON_KEY,service=process.env.SERVICE_ROLE_KEY,db=process.env.DB_URL;
for(const [k,v] of Object.entries({API_URL:api,ANON_KEY:anon,SERVICE_ROLE_KEY:service,DB_URL:db})) if(!v) throw new Error(`Missing ${k}`);
const suffix=`wp3-${Date.now()}`, users=[];
const q=s=>`'${String(s).replaceAll("'","''")}'`;
async function adminUser(email,password){
 const r=await fetch(`${api}/auth/v1/admin/users`,{method:'POST',headers:{apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'},body:JSON.stringify({email,password,email_confirm:true,user_metadata:{username:email.split('@')[0]}})});
 const b=await r.json();assert.equal(r.status,200,`admin user: ${JSON.stringify(b)}`);users.push(b.id);return b.id;
}
async function token(email,password){
 const r=await fetch(`${api}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
 const b=await r.json();assert.equal(r.status,200,`sign in: ${JSON.stringify(b)}`);return b.access_token;
}
async function rest(path,t,init={}){
 return fetch(`${api}/rest/v1/${path}`,{...init,headers:{apikey:anon,Authorization:`Bearer ${t}`,...(init.headers||{})}});
}
async function rpc(name,args,t){
 const r=await rest(`rpc/${name}`,t,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)});
 const body=await r.text();return {status:r.status,body};
}
const {spawnSync}=await import('node:child_process');
function psql(statement){
 const r=spawnSync('psql',[db,'-v','ON_ERROR_STOP=1','-c',statement],{encoding:'utf8'});
 if(r.status!==0)throw new Error(`psql failed: ${r.stderr||r.stdout}`);
}
const expectDenied=({status,body},label)=>{
 assert.ok(status===401||status===403, `${label}: expected explicit authentication/authorization denial (401/403), got HTTP ${status}: ${body}`);
};
try{
 const emailA=`wp3-a-${suffix}@example.test`,emailB=`wp3-b-${suffix}@example.test`;
 const passA=`Wp3-A-${crypto.randomUUID()}-Aa9!`,passB=`Wp3-B-${crypto.randomUUID()}-Aa9!`;
 const [userA,userB]=await Promise.all([adminUser(emailA,passA),adminUser(emailB,passB)]);
 const orgA=crypto.randomUUID(),orgB=crypto.randomUUID();
 psql(`
  insert into public.organizations(id,owner_user_id,name) values
   (${q(orgA)},${q(userA)},'WP3 tenant A ${suffix}'),(${q(orgB)},${q(userB)},'WP3 tenant B ${suffix}');
  update public.licenses set organization_id=${q(orgA)} where user_id=${q(userA)};
  update public.licenses set organization_id=${q(orgB)} where user_id=${q(userB)};
  insert into public.organization_members(organization_id,user_id,status,is_owner)
  values (${q(orgA)},${q(userA)},'active',true),(${q(orgB)},${q(userB)},'active',true);
 `);
 const [jwtA,jwtB]=await Promise.all([token(emailA,passA),token(emailB,passB)]);
 const voucherId=`wp3-voucher-${suffix}`,companyId=`wp3-company-${suffix}`,fyId=`wp3-fy-${suffix}`;
 const data={companyId,fiscalYearId:fyId,date:'1405/01/01',description:'WP3 isolated financial fixture',status:'draft',sourceType:'manual'};
 psql(`
  insert into public.records(organization_id,owner_id,collection,id,data) values
   (${q(orgA)},${q(userA)},'companies',${q(companyId)},'{"name":"WP3 fixture company"}'::jsonb),
   (${q(orgA)},${q(userA)},'fiscalYears',${q(fyId)},'{"companyId":"${companyId}","startDate":"1405/01/01","endDate":"1405/12/29","status":"open"}'::jsonb),
   (${q(orgA)},${q(userA)},'journalVouchers',${q(voucherId)},${q(JSON.stringify(data))}::jsonb);
 `);
 const own=await rest(`records?select=id,organization_id,data,version&collection=eq.journalVouchers&id=eq.${encodeURIComponent(voucherId)}`,jwtA);
 assert.equal(own.status,200);const ownRows=await own.json();assert.equal(ownRows.length,1,'tenant A must read its seeded voucher');
 const foreign=await rest(`records?select=id,organization_id,data&collection=eq.journalVouchers&id=eq.${encodeURIComponent(voucherId)}`,jwtB);
 assert.equal(foreign.status,200);assert.equal((await foreign.json()).length,0,'tenant B read another tenant journal voucher');
 const insertForeign=await rest('records?select=id',jwtB,{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({organization_id:orgA,owner_id:userB,collection:'journalVouchers',id:`wp3-injected-${suffix}`,data})});
 assert.ok(insertForeign.status===401||insertForeign.status===403, `cross-tenant insert must be explicitly denied (401/403), got ${insertForeign.status}: ${await insertForeign.text()}`);
 const updateForeign=await rest(`records?organization_id=eq.${orgA}&collection=eq.journalVouchers&id=eq.${encodeURIComponent(voucherId)}`,jwtB,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({data:{...data,description:'tampered by tenant B'}})});
 assert.ok(updateForeign.status===200||updateForeign.status===204, `unexpected cross-tenant update status ${updateForeign.status}`);
 assert.equal((await updateForeign.json().catch(()=>[])).length,0,'cross-tenant update returned modified rows');
 const deleteForeign=await rest(`records?organization_id=eq.${orgA}&collection=eq.journalVouchers&id=eq.${encodeURIComponent(voucherId)}`,jwtB,{method:'DELETE',headers:{Prefer:'return=representation'}});
 assert.ok(deleteForeign.status===200||deleteForeign.status===204,`unexpected cross-tenant delete status ${deleteForeign.status}`);
 assert.equal((await deleteForeign.json().catch(()=>[])).length,0,'cross-tenant delete returned deleted rows');
 const after=await rest(`records?select=id,data&collection=eq.journalVouchers&id=eq.${encodeURIComponent(voucherId)}`,jwtA);
 assert.equal(after.status,200);const afterRows=await after.json();assert.equal(afterRows.length,1);assert.equal(afterRows[0].data.description,data.description,'tenant B changed or deleted tenant A voucher');
 const orgArgs={p_organization_id:orgA,p_voucher_id:`wp3-rpc-${suffix}`,p_header:{companyId,fiscalYearId:fyId,date:'1405/01/01',description:'forbidden',sourceType:'manual'},p_lines:[]};
 expectDenied(await rpc('finora_journal_create_draft',orgArgs,jwtB),'create draft RPC');
 expectDenied(await rpc('finora_journal_update_draft',{p_organization_id:orgA,p_voucher_id:voucherId,p_expected_version:1,p_header:{description:'tamper'},p_lines:[]},jwtB),'update draft RPC');
 expectDenied(await rpc('finora_journal_delete_draft',{p_organization_id:orgA,p_voucher_id:voucherId,p_expected_version:1},jwtB),'delete draft RPC');
 expectDenied(await rpc('finora_journal_post',{p_organization_id:orgA,p_voucher_id:voucherId,p_expected_version:1},jwtB),'post RPC');
 expectDenied(await rpc('finora_journal_reverse',{p_organization_id:orgA,p_original_id:voucherId,p_reversal_id:`wp3-reversal-${suffix}`,p_date:'1405/01/02',p_reason:'unauthorized cross-tenant reversal',p_expected_version:1,p_allocations:null},jwtB),'reverse RPC');
 const finalA=await rest(`records?select=id,data&collection=eq.journalVouchers&id=eq.${encodeURIComponent(voucherId)}`,jwtA);
 assert.equal((await finalA.json()).length,1,'source voucher missing after forbidden RPC attempts');
 console.log('WP3_FINANCIAL_TENANT_ISOLATION_PASS: cross-tenant journal read/insert/update/delete and create/update/delete/post/reverse RPC attempts denied; tenant A fixture unchanged.');
}finally{
 console.log(`WP3 disposable fixtures: ${users.length} auth users; entire local Supabase stack is destroyed by workflow teardown.`);
}
