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
const syncVersionSnap=new Map();
let syncTimer=null,syncRunning=false,syncAgain=false,syncPending=false,syncFailCount=0;

// Context identity is separate from successful same-tenant hydration. Forms may
// refresh after a write without becoming stale, but a tenant round-trip must
// invalidate every completion captured before the switch.
let finoraSyncEpoch=0,finoraReadSerial=0,finoraSnapshotSerial=0;
let finoraHydratedTenant=null,finoraSyncPausedContext=null;
function finoraSyncContext(){return {user:currentUser,uid:currentUser?.id,org:currentUser?.organizationId||null,epoch:finoraSyncEpoch};}
function finoraSyncContextMatches(c){return !!c&&currentUser===c.user&&currentUser?.id===c.uid&&(currentUser?.organizationId||null)===c.org&&finoraSyncEpoch===c.epoch;}
function finoraTenantKey(c){return JSON.stringify([c.uid,c.org]);}
function finoraSyncIssue(code){const e=new Error(code);e.code=code;e.finoraPreservePending=true;return e;}
function finoraInvalidateSyncContext(){finoraSyncEpoch++;finoraReadSerial++;finoraHydratedTenant=null;finoraSyncPausedContext=null;finoraShowConflictReview(false);}
function finoraSyncStateFingerprint(){return JSON.stringify([datastore,[...syncSnap],[...syncVersionSnap]]);}
function finoraSyncHasChanges(){const d=computeDiff();return d.up.length>0||d.del.length>0;}
function finoraCaptureRead(){
  const context=finoraSyncContext();
  if(!context.uid)throw finoraSyncIssue('FINORA_SYNC_CONTEXT_CHANGED');
  if(finoraSyncIsPaused())throw finoraSyncIssue('FINORA_READ_PAUSED_CONFLICT');
  if(finoraHydratedTenant===finoraTenantKey(context)&&finoraSyncHasChanges())throw finoraSyncIssue('FINORA_READ_PENDING_EDITS');
  return {context,serial:++finoraReadSerial,fingerprint:finoraSyncStateFingerprint()};
}
function finoraAssertRead(capture){
  if(!finoraSyncContextMatches(capture.context))throw finoraSyncIssue('FINORA_SYNC_CONTEXT_CHANGED');
  if(capture.serial!==finoraReadSerial)throw finoraSyncIssue('FINORA_READ_SUPERSEDED');
  if(capture.fingerprint!==finoraSyncStateFingerprint())throw finoraSyncIssue('FINORA_READ_PENDING_EDITS');
}
function finoraReadPublished(context){
  finoraHydratedTenant=finoraTenantKey(context);finoraSnapshotSerial++;
  finoraSyncPausedContext=null;syncPending=false;syncFailCount=0;finoraShowConflictReview(false);
}
function finoraSyncIsPaused(){return finoraSyncContextMatches(finoraSyncPausedContext);}


function keyOfRecord(coll,item){return coll==='settings'?'main':String(item&&item.id!=null?item.id:'');}
function stripOwner(item){const c=Object.assign({},item);delete c.ownerUserId;delete c._serverVersion;delete c.accountingPostingPending;delete c.accountingPostingPendingAt;return c;}
function finoraShowConflictReview(show){
  const button=document.getElementById('sync-conflict-review');
  if(button)button.hidden=!show;
}
document.addEventListener('click',event=>{
  if(event.target?.id==='sync-conflict-review'&&typeof window.finoraReviewSyncConflict==='function')void window.finoraReviewSyncConflict();
});
function setSyncBadge(state){
  finoraShowConflictReview(state==='conflict'&&!!currentUser?.organizationId&&finoraSyncIsPaused());
  const el=document.getElementById('sync-badge');if(!el)return;
  const map={saved:['✔ ذخیره شد','#059669'],saving:['⏳ در حال ذخیره…','#d97706'],error:['⚠️ ذخیره نشد؛ تلاش مجدد…','#dc2626'],conflict:['⚠️ ذخیره تأیید نشد؛ تغییرات محفوظ است','#dc2626'],reconciled:['✔ تطابق داده با سرور تأیید شد','#059669']};
  const m=map[state];if(!m)return;
  el.textContent=m[0];el.style.background=m[1];el.style.display='block';
  clearTimeout(setSyncBadge._t);
  if(state==='saved'||state==='reconciled')setSyncBadge._t=setTimeout(()=>{el.style.display='none';},2000);
}
async function pullAll({signal}={}){
  const capture=finoraCaptureRead(),uid=capture.context.uid;
  const fresh={};COLLS.forEach(k=>{fresh[k]=[];});
  const snap=new Map(),snapVersions=new Map();
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
      const rowVersion=Number(r.version);
      if(!Number.isSafeInteger(rowVersion)||rowVersion<1)throw new Error('FINORA_SERVER_VERSION_MISSING: '+r.collection+'|'+r.id);
      obj._serverVersion=rowVersion;
      const key=r.collection+'|'+r.id;
      snap.set(key,JSON.stringify(stripOwner(obj)));
      snapVersions.set(key,rowVersion);
      obj.ownerUserId=uid;
      fresh[r.collection].push(obj);
    });
    if(!data||data.length<page)break;
    from+=page;
  }
  // A timed-out restore must never replace current local data from a late
  // response or publish a partial snapshot; writes still use existing guards.
  if(signal?.aborted)throw new Error('FINORA_LOGIN_READ_TIMEOUT');
  finoraAssertRead(capture);
  datastore=fresh;
  syncSnap.clear();snap.forEach((v,k)=>syncSnap.set(k,v));
  syncVersionSnap.clear();snapVersions.forEach((v,k)=>syncVersionSnap.set(k,v));
  finoraReadPublished(capture.context);
}
function computeDiff(){
  const uid=currentUser.id;const up=[];const seen=new Set();
  COLLS.forEach(coll=>{(datastore[coll]||[]).forEach(item=>{
    if(!item||item.ownerUserId!==uid)return;
    const id=keyOfRecord(coll,item);
    if(!ID_RE.test(id)){console.warn('skipped record with invalid id',coll,id);return;}
    const key=coll+'|'+id;seen.add(key);
    const payload=stripOwner(item);const s=JSON.stringify(payload);
    if(syncSnap.get(key)!==s)up.push({key,coll,id,payload,s,expectedVersion:syncVersionSnap.get(key)||0});
  });});
  const del=[];syncSnap.forEach((v,k)=>{if(!seen.has(k))del.push(k);});
  return {up,del};
}
function scheduleSync(ms){clearTimeout(syncTimer);syncTimer=setTimeout(runSync,ms);}
// Generic CAS recovery is deliberately limited to upserts in a verified
// organization. Deletions/financial conflicts require separate reconciliation.
function finoraSyncTransportUnknown(error){
  const code=String(error?.code||''),message=String(error?.message||error||'');
  return (!code||code==='FETCH_ERROR')&&/failed to fetch|networkerror|network request failed|load failed|fetch failed|connection reset|timed?\s*out/i.test(message);
}
function finoraCanonicalJson(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(finoraCanonicalJson).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+finoraCanonicalJson(value[k])).join(',')+'}';
}
function finoraComparableRecord(data,id){
  if(!data||typeof data!=='object'||Array.isArray(data))throw finoraSyncIssue('FINORA_RECOVERY_ROW_INVALID');
  return finoraCanonicalJson(stripOwner({...data,id}));
}
async function finoraReadRecoveryRows(context,requests,stillCurrent){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
    const ids=[...new Set(requests.map(r=>r.id))];
    // One bounded statement, not a series of individually timed observations.
    let query=sb.from('records').select('collection,id,data,version,organization_id').eq('organization_id',context.org).in('id',ids).range(0,999);
    if(typeof query.abortSignal==='function')query=query.abortSignal(controller.signal);
    const {data,error}=await finoraAbortableRead(query,controller.signal);
    if(controller.signal.aborted||!stillCurrent()||error||!Array.isArray(data)||data.length>=1000)throw finoraSyncIssue('FINORA_RECOVERY_READ_FAILED');
    const wanted=new Set(requests.map(r=>r.collection+'|'+r.id)),rows=new Map();
    for(const row of data){
      const key=row.collection+'|'+row.id;
      if(!wanted.has(key))continue;
      if(rows.has(key)||(row.organization_id!=null&&row.organization_id!==context.org)||!Number.isSafeInteger(row.version)||row.version<1)throw finoraSyncIssue('FINORA_RECOVERY_ROW_INVALID');
      rows.set(key,row);
    }
    return rows;
  }finally{clearTimeout(timer);}
}
async function finoraSendVersionedBatch(args,up,context,snapshotSerial){
  const stillCurrent=()=>finoraSyncContextMatches(context)&&snapshotSerial===finoraSnapshotSerial&&finoraHydratedTenant===finoraTenantKey(context);
  const send=async()=>{try{return await sb.rpc('finora_sync_records_v2',JSON.parse(JSON.stringify(args)));}catch(error){return {error};}};
  const result=await send();
  if(!result?.error||!finoraSyncTransportUnknown(result.error)||!stillCurrent()||!context.org||args.p_deletes.length||!up.length||up.length>50)return result;
  try{
    // Keep the immutable request, original CAS revisions and base payloads.
    // Read-back may establish state equivalence, never an audit/actor receipt.
    const rows=await finoraReadRecoveryRows(context,args.p_upserts,stillCurrent);
    let unchanged=true,applied=true;
    for(let i=0;i<up.length;i++){
      if(!stillCurrent())throw finoraSyncIssue('FINORA_SYNC_CONTEXT_CHANGED');
      const r=up[i],request=args.p_upserts[i],row=rows.get(r.key);
      const version=row?.version??0,actual=row?finoraComparableRecord(row.data,request.id):null;
      const before=syncSnap.get(r.key);
      const beforeComparable=before===undefined?null:finoraComparableRecord(JSON.parse(before),request.id);
      const desired=finoraComparableRecord(request.data,request.id);
      unchanged=unchanged&&version===request.expected_version&&actual===beforeComparable;
      applied=applied&&version===request.expected_version+1&&actual===desired;
    }
    if(!stillCurrent())throw finoraSyncIssue('FINORA_SYNC_CONTEXT_CHANGED');
    if(applied)return {data:{upserts:args.p_upserts.map(r=>({collection:r.collection,id:r.id,version:r.expected_version+1})),deletes:[]},error:null,reconciled:true};
    if(unchanged)return await send(); // One exact CAS replay, never a new revision/ID.
    return {error:finoraSyncIssue('FINORA_RECOVERY_DIVERGENT')};
  }catch(error){return {error};}
}
async function runSync(){
  if(!currentUser)return;
  if(finoraSyncIsPaused()){syncPending=true;setSyncBadge('conflict');return;}
  if(syncRunning){syncAgain=true;return;}
  syncRunning=true;
  const context=finoraSyncContext(),snapshotSerial=finoraSnapshotSerial;
  try{
    if(finoraHydratedTenant!==finoraTenantKey(context))throw finoraSyncIssue('FINORA_SYNC_SNAPSHOT_REQUIRED');
    let guardLoops=0,reconciled=false;
    do{
      if(!finoraSyncContextMatches(context)||snapshotSerial!==finoraSnapshotSerial)throw finoraSyncIssue('FINORA_SYNC_CONTEXT_CHANGED');
      syncAgain=false;
      const {up,del}=computeDiff();
      if(up.length===0&&del.length===0)break;
      setSyncBadge('saving');
      const deletes=del.map(k=>{
        const j=k.indexOf('|'),version=syncVersionSnap.get(k);
        if(!Number.isSafeInteger(version)||version<1)throw new Error('FINORA_DELETE_VERSION_MISSING: '+k);
        return {collection:k.slice(0,j),id:k.slice(j+1),expected_version:version};
      });
      const args={
        p_upserts:up.map(r=>({collection:r.coll,id:r.id,data:JSON.parse(r.s),expected_version:r.expectedVersion})),
        p_deletes:deletes,
        p_organization_id:context.org
      };
      const {data,error,reconciled:readBack}=await finoraSendVersionedBatch(args,up,context,snapshotSerial);
      if(!finoraSyncContextMatches(context)||snapshotSerial!==finoraSnapshotSerial)throw finoraSyncIssue('FINORA_SYNC_CONTEXT_CHANGED');
      if(error)throw error;
      if(!data||!Array.isArray(data.upserts)||!Array.isArray(data.deletes))throw finoraSyncIssue('FINORA_SYNC_ACK_INVALID');
      const savedUpserts=Array.isArray(data?.upserts)?data.upserts:[];
      const savedDeletes=Array.isArray(data?.deletes)?data.deletes:[];
      // Validate the entire server acknowledgement before changing any local snapshot.
      if(savedUpserts.length!==up.length||savedDeletes.length!==deletes.length)throw finoraSyncIssue('FINORA_SYNC_ACK_INVALID');
      const acknowledged=new Map();
      up.forEach(r=>{
        const matches=savedUpserts.filter(x=>x.collection===r.coll&&x.id===r.id);
        const version=matches[0]?.version;
        if(matches.length!==1||!Number.isSafeInteger(version)||version!==r.expectedVersion+1)
          throw new Error('FINORA_SYNC_ACK_VERSION_MISSING: '+r.key);
        acknowledged.set(r.key,version);
      });
      deletes.forEach(r=>{
        if(savedDeletes.filter(x=>x.collection===r.collection&&x.id===r.id).length!==1)
          throw new Error('FINORA_SYNC_DELETE_ACK_MISSING: '+r.collection+'|'+r.id);
      });
      up.forEach(r=>{
        const version=acknowledged.get(r.key);
        syncSnap.set(r.key,r.s);syncVersionSnap.set(r.key,version);
        const local=(datastore[r.coll]||[]).find(x=>keyOfRecord(r.coll,x)===r.id&&x.ownerUserId===currentUser.id);
        if(local)local._serverVersion=version;
      });
      deletes.forEach(r=>{
        const key=r.collection+'|'+r.id;syncSnap.delete(key);syncVersionSnap.delete(key);
      });
      syncFailCount=0;
      reconciled=reconciled||readBack===true;
      guardLoops++;
    }while(guardLoops<5);
    const d=computeDiff();
    syncPending=(d.up.length>0||d.del.length>0);
    if(syncPending){scheduleSync(500);}else{setSyncBadge(reconciled?'reconciled':'saved');}
  }catch(err){
    // The old tenant's completion must not alter the new tenant's status or retry queue.
    if(finoraSyncContextMatches(context)){console.error('sync error',err);await handleSyncError(err);}
  }finally{
    syncRunning=false;
    if(syncAgain&&currentUser&&!finoraSyncIsPaused()){syncAgain=false;scheduleSync(0);}
  }
}
async function handleSyncError(err){
  // A failed/ambiguous CAS write is not permission to discard edits or silently
  // retry against a new revision. Preserve the full local graph until deliberate
  // reconciliation; a clean successful read clears this pause.
  clearTimeout(syncTimer);syncTimer=null;syncAgain=false;
  syncPending=true;syncFailCount++;
  finoraSyncPausedContext=finoraSyncContext();setSyncBadge('conflict');
}
function saveDatastore(){
  if(!currentUser)return false;
  if(!canWrite()){
    requireWrite();
    pullAll().then(()=>refreshAllSurfaces()).catch(()=>{});
    return false;
  }
  syncPending=true;
  if(finoraSyncIsPaused()){setSyncBadge('conflict');return true;}
  setSyncBadge('saving');scheduleSync(300);
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
