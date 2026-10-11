const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('UX R2 adds searchable selectors, keyboard close/zeros and settings controls',async({page})=>{
 let opts='';for(let i=0;i<10;i++)opts+='<option value="P'+i+'">کالا '+i+'</option>';
 await page.setContent('<section id="view-settings" class="view-pane"></section><section id="view-invoices" class="view-pane active"><div><select id="big-select">'+opts+'</select></div><input id="money" inputmode="decimal" value="25"></section><section id="view-purchases" class="view-pane"></section><div id="m1" class="modal-backdrop active"><button id="mclose">بستن</button></div>');
 await page.addScriptTag({content:"var currentUser={id:'U1'},datastore={settings:[{ownerUserId:'U1',ui_theme:'light',hotkey_ctrl_s:true,hotkey_ctrl_enter:true,hotkey_enter_save:false,hotkey_quick_zeros:true}],products:[],contacts:[],companies:[{id:'C1',ownerUserId:'U1'}],invoices:[],purchases:[],cheques:[],accounts:[],projects:[],journalVouchers:[]};var FINORA_MODULES={settings:{groups:[]}};function getMySettings(){return datastore.settings[0]}function getMyCompanies(){return datastore.companies}function getMyProducts(){return datastore.products}function getMyContacts(){return datastore.contacts}function getMyAccounts(){return datastore.accounts}function getMyGlobalProjects(){return datastore.projects}function requireWrite(){return true}function saveDatastore(){}function toggleAccordion(){}function navigateShell(m,v){window.lastNav=m+'|'+v}function switchView(v){window.lastNav='switch|'+v}function esc(v){return String(v)}function commitSaveInvoice(){window.saved=(window.saved||0)+1};document.getElementById('mclose').onclick=()=>document.getElementById('m1').classList.remove('active');"});
 await page.addScriptTag({path:path.resolve('js/ux-hardening-r2.js')});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 await expect(page.locator('.finora-combobox-input')).toHaveCount(1);
 await page.locator('.finora-combobox-input').fill('کالا 7');
 await expect(page.locator('.finora-combobox-list')).toBeVisible();
 await expect(page.locator('.finora-combobox-option')).toHaveCount(1);
 await expect(page.locator('.finora-combobox-option')).toContainText('کالا 7');
 await page.locator('.finora-combobox-option').click();
 expect(await page.locator('#big-select').inputValue()).toBe('P7');
 await page.keyboard.press('Escape');await expect(page.locator('#m1')).not.toHaveClass(/active/);
 await page.locator('#money').focus();await page.keyboard.press('+');await expect(page.locator('#money')).toHaveValue('25000');
 await page.keyboard.press('Control+Enter');expect(await page.evaluate(()=>window.saved||0)).toBe(1);
 await expect(page.locator('#finora-theme-select')).toBeVisible();
 await expect(page.locator('#finora-excel-type')).toBeVisible();
 await expect(page.locator('#finora-data-stats')).toBeVisible();
 await expect(page.locator('.finora-commerce-toolbar')).toHaveCount(0);
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

test('factory reset denies non-manager without touching company data',async({page})=>{
 await page.setContent('<section id="view-data-center"></section><section id="view-settings"></section>');
 await page.addScriptTag({content:"var currentUser={id:'U1',role:'user'},COLLS=['companies','settings','products'],datastore={companies:[{id:'C1',ownerUserId:'U1',name:'الف',activityType:'trading'}],settings:[{ownerUserId:'U1',default_company_id:'C1'}],products:[{id:'P1',ownerUserId:'U1',companyId:'C1'}]};window.finoraCanManageOrganization=()=>false;window.lastAlert='';function getMySettings(){return datastore.settings[0]}function getMyCompanies(){return datastore.companies}function requireWrite(){return true}function saveDatastore(){}function refreshAllSurfaces(){}function navigateShell(){}function switchView(){}function openQuickContactModal(){}function alert(x){window.lastAlert=x}function prompt(){throw new Error('prompt must not run')}function confirm(){throw new Error('confirm must not run')}"});
 await page.addScriptTag({path:path.resolve('js/commercial-rnd.js')});
 await page.evaluate(()=>finoraFactoryResetSelectedCompany());
 expect(await page.evaluate(()=>datastore.products.length)).toBe(1);
 expect(await page.evaluate(()=>window.lastAlert)).toContain('فقط برای مدیر/مالک');
});

test('product combobox searches one field by code, name and specification',async({page})=>{
 await page.setContent('<section id="view-settings"></section><section id="view-invoices" class="view-pane active"><select class="row-product-select" id="product-search"><option value="">انتخاب کالا</option><option value="B10">بلوک سایز ۱۰</option><option value="C3">سیمان تیپ ۲</option></select></section>');
 await page.addScriptTag({content:"var currentUser={id:'U1'},datastore={settings:[{ownerUserId:'U1'}],products:[{id:'B10',code:'BLK-310',name:'بلوک سایز ۱۰',spec:'سبک AAC'},{id:'C3',code:'CEM-003',name:'سیمان تیپ ۲',spec:'پاکتی'}],contacts:[],companies:[{id:'C1',ownerUserId:'U1'}],accounts:[],projects:[],invoices:[],purchases:[],cheques:[],journalVouchers:[]};var FINORA_MODULES={settings:{groups:[]}};function getMySettings(){return datastore.settings[0]}function getMyCompanies(){return datastore.companies}function getMyProducts(){return datastore.products}function getMyContacts(){return datastore.contacts}function getMyAccounts(){return datastore.accounts}function getMyGlobalProjects(){return datastore.projects}function requireWrite(){return true}function saveDatastore(){}function toggleAccordion(){}function esc(v){return String(v)}"});
 await page.addScriptTag({path:path.resolve('js/ux-hardening-r2.js')});await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 const input=page.locator('#product-search').locator('xpath=..').locator('.finora-combobox-input');
 await input.fill('310');await expect(page.locator('body > .finora-combobox-list .finora-combobox-option')).toContainText('بلوک سایز ۱۰');
 await input.fill('AAC');await expect(page.locator('body > .finora-combobox-list .finora-combobox-option')).toContainText('بلوک سایز ۱۰');
 await input.fill('سیمان');await expect(page.locator('body > .finora-combobox-list .finora-combobox-option')).toContainText('سیمان تیپ ۲');
});


test('existing invoice row rehydrates after cloud data arrives, displays an unclipped list and fills price/unit',async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 await page.setContent(`<!doctype html><html lang="fa" dir="rtl"><head><style>
 body{font-family:Tahoma,sans-serif;background:#f8fafc;padding:26px;color:#1e293b}#view-settings,.finora-data-stats{display:none!important}h2{margin:12px 0 16px}
 .invoice-card{border:1px solid #d8e0e8;background:white;border-radius:12px;padding:20px;max-width:1120px}
 .table-clip{overflow:hidden;border:1px solid #d5dae0;border-radius:8px;max-height:130px}
 table{width:100%;border-collapse:collapse;text-align:right}td,th{padding:15px 12px;border-bottom:1px solid #e2e8f0}
 .form-control{width:100%;box-sizing:border-box;height:44px;border:1px solid #b3c1d1;border-radius:7px;padding:9px;text-align:right;font:inherit}
 </style></head><body><section id="view-settings"></section>
 <section id="view-invoices" class="view-pane active"><div class="invoice-card"><h2>صدور سند تجاری — اقلام کالا یا خدمات</h2>
 <p>جستجوی کالا با نام، کد یا مشخصه</p>
 <div class="table-clip"><table><thead><tr><th>شرح کالا / خدمات</th><th>واحد</th><th>قیمت واحد (ریال)</th></tr></thead><tbody><tr>
 <td style="width:65%"><select class="form-control row-product-select" id="rehydrate-product"><option value="">-- انتخاب کالا / خدمات --</option></select></td>
 <td><input id="result-unit" class="form-control" readonly></td><td><input id="result-price" class="form-control" readonly></td>
 </tr></tbody></table></div></div></section></body></html>`);
 await page.addScriptTag({content:`var currentUser={id:'U1'},datastore={settings:[{ownerUserId:'U1',ui_theme:'light'}],products:[],contacts:[],companies:[{id:'C1',ownerUserId:'U1'}],invoices:[],purchases:[],cheques:[],accounts:[],projects:[],journalVouchers:[]};var FINORA_MODULES={settings:{groups:[]}};function getMySettings(){return datastore.settings[0]}function getMyCompanies(){return datastore.companies}function getMyProducts(){return datastore.products.filter(p=>p.ownerUserId===currentUser.id)}function getMyContacts(){return datastore.contacts}function getMyAccounts(){return datastore.accounts}function getMyGlobalProjects(){return datastore.projects}function requireWrite(){return true}function saveDatastore(){}function toggleAccordion(){}function esc(v){return String(v)};document.getElementById('rehydrate-product').addEventListener('change',e=>{const o=e.target.selectedOptions[0];document.getElementById('result-price').value=o.dataset.price||'';document.getElementById('result-unit').value=o.dataset.unit||'';});`});
 await page.addScriptTag({path:path.resolve('js/ux-hardening-r2.js')});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 const input=page.locator('#rehydrate-product').locator('xpath=..').locator('.finora-combobox-input');
 await expect(page.locator('#rehydrate-product option')).toHaveCount(1);
 await page.evaluate(()=>{datastore.products=[
 {id:'B10',ownerUserId:'U1',name:'بلوک سیمانی ۱۰ سانتی',code:'310001',spec:'سبک',unit:'عدد',sale_price:85000},
 {id:'B15',ownerUserId:'U1',name:'بلوک سبک ۱۵ سانتی',code:'310002',spec:'AAC',unit:'عدد',sale_price:110000},
 {id:'C3',ownerUserId:'U1',name:'سیمان تیپ ۲',code:'220003',spec:'پاکتی ۵۰ کیلو',unit:'کیسه',sale_price:150000},
 {id:'Evil',ownerUserId:'OTHER_USER',name:'سیمان محرمانه',code:'555',unit:'عدد',sale_price:1}
 ]});
 await input.click();
 await expect(page.locator('body > .finora-combobox-list')).toBeVisible();
 await expect(page.locator('body > .finora-combobox-list .finora-combobox-option')).toHaveCount(3);
 await input.fill('بلوک');
 await expect(page.locator('body > .finora-combobox-list .finora-combobox-option')).toHaveCount(2);
 await expect(page.locator('body > .finora-combobox-list')).toContainText('بلوک سیمانی');
 if(process.env.FINORA_PRODUCT_SEARCH_SCREENSHOT){
   await page.screenshot({path:process.env.FINORA_PRODUCT_SEARCH_SCREENSHOT+'_block.png',fullPage:false});
 }
 await input.fill('سيــمان'.replace(/ـ/g,''));
 // Both cement and cement-block products legitimately match the shared word.
 await expect(page.locator('body > .finora-combobox-list .finora-combobox-option')).toHaveCount(2);
 await expect(page.locator('body > .finora-combobox-list')).toContainText('سیمان تیپ ۲');
 if(process.env.FINORA_PRODUCT_SEARCH_SCREENSHOT){
   await page.screenshot({path:process.env.FINORA_PRODUCT_SEARCH_SCREENSHOT+'_cement.png',fullPage:false});
 }
 await page.locator('body > .finora-combobox-list .finora-combobox-option').filter({hasText:'سیمان تیپ ۲'}).click();
 await expect(page.locator('#rehydrate-product')).toHaveValue('C3');
 await expect(page.locator('#result-unit')).toHaveValue('کیسه');
 await expect(page.locator('#result-price')).toHaveValue('150000');
 await input.click();await input.fill('محرمانه');
 await expect(page.locator('body > .finora-combobox-list .finora-combobox-empty')).toContainText('موردی پیدا نشد');
 await page.keyboard.press('Escape');
 await expect(page.locator('body > .finora-combobox-list')).toHaveCount(0);
});
