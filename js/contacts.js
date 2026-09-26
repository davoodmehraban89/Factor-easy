function commitSaveContact(){
  if(!requireWrite())return;
  if(!currentUser)return;
  const entity_type=document.getElementById('contact-entity-type').value;
  const custom_prefix=entity_type==='natural'?document.getElementById('contact-prefix-select')?.value:'';
  const raw_name=document.getElementById('contact-name-input').value;
  const role=document.getElementById('contact-role-input').value;
  const mobile=document.getElementById('contact-mobile-input').value;
  const national_id=document.getElementById('contact-national-input').value;
  const economic_code=(entity_type==='natural')?'':document.getElementById('contact-economic-input').value;
  const reg_number=(entity_type==='natural')?'':document.getElementById('contact-reg-input').value;
  const postal_code=document.getElementById('contact-postal-input').value;
  const address=document.getElementById('contact-address-input').value;
  if(!raw_name.trim()){alert('نام طرف حساب الزامی است.');return;}
  const formatted_name=formatEntityName(raw_name,entity_type,custom_prefix);
  datastore.contacts.push({id:'C_'+Date.now(),ownerUserId:currentUser.id,entity_type,name:formatted_name,role,mobile,national_id,economic_code,reg_number,postal_code,address,balance:0});
  saveDatastore();
  alert('طرف حساب ثبت شد.');
  document.getElementById('contact-name-input').value='';
  refreshAllSurfaces();
}
function renderContacts(){
  const tbody=document.getElementById('contacts-ledger-table-body');
  const invSelect=document.getElementById('invoice-contact-id');
  const chqSelect=document.getElementById('chq-contact-select');
  const myContacts=getMyContacts();
  if(myContacts.length===0){
    tbody.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:20px">هیچ طرف حسابی ثبت نشده است.</td></tr>';
  }else{
    tbody.innerHTML=myContacts.map(c=>`<tr><td><strong>${esc(c.name)}</strong></td><td><span class="badge ${c.entity_type==='legal'?'badge-warning':'badge-success'}">${c.entity_type==='legal'?'حقوقی':'حقیقی'}</span></td><td>${esc(c.national_id||'—')}</td><td>${esc(c.economic_code||'—')}</td><td>${esc(c.postal_code||'—')}</td><td>${esc(c.mobile||'—')}</td><td>${Math.abs(c.balance||0).toLocaleString('fa-IR')}</td><td><button class="btn btn-danger btn-inline" style="padding:4px 8px;font-size:12px;min-height:30px" onclick="deleteContact('${c.id}')">حذف</button></td></tr>`).join('');
  }
  const options=myContacts.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  if(invSelect)invSelect.innerHTML=options;
  if(chqSelect)chqSelect.innerHTML=options;
}
function deleteContact(id){
  if(!requireWrite())return;
  if(!currentUser)return;
  if(confirm('حذف شود؟')){
    datastore.contacts=datastore.contacts.filter(c=>!(c.id===id&&c.ownerUserId===currentUser.id));
    saveDatastore();refreshAllSurfaces();
  }
}
function openQuickContactModal(){document.getElementById('modal-quick-contact').classList.add('active');handleQuickCEntityChange();}
function closeQuickContactModal(){document.getElementById('modal-quick-contact').classList.remove('active');}
function saveQuickContact(){
  if(!requireWrite())return;
  if(!currentUser)return;
  const entity_type=document.getElementById('quick-c-entity').value;
  const prefix=entity_type==='natural'?document.getElementById('quick-c-prefix')?.value:'';
  const raw_name=document.getElementById('quick-c-name').value;
  if(!raw_name.trim()){alert('نام الزامی است.');return;}
  const newId='C_'+Date.now();
  datastore.contacts.push({id:newId,ownerUserId:currentUser.id,entity_type,name:formatEntityName(raw_name,entity_type,prefix),role:'customer',mobile:document.getElementById('quick-c-mobile').value,national_id:document.getElementById('quick-c-national').value,economic_code:(entity_type==='natural')?'':document.getElementById('quick-c-economic').value,reg_number:(entity_type==='natural')?'':document.getElementById('quick-c-reg').value,postal_code:document.getElementById('quick-c-postal').value,address:document.getElementById('quick-c-address').value,balance:0});
  saveDatastore();
  closeQuickContactModal();
  refreshAllSurfaces();
  document.getElementById('invoice-contact-id').value=newId;
}
function downloadContactsExcelTemplate(){
  const ws_data=[["نام شخص یا شرکت","نوع (حقیقی/حقوقی)","شماره همراه","شناسه یا کد ملی","کد اقتصادی","شماره ثبت","کد پستی","نشانی"],["دانشگاه صنعتی شریف","حقوقی","02166165000","14002830256","14002830256","","1458889694","طرشت محله تیموری پلاک 435"]];
  const ws=XLSX.utils.aoa_to_sheet(ws_data);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"اشخاص");
  XLSX.writeFile(wb,"نمونه_اشخاص_فینورا.xlsx");
}
function importContactsFromExcel(event){
  if(!requireWrite())return;
  if(!currentUser)return;
  const file=event.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const data=new Uint8Array(e.target.result);
      const workbook=XLSX.read(data,{type:'array'});
      const rows=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      rows.forEach((r,idx)=>{
        const raw_name=r["نام شخص یا شرکت"]||r["نام"];
        if(raw_name){
          const entity_type=(r["نوع (حقیقی/حقوقی)"]||'').includes('حقوقی')?'legal':'natural';
          datastore.contacts.push({id:'C_'+Date.now()+'_'+idx,ownerUserId:currentUser.id,entity_type,name:formatEntityName(raw_name.toString(),entity_type,'آقا/خانم'),role:'customer',mobile:(r["شماره همراه"]||'').toString(),national_id:(r["شناسه یا کد ملی"]||'').toString(),economic_code:(entity_type==='legal'?(r["کد اقتصادی"]||''):'').toString(),reg_number:(entity_type==='legal'?(r["شماره ثبت"]||''):'').toString(),postal_code:(r["کد پستی"]||'').toString(),address:(r["نشانی"]||'').toString(),balance:0});
        }
      });
      saveDatastore();refreshAllSurfaces();
      alert('اشخاص ایمپورت شدند.');
    }catch(err){alert('خطا در فایل اکسل!');}
  };
  reader.readAsArrayBuffer(file);
}
