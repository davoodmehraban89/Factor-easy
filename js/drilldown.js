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
  getMyCheques().filter(q=>q.contactId===contactId||(!q.contactId&&q.contactName===c.name)).forEach(q=>rows.push({date:q.due_date,type:(q.direction==='inbound'?'چک دریافتی':'چک پرداختی')+' — '+(q.status==='cleared'?'وصول/پرداخت شده':q.status==='bounced'?'برگشتی':q.status==='cancelled'?'باطل':'در جریان'),ref:q.sayad_id,name:q.bank||c.name,amount:q.amount,action:chqAction(q)}));
  const sales=rows.filter(r=>r.type.startsWith('فروش')).reduce((a,r)=>a+r.amount,0);
  const purchases=rows.filter(r=>r.type.startsWith('خرید')).reduce((a,r)=>a+r.amount,0);
  const receivable=getMyInvoices().filter(i=>i.contactId===contactId&&i.paymentMethod==='credit').reduce((a,i)=>a+(typeof invoiceOutstanding==='function'?invoiceOutstanding(i):Number(i.grandTotal||0)),0);
  const payable=(datastore.purchases||[]).filter(p=>p.ownerUserId===currentUser.id&&p.supplierId===contactId&&p.paymentMethod==='credit').reduce((a,p)=>a+(typeof purchaseOutstanding==='function'?purchaseOutstanding(p):Number(p.grandTotal||0)),0);
  const contactCheques=getMyCheques().filter(q=>q.contactId===contactId||(!q.contactId&&q.contactName===c.name));
  const net=receivable-payable;
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
window.openFinancialSummaryDetail=function(kind){
  const labels={purchases:'فاکتورهای خرید',expenses:'هزینه‌ها',income:'درآمدها',receipts:'دریافت‌ها',payments:'پرداخت‌ها'};
  let rows=[];
  if(kind==='purchases')getMyPurchases().forEach(p=>rows.push({date:p.date,type:'خرید',ref:p.number,name:p.supplierName||p.costCenterLabel||'',amount:p.grandTotal,action:purAction(p)}));
  if(kind==='expenses'||kind==='income')getMyExpenses().filter(e=>e.kind===(kind==='expenses'?'expense':'income')).forEach(e=>rows.push({date:e.date,type:kind==='expenses'?'هزینه':'درآمد',ref:e.category||'',name:e.contactName||e.projectName||e.description||'',amount:e.amount,action:''}));
  if(kind==='receipts'||kind==='payments')getMyPayments().filter(p=>p.direction===(kind==='receipts'?'inbound':'outbound')).forEach(p=>rows.push({date:p.date,type:kind==='receipts'?'دریافت':'پرداخت',ref:p.reference||'',name:p.contactName||p.projectLabel||'',amount:p.amount,action:''}));
  show(labels[kind]||'جزئیات مالی',rowsTable(rows));
};

function dashboardCompanyId(){
 try{return getMySettings().default_company_id||getMyCompanies()[0]?.id||''}catch(_){return ''}
}
function dashboardCompanyAllowed(row){
 const c=dashboardCompanyId();return !c||row.companyId===c;
}
function dashboardAccounts(kind){
 const tb=window.P6Reports?.rollup?.('','')||[];
 return tb.filter(a=>{
   const title=String(a.title||''),role=String(a.systemRole||''),type=String(a.accountType||'').toLowerCase(),code=String(a.code||'');
   if(kind==='assets')return type==='asset'||(!type&&/دارایی|موجودی|بانک|صندوق|دریافتنی/.test(title+' '+code));
   const cashId=typeof jeCashAccount==='function'?jeCashAccount()?.id||'':'';
   return a.accountId===cashId||/cash|bank|petty|treasury/i.test(role)||/بانک|صندوق|تنخواه|نقد/.test(title);
 });
}
window.openDashboardAccountJournal=function(accountId){
 const account=(typeof getMyAccounts==='function'?getMyAccounts():[]).find(a=>a.id===accountId);
 if(!account)return;
 const rows=window.P6Reports?.ledger?.({accountId})||[];
 const trs=rows.map(r=>({date:r.voucher?.date||'',type:jeStatusLabelSafe(r.voucher?.status),ref:r.voucher?.number||r.voucherId||'',name:r.description||r.voucher?.description||'',amount:Number(r.debit||0)-Number(r.credit||0),action:'<button class="btn btn-secondary btn-inline finora-open-voucher" data-voucher-id="'+esc(r.voucherId||r.voucher?.id||'')+'">مرور سند</button>'}));
 show('گردش حساب — '+String(account.code||'')+' '+String(account.title||''),'<p class="af-hint">گردش سندهای قطعی، بر اساس دفتر کل و معین؛ مبلغ مثبت بدهکار و منفی بستانکار است.</p>'+rowsTable(trs));
};
function jeStatusLabelSafe(status){return status==='posted'?'قطعی':status==='reversed'?'برگشت‌شده':status==='draft'?'پیش‌نویس':status||'سند'}
window.openDashboardVoucher=function(voucherId){
 const v=(typeof getMyJournalVouchers==='function'?getMyJournalVouchers():[]).find(x=>x.id===voucherId&&dashboardCompanyAllowed(x));
 if(!v)return;
 const accounts=new Map((typeof getMyAccounts==='function'?getMyAccounts():[]).map(x=>[x.id,x]));
 const lines=(typeof getMyJournalLines==='function'?getMyJournalLines():[]).filter(x=>x.voucherId===voucherId);
 const content='<p><b>شماره: </b>'+esc(v.number||'—')+' · <b>تاریخ: </b>'+esc(v.date||'—')+' · <b>وضعیت: </b>'+esc(jeStatusLabelSafe(v.status))+'</p>'
 +'<div class="table-responsive"><table><thead><tr><th>حساب</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th></tr></thead><tbody>'
 +(lines.length?lines.map(l=>'<tr><td>'+esc((accounts.get(l.accountId)?.code||'')+' — '+(accounts.get(l.accountId)?.title||l.accountId||''))+'</td><td>'+esc(l.description||v.description||'')+'</td><td>'+fmt(l.debit)+'</td><td>'+fmt(l.credit)+'</td></tr>').join(''):'<tr><td colspan="4">آرتیکلی یافت نشد.</td></tr>')
 +'</tbody></table></div><button type="button" class="btn btn-secondary" id="finora-voucher-register-open">باز کردن مدیریت اسناد</button>';
 show('جزئیات سند حسابداری',content);
 const btn=$('finora-voucher-register-open');
 if(btn)btn.onclick=()=>{closeFinoraDrill();navigateShell('accounting','view-journal','register')};
};
window.openDashboardFinanceKpi=function(kind){
 const titles={assets:'جزئیات دارایی‌ها',cash:'نقد و بانک، صندوق و تنخواه',receivable:'دریافتنی‌های جاری',payable:'پرداختنی‌های جاری'};
 if(kind==='assets'||kind==='cash'){
   const rows=dashboardAccounts(kind);
   const html='<p class="af-hint">مبالغ از آرتیکل‌های قطعی دفترکل استخراج می‌شوند. برای مشاهده آرتیکل‌های هر حساب، روی «مرور حساب» بزنید.</p>'+
   '<div class="table-responsive"><table><thead><tr><th>کد</th><th>حساب</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th><th>مرور</th></tr></thead><tbody>'+
   (rows.length?rows.map(a=>'<tr><td>'+esc(a.code||'')+'</td><td>'+esc(a.title||'')+'</td><td>'+fmt(a.debit)+'</td><td>'+fmt(a.credit)+'</td><td>'+fmt(a.balance)+'</td><td><button type="button" class="btn btn-secondary btn-inline finora-open-account" data-account-id="'+esc(a.accountId)+'">مرور حساب</button></td></tr>').join(''):'<tr><td colspan="6">گردش حساب قطعی برای این بخش ثبت نشده است.</td></tr>')+
   '</tbody></table></div>'+(kind==='cash'?'<p class="af-hint">نکته: کارت مانده نقد و بانک فعلاً براساس حساب مرجع نقد محاسبه می‌شود؛ این فهرست همه حساب‌های مرتبط با بانک، صندوق و تنخواه را برای بررسی تفکیکی نمایش می‌دهد.</p>':'');
   show(titles[kind],html);return;
 }
 const inv=(typeof getMyInvoices==='function'?getMyInvoices():[]).filter(x=>dashboardCompanyAllowed(x)&&typeof invoiceDocumentStatus==='function'&&invoiceDocumentStatus(x)==='posted');
 const pur=(typeof getMyPurchases==='function'?getMyPurchases():[]).filter(x=>dashboardCompanyAllowed(x));
 const rows=kind==='receivable'?inv.filter(i=>i.paymentMethod==='credit').map(i=>({date:i.date,type:'فروش نسیه',ref:i.number,name:i.contactName||'',amount:typeof invoiceOutstanding==='function'?invoiceOutstanding(i):i.grandTotal,action:invAction(i)}))
 :pur.filter(p=>p.paymentMethod==='credit').map(p=>({date:p.date,type:'خرید نسیه',ref:p.number,name:p.supplierName||'',amount:typeof purchaseOutstanding==='function'?purchaseOutstanding(p):p.grandTotal,action:purAction(p)}));
 show(titles[kind]||'جزئیات',rowsTable(rows));
};
document.addEventListener('click',e=>{
 const target=e.target instanceof Element?e.target:null;
 const account=target?.closest('#finora-drill-modal .finora-open-account');
 const voucher=target?.closest('#finora-drill-modal .finora-open-voucher');
 if(account)openDashboardAccountJournal(account.dataset.accountId);
 else if(voucher)openDashboardVoucher(voucher.dataset.voucherId);
});
function wireFinanceDashboard(){
 const ids=[['kpi-assets-sum','assets'],['kpi-cash-sum','cash'],['kpi-receivable-sum','receivable'],['kpi-payable-sum','payable']];
 for(const [id,kind] of ids){
   const card=$(id)?.closest('.fin-kpi-card');if(!card)continue;
   card.style.cursor='pointer';card.title='مرور جزئیات و گردش حساب';card.setAttribute('role','button');card.setAttribute('tabindex','0');
   card.onclick=()=>openDashboardFinanceKpi(kind);
   card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click()}};
 }
 const tb=$('dashboard-recent-journals');if(!tb)return;
 for(const [i,tr] of [...tb.querySelectorAll('tr')].entries()){
   const id=(typeof getMyJournalVouchers==='function'?getMyJournalVouchers():[]).filter(dashboardCompanyAllowed)
     .slice().sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||''))).slice(0,5)[i]?.id;
   if(!id||tr.querySelector('.af-empty'))continue;
   tr.style.cursor='pointer';tr.title='مشاهده جزئیات سند';tr.setAttribute('tabindex','0');tr.setAttribute('role','button');
   tr.onclick=()=>openDashboardVoucher(id);
   tr.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tr.click()}};
 }
}

function wire(){
  [['kpi-sales-sum','sales'],['kpi-settled-sum','settled'],['kpi-debtors-sum','debtors'],['kpi-cheques-count','cheques']].forEach(([id,k])=>{const card=$(id)?.closest('.kpi-unit');if(card){card.style.cursor='pointer';card.title='مشاهده جزئیات';card.onclick=()=>openDashboardDetail(k);}});
  [['rep-year-total','year'],['rep-year-avg','avg'],['rep-best-month','best'],['rep-invoice-count','count']].forEach(([id,k])=>{const card=$(id)?.closest('.kpi-unit');if(card){card.style.cursor='pointer';card.title='مشاهده اسناد تشکیل‌دهنده';card.onclick=()=>openReportDetail(k);}});
  [['rep-purchase-total','purchases'],['rep-expense-total','expenses']].forEach(([id,k])=>{const card=$(id)?.closest('.kpi-unit');if(card){card.style.cursor='pointer';card.title='مشاهده جزئیات';card.onclick=()=>openFinancialSummaryDetail(k);}});
  document.querySelectorAll('#report-top-customers tr').forEach(tr=>{const id=tr.dataset?.contactId;const name=tr.cells?.[0]?.textContent;const c=(id&&getMyContacts().find(x=>x.id===id))||getMyContacts().find(x=>x.name===name);if(c){tr.style.cursor='pointer';tr.title='مرور حساب';tr.onclick=()=>openContactLedger(c.id);}});
}
const rd=window.renderDashboard;window.renderDashboard=function(){rd();wire();wireFinanceDashboard();const tb=$('dashboard-recent-table');if(tb)tb.querySelectorAll('tr').forEach(tr=>{const num=(tr.cells?.[0]?.textContent||'').replace(/^#/,'');const i=getMyInvoices().find(x=>String(x.number)===num);if(i&&tr.lastElementChild&&!tr.lastElementChild.querySelector('.dash-open')){const b=document.createElement('button');b.className='btn btn-secondary btn-inline dash-open';b.style.cssText='padding:4px 8px;font-size:11px;margin-left:4px';b.textContent='جزئیات';b.onclick=()=>editInvoice(i.id);tr.lastElementChild.prepend(b);}});};
const rr=window.renderFinancialReports;if(typeof rr==='function')window.renderFinancialReports=function(){rr();wire();};
const rc=window.renderContacts;window.renderContacts=function(){rc();const cs=getMyContacts(),trs=document.querySelectorAll('#contacts-ledger-table-body tr');trs.forEach((tr,i)=>{const c=cs[i];if(!c||!tr.cells||tr.cells.length<7)return;tr.cells[0].style.cursor='pointer';tr.cells[0].title='مرور حساب';tr.cells[0].onclick=()=>openContactLedger(c.id);const rec=getMyInvoices().filter(i=>i.contactId===c.id&&i.paymentMethod==='credit').reduce((a,i)=>a+(typeof invoiceOutstanding==='function'?invoiceOutstanding(i):Number(i.grandTotal||0)),0);const pay=(datastore.purchases||[]).filter(p=>p.ownerUserId===currentUser.id&&p.supplierId===c.id&&p.paymentMethod==='credit').reduce((a,p)=>a+(typeof purchaseOutstanding==='function'?purchaseOutstanding(p):Number(p.grandTotal||0)),0);const net=rec-pay;tr.cells[6].innerHTML=`<div style="font-weight:bold">${fmt(Math.abs(net))}</div><button class="btn btn-secondary btn-inline" style="padding:2px 7px;font-size:11px;margin-top:3px" onclick="openContactLedger('${c.id}')">${net>0?'مطالبات':net<0?'بدهی':'مرور حساب'} ↗</button>`;});};
try{if(currentUser)refreshAllSurfaces();}catch(e){console.error('drilldown init',e);}
})();