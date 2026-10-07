// Finora UX hardening R2 — searchable selectors, keyboard UX, themes, Excel templates, stats and modal safety.
(function(){
 const $=id=>document.getElementById(id);
 function activeCompanyId(){try{return getMySettings().default_company_id||getMyCompanies()[0]?.id||''}catch(_){return''}}
 function ownedRows(k){const cid=activeCompanyId(),all=Array.isArray(datastore?.[k])?datastore[k]:[];return all.filter(r=>r?.ownerUserId===currentUser?.id&&(!r.companyId||r.companyId===cid))}
 window.finoraFaDigits=v=>String(v??'').replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
 function searchMeta(value,text){
   const id=String(value||''),parts=[text||''];try{
     const p=typeof getMyProducts==='function'?getMyProducts().find(x=>x.id===id):null;if(p)parts.push(p.code,p.name,p.spec,p.barcode,p.internal_id,p.official_id,p.category,p.unit);
     const c=typeof getMyContacts==='function'?getMyContacts().find(x=>x.id===id):null;if(c)parts.push(c.name,c.mobile,c.national_id,c.economic_code,c.reg_number,c.postal_code);
     const pr=typeof getMyGlobalProjects==='function'?getMyGlobalProjects().find(x=>x.id===id):null;if(pr)parts.push(pr.code,pr.name,pr.floatingCode);
     const a=typeof getMyAccounts==='function'?getMyAccounts().find(x=>x.id===id):null;if(a)parts.push(a.code,a.title);
   }catch(_){}
   return parts.filter(Boolean).join(' ').toLowerCase();
 }
 function filterSelect(select,input){
   const q=String(input?.value||'').trim().toLowerCase();[...select.options].forEach((o,i)=>{if(i===0&&o.value===''){o.hidden=false;return}const hay=(o.dataset.search||searchMeta(o.value,o.textContent));o.dataset.search=hay;o.hidden=!!q&&!hay.includes(q)});
 }
 window.finoraRefreshSearchableSelect=function(select){
   if(!select||select.multiple||select.dataset.finoraSearchReady==='1'||select.classList.contains('je-account'))return;
   const ids=['invoice-contact-id','pur-supplier','invoice-project-id','pur-costcenter','chq-contact-select','trx-contact-select','trx-project-select','company-parent-id','invoice-company-id','filter-invoice-company','af-project-parent','af-project-branch'];
   const targeted=ids.includes(select.id)||select.classList.contains('row-product-select')||select.classList.contains('pur-prod');if(!targeted&&select.options.length<8)return;
   select.dataset.finoraSearchReady='1';const input=document.createElement('input');input.type='search';input.className='form-control finora-select-search';input.placeholder='جستجو...';input.autocomplete='off';input.style.marginBottom='5px';select.parentNode?.insertBefore(input,select);input.addEventListener('input',()=>filterSelect(select,input));
   new MutationObserver(()=>filterSelect(select,input)).observe(select,{childList:true,subtree:true,attributes:true});filterSelect(select,input);
 }
 function refreshProductOptionMetadata(){document.querySelectorAll('.row-product-select,.pur-prod').forEach(sel=>[...sel.options].forEach(o=>{if(!o.value)return;const p=typeof getMyProducts==='function'?getMyProducts().find(x=>x.id===o.value):null;if(!p)return;o.dataset.price=String(sel.classList.contains('pur-prod')?(p.buy_price||0):(p.sale_price||0));o.dataset.unit=p.unit||'عدد';o.dataset.search=[p.code,p.name,p.spec,p.barcode,p.internal_id,p.official_id,p.category].filter(Boolean).join(' ').toLowerCase()}))}
 function enhanceAll(){refreshProductOptionMetadata();document.querySelectorAll('select').forEach(finoraRefreshSearchableSelect)}
 function closeTopModal(){
   const modals=[...document.querySelectorAll('.modal-backdrop.active')];if(!modals.length)return false;const m=modals[modals.length-1],cancel=[...m.querySelectorAll('button')].find(b=>/انصراف|بستن|لغو|✕/.test(b.textContent||''));if(cancel){cancel.click();return true}m.classList.remove('active');return true;
 }
 window.finoraCloseTopModal=closeTopModal;
 const THEME_CSS=`body.finora-theme-dark{--bg:#07111f;--surface:#0f1b2d;--card:#122238;--text:#e6edf7;--text-muted:#9db0c9;--border:#263a55;--primary:#22b8c7;color:var(--text);background:var(--bg)}body.finora-theme-dark .card,body.finora-theme-dark .modal-card,body.finora-theme-dark input,body.finora-theme-dark select,body.finora-theme-dark textarea{background:#122238!important;color:#e6edf7!important;border-color:#2b405d!important}body.finora-theme-dark table th,body.finora-theme-dark table td{border-color:#2b405d!important}body.finora-theme-dark .form-row[style*="background"]{background:#0d1a2c!important}`;
 function ensureThemeCss(){if($('finora-theme-r2-css'))return;const s=document.createElement('style');s.id='finora-theme-r2-css';s.textContent=THEME_CSS;document.head.appendChild(s)}
 function resolveTheme(mode){if(mode==='dark'||mode==='light')return mode;const h=new Date().getHours();return h>=7&&h<19?'light':'dark'}
 window.finoraApplyTheme=function(){ensureThemeCss();const mode=getMySettings()?.ui_theme||'auto',r=resolveTheme(mode);document.body.classList.toggle('finora-theme-dark',r==='dark');document.documentElement.dataset.finoraTheme=r}
 function saveExperience(){
   if(!requireWrite())return;const s=getMySettings();s.ui_theme=$('finora-theme-select').value;s.hotkey_ctrl_s=$('finora-hotkey-ctrls').checked;s.hotkey_enter_save=$('finora-hotkey-enter').checked;s.hotkey_quick_zeros=$('finora-hotkey-zeros').checked;saveDatastore();finoraApplyTheme();alert('تنظیمات تجربه کاربری ذخیره شد.');
 }
 window.finoraSaveExperienceSettings=saveExperience;
 function activeSave(){
   const v=document.querySelector('.view-pane.active')?.id;if(v==='view-invoices'&&typeof commitSaveInvoice==='function')return commitSaveInvoice();if(v==='view-purchases'&&typeof purSave==='function')return purSave();if(v==='view-products'&&typeof commitSaveProduct==='function')return commitSaveProduct();if(v==='view-contacts'&&typeof commitSaveContact==='function')return commitSaveContact();if(v==='view-journal'&&typeof jeSaveManual==='function')return jeSaveManual();if(v==='view-settings'&&typeof commitSaveDefaultSettings==='function')return commitSaveDefaultSettings();
 }
 document.addEventListener('keydown',e=>{
   const s=typeof getMySettings==='function'?getMySettings():{};if(e.key==='Escape'){if(closeTopModal()){e.preventDefault();return}}
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&s.hotkey_ctrl_s!==false){e.preventDefault();activeSave();return}
   const t=e.target;if(s.hotkey_quick_zeros&&t?.matches?.('input[inputmode="decimal"],input[type="number"]')&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&(e.code==='NumpadAdd'||e.code==='NumpadSubtract'||e.key==='+'||e.key==='-')){e.preventDefault();const zeros=(e.code==='NumpadSubtract'||e.key==='-')?'00':'000',raw=String(t.value||'').replace(/,/g,'');t.value=raw+zeros;t.dispatchEvent(new Event('input',{bubbles:true}));return}
   if(s.hotkey_enter_save&&e.key==='Enter'&&!e.shiftKey&&!e.ctrlKey&&!e.altKey&&!t?.matches?.('textarea,select,button')){e.preventDefault();activeSave()}
 });
 const EXCEL_SCHEMAS={
  products:[['code','کد کالا'],['name','نام کالا',1],['spec','مشخصه و نوع'],['category','دسته‌بندی'],['unit','واحد'],['buy_price','قیمت خرید (ریال)'],['sale_price','قیمت فروش (ریال)'],['barcode','بارکد'],['internal_id','شناسه کالا/خدمت داخلی'],['official_id','شناسه کالا/خدمت سامانه مالیاتی'],['min_stock','حداقل موجودی']],
  contacts:[['name','نام شخص یا شرکت',1],['entity_type','نوع (حقیقی/حقوقی)'],['role','نقش (مشتری/تأمین‌کننده/هر دو)'],['mobile','شماره همراه'],['national_id','شناسه یا کد ملی'],['economic_code','کد اقتصادی'],['reg_number','شماره ثبت'],['postal_code','کد پستی'],['address','نشانی']],
  accounts:[['code','کد حساب',1],['title','عنوان',1],['level','سطح',1],['parent_code','کد والد'],['normal_balance','ماهیت'],['account_type','نوع حساب'],['system_role','نقش سیستمی']],
  saleItems:[['code','کد کالا'],['name','شرح',1],['qty','تعداد'],['unit','واحد'],['price','فی']],
  purchaseItems:[['code','کد کالا'],['name','شرح',1],['qty','تعداد'],['unit','واحد'],['price','فی']]
 };
 function excelSelection(type){const s=getMySettings(),saved=s.excel_template_fields?.[type],schema=EXCEL_SCHEMAS[type]||[];return Array.isArray(saved)&&saved.length?saved:schema.map(x=>x[0])}
 function renderExcelFields(){
   const type=$('finora-excel-type')?.value||'products',host=$('finora-excel-fields');if(!host)return;const selected=new Set(excelSelection(type));host.innerHTML=(EXCEL_SCHEMAS[type]||[]).map(([k,l,req])=>'<label style="display:flex;gap:6px;align-items:center;margin:5px 0"><input type="checkbox" data-excel-field="'+k+'" '+(selected.has(k)?'checked':'')+' '+(req?'disabled':'')+'> '+l+(req?' *':'')+'</label>').join('')
 }
 window.finoraRenderExcelFields=renderExcelFields;
 function saveExcelFields(){
   const type=$('finora-excel-type').value,s=getMySettings(),keys=[...document.querySelectorAll('#finora-excel-fields input:checked')].map(x=>x.dataset.excelField);s.excel_template_fields=s.excel_template_fields||{};s.excel_template_fields[type]=keys;saveDatastore();alert('فیلدهای قالب ذخیره شد.');
 }
 window.finoraSaveExcelFields=saveExcelFields;
 function templateSample(type,key){const samples={products:{code:'101',name:'بلوک سایز ۱۰',spec:'سبک',category:'مصالح',unit:'عدد',buy_price:80000,sale_price:100000,barcode:'6260000000000',internal_id:'INT-101',official_id:'',min_stock:20},contacts:{name:'شرکت نمونه',entity_type:'حقوقی',role:'هر دو',mobile:'09120000000',national_id:'14000000000',economic_code:'411111111111',reg_number:'12345',postal_code:'1234567890',address:'تهران'},accounts:{code:'1101',title:'صندوق و بانک',level:'تفصیلی',parent_code:'11',normal_balance:'بدهکار',account_type:'دارایی',system_role:'cash_default'},saleItems:{code:'101',name:'بلوک سایز ۱۰',qty:2,unit:'عدد',price:100000},purchaseItems:{code:'101',name:'بلوک سایز ۱۰',qty:2,unit:'عدد',price:80000}};return samples[type]?.[key]??''}
 window.finoraDownloadConfiguredTemplate=function(type){
   if(typeof XLSX==='undefined')return alert('موتور Excel در دسترس نیست.');const schema=EXCEL_SCHEMAS[type]||[],keys=excelSelection(type),cols=schema.filter(x=>keys.includes(x[0])),headers=cols.map(x=>x[1]),sample=cols.map(x=>templateSample(type,x[0])),ws=XLSX.utils.aoa_to_sheet([headers,sample]),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'قالب');XLSX.writeFile(wb,'Finora_'+type+'_Template.xlsx')
 }
 window.finoraExportConfiguredData=function(type){
   if(typeof XLSX==='undefined')return alert('موتور Excel در دسترس نیست.');let rows=[];if(type==='products')rows=getMyProducts();else if(type==='contacts')rows=getMyContacts();else if(type==='accounts')rows=getMyAccounts();else return alert('برای اقلام فاکتور از قالب نمونه استفاده کنید.');const schema=EXCEL_SCHEMAS[type],keys=excelSelection(type),out=rows.map(r=>Object.fromEntries(schema.filter(x=>keys.includes(x[0])).map(([k,l])=>[l,r[k]??'']))),ws=XLSX.utils.json_to_sheet(out),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'خروجی');XLSX.writeFile(wb,'Finora_'+type+'_Export.xlsx')
 }
 function statsHtml(){const stats=[['کالا/خدمت',ownedRows('products').length],['اشخاص',ownedRows('contacts').length],['فاکتور فروش',ownedRows('invoices').length],['فاکتور خرید',ownedRows('purchases').length],['چک',ownedRows('cheques').length],['حساب',ownedRows('accounts').length],['پروژه',ownedRows('projects').length],['اسناد حسابداری',ownedRows('journalVouchers').length]];return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px">'+stats.map(x=>'<div style="border:1px solid var(--border);border-radius:10px;padding:12px"><small>'+x[0]+'</small><div style="font-size:22px;font-weight:800">'+Number(x[1]).toLocaleString('fa-IR')+'</div></div>').join('')+'</div>'}
 window.finoraRefreshDataStats=function(){const h=$('finora-data-stats');if(h)h.innerHTML=statsHtml()}
 function installSettings(){
   const root=$('view-settings');if(!root||$('finora-experience-card'))return;try{if(typeof FINORA_MODULES!=='undefined'&&!FINORA_MODULES.settings.groups.some(g=>g.title==='تجربه کاربری'))FINORA_MODULES.settings.groups.splice(2,0,{title:'تجربه کاربری',items:[['ظاهر و میانبرها','view-settings','⌨','','experience'],['قالب‌های Excel','view-settings','▦','','excel-templates'],['آمار داده‌ها','view-settings','◎','','data-stats']]})}catch(_){}
   const s=getMySettings(),exp=document.createElement('div');exp.id='finora-experience-card';exp.className='accordion-item open';exp.dataset.finoraTask='experience';exp.innerHTML='<div class="accordion-header" onclick="toggleAccordion(this)"><span>⌨ ظاهر و میانبرهای صفحه‌کلید</span><span>▼</span></div><div class="accordion-body"><div class="form-row"><div class="form-group"><label>تم ظاهری</label><select id="finora-theme-select" class="form-control"><option value="auto">خودکار (روز روشن / شب تاریک)</option><option value="light">روشن</option><option value="dark">تاریک</option></select></div></div><label><input type="checkbox" id="finora-hotkey-ctrls"> Ctrl+S برای ذخیره</label><br><label><input type="checkbox" id="finora-hotkey-enter"> Enter برای ذخیره فرم فعال</label><br><label><input type="checkbox" id="finora-hotkey-zeros"> + افزودن سه صفر و − افزودن دو صفر در فیلد مبلغ</label><p class="af-hint">Escape همیشه پنجره باز را می‌بندد. میانبرهای عددی فقط داخل فیلدهای مبلغ عمل می‌کنند.</p><button class="btn btn-primary" onclick="finoraSaveExperienceSettings()">ذخیره تنظیمات</button></div>';root.insertBefore(exp,root.firstElementChild?.nextSibling||null);
   $('finora-theme-select').value=s.ui_theme||'auto';$('finora-hotkey-ctrls').checked=s.hotkey_ctrl_s!==false;$('finora-hotkey-enter').checked=!!s.hotkey_enter_save;$('finora-hotkey-zeros').checked=!!s.hotkey_quick_zeros;
   const ex=document.createElement('div');ex.className='accordion-item';ex.dataset.finoraTask='excel-templates';ex.innerHTML='<div class="accordion-header" onclick="toggleAccordion(this)"><span>▦ قالب‌های Excel و فیلدهای قابل انتخاب</span><span>▼</span></div><div class="accordion-body"><div class="form-group"><label>نوع قالب</label><select id="finora-excel-type" class="form-control" onchange="finoraRenderExcelFields()"><option value="products">کالا و خدمات</option><option value="contacts">اشخاص</option><option value="accounts">کدینگ حساب‌ها</option><option value="saleItems">اقلام فاکتور فروش</option><option value="purchaseItems">اقلام فاکتور خرید</option></select></div><div id="finora-excel-fields"></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="finoraSaveExcelFields()">ذخیره فیلدها</button><button class="btn btn-secondary" onclick="finoraDownloadConfiguredTemplate(document.getElementById(\'finora-excel-type\').value)">دانلود قالب نمونه</button><button class="btn btn-secondary" onclick="finoraExportConfiguredData(document.getElementById(\'finora-excel-type\').value)">خروجی داده‌های فعلی</button></div></div>';root.appendChild(ex);renderExcelFields();
   const st=document.createElement('div');st.className='accordion-item';st.dataset.finoraTask='data-stats';st.innerHTML='<div class="accordion-header" onclick="toggleAccordion(this)"><span>◎ آمار داده‌های شرکت فعال</span><span>▼</span></div><div class="accordion-body"><div id="finora-data-stats"></div><button class="btn btn-secondary" style="margin-top:10px" onclick="finoraRefreshDataStats()">به‌روزرسانی آمار</button></div>';root.appendChild(st);finoraRefreshDataStats();
 }
 function installCommerceToolbar(){
   ['view-invoices','view-purchases'].forEach(id=>{const root=$(id);if(!root||root.querySelector('.finora-commerce-toolbar'))return;const bar=document.createElement('div');bar.className='card no-print finora-commerce-toolbar';bar.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px;margin-bottom:10px';bar.innerHTML='<strong>فاکتورها:</strong><button class="btn btn-secondary btn-inline" onclick="finoraOpenInvoiceType(\'sale\')">فروش</button><button class="btn btn-secondary btn-inline" onclick="finoraOpenInvoiceType(\'purchase\')">خرید</button><button class="btn btn-secondary btn-inline" onclick="finoraOpenInvoiceType(\'pre_invoice\')">پیش‌فاکتور</button>';root.insertBefore(bar,root.firstChild)})
 }
 window.finoraOpenInvoiceType=function(type){if(type==='purchase'){if(typeof navigateShell==='function')navigateShell('commerce','view-purchases');else switchView('view-purchases');return}if(typeof navigateShell==='function')navigateShell('commerce','view-invoices');else switchView('view-invoices');const kind=$('invoice-kind');if(kind){kind.value=type==='pre_invoice'?'pre_invoice':type==='contract_statement'?'contract_statement':'non_formal';if(typeof handleInvoiceKindChange==='function')handleInvoiceKindChange()}}
 const oldProductTpl=window.downloadProductsExcelTemplate,oldContactTpl=window.downloadContactsExcelTemplate;window.downloadProductsExcelTemplate=()=>finoraDownloadConfiguredTemplate('products');window.downloadContactsExcelTemplate=()=>finoraDownloadConfiguredTemplate('contacts');
 window.downloadAccountsExcelTemplate=()=>finoraDownloadConfiguredTemplate('accounts');window.downloadInvoiceItemsExcelTemplate=()=>finoraDownloadConfiguredTemplate('saleItems');window.purDownloadExcelTemplate=()=>finoraDownloadConfiguredTemplate('purchaseItems');
 function boot(){installSettings();installCommerceToolbar();enhanceAll();finoraApplyTheme();finoraRefreshDataStats()}
 const oldRefresh=window.refreshAllSurfaces;if(typeof oldRefresh==='function')window.refreshAllSurfaces=function(){const r=oldRefresh.apply(this,arguments);setTimeout(boot,0);return r};
 document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0));setInterval(()=>{if((getMySettings()?.ui_theme||'auto')==='auto')finoraApplyTheme()},15*60*1000);
})();