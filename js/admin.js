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
    const capacity=Math.max(1,Number(u.lic?.max_companies||1)),userCapacity=Math.max(1,Number(u.lic?.max_users||1));return `<tr><td><strong>${esc(u.full_name||u.email||u.username||'—')}</strong><small style="display:block;color:var(--text-muted)">${esc(u.email||'')}</small> ${u.role==='admin'?'<span class="badge badge-info">مدیر سیستم</span>':''}</td><td>${statusBadge}</td><td>${esc(planLabels[sub.type]||sub.type)}</td><td><strong>${toPersianDigits(capacity)}</strong> شرکت</td><td><strong>${toPersianDigits(userCapacity)}</strong> کاربر</td><td>${formatToJalali(sub.startDate)}</td><td>${endJalali}</td><td>${remDaysText}</td><td style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-success btn-inline" style="padding:3px 8px;font-size:11px;min-height:30px" onclick="adminActivateLicense('${uid}')">فعال‌سازی</button><button class="btn btn-secondary btn-inline" style="padding:3px 8px;font-size:11px;min-height:30px" onclick="openLicenseEditModal('${uid}')">اصلاح لایسنس</button><button class="btn btn-secondary btn-inline" style="padding:3px 8px;font-size:11px;min-height:30px" data-recovery-user="${uid}" onclick="finoraSendUserRecovery('${uid}')">ارسال پیوند بازیابی</button><button class="btn btn-secondary btn-inline" style="padding:3px 8px;font-size:11px;min-height:30px" onclick="adminExtendSubscription('${uid}', 30)">+۳۰ روز</button>${sub.status!=='cancelled'?`<button class="btn btn-danger btn-inline" style="padding:3px 8px;font-size:11px;min-height:30px" onclick="adminCancelSubscription('${uid}')">لغو اشتراک</button>`:''}</td></tr>`;
  }).join('');
}
function refreshAdminPanel(){renderAdminPanel();}
(function(){
  const pending=new Set(),cooldowns=new Map();
  async function recoveryError(data,error){
    let code=data?.error;
    if(!code&&typeof error?.context?.json==='function'){
      try{code=(await error.context.clone().json())?.error}catch(_ignored){}
    }
    return {
      unauthorized:'نشست ورود معتبر نیست؛ دوباره وارد حساب مدیر شوید.',
      forbidden:'مجوز ارسال پیوند بازیابی را ندارید.',
      organization_access_denied:'برای این کاربر در سازمان فعال مجوز بازیابی ندارید.',
      authorization_unavailable:'بررسی مجوزها انجام نشد؛ کمی بعد دوباره تلاش کنید.',
      invalid_recovery_request:'شناسهٔ کاربر یا سازمان معتبر نیست.',
      recovery_target_unavailable:'ایمیل تأییدشدهٔ این کاربر برای بازیابی در دسترس نیست.',
      recovery_rate_limited:'برای ارسال دوبارهٔ پیوند کمی صبر کنید.',
      recovery_failed:'سرویس ایمیل درخواست بازیابی را نپذیرفت؛ کمی بعد دوباره تلاش کنید.',
      unsupported_action:'سرویس بازیابی هنوز فعال نیست؛ با پشتیبانی تماس بگیرید.'
    }[code]||'ارسال پیوند تأیید نشد؛ پیش از تلاش دوباره، ایمیل کاربر را بررسی کنید.';
  }
  window.finoraSendUserRecovery=async function(userId,organizationId=''){
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if(!currentUser||!uuid.test(userId)||organizationId&&!uuid.test(organizationId))return;
    if(organizationId){
      if(organizationId!==currentUser.organizationId||!(currentUser.role==='admin'||window.finoraCanManageOrganization?.()))return;
    }else if(currentUser.role!=='admin')return;
    if(pending.has(userId))return;
    if((cooldowns.get(userId)||0)>Date.now())return alert('پیش از درخواست دوباره، یک دقیقه صبر کنید و ایمیل کاربر را بررسی کنید.');
    if(!confirm('پیوند بازیابی به ایمیل تأییدشدهٔ کاربر فرستاده شود؟ کاربر خودش رمز جدید را تعیین می‌کند.'))return;
    pending.add(userId);cooldowns.set(userId,Date.now()+60000);
    const buttons=[...document.querySelectorAll('[data-recovery-user="'+userId+'"]')].map(el=>({el,disabled:el.disabled}));
    buttons.forEach(({el})=>{el.disabled=true});
    let timer;
    try{
      const send=async()=>{
        const body={action:'send_recovery',user_id:userId};
        if(organizationId)body.organization_id=organizationId;
        const {data,error}=await sb.functions.invoke('admin-user-management',{body});
        if(error||!data?.ok)return recoveryError(data,error);
        return null;
      };
      const reason=await Promise.race([send(),new Promise(resolve=>{timer=setTimeout(()=>resolve('نتیجهٔ درخواست مشخص نیست؛ ایمیل کاربر را بررسی کنید و پیش از ارسال دوباره یک دقیقه صبر کنید.'),20000)})]);
      if(reason)return alert(reason);
      alert('درخواست ارسال پیوند بازیابی ثبت شد؛ کاربر ایمیل و پوشهٔ هرزنامه را بررسی کند.');
    }catch(_error){alert('نتیجهٔ درخواست مشخص نیست؛ ایمیل کاربر را بررسی کنید و پیش از ارسال دوباره یک دقیقه صبر کنید.')}
    finally{clearTimeout(timer);pending.delete(userId);buttons.forEach(({el,disabled})=>{el.disabled=disabled})}
  };
})();
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

function adminOpenCreateUser(){
  if(!currentUser||currentUser.role!=='admin')return;
  const modal=document.getElementById('modal-admin-create-user');
  if(!modal)return;
  ['admin-new-fullname','admin-new-username','admin-new-email','admin-new-password'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
  const status=document.getElementById('admin-create-status');if(status)status.textContent='';
  modal.classList.add('active');modal.removeAttribute('aria-hidden');
  document.getElementById('admin-new-fullname')?.focus();
}
function adminCloseCreateUser(){
  const modal=document.getElementById('modal-admin-create-user');
  if(modal){modal.classList.remove('active');modal.setAttribute('aria-hidden','true');}
  const pw=document.getElementById('admin-new-password');if(pw)pw.value='';
}
// Only show a bounded, localized error classification. Do not display raw backend
// error messages, response bodies or any credentials in the admin panel.
async function adminProvisioningErrorMessage(data,error){
  let code=String(data?.error||'').trim();
  if(!code&&error?.context&&typeof error.context.json==='function'){
    try{
      const response=typeof error.context.clone==='function'?error.context.clone():error.context;
      const body=await response.json();
      code=String(body?.error||'').trim();
    }catch(_ignored){}
  }
  const descriptions={
    invalid_email_or_phone:'نشانی ایمیل یا شماره تماس نامعتبر است.',
    invalid_profile:'نام یا نام کاربری شرایط مجاز را ندارد.',
    weak_temporary_password:'رمز اولیه باید حداقل ۱۲ کاراکتر و شامل حرف بزرگ و کوچک لاتین، عدد و نماد باشد.',
    unauthorized:'نشست ورود معتبر نیست؛ دوباره وارد حساب مدیر شوید.',
    admin_required:'این عملیات فقط با نقش مدیر سیستم تأییدشده مجاز است.',
    origin_not_allowed:'دامنه فعلی برای عملیات مدیریتی مجاز نیست.',
    server_configuration_missing:'تنظیمات امن سرویس ساخت حساب ناقص است؛ با پشتیبانی فنی تماس بگیرید.',
    email_exists:'این نشانی ایمیل قبلاً ثبت شده است؛ ابتدا فهرست کاربران را بررسی کنید.',
    user_already_exists:'این حساب قبلاً ایجاد شده است؛ ابتدا فهرست کاربران را بررسی کنید.',
    unexpected_failure:'پایگاه داده ساخت حساب را رد کرده است؛ ابتدا فهرست کاربران را بررسی کنید و موضوع را به پشتیبانی فنی گزارش دهید.',
    provision_failed:'ساخت حساب در سامانه احراز هویت ناموفق بود؛ ابتدا فهرست کاربران را بررسی کنید.',
    internal_error:'سرویس ساخت حساب خطای داخلی دارد؛ موضوع را به پشتیبانی فنی گزارش دهید.'
  };
  return descriptions[code]||'پاسخ موفق از سرویس دریافت نشد. پیش از تلاش مجدد، فهرست کاربران را بررسی کنید و در صورت نیاز با پشتیبانی تماس بگیرید.';
}
async function adminCreateUser(){
  if(!currentUser||currentUser.role!=='admin')return;
  const email=String(document.getElementById('admin-new-email')?.value||'').trim().toLowerCase();
  const full_name=String(document.getElementById('admin-new-fullname')?.value||'').trim();
  const username=String(document.getElementById('admin-new-username')?.value||'').trim().toLowerCase();
  const pw=document.getElementById('admin-new-password'),temporary_password=String(pw?.value||'');
  const status=document.getElementById('admin-create-status'),btn=document.getElementById('admin-create-submit');
  const fail=message=>{if(status)status.textContent=message;};
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)||email.length>254)return fail('ایمیل معتبر وارد کنید.');
  if(username&&!/^[a-z0-9_.-]{3,40}$/.test(username))return fail('نام کاربری باید ۳ تا ۴۰ نویسه لاتین مجاز داشته باشد.');
  if(full_name.length>120)return fail('نام بیش از حد طولانی است.');
  if(temporary_password.length<12||temporary_password.length>128||!/[a-z]/.test(temporary_password)||!/[A-Z]/.test(temporary_password)||!/[0-9]/.test(temporary_password)||!/[^A-Za-z0-9]/.test(temporary_password))return fail('رمز اولیه حداقل ۱۲ کاراکتر و شامل حرف بزرگ، حرف کوچک، عدد و نماد باشد.');
  if(!confirm('حساب کاربری عادی برای '+email+' ساخته شود؟'))return;
  if(btn)btn.disabled=true;if(status)status.textContent='در حال ایجاد حساب روی سرور...';
  if(pw)pw.value='';
  try{
    const {data,error}=await sb.functions.invoke('admin-user-management',{body:{action:'create',email,full_name,username,temporary_password}});
    if(error||!data?.ok){
      const reason=await adminProvisioningErrorMessage(data,error);
      fail('ایجاد حساب تأیید نشد: '+reason);return;
    }
    adminCloseCreateUser();
    alert('حساب ساخته شد. رمز اولیه را فقط از مسیر امن در اختیار کاربر قرار دهید و سپس لایسنس را از جدول مدیریت کنید.');
    await renderAdminPanel();
  }catch(e){fail('اتصال به سرویس ساخت کاربر برقرار نشد. دوباره تلاش کنید.');}
  finally{if(btn)btn.disabled=false;}
}
