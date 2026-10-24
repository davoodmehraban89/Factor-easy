const {test,expect}=require('@playwright/test');
const path=require('node:path');

async function fixture(page){
 const productOptions=Array.from({length:48},(_,i)=>'<option value="P'+i+'">کالا عمومی '+String(i).padStart(2,'0')+'</option>').join('');
 const contactOptions=Array.from({length:15},(_,i)=>'<option value="C'+i+'">شرکت شماره '+String(i).padStart(2,'0')+'</option>').join('');
 await page.setContent('<style>.view-pane{display:none}.view-pane.active{display:block}.list-shell{max-width:480px}.finora-combobox-list{font-size:16px}</style>'
  +'<section id="view-settings" class="view-pane"><div class="accordion-item"><input id="company-name-input"><button id="company-save-btn">ثبت شرکت</button></div><input id="def-invoice-kind" value="formal"></section>'
  +'<section id="view-products" class="view-pane"><input id="prod-name-input"><button id="product-save-btn">ثبت کالا</button></section>'
  +'<section id="view-invoices" class="view-pane active"><div class="list-shell"><table><tbody id="invoice-items-table-body"><tr><td>'
  +'<select id="test-product" class="row-product-select"><option value="">-- انتخاب کالا --</option>'+productOptions+'</select>'
  +'<input class="row-quantity" value="0"></td></tr></tbody></table>'
  +'<select id="invoice-contact-id"><option value="">-- انتخاب شخص --</option>'+contactOptions+'</select></div></section>');
 await page.addScriptTag({content:`var currentUser={id:'QA1'};
 var datastore={settings:[{ownerUserId:'QA1',ui_theme:'light',hotkey_ctrl_s:true,hotkey_ctrl_enter:true}],products:[],contacts:[],companies:[{id:'C1',ownerUserId:'QA1'}],invoices:[],purchases:[],cheques:[],accounts:[],projects:[],journalVouchers:[]};
 var FINORA_MODULES={settings:{groups:[]}};
 window.__saves=0;window.__posted=0;window.__alerts=[];
 function getMySettings(){return datastore.settings[0]}
 function getMyCompanies(){return datastore.companies}
 function getMyProducts(){return datastore.products.filter(p=>p.ownerUserId===currentUser.id)}
 function getMyContacts(){return datastore.contacts}
 function getMyAccounts(){return datastore.accounts}
 function getMyGlobalProjects(){return datastore.projects}
 function requireWrite(){return true}
 function saveDatastore(){}
 function toggleAccordion(){}
 function esc(s){return String(s)}
 function commitSaveInvoice(){window.__saves++}
 function commitSaveProduct(){window.__saves++}
 function commitSaveCompany(){window.__companySaves=(window.__companySaves||0)+1}
 function commitSaveDefaultSettings(){window.__defaultSaves=(window.__defaultSaves||0)+1}
 function jePostSourceRecord(){window.__posted++}
 window.alert=m=>window.__alerts.push(String(m));`});
 await page.evaluate(()=>{
   datastore.products=[
     ...Array.from({length:48},(_,i)=>({id:'P'+i,ownerUserId:'QA1',name:'کالا عمومی '+String(i).padStart(2,'0'),code:'40'+i,unit:'عدد',sale_price:100+i})),
     {id:'BL1',ownerUserId:'QA1',name:'بلوک سیمانی ۱۰ سانتی',code:'310001',unit:'عدد',sale_price:1500},
     {id:'BL2',ownerUserId:'QA1',name:'بلوک سبک ۱۵ سانتی',code:'310002',unit:'عدد',sale_price:2000},
     {id:'BLOCKED',ownerUserId:'OTHER_TENANT',name:'بلوک محرمانه',code:'777',unit:'عدد',sale_price:1}
   ];
 });
 await page.addScriptTag({path:path.resolve('js/ux-hardening-r2.js')});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 return {
   product:page.locator('#test-product').locator('xpath=..').locator('.finora-combobox-input'),
   person:page.locator('#invoice-contact-id').locator('xpath=..').locator('.finora-combobox-input')
 };
}

test('searchable products filter Persian variants; arrows select highlighted entry with Enter, not first',async({page})=>{
 const {product,person}=await fixture(page);
 await product.click();
 await product.fill('بلوك');
 const list=page.locator('body > .finora-combobox-list');
 await expect(list).toBeVisible();
 await expect(list.locator('[role="option"]')).toHaveCount(2);
 await expect(list).not.toContainText('محرمانه');
 await expect(product).toHaveAttribute('aria-expanded','true');
 await product.press('ArrowDown');
 await expect(list.locator('[aria-selected="true"]')).toContainText('بلوک سبک');
 await product.press('Enter');
 await expect(page.locator('#test-product')).toHaveValue('BL2');
 await expect(product).toHaveAttribute('aria-expanded','false');
 expect(await page.evaluate(()=>window.__saves)).toBe(0);
 await person.click();
 await person.fill('شرکت شماره 0');
 await expect(page.locator('#invoice-contact-id').locator('xpath=..').locator('[role="option"]')).toHaveCount(11);
 await person.press('ArrowDown');
 await person.press('Enter');
 await expect(page.locator('#invoice-contact-id')).toHaveValue('C1');
 expect(await page.evaluate(()=>window.__saves)).toBe(0);
});

test('large dropdown wheel scroll, PageDown, Home/End and Escape preserve selection',async({page})=>{
 const {product}=await fixture(page);
 await product.click();await product.fill('کالا عمومی');
 const list=page.locator('body > .finora-combobox-list');
 await expect(list.locator('[role="option"]')).toHaveCount(48);
 await product.press('PageDown');
 await expect(list.locator('[aria-selected="true"]')).not.toContainText('کالا عمومی 00');
 await product.press('End');
 await expect(list.locator('[aria-selected="true"]')).toContainText('کالا عمومی 47');
 await product.press('Home');
 await expect(list.locator('[aria-selected="true"]')).toContainText('کالا عمومی 00');
 await list.hover({position:{x:12,y:38}});
 await page.mouse.wheel(0,475);
 await expect.poll(()=>list.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
 const selected=await list.locator('[aria-selected="true"]').getAttribute('data-value');
 expect(selected).not.toBe('P0');
 await product.press('Enter');
 await expect(page.locator('#test-product')).toHaveValue(selected);
 await product.click();await product.fill('مورد بی‌ربط');
 await expect(list.locator('.finora-combobox-empty')).toContainText('موردی پیدا نشد');
 await product.press('Enter');
 await expect(page.locator('#test-product')).toHaveValue(selected);
 await product.press('Escape');
 await expect(product).toHaveAttribute('aria-expanded','false');
 await expect(page.locator('#test-product')).toHaveValue(selected);
});

test('F2 explicitly saves valid active form but rejects missing rows, unsupported modal and no active entry',async({page})=>{
 const {product}=await fixture(page);
 await page.keyboard.press('F2');
 expect(await page.evaluate(()=>window.__saves)).toBe(0);
 await expect.poll(()=>page.evaluate(()=>window.__alerts.at(-1))).toContain('حداقل یک کالا');
 await product.click();await product.fill('بلوک');await product.press('ArrowDown');await product.press('Enter');
 await page.locator('.row-quantity').fill('2');
 await page.keyboard.press('F2');
 expect(await page.evaluate(()=>window.__saves)).toBe(1);
 expect(await page.evaluate(()=>window.__posted)).toBe(0);
 await page.evaluate(()=>{
   const modal=document.createElement('div');modal.id='qa-modal';modal.className='modal-backdrop active';modal.textContent='تأیید اختصاصی';document.body.appendChild(modal);
 });
 await page.keyboard.press('F2');
 expect(await page.evaluate(()=>window.__saves)).toBe(1);
 await expect.poll(()=>page.evaluate(()=>window.__alerts.at(-1))).toContain('این پنجره');
 await page.evaluate(()=>{document.querySelector('#qa-modal').remove();document.querySelector('#view-invoices').classList.remove('active');document.querySelector('#view-products').classList.add('active')});
 await page.keyboard.press('F2');
 expect(await page.evaluate(()=>window.__saves)).toBe(1);
 await expect.poll(()=>page.evaluate(()=>window.__alerts.at(-1))).toContain('عنوان کالا');
 await page.locator('#prod-name-input').fill('قطعه جدید');
 await page.keyboard.press('F2');
 expect(await page.evaluate(()=>window.__saves)).toBe(2);
 await page.keyboard.press('Control+Enter');
 expect(await page.evaluate(()=>window.__saves)).toBe(3);
 await page.evaluate(()=>document.querySelector('#view-products').classList.remove('active'));
 await page.keyboard.press('F2');
 expect(await page.evaluate(()=>window.__saves)).toBe(3);
 await expect.poll(()=>page.evaluate(()=>window.__alerts.at(-1))).toContain('فرم فعالی');
});

test('F2 saves the company form or default settings according to focused field',async({page})=>{
 await fixture(page);
 await page.evaluate(()=>{
   document.querySelector('#view-invoices').classList.remove('active');
   document.querySelector('#view-settings').classList.add('active');
 });
 await page.locator('#company-name-input').focus();
 await page.keyboard.press('F2');
 expect(await page.evaluate(()=>window.__companySaves||0)).toBe(1);
 expect(await page.evaluate(()=>window.__defaultSaves||0)).toBe(0);
 await page.locator('#def-invoice-kind').focus();
 await page.keyboard.press('F2');
 expect(await page.evaluate(()=>window.__defaultSaves||0)).toBe(1);
 expect(await page.evaluate(()=>window.__companySaves||0)).toBe(1);
});

test('Settings keyboard saves the focused appearance card through its real save handler',async({page})=>{
 await fixture(page);
 await page.evaluate(()=>{
  document.querySelector('#view-invoices').classList.remove('active');document.querySelector('#view-settings').classList.add('active');
  window.__preferences=[];saveDatastore=()=>window.__preferences.push(JSON.parse(JSON.stringify(getMySettings())));
  document.getElementById('company-name-input').required=true;
 });
 for(const [i,key] of ['Control+s','Control+Enter','F2','Enter'].entries()){
  await page.evaluate(()=>Object.assign(getMySettings(),{hotkey_ctrl_s:true,hotkey_ctrl_enter:true,hotkey_enter_save:true}));
  const theme=i%2?'light':'dark';await page.locator('#finora-theme-select').selectOption(theme);
  await page.locator('#finora-hotkey-zeros').setChecked(i%2===0);await page.locator('#finora-hotkey-zeros').focus();
  await page.keyboard.press(key);
  await expect.poll(()=>page.evaluate(()=>window.__preferences.length)).toBe(i+1);
  expect(await page.evaluate(()=>window.__preferences.at(-1).ui_theme)).toBe(theme);
  expect(await page.evaluate(()=>window.__preferences.at(-1).hotkey_quick_zeros)).toBe(i%2===0);
 }
 expect(await page.evaluate(()=>window.__defaultSaves||0)).toBe(0);expect(await page.evaluate(()=>window.__companySaves||0)).toBe(0);
});

test('Settings keyboard saves the focused Excel card without saving invoice defaults',async({page})=>{
 await fixture(page);
 await page.evaluate(()=>{
  document.querySelector('#view-invoices').classList.remove('active');document.querySelector('#view-settings').classList.add('active');
  Object.assign(getMySettings(),{hotkey_enter_save:true});window.__preferences=[];saveDatastore=()=>window.__preferences.push(JSON.parse(JSON.stringify(getMySettings())));
 });
 for(const [i,key] of ['Control+s','Control+Enter','F2','Enter'].entries()){
  await page.locator('[data-excel-field="code"]').setChecked(i%2!==0);await page.locator('[data-excel-field="code"]').focus();await page.keyboard.press(key);
  await expect.poll(()=>page.evaluate(()=>window.__preferences.length)).toBe(i+1);
  expect(await page.evaluate(()=>getMySettings().excel_template_fields.products.includes('code'))).toBe(i%2!==0);
 }
 expect(await page.evaluate(()=>window.__defaultSaves||0)).toBe(0);expect(await page.evaluate(()=>window.__companySaves||0)).toBe(0);
});

test('Settings keyboard routes only the focused operational card to its existing save action',async({page})=>{
 await fixture(page);
 await page.evaluate(()=>{
  document.querySelector('#view-invoices').classList.remove('active');getMySettings().hotkey_enter_save=true;
  const view=document.createElement('section');view.id='view-data-center';view.className='view-pane active';
  view.innerHTML='<div id="p5-data-root"><div class="card"><select id="p5-set-default-wh"><option value="W1">اول</option><option value="W2">دوم</option></select><button onclick="p5SaveCompanyOpsSettings()">ذخیره تنظیمات</button></div></div>';document.body.append(view);
  window.__opsSaves=0;window.p5SaveCompanyOpsSettings=()=>{window.__opsSaves++;getMySettings().defaultWarehouseId=document.getElementById('p5-set-default-wh').value};
 });
 for(const [i,key] of ['Control+s','Control+Enter','F2','Enter'].entries()){
  await page.locator('#p5-set-default-wh').selectOption(i%2?'W1':'W2');await page.locator('#p5-set-default-wh').focus();
  // Plain Enter remains a native selection action on a select.
  if(key==='Enter')continue;
  await page.keyboard.press(key);expect(await page.evaluate(()=>window.__opsSaves)).toBe(i+1);
  expect(await page.evaluate(()=>getMySettings().defaultWarehouseId)).toBe(i%2?'W1':'W2');
 }
 expect(await page.evaluate(()=>window.__defaultSaves||0)).toBe(0);
});

test('Settings keyboard never saves invoice defaults from an unrelated account form',async({page})=>{
 await fixture(page);await page.evaluate(()=>{
  document.querySelector('#view-invoices').classList.remove('active');document.querySelector('#view-settings').classList.add('active');
  const card=document.createElement('div');card.className='accordion-item';card.dataset.finoraTask='account';card.innerHTML='<input id="unrelated-account-field"><button>تغییر رمز عبور</button>';document.querySelector('#view-settings').append(card);
 });
 await page.locator('#unrelated-account-field').focus();await page.keyboard.press('Control+s');await page.keyboard.press('F2');
 expect(await page.evaluate(()=>window.__defaultSaves||0)).toBe(0);expect(await page.evaluate(()=>window.__companySaves||0)).toBe(0);
});
test('F2 never silently finalizes a purchase: explicit confirmation is required',async({page})=>{
 await fixture(page);
 await page.evaluate(()=>{
   document.querySelector('#view-invoices').classList.remove('active');
   const purchase=document.createElement('section');
   purchase.id='view-purchases';purchase.className='view-pane active';
   purchase.innerHTML='<table><tbody id="pur-items-body"><tr><td><select class="pur-prod"><option value="P0" selected>کالا</option></select><input class="pur-qty" value="2"></td></tr></tbody></table><select id="pur-supplier"><option value="C0" selected>شخص</option></select>';
   document.body.appendChild(purchase);
   window.purSave=()=>{window.__purchaseSaves=(window.__purchaseSaves||0)+1};
   window.__prompts=0;
   window.confirm=()=>{window.__prompts++;return false};
 });
 await page.keyboard.press('F2');
 expect(await page.evaluate(()=>window.__purchaseSaves||0)).toBe(0);
 expect(await page.evaluate(()=>window.__prompts)).toBe(1);
 await expect.poll(()=>page.evaluate(()=>window.__alerts.at(-1))).toContain('نیازمند تأیید صریح');
 await page.evaluate(()=>window.confirm=()=>true);
 await page.keyboard.press('F2');
 expect(await page.evaluate(()=>window.__purchaseSaves||0)).toBe(1);
});


test('F2 detects a safe save command in other module forms and active dialogs, never a posting button',async({page})=>{
 await fixture(page);
 await page.evaluate(()=>{
   document.querySelector('#view-invoices').classList.remove('active');
   const inventory=document.createElement('section');
   inventory.id='view-inventory';inventory.className='view-pane active';
   inventory.innerHTML='<div class="card"><input id="generic-form-input" value="مجاز"><button id="generic-form-save" onclick="afSaveProject()">ثبت پروژه</button><button onclick="jePostUi()">قطعی‌سازی سند</button></div>';
   document.body.append(inventory);
   window.afSaveProject=()=>{window.__otherSaves=(window.__otherSaves||0)+1};
   window.jePostUi=()=>{window.__posted=(window.__posted||0)+1};
 });
 await page.locator('#generic-form-input').focus();
 await page.keyboard.press('F2');
 expect(await page.evaluate(()=>window.__otherSaves||0)).toBe(1);
 expect(await page.evaluate(()=>window.__posted||0)).toBe(0);
 await page.evaluate(()=>{
   const modal=document.createElement('div');modal.id='qa-safe-modal';modal.className='modal-backdrop active';
   modal.innerHTML='<div class="modal-card"><input id="modal-required" required><button onclick="afSaveDimension()">ذخیره تفصیلی</button><button onclick="jePostUi()">قطعی</button></div>';
   document.body.append(modal);
   window.afSaveDimension=()=>{window.__modalSaves=(window.__modalSaves||0)+1;modal.classList.remove('active')};
 });
 await page.locator('#modal-required').focus();
 await page.keyboard.press('F2');
 expect(await page.evaluate(()=>window.__modalSaves||0)).toBe(0);
 await expect.poll(()=>page.evaluate(()=>window.__alerts.at(-1))).toContain('فیلد پنجره');
 await page.locator('#modal-required').fill('تایید');
 await page.keyboard.press('F2');
 expect(await page.evaluate(()=>window.__modalSaves||0)).toBe(1);
 await expect(page.locator('#qa-safe-modal')).not.toHaveClass(/active/);
 expect(await page.evaluate(()=>window.__posted||0)).toBe(0);
});
