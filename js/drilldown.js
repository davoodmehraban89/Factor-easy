(function(){
const $=id=>document.getElementById(id),fmt=n=>Number(n||0).toLocaleString('fa-IR');
function modal(){if($('finora-drill-modal'))return;const d=document.createElement('div');d.id='finora-drill-modal';d.className='modal-backdrop';d.innerHTML='<div class="modal-card" style="max-width:1000px;max-height:85vh;overflow:auto"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 id="finora-drill-title"></h3><button class="btn btn-secondary btn-inline" onclick="closeFinoraDrill()">✕ بستن</button></div><div id="finora-drill-body"></div></div>';document.body.appendChild(d);}
window.closeFinoraDrill=function(){if($('finora-drill-modal'))$('finora-drill-modal').classList.remove('active');};
function show(title,html){modal();$('finora-drill-title').innerText=title;$('finora-drill-body').innerHTML=html;$('finora-drill-modal').classList.add('active');}
function rowsTable(rows){return `<div class="table-responsive"><table><thead><tr><th>تاریخ</th><th>نوع</th><th>مرجع</th><th>طرف حساب / پروژه</th><th>مبلغ</th><th>عملیات</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td>${esc(r.date||'—')}</td><td>${esc(r.type||'—')}</td><td>${esc(r.ref||'—')}</td><td>${esc(r.name||'—')}</td><td>${fmt(r.amount)}</td><td>${r.action||''}</td></tr>`).join(''):'<tr><td colspan="6" style="text-align:center;padding:18px">موردی وجود ندارد.</td></tr>'}</tbody></table></div>`;}
function invAction(i){return `<button class="btn btn-secondary btn-inline" onclick="closeFinoraDrill();editInvoice('${i.id}')">باز کردن</button> <button class="btn btn-secondary btn-inline" onclick="renderAndPrintDirect('${i.id}')">چاپ</button>`;}
function purAction(p){return `<button class="btn btn-secondary btn-inline" onclick="closeFinoraDrill();purEdit('${p.id}')">باز کردن</button>`;}
function chqAction(q){return `<button class="btn btn-secondary btn-inline" onclick="closeFinoraDrill();editCheque('${q.id}')">باز کردن</button>`;}
window.openContactLedger=function(contactId){
  const c=getMyContacts().find(x=>x.id===contactId);if(!c)return;
  const rows=[];
  getMyInvoices().filter(i=>i.contactId===contactId).forEach(i=>rows.push({date:i.date,type:'فروش '+(i.paymentMethod==='credit'?'نسیه':'نقدی'),ref:i.number,name:(i.projectName?i.projectName+' — ':'')+(i.description||c.name),amount:i.grandTotal,action:invAction(i)}));
  (datastore.purchases||[]).filter(p=>p.ownerUserId===currentUser.id&&p.supplierId===contactId).forEach(p=>rows.push({date:p.date,type:'خرید '+(p.paymentMethod==='credit'?'نسیه':'نقدی'),ref:p.number,name:(p.costCenterLabel?p.costCenterLabel+' — ':'')+(p.description||c.name),amount:p.grandTotal,action:purAction(p)}));
  getMyCheques().filter(q=>q.contactId===contactId||(!q.contactId&&q.contactName===c.name)).forEach(q=>rows.push({date:q.due_date,type:q.direction==='inbound'?'چک دریافتی':'چک پرداختی',ref:q.sayad_id,name:q.bank||c.name,amount:q.amount,action:chqAction(q)}));
  const sales=rows.filter(r=>r.type.startsWith('فروش')).reduce((a,r)=>a+r.amount,0);
  const purchases=rows.filter(r=>r.type.startsWith('خرید')).reduce((a,r)=>a+r.amount,0);
  const receivable=getMyInvoices().filter(i=>i.contactId===contactId&&i.paymentMethod==='credit').reduce((a,i)=>a+Number(i.grandTotal||0),0);
  const payable=(datastore.purchases||[]).filter(p=>p.ownerUserId===currentUser.id&&p.supplierId===contactId&&p.paymentMethod==='credit').reduce((a,p)=>a+Number(p.grandTotal||0),0);
  const contactCheques=getMyCheques().filter(q=>q.contactId===contactId||(!q.contactId&&q.contactName===c.name));
  const received=contactCheques.filter(q=>q.direction==='inbound').reduce((a,q)=>a+Number(q.amount||0),0);
  const paid=contactCheques.filter(q=>q.direction==='outbound').reduce((a,q)=>a+Number(q.amount||0),0);
  const net=(receivable-received)-(payable-paid);
  show('مرور حساب — '+c.name,`<div class="grid-kpi" style="margin-bottom:12px"><div class="kpi-unit"><div><div class="kpi-lbl">فروش</div><div class="kpi-val">${fmt(sales)}</div></div></div><div class="kpi-unit"><div><div class="kpi-lbl">خرید</div><div class="kpi-val">${fmt(purchases)}</div></div></div><div class="kpi-unit"><div><div class="kpi-lbl">مطالبات</div><div class="kpi-val">${fmt(receivable)}</div></div></div><div class="kpi-unit"><div><div class="kpi-lbl">بدهی</div><div class="kpi-val">${fmt(payable)}</div></div></div></div><div style="padding:10px 12px;margin-bottom:12px;border:1px solid var(--border);border-radius:10px"><b>مانده خالص:</b> ${fmt(Math.abs(net))} — ${net>0?'مطالبات از طرف حساب':net<0?'بدهی به طرف حساب':'تسویه'}</div>${rowsTable(rows)}`);
}
window.openDashboardDetail=function(kind){let title='',rows=[];const inv=getMyInvoices();if(kind==='sales'||kind==='settled'||kind==='debtors'){title=kind==='sales'?'جزئیات فروش':kind==='settled'?'فروش/دریافت وصول‌شده':'مطالبات نسیه';inv.filter(i=>kind==='sales'||(kind==='settled'&&i.paymentMethod!=='credit')||(kind==='debtors'&&i.paymentMethod==='credit')).forEach(i=>rows.push({date:i.date,type:i.kindLabel||'فاکتور',ref:i.number,name:(i.contactName||'')+(i.projectName?' — '+i.projectName:''),amount:i.grandTotal,action:invAction(i)}));}else{title='چک‌های باز صیادی';getMyCheques().filter(q=>q.status==='registered').forEach(q=>rows.push({date:q.due_date,type:q.direction==='inbound'?'دریافتی':'پرداختی',ref:q.sayad_id,name:q.contactName,amount:q.amount,action:chqAction(q)}));}show(title,rowsTable(rows));}
window.openReportDetail=function(kind){
  const y=parseInt($('report-year-select')?.value||0);
  const parsed=getMyInvoices().map(i=>{const d=String(i.date||'').replace(/[۰-۹]/g,x=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(x));const p=d.split('/');return {i,year:parseInt(p[0]),month:parseInt(p[1])};}).filter(x=>x.year===y);
  let list=parsed,title='جزئیات گزارش';
  if(kind==='best'&&parsed.length){
    const sums=Array(12).fill(0);parsed.forEach(x=>{if(x.month>=1&&x.month<=12)sums[x.month-1]+=Number(x.i.grandTotal||0);});
    const m=sums.indexOf(Math.max(...sums))+1;list=parsed.filter(x=>x.month===m);title='فاکتورهای پرفروش‌ترین ماه';
  }else if(kind==='year')title='فاکتورهای سال انتخاب‌شده';
  else if(kind==='avg')title='اسناد تشکیل‌دهنده میانگین ماهانه';
  else if(kind==='count')title='فهرست فاکتورهای سال';
  const rows=list.map(x=>({date:x.i.date,type:x.i.kindLabel||'فاکتور',ref:x.i.number,name:(x.i.contactName||'')+(x.i.projectName?' — '+x.i.projectName:''),amount:x.i.grandTotal,action:invAction(x.i)}));
  show(title,rowsTable(rows));
};
function wire(){
  [['kpi-sales-sum','sales'],['kpi-settled-sum','settled'],['kpi-debtors-sum','debtors'],['kpi-cheques-count','cheques']].forEach(([id,k])=>{const card=$(id)?.closest('.kpi-unit');if(card){card.style.cursor='pointer';card.title='مشاهده جزئیات';card.onclick=()=>openDashboardDetail(k);}});
  [['rep-year-total','year'],['rep-year-avg','avg'],['rep-best-month','best'],['rep-invoice-count','count']].forEach(([id,k])=>{const card=$(id)?.closest('.kpi-unit');if(card){card.style.cursor='pointer';card.title='مشاهده اسناد تشکیل‌دهنده';card.onclick=()=>openReportDetail(k);}});
  document.querySelectorAll('#report-top-customers tr').forEach(tr=>{const id=tr.dataset?.contactId;const name=tr.cells?.[0]?.textContent;const c=(id&&getMyContacts().find(x=>x.id===id))||getMyContacts().find(x=>x.name===name);if(c){tr.style.cursor='pointer';tr.title='مرور حساب';tr.onclick=()=>openContactLedger(c.id);}});
}
const rd=window.renderDashboard;window.renderDashboard=function(){rd();wire();const tb=$('dashboard-recent-table');if(tb)tb.querySelectorAll('tr').forEach(tr=>{const num=(tr.cells?.[0]?.textContent||'').replace(/^#/,'');const i=getMyInvoices().find(x=>String(x.number)===num);if(i&&tr.lastElementChild&&!tr.lastElementChild.querySelector('.dash-open')){const b=document.createElement('button');b.className='btn btn-secondary btn-inline dash-open';b.style.cssText='padding:4px 8px;font-size:11px;margin-left:4px';b.textContent='جزئیات';b.onclick=()=>editInvoice(i.id);tr.lastElementChild.prepend(b);}});};
const rr=window.renderFinancialReports;if(typeof rr==='function')window.renderFinancialReports=function(){rr();wire();};
const rc=window.renderContacts;window.renderContacts=function(){rc();const cs=getMyContacts(),trs=document.querySelectorAll('#contacts-ledger-table-body tr');trs.forEach((tr,i)=>{const c=cs[i];if(!c||!tr.cells||tr.cells.length<7)return;tr.cells[0].style.cursor='pointer';tr.cells[0].title='مرور حساب';tr.cells[0].onclick=()=>openContactLedger(c.id);const rec=getMyInvoices().filter(i=>i.contactId===c.id&&i.paymentMethod==='credit').reduce((a,i)=>a+Number(i.grandTotal||0),0);const pay=(datastore.purchases||[]).filter(p=>p.ownerUserId===currentUser.id&&p.supplierId===c.id&&p.paymentMethod==='credit').reduce((a,p)=>a+Number(p.grandTotal||0),0);const cq=getMyCheques().filter(q=>q.contactId===c.id||(!q.contactId&&q.contactName===c.name));const received=cq.filter(q=>q.direction==='inbound').reduce((a,q)=>a+Number(q.amount||0),0);const paid=cq.filter(q=>q.direction==='outbound').reduce((a,q)=>a+Number(q.amount||0),0);const net=(rec-received)-(pay-paid);tr.cells[6].innerHTML=`<div style="font-weight:bold">${fmt(Math.abs(net))}</div><button class="btn btn-secondary btn-inline" style="padding:2px 7px;font-size:11px;margin-top:3px" onclick="openContactLedger('${c.id}')">${net>0?'مطالبات':net<0?'بدهی':'مرور حساب'} ↗</button>`;});};
try{if(currentUser)refreshAllSurfaces();}catch(e){console.error('drilldown init',e);}
})();