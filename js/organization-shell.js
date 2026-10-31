/* Slice B / ELI organization shell controls loaded after platform modules. */
(function(){
window.showFinoraOrganizationSwitcher=function(){
  const xs=currentUser?.organizations||[];if(xs.length<2)return;
  let el=document.getElementById('finora-org-switch-modal');if(!el){el=document.createElement('div');el.id='finora-org-switch-modal';el.className='modal-backdrop';document.body.appendChild(el)}
  el.innerHTML='<div class="modal-card" style="max-width:520px"><h3>انتخاب سازمان فعال</h3><p class="af-hint">اطلاعات، لایسنس و دسترسی‌ها بر اساس سازمان انتخاب‌شده بارگذاری می‌شوند.</p>'+finoraOrganizationSwitcherHtml()+'<div style="margin-top:14px"><button class="btn btn-secondary" onclick="document.getElementById(\'finora-org-switch-modal\').classList.remove(\'active\')">بستن</button></div></div>';el.classList.add('active');
};
function ensureOrgShell(){
  const footer=document.querySelector('.app-shell-nav .sidebar-footer');if(!footer)return;
  let b=document.getElementById('finora-org-switch-btn');
  const multiple=(currentUser?.organizations||[]).length>1;
  if(multiple&&!b){b=document.createElement('button');b.id='finora-org-switch-btn';b.className='shell-logout';b.title='تغییر سازمان';b.textContent='سازمان';b.onclick=()=>window.showFinoraOrganizationSwitcher();footer.appendChild(b)}
  if(b)b.style.display=multiple?'':'none';
  window.refreshFinoraOrganizationAccessButton?.();
}
const baseEnter=enterApp;enterApp=async function(authUser){const r=await baseEnter(authUser);ensureOrgShell();return r};
const baseRefresh=refreshAllSurfaces;refreshAllSurfaces=function(){const r=baseRefresh();ensureOrgShell();return r};
})();
