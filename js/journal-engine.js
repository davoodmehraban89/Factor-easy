/* Phase 3 — immutable double-entry journal engine */
const JE_EPSILON=0.0001;
let jeMutationDepth=0;
// This is an in-memory unit of work, not a database transaction. Cloud atomicity
// and concurrent posting still require the server gate documented in the handoff.
function jeSave(){if(!jeMutationDepth&&saveDatastore()===false)throw new Error('ذخیره تغییرات مجاز نیست.');}
function jeAtomic(work){
 if(jeMutationDepth)return work();
 const keys=['postingProfiles','journalVouchers','journalLines','journalLineDimensions','invoices','purchases','payments','expenses'];
 const snapshot=Object.fromEntries(keys.map(k=>[k,JSON.parse(JSON.stringify(datastore[k]||[]))]));
 jeMutationDepth++;
 try{const result=work();if(saveDatastore()===false)throw new Error('ذخیره تغییرات مجاز نیست.');return result;}
 catch(error){keys.forEach(k=>{datastore[k]=snapshot[k]});throw error;}
 finally{jeMutationDepth--;}
}
const JE_DATE_FORMAT=new Intl.DateTimeFormat('en-US-u-ca-persian',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'});
function jePersianDate(date){
 const parts=JE_DATE_FORMAT.formatToParts(date),get=type=>parts.find(p=>p.type===type).value;
 return get('year')+'/'+get('month')+'/'+get('day');
}
function jeDate(value){
 const raw=toEnDigits(String(value||getJalaliNumeric()).trim());
 const j=raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
 if(j){
  const y=Number(j[1]),m=Number(j[2]),d=Number(j[3]);if(y<1000||y>1700||m<1||m>12||d<1||d>(m<=6?31:30))throw new Error('تاریخ شمسی سند معتبر نیست.');
  const canonical=j[1]+'/'+j[2].padStart(2,'0')+'/'+j[3].padStart(2,'0');
  // ICU calendar roundtrip rejects Esfand 30 in non-leap years. No guessed leap cycle.
  for(let day=18;day<=23;day++){
   const start=Date.UTC(y+621,2,day,12);
   if(jePersianDate(new Date(start))===j[1]+'/01/01'){
    const offset=(m<=7?(m-1)*31:186+(m-7)*30)+d-1;
    if(jePersianDate(new Date(start+offset*86400000))===canonical)return canonical;
    break;
   }
  }
  throw new Error('تاریخ شمسی سند معتبر نیست.');
 }
 if(/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(raw)){
  const [year,month,day]=raw.slice(0,10).split('-').map(Number),check=new Date(Date.UTC(year,month-1,day));
  const date=new Date(raw);if(!Number.isFinite(date.getTime())||check.getUTCFullYear()!==year||check.getUTCMonth()+1!==month||check.getUTCDate()!==day)throw new Error('تاریخ سند معتبر نیست.');
  return jePersianDate(date);
 }
 throw new Error('تاریخ سند معتبر نیست.');
}
function jeMoney(value){const n=Number(value??0);if(!Number.isFinite(n)||n<0||!Number.isSafeInteger(Math.round(n)))throw new Error('مبلغ سند باید عدد معتبر و غیرمنفی باشد.');return Math.round(n);}
function jeSourceScope(source){if(!source?.id||source.ownerUserId!==currentUser?.id||source.companyId!==afCompanyId())throw new Error('مالک یا شرکت سند با شرکت فعال مطابقت ندارد.');}

function jeOwned(k){const cid=afCompanyId();return(datastore[k]||[]).filter(x=>x.ownerUserId===currentUser?.id&&x.companyId===cid)}
function getMyPostingProfiles(){return jeOwned('postingProfiles')} function getMyJournalVouchers(){return jeOwned('journalVouchers')}
function getMyJournalLines(){return jeOwned('journalLines')} function getMyJournalLineDimensions(){return jeOwned('journalLineDimensions')}
function jeNum(v){const n=Number(v);return Number.isFinite(n)?Math.round(n):0}
function jeFiscalForDate(date){const ds=jeDate(date);return getMyFiscalYears().find(f=>f.companyId===afCompanyId()&&ds>=f.startDate&&ds<=f.endDate)||null}
function jePostingAccount(id){const a=getMyAccounts().find(x=>x.id===id);return a&&a.companyId===afCompanyId()&&a.active!==false&&a.postingAllowed&&a.level==='detail'?a:null}
function jeAccountByCode(code){return getMyAccounts().find(x=>x.code===String(code)&&x.active!==false&&x.postingAllowed)}
function jeFindAccountByTitle(words){const A=getMyAccounts().filter(x=>x.active!==false&&x.postingAllowed);return A.find(a=>words.some(w=>String(a.title||'').includes(w)))||null}
function jeCashAccount(){return jeAccountByCode('1101')||jeFindAccountByTitle(['صندوق','بانک','نقد'])}
function jeReceivableAccount(){return jeAccountByCode('1102')||jeFindAccountByTitle(['دریافتنی','بدهکاران'])}
function jePayableAccount(){return jeAccountByCode('2101')||jeFindAccountByTitle(['پرداختنی','بستانکاران'])}
function jeRevenueAccount(){return jeAccountByCode('4101')||jeAccountByCode('4107')||jeAccountByCode('4106')}
function jePurchaseAccount(){return jeAccountByCode('5101')||jeAccountByCode('5102')||jeFindAccountByTitle(['بهای تمام','خرید'])}
function jeExpenseAccount(){return jeAccountByCode('6103')||jeFindAccountByTitle(['هزینه عمومی','هزینه'])}
function jeOtherIncomeAccount(){return jeAccountByCode('4201')||jeFindAccountByTitle(['سایر درآمد'])}
function jeVatPayableAccount(){return jeAccountByCode('2102')||jeFindAccountByTitle(['مالیات و عوارض پرداختنی'])}
function jeVatRecoverableAccount(){return jeFindAccountByTitle(['مالیات بر ارزش افزوده خرید','مالیات و عوارض دریافتنی'])}
function jeRulesForAccount(accountId){return getMyAccountDimensionRules().filter(r=>r.accountId===accountId&&r.active!==false)}
function jeDimensionValueValid(type,valueId){
 const t=getMyDimensionTypes().find(x=>x.id===type);if(!t||t.companyId!==afCompanyId()||t.active===false)return false;
 return afResolvedValues(t).some(v=>v.id===valueId&&v.postable!==false);
}
function jeValidateDimensions(accountId,assignments){
 const rules=jeRulesForAccount(accountId),map=new Map();
 if(!Array.isArray(assignments))throw new Error('ساختار تفصیلی معتبر نیست.');
 for(const item of assignments){if(!item?.dimensionTypeId||!item.dimensionValueId||map.has(item.dimensionTypeId))throw new Error('تفصیلی ناقص یا تکراری است.');map.set(item.dimensionTypeId,item.dimensionValueId);}
 for(const r of rules){
  if(r.applicability==='unavailable'&&map.has(r.dimensionTypeId))throw new Error('تفصیلی غیرمجاز برای حساب انتخاب شده است.');
  if(r.applicability==='required'&&!map.get(r.dimensionTypeId))throw new Error('تفصیلی الزامی حساب تکمیل نشده است.');
  if(map.has(r.dimensionTypeId)&&!jeDimensionValueValid(r.dimensionTypeId,map.get(r.dimensionTypeId)))throw new Error('مقدار تفصیلی معتبر/قابل ثبت نیست.');
 }
 for(const [type,val] of map)if(!rules.some(r=>r.dimensionTypeId===type&&r.applicability!=='unavailable'))throw new Error('تفصیلی انتخاب‌شده برای این حساب تعریف نشده است.');
 return true;
}
function jeValidateLines(lines){
 if(!Array.isArray(lines)||lines.length<2)throw new Error('سند باید حداقل دو آرتیکل داشته باشد.');
 let dr=0,cr=0;
 lines.forEach((l,i)=>{const d=jeMoney(l.debit),c=jeMoney(l.credit);if(!jePostingAccount(l.accountId))throw new Error('حساب ثبت‌پذیر ردیف '+(i+1)+' معتبر نیست.');if(d<0||c<0||(!d&&!c)||(d&&c))throw new Error('هر آرتیکل باید فقط بدهکار یا فقط بستانکار باشد.');jeValidateDimensions(l.accountId,l.dimensions||[]);dr+=d;cr+=c});
 if(!Number.isSafeInteger(dr)||!Number.isSafeInteger(cr)||Math.abs(dr-cr)>JE_EPSILON||dr<=0)throw new Error('سند تراز نیست. جمع بدهکار و بستانکار باید برابر باشد.');
 return {debit:dr,credit:cr};
}
function jeNextNumber(fiscalYearId){const nums=getMyJournalVouchers().filter(v=>v.fiscalYearId===fiscalYearId).map(v=>Number(v.number)||0);return String(Math.max(0,...nums)+1)}
function jeCreateDraft(input){
 if(!requireWrite())throw new Error('write denied');const cid=afCompanyId(),fy=jeFiscalForDate(input.date);if(!cid||!fy)throw new Error('سال مالی متناظر با تاریخ سند پیدا نشد.');if(fy.status==='locked')throw new Error('سال مالی قفل است.');
 const number=String(input.number||jeNextNumber(fy.id)).trim();if(!/^\d+$/.test(number)||Number(number)<=0||!Number.isSafeInteger(Number(number)))throw new Error('شماره سند معتبر نیست.');
 if(getMyJournalVouchers().some(v=>v.fiscalYearId===fy.id&&Number(v.number)===Number(number)))throw new Error('شماره سند در سال مالی تکراری است.');
 const totals=jeValidateLines(input.lines),id=afId('JV'),voucher={id,ownerUserId:currentUser.id,companyId:cid,fiscalYearId:fy.id,number,date:jeDate(input.date),description:String(input.description||''),status:'draft',sourceType:input.sourceType||'manual',sourceId:input.sourceId||'',sourceVersion:Number(input.sourceVersion||1),totalDebit:totals.debit,totalCredit:totals.credit,createdAt:new Date().toISOString(),createdBy:currentUser.id};
 datastore.journalVouchers.push(voucher);input.lines.forEach((l,n)=>{const lineId=afId('JL');datastore.journalLines.push({id:lineId,ownerUserId:currentUser.id,companyId:cid,voucherId:id,lineNo:n+1,accountId:l.accountId,debit:jeNum(l.debit),credit:jeNum(l.credit),description:String(l.description||''),counterpartyId:l.counterpartyId||'',projectId:l.projectId||''});(l.dimensions||[]).forEach(d=>datastore.journalLineDimensions.push({id:afId('JLD'),ownerUserId:currentUser.id,companyId:cid,voucherId:id,journalLineId:lineId,dimensionTypeId:d.dimensionTypeId,dimensionValueId:d.dimensionValueId}))});jeSave();return voucher;
}
function jePost(voucherId){
 if(!requireWrite())throw new Error('write denied');const v=getMyJournalVouchers().find(x=>x.id===voucherId);if(!v||v.status!=='draft')throw new Error('فقط سند پیش‌نویس قابل قطعی‌سازی است.');const fy=getMyFiscalYears().find(x=>x.id===v.fiscalYearId);if(!fy||fy.status==='locked')throw new Error('سال مالی قفل است.');
 if(jeFiscalForDate(v.date)?.id!==fy.id)throw new Error('تاریخ سند خارج از سال مالی است.');
 if(getMyJournalVouchers().some(x=>x.id!==v.id&&x.fiscalYearId===fy.id&&Number(x.number)===Number(v.number)))throw new Error('شماره سند در سال مالی تکراری است.');
 const lines=getMyJournalLines().filter(x=>x.voucherId===v.id).map(l=>({...l,dimensions:getMyJournalLineDimensions().filter(d=>d.journalLineId===l.id)}));const totals=jeValidateLines(lines);
 if(v.sourceId&&getMyJournalVouchers().some(x=>x.id!==v.id&&x.status==='posted'&&x.sourceType===v.sourceType&&x.sourceId===v.sourceId&&Number(x.sourceVersion||1)===Number(v.sourceVersion||1)))throw new Error('برای این رویداد منبع قبلاً سند قطعی ثبت شده است.');
 Object.assign(v,{status:'posted',totalDebit:totals.debit,totalCredit:totals.credit,postedAt:new Date().toISOString(),postedBy:currentUser.id});jeSave();return v;
}
function jeReverse(voucherId,date,reason){return jeAtomic(()=>{
 if(!requireWrite())throw new Error('write denied');const v=getMyJournalVouchers().find(x=>x.id===voucherId);if(!v||v.status!=='posted')throw new Error('فقط سند قطعی قابل برگشت است.');if(v.reversalVoucherId)throw new Error('این سند قبلاً برگشت شده است.');
 if(v.sourceType==='reversal')throw new Error('سند برگشت دوباره برگشت نمی‌شود؛ منبع اصلی را با نسخه جدید اصلاح کنید.');
 const lines=getMyJournalLines().filter(x=>x.voucherId===v.id).map(l=>({accountId:l.accountId,debit:l.credit,credit:l.debit,description:'برگشت: '+(l.description||v.description||''),dimensions:getMyJournalLineDimensions().filter(d=>d.journalLineId===l.id).map(d=>({dimensionTypeId:d.dimensionTypeId,dimensionValueId:d.dimensionValueId}))}));
 const rv=jeCreateDraft({date:date||getJalaliNumeric(),description:'برگشت سند '+v.number+(reason?' — '+reason:''),sourceType:'reversal',sourceId:v.id,lines});jePost(rv.id);v.status='reversed';v.reversalVoucherId=rv.id;v.reversedAt=new Date().toISOString();jeSave();return rv;
});}
function jeDeleteDraft(voucherId){if(!requireWrite())return false;const v=getMyJournalVouchers().find(x=>x.id===voucherId);if(!v||v.status!=='draft')throw new Error('سند قطعی/برگشتی حذف‌پذیر نیست.');const ids=getMyJournalLines().filter(x=>x.voucherId===voucherId).map(x=>x.id);datastore.journalLineDimensions=datastore.journalLineDimensions.filter(x=>!ids.includes(x.journalLineId));datastore.journalLines=datastore.journalLines.filter(x=>x.voucherId!==voucherId);datastore.journalVouchers=datastore.journalVouchers.filter(x=>x.id!==voucherId);jeSave();return true}
function jeLedgerRows(){return getMyJournalLines().flatMap(l=>{const v=getMyJournalVouchers().find(x=>x.id===l.voucherId);return v&&['posted','reversed'].includes(v.status)?[{...l,voucher:v,account:getMyAccounts().find(a=>a.id===l.accountId)}]:[]})}
function jeTrialBalance(){const m={};jeLedgerRows().forEach(l=>{if(!m[l.accountId])m[l.accountId]={accountId:l.accountId,code:l.account?.code||'',title:l.account?.title||'',debit:0,credit:0};m[l.accountId].debit+=jeNum(l.debit);m[l.accountId].credit+=jeNum(l.credit)});return Object.values(m).map(x=>({...x,balance:x.debit-x.credit})).sort((a,b)=>String(a.code).localeCompare(String(b.code),undefined,{numeric:true}))}
function jeDimensionAssignmentsForContext(accountId,ctx){
 const rules=jeRulesForAccount(accountId),out=[];rules.forEach(r=>{if(r.applicability==='unavailable')return;const t=getMyDimensionTypes().find(x=>x.id===r.dimensionTypeId);if(!t)return;let id='';if(t.sourceEntity==='contact')id=ctx.contactId||'';else if(t.sourceEntity==='project')id=ctx.projectId||'';else if(t.sourceEntity==='branch')id=ctx.branchId||'';if(id)out.push({dimensionTypeId:t.id,dimensionValueId:id})});return out;
}
function jeProfile(kind){return getMyPostingProfiles().find(x=>x.kind===kind&&x.active!==false)||null}
function jeEnsureDefaultProfiles(){
 if(!currentUser||!afCompanyId())return;const cid=afCompanyId(),A=code=>jeAccountByCode(code)?.id||'';
 const rows=[['sale','فروش',jeReceivableAccount()?.id||'',jeRevenueAccount()?.id||''],['purchase','خرید',jePurchaseAccount()?.id||'',jePayableAccount()?.id||''],['receipt','دریافت',jeCashAccount()?.id||'',jeReceivableAccount()?.id||''],['payment','پرداخت',jePayableAccount()?.id||'',jeCashAccount()?.id||''],['expense','هزینه',jeExpenseAccount()?.id||'',jeCashAccount()?.id||''],['income','درآمد متفرقه',jeCashAccount()?.id||'',jeOtherIncomeAccount()?.id||'']];
 rows.filter(x=>x[2]&&x[3]&&!getMyPostingProfiles().some(p=>p.kind===x[0])).forEach(x=>datastore.postingProfiles.push({id:afId('PP'),ownerUserId:currentUser.id,companyId:cid,kind:x[0],title:x[1],debitAccountId:x[2],creditAccountId:x[3],active:true}));if(rows.some(x=>x[2]&&x[3]))jeSave();
}
function jeAutoPost(kind,source){return jeAtomic(()=>{
 jeSourceScope(source);
 if(kind==='sale'&&source.kind==='pre_invoice')throw new Error('پیش‌فاکتور سند مالی نیست و ثبت حسابداری ندارد.');
 if((kind==='receipt'||kind==='payment')&&source.method==='cheque')throw new Error('تسویه با چک هنوز به چرخه حسابداری وصول/برگشت متصل نیست؛ ثبت نقدی برای آن مجاز نیست.');
 if(getMyJournalVouchers().some(v=>v.status==='posted'&&v.sourceType===kind&&v.sourceId===source.id))throw new Error('این منبع سند قطعی فعال دارد؛ ابتدا برگشت ثبت کنید.');
 jeEnsureDefaultProfiles();
 const amount=jeMoney(source.amount??source.grandTotal);if(amount<=0)throw new Error('مبلغ سند منبع معتبر نیست.');
 const ctx={contactId:source.contactId||source.supplierId||'',projectId:source.projectId||source.costCenterId||'',branchId:source.branchId||''},dims=a=>jeDimensionAssignmentsForContext(a,ctx);
 let lines=[],title='';
 if(kind==='sale'){
  const profile=jeProfile(kind),cash=jeCashAccount(),ar=profile?jePostingAccount(profile.debitAccountId):jeReceivableAccount(),rev=profile?jePostingAccount(profile.creditAccountId):jeRevenueAccount(),vat=jeVatPayableAccount(),gross=jeMoney(source.grandTotal),tax=jeMoney(source.vat),net=Math.max(0,gross-tax),debit=source.paymentMethod==='credit'?ar:cash;if(!debit||!rev)throw new Error('حساب‌های فروش/دریافتنی/نقد در کدینگ تکمیل نیست.');
  title='فروش';lines=[{accountId:debit.id,debit:gross,credit:0,description:title,dimensions:dims(debit.id)},{accountId:rev.id,debit:0,credit:net,description:title,dimensions:dims(rev.id)}];if(tax){if(!vat)throw new Error('برای مالیات فروش حساب مالیات پرداختنی تعریف کنید.');lines.push({accountId:vat.id,debit:0,credit:tax,description:'مالیات فروش',dimensions:dims(vat.id)})}
 }else if(kind==='purchase'){
  const profile=jeProfile(kind),cash=jeCashAccount(),ap=profile?jePostingAccount(profile.creditAccountId):jePayableAccount(),buy=profile?jePostingAccount(profile.debitAccountId):jePurchaseAccount(),vat=jeVatRecoverableAccount(),gross=jeMoney(source.grandTotal),tax=jeMoney(source.vat),net=Math.max(0,gross-tax),credit=source.paymentMethod==='credit'?ap:cash;if(!credit||!buy)throw new Error('حساب‌های خرید/پرداختنی/نقد در کدینگ تکمیل نیست.');
  title='خرید';lines=[{accountId:buy.id,debit:vat?net:gross,credit:0,description:title,dimensions:dims(buy.id)}];if(tax&&vat)lines.push({accountId:vat.id,debit:tax,credit:0,description:'مالیات خرید',dimensions:dims(vat.id)});else if(tax)lines[0].debit=gross;lines.push({accountId:credit.id,debit:0,credit:gross,description:title,dimensions:dims(credit.id)})
 }else{
  const profile=jeProfile(kind);if(!profile)throw new Error('پروفایل ثبت خودکار '+kind+' تعریف نشده است.');title=profile.title;lines=[{accountId:profile.debitAccountId,debit:amount,credit:0,description:title,dimensions:dims(profile.debitAccountId)},{accountId:profile.creditAccountId,debit:0,credit:amount,description:title,dimensions:dims(profile.creditAccountId)}];
 }
 const v=jeCreateDraft({date:source.date||getJalaliNumeric(),description:title+' — '+(source.number||source.reference||source.id),sourceType:kind,sourceId:source.id,sourceVersion:Number(source.accountingVersion||1),lines});return jePost(v.id);
});}
function jeSourceHistory(source){return source?(datastore.journalVouchers||[]).filter(v=>v.ownerUserId===currentUser?.id&&v.companyId===source.companyId&&(v.id===source.journalVoucherId||(v.sourceId===source.id&&v.sourceType!=='reversal'))):[];}
function jeActiveSourceVoucher(source){return jeSourceHistory(source).find(v=>v.status==='posted')||null;}
function jeSourceLocked(source){return !!jeActiveSourceVoucher(source)}
function jeGuardSourceMutation(source,label){if(jeSourceLocked(source))throw new Error((label||'رکورد مالی')+' دارای سند حسابداری قطعی است؛ ابتدا سند را برگشت بزنید و سپس اصلاح کنید.');return true}
function jeGuardSourceDeletion(source,label){if(jeSourceHistory(source).length)throw new Error((label||'رکورد مالی')+' دارای سابقه حسابداری است و حذف نمی‌شود؛ اصلاح را با برگشت و نسخه جدید انجام دهید.');return true;}
function jePostSourceRecord(kind,source){
 jeSourceScope(source);
 if(jeActiveSourceVoucher(source))return jeActiveSourceVoucher(source);
 const v=jeAutoPost(kind,source);source.journalVoucherId=v.id;source.accountingVersion=Number(source.accountingVersion||1);source.accountingStatus='posted';source.accountingPostedAt=v.postedAt;jeSave();return v;
}
function jePostLegacySource(kind,id){
 let source;if(kind==='sale')source=getMyInvoices().find(x=>x.id===id);else if(kind==='purchase')source=getMyPurchases().find(x=>x.id===id);else if(kind==='receipt'||kind==='payment')source=getMyPayments().find(x=>x.id===id);else if(kind==='expense'||kind==='income')source=getMyExpenses().find(x=>x.id===id);if(!source)throw new Error('رکورد منبع پیدا نشد.');
 if(kind==='receipt'||kind==='payment')kind=source.direction==='outbound'?'payment':'receipt';if(kind==='expense'||kind==='income')kind=source.kind==='income'?'income':'expense';
 return jePostSourceRecord(kind,source);
}

function jeSaveOperationalRecord(kind,input){return jeAtomic(()=>{
 if(!requireWrite())throw new Error('write denied');
 const collection={sale:'invoices',purchase:'purchases',receipt:'payments',payment:'payments',expense:'expenses',income:'expenses'}[kind];
 if(!collection)throw new Error('نوع منبع حسابداری معتبر نیست.');
 jeSourceScope(input);
 const list=datastore[collection],index=list.findIndex(x=>x.id===input.id&&x.ownerUserId===currentUser.id),old=index<0?null:list[index];
 if(old&&old.companyId!==input.companyId)throw new Error('شرکت رکورد موجود قابل تغییر نیست.');
 if(old)jeGuardSourceMutation(old);
 const record={...old,...input},history=jeSourceHistory(old||record);
 record.accountingVersion=history.length?Math.max(...history.map(v=>Number(v.sourceVersion)||1))+1:Number(old?.accountingVersion||1);
 delete record.journalVoucherId;delete record.accountingPostedAt;
 const configured=getMyAccounts().length||getMyPostingProfiles().length||getMyJournalVouchers().length;
 if(kind==='sale'&&record.kind==='pre_invoice')record.accountingStatus='non_financial';
 else if(!configured)record.accountingStatus='not_configured';
 else jePostSourceRecord(kind,record);
 if(index<0)list.push(record);else list[index]=record;
 return record;
});}
