// First-class receipt/payment settlements with invoice allocation.
(function(){
let editingPaymentId=null;
const escP=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const num=v=>Math.max(0,Number(v)||0);
function paymentDirectionLabel(v){return v==='outbound'?'پرداخت':'دریافت';}
function paymentMethodLabel(v){return ({cash:'نقد',card:'کارت',bank:'انتقال بانکی',cheque:'چک'}[v]||'سایر');}
// One employee-facing treasury document; corrections are private linked source
// versions and balanced journal events, never mutations of posted history.
function paymentPostingStatus(p){
 if(!p)return 'unknown';
 const v=typeof jeSourceVoucher==='function'?jeSourceVoucher(p):null;
 if(v?.status==='posted')return 'posted';
 if(v?.status==='reversed')return 'reversed';
 return 'legacy_review'; // Unlinked historical records need manual reconciliation.
}
function paymentCurrentVisible(id){
 const rows=getMyPayments();let p=rows.find(x=>x.id===id),seen=new Set();
 while(p&&!seen.has(p.id)){
  seen.add(p.id);
  const next=rows.filter(x=>x.correctsPaymentId===p.id)
    .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0];
  if(!next)break;p=next;
 }
 return p;
}
function paymentVisibleRecords(){
 const rows=getMyPayments(),parents=new Set(rows.map(p=>p.correctsPaymentId).filter(Boolean));
 return rows.filter(p=>!parents.has(p.id));
}
function paymentEffectiveRecords(){
 return paymentVisibleRecords().filter(p=>['posted','legacy_review'].includes(paymentPostingStatus(p)));
}
function paymentCanAmend(p){
 return !!p&&!p.invoiceId&&!p.invoiceType&&p.method!=='cheque';
}
function paymentEligibility(id){
 if(!requireWrite()||!currentUser)throw new Error('مجوز اصلاح دریافت/پرداخت ندارید.');
 const p=paymentCurrentVisible(id);
 if(!p||p.id!==id||p.ownerUserId!==currentUser.id||p.companyId!==afCompanyId())
  throw new Error('سند جاری مربوط به این کاربر و شرکت نیست.');
 if(paymentPostingStatus(p)!=='posted')throw new Error('فقط ثبت قطعیِ دارای سند حسابداری قابل اصلاح است.');
 if(!paymentCanAmend(p))throw new Error('سند دارای تسویه فاکتور یا چک است و ابتدا باید جداگانه تطبیق شود.');
 const v=jeSourceVoucher(p);
 if(!v||v.status!=='posted'||v.sourceId!==p.id||
  v.sourceType!==(p.direction==='outbound'?'payment':'receipt'))throw new Error('سند حسابداری متصل تطبیق ندارد.');
 const fy=getMyFiscalYears().find(x=>x.id===v.fiscalYearId);
 const next=jeFiscalForDate(getJalaliNumeric());
 if(!fy||fy.status==='locked'||!next||next.status==='locked')
  throw new Error('سال مالی قفل‌شده یا بدون دوره باز است.');
 if(getMyPayments().some(x=>x.correctsPaymentId===p.id))
  throw new Error('نسخه اصلاحی جدیدتری ثبت شده؛ فهرست را تازه کنید.');
 return {record:p,voucher:v};
}
function paymentPreflight(patch,p){
 const amount=num(patch.amount);
 if(!Number.isFinite(amount)||amount<=0)throw new Error('مبلغ معتبر نیست.');
 if(patch.direction!==p.direction||patch.contactId!==p.contactId||
    patch.companyId!==p.companyId||patch.invoiceId||patch.invoiceType)
  throw new Error('طرف حساب، شرکت، نوع و تخصیص سند قطعی در این مرحله قابل تغییر نیست.');
 if(!['cash','card','bank'].includes(patch.method))throw new Error('اصلاح چک نیازمند بررسی مستقل است.');
 if(!getMyContacts().some(c=>c.id===p.contactId))throw new Error('طرف حساب یافت نشد.');
 const kind=p.direction==='outbound'?'payment':'receipt';
 if(typeof jeProfile!=='function'||!jeProfile(kind))throw new Error('پروفایل ثبت حسابداری دریافت/پرداخت یافت نشد.');
 return amount;
}
async function paymentAmendPosted(id,patch){
 const {record:p,voucher:v}=paymentEligibility(id);
 paymentPreflight(patch,p);
 // The original voucher is not reversed on form OPEN/CANCEL, only on SAVE.
 const reversal=jeReverse(v.id,getJalaliNumeric(),'اصلاح دریافت/پرداخت دوره پایلوت');
 await invoicePilotAwaitSync(['journalVouchers|'+v.id,'journalVouchers|'+reversal.id]);
 const now=new Date().toISOString();
 const newer={...p,id:afId('PAY'),amount:num(patch.amount),method:patch.method,
  reference:String(patch.reference||''),note:String(patch.note||''),
  createdAt:now,updatedAt:now,accountingStatus:'draft',
  correctsPaymentId:p.id,correctionReversalId:reversal.id,
  accountingVersion:1};
 delete newer.journalVoucherId;delete newer.accountingPostedAt;
 datastore.payments.push(newer);saveDatastore();
 await invoicePilotAwaitSync(['payments|'+newer.id]);
 const posted=jePostSourceRecord(p.direction==='outbound'?'payment':'receipt',newer);
 await invoicePilotAwaitSync(['payments|'+newer.id,'journalVouchers|'+posted.id]);
 return newer.id;
}
async function paymentCancelPosted(id,reason){
 const {voucher:v}=paymentEligibility(id);
 if(!String(reason||'').trim())throw new Error('دلیل ابطال لازم است.');
 const reversed=jeReverse(v.id,getJalaliNumeric(),'ابطال ثبت نرم‌افزاری: '+String(reason).trim());
 await invoicePilotAwaitSync(['journalVouchers|'+v.id,'journalVouchers|'+reversed.id]);
 return reversed.id;
}
function paymentCorrectionPayload(){
 return {direction:document.getElementById('pay-direction')?.value||'',
  contactId:document.getElementById('pay-contact')?.value||'',
  companyId:afCompanyId(),
  amount:num(document.getElementById('pay-amount')?.value),
  method:document.getElementById('pay-method')?.value||'bank',
  reference:(document.getElementById('pay-reference')?.value||'').trim(),
  note:(document.getElementById('pay-note')?.value||'').trim(),
  invoiceType:(document.getElementById('pay-invoice')?.value||'').split('|')[0]||'',
  invoiceId:(document.getElementById('pay-invoice')?.value||'').split('|')[1]||''};
}
function cancelPostedPaymentUi(id){
 if(!confirm('فقط ثبت داخل فینورا با سند حسابداری معکوس ابطال می‌شود. تراکنش واقعی بانک/کارت برگشت نمی‌خورد. ادامه می‌دهید؟'))return;
 const reason=prompt('دلیل ابطال ثبت نرم‌افزاری:','اشتباه ثبت در دوره پایلوت');
 if(reason===null)return;
 void paymentCancelPosted(id,reason).then(()=>{refreshAllSurfaces();renderPayments();alert('ابطال ثبت شد. سابقه اصلی محفوظ است.');})
 .catch(e=>{refreshAllSurfaces();renderPayments();alert('ابطال تأیید نشد؛ وضعیت سرور را قبل از تکرار بررسی کنید: '+e.message);});
}
window.paymentVisibleRecords=paymentVisibleRecords;
window.paymentEffectiveRecords=paymentEffectiveRecords;
window.paymentPostingStatus=paymentPostingStatus;
window.paymentAmendPosted=paymentAmendPosted;
window.paymentCancelPosted=paymentCancelPosted;
window.cancelPostedPaymentUi=cancelPostedPaymentUi;

function invoiceOutstanding(inv){
  const gross=num(inv?.grandTotal);
  if(inv?.paymentMethod!=='credit')return 0;
  const paid=paymentEffectiveRecords().filter(p=>p.direction==='inbound'&&p.invoiceType==='sale'&&p.invoiceId===inv.id).reduce((s,p)=>s+num(p.amount),0);
  return Math.max(0,gross-paid);
}
function purchaseOutstanding(inv){
  if(typeof purchaseDocumentStatus==='function'&&purchaseDocumentStatus(inv)!=='posted')return 0;
  const gross=num(inv?.grandTotal);
  if(inv?.paymentMethod!=='credit')return 0;
  const paid=paymentEffectiveRecords().filter(p=>p.direction==='outbound'&&p.invoiceType==='purchase'&&p.invoiceId===inv.id).reduce((s,p)=>s+num(p.amount),0);
  return Math.max(0,gross-paid);
}
function resetPaymentForm(){
  editingPaymentId=null;
  ['pay-amount','pay-reference','pay-note'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  const d=document.getElementById('pay-direction');if(d)d.value='inbound';
  const m=document.getElementById('pay-method');if(m)m.value='bank';
  const c=document.getElementById('pay-contact');if(c)c.value='';
  refreshPaymentInvoices();
  const b=document.getElementById('pay-save');if(b)b.textContent='ثبت دریافت / پرداخت';
  const x=document.getElementById('pay-cancel');if(x)x.style.display='none';
}
function refreshPaymentContacts(){
  const el=document.getElementById('pay-contact');if(!el)return;
  const prev=el.value;
  el.innerHTML='<option value="">انتخاب طرف حساب</option>'+getMyContacts().map(c=>`<option value="${escP(c.id)}">${escP(c.name)}</option>`).join('');
  if([...el.options].some(o=>o.value===prev))el.value=prev;
}
function refreshPaymentInvoices(){
  const el=document.getElementById('pay-invoice');if(!el)return;
  const dir=document.getElementById('pay-direction')?.value||'inbound';
  const cid=document.getElementById('pay-contact')?.value||'';
  let rows=[];
  const companies=getMyCompanies(),active=getMySettings().default_company_id||companies[0]?.id||'',legacyOk=companies.length===1,companyOk=i=>!active||i.companyId===active||(!i.companyId&&legacyOk);
  if(dir==='inbound')rows=getMyInvoices().filter(i=>companyOk(i)&&(!cid||i.contactId===cid)&&typeof invoiceDocumentStatus==='function'&&invoiceDocumentStatus(i)==='posted'&&invoiceOutstanding(i)>0).map(i=>({id:i.id,type:'sale',label:`فروش ${i.number||i.invoiceNumber||i.id} — مانده ${invoiceOutstanding(i).toLocaleString('fa-IR')}`}));
  else rows=getMyPurchases().filter(i=>companyOk(i)&&(!cid||i.supplierId===cid)&&purchaseOutstanding(i)>0).map(i=>({id:i.id,type:'purchase',label:`خرید ${i.number||i.invoiceNo||i.id} — مانده ${purchaseOutstanding(i).toLocaleString('fa-IR')}`}));
  const prev=el.value;
  el.innerHTML='<option value="">بدون تخصیص به فاکتور</option>'+rows.map(r=>`<option value="${r.type}|${escP(r.id)}">${escP(r.label)}</option>`).join('');
  if([...el.options].some(o=>o.value===prev))el.value=prev;
}
function commitSavePayment(){
  if(typeof requireWrite==='function'&&!requireWrite())return;
  const direction=document.getElementById('pay-direction')?.value||'inbound';
  const contactId=document.getElementById('pay-contact')?.value||'';
  const amount=num(document.getElementById('pay-amount')?.value);
  if(!contactId){alert('طرف حساب را انتخاب کنید.');return;}
  if(amount<=0){alert('مبلغ باید بیشتر از صفر باشد.');return;}
  const alloc=(document.getElementById('pay-invoice')?.value||'').split('|');
  const invoiceType=alloc.length===2?alloc[0]:'';
  const invoiceId=alloc.length===2?alloc[1]:'';
  let outstanding=Infinity;
  if(invoiceId&&invoiceType==='sale'){const inv=getMyInvoices().find(i=>i.id===invoiceId);if(!inv||typeof invoiceDocumentStatus!=='function'||invoiceDocumentStatus(inv)!=='posted'||direction!=='inbound'||inv.contactId!==contactId){alert('فاکتور فروش با طرف حساب یا نوع دریافت مطابقت ندارد.');return;}if(inv.paymentMethod!=='credit'){alert('فاکتور نقدی مانده قابل تخصیص ندارد.');return;}outstanding=invoiceOutstanding(inv);}
  if(invoiceId&&invoiceType==='purchase'){const inv=getMyPurchases().find(i=>i.id===invoiceId);if(!inv||direction!=='outbound'||inv.supplierId!==contactId){alert('فاکتور خرید با طرف حساب یا نوع پرداخت مطابقت ندارد.');return;}if(inv.paymentMethod!=='credit'){alert('فاکتور خرید نقدی مانده قابل تخصیص ندارد.');return;}outstanding=purchaseOutstanding(inv);}
  const old=editingPaymentId?getMyPayments().find(p=>p.id===editingPaymentId):null;
  if(old&&paymentPostingStatus(old)==='posted'){
    const payload=paymentCorrectionPayload(),id=old.id;
    try{paymentEligibility(id);paymentPreflight(payload,old);}catch(e){alert(e.message);return;}
    const btn=document.getElementById('pay-save');if(btn)btn.disabled=true;
    void paymentAmendPosted(id,payload).then(()=>{
      resetPaymentForm();refreshAllSurfaces();renderPayments();
      alert('اصلاح دریافت/پرداخت ذخیره شد.');
    }).catch(e=>{
      resetPaymentForm();refreshAllSurfaces();renderPayments();
      alert('اصلاح کامل نشد؛ وضعیت ثبت‌های حسابداری و سرور را بررسی کنید، سپس اقدام کنید: '+e.message);
    }).finally(()=>{if(btn)btn.disabled=false;});
    return;
  }
  if(old&&typeof jeGuardSourceMutation==='function'){try{jeGuardSourceMutation(old,'دریافت/پرداخت');}catch(e){alert(e.message);return;}}
  if(old&&old.invoiceId===invoiceId&&old.invoiceType===invoiceType&&old.direction===direction)outstanding+=num(old.amount);
  if(invoiceId&&amount>outstanding){alert('مبلغ از مانده فاکتور بیشتر است.');return;}
  const contact=getMyContacts().find(c=>c.id===contactId);
  const linkedSale=invoiceType==='sale'?getMyInvoices().find(i=>i.id===invoiceId):null;
  const linkedPurchase=invoiceType==='purchase'?getMyPurchases().find(i=>i.id===invoiceId):null;
  const companies=getMyCompanies(),active=linkedSale?.companyId||linkedPurchase?.companyId||getMySettings().default_company_id||companies[0]?.id||'';
  const payload={id:old?.id||('PAY-'+Date.now()),ownerUserId:currentUser.id,companyId:active,contactId,contactName:contact?.name||'',direction,amount,method:document.getElementById('pay-method')?.value||'bank',reference:(document.getElementById('pay-reference')?.value||'').trim(),note:(document.getElementById('pay-note')?.value||'').trim(),invoiceType,invoiceId,projectId:linkedSale?.projectId||linkedPurchase?.costCenterId||'',date:old?.date||getJalaliNumeric()};
  if(old)Object.assign(old,payload);else{datastore.payments.push(payload);if(typeof jePostSourceRecord==='function'){try{jePostSourceRecord(direction==='outbound'?'payment':'receipt',payload);}catch(e){datastore.payments=datastore.payments.filter(x=>x.id!==payload.id);alert('دریافت/پرداخت ثبت نشد: '+e.message);return;}}}
  saveDatastore();resetPaymentForm();refreshAllSurfaces();renderPayments();
}
function editPayment(id){
  const p=paymentCurrentVisible(id);if(!p)return;
  if(paymentPostingStatus(p)!=='posted'||!paymentCanAmend(p)){
    alert('این ثبت ابتدا به تطبیق تاریخچه، تسویه فاکتور یا چک نیاز دارد.');return;
  }
  try{paymentEligibility(p.id);}catch(e){alert(e.message);return;}
  editingPaymentId=p.id;refreshPaymentContacts();
  document.getElementById('pay-direction').value=p.direction;
  document.getElementById('pay-contact').value=p.contactId||'';
  document.getElementById('pay-method').value=p.method||'bank';
  document.getElementById('pay-amount').value=p.amount||'';
  document.getElementById('pay-reference').value=p.reference||'';
  document.getElementById('pay-note').value=p.note||'';
  refreshPaymentInvoices();
  if(p.invoiceId)document.getElementById('pay-invoice').value=(p.invoiceType||'sale')+'|'+p.invoiceId;
  document.getElementById('pay-save').textContent='ذخیره اصلاح';
  document.getElementById('pay-cancel').style.display='';
}
function deletePayment(id){
  if(typeof requireWrite==='function'&&!requireWrite())return;
  const source=paymentCurrentVisible(id);if(source&&paymentPostingStatus(source)==='posted')
    return cancelPostedPaymentUi(source.id);
  if(typeof jeGuardSourceMutation==='function'){try{jeGuardSourceMutation(source,'دریافت/پرداخت');}catch(e){alert(e.message);return;}}if(!confirm('این دریافت/پرداخت حذف شود؟ مانده فاکتور دوباره محاسبه می‌شود.'))return;
  datastore.payments=datastore.payments.filter(p=>!(p.id===id&&p.ownerUserId===currentUser.id));
  if(editingPaymentId===id)resetPaymentForm();
  saveDatastore();refreshAllSurfaces();renderPayments();
}
function renderPayments(){
  refreshPaymentContacts();refreshPaymentInvoices();
  const body=document.getElementById('payments-ledger');if(!body)return;
  const companies=getMyCompanies(),active=getMySettings().default_company_id||companies[0]?.id||'',legacyOk=companies.length===1;const rows=paymentVisibleRecords().filter(p=>!active||p.companyId===active||(!p.companyId&&legacyOk))
   .slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  body.innerHTML=rows.length?rows.map(p=>{const displayDate=/^\d{4}\/\d{2}\/\d{2}$/.test(String(p.date||''))?p.date:new Date(p.date).toLocaleDateString('fa-IR');return `<tr><td>${escP(displayDate)}</td><td>${escP(paymentDirectionLabel(p.direction))}</td><td>${escP(p.contactName)}</td><td>${escP(paymentMethodLabel(p.method))}</td><td>${num(p.amount).toLocaleString('fa-IR')}</td><td>${escP(p.reference||'-')}</td><td>${paymentPostingStatus(p)==='posted'&&paymentCanAmend(p)?
  '<button class="btn btn-secondary btn-inline" onclick="editPayment(&#39;'+escP(p.id)+'&#39;)">اصلاح</button> <button class="btn btn-danger btn-inline" onclick="deletePayment(&#39;'+escP(p.id)+'&#39;)">ابطال ثبت</button>':
  paymentPostingStatus(p)==='reversed'?'ابطال‌شده':
  '<button class="btn btn-secondary btn-inline" disabled title="نیازمند تطبیق ثبت‌های مرتبط">نیازمند تطبیق</button>'}</td></tr>`}).join(''):'<tr><td colspan="7" style="text-align:center">هنوز دریافت یا پرداختی ثبت نشده است.</td></tr>';
}
function installPaymentUI(){
  if(document.getElementById('view-payments'))return;
  const expLink=document.querySelector('[data-view="view-expenses"]')?.closest('li');
  if(expLink&&!document.querySelector('.sidebar [data-view="view-payments"]')){const li=document.createElement('li');li.innerHTML='<a href="#" class="nav-link" data-view="view-payments" onclick="switchView(\'view-payments\');renderPayments();return false">💵 دریافت و پرداخت</a>';expLink.after(li);}
  const expenses=document.getElementById('view-expenses');if(!expenses)return;
  const s=document.createElement('section');s.id='view-payments';s.className='view-pane';
  s.innerHTML=`<div class="card"><h2 style="font-size:17px;margin-bottom:14px">دریافت و پرداخت</h2><div class="form-grid">
  <div class="form-group"><label>نوع</label><select id="pay-direction" class="form-control" onchange="refreshPaymentInvoices()"><option value="inbound">دریافت از مشتری</option><option value="outbound">پرداخت به تأمین‌کننده</option></select></div>
  <div class="form-group"><label>طرف حساب</label><select id="pay-contact" class="form-control" onchange="refreshPaymentInvoices()"></select></div>
  <div class="form-group"><label>فاکتور مرتبط</label><select id="pay-invoice" class="form-control"></select></div>
  <div class="form-group"><label>روش</label><select id="pay-method" class="form-control"><option value="bank">انتقال بانکی</option><option value="card">کارت</option><option value="cash">نقد</option><option value="cheque">چک</option></select></div>
  <div class="form-group"><label>مبلغ</label><input id="pay-amount" type="number" min="0" class="form-control"></div>
  <div class="form-group"><label>شماره پیگیری / مرجع</label><input id="pay-reference" class="form-control"></div>
  <div class="form-group" style="grid-column:1/-1"><label>توضیحات</label><input id="pay-note" class="form-control"></div></div>
  <div style="display:flex;gap:8px"><button id="pay-save" class="btn btn-success" onclick="commitSavePayment()">ثبت دریافت / پرداخت</button><button id="pay-cancel" class="btn btn-secondary" style="display:none" onclick="resetPaymentForm()">انصراف</button></div></div>
  <div class="card"><h3 style="font-size:15px;margin-bottom:12px">گردش دریافت و پرداخت</h3><div class="table-wrap"><table><thead><tr><th>تاریخ</th><th>نوع</th><th>طرف حساب</th><th>روش</th><th>مبلغ</th><th>مرجع</th><th>عملیات</th></tr></thead><tbody id="payments-ledger"></tbody></table></div></div>`;
  expenses.after(s);renderPayments();
}
window.invoiceOutstanding=invoiceOutstanding;window.purchaseOutstanding=purchaseOutstanding;window.renderPayments=renderPayments;window.commitSavePayment=commitSavePayment;window.editPayment=editPayment;window.deletePayment=deletePayment;window.resetPaymentForm=resetPaymentForm;window.refreshPaymentInvoices=refreshPaymentInvoices;
document.addEventListener('DOMContentLoaded',installPaymentUI);
const oldRefresh=window.refreshAllSurfaces;if(typeof oldRefresh==='function')window.refreshAllSurfaces=function(){oldRefresh();renderPayments();};
})();