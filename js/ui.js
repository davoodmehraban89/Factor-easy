function switchView(viewId){
  document.querySelectorAll('.view-pane').forEach(el=>el.classList.remove('active'));
  const target=document.getElementById(viewId);
  if(target)target.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(btn=>btn.classList.toggle('active',btn.getAttribute('data-view')===viewId));
  const dockViews=['view-dashboard','view-invoices','view-products','view-contacts','view-cheques','view-settings'];
  document.querySelectorAll('.dock-tab').forEach((dock,idx)=>{dock.classList.toggle('active',dockViews[idx]===viewId);});
  if(viewId==='view-admin')renderAdminPanel();
  if(viewId==='view-reports')renderFinancialReports();
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
