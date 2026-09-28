function buildTaxLogo(){
  return `<svg viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" style=\"width:80px;height:80px\">
    <circle cx=\"50\" cy=\"50\" r=\"46\" fill=\"none\" stroke=\"#1e3a8a\" stroke-width=\"1.5\"/>
    <circle cx=\"50\" cy=\"50\" r=\"38\" fill=\"none\" stroke=\"#1e3a8a\" stroke-width=\"1\"/>
    <rect x=\"30\" y=\"32\" width=\"4\" height=\"36\" fill=\"#1e3a8a\"/>
    <rect x=\"40\" y=\"26\" width=\"4\" height=\"42\" fill=\"#1e3a8a\"/>
    <rect x=\"50\" y=\"22\" width=\"4\" height=\"46\" fill=\"#1e3a8a\"/>
    <rect x=\"60\" y=\"26\" width=\"4\" height=\"42\" fill=\"#1e3a8a\"/>
    <rect x=\"70\" y=\"32\" width=\"4\" height=\"36\" fill=\"#1e3a8a\"/>
    <rect x=\"26\" y=\"20\" width=\"52\" height=\"5\" fill=\"#1e3a8a\" rx=\"1\"/>
    <rect x=\"28\" y=\"66\" width=\"48\" height=\"4\" fill=\"#1e3a8a\" rx=\"1\"/>
    <rect x=\"24\" y=\"72\" width=\"56\" height=\"4\" fill=\"#1e3a8a\" rx=\"1\"/>
  </svg>`;
}
function buildElectronicDocPage(inv,edoc,seller,contact){
  const cur='ریال';
  const items=inv.items;
  const vatRate=(inv.vatRate!==undefined&&inv.vatType!=='fixed')?inv.vatRate:10;

  const itemsRows=items.map((it,idx)=>{
    const line=it.lineTotal;
    const rowVatRate=(inv.vat>0)?vatRate:0;
    const vat=Math.round(line*rowVatRate/100);
    const total=line+vat;
    const edItem=(edoc.items&&edoc.items[idx])?edoc.items[idx]:{};
    return `<tr>
      <td style=\"border:1px solid #000;padding:4px;text-align:center\">${toPersianDigits(idx+1)}</td>
      <td style=\"border:1px solid #000;padding:4px\">${esc(it.prodName||'')}</td>
      <td style=\"border:1px solid #000;padding:4px;text-align:center\">${toPersianDigits(it.qty)}</td>
      <td style=\"border:1px solid #000;padding:4px;text-align:center\">${esc(it.unit||'')}</td>
      <td style=\"border:1px solid #000;padding:4px;text-align:left\">${it.price.toLocaleString('fa-IR')}</td>
      <td style=\"border:1px solid #000;padding:4px;text-align:left\">${line.toLocaleString('fa-IR')}</td>
      <td style=\"border:1px solid #000;padding:4px;text-align:center\">${toPersianDigits(rowVatRate)}٪</td>
      <td style=\"border:1px solid #000;padding:4px;text-align:left\">${vat.toLocaleString('fa-IR')}</td>
      <td style=\"border:1px solid #000;padding:4px;text-align:left\">${total.toLocaleString('fa-IR')}</td>
      <td style=\"border:1px solid #000;padding:4px;text-align:center\">${esc(edItem.internalId||'')}</td>
      <td style=\"border:1px solid #000;padding:4px;text-align:center\">${esc(edItem.officialId||'')}</td>
    </tr>`;
  }).join('');

  let contractText='';
  if(edoc.pattern==='پیمانکاری'&&edoc.contractId){
    contractText=items.map((it,idx)=>
      `+ شناسه یکتای ثبت قرارداد حق‌العمل‌کاری برای ردیف ${toPersianDigits(idx+1)}: ${esc(edoc.contractId)} است`
    ).join('<br>');
  }

  const grandTotal=inv.grandTotal||0;
  const vatTotal=inv.vat||0;
  const baseTotal=grandTotal-vatTotal;

  return `<div class=\"invoice-a4-page landscape\" style=\"background:#fff;padding:6mm 8mm;color:#000;font-family:'Vazirmatn FD',sans-serif;position:relative\">
    <table style=\"width:100%;border-collapse:collapse;margin-bottom:4px\">
      <tr>
        <td style=\"width:20%;vertical-align:top;text-align:center;padding:4px\">${buildTaxLogo()}<div style=\"font-size:9px;color:#1e3a8a;margin-top:2px\">سازمان امور مالیاتی</div></td>
        <td style=\"width:60%;text-align:center;vertical-align:middle;padding:6px\">
          <div style=\"font-size:14px;font-weight:bold;color:#1e3a8a\">صورتحساب الکترونیکی فروش کالا / خدمات</div>
          <div style=\"font-size:9.5px;color:#475569;margin-top:2px\">(مطابق استاندارد سامانه مودیان)</div>
        </td>
        <td style=\"width:20%;vertical-align:top;padding:4px;font-size:9.5px;text-align:left\">
          <div>${esc(seller.name||'')}</div>
          <div style=\"color:#475569\">${esc(seller.phone||'')}</div>
        </td>
      </tr>
    </table>

    <table style=\"width:100%;border-collapse:collapse;border:1px solid #000;font-size:10px;margin-bottom:4px\">
      <tr>
        <td style=\"border:1px solid #000;padding:4px;background:#f1f5f9;width:30%\"><strong>شماره منحصر به فرد صورتحساب الکترونیکی مالیاتی</strong></td>
        <td style=\"border:1px solid #000;padding:4px;width:70%\">${esc(edoc.uniqueNumber||'—')}</td>
      </tr>
      <tr>
        <td style=\"border:1px solid #000;padding:4px;background:#f1f5f9\"><strong>شماره مالیاتی مندرج در برگه تشخیص</strong></td>
        <td style=\"border:1px solid #000;padding:4px\">${esc(edoc.taxNumber||'—')}</td>
      </tr>
      <tr>
        <td style=\"border:1px solid #000;padding:4px;background:#f1f5f9\"><strong>تاریخ و زمان صدور صورتحساب الکترونیکی</strong></td>
        <td style=\"border:1px solid #000;padding:4px\">${esc(edoc.issueDateTime||'—')}</td>
      </tr>
      <tr>
        <td style=\"border:1px solid #000;padding:4px;background:#f1f5f9\"><strong>تاریخ صورتحساب الکترونیکی اصلی</strong></td>
        <td style=\"border:1px solid #000;padding:4px\">${esc(edoc.originalDate||'—')}</td>
      </tr>
      <tr>
        <td style=\"border:1px solid #000;padding:4px;background:#f1f5f9\"><strong>شماره صورتحساب الکترونیکی اصلی</strong></td>
        <td style=\"border:1px solid #000;padding:4px\">${esc(edoc.originalNumber||'—')}</td>
      </tr>
      <tr>
        <td style=\"border:1px solid #000;padding:4px;background:#f1f5f9\"><strong>نوع صورتحساب</strong></td>
        <td style=\"border:1px solid #000;padding:4px\">${esc(edoc.kind||'—')}</td>
      </tr>
      <tr>
        <td style=\"border:1px solid #000;padding:4px;background:#f1f5f9\"><strong>موضوع صورتحساب</strong></td>
        <td style=\"border:1px solid #000;padding:4px\">${esc(edoc.pattern||'—')}</td>
      </tr>
    </table>

    <table style=\"width:100%;border-collapse:collapse;border:1px solid #000;font-size:10px;margin-bottom:4px\">
      <tr><td colspan=\"4\" style=\"border:1px solid #000;padding:4px;background:#f1f5f9;font-weight:bold\">مشخصات فروشنده</td></tr>
      <tr>
        <td style=\"border:1px solid #000;padding:4px;background:#f8fafc;width:15%\">نام شخص</td>
        <td style=\"border:1px solid #000;padding:4px;width:35%\">${esc(seller.name||'—')}</td>
        <td style=\"border:1px solid #000;padding:4px;background:#f8fafc;width:15%\">شماره اقتصادی فروشنده</td>
        <td style=\"border:1px solid #000;padding:4px;width:35%\">${esc(seller.economic_code||'0000')}</td>
      </tr>
      <tr>
        <td style=\"border:1px solid #000;padding:4px;background:#f8fafc\">شماره ثبت / شناسه ملی</td>
        <td style=\"border:1px solid #000;padding:4px\">${esc(seller.national_id||'—')}</td>
        <td style=\"border:1px solid #000;padding:4px;background:#f8fafc\">کد پستی</td>
        <td style=\"border:1px solid #000;padding:4px\">${esc(seller.postal_code||'—')}</td>
      </tr>
    </table>

    <table style=\"width:100%;border-collapse:collapse;border:1px solid #000;font-size:10px;margin-bottom:4px\">
      <tr><td colspan=\"4\" style=\"border:1px solid #000;padding:4px;background:#f1f5f9;font-weight:bold\">مشخصات خریدار</td></tr>
      <tr>
        <td style=\"border:1px solid #000;padding:4px;background:#f8fafc;width:15%\">نام شخص</td>
        <td style=\"border:1px solid #000;padding:4px;width:35%\">${esc(contact.name||inv.contactName)}</td>
        <td style=\"border:1px solid #000;padding:4px;background:#f8fafc;width:15%\">شماره اقتصادی خریدار</td>
        <td style=\"border:1px solid #000;padding:4px;width:35%\">${esc(contact.economic_code||'0000')}</td>
      </tr>
      <tr>
        <td style=\"border:1px solid #000;padding:4px;background:#f8fafc\">شماره ثبت / شناسه ملی</td>
        <td style=\"border:1px solid #000;padding:4px\">${esc(contact.national_id||'—')}</td>
        <td style=\"border:1px solid #000;padding:4px;background:#f8fafc\">کد پستی</td>
        <td style=\"border:1px solid #000;padding:4px\">${esc(contact.postal_code||'—')}</td>
      </tr>
    </table>

    <table style=\"width:100%;border-collapse:collapse;border:1px solid #000;font-size:9.5px\">
      <thead>
        <tr style=\"background:#f1f5f9;font-weight:bold;text-align:center\">
          <th style=\"border:1px solid #000;padding:4px\" rowspan=\"2\">ردیف</th>
          <th style=\"border:1px solid #000;padding:4px\" rowspan=\"2\">شرح کالا/خدمت</th>
          <th style=\"border:1px solid #000;padding:4px\" rowspan=\"2\">تعداد/مقدار</th>
          <th style=\"border:1px solid #000;padding:4px\" rowspan=\"2\">واحد اندازه‌گیری</th>
          <th style=\"border:1px solid #000;padding:4px\" rowspan=\"2\">مبلغ واحد (ریال)</th>
          <th style=\"border:1px solid #000;padding:4px\" rowspan=\"2\">مبلغ کل (ریال)</th>
          <th style=\"border:1px solid #000;padding:4px\" colspan=\"3\">مالیات بر ارزش افزوده</th>
          <th style=\"border:1px solid #000;padding:4px\" rowspan=\"2\">شناسه کالا/خدمت داخلی</th>
          <th style=\"border:1px solid #000;padding:4px\" rowspan=\"2\">شناسه کالا/خدمت</th>
        </tr>
        <tr style=\"background:#f1f5f9;font-weight:bold;text-align:center\">
          <th style=\"border:1px solid #000;padding:4px\">نرخ</th>
          <th style=\"border:1px solid #000;padding:4px\">مبلغ</th>
          <th style=\"border:1px solid #000;padding:4px\">مبلغ کل کالا/خدمت</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>

    <table style=\"width:100%;border-collapse:collapse;border:1px solid #000;font-size:10px;margin-top:6px\">
      <tr>
        <td style=\"border:1px solid #000;padding:4px;background:#f8fafc;width:25%\">جمع کل مبلغ کالا/خدمت</td>
        <td style=\"border:1px solid #000;padding:4px;width:25%;text-align:left\">${baseTotal.toLocaleString('fa-IR')} ${cur}</td>
        <td style=\"border:1px solid #000;padding:4px;background:#f8fafc;width:25%\">جمع کل مالیات بر ارزش افزوده</td>
        <td style=\"border:1px solid #000;padding:4px;width:25%;text-align:left\">${vatTotal.toLocaleString('fa-IR')} ${cur}</td>
      </tr>
      <tr>
        <td style=\"border:1px solid #000;padding:4px;background:#f8fafc\">مبلغ کل صورتحساب</td>
        <td style=\"border:1px solid #000;padding:4px;text-align:left;font-weight:bold\" colspan=\"3\">${grandTotal.toLocaleString('fa-IR')} ${cur}</td>
      </tr>
      <tr>
        <td style=\"border:1px solid #000;padding:4px;background:#f8fafc\">مصرف‌کننده نهایی</td>
        <td style=\"border:1px solid #000;padding:4px\">خیر</td>
        <td style=\"border:1px solid #000;padding:4px;background:#f8fafc\">مالیات موضوع ماده ۱۷</td>
        <td style=\"border:1px solid #000;padding:4px;text-align:left\">۰ ${cur}</td>
      </tr>
    </table>

    ${contractText?`<div style=\"border:1px solid #000;padding:6px;margin-top:6px;font-size:10.5px;line-height:1.7;background:#fffbeb\">${contractText}</div>`:''}

    <table style=\"width:100%;border-collapse:collapse;margin-top:8px;font-size:10.5px\">
      <tr>
        <td style=\"width:50%;border:1px solid #000;padding:8px;height:70px;vertical-align:top\">
          <div style=\"font-weight:bold;margin-bottom:4px\">مهر و امضای فروشنده</div>
          <div style=\"font-size:9.5px;color:#475569\">${esc(seller.name||'')}</div>
        </td>
        <td style=\"width:50%;border:1px solid #000;padding:8px;height:70px;vertical-align:top\">
          <div style=\"font-weight:bold;margin-bottom:4px\">مهر و امضای خریدار</div>
          <div style=\"font-size:9.5px;color:#475569\">${esc(contact.name||inv.contactName)}</div>
        </td>
      </tr>
    </table>
  </div>`;
}

function printElectronicDoc(invId){
  const inv=getMyInvoices().find(i=>i.id===invId);
  if(!inv||!inv.electronicDoc){
    alert('سند الکترونیکی برای این فاکتور ثبت نشده است.');
    return;
  }
  const myCompanies=getMyCompanies();
  const myContacts=getMyContacts();
  const seller=myCompanies.find(c=>c.id===inv.companyId)||myCompanies[0]||{};
  const contact=myContacts.find(c=>c.id===inv.contactId)||{};
  const html=buildElectronicDocPage(inv,inv.electronicDoc,seller,contact);
  let orientationStyle=document.getElementById('dynamic-print-orientation');
  if(!orientationStyle){orientationStyle=document.createElement('style');orientationStyle.id='dynamic-print-orientation';document.head.appendChild(orientationStyle);}
  orientationStyle.innerHTML=`@media print { @page { size: A4 landscape; margin: 8mm 10mm; } }`;
  const printContainer=document.getElementById('printable-invoice');
  printContainer.innerHTML=html;
  printContainer.style.display='block';
  window.print();
  printContainer.style.display='none';
}

// ============ فاکتورهای معمول ============
const FORMAL_ROWS_PER_PAGE=12;
const NONFORMAL_ROWS_PER_PAGE=10;
function computeInvoiceLines(inv){
  const n=inv.items.length;
  const afterDiscountTotal=Math.max(0,(inv.subtotal||0)-(inv.discount||0));
  let usedDiscount=0,usedVat=0;
  return inv.items.map((it,idx)=>{
    const lineSubtotal=it.lineTotal;
    const isLastItem=(idx===n-1);
    let lineDiscount,lineVat;
    if(isLastItem){
      lineDiscount=Math.max(0,(inv.discount||0)-usedDiscount);
      lineVat=Math.max(0,(inv.vat||0)-usedVat);
    }else{
      lineDiscount=(inv.subtotal>0)?Math.round((inv.discount||0)*(lineSubtotal/inv.subtotal)):0;
      const lineAfterDiscount=lineSubtotal-lineDiscount;
      lineVat=(afterDiscountTotal>0&&inv.vat>0)?Math.round((inv.vat||0)*(lineAfterDiscount/afterDiscountTotal)):0;
    }
    usedDiscount+=lineDiscount;usedVat+=lineVat;
    const lineNet=lineSubtotal-lineDiscount+lineVat;
    return {rowNo:idx+1,prodName:it.prodName,qty:it.qty,unit:it.unit||'عدد',price:it.price,lineSubtotal,lineDiscount,lineVat,lineNet};
  });
}
function buildFormalPage(items,seller,contact,inv,opt){
  const cur=inv.currencyLabel||'ریال';
  const isLast=opt.isLastPage;
  const rowsHtml=items.map(li=>`
    <tr style=\"text-align:center\">
      <td style=\"border:1px solid #1e293b;padding:3px 6px;font-size:10.5px\">${li.rowNo.toLocaleString('fa-IR')}</td>
      <td style=\"border:1px solid #1e293b;padding:3px 6px;text-align:right;font-size:10.5px;font-weight:600\">${esc(li.prodName)}</td>
      <td style=\"border:1px solid #1e293b;padding:3px 6px;font-size:10.5px\">${li.qty.toLocaleString('fa-IR')}</td>
      <td style=\"border:1px solid #1e293b;padding:3px 6px;font-size:10.5px\">${esc(li.unit)}</td>
      <td style=\"border:1px solid #1e293b;padding:3px 6px;text-align:left;font-size:10.5px\">${li.price.toLocaleString('fa-IR')}</td>
      <td style=\"border:1px solid #1e293b;padding:3px 6px;text-align:left;font-size:10.5px\">${li.lineSubtotal.toLocaleString('fa-IR')}</td>
      <td style=\"border:1px solid #1e293b;padding:3px 6px;text-align:left;font-size:10.5px\">${li.lineDiscount.toLocaleString('fa-IR')}</td>
      <td style=\"border:1px solid #1e293b;padding:3px 6px;text-align:left;font-size:10.5px\">${li.lineVat.toLocaleString('fa-IR')}</td>
      <td style=\"border:1px solid #1e293b;padding:3px 6px;text-align:left;font-size:10.5px;font-weight:bold\">${li.lineNet.toLocaleString('fa-IR')}</td>
    </tr>`).join('');
  const sellerIds=`${esc(seller.national_id||'—')} / ${esc(seller.reg_number||'—')}`;
  const contactIds=`${esc(contact.national_id||'—')} / ${esc(contact.reg_number||'—')}`;
  const cumSub=opt.cumulativeSubtotal||0;
  const cumDisc=opt.cumulativeDiscount||0;
  const cumVat=opt.cumulativeVat||0;
  const cumNet=opt.cumulativeNet||0;
  const subtotalLabel=isLast?'جمع کل اقلام:':'جمع اقلام تا این صفحه:';
  const discountLabel=isLast?'مجموع تخفیف:':'مجموع تخفیف تا این صفحه:';
  const vatLabel=isLast?'مالیات و عوارض ارزش افزوده:':'مالیات تا این صفحه:';
  const netLabel=isLast?'مبلغ قابل پرداخت:':'جمع تا این صفحه:';
  const wordsLabel=isLast?'مبلغ کل به حروف:':'مبلغ تا این صفحه به حروف:';
  const summaryBox=`
    <table style=\"width:100%;border-collapse:collapse;border:1.5px solid #1e3a8a;font-size:10.5px;margin-top:3px\">
      <tr>
        <td style=\"width:60%;border:1px solid #1e3a8a;padding:6px;vertical-align:top;background:#f8fafc\">
          <div style=\"margin-bottom:4px\"><strong>${wordsLabel}</strong> ${numberToPersianWords(cumNet,cur)}</div>
          ${isLast?`<div style=\"margin-bottom:4px\"><strong>شرایط و نحوه پرداخت:</strong> ${inv.paymentMethod==='credit'?'نقدی ☐ &nbsp;&nbsp;&nbsp; غیرنقدی (نسیه/چک) ☑':'نقدی ☑ &nbsp;&nbsp;&nbsp; غیرنقدی (نسیه/چک) ☐'}</div><div style=\"font-size:9.5px;color:#475569;line-height:1.5\"><strong>توضیحات:</strong> ${esc(inv.description||seller.footer||'تحویل کالا منوط به تسویه نهایی می‌باشد.')}</div>`:`<div style=\"font-size:9.5px;color:#64748b;margin-top:4px\">(ادامه اقلام در صفحه بعد درج گردیده است...)</div>`}
        </td>
        <td style=\"width:40%;border:1px solid #1e3a8a;padding:0\">
          <table style=\"width:100%;border-collapse:collapse;font-size:10.5px\">
            <tr><td style=\"border-bottom:1px solid #cbd5e1;padding:3px 8px\">${subtotalLabel}</td><td style=\"border-bottom:1px solid #cbd5e1;padding:3px 8px;text-align:left\">${cumSub.toLocaleString('fa-IR')} ${cur}</td></tr>
            <tr><td style=\"border-bottom:1px solid #cbd5e1;padding:3px 8px\">${discountLabel}</td><td style=\"border-bottom:1px solid #cbd5e1;padding:3px 8px;text-align:left\">${cumDisc.toLocaleString('fa-IR')} ${cur}</td></tr>
            <tr><td style=\"border-bottom:1px solid #cbd5e1;padding:3px 8px\">${vatLabel}</td><td style=\"border-bottom:1px solid #cbd5e1;padding:3px 8px;text-align:left\">${cumVat.toLocaleString('fa-IR')} ${cur}</td></tr>
            <tr style=\"background:#eff6ff;font-weight:bold;font-size:11.5px;color:#1e3a8a\"><td style=\"padding:5px 8px\">${netLabel}</td><td style=\"padding:5px 8px;text-align:left\">${cumNet.toLocaleString('fa-IR')} ${cur}</td></tr>
          </table>
        </td>
      </tr>
    </table>`;
  const signatures=isLast?`
    <table style=\"width:100%;border-collapse:collapse;border:1px solid #1e3a8a;margin-top:6px;text-align:center;font-size:10.5px\">
      <tr>
        <td style=\"width:50%;height:50px;vertical-align:top;border:1px solid #1e3a8a;padding:5px;background:#fff\"><div style=\"font-weight:bold\">مهر و امضای فروشنده</div></td>
        <td style=\"width:50%;height:50px;vertical-align:top;border:1px solid #1e3a8a;padding:5px;background:#fff\"><div style=\"font-weight:bold\">مهر و امضای خریدار</div></td>
      </tr>
    </table>`:'';
  return `
    <div class=\"invoice-a4-page landscape\" style=\"background:#fff;padding:6mm 8mm;color:#000;font-family:'Vazirmatn FD',sans-serif\">
      <table style=\"width:100%;border-collapse:collapse;margin-bottom:3px\">
        <tr>
          <td style=\"width:28%;padding:5px;vertical-align:middle\"></td>
          <td style=\"width:44%;padding:6px;text-align:center;vertical-align:middle;background:#eff6ff\">
            <h1 style=\"font-size:15px;margin:0;font-weight:bold;color:#1e3a8a\">صورتحساب فروش کالا و خدمات</h1>
          </td>
          <td style=\"width:28%;padding:5px;font-size:10.5px;vertical-align:middle;text-align:left\">
            <div>شماره سریال: <strong style=\"color:#b91c1c\">${esc(inv.number)}</strong></div>
            <div style=\"margin-top:1px\">تاریخ صدور: <strong>${esc(inv.date)}</strong></div>
            <div style=\"margin-top:1px;color:#64748b;font-size:9.5px\">صفحه: ${opt.pageNum} از ${opt.totalPages}</div>
          </td>
        </tr>
      </table>
      <table style=\"width:100%;border-collapse:collapse;border:1.5px solid #1e3a8a;font-size:10px;margin-bottom:3px\">
        <tr style=\"background:#f8fafc;font-weight:bold\"><td colspan=\"4\" style=\"border:1px solid #1e3a8a;padding:2px 6px;color:#1e3a8a\">مشخصات فروشنده</td></tr>
        <tr>
          <td style=\"border:1px solid #cbd5e1;padding:3px 6px;width:15%;background:#f1f5f9\">نام شخص حقیقی/حقوقی:</td>
          <td style=\"border:1px solid #cbd5e1;padding:3px 6px;width:35%\"><strong>${esc(seller.name||'—')}</strong></td>
          <td style=\"border:1px solid #cbd5e1;padding:3px 6px;width:15%;background:#f1f5f9\">شماره اقتصادی:</td>
          <td style=\"border:1px solid #cbd5e1;padding:3px 6px;width:35%\">${esc(seller.economic_code||'—')}</td>
        </tr>
        <tr>
          <td style=\"border:1px solid #cbd5e1;padding:3px 6px;background:#f1f5f9\">شناسه ملی / شماره ثبت:</td>
          <td style=\"border:1px solid #cbd5e1;padding:3px 6px\">${sellerIds}</td>
          <td style=\"border:1px solid #cbd5e1;padding:3px 6px;background:#f1f5f9\">کد پستی ۱۰ رقمی:</td>
          <td style=\"border:1px solid #cbd5e1;padding:3px 6px\">${esc(seller.postal_code||'—')}</td>
        </tr>
        <tr>
          <td style=\"border:1px solid #cbd5e1;padding:3px 6px;background:#f1f5f9\">نشانی و تلفن:</td>
          <td colspan=\"3\" style=\"border:1px solid #cbd5e1;padding:3px 6px\">${esc(seller.address||'—')} ${esc(seller.phone?' | تلفن: '+seller.phone:'')}</td>
        </tr>
      </table>
      <table style=\"width:100%;border-collapse:collapse;border:1.5px solid #1e3a8a;font-size:10px;margin-bottom:3px\">
        <tr style=\"background:#f8fafc;font-weight:bold\"><td colspan=\"4\" style=\"border:1px solid #1e3a8a;padding:2px 6px;color:#1e3a8a\">مشخصات خریدار</td></tr>
        <tr>
          <td style=\"border:1px solid #cbd5e1;padding:3px 6px;width:15%;background:#f1f5f9\">نام شخص حقیقی/حقوقی:</td>
          <td style=\"border:1px solid #cbd5e1;padding:3px 6px;width:35%\"><strong>${esc(contact.name||inv.contactName)}</strong></td>
          <td style=\"border:1px solid #cbd5e1;padding:3px 6px;width:15%;background:#f1f5f9\">شماره اقتصادی:</td>
          <td style=\"border:1px solid #cbd5e1;padding:3px 6px;width:35%\">${esc(contact.economic_code||'—')}</td>
        </tr>
        <tr>
          <td style=\"border:1px solid #cbd5e1;padding:3px 6px;background:#f1f5f9\">شناسه ملی / شماره ثبت:</td>
          <td style=\"border:1px solid #cbd5e1;padding:3px 6px\">${contactIds}</td>
          <td style=\"border:1px solid #cbd5e1;padding:3px 6px;background:#f1f5f9\">کد پستی ۱۰ رقمی:</td>
          <td style=\"border:1px solid #cbd5e1;padding:3px 6px\">${esc(contact.postal_code||'—')}</td>
        </tr>
        <tr>
          <td style=\"border:1px solid #cbd5e1;padding:3px 6px;background:#f1f5f9\">نشانی و تلفن:</td>
          <td colspan=\"3\" style=\"border:1px solid #cbd5e1;padding:3px 6px\">${esc(contact.address||'—')} ${esc(contact.mobile?' | تلفن: '+contact.mobile:'')}</td>
        </tr>
      </table>
      <table style=\"width:100%;border-collapse:collapse;border:1.5px solid #1e3a8a;font-size:10px\">
        <thead>
          <tr style=\"background:#1e3a8a;color:#fff;font-weight:bold;text-align:center\">
            <th style=\"border:1px solid #1e3a8a;padding:4px;width:28px\">ردیف</th>
            <th style=\"border:1px solid #1e3a8a;padding:4px 6px;text-align:right\">شرح کالا یا خدمات</th>
            <th style=\"border:1px solid #1e3a8a;padding:4px;width:42px\">تعداد</th>
            <th style=\"border:1px solid #1e3a8a;padding:4px;width:42px\">واحد</th>
            <th style=\"border:1px solid #1e3a8a;padding:4px;width:105px\">مبلغ واحد (${cur})</th>
            <th style=\"border:1px solid #1e3a8a;padding:4px;width:110px\">مبلغ کل (${cur})</th>
            <th style=\"border:1px solid #1e3a8a;padding:4px;width:80px\">تخفیف (${cur})</th>
            <th style=\"border:1px solid #1e3a8a;padding:4px;width:90px\">مالیات (${cur})</th>
            <th style=\"border:1px solid #1e3a8a;padding:4px;width:120px\">مبلغ نهایی (${cur})</th>
          </tr>
        </thead>
        <tbody>
          ${!opt.isFirstPage?`<tr style=\"background:#fef3c7;font-weight:bold;font-size:9.5px\"><td colspan=\"5\" style=\"border:1px solid #1e293b;padding:3px;text-align:left\">نقل از صفحه قبل:</td><td colspan=\"4\" style=\"border:1px solid #1e293b;padding:3px;text-align:left\">${(opt.cumulativeBefore||0).toLocaleString('fa-IR')} ${cur}</td></tr>`:''}
          ${rowsHtml}
        </tbody>
      </table>
      ${summaryBox}
      ${signatures}
    </div>`;
}
function buildNonFormalPage(items,seller,contact,inv,opt){
  const cur=inv.currencyLabel||'ریال';
  const isPre=inv.kind==='pre_invoice';
  const isLast=opt.isLastPage;
  const hasVat=isPre&&inv.vat>0;
  const title=isPre?'پیش‌فاکتور فروش کالا و خدمات':'فاکتور فروش کالا و خدمات';
  const rowsHtml=items.map(li=>hasVat?`
    <tr style=\"text-align:center\">
      <td style=\"border:1px solid #334155;padding:3px 5px;font-size:10px\">${li.rowNo.toLocaleString('fa-IR')}</td>
      <td style=\"border:1px solid #334155;padding:3px 6px;text-align:right;font-size:10px;font-weight:600\">${esc(li.prodName)}</td>
      <td style=\"border:1px solid #334155;padding:3px 5px;font-size:10px\">${esc(li.unit)}</td>
      <td style=\"border:1px solid #334155;padding:3px 5px;font-size:10px\">${li.qty.toLocaleString('fa-IR')}</td>
      <td style=\"border:1px solid #334155;padding:3px 5px;text-align:left;font-size:10px\">${li.price.toLocaleString('fa-IR')}</td>
      <td style=\"border:1px solid #334155;padding:3px 5px;text-align:left;font-size:10px\">${li.lineSubtotal.toLocaleString('fa-IR')}</td>
      <td style=\"border:1px solid #334155;padding:3px 5px;text-align:left;font-size:10px\">${li.lineVat.toLocaleString('fa-IR')}</td>
      <td style=\"border:1px solid #334155;padding:3px 5px;text-align:left;font-size:10px;font-weight:bold\">${li.lineNet.toLocaleString('fa-IR')}</td>
    </tr>`:`
    <tr style=\"text-align:center\">
      <td style=\"border:1px solid #334155;padding:4px 5px;font-size:10.5px\">${li.rowNo.toLocaleString('fa-IR')}</td>
      <td style=\"border:1px solid #334155;padding:4px 8px;text-align:right;font-size:10.5px;font-weight:600\">${esc(li.prodName)}</td>
      <td style=\"border:1px solid #334155;padding:4px 5px;font-size:10.5px\">${esc(li.unit)}</td>
      <td style=\"border:1px solid #334155;padding:4px 5px;font-size:10.5px\">${li.qty.toLocaleString('fa-IR')}</td>
      <td style=\"border:1px solid #334155;padding:4px 5px;text-align:left;font-size:10.5px\">${li.price.toLocaleString('fa-IR')}</td>
      <td style=\"border:1px solid #334155;padding:4px 5px;text-align:left;font-size:10.5px;font-weight:bold\">${li.lineSubtotal.toLocaleString('fa-IR')}</td>
    </tr>`).join('');
  const cumSub=opt.cumulativeSubtotal||0;
  const cumDisc=opt.cumulativeDiscount||0;
  const cumVat=opt.cumulativeVat||0;
  const cumNet=opt.cumulativeNet||0;
  const subtotalLabel=isLast?'قیمت کل اقلام:':'جمع اقلام تا این صفحه:';
  const discountLabel=isLast?'تخفیف:':'تخفیف تا این صفحه:';
  const vatLabel=isLast?'مالیات ارزش افزوده:':'مالیات تا این صفحه:';
  const netLabel=isLast?`مبلغ کل (${cur}):`:'جمع تا این صفحه:';
  const wordsLabel=isLast?'مبلغ به حروف:':'مبلغ تا این صفحه به حروف:';
  const summaryBox=`
    <table style=\"width:100%;border-collapse:collapse;border:1.5px solid #334155;font-size:10.5px;margin-top:5px\">
      <tr>
        <td style=\"width:60%;border:1px solid #334155;padding:6px;vertical-align:top;background:#f8fafc\">
          <div style=\"margin-bottom:4px\"><strong>${wordsLabel}</strong> ${numberToPersianWords(cumNet,cur)}</div>
          ${isLast?`<div style=\"font-size:9.5px;color:#475569;line-height:1.5\"><strong>توضیحات:</strong> ${esc(inv.description||seller.footer||(isPre?'اعتبار پیش‌فاکتور به مدت ۴۸ ساعت می‌باشد.':'از خرید شما سپاسگزاریم.'))}</div>`:`<div style=\"font-size:9.5px;color:#64748b\">(ادامه در صفحه بعد...)</div>`}
        </td>
        <td style=\"width:40%;border:1px solid #334155;padding:0\">
          <table style=\"width:100%;border-collapse:collapse;font-size:10.5px\">
            <tr><td style=\"border-bottom:1px solid #cbd5e1;padding:3px 8px\">${subtotalLabel}</td><td style=\"border-bottom:1px solid #cbd5e1;padding:3px 8px;text-align:left\">${cumSub.toLocaleString('fa-IR')} ${cur}</td></tr>
            ${cumDisc>0||inv.discount>0?`<tr><td style=\"border-bottom:1px solid #cbd5e1;padding:3px 8px\">${discountLabel}</td><td style=\"border-bottom:1px solid #cbd5e1;padding:3px 8px;text-align:left\">${cumDisc.toLocaleString('fa-IR')} ${cur}</td></tr>`:''}
            ${hasVat?`<tr style=\"background:#fffbeb\"><td style=\"border-bottom:1px solid #cbd5e1;padding:3px 8px\"><strong>${vatLabel}</strong></td><td style=\"border-bottom:1px solid #cbd5e1;padding:3px 8px;text-align:left\"><strong>${cumVat.toLocaleString('fa-IR')} ${cur}</strong></td></tr>`:''}
            <tr style=\"background:#f1f5f9;font-weight:bold;font-size:11.5px\"><td style=\"padding:5px 8px\">${netLabel}</td><td style=\"padding:5px 8px;text-align:left\">${cumNet.toLocaleString('fa-IR')} ${cur}</td></tr>
          </table>
        </td>
      </tr>
    </table>`;
  const signatures=isLast?`
    <table style=\"width:100%;border-collapse:collapse;border:1px solid #334155;margin-top:6px;text-align:center;font-size:10.5px\">
      <tr>
        <td style=\"width:50%;height:50px;vertical-align:top;border:1px solid #334155;padding:5px;background:#fff\"><div style=\"font-weight:bold\">مهر و امضای فروشنده</div></td>
        <td style=\"width:50%;height:50px;vertical-align:top;border:1px solid #334155;padding:5px;background:#fff\"><div style=\"font-weight:bold\">مهر و امضای خریدار</div></td>
      </tr>
    </table>`:'';
  return `
    <div class=\"invoice-a4-page landscape\" style=\"background:#fff;padding:7mm 8mm;color:#000;font-family:'Vazirmatn FD',sans-serif\">
      <table style=\"width:100%;border-collapse:collapse;margin-bottom:5px\">
        <tr>
          <td style=\"width:30%;padding:6px;vertical-align:middle\"></td>
          <td style=\"width:40%;padding:6px;text-align:center;vertical-align:middle;background:#f8fafc\">
            <h1 style=\"font-size:15px;margin:0;font-weight:bold;color:#0f172a\">${title}</h1>
          </td>
          <td style=\"width:30%;padding:6px;font-size:10.5px;vertical-align:middle;text-align:left\">
            <div>شماره: <strong style=\"font-size:11.5px\">#${esc(inv.number)}</strong></div>
            <div style=\"margin-top:1px\">تاریخ: <strong>${esc(inv.date)}</strong></div>
            <div style=\"margin-top:1px;color:#64748b;font-size:9.5px\">صفحه: ${opt.pageNum} از ${opt.totalPages}</div>
          </td>
        </tr>
      </table>
      <table style=\"width:100%;border-collapse:collapse;border:1.5px solid #334155;font-size:10.5px;margin-bottom:5px\">
        <tr>
          <td style=\"width:50%;border:1px solid #334155;padding:5px;vertical-align:top;background:#f8fafc\">
            <div style=\"font-weight:bold;color:#334155;margin-bottom:2px\">مشخصات فروشنده:</div>
            <div>نام: <strong>${esc(seller.name||'—')}</strong></div>
            <div>نشانی: ${esc(seller.address||'—')}</div>
            <div>تلفن تماس: ${esc(seller.phone||'—')}</div>
          </td>
          <td style=\"width:50%;border:1px solid #334155;padding:5px;vertical-align:top;background:#f8fafc\">
            <div style=\"font-weight:bold;color:#334155;margin-bottom:2px\">مشخصات خریدار:</div>
            <div>نام: <strong>${esc(contact.name||inv.contactName)}</strong></div>
            <div>نشانی: ${esc(contact.address||'—')}</div>
            <div>تلفن: ${esc(contact.mobile||'—')}</div>
          </td>
        </tr>
      </table>
      <table style=\"width:100%;border-collapse:collapse;border:1.5px solid #334155;font-size:10.5px\">
        <thead>
          <tr style=\"background:#334155;color:#fff;font-weight:bold;text-align:center\">
            <th style=\"border:1px solid #334155;padding:5px 4px;width:32px\">ردیف</th>
            <th style=\"border:1px solid #334155;padding:5px 8px;text-align:right\">شرح کالا | خدمات</th>
            <th style=\"border:1px solid #334155;padding:5px 4px;width:60px\">واحد</th>
            <th style=\"border:1px solid #334155;padding:5px 4px;width:60px\">مقدار</th>
            <th style=\"border:1px solid #334155;padding:5px 4px;width:${hasVat?'110':'150'}px;text-align:left\">قیمت واحد (${cur})</th>
            <th style=\"border:1px solid #334155;padding:5px 4px;width:${hasVat?'120':'170'}px;text-align:left\">قیمت کل (${cur})</th>
            ${hasVat?`<th style=\"border:1px solid #334155;padding:5px 4px;width:110px;text-align:left\">مالیات (${cur})</th><th style=\"border:1px solid #334155;padding:5px 4px;width:130px;text-align:left\">مبلغ نهایی (${cur})</th>`:''}
          </tr>
        </thead>
        <tbody>
          ${!opt.isFirstPage?`<tr style=\"background:#fef3c7;font-weight:bold;font-size:9.5px\"><td colspan=\"${hasVat?6:5}\" style=\"border:1px solid #334155;padding:3px;text-align:left\">نقل از صفحه قبل:</td><td colspan=\"${hasVat?2:1}\" style=\"border:1px solid #334155;padding:3px;text-align:left\">${(opt.cumulativeBefore||0).toLocaleString('fa-IR')} ${cur}</td></tr>`:''}
          ${rowsHtml}
        </tbody>
      </table>
      ${summaryBox}
      ${signatures}
    </div>`;
}
function renderAndPrintDirect(invId){
  const inv=getMyInvoices().find(i=>i.id===invId);
  if(!inv)return;
  const myCompanies=getMyCompanies();
  const myContacts=getMyContacts();
  const seller=myCompanies.find(c=>c.id===inv.companyId)||myCompanies[0]||{};
  const contact=myContacts.find(c=>c.id===inv.contactId)||{};
  const isFormal=(inv.kind==='formal');
  const builder=isFormal?buildFormalPage:buildNonFormalPage;
  const rowsPerPage=isFormal?FORMAL_ROWS_PER_PAGE:NONFORMAL_ROWS_PER_PAGE;
  const allLines=computeInvoiceLines(inv);
  const pageGroups=[];
  let cumulativeSub=0,cumulativeDisc=0,cumulativeVat=0;
  for(let start=0;start<allLines.length;start+=rowsPerPage){
    const pageItems=allLines.slice(start,start+rowsPerPage);
    const isFirstPage=(start===0);
    const isLastPage=(start+rowsPerPage>=allLines.length);
    const pageSub=pageItems.reduce((s,li)=>s+li.lineSubtotal,0);
    const pageDisc=pageItems.reduce((s,li)=>s+li.lineDiscount,0);
    const pageVat=pageItems.reduce((s,li)=>s+li.lineVat,0);
    const cumSubAfter=cumulativeSub+pageSub;
    const cumDiscAfter=cumulativeDisc+pageDisc;
    const cumVatAfter=cumulativeVat+pageVat;
    const cumNetAfter=cumSubAfter-cumDiscAfter+cumVatAfter;
    pageGroups.push({items:pageItems,isFirstPage,isLastPage,cumulativeBefore:cumulativeSub,cumulativeSubtotal:cumSubAfter,cumulativeDiscount:cumDiscAfter,cumulativeVat:cumVatAfter,cumulativeNet:cumNetAfter});
    cumulativeSub=cumSubAfter;cumulativeDisc=cumDiscAfter;cumulativeVat=cumVatAfter;
  }
  const totalPages=pageGroups.length;
  const containerHtml=pageGroups.map((g,idx)=>builder(g.items,seller,contact,inv,{pageNum:idx+1,totalPages,isFirstPage:g.isFirstPage,isLastPage:g.isLastPage,cumulativeBefore:g.cumulativeBefore,cumulativeSubtotal:g.cumulativeSubtotal,cumulativeDiscount:g.cumulativeDiscount,cumulativeVat:g.cumulativeVat,cumulativeNet:g.cumulativeNet})).join('');
  let orientationStyle=document.getElementById('dynamic-print-orientation');
  if(!orientationStyle){orientationStyle=document.createElement('style');orientationStyle.id='dynamic-print-orientation';document.head.appendChild(orientationStyle);}
  orientationStyle.innerHTML=isFormal
    ?`@media print { @page { size: A4 portrait; margin: 5mm; } .invoice-a4-page{max-width:200mm!important;padding:3mm 4mm!important} .invoice-a4-page table{font-size:8.5px!important} .invoice-a4-page td,.invoice-a4-page th{padding:2px 3px!important} }`
    :`@media print { @page { size: A5 landscape; margin: 5mm; } .invoice-a4-page{max-width:200mm!important;padding:3mm 4mm!important} .invoice-a4-page table{font-size:9px!important} .invoice-a4-page td,.invoice-a4-page th{padding:2px 3px!important} }`;
  const printContainer=document.getElementById('printable-invoice');
  printContainer.innerHTML=containerHtml;
  printContainer.style.display='block';
  window.print();
  printContainer.style.display='none';
}
