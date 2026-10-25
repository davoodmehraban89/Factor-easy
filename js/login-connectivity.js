// Credential-free diagnostics. GoTrue health does not check PostgREST.
// A missing manifest is NOT proof that core JS or data reads are unavailable.
async function checkAuthConnectivity(){
  const out=document.getElementById('auth-connectivity-result');
  const button=document.getElementById('auth-connectivity-check');
  if(!out||button?.disabled)return;
  if(button)button.disabled=true;
  out.textContent='در حال بررسی مستقل فایل برنامه و سرور ورود...';
  out.dataset.status='checking';
  try{
    if(navigator.onLine===false){
      out.textContent='اتصال اینترنت دستگاه قطع است (OFFLINE). اتصال را برقرار کنید و دوباره بررسی کنید.';
      out.dataset.status='offline';
      return;
    }
    // Execute four independent GET checks. The REST root only returns
    // gateway/OpenAPI status: never call a table, use a user JWT or read records.
    const finoraConnectivityProbe=async(input,init={})=>{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),12000);
      try{
        const value=await fetch(input,{...init,cache:'no-store',signal:controller.signal});
        // Only headers prove gateway reachability; do not download the body.
        if(value.body)void value.body.cancel().catch(()=>{});
        return {status:'fulfilled',value};
      }catch{
        return {status:'rejected',timedOut:controller.signal.aborted};
      }finally{clearTimeout(timer);}
    };
    const requests=[
      finoraConnectivityProbe(new URL('js/login-connectivity.js?v=20261024-independent-probes-v4',document.baseURI).href),
      finoraConnectivityProbe(new URL('manifest.json',document.baseURI).href),
      finoraConnectivityProbe(SUPABASE_URL+'/auth/v1/health',{method:'GET',headers:{apikey:SUPABASE_KEY}}),
      finoraConnectivityProbe(SUPABASE_URL+'/rest/v1/',{method:'GET',headers:{apikey:SUPABASE_KEY}})
    ];
    const [script,manifest,auth,rest]=await Promise.all(requests);
    const describe=(r,name)=>{
      if(r.status==='rejected')return name+(r.timedOut?'_TIMEOUT':'_NETWORK_ERROR');
      return name+(r.value.ok?'_OK':'_HTTP_'+r.value.status);
    };
    const scriptOk=script.status==='fulfilled'&&script.value.ok;
    const manifestOk=manifest.status==='fulfilled'&&manifest.value.ok;
    const authOk=auth.status==='fulfilled'&&auth.value.status===200;
    const siteCode=describe(script,'SITE_JS');
    const manifestCode=describe(manifest,'MANIFEST');
    const authCode=auth.status==='rejected'?(auth.timedOut?'AUTH_TIMEOUT':'AUTH_UNREACHABLE'):
      (auth.value.status===200?'AUTH_OK':'AUTH_HTTP_'+auth.value.status);
    // A 401/403/404 from REST still proves the gateway responded; 5xx does not.
    // It does NOT prove authenticated tenant reads or RLS authorization.
    const restCode=rest.status==='rejected'?(rest.timedOut?'REST_TIMEOUT':'REST_UNREACHABLE'):'REST_HTTP_'+rest.value.status;
    const restHealthy=rest.status==='fulfilled'&&rest.value.status<500;
    const codes=[siteCode,manifestCode,authCode,restCode].join(' | ');
    if(!scriptOk&&!manifestOk){
      out.dataset.status='site-error';
      out.textContent='دو فایل بررسی‌شده از این شبکه دریافت نشدند ('+codes+'). با اینترنت دیگری امتحان کنید؛ این آزمون علت قطعی مشکل ورود را مشخص نمی‌کند.';
    }else if(!scriptOk){
      out.dataset.status='site-error';
      out.textContent='فایل اصلی اجرای ورود در این شبکه قابل دریافت نیست، هرچند فایل تنظیمات سایت پاسخ داده است ('+codes+').';
    }else if(!authOk){
      out.dataset.status=auth.status==='rejected'?'auth-unreachable':'auth-http';
      out.textContent='فایل اصلی سایت دریافت می‌شود، اما بررسی سرور ورود موفق نبود ('+codes+'). نتیجه را بدون اطلاعات حساب برای پشتیبانی بفرستید.';
    }else if(!restHealthy){
      out.dataset.status='rest-unreachable';
      out.textContent='فایل ورود و سرور Auth پاسخ می‌دهند، اما مسیر دریافت اطلاعات شرکت (REST) پاسخ سالم نداده است ('+codes+'). این مورد می‌تواند باعث توقف ورود شود.';
    }else if(!manifestOk){
      out.dataset.status='site-warning';
      out.textContent='فایل اجرایی و سرور ورود در دسترس‌اند، اما فایل تنظیمات سایت دریافت نشد ('+codes+'). این مورد به‌تنهایی مانع ورود را ثابت نمی‌کند.';
    }else{
      out.dataset.status='ok';
      out.textContent='فایل‌های سایت و درگاه‌های Auth و REST پاسخ داده‌اند ('+codes+'). این نتیجه ورود موفق یا صحت مجوزها و دریافت اطلاعات شرکت را تأیید نمی‌کند.';
    }
  }catch{
    out.textContent='بررسی مستقل اتصال کامل نشد (DIAGNOSTIC_FAILED). بدون ارسال رمز یا اطلاعات حساب دوباره امتحان کنید.';
    out.dataset.status='error';
  }finally{
    if(button)button.disabled=false;
  }
}
function isAuthNetworkError(error){
  if(error?.code==='invalid_credentials'||error?.status===400||error?.status===401)return false;
  return /fetch|network|load failed|timeout|abort/i.test(String(error?.message||''));
}
