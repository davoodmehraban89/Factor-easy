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
  expect(html).toContain('مالیات موضوع ماده ۱۷');
  expect(html).toContain('روش تسویه');
  expect(html).toContain('سازمان امور مالیاتی کشور');
  expect(html).toContain('205108734859');
  expect(html).not.toContain('مطابق استاندارد سامانه مودیان');
});
