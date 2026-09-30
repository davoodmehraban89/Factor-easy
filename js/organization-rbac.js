/* Finora Slice B organization context + member capabilities. Server RLS remains authoritative. */
(function(){
const baseFetchCurrentUser=fetchCurrentUser;
async function loadOrganizationContext(user){
  const {data:members,error:memberError}=await sb.from('organization_members').select('id,organization_id,unit_id,position_title,status,is_owner').eq('user_id',user.id).eq('status','active');
  if(memberError)throw memberError;
  const orgIds=(members||[]).map(x=>x.organization_id);
  if(!orgIds.length)throw new Error('عضویت سازمانی برای این کاربر تعریف نشده است.');
  const [{data:orgs,error:orgError},{data:perms,error:permError},{data:licenses,error:licenseError},{data:activeMembers,error:seatError}]=await Promise.all([
    sb.from('organizations').select('id,name,status').in('id',orgIds),
    sb.from('member_module_permissions').select('id,organization_id,member_id,module_key,capabilities,scope_type,scope_id,confidentiality_level').in('organization_id',orgIds),
    sb.from('licenses').select('*').in('organization_id',orgIds),
    sb.from('organization_members').select('id,organization_id,status').in('organization_id',orgIds).eq('status','active')
  ]);
  if(orgError)throw orgError;if(permError)throw permError;if(licenseError)throw licenseError;if(seatError)throw seatError;
  const contexts=(members||[]).map(m=>({membership:m,organization:(orgs||[]).find(o=>o.id===m.organization_id),license:(licenses||[]).find(l=>l.organization_id===m.organization_id),permissions:(perms||[]).filter(p=>p.member_id===m.id)})).filter(x=>x.organization&&x.license);
  const saved=localStorage.getItem('finora_active_org_'+user.id);
  const selected=contexts.find(x=>x.organization.id===saved)||contexts.find(x=>x.membership.is_owner)||contexts[0];
  const lic=selected.license,sub={type:lic.plan,startDate:lic.starts_at,endDate:lic.ends_at,status:lic.status};
  user.organizations=contexts;
  user.organizationId=selected.organization.id;
  user.organizationName=selected.organization.name;
  user.membershipId=selected.membership.id;
  user.organizationUnitId=selected.membership.unit_id||'';
  user.isOrganizationOwner=!!selected.membership.is_owner;
  user.modulePermissions=selected.permissions||[];
  const commercial=Array.isArray(lic.modules)&&lic.modules.length?lic.modules.slice():['full_suite'];
  user.commercialModules=commercial;
  if(user.isOrganizationOwner)user.modules=commercial.slice();
  else{const readable=(user.modulePermissions||[]).filter(p=>Array.isArray(p.capabilities)&&p.capabilities.includes('read')).map(p=>p.module_key);user.modules=readable.includes('full_suite')?['full_suite']:[...new Set(readable.filter(k=>commercial.includes('full_suite')||commercial.includes(k)))];}
  user.maxCompanies=Math.max(1,Number(lic.max_companies||1));
  user.maxUsers=Math.max(1,Number(lic.max_users||1));
  user.activeSeatCount=(activeMembers||[]).filter(x=>x.organization_id===selected.organization.id).length;
  user.remainingSeats=Math.max(0,user.maxUsers-user.activeSeatCount);
  user.subscription=sub;user.subscriptionType=sub.type;user.subscriptionStart=sub.startDate;user.subscriptionEnd=sub.endDate;user.licenseStatus=sub.status;
  return user;
}
fetchCurrentUser=async function(authUser){return loadOrganizationContext(await baseFetchCurrentUser(authUser))};
window.hasFinoraCapability=function(moduleKey,capability='read'){
  if(!currentUser)return false;
  if(moduleKey==='core'&&capability==='read')return true;
  const mods=Array.isArray(currentUser.commercialModules)&&currentUser.commercialModules.length?currentUser.commercialModules:['full_suite'];
  if(moduleKey!=='core'&&!(mods.includes('full_suite')||mods.includes(moduleKey)))return false;
  if(currentUser.isOrganizationOwner)return true;
  return (currentUser.modulePermissions||[]).some(p=>(p.module_key===moduleKey||p.module_key==='full_suite')&&Array.isArray(p.capabilities)&&p.capabilities.includes(capability));
};
const legacyPullAll=pullAll;
pullAll=async function(){
  if(!currentUser?.organizationId)return legacyPullAll();
  const uid=currentUser.id,fresh={};COLLS.forEach(k=>fresh[k]=[]);
  const snap=new Map(),page=1000;let from=0;
  for(;;){
    const {data,error}=await sb.from('records').select('collection,id,data,owner_id,organization_id').eq('organization_id',currentUser.organizationId).order('collection').order('id').range(from,from+page-1);
    if(error)throw error;
    (data||[]).forEach(r=>{if(!fresh[r.collection])return;const obj=(r.data&&typeof r.data==='object'&&!Array.isArray(r.data))?r.data:{};obj.id=r.id;snap.set(r.collection+'|'+r.id,JSON.stringify(stripOwner(obj)));obj.ownerUserId=uid;fresh[r.collection].push(obj)});
    if(!data||data.length<page)break;from+=page;
  }
  datastore=fresh;syncSnap.clear();snap.forEach((v,k)=>syncSnap.set(k,v));
};
runSync=async function(){
  if(!currentUser)return;if(syncRunning){syncAgain=true;return;}syncRunning=true;
  try{let guardLoops=0;do{syncAgain=false;const {up,del}=computeDiff();if(!up.length&&!del.length)break;setSyncBadge('saving');const deletes=del.map(k=>{const j=k.indexOf('|');return {collection:k.slice(0,j),id:k.slice(j+1)}});const {error}=await sb.rpc('finora_sync_records',{p_upserts:up.map(r=>({collection:r.coll,id:r.id,data:r.payload})),p_deletes:deletes,p_organization_id:currentUser.organizationId||null});if(error)throw error;up.forEach(r=>syncSnap.set(r.key,r.s));deletes.forEach(r=>syncSnap.delete(r.collection+'|'+r.id));syncFailCount=0;guardLoops++}while(guardLoops<5);const d=computeDiff();syncPending=!!(d.up.length||d.del.length);if(syncPending)scheduleSync(500);else setSyncBadge('saved')}catch(err){console.error('sync error',err);await handleSyncError(err)}finally{syncRunning=false}
};
window.switchFinoraOrganization=async function(orgId){
  if(!currentUser?.organizations?.some(x=>x.organization.id===orgId))return false;
  localStorage.setItem('finora_active_org_'+currentUser.id,orgId);
  const {data}=await sb.auth.getUser();if(!data?.user)return false;
  currentUser=await fetchCurrentUser(data.user);await pullAll();refreshAllSurfaces();if(typeof showModuleLauncher==='function')showModuleLauncher(true);return true;
};
window.finoraOrganizationSwitcherHtml=function(){
  const xs=currentUser?.organizations||[];if(xs.length<2)return '';
  return '<div class="form-group" style="margin-top:12px"><label>سازمان فعال</label><select class="form-control" onchange="switchFinoraOrganization(this.value)">'+xs.map(x=>'<option value="'+esc(x.organization.id)+'" '+(x.organization.id===currentUser.organizationId?'selected':'')+'>'+esc(x.organization.name)+'</option>').join('')+'</select></div>';
};
window.finoraCanConfigureModule=function(moduleKey){return !!currentUser&&(currentUser.isOrganizationOwner||hasFinoraCapability(moduleKey,'configure'))};
window.finoraCanManageOrganization=function(){return !!currentUser&&(currentUser.isOrganizationOwner||hasFinoraCapability('core','configure'))};
async function orgManagerData(){
  const {data:members,error}=await sb.from('organization_members').select('id,user_id,unit_id,position_title,is_owner,status').eq('organization_id',currentUser.organizationId);if(error)throw error;
  const ids=(members||[]).map(x=>x.user_id),profiles=ids.length?(await sb.from('profiles').select('id,full_name,email').in('id',ids)).data||[]:[];
  return (members||[]).map(m=>Object.assign({},m,{profile:profiles.find(p=>p.id===m.user_id)}));
}
function configurableModules(){
  if(currentUser?.isOrganizationOwner)return Object.entries(window.FINORA_MODULE_CATALOG||{}).filter(([k,v])=>k!=='core'&&v.implemented).map(([k,v])=>[k,v.title]);
  return (currentUser?.modulePermissions||[]).filter(p=>p.capabilities?.includes('configure')).map(p=>[p.module_key,(window.FINORA_MODULE_CATALOG||{})[p.module_key]?.title||p.module_key]);
}
window.showOrganizationAccessManager=async function(){
  const canManage=finoraCanManageOrganization();
  if(!canManage&&!configurableModules().length)return alert('دسترسی مدیریت اعضا یا مجوزهای ماژول را ندارید.');
  let el=document.getElementById('finora-org-access-modal');if(!el){el=document.createElement('div');el.id='finora-org-access-modal';el.className='modal-backdrop';document.body.appendChild(el)}
  const members=await orgManagerData(),mods=configurableModules();
  const activeCount=members.filter(m=>m.status==='active').length,maxUsers=Math.max(1,Number(currentUser.maxUsers||1)),remaining=Math.max(0,maxUsers-activeCount);
  const memberRows=members.map(m=>'<tr><td>'+esc(m.profile?.full_name||m.profile?.email||m.user_id)+'</td><td>'+esc(m.position_title||'—')+'</td><td>'+esc(m.status)+'</td><td>'+(m.is_owner?'مالک':(canManage?'<button class="btn btn-secondary btn-inline" onclick="organizationSetMemberStatusFromUi(\''+esc(m.id)+'\',\''+(m.status==='active'?'suspended':'active')+'\')">'+(m.status==='active'?'تعلیق':'فعال‌سازی')+'</button>':'—'))+'</td></tr>').join('');
  el.innerHTML='<div class="modal-card" style="max-width:900px"><div style="display:flex;justify-content:space-between;gap:10px"><div><h3>مدیریت دسترسی سازمان</h3><p class="af-hint">'+esc(currentUser.organizationName||'')+' · مجوز تجاری و مجوز عضو مستقل از هم هستند.</p><p id="org-seat-summary" class="af-hint"><strong>'+toPersianDigits(activeCount)+'</strong> کاربر فعال از <strong>'+toPersianDigits(maxUsers)+'</strong> · ظرفیت باقی‌مانده '+toPersianDigits(remaining)+'</p></div><button class="btn btn-secondary btn-inline" onclick="document.getElementById(\'finora-org-access-modal\').classList.remove(\'active\')">بستن</button></div>'+
  (canManage?'<div class="card" style="margin-top:14px"><h4>افزودن عضو موجود فینورا</h4><div class="form-row"><div class="form-group"><label>ایمیل</label><input id="org-member-email" class="form-control" type="email"></div><div class="form-group"><label>سمت</label><input id="org-member-position" class="form-control"></div></div><button class="btn btn-primary" onclick="organizationAddMemberFromUi()">افزودن عضو</button><p class="af-hint">دعوت کاربر فاقد حساب در ELI-3 اضافه می‌شود.</p><div class="table-responsive" style="margin-top:12px"><table><thead><tr><th>عضو</th><th>سمت</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>'+memberRows+'</tbody></table></div></div>':'')+
  '<div class="card"><h4>مجوز ماژول</h4><div class="form-row"><div class="form-group"><label>عضو</label><select id="org-perm-member" class="form-control">'+members.filter(m=>!m.is_owner&&m.status==='active').map(m=>'<option value="'+esc(m.id)+'">'+esc(m.profile?.full_name||m.profile?.email||m.position_title||m.user_id)+'</option>').join('')+'</select></div><div class="form-group"><label>ماژول</label><select id="org-perm-module" class="form-control">'+mods.map(x=>'<option value="'+esc(x[0])+'">'+esc(x[1])+'</option>').join('')+'</select></div><div class="form-group"><label>دامنه</label><select id="org-perm-scope" class="form-control" onchange="document.getElementById(\'org-perm-scope-id\').disabled=[\'own\',\'organization\'].includes(this.value)"><option value="own">فقط رکوردهای خود</option><option value="unit">واحد</option><option value="branch">شعبه</option><option value="company">شرکت</option><option value="organization">کل سازمان</option></select></div><div class="form-group"><label>شناسه دامنه</label><input id="org-perm-scope-id" class="form-control" disabled></div></div><div class="form-group"><label>قابلیت‌ها</label><div id="org-perm-caps" style="display:flex;gap:10px;flex-wrap:wrap">'+[['read','مشاهده'],['create','ایجاد'],['edit','ویرایش'],['delete','حذف'],['approve','تأیید'],['register','ثبت دبیرخانه'],['refer','ارجاع'],['archive','بایگانی'],['configure','مدیریت ماژول']].map(x=>'<label><input type="checkbox" value="'+x[0]+'" '+(x[0]==='read'?'checked':'')+'> '+x[1]+'</label>').join('')+'</div></div><div class="form-row"><div class="form-group"><label>سطح محرمانگی</label><select id="org-perm-clearance" class="form-control"><option value="0">عادی</option><option value="1">محرمانه</option><option value="2">خیلی محرمانه</option><option value="3">سری</option></select></div></div><button class="btn btn-success" onclick="organizationSavePermissionFromUi()">ثبت/به‌روزرسانی مجوز</button></div></div>';
  el.classList.add('active');
};
window.organizationAddMemberFromUi=async function(){
  if(!finoraCanManageOrganization())return;
  const email=String(document.getElementById('org-member-email')?.value||'').trim(),position=String(document.getElementById('org-member-position')?.value||'').trim();if(!email)return alert('ایمیل عضو را وارد کنید.');
  const {error}=await sb.rpc('organization_add_member',{p_organization_id:currentUser.organizationId,p_email:email,p_position_title:position,p_unit_id:null});if(error)return alert('افزودن عضو انجام نشد: '+error.message);await showOrganizationAccessManager();
};
window.organizationSetMemberStatusFromUi=async function(memberId,status){
  if(!finoraCanManageOrganization())return;
  const {error}=await sb.rpc('organization_set_member_status',{p_organization_id:currentUser.organizationId,p_member_id:memberId,p_status:status});
  if(error)return alert('تغییر وضعیت عضو انجام نشد: '+error.message);
  const {data}=await sb.auth.getUser();if(data?.user)currentUser=await fetchCurrentUser(data.user);
  await showOrganizationAccessManager();
};
window.organizationSavePermissionFromUi=async function(){
  const member=document.getElementById('org-perm-member')?.value,module=document.getElementById('org-perm-module')?.value,scope=document.getElementById('org-perm-scope')?.value||'own',scopeId=['own','organization'].includes(scope)?null:String(document.getElementById('org-perm-scope-id')?.value||'').trim(),caps=[...document.querySelectorAll('#org-perm-caps input:checked')].map(x=>x.value),clearance=Number(document.getElementById('org-perm-clearance')?.value||0);
  if(!member||!module||!caps.length)return alert('عضو، ماژول و حداقل یک قابلیت الزامی است.');if(!['own','organization'].includes(scope)&&!scopeId)return alert('شناسه دامنه را وارد کنید.');
  const {error}=await sb.rpc('organization_set_member_permission',{p_organization_id:currentUser.organizationId,p_member_id:member,p_module_key:module,p_capabilities:caps,p_scope_type:scope,p_scope_id:scopeId,p_confidentiality_level:clearance});if(error)return alert('ثبت مجوز انجام نشد: '+error.message);alert('مجوز عضو ثبت شد.');await showOrganizationAccessManager();
};
function ensureOrgAccessButton(){
  const rail=document.getElementById('module-rail');if(!rail||document.getElementById('finora-org-access-btn'))return;
  const b=document.createElement('button');b.id='finora-org-access-btn';b.className='module-tab';b.title='سازمان و دسترسی‌ها';b.innerHTML='<span>♙</span><b>دسترسی‌ها</b>';b.onclick=showOrganizationAccessManager;rail.appendChild(b);
  b.style.display=(finoraCanManageOrganization()||configurableModules().length)?'':'none';
}
const baseEnterAppOrg=enterApp;
enterApp=async function(authUser){const r=await baseEnterAppOrg(authUser);ensureOrgAccessButton();return r};
})();