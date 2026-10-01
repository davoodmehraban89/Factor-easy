(function(){
  function money(v){return Number(v||0).toLocaleString('fa-IR')}
  function txt(v,fallback='—'){return esc(v===undefined||v===null||v===''?fallback:v)}
  function words(v){
    try{
      if(typeof numberToPersianWords==='function')return numberToPersianWords(Math.round(Number(v)||0));
      if(typeof numberToWords==='function')return numberToWords(Math.round(Number(v)||0));
      if(typeof convertNumberToWords==='function')return convertNumberToWords(Math.round(Number(v)||0));
    }catch(_){ }
    return money(v);
  }
  function taxLogo(){return `<div class="tax-org-mark" aria-label="سازمان امور مالیاتی کشور"><svg viewBox="0 0 92 92" xmlns="http://www.w3.org/2000/svg" role="img"><g fill="none" stroke="#111" stroke-width="3.2"><path d="M8 8h26v10H18v16H8zM84 8H58v10h16v16h10zM8 84h26V74H18V58H8zM84 84H58V74h16V58h10z"/><path d="M26 26h40v40H26zM34 34h24v24H34z"/><path d="M8 42h26M58 42h26M42 8v26M42 58v26M50 8v18M50 66v18M8 50h18M66 50h18"/></g><circle cx="46" cy="46" r="7" fill="none" stroke="#111" stroke-width="3"/></svg><div>سازمان امور مالیاتی کشور</div></div>`}
  window.buildTaxLogo=taxLogo;
  window.buildElectronicDocPage=function(inv,edoc,seller,contact){
    inv=inv||{};edoc=edoc||{};seller=seller||{};contact=contact||{};
    const items=Array.isArray(inv.items)?inv.items:[];
    const vatRate=(inv.vatRate!==undefined&&inv.vatType!=='fixed')?Number(inv.vatRate||0):(Number(inv.vat||0)>0?10:0);
    const discountTotal=Math.max(0,Number(inv.discount||inv.fixedDiscount||0));
    const vatTotal=Math.max(0,Number(inv.vat||0));
    const grandTotal=Math.max(0,Number(inv.grandTotal||0));
    const baseTotal=Math.max(0,grandTotal-vatTotal);
    const itemRows=items.map((it,idx)=>{
      const line=Number(it.lineTotal!==undefined?it.lineTotal:(Number(it.qty||0)*Number(it.price||0)));
      const share=baseTotal>0?line/baseTotal:0;
      const rowDiscount=items.length===1?discountTotal:Math.round(discountTotal*share);
      const taxable=Math.max(0,line-rowDiscount);
      const rowVat=items.length===1?vatTotal:Math.round(taxable*vatRate/100);
      const total=taxable+rowVat;
      const ids=(edoc.items&&edoc.items[idx])||{};
      return `<tr>
        <td class="c rowno">${toPersianDigits(idx+1)}</td>
        <td class="c ids"><div>${txt(ids.internalId,'')}</div><div class="id-sep">${txt(ids.officialId,'')}</div></td>
        <td class="desc">${txt(it.prodName,'')}</td>
        <td class="c">${txt(it.unit,'عدد')}</td>
        <td class="c">${toPersianDigits(it.qty||0)}</td>
        <td class="num"><div>${money(it.price)}</div><small>ریال</small></td>
        <td class="num">${money(rowDiscount)}</td>
        <td class="c">${toPersianDigits(vatRate)}</td>
        <td class="num">${money(rowVat)}</td>
        <td class="num strong">${money(total)}</td>
      </tr>`;
    }).join('');
    const contract=(edoc.pattern==='پیمانکاری'||edoc.contractId)?`<div class="contract-note">+ شناسه یکتای ثبت قرارداد حق‌العمل‌کاری برای ردیف ۱: <b>${txt(edoc.contractId,'—')}</b> است</div>`:'';
    const paymentLabel=inv.paymentMethod==='credit'?'نسیه':inv.paymentMethod==='mixed'?'نقد/نسیه':'نقد';
    const cashAmount=inv.paymentMethod==='credit'?0:baseTotal;
    const subject=edoc.subject||edoc.invoiceSubject||'اصلی';
    const typeText=edoc.kind||edoc.invoiceType||'نوع اول';
    const pattern=edoc.pattern||'فروش کالا / خدمات';
    return `<div class="invoice-a4-page taxpayer-official-sheet" dir="rtl">
      <style>
        .taxpayer-official-sheet{background:#fff!important;color:#111!important;padding:4mm 5mm!important;font-family:Tahoma,'Vazirmatn FD',Arial,sans-serif!important;font-size:9px;line-height:1.45;position:relative;direction:rtl}
        .taxpayer-official-sheet *{box-sizing:border-box}.taxpayer-official-sheet .tax-title{text-align:center;font-size:15px;font-weight:800;margin:0 0 4mm}
        .taxpayer-official-sheet .meta{display:grid;grid-template-columns:1fr 1.25fr 1fr;gap:7mm;border-bottom:1px dotted #555;padding-bottom:2mm;margin-bottom:1.5mm;direction:ltr}
        .taxpayer-official-sheet .meta-col{direction:rtl}.taxpayer-official-sheet .kv{display:grid;grid-template-columns:1.35fr 1fr;gap:3mm;min-height:7mm;align-items:center}.taxpayer-official-sheet .kv b{font-weight:700}.taxpayer-official-sheet .ltr{direction:ltr;text-align:left;font-family:Tahoma,Arial,sans-serif}
        .taxpayer-official-sheet .party-title{font-weight:800;border-bottom:1px dotted #555;padding:1mm 0;text-align:right}.taxpayer-official-sheet .party{display:grid;grid-template-columns:1.1fr 1fr 1fr 1.2fr;gap:2mm 6mm;padding:1.5mm 0 2mm;border-bottom:1px dotted #555}.taxpayer-official-sheet .party span{white-space:nowrap}.taxpayer-official-sheet .party .wide{grid-column:span 2}
        .taxpayer-official-sheet .section-label{text-align:right;font-weight:800;padding:1.5mm 0 .8mm}.taxpayer-official-sheet table{width:100%;border-collapse:collapse;table-layout:fixed;direction:rtl;font-size:8.2px}.taxpayer-official-sheet th,.taxpayer-official-sheet td{border:1px solid #333;padding:1.2mm .9mm;vertical-align:middle}.taxpayer-official-sheet th{text-align:center;background:#fff;font-weight:800}.taxpayer-official-sheet .c{text-align:center}.taxpayer-official-sheet .num{text-align:center;direction:ltr}.taxpayer-official-sheet .desc{text-align:right}.taxpayer-official-sheet .strong{font-weight:800}.taxpayer-official-sheet .rowno{width:3.5%}.taxpayer-official-sheet .ids{width:14%}.taxpayer-official-sheet .id-sep{border-top:1px solid #777;margin:1mm -.9mm -1.2mm;padding:1mm .9mm}.taxpayer-official-sheet small{display:block;font-size:7px}.taxpayer-official-sheet .totals td{font-weight:700}.taxpayer-official-sheet .final-grid{display:grid;grid-template-columns:16% 38% 46%;border:1px solid #333;border-top:0;min-height:15mm}.taxpayer-official-sheet .final-grid>div{border-left:1px solid #333;padding:1.4mm}.taxpayer-official-sheet .final-grid>div:last-child{border-left:0}.taxpayer-official-sheet .final-amount{display:grid;grid-template-columns:28% 72%;align-items:center;font-size:9px}.taxpayer-official-sheet .final-amount b{font-size:11px}.taxpayer-official-sheet .settle{width:100%;border-collapse:collapse;font-size:8px}.taxpayer-official-sheet .settle td,.taxpayer-official-sheet .settle th{padding:1mm}.taxpayer-official-sheet .contract-note{padding:2mm 1mm;font-size:9px}.taxpayer-official-sheet .tax-org-mark{width:25mm;text-align:center;font-size:6.5px;line-height:1.2}.taxpayer-official-sheet .tax-org-mark svg{width:22mm;height:22mm;display:block;margin:auto}.taxpayer-official-sheet .bottom{display:flex;align-items:flex-start;justify-content:space-between;margin-top:1mm;direction:ltr}.taxpayer-official-sheet .bottom>*{direction:rtl}.taxpayer-official-sheet .tax-logo-slot{width:30mm;padding-top:1mm}.taxpayer-official-sheet .contract-slot{flex:1;padding:2mm 5mm 0;text-align:center}
      </style>
      <div class="tax-title">صورتحساب الکترونیکی فروش کالا/خدمات</div>
      <div class="meta">
        <div class="meta-col">
          <div class="kv"><b>تاریخ و زمان صدور صورتحساب:</b><span class="ltr">${txt(edoc.issueDateTime||inv.createdAt||inv.date,'')}</span></div>
          <div class="kv"><b>تاریخ و زمان درج صورتحساب در کارپوشه:</b><span class="ltr">${txt(edoc.insertDateTime||edoc.issueDateTime||inv.createdAt||inv.date,'')}</span></div>
          <div class="kv"><b>تاریخ و زمان ثبت صورتحساب:</b><span class="ltr">${txt(edoc.registerDateTime||edoc.issueDateTime||inv.createdAt||inv.date,'')}</span></div>
        </div>
        <div class="meta-col">
          <div class="kv"><b>شماره منحصر به فرد مالیاتی صورتحساب مرجع:</b><span class="ltr">${txt(edoc.referenceUniqueNumber,'')}</span></div>
          <div class="kv"><b>شماره صورتحساب داخلی:</b><span class="ltr">${txt(edoc.internalInvoiceNumber||inv.number,'')}</span></div>
          <div class="kv"><b>موضوع صورتحساب:</b><span>${txt(subject,'اصلی')}</span></div>
        </div>
        <div class="meta-col">
          <div class="kv"><b>شماره منحصر به فرد مالیاتی:</b><span class="ltr">${txt(edoc.uniqueNumber,'')}</span></div>
          <div class="kv"><b>سریال صورتحساب داخلی حافظه مالیاتی:</b><span class="ltr">${txt(edoc.taxNumber||edoc.serialNumber,'')}</span></div>
          <div class="kv"><b>نوع و الگوی صورتحساب:</b><span>${txt(typeText)} - ${txt(pattern)}</span></div>
        </div>
      </div>
      <div class="party-title">مشخصات فروشنده</div>
      <div class="party">
        <span><b>شماره اقتصادی:</b> ${txt(seller.economic_code||seller.economicCode,'')}</span><span><b>شماره/شناسه ملی:</b> ${txt(seller.national_id||seller.nationalId,'')}</span><span><b>کد شعبه:</b> ${txt(seller.branch_code||seller.branchCode,'0000')}</span><span><b>کد پستی:</b> ${txt(seller.postal_code||seller.postalCode,'')}</span>
        <span class="wide"><b>نام شخص حقیقی/حقوقی:</b> ${txt(seller.name,'')}</span><span class="wide"><b>نام بنگاه اقتصادی:</b> ${txt(seller.trade_name||seller.business_name||seller.name,'')}</span>
      </div>
      <div class="party-title">مشخصات خریدار</div>
      <div class="party">
        <span><b>شماره اقتصادی:</b> ${txt(contact.economic_code||contact.economicCode,'')}</span><span><b>شماره/شناسه ملی:</b> ${txt(contact.national_id||contact.nationalId,'')}</span><span><b>کد شعبه:</b> ${txt(contact.branch_code||contact.branchCode,'0000')}</span><span><b>کد پستی:</b> ${txt(contact.postal_code||contact.postalCode,'')}</span>
        <span class="wide"><b>نام شخص حقیقی/حقوقی:</b> ${txt(contact.name||inv.contactName,'')}</span><span class="wide"><b>نام بنگاه اقتصادی:</b> ${txt(contact.trade_name||contact.business_name||contact.name||inv.contactName,'')}</span>
      </div>
      <div class="section-label">مشخصات کالا / خدمت مورد معامله</div>
      <table class="items-table"><thead><tr><th rowspan="2" style="width:3.5%">ردیف</th><th style="width:14%">شناسه کالا/خدمت داخلی</th><th rowspan="2" style="width:23%">شرح کالا/خدمت</th><th rowspan="2" style="width:7%">واحد اندازه‌گیری</th><th rowspan="2" style="width:6%">تعداد/مقدار</th><th style="width:11%">مبلغ واحد (ریال)</th><th rowspan="2" style="width:9%">مبلغ تخفیف</th><th rowspan="2" style="width:6%">نرخ مالیات بر ارزش افزوده</th><th rowspan="2" style="width:10%">مبلغ مالیات بر ارزش افزوده</th><th rowspan="2" style="width:11%">مبلغ کل کالا/خدمت</th></tr><tr><th>شناسه کالا/خدمت</th><th>نوع ارز</th></tr></thead><tbody>${itemRows||'<tr><td colspan="10" class="c">—</td></tr>'}</tbody>
      <tfoot class="totals"><tr><td colspan="6" class="desc">جمع کل</td><td class="num">${money(discountTotal)}</td><td></td><td class="num">${money(vatTotal)}</td><td class="num">${money(grandTotal)}</td></tr></tfoot></table>
      <div class="final-grid"><div class="tax-logo-slot">${taxLogo()}</div><div><div class="c"><b>مالیات موضوع ماده ۱۷</b></div><div class="c" style="font-size:14px;margin-top:2mm">${money(Number(edoc.article17Tax||0))}</div></div><div><div class="final-amount"><b>مبلغ نهایی</b><b class="num">${money(grandTotal)}</b></div><div style="border-top:1px solid #333;margin-top:1.5mm;padding-top:1.5mm;text-align:center">${txt(words(grandTotal),'')} ریال</div></div></div>
      <div class="bottom"><div class="tax-logo-slot"></div><div class="contract-slot">${contract}</div><div style="width:46%"><table class="settle"><tr><th>روش تسویه</th><th>مبلغ پرداختی نقدی بدون احتساب ارزش افزوده</th><th>مبلغ نسیه بدون احتساب ارزش افزوده</th></tr><tr><td class="c">${paymentLabel}</td><td class="num">${money(cashAmount)}</td><td class="num">${money(inv.paymentMethod==='credit'?baseTotal:0)}</td></tr></table></div></div>
    </div>`;
  };
})();
