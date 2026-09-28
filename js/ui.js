function switchView(viewId){
  document.querySelectorAll('.view-pane').forEach(el=>el.classList.remove('active'));
  const target=document.getElementById(viewId);
  if(target)target.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(btn=>btn.classList.toggle('active',btn.getAttribute('data-view')===viewId));
  document.querySelectorAll('.dock-tab').forEach(dock=>dock.classList.toggle('active',dock.dataset.view===viewId));
  if(viewId==='view-admin')renderAdminPanel();
  if(viewId==='view-reports')renderFinancialReports();\n  if(typeof syncShellForView==='function')syncShellForView(viewId);
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
  renderDashboard();renderCheques();renderExpenses();
  applyDefaultSettingsToForm();
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


/* Phase 1 scalable navigation shell */
const FINORA_MODULES={
  home:{title:'خانه',context:'نمای یکپارچه عملیات مالی',groups:[{title:'نمای کلی',items:[['داشبورد','view-dashboard','⌂']]}]},
  sales:{title:'فروش',context:'فاکتور، مشتری و کالا/خدمت',groups:[{title:'عملیات فروش',items:[['فاکتور فروش و اسناد','view-invoices','▤'],['اشخاص / مشتریان','view-contacts','◎']]},{title:'داده پایه',items:[['کالا و خدمات','view-products','◇']]}]},
  purchases:{title:'خرید',context:'خرید، تأمین‌کننده و هزینه',groups:[{title:'عملیات خرید',items:[['فاکتورهای خرید','view-purchases','▣'],['اشخاص / تأمین‌کنندگان','view-contacts','◎']]},{title:'کنترل',items:[['هزینه‌ها و درآمد','view-expenses','◌']]}]},
  treasury:{title:'خزانه‌داری',context:'دریافت، پرداخت و چک',groups:[{title:'عملیات روزانه',items:[['دریافت و پرداخت','view-payments','↔'],['چک‌ها و صیاد','view-cheques','◈']]},{title:'مرتبط',items:[['هزینه‌ها و درآمد','view-expenses','◌']]}]},
  people:{title:'اشخاص',context:'مشتریان، تأمین‌کنندگان و طرف‌حساب‌ها',groups:[{title:'مدیریت اشخاص',items:[['طرف‌حساب‌ها','view-contacts','◎']]}]},
  catalog:{title:'کالا و خدمات',context:'داده پایه کالا و خدمت',groups:[{title:'داده پایه',items:[['کالاها و خدمات','view-products','◇']]},{title:'گردش',items:[['فروش','view-invoices','▤'],['خرید','view-purchases','▣']]}]},
  reports:{title:'گزارش‌ها',context:'تحلیل مالی و مدیریتی',groups:[{title:'گزارش‌های موجود',items:[['گزارش‌های مالی','view-reports','▥'],['داشبورد تحلیلی','view-dashboard','⌂']]}]},
  settings:{title:'تنظیمات',context:'شرکت، پیکربندی و دسترسی',groups:[{title:'مدیریت',items:[['تنظیمات و شرکت‌ها','view-settings','⚙'],['مدیریت کاربران و لایسنس','view-admin','♙','admin']]}]}
};
const FINORA_VIEW_HOME={
  'view-dashboard':'home','view-invoices':'sales','view-purchases':'purchases','view-payments':'treasury',
  'view-cheques':'treasury','view-expenses':'treasury','view-contacts':'people','view-products':'catalog',
  'view-reports':'reports','view-settings':'settings','view-admin':'settings'
};
const FINORA_COMMANDS=Object.entries(FINORA_MODULES).flatMap(([module,m])=>m.groups.flatMap(g=>g.items.map(i=>({module,moduleTitle:m.title,title:i[0],view:i[1],icon:i[2],guard:i[3]||''}))));

function canShowShellCommand(cmd){
  if(cmd.guard==='admin'){
    const el=document.getElementById('menu-admin-panel');
    return !!el&&el.style.display!=='none';
  }
  return true;
}
function renderModulePanel(moduleKey,activeView){
  const m=FINORA_MODULES[moduleKey]||FINORA_MODULES.home;
  const title=document.getElementById('module-panel-title'),box=document.getElementById('module-panel-links');
  if(title)title.textContent=m.title;
  if(!box)return;
  box.innerHTML=m.groups.map(g=>'<div class="module-group"><div class="module-group-title">'+g.title+'</div>'+g.items.filter(i=>canShowShellCommand({guard:i[3]||''})).map(i=>'<button class="module-link '+(i[1]===activeView?'active':'')+'" data-view="'+i[1]+'" onclick="navigateShell(\''+moduleKey+'\',\''+i[1]+'\')"><span class="mi">'+i[2]+'</span><span>'+i[0]+'</span></button>').join('')+'</div>').join('');
}
function updateShellContext(moduleKey,viewId){
  const m=FINORA_MODULES[moduleKey]||FINORA_MODULES.home;
  const cmd=FINORA_COMMANDS.find(x=>x.module===moduleKey&&x.view===viewId);
  const wt=document.getElementById('workspace-title'),wc=document.getElementById('workspace-context-text');
  if(wt)wt.textContent=cmd?cmd.title:m.title;
  if(wc)wc.textContent=m.context||'';
  try{
    const companies=typeof getMyCompanies==='function'?getMyCompanies():[];
    const settings=typeof getMySettings==='function'?getMySettings():{};
    const active=companies.find(x=>x.id===settings.default_company_id)||companies[0];
    const cb=document.getElementById('topbar-company');if(cb)cb.textContent=active?.name||'انتخاب شرکت';
  }catch(_){}
  const fy=document.getElementById('topbar-fiscal-year');
  if(fy){
    try{const y=typeof getJalaliNumeric==='function'?String(getJalaliNumeric()).split('/')[0]:'';fy.textContent=y?'سال مالی '+y:'سال مالی جاری';}catch(_){fy.textContent='سال مالی جاری';}
  }
}
function openModule(moduleKey,defaultView){
  document.querySelectorAll('.module-tab').forEach(x=>x.classList.toggle('active',x.dataset.module===moduleKey));
  renderModulePanel(moduleKey,defaultView);
  if(defaultView)navigateShell(moduleKey,defaultView,false);
}
function navigateShell(moduleKey,viewId,rerender=true){
  switchView(viewId);
  if(viewId==='view-payments'&&typeof renderPayments==='function')renderPayments();
  if(rerender)renderModulePanel(moduleKey,viewId);
  document.querySelectorAll('.module-tab').forEach(x=>x.classList.toggle('active',x.dataset.module===moduleKey));
  updateShellContext(moduleKey,viewId);
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
    if(x){e.preventDefault();navigateShell(x.module,x.view);}
  }
}
function closeCommandSearch(){const b=document.getElementById('command-search-results');if(b)b.classList.remove('open');}
function syncShellForView(viewId){
  const moduleKey=FINORA_VIEW_HOME[viewId]||'home';
  document.querySelectorAll('.module-tab').forEach(x=>x.classList.toggle('active',x.dataset.module===moduleKey));
  renderModulePanel(moduleKey,viewId);
  updateShellContext(moduleKey,viewId);
}
document.addEventListener('click',e=>{if(!e.target.closest('.global-search'))closeCommandSearch();});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();const s=document.getElementById('global-command-search');if(s){s.focus();s.select();}}});
document.addEventListener('DOMContentLoaded',()=>{
  try{if(localStorage.getItem('finora.shell.panelCollapsed')==='1')document.body.classList.add('shell-panel-collapsed');}catch(_){}
  renderModulePanel('home','view-dashboard');updateShellContext('home','view-dashboard');
});
