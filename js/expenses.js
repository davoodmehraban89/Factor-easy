// Expense / income source documents: immutable posted journal, one employee-facing entry.
// Physical revisions are retained only for accounting audit and source lineage.
let expenseEditingId='';
function expensePostingStatus(record){
 if(!record)return 'unknown';
 const v=typeof jeSourceVoucher==='function'?jeSourceVoucher(record):null;
 if(v?.status==='posted')return 'posted';
 if(v?.status==='reversed')return 'reversed';
 return 'legacy_review';
}
function expenseCurrentVisible(id){
 const list=getMyExpenses(),seen=new Set();let row=list.find(e=>e.id===id);
 while(row&&!seen.has(row.id)){
  seen.add(row.id);
  const next=list.filter(e=>e.correctsExpenseId===row.id)
    .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0];
  if(!next)break;row=next;
 }
 return row;
}
function expenseVisibleRecords(){
 const list=getMyExpenses(),superseded=new Set(list.map(e=>e.correctsExpenseId).filter(Boolean));
 return list.filter(e=>!superseded.has(e.id));
}
function expenseEffectiveRecords(){
 return expenseVisibleRecords().filter(e=>['posted','legacy_review'].includes(expensePostingStatus(e)));
}
function expenseCorrectionEligibility(id){
 if(!requireWrite()||!currentUser)throw new Error('مجوز اصلاح سند ندارید.');
 const e=expenseCurrentVisible(id);
 if(!e||e.id!==id||e.ownerUserId!==currentUser.id||e.companyId!==afCompanyId())
  throw new Error('سند جاری به کاربر و شرکت فعال تعلق ندارد.');
 if(!['expense','income'].includes(e.kind)||expensePostingStatus(e)!=='posted')
  throw new Error('سند معتبر قطعی با ثبت حسابداری متصل یافت نشد.');
 const v=jeSourceVoucher(e);
 if(!v||v.status!=='posted'||v.sourceType!==e.kind||v.sourceId!==e.id)
  throw new Error('مرجع دفترکل سند با ثبت جاری تطبیق ندارد.');
 const fy=getMyFiscalYears().find(f=>f.id===v.fiscalYearId),active=jeFiscalForDate(getJalaliNumeric());
 if(!fy||fy.status==='locked'||!active||active.status==='locked')
  throw new Error('سال مالی سند بسته یا سال مالی جاری فعال نیست.');
 if(getMyExpenses().some(x=>x.correctsExpenseId===e.id))
  throw new Error('برای این سند قبلاً اصلاح ثبت شده است؛ صفحه را تازه‌سازی کنید.');
 return {source:e,voucher:v};
}
function expenseReadForm(){
 // Disabled identity fields can be re-populated by dependent select renderers;
 // always derive protected posted identity from the source, not a DOM default.
 const original=expenseEditingId?expenseCurrentVisible(expenseEditingId):null;
 return {kind:original?.kind??(document.getElementById('trx-kind-input')?.value||''),
  category:document.getElementById('trx-category-input')?.value||'',
  contactId:original?.contactId??(document.getElementById('trx-contact-select')?.value||''),
  projectId:original?.projectId??(document.getElementById('trx-project-select')?.value||''),
  amount:parseFormattedNumber(document.getElementById('trx-amount-input')?.value||''),
  desc:document.getElementById('trx-desc-input')?.value||''};
}
function expenseValidateChange(old,form){
 if(form.kind!==old.kind||form.contactId!==(old.contactId||'')||
    form.projectId!==(old.projectId||''))
  throw new Error('نوع سند، طرف حساب و پروژه این سند قطعی در اصلاح پایلوت قابل تغییر نیست.');
 if(!Number.isFinite(form.amount)||form.amount<=0)throw new Error('مبلغ معتبر نیست.');
 if(!String(form.category||'').trim())throw new Error('سرفصل هزینه/درآمد الزامی است.');
 if(!jeProfile(old.kind))throw new Error('پروفایل ثبت حسابداری معتبر پیدا نشد.');
}
async function expenseAmendPosted(id,form){
 const {source:old,voucher:original}=expenseCorrectionEligibility(id);
 expenseValidateChange(old,form);
 // All financial changes are staged synchronously, then persisted via ONE
 // transactional finora_sync_records RPC (no intermediate reversal commit).
 const voucherIds=new Set(datastore.journalVouchers.map(x=>x.id));
 const lineIds=new Set(datastore.journalLines.map(x=>x.id));
 const dimensionIds=new Set(datastore.journalLineDimensions.map(x=>x.id));
 const profileIds=new Set(datastore.postingProfiles.map(x=>x.id));
 const originalVoucher={...original};
 let newRecord,reversal,posted;
 try{
  reversal=jeReverse(original.id,getJalaliNumeric(),'اصلاح هزینه/درآمد در دوره پایلوت');
  const now=new Date().toISOString();
  newRecord={...old,id:afId('TRX'),amount:form.amount,category:String(form.category),
   desc:String(form.desc||''),createdAt:now,updatedAt:now,
   accountingStatus:'draft',accountingVersion:1,
   correctsExpenseId:old.id,correctionReversalId:reversal.id};
  delete newRecord.journalVoucherId;delete newRecord.accountingPostedAt;
  datastore.expenses.push(newRecord);
  posted=jePostSourceRecord(old.kind,newRecord);
  saveDatastore();
 }catch(e){
  Object.assign(original,originalVoucher);
  datastore.journalVouchers=datastore.journalVouchers.filter(x=>voucherIds.has(x.id));
  datastore.journalLines=datastore.journalLines.filter(x=>lineIds.has(x.id));
  datastore.journalLineDimensions=datastore.journalLineDimensions.filter(x=>dimensionIds.has(x.id));
  datastore.postingProfiles=datastore.postingProfiles.filter(x=>profileIds.has(x.id));
  if(newRecord)datastore.expenses=datastore.expenses.filter(x=>x.id!==newRecord.id);
  saveDatastore();throw e;
 }
 await invoicePilotAwaitSync(['journalVouchers|'+original.id,
  'journalVouchers|'+reversal.id,'journalVouchers|'+posted.id,'expenses|'+newRecord.id]);
 return newRecord.id;
}
async function expenseCancelPosted(id,reason){
 const {voucher}=expenseCorrectionEligibility(id);
 if(!String(reason||'').trim())throw new Error('دلیل ابطال الزامی است.');
 const reversal=jeReverse(voucher.id,getJalaliNumeric(),'ابطال ثبت هزینه/درآمد: '+String(reason).trim());
 await invoicePilotAwaitSync(['journalVouchers|'+voucher.id,'journalVouchers|'+reversal.id]);
 return reversal.id;
}
function cancelExpenseEdit(){
 expenseEditingId='';
 ['trx-amount-input','trx-desc-input'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
 const save=document.getElementById('expense-save-btn');if(save)save.textContent='➕ ثبت سند';
 const cancel=document.getElementById('expense-edit-cancel-btn');if(cancel)cancel.style.display='none';
 for(const id of ['trx-kind-input','trx-contact-select','trx-project-select']){
  const e=document.getElementById(id);if(e)e.disabled=false;
 }
}
function editExpense(id){
 const e=expenseCurrentVisible(id);
 try{
  if(!e)throw new Error('ثبت هزینه/درآمد پیدا نشد.');
  expenseCorrectionEligibility(e.id);
 }catch(err){alert(err.message);return;}
 expenseEditingId=e.id;
 switchView('view-expenses');
 if(typeof refreshExpenseContacts==='function')refreshExpenseContacts();
 const values=[['trx-kind-input',e.kind],['trx-category-input',e.category||'سایر'],
  ['trx-contact-select',e.contactId||''],['trx-amount-input',String(e.amount)],
  ['trx-desc-input',e.desc||'']];
 values.forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.value=value;});
 if(typeof refreshExpenseProjects==='function')refreshExpenseProjects();
 const project=document.getElementById('trx-project-select');if(project)project.value=e.projectId||'';
 for(const id of ['trx-kind-input','trx-contact-select','trx-project-select']){
  const el=document.getElementById(id);if(el)el.disabled=true;
 }
 const save=document.getElementById('expense-save-btn');if(save)save.textContent='ذخیره اصلاحات';
 const cancel=document.getElementById('expense-edit-cancel-btn');if(cancel)cancel.style.display='';
}
function cancelPostedExpenseUi(id){
 if(!confirm('این کار فقط اثر ثبت حسابداری داخل نرم‌افزار را خنثی می‌کند و تراکنش واقعی بیرونی را برنمی‌گرداند. ادامه؟'))return;
 const reason=prompt('دلیل ابطال ثبت:','اشتباه ثبت در دوره پایلوت');
 if(reason===null)return;
 void expenseCancelPosted(id,reason).then(()=>{
  refreshAllSurfaces();renderExpenses();if(typeof renderDocumentManagement==='function')renderDocumentManagement();
  alert('ابطال ثبت شد. سوابق قبلی حفظ شده‌اند.');
 }).catch(e=>alert('وضعیت ثبت را بررسی کنید و بدون بررسی مجدد عملیات را تکرار نکنید: '+e.message));
}
function commitSaveExpense(){
 if(!requireWrite()||!currentUser)return;
 const form=expenseReadForm();
 if(expenseEditingId){
  const id=expenseEditingId;
  try{const current=expenseCorrectionEligibility(id);expenseValidateChange(current.source,form);}
  catch(e){alert(e.message);return;}
  const btn=document.getElementById('expense-save-btn');if(btn)btn.disabled=true;
  void expenseAmendPosted(id,form).then(()=>{
   cancelExpenseEdit();refreshAllSurfaces();renderExpenses();
   if(typeof renderDocumentManagement==='function')renderDocumentManagement();
   alert('اصلاح هزینه/درآمد ذخیره شد.');
  }).catch(e=>{
   cancelExpenseEdit();refreshAllSurfaces();renderExpenses();
   alert('ثبت اصلاح تأیید نشد؛ پیش از اقدام دوباره، وضعیت سرور را بررسی کنید: '+e.message);
  }).finally(()=>{if(btn)btn.disabled=false;});
  return;
 }
 if(!Number.isFinite(form.amount)||form.amount<=0){alert('مبلغ معتبر نیست.');return;}
 if(!['expense','income'].includes(form.kind)){alert('نوع سند معتبر نیست.');return;}
 const kind=form.kind;
 const record={id:afId('TRX'),ownerUserId:currentUser.id,
  companyId:typeof afCompanyId==='function'?afCompanyId():'',
  kind:form.kind,category:form.category,amount:form.amount,desc:form.desc,
  contactId:form.contactId,projectId:form.projectId,date:getJalaliNumeric(),accountingVersion:1};
 datastore.expenses.push(record);
 if(typeof jePostSourceRecord==='function'){
  try{jePostSourceRecord(kind,record);}
  catch(e){datastore.expenses=datastore.expenses.filter(x=>x.id!==record.id);
   alert('هزینه/درآمد ثبت نشد: '+e.message);return;}
 }
 saveDatastore();alert('هزینه/درآمد و سند حسابداری با موفقیت ثبت شد.');
 refreshAllSurfaces();
}
function renderExpenses(){
 const tbody=document.getElementById('expenses-ledger-table-body');if(!tbody)return;
 const rows=expenseVisibleRecords();
 tbody.innerHTML=rows.length?rows.map(e=>{
  const status=expensePostingStatus(e),actions=status==='posted'?
   '<button class="btn btn-secondary btn-inline" onclick="editExpense(&#39;'+esc(e.id)+'&#39;)">اصلاح</button> <button class="btn btn-danger btn-inline" onclick="cancelPostedExpenseUi(&#39;'+esc(e.id)+'&#39;)">ابطال ثبت</button>':
   status==='reversed'?'ابطال‌شده':'نیازمند تطبیق';
  const contact=getMyContacts().find(c=>c.id===e.contactId);
  const project=typeof getMyProjects==='function'?getMyProjects().find(p=>p.id===e.projectId):null;
  return '<tr><td>'+esc(e.kind==='income'?'درآمد':'هزینه')+'</td><td>'+esc(e.category||'—')+'</td><td>'+esc(contact?.name||'—')+'</td><td>'+esc(project?.title||project?.name||'—')+'</td><td>'+esc(e.desc||'—')+'</td><td>'+Number(e.amount||0).toLocaleString('fa-IR')+'</td><td>'+actions+'</td></tr>';
 }).join(''):'<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted)">موردی ثبت نشده است.</td></tr>';
}
window.expensePostingStatus=expensePostingStatus;
window.expenseVisibleRecords=expenseVisibleRecords;
window.expenseEffectiveRecords=expenseEffectiveRecords;
window.expenseAmendPosted=expenseAmendPosted;
window.expenseCancelPosted=expenseCancelPosted;
window.editExpense=editExpense;
window.cancelExpenseEdit=cancelExpenseEdit;
window.cancelPostedExpenseUi=cancelPostedExpenseUi;
