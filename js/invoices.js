function handleInvoiceKindChange(){
  const kind=document.getElementById('invoice-kind').value;
  const vatModeRow=document.getElementById('box-invoice-vat-mode-row');
  const vatModeSelect=document.getElementById('invoice-vat-mode');
  if(kind==='non_formal'){
    if(vatModeRow)vatModeRow.style.display='none';
    if(vatModeSelect)vatModeSelect.value='none';
  }else{
    if(vatModeRow)vatModeRow.style.display='flex';
  }
  const boxEdoc=document.getElementById('box-enable-electronic-doc');
  if(boxEdoc){
    if(kind==='formal'){
      boxEdoc.style.display='block';
    }else{
      boxEdoc.style.display='none';
      const cb=document.getElementById('enable-electronic-doc');
      if(cb)cb.checked=false;
      window.pendingElectronicDoc=null;
      const st=document.getElementById('edoc-status');
      if(st)st.innerText='';
    }
  }
  const contractBox=document.getElementById('box-invoice-contract-number');
  if(contractBox)contractBox.style.display=(kind==='contract_statement')?'flex':'none';
  handleVatModeChange();
  recomputeTotals();
}
function handleVatModeChange(){
  const mode=document.getElementById('invoice-vat-mode').value;
  const kind=document.getElementById('invoice-kind').value;
  const rateBox=document.getElementById('box-invoice-vat-rate');
  if(kind==='non_formal'){rateBox.style.display='none';document.getElementById('invoice-vat-mode').value='none';}
  else{rateBox.style.display=(mode==='with_vat')?'flex':'none';}
  recomputeTotals();
}
function handleVatTypeChange(){const type=document.getElementById('invoice-vat-type').value;document.getElementById('invoice-vat-rate-input').value=(type==='percent')?10:0;recomputeTotals();}
function handleDiscountTypeChange(){
  const type=document.getElementById('invoice-discount-type').value;
  const label=document.getElementById('label-invoice-discount-value');
  const cur=getCurrencyLabel();
  label.innerText=(type==='percent')?'درصد تخفیف (٪)':`مبلغ تخفیف (${cur})`;
  document.getElementById('invoice-discount-fixed').value=0;
  recomputeTotals();
}
function applyDefaultSettingsToForm(){
  const def=getMySettings();
  const defKind=document.getElementById('def-invoice-kind');
  const defVat=document.getElementById('def-vat-mode');
  const defRate=document.getElementById('def-vat-rate');
  const defCurMode=document.getElementById('def-currency-mode');
  const defCurCustom=document.getElementById('def-currency-custom');
  if(defKind)defKind.value=def.invoice_kind||'non_formal';
  if(defVat)defVat.value=def.vat_mode||'none';
  if(defRate)defRate.value=def.vat_rate||10;
  if(defCurMode)defCurMode.value=def.currency_mode||'rial';
  if(defCurCustom)defCurCustom.value=def.currency_custom||'';
  handleCurrencyModeChange();
  const editId=document.getElementById('edit-invoice-id')?.value;
  if(!editId){
    const kindEl=document.getElementById('invoice-kind');
    if(kindEl)kindEl.value=def.invoice_kind||'non_formal';
    handleInvoiceKindChange();
    if((def.invoice_kind||'non_formal')!=='non_formal'){
      document.getElementById('invoice-vat-mode').value=def.vat_mode||'none';
      document.getElementById('invoice-vat-rate-input').value=def.vat_rate||10;
      handleVatModeChange();
    }
  }
}
function commitSaveDefaultSettings(){
  if(!requireWrite())return;
  const s=getMySettings();
  s.invoice_kind=document.getElementById('def-invoice-kind').value;
  s.vat_mode=document.getElementById('def-vat-mode').value;
  s.vat_rate=parseFormattedNumber(document.getElementById('def-vat-rate').value);
  s.currency_mode=document.getElementById('def-currency-mode').value;
  s.currency_custom=document.getElementById('def-currency-custom').value||'';
  saveDatastore();
  refreshCurrencyLabels();
  alert('پیش‌فرض‌ها ذخیره شد.');
}
function renderDashboard(){
  const cur=getCurrencyLabel(),myInvoices=getMyInvoices(),myPurchases=typeof getMyPurchases==='function'?getMyPurchases():[],myPayments=typeof getMyPayments==='function'?getMyPayments():[],companies=getMyCompanies(),settings=getMySettings(),activeCompId=settings.default_company_id||document.getElementById('invoice-company-id')?.value||(companies[0]?.id);
  const companyOk=x=>!activeCompId||x.companyId===activeCompId,inv=myInvoices.filter(x=>companyOk(x)&&invoiceCreatesAccountingEntry(x.kind)&&invoiceDocumentStatus(x)==='posted'),pur=myPurchases.filter(companyOk),pay=myPayments.filter(companyOk);
  const receivable=inv.filter(x=>x.paymentMethod==='credit').reduce((s,x)=>s+(typeof invoiceOutstanding==='function'?invoiceOutstanding(x):Number(x.grandTotal||0)),0);
  const payable=pur.filter(x=>x.paymentMethod==='credit').reduce((s,x)=>s+(typeof purchaseOutstanding==='function'?purchaseOutstanding(x):Number(x.grandTotal||0)),0);
  let assets=0,cash=0;try{if(window.P6Reports){const f=P6Reports.financials('','');assets=Number(f.assets||0);const cashId=typeof jeCashAccount==='function'?jeCashAccount()?.id||'':'';if(cashId){const row=P6Reports.rollup('','').find(x=>x.accountId===cashId);cash=Number(row?.balance||0)}}}catch(_){}
  const setMoney=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=Math.round(v||0).toLocaleString('fa-IR')+' '+cur};
  setMoney('kpi-assets-sum',assets);setMoney('kpi-cash-sum',cash);setMoney('kpi-receivable-sum',receivable);setMoney('kpi-payable-sum',payable);
  const months=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'],now=String(getJalaliNumeric()).split('/'),cy=+now[0]||1405,cm=+now[1]||1,slots=[];for(let k=5;k>=0;k--){let y=cy,m=cm-k;while(m<1){m+=12;y--}slots.push({key:y+'/'+String(m).padStart(2,'0'),label:months[m-1],in:0,out:0})}
  pay.forEach(p=>{const key=String(p.date||'').slice(0,7),slot=slots.find(x=>x.key===key);if(slot){const amount=Number(p.amount||0);if(p.direction==='inbound')slot.in+=amount;else if(p.direction==='outbound')slot.out+=amount}});
  const chart=document.getElementById('dashboard-cashflow-chart');if(chart){const max=Math.max(1,...slots.flatMap(x=>[x.in,x.out])),W=720,H=220,pad=34,step=(W-pad*2)/Math.max(1,slots.length-1),y=v=>H-pad-(v/max)*(H-pad*2),pts=kind=>slots.map((x,i)=>(pad+i*step)+','+y(x[kind])).join(' '),labels=slots.map((x,i)=>'<text x="'+(pad+i*step)+'" y="'+(H-8)+'" text-anchor="middle" font-size="10" fill="#64748b">'+x.label+'</text>').join('');chart.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="گردش شش ماهه نقدینگی"><line x1="'+pad+'" y1="'+(H-pad)+'" x2="'+(W-pad)+'" y2="'+(H-pad)+'" stroke="#e5eaf1"/><polyline points="'+pts('in')+'" fill="none" stroke="#0a9baa" stroke-width="3"/><polyline points="'+pts('out')+'" fill="none" stroke="#1685d1" stroke-width="3"/>'+slots.map((x,i)=>'<circle cx="'+(pad+i*step)+'" cy="'+y(x.in)+'" r="4" fill="#0a9baa"/><circle cx="'+(pad+i*step)+'" cy="'+y(x.out)+'" r="4" fill="#1685d1"/>').join('')+labels+'</svg><div class="fin-chart-legend"><span><i class="fin-chart-dot" style="background:#0a9baa"></i>ورود</span><span><i class="fin-chart-dot" style="background:#1685d1"></i>خروج</span></div>'}
  const status=document.getElementById('dashboard-account-status');if(status){const rows=[['حساب‌های دریافتنی',receivable],['حساب‌های پرداختنی',payable],['موجودی نقد و بانک',Math.abs(cash)],['جمع دارایی‌ها',Math.abs(assets)]],mx=Math.max(1,...rows.map(x=>x[1]));status.innerHTML=rows.map(([title,value])=>'<div class="fin-status-row"><div class="fin-status-line"><span>'+title+'</span><b>'+Math.round(value).toLocaleString('fa-IR')+' '+cur+'</b></div><div class="fin-status-track"><div class="fin-status-fill" style="width:'+Math.round((value/mx)*100)+'%"></div></div></div>').join('')}
  const body=document.getElementById('dashboard-recent-journals');if(body){const vs=typeof getMyJournalVouchers==='function'?getMyJournalVouchers().filter(companyOk).slice().sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||''))).slice(0,5):[];body.innerHTML=vs.length?vs.map(v=>'<tr><td>'+esc(v.number||'—')+'</td><td>'+esc(v.date||'—')+'</td><td>'+esc(v.description||'—')+'</td><td>'+Number(v.totalDebit||0).toLocaleString('fa-IR')+'</td><td>'+Number(v.totalCredit||0).toLocaleString('fa-IR')+'</td><td><span class="badge '+(v.status==='posted'?'badge-success':v.status==='reversed'?'badge-danger':'badge-warning')+'">'+esc(v.status==='posted'?'قطعی':v.status==='reversed'?'برگشت‌شده':'پیش‌نویس')+'</span></td></tr>').join(''):'<tr><td colspan="6" class="af-empty">سند حسابداری ثبت نشده است.</td></tr>'}
}
function onActiveCompanyFilterChange(){
  // The invoicing seller follows Settings and cannot change invoice scope.
  const active=typeof afCompanyId==='function'?afCompanyId():'';
  const header=document.getElementById('invoice-company-id');
  if(header&&header.value!==active)header.value=active;
  renderInvoices();renderDashboard();
}
function startNewInvoice(){cancelInvoiceEdit();switchView('view-invoices');}
function updateInvoiceItemRowNumbers(){
  const rows=document.querySelectorAll('#invoice-items-table-body tr');
  rows.forEach((tr,index)=>{const numCell=tr.querySelector('.row-item-number');if(numCell)numCell.innerText=(index+1).toLocaleString('fa-IR');});
}
function addInvoiceItemRow(selectedProdId='',initialQty=1,initialPrice=null){
  const tbody=document.getElementById('invoice-items-table-body');
  const rowKey='item_'+Date.now()+'_'+Math.random().toString(36).substr(2,4);
  const tr=document.createElement('tr');
  tr.id=rowKey;
  const myProducts=getMyProducts();
  const productOptions=myProducts.map(p=>`<option value="${p.id}" data-price="${esc(p.sale_price||0)}" data-unit="${esc(p.unit||'عدد')}" data-search="${esc([p.code,p.name,p.spec,p.barcode,p.internal_id,p.official_id,p.category,p.subcategory].filter(Boolean).join(' ').toLowerCase())}" ${p.id===selectedProdId?'selected':''}>${esc(p.name)} ${esc(p.spec?'('+p.spec+')':'')}</option>`).join('');
  const priceVal=(initialPrice!==null?Number(initialPrice):0);
  tr.innerHTML=`
    <td class="row-item-number" style="width:40px;text-align:center;font-weight:bold;vertical-align:middle"></td>
    <td><select class="form-control row-product-select" onchange="onRowProductChange('${rowKey}')"><option value="">-- انتخاب کالا / خدمات --</option>${productOptions}</select></td>
    <td style="width:90px"><input type="text" class="form-control row-unit-input" value="عدد" style="text-align:center" /></td>
    <td style="width:100px"><input type="number" class="form-control row-quantity" value="${initialQty}" min="1" oninput="recomputeTotals()" style="text-align:center" /></td>
    <td style="width:160px"><input type="text" inputmode="decimal" class="form-control row-price" value="${priceVal?priceVal.toLocaleString('en-US'):''}" oninput="handleMoneyInput(this);recomputeTotals()" style="text-align:left" /></td>
    <td class="row-linetotal" style="width:170px;font-weight:bold;text-align:left;vertical-align:middle;direction:ltr">۰</td>
    <td style="width:50px;text-align:center;vertical-align:middle"><button class="btn btn-danger btn-inline" style="min-height:36px;padding:4px 10px" onclick="document.getElementById('${rowKey}').remove();updateInvoiceItemRowNumbers();recomputeTotals()">✕</button></td>`;
  tbody.appendChild(tr);
  if(typeof finoraRefreshSearchableSelect==='function')finoraRefreshSearchableSelect(tr.querySelector('.row-product-select'));
  updateInvoiceItemRowNumbers();
  if(selectedProdId&&initialPrice===null)onRowProductChange(rowKey);
  else recomputeTotals();
}
function onRowProductChange(rowKey){
  const tr=document.getElementById(rowKey);if(!tr)return;
  const sel=tr.querySelector('.row-product-select');
  const opt=sel.options[sel.selectedIndex];
  const prc=parseFormattedNumber(opt?.getAttribute('data-price')||0);
  const unt=opt?.getAttribute('data-unit');
  tr.querySelector('.row-price').value=prc?prc.toLocaleString('en-US'):'';
  if(unt){const unitInput=tr.querySelector('.row-unit-input');if(unitInput)unitInput.value=unt;}
  recomputeTotals();
}
function recomputeTotals(){
  let subtotal=0;
  document.querySelectorAll('#invoice-items-table-body tr').forEach(tr=>{
    const qty=parseFloat(tr.querySelector('.row-quantity')?.value)||0;
    const prc=parseFormattedNumber(tr.querySelector('.row-price')?.value);
    const line=qty*prc;
    const lineEl=tr.querySelector('.row-linetotal');
    if(lineEl)lineEl.innerText=line.toLocaleString('fa-IR');
    subtotal+=line;
  });
  const discountType=document.getElementById('invoice-discount-type')?.value||'fixed';
  const discountInput=parseFormattedNumber(document.getElementById('invoice-discount-fixed')?.value);
  const rawDiscount=(discountType==='percent')?Math.round(subtotal*(discountInput/100)):discountInput;
  const fixedDiscount=Math.max(0,Math.min(rawDiscount,subtotal));
  const kind=document.getElementById('invoice-kind')?.value||'non_formal';
  const vatMode=(kind==='non_formal')?'none':(document.getElementById('invoice-vat-mode')?.value||'none');
  const vatType=document.getElementById('invoice-vat-type')?.value||'percent';
  const vatRate=parseFormattedNumber(document.getElementById('invoice-vat-rate-input')?.value);
  const afterDiscount=Math.max(0,subtotal-fixedDiscount);
  let vatAmount=0;
  if(vatMode==='with_vat'){vatAmount=(vatType==='fixed')?Math.max(0,Math.round(vatRate)):Math.round(afterDiscount*(vatRate/100));}
  const grandTotal=afterDiscount+vatAmount;
  const cur=getCurrencyLabel();
  const subtotalEl=document.getElementById('summary-subtotal');
  const vatEl=document.getElementById('summary-vat');
  const grandEl=document.getElementById('summary-grandtotal');
  const wordsEl=document.getElementById('summary-words');
  if(subtotalEl)subtotalEl.innerText=subtotal.toLocaleString('fa-IR')+' '+cur;
  if(vatEl)vatEl.innerText=vatAmount.toLocaleString('fa-IR')+' '+cur;
  if(grandEl)grandEl.innerText=grandTotal.toLocaleString('fa-IR')+' '+cur;
  if(wordsEl)wordsEl.innerText='به حروف: '+numberToPersianWords(grandTotal,cur);
  return {subtotal,fixedDiscount,discountType,discountInput,vatAmount,vatType,grandTotal,vatRate};
}

// ================== سند الکترونیکی سامانه مودیان ==================
function toggleElectronicDoc(){
  const checked=document.getElementById('enable-electronic-doc').checked;
  if(checked){
    openElectronicDocModal();
  }else{
    window.pendingElectronicDoc=null;
    document.getElementById('edoc-status').innerText='';
  }
}
function openElectronicDocModal(){
  const itemsContainer=document.getElementById('edoc-items-container');
  const rows=document.querySelectorAll('#invoice-items-table-body tr');
  let html='';
  if(rows.length===0){
    html='<p style="color:var(--text-muted);font-size:12.5px;padding:8px">ابتدا اقلام فاکتور را اضافه کنید.</p>';
  }else{
    rows.forEach((tr,idx)=>{
      const sel=tr.querySelector('.row-product-select');
      const prodId=sel?sel.value:'';
      const prod=getMyProducts().find(p=>p.id===prodId)||{};
      const prodName=sel&&sel.options[sel.selectedIndex]?sel.options[sel.selectedIndex].text:'';
      html+=`<div style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px;background:#f8fafc">
        <div style="font-weight:bold;font-size:13px;margin-bottom:8px">ردیف ${toPersianDigits(idx+1)}: ${prodName||'—'}</div>
        <div class="form-row">
          <div class="form-group" style="margin-bottom:6px"><label style="font-size:12px">شناسه کالا/خدمت داخلی</label><input type="text" class="form-control edoc-row-internal" data-row="${idx}" value="${esc(prod.code||'')}" readonly /><small style="color:var(--text-muted)">از تعریف کالا/خدمت خوانده می‌شود.</small></div>
          <div class="form-group" style="margin-bottom:6px"><label style="font-size:12px">شناسه کالا/خدمت سامانه مالیاتی <span style="color:var(--danger)">*</span></label><input type="text" class="form-control edoc-row-official" data-row="${idx}" value="${esc(prod.official_id||'')}" /><small style="color:var(--text-muted)">اگر در تعریف کالا ثبت نشده، اینجا تکمیل آن الزامی است.</small></div>
        </div>
      </div>`;
    });
  }
  itemsContainer.innerHTML=html;

  const p=window.pendingElectronicDoc;
  if(p){
    document.getElementById('edoc-unique-number').value=p.uniqueNumber||'';
    document.getElementById('edoc-tax-number').value=p.taxNumber||'';
    document.getElementById('edoc-issue-datetime').value=p.issueDateTime||'';
    document.getElementById('edoc-original-date').value=p.originalDate||'';
    document.getElementById('edoc-original-number').value=p.originalNumber||'';
    document.getElementById('edoc-kind').value=p.kind||'اصل';
    document.getElementById('edoc-pattern').value=p.pattern||'کالا';
    document.getElementById('edoc-contract-id').value=p.contractId||'';
    if(p.items){
      p.items.forEach((it,idx)=>{
        const intEl=document.querySelector(`.edoc-row-internal[data-row="${idx}"]`);
        const offEl=document.querySelector(`.edoc-row-official[data-row="${idx}"]`);
        if(intEl){const row=document.querySelectorAll('#invoice-items-table-body tr')[idx],sel=row?.querySelector('.row-product-select'),prod=getMyProducts().find(x=>x.id===sel?.value);intEl.value=prod?.code||it.internalId||'';}
        if(offEl){const row=document.querySelectorAll('#invoice-items-table-body tr')[idx],sel=row?.querySelector('.row-product-select'),prod=getMyProducts().find(x=>x.id===sel?.value);offEl.value=prod?.official_id||it.officialId||'';}
      });
    }
  }else{
    const now=new Date();
    const timeStr=now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0')+':00';
    document.getElementById('edoc-issue-datetime').value=getJalaliNumeric()+' '+timeStr;
    document.getElementById('edoc-original-date').value='';
    document.getElementById('edoc-original-number').value='';
    document.getElementById('edoc-unique-number').value='';
    document.getElementById('edoc-tax-number').value='';
    document.getElementById('edoc-kind').value='اصل';
    document.getElementById('edoc-pattern').value='کالا';
    document.getElementById('edoc-contract-id').value='';
  }
  handleEdocPatternChange();
  document.getElementById('modal-electronic-doc').classList.add('active');
}
function closeElectronicDocModal(){
  document.getElementById('modal-electronic-doc').classList.remove('active');
}
function cancelElectronicDoc(){
  document.getElementById('enable-electronic-doc').checked=false;
  window.pendingElectronicDoc=null;
  document.getElementById('edoc-status').innerText='';
  closeElectronicDocModal();
}
function handleEdocPatternChange(){
  const pattern=document.getElementById('edoc-pattern').value;
  const box=document.getElementById('box-edoc-contract');
  const hint=document.getElementById('edoc-contract-hint');
  if(pattern==='پیمانکاری'){
    box.style.display='block';
    hint.style.display='none';
  }else{
    box.style.display='none';
    hint.style.display='block';
  }
}
function saveElectronicDocToPending(){
  const pattern=document.getElementById('edoc-pattern').value;
  const contractId=document.getElementById('edoc-contract-id').value.trim();
  if(pattern==='پیمانکاری'&&!contractId){
    alert('برای الگوی «قرارداد پیمانکاری»، وارد کردن «شناسه یکتای ثبت قرارداد» اجباری است.');
    return;
  }
  const items=[];
  const rows=document.querySelectorAll('#invoice-items-table-body tr');
  for(let idx=0;idx<rows.length;idx++){
    const intEl=document.querySelector(`.edoc-row-internal[data-row="${idx}"]`);
    const offEl=document.querySelector(`.edoc-row-official[data-row="${idx}"]`);
    const row=rows[idx],sel=row?.querySelector('.row-product-select'),prod=getMyProducts().find(x=>x.id===sel?.value)||{};const offVal=(prod.official_id||offEl?.value||'').trim();
    if(!offVal){
      alert(`«شناسه کالا/خدمت» برای ردیف ${toPersianDigits(idx+1)} اجباری است.`);
      return;
    }
    items.push({internalId:String(prod.code||intEl?.value||'').trim(),officialId:offVal});
  }
  const p={
    uniqueNumber:document.getElementById('edoc-unique-number').value.trim(),
    taxNumber:document.getElementById('edoc-tax-number').value.trim(),
    issueDateTime:document.getElementById('edoc-issue-datetime').value.trim(),
    originalDate:document.getElementById('edoc-original-date').value.trim(),
    originalNumber:document.getElementById('edoc-original-number').value.trim(),
    kind:document.getElementById('edoc-kind').value,
    pattern:pattern,
    contractId:contractId,
    items:items
  };
  window.pendingElectronicDoc=p;
  document.getElementById('edoc-status').innerText='✓ اطلاعات سند الکترونیکی ذخیره شد. با ثبت فاکتور، سند نیز ذخیره می‌شود.';
  closeElectronicDocModal();
}

function invoiceCreatesAccountingEntry(kind){return kind==='formal'||kind==='non_formal';}

function invoiceLogicalRoot(inv){
 if(!inv)return null;
 const rows=getMyInvoices(),seen=new Set();let current=inv;
 while(current?.correctsInvoiceId&&!seen.has(current.id)){
  seen.add(current.id);const parent=rows.find(x=>x.id===current.correctsInvoiceId);
  if(!parent)break;current=parent;
 }
 return current;
}
function invoiceVisibleNumber(inv){return invoiceLogicalRoot(inv)?.number||inv?.number||'';}
function invoiceVisibleRecords(){
 const active=typeof afCompanyId==='function'?afCompanyId():getMySettings().default_company_id;
 if(!active||!getMyCompanies().some(c=>c.id===active))return [];
 const all=getMyInvoices(),children=new Set(all.map(x=>x.correctsInvoiceId).filter(Boolean));
 return all.filter(x=>x.companyId===active&&!children.has(x.id));
}
function invoiceCurrentVisible(invId){
 const all=getMyInvoices();let current=all.find(x=>x.id===invId);
 if(!current)return null;
 const seen=new Set();
 while(current&&!seen.has(current.id)){
  seen.add(current.id);const next=all.filter(x=>x.correctsInvoiceId===current.id)
   .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0];
  if(!next)break;current=next;
 }
 return current;
}
function invoicePrintView(record){
 if(!record)return null;
 const current=invoiceCurrentVisible(record.id)||record;
 return {...current,number:invoiceVisibleNumber(current)};
}
let finoraSaleAmendmentId='';
function beginInvoiceAmendment(id){
 const source=invoiceCurrentVisible(id);
 if(!source)return alert('فاکتور پیدا نشد.');
 try{
  invoicePilotCorrectionEligible(source);
  finoraSaleAmendmentId=source.id;
  editInvoice(source.id,true);
 }catch(e){finoraSaleAmendmentId='';alert(e.message)}
}
async function commitInvoiceSeamlessAmendment(id,changes){
 if(!requireWrite())throw new Error('مجوز اصلاح ندارید.');
 const current=invoiceCurrentVisible(id),root=invoiceLogicalRoot(current);
 if(!current||current.id!==id||!root)throw new Error('نسخه جاری سند با درخواست ویرایش مطابقت ندارد.');
 invoicePilotCorrectionEligible(current);
 if(changes.companyId!==current.companyId||changes.kind!==current.kind||changes.number!==root.number)
  throw new Error('شماره اصلی، نوع سند و شرکت را در اصلاح سند قطعی تغییر ندهید.');
 if(!Number.isFinite(changes.grandTotal)||changes.grandTotal<=0||!changes.items?.length)
  throw new Error('مبلغ و اقلام فاکتور معتبر نیست.');
 // Zero accounting writes occurred when the employee merely opened the form.
 const idNew=await reopenPostedInvoiceAsDraft(id,'اصلاح اطلاعات فاکتور در دوره پایلوت');
 const copy=getMyInvoices().find(x=>x.id===idNew);
 if(!copy)throw new Error('فاکتور اصلاح‌شده بارگذاری نشد.');
 Object.assign(copy,changes,{number:copy.number,documentStatus:'draft',accountingStatus:'draft',
  electronicDoc:current.electronicDoc||null,documentVersion:Number(current.documentVersion||1)+1,
  correctsInvoiceId:current.id,correctionOriginalNumber:root.number,updatedAt:new Date().toISOString()});
 saveDatastore();
 await invoicePilotAwaitSync(['invoices|'+idNew]);
 await finalizeInvoiceDocument(idNew);
 finoraSaleAmendmentId='';
 cancelInvoiceEdit();refreshAllSurfaces();
 return idNew;
}

function invoiceDocumentStatus(inv){
  if(!inv)return 'unknown';
  const linked=typeof jeSourceVoucher==='function'?jeSourceVoucher(inv):null;
  if(linked?.status==='reversed'||inv.accountingStatus==='reversed'||inv.documentStatus==='reversed')return 'reversed';
  if(linked?.status==='posted'||inv.journalVoucherId||inv.accountingStatus==='posted'||inv.documentStatus==='posted')return 'posted';
  if(inv.documentStatus==='draft'||inv.accountingStatus==='draft')return 'draft';
  if(invoiceCreatesAccountingEntry(inv.kind))return 'legacy_review';
  return 'operational';
}
function invoiceDocumentStatusLabel(inv){
  return ({posted:'قطعی',draft:'پیش‌نویس قابل ویرایش',reversed:'برگشت‌شده',legacy_review:'قدیمی — نیازمند تطبیق',operational:'سند عملیاتی',unknown:'نامشخص'})[invoiceDocumentStatus(inv)]||'نامشخص';
}
function invoiceMayEdit(inv){
  return !!inv&&invoiceDocumentStatus(inv)==='draft'||!!inv&&invoiceDocumentStatus(inv)==='operational';
}
// Stage 3.2: guarded, opt-in FINORA sale source posting.
// No browser-created posted lines/numbers and no mutation of posted source.
const finoraSaleServerInFlight=new Map();
function finoraStage3SaleV1Valid(source){
 if(source?.currencyCode!=='IRR'||(getMySettings().currency_mode||'rial')!=='rial')
  throw new Error('این قرارداد فقط واحد ریال را می‌پذیرد؛ تبدیل ارز یا تومان تصویب نشده است.');
 if(source.accountingVersion!==1||!['formal','non_formal'].includes(source.kind)||
  !['credit','cash'].includes(source.paymentMethod)||
  !['none','with_vat'].includes(source.vatMode))
  throw new Error('قرارداد مالی فروش نسخه ۱ برای این پیش‌نویس معتبر نیست.');
 for(const k of ['subtotal','discount','discountInput','vat','vatRate','grandTotal']){
  if(!Number.isSafeInteger(source[k])||source[k]<0)
   throw new Error('مبلغ یا نرخ سند مالی باید عدد صحیح معتبر باشد.');
 }
 if(!Array.isArray(source.items)||source.items.length===0||
  source.items.some(x=>!Number.isSafeInteger(x.qty)||x.qty<=0||
   !Number.isSafeInteger(x.price)||x.price<0||
   !Number.isSafeInteger(x.lineTotal)||x.lineTotal!==x.qty*x.price))
  throw new Error('مقدار یا قیمت ردیف فروش با قرارداد مالی ریالی سازگار نیست.');
}
async function finoraStage3SyncSourceOnly(source){
 const key='invoices|'+source.id;
 const payload=stripOwner(source),snapshot=JSON.stringify(payload);
 let deadline=Date.now()+8000;
 while(syncRunning&&Date.now()<deadline)
  await new Promise(resolve=>setTimeout(resolve,100));
 if(syncRunning)throw new Error('همگام‌سازی دیگری در جریان است؛ ابتدا وضعیت را بررسی کنید.');
 if(syncSnap.get(key)===snapshot)return;
 const expected=versionSnap.get(key)||0;
 if(!Number.isSafeInteger(expected)||expected<0)
  throw new Error('نسخه معتبر پیش‌نویس فروش مشخص نیست.');
 const {data,error}=await sb.rpc('finora_sync_records_v2',{
  p_upserts:[{collection:'invoices',id:source.id,data:payload,expected_version:expected}],
  p_deletes:[]
 });
 if(error)throw new Error('ثبت پیش‌نویس روی سرور تأیید نشد: '+error.message);
 const ack=(data?.upserts||[]).find(x=>x.collection==='invoices'&&x.id===source.id);
 if(!Number.isSafeInteger(Number(ack?.version))||Number(ack.version)<1)
  throw new Error('نسخه نهایی پیش‌نویس از سرور دریافت نشد.');
 syncSnap.set(key,snapshot);versionSnap.set(key,Number(ack.version));
}
async function finoraStage3FinalizeSaleServer(source){
 if(finoraSaleServerInFlight.has(source.id))return finoraSaleServerInFlight.get(source.id);
 const job=(async()=>{
  if(typeof navigator!=='undefined'&&navigator.onLine===false)
   throw new Error('قطعی‌سازی سروری نیازمند اتصال اینترنت است؛ پیش‌نویس محفوظ است.');
  finoraStage3SaleV1Valid(source);
  const fy=jeFiscalForDate(source.date);
  if(!fy||fy.status==='locked'||fy.companyId&&fy.companyId!==source.companyId)
   throw new Error('سال مالی باز و هم‌شرکت برای این فاکتور موجود نیست.');
  // Existing unsaved nonfinancial work is NOT flushed or discarded here.
  await finoraStage3SyncSourceOnly(source);
  const voucherId='JVS_'+source.id;
  const params={p_organization_id:finoraManualOrg(),
   p_voucher_id:voucherId,p_source_collection:'invoices',p_source_id:source.id,
   p_header:{companyId:source.companyId,fiscalYearId:fy.id,
    date:source.date,sourceType:'sale',sourceId:source.id,
    sourceVersion:String(source.accountingVersion)},p_lines:null};
  let timer,result;
  try{
   const out=await Promise.race([
    sb.rpc('finora_journal_autopost',params),
    new Promise((_,reject)=>{
     timer=setTimeout(()=>reject(new Error('FINORA_STAGE3_POST_TIMEOUT')),12000);
    })
   ]);
   if(out.error)throw new Error(out.error.message||'سرور ثبت فروش را رد کرد.');
   result=out.data;
  }catch(e){
   // Unknown acknowledgement: same deterministic voucher ID, targeted read
   // only. Never create a second financial voucher or globally pullAll().
   try{
    const known=await finoraManualReload(voucherId);
    if(known?.status==='posted'){
     refreshAllSurfaces();return known.id;
    }
   }catch(readError){console.warn('Stage3 targeted source recovery failed',readError);}
   throw new Error('وضعیت قطعی‌سازی فروش نامشخص است؛ پیش از تلاش دوباره فقط سند متناظر را بررسی کنید: '+e.message);
  }finally{if(timer)clearTimeout(timer);}
  const posted=result?.voucher;
  if(posted?.status!=='posted'||!posted.id||!Number.isSafeInteger(Number(result.contractVersion)))
   throw new Error('سرور پاسخ قطعی و نسخه قرارداد مالی را تأیید نکرد.');
  const local=await finoraManualReload(posted.id);
  if(local?.status!=='posted'||local.sourceId!==source.id||
   local.sourceType!=='sale'||local.companyId!==source.companyId)
   throw new Error('تطبیق سند قطعی فروش با منبع تأیید نشد.');
  refreshAllSurfaces();return posted.id;
 })().finally(()=>finoraSaleServerInFlight.delete(source.id));
 finoraSaleServerInFlight.set(source.id,job);
 return job;
}

async function finalizeInvoiceDocument(invoiceId){
  if(!requireWrite()||!currentUser)throw new Error('مجوز قطعی‌سازی ندارید.');
  const inv=getMyInvoices().find(i=>i.id===invoiceId);
  if(!inv||inv.ownerUserId!==currentUser.id)throw new Error('فاکتور برای این حساب یافت نشد.');
  if(!invoiceCreatesAccountingEntry(inv.kind))throw new Error('این سند عملیاتی قابلیت قطعی‌سازی حسابداری فروش ندارد.');
  const status=invoiceDocumentStatus(inv);
  if(status==='posted')return inv.journalVoucherId;
  if(status!=='draft')throw new Error('فقط پیش‌نویس جدید و معتبر قابل قطعی‌سازی است؛ اسناد قدیمی ابتدا باید تطبیق داده شوند.');
  const activeCompany=typeof afCompanyId==='function'?afCompanyId():getMySettings().default_company_id;
  if(!activeCompany||inv.companyId!==activeCompany)throw new Error('ابتدا شرکت ثبت‌کننده فاکتور را در سربرگ انتخاب کنید.');
  if(!Array.isArray(inv.items)||!inv.items.length||!Number.isFinite(inv.grandTotal)||inv.grandTotal<=0)throw new Error('ردیف‌ها و مبلغ فاکتور معتبر نیست.');
  // The server owns posting under ENFORCE; legacy off/audit path is unchanged.
  // Always refresh authoritative mode, never rely on stale browser flags.
  const stage3Mode=await finoraManualMode();
  if(stage3Mode==='enforce')return finoraStage3FinalizeSaleServer(inv);
  // Legacy mode retains the existing draft/posted accounting interaction.
  const v=jePostSourceRecord('sale',inv);
  inv.documentStatus='posted';
  inv.documentPostedAt=v.postedAt||new Date().toISOString();
  inv.documentPostedBy=currentUser.id;
  inv.documentVersion=Number(inv.documentVersion||1);
  if(typeof syncProductDefaultPrices==='function')syncProductDefaultPrices(inv.items,'sale');
  saveDatastore();
  // Only report financial finalization as successful after the atomic sync RPC has
  // acknowledged both the source invoice and its voucher on the server.
  if(typeof runSync==='function'&&typeof syncSnap!=='undefined'){
    await runSync();
    const deadline=Date.now()+20000;
    let saved=false;
    while(Date.now()<deadline){
      const savedInvoice=getMyInvoices().find(x=>x.id===invoiceId);
      saved=!syncRunning&&!syncPending&&
        syncSnap.has('journalVouchers|'+v.id)&&syncSnap.has('invoices|'+invoiceId)&&
        savedInvoice?.journalVoucherId===v.id&&invoiceDocumentStatus(savedInvoice)==='posted';
      if(saved)break;
      if(syncFailCount>0)break;
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    if(!saved)throw new Error('تأیید ذخیره قطعی از سرور دریافت نشد. وضعیت را دوباره بارگذاری و بررسی کنید.');
  }
  refreshAllSurfaces();
  return v.id;
}
async function finalizeInvoiceDocumentUi(id){
  const inv=getMyInvoices().find(i=>i.id===id);
  if(!inv||invoiceDocumentStatus(inv)!=='draft')return alert('فقط پیش‌نویس قابل قطعی‌سازی است.');
  if(!confirm('فاکتور '+(inv.number||'')+' قطعی و در دفترکل ثبت شود؟ پس از آن اصلاح مستقیم ممکن نیست.'))return;
  try{await finalizeInvoiceDocument(id);alert('فاکتور و سند حسابداری روی سرور قطعی شد.');renderDocumentManagement();}
  catch(e){alert('قطعی‌سازی تأیید نشد: '+e.message)}
}

// Pilot only: a posted sale is NEVER turned back into a mutable posted record.
// Compensate the original posting and create a new, traceable, editable invoice.
function invoicePilotCorrectionEligible(inv){
 if(!inv||inv.ownerUserId!==currentUser?.id||!invoiceCreatesAccountingEntry(inv.kind))throw new Error('فاکتور فروش معتبر برای حساب جاری انتخاب نشده است.');
 if(inv.companyId!==afCompanyId())throw new Error('شرکت فعلی با سند مطابقت ندارد.');
 if(invoiceDocumentStatus(inv)!=='posted')throw new Error('فقط فاکتور قطعی قابل برگشت به موقت است.');
 const v=typeof jeActiveSourceVoucher==='function'?jeActiveSourceVoucher(inv):null;
 if(!v||v.sourceType!=='sale'||v.sourceId!==inv.id)throw new Error('سند حسابداری قطعی و متصل به این فاکتور یافت نشد؛ ابتدا سند را تطبیق دهید.');
 const fy=getMyFiscalYears().find(x=>x.id===v.fiscalYearId);
 const newFY=jeFiscalForDate(getJalaliNumeric());
 if(!fy||fy.status==='locked'||!newFY||newFY.status==='locked')throw new Error('اصلاح در سال مالی قفل‌شده یا بدون سال مالی باز مجاز نیست.');
 // Electronic tax references and settled receipts require their own controlled workflow.
 if(inv.electronicDoc)throw new Error('این فاکتور سند الکترونیکی مرتبط دارد؛ ابتدا وضعیت مالیاتی آن بررسی شود.');
 if(typeof getMyPayments==='function'&&getMyPayments().some(p=>p.invoiceId===inv.id||p.sourceInvoiceId===inv.id||p.relatedInvoiceId===inv.id))
  throw new Error('این فاکتور به دریافت/پرداخت متصل است؛ اصلاح ابتدا نیازمند تطبیق تسویه است.');
 return v;
}
function invoicePilotCorrectionNumber(inv){
 const initial=String(inv.number||inv.id).trim()+'-اصلاح';
 let n=1,number=initial+'-'+n;
 while(getMyInvoices().some(x=>x.companyId===inv.companyId&&String(x.number||'').trim()===number)){
  n++;number=initial+'-'+n;
  if(n>10000)throw new Error('ایجاد شماره نسخه اصلاحی یکتا ممکن نیست.');
 }
 return number;
}
async function invoicePilotAwaitSync(entries){
 if(typeof runSync!=='function'||typeof syncSnap==='undefined')return;
 await runSync();
 const deadline=Date.now()+20000;
 while(Date.now()<deadline){
  if(!syncRunning&&!syncPending&&entries.every(key=>syncSnap.has(key)))return;
  if(syncFailCount>0)break;
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 throw new Error('سرور هنوز تغییرات را تأیید نکرده است. بدون بررسی همگام‌سازی، عملیات را تکرار نکنید.');
}
async function reopenPostedInvoiceAsDraft(invoiceId,reason){
 if(!requireWrite())throw new Error('مجوز اصلاح ندارید.');
 const inv=getMyInvoices().find(x=>x.id===invoiceId);
 const v=invoicePilotCorrectionEligible(inv);
 const why=String(reason||'').trim();if(!why)throw new Error('دلیل برگشت سند الزامی است.');
 // Resolve number/clone before reversing, so validation failures do not touch posting.
 const number=invoicePilotCorrectionNumber(inv);
 const id=afId('INV'),now=new Date().toISOString();
 const draft={...inv,id,number,createdAt:now,updatedAt:now,documentStatus:'draft',accountingStatus:'draft',documentVersion:1,accountingVersion:1,
  correctsInvoiceId:inv.id,correctsVoucherId:v.id,correctionReason:why,
  correctionOriginalNumber:inv.number};
 for(const key of ['journalVoucherId','accountingPostedAt','documentPostedAt','documentPostedBy','postedAt','postedBy','reversalVoucherId'])delete draft[key];
 // jeReverse records a balanced linked reversal; historical source and lines stay immutable.
 const reversal=jeReverse(v.id,getJalaliNumeric(),why);
 draft.correctionReversalId=reversal.id;
 datastore.invoices.push(draft);saveDatastore();
 await invoicePilotAwaitSync(['journalVouchers|'+v.id,'journalVouchers|'+reversal.id,'invoices|'+draft.id]);
 refreshAllSurfaces();return draft.id;
}
async function cancelPostedInvoicePilot(invoiceId,reason){
 if(!requireWrite())throw new Error('مجوز ابطال ندارید.');
 const inv=getMyInvoices().find(x=>x.id===invoiceId);
 const v=invoicePilotCorrectionEligible(inv);
 const why=String(reason||'').trim();if(!why)throw new Error('دلیل ابطال الزامی است.');
 const reversal=jeReverse(v.id,getJalaliNumeric(),'ابطال پایلوت: '+why);
 await invoicePilotAwaitSync(['journalVouchers|'+v.id,'journalVouchers|'+reversal.id]);
 refreshAllSurfaces();return reversal.id;
}
function deleteInvoicePilotDraft(invoiceId){
 if(!requireWrite())throw new Error('مجوز حذف ندارید.');
 const inv=getMyInvoices().find(x=>x.id===invoiceId);
 if(!inv||inv.ownerUserId!==currentUser?.id||inv.companyId!==afCompanyId()||invoiceDocumentStatus(inv)!=='draft'||inv.journalVoucherId)
  throw new Error('فقط پیش‌نویس ثبت‌نشده همین شرکت قابل حذف است.');
 if(inv.electronicDoc)throw new Error('سند الکترونیکی مرتبط ابتدا باید بررسی شود.');
 if(typeof getMyPayments==='function'&&getMyPayments().some(p=>p.invoiceId===inv.id||p.sourceInvoiceId===inv.id||p.relatedInvoiceId===inv.id))
  throw new Error('این فاکتور ارجاع دریافت/پرداخت دارد و قابل حذف نیست.');
 datastore.invoices=datastore.invoices.filter(x=>x.id!==inv.id);
 saveDatastore();refreshAllSurfaces();return true;
}
function commitSaveInvoice(){
  if(!requireWrite())return;
  if(!currentUser)return;
  const myCompanies=getMyCompanies();
  const mySettings=getMySettings();
  const companySelect=document.getElementById('invoice-company-id');
  const selectedCompanyId=companySelect?companySelect.value:mySettings.default_company_id;
  const activeCompanyId=typeof afCompanyId==='function'?afCompanyId():mySettings.default_company_id;
  const sellerCompany=myCompanies.find(c=>c.id===activeCompanyId);
  if(!sellerCompany){alert('ابتدا شرکت فعال را در بخش تنظیمات انتخاب کنید.');return;}
  if(selectedCompanyId!==sellerCompany.id){alert('شرکت فاکتور با شرکت فعال در تنظیمات یکسان نیست.');return;}
  const editSource=getMyInvoices().find(i=>i.id===document.getElementById('edit-invoice-id')?.value);
  if(editSource&&editSource.companyId!==sellerCompany.id){
    alert('برای اصلاح این فاکتور، شرکت مربوطه را از تنظیمات انتخاب کنید.');return;
  }
  const companyId=sellerCompany.id;
  const companyName=sellerCompany.name;
  const contactSelect=document.getElementById('invoice-contact-id');
  const contactId=contactSelect?contactSelect.value:'';
  const contactName=contactSelect?.options[contactSelect.selectedIndex]?.text||'مشتری آزاد';
  let number=document.getElementById('invoice-number')?.value.trim()||('PINV-'+(getMyInvoices().length+31));
  const date=document.getElementById('invoice-date-input')?.value.trim()||getJalaliNumeric();
  const kind=document.getElementById('invoice-kind')?.value||'non_formal';
  const description=document.getElementById('invoice-desc-input')?.value.trim()||'';
  const paymentMethod=document.getElementById('invoice-payment-method')?.value||'cash';
  const paymentMethodLabel=paymentMethod==='credit'?'نسیه':'نقدی';
  const warehouseId=document.getElementById('invoice-warehouse-id')?.value||'';
  const editId=document.getElementById('edit-invoice-id')?.value;
  const previousDraft=getMyInvoices().find(i=>i.id===editId);
  // Old in-progress correction drafts show the original business number;
  // preserve their private unique storage number while updating them.
  if(previousDraft?.correctsInvoiceId&&invoiceDocumentStatus(previousDraft)==='draft'
     &&number===invoiceVisibleNumber(previousDraft))number=previousDraft.number;
  if(getMyInvoices().some(i=>i.id!==editId&&i.companyId===companyId&&String(i.number||'').trim()===number)&&!(finoraSaleAmendmentId===editId&&invoiceVisibleNumber(getMyInvoices().find(i=>i.id===editId))===number)){alert('شماره فاکتور برای این شرکت قبلاً ثبت شده است.');return;}
  if(kind==='non_formal'){document.getElementById('invoice-vat-mode').value='none';}

  const contractNumber=document.getElementById('invoice-contract-number')?.value.trim()||'';
  if(kind==='contract_statement'&&!contractNumber){
    alert('برای «صورت وضعیت پیمان»، وارد کردن شماره پیمان اجباری است.');
    return;
  }
  const projectSelect=document.getElementById('invoice-project-id');
  const projectRow=document.getElementById('box-invoice-project-row');
  const projectId=(projectRow&&projectRow.style.display!=='none'&&projectSelect)?projectSelect.value:'';
  const projectName=(projectId&&projectSelect)?(projectSelect.options[projectSelect.selectedIndex]?.text||''):'';

  const items=[];
  document.querySelectorAll('#invoice-items-table-body tr').forEach(tr=>{
    const sel=tr.querySelector('.row-product-select');
    const prodId=sel?sel.value:'';
    const prodName=sel?sel.options[sel.selectedIndex]?.text:'';
    const unit=tr.querySelector('.row-unit-input')?.value||'عدد';
    const qty=parseFloat(tr.querySelector('.row-quantity')?.value)||0;
    const price=parseFormattedNumber(tr.querySelector('.row-price')?.value);
    if(prodId&&qty>0){items.push({prodId,prodName,unit,qty,price,lineTotal:qty*price});}
  });
  if(items.length===0){alert('لطفاً حداقل یک ردیف کالا به فاکتور اضافه کنید.');return;}

  // بررسی سند الکترونیکی
  let edoc=null;
  if(kind==='formal'){
    const cb=document.getElementById('enable-electronic-doc');
    if(cb&&cb.checked){
      if(!window.pendingElectronicDoc){
        alert('برای صدور سند الکترونیکی، ابتدا باید اطلاعات سند را تکمیل و ذخیره کنید.');
        return;
      }
      edoc=window.pendingElectronicDoc;
      if(edoc.pattern==='پیمانکاری'&&!edoc.contractId){
        alert('برای الگوی «قرارداد پیمانکاری»، وارد کردن «شناسه یکتای ثبت قرارداد» اجباری است.');
        return;
      }
    }
  }

  const totals=recomputeTotals();
  const kindLabels={formal:'رسمی',non_formal:'غیررسمی',pre_invoice:'پیش‌فاکتور',contract_statement:'صورت وضعیت پیمان'};
  const cur=getCurrencyLabel();
  // SQL-v1 uses IRR; never infer a conversion rate from toman/custom display.
  const currencyCode=(mySettings.currency_mode||'rial')==='rial'?'IRR':'UNSUPPORTED_NON_RIAL';
  const vatMode=kind==='non_formal'?'none':(document.getElementById('invoice-vat-mode')?.value||'none');
  if(editId&&finoraSaleAmendmentId===editId){
    const changes={number,date,companyId,companyName,kind,kindLabel:kindLabels[kind],contactId,contactName,
      projectId,projectName,contractNumber,paymentMethod,paymentMethodLabel,warehouseId,
      subtotal:totals.subtotal,discount:totals.fixedDiscount,discountType:totals.discountType,
      discountInput:totals.discountInput,vat:totals.vatAmount,vatMode,vatType:totals.vatType,
      vatRate:totals.vatRate,grandTotal:totals.grandTotal,description,items,currencyLabel:cur,currencyCode,
      electronicDoc:edoc};
    const btn=document.getElementById('btn-save-invoice');if(btn)btn.disabled=true;
    void commitInvoiceSeamlessAmendment(editId,changes).then(()=>{
       alert('اصلاحات فاکتور '+number+' ذخیره و تأیید شد. چاپ از همین فاکتور امکان‌پذیر است.');
    }).catch(e=>{
       finoraSaleAmendmentId='';
       // If sync failed mid-correction, do not silently retry a reversal.
       cancelInvoiceEdit();refreshAllSurfaces();
       alert('اصلاح فاکتور تکمیل نشد؛ وضعیت سند را تازه‌سازی و بررسی کنید: '+e.message);
    }).finally(()=>{if(btn)btn.disabled=false;});
    return;
  }
  if(editId){
    const lockedExisting=getMyInvoices().find(i=>i.id===editId);
    if(!invoiceMayEdit(lockedExisting)){alert('این سند قطعی شده یا نیازمند تطبیق سوابق قدیمی است و قابل ویرایش مستقیم نیست.');return;}
    if(typeof jeGuardSourceMutation==='function'){try{jeGuardSourceMutation(lockedExisting,'فاکتور فروش');}catch(e){alert(e.message);return;}}
    const existingIndex=datastore.invoices.findIndex(i=>i.id===editId&&i.ownerUserId===currentUser.id);
    if(existingIndex!==-1){
      const prev=datastore.invoices[existingIndex];
      const finalEdoc=edoc?edoc:(prev.electronicDoc||null);
      datastore.invoices[existingIndex]={...prev,ownerUserId:currentUser.id,number,date,companyId,companyName,kind,kindLabel:kindLabels[kind],contactId,contactName,projectId,projectName,contractNumber,paymentMethod,paymentMethodLabel,warehouseId,subtotal:totals.subtotal,discount:totals.fixedDiscount,discountType:totals.discountType,discountInput:totals.discountInput,vat:totals.vatAmount,vatMode,vatType:totals.vatType,vatRate:totals.vatRate,grandTotal:totals.grandTotal,description,items,currencyLabel:cur,currencyCode,electronicDoc:finalEdoc,documentStatus:'draft',accountingStatus:'draft',documentVersion:Number(prev.documentVersion||1)+1,updatedAt:new Date().toISOString()};
      alert('فاکتور با موفقیت ویرایش شد.');
    }
    cancelInvoiceEdit();
  }else{
    const record={id:'INV_'+Date.now(),ownerUserId:currentUser.id,documentStatus:'draft',accountingStatus:'draft',documentVersion:1,accountingVersion:1,createdAt:new Date().toISOString(),number,date,companyId,companyName,kind,kindLabel:kindLabels[kind],contactId,contactName,projectId,projectName,contractNumber,paymentMethod,paymentMethodLabel,warehouseId,subtotal:totals.subtotal,discount:totals.fixedDiscount,discountType:totals.discountType,discountInput:totals.discountInput,vat:totals.vatAmount,vatMode,vatType:totals.vatType,vatRate:totals.vatRate,grandTotal:totals.grandTotal,description,items,currencyLabel:cur,currencyCode,electronicDoc:edoc};
    datastore.invoices.push(record);
    alert(invoiceCreatesAccountingEntry(kind)?'فاکتور به‌صورت پیش‌نویس ذخیره شد. از حسابداری ← مدیریت اسناد می‌توانید آن را بازبینی و قطعی کنید.':'سند عملیاتی ذخیره شد؛ ثبت حسابداری قطعی ایجاد نمی‌شود.');
    cancelInvoiceEdit();
    renderAndPrintDirect(record.id);
  }
  // Draft edits must not update the posted sales price defaults.
  window.pendingElectronicDoc=null;
  saveDatastore();
  refreshAllSurfaces();
}
function editInvoice(invId,allowPostedCorrection=false){
  const inv=getMyInvoices().find(i=>i.id===invId);
  if(!inv)return;
  if(!afCompanyId()||inv.companyId!==afCompanyId()){
    alert('برای مشاهده این فاکتور، ابتدا شرکت مربوطه را در تنظیمات فعال کنید.');return;
  }
  if(!invoiceMayEdit(inv)&&!(allowPostedCorrection&&invoiceDocumentStatus(inv)==='posted')){alert('فاکتور برای اصلاح در این وضعیت قابل دسترس نیست.');return;}
  switchView('view-invoices');
  document.getElementById('edit-invoice-id').value=inv.id;
  document.getElementById('invoice-form-title').innerText=`✏️ اصلاح فاکتور #${invoiceVisibleNumber(inv)}`;
  document.getElementById('btn-cancel-edit').style.display='inline-flex';
  document.getElementById('btn-save-invoice').innerText='💾 ذخیره تغییرات';
  document.getElementById('invoice-company-id').value=inv.companyId;
  document.getElementById('invoice-kind').value=inv.kind;
  document.getElementById('invoice-vat-mode').value=inv.vatMode||((inv.vat||0)>0?'with_vat':'none');
  document.getElementById('invoice-vat-type').value=inv.vatType||'percent';
  document.getElementById('invoice-vat-rate-input').value=inv.vatRate??10;
  document.getElementById('invoice-number').value=invoiceVisibleNumber(inv);
  document.getElementById('invoice-contact-id').value=inv.contactId;
  document.getElementById('invoice-date-input').value=inv.date;
  if(document.getElementById('invoice-payment-method'))document.getElementById('invoice-payment-method').value=inv.paymentMethod||'cash';if(document.getElementById('invoice-warehouse-id'))document.getElementById('invoice-warehouse-id').value=inv.warehouseId||p5DefaultWarehouse()?.id||'';
  document.getElementById('invoice-discount-type').value=inv.discountType||'fixed';
  document.getElementById('label-invoice-discount-value').innerText=(inv.discountType==='percent')?'درصد تخفیف (٪)':`مبلغ تخفیف (${getCurrencyLabel()})`;
  document.getElementById('invoice-discount-fixed').value=(inv.discountType==='percent')?(inv.discountInput||0):(inv.discount||0);
  document.getElementById('invoice-desc-input').value=inv.description||'';
  const contractInput=document.getElementById('invoice-contract-number');
  if(contractInput)contractInput.value=inv.contractNumber||'';
  handleInvoiceKindChange();
  if(typeof handleInvoiceContactChange==='function'){
    handleInvoiceContactChange();
    const projSel=document.getElementById('invoice-project-id');
    if(projSel&&inv.projectId)projSel.value=inv.projectId;
  }
  // بارگذاری سند الکترونیکی در صورت وجود
  window.pendingElectronicDoc=inv.electronicDoc||null;
  const cb=document.getElementById('enable-electronic-doc');
  if(cb){
    if(inv.kind==='formal'&&inv.electronicDoc){
      cb.checked=true;
      document.getElementById('edoc-status').innerText='✓ اطلاعات سند الکترونیکی قبلاً ذخیره شده است.';
    }else{
      cb.checked=false;
      document.getElementById('edoc-status').innerText='';
    }
  }
  const tbody=document.getElementById('invoice-items-table-body');
  tbody.innerHTML='';
  inv.items.forEach(it=>{
    addInvoiceItemRow(it.prodId,it.qty,it.price);
    const lastRow=tbody.lastElementChild;
    if(lastRow)lastRow.querySelector('.row-unit-input').value=it.unit||'عدد';
  });
  updateInvoiceItemRowNumbers();
  recomputeTotals();
}
function cancelInvoiceEdit(){
  finoraSaleAmendmentId='';
  document.getElementById('edit-invoice-id').value='';
  document.getElementById('invoice-form-title').innerText='صدور فاکتور جدید';
  document.getElementById('btn-cancel-edit').style.display='none';
  document.getElementById('btn-save-invoice').innerText='💾 ثبت فاکتور';
  document.getElementById('invoice-items-table-body').innerHTML='';
  document.getElementById('invoice-number').value='';
  document.getElementById('invoice-discount-type').value='fixed';
  document.getElementById('label-invoice-discount-value').innerText=`مبلغ تخفیف (${getCurrencyLabel()})`;
  document.getElementById('invoice-discount-fixed').value=0;
  document.getElementById('invoice-vat-type').value='percent';
  document.getElementById('invoice-desc-input').value='';
  if(document.getElementById('invoice-payment-method'))document.getElementById('invoice-payment-method').value='cash';
  const contractInput=document.getElementById('invoice-contract-number');
  if(contractInput)contractInput.value='';
  const contractBox=document.getElementById('box-invoice-contract-number');
  if(contractBox)contractBox.style.display='none';
  const projectRow=document.getElementById('box-invoice-project-row');
  if(projectRow)projectRow.style.display='none';
  window.pendingElectronicDoc=null;
  const cb=document.getElementById('enable-electronic-doc');
  if(cb)cb.checked=false;
  const st=document.getElementById('edoc-status');
  if(st)st.innerText='';
  addInvoiceItemRow();
  applyDefaultSettingsToForm();
}
function renderInvoices(){
  const tbody=document.getElementById('invoice-archive-table-body');
  if(!tbody)return;
  // Filtering is authoritative from Settings; no independent ALL/stale filter.
  const list=invoiceVisibleRecords();
  if(list.length===0){tbody.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px">هیچ فاکتوری ثبت نشده است.</td></tr>';return;}
  tbody.innerHTML=list.map(inv=>`
    <tr>
      <td><strong>#${esc(invoiceVisibleNumber(inv))}</strong></td>
      <td>${esc(inv.companyName||'—')}</td>
      <td>${esc(inv.contactName)}${inv.projectName?' <span class="badge badge-info">'+esc(inv.projectName)+'</span>':''}</td>
      <td><span class="badge ${inv.kind==='formal'?'badge-danger':(inv.kind==='contract_statement'?'badge-warning':'badge-success')}">${esc(inv.kindLabel)}</span></td>
      <td>${esc(inv.date)}</td>
      <td>${inv.grandTotal.toLocaleString('fa-IR')}<div class="af-hint">${esc(invoiceDocumentStatusLabel(inv))}</div></td>
      <td>
        <button class="btn btn-secondary btn-inline" style="padding:4px 8px;font-size:12px;min-height:30px" onclick="navigateShell('accounting','view-journal','documents')">▤ مدیریت سند</button>${invoiceMayEdit(inv)?` <button class="btn btn-secondary btn-inline" onclick="editInvoice('${inv.id}')">✏️ ویرایش</button>` : (invoiceDocumentStatus(inv)==='posted'?` <button class="btn btn-secondary btn-inline" onclick="beginInvoiceAmendment('${inv.id}')">✏️ اصلاح</button>`:'')}
        <button class="btn btn-secondary btn-inline" style="padding:4px 8px;font-size:12px;min-height:30px" onclick="renderAndPrintDirect('${inv.id}')">🖨️ چاپ</button>
        ${inv.electronicDoc?`<button class="btn btn-primary btn-inline" style="padding:4px 8px;font-size:12px;min-height:30px" onclick="printElectronicDoc('${inv.id}')">📄 سند مودیان</button>`:''}
      </td>
    </tr>`).join('');
}

function finoraEnsureInitialInvoiceRow(){const body=document.getElementById('invoice-items-table-body');if(body&&!body.querySelector('tr')&&!document.getElementById('edit-invoice-id')?.value)addInvoiceItemRow()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',finoraEnsureInitialInvoiceRow,{once:true});else finoraEnsureInitialInvoiceRow();
