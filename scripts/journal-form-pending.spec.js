const {test,expect}=require('@playwright/test');
const BASE=process.env.FINORA_TEST_BASE_URL||'http://127.0.0.1:4173/index.html';
test.setTimeout(30000);
async function fixture(page){
 await page.route(/https:\/\/[^/]*supabase\.co\//,r=>r.abort());
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.FinoraStartupStatus?.extensionsReady&&window.FinoraStartupStatus?.authChecked);
 await page.evaluate(()=>{
  currentUser={id:'QA_OWNER',organizationId:'QA_ORG',role:'user',isOrganizationOwner:true};
  window.__company='CO_A';afCompanyId=()=>window.__company;
  getMyAccounts=()=>[{id:'ACC_A',code:'100',title:'حساب اول',active:true,postingAllowed:true},{id:'ACC_B',code:'200',title:'حساب دوم',active:true,postingAllowed:true}];
  jeRulesForAccount=()=>[];window.__calls=[];window.__alerts=[];window.alert=x=>window.__alerts.push(x);renderJournal=()=>{};
  jeRpcCreateDraft=input=>new Promise(resolve=>{window.__calls.push({kind:'create',input});window.__finish=()=>resolve({id:'JV_SAVED',status:'draft',companyId:'CO_A',version:1});});
  jeRpcUpdateDraft=(id,input)=>new Promise(resolve=>{window.__calls.push({kind:'update',id,input});window.__finish=()=>resolve({id,status:'draft',companyId:'CO_A',version:2});});
  ensureJournalView();document.getElementById('auth-screen').style.display='none';
  document.querySelectorAll('.view-pane').forEach(el=>el.classList.remove('active'));
  document.getElementById('view-journal').classList.add('active');jeClearManualForm();
 });
 await page.locator('#je-date').fill('1405/08/30');await page.locator('#je-desc').fill('نسخه ارسال‌شده');
 await page.locator('.je-line .je-account').nth(0).selectOption('ACC_A');await page.locator('.je-line .je-account').nth(1).selectOption('ACC_B');
 await page.locator('.je-debit').nth(0).fill('100');await page.locator('.je-credit').nth(1).fill('100');
}
test('manual Save retains newer input and next click updates the same created draft',async({page})=>{
 await fixture(page);await page.locator('#je-save-draft-button').click();await expect.poll(()=>page.evaluate(()=>window.__calls.length)).toBe(1);
 await page.locator('#je-desc').fill('تغییر جدید و ذخیره‌نشده');await page.locator('.je-debit').nth(0).fill('150');await page.locator('.je-credit').nth(1).fill('150');
 await page.evaluate(()=>window.__finish());await expect(page.locator('#je-edit-voucher-id')).toHaveValue('JV_SAVED');
 await expect(page.locator('#je-desc')).toHaveValue('تغییر جدید و ذخیره‌نشده');await expect(page.locator('.je-debit').nth(0)).toHaveValue('150');
 expect(await page.evaluate(()=>window.__alerts.at(-1))).toContain('ذخیره نشده');
 await page.locator('#je-save-draft-button').click();expect(await page.evaluate(()=>window.__calls.map(x=>[x.kind,x.id||null]))).toEqual([['create',null],['update','JV_SAVED']]);
 await page.evaluate(()=>window.__finish());await expect(page.locator('#je-desc')).toHaveValue('');await expect(page.locator('#je-edit-voucher-id')).toHaveValue('');
});
test('manual Save completion after company switch does not clear or report into another company',async({page})=>{
 await fixture(page);await page.locator('#je-save-draft-button').click();await expect.poll(()=>page.evaluate(()=>window.__calls.length)).toBe(1);
 await page.evaluate(()=>{window.__company='CO_B'});await page.locator('#je-desc').fill('فرم شرکت جدید');await page.evaluate(()=>window.__finish());
 await expect(page.locator('#je-desc')).toHaveValue('فرم شرکت جدید');await expect(page.locator('#je-edit-voucher-id')).toHaveValue('');expect(await page.evaluate(()=>window.__alerts)).toEqual([]);
});
