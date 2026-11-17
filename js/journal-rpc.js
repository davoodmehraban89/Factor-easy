/* WP2 — authoritative manual journal RPC adapter.
 * The server owns numbering, versions, authorization, balances and reversal state.
 * This adapter never writes journal collections through the generic datastore sync.
 */
let jeRpcEffectiveStatuses=new Map();
let jeRpcStatusRefreshToken=0;
let jeRpcPendingCreate=null;
let jeRpcBusy=false;
let jeRpcAutoPostBusy=false;

async function jeRpcAssertContext(){
 if(!currentUser?.id||!currentUser?.organizationId)throw new Error('سازمان فعال برای عملیات دفتر کل مشخص نیست.');
 const uid=currentUser.id,org=currentUser.organizationId;
 if(typeof window.requireFreshFinoraMembership==='function'&&!await window.requireFreshFinoraMembership())throw new Error('عضویت فعال سازمان تأیید نشد.');
 if(currentUser?.id!==uid||currentUser?.organizationId!==org)throw new Error('سازمان فعال هنگام اجرای عملیات تغییر کرد؛ دوباره تلاش کنید.');
 return org;
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
 for(const [i,l] of lines.entries()){
  if(!Number.isSafeInteger(Number(l.debit))||!Number.isSafeInteger(Number(l.credit))||Number(l.debit)<0||Number(l.credit)<0)
   throw new Error('مبلغ آرتیکل '+(i+1)+' خارج از محدوده دقت امن ریال است؛ ثبت برای جلوگیری از تغییر مبلغ متوقف شد.');
 }
 jeValidateLines(lines);
 return lines.map(l=>({accountId:l.accountId,debit:jeNum(l.debit),credit:jeNum(l.credit),
  description:String(l.description||''),dimensions:(l.dimensions||[]).map(d=>({
   dimensionTypeId:d.dimensionTypeId,dimensionValueId:d.dimensionValueId
  }))}));
}
async function jeRpcCall(name,args){
 if(jeRpcBusy)throw new Error('یک عملیات دفتر کل در حال اجراست؛ از ارسال دوباره درخواست خودداری کنید.');
 jeRpcBusy=true;let rpcSubmitted=false;
 try{
  const activeOrg=await jeRpcAssertContext();
  if(args.p_organization_id&&args.p_organization_id!==activeOrg)throw new Error('سازمان فعال تغییر کرده است؛ عملیات برای جلوگیری از ثبت بین‌سازمانی متوقف شد.');
  if(syncPending||syncRunning)throw new Error('ابتدا همگام‌سازی تغییرات دیگر را کامل کنید؛ عملیات دفتر کل برای جلوگیری از بازنویسی داده معلق متوقف شد.');
  rpcSubmitted=true;
  const {data,error}=await sb.rpc(name,args);
  if(error){const e=new Error(error.message||'عملیات دفتر کل در سرور انجام نشد.');e.code=error.code||'';throw e;}
  if(name==='finora_journal_read_graph')jeRpcBusy=false;
  return data;
 }catch(err){if(err&&typeof err==='object')err.rpcSubmitted=rpcSubmitted;jeRpcBusy=false;throw err;}
}
async function jeRpcRefresh(expectedOrg){
 try{
  if(currentUser?.organizationId!==expectedOrg)throw new Error('FINORA_ORGANIZATION_CONTEXT_CHANGED');
  if(syncPending||syncRunning)throw new Error('FINORA_SYNC_BECAME_PENDING');
  await pullAll();
  if(currentUser?.organizationId!==expectedOrg)throw new Error('FINORA_ORGANIZATION_CONTEXT_CHANGED');
  await jeRpcRefreshEffectiveStatuses();
 }catch(err){
  const e=new Error('عملیات در سرور ثبت شد، اما سازمان/اطلاعات صفحه تغییر کرد. صفحه را تازه کنید و پیش از ارسال مجدد، وضعیت سند را بررسی کنید.');
  e.code='FINORA_RPC_COMMITTED_REFRESH_FAILED';throw e;
 }finally{jeRpcBusy=false;}
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
 const header=jeRpcHeader(input,companyId,fy.id),lines=jeRpcLines(input.lines);
 const fingerprint=JSON.stringify({org,header,lines});
 if(jeRpcPendingCreate&&jeRpcPendingCreate.fingerprint!==fingerprint)
  throw new Error('وضعیت درخواست قبلی ثبت پیش‌نویس نامشخص است. ابتدا صفحه را تازه کنید و فهرست اسناد را بررسی کنید؛ درخواست جدید ارسال نشد.');
 const id=jeRpcPendingCreate?.id||afId('JV');
 jeRpcPendingCreate={id,fingerprint};
 const data=await jeRpcCall('finora_journal_create_draft',{
  p_organization_id:org,p_voucher_id:id,p_header:header,p_lines:lines
 });
 await jeRpcRefresh(org);
 jeRpcPendingCreate=null;
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
 await jeRpcRefresh(org);
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
 await jeRpcRefresh(org);
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
 await jeRpcRefresh(org);
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
 await jeRpcRefresh(org);
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


// Source posting is a server-owned transaction. The business source is first
// persisted as a draft; the RPC then derives lines from that persisted source
// and posts the voucher atomically. Only the source-to-voucher link is synced
// back through the generic record store.
const JE_RPC_JOURNAL_COLLECTIONS=new Set(['journalVouchers','journalLines','journalLineDimensions']);
function jeRpcAssertNoGenericJournalDiff(){
 if(typeof computeDiff!=='function')throw new Error('کنترل تغییرات دفتر کل در دسترس نیست؛ ثبت خودکار متوقف شد.');
 const diff=computeDiff();
 const dirty=[...(diff.up||[]).map(x=>x.coll),...(diff.del||[]).map(x=>String(x).split('|',1)[0])]
  .filter(x=>JE_RPC_JOURNAL_COLLECTIONS.has(x));
 if(dirty.length)throw new Error('تغییر محلی دفتر کل هنوز از مسیر قدیمی در صف همگام‌سازی است؛ ابتدا وضعیت را بررسی و تطبیق کنید. ثبت خودکار سرور اجرا نشد.');
}
function jeRpcSourceRecord(collection,id){
 if(collection==='invoices')return getMyInvoices().find(x=>x.id===id);
 if(collection==='purchases')return getMyPurchases().find(x=>x.id===id);
 return null;
}
async function jeRpcPersistSourceRecord(collection,id){
 const org=await jeRpcAssertContext(),key=collection+'|'+id;
 if(!['invoices','purchases'].includes(collection))throw new Error('نوع رکورد منبع برای ثبت خودکار پشتیبانی نمی‌شود.');
 const source=jeRpcSourceRecord(collection,id);
 if(!source||source.ownerUserId!==currentUser.id||source.companyId!==afCompanyId())
  throw new Error('رکورد منبع در حساب یا شرکت فعال پیدا نشد.');
 jeRpcAssertNoGenericJournalDiff();
 if(typeof saveDatastore!=='function'||typeof runSync!=='function'||typeof syncSnap==='undefined')
  throw new Error('لایه همگام‌سازی برای تأیید ثبت منبع در دسترس نیست.');
 saveDatastore();
 // saveDatastore schedules a delayed retry; cancel it because this adapter
 // owns the immediate flush and must not race its following journal RPC.
 if(typeof syncTimer!=='undefined'&&syncTimer!==null){clearTimeout(syncTimer);syncTimer=null;}
 await runSync();
 const deadline=Date.now()+20000;
 while(Date.now()<deadline){
  if(currentUser?.organizationId!==org)throw new Error('سازمان فعال هنگام ذخیره رکورد منبع تغییر کرد.');
  const latest=jeRpcSourceRecord(collection,id);
  const expected=latest&&JSON.stringify(stripOwner(latest));
  const diff=typeof computeDiff==='function'?computeDiff():{up:[],del:[]};
  const sourceDirty=(diff.up||[]).some(x=>x.key===key)||(diff.del||[]).includes(key);
  if(!syncRunning&&!syncPending&&!sourceDirty&&syncSnap.get(key)===expected){
   jeRpcAssertNoGenericJournalDiff();
   return latest;
  }
  if(Number(syncFailCount||0)>0)break;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw new Error('تأیید ذخیره رکورد منبع از سرور دریافت نشد؛ ثبت حسابداری انجام نشد یا وضعیت باید پس از بارگذاری مجدد بررسی شود.');
}
async function jeRpcAutoPost(kind,sourceId){
 if(jeRpcAutoPostBusy)throw new Error('ثبت خودکار همین منبع در حال اجراست؛ از ارسال دوباره درخواست خودداری کنید.');
 jeRpcAutoPostBusy=true;
 try{
 if(!requireWrite())throw new Error('مجوز قطعی‌سازی حسابداری ندارید.');
 const collection=kind==='sale'?'invoices':kind==='purchase'?'purchases':'';
 if(!collection)throw new Error('نوع ثبت خودکار پشتیبانی نمی‌شود.');
 const org=await jeRpcAssertContext();
 let source=jeRpcSourceRecord(collection,sourceId);
 if(!source||source.ownerUserId!==currentUser.id||source.companyId!==afCompanyId())
  throw new Error('رکورد منبع برای شرکت فعال پیدا نشد.');
 if(source.journalVoucherId){
  let existing=getMyJournalVouchers().find(v=>v.id===source.journalVoucherId);
  if(!existing){await jeRpcRefresh(org);source=jeRpcSourceRecord(collection,sourceId);existing=getMyJournalVouchers().find(v=>v.id===source?.journalVoucherId);}
  if(existing?.status==='posted'&&jeRpcEffectiveStatus(existing)!=='reversed'){delete source.accountingPostingPending;delete source.accountingPostingPendingAt;return existing;}
  if(existing&&jeRpcEffectiveStatus(existing)==='reversed')throw new Error('سند منبع قبلاً برگشت حسابداری شده است؛ ثبت مجدد مجاز نیست.');
  throw new Error('رکورد منبع از قبل به سندی متصل است؛ وضعیت اتصال باید بررسی شود.');
 }
 if(!Number.isSafeInteger(Number(source.grandTotal))||Number(source.grandTotal)<=0)
  throw new Error('مبلغ کل منبع باید عدد صحیح مثبت و امن باشد.');
 const date=jeRpcDate(source.date),fy=jeFiscalForDate(date);
 if(!fy||fy.status==='locked')throw new Error('سال مالی باز برای تاریخ رکورد منبع پیدا نشد.');
 const sourceVersion=Number(source.accountingVersion||1);
 if(!Number.isSafeInteger(sourceVersion)||sourceVersion<1)throw new Error('نسخه رویداد منبع معتبر نیست.');
 // Commit the source draft first. The transient freeze marker is local-only;
 // stripOwner deliberately excludes it from generic sync payloads.
 await jeRpcPersistSourceRecord(collection,sourceId);
 source=jeRpcSourceRecord(collection,sourceId);
 source.accountingPostingPending=true;
 source.accountingPostingPendingAt=source.accountingPostingPendingAt||new Date().toISOString();
 const header={companyId:source.companyId,fiscalYearId:fy.id,date,
  description:String(source.description||((kind==='sale'?'فروش ':'خرید ')+(source.number||source.id))),
  reference:String(source.reference||source.number||''),voucherType:kind,
  sourceType:kind,sourceId:String(source.id),sourceVersion:String(sourceVersion)};
 let result;
 try{
  result=await jeRpcCall('finora_journal_autopost',{
   p_organization_id:org,p_voucher_id:afId('JV'),p_source_collection:collection,
   p_source_id:String(source.id),p_header:header,p_lines:[]
  });
 }catch(err){
  // A returned database error or a pre-submit rejection is definitive. A
  // transport failure after submission remains frozen until retry/reload.
  if(err?.code||err?.rpcSubmitted===false){
   delete source.accountingPostingPending;delete source.accountingPostingPendingAt;
  }
  throw err;
 }
 const voucher=result?.voucher;
 if(!voucher?.id)throw new Error('پاسخ ثبت خودکار سرور فاقد شناسه سند است؛ وضعیت را پیش از تکرار بررسی کنید.');
 if(voucher.status!=='posted'){
  await jeRpcRefresh(org);
  throw new Error('این منبع قبلاً برگشت حسابداری شده است؛ ثبت مجدد آن مجاز نیست.');
 }
 await jeRpcRefresh(org);
 if(jeRpcEffectiveStatus(voucher)==='reversed')throw new Error('این منبع قبلاً برگشت حسابداری شده است؛ ثبت مجدد آن مجاز نیست.');
 const reconciledSource=jeRpcSourceRecord(collection,sourceId);
 if(!reconciledSource||reconciledSource.journalVoucherId!==voucher.id||
    reconciledSource.accountingStatus!=='posted'||reconciledSource.documentStatus!=='posted')
  throw new Error('سند قطعی ثبت شد اما پیوند منبع در همان تراکنش سرور تأیید نشد؛ ثبت مجدد نکنید و وضعیت را بررسی کنید.');
 return voucher;
 }finally{jeRpcAutoPostBusy=false;}
}
