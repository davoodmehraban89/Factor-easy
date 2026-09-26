(function(){
  const IDLE_TIMEOUT_MS = 30*60*1000; // ۳۰ دقیقه
  const WARN_LEAD_MS = 60*1000;       // ۱ دقیقه قبل هشدار
  const DRAFT_KEY = 'factoreasy_invoice_draft_v1';
  let idleTimer=null, warnTimer=null, countdownInterval=null, warningVisible=false, lastActivityReset=0;

  function ensureIdleModal(){
    if(document.getElementById('modal-idle-warning'))return;
    const div=document.createElement('div');
    div.className='modal-backdrop';
    div.id='modal-idle-warning';
    div.innerHTML=`<div class="modal-card" style="max-width:420px;text-align:center">
      <h3 style="font-size:16px;margin-bottom:10px">⏰ عدم فعالیت</h3>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:14px">به دلیل عدم فعالیت، تا <span id="idle-countdown" style="font-weight:bold;color:#dc2626">60</span> ثانیه دیگر از حساب خارج می‌شوید.</p>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="btn btn-success" onclick="window.__idleContinueWorking()">✅ ادامه کار</button>
        <button class="btn btn-secondary" onclick="window.__idleLogoutNow()">🚪 خروج فوری</button>
      </div>
    </div>`;
    document.body.appendChild(div);
  }
  function hideWarning(){
    warningVisible=false;
    clearInterval(countdownInterval);
    const el=document.getElementById('modal-idle-warning');
    if(el)el.classList.remove('active');
  }
  function showWarning(){
    ensureIdleModal();
    warningVisible=true;
    let remain=Math.round(WARN_LEAD_MS/1000);
    const cd=document.getElementById('idle-countdown');
    if(cd)cd.innerText=remain;
    document.getElementById('modal-idle-warning').classList.add('active');
    countdownInterval=setInterval(()=>{
      remain--;
      const el=document.getElementById('idle-countdown');
      if(el)el.innerText=Math.max(remain,0);
      if(remain<=0)clearInterval(countdownInterval);
    },1000);
  }

  function getInvoiceFormSnapshot(){
    const rows=[...document.querySelectorAll('#invoice-items-table-body tr')].map(tr=>({
      prodId: tr.querySelector('.row-product-select')?.value||'',
      unit: tr.querySelector('.row-unit-input')?.value||'',
      qty: tr.querySelector('.row-quantity')?.value||'',
      price: tr.querySelector('.row-price')?.value||''
    })).filter(r=>r.prodId);
    return {
      editId: document.getElementById('edit-invoice-id')?.value||'',
      companyId: document.getElementById('invoice-company-id')?.value||'',
      kind: document.getElementById('invoice-kind')?.value||'',
      vatMode: document.getElementById('invoice-vat-mode')?.value||'',
      vatType: document.getElementById('invoice-vat-type')?.value||'',
      vatRate: document.getElementById('invoice-vat-rate-input')?.value||'',
      number: document.getElementById('invoice-number')?.value||'',
      contactId: document.getElementById('invoice-contact-id')?.value||'',
      date: document.getElementById('invoice-date-input')?.value||'',
      discountType: document.getElementById('invoice-discount-type')?.value||'',
      discountFixed: document.getElementById('invoice-discount-fixed')?.value||'',
      desc: document.getElementById('invoice-desc-input')?.value||'',
      items: rows,
      savedAt: Date.now(),
      userId: (typeof currentUser!=='undefined'&&currentUser)?currentUser.id:null
    };
  }
  function isSnapshotWorthSaving(snap){
    return !!(snap.contactId || (snap.desc&&snap.desc.trim()) || (snap.items&&snap.items.length>0));
  }
  function saveInvoiceDraftIfNeeded(){
    try{
      const snap=getInvoiceFormSnapshot();
      if(!isSnapshotWorthSaving(snap))return;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(snap));
    }catch(e){console.error('draft save failed',e);}
  }

  async function performIdleLogout(){
    hideWarning();
    saveInvoiceDraftIfNeeded();
    try{await sb.auth.signOut();}catch(e){}
  }
  window.__idleContinueWorking=function(){ hideWarning(); resetIdleTimer(); };
  window.__idleLogoutNow=async function(){
    hideWarning();
    saveInvoiceDraftIfNeeded();
    try{await sb.auth.signOut();}catch(e){}
  };

  function resetIdleTimer(){
    if(!window.__idleWatcherActive)return;
    clearTimeout(idleTimer);
    clearTimeout(warnTimer);
    warnTimer=setTimeout(showWarning, IDLE_TIMEOUT_MS-WARN_LEAD_MS);
    idleTimer=setTimeout(performIdleLogout, IDLE_TIMEOUT_MS);
  }
  function onActivity(){
    if(!window.__idleWatcherActive)return;
    const now=Date.now();
    if(warningVisible)hideWarning();
    if(now-lastActivityReset<3000)return;
    lastActivityReset=now;
    resetIdleTimer();
  }
  ['mousemove','mousedown','keydown','scroll','touchstart','click'].forEach(evt=>{
    window.addEventListener(evt, onActivity, {passive:true});
  });

  window.startIdleWatcher=function(){ window.__idleWatcherActive=true; resetIdleTimer(); };
  window.stopIdleWatcher=function(){
    window.__idleWatcherActive=false;
    clearTimeout(idleTimer); clearTimeout(warnTimer); hideWarning();
  };

  window.offerInvoiceDraftRestoreIfAny=function(){
    try{
      const raw=localStorage.getItem(DRAFT_KEY);
      if(!raw)return;
      const snap=JSON.parse(raw);
      const uid=(typeof currentUser!=='undefined'&&currentUser)?currentUser.id:null;
      if(!uid||snap.userId!==uid){localStorage.removeItem(DRAFT_KEY);return;}
      const ageMin=Math.max(1,Math.round((Date.now()-(snap.savedAt||0))/60000));
      if(!confirm(`یک فاکتور پیش‌نویس ذخیره‌نشده (حدود ${ageMin} دقیقه پیش، به‌دلیل خروج خودکار به‌خاطر عدم فعالیت) پیدا شد. بازیابی شود؟`)){
        localStorage.removeItem(DRAFT_KEY); return;
      }
      switchView('view-invoices');
      document.getElementById('edit-invoice-id').value=snap.editId||'';
      if(snap.editId){
        document.getElementById('invoice-form-title').innerText='✏️ ویرایش فاکتور (پیش‌نویس بازیابی‌شده)';
        document.getElementById('btn-cancel-edit').style.display='inline-flex';
        document.getElementById('btn-save-invoice').innerText='💾 ذخیره تغییرات';
      }else{
        document.getElementById('invoice-form-title').innerText='📝 فاکتور پیش‌نویس بازیابی‌شده';
      }
      document.getElementById('invoice-company-id').value=snap.companyId||'';
      document.getElementById('invoice-kind').value=snap.kind||'non_formal';
      document.getElementById('invoice-vat-mode').value=snap.vatMode||'none';
      document.getElementById('invoice-vat-type').value=snap.vatType||'percent';
      document.getElementById('invoice-vat-rate-input').value=snap.vatRate||10;
      document.getElementById('invoice-number').value=snap.number||'';
      document.getElementById('invoice-contact-id').value=snap.contactId||'';
      document.getElementById('invoice-date-input').value=snap.date||'';
      document.getElementById('invoice-discount-type').value=snap.discountType||'fixed';
      document.getElementById('invoice-discount-fixed').value=snap.discountFixed||0;
      document.getElementById('invoice-desc-input').value=snap.desc||'';
      if(typeof handleInvoiceKindChange==='function')handleInvoiceKindChange();
      const tbody=document.getElementById('invoice-items-table-body');
      tbody.innerHTML='';
      (snap.items||[]).forEach(it=>{
        addInvoiceItemRow(it.prodId, parseFloat(it.qty)||1, it.price!==''?parseFloat(it.price):null);
        const lastRow=tbody.lastElementChild;
        if(lastRow&&it.unit)lastRow.querySelector('.row-unit-input').value=it.unit;
      });
      if(typeof updateInvoiceItemRowNumbers==='function')updateInvoiceItemRowNumbers();
      if(typeof recomputeTotals==='function')recomputeTotals();
      localStorage.removeItem(DRAFT_KEY);
    }catch(e){console.error('draft restore failed',e);}
  };

  // اتصال بدون دست‌زدن به کد اصلی enterApp/handleLogout
  const oldEnterApp=window.enterApp;
  window.enterApp=async function(authUser){
    await oldEnterApp(authUser);
    if(typeof currentUser!=='undefined'&&currentUser){
      window.startIdleWatcher();
      window.offerInvoiceDraftRestoreIfAny();
    }
  };
  const oldHandleLogout=window.handleLogout;
  window.handleLogout=async function(){
    window.stopIdleWatcher();
    return oldHandleLogout();
  };
})();

// ============== گزارشات مالی ==============
function toEnglishDigits(str){
  if(str===null||str===undefined)return '';
  const map={'۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
  return String(str).replace(/[۰-۹]/g,d=>map[d]);
}
const persianMonthNames=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
function populateReportYearSelect(years){
  const sel=document.getElementById('report-year-select');
  if(!sel)return;
  const current=sel.value;
  sel.innerHTML=years.map(y=>`<option value="${y}">سال ${toPersianDigits(y)}</option>`).join('');
  if(current&&years.includes(parseInt(current)))sel.value=current;
}
function renderFinancialReports(){
  const cur=(typeof getCurrencyLabel==='function')?getCurrencyLabel():'ریال';
  const invoices=(typeof getMyInvoices==='function')?getMyInvoices():[];
  const parsed=invoices.map(inv=>{
    const d=toEnglishDigits(inv.date||'');
    const parts=d.split('/');
    if(parts.length<2)return null;
    const y=parseInt(parts[0]),m=parseInt(parts[1]);
    if(!y||!m)return null;
    return {year:y,month:m,inv};
  }).filter(Boolean);

  let years=[...new Set(parsed.map(p=>p.year))].sort((a,b)=>b-a);
  if(years.length===0){
    const fallback=parseInt(toEnglishDigits((typeof getJalaliNumeric==='function'?getJalaliNumeric():'').split('/')[0]))||1404;
    years=[fallback];
  }
  populateReportYearSelect(years);
  const sel=document.getElementById('report-year-select');
  const selectedYear=(sel&&sel.value)?parseInt(sel.value):years[0];

  const yearInvoices=parsed.filter(p=>p.year===selectedYear);
  const monthTotals=Array(12).fill(0);
  yearInvoices.forEach(p=>{ if(p.month>=1&&p.month<=12) monthTotals[p.month-1]+=(p.inv.grandTotal||0); });
  const yearTotal=monthTotals.reduce((a,b)=>a+b,0);
  const avg=yearTotal/12;
  const maxVal=Math.max(...monthTotals,1);
  const maxIdx=monthTotals.indexOf(maxVal);

  const setTxt=(id,txt)=>{const el=document.getElementById(id);if(el)el.innerText=txt;};
  setTxt('rep-year-total',yearTotal.toLocaleString('fa-IR')+' '+cur);
  setTxt('rep-year-avg',Math.round(avg).toLocaleString('fa-IR')+' '+cur);
  setTxt('rep-best-month',monthTotals[maxIdx]>0?persianMonthNames[maxIdx]:'—');
  setTxt('rep-invoice-count',yearInvoices.length.toLocaleString('fa-IR'));

  const chartEl=document.getElementById('report-monthly-chart');
  if(chartEl){
    chartEl.innerHTML=monthTotals.map((v,i)=>{
      const h=Math.max(4,Math.round((v/maxVal)*130));
      return `<div class="report-bar-col">
        <div class="report-bar-value">${v>0?(v/1000000).toLocaleString('fa-IR',{maximumFractionDigits:1})+'M':''}</div>
        <div class="report-bar" style="height:${h}px"></div>
        <div class="report-bar-label">${persianMonthNames[i].slice(0,3)}</div>
      </div>`;
    }).join('');
  }

  const byCustomer={};
  yearInvoices.forEach(p=>{
    const key=p.inv.contactId||p.inv.contactName||'—';
    if(!byCustomer[key])byCustomer[key]={name:p.inv.contactName||'—',count:0,sum:0};
    byCustomer[key].count++;
    byCustomer[key].sum+=(p.inv.grandTotal||0);
  });
  const topList=Object.values(byCustomer).sort((a,b)=>b.sum-a.sum).slice(0,10);
  const tbody=document.getElementById('report-top-customers');
  if(tbody){
    if(topList.length===0){
      tbody.innerHTML='<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px">داده‌ای برای نمایش وجود ندارد.</td></tr>';
    }else{
      tbody.innerHTML=topList.map(c=>`<tr><td>${(typeof esc==='function'?esc(c.name):c.name)}</td><td>${c.count.toLocaleString('fa-IR')}</td><td>${c.sum.toLocaleString('fa-IR')}</td></tr>`).join('');
    }
  }

  let formalCount=0,formalSum=0,informalCount=0,informalSum=0;
  yearInvoices.forEach(p=>{
    if(p.inv.kind==='formal'){formalCount++;formalSum+=(p.inv.grandTotal||0);}
    else{informalCount++;informalSum+=(p.inv.grandTotal||0);}
  });
  setTxt('rep-formal-count',formalCount.toLocaleString('fa-IR'));
  setTxt('rep-formal-sum',formalSum.toLocaleString('fa-IR')+' '+cur);
  setTxt('rep-informal-count',informalCount.toLocaleString('fa-IR'));
  setTxt('rep-informal-sum',informalSum.toLocaleString('fa-IR')+' '+cur);
}

// ============== تغییر/تعیین رمز عبور از داخل تنظیمات (برای کاربران گوگل هم کار می‌کند) ==============
async function changeAccountPassword(){
  const p1=document.getElementById('acct-newpass').value;
  const p2=document.getElementById('acct-newpass2').value;
  if(p1.length<8){alert('رمز عبور باید حداقل ۸ کاراکتر باشد.');return;}
  if(p1!==p2){alert('تکرار رمز عبور با رمز اصلی یکی نیست.');return;}
  try{
    const {error}=await sb.auth.updateUser({password:p1,data:{has_password:true}});
    if(error)throw error;
    document.getElementById('acct-newpass').value='';
    document.getElementById('acct-newpass2').value='';
    alert('رمز عبور با موفقیت ذخیره شد. دفعات بعد می‌توانید با ایمیل و همین رمز هم وارد شوید.');
  }catch(err){
    alert(typeof authMsg==='function'?authMsg(err):(err.message||'خطا در ذخیره رمز عبور.'));
  }
}
