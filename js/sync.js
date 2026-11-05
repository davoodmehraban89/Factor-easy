let datastore={companies:[],contacts:[],products:[],invoices:[],purchases:[],cheques:[],expenses:[],payments:[],settings:[],fiscalYears:[],accounts:[],dimensionTypes:[],dimensionValues:[],accountDimensionRules:[],branches:[],projects:[],projectLinks:[],postingProfiles:[],journalVouchers:[],journalLines:[],journalLineDimensions:[],contracts:[],contractAmendments:[],contractParties:[],contractDeductions:[],guarantees:[],guaranteeEvents:[],contractStatements:[],phase4Audit:[],warehouses:[],stockMovements:[],inventoryCounts:[],fixedAssets:[],assetDepreciations:[],currencies:[],exchangeRates:[],costCenters:[],importBatches:[],integrationConnections:[],integrationOutbox:[],phase5Audit:[],employees:[],employmentContracts:[],employeeLeave:[],cashboxes:[],pettyCashFunds:[],complianceRules:[],payrollRuns:[],payrollLines:[],employeeBenefitAccruals:[],pettyCashTransactions:[],budgets:[],costDrivers:[],costAllocations:[],intercompanyTransactions:[],enterpriseAudit:[]};
function getMyProducts(){return !currentUser?[]:datastore.products.filter(p=>p.ownerUserId===currentUser.id);}
function getMyContacts(){return !currentUser?[]:datastore.contacts.filter(c=>c.ownerUserId===currentUser.id);}
function getMyCompanies(){return !currentUser?[]:datastore.companies.filter(c=>c.ownerUserId===currentUser.id);}
function getMyInvoices(){return !currentUser?[]:datastore.invoices.filter(i=>i.ownerUserId===currentUser.id);}
function getMyPurchases(){return !currentUser?[]:(datastore.purchases||[]).filter(i=>i.ownerUserId===currentUser.id);}
function getMyCheques(){return !currentUser?[]:datastore.cheques.filter(c=>c.ownerUserId===currentUser.id);}
function getMyExpenses(){return !currentUser?[]:datastore.expenses.filter(e=>e.ownerUserId===currentUser.id);}
function getMyPayments(){return !currentUser?[]:(datastore.payments||[]).filter(p=>p.ownerUserId===currentUser.id);}
function getMySettings(){
  if(!currentUser)return{invoice_kind:'non_formal',vat_mode:'none',vat_rate:10,default_company_id:'',currency_mode:'rial',currency_custom:''};
  if(!Array.isArray(datastore.settings))datastore.settings=[];
  let s=datastore.settings.find(item=>item.ownerUserId===currentUser.id);
  if(!s){s={ownerUserId:currentUser.id,invoice_kind:'non_formal',vat_mode:'none',vat_rate:10,default_company_id:'',currency_mode:'rial',currency_custom:''};datastore.settings.push(s);}
  if(typeof s.currency_mode==='undefined')s.currency_mode='rial';
  if(typeof s.currency_custom==='undefined')s.currency_custom='';
  return s;
}
// ---------- Cloud data layer (Supabase). UI code keeps using `datastore`; this layer syncs it. ----------
const syncSnap=new Map();
// Revisions are kept outside application records and never copied into user data.
const versionSnap=new Map(),finoraVersionedTenants=new Set();
let finoraSyncGeneration=0,finoraHydratedTenant=null;
function finoraSyncContext(){return {user:currentUser,uid:currentUser?.id,org:currentUser?.organizationId||null,generation:finoraSyncGeneration};}
function finoraSyncContextMatches(c){return currentUser===c.user&&currentUser?.id===c.uid&&(currentUser?.organizationId||null)===c.org&&finoraSyncGeneration===c.generation;}
function finoraSyncIssue(code){const e=new Error(code);e.code=code;e.finoraPreservePending=true;return e;}
function finoraAssertSyncContext(c){if(!finoraSyncContextMatches(c))throw finoraSyncIssue('FINORA_SYNC_CONTEXT_CHANGED');}
function finoraAssertSyncSnapshot(c){
  finoraAssertSyncContext(c);
  if(finoraHydratedTenant!==finoraTenantKey(c))throw finoraSyncIssue('FINORA_SYNC_SNAPSHOT_REQUIRED');
}
function finoraValidVersion(v){return Number.isSafeInteger(v)&&v>0&&v<Number.MAX_SAFE_INTEGER;}
function finoraCaptureVersion(r,versions){
  if(!Object.prototype.hasOwnProperty.call(r,'version'))return;
  if(!finoraValidVersion(r.version))throw finoraSyncIssue('FINORA_SYNC_VERSION_INVALID');
  versions.set(r.collection+'|'+r.id,r.version);
}
function finoraTenantKey(c){return JSON.stringify([c.uid,c.org]);}
function finoraPublishSyncSnapshot(fresh,snap,versions,c){
  finoraAssertSyncContext(c);
  datastore=fresh;syncSnap.clear();snap.forEach((v,k)=>syncSnap.set(k,v));
  versionSnap.clear();versions.forEach((v,k)=>versionSnap.set(k,v));
  if(versions.size)finoraVersionedTenants.add(finoraTenantKey(c));
  finoraHydratedTenant=finoraTenantKey(c);finoraSyncGeneration++;
}
async function finoraBoundedSyncRequest(request,code){
  let timer;
  try{return await Promise.race([request,new Promise((_,reject)=>{timer=setTimeout(()=>reject(finoraSyncIssue(code)),20000);})]);}
  finally{clearTimeout(timer);}
}
// Probe only on writes: login reads must work against either schema without a
// speculative network call or an explicit select of a not-yet-installed column.
async function finoraHasVersionedSync(c){
  let result;
  try{result=await finoraBoundedSyncRequest(sb.rpc('finora_journal_get_guard_mode',{p_organization_id:c.org}),'FINORA_SYNC_CAPABILITY_TIMEOUT');}
  catch(e){throw finoraSyncIssue('FINORA_SYNC_CAPABILITY_UNAVAILABLE');}
  finoraAssertSyncContext(c);
  const key=finoraTenantKey(c);
  if(result?.error){
    if(['PGRST202','42883'].includes(result.error.code)&&!finoraVersionedTenants.has(key)&&versionSnap.size===0)return false;
    throw finoraSyncIssue('FINORA_SYNC_CAPABILITY_UNAVAILABLE');
  }
  if(!['off','audit','enforce'].includes(result?.data))throw finoraSyncIssue('FINORA_SYNC_CAPABILITY_INVALID');
  finoraVersionedTenants.add(key);return true;
}
function finoraExpectedVersion(key,creating){
  if(creating&&!syncSnap.has(key))return 0;
  const version=versionSnap.get(key);
  if(!finoraValidVersion(version))throw finoraSyncIssue('FINORA_SYNC_VERSION_REQUIRED');
  return version;
}
function finoraValidateSyncAck(data,upserts,deletes){
  if(!data||!Array.isArray(data.upserts)||!Array.isArray(data.deletes)||data.upserts.length!==upserts.length||data.deletes.length!==deletes.length)throw finoraSyncIssue('FINORA_SYNC_ACK_INVALID');
  const check=(rows,requested,withVersion)=>{
    const expected=new Map(requested.map(r=>[r.collection+'|'+r.id,r]));
    if(expected.size!==requested.length)throw finoraSyncIssue('FINORA_SYNC_ACK_INVALID');
    for(const r of rows){
      if(!r||typeof r.collection!=='string'||typeof r.id!=='string')throw finoraSyncIssue('FINORA_SYNC_ACK_INVALID');
      const key=r.collection+'|'+r.id,want=expected.get(key);
      if(!want||(withVersion&&(!finoraValidVersion(r.version)||r.version!==want.expected_version+1)))throw finoraSyncIssue('FINORA_SYNC_ACK_INVALID');
      expected.delete(key);
    }
    if(expected.size)throw finoraSyncIssue('FINORA_SYNC_ACK_INVALID');
  };
  check(data.upserts,upserts,true);check(data.deletes,deletes,false);
}
async function finoraWriteSyncBatch(up,del,c){
  finoraAssertSyncSnapshot(c);
  const versioned=await finoraHasVersionedSync(c);
  finoraAssertSyncContext(c);
  const upserts=up.map(r=>({collection:r.coll,id:r.id,data:JSON.parse(r.s)}));
  const deletes=del.map(k=>{const j=k.indexOf('|');return {collection:k.slice(0,j),id:k.slice(j+1)};});
  if(new Set(up.map(r=>r.key).concat(del)).size!==up.length+del.length)throw finoraSyncIssue('FINORA_SYNC_DUPLICATE_KEYS');
  if(versioned){
    upserts.forEach(r=>r.expected_version=finoraExpectedVersion(r.collection+'|'+r.id,true));
    deletes.forEach(r=>r.expected_version=finoraExpectedVersion(r.collection+'|'+r.id,false));
  }
  const args={p_upserts:upserts,p_deletes:deletes};
  if(c.org||versioned)args.p_organization_id=c.org;
  let result;
  try{result=await finoraBoundedSyncRequest(sb.rpc(versioned?'finora_sync_records_v2':'finora_sync_records',args),'FINORA_SYNC_WRITE_UNCERTAIN');}
  catch(e){throw finoraSyncIssue('FINORA_SYNC_WRITE_UNCERTAIN');}
  finoraAssertSyncContext(c);
  if(result?.error){
    if(versioned){const e=finoraSyncIssue(result.error.code==='40001'?'FINORA_SYNC_VERSION_CONFLICT':'FINORA_SYNC_WRITE_REJECTED');throw e;}
    throw result.error;
  }
  if(!result||typeof result!=='object'||result.error!==null)throw finoraSyncIssue('FINORA_SYNC_ACK_INVALID');
  if(versioned)finoraValidateSyncAck(result.data,upserts,deletes);
  // Validate the entire response before publishing any acknowledgement.
  if(versioned)result.data.upserts.forEach(r=>versionSnap.set(r.collection+'|'+r.id,r.version));
  up.forEach(r=>syncSnap.set(r.key,r.s));
  deletes.forEach(r=>{const key=r.collection+'|'+r.id;syncSnap.delete(key);versionSnap.delete(key);});
}
let syncTimer=null,syncRunning=false,syncAgain=false,syncPending=false,syncFailCount=0;

function keyOfRecord(coll,item){return coll==='settings'?'main':String(item&&item.id!=null?item.id:'');}
function stripOwner(item){const c=Object.assign({},item);delete c.ownerUserId;return c;}
function setSyncBadge(state){
  const el=document.getElementById('sync-badge');if(!el)return;
  const map={saved:['✔ ذخیره شد','#059669'],saving:['⏳ در حال ذخیره…','#d97706'],error:['⚠️ ذخیره نشد؛ تلاش مجدد…','#dc2626'],conflict:['⚠️ ذخیره تأیید نشد؛ تغییرات محفوظ است','#dc2626']};
  const m=map[state];if(!m)return;
  el.textContent=m[0];el.style.background=m[1];el.style.display='block';
  clearTimeout(setSyncBadge._t);
  if(state==='saved')setSyncBadge._t=setTimeout(()=>{el.style.display='none';},2000);
}
async function pullAll({signal}={}){
  const context=finoraSyncContext(),uid=context.uid;
  const fresh={};COLLS.forEach(k=>{fresh[k]=[];});
  const snap=new Map(),versions=new Map();
  const page=1000;let from=0;
  for(;;){
    let request=sb.from('records').select('*').order('collection').order('id').range(from,from+page-1);
    if(signal&&typeof request.abortSignal==='function')request=request.abortSignal(signal);
    const {data,error}=await finoraAbortableRead(request,signal);
    if(signal?.aborted)throw new Error('FINORA_LOGIN_READ_TIMEOUT');
    if(error)throw error;
    (data||[]).forEach(r=>{
      if(!fresh[r.collection])return;
      const obj=(r.data&&typeof r.data==='object'&&!Array.isArray(r.data))?r.data:{};
      obj.id=r.id;
      snap.set(r.collection+'|'+r.id,JSON.stringify(stripOwner(obj)));
      finoraCaptureVersion(r,versions);
      obj.ownerUserId=uid;
      fresh[r.collection].push(obj);
    });
    if(!data||data.length<page)break;
    from+=page;
  }
  // A timed-out restore must never replace current local data from a late
  // response or publish a partial snapshot; writes still use existing guards.
  if(signal?.aborted)throw new Error('FINORA_LOGIN_READ_TIMEOUT');
  finoraPublishSyncSnapshot(fresh,snap,versions,context);
}
function computeDiff(){
  const uid=currentUser.id;const up=[];const seen=new Set();
  COLLS.forEach(coll=>{(datastore[coll]||[]).forEach(item=>{
    if(!item||item.ownerUserId!==uid)return;
    const id=keyOfRecord(coll,item);
    if(!ID_RE.test(id)){console.warn('skipped record with invalid id',coll,id);return;}
    const key=coll+'|'+id;seen.add(key);
    const payload=stripOwner(item);const s=JSON.stringify(payload);
    if(syncSnap.get(key)!==s)up.push({key,coll,id,payload,s});
  });});
  const del=[];syncSnap.forEach((v,k)=>{if(!seen.has(k))del.push(k);});
  return {up,del};
}
function scheduleSync(ms){clearTimeout(syncTimer);syncTimer=setTimeout(runSync,ms);}
async function runSync(){
  if(!currentUser)return;
  if(syncRunning){syncAgain=true;return;}
  syncRunning=true;
  const context=finoraSyncContext();
  try{
    let guardLoops=0;
    do{
      syncAgain=false;
      finoraAssertSyncSnapshot(context);
      const {up,del}=computeDiff();
      if(up.length===0&&del.length===0)break;
      setSyncBadge('saving');
      await finoraWriteSyncBatch(up,del,context);
      syncFailCount=0;
      guardLoops++;
    }while(guardLoops<5);
    const d=computeDiff();
    syncPending=(d.up.length>0||d.del.length>0);
    if(syncPending){scheduleSync(500);}else{setSyncBadge('saved');}
  }catch(err){
    if(finoraSyncContextMatches(context)){
      console.error('sync error',err);
      await handleSyncError(err);
    }
  }finally{
    syncRunning=false;
    // A newer account/snapshot may have queued its save behind this request.
    // Release that work only after the stale request relinquishes the lock;
    // same-context uncertain/conflicting writes must not gain an automatic retry.
    if(!finoraSyncContextMatches(context)&&currentUser&&syncAgain){
      syncAgain=false;scheduleSync(0);
    }else if(!finoraSyncContextMatches(context)&&currentUser?.id===context.uid&&(currentUser?.organizationId||null)===context.org&&finoraHydratedTenant===finoraTenantKey(context)){
      const pending=computeDiff();
      if(pending.up.length||pending.del.length){syncPending=true;setSyncBadge('conflict');}
    }
  }
}
async function handleSyncError(err){
  if(err?.finoraPreservePending||err?.code==='40001'){
    clearTimeout(syncTimer);syncPending=true;syncFailCount=0;setSyncBadge('conflict');
    const conflict=err.code==='FINORA_SYNC_VERSION_CONFLICT'||err.code==='40001';
    alert(conflict?'این اطلاعات هم‌زمان تغییر کرده است؛ ویرایش شما حفظ شد ولی ذخیره نشد. پیش از بارگذاری مجدد، تغییرات را برای مقایسه نگه دارید.':'ذخیره روی سرور تأیید نشد؛ ویرایش شما در این صفحه حفظ شده است. پیش از خروج یا بارگذاری مجدد، تغییرات را نگه دارید و اتصال و وضعیت ذخیره را بررسی کنید.');
    return;
  }
  const msg=String((err&&err.message)||''),code=String((err&&err.code)||'');
  if(code==='42501'||/row-level security/i.test(msg)){
    setSyncBadge('error');
    syncPending=false;
    alert('اشتراک شما منقضی یا لغو شده است؛ تغییرات ثبت نشد. برای تمدید با پشتیبانی تماس بگیرید.');
    try{currentUser=await fetchCurrentUser({id:currentUser.id});await pullAll();}catch(e){console.error(e);}
    refreshAllSurfaces();
    return;
  }
  const financialConflict=code==='23505'||/immutable|قطعی|posted\/reversed|duplicate key|unique constraint/i.test(msg);
  if(financialConflict){
    syncPending=false;syncFailCount=0;setSyncBadge('error');
    alert('تغییرات با سابقه قطعی یا ثبت هم‌زمان دیگری تعارض داشت و روی سرور ذخیره نشد. نسخه معتبر سرور دوباره بارگذاری می‌شود؛ عملیات را پس از بررسی تکرار کنید.');
    try{await pullAll();refreshAllSurfaces();setSyncBadge('saved');}catch(e){console.error('conflict reconciliation failed',e);syncPending=true;scheduleSync(5000);}
    return;
  }
  syncFailCount++;syncPending=true;setSyncBadge('error');
  scheduleSync(Math.min(30000,2000*syncFailCount));
}
function saveDatastore(){
  if(!currentUser)return false;
  if(!canWrite()){
    requireWrite();
    pullAll().then(()=>refreshAllSurfaces()).catch(()=>{});
    return false;
  }
  syncPending=true;setSyncBadge('saving');scheduleSync(300);
  return true;
}
window.addEventListener('beforeunload',e=>{if(syncPending){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&syncPending){clearTimeout(syncTimer);runSync();}});

// ---------- Untrusted input handling (backup files, legacy local data) ----------
function neutralize(v){
  if(typeof v==='string')return v.replace(/</g,'＜').replace(/>/g,'＞');
  if(Array.isArray(v))return v.map(neutralize);
  if(v&&typeof v==='object'){const o={};Object.keys(v).forEach(k=>{if(k==='__proto__'||k==='constructor'||k==='prototype')return;o[k]=neutralize(v[k]);});return o;}
  return v;
}
function safeId(raw,prefix){
  let s=String(raw==null?'':raw).replace(/[^A-Za-z0-9_-]/g,'_').slice(0,64);
  if(!s)s=prefix+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  return s;
}
function restoreRecordImmutable(store,key,old){
  if(!old)return false;
  if(key==='journalVouchers')return ['posted','reversed'].includes(old.status);
  if(key==='journalLines'){const v=(store.journalVouchers||[]).find(x=>x.id===old.voucherId);return !!v&&['posted','reversed'].includes(v.status)}
  if(key==='journalLineDimensions'){let voucherId=old.voucherId;if(!voucherId){const line=(store.journalLines||[]).find(x=>x.id===old.journalLineId);voucherId=line?.voucherId||''}const v=(store.journalVouchers||[]).find(x=>x.id===voucherId);return !!v&&['posted','reversed'].includes(v.status)}
  if(['stockMovements','inventoryCounts','assetDepreciations'].includes(key))return old.status==='posted';
  if(key==='contractStatements')return ['posted','reversed'].includes(old.status);
  if(['phase4Audit','phase5Audit'].includes(key))return true;
  if(old.accountingStatus==='posted'||old.journalVoucherId){const v=(store.journalVouchers||[]).find(x=>x.id===old.journalVoucherId);return old.accountingStatus==='posted'||!!v&&['posted','reversed'].includes(v.status)}
  return false;
}
function absorbRecords(imported){
  const uid=currentUser.id;let count=0;
  const staged=JSON.parse(JSON.stringify(datastore));
  ['companies','contacts','products','invoices','purchases','cheques','expenses','payments','fiscalYears','accounts','dimensionTypes','dimensionValues','accountDimensionRules','branches','projects','projectLinks','postingProfiles','journalVouchers','journalLines','journalLineDimensions','contracts','contractAmendments','contractParties','contractDeductions','guarantees','guaranteeEvents','contractStatements','phase4Audit','warehouses','stockMovements','inventoryCounts','fixedAssets','assetDepreciations','currencies','exchangeRates','costCenters','importBatches','integrationConnections','integrationOutbox','phase5Audit'].forEach(key=>{
    if(!Array.isArray(imported[key]))return;
    imported[key].forEach(raw=>{
      if(!raw||typeof raw!=='object')return;
      const item=neutralize(raw);
      item.id=safeId(item.id,key.slice(0,3));
      item.ownerUserId=uid;
      const idx=staged[key].findIndex(x=>x.id===item.id&&x.ownerUserId===uid);
      if(idx>=0){const old=staged[key][idx];if(restoreRecordImmutable(staged,key,old)&&JSON.stringify(old)!==JSON.stringify(item))throw new Error('تعارض با سابقه قطعی در '+key+' / '+item.id);staged[key][idx]=item;}else staged[key].push(item);
      count++;
    });
  });
  if(imported.settings&&typeof imported.settings==='object'&&!Array.isArray(imported.settings)){
    let s=(staged.settings||[]).find(x=>x.ownerUserId===uid);if(!s){s={ownerUserId:uid,id:'main'};staged.settings.push(s)}Object.assign(s,neutralize(imported.settings),{ownerUserId:uid,id:'main'});
  }
  datastore=staged;
  return count;
}
function maybeMigrateLegacyData(){
  try{
    const flag='finora_legacy_done_'+currentUser.id;
    if(localStorage.getItem(flag))return;
    const rawOld=localStorage.getItem(STORAGE_KEY);
    if(!rawOld)return;
    let old;try{old=JSON.parse(rawOld);}catch(e){return;}
    const isSeed=it=>it&&it.ownerUserId==='user_admin'&&['COMP-1','C-1','P-1','P-2'].includes(it.id);
    const clean={};let n=0;
    ['companies','contacts','products','invoices','purchases','cheques','expenses','payments'].forEach(k=>{
      clean[k]=(old&&Array.isArray(old[k])?old[k]:[]).filter(it=>!isSeed(it));
      n+=clean[k].length;
    });
    if(n===0){localStorage.setItem(flag,'1');return;}
    if(!confirm('اطلاعات ذخیره‌شده‌ی نسخه‌ی قبلی در این مرورگر پیدا شد ('+n+' مورد). به حساب ابری شما منتقل شود؟')){return;}
    if(!requireWrite())return;
    absorbRecords(clean);
    saveDatastore();refreshAllSurfaces();
    localStorage.setItem(flag,'1');
    alert('اطلاعات قبلی به حساب ابری منتقل شد. نسخه‌ی محلی روی این مرورگر دست‌نخورده باقی می‌ماند.');
  }catch(e){console.error(e);}
}
function initDatastore(){refreshAllSurfaces();}

function getJalaliDate(){return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{dateStyle:'full'}).format(new Date());}
function getJalaliNumeric(){return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function getCurrencyLabel(){const s=getMySettings();if(s.currency_mode==='toman')return 'تومان';if(s.currency_mode==='custom')return (s.currency_custom||'').trim()||'واحد پول';return 'ریال';}
function refreshCurrencyLabels(){const label=getCurrencyLabel();document.querySelectorAll('.cur-label').forEach(el=>{el.innerText=label;});}
function handleCurrencyModeChange(){const mode=document.getElementById('def-currency-mode').value;document.getElementById('box-currency-custom').style.display=(mode==='custom')?'block':'none';}
