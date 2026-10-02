/* Finora ELI-3 invitation lifecycle UI. Server RPCs and RLS remain authoritative. */
(function(){
function invitationUrl(token){
  const u=new URL(window.location.href);u.search='';u.hash='';u.searchParams.set('invite',token);return u.toString();
}
async function invitationManagerData(){
  const [{data:invites,error:ie},{data:links,error:le},{data:roles,error:re}]=await Promise.all([
    sb.from('organization_invitations').select('id,email_normalized,position_title,status,expires_at,created_at').eq('organization_id',currentUser.organizationId).order('created_at',{ascending:false}),
    sb.from('organization_invitation_roles').select('invitation_id,role_id').eq('organization_id',currentUser.organizationId),
    sb.from('organization_roles').select('id,title,role_key,is_system,active').eq('organization_id',currentUser.organizationId).eq('active',true).order('is_system',{ascending:false}).order('title')
  ]);
  if(ie)throw ie;if(le)throw le;if(re)throw re;
  return {invites:invites||[],links:links||[],roles:roles||[]};
}
function invitationPanelHtml(data){
  const pending=data.invites.filter(x=>x.status==='pending');
  const rows=data.invites.map(i=>{
    const names=data.links.filter(x=>x.invitation_id===i.id).map(x=>data.roles.find(r=>r.id===x.role_id)?.title).filter(Boolean);
    return '<tr><td>'+esc(i.email_normalized)+'</td><td>'+esc(i.position_title||'—')+'</td><td>'+esc(names.join('، ')||'—')+'</td><td>'+esc(i.status)+'</td><td>'+esc(new Date(i.expires_at).toLocaleString('fa-IR'))+'</td><td>'+(i.status==='pending'?'<button class="btn btn-danger btn-inline" onclick="organizationRevokeInvitationFromUi(\''+esc(i.id)+'\')">لغو</button>':'—')+'</td></tr>';
  }).join('');
  return '<div class="card" id="org-invitation-card"><h4>دعوت کاربر جدید</h4><p class="af-hint">دعوت‌نامه به ایمیل و ظرفیت کاربری سازمان متصل است. لینک فقط هنگام ایجاد نمایش داده می‌شود.</p><div class="form-row"><div class="form-group"><label>ایمیل</label><input id="org-invite-email" class="form-control" type="email" autocomplete="off"></div><div class="form-group"><label>سمت</label><input id="org-invite-position" class="form-control"></div><div class="form-group"><label>اعتبار دعوت (ساعت)</label><input id="org-invite-hours" class="form-control" type="number" min="1" max="720" value="168"></div></div><div class="form-group"><label>نقش‌های اولیه</label><div id="org-invite-roles" style="display:flex;gap:10px;flex-wrap:wrap">'+data.roles.map(r=>'<label><input type="checkbox" value="'+esc(r.id)+'"> '+esc(r.title)+(r.is_system?' · پیش‌فرض':'')+'</label>').join('')+'</div></div><button class="btn btn-primary" onclick="organizationCreateInvitationFromUi()">ایجاد دعوت امن</button><div id="org-invite-result" style="display:none;margin-top:12px"><label>لینک یک‌بارنمایش دعوت</label><div style="display:flex;gap:8px;align-items:center"><input id="org-invite-url" class="form-control" readonly dir="ltr"><button class="btn btn-secondary btn-inline" onclick="organizationCopyInvitationUrl()">کپی</button></div><p class="af-hint">ارسال خودکار ایمیل هنوز فعال نشده؛ این لینک را از مسیر امن برای کاربر ارسال کنید.</p></div><div class="table-responsive" style="margin-top:12px"><table><thead><tr><th>ایمیل</th><th>سمت</th><th>نقش</th><th>وضعیت</th><th>انقضا</th><th>عملیات</th></tr></thead><tbody>'+rows+'</tbody></table></div><p class="af-hint">دعوت‌های در انتظار: '+toPersianDigits(pending.length)+'</p></div>';
}
async function injectInvitationPanel(){
  if(!window.finoraCanManageOrganization?.())return;
  const modal=document.getElementById('finora-org-access-modal');const card=modal?.querySelector('.modal-card');if(!card)return;
  modal.querySelector('#org-invitation-card')?.remove();
  try{card.insertAdjacentHTML('beforeend',invitationPanelHtml(await invitationManagerData()));}
  catch(e){console.error('invitation manager load failed',e);}
}
const baseShowOrganizationAccessManager=window.showOrganizationAccessManager;
window.showOrganizationAccessManager=async function(){const r=await baseShowOrganizationAccessManager();await injectInvitationPanel();return r};
window.organizationCreateInvitationFromUi=async function(){
  if(!window.finoraCanManageOrganization?.())return;
  const email=String(document.getElementById('org-invite-email')?.value||'').trim().toLowerCase();
  const position=String(document.getElementById('org-invite-position')?.value||'').trim();
  const hours=Number(document.getElementById('org-invite-hours')?.value||168);
  const roleIds=[...document.querySelectorAll('#org-invite-roles input:checked')].map(x=>x.value);
  if(!email||!email.includes('@'))return alert('ایمیل معتبر وارد کنید.');
  if(!Number.isInteger(hours)||hours<1||hours>720)return alert('اعتبار دعوت باید بین ۱ تا ۷۲۰ ساعت باشد.');
  const {data,error}=await sb.rpc('organization_create_invitation',{p_organization_id:currentUser.organizationId,p_email:email,p_unit_id:null,p_position_title:position||null,p_role_ids:roleIds,p_expires_hours:hours});
  if(error)return alert('ایجاد دعوت انجام نشد: '+error.message);
  const token=data?.token;if(!token)return alert('دعوت ایجاد شد اما توکن یک‌بارنمایش دریافت نشد.');
  const url=invitationUrl(token),box=document.getElementById('org-invite-result'),input=document.getElementById('org-invite-url');
  if(input)input.value=url;if(box)box.style.display='block';
};
window.organizationCopyInvitationUrl=async function(){
  const input=document.getElementById('org-invite-url');if(!input?.value)return;
  try{await navigator.clipboard.writeText(input.value);alert('لینک دعوت کپی شد.');}
  catch(_){input.focus();input.select();document.execCommand('copy');alert('لینک دعوت کپی شد.');}
};
window.organizationRevokeInvitationFromUi=async function(invitationId){
  if(!window.finoraCanManageOrganization?.())return;
  const {error}=await sb.rpc('organization_revoke_invitation',{p_organization_id:currentUser.organizationId,p_invitation_id:invitationId});
  if(error)return alert('لغو دعوت انجام نشد: '+error.message);await showOrganizationAccessManager();
};
window.processFinoraInvitationFromUrl=async function(){
  const u=new URL(window.location.href),token=u.searchParams.get('invite');if(!token)return false;
  const {data,error}=await sb.rpc('organization_accept_invitation',{p_token:token});
  if(error){alert('پذیرش دعوت انجام نشد: '+error.message);return false;}
  u.searchParams.delete('invite');history.replaceState({},'',u.pathname+(u.searchParams.toString()?'?'+u.searchParams.toString():'')+u.hash);
  alert('عضویت سازمانی با موفقیت فعال شد.');
  return !!data;
};
const baseEnterAppInvitation=enterApp;
enterApp=async function(authUser){
  await window.processFinoraInvitationFromUrl();
  return baseEnterAppInvitation(authUser);
};
})();
