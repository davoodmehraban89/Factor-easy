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
    const sourceMap={metadata:'فراداده',body:'متن نامه',ocr:'متن OCR'};
    const source=sourceMap[r.match_source]||'فراداده';
    const provenance=r.ocr_evidence_id?('OCR: '+oe(r.ocr_provider||'نامشخص')+' · '+oe(r.ocr_language||'—')+(r.ocr_corrected?' · اصلاح انسانی':' · خروجی خام')):'—';
    const classify=(canOffice('archive')||canOffice('configure'))?'<button class="btn btn-secondary btn-inline" onclick="officeClassifyPrompt(\''+oe(r.correspondence_id)+'\')">طبقه‌بندی</button> ':'';
    const ocr=(canOffice('archive')||canOffice('configure'))?'<button class="btn btn-secondary btn-inline" onclick="officeRecordOcrEvidence(\''+oe(r.correspondence_id)+'\')">ثبت متن OCR</button> '+(r.ocr_evidence_id?'<button class="btn btn-secondary btn-inline" onclick="officeCorrectOcrEvidence(\''+oe(r.ocr_evidence_id)+'\')">اصلاح OCR</button> ':''):'';
    const link=(canOffice('edit')||canOffice('refer'))?'<button class="btn btn-secondary btn-inline" onclick="officeLinkPrompt(\''+oe(r.correspondence_id)+'\')">ارتباط</button>':'';
    return '<tr><td><strong>'+oe(r.register_number||'—')+'</strong></td><td>'+oe(r.subject||'—')+'</td><td>'+oe(r.folder||'—')+'</td><td>'+oe(r.classification_code||'—')+'</td><td>'+oe(tags||'—')+'</td><td>'+source+'<div class="text-muted">'+provenance+'</div></td><td>'+Number(r.related_count||0).toLocaleString('fa-IR')+'</td><td><button class="btn btn-secondary btn-inline" onclick="officeOpenRecord(\''+oe(r.correspondence_id)+'\')">مشاهده</button> '+classify+ocr+link+'</td></tr>'
  }).join(''):'<tr><td colspan="8" class="af-empty">مکاتبه‌ای مطابق فیلتر آرشیو یافت نشد.</td></tr>';
  root.innerHTML='<div class="af-head"><div><h1>جست‌وجو و آرشیو مکاتبات</h1><p>جست‌وجوی Full-text سرورمحور روی فراداده، متن نامه و متن OCR ثبت‌شده. C7 خودش OCR انجام نمی‌دهد و دقت OCR فارسی هنوز با اسکن واقعی تأیید نشده است.</p></div></div><div class="card"><div class="form-row"><div class="form-group" style="grid-column:span 2"><label>جست‌وجو</label><input id="office-archive-q" class="form-control" placeholder="شماره، موضوع، متن نامه، متن OCR"></div><div class="form-group"><label>پوشه</label><input id="office-archive-folder" class="form-control"></div><div class="form-group"><label>کد طبقه‌بندی</label><input id="office-archive-code" class="form-control"></div></div><button class="btn btn-primary btn-inline" onclick="officeLoadArchiveIndex(true)">جست‌وجو</button></div><div class="card"><div class="table-responsive"><table><thead><tr><th>ثبت</th><th>موضوع</th><th>پوشه</th><th>کد</th><th>برچسب‌ها</th><th>منبع تطبیق</th><th>ارتباط‌ها</th><th>عملیات</th></tr></thead><tbody>'+body+'</tbody></table></div></div>';
}
window.officeLoadArchiveIndex=async function(render=true){
  if(!currentUser?.organizationId)return [];
  const q=document.getElementById('office-archive-q')?.value||null;
  const folder=document.getElementById('office-archive-folder')?.value||null;
  const code=document.getElementById('office-archive-code')?.value||null;
  const {data,error}=await sb.rpc('office_archive_search_v2',{p_organization_id:currentUser.organizationId,p_query:q,p_folder:folder,p_classification_code:code,p_related_to:null,p_limit:100});
  if(error){console.error('office archive search failed',error);if(render)alert('جست‌وجوی آرشیو ناموفق بود: '+error.message);return []}
  window.FINORA_ARCHIVE_INDEX=Array.isArray(data)?data:[];
  if(render)renderArchiveIndex();
  return window.FINORA_ARCHIVE_INDEX;
};
window.officeRecordOcrEvidence=async function(correspondenceId){
  if(!(canOffice('archive')||canOffice('configure')))return alert('برای ثبت Evidence OCR دسترسی لازم را ندارید.');
  const attachments=(datastore.correspondenceAttachments||[]).filter(x=>x.correspondenceId===correspondenceId);
  if(!attachments.length)return alert('برای ثبت OCR ابتدا باید یک پیوست/اسکن واقعی به همین نامه متصل باشد.');
  const choices=attachments.map((x,i)=>({n:i+1,x}));
  const pick=Number(prompt('فایل منبع OCR را انتخاب کنید:\n'+choices.map(z=>z.n+') '+(z.x.fileName||z.x.id)).join('\n')));
  const chosen=choices.find(z=>z.n===pick);if(!chosen)return;
  const sourceRef=chosen.x.id;
  const provider=String(prompt('نام موتور/ارائه‌دهنده OCR:')||'').trim();if(!provider)return;
  const language=String(prompt('زبان خروجی (مثلاً fa):')||'fa').trim();
  const confidenceRaw=String(prompt('Confidence بین 0 و 1 (اختیاری):')||'').trim();
  const confidence=confidenceRaw===''?null:Number(confidenceRaw);if(confidence!==null&&(!Number.isFinite(confidence)||confidence<0||confidence>1))return alert('Confidence باید بین صفر و یک باشد.');
  const text=String(prompt('متن خروجی OCR را وارد کنید:')||'');if(!text.trim())return;
  const {error}=await sb.rpc('office_record_ocr_evidence',{p_organization_id:currentUser.organizationId,p_correspondence_id:correspondenceId,p_source_ref:sourceRef,p_provider:provider,p_language:language,p_confidence:confidence,p_text:text});
  if(error){console.error('office OCR evidence failed',error);return alert('ثبت Evidence OCR انجام نشد: '+error.message)}
  await window.officeLoadArchiveIndex(true);alert('خروجی OCR به پیوست واقعی همین نامه متصل و با provenance ثبت شد. این قابلیت خودِ OCR را اجرا نمی‌کند.');
};
window.officeCorrectOcrEvidence=async function(ocrEvidenceId){
  if(!(canOffice('archive')||canOffice('configure')))return alert('برای اصلاح OCR دسترسی لازم را ندارید.');
  const corrected=String(prompt('متن اصلاح‌شده OCR:')||'');if(!corrected.trim())return;
  const note=String(prompt('یادداشت اصلاح (اختیاری):')||'');
  const {error}=await sb.rpc('office_correct_ocr_evidence',{p_organization_id:currentUser.organizationId,p_ocr_evidence_id:ocrEvidenceId,p_corrected_text:corrected,p_note:note});
  if(error){console.error('office OCR correction failed',error);return alert('اصلاح OCR ثبت نشد: '+error.message)}
  await window.officeLoadArchiveIndex(true);alert('اصلاح انسانی به‌صورت Evidence جدید ثبت شد؛ خروجی خام OCR حفظ شده است.');
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

window.FINORA_TEMPLATE_CATALOG=[];
window.officeTemplateCatalog=function(){return Array.isArray(window.FINORA_TEMPLATE_CATALOG)?window.FINORA_TEMPLATE_CATALOG:[]};
window.officeLoadTemplateCatalog=async function(render=true){
  if(!currentUser?.organizationId)return [];
  const includeInactive=window.FINORA_OFFICE_TASK==='templates'&&(canOffice('configure'));
  const {data,error}=await sb.rpc('office_template_catalog',{p_organization_id:currentUser.organizationId,p_include_inactive:includeInactive});
  if(error){console.error('office template catalog failed',error);if(render)alert('دریافت قالب‌های نامه ناموفق بود: '+error.message);return []}
  window.FINORA_TEMPLATE_CATALOG=Array.isArray(data)?data:[];
  if(render){
    if(window.FINORA_OFFICE_TASK==='templates')renderTemplateManager();
    else if(window.FINORA_OFFICE_TASK==='new')renderTemplateSelector();
  }
  return window.FINORA_TEMPLATE_CATALOG;
};
function renderTemplateManager(){
  const root=document.getElementById('view-office');if(!root)return;
  const rows=window.officeTemplateCatalog();
  const canConfigure=canOffice('configure');
  const form=canConfigure?'<div class="card"><h3>نسخه جدید قالب</h3><div class="form-row"><div class="form-group"><label>کلید ثابت قالب</label><input id="office-template-edit-key" class="form-control" maxlength="64" placeholder="OFFICIAL_REPLY"></div><div class="form-group" style="grid-column:span 3"><label>عنوان قالب</label><input id="office-template-edit-name" class="form-control" maxlength="160"></div></div><div class="form-group"><label>الگوی موضوع</label><input id="office-template-edit-subject" class="form-control" maxlength="500"></div><div class="form-group"><label>متن قالب</label><textarea id="office-template-edit-body" class="form-control" rows="10"></textarea></div><label><input id="office-template-edit-active" type="checkbox" checked> نسخه فعال باشد</label><div style="margin-top:10px"><button class="btn btn-primary" onclick="officeSaveTemplateVersion()">ثبت نسخه جدید</button></div><p class="af-hint">ویرایش قالب، نسخه قبلی را تغییر نمی‌دهد؛ همیشه یک نسخه جدید ساخته می‌شود.</p></div>':'';
  const body=rows.length?rows.map(t=>'<tr><td><strong>'+oe(t.template_key)+'</strong></td><td>'+oe(t.name)+'</td><td>'+Number(t.version||0).toLocaleString('fa-IR')+'</td><td>'+(t.active?'فعال':'غیرفعال')+'</td><td>'+faDate(t.created_at)+'</td><td>'+(canConfigure?'<button class="btn btn-secondary btn-inline" onclick="officePrepareTemplateVersion(\''+oe(t.template_key)+'\')">نسخه جدید</button>':'')+'</td></tr>').join(''):'<tr><td colspan="6" class="af-empty">قالبی تعریف نشده است.</td></tr>';
  root.innerHTML='<div class="af-head"><div><h1>قالب‌های نسخه‌دار نامه</h1><p>هر تغییر یک نسخه جدید می‌سازد؛ نامه ثبت‌شده مرجع نسخه استفاده‌شده را حفظ می‌کند.</p></div></div>'+form+'<div class="card"><div class="table-responsive"><table><thead><tr><th>کلید</th><th>عنوان</th><th>نسخه</th><th>وضعیت</th><th>ایجاد</th><th></th></tr></thead><tbody>'+body+'</tbody></table></div></div>';
}
window.officePrepareTemplateVersion=function(key){
  const t=window.officeTemplateCatalog().find(x=>x.template_key===key);if(!t)return;
  const keyEl=document.getElementById('office-template-edit-key'),nameEl=document.getElementById('office-template-edit-name'),subEl=document.getElementById('office-template-edit-subject'),bodyEl=document.getElementById('office-template-edit-body'),activeEl=document.getElementById('office-template-edit-active');
  if(keyEl){keyEl.value=t.template_key;keyEl.readOnly=true}if(nameEl)nameEl.value=t.name||'';if(subEl)subEl.value=t.subject_template||'';if(bodyEl)bodyEl.value=t.body_template||'';if(activeEl)activeEl.checked=!!t.active;
};
window.officeSaveTemplateVersion=async function(){
  if(!canOffice('configure'))return alert('برای مدیریت قالب‌ها دسترسی پیکربندی لازم است.');
  const key=String(document.getElementById('office-template-edit-key')?.value||'').trim().toUpperCase();
  const name=String(document.getElementById('office-template-edit-name')?.value||'').trim();
  const subject=String(document.getElementById('office-template-edit-subject')?.value||'');
  const body=String(document.getElementById('office-template-edit-body')?.value||'');
  const active=!!document.getElementById('office-template-edit-active')?.checked;
  if(!key||!name)return alert('کلید و عنوان قالب الزامی است.');
  const {data,error}=await sb.rpc('office_create_template_version',{p_organization_id:currentUser.organizationId,p_template_key:key,p_name:name,p_subject_template:subject,p_body_template:body,p_active:active});
  if(error){console.error('office template version failed',error);return alert('ثبت نسخه قالب انجام نشد: '+error.message)}
  await window.officeLoadTemplateCatalog(true);alert('نسخه '+Number(data||0).toLocaleString('fa-IR')+' قالب ثبت شد.');
};
function renderTemplateSelector(){
  if(window.FINORA_OFFICE_TASK!=='new')return;
  const subject=document.getElementById('office-subject');if(!subject)return;
  let host=document.getElementById('office-template-apply-card');
  if(!host){host=document.createElement('div');host.id='office-template-apply-card';host.className='card';const head=document.querySelector('#view-office .af-head');if(head?.nextSibling)head.parentNode.insertBefore(host,head.nextSibling);else document.getElementById('view-office')?.prepend(host)}
  const options=window.officeTemplateCatalog().map(t=>'<option value="'+oe(t.template_key)+'::'+Number(t.version||0)+'">'+oe(t.name)+' · نسخه '+Number(t.version||0).toLocaleString('fa-IR')+'</option>').join('');
  host.innerHTML='<div class="form-row"><div class="form-group" style="grid-column:span 3"><label>قالب نامه</label><select id="office-template-selector" class="form-control"><option value="">— بدون قالب —</option>'+options+'</select></div><div class="form-group" style="align-self:end"><button class="btn btn-secondary" onclick="officeApplyTemplate(document.getElementById(\'office-template-selector\')?.value)">اعمال قالب</button></div></div><input id="office-template-key" type="hidden"><input id="office-template-version" type="hidden"><p id="office-template-provenance" class="af-hint">هنوز قالبی روی این پیش‌نویس اعمال نشده است.</p>';
}
window.officeApplyTemplate=function(ref){
  if(window.FINORA_OFFICE_TASK!=='new')return false;
  const [key,versionRaw]=String(ref||'').split('::'),version=Number(versionRaw);
  const t=window.officeTemplateCatalog().find(x=>x.template_key===key&&Number(x.version)===version);
  if(!t)return alert('نسخه قالب انتخاب‌شده در دسترس نیست.');
  const subject=document.getElementById('office-subject'),body=document.getElementById('office-body'),keyEl=document.getElementById('office-template-key'),verEl=document.getElementById('office-template-version'),prov=document.getElementById('office-template-provenance');
  if(!subject||!body||!keyEl||!verEl)return false;
  subject.value=t.subject_template||'';body.value=t.body_template||'';keyEl.value=t.template_key;verEl.value=String(t.version);
  if(prov)prov.textContent='قالب اعمال‌شده: '+t.name+' · نسخه '+Number(t.version).toLocaleString('fa-IR')+' — پس از اعمال، متن قابل ویرایش است اما مرجع نسخه حفظ می‌شود.';
  return true;
};
const c3OfficeRenderForC4=window.officeRender;
window.officeRender=function(task='inbox'){
  if(task==='templates'){
    c3OfficeRenderForC4('inbox');window.FINORA_OFFICE_TASK='templates';renderTemplateManager();window.officeLoadTemplateCatalog(true);return;
  }
  const out=c3OfficeRenderForC4(task);
  if(task==='new'){window.FINORA_OFFICE_TASK='new';window.officeLoadTemplateCatalog(false).then(()=>renderTemplateSelector())}
  return out;
};

window.FINORA_APPROVAL_QUEUE=[];
window.officeApprovalWorkQueue=function(){return Array.isArray(window.FINORA_APPROVAL_QUEUE)?window.FINORA_APPROVAL_QUEUE:[]};
window.officeLoadApprovalQueue=async function(render=true){
  if(!currentUser?.organizationId)return [];
  const {data,error}=await sb.rpc('office_approval_work_queue',{p_organization_id:currentUser.organizationId});
  if(error){console.error('office approval queue failed',error);if(render)alert('دریافت کارتابل تأییدات ناموفق بود: '+error.message);return []}
  window.FINORA_APPROVAL_QUEUE=Array.isArray(data)?data:[];
  if(render)renderApprovalWork();
  return window.FINORA_APPROVAL_QUEUE;
};
window.officeRequestApproval=async function(correspondenceId){
  const x=(datastore.correspondence||[]).find(r=>r.id===correspondenceId);
  if(!x||x.status==='draft')return alert('درخواست تأیید فقط برای نامه ثبت‌شده قابل ایجاد است.');
  if(!(canOffice('edit')||canOffice('refer')))return alert('برای درخواست تأیید دسترسی لازم را ندارید.');
  const {data:members,error}=await sb.from('organization_members').select('id,user_id,position_title,is_owner').eq('organization_id',currentUser.organizationId).eq('status','active');
  if(error)return alert(error.message);
  const ids=(members||[]).map(m=>m.user_id),profiles=ids.length?(await sb.from('profiles').select('id,full_name,email').in('id',ids)).data||[]:[];
  const choices=(members||[]).filter(m=>m.user_id!==currentUser.id).map((m,i)=>({n:i+1,m,p:profiles.find(p=>p.id===m.user_id)}));
  if(!choices.length)return alert('عضو دیگری برای تأیید در این سازمان وجود ندارد.');
  const pick=Number(prompt('تأییدکننده را انتخاب کنید:\n'+choices.map(x=>x.n+') '+(x.p?.full_name||x.p?.email||x.m.position_title||'کاربر')).join('\n')));
  const chosen=choices.find(x=>x.n===pick);if(!chosen)return;
  const note=prompt('یادداشت درخواست تأیید (اختیاری):')||'';
  const dueRaw=String(prompt('مهلت تأیید (اختیاری، نمونه 2026-10-01T12:00):')||'').trim();
  let dueAt=null;if(dueRaw){const d=new Date(dueRaw);if(Number.isNaN(d.getTime()))return alert('فرمت مهلت معتبر نیست.');dueAt=d.toISOString()}
  const {error:rpcError}=await sb.rpc('office_request_approval',{
    p_organization_id:currentUser.organizationId,p_correspondence_id:correspondenceId,
    p_approver_member_id:chosen.m.id,p_note:note,p_due_at:dueAt
  });
  if(rpcError){console.error('office approval request failed',rpcError);return alert('درخواست تأیید ثبت نشد: '+rpcError.message)}
  await window.officeLoadApprovalQueue(false);alert('درخواست تأیید داخلی با سابقه غیرقابل‌تغییر ثبت شد.');
  return true;
};
window.officeActOnApproval=async function(approvalId,action){
  if(!['approved','rejected'].includes(action))return false;
  const label=action==='approved'?'تأیید':'رد';
  const note=prompt('یادداشت '+label+' (اختیاری):')||'';
  const {error}=await sb.rpc('office_act_on_approval',{
    p_organization_id:currentUser.organizationId,p_approval_id:approvalId,p_action:action,p_note:note
  });
  if(error){console.error('office approval decision failed',error);if(/approval content changed/i.test(error.message||''))return alert('محتوای نامه بعد از درخواست تغییر کرده است؛ این درخواست دیگر قابل تصمیم نیست و باید درخواست جدید ایجاد شود.');return alert(label+' انجام نشد: '+error.message)}
  await window.officeLoadApprovalQueue(false);renderApprovalWork();alert(label+' با هویت نشست فعلی در سابقه داخلی ثبت شد.');
  return true;
};
function renderApprovalWork(){
  const root=document.getElementById('view-office');if(!root)return;
  const rows=window.officeApprovalWorkQueue();
  const body=rows.length?rows.map(r=>{
    const mine=String(r.approver_user_id||'')===String(currentUser?.id||'');
    const state=(r.state==='approved'?'تأییدشده':r.state==='rejected'?'ردشده':'در انتظار')+(r.content_changed?' · محتوا تغییر کرده':'');
    const actions=mine&&r.state==='pending'&&!r.content_changed
      ?'<button class="btn btn-primary btn-inline" onclick="officeActOnApproval(\''+oe(r.approval_id)+'\',\'approved\')">تأیید</button> <button class="btn btn-secondary btn-inline" onclick="officeActOnApproval(\''+oe(r.approval_id)+'\',\'rejected\')">رد</button>'
      :'';
    return '<tr><td><strong>'+oe(r.register_number||'—')+'</strong></td><td>'+oe(r.subject||'—')+'</td><td>'+state+(r.overdue?' <strong>· معوق</strong>':'')+'</td><td>'+faDate(r.due_at)+'</td><td>'+oe(r.note||'—')+'</td><td>'+oe(r.decision_aal||'—')+'</td><td><button class="btn btn-secondary btn-inline" onclick="officeOpenRecord(\''+oe(r.correspondence_id)+'\')">نامه</button> '+actions+'</td></tr>'
  }).join(''):'<tr><td colspan="7" class="af-empty">درخواست تأییدی برای نمایش وجود ندارد.</td></tr>';
  root.innerHTML='<div class="af-head"><div><h1>تأییدات داخلی</h1><p>درخواست، تأیید و رد با شواهد غیرقابل‌تغییر ثبت می‌شود. این قابلیت امضای دیجیتال Qualified یا گواهی معتبر بیرونی نیست.</p></div><div><button class="btn btn-secondary btn-inline" onclick="officeLoadApprovalQueue(true)">بازخوانی</button></div></div><div class="card"><div class="table-responsive"><table><thead><tr><th>نامه</th><th>موضوع</th><th>وضعیت</th><th>مهلت</th><th>یادداشت</th><th>AAL تصمیم</th><th>عملیات</th></tr></thead><tbody>'+body+'</tbody></table></div></div>';
}
const c4OfficeRenderForC5=window.officeRender;
window.officeRender=function(task='inbox'){
  if(task==='approvals'){c4OfficeRenderForC5('inbox');window.FINORA_OFFICE_TASK='approvals';renderApprovalWork();window.officeLoadApprovalQueue(true);return}
  return c4OfficeRenderForC5(task);
};
const c4OfficeOpenRecordForC5=window.officeOpenRecord;
window.officeOpenRecord=async function(id){
  const result=await c4OfficeOpenRecordForC5(id);
  const x=(datastore.correspondence||[]).find(r=>r.id===id);
  if(x&&x.status!=='draft'&&(canOffice('edit')||canOffice('refer'))){
    const head=document.querySelector('#view-office .af-head > div:last-child');
    if(head&&!document.getElementById('office-request-approval-btn')){
      const btn=document.createElement('button');btn.id='office-request-approval-btn';btn.className='btn btn-secondary btn-inline';btn.textContent='درخواست تأیید داخلی';btn.onclick=()=>window.officeRequestApproval(id);head.appendChild(btn);
    }
  }
  return result;
};


window.FINORA_SLA_QUEUE=[];
window.officeSlaWorkQueue=function(){return Array.isArray(window.FINORA_SLA_QUEUE)?window.FINORA_SLA_QUEUE:[]};
window.officeLoadSlaQueue=async function(render=true){
  if(!currentUser?.organizationId)return [];
  const {data,error}=await sb.rpc('office_sla_work_queue',{p_organization_id:currentUser.organizationId});
  if(error){console.error('office SLA queue failed',error);if(render)alert('دریافت کارتابل SLA ناموفق بود: '+error.message);return []}
  window.FINORA_SLA_QUEUE=Array.isArray(data)?data:[];
  if(render)renderSlaWork();
  return window.FINORA_SLA_QUEUE;
};
window.officeEmitSlaEvent=async function(workType,workId,eventName){
  if(!currentUser?.organizationId||!['referral','approval'].includes(workType)||!['sla_reminder','sla_escalated'].includes(eventName))return false;
  const label=eventName==='sla_reminder'?'یادآوری داخلی':'تصعید داخلی';
  const {error}=await sb.rpc('office_emit_sla_event',{
    p_organization_id:currentUser.organizationId,p_work_type:workType,p_work_id:workId,p_event:eventName
  });
  if(error){
    console.error('office SLA event failed',error);
    if(/already emitted for policy window/i.test(error.message||''))return alert(label+' برای بازه سیاست فعلی قبلاً ثبت شده است.');
    if(/24 hours overdue/i.test(error.message||''))return alert('تصعید پس از حداقل ۲۴ ساعت تأخیر مجاز است.');
    if(/pending work required/i.test(error.message||''))return alert('این کار دیگر در وضعیت باز نیست و رویداد SLA جدید برای آن مجاز نیست.');
    return alert(label+' ثبت نشد: '+error.message);
  }
  await window.officeLoadSlaQueue(true);
  alert(label+' به‌صورت Evidence داخلی ثبت شد؛ در C6 هیچ ایمیل، پیامک یا webhook بیرونی ارسال نمی‌شود.');
  return true;
};
function renderSlaWork(){
  const root=document.getElementById('view-office');if(!root)return;
  const rows=window.officeSlaWorkQueue();
  const todayUtc=new Date().toISOString().slice(0,10);
  const body=rows.length?rows.map(r=>{
    const type=r.work_type==='approval'?'تأیید':'ارجاع';
    const stateMap={sent:'ارسال‌شده',acknowledged:'دریافت‌شده',completed:'تکمیل‌شده',pending:'در انتظار',approved:'تأییدشده',rejected:'ردشده',stale:'محتوا تغییر کرده'};
    const state=stateMap[r.work_state]||r.work_state||'—';
    const reminderToday=r.last_reminder_at&&String(r.last_reminder_at).slice(0,10)===todayUtc;
    const canReminder=r.can_emit&&r.overdue&&['sent','acknowledged','pending'].includes(r.work_state)&&!reminderToday;
    const canEscalate=r.can_emit&&r.overdue&&Number(r.overdue_hours||0)>=24&&!r.escalated_at&&['sent','acknowledged','pending'].includes(r.work_state);
    const actions='<button class="btn btn-secondary btn-inline" onclick="officeOpenRecord(\''+oe(r.correspondence_id)+'\')">نامه</button> '
      +(canReminder?'<button class="btn btn-secondary btn-inline" onclick="officeEmitSlaEvent(\''+oe(r.work_type)+'\',\''+oe(r.work_id)+'\',\'sla_reminder\')">یادآوری</button> ':'')
      +(canEscalate?'<button class="btn btn-primary btn-inline" onclick="officeEmitSlaEvent(\''+oe(r.work_type)+'\',\''+oe(r.work_id)+'\',\'sla_escalated\')">تصعید</button>':'');
    return '<tr><td>'+type+'</td><td><strong>'+oe(r.register_number||'—')+'</strong></td><td>'+oe(r.subject||'—')+'</td><td>'+state+(r.overdue?' <strong>· معوق</strong>':'')+'</td><td>'+faDate(r.due_at)+'</td><td>'+Number(r.overdue_hours||0).toLocaleString('fa-IR')+'</td><td>'+faDate(r.last_reminder_at)+'</td><td>'+faDate(r.escalated_at)+'</td><td>'+actions+'</td></tr>';
  }).join(''):'<tr><td colspan="9" class="af-empty">کار دارای مهلت برای نمایش وجود ندارد.</td></tr>';
  root.innerHTML='<div class="af-head"><div><h1>SLA، یادآوری و تصعید</h1><p>وضعیت مهلت از سرور محاسبه می‌شود. یادآوری و تصعید فقط Evidence داخلی هستند؛ C6 هیچ ارسال ایمیل، پیامک یا webhook بیرونی انجام نمی‌دهد.</p></div><div><button class="btn btn-secondary btn-inline" onclick="officeLoadSlaQueue(true)">بازخوانی</button></div></div><div class="card"><div class="table-responsive"><table><thead><tr><th>نوع</th><th>نامه</th><th>موضوع</th><th>وضعیت</th><th>مهلت</th><th>ساعت تأخیر</th><th>آخرین یادآوری</th><th>تصعید</th><th>عملیات</th></tr></thead><tbody>'+body+'</tbody></table></div></div>';
}
const c5OfficeRenderForC6=window.officeRender;
window.officeRender=function(task='inbox'){
  if(task==='sla'){c5OfficeRenderForC6('inbox');window.FINORA_OFFICE_TASK='sla';renderSlaWork();window.officeLoadSlaQueue(true);return}
  return c5OfficeRenderForC6(task);
};
})();
