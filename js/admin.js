let adminUsersCache=[];
async function renderAdminPanel(){
  const tbody=document.getElementById('admin-users-table-body');
  if(!tbody||!currentUser||currentUser.role!=='admin')return;
  tbody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:20px">در حال بارگذاری کاربران...</td></tr>';
  const [p,l]=await Promise.all([
    sb.from('profiles').select('id,email,username,full_name,role,created_at').order('created_at',{ascending:false}),
    sb.from('licenses').select('*')
  ]);
  if(p.error||l.error){tbody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--danger)">خطا در دریافت لیست کاربران.</td></tr>';return;}
  const lic=new Map((l.data||[]).map(x=>[x.user_id,x]));
  adminUsersCache=(p.data||[]).map(u=>Object.assign({},u,{lic:lic.get(u.id)||null}));
  if(adminUsersCache.length===0){tbody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:20px">هیچ کاربری یافت نشد.</td></tr>';return;}
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
    const capacity=Math.max(1,Number(u.lic?.max_companies||1)),userCapacity=Math.max(1,Number(u.lic?.max_users||1));return `<tr><td><strong>${esc(u.full_name||u.email||u.username||'—')}</strong><small style="display:block;color:var(--text-muted)">${esc(u.email||'')}</small> ${u.role==='admin'?'<span class="badge badge-info">مدیر سیستم</span>':''}</td><td>${statusBadge}</td><td>${esc(planLabels[sub.type]||sub.type)}</td><td><strong>${toPersianDigits(capacity)}</strong> شرکت</td><td><strong>${toPersianDigits(userCapacity)}</strong> کاربر</td><td>${formatToJalali(sub.startDate)}</td><td>${endJalali}</td><td>${remDaysText}</td><td style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-success btn-inline" style="padding:3px 8px;font-size:11px;min-height:30px" onclick="adminActivateLicense('${uid}')">فعال‌سازی</button><button class="btn btn-secondary btn-inline" style="padding:3px 8px;font-size:11px;min-height:30px" onclick="openLicenseEditModal('${uid}')">تغییر مدت</button><button class="btn btn-secondary btn-inline" style="padding:3px 8px;font-size:11px;min-height:30px" onclick="adminExtendSubscription('${uid}', 30)">+۳۰ روز</button>${sub.status!=='cancelled'?`<button class="btn btn-danger btn-inline" style="padding:3px 8px;font-size:11px;min-height:30px" onclick="adminCancelSubscription('${uid}')">لغو اشتراک</button>`:''}</td></tr>`;
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
  const cap=document.getElementById('modal-license-company-limit'),hint=document.getElementById('modal-license-company-limit-hint'),companyReady=!!(u.lic&&Object.prototype.hasOwnProperty.call(u.lic,'max_companies'));
  const users=document.getElementById('modal-license-user-limit'),userHint=document.getElementById('modal-license-user-limit-hint'),userReady=!!(u.lic&&Object.prototype.hasOwnProperty.call(u.lic,'max_users'));
  if(cap){cap.value=String(Math.max(1,Number(u.lic?.max_companies||1)));cap.disabled=!companyReady;}if(hint)hint.textContent=companyReady?'ظرفیت شرکت در سرور اعمال می‌شود.':'ظرفیت شرکت فعلاً روی پیش‌فرض ۱ است.';
  if(users){users.value=String(Math.max(1,Number(u.lic?.max_users||1)));users.disabled=!userReady;}if(userHint)userHint.textContent=userReady?'ظرفیت کاربران نام‌دار در سرور اعمال می‌شود.':'Seat server contract هنوز روی این لایسنس فعال نشده است.';
  document.getElementById('modal-admin-license-edit').classList.add('active');
}
function closeLicenseEditModal(){document.getElementById('modal-admin-license-edit').classList.remove('active');}
async function applyLicenseDurationChange(){const uid=document.getElementById('modal-license-target-username').value,plan=document.getElementById('modal-license-duration-select').value,u=adminUsersCache.find(x=>x.id===uid),ready=!!(u?.lic&&Object.prototype.hasOwnProperty.call(u.lic,'max_companies')),cap=Math.max(1,Math.min(1000,Number(document.getElementById('modal-license-company-limit')?.value||1)));closeLicenseEditModal();const ok=await adminRpc('admin_set_license',{target:uid,new_plan:plan,new_status:'active'},'');if(!ok)return false;if(ready)return adminRpc('admin_set_company_limit',{target:uid,new_max_companies:cap},'لایسنس و ظرفیت شرکت کاربر اعمال شد.');alert('طرح لایسنس اعمال شد. ظرفیت شرکت فعلاً روی پیش‌فرض ۱ باقی می‌ماند تا Migration ظرفیت شرکت در سرور اعمال شود.');return true;}
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
