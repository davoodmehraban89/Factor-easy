// Read-only, credential-free diagnostics. A missing manifest is NOT proof
// that core JS or the Supabase Auth service is unreachable.
async function checkAuthConnectivity(){
  const out=document.getElementById('auth-connectivity-result');
  const button=document.getElementById('auth-connectivity-check');
  if(!out||button?.disabled)return;
  if(button)button.disabled=true;
  out.textContent='در حال بررسی مستقل فایل برنامه و سرور ورود...';
  out.dataset.status='checking';
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    if(navigator.onLine===false){
      out.textContent='اتصال اینترنت دستگاه قطع است (OFFLINE). اتصال را برقرار کنید و دوباره بررسی کنید.';
      out.dataset.status='offline';
      return;
    }
    // Execute three independent checks so a failed PWA manifest cannot mask
    // a healthy executable file or a healthy GoTrue endpoint. Both are GET;
    // neither accesses user identity, session, password or private records.
    const requests=[
      fetch(new URL('js/login-connectivity.js?v=20261012-site-probe-v2',document.baseURI).href,{cache:'no-store',signal:controller.signal}),
      fetch(new URL('manifest.json',document.baseURI).href,{cache:'no-store',signal:controller.signal}),
      fetch(SUPABASE_URL+'/auth/v1/health',{method:'GET',headers:{apikey:SUPABASE_KEY},cache:'no-store',signal:controller.signal})
    ];
    const [script,manifest,auth]=await Promise.allSettled(requests);
    const describe=(r,name)=>{
      if(r.status==='rejected')return name+(controller.signal.aborted?'_TIMEOUT':'_NETWORK_ERROR');
      return name+(r.value.ok?'_OK':'_HTTP_'+r.value.status);
    };
    const scriptOk=script.status==='fulfilled'&&script.value.ok;
    const manifestOk=manifest.status==='fulfilled'&&manifest.value.ok;
    const authOk=auth.status==='fulfilled'&&auth.value.status===200;
    const siteCode=describe(script,'SITE_JS');
    const manifestCode=describe(manifest,'MANIFEST');
    const authCode=auth.status==='rejected'?(controller.signal.aborted?'AUTH_TIMEOUT':'AUTH_UNREACHABLE'):
      (auth.value.status===200?'AUTH_OK':'AUTH_HTTP_'+auth.value.status);
    const codes=[siteCode,manifestCode,authCode].join(' | ');
    if(!scriptOk&&!manifestOk){
      out.dataset.status='site-error';
      out.textContent='دو فایل بررسی‌شده از این شبکه دریافت نشدند ('+codes+'). با اینترنت دیگری امتحان کنید؛ این آزمون علت قطعی مشکل ورود را مشخص نمی‌کند.';
    }else if(!scriptOk){
      out.dataset.status='site-error';
      out.textContent='فایل اصلی اجرای ورود در این شبکه قابل دریافت نیست، هرچند فایل تنظیمات سایت پاسخ داده است ('+codes+').';
    }else if(!authOk){
      out.dataset.status=auth.status==='rejected'?'auth-unreachable':'auth-http';
      out.textContent='فایل اصلی سایت دریافت می‌شود، اما بررسی سرور ورود موفق نبود ('+codes+'). نتیجه را بدون اطلاعات حساب برای پشتیبانی بفرستید.';
    }else if(!manifestOk){
      out.dataset.status='site-warning';
      out.textContent='فایل اجرایی و سرور ورود در دسترس‌اند، اما فایل تنظیمات سایت دریافت نشد ('+codes+'). این مورد به‌تنهایی مانع ورود را ثابت نمی‌کند.';
    }else{
      out.dataset.status='ok';
      out.textContent='فایل اصلی و سرور ورود پاسخ داده‌اند ('+codes+'). این نتیجه موفقیت رمز عبور یا بارگذاری اطلاعات شرکت را تأیید نمی‌کند.';
    }
  }catch{
    out.textContent='بررسی مستقل اتصال کامل نشد (DIAGNOSTIC_FAILED). بدون ارسال رمز یا اطلاعات حساب دوباره امتحان کنید.';
    out.dataset.status='error';
  }finally{
    clearTimeout(timer);
    if(button)button.disabled=false;
  }
}
function isAuthNetworkError(error){
  if(error?.code==='invalid_credentials'||error?.status===400||error?.status===401)return false;
  return /fetch|network|load failed|timeout|abort/i.test(String(error?.message||''));
}
