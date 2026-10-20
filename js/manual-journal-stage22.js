/* Stage 2.2 only: manual voucher RPC strangler. Commercial flows unchanged.
   The authoritative mode comes from the server on every manual operation. */
const finoraManualLegacy={
 create:jeCreateDraft,update:jeUpdateDraft,remove:jeDeleteDraft,post:jePost
};
window.finoraManualGuardMode=null;
window.finoraManualGuardOrg=null;
const finoraManualInFlight=new Map();
function finoraManualOrg(){
 if(!currentUser?.organizationId)throw new Error('سازمان فعال مشخص نیست.');
 return currentUser.organizationId;
}
async function finoraManualMode(){
 const org=finoraManualOrg();
 const {data,error}=await sb.rpc('finora_journal_get_guard_mode',{p_organization_id:org});
 if(error)throw new Error('دریافت حالت سروری دفترکل انجام نشد: '+error.message);
 if(!['off','audit','enforce'].includes(data))throw new Error('حالت سروری دفترکل نامعتبر است.');
 window.finoraManualGuardOrg=org;window.finoraManualGuardMode=data;
 return data;
}
function finoraManualEnforced(){
 return window.finoraManualGuardMode==='enforce' &&
 window.finoraManualGuardOrg===currentUser?.organizationId;
}
function finoraManualError(e){
 const msg=String(e?.message||e||'');
 if(/FINORA_VERSION_CONFLICT|FINORA_DRAFT_REQUEST_CONFLICT|FINORA_GUARD_MODE_CONFLICT/.test(msg))
  return new Error('نسخه سند با نسخه سرور تعارض دارد. «بارگذاری نسخه سرور» را انتخاب کنید. FINORA_VERSION_CONFLICT');
 if(/FINORA_FISCAL_YEAR_LOCKED/.test(msg))return new Error('سال مالی قفل است.');
 if(/FINORA_(MANUAL_DRAFT_REQUIRED|DRAFT_DELETE_FORBIDDEN)/.test(msg))return new Error('فقط پیش‌نویس دستی قابل ویرایش یا حذف است.');
 if(/FINORA_(OPENING_CLOSING_NOT_APPROVED)/.test(msg))return new Error('سند افتتاحیه یا اختتامیه هنوز مجوز قطعی‌سازی ندارد.');
 if(/FINORA_(ORG_FORBIDDEN|MODULE_FORBIDDEN|GUARD_MODE_OWNER_ONLY)/.test(msg))
  return new Error('مجوز عملیات حسابداری برای شما صادر نشده است.');
 return new Error('عملیات دفترکل تأیید نشد: '+msg);
}
function finoraManualPayload(input){
 const companyId=afCompanyId(),date=input.date||getJalaliNumeric(),fy=jeFiscalForDate(date);
 if(!companyId||!fy||fy.status==='locked')throw new Error('سال مالی باز برای این سند پیدا نشد.');
 const vt=input.voucherType||'manual';
 if(!['manual','adjustment'].includes(vt))throw new Error('ثبت افتتاحیه و اختتامیه به تصویب قرارداد جداگانه نیاز دارد.');
 if(input.sourceId || (input.sourceType&&input.sourceType!=='manual'))
  throw new Error('این مسیر فقط برای سند دستی است.');
 jeValidateLines(input.lines);
 const lines=input.lines.map(l=>({
  accountId:l.accountId,debit:jeNum(l.debit),credit:jeNum(l.credit),
  description:String(l.description||''),
  dimensions:Array.isArray(l.dimensions)?l.dimensions.map(d=>({
   dimensionTypeId:d.dimensionTypeId,dimensionValueId:d.dimensionValueId
  })):[]
 }));
 return {header:{companyId,fiscalYearId:fy.id,date,sourceType:'manual',
  voucherType:vt,description:String(input.description||''),
  reference:String(input.reference||'')},lines};
}
async function finoraManualCall(name,parameters){
 const {data,error}=await sb.rpc(name,parameters);
 if(error)throw finoraManualError(error);
 return data;
}
function finoraManualSnapshotRemove(collection,id){
 const key=collection+'|'+id;
 syncSnap.delete(key);versionSnap.delete(key);
}
function finoraManualSetLocalRows(id,rows){
 const names=['journalVouchers','journalLines','journalLineDimensions'],uid=currentUser.id;
 const former=(datastore.journalLines||[]).filter(x=>x.voucherId===id).map(x=>x.id);
 for(const c of names){
  const removed=(datastore[c]||[]).filter(x=>c==='journalVouchers'?x.id===id:
   c==='journalLines'?x.voucherId===id:
   x.voucherId===id||former.includes(x.journalLineId));
  removed.forEach(x=>finoraManualSnapshotRemove(c,x.id));
  datastore[c]=(datastore[c]||[]).filter(x=>!removed.includes(x));
 }
 for(const row of rows){
  const c=row.collection;if(!names.includes(c))continue;
  const item={...row.data,id:row.id,ownerUserId:uid};
  datastore[c].push(item);
  const key=c+'|'+row.id;
  syncSnap.set(key,JSON.stringify(stripOwner(item)));
  versionSnap.set(key,Number(row.version));
 }
}
async function finoraManualReadRows(id){
 const org=finoraManualOrg(),out=[];
 const v=await sb.from('records').select('collection,id,data,version')
  .eq('organization_id',org).eq('collection','journalVouchers').eq('id',id).maybeSingle();
 if(v.error)throw finoraManualError(v.error);
 if(v.data)out.push(v.data);
 for(const coll of ['journalLines','journalLineDimensions']){
  const r=await sb.from('records').select('collection,id,data,version')
   .eq('organization_id',org).eq('collection',coll)
   .filter('data->>voucherId','eq',id);
  if(r.error)throw finoraManualError(r.error);
  out.push(...(r.data||[]));
 }
 return out;
}
async function finoraManualReload(id){
 const rows=await finoraManualReadRows(id);
 finoraManualSetLocalRows(id,rows);
 return (datastore.journalVouchers||[]).find(x=>x.id===id)||null;
}
window.jeLoadServerVersion=async function(id){
 try{await finoraManualReload(id);renderJournal();alert('آخرین نسخه سند از سرور بارگذاری شد؛ سایر تغییرات محلی حفظ شدند.');}
 catch(e){alert(finoraManualError(e).message);}
};
async function finoraManualApply(id,response){
 if(response?.deleted)finoraManualSetLocalRows(id,[]);
 else await finoraManualReload(id);
 return response?.deleted?true:(datastore.journalVouchers||[]).find(x=>x.id===id);
}
async function finoraManualCreate(input){
 const {header,lines}=finoraManualPayload(input),id=input.__requestId||afId('JV');
 const data=await finoraManualCall('finora_journal_create_draft',{
  p_organization_id:finoraManualOrg(),p_voucher_id:id,p_header:header,p_lines:lines});
 return finoraManualApply(id,data);
}
async function finoraManualUpdate(id,input){
 const voucher=getMyJournalVouchers().find(x=>x.id===id);
 if(!voucher||voucher.status!=='draft')throw new Error('پیش‌نویس سند پیدا نشد.');
 const {header,lines}=finoraManualPayload(input);
 const {sourceType,...updateHeader}=header;
 const expected=versionSnap.get('journalVouchers|'+id);
 if(!Number.isSafeInteger(expected))throw new Error('نسخه سرور ناشناخته است؛ ابتدا بارگذاری کنید.');
 const data=await finoraManualCall('finora_journal_update_draft',{
  p_organization_id:finoraManualOrg(),p_voucher_id:id,
  p_expected_version:expected,p_header:updateHeader,p_lines:lines});
 return finoraManualApply(id,data);
}
async function finoraManualDelete(id){
 const expected=versionSnap.get('journalVouchers|'+id);
 if(!Number.isSafeInteger(expected))throw new Error('نسخه سرور ناشناخته است؛ ابتدا بارگذاری کنید.');
 const data=await finoraManualCall('finora_journal_delete_draft',{
  p_organization_id:finoraManualOrg(),p_voucher_id:id,p_expected_version:expected});
 return finoraManualApply(id,data);
}
function finoraManualIsTimeout(e){
 return /timeout|abort|network|fetch failed|Failed to fetch/i.test(String(e?.message||''));
}
async function finoraManualPost(id){
 if(finoraManualInFlight.has(id))return finoraManualInFlight.get(id);
 const job=(async()=>{
  if(typeof navigator!=='undefined'&&navigator.onLine===false)
   throw new Error('برای قطعی‌سازی اتصال اینترنت لازم است. پیش‌نویس محفوظ است.');
  const expected=versionSnap.get('journalVouchers|'+id);
  if(!Number.isSafeInteger(expected))throw new Error('نسخه سرور ناشناخته است؛ بارگذاری کنید.');
  const args={p_organization_id:finoraManualOrg(),p_voucher_id:id,p_expected_version:expected};
  try{
   const result=await Promise.race([
    finoraManualCall('finora_journal_post',args),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('FINORA_POST_TIMEOUT')),12000))
   ]);
   return finoraManualApply(id,result);
  }catch(e){
   if(!finoraManualIsTimeout(e))throw e;
   // A timeout NEVER creates a second document or ID. Query same ID first.
   const known=await finoraManualReload(id);
   if(known?.status==='posted')return known;
   if(known?.status!=='draft')throw new Error('وضعیت قطعی‌سازی نامشخص است؛ مجدداً وضعیت را بررسی کنید.');
   if(versionSnap.get('journalVouchers|'+id)!==expected)
    throw new Error('نسخه سرور تغییر کرده است؛ بارگذاری نسخه سرور لازم است.');
   return finoraManualApply(id,await finoraManualCall('finora_journal_post',args));
  }
 })().finally(()=>finoraManualInFlight.delete(id));
 finoraManualInFlight.set(id,job);return job;
}
jeCreateDraft=function(input){
 if((input?.sourceType||'manual')!=='manual')return finoraManualLegacy.create(input);
 if(['off','audit'].includes(window.finoraManualGuardMode) &&
  window.finoraManualGuardOrg===currentUser?.organizationId)return finoraManualLegacy.create(input);
 return finoraManualMode().then(mode=>mode==='enforce'?finoraManualCreate(input):finoraManualLegacy.create(input));
};
jeUpdateDraft=function(id,input){
 if(['off','audit'].includes(window.finoraManualGuardMode) &&
  window.finoraManualGuardOrg===currentUser?.organizationId)return finoraManualLegacy.update(id,input);
 return finoraManualMode().then(mode=>mode==='enforce'?finoraManualUpdate(id,input):finoraManualLegacy.update(id,input));
};
jeDeleteDraft=function(id){
 if(['off','audit'].includes(window.finoraManualGuardMode) &&
  window.finoraManualGuardOrg===currentUser?.organizationId)return finoraManualLegacy.remove(id);
 return finoraManualMode().then(mode=>mode==='enforce'?finoraManualDelete(id):finoraManualLegacy.remove(id));
};
jePost=function(id){
 const voucher=getMyJournalVouchers().find(x=>x.id===id);
 if(voucher?.sourceType!=='manual')return finoraManualLegacy.post(id);
 if(['off','audit'].includes(window.finoraManualGuardMode) &&
  window.finoraManualGuardOrg===currentUser?.organizationId)return finoraManualLegacy.post(id);
 return finoraManualMode().then(mode=>mode==='enforce'?finoraManualPost(id):finoraManualLegacy.post(id));
};
