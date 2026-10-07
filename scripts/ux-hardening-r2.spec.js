const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('UX R2 adds searchable selectors, keyboard close/zeros and settings controls',async({page})=>{
 let opts='';for(let i=0;i<10;i++)opts+='<option value="P'+i+'">کالا '+i+'</option>';
 await page.setContent('<section id="view-settings" class="view-pane"></section><section id="view-invoices" class="view-pane active"><div><select id="big-select">'+opts+'</select></div><input id="money" inputmode="decimal" value="25"></section><div id="m1" class="modal-backdrop active"><button id="mclose">بستن</button></div>');
 await page.addScriptTag({content:"var currentUser={id:'U1'},datastore={settings:[{ownerUserId:'U1',ui_theme:'light',hotkey_ctrl_s:true,hotkey_ctrl_enter:true,hotkey_enter_save:false,hotkey_quick_zeros:true}],products:[],contacts:[],companies:[{id:'C1',ownerUserId:'U1'}],invoices:[],purchases:[],cheques:[],accounts:[],projects:[],journalVouchers:[]};var FINORA_MODULES={settings:{groups:[]}};function getMySettings(){return datastore.settings[0]}function getMyCompanies(){return datastore.companies}function getMyProducts(){return datastore.products}function getMyContacts(){return datastore.contacts}function getMyAccounts(){return datastore.accounts}function getMyGlobalProjects(){return datastore.projects}function requireWrite(){return true}function saveDatastore(){}function toggleAccordion(){}function esc(v){return String(v)}function commitSaveInvoice(){window.saved=(window.saved||0)+1};document.getElementById('mclose').onclick=()=>document.getElementById('m1').classList.remove('active');"});
 await page.addScriptTag({path:path.resolve('js/ux-hardening-r2.js')});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 await expect(page.locator('.finora-select-search')).toHaveCount(1);
 await page.locator('.finora-select-search').fill('کالا 7');
 expect(await page.locator('#big-select option[value="P1"]').evaluate(o=>o.hidden)).toBe(true);
 expect(await page.locator('#big-select option[value="P7"]').evaluate(o=>o.hidden)).toBe(false);
 await page.keyboard.press('Escape');await expect(page.locator('#m1')).not.toHaveClass(/active/);
 await page.locator('#money').focus();await page.keyboard.press('+');await expect(page.locator('#money')).toHaveValue('25000');
 await page.keyboard.press('Control+Enter');expect(await page.evaluate(()=>window.saved||0)).toBe(1);
 await expect(page.locator('#finora-theme-select')).toBeVisible();
 await expect(page.locator('#finora-excel-type')).toBeVisible();
 await expect(page.locator('#finora-data-stats')).toBeVisible();
});
test('counterparty project manager reuses global project master and attaches existing project',async({page})=>{
 await page.setContent('<div></div>');
 await page.addScriptTag({content:"var currentUser={id:'U1'},datastore={projects:[{id:'PR1',ownerUserId:'U1',companyId:'C1',code:'001',name:'الغدیر',linkedContactIds:[],direction:'both',active:true},{id:'PR2',ownerUserId:'U1',companyId:'C1',code:'002',name:'یاس',linkedContactIds:['C1P'],direction:'both',active:true}],contacts:[{id:'C1P',ownerUserId:'U1',name:'مجیدلو',project_mode:'multi',projects:[{id:'LEGACY',name:'نباید مبنا باشد'}]}]};function getMyGlobalProjects(){return datastore.projects}function getMyContacts(){return datastore.contacts}function requireWrite(){return true}function saveDatastore(){}function refreshAllSurfaces(){}function afCompanyId(){return 'C1'}function afNextFloatingCode(){return '31000001'}function esc(v){return String(v)}function confirm(){return true}function prompt(){return null}"});
 await page.addScriptTag({path:path.resolve('js/projects.js')});
 expect(await page.evaluate(()=>getContactProjects('C1P').map(x=>x.id))).toEqual(['PR2']);
 await page.evaluate(()=>openProjectAttachModal('C1P'));
 await expect(page.locator('#project-attach-existing')).toContainText('الغدیر');
 await page.locator('#project-attach-existing').selectOption('PR1');
 await page.evaluate(()=>attachExistingProject());
 expect(await page.evaluate(()=>datastore.projects.find(x=>x.id==='PR1').linkedContactIds.includes('C1P'))).toBe(true);
});

test('factory reset deletes only active-company rows and preserves ambiguous legacy rows in multi-company mode',async({page})=>{
 await page.setContent('<section id="view-data-center"></section><section id="view-settings"></section>');
 await page.addScriptTag({content:"var currentUser={id:'U1',role:'admin'},COLLS=['companies','settings','products','contacts'],datastore={companies:[{id:'C1',ownerUserId:'U1',name:'الف',activityType:'trading',accountingTemplate:{type:'trading'}},{id:'C2',ownerUserId:'U1',name:'ب'}],settings:[{ownerUserId:'U1',default_company_id:'C1'}],products:[{id:'P1',ownerUserId:'U1',companyId:'C1'},{id:'P2',ownerUserId:'U1',companyId:'C2'},{id:'LEG',ownerUserId:'U1'}],contacts:[]};function getMySettings(){return datastore.settings[0]}function getMyCompanies(){return datastore.companies}function requireWrite(){return true}function saveDatastore(){}function refreshAllSurfaces(){}function navigateShell(){}function switchView(){}function openQuickContactModal(){}function alert(){}function prompt(){return 'ریست الف'}function confirm(){return true}"});
 await page.addScriptTag({path:path.resolve('js/commercial-rnd.js')});
 await page.evaluate(()=>finoraFactoryResetSelectedCompany());
 expect(await page.evaluate(()=>datastore.products.map(x=>x.id).sort())).toEqual(['LEG','P2']);
 expect(await page.evaluate(()=>datastore.companies.map(x=>x.id).sort())).toEqual(['C1','C2']);
 expect(await page.evaluate(()=>datastore.companies.find(x=>x.id==='C1').activityType)).toBe('');
});
