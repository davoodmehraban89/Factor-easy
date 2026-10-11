// Finora UX hardening R2 — searchable selectors, keyboard UX, themes, Excel templates, stats and modal safety.
(function(){
 const $=id=>document.getElementById(id);
 function activeCompanyId(){try{return getMySettings().default_company_id||getMyCompanies()[0]?.id||''}catch(_){return''}}
 function ownedRows(k){const cid=activeCompanyId(),all=Array.isArray(datastore?.[k])?datastore[k]:[];return all.filter(r=>r?.ownerUserId===currentUser?.id&&(!r.companyId||r.companyId===cid))}
 window.finoraFaDigits=v=>String(v??'').replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
 function searchMeta(value,text){
   const id=String(value||''),parts=[text||''];try{
     const p=typeof getMyProducts==='function'?getMyProducts().find(x=>x.id===id):null;if(p)parts.push(p.code,p.name,p.spec,p.barcode,p.internal_id,p.official_id,p.category,p.subcategory,p.unit);
     const c=typeof getMyContacts==='function'?getMyContacts().find(x=>x.id===id):null;if(c)parts.push(c.name,c.mobile,c.national_id,c.economic_code,c.reg_number,c.postal_code);
     const pr=typeof getMyGlobalProjects==='function'?getMyGlobalProjects().find(x=>x.id===id):null;if(pr)parts.push(pr.code,pr.name,pr.floatingCode);
     const a=typeof getMyAccounts==='function'?getMyAccounts().find(x=>x.id===id):null;if(a)parts.push(a.code,a.title);
   }catch(_){}
   return parts.filter(Boolean).join(' ').toLowerCase();
 }
 function searchNorm(v){return String(v||'').toLowerCase().replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[أإآ]/g,'ا').replace(/\s+/g,' ').trim()}
 function comboOptions(select,q){
   const query=searchNorm(q),tokens=query.split(' ').filter(Boolean),productSelect=select.matches('.row-product-select,.pur-prod');return [...select.options].filter(o=>o.value).map(o=>({o,hay:searchNorm([o.dataset.search,productSelect?o.textContent:searchMeta(o.value,o.textContent)].filter(Boolean).join(' '))})).filter(x=>!tokens.length||tokens.every(t=>x.hay.includes(t))).sort((a,b)=>{if(!query)return 0;const as=a.hay.startsWith(query)?0:a.hay.includes(' '+query)?1:2,bs=b.hay.startsWith(query)?0:b.hay.includes(' '+query)?1:2;return as-bs}).map(x=>x.o);
 }
 function comboLabel(o){return String(o?.textContent||'').trim()}
 function syncProductSelectOptions(select){
   if(!select||!select.matches('.row-product-select,.pur-prod')||typeof getMyProducts!=='function')return;
   const products=getMyProducts();if(!Array.isArray(products))return;
   const purchase=select.classList.contains('pur-prod'),existing=[...select.options].filter(o=>o.value),selectedId=select.value;
   const rows=products.filter(p=>p&&p.id!=null).map(p=>({id:String(p.id),name:String(p.name||''),spec:String(p.spec||''),unit:String(p.unit||'عدد'),price:String((purchase?p.buy_price:p.sale_price)||0),search:[p.code,p.name,p.spec,p.barcode,p.internal_id,p.official_id,p.category,p.subcategory,p.unit].filter(Boolean).join(' ').toLowerCase()}));
   const same=existing.length===rows.length&&rows.every((p,i)=>existing[i].value===p.id&&existing[i].textContent===p.name+(p.spec?' ('+p.spec+')':'')&&existing[i].dataset.price===p.price&&existing[i].dataset.unit===p.unit&&existing[i].dataset.search===p.search);
   if(same)return;
   const placeholder=select.querySelector('option[value=""]')?.cloneNode(true)||new Option('-- انتخاب کالا / خدمات --','');
   const original=existing.find(o=>o.value===selectedId),fragment=document.createDocumentFragment();fragment.appendChild(placeholder);
   for(const p of rows){const option=new Option(p.name+(p.spec?' ('+p.spec+')':''),p.id);option.dataset.price=p.price;option.dataset.unit=p.unit;option.dataset.search=p.search;fragment.appendChild(option)}
   // Preserve selected historical records when a master item was archived or removed.
   if(selectedId&&!rows.some(p=>p.id===selectedId)&&original)fragment.appendChild(original.cloneNode(true));
   select.replaceChildren(fragment);
   if(selectedId&&[...select.options].some(o=>o.value===selectedId))select.value=selectedId;
 }
 window.finoraRefreshSearchableSelect=function(select){
   if(!select||select.multiple||select.classList.contains('je-account'))return;
   syncProductSelectOptions(select);
   if(select.dataset.finoraSearchReady==='1')return;
   const ids=['invoice-contact-id','pur-supplier','invoice-project-id','pur-costcenter','chq-contact-select','trx-contact-select','trx-project-select','company-parent-id','invoice-company-id','filter-invoice-company','af-project-parent','af-project-branch'];
   const targeted=ids.includes(select.id)||select.classList.contains('row-product-select')||select.classList.contains('pur-prod');if(!targeted&&(select.options.length<8||select.dataset.finoraNoSearch==='1'))return;
   select.dataset.finoraSearchReady='1';const wrap=document.createElement('div');wrap.className='finora-combobox';wrap.style.cssText='position:relative;width:100%';select.parentNode?.insertBefore(wrap,select);wrap.appendChild(select);select.style.display='none';
   const input=document.createElement('input');input.type='text';input.className='form-control finora-combobox-input';input.autocomplete='off';input.placeholder=select.classList.contains('row-product-select')||select.classList.contains('pur-prod')?'انتخاب یا جستجوی کالا (نام، کد، مشخصه...)':'انتخاب یا جستجو...';wrap.insertBefore(input,select);
   const list=document.createElement('div');list.className='finora-combobox-list';list.setAttribute('role','listbox');list.style.cssText='display:none;position:absolute;z-index:1200;top:calc(100% + 3px);right:0;left:0;max-height:240px;overflow:auto;background:var(--card,#fff);border:1px solid var(--border,#cbd5e1);border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.14)';wrap.appendChild(list);
   const isProduct=select.matches('.row-product-select,.pur-prod');
   const listId='finora-combo-list-'+(window.__finoraComboSequence=(window.__finoraComboSequence||0)+1);
   list.id=listId;input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',listId);input.setAttribute('aria-expanded','false');
   let activeIndex=-1;
   const options=()=>[...list.querySelectorAll('.finora-combobox-option')];
   const activate=(index,ensureVisible=false)=>{
     const rows=options();
     activeIndex=rows.length?Math.max(0,Math.min(rows.length-1,index)):-1;
     rows.forEach((b,i)=>{const active=i===activeIndex;b.classList.toggle('finora-combobox-active',active);b.setAttribute('aria-selected',String(active));b.style.background=active?'var(--finora-selection-bg,rgba(35,120,200,.15))':'transparent'});
     if(activeIndex<0){input.removeAttribute('aria-activedescendant');return}
     input.setAttribute('aria-activedescendant',rows[activeIndex].id);
     if(ensureVisible)rows[activeIndex].scrollIntoView({block:'nearest'});
   };
   const placeList=()=>{if(!isProduct)return;const rect=wrap.getBoundingClientRect(),spaceBelow=window.innerHeight-rect.bottom,above=spaceBelow<115&&rect.top>spaceBelow;const maxH=Math.max(75,Math.min(240,(above?rect.top:spaceBelow)-8));list.style.position='fixed';list.style.right='auto';list.style.left=Math.max(0,rect.left)+'px';list.style.top=(above?Math.max(0,rect.top-maxH-3):rect.bottom+3)+'px';list.style.width=rect.width+'px';list.style.maxHeight=maxH+'px';list.style.zIndex='10000'};
   const close=()=>{list.style.display='none';input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');activeIndex=-1;if(isProduct&&list.parentNode!==wrap)wrap.appendChild(list)};
   const render=()=>{
     if(isProduct){syncProductSelectOptions(select);if(list.parentNode!==document.body)document.body.appendChild(list);placeList()}
     const rows=comboOptions(select,input.value);list.replaceChildren();
     if(!rows.length){const empty=document.createElement('div');empty.className='finora-combobox-empty';empty.textContent='موردی پیدا نشد';empty.style.cssText='padding:10px;color:var(--text-muted)';list.appendChild(empty)}
     else rows.forEach((o,i)=>{const b=document.createElement('button');b.type='button';b.id=listId+'-item-'+i;b.className='finora-combobox-option';b.dataset.value=o.value;b.textContent=comboLabel(o);b.setAttribute('role','option');b.setAttribute('aria-selected','false');b.style.cssText='display:block;width:100%;text-align:right;border:0;border-bottom:1px solid var(--border,#e2e8f0);background:transparent;padding:9px 10px;cursor:pointer;color:inherit';list.appendChild(b)});
     list.style.display='block';input.setAttribute('aria-expanded','true');activate(0,false);
   };
   const sync=()=>{const o=select.options[select.selectedIndex];if(document.activeElement===input&&input.dataset.searchDirty==='1')return;input.value=o&&o.value?comboLabel(o):''};
   const choose=(b)=>{if(!b)return false;select.value=b.dataset.value;input.dataset.searchDirty='0';select.dispatchEvent(new Event('change',{bubbles:true}));sync();close();return true};
   input.addEventListener('focus',()=>{input.dataset.searchDirty='1';input.value='';render()});
   input.addEventListener('click',()=>{if(list.style.display==='none'){input.dataset.searchDirty='1';input.value='';render()}});
   input.addEventListener('input',()=>{input.dataset.searchDirty='1';render()});
   input.addEventListener('keydown',e=>{
     if(e.key==='Escape'){if(list.style.display!=='none'){e.preventDefault();e.stopPropagation();close();input.dataset.searchDirty='0';sync();input.blur()}return}
     if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes(e.key)){
       e.preventDefault();e.stopPropagation();
       if(list.style.display==='none')render();
       const step=e.key==='PageDown'?Math.max(1,Math.floor(list.clientHeight/(options()[0]?.offsetHeight||38))):e.key==='PageUp'?-Math.max(1,Math.floor(list.clientHeight/(options()[0]?.offsetHeight||38))):e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0;
       activate(e.key==='Home'?0:e.key==='End'?options().length-1:activeIndex+step,true);return;
     }
     if(e.key==='Enter'&&list.style.display!=='none'){e.preventDefault();e.stopPropagation();choose(options()[activeIndex]);}
   });
   list.addEventListener('mousemove',e=>{const b=e.target instanceof Element?e.target.closest('.finora-combobox-option'):null;if(b)activate(options().indexOf(b),false)});
   list.addEventListener('wheel',e=>{
     if(list.style.display==='none')return;
     e.preventDefault();e.stopPropagation();
     list.scrollTop+=e.deltaY;
     const rows=options(),firstVisible=rows.findIndex(b=>b.offsetTop+b.offsetHeight>list.scrollTop);
     if(firstVisible>=0)activate(firstVisible,false);
   },{passive:false});
   list.addEventListener('mousedown',e=>{const b=e.target instanceof Element?e.target.closest('.finora-combobox-option'):null;if(!b)return;e.preventDefault();choose(b)});
   select.addEventListener('change',()=>{input.dataset.searchDirty='0';sync()});document.addEventListener('mousedown',e=>{if(!wrap.contains(e.target)){close();input.dataset.searchDirty='0';sync()}});new MutationObserver(()=>{if(input.dataset.searchDirty!=='1')sync();if(list.style.display==='block')render()}).observe(select,{childList:true,subtree:true});if(isProduct){document.addEventListener('scroll',()=>{if(list.style.display==='block')placeList()},true);window.addEventListener('resize',()=>{if(list.style.display==='block')placeList()})}sync();
 }
 function refreshProductOptionMetadata(){document.querySelectorAll('.row-product-select,.pur-prod').forEach(syncProductSelectOptions)}
 function enhanceAll(){refreshProductOptionMetadata();document.querySelectorAll('select').forEach(finoraRefreshSearchableSelect)}
 function closeTopModal(){
   const modals=[...document.querySelectorAll('.modal-backdrop.active')];if(!modals.length)return false;const m=modals[modals.length-1],cancel=[...m.querySelectorAll('button')].find(b=>/انصراف|بستن|لغو|✕/.test(b.textContent||''));if(cancel){cancel.click();return true}m.classList.remove('active');return true;
 }
 window.finoraCloseTopModal=closeTopModal;
 // A delegated close contract also covers late-rendered organization/access dialogs.
 // Execute before inline handlers so one broken/stale onclick cannot trap the user.
 function dismissModal(modal){
   if(!modal?.classList.contains('modal-backdrop'))return false;
   modal.classList.remove('active');
   modal.setAttribute('aria-hidden','true');
   const focused=document.activeElement;
   if(focused&&modal.contains(focused)&&typeof focused.blur==='function')focused.blur();
   return true;
 }
 document.addEventListener('click',e=>{
   const target=e.target instanceof Element?e.target:null;
   if(!target)return;
   const modal=target.closest('.modal-backdrop.active');
   if(!modal)return;
   const button=target.closest('button');
   const closeButton=!!button&&modal.contains(button)&&(button.matches('[data-finora-close-modal]')||/^(?:✕|×|\u2715)?\s*(?:بستن|انصراف)\s*(?:✕|×)?$/.test((button.textContent||'').trim()));
   if(closeButton||target===modal){
     e.preventDefault();
     e.stopImmediatePropagation();
     dismissModal(modal);
   }
 },true);

 const THEME_CSS=`body.finora-theme-dark{--bg:#07111f;--surface:#0f1b2d;--card:#122238;--text:#e6edf7;--text-muted:#9db0c9;--border:#263a55;--primary:#22b8c7;color:var(--text);background:var(--bg)}body.finora-theme-dark .card,body.finora-theme-dark .modal-card,body.finora-theme-dark input,body.finora-theme-dark select,body.finora-theme-dark textarea{background:#122238!important;color:#e6edf7!important;border-color:#2b405d!important}body.finora-theme-dark table th,body.finora-theme-dark table td{border-color:#2b405d!important}body.finora-theme-dark .form-row[style*="background"]{background:#0d1a2c!important}`;
 function ensureThemeCss(){if($('finora-theme-r2-css'))return;const s=document.createElement('style');s.id='finora-theme-r2-css';s.textContent=THEME_CSS;document.head.appendChild(s)}
 function resolveTheme(mode){if(mode==='dark'||mode==='light')return mode;const h=new Date().getHours();return h>=7&&h<19?'light':'dark'}
 window.finoraApplyTheme=function(){ensureThemeCss();const mode=getMySettings()?.ui_theme||'auto',r=resolveTheme(mode);document.body.classList.toggle('finora-theme-dark',r==='dark');document.documentElement.dataset.finoraTheme=r}
 function saveExperience(){
   if(!requireWrite())return;const s=getMySettings();s.ui_theme=$('finora-theme-select').value;s.hotkey_ctrl_s=$('finora-hotkey-ctrls').checked;s.hotkey_ctrl_enter=$('finora-hotkey-ctrlenter').checked;s.hotkey_enter_save=$('finora-hotkey-enter').checked;s.hotkey_quick_zeros=$('finora-hotkey-zeros').checked;saveDatastore();finoraApplyTheme();alert('تنظیمات تجربه کاربری ذخیره شد.');
 }
 window.finoraSaveExperienceSettings=saveExperience;
 function activeSave(){
   const v=document.querySelector('.view-pane.active')?.id;if(v==='view-invoices'&&typeof commitSaveInvoice==='function')return commitSaveInvoice();if(v==='view-purchases'&&typeof purSave==='function')return purSave();if(v==='view-products'&&typeof commitSaveProduct==='function')return commitSaveProduct();if(v==='view-contacts'&&typeof commitSaveContact==='function')return commitSaveContact();if(v==='view-journal'&&typeof jeSaveManual==='function')return jeSaveManual();if(v==='view-settings'&&typeof commitSaveDefaultSettings==='function')return commitSaveDefaultSettings();
 }
 // F2 saves the *active entry form*, never posts the accounting journal or clicks destructive actions.
 // Use the form's original validation/save function so its exact rejection reason remains visible.
 let f2Running=false;
 function f2Error(message){alert(message);return false}
 async function f2ConfirmCurrentForm(){
   if(f2Running)return false;
   if(!currentUser)return f2Error('ابتدا وارد حساب کاربری شوید.');
   if(document.querySelector('.modal-backdrop.active'))return f2Error('این پنجره تأیید اختصاصی دارد. برای جلوگیری از عملیات ناخواسته، دکمه ثبت همان پنجره را انتخاب کنید.');
   const view=document.querySelector('.view-pane.active')?.id;
   if(!view)return f2Error('هیچ فرم فعالی برای تأیید پیدا نشد.');
   const ids={
     'view-invoices':'commitSaveInvoice',
     'view-purchases':'purSave',
     'view-products':'commitSaveProduct',
     'view-contacts':'commitSaveContact',
     'view-cheques':'commitSaveCheque',
     'view-expenses':'commitSaveExpense',
     'view-journal':'jeSaveManual',
     'view-settings':'commitSaveDefaultSettings'
   };
   const handler=window[ids[view]];
   if(typeof handler!=='function')return f2Error('در این صفحه، فرم قابل ذخیره‌ای برای کلید F2 تعریف نشده است.');
   // Do not turn approval of the manual voucher or a sales invoice into an implicit posting.
   if(view==='view-journal'&&document.querySelector('[data-finora-task="documents"]')?.getClientRects().length>0)
     return f2Error('قطعی‌سازی سند مالی فقط از مدیریت اسناد و با تأیید صریح انجام می‌شود؛ F2 برای ثبت پیش‌نویس است.');
   // Accessible native inputs supply field-specific errors before any write is attempted.
   const visibleView=document.getElementById(view);
   const invalid=[...(visibleView?.querySelectorAll('input,select,textarea')||[])].find(el=>{
     if(el.disabled||el.type==='hidden'||el.closest('[hidden]'))return false;
     if(el.offsetParent===null&&!el.getClientRects().length)return false;
     return typeof el.checkValidity==='function'&&!el.checkValidity();
   });
   if(invalid){invalid.focus();return f2Error('اطلاعات این فیلد معتبر نیست: '+(invalid.labels?.[0]?.textContent?.trim()||invalid.placeholder||invalid.id||'فیلد انتخاب‌شده'))}
   if(view==='view-products'&&!$('prod-name-input')?.value.trim())return f2Error('عنوان کالا یا خدمت الزامی است.');
   if(view==='view-contacts'&&!$('contact-name-input')?.value.trim())return f2Error('نام طرف حساب الزامی است.');
   if(view==='view-invoices'){
     const items=[...document.querySelectorAll('#invoice-items-table-body tr')];
     if(!items.some(row=>row.querySelector('.row-product-select')?.value&&Number(row.querySelector('.row-quantity')?.value)>0))
       return f2Error('حداقل یک کالا یا خدمت معتبر و تعداد بیشتر از صفر انتخاب کنید.');
   }
   if(view==='view-purchases'){
     const items=[...document.querySelectorAll('#pur-items-body tr')];
     if(!items.some(row=>row.querySelector('.pur-prod')?.value&&Number(row.querySelector('.pur-qty')?.value)>0))
       return f2Error('حداقل یک ردیف کالا یا خدمت با تعداد معتبر وارد کنید.');
     if(!$('pur-supplier')?.value)return f2Error('تأمین‌کننده را انتخاب کنید.');
   }
   // Unlike sales drafts, the current purchase Save posts its financial voucher.
   // Require an explicit second confirmation rather than silently posting through a hotkey.
   if(view==='view-purchases'&&!confirm('ثبت فاکتور خرید در نسخه فعلی سند حسابداری را قطعی می‌کند. با ثبت قطعی موافقید؟'))
     return f2Error('عملیات متوقف شد؛ قطعی‌سازی خرید نیازمند تأیید صریح است.');
   f2Running=true;
   try{await Promise.resolve(handler());return true}
   catch(error){return f2Error('فرم ذخیره نشد: '+(error?.message||String(error)))}
   finally{f2Running=false}
 }
 window.finoraConfirmActiveFormF2=f2ConfirmCurrentForm;
 document.addEventListener('keydown',e=>{
   const s=typeof getMySettings==='function'?getMySettings():{};if(e.key==='F2'&&!e.altKey&&!e.ctrlKey&&!e.metaKey){e.preventDefault();e.stopPropagation();if(!e.repeat)void f2ConfirmCurrentForm();return}if(e.key==='Escape'){if(closeTopModal()){e.preventDefault();return}}
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&s.hotkey_ctrl_s!==false){e.preventDefault();activeSave();return}
   if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&s.hotkey_ctrl_enter!==false){e.preventDefault();activeSave();return}
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
   const s=getMySettings(),exp=document.createElement('div');exp.id='finora-experience-card';exp.className='accordion-item open';exp.dataset.finoraTask='experience';exp.innerHTML='<div class="accordion-header" onclick="toggleAccordion(this)"><span>⌨ ظاهر و میانبرهای صفحه‌کلید</span><span>▼</span></div><div class="accordion-body"><div class="form-row"><div class="form-group"><label>تم ظاهری</label><select id="finora-theme-select" class="form-control"><option value="auto">خودکار (روز روشن / شب تاریک)</option><option value="light">روشن</option><option value="dark">تاریک</option></select></div></div><label><input type="checkbox" id="finora-hotkey-ctrls"> Ctrl+S برای ذخیره</label><br><label><input type="checkbox" id="finora-hotkey-ctrlenter"> Ctrl+Enter برای ذخیره</label><br><strong>F2 برای ذخیره یا تأیید فرم فعال</strong> (بدون قطعی‌کردن خودکار اسناد مالی)<br><label><input type="checkbox" id="finora-hotkey-enter"> Enter برای ذخیره فرم فعال</label><br><label><input type="checkbox" id="finora-hotkey-zeros"> + افزودن سه صفر و − افزودن دو صفر در فیلد مبلغ</label><p class="af-hint">Escape همیشه پنجره باز را می‌بندد. میانبرهای عددی فقط داخل فیلدهای مبلغ عمل می‌کنند.</p><button class="btn btn-primary" onclick="finoraSaveExperienceSettings()">ذخیره تنظیمات</button></div>';root.insertBefore(exp,root.firstElementChild?.nextSibling||null);
   $('finora-theme-select').value=s.ui_theme||'auto';$('finora-hotkey-ctrls').checked=s.hotkey_ctrl_s!==false;$('finora-hotkey-ctrlenter').checked=s.hotkey_ctrl_enter!==false;$('finora-hotkey-enter').checked=!!s.hotkey_enter_save;$('finora-hotkey-zeros').checked=!!s.hotkey_quick_zeros;
   const ex=document.createElement('div');ex.className='accordion-item';ex.dataset.finoraTask='excel-templates';ex.innerHTML='<div class="accordion-header" onclick="toggleAccordion(this)"><span>▦ قالب‌های Excel و فیلدهای قابل انتخاب</span><span>▼</span></div><div class="accordion-body"><div class="form-group"><label>نوع قالب</label><select id="finora-excel-type" class="form-control" onchange="finoraRenderExcelFields()"><option value="products">کالا و خدمات</option><option value="contacts">اشخاص</option><option value="accounts">کدینگ حساب‌ها</option><option value="saleItems">اقلام فاکتور فروش</option><option value="purchaseItems">اقلام فاکتور خرید</option></select></div><div id="finora-excel-fields"></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="finoraSaveExcelFields()">ذخیره فیلدها</button><button class="btn btn-secondary" onclick="finoraDownloadConfiguredTemplate(document.getElementById(\'finora-excel-type\').value)">دانلود قالب نمونه</button><button class="btn btn-secondary" onclick="finoraExportConfiguredData(document.getElementById(\'finora-excel-type\').value)">خروجی داده‌های فعلی</button></div></div>';root.appendChild(ex);renderExcelFields();
   const st=document.createElement('div');st.className='accordion-item';st.dataset.finoraTask='data-stats';st.innerHTML='<div class="accordion-header" onclick="toggleAccordion(this)"><span>◎ آمار داده‌های شرکت فعال</span><span>▼</span></div><div class="accordion-body"><div id="finora-data-stats"></div><button class="btn btn-secondary" style="margin-top:10px" onclick="finoraRefreshDataStats()">به‌روزرسانی آمار</button></div>';root.appendChild(st);finoraRefreshDataStats();
 }
 window.finoraOpenInvoiceType=function(type){if(type==='purchase'){if(typeof navigateShell==='function')navigateShell('commerce','view-purchases');else switchView('view-purchases');return}if(typeof navigateShell==='function')navigateShell('commerce','view-invoices');else switchView('view-invoices');const kind=$('invoice-kind');if(kind){kind.value=type==='pre_invoice'?'pre_invoice':type==='contract_statement'?'contract_statement':'non_formal';if(typeof handleInvoiceKindChange==='function')handleInvoiceKindChange()}}
 const oldProductTpl=window.downloadProductsExcelTemplate,oldContactTpl=window.downloadContactsExcelTemplate;window.downloadProductsExcelTemplate=()=>finoraDownloadConfiguredTemplate('products');window.downloadContactsExcelTemplate=()=>finoraDownloadConfiguredTemplate('contacts');
 window.downloadAccountsExcelTemplate=()=>finoraDownloadConfiguredTemplate('accounts');window.downloadInvoiceItemsExcelTemplate=()=>finoraDownloadConfiguredTemplate('saleItems');window.purDownloadExcelTemplate=()=>finoraDownloadConfiguredTemplate('purchaseItems');
 function boot(){installSettings();enhanceAll();finoraApplyTheme();finoraRefreshDataStats()}
 const oldRefresh=window.refreshAllSurfaces;if(typeof oldRefresh==='function')window.refreshAllSurfaces=function(){const r=oldRefresh.apply(this,arguments);setTimeout(boot,0);return r};
 document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0));setInterval(()=>{if((getMySettings()?.ui_theme||'auto')==='auto')finoraApplyTheme()},15*60*1000);
})();
