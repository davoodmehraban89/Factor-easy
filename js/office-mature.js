/* Office Slice C1/C2 mature correspondence evidence + actionable referrals. */
(function(){
function oe(v){return typeof esc==='function'?esc(v):String(v??'')}
function faDate(v){if(!v)return '—';try{return new Date(v).toLocaleString('fa-IR')}catch(_){return String(v)}}
window.officeReadEvidenceFor=function(correspondenceId){return (datastore.correspondenceAudit||[]).filter(x=>x.event==='read'&&x.correspondenceId===correspondenceId)};
window.officeMarkReadEvidence=async function(correspondenceId){
  if(!currentUser?.organizationId||!correspondenceId)return false;
  const {error}=await sb.rpc('office_mark_correspondence_read',{p_organization_id:currentUser.organizationId,p_correspondence_id:correspondenceId});
  if(error){console.error('office read evidence failed',error);return false}
  try{await pullAll()}catch(e){console.error('office read evidence refresh failed',e)}
  return true;
};
const baseOfficeOpenRecord=window.officeOpenRecord;
window.officeOpenRecord=async function(id){
  const x=(datastore.correspondence||[]).find(r=>r.id===id);if(!x)return;
  if(x.status!=='draft'){
    const ok=await window.officeMarkReadEvidence(id);
    if(!ok)return alert('ثبت مشاهده نامه در سرور انجام نشد؛ برای حفظ صحت سابقه، نمایش نامه متوقف شد.');
  }
  return baseOfficeOpenRecord(id);
};

window.FINORA_REFERRAL_QUEUE=[];
window.officeReferralWorkQueue=function(){return Array.isArray(window.FINORA_REFERRAL_QUEUE)?window.FINORA_REFERRAL_QUEUE:[]};
window.officeLoadReferralQueue=async function(render=true){
  if(!currentUser?.organizationId)return [];
  const {data,error}=await sb.rpc('office_referral_work_queue',{p_organization_id:currentUser.organizationId});
  if(error){console.error('office referral queue failed',error);if(render)alert('دریافت کارتابل ارجاعات ناموفق بود: '+error.message);return []}
  window.FINORA_REFERRAL_QUEUE=Array.isArray(data)?data:[];
  if(render)renderReferralWork();
  return window.FINORA_REFERRAL_QUEUE;
};
window.officeActOnReferral=async function(referralId,action){
  if(!currentUser?.organizationId||!referralId)return false;
  const label=action==='acknowledged'?'تأیید دریافت':'تکمیل ارجاع';
  const note=prompt('یادداشت '+label+' (اختیاری):')||'';
  const {error}=await sb.rpc('office_act_on_referral',{
    p_organization_id:currentUser.organizationId,p_referral_id:referralId,p_action:action,p_note:note
  });
  if(error){console.error('office referral action failed',error);alert(label+' انجام نشد: '+error.message);return false}
  await window.officeLoadReferralQueue(false);
  renderReferralWork();
  alert(label+' با سابقه غیرقابل‌تغییر ثبت شد.');
  return true;
};
function renderReferralWork(){
  const root=document.getElementById('view-office');if(!root)return;
  const rows=window.officeReferralWorkQueue();
  const body=rows.length?rows.map(r=>{
    const mine=String(r.to_user_id||'')===String(currentUser?.id||'');
    const status=r.state==='completed'?'تکمیل‌شده':r.state==='acknowledged'?'دریافت‌شده':'ارسال‌شده';
    const actions=mine&&r.state==='sent'
      ?'<button class="btn btn-primary btn-inline" onclick="officeActOnReferral(\''+oe(r.referral_id)+'\',\'acknowledged\')">تأیید دریافت</button>'
      :mine&&r.state==='acknowledged'
        ?'<button class="btn btn-primary btn-inline" onclick="officeActOnReferral(\''+oe(r.referral_id)+'\',\'completed\')">تکمیل</button>'
        :'';
    return '<tr><td><strong>'+oe(r.register_number||'—')+'</strong></td><td>'+oe(r.subject||'—')+'</td><td>'+status+(r.overdue?' <strong>· معوق</strong>':'')+'</td><td>'+faDate(r.due_at)+'</td><td>'+oe(r.note||'—')+'</td><td><button class="btn btn-secondary btn-inline" onclick="officeOpenRecord(\''+oe(r.correspondence_id)+'\')">نامه</button> '+actions+'</td></tr>'
  }).join(''):'<tr><td colspan="6" class="af-empty">ارجاع فعالی برای نمایش وجود ندارد.</td></tr>';
  root.innerHTML='<div class="af-head"><div><h1>ارجاعات و پیگیری</h1><p>کارتابل سرورمحور ارجاعات؛ وضعیت دریافت، تکمیل و مهلت پیگیری از سابقه غیرقابل‌تغییر محاسبه می‌شود.</p></div><div><button class="btn btn-secondary btn-inline" onclick="officeLoadReferralQueue(true)">بازخوانی</button></div></div><div class="card"><div class="table-responsive"><table><thead><tr><th>نامه</th><th>موضوع</th><th>وضعیت</th><th>مهلت</th><th>یادداشت</th><th>عملیات</th></tr></thead><tbody>'+body+'</tbody></table></div></div>';
}
const c1OfficeRender=window.officeRender;
window.officeRender=function(task='inbox'){
  if(task==='work'){
    c1OfficeRender('inbox');
    renderReferralWork();
    window.officeLoadReferralQueue(true);
    return;
  }
  return c1OfficeRender(task);
};

window.officeReferPrompt=async function(correspondenceId){
  if(typeof hasFinoraCapability==='function'&&!hasFinoraCapability('office_automation','refer'))return alert('برای ارجاع دسترسی سازمانی لازم را ندارید.');
  const {data:members,error}=await sb.from('organization_members').select('id,user_id,position_title,is_owner').eq('organization_id',currentUser.organizationId).eq('status','active');
  if(error)return alert(error.message);
  const ids=(members||[]).map(x=>x.user_id),profiles=ids.length?(await sb.from('profiles').select('id,full_name,email').in('id',ids)).data||[]:[];
  const choices=(members||[]).filter(x=>x.user_id!==currentUser.id).map((m,i)=>({n:i+1,m,p:profiles.find(p=>p.id===m.user_id)}));
  if(!choices.length)return alert('عضو دیگری برای ارجاع در این سازمان وجود ندارد.');
  const text=choices.map(x=>x.n+') '+(x.p?.full_name||x.p?.email||x.m.position_title||'کاربر')).join('\n');
  const pick=Number(prompt('ارجاع به کدام عضو؟\n'+text)),chosen=choices.find(x=>x.n===pick);if(!chosen)return;
  const note=prompt('یادداشت ارجاع (اختیاری):')||'';
  const dueRaw=String(prompt('مهلت ارجاع (اختیاری، نمونه 2026-10-01T12:00):')||'').trim();
  let dueAt=null;
  if(dueRaw){const d=new Date(dueRaw);if(Number.isNaN(d.getTime()))return alert('فرمت مهلت معتبر نیست.');dueAt=d.toISOString()}
  const {error:rpcError}=await sb.rpc('office_refer_correspondence_v2',{
    p_organization_id:currentUser.organizationId,p_correspondence_id:correspondenceId,
    p_to_member_id:chosen.m.id,p_note:note,p_due_at:dueAt
  });
  if(rpcError){
    console.error('office referral failed',rpcError);
    if(/target member cannot read correspondence/i.test(rpcError.message||''))return alert('این کاربر طبق سطح دسترسی/دامنه/محرمانگی مجاز به خواندن این نامه نیست.');
    return alert('ارجاع انجام نشد: '+rpcError.message);
  }
  await pullAll();alert('ارجاع ثبت شد و در کارتابل پیگیری قابل مشاهده است.');officeRender('work');
};

window.FINORA_ARCHIVE_INDEX=[];
window.officeArchiveIndex=function(){return Array.isArray(window.FINORA_ARCHIVE_INDEX)?window.FINORA_ARCHIVE_INDEX:[]};
function canOffice(c){return typeof hasFinoraCapability==='function'&&hasFinoraCapability('office_automation',c)}
function renderArchiveIndex(){
  const root=document.getElementById('view-office');if(!root)return;
  const rows=window.officeArchiveIndex();
  const body=rows.length?rows.map(r=>{
    const tags=Array.isArray(r.tags)?r.tags.join('، '):'';
    const classify=(canOffice('archive')||canOffice('configure'))?'<button class="btn btn-secondary btn-inline" onclick="officeClassifyPrompt(\''+oe(r.correspondence_id)+'\')">طبقه‌بندی</button> ':'';
    const link=(canOffice('edit')||canOffice('refer'))?'<button class="btn btn-secondary btn-inline" onclick="officeLinkPrompt(\''+oe(r.correspondence_id)+'\')">ارتباط</button>':'';
    return '<tr><td><strong>'+oe(r.register_number||'—')+'</strong></td><td>'+oe(r.subject||'—')+'</td><td>'+oe(r.folder||'—')+'</td><td>'+oe(r.classification_code||'—')+'</td><td>'+oe(tags||'—')+'</td><td>'+Number(r.related_count||0).toLocaleString('fa-IR')+'</td><td><button class="btn btn-secondary btn-inline" onclick="officeOpenRecord(\''+oe(r.correspondence_id)+'\')">مشاهده</button> '+classify+link+'</td></tr>'
  }).join(''):'<tr><td colspan="7" class="af-empty">مکاتبه‌ای مطابق فیلتر آرشیو یافت نشد.</td></tr>';
  root.innerHTML='<div class="af-head"><div><h1>جست‌وجو و آرشیو مکاتبات</h1><p>جست‌وجوی سرورمحور بر اساس فراداده، پوشه و کد طبقه‌بندی؛ ارتباط پاسخ/مرتبط نیز به‌صورت سابقه غیرقابل‌تغییر ثبت می‌شود.</p></div></div><div class="card"><div class="form-row"><div class="form-group" style="grid-column:span 2"><label>جست‌وجو</label><input id="office-archive-q" class="form-control" placeholder="شماره، موضوع، طرف مکاتبه، برچسب"></div><div class="form-group"><label>پوشه</label><input id="office-archive-folder" class="form-control"></div><div class="form-group"><label>کد طبقه‌بندی</label><input id="office-archive-code" class="form-control"></div></div><button class="btn btn-primary btn-inline" onclick="officeLoadArchiveIndex(true)">جست‌وجو</button></div><div class="card"><div class="table-responsive"><table><thead><tr><th>ثبت</th><th>موضوع</th><th>پوشه</th><th>کد</th><th>برچسب‌ها</th><th>ارتباط‌ها</th><th>عملیات</th></tr></thead><tbody>'+body+'</tbody></table></div></div>';
}
window.officeLoadArchiveIndex=async function(render=true){
  if(!currentUser?.organizationId)return [];
  const q=document.getElementById('office-archive-q')?.value||null;
  const folder=document.getElementById('office-archive-folder')?.value||null;
  const code=document.getElementById('office-archive-code')?.value||null;
  const {data,error}=await sb.rpc('office_archive_search',{p_organization_id:currentUser.organizationId,p_query:q,p_folder:folder,p_classification_code:code,p_related_to:null});
  if(error){console.error('office archive search failed',error);if(render)alert('جست‌وجوی آرشیو ناموفق بود: '+error.message);return []}
  window.FINORA_ARCHIVE_INDEX=Array.isArray(data)?data:[];
  if(render)renderArchiveIndex();
  return window.FINORA_ARCHIVE_INDEX;
};
window.officeClassifyPrompt=async function(correspondenceId){
  if(!(canOffice('archive')||canOffice('configure')))return alert('برای طبقه‌بندی آرشیو دسترسی لازم را ندارید.');
  const folder=String(prompt('پوشه آرشیو:')||'').trim();
  const code=String(prompt('کد طبقه‌بندی:')||'').trim();
  const tags=String(prompt('برچسب‌ها با ویرگول جدا شوند:')||'').split(',').map(x=>x.trim()).filter(Boolean);
  const {error}=await sb.rpc('office_classify_correspondence',{p_organization_id:currentUser.organizationId,p_correspondence_id:correspondenceId,p_folder:folder,p_classification_code:code,p_tags:tags});
  if(error){console.error('office classification failed',error);return alert('طبقه‌بندی انجام نشد: '+error.message)}
  await window.officeLoadArchiveIndex(true);alert('طبقه‌بندی آرشیو با سابقه غیرقابل‌تغییر ثبت شد.');
};
window.officeLinkPrompt=async function(sourceId){
  if(!(canOffice('edit')||canOffice('refer')))return alert('برای ایجاد ارتباط نامه دسترسی لازم را ندارید.');
  const choices=(datastore.correspondence||[]).filter(x=>x.id!==sourceId).map((x,i)=>({n:i+1,x}));
  if(!choices.length)return alert('نامه دیگری برای ایجاد ارتباط در دسترس نیست.');
  const text=choices.slice(0,50).map(z=>z.n+') '+(z.x.registerNumber||'—')+' · '+(z.x.subject||'بدون موضوع')).join('\n');
  const pick=Number(prompt('نامه مقصد را انتخاب کنید:\n'+text)),chosen=choices.find(z=>z.n===pick);if(!chosen)return;
  const relPick=String(prompt('نوع ارتباط: 1 = پاسخ به، 2 = مرتبط')||'').trim();
  const relation=relPick==='1'?'reply_to':relPick==='2'?'related':null;if(!relation)return;
  const {error}=await sb.rpc('office_link_correspondence',{p_organization_id:currentUser.organizationId,p_source_id:sourceId,p_target_id:chosen.x.id,p_relation_type:relation});
  if(error){console.error('office relation failed',error);return alert('ایجاد ارتباط انجام نشد: '+error.message)}
  await window.officeLoadArchiveIndex(true);alert('ارتباط نامه با سابقه غیرقابل‌تغییر ثبت شد.');
};
const c2OfficeRender=window.officeRender;
window.officeRender=function(task='inbox'){
  if(task==='archive'){
    c2OfficeRender('inbox');
    renderArchiveIndex();
    window.officeLoadArchiveIndex(true);
    return;
  }
  return c2OfficeRender(task);
};
})();