// F0-05: standalone controlled browser stress; never uses user or production data.
const {test,expect}=require('@playwright/test');
const path=require('node:path');

async function fixture(page){
 const people=Array.from({length:1205},(_,i)=>({id:'C'+i,ownerUserId:'QA',name:'شرکت آزمایشی شماره '+String(i).padStart(4,'0'),mobile:'0912'+String(i).padStart(7,'0')}));
 people.push({id:'CVIP',ownerUserId:'QA',name:'شرکت توسعه هارد',mobile:'09120009999'});
 const choices=people.map(c=>'<option value="'+c.id+'">'+c.name+'</option>').join('');
 await page.setContent('<!doctype html><html lang="fa" dir="rtl"><head><style>.view-pane{display:none}.view-pane.active{display:block}.finora-combobox{width:420px!important}.finora-combobox-list{max-height:220px!important}</style></head><body><section id="view-settings"></section><section id="view-invoices" class="view-pane active"><select id="stress-products" class="row-product-select"><option value="">انتخاب کالا</option></select><select id="invoice-contact-id"><option value="">انتخاب شخص</option>'+choices+'</select></section></body></html>');
 await page.addScriptTag({content:'var currentUser={id:"QA"};var datastore={settings:[{ownerUserId:"QA",ui_theme:"light"}],companies:[{id:"ORG",ownerUserId:"QA"}],products:[],contacts:[],projects:[],accounts:[],invoices:[],purchases:[],cheques:[],journalVouchers:[]};var FINORA_MODULES={settings:{groups:[]}};window.__saves=0;window.__posted=0;function getMySettings(){return datastore.settings[0]}function getMyCompanies(){return datastore.companies}function getMyProducts(){return datastore.products.filter(p=>p.ownerUserId===currentUser.id)}function getMyContacts(){return datastore.contacts.filter(c=>c.ownerUserId===currentUser.id)}function getMyAccounts(){return datastore.accounts}function getMyGlobalProjects(){return datastore.projects}function requireWrite(){return true}function saveDatastore(){window.__saves++}function toggleAccordion(){}function esc(v){return String(v)}function jePostSourceRecord(){window.__posted++}'});
 await page.evaluate(people=>{datastore.contacts=people;datastore.products=Array.from({length:1205},(_,i)=>({id:'P'+i,ownerUserId:'QA',code:String(100000+i),name:'کالا آزمایشی شماره '+String(i).padStart(4,'0'),spec:'رده عمومی',unit:'عدد',sale_price:1000+i}));datastore.products.push({id:'B10',ownerUserId:'QA',code:'310001',name:'بلوک سیمانی ۱۰',spec:'سبک',unit:'عدد',sale_price:10000},{id:'B15',ownerUserId:'QA',code:'310002',name:'بلوک سبک ۱۵',spec:'AAC',unit:'عدد',sale_price:12000},{id:'H1',ownerUserId:'QA',code:'910001',name:'هارد اکسترنال',spec:'دو ترابایت',unit:'عدد',sale_price:20000},{id:'SECRET',ownerUserId:'OTHER',code:'777777',name:'هارد محرمانه',spec:'فقط شرکت دیگر',unit:'عدد',sale_price:1});},people);
 await page.addScriptTag({path:path.resolve('js/ux-hardening-r2.js')});
 await page.evaluate(()=>{finoraRefreshSearchableSelect(document.querySelector('#stress-products'));finoraRefreshSearchableSelect(document.querySelector('#invoice-contact-id'))});
 return {product:page.locator('#stress-products').locator('xpath=..').locator('.finora-combobox-input'),person:page.locator('#invoice-contact-id').locator('xpath=..').locator('.finora-combobox-input')};
}

test('F0-05 products: 1208 choices, Persian variants, keyboard and cross-tenant negative control',async({page})=>{
 const {product}=await fixture(page);
 await product.click();
 const list=page.locator('body > .finora-combobox-list');
 await expect(list.locator('[role="option"]')).toHaveCount(1208);
 const elapsed=await page.evaluate(()=>{const e=document.querySelector('#stress-products').parentElement.querySelector('input');const t=performance.now();e.value='کالا آزمایشی شماره 1204';e.dispatchEvent(new Event('input',{bubbles:true}));return performance.now()-t});
 expect(elapsed,'product filter took '+elapsed.toFixed(0)+'ms').toBeLessThan(5000);
 await expect(list.locator('[role="option"]')).toHaveCount(1);
 await expect(list).toContainText('1204');
 await product.fill('بلوك');
 await expect(list.locator('[role="option"]')).toHaveCount(2);
 await product.press('ArrowDown');
 await expect(list.locator('[aria-selected="true"]')).toContainText('بلوک سبک ۱۵');
 await product.press('Enter');
 await expect(page.locator('#stress-products')).toHaveValue('B15');
 await product.click();await product.fill('هارد');
 await expect(list.locator('[role="option"]')).toHaveCount(1);
 await expect(list).not.toContainText('محرمانه');
 await product.fill('دو ترابایت');
 await expect(list.locator('[role="option"]')).toHaveCount(1);
 await product.fill('عبارت ناموجود');
 await expect(list.locator('.finora-combobox-empty')).toContainText('موردی پیدا نشد');
 await product.press('Escape');
 await expect(page.locator('#stress-products')).toHaveValue('B15');
 expect(await page.evaluate(()=>[window.__saves,window.__posted])).toEqual([0,0]);
});

test('F0-05 people: 1206 choices and 11-digit metadata filter with no implicit writes',async({page})=>{
 const {person}=await fixture(page);
 await person.click();
 const list=page.locator('#invoice-contact-id').locator('xpath=..').locator('.finora-combobox-list');
 await expect(list.locator('[role="option"]')).toHaveCount(1206);
 const elapsed=await page.evaluate(()=>{const e=document.querySelector('#invoice-contact-id').parentElement.querySelector('input');const t=performance.now();e.value='09120009999';e.dispatchEvent(new Event('input',{bubbles:true}));return performance.now()-t});
 expect(elapsed,'contact filter took '+elapsed.toFixed(0)+'ms').toBeLessThan(5000);
 await expect(list.locator('[role="option"]')).toHaveCount(1);
 await expect(list).toContainText('شرکت توسعه هارد');
 await person.press('Enter');
 await expect(page.locator('#invoice-contact-id')).toHaveValue('CVIP');
 await person.click();await person.fill('شرکت آزمایشی شماره 1199');
 await expect(list.locator('[role="option"]')).toHaveCount(1);
 await person.press('Enter');
 await expect(page.locator('#invoice-contact-id')).toHaveValue('C1199');
 expect(await page.evaluate(()=>[window.__saves,window.__posted])).toEqual([0,0]);
});
