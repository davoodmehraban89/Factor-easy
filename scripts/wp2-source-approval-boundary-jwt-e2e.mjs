import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// Issue #229 — EXPECTED CONTRACT RED, never a product pass.
// Real Auth JWT / PostgREST against the *disposable local* WP2 stack only.
// psql/service-role are strictly fixture and read-back tools, never the posting caller.
const api=String(process.env.API_URL||'').replace(/\/$/,'');
const anon=process.env.ANON_KEY,service=process.env.SERVICE_ROLE_KEY,db=process.env.DB_URL;
for(const [key,val] of Object.entries({API_URL:api,ANON_KEY:anon,SERVICE_ROLE_KEY:service,DB_URL:db})){
 assert.ok(val,'missing disposable WP2 setting '+key);
}
for(const [label,url] of [['API_URL',api],['DB_URL',db]]){
 const host=new URL(url).hostname.toLowerCase();
 assert.ok(['localhost','127.0.0.1','::1','[::1]'].includes(host),
  label+' MUST refer to localhost: refusing any nonlocal financial operation');
}
const suffix=Date.now()+'_'+crypto.randomUUID().slice(0,8);
const q=value=>"'"+String(value).replaceAll("'","''")+"'";
function sql(statement,scalar=false){
 const args=[db,'-X','-v','ON_ERROR_STOP=1'];
 if(scalar)args.push('-At');
 args.push('-c',statement);
 const result=spawnSync('psql',args,{encoding:'utf8'});
 assert.equal(result.status,0,'disposable fixture SQL failed; check local-stack logs');
 return (result.stdout||'').trim();
}
function rec(org,owner,collection,id,data){
 return '('+[q(org),q(owner),q(collection),q(id),q(JSON.stringify(data))+'::jsonb'].join(',')+')';
}
async function addUser(label){
 const email='finora-issue229-'+label+'-'+suffix+'@example.test';
 const password='QA-'+crypto.randomUUID()+'-Aa9!';
 const response=await fetch(api+'/auth/v1/admin/users',{
  method:'POST',
  headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},
  body:JSON.stringify({email,password,email_confirm:true,user_metadata:{username:'qa229'+label+Date.now()}})
 });
 const user=await response.json();
 assert.equal(response.status,200,'disposable Auth setup failed for '+label);
 assert.ok(user.id,'new Auth user missing ID');
 return {id:user.id,email,password};
}
async function login(user){
 const response=await fetch(api+'/auth/v1/token?grant_type=password',{
  method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},
  body:JSON.stringify({email:user.email,password:user.password})
 });
 const body=await response.json();
 assert.equal(response.status,200,'Auth user login failed');
 assert.equal(body.user?.id,user.id,'JWT identity mismatch');
 assert.ok(body.access_token,'Auth access token missing');
 return body.access_token;
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
const owner=await addUser('owner'),seller=await addUser('seller');
const org=crypto.randomUUID(),co='QA229_CO_'+suffix,fy='QA229_FY_'+suffix;
const cash='QA229_CASH_'+suffix,revenue='QA229_REV_'+suffix;
const sourceId='QA229_SALE_'+suffix,voucherId='QA229_JV_'+suffix;
sql('INSERT INTO public.organizations(id,owner_user_id,name) VALUES ('+
 q(org)+','+q(owner.id)+','+q('QA229 disposable organization')+');');
sql('UPDATE public.licenses SET organization_id='+q(org)+
 ",plan='lifetime',status='active',max_users=2,ends_at=date '2099-01-01',modules=array['full_suite']::text[] WHERE user_id="+q(owner.id)+';');
sql('INSERT INTO public.organization_members(organization_id,user_id,status,is_owner) VALUES ('+
 q(org)+','+q(owner.id)+",'active',true),("+q(org)+','+q(seller.id)+",'active',false);");
sql('INSERT INTO public.member_module_permissions(organization_id,member_id,module_key,capabilities,scope_type) '+
 'SELECT '+q(org)+",id,'commerce',array['read','create']::text[],'organization' "+
 'FROM public.organization_members WHERE organization_id='+q(org)+' AND user_id='+q(seller.id)+';');
const records=[
 rec(org,owner.id,'companies',co,{name:'QA229 disposable company'}),
 rec(org,owner.id,'fiscalYears',fy,{companyId:co,startDate:'1405/01/01',endDate:'1405/12/29',status:'open'}),
 rec(org,owner.id,'accounts',cash,{companyId:co,systemRole:'cash_default',accountType:'asset',
  normalBalance:'debit',level:'detail',postingAllowed:true,active:true,code:'1101',name:'QA229 cash'}),
 rec(org,owner.id,'accounts',revenue,{companyId:co,systemRole:'revenue_default',accountType:'revenue',
  normalBalance:'credit',level:'detail',postingAllowed:true,active:true,code:'4101',name:'QA229 revenue'})
];
sql('INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES '+records.join(',')+';');
sql('INSERT INTO private.finora_phase1a_account_role_snapshots ('+
 'organization_id,company_id,version,assignments,account_fields,approved,approved_by,reason) '+
 'SELECT '+q(org)+','+q(co)+",1,jsonb_build_object('cash_default',"+q(cash)+
 ",'revenue_default',"+q(revenue)+"),jsonb_build_object('cash_default',"+
 'private.finora_phase1a_account_fields(c.data),'+
 "'revenue_default',private.finora_phase1a_account_fields(r.data)),true,"+q(owner.id)+
 ",'Issue229 disposable snapshot' FROM public.records c JOIN public.records r ON "+
 'r.organization_id=c.organization_id AND r.collection='+q('accounts')+
 ' AND r.id='+q(revenue)+' WHERE c.organization_id='+q(org)+
 ' AND c.collection='+q('accounts')+' AND c.id='+q(cash)+';');
const data={companyId:co,date:'1405/01/01',kind:'formal',description:'QA229 restricted seller sale',
 reference:sourceId,accountingVersion:1,accountingStatus:'draft',documentStatus:'draft',
 paymentMethod:'cash',currencyCode:'IRR',items:[{prodId:'QA_PRODUCT',qty:1,price:125,lineTotal:125}],
 subtotal:125,discountType:'fixed',discountInput:0,discount:0,
 vatMode:'none',vatType:'percent',vatRate:0,vat:0,grandTotal:125};
sql('INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES '+
 rec(org,seller.id,'invoices',sourceId,data)+';');
const noExtraRoles=sql('SELECT count(*) FROM public.organization_member_roles mr '+
 'JOIN public.organization_members m ON m.id=mr.member_id WHERE m.organization_id='+
 q(org)+' AND m.user_id='+q(seller.id)+' AND mr.active;',true);
assert.equal(noExtraRoles,'0','seller unexpectedly inherits an assigned reusable role');
// Verify the REAL capability predicate with seller JWT subject as evaluated by auth.uid().
// No application privilege is inferred merely from the synthetic grant row.
const privilegeLog=sql('BEGIN; SELECT set_config('+q('request.jwt.claim.sub')+','+
 q(seller.id)+',true); SELECT '+
 "CASE WHEN private.has_org_capability("+q(org)+",'commerce','create') THEN 't' ELSE 'f' END || '|' || "+
 "CASE WHEN private.has_org_capability("+q(org)+",'accounting','approve') THEN 't' ELSE 'f' END; ROLLBACK;",true);
assert.ok(privilegeLog.split(/\r?\n/).includes('t|f'),
 'fixture does not have commerce:create without accounting:approve; NOT a product RED');
const jwt=await login(seller);
const args={p_organization_id:org,p_voucher_id:voucherId,
 p_source_collection:'invoices',p_source_id:sourceId,
 p_header:{companyId:co,fiscalYearId:fy,date:'1405/01/01',voucherType:'sale',
  sourceType:'sale',sourceId,sourceVersion:'1',description:'QA229 approval boundary'},
 p_lines:[]};
const result=await rpc('finora_journal_autopost',args,jwt);
// The existing code is known to bypass separate accounting approval.
// A 403/42501 here is an UNEXPECTED PASS of the new authorization boundary;
// review/update this expected-RED test to assert the complete fixed draft-first flow.
if(result.status!==200){
 throw Error('Approval bypass NOT reproduced: JWT RPC status '+result.status+
  '; inspect whether product has been repaired or fixture/setup failed. Do NOT count as expected RED.');
}
assert.equal(result.body?.voucher?.status,'posted',
 'existing code must have actually POSTED, otherwise no authorization-bypass evidence');
assert.equal(result.body?.voucher?.id,voucherId,
 'posted voucher identity mismatch; do not count a fake/partial response');
const journal=sql("SELECT data->>'status' FROM public.records WHERE organization_id="+q(org)+
 " AND collection='journalVouchers' AND id="+q(voucherId)+';',true);
const source=sql("SELECT (data->>'documentStatus') || '|' || (data->>'journalVoucherId') "+
 'FROM public.records WHERE organization_id='+q(org)+" AND collection='invoices' AND id="+q(sourceId)+';',true);
const lines=sql("SELECT count(*) || '|' || coalesce(sum((data->>'debit')::numeric),0) || '|' || "+
 "coalesce(sum((data->>'credit')::numeric),0) FROM public.records WHERE organization_id="+q(org)+
 " AND collection='journalLines' AND data->>'voucherId'="+q(voucherId)+';',true);
const audit=sql('SELECT count(*) FROM private.finora_phase1a_journal_audit WHERE organization_id='+
 q(org)+' AND voucher_id='+q(voucherId)+' AND actor_id='+q(seller.id)+'::uuid;',true);
const counter=sql('SELECT last_no FROM private.finora_phase1a_journal_counters WHERE organization_id='+
 q(org)+' AND fiscal_year_id='+q(fy)+';',true);
assert.equal(journal,'posted','JWT returned posted but journal status is not persisted');
assert.equal(source,'posted|'+voucherId,'source-to-posted linkage not persisted');
assert.equal(lines,'2|125|125','unexpected ledger line count or imbalance');
assert.ok(Number(audit)>=2,'Auth-user actor audit missing from persisted posting');
assert.equal(counter,'1','unexpected posting counter state');
console.log('FINORA_ISSUE229_APPROVAL_EXPECTED_RED: real non-owner commerce:create JWT without accounting:approve POSTED sale via legacy autopost; persisted source, voucher, balanced lines, actor audit and counter verified in disposable local Supabase. This is a CONFIRMED PRODUCT DEFECT, NOT a fix or authorization PASS.');


 
// Issue #229 purchase-specific parity: same *non-owner* user and original
// commerce:create-only grant. This is another EXPECTED PRODUCT RED on the
// existing code, NOT a proposed purchase posting implementation.
const purchaseCost='QA229_PURCHASE_COST_'+suffix,payable='QA229_PAYABLE_'+suffix;
const purchaseSource='QA229_PURCHASE_'+suffix,purchaseVoucher='QA229_PURCHASE_JV_'+suffix;
const expenseAccount={companyId:co,systemRole:'purchase_default',accountType:'expense',
 normalBalance:'debit',level:'detail',postingAllowed:true,active:true,code:'5101',
 name:'QA229 synthetic purchase expense'};
const payableAccount={companyId:co,systemRole:'payable_control',accountType:'liability',
 normalBalance:'credit',level:'detail',postingAllowed:true,active:true,code:'2101',
 name:'QA229 synthetic accounts payable'};
sql('INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES '+
 [rec(org,owner.id,'accounts',purchaseCost,expenseAccount),
  rec(org,owner.id,'accounts',payable,payableAccount)].join(',')+';');
// Preserve approved role-snapshot v1, extending it via immutable v2 for
// legitimate expense/payable source mapping (same proven local QA pattern).
sql('INSERT INTO private.finora_phase1a_account_role_snapshots ('+
 'organization_id,company_id,version,assignments,account_fields,approved,approved_by,reason) '+
 'SELECT '+q(org)+','+q(co)+',2,'+
 'old.assignments || jsonb_build_object('+
 "'purchase_default',"+q(purchaseCost)+",'payable_control',"+q(payable)+'),'+
 'old.account_fields || jsonb_build_object('+
 "'purchase_default',private.finora_phase1a_account_fields(p.data),"+
 "'payable_control',private.finora_phase1a_account_fields(a.data)),true,"+
 q(owner.id)+",'Issue229 disposable purchase v2' "+
 'FROM private.finora_phase1a_account_role_snapshots old '+
 'JOIN public.records p ON p.organization_id=old.organization_id AND p.collection='+
 q('accounts')+' AND p.id='+q(purchaseCost)+' '+
 'JOIN public.records a ON a.organization_id=old.organization_id AND a.collection='+
 q('accounts')+' AND a.id='+q(payable)+' '+
 'WHERE old.organization_id='+q(org)+' AND old.company_id='+q(co)+
 ' AND old.version=1 AND old.approved=true;');
assert.equal(sql('SELECT count(*) FROM private.finora_phase1a_account_role_snapshots '+
 'WHERE organization_id='+q(org)+' AND company_id='+q(co)+' AND approved;',true),'2',
 'purchase fixture must append role snapshot, not overwrite history');
const purchaseAmount=170;
const purchaseData={...data,reference:purchaseSource,grandTotal:purchaseAmount,
 subtotal:purchaseAmount,description:'QA229 restricted JWT credit purchase',
 paymentMethod:'credit',items:[{prodId:'QA_PRODUCT',qty:1,
  price:purchaseAmount,lineTotal:purchaseAmount}]};
sql('INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES '+
 rec(org,seller.id,'purchases',purchaseSource,purchaseData)+';');
// Assert the account never acquired accounting approve while expanding
// *account-mapping metadata* (which must not affect member permissions).
assert.equal(sql('SELECT count(*) FROM public.member_module_permissions p '+
 'JOIN public.organization_members m ON m.id=p.member_id '+
 'WHERE m.organization_id='+q(org)+' AND m.user_id='+q(seller.id)+
 " AND (p.module_key IN ('accounting','full_suite')) AND 'approve'=ANY(p.capabilities);",true),'0',
 'synthetic restricted seller gained accounting approval unexpectedly');
const purchaseRequest={p_organization_id:org,p_voucher_id:purchaseVoucher,
 p_source_collection:'purchases',p_source_id:purchaseSource,
 p_header:{companyId:co,fiscalYearId:fy,date:'1405/01/01',
  voucherType:'purchase',sourceType:'purchase',sourceId:purchaseSource,
  sourceVersion:'1',description:'QA229 restricted purchase approval boundary'},
 p_lines:[]};
const purchaseResponse=await rpc('finora_journal_autopost',purchaseRequest,jwt);
if(purchaseResponse.status!==200){
 throw Error('Purchase approval bypass NOT reproduced: JWT RPC status '+
  purchaseResponse.status+'; distinguish an owner product fix from QA setup failure.');
}
assert.equal(purchaseResponse.body?.voucher?.status,'posted',
 'purchase JWT returned without an actually posted voucher');
assert.equal(purchaseResponse.body?.voucher?.id,purchaseVoucher,
 'purchase JWT generated wrong voucher identity');
assert.equal(String(purchaseResponse.body?.voucher?.number),'2',
 'purchase did not consume exactly the next final number');
const purchaseJournal=sql("SELECT data->>'status' FROM public.records WHERE organization_id="+q(org)+
 " AND collection='journalVouchers' AND id="+q(purchaseVoucher)+';',true);
const purchaseSourceProjection=sql("SELECT (data->>'accountingStatus') || '|' || "+
 "(data->>'documentStatus') || '|' || (data->>'journalVoucherId') "+
 'FROM public.records WHERE organization_id='+q(org)+
 " AND collection='purchases' AND id="+q(purchaseSource)+';',true);
const sourceVoucherCount=sql('SELECT count(*) FROM public.records WHERE organization_id='+q(org)+
 " AND collection='journalVouchers' AND data->>'sourceType'='purchase' AND data->>'sourceId'="+
 q(purchaseSource)+';',true);
const voucherFilter='organization_id='+q(org)+
 " AND collection='journalLines' AND data->>'voucherId'="+q(purchaseVoucher);
const purchaseBalances=sql("SELECT count(*) || '|' || coalesce(sum((data->>'debit')::numeric),0) "+
 "|| '|' || coalesce(sum((data->>'credit')::numeric),0) FROM public.records WHERE "+
 voucherFilter+';',true);
const expenseEntries=sql("SELECT count(*) || '|' || coalesce(sum((data->>'debit')::numeric),0) "+
 "|| '|' || coalesce(sum((data->>'credit')::numeric),0) FROM public.records WHERE "+
 voucherFilter+" AND data->>'accountId'="+q(purchaseCost)+';',true);
const payableEntries=sql("SELECT count(*) || '|' || coalesce(sum((data->>'debit')::numeric),0) "+
 "|| '|' || coalesce(sum((data->>'credit')::numeric),0) FROM public.records WHERE "+
 voucherFilter+" AND data->>'accountId'="+q(payable)+';',true);
const purchaseAudit=sql('SELECT count(*) FROM private.finora_phase1a_journal_audit '+
 'WHERE organization_id='+q(org)+' AND voucher_id='+q(purchaseVoucher)+
 ' AND actor_id='+q(seller.id)+'::uuid;',true);
const purchaseCounter=sql('SELECT last_no FROM private.finora_phase1a_journal_counters '+
 'WHERE organization_id='+q(org)+' AND fiscal_year_id='+q(fy)+';',true);
assert.equal(purchaseJournal,'posted','purchase journal was not durably posted');
assert.equal(purchaseSourceProjection,'posted|posted|'+purchaseVoucher,
 'purchase source document/accounting status and voucher link inconsistent');
assert.equal(sourceVoucherCount,'1','source linked to duplicate purchased vouchers');
assert.equal(purchaseBalances,'2|170|170','purchase journal not exactly two balanced lines');
assert.equal(expenseEntries,'1|170|0','purchase expense debit mapping incorrect');
assert.equal(payableEntries,'1|0|170','purchase payable credit mapping incorrect');
assert.ok(Number(purchaseAudit)>=2,'purchase posting audit not attributed to restricted JWT');
assert.equal(purchaseCounter,'2','unexpected second final-number counter');
console.log('FINORA_ISSUE229_PURCHASE_APPROVAL_EXPECTED_RED: real non-owner commerce:create JWT without accounting:approve POSTED credit purchase via legacy autopost; persisted purchase source and unique posted voucher, debit expense 170, credit payable 170, actor audit and server numbering verified. CONFIRMED PRODUCT DEFECT, NOT FIX.');
