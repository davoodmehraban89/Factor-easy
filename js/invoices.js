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
  let salesSum=0;let debtorsSum=0;
  const myInvoices=getMyInvoices();
  const myCheques=getMyCheques();
  const myCompanies=getMyCompanies();
  const mySettings=getMySettings();
  const activeCompId=mySettings.default_company_id||document.getElementById('invoice-company-id')?.value||(myCompanies[0]?.id);
  const filteredInvoices=activeCompId?myInvoices.filter(inv=>inv.companyId===activeCompId):myInvoices;
  const cur=getCurrencyLabel();
  filteredInvoices.forEach(inv=>{salesSum+=Number(inv.grandTotal||0);if(inv.paymentMethod==='credit')debtorsSum+=Number(inv.grandTotal||0);});
  const inboundSettlements=myCheques.filter(q=>q.direction==='inbound'&&q.status==='cleared'&&(!activeCompId||q.companyId===activeCompId||(!q.companyId&&myCompanies.length===1))).reduce((a,q)=>a+Number(q.amount||0),0);
  const appliedInbound=Math.min(debtorsSum,inboundSettlements);
  debtorsSum=Math.max(0,debtorsSum-appliedInbound);
  const salesEl=document.getElementById('kpi-sales-sum');
  const settledEl=document.getElementById('kpi-settled-sum');
  const debtorsEl=document.getElementById('kpi-debtors-sum');
  const chequesEl=document.getElementById('kpi-cheques-count');
  if(salesEl)salesEl.innerText=salesSum.toLocaleString('fa-IR')+' '+cur;
  if(settledEl)settledEl.innerText=(salesSum-debtorsSum).toLocaleString('fa-IR')+' '+cur;
  if(debtorsEl)debtorsEl.innerText=debtorsSum.toLocaleString('fa-IR')+' '+cur;
  if(chequesEl)chequesEl.innerText=myCheques.filter(c=>c.status==='registered').length.toLocaleString('fa-IR')+' فقره';
  const recentTbody=document.getElementById('dashboard-recent-table');
  if(recentTbody){
    if(filteredInvoices.length===0){recentTbody.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px">هیچ فاکتوری صادر نشده است.</td></tr>';return;}
    recentTbody.innerHTML=filteredInvoices.slice(-5).reverse().map(inv=>`
      <tr>
        <td><strong>#${esc(inv.number)}</strong></td>
        <td>${esc(inv.companyName||'—')}</td>
        <td>${esc(inv.contactName)}</td>
        <td><span class="badge ${inv.kind==='formal'?'badge-danger':(inv.kind==='contract_statement'?'badge-warning':'badge-success')}">${esc(inv.kindLabel)}</span></td>
        <td>${inv.vat>0?'با ارزش افزوده':'بدون مالیات'}</td>
        <td>${inv.grandTotal.toLocaleString('fa-IR')}</td>
        <td><button class="btn btn-secondary btn-inline" style="padding:4px 10px;font-size:12px" onclick="renderAndPrintDirect('${inv.id}')">🖨️ چاپ</button></td>
      </tr>`).join('');
  }
}
function onActiveCompanyFilterChange(){
  const activeCompId=document.getElementById('invoice-company-id').value;
  const filterSelect=document.getElementById('filter-invoice-company');
  if(filterSelect)filterSelect.value=activeCompId;
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
  const productOptions=myProducts.map(p=>`<option value="${p.id}" data-price="${esc(p.sale_price)}" data-unit="${esc(p.unit||'عدد')}" ${p.id===selectedProdId?'selected':''}>${esc(p.name)} ${esc(p.spec?'('+p.spec+')':'')}</option>`).join('');
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
          <div class="form-group" style="margin-bottom:6px"><label style="font-size:12px">شناسه کالا/خدمت داخلی</label><input type="text" class="form-control edoc-row-internal" data-row="${idx}" value="${esc(prod.internal_id||'')}" /></div>
          <div class="form-group" style="margin-bottom:6px"><label style="font-size:12px">شناسه کالا/خدمت <span style="color:var(--danger)">*</span></label><input type="text" class="form-control edoc-row-official" data-row="${idx}" value="" /></div>
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
        if(intEl)intEl.value=it.internalId||'';
        if(offEl)offEl.value=it.officialId||'';
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
    const offVal=offEl?offEl.value.trim():'';
    if(!offVal){
      alert(`«شناسه کالا/خدمت» برای ردیف ${toPersianDigits(idx+1)} اجباری است.`);
      return;
    }
    items.push({internalId:intEl?intEl.value.trim():'',officialId:offVal});
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

function commitSaveInvoice(){
  if(!requireWrite())return;
  if(!currentUser)return;
  const myCompanies=getMyCompanies();
  const mySettings=getMySettings();
  const companySelect=document.getElementById('invoice-company-id');
  const selectedCompanyId=companySelect?companySelect.value:mySettings.default_company_id;
  const sellerCompany=myCompanies.find(c=>c.id===selectedCompanyId)||myCompanies.find(c=>c.id===mySettings.default_company_id)||myCompanies[0];
  if(!sellerCompany){alert('لطفاً ابتدا حداقل یک شرکت در بخش تنظیمات ثبت فرمایید.');return;}
  const companyId=sellerCompany.id;
  const companyName=sellerCompany.name;
  const contactSelect=document.getElementById('invoice-contact-id');
  const contactId=contactSelect?contactSelect.value:'';
  const contactName=contactSelect?.options[contactSelect.selectedIndex]?.text||'مشتری آزاد';
  const number=document.getElementById('invoice-number')?.value.trim()||('PINV-'+(getMyInvoices().length+31));
  const date=document.getElementById('invoice-date-input')?.value.trim()||getJalaliNumeric();
  const kind=document.getElementById('invoice-kind')?.value||'non_formal';
  const description=document.getElementById('invoice-desc-input')?.value.trim()||'';
  const paymentMethod=document.getElementById('invoice-payment-method')?.value||'cash';
  const paymentMethodLabel=paymentMethod==='credit'?'نسیه':'نقدی';
  const editId=document.getElementById('edit-invoice-id')?.value;
  if(getMyInvoices().some(i=>i.id!==editId&&i.companyId===companyId&&String(i.number||'').trim()===number)){alert('شماره فاکتور برای این شرکت قبلاً ثبت شده است.');return;}
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
  if(editId){
    const existingIndex=datastore.invoices.findIndex(i=>i.id===editId&&i.ownerUserId===currentUser.id);
    if(existingIndex!==-1){
      const prev=datastore.invoices[existingIndex];
      const finalEdoc=edoc?edoc:(prev.electronicDoc||null);
      datastore.invoices[existingIndex]={...prev,ownerUserId:currentUser.id,number,date,companyId,companyName,kind,kindLabel:kindLabels[kind],contactId,contactName,projectId,projectName,contractNumber,paymentMethod,paymentMethodLabel,subtotal:totals.subtotal,discount:totals.fixedDiscount,discountType:totals.discountType,discountInput:totals.discountInput,vat:totals.vatAmount,vatType:totals.vatType,vatRate:totals.vatRate,grandTotal:totals.grandTotal,description,items,currencyLabel:cur,electronicDoc:finalEdoc};
      alert('فاکتور با موفقیت ویرایش شد.');
    }
    cancelInvoiceEdit();
  }else{
    const record={id:'INV_'+Date.now(),ownerUserId:currentUser.id,number,date,companyId,companyName,kind,kindLabel:kindLabels[kind],contactId,contactName,projectId,projectName,contractNumber,paymentMethod,paymentMethodLabel,subtotal:totals.subtotal,discount:totals.fixedDiscount,discountType:totals.discountType,discountInput:totals.discountInput,vat:totals.vatAmount,vatType:totals.vatType,vatRate:totals.vatRate,grandTotal:totals.grandTotal,description,items,currencyLabel:cur,electronicDoc:edoc};
    datastore.invoices.push(record);
    alert('فاکتور با موفقیت ثبت شد.');
    cancelInvoiceEdit();
    renderAndPrintDirect(record.id);
  }
  window.pendingElectronicDoc=null;
  saveDatastore();
  refreshAllSurfaces();
}
function editInvoice(invId){
  const inv=getMyInvoices().find(i=>i.id===invId);
  if(!inv)return;
  switchView('view-invoices');
  document.getElementById('edit-invoice-id').value=inv.id;
  document.getElementById('invoice-form-title').innerText=`✏️ ویرایش فاکتور #${inv.number}`;
  document.getElementById('btn-cancel-edit').style.display='inline-flex';
  document.getElementById('btn-save-invoice').innerText='💾 ذخیره تغییرات';
  document.getElementById('invoice-company-id').value=inv.companyId;
  document.getElementById('invoice-kind').value=inv.kind;
  document.getElementById('invoice-vat-mode').value=inv.vat>0?'with_vat':'none';
  document.getElementById('invoice-vat-type').value=inv.vatType||'percent';
  document.getElementById('invoice-vat-rate-input').value=inv.vatRate||10;
  document.getElementById('invoice-number').value=inv.number;
  document.getElementById('invoice-contact-id').value=inv.contactId;
  document.getElementById('invoice-date-input').value=inv.date;
  if(document.getElementById('invoice-payment-method'))document.getElementById('invoice-payment-method').value=inv.paymentMethod||'cash';
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
  const filterSelect=document.getElementById('filter-invoice-company');
  const selectedFilter=filterSelect?.value||document.getElementById('invoice-company-id')?.value||'ALL';
  let list=getMyInvoices();
  if(selectedFilter!=='ALL')list=list.filter(i=>i.companyId===selectedFilter);
  if(list.length===0){tbody.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px">هیچ فاکتوری ثبت نشده است.</td></tr>';return;}
  tbody.innerHTML=list.map(inv=>`
    <tr>
      <td><strong>#${esc(inv.number)}</strong></td>
      <td>${esc(inv.companyName||'—')}</td>
      <td>${esc(inv.contactName)}${inv.projectName?' <span class="badge badge-info">'+esc(inv.projectName)+'</span>':''}</td>
      <td><span class="badge ${inv.kind==='formal'?'badge-danger':(inv.kind==='contract_statement'?'badge-warning':'badge-success')}">${esc(inv.kindLabel)}</span></td>
      <td>${esc(inv.date)}</td>
      <td>${inv.grandTotal.toLocaleString('fa-IR')}</td>
      <td>
        <button class="btn btn-secondary btn-inline" style="padding:4px 8px;font-size:12px;min-height:30px" onclick="editInvoice('${inv.id}')">✏️ ویرایش</button>
        <button class="btn btn-secondary btn-inline" style="padding:4px 8px;font-size:12px;min-height:30px" onclick="renderAndPrintDirect('${inv.id}')">🖨️ چاپ</button>
        ${inv.electronicDoc?`<button class="btn btn-primary btn-inline" style="padding:4px 8px;font-size:12px;min-height:30px" onclick="printElectronicDoc('${inv.id}')">📄 سند مودیان</button>`:''}
      </td>
    </tr>`).join('');
}
