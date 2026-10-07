let adminUsersCache=[];
async function renderAdminPanel(){
  const tbody=document.getElementById('admin-users-table-body');
  if(!tbody||!currentUser||currentUser.role!=='admin')return;
  tbody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:20px">در حال بارگذاری کاربران...</td></tr>';
  const [p,l]=await Promise.all([
    sb.from('profiles').select('id,email,phone,username,full_name,role,created_at').order('created_at',{ascending:false}),
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
    const capacity=Math.max(1,Number(u.lic?.max_companies||1)),userCapacity=Math.max(1,Number(u.lic?.max_users||1));return `<tr><td><strong>${esc(u.full_name||u.email||u.phone||u.username||'—')}</strong><small style="display:block;color:var(--text-muted)" dir="ltr">${esc(u.email||u.phone||'')}</small><small style="display:block;color:var(--text-muted)">@${esc(u.username||'—')}</small> ${u.role==='admin'?'<span class="badge badge-info">مدیر سیستم</span>':''}</td><td>${statusBadge}</td><td>${esc(planLabels[sub.type]||sub.type)}</td><td><strong>${toPersianDigits(capacity)}</strong> شرکت</td><td><strong>${toPersianDigits(userCapacity)}</strong> کاربر</td><td>${formatToJalali(sub.startDate)}</td><td>${endJalali}</td><td>${remDaysText}</td><td style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-success btn-inline" style="padding:3px 8px;font-size:11px;min-height:30px" onclick="adminActivateLicense('${uid}')">فعال‌سازی</button><button class="btn btn-secondary btn-inline" style="padding:3px 8px;font-size:11px;min-height:30px" onclick="openLicenseEditModal('${uid}')">اصلاح لایسنس</button><button class="btn btn-secondary btn-inline" style="padding:3px 8px;font-size:11px;min-height:30px" onclick="adminOpenPasswordReset('${uid}')">تعیین رمز موقت</button><button class="btn btn-secondary btn-inline" style="padding:3px 8px;font-size:11px;min-height:30px" onclick="adminExtendSubscription('${uid}', 30)">+۳۰ روز</button>${sub.status!=='cancelled'?`<button class="btn btn-danger btn-inline" style="padding:3px 8px;font-size:11px;min-height:30px" onclick="adminCancelSubscription('${uid}')">لغو اشتراک</button>`:''}</td></tr>`;
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
  document.getElementById('modal-license-user-title').innerText='اصلاح لایسنس، ظرفیت شرکت و کاربران: '+(u.email||u.username);
  const cur=u.lic&&u.lic.plan!=='trial'?u.lic.plan:'monthly';
  document.getElementById('modal-license-duration-select').value=cur;
  const cap=document.getElementById('modal-license-company-limit'),hint=document.getElementById('modal-license-company-limit-hint'),companyReady=!!(u.lic&&Object.prototype.hasOwnProperty.call(u.lic,'max_companies'));
  const users=document.getElementById('modal-license-user-limit'),userHint=document.getElementById('modal-license-user-limit-hint'),userReady=!!(u.lic&&Object.prototype.hasOwnProperty.call(u.lic,'max_users'));
  if(cap){cap.value=String(Math.max(1,Number(u.lic?.max_companies||1)));cap.disabled=!companyReady;}if(hint)hint.textContent=companyReady?'ظرفیت شرکت در سرور اعمال می‌شود.':'ظرفیت شرکت فعلاً روی پیش‌فرض ۱ است.';
  if(users){users.value=String(Math.max(1,Number(u.lic?.max_users||1)));users.disabled=!userReady;}if(userHint)userHint.textContent=userReady?'ظرفیت کاربران نام‌دار در سرور اعمال می‌شود.':'Seat server contract هنوز روی این لایسنس فعال نشده است.';
  document.getElementById('modal-admin-license-edit').classList.add('active');
}
function closeLicenseEditModal(){document.getElementById('modal-admin-license-edit').classList.remove('active');}
async function applyLicenseDurationChange(){const uid=document.getElementById('modal-license-target-username').value,plan=document.getElementById('modal-license-duration-select').value,u=adminUsersCache.find(x=>x.id===uid),companyReady=!!(u?.lic&&Object.prototype.hasOwnProperty.call(u.lic,'max_companies')),userReady=!!(u?.lic&&Object.prototype.hasOwnProperty.call(u.lic,'max_users')),cap=Math.max(1,Math.min(1000,Number(document.getElementById('modal-license-company-limit')?.value||1))),users=Math.max(1,Math.min(100000,Number(document.getElementById('modal-license-user-limit')?.value||1)));closeLicenseEditModal();if(!await adminRpc('admin_set_license',{target:uid,new_plan:plan,new_status:'active'},''))return false;if(companyReady&&!await adminRpc('admin_set_company_limit',{target:uid,new_max_companies:cap},''))return false;if(userReady&&!await adminRpc('admin_set_user_limit',{target:uid,new_max_users:users},''))return false;alert('لایسنس، ظرفیت شرکت و ظرفیت کاربران اعمال شد.');renderAdminPanel();return true;}
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

function adminOpenCreateUser(){['admin-new-fullname','admin-new-username','admin-new-email','admin-new-phone','admin-new-password'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});document.getElementById('modal-admin-create-user')?.classList.add('active')}
function adminCloseCreateUser(){document.getElementById('modal-admin-create-user')?.classList.remove('active')}
async function adminInvokeIdentity(body){
 const {data,error}=await sb.functions.invoke('admin-user-management',{body});if(error){alert('خطا در مدیریت کاربر: '+(error.message||'عملیات ناموفق بود.'));return null}if(data?.error){alert('خطا: '+data.error);return null}return data;
}
async function adminCreateUser(){
 const full_name=String(document.getElementById('admin-new-fullname')?.value||'').trim(),username=String(document.getElementById('admin-new-username')?.value||'').trim(),email=normalizeEmail(document.getElementById('admin-new-email')?.value),phone=normalizePhone(document.getElementById('admin-new-phone')?.value),password=String(document.getElementById('admin-new-password')?.value||'');
 if(!email&&!phone)return alert('ایمیل یا شماره موبایل را وارد کنید.');if(email&&!EMAIL_RE.test(email))return alert('ایمیل معتبر نیست.');if(phone&&!PHONE_RE.test(phone))return alert('شماره موبایل را با فرمت 09xxxxxxxxx یا +989xxxxxxxxx وارد کنید.');if(!isStrongPassword(password))return alert('رمز موقت حداقل ۸ کاراکتر و شامل حرف و عدد باشد.');
 const data=await adminInvokeIdentity({action:'create',full_name,username,email,phone,password});if(!data)return;adminCloseCreateUser();alert('کاربر ایجاد شد. می‌توانید لایسنس و ظرفیت او را از همین جدول تنظیم کنید.');renderAdminPanel();
}
function adminOpenPasswordReset(uid){const u=adminUsersCache.find(x=>x.id===uid);if(!u)return;document.getElementById('admin-reset-user-id').value=uid;document.getElementById('admin-reset-user-title').textContent='تعیین رمز موقت برای '+(u.full_name||u.email||u.phone||u.username||'کاربر');document.getElementById('admin-reset-password').value='';document.getElementById('modal-admin-reset-password')?.classList.add('active')}
function adminClosePasswordReset(){document.getElementById('modal-admin-reset-password')?.classList.remove('active')}
async function adminSetTemporaryPassword(){const user_id=document.getElementById('admin-reset-user-id').value,password=String(document.getElementById('admin-reset-password').value||'');if(!isStrongPassword(password))return alert('رمز موقت حداقل ۸ کاراکتر و شامل حرف و عدد باشد.');if(!confirm('رمز ورود این کاربر تغییر کند؟'))return;const data=await adminInvokeIdentity({action:'set_password',user_id,password});if(!data)return;adminClosePasswordReset();alert('رمز موقت کاربر با موفقیت تنظیم شد.')}
