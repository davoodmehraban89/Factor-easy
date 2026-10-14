/* Finora document management: accounting posting is explicit, never part of Save. */
function renderDocumentManagement(){
 const tbody=document.getElementById('finora-document-management-body');if(!tbody||!currentUser)return;
 const status=document.getElementById('document-status-filter')?.value||'all';
 const active=typeof afCompanyId==='function'?afCompanyId():'';
 const records=invoiceVisibleRecords().filter(x=>(!active||x.companyId===active)&&(status==='all'||invoiceDocumentStatus(x)===status))
   .slice().sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||'')));
 tbody.innerHTML=records.length?records.map(inv=>{
   const state=invoiceDocumentStatus(inv);
   const mayPost=invoiceCreatesAccountingEntry(inv.kind)&&state==='draft';
   const btn=mayPost?'<button class="btn btn-success btn-inline" data-doc-action="post" data-doc-id="'+esc(inv.id)+'">قطعی‌سازی</button>':'';
   const correction=state==='posted'&&invoiceCreatesAccountingEntry(inv.kind)?
     '<button class="btn btn-secondary btn-inline" data-doc-action="reopen" data-doc-id="'+esc(inv.id)+'">اصلاح فاکتور</button> <button class="btn btn-danger btn-inline" data-doc-action="cancel" data-doc-id="'+esc(inv.id)+'">ابطال</button>':'';
   const deleteDraft=state==='draft'&&!inv.journalVoucherId?
     '<button class="btn btn-danger btn-inline" data-doc-action="delete" data-doc-id="'+esc(inv.id)+'">حذف پیش‌نویس</button>':'';
   const edit=invoiceMayEdit(inv)?'<button class="btn btn-secondary btn-inline" data-doc-action="edit" data-doc-id="'+esc(inv.id)+'">ویرایش</button>':'';
   const posted=inv.journalVoucherId?'<button class="btn btn-secondary btn-inline" data-doc-action="voucher" data-doc-id="'+esc(inv.id)+'">مشاهده سند قطعی</button>':'';
   const print='<button class="btn btn-secondary btn-inline" data-doc-action="print" data-doc-id="'+esc(inv.id)+'">پیش‌نمایش چاپ</button>';
   return '<tr><td>'+esc(invoiceVisibleNumber(inv)||'—')+'</td><td>'+esc(inv.date||'—')+'</td><td>'+esc(inv.companyName||'—')+'</td><td>'+esc(inv.contactName||'—')+'</td><td>'+Number(inv.grandTotal||0).toLocaleString('fa-IR')+'</td><td>'+esc(invoiceDocumentStatusLabel(inv))+'</td><td style="display:flex;flex-wrap:wrap;gap:5px">'+edit+btn+correction+deleteDraft+posted+print+'</td></tr>';
 }).join(''):'<tr><td colspan="7" class="af-empty">سندی در این وضعیت ثبت نشده است.</td></tr>';
 const buyBody=document.getElementById('finora-purchase-document-management-body');
 if(buyBody&&typeof purchaseDocumentStatus==='function'){
  const rows=purchaseVisibleRecords().filter(x=>(!active||x.companyId===active)&&(status==='all'||purchaseDocumentStatus(x)===status)).slice()
    .sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||'')));
  buyBody.innerHTML=rows.length?rows.map(p=>{
   const state=purchaseDocumentStatus(p),id=esc(p.id),attr=' data-doc-kind="purchase" data-doc-id="'+id+'"';
   const label=({posted:'قطعی',draft:'موقت قابل‌ویرایش',reversed:'برگشت/ابطال‌شده',legacy_review:'قدیمی، نیازمند تطبیق'})[state]||'نامشخص';
   const actions=state==='posted'?
     '<button class="btn btn-secondary btn-inline" data-doc-action="reopen"'+attr+'>اصلاح فاکتور</button> <button class="btn btn-danger btn-inline" data-doc-action="cancel"'+attr+'>ابطال قطعی</button>':
     state==='draft'?
     '<button class="btn btn-secondary btn-inline" data-doc-action="edit"'+attr+'>ویرایش موقت</button> <button class="btn btn-success btn-inline" data-doc-action="post"'+attr+'>قطعی‌سازی</button> <button class="btn btn-danger btn-inline" data-doc-action="delete"'+attr+'>حذف موقت</button>':'';
   const voucher=p.journalVoucherId?'<button class="btn btn-secondary btn-inline" data-doc-action="voucher"'+attr+'>مشاهده سند</button>':'';
   return '<tr><td>'+esc(purchaseVisibleNumber(p)||'—')+'</td><td>'+esc(p.date||'—')+'</td><td>'+esc(p.supplierName||'—')+'</td><td>'+Number(p.grandTotal||0).toLocaleString('fa-IR')+'</td><td>'+esc(label)+'</td><td style="display:flex;flex-wrap:wrap;gap:5px">'+actions+voucher+'<button class="btn btn-secondary btn-inline" data-doc-action="print"'+attr+'>چاپ</button></td></tr>';
  }).join(''):'<tr><td colspan="6" class="af-empty">سند خریدی در این وضعیت وجود ندارد.</td></tr>';
 }
}
document.addEventListener('click',async event=>{
 const button=event.target instanceof Element?event.target.closest('#view-journal button[data-doc-action]'):null;
 if(!button)return;
 if(button.dataset.docKind==='purchase'){
  const purchase=getMyPurchases().find(p=>p.id===button.dataset.docId&&p.ownerUserId===currentUser?.id&&p.companyId===afCompanyId());
  if(!purchase)return;
  const action=button.dataset.docAction;
  if(action==='reopen')return beginPurchaseAmendment(purchase.id);
  if(action==='cancel')return purCancelPostedUi(purchase.id);
  if(action==='post')return purFinalizeUi(purchase.id);
  if(action==='edit')return purEdit(purchase.id);
  if(action==='delete')return purDeleteDraftUi(purchase.id);
  if(action==='print')return purPrint(purchase.id);
  if(action==='voucher'){
   if(typeof openDashboardVoucher==='function'&&purchase.journalVoucherId)return openDashboardVoucher(purchase.journalVoucherId);
   return alert('مرجع سند حسابداری یافت نشد.');
  }
  return;
 }
 const inv=getMyInvoices().find(x=>x.id===button.dataset.docId);
 if(!inv)return;
 const action=button.dataset.docAction;
 if(action==='reopen')return beginInvoiceAmendment(inv.id);
 if(action==='cancel'){
   const reason=prompt('دلیل ابطال سند قطعی:','اشتباه ثبت در دوره پایلوت');
   if(reason===null)return;
   if(!String(reason).trim())return alert('دلیل ابطال الزامی است.');
   if(!confirm('این عملیات سند قطعی را پاک نمی‌کند؛ یک سند معکوسِ قابل‌ردیابی ثبت می‌شود. تأیید می‌کنید؟'))return;
   try{await cancelPostedInvoicePilot(inv.id,reason);alert('ابطال از طریق سند برگشتی در سرور ثبت شد.');renderDocumentManagement();}
   catch(e){alert('ابطال تأیید نشد: '+e.message);}
   return;
 }
 if(action==='delete'){
   if(!confirm('پیش‌نویس انتخابی حذف شود؟ سند قطعی/تاریخچه حذف نخواهد شد.'))return;
   try{deleteInvoicePilotDraft(inv.id);renderDocumentManagement();}
   catch(e){alert('حذف پیش‌نویس مجاز نیست: '+e.message);}
   return;
 }
 if(action==='edit')return editInvoice(inv.id);
 if(action==='post')return finalizeInvoiceDocumentUi(inv.id);
 if(action==='print')return renderAndPrintDirect(inv.id);
 if(action==='voucher'){
   if(typeof openDashboardVoucher==='function'&&inv.journalVoucherId)return openDashboardVoucher(inv.journalVoucherId);
   alert('مرجع حسابداری قابل نمایش نیست.');
 }
});
