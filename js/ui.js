function installDesktopScrollOwnershipStyles(){
  if(document.getElementById('finora-scroll-ownership-style'))return;
  const style=document.createElement('style');
  style.id='finora-scroll-ownership-style';
  style.textContent=`
@media (min-width:821px){
  html,body{height:100%;overflow-y:hidden!important}
  .app-root{height:100vh;min-height:0;overflow:hidden}
  .module-rail,.module-panel-links,.main-surface{direction:rtl;overscroll-behavior:contain;scrollbar-gutter:stable}
  .module-rail>*,.module-panel-links>*,.main-surface>*{direction:rtl}
  .main-surface{height:100vh;overflow-y:auto;scrollbar-width:thin}
}
@media (max-width:820px){
  .app-root{height:auto;min-height:100vh;overflow-x:hidden}
  .main-surface,.shell-panel-collapsed .main-surface{height:auto;overflow-y:visible;direction:rtl}
}
@media print{
  html,body,.app-root{height:auto!important;overflow:visible!important}
  .main-surface{height:auto!important;overflow:visible!important;direction:rtl!important}
}`;
  document.head.appendChild(style);
}
installDesktopScrollOwnershipStyles();

function switchView(viewId){
  document.querySelectorAll('.view-pane').forEach(el=>el.classList.remove('active'));
  const target=document.getElementById(viewId);
  if(target)target.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(btn=>btn.classList.toggle('active',btn.getAttribute('data-view')===viewId));
  document.querySelectorAll('.dock-tab').forEach(dock=>dock.classList.toggle('active',dock.dataset.view===viewId));
  if(viewId==='view-admin')renderAdminPanel();
  if(viewId==='view-reports')renderFinancialReports();
  if(viewId==='view-accounting-reports'&&window.P6Reports)P6Reports.render();
  if(typeof syncShellForView==='function')syncShellForView(viewId);
  if(typeof applyWorkspaceTask==='function')applyWorkspaceTask(viewId,'');
  const workspace=document.querySelector('.main-surface');
  if(window.matchMedia('(min-width:821px)').matches&&workspace)workspace.scrollTo({top:0,behavior:'smooth'});else window.scrollTo({top:0,behavior:'smooth'});
}
function toggleAccordion(headerEl){headerEl.parentElement.classList.toggle('open');}
function refreshAllSurfaces(){
  const dashDate=document.getElementById('dashboard-date-display');
  if(dashDate)dashDate.innerText=getJalaliDate();
  const invDate=document.getElementById('invoice-date-input');
  if(invDate&&!invDate.value)invDate.value=getJalaliNumeric();
  updateLicenseDisplay(currentUser);
  renderCompanies();renderContacts();renderProducts();renderInvoices();
  renderDashboard();renderCheques();renderExpenses();if(typeof renderAccountingFoundation==='function')renderAccountingFoundation();if(typeof renderPhase4==='function')renderPhase4();const p5Active=document.querySelector('.view-pane.active')?.id;if(typeof p5Render==='function'&&['view-inventory','view-assets','view-currency','view-data-center','view-integrations'].includes(p5Active))p5Render(p5Active);
  applyDefaultSettingsToForm();if(typeof p5PopulateWarehouseSelects==='function')p5PopulateWarehouseSelects();
  handleContactEntityChange();
  handleCurrencyModeChange();
  refreshCurrencyLabels();
}
function formatEntityName(rawName,entityType,customPrefix=''){
  let trimmed=(rawName||'').trim();
  if(entityType==='legal'){
    if(!trimmed.startsWith('شرکت')&&!trimmed.startsWith('موسسه')&&!trimmed.startsWith('سازمان')&&!trimmed.startsWith('اداره'))trimmed='شرکت '+trimmed;
  }else if(entityType==='natural'&&customPrefix){
    if(!trimmed.startsWith(customPrefix))trimmed=customPrefix+' '+trimmed;
  }
  return trimmed;
}
function applyEntityTypeToForm(entity,opts){
  const {prefixId,nameId,econId,regId,nationalLabelId}=opts;
  const prefixBox=document.getElementById(prefixId);
  const nameBox=document.getElementById(nameId);
  const econBox=document.getElementById(econId);
  const regBox=document.getElementById(regId);
  const natLabel=document.getElementById(nationalLabelId);
  if(entity==='legal'){
    if(prefixBox)prefixBox.style.display='none';
    if(nameBox)nameBox.style.gridColumn='span 3';
    if(econBox)econBox.style.display='block';
    if(regBox)regBox.style.display='block';
    if(natLabel)natLabel.innerText='شناسه ملی';
  }else{
    if(prefixBox)prefixBox.style.display='block';
    if(nameBox)nameBox.style.gridColumn='span 2';
    if(econBox)econBox.style.display='none';
    if(regBox)regBox.style.display='none';
    if(econBox){const input=econBox.querySelector('input,select,textarea');if(input)input.value='';}
    if(regBox){const input=regBox.querySelector('input,select,textarea');if(input)input.value='';}
    if(natLabel)natLabel.innerText='کد ملی';
  }
}
function handleContactEntityChange(){const el=document.getElementById('contact-entity-type');if(!el)return;applyEntityTypeToForm(el.value,{prefixId:'box-contact-prefix',nameId:'box-contact-name',econId:'box-contact-economic',regId:'box-contact-reg',nationalLabelId:'label-contact-national'});}
function handleQuickCEntityChange(){const el=document.getElementById('quick-c-entity');if(!el)return;applyEntityTypeToForm(el.value,{prefixId:'box-quick-c-prefix',nameId:'box-quick-c-name',econId:'box-quick-c-economic',regId:'box-quick-c-reg',nationalLabelId:'label-quick-c-national'});}


/* Enterprise two-tier navigation shell — IA v2 */
const FINORA_MODULES={
  dashboard:{title:'داشبورد',context:'نمای مدیریتی و دسترسی سریع',groups:[{title:'نمای کلی',items:[['داشبورد','view-dashboard','⌂','','overview']]}]},
  accounting:{title:'حسابداری',context:'ساختار مالی، ثبت، دفاتر و صورت‌های مالی',groups:[
    {title:'ساختار مالی',items:[['کدینگ حساب‌ها','view-accounting-foundation','▦','','accounts'],['تفصیلی‌های شناور','view-accounting-foundation','⌘','','dimensions'],['قواعد حساب و تفصیلی','view-accounting-foundation','≡','','rules'],['سال‌های مالی','view-accounting-foundation','▣','','fiscal'],['شعب','view-accounting-foundation','⌂','','branches'],['مراکز هزینه','view-data-center','◎','','cost-centers'],['ارز و نرخ تبدیل','view-currency','¤']]},
    {title:'ثبت و عملیات',items:[['ثبت سند حسابداری','view-journal','＋','','new'],['فهرست اسناد حسابداری','view-journal','▤','','register'],['هزینه و درآمد','view-expenses','◌']]},
    {title:'دفاتر و کنترل',items:[['تراز آزمایشی','view-accounting-reports','▥','','trial'],['دفتر کل / معین / تفصیلی','view-accounting-reports','▤','','ledger']]},
    {title:'صورت‌های مالی و تحلیل',items:[['صورت‌های مالی','view-accounting-reports','◫','','financials'],['جریان وجوه نقد','view-accounting-reports','↕','','cashflow'],['سن مطالبات و بدهی‌ها','view-accounting-reports','◷','','aging']]}
  ]},
  commerce:{title:'بازرگانی',context:'اشخاص، کالا، فروش و خرید',groups:[{title:'اشخاص و کالا',items:[['اشخاص','view-contacts','◎'],['کالا و خدمات','view-products','◇']]},{title:'فروش',items:[['فاکتور فروش','view-invoices','▤']]},{title:'خرید و تأمین',items:[['فاکتور خرید','view-purchases','▣']]}]},
  treasury:{title:'خزانه‌داری',context:'دریافت، پرداخت، چک و کنترل نقدینگی',groups:[{title:'عملیات',items:[['دریافت و پرداخت','view-payments','↔'],['چک‌ها و صیاد','view-cheques','◈']]},{title:'کنترل',items:[['سن مطالبات و بدهی‌ها','view-accounting-reports','◷','','aging'],['جریان وجوه نقد','view-accounting-reports','↕','','cashflow']]}]},
  projects:{title:'پیمان‌ها',context:'پیمان، پروژه/کارگاه، کسورات، تضمین و صورت‌وضعیت',groups:[{title:'اطلاعات پایه',items:[['پروژه‌ها و کارگاه‌ها','view-accounting-foundation','▧','','projects']]},{title:'عملیات پیمان',items:[['پیمان‌ها و قراردادهای اجرایی','view-contracting','▦']]},{title:'گزارش',items:[['گزارش پیمان و پروژه','view-accounting-reports','▥','','projects']]}]},
  inventory:{title:'انبار',context:'انبار، گردش، شمارش و بهای موجودی',groups:[{title:'اطلاعات پایه',items:[['تعریف انبار','view-inventory','▦','','warehouse']]},{title:'عملیات',items:[['گردش انبار','view-inventory','⇄','','movement'],['انبارگردانی','view-inventory','✓','','count']]},{title:'گزارش و کنترل',items:[['موجودی و بهای میانگین','view-inventory','▥','','stock']]}]},
  assets:{title:'دارایی ثابت',context:'دارایی، استهلاک و ارزش دفتری',groups:[{title:'اطلاعات پایه',items:[['ثبت دارایی','view-assets','◆','','asset-new']]},{title:'عملیات و دفاتر',items:[['دفتر دارایی‌ها','view-assets','▤','','asset-register'],['استهلاک و سوابق','view-assets','◷','','depreciation']]}]},
  enterprise:{title:'سازمان',context:'منابع انسانی، حقوق، خزانه، بهای تمام‌شده و کنترل گروه',groups:[{title:'منابع انسانی',items:[['کارکنان','view-enterprise','♙','','employees'],['قرارداد کار و پایان‌کار','view-enterprise','▤','','contracts'],['مرخصی و ذخیره','view-enterprise','◷','','leave'],['حقوق، بیمه و مالیات','view-enterprise','▥','','payroll'],['تعهدات کارکنان','view-enterprise','◌','','benefits']]},{title:'خزانه تکمیلی',items:[['صندوق و تعریف تنخواه','view-enterprise','¤','','treasury'],['عملیات تنخواه و تسویه','view-enterprise','↔','','pettyops']]},{title:'کنترل مدیریت',items:[['بودجه عملکرد و ABC','view-enterprise','◎','','costing'],['گروه، نقدینگی و فی‌مابین','view-enterprise','▦','','group']]},{title:'انطباق',items:[['رجیستری قوانین و استانداردها','view-enterprise','✓','','compliance']]}]},
  reports:{title:'گزارش‌ها',context:'گزارش‌های حسابداری و مدیریتی',groups:[{title:'مدیریتی',items:[['گزارش‌های عملیاتی','view-reports','▥']]},{title:'حسابداری',items:[['تراز آزمایشی','view-accounting-reports','▥','','trial'],['دفاتر حسابداری','view-accounting-reports','▤','','ledger'],['صورت‌های مالی','view-accounting-reports','◫','','financials'],['جریان وجوه نقد','view-accounting-reports','↕','','cashflow'],['سن مطالبات / بدهی','view-accounting-reports','◷','','aging'],['پروژه / پیمان','view-accounting-reports','▧','','projects']]}]},
  settings:{title:'تنظیمات',context:'شرکت، داده، دسترسی و یکپارچه‌سازی',groups:[{title:'حساب و شرکت',items:[['شرکت‌ها','view-settings','▦','','company'],['حساب کاربری و رمز','view-settings','♙','','account'],['پیش‌فرض فاکتور','view-settings','▤','','invoice-defaults']]},{title:'عملیات و داده',items:[['تنظیمات عملیاتی','view-data-center','◌','','ops-settings'],['ورود/خروج داده و پشتیبان','view-data-center','⇅','','data-backup']]},{title:'یکپارچه‌سازی',items:[['اتصالات و API','view-integrations','⇆']]},{title:'سیستم',items:[['درباره فینورا','view-settings','ⓘ','','about'],['کاربران و لایسنس','view-admin','♙','admin']]}]}
};
const FINORA_VIEW_HOME={
  'view-dashboard':'dashboard','view-journal':'accounting','view-accounting-foundation':'accounting','view-accounting-reports':'accounting','view-currency':'accounting',
  'view-invoices':'commerce','view-purchases':'commerce','view-expenses':'accounting','view-contacts':'commerce','view-products':'commerce',
  'view-payments':'treasury','view-cheques':'treasury','view-contracting':'projects','view-inventory':'inventory','view-assets':'assets','view-enterprise':'enterprise',
  'view-reports':'reports','view-data-center':'settings','view-integrations':'settings','view-settings':'settings','view-admin':'settings'
};
const FINORA_COMMANDS=Object.entries(FINORA_MODULES).flatMap(([module,m])=>m.groups.flatMap(g=>g.items.map(i=>({module,moduleTitle:m.title,groupTitle:g.title,title:i[0],view:i[1],icon:i[2],guard:i[3]||'',task:i[4]||''}))));
let FINORA_ACTIVE_TASK='';
function canShowShellCommand(cmd){
  // Admin-only entries are shown based on the verified role of the signed-in user
  // (server-side RLS/RPC still enforces the real permission).
  if(cmd.guard==='admin')return !!(typeof currentUser!=='undefined'&&currentUser&&currentUser.role==='admin');
  return true;
}
function renderModulePanel(moduleKey,activeView,activeTask=''){
  const m=FINORA_MODULES[moduleKey]||FINORA_MODULES.dashboard;
  const title=document.getElementById('module-panel-title'),box=document.getElementById('module-panel-links');
  if(title)title.textContent=m.title;
  if(!box)return;
  box.innerHTML=m.groups.map(g=>'<div class="module-group"><div class="module-group-title">'+g.title+'</div>'+g.items.filter(i=>canShowShellCommand({guard:i[3]||''})).map(i=>{const task=i[4]||'',active=i[1]===activeView&&task===activeTask;return '<button class="module-link '+(active?'active':'')+'" data-view="'+i[1]+'" data-task="'+task+'" onclick="navigateShell(\''+moduleKey+'\',\''+i[1]+'\',\''+task+'\')"><span class="mi">'+i[2]+'</span><span>'+i[0]+'</span></button>'}).join('')+'</div>').join('');
}
function updateShellContext(moduleKey,viewId,task=''){
  const m=FINORA_MODULES[moduleKey]||FINORA_MODULES.dashboard;
  const cmd=FINORA_COMMANDS.find(x=>x.module===moduleKey&&x.view===viewId&&x.task===task)||FINORA_COMMANDS.find(x=>x.module===moduleKey&&x.view===viewId);
  const wt=document.getElementById('workspace-title'),wc=document.getElementById('workspace-context-text');
  if(wt)wt.textContent=cmd?cmd.title:m.title;
  if(wc)wc.textContent=(cmd&&cmd.groupTitle?cmd.groupTitle+' · ':'')+(m.context||'');
  try{
    const companies=typeof getMyCompanies==='function'?getMyCompanies():[];
    const settings=typeof getMySettings==='function'?getMySettings():{};
    const active=companies.find(x=>x.id===settings.default_company_id)||companies[0];
    const cb=document.getElementById('topbar-company');if(cb)cb.textContent=active?.name||'انتخاب شرکت';
  }catch(_){}
  const fy=document.getElementById('topbar-fiscal-year');
  if(fy){try{const y=typeof getJalaliNumeric==='function'?String(getJalaliNumeric()).split('/')[0]:'';fy.textContent=y?'سال مالی '+y:'سال مالی جاری';}catch(_){fy.textContent='سال مالی جاری';}}
}
function tagDynamicTaskCards(viewId){
  const maps={
    'view-inventory':{'تعریف انبار':'warehouse','گردش انبار':'movement','انبارگردانی':'count','موجودی و بهای میانگین موزون':'stock'},
    'view-assets':{'ثبت دارایی ثابت':'asset-new','دفتر دارایی‌ها':'asset-register','سوابق استهلاک':'depreciation'},
    'view-data-center':{'تنظیمات عملیاتی و دسترسی شرکت':'ops-settings','مراکز هزینه و تحلیل':'cost-centers','مرکز ورود، اکسل و پشتیبان':'data-backup'}
  },map=maps[viewId];if(!map)return;
  document.querySelectorAll('#'+viewId+' .card').forEach(card=>{const h=card.querySelector('h3')?.textContent?.trim();if(map[h])card.dataset.finoraTask=map[h]});
}
function applyWorkspaceTask(viewId,task=''){
  FINORA_ACTIVE_TASK=task||'';tagDynamicTaskCards(viewId);
  const root=document.getElementById(viewId);if(!root)return;
  const nodes=[...root.querySelectorAll('[data-finora-task]')];
  nodes.forEach(el=>{const tasks=String(el.dataset.finoraTask||'').split(/\s+/);el.style.display=!task||tasks.includes('all')||tasks.includes(task)?'':'none'});
}
function openModule(moduleKey,defaultView,defaultTask=''){
  document.querySelectorAll('.module-tab').forEach(x=>x.classList.toggle('active',x.dataset.module===moduleKey));
  if(defaultView)navigateShell(moduleKey,defaultView,defaultTask,true);else renderModulePanel(moduleKey,'','');
}
function navigateShell(moduleKey,viewId,task='',rerender=true){
  if(viewId==='view-journal'&&typeof ensureJournalView==='function')ensureJournalView();
  switchView(viewId);
  if(viewId==='view-payments'&&typeof renderPayments==='function')renderPayments();
  if(viewId==='view-journal'&&typeof renderJournal==='function')renderJournal();
  if(viewId==='view-accounting-foundation'&&typeof renderAccountingFoundation==='function')renderAccountingFoundation();
  if(viewId==='view-accounting-reports'&&window.P6Reports)P6Reports.render();
  if(viewId==='view-contracting'&&typeof renderPhase4==='function')renderPhase4();
  if(viewId==='view-enterprise'&&typeof enterpriseRender==='function')enterpriseRender(task||'employees');
  if(['view-inventory','view-assets','view-currency','view-data-center','view-integrations'].includes(viewId)&&typeof p5Render==='function')p5Render(viewId);
  applyWorkspaceTask(viewId,task);
  if(rerender)renderModulePanel(moduleKey,viewId,task);
  document.querySelectorAll('.module-tab').forEach(x=>x.classList.toggle('active',x.dataset.module===moduleKey));
  updateShellContext(moduleKey,viewId,task);
  closeCommandSearch();
}
function syncModulePanelHandle(){
  const collapsed=document.body.classList.contains('shell-panel-collapsed'),h=document.getElementById('module-panel-handle');
  if(!h)return;h.textContent=collapsed?'‹':'›';h.setAttribute('aria-expanded',collapsed?'false':'true');h.setAttribute('aria-label',collapsed?'باز کردن پنل زیرسیستم':'جمع کردن پنل زیرسیستم');
}
function toggleModulePanel(){
  document.body.classList.toggle('shell-panel-collapsed');
  const collapsed=document.body.classList.contains('shell-panel-collapsed');
  const p=document.getElementById('module-panel');if(p)p.classList.toggle('collapsed',collapsed);
  syncModulePanelHandle();
  try{localStorage.setItem('finora.shell.panelCollapsed',collapsed?'1':'0');}catch(_){}
}
function toggleQuickCreateMenu(event){
  if(event)event.stopPropagation();const m=document.getElementById('quick-create-menu'),b=document.getElementById('quick-create-toggle');if(!m)return;
  const open=!m.classList.contains('open');m.classList.toggle('open',open);if(b)b.setAttribute('aria-expanded',open?'true':'false');
}
function closeQuickCreateMenu(){const m=document.getElementById('quick-create-menu'),b=document.getElementById('quick-create-toggle');if(m)m.classList.remove('open');if(b)b.setAttribute('aria-expanded','false');}
function renderCommandSearch(query){
  const box=document.getElementById('command-search-results');if(!box)return;
  const q=(query||'').trim().toLowerCase();
  if(!q){closeCommandSearch();return;}
  const matches=FINORA_COMMANDS.filter(canShowShellCommand).filter(x=>(x.title+' '+x.moduleTitle).toLowerCase().includes(q)).slice(0,8);
  box.innerHTML=matches.length?matches.map((x,n)=>'<div class="command-result" data-index="'+n+'" onclick="navigateShell(\''+x.module+'\',\''+x.view+'\',\''+(x.task||'')+'\')">'+x.icon+' '+x.title+' <small>'+x.moduleTitle+' · '+x.groupTitle+'</small></div>').join(''):'<div class="command-result">نتیجه‌ای در منو پیدا نشد</div>';
  box.classList.add('open');
}
function handleCommandSearchKey(e){
  if(e.key==='Escape'){closeCommandSearch();e.currentTarget.blur();return;}
  if(e.key==='Enter'){
    const q=(e.currentTarget.value||'').trim().toLowerCase();
    const x=FINORA_COMMANDS.filter(canShowShellCommand).find(x=>(x.title+' '+x.moduleTitle).toLowerCase().includes(q));
    if(x){e.preventDefault();navigateShell(x.module,x.view,x.task||'');}
  }
}
function closeCommandSearch(){const b=document.getElementById('command-search-results');if(b)b.classList.remove('open');}
function syncShellForView(viewId){
  const moduleKey=FINORA_VIEW_HOME[viewId]||'dashboard';FINORA_ACTIVE_TASK='';
  document.querySelectorAll('.module-tab').forEach(x=>x.classList.toggle('active',x.dataset.module===moduleKey));
  renderModulePanel(moduleKey,viewId,'');
  updateShellContext(moduleKey,viewId,'');
}
document.addEventListener('click',e=>{if(!e.target.closest('.global-search'))closeCommandSearch();if(!e.target.closest('.quick-create'))closeQuickCreateMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeQuickCreateMenu();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();const s=document.getElementById('global-command-search');if(s){s.focus();s.select();}}});
document.addEventListener('DOMContentLoaded',()=>{const rail=document.getElementById('module-rail');if(rail&&!rail.querySelector('[data-module="enterprise"]')){const b=document.createElement('button');b.className='module-tab';b.dataset.module='enterprise';b.dataset.view='view-enterprise';b.title='سازمان و منابع انسانی';b.innerHTML='<span>♙</span><b>سازمان</b>';b.onclick=()=>openModule('enterprise','view-enterprise','employees');const reports=rail.querySelector('[data-module="reports"]');rail.insertBefore(b,reports||null)}const s=document.createElement('script');s.src='js/enterprise-iran.js?v=20260930-iran-erp-v1';s.defer=true;document.body.appendChild(s);
  try{if(localStorage.getItem('finora.shell.panelCollapsed')==='1')document.body.classList.add('shell-panel-collapsed');}catch(_){}
  syncModulePanelHandle();
  renderModulePanel('dashboard','view-dashboard','overview');updateShellContext('dashboard','view-dashboard','overview');
});
