// ============== ماژول خرید (فاکتور خرید با مرکز هزینه/پروژه) — کاملاً مستقل، بدون نیاز به تغییر index.html ==============
(function(){
  if(typeof COLLS!=='undefined'&&COLLS.indexOf('purchases')<0)COLLS.push('purchases');

  function myPurchases(){
    if(!currentUser)return [];
    if(!Array.isArray(datastore.purchases))datastore.purchases=[];
    return datastore.purchases.filter(p=>p.ownerUserId===currentUser.id);
  }
  const $=id=>document.getElementById(id);
  const fmt=n=>Number(n||0).toLocaleString('fa-IR');

  function injectUI(){
    if($('view-purchases'))return;
    const sec=document.createElement('section');
    sec.id='view-purchases';sec.className='view-pane';
    sec.innerHTML=`
<div class="card no-print">
  <div class="finora-commercial-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
    <div><h2 style="font-size:17px" id="pur-form-title">صدور سند تجاری</h2><input type="hidden" id="pur-edit-id" value="" /></div>
    <div class="finora-commercial-actions" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><label class="btn btn-secondary btn-inline" style="min-height:34px;padding:4px 10px;font-size:12px">📥 ورود اقلام از اکسل<input type="file" style="display:none" accept=".xlsx,.xls" onchange="purImportExcel(event)" /></label><button type="button" class="btn btn-secondary btn-inline" onclick="finoraShowGuide('invoices')">؟ راهنما</button></div>
  </div>
  <div class="form-row" style="background:#f1f5f9;padding:12px;border-radius:10px;margin-bottom:14px">
    <div class="form-group" style="margin-bottom:0"><label>تاریخ</label><input type="text" id="pur-date" class="form-control" /></div>
    <div class="form-group" style="margin-bottom:0"><label>شماره فاکتور فروشنده</label><input type="text" id="pur-number" class="form-control" /></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>تأمین‌کننده (فروشنده)</label><select id="pur-supplier" class="form-control" onchange="purRefreshProjects()"></select></div>
    <div class="form-group"><label>پروژه <span style="color:var(--text-muted);font-weight:normal">(خرید بابت کدام پروژه؟)</span></label><select id="pur-costcenter" class="form-control"></select></div>
    <div class="form-group"><label>شماره پیمان / صورت وضعیت (اختیاری)</label><input type="text" id="pur-contract" class="form-control" /></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>نحوه تسویه خرید</label><select id="pur-payment-method" class="form-control"><option value="cash">نقدی / تسویه‌شده</option><option value="credit">نسیه / ایجاد بدهی</option></select></div><div class="form-group"><label>انبار ورود کالا</label><select id="pur-warehouse" class="form-control"></select></div>
  </div>
  <div class="table-responsive">
    <table id="pur-items-table" style="min-width:600px"><thead><tr style="background:#e2e8f0"><th style="width:36px">#</th><th>شرح کالا</th><th style="width:80px">واحد</th><th style="width:90px">مقدار</th><th style="width:150px">فی</th><th style="width:150px">مبلغ</th><th style="width:44px"></th></tr></thead><tbody id="pur-items-body"></tbody></table>
  </div>
  <button class="btn btn-secondary btn-inline" style="margin-top:10px;width:100%;border:1.5px dashed var(--primary);color:var(--primary);background:#eff6ff" onclick="purAddRow()">+ افزودن ردیف</button>
  <div class="form-row" style="background:#f1f5f9;padding:14px;border-radius:10px;margin-top:12px">
    <div class="form-group" style="background:#fff;padding:12px;border-radius:8px;border:1px solid var(--border);margin-bottom:0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px"><span>تخفیف (مبلغ)</span><input type="text" inputmode="decimal" id="pur-discount" class="form-control" style="width:140px;min-height:36px" value="0" oninput="handleMoneyInput(this);purRecalc()" /></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span>مالیات ارزش افزوده</span><select id="pur-vat-mode" class="form-control" style="width:100px;min-height:36px" onchange="purRecalc()"><option value="none">ندارد</option><option value="with_vat">دارد</option></select><input type="text" inputmode="decimal" id="pur-vat-rate" class="form-control" style="width:70px;min-height:36px" value="10" oninput="handleMoneyInput(this);purRecalc()" /></div>
    </div>
    <div class="form-group" style="background:#fff;padding:12px;border-radius:8px;border:1px solid var(--border);margin-bottom:0">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px"><span>جمع اقلام:</span><b id="pur-subtotal">۰</b></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px"><span>مالیات:</span><b id="pur-vat">۰</b></div>
      <div style="display:flex;justify-content:space-between;font-size:14px;border-top:1px solid #eee;padding-top:6px"><b style="color:var(--primary)">قابل پرداخت:</b><b id="pur-grand" style="color:var(--primary)">۰</b></div>
    </div>
  </div>
  <div class="form-group" style="margin-top:12px"><label>توضیحات</label><textarea id="pur-desc" class="form-control" rows="2"></textarea></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-success" id="pur-save-btn" onclick="purSave()">💾 ثبت فاکتور خرید</button><button class="btn btn-secondary" id="pur-cancel-edit" style="display:none" onclick="purCancelEdit()">انصراف از اصلاح</button></div>
</div>
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px"><h3 style="font-size:15px">دفتر فاکتورهای خرید</h3><b id="pur-total-all" style="font-size:13px"></b></div>
  <div class="table-responsive"><table><thead><tr><th>شماره</th><th>تاریخ</th><th>تأمین‌کننده</th><th>مرکز هزینه</th><th>پیمان</th><th>مبلغ</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody id="pur-list-body"></tbody></table></div>
</div>`;
    const main=document.querySelector('main.main-surface');
    const anchor=$('printable-invoice');
    if(main){anchor?main.insertBefore(sec,anchor):main.appendChild(sec);}
  }

  // A purchase can be corrected without rewriting its originally posted voucher.
  // Unlinked historical purchases are REVIEW-only, never silently relabeled draft.
  function purchaseDocumentStatus(p){
    if(!p)return 'unknown';
    const linked=typeof jeSourceVoucher==='function'?jeSourceVoucher(p):null;
    if(linked?.status==='reversed'||p.accountingStatus==='reversed')return 'reversed';
    if(linked?.status==='posted')return 'posted';
    if(linked?.status==='draft'||p.accountingStatus==='draft'||p.documentStatus==='draft')return 'draft';
    return 'legacy_review';
  }
  window.purchaseDocumentStatus=purchaseDocumentStatus;
  function purchaseLogicalRoot(p){
    if(!p)return null;const rows=myPurchases(),seen=new Set();let v=p;
    while(v.correctsPurchaseId&&!seen.has(v.id)){seen.add(v.id);const parent=rows.find(x=>x.id===v.correctsPurchaseId);if(!parent)break;v=parent;}
    return v;
  }
  function purchaseVisibleNumber(p){const v=purchaseLogicalRoot(p)||p;return v?.number||v?.temporaryNumber||'';}
  function purchaseCurrentVisible(id){
    const rows=myPurchases();let v=rows.find(x=>x.id===id),seen=new Set();
    while(v&&!seen.has(v.id)){seen.add(v.id);const next=rows.filter(x=>x.correctsPurchaseId===v.id)
       .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0];if(!next)break;v=next;}
    return v;
  }
  function purchaseVisibleRecords(){
    const active=typeof afCompanyId==='function'?afCompanyId():getMySettings().default_company_id;
    if(!active||!getMyCompanies().some(c=>c.id===active))return [];
    const rows=myPurchases(),parents=new Set(rows.map(p=>p.correctsPurchaseId).filter(Boolean));
    return rows.filter(p=>p.companyId===active&&!parents.has(p.id));
  }
  window.purchaseVisibleRecords=purchaseVisibleRecords;
  window.purchaseVisibleNumber=purchaseVisibleNumber;
  let editingPostedPurchaseId='';
  window.beginPurchaseAmendment=function(id){
    const p=purchaseCurrentVisible(id);
    try{if(!p)throw new Error('فاکتور خرید پیدا نشد.');purchasePilotEligibility(p.id);editingPostedPurchaseId=p.id;purEdit(p.id,true);}
    catch(e){editingPostedPurchaseId='';alert(e.message);}
  };
  async function purchaseSaveSeamless(id,payload){
    const p=purchaseCurrentVisible(id),root=purchaseLogicalRoot(p);
    if(!p||p.id!==id||!root)throw new Error('نسخه سند خرید تغییر کرده است.');
    purchasePilotEligibility(id);
    if(payload.companyId!==p.companyId||payload.number!==root.number)
      throw new Error('شرکت و شماره سند اصلی نباید در ویرایش خرید قطعی تغییر کند.');
    if(!Number.isFinite(payload.grandTotal)||payload.grandTotal<=0||!payload.items?.length)
      throw new Error('مبلغ و اقلام خرید نامعتبر است.');
    const newId=await returnPostedPurchaseAsDraft(id,'اصلاح فاکتور خرید در دوره پایلوت');
    const record=myPurchases().find(x=>x.id===newId);if(!record)throw new Error('نسخه سند اصلاحی پیدا نشد.');
    Object.assign(record,payload,{number:record.number,accountingStatus:'draft',documentStatus:'draft',
       correctsPurchaseId:id,correctionOriginalNumber:root.number,updatedAt:new Date().toISOString()});
    saveDatastore();await invoicePilotAwaitSync(['purchases|'+newId]);
    await finalizePurchasePilotDraft(newId);
    editingPostedPurchaseId='';purCancelEdit();refreshAllSurfaces();return newId;
  }

  function purchasePilotEligibility(id){
    if(!requireWrite()||!currentUser)throw new Error('مجوز اصلاح خرید ندارید.');
    const p=myPurchases().find(x=>x.id===id&&x.companyId===afCompanyId());
    if(!p||purchaseDocumentStatus(p)!=='posted')throw new Error('این فاکتور خرید قطعی و متصل به شرکت فعلی نیست.');
    const v=jeSourceVoucher(p);
    if(!v||v.sourceType!=='purchase'||v.sourceId!==p.id||v.status!=='posted')throw new Error('سند قطعی خرید و مرجع حسابداری آن تطبیق ندارد.');
    const fy=getMyFiscalYears().find(x=>x.id===v.fiscalYearId),currentFy=jeFiscalForDate(getJalaliNumeric());
    if(!fy||fy.status==='locked'||!currentFy||currentFy.status==='locked')throw new Error('سال مالی بسته یا قفل‌شده اجازه اصلاح ندارد.');
    if(getMyPayments().some(x=>x.invoiceType==='purchase'&&x.invoiceId===p.id))throw new Error('این خرید پرداخت مرتبط دارد؛ ابتدا تسویه آن تطبیق داده شود.');
    if(!Array.isArray(p.items)||!p.items.length||p.items.some(i=>!getMyProducts().some(prod=>prod.id===(i.prodId||i.productId))))
      throw new Error('اقلام این خرید با کالاهای فعلی تطبیق ندارند.');
    if(typeof productMovement!=='function')throw new Error('کنترل موجودی فعال نیست؛ بازگشت امن امکان‌پذیر نیست.');
    for(const i of p.items){
      const qty=Number(i.qty??i.quantity)||0;
      const stock=productMovement(i.prodId||i.productId).available;
      if(!Number.isFinite(stock)||stock+1e-8<qty)throw new Error('موجودی کافی برای برگشت این خرید وجود ندارد؛ ابتدا مصرف و حواله‌های انبار بررسی شوند.');
    }
    return {purchase:p,voucher:v};
  }
  function purchasePilotNumber(p){
    const start=String(p.number||p.id).trim()+'-اصلاح-';
    let n=1,number=start+n;
    while(myPurchases().some(x=>x.supplierId===p.supplierId&&x.companyId===p.companyId&&String(x.number||'').trim()===number)){
      if(++n>10000)throw new Error('شماره اصلاحی یکتا یافت نشد.');
      number=start+n;
    }
    return number;
  }
  window.returnPostedPurchaseAsDraft=async function(id,reason){
    const why=String(reason||'').trim();
    if(!why)throw new Error('دلیل اصلاح خرید الزامی است.');
    if(!requireWrite()||!currentUser)throw new Error('مجوز اصلاح خرید ندارید.');
    const p=myPurchases().find(x=>x.id===id&&x.companyId===afCompanyId());
    const v=jeSourceVoucher(p);
    if(!p||!v||v.sourceType!=='purchase'||v.sourceId!==p.id||v.status!=='posted')
      throw new Error('سند قطعی خرید و مرجع حسابداری آن تطبیق ندارد.');
    const effective=jeRpcEffectiveStatus(v);
    if(effective==='posted')purchasePilotEligibility(id);
    else if(effective!=='reversed')throw new Error('وضعیت برگشت خرید برای اصلاح قابل قبول نیست.');
    if(effective==='reversed'){
      const existing=myPurchases().find(x=>x.correctsPurchaseId===p.id&&x.correctionReversalId);
      if(existing){
        await invoicePilotAwaitSync(['journalVouchers|'+v.id,'journalVouchers|'+existing.correctionReversalId,'purchases|'+existing.id]);
        refreshAllSurfaces();return existing.id;
      }
    }
    const number=purchasePilotNumber(p),now=new Date().toISOString(),newId=afId('PUR');
    const draft={...p,id:newId,number,date:getJalaliNumeric(),documentStatus:'draft',accountingStatus:'draft',createdAt:now,updatedAt:now,
      accountingVersion:1,documentVersion:1,correctsPurchaseId:p.id,correctsVoucherId:v.id,correctionOriginalNumber:p.number,correctionReason:why};
    for(const k of ['journalVoucherId','accountingPostedAt','documentPostedAt','postedAt','postedBy','reversalVoucherId'])delete draft[k];
    // This is a balanced POSTED compensating entry; the old source is not rewritten.
    const reversal=await jeRpcReverse(v.id,getJalaliNumeric(),why);draft.correctionReversalId=reversal.id;
    datastore.purchases.push(draft);saveDatastore();
    await invoicePilotAwaitSync(['journalVouchers|'+v.id,'journalVouchers|'+reversal.id,'purchases|'+draft.id]);
    refreshAllSurfaces();
    return draft.id;
  };
  window.cancelPostedPurchasePilot=async function(id,reason){
    const why=String(reason||'').trim();
    if(!why)throw new Error('دلیل ابطال الزامی است.');
    if(!requireWrite()||!currentUser)throw new Error('مجوز ابطال خرید ندارید.');
    const p=myPurchases().find(x=>x.id===id&&x.companyId===afCompanyId()),v=jeSourceVoucher(p);
    if(!p||!v||v.sourceType!=='purchase'||v.sourceId!==p.id||v.status!=='posted')
      throw new Error('سند قطعی خرید و مرجع حسابداری آن تطبیق ندارد.');
    const effective=jeRpcEffectiveStatus(v);
    if(effective==='posted')purchasePilotEligibility(id);
    else if(effective!=='reversed')throw new Error('وضعیت برگشت خرید برای ابطال قابل قبول نیست.');
    const reversal=await jeRpcReverse(v.id,getJalaliNumeric(),'ابطال خرید پایلوت: '+why);
    await invoicePilotAwaitSync(['journalVouchers|'+v.id,'journalVouchers|'+reversal.id]);
    refreshAllSurfaces();return reversal.id;
  };
  window.finalizePurchasePilotDraft=async function(id){
    if(!requireWrite())throw new Error('مجوز قطعی‌سازی ندارید.');
    const p=myPurchases().find(x=>x.id===id&&x.companyId===afCompanyId());
    if(!p||purchaseDocumentStatus(p)!=='draft'||p.journalVoucherId)
      throw new Error('فقط پیش‌نویس خرید بدون سند قطعی قابل قطعی‌سازی است.');
    const fy=jeFiscalForDate(p.date);
    if(!fy||fy.status==='locked')throw new Error('تاریخ خرید در سال مالی باز نیست.');
    if(!p.supplierId||!p.items?.length||!Number.isFinite(p.grandTotal)||p.grandTotal<=0)
      throw new Error('اطلاعات تأمین‌کننده و مبلغ خرید نامعتبر است.');
    // Persist the purchase draft first; the server derives and posts the
    // accounting lines atomically. Generic sync only persists the source link.
    const voucher=await jeRpcAutoPost('purchase',id);
    const savedPurchase=myPurchases().find(x=>x.id===id);
    if(!savedPurchase||savedPurchase.journalVoucherId!==voucher.id||purchaseDocumentStatus(savedPurchase)!=='posted')
      throw new Error('ثبت سند حسابداری انجام شد اما ارتباط خرید و سند از سرور تأیید نشد؛ پیش از تکرار وضعیت را بررسی کنید.');
    if(typeof syncProductDefaultPrices==='function'&&syncProductDefaultPrices(savedPurchase.items,'purchase'))saveDatastore();
    refreshAllSurfaces();return voucher.id;
  };
  window.deletePurchasePilotDraft=function(id){
    if(!requireWrite())throw new Error('مجوز حذف ندارید.');
    const p=myPurchases().find(x=>x.id===id&&x.companyId===afCompanyId());
    if(!p||purchaseDocumentStatus(p)!=='draft'||p.accountingPostingPending)throw new Error('تنها پیش‌نویس بدون درخواست معلق قابل حذف است.');
    if(getMyPayments().some(x=>x.invoiceType==='purchase'&&x.invoiceId===id))throw new Error('خرید دارای تسویه است.');
    const org=await jeRpcAssertContext();
    const {error}=await sb.rpc('finora_delete_draft_source',{p_organization_id:org,p_collection:'purchases',p_source_id:id});
    if(error)throw error;
    await pullAll();refreshAllSurfaces();return true;
  };
  window.purReturnToDraftUi=async function(id){
    const why=prompt('علت برگشت خرید قطعی به موقت:','اصلاح خرید دوره پایلوت');
    if(why===null)return;
    if(!String(why).trim())return alert('دلیل اصلاح الزامی است.');
    if(!confirm('سند قطعی و سابقه خرید محفوظ می‌ماند؛ با سند معکوس، نسخه موقت جدید ساخته شود؟'))return;
    try{const newId=await returnPostedPurchaseAsDraft(id,why);alert('نسخه اصلاحی موقت ذخیره شد. اکنون اصلاح کنید و دوباره قطعی کنید.');purEdit(newId);}
    catch(e){alert(e.message);}
  };
  window.purCancelPostedUi=async function(id){
    const why=prompt('علت ابطال خرید قطعی:','ابطال در دوره پایلوت');
    if(why===null)return;
    if(!String(why).trim())return alert('دلیل ابطال الزامی است.');
    if(!confirm('خرید و سند قبلی پاک نمی‌شوند. یک سند حسابداری معکوس ثبت شود؟'))return;
    try{await cancelPostedPurchasePilot(id,why);alert('ابطال خرید با حفظ سابقه ثبت شد.');}
    catch(e){alert(e.message);}
  };
  window.purFinalizeUi=async function(id){
    const p=myPurchases().find(x=>x.id===id);
    if(!p||purchaseDocumentStatus(p)!=='draft')return alert('فقط پیش‌نویس خرید قابل قطعی‌سازی است.');
    if(!confirm('فاکتور خرید '+(p.number||'')+' قطعی و در دفترکل ثبت شود؟'))return;
    try{await finalizePurchasePilotDraft(id);alert('فاکتور خرید به‌صورت قطعی روی سرور ثبت شد.');}
    catch(e){alert('قطعی‌سازی تأیید نشد: '+e.message);}
  };
  window.purDeleteDraftUi=async function(id){
    if(!confirm('پیش‌نویس خرید حذف شود؟ اگر سند حسابداری موقت متصل باشد، آن سند هم هم‌زمان حذف و در لاگ ثبت می‌شود.'))return;
    try{await deletePurchasePilotDraft(id);}catch(e){alert(e.message);}
  };

  window.purAddRow=function(prodId,qty,price,unit){
    const tb=$('pur-items-body');if(!tb)return;
    const prods=getMyProducts();
    const opts=prods.map(p=>`<option value="${esc(p.id)}" data-price="${esc(p.buy_price||0)}" data-unit="${esc(p.unit||'عدد')}" data-search="${esc([p.code,p.name,p.spec,p.barcode,p.internal_id,p.official_id,p.category,p.subcategory].filter(Boolean).join(' ').toLowerCase())}" ${p.id===prodId?'selected':''}>${esc(p.name)} ${esc(p.spec?'('+p.spec+')':'')}</option>`).join('');
    const tr=document.createElement('tr');
    const pv=Number(price||0);
    tr.innerHTML=`<td class="pur-n" style="text-align:center"></td>
<td><select class="form-control pur-prod" onchange="purProdChange(this)"><option value="">-- انتخاب کالا --</option>${opts}</select></td>
<td><input type="text" class="form-control pur-unit" value="${esc(unit||'عدد')}" style="text-align:center" /></td>
<td><input type="number" class="form-control pur-qty" value="${qty||1}" min="0" oninput="purRecalc()" style="text-align:center" /></td>
<td><input type="text" inputmode="decimal" class="form-control pur-price" value="${pv?pv.toLocaleString('en-US'):''}" oninput="handleMoneyInput(this);purRecalc()" style="text-align:left" /></td>
<td class="pur-line" style="font-weight:bold;direction:ltr;text-align:left">۰</td>
<td><button class="btn btn-danger btn-inline" style="min-height:34px;padding:2px 8px" onclick="this.closest('tr').remove();purRecalc()">✕</button></td>`;
    tb.appendChild(tr);
    if(typeof finoraRefreshSearchableSelect==='function')finoraRefreshSearchableSelect(tr.querySelector('.pur-prod'));
    if(prodId&&(price===undefined||price===null))purProdChange(tr.querySelector('.pur-prod'));
    purRecalc();
  };
  window.purProdChange=function(sel){
    const tr=sel.closest('tr');const o=sel.options[sel.selectedIndex];
    const p=Number(o&&o.getAttribute('data-price')||0);
    tr.querySelector('.pur-price').value=p?p.toLocaleString('en-US'):'';
    const u=o&&o.getAttribute('data-unit');if(u)tr.querySelector('.pur-unit').value=u;
    purRecalc();
  };
  window.purRecalc=function(){
    let sub=0;
    document.querySelectorAll('#pur-items-body tr').forEach((tr,i)=>{
      const q=parseFloat(tr.querySelector('.pur-qty').value)||0;
      const p=parseFormattedNumber(tr.querySelector('.pur-price').value);
      const l=q*p;sub+=l;
      tr.querySelector('.pur-line').innerText=fmt(l);
      tr.querySelector('.pur-n').innerText=fmt(i+1);
    });
    const disc=Math.min(parseFormattedNumber($('pur-discount').value),sub);
    const after=Math.max(0,sub-disc);
    const vat=$('pur-vat-mode').value==='with_vat'?Math.round(after*parseFormattedNumber($('pur-vat-rate').value)/100):0;
    $('pur-subtotal').innerText=fmt(sub);$('pur-vat').innerText=fmt(vat);$('pur-grand').innerText=fmt(after+vat);