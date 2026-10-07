const {test,expect}=require('@playwright/test');

test('Taxpayer System print follows the approved official landscape structure',async({page})=>{
  await page.goto('http://127.0.0.1:4173/');
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
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForFunction(()=>typeof printIsolatedDocument==='function');
  let release;
  const gate=new Promise(resolve=>release=resolve);
  await page.route('**/assets/tax-organization-official.png?delayed',async route=>{await gate;await route.continue();});
  await page.evaluate(()=>{
    window.printCalls=0;
    const frame=printIsolatedDocument('<img src="http://127.0.0.1:4173/assets/tax-organization-official.png?delayed">',{paper:'A4',orientation:'landscape',widthMm:297,heightMm:210,marginMm:7});
    frame.contentWindow.print=()=>window.printCalls++;
  });
  // Deliberately hold image response beyond the old 80ms print timer.
  await page.waitForTimeout(200);
  expect(await page.evaluate(()=>window.printCalls)).toBe(0);
  release();
  await expect.poll(()=>page.evaluate(()=>window.printCalls)).toBe(1);
});
