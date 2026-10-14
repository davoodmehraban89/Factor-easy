/* Finora document management: accounting posting is explicit, never part of Save. */
function renderDocumentManagement(){
 const tbody=document.getElementById('finora-document-management-body');if(!tbody||!currentUser)return;
 const status=document.getElementById('document-status-filter')?.value||'all';
 const active=typeof afCompanyId==='function'?afCompanyId():'';
 const records=getMyInvoices().filter(x=>(!active||x.companyId===active)&&(status==='all'||invoiceDocumentStatus(x)===status))
   .slice().sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||'')));
 tbody.innerHTML=records.length?records.map(inv=>{
   const state=invoiceDocumentStatus(inv);
   const mayPost=invoiceCreatesAccountingEntry(inv.kind)&&state==='draft';
   const btn=mayPost?'<button class="btn btn-success btn-inline" data-doc-action="post" data-doc-id="'+esc(inv.id)+'">قطعی‌سازی</button>':'';
   const correction=state==='posted'&&invoiceCreatesAccountingEntry(inv.kind)?
     '<button class="btn btn-secondary btn-inline" data-doc-action="reopen" data-doc-id="'+esc(inv.id)+'">برگشت قطعی به موقت (اصلاحی)</button> <button class="btn btn-danger btn-inline" data-doc-action="cancel" data-doc-id="'+esc(inv.id)+'">ابطال قطعی</button>':'';
   const deleteDraft=state==='draft'&&!inv.journalVoucherId?
     '<button class="btn btn-danger btn-inline" data-doc-action="delete" data-doc-id="'+esc(inv.id)+'">حذف پیش‌نویس</button>':'';
   const edit=invoiceMayEdit(inv)?'<button class="btn btn-secondary btn-inline" data-doc-action="edit" data-doc-id="'+esc(inv.id)+'">ویرایش</button>':'';
   const posted=inv.journalVoucherId?'<button class="btn btn-secondary btn-inline" data-doc-action="voucher" data-doc-id="'+esc(inv.id)+'">مشاهده سند قطعی</button>':'';
   const print='<button class="btn btn-secondary btn-inline" data-doc-action="print" data-doc-id="'+esc(inv.id)+'">پیش‌نمایش چاپ</button>';
   return '<tr><td>'+esc(inv.number||'—')+'</td><td>'+esc(inv.date||'—')+'</td><td>'+esc(inv.companyName||'—')+'</td><td>'+esc(inv.contactName||'—')+'</td><td>'+Number(inv.grandTotal||0).toLocaleString('fa-IR')+'</td><td>'+esc(invoiceDocumentStatusLabel(inv))+'</td><td style="display:flex;flex-wrap:wrap;gap:5px">'+edit+btn+correction+deleteDraft+posted+print+'</td></tr>';
 }).join(''):'<tr><td colspan="7" class="af-empty">سندی در این وضعیت ثبت نشده است.</td></tr>';
}
document.addEventListener('click',async event=>{
 const button=event.target instanceof Element?event.target.closest('#view-journal button[data-doc-action]'):null;
 if(!button)return;
 const inv=getMyInvoices().find(x=>x.id===button.dataset.docId);
 if(!inv)return;
 const action=button.dataset.docAction;
 if(action==='reopen'){
   const reason=prompt('دلیل برگشت از قطعی به موقت (نسخه اصلاحی):','اصلاح اطلاعات دوره پایلوت');
   if(reason===null)return;
   if(!String(reason).trim())return alert('دلیل اصلاح الزامی است.');
   if(!confirm('سند قطعی قدیمی و سطرهای آن حفظ می‌شوند؛ یک سند برگشتی و نسخه موقت جدید برای اصلاح ساخته می‌شود. ادامه می‌دهید؟'))return;
   try{
     const draftId=await reopenPostedInvoiceAsDraft(inv.id,reason);
     alert('نسخه موقت اصلاحی ساخته و در سرور ثبت شد. شماره فاکتور اصلی محفوظ است.');
     renderDocumentManagement();editInvoice(draftId);
   }catch(e){alert('برگشت به موقت تأیید نشد: '+e.message);}
   return;
 }
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
