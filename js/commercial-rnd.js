// Finora commerce R&D slice: unified invoice entry, safe company reset, Excel templates.
(function(){
  const $=id=>document.getElementById(id);
  window.finoraOpenInvoiceType=function(type){
    if(type==='purchase'){switchView('view-purchases');return;}
    switchView('view-invoices');
    const kind=$('invoice-kind');
    if(kind){kind.value=type==='pre_invoice'?'pre_invoice':type==='contract_statement'?'contract_statement':'non_formal';if(typeof handleInvoiceKindChange==='function')handleInvoiceKindChange();}
  };
  function invoiceTypeControl(current){
    return '<div class="form-group finora-invoice-type" style="min-width:220px;margin:0"><label>نوع فاکتور / سند تجاری</label><select class="form-control" onchange="finoraOpenInvoiceType(this.value)">'+
      '<option value="sale" '+(current==='sale'?'selected':'')+'>فروش</option>'+
      '<option value="purchase" '+(current==='purchase'?'selected':'')+'>خرید</option>'+
      '<option value="pre_invoice">پیش‌فاکتور فروش</option>'+
      '<option value="contract_statement">صورت‌وضعیت فروش</option>'+
      '</select><small style="color:var(--text-muted)">نوع سند را انتخاب کنید؛ حسابداری هر رویداد به‌صورت خودکار تعیین می‌شود.</small></div>';
  }
  function installUnifiedInvoiceControls(){
    const saleTitle=$('invoice-form-title');
    if(saleTitle&&!document.querySelector('#view-invoices .finora-invoice-type')){
      const host=saleTitle.parentElement?.parentElement;if(host){const box=document.createElement('div');box.innerHTML=invoiceTypeControl('sale');host.insertBefore(box.firstElementChild,host.children[1]||null);}saleTitle.innerText='صدور سند تجاری';
    }
    const purSel=$('pur-supplier');
    if(purSel&&!$('pur-quick-supplier')){
      const a=document.createElement('a');a.id='pur-quick-supplier';a.href='#';a.innerText='+ تأمین‌کننده جدید';a.style.cssText='display:inline-block;margin-bottom:6px';a.onclick=e=>{e.preventDefault();openQuickContactModal('supplier');};purSel.parentElement?.insertBefore(a,purSel);
    }
    const purTitle=$('pur-form-title');
    if(purTitle&&!document.querySelector('#view-purchases .finora-invoice-type')){
      const host=purTitle.parentElement?.parentElement;if(host){const box=document.createElement('div');box.innerHTML=invoiceTypeControl('purchase');host.insertBefore(box.firstElementChild,host.children[1]||null);}
    }
  }
  window.downloadInvoiceItemsExcelTemplate=function(){
    if(typeof XLSX==='undefined')return alert('موتور Excel در دسترس نیست.');
    const ws=XLSX.utils.aoa_to_sheet([['کد کالا','شرح','تعداد','واحد','فی'],['101','نمونه کالا',2,'عدد',100000]]);
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'اقلام فروش');XLSX.writeFile(wb,'نمونه_ورود_اقلام_فاکتور_فروش_فینورا.xlsx');
  };
  window.purDownloadExcelTemplate=function(){
    if(typeof XLSX==='undefined')return alert('موتور Excel در دسترس نیست.');
    const ws=XLSX.utils.aoa_to_sheet([['کد کالا','شرح','تعداد','واحد','فی'],['101','نمونه کالا',2,'عدد',80000]]);
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'اقلام خرید');XLSX.writeFile(wb,'نمونه_ورود_اقلام_فاکتور_خرید_فینورا.xlsx');
  };
  function installTemplateButtons(){
    const purInput=document.querySelector('#view-purchases input[type=file][accept*=xlsx]');
    if(purInput&&!$('purchase-excel-template-btn')){const b=document.createElement('button');b.type='button';b.id='purchase-excel-template-btn';b.className='btn btn-secondary btn-inline';b.innerText='دانلود فایل نمونه';b.onclick=purDownloadExcelTemplate;purInput.closest('label')?.insertAdjacentElement('afterend',b);}
    const saleInput=$('excel-import-invoice-items');
    if(saleInput&&!$('invoice-excel-template-btn')){const b=document.createElement('button');b.type='button';b.id='invoice-excel-template-btn';b.className='btn btn-secondary btn-inline';b.style.cssText='min-height:34px;padding:4px 10px;font-size:12px';b.innerText='دانلود فایل نمونه';b.onclick=downloadInvoiceItemsExcelTemplate;saleInput.closest('label')?.insertAdjacentElement('afterend',b);}
  }
  const FACTORY_PRESERVE=new Set(['companies','settings']);
  function selectedCompany(){if(!currentUser)return null;const id=getMySettings()?.default_company_id||'';return getMyCompanies().find(c=>c.id===id)||getMyCompanies()[0]||null;}
  function resetCandidates(company){
    const companies=getMyCompanies(),items=[],skippedLegacy=[];for(const coll of COLLS){if(FACTORY_PRESERVE.has(coll))continue;for(const row of (datastore[coll]||[])){if(row?.ownerUserId!==currentUser.id)continue;if(row.companyId===company.id)items.push([coll,row]);else if(!row.companyId){if(companies.length===1)items.push([coll,row]);else skippedLegacy.push([coll,row]);}}}return {items,skippedLegacy};
  }
  window.finoraFactoryResetSelectedCompany=function(){
    if(!requireWrite()||!currentUser)return;const company=selectedCompany();if(!company)return alert('شرکت فعالی انتخاب نشده است.');
    const plan=resetCandidates(company),candidates=plan.items,skipped=plan.skippedLegacy.length;
    const phrase=prompt('هشدار جدی: همه داده‌های مالی و عملیاتی شرکت فعال «'+company.name+'» حذف می‌شود و قابل بازگشت نیست مگر از پشتیبان. خود شرکت، حساب ورود و دسترسی‌ها حفظ می‌شوند.'+(skipped?'\n'+skipped+' رکورد قدیمی بدون شناسه شرکت برای جلوگیری از آسیب به شرکت‌های دیگر حذف نخواهند شد.':'')+'\nبرای ادامه عبارت «ریست '+company.name+'» را دقیق وارد کنید.');
    if(phrase!=='ریست '+company.name)return;if(!confirm('تأیید دوم: '+candidates.length+' رکورد شرکت فعال حذف می‌شود. آیا پشتیبان لازم را گرفته‌اید و مطمئن هستید؟'))return;if(!confirm('تأیید نهایی و غیرقابل بازگشت: بازگشت شرکت فعال به حالت کارخانه اجرا شود؟'))return;
    const target=new Set(candidates.map(([c,r])=>c+'|'+r.id));for(const coll of COLLS){if(FACTORY_PRESERVE.has(coll))continue;datastore[coll]=(datastore[coll]||[]).filter(r=>!target.has(coll+'|'+r.id));}
    company.accountingTemplate='';company.accountingTemplateVersion=0;company.activityType='';const s=getMySettings();s.default_company_id=company.id;saveDatastore();refreshAllSurfaces();
    alert('داده‌های شرکت ریست شد. خود شرکت حفظ شده است. اکنون نوع فعالیت و کدینگ پیشنهادی را دوباره انتخاب کنید.');if(typeof navigateShell==='function')navigateShell('settings','view-settings','company');
  };
  function installFactoryResetCard(){
    const root=$('view-data-center')||$('view-settings');if(!root||$('finora-factory-reset-card'))return;const card=document.createElement('div');card.id='finora-factory-reset-card';card.className='card no-print';
    card.innerHTML='<h3 style="font-size:15px;color:#991b1b">بازگشت داده‌های شرکت به حالت کارخانه</h3><p class="af-hint">خود شرکت، حساب ورود و دسترسی‌ها حذف نمی‌شوند. فقط داده‌های عملیاتی شرکت فعال پاک می‌شوند و راه‌اندازی نوع فعالیت/کدینگ از ابتدا انجام می‌شود. قبل از اجرا از بخش پشتیبان‌گیری خروجی بگیرید.</p><button type="button" class="btn btn-danger" onclick="finoraFactoryResetSelectedCompany()">ریست داده‌های شرکت فعال</button>';root.appendChild(card);
  }
  const oldRefresh=window.refreshAllSurfaces;window.refreshAllSurfaces=function(){oldRefresh.apply(this,arguments);try{installUnifiedInvoiceControls();installTemplateButtons();installFactoryResetCard();}catch(e){console.error('commercial-rnd',e);}};
  document.addEventListener('DOMContentLoaded',()=>{installUnifiedInvoiceControls();installTemplateButtons();installFactoryResetCard();});setTimeout(()=>{installUnifiedInvoiceControls();installTemplateButtons();installFactoryResetCard();},0);
})();