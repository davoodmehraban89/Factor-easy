import assert from 'node:assert/strict';

const api=process.env.API_URL,anon=process.env.ANON_KEY,service=process.env.SERVICE_ROLE_KEY,db=process.env.DB_URL;
for(const [k,v] of Object.entries({API_URL:api,ANON_KEY:anon,SERVICE_ROLE_KEY:service,DB_URL:db})) if(!v) throw new Error(`Missing ${k}`);
// This integration fixture must never target hosted Supabase.
for (const [value,protocols,port] of [[api,['http:'], '54321'],[db,['postgres:','postgresql:'],'54322']]) {
 const u=new URL(value);
 assert.ok(protocols.includes(u.protocol) && ['127.0.0.1','localhost','[::1]'].includes(u.hostname) && u.port===port,
  'WP3 refuses non-disposable local API/DB target');
}
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
 const debitId=`wp3-debit-${suffix}`,creditId=`wp3-credit-${suffix}`;
 const header={companyId,fiscalYearId:fyId,date:'1405/01/01',description:'WP3 isolated financial fixture',sourceType:'manual'};
 const data={...header,status:'draft'};
 const lines=[{accountId:debitId,debit:100,credit:0},{accountId:creditId,debit:0,credit:100}];
 psql(`
  insert into public.records(organization_id,owner_id,collection,id,data) values
   (${q(orgA)},${q(userA)},'companies',${q(companyId)},'{"name":"WP3 fixture company"}'::jsonb),
   (${q(orgA)},${q(userA)},'fiscalYears',${q(fyId)},'{"companyId":"${companyId}","startDate":"1405/01/01","endDate":"1405/12/29","status":"open"}'::jsonb),
   (${q(orgA)},${q(userA)},'accounts',${q(debitId)},${q(JSON.stringify({companyId,code:'WP3D',name:'WP3 debit',postingAllowed:true,active:true}))}::jsonb),
   (${q(orgA)},${q(userA)},'accounts',${q(creditId)},${q(JSON.stringify({companyId,code:'WP3C',name:'WP3 credit',postingAllowed:true,active:true}))}::jsonb);
 `);
 // Do not seed a journal through unauthed SQL: lifecycle allocation requires
 // the real authenticated actor, even on a disposable DB.
 const created=await rpc('finora_journal_create_draft',{p_organization_id:orgA,p_voucher_id:voucherId,p_header:header,p_lines:lines},jwtA);
 assert.equal(created.status,200,`WP3 authorized create draft: HTTP ${created.status}: ${created.body}`);
 const ownPath=`records?select=id,organization_id,owner_id,data,version&organization_id=eq.${orgA}&collection=eq.journalVouchers&id=eq.${encodeURIComponent(voucherId)}`;
 const linesPath=`records?select=id,organization_id,owner_id,data,version&organization_id=eq.${orgA}&collection=eq.journalLines&data->>voucherId=eq.${encodeURIComponent(voucherId)}&order=id.asc`;
 async function snapshot(path,t){const r=await rest(path,t);assert.equal(r.status,200,'WP3 snapshot HTTP status');return r.json();}
 const ownRows=await snapshot(ownPath,jwtA);
 assert.equal(ownRows.length,1,'tenant A must read the authenticated draft');
 const own=ownRows[0];
 assert.equal(own.id,voucherId);assert.equal(own.organization_id,orgA);assert.equal(own.owner_id,userA);
 for(const [k,v] of Object.entries(data)) assert.equal(own.data[k],v,`draft ${k}`);
 assert.equal(own.data.createdBy,userA,'draft must record authenticated creator');
 const version=Number(own.version);assert.ok(Number.isSafeInteger(version)&&version>0,'persisted positive version required');
 const ownLines=await snapshot(linesPath,jwtA);assert.equal(ownLines.length,2);
 for(const expected of lines){
  const matches=ownLines.filter(row=>row.data.accountId===expected.accountId);
  assert.equal(matches.length,1,'each expected account appears exactly once');
  const row=matches[0];assert.equal(row.organization_id,orgA);assert.equal(row.owner_id,userA);
  assert.equal(row.data.voucherId,voucherId);assert.equal(row.data.companyId,companyId);
  assert.equal(row.data.debit,expected.debit);assert.equal(row.data.credit,expected.credit);
 }
 console.log('WP3_AUTHENTICATED_DRAFT_FIXTURE_PASS: signed owner JWT created balanced draft and owner readback confirmed voucher, actor, version and two lines');
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
 const orgArgs={p_organization_id:orgA,p_voucher_id:`wp3-rpc-${suffix}`,p_header:{...header,description:'forbidden'},p_lines:lines};
 expectDenied(await rpc('finora_journal_create_draft',orgArgs,jwtB),'create draft RPC');
 expectDenied(await rpc('finora_journal_update_draft',{p_organization_id:orgA,p_voucher_id:voucherId,p_expected_version:version,p_header:{description:'tamper'},p_lines:lines},jwtB),'update draft RPC');
 expectDenied(await rpc('finora_journal_delete_draft',{p_organization_id:orgA,p_voucher_id:voucherId,p_expected_version:version},jwtB),'delete draft RPC');
 expectDenied(await rpc('finora_journal_post',{p_organization_id:orgA,p_voucher_id:voucherId,p_expected_version:version},jwtB),'post RPC');
 expectDenied(await rpc('finora_journal_reverse',{p_organization_id:orgA,p_original_id:voucherId,p_reversal_id:`wp3-reversal-${suffix}`,p_date:'1405/01/02',p_reason:'unauthorized cross-tenant reversal',p_expected_version:version,p_allocations:null},jwtB),'reverse RPC');
 assert.deepEqual(await snapshot(ownPath,jwtA),ownRows,'foreign operations changed original voucher');
 assert.deepEqual(await snapshot(linesPath,jwtA),ownLines,'foreign operations changed original lines');
 for (const id of [`wp3-injected-${suffix}`,orgArgs.p_voucher_id,`wp3-reversal-${suffix}`]){
  const rows=await snapshot(`records?select=id&organization_id=eq.${orgA}&collection=eq.journalVouchers&id=eq.${encodeURIComponent(id)}`,jwtA);
  assert.equal(rows.length,0,'foreign attempt created a voucher');
 }
 console.log('WP3_FINANCIAL_TENANT_ISOLATION_PASS: cross-tenant journal read/insert/update/delete and create/update/delete/post/reverse RPC attempts denied; tenant A fixture unchanged.');
}finally{
 console.log(`WP3 disposable fixtures: ${users.length} auth users; entire local Supabase stack is destroyed by workflow teardown.`);
}
