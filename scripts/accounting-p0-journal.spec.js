const {test,expect}=require('@playwright/test');
const path=require('node:path');
async function boot(page){
 await page.setContent('<main class="main-surface"></main>');
 await page.addScriptTag({content:`var currentUser={id:'U1'},datastore={journalVouchers:[],journalLines:[],journalLineDimensions:[]};
 function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function parseFormattedNumber(v){return Number(String(v||'').replace(/,/g,''))||0}
 function getJalaliNumeric(){return '1405/07/15'}
 function getMyAccounts(){return [{id:'A1',code:'1102',title:'حساب‌های دریافتنی',postingAllowed:true,active:true},{id:'A2',code:'4101',title:'فروش',postingAllowed:true,active:true}]}
 function getMyDimensionTypes(){return [{id:'D1',title:'طرف حساب',sourceEntity:'contact',active:true}]}
 function afResolvedValues(){return [{id:'C1',title:'مشتری نمونه',postable:true}]}
 function jeRulesForAccount(id){return id==='A1'?[{dimensionTypeId:'D1',applicability:'required'}]:[]}
 function afEnsureAccountingP0Compatibility(){}
 function jeEnsureDefaultProfiles(){}
 function getMyJournalVouchers(){return datastore.journalVouchers}
 function jeTrialBalance(){return []}
 function jeCreateDraft(input){window.lastDraft=input;return {number:input.number||'1'}}
 function jePost(){}
 function jeReverse(){}
 function jeCopyVoucherToDraft(){return {number:'2'}}
 function jeDeleteDraft(){}
 `});
 await page.addScriptTag({path:path.resolve('js/journal-ui.js')});
 await page.evaluate(()=>renderJournal());
}
test('journal P0 renders header controls, live balance and dynamic dimensions',async({page})=>{
 await boot(page);
 await expect(page.locator('#je-number')).toBeVisible();
 await expect(page.locator('#je-reference')).toBeVisible();
 await expect(page.locator('#je-voucher-type')).toBeVisible();
 await expect(page.locator('#je-lines .je-line')).toHaveCount(2);
 const first=page.locator('#je-lines .je-line').first();
 await first.locator('.je-account').selectOption('A1');
 await expect(first.locator('.je-dim[data-type="D1"]')).toBeVisible();
 await first.locator('.je-dim[data-type="D1"]').selectOption('C1');
 await first.locator('.je-debit').fill('1000');
 const second=page.locator('#je-lines .je-line').nth(1);
 await second.locator('.je-account').selectOption('A2');
 await second.locator('.je-credit').fill('1000');
 await expect(page.locator('#je-totals')).toContainText('✓ تراز');
 await first.locator('.je-account-search').fill('دریافتنی');
 expect(await first.locator('.je-account option[value="A2"]').evaluate(o=>o.hidden)).toBe(true);
});
test('journal row copy preserves account, amount and analytic selection',async({page})=>{
 await boot(page);
 const first=page.locator('#je-lines .je-line').first();
 await first.locator('.je-account').selectOption('A1');
 await first.locator('.je-dim[data-type="D1"]').selectOption('C1');
 await first.locator('.je-debit').fill('1250');
 await first.locator('.je-line-desc').fill('شرح ردیف');
 await first.getByTitle('کپی ردیف').click();
 await expect(page.locator('#je-lines .je-line')).toHaveCount(3);
 const copied=page.locator('#je-lines .je-line').nth(2);
 await expect(copied.locator('.je-account')).toHaveValue('A1');
 await expect(copied.locator('.je-debit')).toHaveValue('1250');
 await expect(copied.locator('.je-line-desc')).toHaveValue('شرح ردیف');
 await expect(copied.locator('.je-dim[data-type="D1"]')).toHaveValue('C1');
});
