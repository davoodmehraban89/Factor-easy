const {test,expect}=require('@playwright/test');
const path=require('node:path');

async function fixture(page){
 const productOptions=Array.from({length:48},(_,i)=>'<option value="P'+i+'">کالا عمومی '+String(i).padStart(2,'0')+'</option>').join('');
 const contactOptions=Array.from({length:15},(_,i)=>'<option value="C'+i+'">شرکت شماره '+String(i).padStart(2,'0')+'</option>').join('');
 await page.setContent('<style>.view-pane{display:none}.view-pane.active{display:block}.list-shell{max-width:480px}.finora-combobox-list{font-size:16px}</style>'
  +'<section id="view-settings" class="view-pane"></section>'
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
