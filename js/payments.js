// First-class receipt/payment settlements with invoice allocation.
(function(){
let editingPaymentId=null;
const escP=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const num=v=>Math.max(0,Number(v)||0);
function paymentDirectionLabel(v){return v==='outbound'?'پرداخت':'دریافت';}
function paymentMethodLabel(v){return ({cash:'نقد',card:'کارت',bank:'انتقال بانکی',cheque:'چک'}[v]||'سایر');}
function invoiceOutstanding(inv){
  const gross=num(inv?.grandTotal);
  if(inv?.paymentMethod!=='credit')return 0;
  const paid=getMyPayments().filter(p=>p.direction==='inbound'&&p.invoiceType==='sale'&&p.invoiceId===inv.id).reduce((s,p)=>s+num(p.amount),0);
  return Math.max(0,gross-paid);
}
function purchaseOutstanding(inv){
  const gross=num(inv?.grandTotal);
  if(inv?.paymentMethod!=='credit')return 0;
  const paid=getMyPayments().filter(p=>p.direction==='outbound'&&p.invoiceType==='purchase'&&p.invoiceId===inv.id).reduce((s,p)=>s+num(p.amount),0);
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
  if(dir==='inbound')rows=getMyInvoices().filter(i=>(!cid||i.contactId===cid)&&invoiceOutstanding(i)>0).map(i=>({id:i.id,type:'sale',label:`فروش ${i.invoiceNumber||i.id} — مانده ${invoiceOutstanding(i).toLocaleString('fa-IR')}`}));
  else rows=getMyPurchases().filter(i=>(!cid||i.supplierId===cid)&&purchaseOutstanding(i)>0).map(i=>({id:i.id,type:'purchase',label:`خرید ${i.invoiceNo||i.id} — مانده ${purchaseOutstanding(i).toLocaleString('fa-IR')}`}));
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
  if(invoiceId&&invoiceType==='sale'){const inv=getMyInvoices().find(i=>i.id===invoiceId);if(!inv||direction!=='inbound'||inv.contactId!==contactId){alert('فاکتور فروش با طرف حساب یا نوع دریافت مطابقت ندارد.');return;}if(inv.paymentMethod!=='credit'){alert('فاکتور نقدی مانده قابل تخصیص ندارد.');return;}outstanding=invoiceOutstanding(inv);}
  if(invoiceId&&invoiceType==='purchase'){const inv=getMyPurchases().find(i=>i.id===invoiceId);if(!inv||direction!=='outbound'||inv.supplierId!==contactId){alert('فاکتور خرید با طرف حساب یا نوع پرداخت مطابقت ندارد.');return;}if(inv.paymentMethod!=='credit'){alert('فاکتور خرید نقدی مانده قابل تخصیص ندارد.');return;}outstanding=purchaseOutstanding(inv);}
  const old=editingPaymentId?getMyPayments().find(p=>p.id===editingPaymentId):null;
  if(old&&old.invoiceId===invoiceId)outstanding+=num(old.amount);
  if(invoiceId&&amount>outstanding){alert('مبلغ از مانده فاکتور بیشتر است.');return;}
  const contact=getMyContacts().find(c=>c.id===contactId);
  const linkedSale=invoiceType==='sale'?getMyInvoices().find(i=>i.id===invoiceId):null;
  const linkedPurchase=invoiceType==='purchase'?getMyPurchases().find(i=>i.id===invoiceId):null;
  const companies=getMyCompanies(),active=linkedSale?.companyId||linkedPurchase?.companyId||getMySettings().default_company_id||companies[0]?.id||'';
  const payload={id:old?.id||('PAY-'+Date.now()),ownerUserId:currentUser.id,companyId:active,contactId,contactName:contact?.name||'',direction,amount,method:document.getElementById('pay-method')?.value||'bank',reference:(document.getElementById('pay-reference')?.value||'').trim(),note:(document.getElementById('pay-note')?.value||'').trim(),invoiceType,invoiceId,projectId:linkedSale?.projectId||linkedPurchase?.costCenterId||'',date:old?.date||new Date().toISOString()};
  if(old)Object.assign(old,payload);else datastore.payments.push(payload);
  saveDatastore();resetPaymentForm();refreshAllSurfaces();renderPayments();
}
function editPayment(id){
  const p=getMyPayments().find(x=>x.id===id);if(!p)return;
  editingPaymentId=id;refreshPaymentContacts();
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
  if(!confirm('این دریافت/پرداخت حذف شود؟ مانده فاکتور دوباره محاسبه می‌شود.'))return;
  datastore.payments=datastore.payments.filter(p=>!(p.id===id&&p.ownerUserId===currentUser.id));
  if(editingPaymentId===id)resetPaymentForm();
  saveDatastore();refreshAllSurfaces();renderPayments();
}
function renderPayments(){
  refreshPaymentContacts();refreshPaymentInvoices();
  const body=document.getElementById('payments-ledger');if(!body)return;
  const rows=getMyPayments().slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  body.innerHTML=rows.length?rows.map(p=>`<tr><td>${escP(new Date(p.date).toLocaleDateString('fa-IR'))}</td><td>${escP(paymentDirectionLabel(p.direction))}</td><td>${escP(p.contactName)}</td><td>${escP(paymentMethodLabel(p.method))}</td><td>${num(p.amount).toLocaleString('fa-IR')}</td><td>${escP(p.reference||'-')}</td><td><button class="btn btn-secondary btn-inline" onclick="editPayment('${escP(p.id)}')">اصلاح</button> <button class="btn btn-danger btn-inline" onclick="deletePayment('${escP(p.id)}')">حذف</button></td></tr>`).join(''):'<tr><td colspan="7" style="text-align:center">هنوز دریافت یا پرداختی ثبت نشده است.</td></tr>';
}
function installPaymentUI(){
  if(document.getElementById('view-payments'))return;
  const expLink=document.querySelector('[data-view="view-expenses"]')?.closest('li');
  if(expLink){const li=document.createElement('li');li.innerHTML='<a href="#" class="nav-link" data-view="view-payments" onclick="switchView(\'view-payments\');renderPayments();return false">💵 دریافت و پرداخت</a>';expLink.after(li);}
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