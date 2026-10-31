const {test,expect}=require('@playwright/test');
const BASE=process.env.FINORA_TEST_BASE_URL||'http://127.0.0.1:4173/index.html';
async function openCommerce(page,kind='non_formal'){
 await page.route(/https:\/\/[^/]*supabase\.co\//,r=>r.abort());
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.FinoraStartupStatus?.extensionsReady&&window.FinoraStartupStatus?.authChecked&&!window.FinoraStartupStatus?.failedExtensionCount);
 await page.evaluate(async kind=>{
  window.alert=()=>{};window.confirm=()=>false;maybeMigrateLegacyData=()=>{};
  fetchCurrentUser=async()=>({id:'COMMERCE_QA',fullName:'QA',role:'admin',modules:['full_suite'],subscription:{type:'lifetime',status:'active',endDate:'2099-01-01'}});
  const rows=[{collection:'companies',id:'CO',data:{name:'شرکت آزمون'}},{collection:'settings',id:'main',data:{default_company_id:'CO',invoice_kind:kind,currency_mode:'rial',user_display_name:'QA',professional_role:'accountant'}}];
  sb.from=()=>({select:()=>({order(){return this},async range(){return {data:rows,error:null}}})});
  sb.rpc=async()=>({error:null});
  await enterApp({id:'COMMERCE_QA'});
 },kind);
 await expect(page.locator('#auth-screen')).toBeHidden();
 await page.locator('.module-tab[data-module="commerce"]').click();
 await page.locator('#module-panel-links [data-view="view-invoices"]').click();
}
const sale=page=>page.locator('#view-invoices .finora-invoice-type select');
const purchase=page=>page.locator('#view-purchases .finora-invoice-type select');
test('commerce menu routes offer only matching document families and retain unsaved sale fields',async({page})=>{
 await openCommerce(page);
 await expect(sale(page).locator('option')).toHaveText(['فروش','پیش‌فاکتور فروش','صورت‌وضعیت فروش']);
 await page.locator('#invoice-number').fill('UNSAVED-QA');
 await sale(page).selectOption('pre_invoice');
 await expect(page.locator('#invoice-kind')).toHaveValue('pre_invoice');
 await page.locator('#module-panel-links [data-view="view-purchases"]').click();
 await expect(purchase(page).locator('option')).toHaveText(['خرید']);
 await expect(purchase(page)).toHaveValue('purchase');
 await page.locator('#module-panel-links [data-view="view-invoices"]').click();
 await expect(sale(page)).toHaveValue('pre_invoice');
 await expect(page.locator('#invoice-number')).toHaveValue('UNSAVED-QA');
 await expect(page.locator('#workspace-title')).toHaveText('فاکتور فروش');
});
test('sales document selector reflects restored defaults and existing kind changes',async({page})=>{
 await openCommerce(page,'contract_statement');
 await expect(sale(page)).toHaveValue('contract_statement');
 // Existing edit/default/draft restoration paths all invoke this canonical form handler.
 await page.evaluate(()=>{document.getElementById('invoice-kind').value='formal';handleInvoiceKindChange()});
 await expect(sale(page)).toHaveValue('sale');
 await expect(page.locator('#invoice-kind')).toHaveValue('formal');
 await sale(page).selectOption('pre_invoice');
 await expect(page.locator('#invoice-kind')).toHaveValue('pre_invoice');
 await expect(page.locator('#box-invoice-contract-number')).toBeHidden();
 await sale(page).selectOption('contract_statement');
 await expect(page.locator('#invoice-kind')).toHaveValue('contract_statement');
 await expect(page.locator('#box-invoice-contract-number')).toBeVisible();
});
