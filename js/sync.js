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
const versionSnap=new Map(); // Last confirmed server version by collection/id.
let syncTimer=null,syncRunning=false,syncAgain=false,syncPending=false,syncFailCount=0;

function keyOfRecord(coll,item){return coll==='settings'?'main':String(item&&item.id!=null?item.id:'');}
function stripOwner(item){const c=Object.assign({},item);delete c.ownerUserId;return c;}
function setSyncBadge(state){
  const el=document.getElementById('sync-badge');if(!el)return;
  const map={saved:['✔ ذخیره شد','#059669'],saving:['⏳ در حال ذخیره…','#d97706'],error:['⚠️ ذخیره نشد؛ تلاش مجدد…','#dc2626']};
  const m=map[state];if(!m)return;
  el.textContent=m[0];el.style.background=m[1];el.style.display='block';
  clearTimeout(setSyncBadge._t);
  if(state==='saved')setSyncBadge._t=setTimeout(()=>{el.style.display='none';},2000);
}
async function pullAll({signal}={}){
  const uid=currentUser.id;
  const fresh={};COLLS.forEach(k=>{fresh[k]=[];});
  const snap=new Map();
  const versions=new Map();
  const page=1000;let from=0;
  for(;;){
    let request=sb.from('records').select('collection,id,data,version').order('collection').order('id').range(from,from+page-1);
    if(signal&&typeof request.abortSignal==='function')request=request.abortSignal(signal);
    const {data,error}=await finoraAbortableRead(request,signal);
    if(signal?.aborted)throw new Error('FINORA_LOGIN_READ_TIMEOUT');
    if(error)throw error;
    (data||[]).forEach(r=>{
      if(!fresh[r.collection])return;
      const obj=(r.data&&typeof r.data==='object'&&!Array.isArray(r.data))?r.data:{};
      obj.id=r.id;
      snap.set(r.collection+'|'+r.id,JSON.stringify(stripOwner(obj)));
      versions.set(r.collection+'|'+r.id,Number(r.version)||1);
      obj.ownerUserId=uid;
      fresh[r.collection].push(obj);
    });
    if(!data||data.length<page)break;
    from+=page;
  }
  // A timed-out restore must never replace current local data from a late
  // response or publish a partial snapshot; writes still use existing guards.
  if(signal?.aborted)throw new Error('FINORA_LOGIN_READ_TIMEOUT');
  datastore=fresh;
  syncSnap.clear();snap.forEach((v,k)=>syncSnap.set(k,v));
  versionSnap.clear();versions.forEach((v,k)=>versionSnap.set(k,v));
}
function computeDiff(){
  const uid=currentUser.id;const up=[];const seen=new Set();
  COLLS.forEach(coll=>{
    if(window.finoraManualGuardMode==='enforce' &&
       window.finoraManualGuardOrg===currentUser?.organizationId &&
       ['journalVouchers','journalLines','journalLineDimensions'].includes(coll))return;
    (datastore[coll]||[]).forEach(item=>{
    if(!item||item.ownerUserId!==uid)return;
    const id=keyOfRecord(coll,item);
    if(!ID_RE.test(id)){console.warn('skipped record with invalid id',coll,id);return;}
    const key=coll+'|'+id;seen.add(key);
    const payload=stripOwner(item);const s=JSON.stringify(payload);
    if(syncSnap.get(key)!==s)up.push({key,coll,id,payload,s,expected_version:versionSnap.get(key)||0});
  });});
  const del=[];syncSnap.forEach((v,k)=>{
    if(window.finoraManualGuardMode==='enforce' &&
       window.finoraManualGuardOrg===currentUser?.organizationId &&
       /^(journalVouchers|journalLines|journalLineDimensions)\|/.test(k))return;
    if(!seen.has(k))del.push(k);
  });
  return {up,del};
}
function scheduleSync(ms){clearTimeout(syncTimer);syncTimer=setTimeout(runSync,ms);}
async function runSync(){
  if(!currentUser)return;
  if(syncRunning){syncAgain=true;return;}
  syncRunning=true;
  try{
    let guardLoops=0;
    do{
      syncAgain=false;
      const {up,del}=computeDiff();
      if(up.length===0&&del.length===0)break;
      setSyncBadge('saving');
      const deletes=del.map(k=>{const j=k.indexOf('|');return {collection:k.slice(0,j),id:k.slice(j+1)};});
      const {data:acknowledgement,error}=await sb.rpc('finora_sync_records_v2',{
        p_upserts:up.map(r=>({collection:r.coll,id:r.id,data:r.payload,expected_version:r.expected_version})),
        p_deletes:deletes.map(d=>({...d,expected_version:versionSnap.get(d.collection+'|'+d.id)||0}))
      });
      if(error)throw error;
      const ack=new Map((acknowledgement?.upserts||[]).map(r=>[r.collection+'|'+r.id,Number(r.version)]));
      if(up.some(r=>!Number.isSafeInteger(ack.get(r.key))||ack.get(r.key)<1))throw new Error('FINORA_SYNC_INCOMPLETE_ACK');
      up.forEach(r=>{syncSnap.set(r.key,r.s);versionSnap.set(r.key,ack.get(r.key));});
      deletes.forEach(r=>{syncSnap.delete(r.collection+'|'+r.id);versionSnap.delete(r.collection+'|'+r.id);});
      syncFailCount=0;
      guardLoops++;
    }while(guardLoops<5);
    const d=computeDiff();
    syncPending=(d.up.length>0||d.del.length>0);
    if(syncPending){scheduleSync(500);}else{setSyncBadge('saved');}
  }catch(err){
    console.error('sync error',err);
    await handleSyncError(err);
  }finally{syncRunning=false;}
}
async function handleSyncError(err){
  const msg=String((err&&err.message)||''),code=String((err&&err.code)||'');
  if(code==='42501'||/row-level security/i.test(msg)){
    setSyncBadge('error');
    syncPending=false;
    alert('اشتراک شما منقضی یا لغو شده است؛ تغییرات ثبت نشد. برای تمدید با پشتیبانی تماس بگیرید.');
    try{currentUser=await fetchCurrentUser({id:currentUser.id});await pullAll();}catch(e){console.error(e);}
    refreshAllSurfaces();
    return;
  }
  const financialConflict=code==='23505'||code==='40001'||/FINORA_VERSION_CONFLICT|FINORA_EXPECTED_VERSION_REQUIRED|FINORA_SERVER_ONLY_JOURNAL_FIELDS|immutable|قطعی|posted\/reversed|duplicate key|unique constraint/i.test(msg);
  if(financialConflict&&err?.finoraJournalVoucherId&&
    typeof finoraManualReload==='function'){
    try{
      await finoraManualReload(err.finoraJournalVoucherId);
      setSyncBadge('error');
      alert('نسخه سند دفترکل از سرور بازخوانی شد؛ سایر تغییرات ذخیره‌نشده حفظ شدند.');
      const pending=computeDiff();
      syncPending=!!(pending.up.length||pending.del.length);
      if(syncPending)scheduleSync(500);
    }catch(e){
      console.error('targeted journal reconcile failed',e);
      syncPending=true;scheduleSync(5000);
    }
    return;
  }
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
