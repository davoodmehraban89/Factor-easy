import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// Positive financial RPC proof: real Auth JWT + PostgREST on a disposable Supabase.
// The service key and psql are used ONLY to provision synthetic fixture records.
const api=process.env.API_URL;
const anon=process.env.ANON_KEY;
const service=process.env.SERVICE_ROLE_KEY;
const db=process.env.DB_URL;
for(const [name,value] of Object.entries({API_URL:api,ANON_KEY:anon,SERVICE_ROLE_KEY:service,DB_URL:db})){
 if(!value)throw new Error('Missing disposable Supabase value: '+name);
}
const suffix=Date.now()+'-'+crypto.randomUUID().slice(0,8);
const q=value=>"'"+String(value).replaceAll("'","''")+"'";
function sql(statement){
 const result=spawnSync('psql',[db,'-v','ON_ERROR_STOP=1','-c',statement],{encoding:'utf8'});
 assert.equal(result.status,0,'fixture SQL failed: '+(result.stderr||result.stdout));
}
async function rest(path,accessToken,init={}){
 return fetch(api+'/rest/v1/'+path,{
  ...init,
  headers:{apikey:anon,Authorization:'Bearer '+accessToken,...(init.headers||{})}
 });
}
async function rpc(name,args,jwt){
 const response=await rest('rpc/'+name,jwt,{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(args)
 });
 const text=await response.text();
 let body;
 try{body=JSON.parse(text)}catch{body=text}
 return {status:response.status,body};
}
function success(result,label){
 assert.equal(result.status,200,label+' must succeed for an authorized JWT; result: '+JSON.stringify(result.body));
 assert.ok(result.body&&typeof result.body==='object',label+' returned no JSON object');
 return result.body;
}
async function ownRecords(org,jwt,collection){
 const response=await rest('records?select=id,version,data&organization_id=eq.'+encodeURIComponent(org)+'&collection=eq.'+encodeURIComponent(collection),jwt);
 assert.equal(response.status,200,'authorized '+collection+' read failed: '+await response.text().catch(()=>'')); 
 return response.json();
}
const email='wp2-positive-'+suffix+'@example.test';
const password='WP2-'+crypto.randomUUID()+'-Aa9!';
const signup=await fetch(api+'/auth/v1/admin/users',{
 method:'POST',
 headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},
 body:JSON.stringify({email,password,email_confirm:true,user_metadata:{username:'wp2positive'+Date.now()}})
});
const userBody=await signup.json();
assert.equal(signup.status,200,'fixture user provisioning failed');
const userId=userBody.id;
const org=crypto.randomUUID();
const company='POSITIVE_CO_'+suffix;
const fiscal='POSITIVE_FY_'+suffix;
const debitAccount='POSITIVE_DEBIT_'+suffix;
const creditAccount='POSITIVE_CREDIT_'+suffix;
const voucher='POSITIVE_JV_'+suffix;
sql([
 'insert into public.organizations(id,owner_user_id,name) values ('+q(org)+','+q(userId)+','+q('WP2 positive synthetic')+');',
 'update public.licenses set organization_id='+q(org)+", plan='lifetime', status='active', ends_at=date '2099-01-01', modules=array['full_suite']::text[] where user_id="+q(userId)+';',
 'insert into public.organization_members(organization_id,user_id,status,is_owner) values ('+q(org)+','+q(userId)+",'active',true);",
 'insert into public.records(organization_id,owner_id,collection,id,data) values '+
  '('+q(org)+','+q(userId)+",'companies',"+q(company)+','+q(JSON.stringify({name:'WP2 synthetic company'}))+'::jsonb),'+
  '('+q(org)+','+q(userId)+",'fiscalYears',"+q(fiscal)+','+q(JSON.stringify({companyId:company,startDate:'1405/01/01',endDate:'1405/12/29',status:'open'}))+'::jsonb),'+
  '('+q(org)+','+q(userId)+",'accounts',"+q(debitAccount)+','+q(JSON.stringify({companyId:company,code:'1101',name:'QA debit',postingAllowed:true,active:true}))+'::jsonb),'+
  '('+q(org)+','+q(userId)+",'accounts',"+q(creditAccount)+','+q(JSON.stringify({companyId:company,code:'4101',name:'QA credit',postingAllowed:true,active:true}))+'::jsonb);'
].join('\n'));
const login=await fetch(api+'/auth/v1/token?grant_type=password',{
 method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},
 body:JSON.stringify({email,password})
});
const signed=await login.json();
assert.equal(login.status,200,'disposable Auth JWT login failed');
assert.equal(signed.user?.id,userId,'wrong synthetic actor');
assert.ok(signed.access_token,'missing signed-in user JWT');
const jwt=signed.access_token;
const header={companyId:company,fiscalYearId:fiscal,date:'1405/01/01',sourceType:'manual',voucherType:'manual',description:'authorized synthetic double-entry'};
const lines=[
 {id:'positive-debit-'+suffix,accountId:debitAccount,debit:150,credit:0,dimensions:[]},
 {id:'positive-credit-'+suffix,accountId:creditAccount,debit:0,credit:150,dimensions:[]}
];
const args={p_organization_id:org,p_voucher_id:voucher,p_header:header,p_lines:lines};
const created=success(await rpc('finora_journal_create_draft',args,jwt),'create draft');
assert.equal(created.replayed,false,'first draft create unexpectedly replayed');
assert.equal(created.voucher?.status,'draft','draft status missing');
assert.equal(created.voucher?.id,voucher,'unexpected draft id');
const version=Number(created.voucher?.version);
assert.ok(Number.isSafeInteger(version)&&version>0,'server version required for optimistic post');
const replay=success(await rpc('finora_journal_create_draft',args,jwt),'same-request replay');
assert.equal(replay.replayed,true,'same request must be idempotent');
assert.equal(replay.voucher?.id,voucher,'replay changed identity');
let voucherRows=(await ownRecords(org,jwt,'journalVouchers')).filter(v=>v.id===voucher);
assert.equal(voucherRows.length,1,'draft must be recorded once');
let journalRows=(await ownRecords(org,jwt,'journalLines')).filter(v=>v.data?.voucherId===voucher);
assert.equal(journalRows.length,2,'replaying draft duplicated journal lines');
assert.equal(journalRows.reduce((n,l)=>n+Number(l.data?.debit||0),0),150);
assert.equal(journalRows.reduce((n,l)=>n+Number(l.data?.credit||0),0),150);
const posted=success(await rpc('finora_journal_post',{
 p_organization_id:org,p_voucher_id:voucher,p_expected_version:version
},jwt),'post draft');
assert.equal(posted.voucher?.status,'posted','authorized post was not persisted');
assert.match(String(posted.voucher?.number||''),/^[1-9][0-9]*$/,'posting must allocate a server number');
const allocated=posted.voucher.number;
const postReplay=success(await rpc('finora_journal_post',{
 p_organization_id:org,p_voucher_id:voucher,p_expected_version:version
},jwt),'post replay');
assert.equal(postReplay.replayed,true,'already-posted operation must replay safely');
assert.equal(postReplay.voucher?.number,allocated,'post replay changed allocated number');
voucherRows=(await ownRecords(org,jwt,'journalVouchers')).filter(v=>v.id===voucher);
assert.equal(voucherRows.length,1,'posted document disappeared');
assert.equal(voucherRows[0].data.status,'posted');
assert.equal(voucherRows[0].data.number,allocated,'server number differs from returned post');
journalRows=(await ownRecords(org,jwt,'journalLines')).filter(v=>v.data?.voucherId===voucher);
assert.equal(journalRows.length,2,'posting changed balanced line count');
const debit=journalRows.reduce((n,l)=>n+Number(l.data?.debit||0),0);
const credit=journalRows.reduce((n,l)=>n+Number(l.data?.credit||0),0);
assert.equal(debit,credit,'posted journal is unbalanced');
assert.equal(debit,150);
const badId='POSITIVE_UNBALANCED_'+suffix;
const badArgs={...args,p_voucher_id:badId,p_lines:[
 {...lines[0],id:'bad-debit-'+suffix,debit:50},
 {...lines[1],id:'bad-credit-'+suffix,credit:40}
]};
const refused=await rpc('finora_journal_create_draft',badArgs,jwt);
assert.ok(refused.status>=400,'unbalanced journal unexpectedly accepted by real service');
assert.ok(!(await ownRecords(org,jwt,'journalVouchers')).some(x=>x.id===badId),'rejected draft left persisted voucher');
assert.ok(!(await ownRecords(org,jwt,'journalLines')).some(x=>x.data?.voucherId===badId),'rejected draft left orphan lines');
console.log('WP2_POSITIVE_AUTHORIZED_JOURNAL_PASS: real JWT create/replay/post/readback, balanced lines, immutable post number and failed-create rollback in disposable local Supabase');
