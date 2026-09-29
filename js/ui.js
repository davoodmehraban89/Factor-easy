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
  window.scrollTo({top:0,behavior:'smooth'});
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
    if(natLabel)natLabel.innerText='کد ملی';
  }
}
function handleContactEntityChange(){const el=document.getElementById('contact-entity-type');if(!el)return;applyEntityTypeToForm(el.value,{prefixId:'box-contact-prefix',nameId:'box-contact-name',econId:'box-contact-economic',regId:'box-contact-reg',nationalLabelId:'label-contact-national'});}
function handleQuickCEntityChange(){const el=document.getElementById('quick-c-entity');if(!el)return;applyEntityTypeToForm(el.value,{prefixId:'box-quick-c-prefix',nameId:'box-quick-c-name',econId:'box-quick-c-economic',regId:'box-quick-c-reg',nationalLabelId:'label-quick-c-national'});}


/* Enterprise two-tier navigation shell — IA v2 */
const FINORA_MODULES={
  dashboard:{title:'داشبورد',context:'نمای مدیریتی و دسترسی سریع',groups:[{title:'نمای کلی',items:[['داشبورد','view-dashboard','⌂','','overview']]}]},
  accounting:{title:'حسابداری',context:'کدینگ، اسناد، دفاتر و کنترل مالی',groups:[
    {title:'اطلاعات پایه',items:[['کدینگ حساب‌ها','view-accounting-foundation','▦','','accounts'],['تفصیلی‌های شناور','view-accounting-foundation','⌘','','dimensions'],['قواعد حساب و تفصیلی','view-accounting-foundation','≡','','rules'],['سال‌های مالی','view-accounting-foundation','▣','','fiscal'],['شعب','view-accounting-foundation','⌂','','branches'],['ارز و نرخ تبدیل','view-currency','¤'],['مراکز هزینه','view-data-center','◎','','cost-centers']]},
    {title:'عملیات حسابداری',items:[['ثبت سند حسابداری','view-journal','＋','','new'],['فهرست اسناد حسابداری','view-journal','▤','','register']]},
    {title:'دفاتر و گزارش‌ها',items:[['تراز آزمایشی','view-accounting-reports','▥','','trial'],['دفتر کل / معین / تفصیلی','view-accounting-reports','▤','','ledger'],['صورت‌های مالی','view-accounting-reports','◫','','financials'],['جریان وجوه نقد','view-accounting-reports','↕','','cashflow'],['سن مطالبات و بدهی‌ها','view-accounting-reports','◷','','aging']]}
  ]},
  commerce:{title:'بازرگانی',context:'اشخاص، کالا، فروش و خرید',groups:[{title:'اطلاعات پایه',items:[['اشخاص','view-contacts','◎'],['کالا و خدمات','view-products','◇']]},{title:'فروش',items:[['فاکتور فروش','view-invoices','▤']]},{title:'خرید',items:[['فاکتور خرید','view-purchases','▣']]},{title:'کنترل',items:[['هزینه و درآمد','view-expenses','◌']]}]},
  treasury:{title:'خزانه‌داری',context:'دریافت، پرداخت و اسناد بانکی',groups:[{title:'عملیات',items:[['دریافت و پرداخت','view-payments','↔'],['چک‌ها و صیاد','view-cheques','◈']]}]},
  projects:{title:'پروژه و قرارداد',context:'پروژه، پیمان، کسورات، تضمین و صورت‌وضعیت',groups:[{title:'اطلاعات پایه',items:[['پروژه‌ها','view-accounting-foundation','▧','','projects']]},{title:'عملیات پیمان',items:[['قراردادها و پیمان','view-contracting','▦']]},{title:'گزارش',items:[['گزارش پروژه و پیمان','view-accounting-reports','▥','','projects']]}]},
  inventory:{title:'انبار',context:'انبار، گردش، شمارش و بهای موجودی',groups:[{title:'اطلاعات پایه',items:[['تعریف انبار','view-inventory','▦','','warehouse']]},{title:'عملیات',items:[['گردش انبار','view-inventory','⇄','','movement'],['انبارگردانی','view-inventory','✓','','count']]},{title:'گزارش و کنترل',items:[['موجودی و بهای میانگین','view-inventory','▥','','stock']]}]},
  assets:{title:'دارایی ثابت',context:'دارایی، استهلاک و ارزش دفتری',groups:[{title:'اطلاعات پایه',items:[['ثبت دارایی','view-assets','◆','','asset-new']]},{title:'عملیات و دفاتر',items:[['دفتر دارایی‌ها','view-assets','▤','','asset-register'],['استهلاک و سوابق','view-assets','◷','','depreciation']]}]},
  reports:{title:'گزارش‌ها',context:'گزارش‌های حسابداری و مدیریتی',groups:[{title:'مدیریتی',items:[['گزارش‌های عملیاتی','view-reports','▥']]},{title:'حسابداری',items:[['تراز آزمایشی','view-accounting-reports','▥','','trial'],['دفاتر حسابداری','view-accounting-reports','▤','','ledger'],['صورت‌های مالی','view-accounting-reports','◫','','financials'],['جریان وجوه نقد','view-accounting-reports','↕','','cashflow'],['سن مطالبات / بدهی','view-accounting-reports','◷','','aging'],['پروژه / پیمان','view-accounting-reports','▧','','projects']]}]},
  settings:{title:'تنظیمات',context:'شرکت، داده، دسترسی و یکپارچه‌سازی',groups:[{title:'شرکت و عملیات',items:[['شرکت‌ها و تنظیمات عمومی','view-settings','⚙'],['تنظیمات عملیاتی','view-data-center','◌','','ops-settings']]},{title:'داده و پشتیبان',items:[['ورود/خروج داده و پشتیبان','view-data-center','⇅','','data-backup']]},{title:'یکپارچه‌سازی',items:[['اتصالات و API','view-integrations','⇆']]},{title:'مدیریت',items:[['کاربران و لایسنس','view-admin','♙','admin']]}]}
};
const FINORA_VIEW_HOME={
  'view-dashboard':'dashboard','view-journal':'accounting','view-accounting-foundation':'accounting','view-accounting-reports':'accounting','view-currency':'accounting',
  'view-invoices':'commerce','view-purchases':'commerce','view-expenses':'commerce','view-contacts':'commerce','view-products':'commerce',
  'view-payments':'treasury','view-cheques':'treasury','view-contracting':'projects','view-inventory':'inventory','view-assets':'assets',
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
  renderModulePanel(moduleKey,defaultView,defaultTask);
  if(defaultView)navigateShell(moduleKey,defaultView,defaultTask,false);
}
function navigateShell(moduleKey,viewId,task='',rerender=true){
  switchView(viewId);
  if(viewId==='view-payments'&&typeof renderPayments==='function')renderPayments();
  if(viewId==='view-journal'&&typeof renderJournal==='function')renderJournal();
  if(viewId==='view-accounting-foundation'&&typeof renderAccountingFoundation==='function')renderAccountingFoundation();
  if(viewId==='view-accounting-reports'&&window.P6Reports)P6Reports.render();
  if(viewId==='view-contracting'&&typeof renderPhase4==='function')renderPhase4();
  if(['view-inventory','view-assets','view-currency','view-data-center','view-integrations'].includes(viewId)&&typeof p5Render==='function')p5Render(viewId);
  applyWorkspaceTask(viewId,task);
  if(rerender)renderModulePanel(moduleKey,viewId,task);
  document.querySelectorAll('.module-tab').forEach(x=>x.classList.toggle('active',x.dataset.module===moduleKey));
  updateShellContext(moduleKey,viewId,task);
  closeCommandSearch();
}
function toggleModulePanel(){
  document.body.classList.toggle('shell-panel-collapsed');
  const collapsed=document.body.classList.contains('shell-panel-collapsed');
  const p=document.getElementById('module-panel');if(p)p.classList.toggle('collapsed',collapsed);
  try{localStorage.setItem('finora.shell.panelCollapsed',collapsed?'1':'0');}catch(_){}
}
function renderCommandSearch(query){
  const box=document.getElementById('command-search-results');if(!box)return;
  const q=(query||'').trim().toLowerCase();
  if(!q){closeCommandSearch();return;}
  const matches=FINORA_COMMANDS.filter(canShowShellCommand).filter(x=>(x.title+' '+x.moduleTitle).toLowerCase().includes(q)).slice(0,8);
  box.innerHTML=matches.length?matches.map((x,n)=>'<div class="command-result" data-index="'+n+'" onclick="navigateShell(\''+x.module+'\',\''+x.view+'\')">'+x.icon+' '+x.title+' <small>'+x.moduleTitle+'</small></div>').join(''):'<div class="command-result">نتیجه‌ای در منو پیدا نشد</div>';
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
document.addEventListener('click',e=>{if(!e.target.closest('.global-search'))closeCommandSearch();});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();const s=document.getElementById('global-command-search');if(s){s.focus();s.select();}}});
document.addEventListener('DOMContentLoaded',()=>{
  try{if(localStorage.getItem('finora.shell.panelCollapsed')==='1')document.body.classList.add('shell-panel-collapsed');}catch(_){}
  renderModulePanel('dashboard','view-dashboard','overview');updateShellContext('dashboard','view-dashboard','overview');
});
