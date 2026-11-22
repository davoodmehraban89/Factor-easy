import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// Stage C QA only — live local Auth/JWT + PostgREST, synthetic fixture.
// psql and the local admin service key ONLY prepare disposable data and inject
// a deterministic failure at the final source-link write. The financial RPC
// requests themselves MUST use the logged-in user's JWT.
const api=process.env.API_URL,anon=process.env.ANON_KEY;
const service=process.env.SERVICE_ROLE_KEY,db=process.env.DB_URL;
for(const [name,value] of Object.entries({API_URL:api,ANON_KEY:anon,SERVICE_ROLE_KEY:service,DB_URL:db})){
 assert.ok(value,'missing disposable local Supabase setting '+name);
}
const suffix=Date.now()+'_'+crypto.randomUUID().slice(0,8);
const q=value=>"'"+String(value).replaceAll("'","''")+"'";
function command(statement,scalar=false){
 const flags=['-X','-v','ON_ERROR_STOP=1'];
 if(scalar)flags.push('-At');
 const out=spawnSync('psql',[db,...flags,'-c',statement],{encoding:'utf8'});
 assert.equal(out.status,0,'local fixture SQL failed: '+(out.stderr||out.stdout).slice(-800));
 return (out.stdout||'').trim();
}
async function rest(collection,token){
 const url=api+'/rest/v1/records?select=id,owner_id,version,data&collection=eq.'+encodeURIComponent(collection);
 const response=await fetch(url,{headers:{apikey:anon,Authorization:'Bearer '+token}});
 const raw=await response.text();
 assert.equal(response.status,200,'signed-in journal read failed ('+collection+'): '+raw.slice(0,600));
 return JSON.parse(raw);
}
async function rpc(name,args,jwt){
 const response=await fetch(api+'/rest/v1/rpc/'+name,{
  method:'POST',headers:{apikey:anon,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},
  body:JSON.stringify(args)
 });
 const raw=await response.text();
 let body;
 try{body=JSON.parse(raw)}catch{body=raw}
 return {status:response.status,body};
}
function ok(result,label){
 assert.equal(result.status,200,label+': '+JSON.stringify(result.body));
 assert.ok(result.body&&typeof result.body==='object',label+': missing object');
 return result.body;
}
const email='wp2-source-'+suffix+'@example.test',password='Qa-'+crypto.randomUUID()+'-Aa9!';
const signup=await fetch(api+'/auth/v1/admin/users',{
 method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},
 body:JSON.stringify({email,password,email_confirm:true,user_metadata:{username:'qa'+suffix}})
});
const user=await signup.json();
assert.equal(signup.status,200,'disposable Auth user setup failed');
const uid=user.id,org=crypto.randomUUID();
const co='QA_CO_'+suffix,fy='QA_FY_'+suffix;
const cash='QA_CASH_'+suffix,revenue='QA_REV_'+suffix;
const accCash={companyId:co,systemRole:'cash_default',accountType:'asset',normalBalance:'debit',
 level:'detail',postingAllowed:true,active:true,code:'1101',name:'Synthetic cash'};
const accRevenue={companyId:co,systemRole:'revenue_default',accountType:'revenue',normalBalance:'credit',
 level:'detail',postingAllowed:true,active:true,code:'4101',name:'Synthetic revenue'};
command('INSERT INTO public.organizations(id,owner_user_id,name) VALUES ('+
 q(org)+','+q(uid)+','+q('QA source '+suffix)+');');
command("UPDATE public.licenses SET organization_id="+q(org)+
 ",plan='lifetime',status='active',ends_at=date '2099-01-01',modules=array['full_suite']::text[] WHERE user_id="+q(uid)+';');
command('INSERT INTO public.organization_members(organization_id,user_id,status,is_owner) VALUES ('+
 q(org)+','+q(uid)+",'active',true);");
const rec=(collection,id,data)=>'('+q(org)+','+q(uid)+','+q(collection)+','+q(id)+','+q(JSON.stringify(data))+'::jsonb)';
command('INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES '+
 [rec('companies',co,{name:'QA company'}),rec('fiscalYears',fy,{companyId:co,startDate:'1405/01/01',endDate:'1405/12/29',status:'open'}),
  rec('accounts',cash,accCash),rec('accounts',revenue,accRevenue)].join(',')+';');
command('INSERT INTO private.finora_phase1a_account_role_snapshots ('+
 'organization_id,company_id,version,assignments,account_fields,approved,approved_by,reason) '+
 'SELECT '+q(org)+','+q(co)+",1,jsonb_build_object('cash_default',"+q(cash)+
 ",'revenue_default',"+q(revenue)+"),jsonb_build_object('cash_default',"+
 'private.finora_phase1a_account_fields(c.data),'+
 "'revenue_default',private.finora_phase1a_account_fields(r.data)),true,"+q(uid)+
 ",'QA disposable approved binding' FROM public.records c JOIN public.records r ON "+
 'r.organization_id=c.organization_id AND r.collection='+q('accounts')+' AND r.id='+q(revenue)+
 ' WHERE c.organization_id='+q(org)+' AND c.collection='+q('accounts')+' AND c.id='+q(cash)+';');
const login=await fetch(api+'/auth/v1/token?grant_type=password',{
 method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email,password})
});
const signed=await login.json();
assert.equal(login.status,200,'real user sign-in failed');
assert.equal(signed.user?.id,uid,'wrong authenticated user');
assert.ok(signed.access_token,'missing Auth-issued token');
const jwt=signed.access_token;
function newSource(id,amount){
 return {companyId:co,date:'1405/01/01',kind:'formal',description:'Synthetic sale',
  reference:id,accountingVersion:1,accountingStatus:'draft',documentStatus:'draft',
  paymentMethod:'cash',currencyCode:'IRR',
  items:[{prodId:'QA_PRODUCT',qty:1,price:amount,lineTotal:amount}],
  subtotal:amount,discountType:'fixed',discountInput:0,discount:0,
  vatMode:'none',vatType:'percent',vatRate:0,vat:0,grandTotal:amount};
}
function seedSource(id,amount){
 command('INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES '+
  rec('invoices',id,newSource(id,amount))+';');
}
const voucherArgs=(id,source)=>({
 p_organization_id:org,p_voucher_id:id,p_source_collection:'invoices',p_source_id:source,
 p_header:{companyId:co,fiscalYearId:fy,date:'1405/01/01',voucherType:'sale',
  sourceType:'sale',sourceId:source,sourceVersion:'1',description:'JWT source autolink'},
 p_lines:[]
});
const own=async(collection)=> (await rest(collection,jwt))
 .filter(x=>x.data?.companyId===co);
const sourceRow=async(id)=>{
 const items=(await own('invoices')).filter(x=>x.id===id);
 assert.equal(items.length,1,'source not found by authorized JWT');
 return items[0];
};
const voucherRows=async(source)=> (await own('journalVouchers')).filter(x=>
 x.data?.sourceType==='sale'&&x.data?.sourceId===source);
const voucherLines=async(id)=> (await own('journalLines')).filter(x=>x.data?.voucherId===id);
const counter=()=>command('SELECT last_no FROM private.finora_phase1a_journal_counters WHERE organization_id='+
 q(org)+' AND fiscal_year_id='+q(fy)+';',true);
const auditCount=id=>Number(command(
 'SELECT count(*) FROM private.finora_phase1a_journal_audit WHERE organization_id='+
 q(org)+' AND voucher_id='+q(id)+';',true));
const auditWrongActors=id=>Number(command(
 'SELECT count(*) FROM private.finora_phase1a_journal_audit WHERE organization_id='+
 q(org)+' AND voucher_id='+q(id)+' AND actor_id IS DISTINCT FROM '+q(uid)+'::uuid;',true));
const businessOnly=data=>{
 const copy={...data};
 for(const key of ['journalVoucherId','accountingStatus','accountingPostedAt',
  'documentStatus','documentPostedAt','documentPostedBy','documentVersion',
  'updatedAt','accountingPostingPending','accountingPostingPendingAt'])delete copy[key];
 return copy;
};

// 1. Positive real source→journal commit, plus replay with an unrelated RPC
// request voucher ID: server must recover by stable source/version, not caller ID.
const firstSource='QA_SALE_A_'+suffix,firstVoucher='QA_VOUCH_A_'+suffix;
seedSource(firstSource,120);
const initial=await sourceRow(firstSource);
assert.equal(initial.data?.journalVoucherId,undefined,'draft already linked');
const posted=ok(await rpc('finora_journal_autopost',voucherArgs(firstVoucher,firstSource),jwt),'source autopost');
assert.equal(posted.voucher?.status,'posted','autopost did not post');
assert.equal(posted.voucher?.id,firstVoucher,'server changed voucher ID');
assert.match(String(posted.voucher?.number||''),/^[1-9][0-9]*$/);
let source=await sourceRow(firstSource);
assert.equal(source.data.journalVoucherId,firstVoucher,'server failed to link source in same operation');
assert.equal(source.data.accountingStatus,'posted');
assert.equal(source.data.documentStatus,'posted');
assert.equal(source.data.grandTotal,120,'autopost mutated source business amount');
assert.deepEqual(businessOnly(source.data),businessOnly(initial.data),
 'posted source must preserve all unrelated business fields');
let vouchers=await voucherRows(firstSource);
assert.equal(vouchers.length,1,'duplicate source vouchers');
let lines=await voucherLines(firstVoucher);
assert.equal(lines.length,2,'source has wrong number of ledger lines');
assert.equal(lines.reduce((s,x)=>s+Number(x.data?.debit||0),0),120);
assert.equal(lines.reduce((s,x)=>s+Number(x.data?.credit||0),0),120);
const successfulAuditCount=auditCount(firstVoucher);
assert.ok(successfulAuditCount>=2,'source posting must keep draft-created and posted audit events');
assert.equal(auditWrongActors(firstVoucher),0,'source audit actor must be Auth JWT subject');
const replay=ok(await rpc('finora_journal_autopost',
 voucherArgs('QA_DIFFERENT_RETRY_'+suffix,firstSource),jwt),'replay with changed request ID');
assert.equal(replay.replayed,true,'source-level replay did not succeed');
assert.equal(replay.voucher?.id,firstVoucher,'source retry created different voucher');
assert.equal(replay.voucher?.number,posted.voucher.number,'source retry changed financial number');
assert.equal((await voucherRows(firstSource)).length,1);
assert.equal((await voucherLines(firstVoucher)).length,2);
assert.equal(auditCount(firstVoucher),successfulAuditCount,
 'idempotent source retry must not append another posting audit event');

// 2. Deterministic AFTER-POST failure at the source link: all rows and
// counters MUST roll back. Only the disposable local database gets this trigger.
const failingSource='QA_FAIL_LINK_'+suffix,failingVoucher='QA_FAIL_JV_'+suffix;
seedSource(failingSource,130);
const oldCounter=counter();
const fn='finora_qa_inject_source_link_'+suffix.replaceAll('-','_');
const trigger='finora_qa_fail_link_'+suffix.replaceAll('-','_');
command('CREATE FUNCTION private.'+fn+'() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='+
 q('')+' AS $f$ BEGIN IF NEW.collection='+q('invoices')+' AND NEW.id='+q(failingSource)+
 " AND coalesce(NEW.data->>'journalVoucherId','')<>'' THEN "+
 "RAISE EXCEPTION 'FINORA_QA_FORCED_LINK_FAILURE' USING ERRCODE='P0001'; "+
 'END IF; RETURN NEW; END $f$;');
command('CREATE TRIGGER '+trigger+' BEFORE UPDATE ON public.records FOR EACH ROW EXECUTE FUNCTION private.'+fn+'();');
const rejected=await rpc('finora_journal_autopost',voucherArgs(failingVoucher,failingSource),jwt);
assert.ok(rejected.status>=400,'injected source link failure unexpectedly posted');
assert.match(JSON.stringify(rejected.body),/FINORA_QA_FORCED_LINK_FAILURE/,
 'expected failure must occur at source link AFTER posting attempt');
assert.equal((await voucherRows(failingSource)).length,0,'journal header survived failed source link');
assert.equal((await voucherLines(failingVoucher)).length,0,'journal lines survived failed source link');
const afterFailure=await sourceRow(failingSource);
assert.equal(afterFailure.data.accountingStatus,'draft','source status changed despite rollback');
assert.ok(!afterFailure.data.journalVoucherId,'source link survived failed transaction');
assert.equal(counter(),oldCounter,'failed source link consumed a committed number');
assert.equal(auditCount(failingVoucher),0,
 'audit records survived a rolled-back source-link failure');
command('DROP TRIGGER '+trigger+' ON public.records;');
command('DROP FUNCTION private.'+fn+'();');

// 3. Two independent real JWT RPC requests for the SAME source with different
// voucher IDs are forced to race. At most one source voucher/number may persist.
const racingSource='QA_RACE_SALE_'+suffix;
seedSource(racingSource,140);
const [raceA,raceB]=await Promise.all([
 rpc('finora_journal_autopost',voucherArgs('QA_RACE_A_'+suffix,racingSource),jwt),
 rpc('finora_journal_autopost',voucherArgs('QA_RACE_B_'+suffix,racingSource),jwt)
]);
const a=ok(raceA,'concurrent source A'),b=ok(raceB,'concurrent source B');
assert.equal(a.voucher.id,b.voucher.id,'concurrent source requests posted different vouchers');
assert.equal(a.voucher.number,b.voucher.number,'concurrent source requests allocated different numbers');
assert.ok(a.replayed===true||b.replayed===true,
 'one concurrent request must recover already-posted source');
source=await sourceRow(racingSource);
assert.equal(source.data.journalVoucherId,a.voucher.id,'concurrent source link is inconsistent');
vouchers=await voucherRows(racingSource);
assert.equal(vouchers.length,1,'concurrent source request double-posted');
lines=await voucherLines(a.voucher.id);
assert.equal(lines.length,2,'concurrent source created duplicate lines');
assert.equal(lines.reduce((s,x)=>s+Number(x.data?.debit||0),0),140);
assert.equal(lines.reduce((s,x)=>s+Number(x.data?.credit||0),0),140);
assert.ok(auditCount(a.voucher.id)>=2,'concurrent winner is missing audit trail');
assert.equal(auditWrongActors(a.voucher.id),0,
 'concurrent source posting audit actor must be Auth JWT subject');
console.log('FINORA_SOURCE_JWT_ATOMIC_PASS: real user JWT positive source link/replay, injected late-link rollback with unchanged counter, and two-request source concurrency; audit attribution and rollback also verified in disposable Supabase');

// 4. Auth-JWT negative contract for the REAL persisted posted source.
command('INSERT INTO private.finora_phase1a_guard_modes(organization_id,mode) VALUES ('+
 q(org)+",'enforce') ON CONFLICT (organization_id) DO UPDATE SET mode='enforce';");
async function userRestMutation(method,collection,id,data){
 const url=new URL(api+'/rest/v1/records');
 for(const [key,value] of Object.entries({
  organization_id:org,collection,id
 }))url.searchParams.set(key,'eq.'+value);
 const res=await fetch(url,{method,
  headers:{apikey:anon,Authorization:'Bearer '+jwt,
   'Content-Type':'application/json',Prefer:'return=representation'},
  ...(data===undefined?{}:{body:JSON.stringify({data})})
 });
 const raw=await res.text();let body;
 try{body=JSON.parse(raw)}catch{body=raw}
 return {status:res.status,body};
}
function financialGuardRejected(result,label,pattern){
 assert.ok(result.status>=400&&result.status<500,
  label+' succeeded or had unexpected status: '+JSON.stringify(result));
 assert.ok(result.body&&typeof result.body==='object'&&
  ['23514','P0001'].includes(String(result.body.code||'')),
  label+' was only RLS denied or did not hit financial guard: '+JSON.stringify(result));
 assert.match(JSON.stringify(result.body),pattern,label+' wrong guard error');
}
const frozenSource=(await sourceRow(firstSource)).data;
const frozenVoucher=(await voucherRows(firstSource))[0];
const frozenLines=await voucherLines(firstVoucher);
const frozenCounter=counter(),frozenAudit=auditCount(firstVoucher);
financialGuardRejected(await userRestMutation('PATCH','invoices',firstSource,{
 ...frozenSource,description:'forged commercial amendment'
}),'posted sale commercial edit',/FINORA_POSTED_SOURCE_IMMUTABLE|linked to posted\/reversed/i);
financialGuardRejected(await userRestMutation('PATCH','invoices',firstSource,{
 ...frozenSource,journalVoucherId:'FORGED_JOURNAL',documentStatus:'draft'
}),'posted sale accounting projection forgery',
 /FINORA_POSTED_SOURCE_LINK_PROJECTION_INVALID|linked to posted\/reversed/i);
financialGuardRejected(await userRestMutation('DELETE','invoices',firstSource),
 'posted sale direct delete',/FINORA_POSTED_SOURCE_IMMUTABLE|linked to posted\/reversed/i);
financialGuardRejected(await userRestMutation('PATCH','journalLines',frozenLines[0].id,{
 ...frozenLines[0].data,debit:1
}),'posted journal line edit',/FINORA_POSTED_JOURNAL_CHILD_IMMUTABLE/i);
const deniedVoucherDelete=await rpc('finora_journal_delete_draft',{
 p_organization_id:org,p_voucher_id:firstVoucher,
 p_expected_version:frozenVoucher.version
},jwt);
assert.ok(deniedVoucherDelete.status>=400&&deniedVoucherDelete.status<500,
 'posted source voucher delete_draft RPC succeeded');
assert.match(JSON.stringify(deniedVoucherDelete.body),
 /FINORA_JOURNAL_NOT_DRAFT|FINORA_SOURCE|FORBIDDEN/i,
 'posted source voucher RPC did not reject for a financial reason');
assert.deepEqual((await sourceRow(firstSource)).data,frozenSource,
 'posted source changed after denied JWT mutation');
assert.deepEqual((await voucherRows(firstSource))[0],frozenVoucher,
 'posted voucher changed after denied JWT mutation');
assert.deepEqual(await voucherLines(firstVoucher),frozenLines,
 'posted journal lines changed after denied JWT mutation');
assert.equal(counter(),frozenCounter,'denied JWT action changed final counter');
assert.equal(auditCount(firstVoucher),frozenAudit,'denied JWT action changed audit');
console.log('FINORA_POSTED_SOURCE_JWT_IMMUTABLE_PASS: live JWT source edit, forged link, delete, posted journal line edit and linked voucher delete rejected by financial guard; source, voucher, lines, counter and audit unchanged');
