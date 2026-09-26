function commitSaveCompany(){
  if(!requireWrite())return;
  if(!currentUser)return;
  const entity_type=document.getElementById('company-entity-type').value;
  const raw_name=document.getElementById('company-name-input').value;
  if(!raw_name.trim()){alert('نام شرکت الزامی است.');return;}
  const newComp={id:'COMP_'+Date.now(),ownerUserId:currentUser.id,entity_type,name:formatEntityName(raw_name,entity_type),phone:document.getElementById('company-phone-input').value||'',national_id:document.getElementById('company-national-input').value||'',economic_code:document.getElementById('company-economic-input').value||'',reg_number:document.getElementById('company-reg-input').value||'',postal_code:document.getElementById('company-postal-input').value||'',address:document.getElementById('company-address-input').value||'',footer:document.getElementById('company-footer-input')?.value||'از خرید شما سپاسگزاریم.'};
  datastore.companies.push(newComp);
  const s=getMySettings();
  s.default_company_id=newComp.id;
  saveDatastore();
  alert('شرکت با موفقیت ثبت و ذخیره شد و به عنوان فروشنده پیش‌فرض تنظیم گردید.');
  ['company-name-input','company-phone-input','company-national-input','company-economic-input','company-reg-input','company-postal-input','company-address-input','company-footer-input'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
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
      tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">هیچ شرکتی ثبت نشده است. لطفاً ابتدا شرکت خود را ثبت کنید.</td></tr>';
    }else{
      tbody.innerHTML=myCompanies.map(c=>`<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(c.national_id||'—')}</td><td>${esc(c.economic_code||'—')}</td><td>${c.id===defCompId?'<span class="badge badge-success">پیش‌فرض</span>':`<button class="btn btn-secondary btn-inline" style="padding:2px 8px;font-size:11px" onclick="setDefaultCompany('${c.id}')">انتخاب</button>`}</td><td>${myCompanies.length>1?`<button class="btn btn-danger btn-inline" style="padding:2px 8px;font-size:11px" onclick="deleteCompany('${c.id}')">حذف</button>`:'—'}</td></tr>`).join('');
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
  if(confirm('حذف شود؟')){
    datastore.companies=datastore.companies.filter(c=>!(c.id===id&&c.ownerUserId===currentUser.id));
    const myCompanies=getMyCompanies();
    const s=getMySettings();
    if(s.default_company_id===id)s.default_company_id=myCompanies[0]?.id||'';
    saveDatastore();refreshAllSurfaces();
  }
}
