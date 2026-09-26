let adminUsersCache=[];
async function renderAdminPanel(){
  const tbody=document.getElementById('admin-users-table-body');
  if(!tbody||!currentUser||currentUser.role!=='admin')return;
  tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:20px">در حال بارگذاری کاربران...</td></tr>';
  const [p,l]=await Promise.all([
    sb.from('profiles').select('id,email,username,role,created_at').order('created_at',{ascending:false}),
    sb.from('licenses').select('user_id,plan,status,starts_at,ends_at')
  ]);
  if(p.error||l.error){tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--danger)">خطا در دریافت لیست کاربران.</td></tr>';return;}
  const lic=new Map((l.data||[]).map(x=>[x.user_id,x]));
  adminUsersCache=(p.data||[]).map(u=>Object.assign({},u,{lic:lic.get(u.id)||null}));
  if(adminUsersCache.length===0){tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:20px">هیچ کاربری یافت نشد.</td></tr>';return;}
  const planLabels={monthly:'طرح ۱ ماهه',three_months:'طرح ۳ ماهه',annual:'طرح ۱ ساله',lifetime:'دائمی (Lifetime)',trial:'آزمایشی (Trial)'};
  tbody.innerHTML=adminUsersCache.map(u=>{
    const sub=u.lic?{type:u.lic.plan,startDate:u.lic.starts_at,endDate:u.lic.ends_at,status:u.lic.status}:{type:'trial',startDate:'',endDate:'',status:'cancelled'};
    const remDays=getRemainingDays(sub.endDate);
    const isExp=remDays<=0&&sub.type!=='lifetime';
    let statusBadge='';
    if(sub.status==='cancelled')statusBadge='<span class="badge badge-danger">لغو شده</span>';
    else if(sub.status==='active')statusBadge=isExp?'<span class="badge badge-danger">منقضی شده</span>':'<span class="badge badge-success">فعال</span>';
    else statusBadge=isExp?'<span class="badge badge-danger">آزمایشی منقضی</span>':'<span class="badge badge-warning">آزمایشی</span>';
    const endJalali=sub.type==='lifetime'?'نامحدود':formatToJalali(sub.endDate);
    const remDaysText=sub.type==='lifetime'?'نامحدود':toPersianDigits(Math.max(0,remDays))+' روز';
    const uid=esc(u.id);
    return `<tr><td><strong>${esc(u.email||u.username||'—')}</strong> ${u.role==='admin'?'<span class="badge badge-info">مدیر</span>':''}</td><td>${statusBadge}</td><td>${esc(planLabels[sub.type]||sub.type)}</td><td>${formatToJalali(sub.startDate)}</td><td>${endJalali}</td><td>${remDaysText}</td><td style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-success btn-inline" style="padding:3px 8px;font-size:11px;min-height:30px" onclick="adminActivateLicense('${uid}')">فعال‌سازی</button><button class="btn btn-secondary btn-inline" style="padding:3px 8px;font-size:11px;min-height:30px" onclick="openLicenseEditModal('${uid}')">تغییر مدت</button><button class="btn btn-secondary btn-inline" style="padding:3px 8px;font-size:11px;min-height:30px" onclick="adminExtendSubscription('${uid}', 30)">+۳۰ روز</button>${sub.status!=='cancelled'?`<button class="btn btn-danger btn-inline" style="padding:3px 8px;font-size:11px;min-height:30px" onclick="adminCancelSubscription('${uid}')">لغو اشتراک</button>`:''}</td></tr>`;
  }).join('');
}
function refreshAdminPanel(){renderAdminPanel();}
async function adminRpc(name,args,okMsg){
  const {error}=await sb.rpc(name,args);
  if(error){alert('خطا: '+(error.message||'عملیات ناموفق بود.'));return false;}
  if(okMsg)alert(okMsg);
  if(currentUser&&args.target===currentUser.id){try{currentUser=await fetchCurrentUser({id:currentUser.id});updateLicenseDisplay(currentUser);}catch(e){}}
  renderAdminPanel();
  return true;
}
function adminActivateLicense(uid){
  return adminRpc('admin_set_license',{target:uid,new_plan:'monthly',days:30,new_status:'active'},'لایسنس ۱ ماهه فعال شد.');
}
function openLicenseEditModal(uid){
  const u=adminUsersCache.find(x=>x.id===uid);if(!u)return;
  document.getElementById('modal-license-target-username').value=uid;
  document.getElementById('modal-license-user-title').innerText='تغییر مدت و نوع لایسنس: '+(u.email||u.username);
  const cur=u.lic&&u.lic.plan!=='trial'?u.lic.plan:'monthly';
  document.getElementById('modal-license-duration-select').value=cur;
  document.getElementById('modal-admin-license-edit').classList.add('active');
}
function closeLicenseEditModal(){document.getElementById('modal-admin-license-edit').classList.remove('active');}
function applyLicenseDurationChange(){
  const uid=document.getElementById('modal-license-target-username').value;
  const plan=document.getElementById('modal-license-duration-select').value;
  closeLicenseEditModal();
  return adminRpc('admin_set_license',{target:uid,new_plan:plan,new_status:'active'},'طرح لایسنس کاربر تغییر یافت.');
}
function adminExtendSubscription(uid,days){
  const u=adminUsersCache.find(x=>x.id===uid);
  if(u&&u.lic&&u.lic.plan==='lifetime'){alert('این حساب دائمی است و نیازی به تمدید ندارد.');return;}
  return adminRpc('admin_extend_license',{target:uid,days},'اشتراک کاربر '+days+' روز تمدید شد.');
}
function adminCancelSubscription(uid){
  const u=adminUsersCache.find(x=>x.id===uid);
  if(!confirm('آیا از لغو اشتراک کاربر '+(u?(u.email||u.username):'')+' اطمینان دارید؟'))return;
  return adminRpc('admin_cancel_license',{target:uid},'اشتراک کاربر لغو شد.');
}
