(function(){
 'use strict';
 const marker='finora_recovery',proofKey='finora.password-recovery.v1',proofLifetime=15*60*1000;
 const redirectTo='https://factoreasy.ir/?finora_recovery=1';
 const url=new URL(window.location.href),hash=new URLSearchParams(url.hash.slice(1));
 const implicit=hash.get('type')==='recovery';
 const callbackFields=['type','access_token','refresh_token','token_hash','error','error_code','error_description'];
 const callbackFragment=callbackFields.some(key=>hash.has(key));
 const state={active:url.searchParams.get(marker)==='1'||implicit,ready:null,session:null,client:null,busy:false,requestBusy:false,cooldown:0,epoch:0,completed:false,resolving:null,message:'در حال بررسی پیوند بازیابی...',status:'loading'};
 let incoming=implicit?{access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token')}:null;
 const fresh=state.active&&(callbackFragment||url.searchParams.has('code')||callbackFields.some(key=>url.searchParams.has(key)));
 function forgetProof(){try{sessionStorage.removeItem(proofKey);}catch(_){} }
 if(fresh)forgetProof();
 if(state.active){
  url.searchParams.set(marker,'1');
  if(callbackFragment)url.hash='';
  callbackFields.forEach(key=>url.searchParams.delete(key));
  window.history.replaceState(window.history.state,'',url.toString());
 }
 function field(id){return document.getElementById(id);}
 function sessionId(session){
  try{const raw=session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');const value=JSON.parse(atob(raw.padEnd(Math.ceil(raw.length/4)*4,'='))).session_id;return typeof value==='string'?value:'';}catch(_){return '';}
 }
 function readProof(){
  try{const p=JSON.parse(sessionStorage.getItem(proofKey)||'null'),age=Date.now()-p?.at;return p&&typeof p.user==='string'&&Number.isFinite(age)&&age>=0&&age<proofLifetime?p:null;}catch(_){return null;}
 }
 function sameSession(proof,session){return !!proof?.session&&proof.user===session?.user?.id&&proof.session===sessionId(session);}
 function ephemeralClient(storageKey){return window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{global:{fetch:finoraBoundedAuthFetch},auth:{flowType:'implicit',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey}});}
 function remember(session,user){try{sessionStorage.setItem(proofKey,JSON.stringify({user:user.id,session:sessionId(session),at:Date.now()}));}catch(_){} }
 function cleanUrl(){
  const clean=new URL(window.location.href);[marker,'code','error','error_code','error_description'].forEach(key=>clean.searchParams.delete(key));clean.hash='';window.history.replaceState(window.history.state,'',clean.toString());
 }
 function clearPasswords(){['auth-recovery-password','auth-recovery-confirm'].forEach(id=>{const el=field(id);if(el)el.value='';});}
 function render(){
  if(!state.active)return;
  const screen=field('auth-screen');if(screen)screen.style.display='flex';
  if(typeof showAuthPanel==='function')showAuthPanel('recovery');
  const message=field('auth-recovery-status');if(message){message.textContent=state.message;message.dataset.state=state.status;}
  ['auth-recovery-password','auth-recovery-confirm','auth-recovery-submit'].forEach(id=>{const el=field(id);if(el)el.disabled=!state.ready||state.busy;});
  const cancel=field('auth-recovery-cancel');if(cancel)cancel.disabled=state.busy||state.status==='loading';
 }
 function message(text,status='error'){state.message=text;state.status=status;render();}
 function invalid(){state.ready=null;state.session=null;forgetProof();clearPasswords();message('پیوند بازیابی معتبر نیست یا منقضی شده است. از صفحه ورود دوباره درخواست بدهید.');}
 async function resume(client,restored){
  state.client=client;if(!state.active||state.completed)return false;
  if(state.resolving)return state.resolving;
  const epoch=state.epoch;
  state.resolving=(async()=>{
   try{
    render();let verified=state.session;
    if(incoming){
     const pair=incoming;incoming=null;
     if(!pair.access_token||!pair.refresh_token){invalid();return false;}
     const {data,error}=await client.auth.setSession(pair);
     if(epoch!==state.epoch)return false;
     if(error||!data?.user||!data?.session){invalid();return false;}
     verified=data.session;
    }
    const proof=readProof();
    if(!verified){
     if(!sameSession(proof,restored)){invalid();return false;}
     verified=restored;
    }
    const {data,error}=await client.auth.getUser(verified.access_token);
    if(epoch!==state.epoch)return false;
    if(error||!data?.user||data.user.id!==verified.user?.id||!sessionId(verified)){invalid();return false;}
    const first=!state.ready;state.ready=data.user;state.session=verified;
    if(!proof)remember(verified,data.user);
    if(first)clearPasswords();
    message('پیوند تأیید شد. رمز عبور جدید و تکرار آن را وارد کنید.','ready');return true;
   }catch(_){if(epoch===state.epoch)invalid();return false;}
   finally{state.resolving=null;}
  })();
  return state.resolving;
 }
 function handleEvent(event,session){
  if(event!=='PASSWORD_RECOVERY'||!session?.user||state.completed)return;
  state.active=true;state.session=session;
  const current=new URL(window.location.href);current.searchParams.set(marker,'1');window.history.replaceState(window.history.state,'',current.toString());
  render();if(state.client)setTimeout(()=>{void resume(state.client,session);},0);
 }
 async function request(){
  if(state.requestBusy||state.active||typeof authBusy!=='undefined'&&authBusy)return;
  if(Date.now()<state.cooldown)return;
  const email=String(field('auth-email')?.value||'').trim().toLowerCase();
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){setAuthLoginStatus('ایمیل معتبر وارد کنید.','error');field('auth-email')?.focus();return;}
  state.requestBusy=true;const button=field('auth-forgot-password');if(button)button.disabled=true;
  try{
   const sender=ephemeralClient('finora-recovery-request');
   const {error}=await sender.auth.resetPasswordForEmail(email,{redirectTo});
   if(error&&error.code!=='user_not_found'&&error.code!=='email_not_found')throw error;
   state.cooldown=Date.now()+60000;
   setAuthLoginStatus('اگر حسابی با این ایمیل وجود داشته باشد، پیوند بازیابی ارسال می‌شود. ایمیل و پوشه هرزنامه را بررسی کنید.','ready');
  }catch(error){
   const code=String(error?.code||'');setAuthLoginStatus(code.includes('rate_limit')?'تعداد درخواست‌ها زیاد است؛ چند دقیقه بعد دوباره تلاش کنید.':'ارسال پیوند بازیابی انجام نشد؛ اتصال را بررسی و دوباره تلاش کنید.','error');
  }finally{state.requestBusy=false;if(button)button.disabled=false;}
 }
 async function save(){
  if(!state.active||!state.ready||!state.client||state.busy)return;
  const password=field('auth-recovery-password')?.value||'',confirm=field('auth-recovery-confirm')?.value||'';
  if(!isStrongPassword(password)){message('رمز عبور باید حداقل ۸ کاراکتر و شامل یک حرف و یک عدد باشد.');return;}
  if(password!==confirm){message('رمز جدید و تکرار آن باید یکسان باشند.');return;}
  state.busy=true;render();
  try{
   const proof=readProof(),expected=state.ready.id;
   const {data:checked,error:checkError}=await state.client.auth.getUser();
   if(!proof||checkError||checked?.user?.id!==expected||proof.user!==expected){invalid();return;}
   const {data:current,error:sessionError}=await state.client.auth.getSession();
   if(sessionError||!sameSession(proof,current?.session)){invalid();return;}
   // Pin the mutation to this recovery identity: another tab can change the
   // persistent SDK session between validation and updateUser's storage read.
   const writer=ephemeralClient('finora-recovery-update');
   const {data:bound,error:bindError}=await writer.auth.setSession(current.session);
   if(bindError||!sameSession(proof,bound?.session)){invalid();return;}
   const {data,error}=await writer.auth.updateUser({password,data:{has_password:true}});
   if(error){message(error.code==='weak_password'?'رمز عبور انتخاب‌شده شرایط امنیتی سرور را ندارد.':'ذخیره رمز عبور انجام نشد؛ دوباره تلاش کنید.');return;}
   if(data?.user?.id!==expected){invalid();return;}
   const {data:after,error:afterError}=await state.client.auth.getSession();
   state.completed=true;state.active=false;state.ready=null;state.session=null;state.epoch++;
   clearPasswords();forgetProof();cleanUrl();
   if(afterError||!sameSession(proof,after?.session)){showAuthPanel('main');setAuthLoginStatus('رمز جدید ذخیره شد. نشست مرورگر تغییر کرده است؛ برای ادامه با حساب موردنظر وارد شوید.','ready');return;}
   await enterApp(data.user);
  }catch(_){message('ذخیره رمز عبور انجام نشد؛ اتصال را بررسی و دوباره تلاش کنید.');}
  finally{state.busy=false;render();}
 }
 async function cancel(){
  if(state.busy||state.resolving||state.status==='loading')return;
  state.epoch++;
  if(state.ready&&state.client){
   state.busy=true;render();
   try{
    const {data,error:sessionError}=await state.client.auth.getSession();if(sessionError)throw sessionError;
    const proof=readProof();
    if(sameSession(proof,data?.session)){
     const writer=ephemeralClient('finora-recovery-cancel');
     const {data:bound,error:bindError}=await writer.auth.setSession(data.session);if(bindError||!sameSession(proof,bound?.session))throw bindError||new Error('recovery_session_changed');
     const {error}=await writer.auth.signOut({scope:'local'});if(error)throw error;
     // The public SDK logout rereads persistent storage. Revoke only the
     // recovery identity and clear our configured cache only if it still matches.
     const cached=JSON.parse(localStorage.getItem(FINORA_AUTH_STORAGE_KEY)||'null');
     if(sameSession(proof,cached))localStorage.removeItem(FINORA_AUTH_STORAGE_KEY);
    }
   }
   catch(_){state.busy=false;message('خروج از نشست بازیابی کامل نشد؛ دوباره تلاش کنید.');return;}
  }
  state.active=false;state.completed=true;state.ready=null;state.session=null;state.busy=false;incoming=null;
  clearPasswords();forgetProof();cleanUrl();showAuthPanel('main');setAuthLoginStatus('فرم ورود آماده است.','ready');
 }
 window.FinoraPasswordRecovery={get active(){return state.active;},resume,handleEvent,render};
 window.finoraRequestPasswordRecovery=request;
 window.finoraSaveRecoveredPassword=save;
 window.finoraCancelPasswordRecovery=cancel;
 window.addEventListener('hashchange',()=>{
  const next=new URL(window.location.href),fragment=new URLSearchParams(next.hash.slice(1));
  if(!callbackFields.some(key=>fragment.has(key))||!state.active&&next.searchParams.get(marker)!=='1'&&fragment.get('type')!=='recovery')return;
  state.active=true;state.ready=null;state.status='loading';state.epoch++;forgetProof();clearPasswords();render();
  window.location.reload();
 });
 render();
})();
