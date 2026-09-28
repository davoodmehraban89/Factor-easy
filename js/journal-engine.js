/* Phase 3 — immutable double-entry journal engine */
const JE_EPSILON=0.0001;
function jeOwned(k){const cid=afCompanyId();return(datastore[k]||[]).filter(x=>x.ownerUserId===currentUser?.id&&(!x.companyId||x.companyId===cid))}
function getMyPostingProfiles(){return jeOwned('postingProfiles')} function getMyJournalVouchers(){return jeOwned('journalVouchers')}
function getMyJournalLines(){return jeOwned('journalLines')} function getMyJournalLineDimensions(){return jeOwned('journalLineDimensions')}
function jeNum(v){const n=Number(v);return Number.isFinite(n)?Math.round(n):0}
function jeFiscalForDate(date){const ds=toEnDigits(String(date||getJalaliNumeric()).slice(0,10));return getMyFiscalYears().find(f=>ds>=f.startDate&&ds<=f.endDate)||null}
function jePostingAccount(id){const a=getMyAccounts().find(x=>x.id===id);return a&&a.active!==false&&a.postingAllowed?a:null}
function jeAccountByCode(code){return getMyAccounts().find(x=>x.code===String(code)&&x.active!==false&&x.postingAllowed)}
function jeRulesForAccount(accountId){return getMyAccountDimensionRules().filter(r=>r.accountId===accountId&&r.active!==false)}
function jeDimensionValueValid(type,valueId){
 const t=getMyDimensionTypes().find(x=>x.id===type);if(!t||t.active===false)return false;
 return afResolvedValues(t).some(v=>v.id===valueId&&v.postable!==false);
}
function jeValidateDimensions(accountId,assignments){
 const rules=jeRulesForAccount(accountId),map=new Map((assignments||[]).map(x=>[x.dimensionTypeId,x.dimensionValueId]));
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
 lines.forEach((l,i)=>{const d=jeNum(l.debit),c=jeNum(l.credit);if(!jePostingAccount(l.accountId))throw new Error('حساب ثبت‌پذیر ردیف '+(i+1)+' معتبر نیست.');if(d<0||c<0||(!d&&!c)||(d&&c))throw new Error('هر آرتیکل باید فقط بدهکار یا فقط بستانکار باشد.');jeValidateDimensions(l.accountId,l.dimensions||[]);dr+=d;cr+=c});
 if(Math.abs(dr-cr)>JE_EPSILON||dr<=0)throw new Error('سند تراز نیست. جمع بدهکار و بستانکار باید برابر باشد.');
 return {debit:dr,credit:cr};
}
function jeNextNumber(fiscalYearId){const nums=getMyJournalVouchers().filter(v=>v.fiscalYearId===fiscalYearId).map(v=>Number(v.number)||0);return String(Math.max(0,...nums)+1)}
function jeCreateDraft(input){
 if(!requireWrite())throw new Error('write denied');const cid=afCompanyId(),fy=jeFiscalForDate(input.date);if(!cid||!fy)throw new Error('سال مالی متناظر با تاریخ سند پیدا نشد.');if(fy.status==='locked')throw new Error('سال مالی قفل است.');
 const totals=jeValidateLines(input.lines),id=afId('JV'),voucher={id,ownerUserId:currentUser.id,companyId:cid,fiscalYearId:fy.id,number:input.number||jeNextNumber(fy.id),date:input.date||getJalaliNumeric(),description:String(input.description||''),status:'draft',sourceType:input.sourceType||'manual',sourceId:input.sourceId||'',sourceVersion:Number(input.sourceVersion||1),totalDebit:totals.debit,totalCredit:totals.credit,createdAt:new Date().toISOString(),createdBy:currentUser.id};
 datastore.journalVouchers.push(voucher);input.lines.forEach((l,n)=>{const lineId=afId('JL');datastore.journalLines.push({id:lineId,ownerUserId:currentUser.id,companyId:cid,voucherId:id,lineNo:n+1,accountId:l.accountId,debit:jeNum(l.debit),credit:jeNum(l.credit),description:String(l.description||''),counterpartyId:l.counterpartyId||'',projectId:l.projectId||''});(l.dimensions||[]).forEach(d=>datastore.journalLineDimensions.push({id:afId('JLD'),ownerUserId:currentUser.id,companyId:cid,voucherId:id,journalLineId:lineId,dimensionTypeId:d.dimensionTypeId,dimensionValueId:d.dimensionValueId}))});saveDatastore();return voucher;
}
function jePost(voucherId){
 if(!requireWrite())throw new Error('write denied');const v=getMyJournalVouchers().find(x=>x.id===voucherId);if(!v||v.status!=='draft')throw new Error('فقط سند پیش‌نویس قابل قطعی‌سازی است.');const fy=getMyFiscalYears().find(x=>x.id===v.fiscalYearId);if(!fy||fy.status==='locked')throw new Error('سال مالی قفل است.');
 const lines=getMyJournalLines().filter(x=>x.voucherId===v.id).map(l=>({...l,dimensions:getMyJournalLineDimensions().filter(d=>d.journalLineId===l.id)}));const totals=jeValidateLines(lines);
 if(v.sourceId&&getMyJournalVouchers().some(x=>x.id!==v.id&&x.status==='posted'&&x.sourceType===v.sourceType&&x.sourceId===v.sourceId&&Number(x.sourceVersion||1)===Number(v.sourceVersion||1)))throw new Error('برای این رویداد منبع قبلاً سند قطعی ثبت شده است.');
 Object.assign(v,{status:'posted',totalDebit:totals.debit,totalCredit:totals.credit,postedAt:new Date().toISOString(),postedBy:currentUser.id});saveDatastore();return v;
}
function jeReverse(voucherId,date,reason){
 if(!requireWrite())throw new Error('write denied');const v=getMyJournalVouchers().find(x=>x.id===voucherId);if(!v||v.status!=='posted')throw new Error('فقط سند قطعی قابل برگشت است.');if(v.reversalVoucherId)throw new Error('این سند قبلاً برگشت شده است.');
 const lines=getMyJournalLines().filter(x=>x.voucherId===v.id).map(l=>({accountId:l.accountId,debit:l.credit,credit:l.debit,description:'برگشت: '+(l.description||v.description||''),dimensions:getMyJournalLineDimensions().filter(d=>d.journalLineId===l.id).map(d=>({dimensionTypeId:d.dimensionTypeId,dimensionValueId:d.dimensionValueId}))}));
 const rv=jeCreateDraft({date:date||getJalaliNumeric(),description:'برگشت سند '+v.number+(reason?' — '+reason:''),sourceType:'reversal',sourceId:v.id,lines});jePost(rv.id);v.status='reversed';v.reversalVoucherId=rv.id;v.reversedAt=new Date().toISOString();saveDatastore();return rv;
}
function jeDeleteDraft(voucherId){if(!requireWrite())return false;const v=getMyJournalVouchers().find(x=>x.id===voucherId);if(!v||v.status!=='draft')throw new Error('سند قطعی/برگشتی حذف‌پذیر نیست.');const ids=getMyJournalLines().filter(x=>x.voucherId===voucherId).map(x=>x.id);datastore.journalLineDimensions=datastore.journalLineDimensions.filter(x=>!ids.includes(x.journalLineId));datastore.journalLines=datastore.journalLines.filter(x=>x.voucherId!==voucherId);datastore.journalVouchers=datastore.journalVouchers.filter(x=>x.id!==voucherId);saveDatastore();return true}
function jeLedgerRows(){return getMyJournalLines().flatMap(l=>{const v=getMyJournalVouchers().find(x=>x.id===l.voucherId);return v&&['posted','reversed'].includes(v.status)?[{...l,voucher:v,account:jePostingAccount(l.accountId)}]:[]})}
function jeTrialBalance(){const m={};jeLedgerRows().forEach(l=>{if(!m[l.accountId])m[l.accountId]={accountId:l.accountId,code:l.account?.code||'',title:l.account?.title||'',debit:0,credit:0};m[l.accountId].debit+=jeNum(l.debit);m[l.accountId].credit+=jeNum(l.credit)});return Object.values(m).map(x=>({...x,balance:x.debit-x.credit})).sort((a,b)=>String(a.code).localeCompare(String(b.code),undefined,{numeric:true}))}
function jeDimensionAssignmentsForContext(accountId,ctx){
 const rules=jeRulesForAccount(accountId),out=[];rules.forEach(r=>{if(r.applicability==='unavailable')return;const t=getMyDimensionTypes().find(x=>x.id===r.dimensionTypeId);if(!t)return;let id='';if(t.sourceEntity==='contact')id=ctx.contactId||'';else if(t.sourceEntity==='project')id=ctx.projectId||'';else if(t.sourceEntity==='branch')id=ctx.branchId||'';if(id)out.push({dimensionTypeId:t.id,dimensionValueId:id})});return out;
}
function jeProfile(kind){return getMyPostingProfiles().find(x=>x.kind===kind&&x.active!==false)||null}
function jeEnsureDefaultProfiles(){
 if(!currentUser||!afCompanyId()||getMyPostingProfiles().length)return;const cid=afCompanyId(),A=code=>jeAccountByCode(code)?.id||'';
 const rows=[['sale','فروش نسیه',A('1102'),A('4101')],['purchase','خرید نسیه',A('5101'),A('2101')],['receipt','دریافت',A('1101'),A('1102')],['payment','پرداخت',A('2101'),A('1101')],['expense','هزینه',A('6103'),A('1101')],['income','درآمد متفرقه',A('1101'),A('4201')]];
 rows.filter(x=>x[2]&&x[3]).forEach(x=>datastore.postingProfiles.push({id:afId('PP'),ownerUserId:currentUser.id,companyId:cid,kind:x[0],title:x[1],debitAccountId:x[2],creditAccountId:x[3],active:true}));if(rows.some(x=>x[2]&&x[3]))saveDatastore();
}
function jeAutoPost(kind,source){
 const profile=jeProfile(kind);if(!profile)throw new Error('پروفایل ثبت خودکار '+kind+' تعریف نشده است.');const amount=jeNum(source.amount??source.grandTotal);if(amount<=0)throw new Error('مبلغ سند منبع معتبر نیست.');
 const ctx={contactId:source.contactId||source.supplierId||'',projectId:source.projectId||source.costCenterId||'',branchId:source.branchId||''};
 const lines=[{accountId:profile.debitAccountId,debit:amount,credit:0,description:profile.title,dimensions:jeDimensionAssignmentsForContext(profile.debitAccountId,ctx)},{accountId:profile.creditAccountId,debit:0,credit:amount,description:profile.title,dimensions:jeDimensionAssignmentsForContext(profile.creditAccountId,ctx)}];
 const v=jeCreateDraft({date:source.date||getJalaliNumeric(),description:profile.title+' — '+(source.number||source.reference||source.id),sourceType:kind,sourceId:source.id,sourceVersion:Number(source.accountingVersion||1),lines});return jePost(v.id);
}
function jePostLegacySource(kind,id){
 let source;if(kind==='sale')source=getMyInvoices().find(x=>x.id===id);else if(kind==='purchase')source=getMyPurchases().find(x=>x.id===id);else if(kind==='receipt'||kind==='payment')source=getMyPayments().find(x=>x.id===id);else if(kind==='expense'||kind==='income')source=getMyExpenses().find(x=>x.id===id);if(!source)throw new Error('رکورد منبع پیدا نشد.');
 if(kind==='receipt'||kind==='payment')kind=source.direction==='outbound'?'payment':'receipt';if(kind==='expense'||kind==='income')kind=source.kind==='income'?'income':'expense';
 const v=jeAutoPost(kind,source);source.journalVoucherId=v.id;source.accountingVersion=Number(source.accountingVersion||1);saveDatastore();return v;
}
