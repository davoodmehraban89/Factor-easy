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
 console.info('F0-05 product filter browser ms:',elapsed.toFixed(1));
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
 console.info('F0-05 contact filter browser ms:',elapsed.toFixed(1));
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


test('F0-05 1200+ account, project and contract comboboxes: scoped metadata, keyboard, no writes',async({page})=>{
 await fixture(page);
 await page.evaluate(()=>{
   // All records are disposable fixture records. Ownership is resolved BEFORE
   // option construction; this is not a substitute for real Supabase RLS.
   const own=(prefix,label,codefield,number)=>Array.from({length:number},(_,i)=>({
     id:prefix+i,ownerUserId:'QA',companyId:'ORG',name:label+' '+String(i).padStart(4,'0'),
     code:prefix+'-'+String(i).padStart(5,'0'),
     title:label+' '+String(i).padStart(4,'0')
   }));
   datastore.accounts=own('A','حساب آزمایشی','code',1205);
   datastore.accounts.push({id:'AX',ownerUserId:'QA',companyId:'ORG',code:'442201',title:'حساب کنترل بانک',name:'حساب کنترل بانک'});
   datastore.accounts.push({id:'HIDDEN_ACCOUNT',ownerUserId:'OTHER',companyId:'OTHER',code:'999999',title:'حساب شرکت محرمانه'});
   datastore.projects=own('J','پروژه آزمایشی','code',1205);
   datastore.projects.push({id:'JX',ownerUserId:'QA',companyId:'ORG',code:'PRJ-SPEC-44',floatingCode:'F-4444',name:'پروژه سیمانی ویژه'});
   datastore.projects.push({id:'HIDDEN_PROJECT',ownerUserId:'OTHER',companyId:'OTHER',code:'OTHER-PRJ',name:'پروژه شرکت محرمانه'});
   datastore.contracts=own('T','پیمان آزمایشی','code',1205);
   datastore.contracts.push({id:'TX',ownerUserId:'QA',companyId:'ORG',code:'CNT-XL-2026',name:'پیمان خاص آبان'});
   datastore.contracts.push({id:'HIDDEN_CONTRACT',ownerUserId:'OTHER',companyId:'OTHER',code:'OTHER-CNT',name:'پیمان شرکت محرمانه'});
   const targets=[
     {id:'af-rule-account',rows:datastore.accounts,heading:'انتخاب حساب'},
     {id:'invoice-project-id',rows:datastore.projects,heading:'انتخاب پروژه'},
     {id:'f0-contract-synthetic',rows:datastore.contracts,heading:'انتخاب پیمان'}
   ];
   for(const target of targets){
     let s=document.getElementById(target.id);
     if(!s){s=document.createElement('select');s.id=target.id;document.getElementById('view-invoices').appendChild(s)}
     s.replaceChildren(new Option(target.heading,''));
     target.rows.filter(x=>x.ownerUserId==='QA'&&x.companyId==='ORG').forEach(x=>{
       const o=new Option(x.title||x.name,x.id);
       o.dataset.search=[x.code,x.floatingCode].filter(Boolean).join(' ');
       s.appendChild(o);
     });
     finoraRefreshSearchableSelect(s);
   }
 });
 const listFor=id=>page.locator('#'+id).locator('xpath=..').locator('.finora-combobox-list');
 const inputFor=id=>page.locator('#'+id).locator('xpath=..').locator('.finora-combobox-input');
 const specs=[
   {id:'af-rule-account',special:'442201',selected:'AX',other:'HIDDEN_ACCOUNT',name:'account',ordinary:'حساب آزمایشی 1199'},
   {id:'invoice-project-id',special:'F-4444',selected:'JX',other:'HIDDEN_PROJECT',name:'project',ordinary:'پروژه آزمایشی 1199'},
   {id:'f0-contract-synthetic',special:'CNT-XL-2026',selected:'TX',other:'HIDDEN_CONTRACT',name:'contract',ordinary:'پیمان آزمایشی 1199'}
 ];
 for(const spec of specs){
   const input=inputFor(spec.id),list=listFor(spec.id),select=page.locator('#'+spec.id);
   await input.click();
   await expect(list.locator('[role="option"]')).toHaveCount(1206);
   await expect(list.locator('[data-value="'+spec.other+'"]')).toHaveCount(0);
   const elapsed=await page.evaluate(({id,q})=>{
     const e=document.getElementById(id).parentElement.querySelector('.finora-combobox-input');
     const t=performance.now();e.value=q;e.dispatchEvent(new Event('input',{bubbles:true}));return performance.now()-t;
   },{id:spec.id,q:spec.special});
   console.info('F0-05 '+spec.name+' filter browser ms:',elapsed.toFixed(1));
   expect(elapsed,spec.name+' synthetic filter latency').toBeLessThan(5000);
   await expect(list.locator('[role="option"]')).toHaveCount(1);
   await input.press('Enter');
   await expect(select).toHaveValue(spec.selected);
   await input.click();
   await input.fill('عبارت ناموجود');
   await expect(list.locator('.finora-combobox-empty')).toContainText('موردی پیدا نشد');
   await input.press('Escape');
   await expect(select).toHaveValue(spec.selected);
   await input.click();
   await input.fill(spec.ordinary);
   await expect(list.locator('[role="option"]')).toHaveCount(1);
   await input.press('End');
   await input.press('Enter');
   await expect(select).not.toHaveValue(spec.selected);
   expect(await page.evaluate(()=>[window.__saves,window.__posted])).toEqual([0,0]);
 }
});
