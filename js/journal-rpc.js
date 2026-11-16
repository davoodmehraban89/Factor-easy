/* WP2 — authoritative manual journal RPC adapter.
 * The server owns numbering, versions, authorization, balances and reversal state.
 * This adapter never writes journal collections through the generic datastore sync.
 */
let jeRpcEffectiveStatuses=new Map();
let jeRpcStatusRefreshToken=0;

async function jeRpcAssertContext(){
 if(!currentUser?.id||!currentUser?.organizationId)throw new Error('سازمان فعال برای عملیات دفتر کل مشخص نیست.');
 if(typeof window.requireFreshFinoraMembership==='function'&&!await window.requireFreshFinoraMembership())throw new Error('عضویت فعال سازمان تأیید نشد.');
 return currentUser.organizationId;
}
function jeRpcDate(value){
 const date=toEnDigits(String(value||getJalaliNumeric()).trim()).slice(0,10);
 if(!/^\d{4}\/\d{2}\/\d{2}$/.test(date))throw new Error('تاریخ سند معتبر نیست.');
 return date;
}
function jeRpcHeader(input,companyId,fiscalYearId){
 const date=jeRpcDate(input.date);
 const fy=getMyFiscalYears().find(x=>x.id===fiscalYearId)||jeFiscalForDate(date);
 if(!fy||fy.id!==fiscalYearId||fy.status==='locked')throw new Error('سال مالی متناظر باز و معتبر نیست.');
 return {companyId,fiscalYearId:fy.id,date,description:String(input.description||''),
  reference:String(input.reference||''),voucherType:String(input.voucherType||'manual')};
}
function jeRpcLines(lines){
 jeValidateLines(lines);
 return lines.map(l=>({accountId:l.accountId,debit:jeNum(l.debit),credit:jeNum(l.credit),
  description:String(l.description||''),dimensions:(l.dimensions||[]).map(d=>({
   dimensionTypeId:d.dimensionTypeId,dimensionValueId:d.dimensionValueId
  }))}));
}
async function jeRpcCall(name,args){
 await jeRpcAssertContext();
 if(syncPending||syncRunning)throw new Error('ابتدا همگام‌سازی تغییرات دیگر را کامل کنید؛ عملیات دفتر کل برای جلوگیری از بازنویسی داده معلق متوقف شد.');
 const {data,error}=await sb.rpc(name,args);
 if(error){const e=new Error(error.message||'عملیات دفتر کل در سرور انجام نشد.');e.code=error.code||'';throw e;}
 return data;
}
async function jeRpcRefresh(){
 try{await pullAll();}catch(err){const e=new Error('عملیات در سرور ثبت شد، اما تازه‌سازی اطلاعات کامل نشد. صفحه را تازه کنید و پیش از ارسال مجدد، وضعیت سند را بررسی کنید.');e.code='FINORA_RPC_COMMITTED_REFRESH_FAILED';throw e;}
 await jeRpcRefreshEffectiveStatuses();
}
async function jeRpcRefreshEffectiveStatuses(){
 const token=++jeRpcStatusRefreshToken,org=await jeRpcAssertContext();
 const {data,error}=await sb.from('finora_journal_reversal_status')
  .select('voucher_id,effective_status').eq('organization_id',org);
 if(error){console.warn('journal effective status view unavailable',error);jeRpcEffectiveStatuses=new Map();return;}
 if(token!==jeRpcStatusRefreshToken||currentUser?.organizationId!==org)return;
 jeRpcEffectiveStatuses=new Map((data||[]).map(x=>[x.voucher_id,x.effective_status]));
}
function jeRpcEffectiveStatus(v){return jeRpcEffectiveStatuses.get(v.id)||v.status||'draft';}
async function jeRpcCreateDraft(input){
 if(!requireWrite())throw new Error('مجوز ثبت سند ندارید.');
 const org=await jeRpcAssertContext(),companyId=afCompanyId(),date=jeRpcDate(input.date);
 const fy=jeFiscalForDate(date);
 if(!companyId||!fy||fy.status==='locked')throw new Error('شرکت یا سال مالی باز برای تاریخ سند پیدا نشد.');
 const id=afId('JV'),header=jeRpcHeader(input,companyId,fy.id);
 const data=await jeRpcCall('finora_journal_create_draft',{
  p_organization_id:org,p_voucher_id:id,p_header:header,p_lines:jeRpcLines(input.lines)
 });
 await jeRpcRefresh();
 return data?.voucher||getMyJournalVouchers().find(x=>x.id===id)||data;
}
async function jeRpcUpdateDraft(voucherId,input){
 if(!requireWrite())throw new Error('مجوز ویرایش سند ندارید.');
 const org=await jeRpcAssertContext(),v=getMyJournalVouchers().find(x=>x.id===voucherId);
 if(!v||v.status!=='draft'||(v.sourceType||'manual')!=='manual')throw new Error('فقط پیش‌نویس دستی قابل ویرایش است.');
 if(!Number.isInteger(Number(v._serverVersion)))throw new Error('نسخه معتبر سند در سرور پیدا نشد؛ فهرست را تازه‌سازی کنید.');
 const header=jeRpcHeader(input,v.companyId,v.fiscalYearId);
 const data=await jeRpcCall('finora_journal_update_draft',{
  p_organization_id:org,p_voucher_id:voucherId,p_expected_version:Number(v._serverVersion),
  p_header:header,p_lines:jeRpcLines(input.lines)
 });
 await jeRpcRefresh();
 return data?.voucher||getMyJournalVouchers().find(x=>x.id===voucherId)||data;
}
async function jeRpcPost(voucherId){
 if(!requireWrite())throw new Error('مجوز قطعی‌سازی سند ندارید.');
 const org=await jeRpcAssertContext(),v=getMyJournalVouchers().find(x=>x.id===voucherId);
 if(!v||v.status!=='draft')throw new Error('فقط پیش‌نویس قابل قطعی‌سازی است.');
 if(!Number.isInteger(Number(v._serverVersion)))throw new Error('نسخه معتبر سند در سرور پیدا نشد؛ فهرست را تازه‌سازی کنید.');
 const data=await jeRpcCall('finora_journal_post',{
  p_organization_id:org,p_voucher_id:voucherId,p_expected_version:Number(v._serverVersion)
 });
 await jeRpcRefresh();
 return data?.voucher||getMyJournalVouchers().find(x=>x.id===voucherId)||data;
}
async function jeRpcDeleteDraft(voucherId){
 if(!requireWrite())throw new Error('مجوز حذف پیش‌نویس ندارید.');
 const org=await jeRpcAssertContext(),v=getMyJournalVouchers().find(x=>x.id===voucherId);
 if(!v||v.status!=='draft'||(v.sourceType||'manual')!=='manual')throw new Error('فقط پیش‌نویس دستی قابل حذف است.');
 if(!Number.isInteger(Number(v._serverVersion)))throw new Error('نسخه معتبر سند در سرور پیدا نشد.');
 const data=await jeRpcCall('finora_journal_delete_draft',{
  p_organization_id:org,p_voucher_id:voucherId,p_expected_version:Number(v._serverVersion)
 });
 await jeRpcRefresh();
 return data;
}
async function jeRpcReverse(voucherId,date,reason){
 if(!requireWrite())throw new Error('مجوز برگشت سند ندارید.');
 const org=await jeRpcAssertContext(),v=getMyJournalVouchers().find(x=>x.id===voucherId);
 if(!v||v.status!=='posted')throw new Error('سند قطعی در سازمان فعال پیدا نشد.');
 await jeRpcRefreshEffectiveStatuses();
 const effective=jeRpcEffectiveStatus(v);
 if(effective!=='posted')throw new Error(effective==='reversed'?'این سند قبلاً به‌طور کامل برگشت شده است.':'این سند قبلاً برگشت جزئی داشته؛ برای برگشت مانده، تخصیص جزئی لازم است.');
 if(!Number.isInteger(Number(v._serverVersion)))throw new Error('نسخه معتبر سند در سرور پیدا نشد.');
 const data=await jeRpcCall('finora_journal_reverse',{
  p_organization_id:org,p_original_id:voucherId,p_reversal_id:afId('JV'),
  p_date:jeRpcDate(date),p_reason:String(reason||'').trim(),
  p_expected_version:Number(v._serverVersion),p_allocations:null
 });
 await jeRpcRefresh();
 return data;
}
async function jeRpcCopyVoucher(voucherId,date){
 const {voucher:v,lines}=jeVoucherDraftInput(voucherId);
 return jeRpcCreateDraft({date:date||getJalaliNumeric(),description:'کپی سند '+(v.number||v.id)+(v.description?' — '+v.description:''),
  reference:v.reference||('سند '+(v.number||v.id)),voucherType:'manual',lines});
}
async function jeRpcReadGraph(voucherId){
 return jeRpcCall('finora_journal_read_graph',{p_organization_id:await jeRpcAssertContext(),p_voucher_id:voucherId});
}
