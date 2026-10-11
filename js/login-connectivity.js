// Read-only, credential-free connection diagnostics for the Finora login screen.
// Never logs usernames, passwords, sessions, API responses, or access tokens.
async function checkAuthConnectivity(){
  const out=document.getElementById('auth-connectivity-result');
  const button=document.getElementById('auth-connectivity-check');
  if(!out)return;
  if(button?.disabled)return;
  if(button)button.disabled=true;
  out.textContent='در حال بررسی اتصال به سایت و سرویس ورود...';
  out.dataset.status='checking';
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    if(navigator.onLine===false){
      out.textContent='اتصال اینترنت این دستگاه قطع است (OFFLINE). پس از وصل‌شدن اینترنت دوباره تلاش کنید.';
      out.dataset.status='offline';
      return;
    }
    const [site,auth]=await Promise.allSettled([
      fetch(new URL('manifest.json',document.baseURI).href,{cache:'no-store',signal:controller.signal}),
      fetch(SUPABASE_URL+'/auth/v1/health',{method:'GET',headers:{apikey:SUPABASE_KEY},cache:'no-store',signal:controller.signal})
    ]);
    const siteOk=site.status==='fulfilled'&&site.value.ok;
    if(!siteOk){
      out.textContent='فایل‌های نرم‌افزار از این شبکه به‌درستی دریافت نمی‌شوند (SITE_UNREACHABLE). با اینترنت دیگری امتحان کنید.';
      out.dataset.status='site-error';
    }else if(auth.status==='rejected'){
      const code=controller.signal.aborted?'AUTH_TIMEOUT':'AUTH_UNREACHABLE';
      out.textContent='سایت باز می‌شود، اما مرورگر به سرور ورود فینورا دسترسی ندارد ('+code+'). با اینترنت دیگری آزمایش کنید؛ اگر مشکل باقی بود، همین کد را برای پشتیبانی بفرستید.';
      out.dataset.status='auth-unreachable';
    }else if(auth.value.status===200){
      out.textContent='اتصال به سایت و سرور ورود برقرار است (AUTH_OK). اگر ورود انجام نمی‌شود، متن دقیق خطای ورود را بررسی کنید.';
      out.dataset.status='ok';
    }else{
      out.textContent='سرویس ورود پاسخ داده، اما پاسخ آن غیرمنتظره است (AUTH_HTTP_'+auth.value.status+'). این کد را برای پشتیبانی بفرستید.';
      out.dataset.status='auth-http';
    }
  }catch(err){
    out.textContent='آزمایش اتصال کامل نشد (DIAGNOSTIC_FAILED). با اینترنت دیگری دوباره امتحان کنید.';
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
