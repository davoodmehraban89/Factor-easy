const STORAGE_KEY = 'easy_factor_commercial_v4_7';
const AUTH_KEY = 'easy_factor_auth_users_v4_7';

window.pendingElectronicDoc = null;

function toPersianDigits(str){if(str===null||str===undefined)return '';return String(str).replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);}
function formatToJalali(dateInput){
  if(!dateInput)return '—';
  let dateObj;
  if(dateInput instanceof Date)dateObj=dateInput;
  else if(typeof dateInput==='string'&&dateInput.includes('/'))return toPersianDigits(dateInput);
  else{const str=String(dateInput).split('T')[0];const parts=str.split('-');if(parts.length===3)dateObj=new Date(parseInt(parts[0]),parseInt(parts[1])-1,parseInt(parts[2]),12,0,0);else dateObj=new Date(dateInput);}
  if(isNaN(dateObj.getTime()))return toPersianDigits(String(dateInput));
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit'}).format(dateObj);
}
function getRemainingDays(endDateStr){
  if(!endDateStr)return 0;
  if(String(endDateStr).startsWith('2099'))return Infinity;
  const str=String(endDateStr).split('T')[0];const parts=str.split('-');
  if(parts.length!==3)return 0;
  const end=new Date(parseInt(parts[0]),parseInt(parts[1])-1,parseInt(parts[2]),23,59,59);
  return Math.ceil((end.getTime()-new Date().getTime())/(1000*60*60*24));
}
function addDaysToDate(baseDateStr,days){
  let d;
  if(baseDateStr){const parts=String(baseDateStr).split('T')[0].split('-');d=new Date(parseInt(parts[0]),parseInt(parts[1])-1,parseInt(parts[2]),12,0,0);}
  else{const tp=todayISO().split('-');d=new Date(parseInt(tp[0]),parseInt(tp[1])-1,parseInt(tp[2]),12,0,0);}
  if(isNaN(d.getTime()))d=new Date();
  d.setDate(d.getDate()+days);
  return d.toISOString().split('T')[0];
}

const SUPABASE_URL='https://hcsixhqbyuhpshfwqpjx.supabase.co';
const SUPABASE_KEY='sb_publishable_2y8IsGdhqeLDPkEp7mBF4w_X4yji16D'; // publishable (public by design); access is enforced by RLS on the server
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
const ID_RE=/^[A-Za-z0-9_-]{1,64}$/;
const COLLS=['companies','contacts','products','invoices','cheques','expenses','settings'];

function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function todayISO(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}

let currentUser=null;
let authBusy=false;

const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const OTP_RE=/^[0-9]{6,10}$/;
let otpEmail='',otpCooldownUntil=0,pendingAuthUser=null;

function normalizeEmail(raw){return String(raw||'').trim().toLowerCase();}
function toEnDigits(s){
  return String(s||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}
function buildUserFromRows(profile,lic){
  const sub={type:lic.plan,startDate:lic.starts_at,endDate:lic.ends_at,status:lic.status};
  return {id:profile.id,email:profile.email||'',fullName:profile.full_name||'',username:profile.username||profile.email||'',role:profile.role,subscription:sub,subscriptionType:sub.type,subscriptionStart:sub.startDate,subscriptionEnd:sub.endDate,licenseStatus:sub.status};
}
async function fetchCurrentUser(authUser){
  const [p,l]=await Promise.all([
    sb.from('profiles').select('id,email,username,full_name,role').eq('id',authUser.id).single(),
    sb.from('licenses').select('plan,status,starts_at,ends_at').eq('user_id',authUser.id).single()
  ]);
  if(p.error)throw p.error;
  if(l.error)throw l.error;
  return buildUserFromRows(p.data,l.data);
}
function canWrite(){
  if(!currentUser)return false;
  const s=currentUser.subscription||{};
  if(s.status!=='active'&&s.status!=='trial')return false;
  if(s.type==='lifetime')return true;
  return String(s.endDate||'')>=todayISO();
}
function requireWrite(){
  if(canWrite())return true;
  alert('اشتراک شما منقضی یا لغو شده است؛ امکان ثبت یا ویرایش اطلاعات وجود ندارد. اطلاعات قبلی شما همچنان قابل مشاهده و پشتیبان‌گیری است. برای تمدید با پشتیبانی تماس بگیرید.');
  return false;
}
function authMsg(err){
  const m=(err&&err.message)||'';
  const c=(err&&(err.code||err.error_code))||'';
  if(c==='invalid_credentials'||/Invalid login credentials/i.test(m))return 'ایمیل یا رمز عبور اشتباه است. اگر رمز ندارید یا فراموش کرده‌اید، «ادامه با کد ایمیل» را بزنید.';
  if(c==='otp_expired'||/expired|invalid.*token|token.*invalid/i.test(m))return 'کد اشتباه است یا منقضی شده. دوباره کد بگیرید.';
  if(c==='over_email_send_rate_limit'||c==='over_request_rate_limit'||/rate limit|too many|security purposes/i.test(m))return 'تعداد درخواست‌ها زیاد است؛ چند دقیقه بعد دوباره تلاش کنید.';
  if(c==='email_address_invalid'||/email address.*invalid|unable to validate email/i.test(m))return 'آدرس ایمیل معتبر نیست.';
  if(c==='email_not_confirmed'||/Email not confirmed/i.test(m))return 'ایمیل هنوز تأیید نشده است. از «ادامه با کد ایمیل» استفاده کنید.';
  if(c==='validation_failed'&&/provider/i.test(m)||/provider is not enabled|unsupported provider/i.test(m))return 'ورود با Google هنوز در سرور فعال نشده است.';
  if(c==='weak_password'||/password.*(weak|short|at least)/i.test(m))return 'رمز عبور ضعیف است؛ حداقل ۸ کاراکتر و ترکیب حروف و عدد استفاده کنید.';
  if(c==='same_password'||/different from the old password/i.test(m))return 'رمز جدید باید با رمز قبلی فرق داشته باشد.';
  if(/fetch|network|load failed|timeout|abort/i.test(m))return 'ارتباط با سرور برقرار نشد. اتصال اینترنت/VPN را بررسی کنید و دوباره تلاش کنید.';
  return 'خطا: '+m;
}
function showAuthPanel(name){
  const ids={main:'auth-form-container',otp:'auth-otp-container',setpass:'auth-setpass-container'};
  Object.keys(ids).forEach(k=>{const el=document.getElementById(ids[k]);if(el)el.style.display=(k===name)?'block':'none';});
}
function backToAuthMain(){pendingAuthUser=null;showAuthPanel('main');}
function reportOAuthReturnError(){
  try{
    const q=new URLSearchParams(window.location.search);
    const h=new URLSearchParams((window.location.hash||'').replace(/^#/,''));
    const desc=q.get('error_description')||h.get('error_description');
    if(desc){
      alert('ورود با Google انجام نشد: '+desc.replace(/\+/g,' '));
      window.history.replaceState({},document.title,window.location.pathname);
    }
  }catch(e){}
}
async function initAuthSystem(){
  // Remove the legacy plaintext user database that older versions kept in this browser.
  try{localStorage.removeItem(AUTH_KEY);}catch(e){}
  try{sessionStorage.removeItem('easy_factor_session_v4_7');}catch(e){}
  reportOAuthReturnError();
  sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT'&&currentUser){window.location.reload();}});
  try{
    const {data}=await sb.auth.getSession();
    if(data&&data.session){await enterApp(data.session.user);return;}
  }catch(e){console.error(e);}
  document.getElementById('auth-screen').style.display='flex';
  showAuthPanel('main');
}
async function handleLogin(){
  if(authBusy)return;
  const email=normalizeEmail(document.getElementById('auth-email').value);
  const pass=document.getElementById('auth-password').value;
  if(!EMAIL_RE.test(email)){alert('آدرس ایمیل معتبر وارد کنید.');return;}
  if(!pass){alert('رمز عبور را وارد کنید؛ یا «ادامه با کد ایمیل» را بزنید.');return;}
  authBusy=true;
  try{
    const {data,error}=await sb.auth.signInWithPassword({email,password:pass});
    if(error)throw error;
    await enterApp(data.user);
  }catch(err){alert(authMsg(err));}
  finally{authBusy=false;}
}
async function signInWithGoogle(){
  if(authBusy)return;
  authBusy=true;
  try{
    const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+window.location.pathname,queryParams:{prompt:'select_account'}}});
    if(error)throw error;
  }catch(err){authBusy=false;alert(authMsg(err));}
}
async function startEmailOtp(isResend){
  if(authBusy)return;
  const email=normalizeEmail(isResend===true?otpEmail:document.getElementById('auth-email').value);
  if(!EMAIL_RE.test(email)){alert('آدرس ایمیل معتبر وارد کنید.');return;}
  if(Date.now()<otpCooldownUntil){alert('لطفاً حدود یک دقیقه بین درخواست‌ها صبر کنید.');return;}
  authBusy=true;
  try{
    const {error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:true}});
    if(error)throw error;
    otpEmail=email;otpCooldownUntil=Date.now()+60000;
    document.getElementById('auth-otp-email-label').innerText=email;
    document.getElementById('auth-otp').value='';
    showAuthPanel('otp');
  }catch(err){alert(authMsg(err));}
  finally{authBusy=false;}
}
async function verifyEmailOtp(){
  if(authBusy)return;
  const token=toEnDigits(document.getElementById('auth-otp').value).replace(/\s/g,'');
  if(!OTP_RE.test(token)){alert('کد را فقط با عدد و کامل وارد کنید.');return;}
  authBusy=true;
  try{
    const {data,error}=await sb.auth.verifyOtp({email:otpEmail,token,type:'email'});
    if(error)throw error;
    const u=data.user;
    const hasPassword=!!(u&&u.user_metadata&&u.user_metadata.has_password===true);
    if(!hasPassword){
      pendingAuthUser=u;
      document.getElementById('auth-newpass').value='';
      document.getElementById('auth-newpass2').value='';
      showAuthPanel('setpass');
      return;
    }
    await enterApp(u);
  }catch(err){alert(authMsg(err));}
  finally{authBusy=false;}
}
async function saveNewPassword(){
  if(authBusy)return;
  const p1=document.getElementById('auth-newpass').value;
  const p2=document.getElementById('auth-newpass2').value;
  if(p1.length<8){alert('رمز عبور باید حداقل ۸ کاراکتر باشد.');return;}
  if(p1!==p2){alert('تکرار رمز عبور با رمز اصلی یکی نیست.');return;}
  authBusy=true;
  try{
    const {data,error}=await sb.auth.updateUser({password:p1,data:{has_password:true}});
    if(error)throw error;
    const u=(data&&data.user)||pendingAuthUser;
    pendingAuthUser=null;
    alert('رمز عبور ذخیره شد. دفعات بعد می‌توانید با ایمیل و رمز وارد شوید.');
    await enterApp(u);
  }catch(err){alert(authMsg(err));}
  finally{authBusy=false;}
}
async function skipSetPassword(){
  if(authBusy||!pendingAuthUser)return;
  const u=pendingAuthUser;pendingAuthUser=null;
  authBusy=true;
  try{await enterApp(u);}finally{authBusy=false;}
}
async function enterApp(authUser){
  try{
    currentUser=await fetchCurrentUser(authUser);
    await pullAll();
  }catch(err){
    console.error(err);
    currentUser=null;
    alert('خطا در بارگذاری اطلاعات حساب. اتصال اینترنت را بررسی کنید و دوباره وارد شوید.');
    document.getElementById('auth-screen').style.display='flex';
    showAuthPanel('main');
    return;
  }
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('logged-user-label').innerText='کاربر: '+(currentUser.fullName||currentUser.email||currentUser.username)+(currentUser.role==='admin'?' (مدیر سیستم)':'');
  document.getElementById('menu-admin-panel').style.display=(currentUser.role==='admin')?'block':'none';
  refreshAllSurfaces();
  maybeMigrateLegacyData();
}
async function handleLogout(){
  if(syncPending&&!confirm('تغییرات ذخیره‌نشده وجود دارد. با خروج ممکن است از بین برود. خارج شوم؟'))return;
  try{await sb.auth.signOut();}catch(e){}
  window.location.reload();
}

function updateLicenseDisplay(user){
  if(!user)return;
  const badge=document.getElementById('user-license-status-badge');
  const detailsBox=document.getElementById('dashboard-license-details');
  if(detailsBox){detailsBox.style.display='none';detailsBox.innerHTML='';}
  const sub=user.subscription||{type:user.subscriptionType||'trial',startDate:user.subscriptionStart||user.createdAt,endDate:user.subscriptionEnd,status:user.licenseStatus||'trial'};
  const remDays=getRemainingDays(sub.endDate);
  const isExpired=remDays<=0&&sub.type!=='lifetime';
  const hasActiveLicense=(sub.status==='active')&&(sub.type==='lifetime'||!isExpired)&&(sub.type!=='trial');
  if(!badge)return;
  if(hasActiveLicense){
    badge.className='badge badge-success';
    badge.innerText=(sub.type==='lifetime')?'وضعیت اشتراک : نامحدود':`وضعیت اشتراک : تا تاریخ ${formatToJalali(sub.endDate)}`;
  }else if(isExpired||sub.status==='cancelled'){
    badge.className='badge badge-danger';badge.innerText='وضعیت اشتراک : منقضی شده';
  }else{
    badge.className='badge badge-warning';badge.innerText=`وضعیت اشتراک : آزمایشی تا تاریخ ${formatToJalali(sub.endDate)}`;
  }
}
