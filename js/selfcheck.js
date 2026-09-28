(function(){
  function run(){
    const requiredFunctions=['refreshAllSurfaces','commitSaveInvoice','editInvoice','renderAndPrintDirect','purSave','purEdit','purPrint','editContact','editProduct','editCheque','editExpense','manageContactProjects','openContactLedger','commitSavePayment','invoiceOutstanding','purchaseOutstanding','openDashboardDetail'];
    const requiredElements=['view-dashboard','view-invoices','view-products','view-contacts','view-cheques','view-expenses','invoice-items-table-body','invoice-payment-method','contacts-ledger-table-body','printable-invoice'];
    const missingFunctions=requiredFunctions.filter(n=>typeof window[n]!=='function');
    const missingElements=requiredElements.filter(id=>!document.getElementById(id));
    const dataIssues=[];
    if(typeof currentUser!=='undefined'&&currentUser&&typeof datastore!=='undefined'){
      const uid=currentUser.id;
      const contacts=new Set((datastore.contacts||[]).filter(x=>x.ownerUserId===uid).map(x=>x.id));
      const companies=new Set((datastore.companies||[]).filter(x=>x.ownerUserId===uid).map(x=>x.id));
      const products=new Set((datastore.products||[]).filter(x=>x.ownerUserId===uid).map(x=>x.id));
      (datastore.invoices||[]).filter(x=>x.ownerUserId===uid).forEach(i=>{
        if(i.contactId&&!contacts.has(i.contactId))dataIssues.push('فاکتور فروش '+(i.number||i.id)+' به طرف حساب حذف‌شده متصل است.');
        if(i.companyId&&!companies.has(i.companyId))dataIssues.push('فاکتور فروش '+(i.number||i.id)+' به شرکت حذف‌شده متصل است.');
        (i.items||[]).forEach(it=>{if(it.prodId&&!products.has(it.prodId))dataIssues.push('فاکتور فروش '+(i.number||i.id)+' کالای حذف‌شده دارد.');});
      });
      (datastore.purchases||[]).filter(x=>x.ownerUserId===uid).forEach(p=>{
        if(p.supplierId&&!contacts.has(p.supplierId))dataIssues.push('فاکتور خرید '+(p.number||p.id)+' به تأمین‌کننده حذف‌شده متصل است.');
        (p.items||[]).forEach(it=>{if(it.prodId&&!products.has(it.prodId))dataIssues.push('فاکتور خرید '+(p.number||p.id)+' کالای حذف‌شده دارد.');});
      });
    }
    return {ok:missingFunctions.length===0&&missingElements.length===0&&dataIssues.length===0,missingFunctions,missingElements,dataIssues,checkedAt:new Date().toISOString(),version:'8.1-reviewed'};
  }
  const prev=window.FinoraHealth||{};
  window.FinoraHealth=Object.assign(prev,{version:'8.1-reviewed',run});
  document.addEventListener('DOMContentLoaded',()=>{const r=run();if(!r.ok)console.warn('Finora self-check',r);});
})();