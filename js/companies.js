let editingCompanyId='';
const COMPANY_ACTIVITY_LABELS={trading:'بازرگانی',service:'خدماتی',manufacturing:'تولیدی',contracting:'پیمانکاری',retail:'فروشگاهی',distribution:'پخش',nonprofit:'غیرانتفاعی',professional:'خدمات حرفه‌ای'};
const COMPANY_LEGAL_FORM_LABELS={natural_person:'شخص حقیقی',private_joint_stock:'سهامی خاص',public_joint_stock:'سهامی عام',limited_liability:'با مسئولیت محدود',general_partnership:'تضامنی',relative_partnership:'نسبی',mixed_non_stock:'مختلط غیرسهامی',mixed_stock:'مختلط سهامی',cooperative:'تعاونی',noncommercial_institution:'مؤسسه غیرتجاری',other:'سایر / نامشخص'};
const COMPANY_SECTOR_LABELS={private:'خصوصی',cooperative:'تعاونی',public_non_government:'عمومی غیردولتی',government:'دولتی / حکومتی',other:'سایر'};
function handleCompanyOrganizationRoleChange(){const role=document.getElementById('company-organization-role')?.value||'standalone',box=document.getElementById('company-parent-box'),sel=document.getElementById('company-parent-id');if(box)box.style.display=role==='subsidiary'?'':'none';if(sel){const current=sel.value,editing=editingCompanyId;sel.innerHTML='<option value="">— انتخاب شرکت مادر —</option>'+getMyCompanies().filter(c=>c.id!==editing&&(c.organizationRole==='holding_parent'||c.organizationRole==='standalone')).map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('');if([...sel.options].some(o=>o.value===current))sel.value=current;}}
function handleCompanyEntityTypeChange(){
  const entity=document.getElementById('company-entity-type'),sectorBox=document.getElementById('company-sector-box'),legalBox=document.getElementById('company-legal-form-box'),orgBox=document.getElementById('company-organization-box'),parentBox=document.getElementById('company-parent-box'),registrationBox=document.getElementById('company-registration-box'),sector=document.getElementById('company-sector'),legal=document.getElementById('company-legal-form'),orgRole=document.getElementById('company-organization-role'),parent=document.getElementById('company-parent-id'),reg=document.getElementById('company-reg-input'),nameLabel=document.getElementById('company-name-label'),nationalLabel=document.getElementById('company-national-label');
  const isLegal=(entity?.value||'legal')==='legal';
  if(sectorBox)sectorBox.style.display=isLegal?'':'none';if(legalBox)legalBox.style.display=isLegal?'':'none';if(orgBox)orgBox.style.display=isLegal?'':'none';if(registrationBox)registrationBox.style.display=isLegal?'':'none';
  if(nameLabel)nameLabel.textContent=isLegal?'نام شرکت / مؤسسه':'نام شخص / کسب‌وکار فردی';if(nationalLabel)nationalLabel.textContent=isLegal?'شناسه ملی':'کد ملی';
  if(!isLegal){if(sector)sector.value='private';if(legal)legal.value='natural_person';if(orgRole)orgRole.value='standalone';if(parent)parent.value='';if(parentBox)parentBox.style.display='none';if(reg)reg.value='';}
  else{if(legal&&(!legal.value||legal.value==='natural_person'))legal.value='limited_liability';handleCompanyOrganizationRoleChange();}
}
function companyLegalSummary(c){
  if((c.entity_type||'legal')==='natural')return 'حقیقی / کسب‌وکار فردی';
  const sector=COMPANY_SECTOR_LABELS[c.organizationSector||'private']||'خصوصی',form=COMPANY_LEGAL_FORM_LABELS[c.legalForm||'other']||'سایر / نامشخص';
  return sector+' · '+form;
}

function resetCompanyForm(){
  editingCompanyId='';
  ['company-name-input','company-phone-input','company-national-input','company-economic-input','company-reg-input','company-postal-input','company-address-input','company-footer-input'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value='';
  });
  const entity=document.getElementById('company-entity-type');if(entity)entity.value='legal';
  const sector=document.getElementById('company-sector');if(sector)sector.value='private';
  const legal=document.getElementById('company-legal-form');if(legal)legal.value='limited_liability';
  handleCompanyEntityTypeChange();const orgRole=document.getElementById('company-organization-role');if(orgRole)orgRole.value='standalone';const parent=document.getElementById('company-parent-id');if(parent)parent.value='';handleCompanyOrganizationRoleChange();
  const activity=document.getElementById('company-activity-type');if(activity)activity.value='trading';
  const template=document.getElementById('company-accounting-template');if(template){template.value='recommended';template.disabled=false;}
  const saveBtn=document.getElementById('company-save-btn');
  if(saveBtn){saveBtn.innerHTML='➕ ثبت شرکت جدید';saveBtn.className='btn btn-success';}
  const cancelBtn=document.getElementById('company-edit-cancel-btn');if(cancelBtn)cancelBtn.style.display='none';
}

function editCompany(id){
  if(!currentUser)return;
  const comp=getMyCompanies().find(c=>c.id===id);
  if(!comp)return;
  editingCompanyId=id;
  const values={'company-entity-type':comp.entity_type||'legal','company-sector':comp.organizationSector||'private','company-legal-form':comp.legalForm||'other','company-organization-role':comp.organizationRole||'standalone','company-parent-id':comp.parentCompanyId||'','company-activity-type':comp.activityType||'trading','company-name-input':comp.name||'','company-phone-input':comp.phone||'','company-national-input':comp.national_id||'','company-economic-input':comp.economic_code||'','company-reg-input':comp.reg_number||'','company-postal-input':comp.postal_code||'','company-address-input':comp.address||'','company-footer-input':comp.footer||''};
  Object.keys(values).forEach(id=>{const el=document.getElementById(id);if(el)el.value=values[id];});
  handleCompanyEntityTypeChange();handleCompanyOrganizationRoleChange();const parentSel=document.getElementById('company-parent-id');if(parentSel&&comp.parentCompanyId)parentSel.value=comp.parentCompanyId;
  const template=document.getElementById('company-accounting-template');if(template){const hasChart=(datastore.accounts||[]).some(a=>a.ownerUserId===currentUser.id&&a.companyId===comp.id);template.value=comp.accountingTemplate?'recommended':'empty';template.disabled=!!comp.accountingTemplate||hasChart;}
  const saveBtn=document.getElementById('company-save-btn');
  if(saveBtn){saveBtn.innerHTML='💾 ذخیره اصلاحات';saveBtn.className='btn btn-primary';}
  const cancelBtn=document.getElementById('company-edit-cancel-btn');if(cancelBtn)cancelBtn.style.display='inline-flex';
  const nameInput=document.getElementById('company-name-input');
  if(nameInput){nameInput.focus();nameInput.scrollIntoView({behavior:'smooth',block:'center'});}
}

function cancelCompanyEdit(){resetCompanyForm();}
function commitSaveCompany(){
  if(!requireWrite())return;
  if(!currentUser)return;
  const entity_type=document.getElementById('company-entity-type').value;
  const raw_name=document.getElementById('company-name-input').value;
  if(!raw_name.trim()){alert('نام شرکت الزامی است.');return;}
  const activityType=document.getElementById('company-activity-type')?.value||'trading';
  const organizationSector=entity_type==='legal'?(document.getElementById('company-sector')?.value||'private'):'private';
  const legalForm=entity_type==='legal'?(document.getElementById('company-legal-form')?.value||'other'):'natural_person';
  const organizationRole=entity_type==='legal'?(document.getElementById('company-organization-role')?.value||'standalone'):'standalone',parentCompanyId=entity_type==='legal'&&organizationRole==='subsidiary'?(document.getElementById('company-parent-id')?.value||''):'';if(entity_type==='legal'&&organizationRole==='subsidiary'&&!parentCompanyId){alert('برای شرکت تابعه، شرکت مادر را مشخص کنید.');return;}
  const templateChoice=document.getElementById('company-accounting-template')?.value||'empty';
  const payload={entity_type,organizationSector,legalForm,organizationRole,parentCompanyId,activityType,name:formatEntityName(raw_name,entity_type),phone:document.getElementById('company-phone-input').value||'',national_id:document.getElementById('company-national-input').value||'',economic_code:document.getElementById('company-economic-input').value||'',reg_number:entity_type==='legal'?(document.getElementById('company-reg-input').value||''):'',postal_code:document.getElementById('company-postal-input').value||'',address:document.getElementById('company-address-input').value||'',footer:document.getElementById('company-footer-input')?.value||'از خرید شما سپاسگزاریم.'};
  if(payload.national_id&&getMyCompanies().some(x=>x.id!==editingCompanyId&&x.national_id===payload.national_id)){alert('شناسه ملی شرکت تکراری است.');return;}
  if(editingCompanyId){
    const comp=datastore.companies.find(c=>c.id===editingCompanyId&&c.ownerUserId===currentUser.id);
    if(!comp){alert('شرکت موردنظر پیدا نشد.');resetCompanyForm();refreshAllSurfaces();return;}
    if(comp.accountingTemplate&&comp.activityType&&comp.activityType!==activityType){alert('نوع فعالیت این شرکت مبنای کدینگ پیشنهادی اعمال‌شده است و تغییر مستقیم آن می‌تواند معنای حساب‌ها را ناسازگار کند. ابتدا باید مهاجرت کنترل‌شده کدینگ انجام شود.');return;}
    const hadChart=(datastore.accounts||[]).some(a=>a.ownerUserId===currentUser.id&&a.companyId===comp.id),hadTemplate=!!comp.accountingTemplate;
    Object.assign(comp,payload);
    saveDatastore();
    if(!hadChart&&!hadTemplate&&templateChoice==='recommended'&&typeof afApplyTemplate==='function')afApplyTemplate(comp.id,activityType);
    alert(templateChoice==='recommended'&&!hadChart&&!hadTemplate?'اطلاعات شرکت اصلاح شد و کدینگ پیشنهادی متناسب با نوع فعالیت اعمال گردید.':'اطلاعات شرکت با موفقیت اصلاح شد.');
  }else{
    const limit=Math.max(1,Number(currentUser.maxCompanies||1)),count=getMyCompanies().length;if(count>=limit){alert('ظرفیت این لایسنس '+toPersianDigits(limit)+' شرکت است. برای تعریف شرکت بیشتر، ظرفیت لایسنس باید توسط مدیر سیستم افزایش یابد.');return;}
    const newComp={id:'COMP_'+Date.now(),ownerUserId:currentUser.id,...payload};
    datastore.companies.push(newComp);
    const s=getMySettings();
    s.default_company_id=newComp.id;
    saveDatastore();
    if(typeof afEnsureFloatingSlotCompatibility==='function')afEnsureFloatingSlotCompatibility();
    if(templateChoice==='recommended'&&typeof afApplyTemplate==='function')afApplyTemplate(newComp.id,activityType);
    alert(templateChoice==='recommended'?'شرکت ثبت شد و کدینگ پیشنهادی متناسب با نوع فعالیت اعمال گردید.':'شرکت ثبت شد؛ هسته حسابداری برای تعریف دستی کدینگ خالی باقی ماند.');
  }
  resetCompanyForm();
  refreshAllSurfaces();
}
function renderCompanies(){
  const tbody=document.getElementById('companies-table-body');
  const invoiceCompSelect=document.getElementById('invoice-company-id');
  const filterCompSelect=document.getElementById('filter-invoice-company');
  const myCompanies=getMyCompanies();
  const mySettings=getMySettings();
  const defCompId=mySettings.default_company_id||(myCompanies[0]?.id);
  if(tbody){
    if(myCompanies.length===0){
      tbody.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px">هیچ شرکتی ثبت نشده است. لطفاً ابتدا شرکت خود را ثبت کنید.</td></tr>';
    }else{
      tbody.innerHTML=myCompanies.map(c=>`<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(companyLegalSummary(c))}</td><td>${esc(COMPANY_ACTIVITY_LABELS[c.activityType||'trading']||c.activityType||'—')}</td><td>${esc(c.national_id||'—')}</td><td>${esc(c.economic_code||'—')}</td><td>${c.id===defCompId?'<span class="badge badge-success">پیش‌فرض</span>':`<button class="btn btn-secondary btn-inline" style="padding:2px 8px;font-size:11px" onclick="setDefaultCompany('${c.id}')">انتخاب</button>`}</td><td><button class="btn btn-secondary btn-inline" style="padding:2px 8px;font-size:11px;margin-left:5px" data-company-id="${c.id}" onclick="editCompany(this.dataset.companyId)">✏️ اصلاح</button>${myCompanies.length>1?`<button class="btn btn-danger btn-inline" style="padding:2px 8px;font-size:11px" onclick="deleteCompany('${c.id}')">حذف</button>`:'—'}</td></tr>`).join('');
    }
  }
  if(invoiceCompSelect){
    invoiceCompSelect.innerHTML=myCompanies.map(c=>`<option value="${c.id}" ${c.id===defCompId?'selected':''}>${esc(c.name)}</option>`).join('');
    if(defCompId)invoiceCompSelect.value=defCompId;
  }
  if(filterCompSelect){
    const currentVal=filterCompSelect.value||'ALL';
    filterCompSelect.innerHTML=`<option value="ALL">نمایش همه شرکت‌ها</option>`+myCompanies.map(c=>`<option value="${c.id}">فقط ${esc(c.name)}</option>`).join('');
    filterCompSelect.value=currentVal;
  }
}
function setDefaultCompany(id){if(!requireWrite())return;const s=getMySettings();s.default_company_id=id;saveDatastore();refreshAllSurfaces();}
function deleteCompany(id){
  if(!requireWrite())return;
  if(!currentUser)return;
  const referenced=Object.entries(datastore).some(([key,rows])=>key!=='companies'&&key!=='settings'&&Array.isArray(rows)&&rows.some(r=>r&&r.ownerUserId===currentUser.id&&r.companyId===id));if(referenced){alert('این شرکت دارای کدینگ، سال مالی، تفصیلی، اسناد یا سایر سوابق وابسته است و برای حفظ یکپارچگی قابل حذف نیست. شرکت را غیرفعال/بایگانی کنید یا ابتدا وابستگی‌های مجاز را بررسی کنید.');return;}
  if(editingCompanyId===id)resetCompanyForm();
  if(confirm('حذف شود؟')){
    datastore.companies=datastore.companies.filter(c=>!(c.id===id&&c.ownerUserId===currentUser.id));
    const myCompanies=getMyCompanies();
    const s=getMySettings();
    if(s.default_company_id===id)s.default_company_id=myCompanies[0]?.id||'';
    saveDatastore();refreshAllSurfaces();
  }
}
