/* Finora Office Slice C8 — workflow policy + correspondence runtime UI. */
(function(){
'use strict';
const CAPABILITIES=['edit','refer','approve'];
let runtimeGeneration=0;
let activeRuntime=null;
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
function errorCode(e){return String(e&&(e.code||e.sqlstate||e.status)||'')}
function stillCurrent(s){return activeRuntime===s&&s.generation===runtimeGeneration&&String(orgId()||'')===String(s.organizationId||'')}
window.officeWorkflowPolicies=async function(){
  const organizationId=orgId();if(!organizationId)throw new Error('organization required');
  const {data,error}=await rpc().rpc('office_workflow_catalog',{p_organization_id:organizationId});if(error)throw error;return Array.isArray(data)?data:[];
};
function stageRow(){
  const row=node('div',{'class':'office-workflow-stage-row'}),id=node('input',{'type':'text','data-field':'stage-id','maxlength':'64','aria-label':'شناسه مرحله'}),label=node('input',{'type':'text','data-field':'stage-label','maxlength':'160','aria-label':'عنوان مرحله'}),start=node('input',{'type':'checkbox','data-field':'stage-start','aria-label':'مرحله شروع'}),terminal=node('input',{'type':'checkbox','data-field':'stage-terminal','aria-label':'مرحله پایان'}),remove=node('button',{'type':'button','class':'btn btn-secondary btn-inline'},'حذف مرحله');
  remove.addEventListener('click',()=>row.remove());row.append(id,label,start,terminal,remove);return row;
}
function edgeRow(){
  const row=node('div',{'class':'office-workflow-edge-row'}),id=node('input',{'type':'text','data-field':'edge-id','maxlength':'64','aria-label':'شناسه انتقال'}),from=node('input',{'type':'text','data-field':'edge-from','maxlength':'64','aria-label':'از مرحله'}),to=node('input',{'type':'text','data-field':'edge-to','maxlength':'64','aria-label':'به مرحله'}),label=node('input',{'type':'text','data-field':'edge-label','maxlength':'160','aria-label':'عنوان انتقال'}),cap=node('select',{'data-field':'edge-capability','aria-label':'مجوز لازم'}),remove=node('button',{'type':'button','class':'btn btn-secondary btn-inline'},'حذف انتقال');
  CAPABILITIES.forEach(x=>cap.append(node('option',{'value':x},x)));remove.addEventListener('click',()=>row.remove());row.append(id,from,to,label,cap,remove);return row;
}
function definitionFrom(root){
  const stages=[...root.querySelectorAll('.office-workflow-stage-row')].map(r=>({id:String(r.querySelector('[data-field="stage-id"]').value||'').trim(),label:String(r.querySelector('[data-field="stage-label"]').value||'').trim(),start:Boolean(r.querySelector('[data-field="stage-start"]').checked),terminal:Boolean(r.querySelector('[data-field="stage-terminal"]').checked)}));
  const edges=[...root.querySelectorAll('.office-workflow-edge-row')].map(r=>({id:String(r.querySelector('[data-field="edge-id"]').value||'').trim(),from:String(r.querySelector('[data-field="edge-from"]').value||'').trim(),to:String(r.querySelector('[data-field="edge-to"]').value||'').trim(),label:String(r.querySelector('[data-field="edge-label"]').value||'').trim(),capability:String(r.querySelector('[data-field="edge-capability"]').value||'')}));return {stages,edges};
}
window.officeWorkflowPublish=async function(payload){
  const organizationId=orgId();if(!organizationId)throw new Error('organization required');if(!canConfigure())throw new Error('configure permission required');
  const {data,error}=await rpc().rpc('office_workflow_publish',{p_organization_id:organizationId,p_policy_key:payload.policyKey,p_title:payload.title,p_definition:payload.definition});if(error)throw error;return Number(data);
};
function renderCatalog(root,rows){root.replaceChildren();if(!rows.length){root.append(node('p',{'class':'af-empty'},'سیاست گردشی منتشر نشده است.'));return}rows.forEach(p=>{const card=node('div',{'class':'card office-workflow-policy-card'});card.append(node('strong',{},p.title||p.policy_key||'—'),node('span',{'class':'office-workflow-policy-meta'},' · '+String(p.policy_key||'')+' · نسخه '+String(p.version||'')));root.append(card)})}
window.officeWorkflowMountAdmin=function(root){
  if(!root)throw new Error('root required');root.replaceChildren();const wrap=node('section',{'class':'office-workflow-admin','aria-label':'سیاست گردش مکاتبات'});wrap.append(node('h2',{},'سیاست گردش مکاتبات'),node('p',{},'مرحله گردش، جایگزین ثبت دبیرخانه یا تأیید داخلی نامه نیست.'));
  const form=node('div',{'class':'card'}),policyKey=node('input',{'type':'text','maxlength':'64','data-field':'policy-key','aria-label':'کلید سیاست'}),title=node('input',{'type':'text','maxlength':'160','data-field':'policy-title','aria-label':'عنوان سیاست'}),stages=node('div',{'data-role':'stages'}),edges=node('div',{'data-role':'edges'}),addStage=node('button',{'type':'button','class':'btn btn-secondary btn-inline'},'افزودن مرحله'),addEdge=node('button',{'type':'button','class':'btn btn-secondary btn-inline'},'افزودن انتقال'),publish=node('button',{'type':'button','class':'btn btn-primary btn-inline'},'انتشار نسخه'),status=node('div',{'role':'status','aria-live':'polite'}),catalog=node('div',{'data-role':'catalog'});
  addStage.addEventListener('click',()=>stages.append(stageRow()));addEdge.addEventListener('click',()=>edges.append(edgeRow()));publish.disabled=!canConfigure();publish.addEventListener('click',async()=>{publish.disabled=true;status.textContent='در حال انتشار…';try{const version=await window.officeWorkflowPublish({policyKey:String(policyKey.value||'').trim(),title:String(title.value||'').trim(),definition:definitionFrom(wrap)});status.textContent='نسخه '+String(version)+' منتشر شد.';renderCatalog(catalog,await window.officeWorkflowPolicies())}catch(e){status.textContent='انتشار ناموفق: '+messageOf(e)}finally{publish.disabled=!canConfigure()}});
  form.append(node('label',{},'کلید سیاست'),policyKey,node('label',{},'عنوان سیاست'),title,addStage,stages,addEdge,edges,publish,status);wrap.append(form,node('h3',{},'نسخه‌های فعال'),catalog);root.append(wrap);window.officeWorkflowPolicies().then(rows=>renderCatalog(catalog,rows)).catch(e=>catalog.replaceChildren(node('p',{'class':'af-empty'},'دریافت سیاست‌ها ناموفق بود: '+messageOf(e))));return wrap;
};
function renderRuntime(s){
  if(!stillCurrent(s))return;const root=s.root;root.replaceChildren();const wrap=node('section',{'class':'office-workflow-runtime','aria-label':'گردش مکاتبه','data-correspondence-id':s.correspondenceId});wrap.append(node('h3',{},'گردش مکاتبه'),node('p',{'class':'text-muted'},'مرحله گردش، جایگزین ثبت دبیرخانه یا تأیید داخلی نامه نیست.'));const status=node('div',{'role':'status','aria-live':'polite'},s.message||'');wrap.append(status);
  if(s.loading){wrap.append(node('p',{'class':'af-empty'},'در حال دریافت گردش…'));root.append(wrap);return}
  const data=s.data||{instance:null,allowed_edges:[],events:[]};
  if(!data.instance){wrap.append(node('p',{},'برای این مکاتبه هنوز گردش متصل نشده است.'));if(s.catalogError)wrap.append(node('p',{'class':'af-empty'},'دریافت سیاست‌های قابل اتصال ناموفق بود.'));if(Array.isArray(s.catalog)&&s.catalog.length){const select=node('select',{'aria-label':'سیاست گردش','data-role':'workflow-policy-select'});s.catalog.forEach(p=>{select.append(node('option',{'value':String(p.policy_key)+'::'+String(p.version)},String(p.title||p.policy_key)+' · نسخه '+String(p.version)));select.append(node('option',{'value':String(p.policy_key)+'@'+String(p.version),'hidden':'hidden'},String(p.title||p.policy_key)+' · نسخه '+String(p.version)))});const attach=node('button',{'type':'button','class':'btn btn-primary btn-inline','disabled':s.pending},'اتصال گردش');attach.addEventListener('click',()=>window.officeWorkflowAttach());wrap.append(node('label',{},'سیاست گردش'),select,attach)}root.append(wrap);return}
  const i=data.instance;if(i.policy_title||i.policy_key)wrap.append(node('div',{'class':'office-workflow-policy-title'},i.policy_title||i.policy_key));wrap.append(node('div',{'class':'office-workflow-current-stage'},'مرحله فعلی: '+String(i.stage_label||i.stage_id||'—')));
  const actions=node('div',{'data-role':'workflow-edge-actions'});(Array.isArray(data.allowed_edges)?data.allowed_edges:[]).forEach(edge=>{const b=node('button',{'type':'button','class':'btn btn-primary btn-inline','disabled':s.pending},edge.label||edge.id);b.addEventListener('click',()=>window.officeWorkflowTransition(edge.id));actions.append(b)});wrap.append(actions);
  const history=node('div',{'data-role':'workflow-history'});history.append(node('h4',{},'سابقه گردش'));(Array.isArray(data.events)?data.events:[]).forEach(ev=>{const row=node('div',{'class':'office-workflow-event'});row.append(node('strong',{},'نسخه '+String(ev.revision)),node('span',{},' · '+String(ev.edge_label||ev.to_stage_label||ev.event_type||'رویداد')),node('span',{},' · '+String(ev.actor_id||'—')),node('span',{},' · '+String(ev.created_at||'—')));if(ev.note)row.append(node('div',{},ev.note));history.append(row)});wrap.append(history);root.append(wrap);
}
async function readRuntime(s){
  const generation=s.generation,organizationId=s.organizationId;const {data,error}=await rpc().rpc('office_workflow_read',{p_organization_id:organizationId,p_correspondence_id:s.correspondenceId,p_after_revision:-1,p_limit:100});if(!stillCurrent(s)||generation!==s.generation)return false;if(error)throw error;s.data=data&&typeof data==='object'?data:{instance:null,allowed_edges:[],events:[],next_after_revision:-1};s.loading=false;return true;
}
async function loadRuntime(s){try{if(!await readRuntime(s))return;if(!s.data.instance){try{const {data,error}=await rpc().rpc('office_workflow_catalog',{p_organization_id:s.organizationId});if(!stillCurrent(s))return;if(error)throw error;s.catalog=Array.isArray(data)?data:[]}catch(e){s.catalog=[];s.catalogError=true}}renderRuntime(s)}catch(e){if(!stillCurrent(s))return;s.loading=false;s.message='دریافت گردش ناموفق بود: '+messageOf(e);renderRuntime(s)}}
window.officeWorkflowMountRuntime=function(root,correspondenceId){if(!root)throw new Error('root required');if(!correspondenceId)throw new Error('correspondence required');const organizationId=orgId();if(!organizationId)throw new Error('organization required');const s={root,correspondenceId:String(correspondenceId),organizationId:String(organizationId),generation:++runtimeGeneration,loading:true,pending:false,data:null,catalog:null,catalogError:false,message:'',intent:null};activeRuntime=s;renderRuntime(s);loadRuntime(s);return s};
window.officeWorkflowOpen=function(correspondenceId,root){let target=root;if(!target){const office=document.getElementById('view-office');if(!office)return null;target=office.querySelector('[data-office-workflow-panel]');if(!target){target=node('div',{'data-office-workflow-panel':'true'});office.append(target)}}return window.officeWorkflowMountRuntime(target,correspondenceId)};
window.officeWorkflowAttach=async function(){
  const s=activeRuntime;if(!s||!stillCurrent(s)||s.pending||s.data?.instance)return false;const select=s.root.querySelector('[data-role="workflow-policy-select"]');if(!select)return false;const raw=String(select.value||''),parts=raw.includes('::')?raw.split('::'):raw.split('@'),policyKey=parts[0],policyVersion=Number(parts[1]);if(!policyKey||!Number.isInteger(policyVersion)||policyVersion<1)return false;const intentKey='attach|'+policyKey+'|'+policyVersion;if(!s.intent||s.intent.key!==intentKey)s.intent={key:intentKey,requestId:requestId()};s.pending=true;s.message='در حال اتصال گردش…';renderRuntime(s);
  try{const {data,error}=await rpc().rpc('office_workflow_attach',{p_organization_id:s.organizationId,p_correspondence_id:s.correspondenceId,p_policy_key:policyKey,p_policy_version:policyVersion,p_request_id:s.intent.requestId});if(!stillCurrent(s))return false;if(error)throw error;s.intent=null;s.pending=false;s.data={instance:{instance_id:data.instance_id,stage_id:data.stage_id,revision:data.revision},allowed_edges:[],events:[]};s.message='گردش متصل شد.';renderRuntime(s);try{if(await readRuntime(s)){s.message='گردش متصل شد.';renderRuntime(s)}}catch(_){}return true}catch(e){if(!stillCurrent(s))return false;s.pending=false;if(errorCode(e)==='42501'){s.intent=null;s.message='دسترسی برای اتصال گردش وجود ندارد.'}else{s.message='اتصال انجام نشد؛ برای همان درخواست دوباره تلاش کنید.'}renderRuntime(s);return false}
};
window.officeWorkflowTransition=async function(edgeId){
  const s=activeRuntime;if(!s||!stillCurrent(s)||s.pending||!s.data?.instance)return false;const edge=(s.data.allowed_edges||[]).find(x=>String(x.id)===String(edgeId));if(!edge)return false;const note=String(window.prompt?window.prompt('یادداشت انتقال (اختیاری):')||'':'');const revision=Number(s.data.instance.revision),intentKey='transition|'+edge.id+'|'+revision+'|'+note;if(!s.intent||s.intent.key!==intentKey)s.intent={key:intentKey,requestId:requestId()};s.pending=true;s.message='در حال ثبت انتقال…';renderRuntime(s);
  try{const {data,error}=await rpc().rpc('office_workflow_transition',{p_organization_id:s.organizationId,p_instance_id:s.data.instance.instance_id,p_edge_id:edge.id,p_expected_revision:revision,p_request_id:s.intent.requestId,p_note:note||null});if(!stillCurrent(s))return false;if(error)throw error;s.intent=null;s.pending=false;s.data={...s.data,instance:{...s.data.instance,stage_id:data.stage_id,stage_label:data.stage_id,revision:data.revision},allowed_edges:[]};s.message='انتقال ثبت شد.';renderRuntime(s);try{if(await readRuntime(s)){s.message='انتقال ثبت شد.';renderRuntime(s)}}catch(_){}return true}catch(e){if(!stillCurrent(s))return false;s.pending=false;const code=errorCode(e);if(code==='40001'||/stale workflow revision/i.test(messageOf(e))){s.intent=null;try{await readRuntime(s)}catch(_){}if(!stillCurrent(s))return false;s.message='تغییر هم‌زمان تشخیص داده شد؛ اطلاعات تازه شد. اقدام را دوباره انتخاب کنید.';renderRuntime(s);return false}if(code==='42501'){s.intent=null;s.message='دسترسی برای این انتقال وجود ندارد.';renderRuntime(s);return false}s.message='انتقال ثبت نشد؛ برای همان درخواست دوباره تلاش کنید.';renderRuntime(s);return false}
};
window.FINORA_OFFICE_WORKFLOW_C8_UI_VERSION='c8-task3-v2';
})();