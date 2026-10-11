const {test,expect}=require('@playwright/test');
const PRINT_QA_BASE_URL=process.env.FINORA_TEST_BASE_URL||'http://127.0.0.1:4173/';

test('Taxpayer System print follows the approved official landscape structure',async({page})=>{
  await page.goto(PRINT_QA_BASE_URL);
  await page.waitForFunction(()=>typeof window.buildElectronicDocPage==='function'&&document.querySelector('script[src*="taxpayer-print.js"]'));
  const html=await page.evaluate(()=>window.buildElectronicDocPage(
    {number:'140507',date:'1405/07/08',createdAt:'1405/07/08 08:36:02',items:[{prodName:'اجاره خودروهای سواری/اجاره و تامین خودرو با راننده',qty:1,unit:'ماه',price:31033548841,lineTotal:31033548841}],vat:3103354884,vatRate:10,grandTotal:34136903725,paymentMethod:'cash'},
    {uniqueNumber:'A2EAG40...47C7',taxNumber:'000000047C',issueDateTime:'1405/07/08 08:36:02',insertDateTime:'1405/07/08 08:36:02',registerDateTime:'1405/07/08 08:39:09',internalInvoiceNumber:'140507',kind:'نوع اول',pattern:'قرارداد پیمانکاری',contractId:'205108734859',items:[{internalId:'8700001705452',officialId:'2330004169617'}]},
    {name:'زرین مهر کوهرنگ',economic_code:'10860921396',national_id:'10860921396',postal_code:'6173663446',branch_code:'0000'},
    {name:'مهدی جمشیدی دانا',economic_code:'10101918813',national_id:'10101918813',postal_code:'1967917661',branch_code:'0000'}
  ));
  expect(html).toContain('taxpayer-official-sheet');
  expect(html).toContain('تاریخ و زمان درج صورتحساب در کارپوشه');
  expect(html).toContain('مشخصات فروشنده');
  expect(html).toContain('مشخصات خریدار');
  expect(html).toContain('شناسه کالا/خدمت داخلی');
  expect(html).toContain('شناسه کالا/خدمت');
  expect(html).toContain('مالیات موضوع ماده 17');
  expect(html).toContain('روش تسویه');
  expect(html).toContain('سازمان امور مالیاتی کشور');
  expect(html).toContain('205108734859');
  expect(html).not.toContain('مطابق استاندارد سامانه مودیان');
  await page.setContent(await page.evaluate(html=>buildIsolatedPrintDocument(html,{paper:'A4',orientation:'landscape',widthMm:297,heightMm:210,marginMm:7}),html));
  const logo=page.locator('.tax-logo-slot img');
  await expect(logo).toHaveCount(1);
  await expect(logo).toHaveAttribute('src',/assets\/tax-organization-official.png$/);
  await expect.poll(()=>logo.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  const table=await page.locator('.items-table').boundingBox(),mark=await logo.boundingBox(),settle=await page.locator('.settle').boundingBox();
  expect(mark.y).toBeGreaterThanOrEqual(table.y+table.height);
  expect(mark.x+mark.width).toBeLessThan(settle.x);
  expect(await page.locator('.final-grid .tax-logo-slot').count()).toBe(0);
  expect((await page.locator('.final-grid').boundingBox()).height).toBeLessThan(55);
  await expect(page.locator('.items-table tbody tr').first()).toContainText('۳۴,۱۳۶,۹۰۳,۷۲۵');
  await expect(page.locator('.items-table tbody tr').first()).toContainText('۱.۰۰');
  await expect(page.locator('.seller-contract')).toContainText('۲۰۵۱۰۸۷۳۴۸۵۹');
  expect((await page.locator('.amount-words').textContent()).match(/ریال/g)).toHaveLength(1);
  expect(await page.locator('.taxpayer-official-sheet').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.screenshot({path:'test-results/taxpayer-reference.png',fullPage:true});
  const {PDFDocument}=require('pdf-lib');
  const pdf=await PDFDocument.load(await page.pdf({preferCSSPageSize:true}));
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getWidth()).toBeGreaterThan(pdf.getPage(0).getHeight());
});

test('isolated print waits for the supplied image before opening print',async({page})=>{
  await page.goto(PRINT_QA_BASE_URL);
  await page.waitForFunction(()=>typeof printIsolatedDocument==='function');
  let release;
  const gate=new Promise(resolve=>release=resolve);
  await page.route('**/assets/tax-organization-official.png?delayed',async route=>{await gate;await route.continue();});
  await page.evaluate(()=>{
    window.printCalls=0;
    const frame=printIsolatedDocument('<img src="'+new URL('assets/tax-organization-official.png?delayed',document.baseURI).href+'">',{paper:'A4',orientation:'landscape',widthMm:297,heightMm:210,marginMm:7});
    frame.contentWindow.print=()=>window.printCalls++;
  });
  // Deliberately hold image response beyond the old 80ms print timer.
  await page.waitForTimeout(200);
  expect(await page.evaluate(()=>window.printCalls)).toBe(0);
  release();
  await expect.poll(()=>page.evaluate(()=>window.printCalls)).toBe(1);
});


test('all visible invoice print digits are Persian across formal, informal and taxpayer templates without mutating data',async({page})=>{
 await page.goto(PRINT_QA_BASE_URL);
 await page.waitForFunction(()=>typeof buildFormalPage==='function'&&typeof buildNonFormalPage==='function'&&typeof buildElectronicDocPage==='function'&&typeof stageInvoicePrint==='function');
 const results=await page.evaluate(()=>{
   window.__FINORA_PRINT_TEST_MODE=true;
   const seller={name:'شرکت نمونه 12',phone:'09123456789',national_id:'0012345678',postal_code:'1234567890'};
   const buyer={name:'خریدار نمونه 2',mobile:'٠٩١٢٣٤٥٦٧٨٩',economic_code:'123456789'};
   const original={number:'PINV-31',date:'۱۴۰5/٠۷/19',id:'TAX12A340'};
   const inv={...original,kind:'formal',items:[{prodName:'کالا 2',unit:'عدد',qty:2,price:12500,lineTotal:25000}],subtotal:25000,discount:0,vat:2500,vatRate:10,grandTotal:27500};
   const row={rowNo:1,prodName:'کالا 2',unit:'عدد',qty:2,price:12500,lineSubtotal:25000,lineDiscount:0,lineVat:2500,lineNet:27500};
   const option={pageNum:1,totalPages:1,isFirstPage:true,isLastPage:true,cumulativeSubtotal:25000,cumulativeDiscount:0,cumulativeVat:2500,cumulativeNet:27500};
   const spec={paper:'A4',orientation:'landscape',widthMm:297,heightMm:210,marginMm:7};
   const cases={
     formal:buildFormalPage([row],seller,buyer,inv,option),
     informal:buildNonFormalPage([row],seller,buyer,{...inv,kind:'non_formal'},option),
     taxpayer:buildElectronicDocPage(inv,{uniqueNumber:original.id,issueDateTime:original.date+' 08:30:59',internalInvoiceNumber:original.number,items:[{internalId:'2030123',officialId:'2099901'}]},seller,buyer)
   };
   const visibleText=root=>{
     const walker=(root.ownerDocument||document).createTreeWalker(root,NodeFilter.SHOW_TEXT);
     let node,output='';
     while((node=walker.nextNode()))if(node.parentElement&&!/^(SCRIPT|STYLE|NOSCRIPT)$/i.test(node.parentElement.tagName))output+=node.nodeValue;
     return output;
   };
   const checks={};
   for(const [kind,html] of Object.entries(cases)){
     const frame=stageInvoicePrint(html,spec);
     const root=frame.contentDocument.getElementById('finora-print-document');
     const preview=document.getElementById('printable-invoice');
     const text=visibleText(root),previewText=preview?visibleText(preview):text;
     checks[kind]={asciiDigits:/[0-9٠-٩]/.test(text),previewAsciiDigits:/[0-9٠-٩]/.test(previewText),
       persianNumber:text.includes('PINV-۳۱'),persianDate:text.includes('۱۴۰۵/۰۷/۱۹'),
       persianTotal:text.includes('۲۷٬۵۰۰')||text.includes('۲۷,۵۰۰'),
       restoredSource:inv.number==='PINV-31'&&inv.date==='۱۴۰5/٠۷/19'&&inv.grandTotal===27500};
   }
   const sample='<div data-code="TAX12A340" title="1405"><span>شماره TAX12A340، تاریخ ۱۴۰5/٠۷/19</span></div>';
   const localized=localizePrintHtmlDigits(sample);
   const sampleTemplate=document.createElement('template');sampleTemplate.innerHTML=localized;
   const el=sampleTemplate.content.querySelector('div');
   checks.attributes={title:el.getAttribute('title'),id:el.getAttribute('data-code'),text:el.textContent};
   return checks;
 });
 for(const [key,v] of Object.entries(results)){
   if(key==='attributes')continue;
   expect(v.asciiDigits,key+' ascii digits').toBe(false);
   expect(v.previewAsciiDigits,key+' preview ascii digits').toBe(false);
   expect(v.persianNumber,key+' invoice number').toBe(true);
   expect(v.persianDate,key+' invoice date').toBe(true);
   expect(v.persianTotal,key+' total').toBe(true);
   expect(v.restoredSource,key+' source unchanged').toBe(true);
 }
 expect(results.attributes).toEqual({title:'1405',id:'TAX12A340',text:'شماره TAX۱۲A۳۴۰، تاریخ ۱۴۰۵/۰۷/۱۹'});
});


test('purchase print popup displays Persian digits while keeping purchase master data untouched',async({page})=>{
 await page.goto(PRINT_QA_BASE_URL);
 await page.waitForFunction(()=>typeof window.purPrint==='function'&&typeof localizePrintTextNodes==='function');
 const actual=await page.evaluate(()=>{
   const userId='PRINT_QA_ONLY';
   currentUser={id:userId};
   const purchase={id:'QA-PUR-1',ownerUserId:userId,number:'BUY-14A90',date:'۱۴۰5/٠۷/19',
     supplierName:'فروشنده 12',contractNumber:'CON-04',projectName:'پروژه 12',
     paymentMethod:'cash',items:[{prodName:'سیمان تیپ 2',unit:'کیسه',qty:3,price:25000,lineTotal:75000}],
     subtotal:75000,discount:0,vat:0,grandTotal:75000,description:'تحویل 3 کیسه'};
   datastore.purchases=[purchase];
   const oldOpen=window.open;
   let popupDoc;
   window.open=()=>{
     popupDoc=document.implementation.createHTMLDocument('purchase print QA');
     return {document:popupDoc};
   };
   try{window.purPrint(purchase.id)}finally{window.open=oldOpen}
   const walker=popupDoc.createTreeWalker(popupDoc.body,NodeFilter.SHOW_TEXT);let node,text='';
   while((node=walker.nextNode()))if(node.parentElement&&!/^(STYLE|SCRIPT)$/i.test(node.parentElement.tagName))text+=node.nodeValue;
   return {text,originalNumber:purchase.number,originalDate:purchase.date,total:purchase.grandTotal};
 });
 expect(actual.text).toContain('BUY-۱۴A۹۰');
 expect(actual.text).toContain('۱۴۰۵/۰۷/۱۹');
 expect(actual.text).toContain('۷۵٬۰۰۰');
 expect(actual.text).not.toMatch(/[0-9٠-٩]/);
 expect(actual.originalNumber).toBe('BUY-14A90');
 expect(actual.originalDate).toBe('۱۴۰5/٠۷/19');
 expect(actual.total).toBe(75000);
});
