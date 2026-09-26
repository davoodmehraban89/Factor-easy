let datastore={companies:[],contacts:[],products:[],invoices:[],cheques:[],expenses:[],settings:[]};
function getMyProducts(){return !currentUser?[]:datastore.products.filter(p=>p.ownerUserId===currentUser.id);}
function getMyContacts(){return !currentUser?[]:datastore.contacts.filter(c=>c.ownerUserId===currentUser.id);}
function getMyCompanies(){return !currentUser?[]:datastore.companies.filter(c=>c.ownerUserId===currentUser.id);}
function getMyInvoices(){return !currentUser?[]:datastore.invoices.filter(i=>i.ownerUserId===currentUser.id);}
function getMyCheques(){return !currentUser?[]:datastore.cheques.filter(c=>c.ownerUserId===currentUser.id);}
function getMyExpenses(){return !currentUser?[]:datastore.expenses.filter(e=>e.ownerUserId===currentUser.id);}
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
async function pullAll(){
  const uid=currentUser.id;
  const fresh={};COLLS.forEach(k=>{fresh[k]=[];});
  const snap=new Map();
  const page=1000;let from=0;
  for(;;){
    const {data,error}=await sb.from('records').select('collection,id,data').order('collection').order('id').range(from,from+page-1);
    if(error)throw error;
    (data||[]).forEach(r=>{
      if(!fresh[r.collection])return;
      const obj=(r.data&&typeof r.data==='object'&&!Array.isArray(r.data))?r.data:{};
      obj.id=r.id;
      snap.set(r.collection+'|'+r.id,JSON.stringify(stripOwner(obj)));
      obj.ownerUserId=uid;
      fresh[r.collection].push(obj);
    });
    if(!data||data.length<page)break;
    from+=page;
  }
  datastore=fresh;
  syncSnap.clear();snap.forEach((v,k)=>syncSnap.set(k,v));
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
  try{
    let guardLoops=0;
    do{
      syncAgain=false;
      const {up,del}=computeDiff();
      if(up.length===0&&del.length===0)break;
      setSyncBadge('saving');
      for(let i=0;i<up.length;i+=200){
        const chunk=up.slice(i,i+200);
        const {error}=await sb.from('records').upsert(chunk.map(r=>({owner_id:currentUser.id,collection:r.coll,id:r.id,data:r.payload})),{onConflict:'owner_id,collection,id'});
        if(error)throw error;
        chunk.forEach(r=>syncSnap.set(r.key,r.s));
      }
      const byColl={};
      del.forEach(k=>{const j=k.indexOf('|');const c=k.slice(0,j),id=k.slice(j+1);(byColl[c]=byColl[c]||[]).push(id);});
      for(const c of Object.keys(byColl)){
        const ids=byColl[c];
        for(let i=0;i<ids.length;i+=100){
          const part=ids.slice(i,i+100);
          const {error}=await sb.from('records').delete().eq('collection',c).in('id',part);
          if(error)throw error;
          part.forEach(id=>syncSnap.delete(c+'|'+id));
        }
      }
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
  const msg=String((err&&err.message)||'');
  if((err&&err.code==='42501')||/row-level security/i.test(msg)){
    setSyncBadge('error');
    syncPending=false;
    alert('اشتراک شما منقضی یا لغو شده است؛ تغییرات ثبت نشد. برای تمدید با پشتیبانی تماس بگیرید.');
    try{currentUser=await fetchCurrentUser({id:currentUser.id});await pullAll();}catch(e){console.error(e);}
    refreshAllSurfaces();
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
function absorbRecords(imported){
  const uid=currentUser.id;let count=0;
  ['companies','contacts','products','invoices','cheques','expenses'].forEach(key=>{
    if(!Array.isArray(imported[key]))return;
    imported[key].forEach(raw=>{
      if(!raw||typeof raw!=='object')return;
      const item=neutralize(raw);
      item.id=safeId(item.id,key.slice(0,3));
      item.ownerUserId=uid;
      const idx=datastore[key].findIndex(x=>x.id===item.id&&x.ownerUserId===uid);
      if(idx>=0)datastore[key][idx]=item;else datastore[key].push(item);
      count++;
    });
  });
  if(imported.settings&&typeof imported.settings==='object'&&!Array.isArray(imported.settings)){
    const s=getMySettings();Object.assign(s,neutralize(imported.settings),{ownerUserId:uid,id:'main'});
  }
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
    ['companies','contacts','products','invoices','cheques','expenses'].forEach(k=>{
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
