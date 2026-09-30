/* Finora Slice B office capability UI + shared referral foundation. */
(function(){
function cap(c){return typeof hasFinoraCapability==='function'&&hasFinoraCapability('office_automation',c)}
function deny(){alert('برای این عملیات دسترسی سازمانی لازم را ندارید.');return false}
function rid(p){return p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)}
function payload(id,status){return {id,ownerUserId:currentUser.id,companyId:(typeof getMySettings==='function'?getMySettings().default_company_id:'')||'',direction:document.getElementById('office-direction')?.value||'incoming',registryId:document.getElementById('office-registry')?.value||'',externalNumber:String(document.getElementById('office-external-no')?.value||'').trim(),externalDate:String(document.getElementById('office-external-date')?.value||'').trim(),subject:String(document.getElementById('office-subject')?.value||'').trim(),counterparty:String(document.getElementById('office-party')?.value||'').trim(),dueDate:String(document.getElementById('office-due')?.value||'').trim(),priority:document.getElementById('office-priority')?.value||'عادی',confidentiality:document.getElementById('office-conf')?.value||'عادی',body:String(document.getElementById('office-body')?.value||'').trim(),status,ocrStatus:'not_requested',ocrText:'',createdAt:new Date().toISOString()}}
async function uploadOrgFiles(correspondenceId){
  if(!cap('create'))return;
  const files=[...(document.getElementById('office-files')?.files||[])];
  for(const file of files){
    if(file.size>20971520)throw new Error('حجم فایل '+file.name+' بیش از ۲۰MB است.');
    const ext=(file.name.split('.').pop()||'bin').replace(/[^A-Za-z0-9]/g,'').toLowerCase();
    const path=currentUser.organizationId+'/'+currentUser.id+'/'+correspondenceId+'/'+rid('F')+(ext?'.'+ext:'');
    const {error}=await sb.storage.from('office-attachments').upload(path,file,{upsert:false,contentType:file.type||undefined});if(error)throw error;
    datastore.correspondenceAttachments.push({id:rid('ATT'),ownerUserId:currentUser.id,companyId:payload('','').companyId,correspondenceId,storagePath:path,fileName:file.name,mimeType:file.type||'',size:file.size,createdAt:new Date().toISOString()});
  }
  if(files.length)saveDatastore();
}
window.officeSaveRegistry=function(){
  if(!requireWrite()||!cap('configure'))return deny();
  const code=String(document.getElementById('office-reg-code')?.value||'').trim().toUpperCase(),title=String(document.getElementById('office-reg-title')?.value||'').trim(),prefix=String(document.getElementById('office-reg-prefix')?.value||'').trim(),nextNumber=Math.max(1,Number(document.getElementById('office-reg-next')?.value||1));
  if(!code||!title)return alert('کد و عنوان دفتر الزامی است.');
  if((datastore.officeRegistries||[]).some(x=>String(x.code).toUpperCase()===code))return alert('کد دفتر تکراری است.');
  datastore.officeRegistries.push({id:rid('OREG'),ownerUserId:currentUser.id,companyId:payload('','').companyId,code,title,prefix,nextNumber,active:true,createdAt:new Date().toISOString()});saveDatastore();officeRender('registries');
};
window.officeSaveDraft=async function(){
  if(!requireWrite()||!cap('create'))return deny();
  const id=rid('COR'),p=payload(id,'draft');if(!p.subject)return alert('موضوع نامه الزامی است.');
  datastore.correspondence.push(p);saveDatastore();
  try{await uploadOrgFiles(id);alert('پیش‌نویس و پیوست‌ها ثبت شد.');officeRender('inbox')}catch(e){console.error(e);alert('پیش‌نویس ذخیره شد اما بارگذاری یک پیوست ناموفق بود: '+(e.message||e))}
};
window.officeRegister=async function(){
  if(!requireWrite()||!cap('register'))return deny();
  const id=rid('COR'),p=payload(id,'draft');if(!p.subject||!p.registryId)return alert('موضوع و دفتر دبیرخانه برای ثبت قطعی الزامی است.');
  try{const body=Object.assign({},p);delete body.id;delete body.ownerUserId;const {data,error}=await sb.rpc('office_register_correspondence',{p_id:id,p_registry_id:p.registryId,p_payload:body,p_organization_id:currentUser.organizationId});if(error)throw error;await pullAll();try{await uploadOrgFiles(id)}catch(fileErr){console.error(fileErr);alert('نامه با شماره '+data+' ثبت شد، اما بارگذاری یک پیوست ناموفق بود: '+(fileErr.message||fileErr));officeRender('inbox');return}alert('نامه با شماره '+data+' ثبت شد.');officeRender('inbox')}catch(e){console.error(e);alert('ثبت قطعی نامه انجام نشد: '+(e.message||e))}
};
window.officeReferPrompt=async function(correspondenceId){
  if(!requireWrite()||!cap('refer'))return deny();
  const {data:members,error}=await sb.from('organization_members').select('id,user_id,position_title,is_owner').eq('organization_id',currentUser.organizationId).eq('status','active');if(error)return alert(error.message);
  const ids=(members||[]).map(x=>x.user_id),profiles=ids.length?(await sb.from('profiles').select('id,full_name,email').in('id',ids)).data||[]:[];
  const choices=(members||[]).filter(x=>x.user_id!==currentUser.id).map((m,i)=>({n:i+1,m,p:profiles.find(p=>p.id===m.user_id)}));
  if(!choices.length)return alert('عضو دیگری برای ارجاع در این سازمان وجود ندارد.');
  const text=choices.map(x=>x.n+') '+(x.p?.full_name||x.p?.email||x.m.position_title||'کاربر')).join('\n');
  const pick=Number(prompt('ارجاع به کدام عضو؟\n'+text));const chosen=choices.find(x=>x.n===pick);if(!chosen)return;
  const note=prompt('یادداشت ارجاع (اختیاری):')||'';
  const {error:rpcError}=await sb.rpc('office_refer_correspondence',{p_organization_id:currentUser.organizationId,p_correspondence_id:correspondenceId,p_to_member_id:chosen.m.id,p_note:note});if(rpcError)return alert('ارجاع انجام نشد: '+rpcError.message);
  await pullAll();alert('ارجاع ثبت شد و در سابقه غیرقابل‌تغییر سازمان ثبت گردید.');officeRender('inbox');
};
const baseRender=window.officeRender;
window.officeRender=function(task='inbox'){
  baseRender(task);
  const root=document.getElementById('view-office');if(!root)return;
  if(task==='registries'&&!cap('configure'))root.querySelectorAll('input,button.btn-primary').forEach(x=>x.disabled=true);
  if(task==='new'){
    const draft=[...root.querySelectorAll('button')].find(x=>/officeSaveDraft/.test(x.getAttribute('onclick')||'')),reg=[...root.querySelectorAll('button')].find(x=>/officeRegister/.test(x.getAttribute('onclick')||''));
    if(draft&&!cap('create'))draft.disabled=true;if(reg&&!cap('register'))reg.disabled=true;
  }
  if((task==='inbox'||task==='archive')&&cap('refer'))root.querySelectorAll('#office-letter-body button[onclick^="officeOpenRecord"]').forEach(btn=>{const m=(btn.getAttribute('onclick')||'').match(/officeOpenRecord\('([^']+)'\)/);if(!m)return;const b=document.createElement('button');b.className='btn btn-secondary btn-inline';b.style.marginRight='6px';b.textContent='ارجاع';b.onclick=()=>officeReferPrompt(m[1]);btn.parentElement.appendChild(b)});
};
})();