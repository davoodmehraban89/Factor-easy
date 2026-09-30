/* Slice B organization shell controls loaded after platform-modules. */
(function(){
function canManage(){return !!currentUser&&(currentUser.isOrganizationOwner||(currentUser.modulePermissions||[]).some(p=>Array.isArray(p.capabilities)&&p.capabilities.includes('configure')))}
window.showFinoraOrganizationSwitcher=function(){
  const xs=currentUser?.organizations||[];if(xs.length<2)return;
  let el=document.getElementById('finora-org-switch-modal');if(!el){el=document.createElement('div');el.id='finora-org-switch-modal';el.className='modal-backdrop';document.body.appendChild(el)}
  el.innerHTML='<div class="modal-card" style="max-width:520px"><h3>انتخاب سازمان فعال</h3><p class="af-hint">اطلاعات، لایسنس و دسترسی‌ها بر اساس سازمان انتخاب‌شده بارگذاری می‌شوند.</p>'+finoraOrganizationSwitcherHtml()+'<div style="margin-top:14px"><button class="btn btn-secondary" onclick="document.getElementById(\'finora-org-switch-modal\').classList.remove(\'active\')">بستن</button></div></div>';el.classList.add('active');
};
function ensureOrgShell(){
  const rail=document.getElementById('module-rail');if(!rail||!currentUser)return;
  if((currentUser.organizations||[]).length>1&&!document.getElementById('finora-org-switch-btn')){const b=document.createElement('button');b.id='finora-org-switch-btn';b.className='module-tab';b.title='تغییر سازمان';b.innerHTML='<span>⇄</span><b>سازمان</b>';b.onclick=showFinoraOrganizationSwitcher;rail.appendChild(b)}
  if(canManage()&&!document.getElementById('finora-org-access-btn')){const b=document.createElement('button');b.id='finora-org-access-btn';b.className='module-tab';b.title='سازمان و دسترسی‌ها';b.innerHTML='<span>♙</span><b>دسترسی‌ها</b>';b.onclick=showOrganizationAccessManager;rail.appendChild(b)}
}
const baseEnter=enterApp;enterApp=async function(authUser){const r=await baseEnter(authUser);ensureOrgShell();return r};
const baseRefresh=refreshAllSurfaces;refreshAllSurfaces=function(){const r=baseRefresh();ensureOrgShell();return r};
})();
