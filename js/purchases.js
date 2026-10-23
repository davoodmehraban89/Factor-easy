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
    if(p.accountingStatus==='draft'&&!p.journalVoucherId)return 'draft';
    return 'legacy_review';
  }
  window.purchaseDocumentStatus=purchaseDocumentStatus;
  function purchaseLogicalRoot(p){
    if(!p)return null;const rows=myPurchases(),seen=new Set();let v=p;
    while(v.correctsPurchaseId&&!seen.has(v.id)){seen.add(v.id);const parent=rows.find(x=>x.id===v.correctsPurchaseId);if(!parent)break;v=parent;}
    return v;
  }
  function purchaseVisibleNumber(p){return purchaseLogicalRoot(p)?.number||p?.number||'';}
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
    const {purchase:p,voucher:v}=purchasePilotEligibility(id),why=String(reason||'').trim();
    if(!why)throw new Error('دلیل اصلاح خرید الزامی است.');
    const number=purchasePilotNumber(p),now=new Date().toISOString(),newId=afId('PUR');
    const draft={...p,id:newId,number,date:getJalaliNumeric(),documentStatus:'draft',accountingStatus:'draft',createdAt:now,updatedAt:now,
      accountingVersion:1,documentVersion:1,correctsPurchaseId:p.id,correctsVoucherId:v.id,correctionOriginalNumber:p.number,correctionReason:why};
    for(const k of ['journalVoucherId','accountingPostedAt','documentPostedAt','postedAt','postedBy','reversalVoucherId'])delete draft[k];
    // This is a balanced POSTED compensating entry; the old source is not rewritten.
    const reversal=jeReverse(v.id,getJalaliNumeric(),why);draft.correctionReversalId=reversal.id;
    datastore.purchases.push(draft);saveDatastore();
    await invoicePilotAwaitSync(['journalVouchers|'+v.id,'journalVouchers|'+reversal.id,'purchases|'+draft.id]);
    refreshAllSurfaces();
    return draft.id;
  };
  window.cancelPostedPurchasePilot=async function(id,reason){
    const {voucher:v}=purchasePilotEligibility(id),why=String(reason||'').trim();
    if(!why)throw new Error('دلیل ابطال الزامی است.');
    const reversal=jeReverse(v.id,getJalaliNumeric(),'ابطال خرید پایلوت: '+why);
    await invoicePilotAwaitSync(['journalVouchers|'+v.id,'journalVouchers|'+reversal.id]);
    refreshAllSurfaces();return reversal.id;
  };
  // Stage 3.3 / test-branch only. Server owns the voucher and number for a
  // NEW purchase; the original financial source is never rewritten on post.
  const finoraStage3PurchaseInFlight=new Map();
  function finoraStage3PurchaseV1Valid(p){
    if(p.currencyCode!=='IRR'||(getMySettings().currency_mode||'rial')!=='rial')
      throw new Error('ثبت قطعی خرید فقط برای قرارداد ریالی مصوب است.');
    if(p.accountingVersion!==1||!['cash','credit'].includes(p.paymentMethod)||
       !['none','with_vat'].includes(p.vatMode)||!p.supplierId)
      throw new Error('قرارداد مالی خرید نسخه ۱ معتبر نیست.');
    if(!Array.isArray(p.items)||p.items.length===0||
       p.items.some(it=>!Number.isSafeInteger(it.qty)||it.qty<=0||
         !Number.isSafeInteger(it.price)||it.price<0||
         !Number.isSafeInteger(it.lineTotal)||it.lineTotal!==it.qty*it.price))
      throw new Error('مقدار یا قیمت اقلام خرید با قرارداد حسابداری سازگار نیست.');
    for(const key of ['subtotal','discount','discountInput','vat','vatRate','grandTotal']){
      if(!Number.isSafeInteger(p[key])||p[key]<0)
        throw new Error('مبلغ یا نرخ سند خرید باید عدد صحیح معتبر باشد.');
    }
    if(p.subtotal-p.discount<=0||p.grandTotal<=0)
      throw new Error('خالص خرید برای ثبت سند باید مثبت باشد.');
  }
  async function finoraStage3SyncPurchaseOnly(p){
    const key='purchases|'+p.id;
    const clean=stripOwner(p),snapshot=JSON.stringify(clean);
    const deadline=Date.now()+8000;
    while(syncRunning&&Date.now()<deadline)
      await new Promise(done=>setTimeout(done,100));
    if(syncRunning)throw new Error('همگام‌سازی دیگری در جریان است؛ وضعیت را بررسی کنید.');
    const version=versionSnap.get(key)||0;
    if(syncSnap.get(key)===snapshot&&version>0)return;
    if(!Number.isSafeInteger(version)||version<0)
      throw new Error('نسخه ثبت خرید روی سرور مشخص نیست.');
    const {data,error}=await sb.rpc('finora_sync_records_v2',{
      p_upserts:[{collection:'purchases',id:p.id,expected_version:version,data:clean}],
      p_deletes:[],p_organization_id:finoraManualOrg()
    });
    if(error)throw new Error('تأیید ذخیره پیش‌نویس خرید دریافت نشد: '+error.message);
    const ack=(data?.upserts||[]).find(x=>x.collection==='purchases'&&x.id===p.id);
    if(!Number.isSafeInteger(Number(ack?.version))||Number(ack.version)<1)
      throw new Error('سرور نسخه پیش‌نویس خرید را تأیید نکرد.');
    syncSnap.set(key,snapshot);versionSnap.set(key,Number(ack.version));
  }
  async function finoraStage3FinalizePurchaseServer(p){
    if(finoraStage3PurchaseInFlight.has(p.id))
      return finoraStage3PurchaseInFlight.get(p.id);
    const work=(async()=>{
      if(typeof navigator!=='undefined'&&navigator.onLine===false)
        throw new Error('قطعی‌سازی خرید به ارتباط فعال نیاز دارد؛ پیش‌نویس محفوظ است.');
      finoraStage3PurchaseV1Valid(p);
      const fy=jeFiscalForDate(p.date);
      if(!fy||fy.status==='locked'||(fy.companyId&&fy.companyId!==p.companyId))
        throw new Error('سال مالی باز و هم‌شرکت برای این خرید پیدا نشد.');
      await finoraStage3SyncPurchaseOnly(p);
      const voucherId='JVP_'+p.id;
      const args={p_organization_id:finoraManualOrg(),p_voucher_id:voucherId,
        p_source_collection:'purchases',p_source_id:p.id,
        p_header:{companyId:p.companyId,fiscalYearId:fy.id,date:p.date,
          sourceType:'purchase',sourceId:p.id,
          sourceVersion:String(p.accountingVersion)},p_lines:null};
      let timer,response;
      try{
        const {data,error}=await Promise.race([
          sb.rpc('finora_journal_autopost',args),
          new Promise((_,reject)=>{
            timer=setTimeout(()=>reject(new Error('FINORA_STAGE3_PURCHASE_TIMEOUT')),12000);
          })
        ]);
        if(error)throw new Error(error.message||'ثبت قطعی خرید از سرور رد شد.');
        response=data;
      }catch(e){
        // Unknown acknowledgement: only read the SAME deterministic voucher.
        // A second POST or blind full pull could duplicate monetary history.
        try{
          const prior=await finoraManualReload(voucherId);
          if(prior?.status==='posted'&&prior.sourceId===p.id&&
             prior.sourceType==='purchase'&&prior.companyId===p.companyId){
            refreshAllSurfaces();return prior.id;
          }
        }catch(readError){console.warn('Stage3 purchase targeted recovery failed',readError);}
        throw new Error('وضعیت ثبت قطعی خرید نامشخص است؛ قبل از تلاش مجدد فقط سند متناظر را بررسی کنید: '+e.message);
      }finally{if(timer)clearTimeout(timer);}
      const voucher=response?.voucher;
      if(voucher?.status!=='posted'||!voucher.id||
         !Number.isSafeInteger(Number(response.contractVersion)))
        throw new Error('تأیید قطعی‌سازی سروری خرید و قرارداد مالی دریافت نشد.');
      const confirmed=await finoraManualReload(voucher.id);
      if(confirmed?.status!=='posted'||confirmed.sourceId!==p.id||
         confirmed.sourceType!=='purchase'||confirmed.companyId!==p.companyId)
        throw new Error('سند قطعی خرید و شرکت منبع در سرور تطبیق ندارند.');
      refreshAllSurfaces();return voucher.id;
    })().finally(()=>finoraStage3PurchaseInFlight.delete(p.id));
    finoraStage3PurchaseInFlight.set(p.id,work);
    return work;
  }

  window.finalizePurchasePilotDraft=async function(id){
    if(!requireWrite())throw new Error('مجوز قطعی‌سازی ندارید.');
    const p=myPurchases().find(x=>x.id===id&&x.companyId===afCompanyId());
    if(!p||purchaseDocumentStatus(p)!=='draft'||p.journalVoucherId)
      throw new Error('تنها پیش‌نویس همین شرکت بدون سند قطعی قابل ثبت است.');
    // ENFORCE supports new purchase sources only. Corrective history needs
    // a separate atomic server reversal/amendment contract; never improvise it.
    const mode=await finoraManualMode();
    if(mode==='enforce'){
      if(p.correctsPurchaseId)
        throw new Error('ثبت اصلاحی خرید در حالت سروری به قرارداد مستقل نیاز دارد.');
      return finoraStage3FinalizePurchaseServer(p);
    }
    if(!p.correctsPurchaseId)
      throw new Error('قطعی‌سازی پیش‌نویس جدید خرید تنها از مسیر سروری مجاز است.');
    const fy=jeFiscalForDate(p.date);
    if(!fy||fy.status==='locked')throw new Error('تاریخ خرید در سال مالی باز نیست.');
    if(!p.supplierId||!p.items?.length||!Number.isFinite(p.grandTotal)||p.grandTotal<=0)
      throw new Error('اطلاعات تأمین‌کننده و مبلغ خرید نامعتبر است.');
    const voucher=jePostSourceRecord('purchase',p);p.documentStatus='posted';p.documentPostedAt=voucher.postedAt;
    saveDatastore();await invoicePilotAwaitSync(['journalVouchers|'+voucher.id,'purchases|'+id]);
    refreshAllSurfaces();return voucher.id;
  };
  window.deletePurchasePilotDraft=function(id){
    if(!requireWrite())throw new Error('مجوز حذف ندارید.');
    const p=myPurchases().find(x=>x.id===id&&x.companyId===afCompanyId());
    if(!p||purchaseDocumentStatus(p)!=='draft'||p.journalVoucherId)throw new Error('تنها پیش‌نویس بدون ثبت حسابداری قابل حذف است.');
    if(getMyPayments().some(x=>x.invoiceType==='purchase'&&x.invoiceId===id))throw new Error('خرید دارای تسویه است.');
    datastore.purchases=datastore.purchases.filter(x=>x.id!==id);saveDatastore();refreshAllSurfaces();return true;
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
    if(!p||purchaseDocumentStatus(p)!=='draft')return alert('فقط نسخه موقت اصلاحی قابل قطعی‌سازی است.');
    if(!confirm('فاکتور خرید اصلاحی '+(p.number||'')+' قطعی و در دفترکل ثبت شود؟'))return;
    try{await finalizePurchasePilotDraft(id);alert('نسخه اصلاحی خرید به‌صورت قطعی روی سرور ثبت شد.');}
    catch(e){alert('قطعی‌سازی تأیید نشد: '+e.message);}
  };
  window.purDeleteDraftUi=function(id){
    if(!confirm('پیش‌نویس خرید بدون سند حسابداری حذف شود؟'))return;
    try{deletePurchasePilotDraft(id);}catch(e){alert(e.message);}
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
    return {sub,disc,vat,grand:after+vat};
  };
  window.purSave=function(){
    if(!requireWrite()||!currentUser)return;
    const items=[];
    document.querySelectorAll('#pur-items-body tr').forEach(tr=>{
      const sel=tr.querySelector('.pur-prod');const prodId=sel.value;
      const qty=parseFloat(tr.querySelector('.pur-qty').value)||0;
      const price=parseFormattedNumber(tr.querySelector('.pur-price').value);
      if(prodId&&qty>0)items.push({prodId,prodName:sel.options[sel.selectedIndex].text,unit:tr.querySelector('.pur-unit').value||'عدد',qty,price,lineTotal:qty*price});
    });
    if(!items.length){alert('حداقل یک ردیف کالا وارد کنید.');return;}
    const supSel=$('pur-supplier');
    if(!supSel.value){alert('تأمین‌کننده را انتخاب کنید (در صورت نبودن، ابتدا در «طرف‌حساب‌ها» ثبت کنید).');return;}
    const ccSel=$('pur-costcenter');
    const t=purRecalc();
    if(!Array.isArray(datastore.purchases))datastore.purchases=[];
    const paymentMethod=$('pur-payment-method')?.value||'cash';
    const editId=$('pur-edit-id')?.value||'';
    let purNumber=$('pur-number').value.trim();
    const previousDraft=myPurchases().find(p=>p.id===editId);
    if(previousDraft?.correctsPurchaseId&&purchaseDocumentStatus(previousDraft)==='draft'
       &&purNumber===purchaseVisibleNumber(previousDraft))purNumber=previousDraft.number;
    if(purNumber&&myPurchases().some(p=>p.id!==editId&&p.supplierId===supSel.value&&String(p.number||'').trim()===purNumber)&&!(editingPostedPurchaseId===editId&&purchaseVisibleNumber(myPurchases().find(p=>p.id===editId))===purNumber)){alert('این شماره فاکتور برای تأمین‌کننده انتخاب‌شده قبلاً ثبت شده است.');return;}
    const activeCompanyId=afCompanyId();
    if(!activeCompanyId||!getMyCompanies().some(c=>c.id===activeCompanyId)){alert('شرکت فعال را در تنظیمات انتخاب کنید.');return;}
    if(editId&&myPurchases().find(p=>p.id===editId)?.companyId!==activeCompanyId){
      alert('برای اصلاح این فاکتور باید شرکت مربوطه را در تنظیمات فعال کنید.');return;
    }
    // Canonical monetary source fields are captured from the form, not guessed
    // from VAT amount or the displayed currency label after persistence.
    const vatMode=$('pur-vat-mode')?.value||'none';
    const vatRate=parseFormattedNumber($('pur-vat-rate')?.value||0);
    const discountInput=parseFormattedNumber($('pur-discount')?.value||0);
    const currencyCode=(getMySettings()?.currency_mode||'rial')==='rial'?'IRR':'UNSUPPORTED_NON_RIAL';
    const warehouseId=$('pur-warehouse')?.value||'',projectId=ccSel.value,projectName=projectId?ccSel.options[ccSel.selectedIndex].text:'';const payload={warehouseId,number:purNumber,date:$('pur-date').value.trim()||getJalaliNumeric(),companyId:activeCompanyId,supplierId:supSel.value,supplierName:supSel.options[supSel.selectedIndex].text,projectId,projectName,costCenterId:'',costCenterLabel:'',contractNumber:$('pur-contract').value.trim(),paymentMethod,paymentMethodLabel:paymentMethod==='credit'?'نسیه':'نقدی',items,subtotal:t.sub,discount:t.disc,discountType:'fixed',discountInput,vat:t.vat,vatMode,vatType:'percent',vatRate,currencyCode,grandTotal:t.grand,description:$('pur-desc').value.trim()};
    if(editId&&editingPostedPurchaseId===editId){
      const btn=$('pur-save-btn');if(btn)btn.disabled=true;
      void purchaseSaveSeamless(editId,payload).then(()=>{
        alert('اصلاحات فاکتور خرید '+purNumber+' ذخیره و تأیید شد.');
      }).catch(e=>{
        editingPostedPurchaseId='';purCancelEdit();refreshAllSurfaces();
        alert('اصلاح سند خرید تکمیل نشد؛ وضعیت را تازه‌سازی و بررسی کنید: '+e.message);
      }).finally(()=>{if(btn)btn.disabled=false;});
      return;
    }
    if(editId){
      const old=datastore.purchases.find(p=>p.id===editId&&p.ownerUserId===currentUser.id);
      if(!old){alert('فاکتور خرید پیدا نشد.');return;}
      if(typeof jeGuardSourceMutation==='function'){try{jeGuardSourceMutation(old,'فاکتور خرید');}catch(e){alert(e.message);return;}}
      Object.assign(old,payload);
      alert('فاکتور خرید اصلاح شد.');
    }else{
      const record={id:'PUR_'+Date.now(),ownerUserId:currentUser.id,accountingVersion:1,...payload};datastore.purchases.push(record);
      if(typeof jePostSourceRecord==='function'){try{jePostSourceRecord('purchase',record);}catch(e){datastore.purchases=datastore.purchases.filter(x=>x.id!==record.id);alert('فاکتور خرید ثبت نشد: '+e.message);return;}}
      alert('فاکتور خرید و سند حسابداری ثبت شد.');
    }
    // Editing an unposted correction draft must not reset real supplier prices.
    if(!editId&&typeof syncProductDefaultPrices==='function')syncProductDefaultPrices(items,'purchase');
    saveDatastore();
    purCancelEdit();
    refreshAllSurfaces();
  };
  window.purCancelEdit=function(){
    editingPostedPurchaseId='';
    if($('pur-edit-id'))$('pur-edit-id').value='';
    if($('pur-form-title'))$('pur-form-title').innerText='🛒 ثبت فاکتور خرید';
    if($('pur-save-btn'))$('pur-save-btn').innerText='💾 ثبت فاکتور خرید';
    if($('pur-cancel-edit'))$('pur-cancel-edit').style.display='none';
    if($('pur-items-body'))$('pur-items-body').innerHTML='';
    ['pur-number','pur-contract','pur-desc'].forEach(id=>{if($(id))$(id).value='';});
    if($('pur-discount'))$('pur-discount').value='0';
    if($('pur-vat-mode'))$('pur-vat-mode').value='none';
    if($('pur-vat-rate'))$('pur-vat-rate').value='10';
    if($('pur-payment-method'))$('pur-payment-method').value='cash';
    if($('pur-date'))$('pur-date').value=getJalaliNumeric();
    purAddRow();
  };
  window.purEdit=function(id,allowPostedCorrection=false){
    const p=myPurchases().find(x=>x.id===id);if(!p)return;
    if(!afCompanyId()||p.companyId!==afCompanyId()){alert('ابتدا شرکت مربوط به فاکتور را در تنظیمات فعال کنید.');return;}
    if(purchaseDocumentStatus(p)!=='draft'&&!(allowPostedCorrection&&purchaseDocumentStatus(p)==='posted')){alert('سند قطعی ابتدا از مدیریت اسناد به نسخه موقت اصلاحی تبدیل شود؛ اسناد قدیمی نیازمند تطبیق هستند.');return;}
    $('pur-edit-id').value=p.id;$('pur-form-title').innerText='✏️ اصلاح فاکتور خرید '+purchaseVisibleNumber(p);
    $('pur-save-btn').innerText='💾 ذخیره اصلاحات';$('pur-cancel-edit').style.display='inline-flex';
    $('pur-date').value=p.date||'';$('pur-number').value=purchaseVisibleNumber(p);$('pur-supplier').value=p.supplierId||'';purRefreshProjects();$('pur-costcenter').value=p.projectId||p.costCenterId||'';if($('pur-payment-method'))$('pur-payment-method').value=p.paymentMethod||'cash';if($('pur-warehouse'))$('pur-warehouse').value=p.warehouseId||p5DefaultWarehouse()?.id||'';$('pur-contract').value=p.contractNumber||'';$('pur-desc').value=p.description||'';$('pur-discount').value=(p.discount||0).toLocaleString('en-US');$('pur-vat-mode').value=p.vatMode||((p.vat||0)>0?'with_vat':'none');if(p.vatRate!==undefined&&p.vatRate!==null)$('pur-vat-rate').value=String(p.vatRate);
    $('pur-items-body').innerHTML='';(p.items||[]).forEach(it=>purAddRow(it.prodId,it.qty,it.price,it.unit));purRecalc();
    switchView('view-purchases');$('pur-form-title').scrollIntoView({behavior:'smooth',block:'center'});
  };
  window.purPrint=function(id){
    const source=myPurchases().find(x=>x.id===id);if(!source)return;
    if(!afCompanyId()||source.companyId!==afCompanyId()){alert('ابتدا شرکت مربوط به فاکتور را در تنظیمات فعال کنید.');return;}
    const current=purchaseCurrentVisible(id)||source,p={...current,number:purchaseVisibleNumber(current)};
    const cur=(typeof getCurrencyLabel==='function'?getCurrencyLabel():'ریال');
    const itemRows=(p.items||[]).map((it,i)=>`<tr><td>${(i+1).toLocaleString('fa-IR')}</td><td>${esc(it.prodName||'')}</td><td>${esc(it.unit||'')}</td><td>${Number(it.qty||0).toLocaleString('fa-IR')}</td><td>${fmt(it.price)}</td><td>${fmt(it.lineTotal)}</td></tr>`).join('');
    const w=window.open('','_blank','width=900,height=700');if(!w){alert('مرورگر پنجره چاپ را مسدود کرده است.');return;}
    w.document.write(`<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>فاکتور خرید ${esc(p.number||'')}</title><style>@page{size:A4 portrait;margin:10mm}body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#111}h2{text-align:center}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border:1px solid #555;padding:7px;text-align:center;font-size:12px}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;font-size:13px}.sum{margin-top:12px;text-align:left;line-height:2}</style></head><body><h2>فاکتور خرید</h2><div class="meta"><div><b>شماره:</b> ${esc(p.number||'—')}</div><div><b>تاریخ:</b> ${esc(p.date||'—')}</div><div><b>تأمین‌کننده:</b> ${esc(p.supplierName||'—')}</div><div><b>پروژه:</b> ${esc(p.projectName||p.costCenterLabel||'—')}</div><div><b>شماره پیمان:</b> ${esc(p.contractNumber||'—')}</div><div><b>نحوه تسویه:</b> ${esc(p.paymentMethodLabel||(p.paymentMethod==='credit'?'نسیه':'نقدی'))}</div></div><table><thead><tr><th>#</th><th>شرح</th><th>واحد</th><th>مقدار</th><th>فی</th><th>مبلغ</th></tr></thead><tbody>${itemRows}</tbody></table><div class="sum"><div>جمع اقلام: <b>${fmt(p.subtotal)} ${cur}</b></div><div>تخفیف: <b>${fmt(p.discount)} ${cur}</b></div><div>مالیات: <b>${fmt(p.vat)} ${cur}</b></div><div>قابل پرداخت: <b>${fmt(p.grandTotal)} ${cur}</b></div></div><p>${esc(p.description||'')}</p><script>window.onload=()=>{window.print();};<\/script></body></html>`);
    w.document.close();
    // Localize only visible print text; stored purchase IDs and the popup print script stay unchanged.
    if(typeof localizePrintTextNodes==='function')localizePrintTextNodes(w.document.body);
  };
  window.purDelete=function(id){
    const source=myPurchases().find(x=>x.id===id);if(!source)return;if(purchaseDocumentStatus(source)==='draft')return purDeleteDraftUi(id);if(purchaseDocumentStatus(source)!=='draft')return alert('فقط نسخه موقت بدون سابقه حسابداری قابل حذف است؛ سند قطعی را از مسیر ابطال قابل‌ردیابی اصلاح کنید.');if(typeof jeGuardSourceMutation==='function'){try{jeGuardSourceMutation(source,'فاکتور خرید');}catch(e){alert(e.message);return;}}if(typeof getMyPayments==='function'&&getMyPayments().some(p=>p.invoiceType==='purchase'&&p.invoiceId===id)){alert('برای این فاکتور پرداخت ثبت شده است؛ برای حفظ سابقه مالی ابتدا تخصیص پرداخت را اصلاح کنید.');return;}
    if(!requireWrite()||!confirm('این فاکتور خرید حذف شود؟'))return;
    datastore.purchases=datastore.purchases.filter(p=>!(p.id===id&&p.ownerUserId===currentUser.id));
    saveDatastore();refreshAllSurfaces();
  };
  window.purImportExcel=function(ev){
    if(!requireWrite())return;
    const f=ev.target.files[0];if(!f)return;if(f.size>5*1024*1024){ev.target.value='';alert('حجم فایل اکسل نباید بیشتر از ۵ مگابایت باشد.');return;}
    const rd=new FileReader();
    rd.onload=function(e){
      try{
        const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
        const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);if(rows.length>10000)throw new Error('too many rows');
        const prods=getMyProducts();let n=0;
        rows.forEach(r=>{
          const code=(r['کد کالا']||r['کد']||'').toString().trim();
          const name=(r['شرح']||r['نام کالا']||r['عنوان']||'').toString().trim();
          const qty=parseFormattedNumber(r['تعداد']||r['مقدار']||1)||1;
          const unit=(r['واحد']||'عدد').toString();
          const price=parseFormattedNumber(r['فی']||r['قیمت']||r['قیمت واحد']||0);
          if(!name&&!code)return;
          let p=prods.find(x=>(code&&x.code===code)||(name&&x.name===name));
          if(!p){p={id:'P_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),ownerUserId:currentUser.id,code:code||String(prods.length+1),name:name||code,spec:'',type:'good',unit,buy_price:price,sale_price:0,stock:0,internal_id:''};datastore.products.push(p);prods.push(p);}
          purAddRow(p.id,qty,price,unit);n++;
        });
        if(n){saveDatastore();alert(n+' ردیف از اکسل اضافه شد.');}else alert('ردیف معتبری پیدا نشد. ستون‌ها: کد کالا، شرح، تعداد، واحد، فی');
      }catch(err){alert('خطا در خواندن فایل اکسل!');}
      ev.target.value='';
    };
    rd.readAsArrayBuffer(f);
  };

  window.purRefreshProjects=function(){
    const sel=$('pur-supplier'),cc=$('pur-costcenter');if(!sel||!cc)return;const current=cc.value;let html='<option value="">بدون پروژه (هزینه عمومی)</option>';
    const projects=typeof getContactProjects==='function'?getContactProjects(sel.value):[];
    projects.filter(p=>(p.direction||'both')!=='sale').forEach(p=>{html+=`<option value="${esc(p.id)}">${esc((p.code?p.code+' — ':'')+p.name)}</option>`;(p.subprojects||[]).filter(s=>(s.direction||p.direction||'both')!=='sale').forEach(s=>{html+=`<option value="${esc(s.id)}">↳ ${esc(p.name)} / ${esc(s.name)}</option>`;});});
    cc.innerHTML=html;if(current&&[...cc.options].some(o=>o.value===current))cc.value=current;if(typeof finoraRefreshSearchableSelect==='function')finoraRefreshSearchableSelect(cc);
  };

  function render(){
    injectUI();
    if(!$('pur-supplier')||!currentUser)return;
    const contacts=getMyContacts();
    const suppliers=contacts.filter(c=>c.role==='supplier'||c.role==='both');
    const cur=$('pur-supplier').value;
    $('pur-supplier').innerHTML=suppliers.length?suppliers.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}${c.role==='both'?' (خرید و فروش)':' (تأمین‌کننده)'}</option>`).join(''):'<option value="">— تأمین‌کننده تعریف نشده —</option>';
    if(cur&&suppliers.some(c=>c.id===cur))$('pur-supplier').value=cur;
    purRefreshProjects();
    if(!$('pur-date').value)$('pur-date').value=getJalaliNumeric();
    if(!document.querySelector('#pur-items-body tr'))purAddRow();
    const list=purchaseVisibleRecords();let total=0;
    $('pur-list-body').innerHTML=list.length?list.map(p=>{
      const state=purchaseDocumentStatus(p),published=state==='posted',draft=state==='draft';
      if(published)total+=Number(p.grandTotal)||0;
      const label=({posted:'قطعی',draft:'موقت قابل اصلاح',reversed:'برگشت/ابطال‌شده',legacy_review:'قدیمی / نیازمند تطبیق'})[state]||'نامشخص';
      const id=esc(p.id);
      const actions=published?
        '<button class="btn btn-secondary btn-inline" onclick="beginPurchaseAmendment(\''+id+'\')">اصلاح</button> <button class="btn btn-danger btn-inline" onclick="purCancelPostedUi(\''+id+'\')">ابطال</button>':
        draft?'<button class="btn btn-secondary btn-inline" onclick="purEdit(\''+id+'\')">ویرایش موقت</button> <button class="btn btn-success btn-inline" onclick="purFinalizeUi(\''+id+'\')">قطعی‌سازی</button> <button class="btn btn-danger btn-inline" onclick="purDeleteDraftUi(\''+id+'\')">حذف موقت</button>':'';
      return '<tr><td>'+esc(purchaseVisibleNumber(p)||'—')+'</td><td>'+esc(p.date)+'</td><td>'+esc(p.supplierName)+'</td><td>'+esc(p.projectName||p.costCenterLabel||'—')+'</td><td>'+esc(p.contractNumber||'—')+'</td><td>'+fmt(p.grandTotal)+'</td><td>'+esc(label)+'</td><td>'+actions+' <button class="btn btn-secondary btn-inline" onclick="purPrint(\''+id+'\')">چاپ</button></td></tr>';
    }).join(''):'<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:20px">فاکتور خریدی ثبت نشده است.</td></tr>';
    $('pur-total-all').innerText=list.length?('جمع کل خریدها: '+fmt(total)):'';
  }

  // اتصال به چرخه‌ی به‌روزرسانی برنامه
  const oldRefresh=window.refreshAllSurfaces;
  window.refreshAllSurfaces=function(){oldRefresh.apply(this,arguments);try{render();}catch(e){console.error('purchases render',e);}};
  document.addEventListener('DOMContentLoaded',injectUI);
  injectUI();
})();
