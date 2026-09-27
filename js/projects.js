// ============== پروژه طرف‌حساب (برای طرف‌حساب‌های پروژه‌محور) ==============
function getContactProjects(contactId){
  const c=getMyContacts().find(x=>x.id===contactId);
  return (c&&Array.isArray(c.projects))?c.projects:[];
}
function addProjectToContact(contactId){
  if(!requireWrite())return;
  const c=getMyContacts().find(x=>x.id===contactId);
  if(!c)return;
  const name=prompt('نام پروژه جدید را وارد کنید:');
  if(!name||!name.trim())return;
  if(!Array.isArray(c.projects))c.projects=[];
  c.projects.push({id:'PRJ_'+Date.now(),name:name.trim()});
  saveDatastore();
  refreshAllSurfaces();
}
function handleInvoiceContactChange(){
  const contactSel=document.getElementById('invoice-contact-id');
  const contactId=contactSel?contactSel.value:'';
  const c=getMyContacts().find(x=>x.id===contactId);
  const row=document.getElementById('box-invoice-project-row');
  const sel=document.getElementById('invoice-project-id');
  if(!row||!sel)return;
  if(c&&c.project_mode==='multi'&&Array.isArray(c.projects)&&c.projects.length>0){
    row.style.display='flex';
    sel.innerHTML=c.projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
  }else{
    row.style.display='none';
    sel.innerHTML='';
  }
}
