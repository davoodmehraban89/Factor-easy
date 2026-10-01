/* Finora Office Slice C8 — policy editor + transactional correspondence workflow runtime. */
(function(){
'use strict';
const CAPABILITIES=['edit','refer','approve'];
function node(tag,attrs={},text){
  const el=document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if(k==='class')el.className=v;
    else if(k==='type')el.type=v;
    else if(k==='value')el.value=v;
    else if(k==='checked')el.checked=Boolean(v);
    else if(k==='disabled')el.disabled=Boolean(v);
    else el.setAttribute(k,String(v));
  });
  if(text!==undefined&&text!==null)el.textContent=String(text);
  return el;
}
function orgId(){
  if(window.currentUser&&window.currentUser.organizationId)return window.currentUser.organizationId;
  try{if(typeof currentUser!=='undefined'&&currentUser&&currentUser.organizationId)return currentUser.organizationId}catch(_){}
  return null;
}
function canCapability(capability){
  if(typeof window.hasFinoraCapability==='function')return Boolean(window.hasFinoraCapability('office_automation',capability));
  try{if(typeof hasFinoraCapability==='function')return Boolean(hasFinoraCapability('office_automation',capability))}catch(_){}
  return false;
}
function canConfigure(){return canCapability('configure')}
function rpc(){if(window.sb&&typeof window.sb.rpc==='function')return window.sb;try{if(typeof sb!=='undefined'&&sb&&typeof sb.rpc==='function')return sb}catch(_){}throw new Error('Supabase client unavailable')}
function requestId(){
  if(window.crypto&&typeof window.crypto.randomUUID==='function')return window.crypto.randomUUID();
  if(window.crypto&&typeof window.crypto.getRandomValues==='function'){
    const b=new Uint8Array(16);window.crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
    const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
  }
  throw new Error('secure request id unavailable');
}
function messageOf(e){return String(e&&e.message||e||'خطای نامشخص')}
function isStale(e){return String(e&&e.code||'')==='40001'||/stale workflow revision/i.test(messageOf(e))}
window.officeWorkflowPolicies=async function(){
  const organizationId=orgId(); if(!organizationId)throw new Error('organization required');
  const {data,error}=await rpc().rpc('office_workflow_catalog',{p_organization_id:organizationId});
  if(error)throw error;
  return Array.isArray(data)?data:[];
};
function stageRow(){
  const row=node('div',{'class':'office-workflow-stage-row'});
  const id=node('input',{'type':'text','data-field':'stage-id','maxlength':'64','aria-label':'شناسه مرحله'});
  const label=node('input',{'type':'text','data-field':'stage-label','maxlength':'160','aria-label':'عنوان مرحله'});
  const start=node('input',{'type':'checkbox','data-field':'stage-start','aria-label':'مرحله شروع'});
  const terminal=node('input',{'type':'checkbox','data-field':'stage-terminal','aria-label':'مرحله پایان'});
  const remove=node('button',{'type':'button','class':'btn btn-secondary btn-inline'},'حذف مرحله');
  remove.addEventListener('click',()=>row.remove());
  row.append(id,label,start,terminal,remove); return row;
}
function edgeRow(){
  const row=node('div',{'class':'office-workflow-edge-row'});
  const id=node('input',{'type':'text','data-field':'edge-id','maxlength':'64','aria-label':'شناسه انتقال'});
  const from=node('input',{'type':'text','data-field':'edge-from','maxlength':'64','aria-label':'از مرحله'});
  const to=node('input',{'type':'text','data-field':'edge-to','maxlength':'64','aria-label':'به مرحله'});
  const label=node('input',{'type':'text','data-field':'edge-label','maxlength':'160','aria-label':'عنوان انتقال'});
  const cap=node('select',{'data-field':'edge-capability','aria-label':'مجوز لازم'});
  CAPABILITIES.forEach(x=>cap.append(node('option',{'value':x},x)));
  const remove=node('button',{'type':'button','class':'btn btn-secondary btn-inline'},'حذف انتقال');
  remove.addEventListener('click',()=>row.remove());
  row.append(id,from,to,label,cap,remove); return row;
}
function definitionFrom(root){
  const stages=[...root.querySelectorAll('.office-workflow-stage-row')].map(r=>({id:String(r.querySelector('[data-field="stage-id"]').value||'').trim(),label:String(r.querySelector('[data-field="stage-label"]').value||'').trim(),start:Boolean(r.querySelector('[data-field="stage-start"]').checked),terminal:Boolean(r.querySelector('[data-field="stage-terminal"]').checked)}));
  const edges=[...root.querySelectorAll('.office-workflow-edge-row')].map(r=>({id:String(r.querySelector('[data-field="edge-id"]').value||'').trim(),from:String(r.querySelector('[data-field="edge-from"]').value||'').trim(),to:String(r.querySelector('[data-field="edge-to"]').value||'').trim(),label:String(r.querySelector('[data-field="edge-label"]').value||'').trim(),capability:String(r.querySelector('[data-field="edge-capability"]').value||'')}));
  return {stages,edges};
}
window.officeWorkflowPublish=async function(payload){
  const organizationId=orgId(); if(!organizationId)throw new Error('organization required');
  if(!canConfigure())throw new Error('configure permission required');
  const {data,error}=await rpc().rpc('office_workflow_publish',{p_organization_id:organizationId,p_policy_key:payload.policyKey,p_title:payload.title,p_definition:payload.definition});
  if(error)throw error; return Number(data);
};
function renderCatalog(root,rows){
  root.replaceChildren();
  if(!rows.length){root.append(node('p',{'class':'af-empty'},'سیاست گردشی منتشر نشده است.'));return}
  rows.forEach(p=>{const card=node('div',{'class':'card office-workflow-policy-card'});card.append(node('strong',{},p.title||p.policy_key||'—'));card.append(node('span',{'class':'office-workflow-policy-meta'},' · '+String(p.policy_key||'')+' · نسخه '+String(p.version||'')));root.append(card)});
}
window.officeWorkflowMountAdmin=function(root){
  if(!root)throw new Error('root required');root.replaceChildren();
  const wrap=node('section',{'class':'office-workflow-admin','aria-label':'سیاست گردش مکاتبات'});wrap.append(node('h2',{},'سیاست گردش مکاتبات'));wrap.append(node('p',{},'مرحله گردش، جایگزین ثبت دبیرخانه یا تأیید داخلی نامه نیست.'));
  const form=node('div',{'class':'card'}),policyKey=node('input',{'type':'text','maxlength':'64','data-field':'policy-key','aria-label':'کلید سیاست'}),title=node('input',{'type':'text','maxlength':'160','data-field':'policy-title','aria-label':'عنوان سیاست'}),stages=node('div',{'data-role':'stages'}),edges=node('div',{'data-role':'edges'});
  const addStage=node('button',{'type':'button','class':'btn btn-secondary btn-inline'},'افزودن مرحله'),addEdge=node('button',{'type':'button','class':'btn btn-secondary btn-inline'},'افزودن انتقال'),publish=node('button',{'type':'button','class':'btn btn-primary btn-inline'},'انتشار نسخه'),status=node('div',{'role':'status','aria-live':'polite'}),catalog=node('div',{'data-role':'catalog'});
  addStage.addEventListener('click',()=>stages.append(stageRow()));addEdge.addEventListener('click',()=>edges.append(edgeRow()));publish.disabled=!canConfigure();
  publish.addEventListener('click',async()=>{publish.disabled=true;status.textContent='در حال انتشار…';try{const version=await window.officeWorkflowPublish({policyKey:String(policyKey.value||'').trim(),title:String(title.value||'').trim(),definition:definitionFrom(wrap)});status.textContent='نسخه '+String(version)+' منتشر شد.';renderCatalog(catalog,await window.officeWorkflowPolicies())}catch(e){status.textContent='انتشار ناموفق: '+messageOf(e)}finally{publish.disabled=!canConfigure()}});
  form.append(node('label',{},'کلید سیاست'),policyKey,node('label',{},'عنوان سیاست'),title,addStage,stages,addEdge,edges,publish,status);wrap.append(form,node('h3',{},'نسخه‌های فعال'),catalog);root.append(wrap);
  window.officeWorkflowPolicies().then(rows=>renderCatalog(catalog,rows)).catch(e=>catalog.replaceChildren(node('p',{'class':'af-empty'},'دریافت سیاست‌ها ناموفق بود: '+messageOf(e))));return wrap;
};

window.officeWorkflowRead=async function(correspondenceId,afterRevision=-1,limit=100){
  const organizationId=orgId();if(!organizationId||!correspondenceId)throw new Error('organization and correspondence required');
  const {data,error}=await rpc().rpc('office_workflow_read',{p_organization_id:organizationId,p_correspondence_id:correspondenceId,p_after_revision:Number(afterRevision),p_limit:Number(limit)});if(error)throw error;return data;
};
window.officeWorkflowAttach=async function(correspondenceId,policyKey,policyVersion,idempotencyKey){
  const organizationId=orgId();if(!organizationId)throw new Error('organization required');
  const {data,error}=await rpc().rpc('office_workflow_attach',{p_organization_id:organizationId,p_correspondence_id:correspondenceId,p_policy_key:policyKey,p_policy_version:Number(policyVersion),p_request_id:idempotencyKey});if(error)throw error;return data;
};
window.officeWorkflowTransition=async function(instanceId,edgeId,expectedRevision,idempotencyKey,note){
  const organizationId=orgId();if(!organizationId)throw new Error('organization required');
  const {data,error}=await rpc().rpc('office_workflow_transition',{p_organization_id:organizationId,p_instance_id:instanceId,p_edge_id:edgeId,p_expected_revision:Number(expectedRevision),p_request_id:idempotencyKey,p_note:note===undefined?null:note});if(error)throw error;return data;
};
function historyItem(e){
  const item=node('li',{'class':'office-workflow-event'});const title=e.event_type==='attach'?'اتصال گردش':(e.edge_label||'انتقال');item.append(node('strong',{},title));item.append(node('span',{},' · '+String(e.from_stage_label||'—')+' ← '+String(e.to_stage_label||'—')+' · بازبینی '+String(e.revision??'—')));if(e.note)item.append(node('p',{},e.note));return item;
}
async function renderAttach(root,correspondenceId,status){
  const box=node('div',{'class':'card office-workflow-attach'});box.append(node('p',{},'برای این نامه هنوز گردش داخلی متصل نشده است.'));
  if(!canCapability('refer')){box.append(node('p',{'class':'af-hint'},'مجوز اتصال گردش برای این حساب فعال نیست.'));root.append(box);return}
  const select=node('select',{'class':'form-control','aria-label':'سیاست گردش'}),button=node('button',{'type':'button','class':'btn btn-primary btn-inline'},'اتصال گردش');select.append(node('option',{'value':''},'— انتخاب سیاست —'));box.append(select,button);root.append(box);
  try{const policies=await window.officeWorkflowPolicies();policies.forEach(p=>select.append(node('option',{'value':String(p.policy_key)+'::'+String(p.version)},String(p.title||p.policy_key)+' · نسخه '+String(p.version))))}catch(e){status.textContent='دریافت سیاست‌ها ناموفق بود: '+messageOf(e);button.disabled=true;return}
  button.addEventListener('click',async()=>{const [policyKey,version]=String(select.value||'').split('::');if(!policyKey||!version){status.textContent='ابتدا سیاست گردش را انتخاب کنید.';return}if(!button.dataset.requestId)button.dataset.requestId=requestId();button.disabled=true;status.textContent='در حال اتصال گردش…';try{await window.officeWorkflowAttach(correspondenceId,policyKey,Number(version),button.dataset.requestId);delete button.dataset.requestId;await loadRuntime(root,correspondenceId,status)}catch(e){status.textContent='اتصال ناموفق؛ دوباره تلاش کنید: '+messageOf(e);button.disabled=false}});
}
function renderRuntimeState(root,correspondenceId,state,status){
  const instance=state&&state.instance;if(!instance){renderAttach(root,correspondenceId,status);return}
  const card=node('div',{'class':'card office-workflow-runtime'});card.append(node('h3',{},instance.policy_title||instance.policy_key||'گردش مکاتبه'));card.append(node('p',{},'مرحله جاری: '+String(instance.stage_label||instance.stage_id||'—')+' · نسخه سیاست '+String(instance.policy_version||'—')+' · بازبینی '+String(instance.revision??'—')));
  const actions=node('div',{'data-role':'workflow-edge-actions','class':'quick-actions-row'});(Array.isArray(state.allowed_edges)?state.allowed_edges:[]).forEach(edge=>{const button=node('button',{'type':'button','class':'btn btn-primary btn-inline'},edge.label||edge.id);button.addEventListener('click',async()=>{if(!button.dataset.requestId){button.dataset.requestId=requestId();button.dataset.note=String(window.prompt('یادداشت انتقال (اختیاری):')||'')}button.disabled=true;status.textContent='در حال ثبت انتقال…';try{await window.officeWorkflowTransition(instance.instance_id,edge.id,instance.revision,button.dataset.requestId,button.dataset.note);delete button.dataset.requestId;delete button.dataset.note;await loadRuntime(root,correspondenceId,status)}catch(e){if(isStale(e)){delete button.dataset.requestId;delete button.dataset.note;await loadRuntime(root,correspondenceId,status);status.textContent='گردش هم‌زمان تغییر کرده است؛ اطلاعات تازه شد. اقدام را دوباره بررسی کنید.'}else{status.textContent='انتقال ناموفق؛ دوباره تلاش کنید: '+messageOf(e);button.disabled=false}}});actions.append(button)});card.append(actions);
  const history=node('ol',{'class':'office-workflow-history','aria-label':'تاریخچه گردش'});(Array.isArray(state.events)?state.events:[]).forEach(e=>history.append(historyItem(e)));card.append(node('h4',{},'تاریخچه گردش'),history);root.append(card);
}
async function loadRuntime(root,correspondenceId,status){
  const keep=status||node('div',{'role':'status','aria-live':'polite'});root.replaceChildren(keep);keep.textContent='در حال دریافت گردش…';
  try{const state=await window.officeWorkflowRead(correspondenceId,-1,100);keep.textContent='';renderRuntimeState(root,correspondenceId,state,keep);root.append(keep);return state}catch(e){keep.textContent='دریافت گردش ناموفق بود: '+messageOf(e);throw e}
}
window.officeWorkflowMountRuntime=function(root,correspondenceId){if(!root)throw new Error('root required');const status=node('div',{'role':'status','aria-live':'polite'});return loadRuntime(root,correspondenceId,status)};
window.officeWorkflowOpenModal=function(correspondenceId){
  let backdrop=document.getElementById('office-workflow-modal');if(backdrop)backdrop.remove();backdrop=node('div',{'id':'office-workflow-modal','class':'modal-backdrop active'});const card=node('div',{'class':'modal-card','role':'dialog','aria-modal':'true','aria-label':'گردش مکاتبه'}),head=node('div',{'class':'af-head'}),close=node('button',{'type':'button','class':'btn btn-secondary btn-inline'},'بستن'),root=node('div',{'data-role':'workflow-runtime-root'});close.addEventListener('click',()=>backdrop.remove());head.append(node('h2',{},'گردش مکاتبه'),close);card.append(head,node('p',{},'گردش داخلی مستقل از وضعیت ثبت دبیرخانه و تأیید داخلی نامه است.'),root);backdrop.append(card);document.body.append(backdrop);window.officeWorkflowMountRuntime(root,correspondenceId).catch(()=>{});return backdrop;
};
const baseOfficeOpenRecord=window.officeOpenRecord;
if(typeof baseOfficeOpenRecord==='function')window.officeOpenRecord=async function(id){const result=await baseOfficeOpenRecord(id);window.officeWorkflowOpenModal(id);return result};
window.FINORA_OFFICE_WORKFLOW_C8_UI_VERSION='c8-task3-v1';
})();