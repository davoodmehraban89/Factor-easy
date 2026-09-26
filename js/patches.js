(function(){
  const oldSave = window.commitSaveInvoice;
  window.commitSaveInvoice = function(){
    const rows = document.querySelectorAll('#invoice-items-table-body tr');
    if(!rows.length){ alert('حداقل یک ردیف کالا یا خدمت لازم است.'); return; }
    for(const row of rows){
      const sel = row.querySelector('.row-product-select');
      if(sel && !sel.value){ alert('لطفاً شرح کالا یا خدمت را از لیست انتخاب کنید.'); return; }
      const qty = parseFloat(row.querySelector('.row-quantity')?.value) || 0;
      if(qty <= 0){ alert('مقدار کالا باید بزرگتر از صفر باشد.'); return; }
    }
    if(typeof oldSave === 'function') return oldSave();
  };
  window.FinoraHealth = {
    version: '7.0-finora',
    storage: 'supabase',
    checks(){ return { rtl: document.documentElement.dir === 'rtl', storage: !!window.localStorage, printReady: !!document.getElementById('printable-invoice') }; }
  };
})();
