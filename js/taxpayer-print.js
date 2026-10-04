(function(){
  function money(v){return Number(v||0).toLocaleString('en-US')}
  function txt(v,fallback='—'){return esc(v===undefined||v===null||v===''?fallback:v)}
  function words(v){
    try{
      if(typeof numberToPersianWords==='function')return numberToPersianWords(Math.round(Number(v)||0));
      if(typeof numberToWords==='function')return numberToWords(Math.round(Number(v)||0));
      if(typeof convertNumberToWords==='function')return convertNumberToWords(Math.round(Number(v)||0));
    }catch(_){ }
    return money(v);
  }
  const taxLogoUrl=new URL('assets/tax-organization-official.png',document.baseURI).href;
  function taxLogo(){return `<div class="tax-org-mark"><img src="${esc(taxLogoUrl)}" alt="سازمان امور مالیاتی کشور"></div>`}
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
        <td class="c rowno">${idx+1}</td>
        <td class="c ids"><div>${txt(ids.internalId,'')}</div><div class="id-sep">${txt(ids.officialId,'')}</div></td>
        <td class="desc">${txt(it.prodName,'')}</td>
        <td class="c">${txt(it.unit,'عدد')}</td>
        <td class="c">${Number(it.qty||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:8})}</td>
        <td class="num unit-price"><div>${money(it.price)}</div><small>ریال</small></td>
        <td class="num">${money(rowDiscount)}</td>
        <td class="c">${vatRate}</td>
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
        .taxpayer-official-sheet{background:#fff!important;color:#111!important;padding:7mm 5mm!important;font-family:Tahoma,Arial,sans-serif!important;font-size:10px;line-height:1.5;position:relative;direction:rtl}
        .taxpayer-official-sheet *{box-sizing:border-box}
        .taxpayer-official-sheet .tax-title{text-align:center;font-size:15px;font-weight:800;margin:0 0 2mm}
        .taxpayer-official-sheet .meta{display:grid;grid-template-columns:33% 36% 31%;direction:ltr}
        .taxpayer-official-sheet .meta-col{direction:rtl;min-width:0}
        .taxpayer-official-sheet .kv{display:flex;align-items:center;gap:1.5mm;min-height:7.5mm}
        .taxpayer-official-sheet .kv b{font-weight:700}
        .taxpayer-official-sheet .meta-col:first-child .kv{justify-content:space-between;padding-right:5mm}
        .taxpayer-official-sheet .meta-col:not(:first-child) .kv{justify-content:flex-start}
        .taxpayer-official-sheet .ltr{direction:ltr;unicode-bidi:isolate;font-family:Arial,sans-serif;overflow-wrap:anywhere}
        .taxpayer-official-sheet .party-title{display:flex;align-items:center;font-weight:800;padding:1mm 0;text-align:right}
        .taxpayer-official-sheet .party-title:after{content:"";flex:1;border-top:1px dotted #555;margin-right:1mm}
        .taxpayer-official-sheet .party{display:grid;grid-template-columns:25% 29% 22% 24%;gap:1mm 0;padding:0 0 2mm;border-bottom:1px dotted #555}
        .taxpayer-official-sheet .party span{min-width:0}
        .taxpayer-official-sheet .party .wide{grid-column:span 2}
        .taxpayer-official-sheet .seller-contract{grid-column:1/-1;padding-top:2mm}
        .taxpayer-official-sheet .section-label{text-align:right;font-weight:800;padding:2mm 0 .8mm}
        .taxpayer-official-sheet table{width:100%;border-collapse:collapse;table-layout:fixed;direction:rtl;font-size:9px}
        .taxpayer-official-sheet th,.taxpayer-official-sheet td{border:1px solid #333;padding:1mm .6mm;vertical-align:middle;overflow-wrap:anywhere}
        .taxpayer-official-sheet th{text-align:center;background:#eee;font-weight:400}
        .taxpayer-official-sheet .c{text-align:center}
        .taxpayer-official-sheet .num{text-align:center;direction:ltr}
        .taxpayer-official-sheet .desc{text-align:right}
        .taxpayer-official-sheet .id-sep{border-top:1px solid #333;margin:.5mm -.6mm -1mm;padding:.5mm .6mm}
        .taxpayer-official-sheet .unit-price small{border-top:1px solid #333;margin:.5mm -.6mm -1mm;padding:.5mm .6mm}
        .taxpayer-official-sheet small{display:block;font-size:8px}
        .taxpayer-official-sheet .totals td{background:#f3f3f3}
        .taxpayer-official-sheet .after-table{position:relative;min-height:28mm;padding-top:2mm}
        .taxpayer-official-sheet .final-grid{display:flex;gap:1mm;width:79%;margin-right:0;margin-left:auto}
        .taxpayer-official-sheet .final-amount{display:grid;grid-template-columns:16% 23% 61%;width:73%;border:1px solid #333;min-height:9mm}
        .taxpayer-official-sheet .final-amount>*{padding:1mm .6mm;display:flex;align-items:center;justify-content:center;font-weight:400}
        .taxpayer-official-sheet .final-amount>*+*{border-right:1px solid #333}
        .taxpayer-official-sheet .amount-words{font-size:8px;text-align:center}
        .taxpayer-official-sheet .article17{display:grid;grid-template-columns:48% 52%;width:27%;border:1px solid #333;text-align:center;align-items:stretch}
        .taxpayer-official-sheet .article17>*{padding:1mm;display:flex;align-items:center;justify-content:center}
        .taxpayer-official-sheet .article17>*+*{border-right:1px solid #333}
        .taxpayer-official-sheet .tax-logo-slot{position:absolute;left:0;top:2mm;width:24mm}
        .taxpayer-official-sheet .tax-org-mark img{display:block;width:24mm;height:auto;filter:grayscale(1)}
        .taxpayer-official-sheet .bottom{display:flex;direction:rtl;gap:2mm;align-items:flex-start;margin-top:4mm;margin-left:25mm}
        .taxpayer-official-sheet .settlement-slot{width:35%;flex-shrink:0}
        .taxpayer-official-sheet .settle{font-size:8px}
        .taxpayer-official-sheet .settle td,.taxpayer-official-sheet .settle th{padding:.6mm}
        .taxpayer-official-sheet .contract-slot{flex:1;padding-top:1mm;text-align:right}
        .taxpayer-official-sheet .contract-note{font-size:9px}
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
        ${edoc.contractId?`<span class="seller-contract"><b>شناسه یکتای ثبت قرارداد:</b> ${txt(edoc.contractId)}</span>`:''}
      </div>
      <div class="party-title">مشخصات خریدار</div>
      <div class="party">
        <span><b>شماره اقتصادی:</b> ${txt(contact.economic_code||contact.economicCode,'')}</span><span><b>شماره/شناسه ملی:</b> ${txt(contact.national_id||contact.nationalId,'')}</span><span><b>کد شعبه:</b> ${txt(contact.branch_code||contact.branchCode,'0000')}</span><span><b>کد پستی:</b> ${txt(contact.postal_code||contact.postalCode,'')}</span>
        <span class="wide"><b>نام شخص حقیقی/حقوقی:</b> ${txt(contact.name||inv.contactName,'')}</span><span class="wide"><b>نام بنگاه اقتصادی:</b> ${txt(contact.trade_name||contact.business_name||contact.name||inv.contactName,'')}</span>
      </div>
      <div class="section-label">مشخصات کالا / خدمت مورد معامله</div>
      <table class="items-table"><thead><tr><th rowspan="2" style="width:1.6%">ردیف</th><th style="width:10.6%">شناسه کالا/خدمت داخلی</th><th rowspan="2" style="width:24.4%">شرح کالا/خدمت</th><th rowspan="2" style="width:5.3%">واحد اندازه‌گیری</th><th rowspan="2" style="width:8.8%">تعداد/مقدار</th><th style="width:14.2%">مبلغ واحد (ریال)</th><th rowspan="2" style="width:8.8%">مبلغ تخفیف</th><th rowspan="2" style="width:5.3%">نرخ مالیات بر ارزش افزوده</th><th rowspan="2" style="width:9.7%">مبلغ مالیات بر ارزش افزوده</th><th rowspan="2" style="width:11.3%">مبلغ کل کالا/خدمت</th></tr><tr><th>شناسه کالا/خدمت</th><th>نوع ارز</th></tr></thead><tbody>${itemRows||'<tr><td colspan="10" class="c">—</td></tr>'}</tbody>
      <tfoot class="totals"><tr><td colspan="6" class="desc">جمع کل</td><td class="num">${money(discountTotal)}</td><td></td><td class="num">${money(vatTotal)}</td><td class="num">${money(grandTotal)}</td></tr></tfoot></table>
      <div class="after-table">
        <div class="tax-logo-slot">${taxLogo()}</div>
        <div class="final-grid">
          <div class="final-amount"><span>مبلغ نهایی</span><span class="num">${money(grandTotal)}</span><span class="amount-words">${txt(words(grandTotal).replace(/(?:\s*ریال)+$/,'').trim())} ریال</span></div>
          <div class="article17"><span>مالیات موضوع ماده 17</span><span class="num">${money(Number(edoc.article17Tax||0))}</span></div>
        </div>
        <div class="bottom"><div class="settlement-slot"><table class="settle"><tr><th>روش تسویه</th><th>مبلغ پرداختی نقدی بدون احتساب ارزش افزوده</th><th>مبلغ نسیه بدون احتساب ارزش افزوده</th></tr><tr><td class="c">${paymentLabel}</td><td class="num">${money(cashAmount)}</td><td class="num">${money(inv.paymentMethod==='credit'?baseTotal:0)}</td></tr></table></div><div class="contract-slot">${contract}</div></div>
      </div>
    </div>`;
  };
})();
