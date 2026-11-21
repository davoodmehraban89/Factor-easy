const {test,expect}=require('@playwright/test');
const BASE=process.env.FINORA_TEST_BASE_URL||'http://127.0.0.1:4173/index.html';
async function openCommerce(page,kind='non_formal'){
 await page.route(/https:\/\/[^/]*supabase\.co\//,r=>r.abort());
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.FinoraStartupStatus?.extensionsReady&&window.FinoraStartupStatus?.authChecked&&!window.FinoraStartupStatus?.failedExtensionCount);
 await page.evaluate(()=>Promise.all([window.FinoraAppAssetsReady,window.FinoraOrganizationContextReady]));
 await page.evaluate(async kind=>{
  window.alert=()=>{};window.confirm=()=>false;maybeMigrateLegacyData=()=>{};
  fetchCurrentUser=async()=>({id:'COMMERCE_QA',organizationId:'QA_ORG',fullName:'QA',role:'admin',modules:['full_suite'],subscription:{type:'lifetime',status:'active',endDate:'2099-01-01'}});
  const rows=[{collection:'companies',id:'CO',data:{name:'شرکت آزمون'},version:1},{collection:'settings',id:'main',data:{default_company_id:'CO',invoice_kind:kind,currency_mode:'rial',user_display_name:'QA',professional_role:'accountant'},version:1}];
  window.qaCommerceMembershipRevoked=false;
  // This authorized-user fixture must respond to the real membership guard.
  // An inert query builder is treated as an empty membership list and revokes
  // the mock session after revalidation, masking the commerce assertions.
  sb.from=collection=>collection==='organization_members'
   ? {select:()=>{const filters={};return {
      eq(field,value){filters[field]=value;return this},
      then(resolve,reject){
       const allowed=!window.qaCommerceMembershipRevoked&&filters.user_id===currentUser?.id&&filters.status==='active';
       return Promise.resolve({data:allowed?[{id:'QA_COMMERCE_MEMBER',organization_id:'QA_ORG',status:'active'}]:[],error:null}).then(resolve,reject);
      }
     }}}
   : {select:()=>({eq(){return this},order(){return this},async range(){return {data:rows,error:null}}})};
  sb.rpc=async(name,args)=>{if(name!=='finora_sync_records_v2')throw Error('Unexpected RPC '+name);return {data:{upserts:(args.p_upserts||[]).map(row=>({collection:row.collection,id:row.id,version:Number(row.expected_version||0)+1})),deletes:(args.p_deletes||[]).map(row=>({collection:row.collection,id:row.id}))},error:null};};
  await enterApp({id:'COMMERCE_QA'});
   const authState={display:getComputedStyle(document.getElementById('auth-screen')).display,status:document.getElementById('auth-login-status')?.textContent||'',userId:currentUser?.id||null,startup:window.FinoraStartupStatus};
   if(authState.display!=='none')throw new Error('QA_ENTER_APP_FAILED '+JSON.stringify(authState));
 },kind);
 await expect(page.locator('#auth-screen')).toBeHidden();
 expect(await page.evaluate(()=>window.revalidateFinoraMembership({sensitive:true}))).toBe(true);
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
test('revoked organization membership still locks and clears the commerce session',async({page})=>{
 await openCommerce(page);
 await page.evaluate(()=>{window.qaCommerceMembershipRevoked=true;sb.auth.signOut=async()=>({error:null});});
 expect(await page.evaluate(()=>window.revalidateFinoraMembership({sensitive:true}))).toBe(false);
 await expect(page.locator('#finora-membership-lock.active')).toBeVisible();
 expect(await page.evaluate(()=>currentUser===null)).toBe(true);
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
