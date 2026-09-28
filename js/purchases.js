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
    const menu=document.querySelector('.sidebar-menu');
    const expLi=menu&&menu.querySelector('[data-view="view-expenses"]');
    if(menu){
      const li=document.createElement('li');
      li.innerHTML='<a href="#" class="nav-link" data-view="view-purchases" onclick="switchView(\'view-purchases\');return false">🛒 فاکتور خرید</a>';
      if(expLi&&expLi.parentElement)menu.insertBefore(li,expLi.parentElement);else menu.appendChild(li);
    }
    const sec=document.createElement('section');
    sec.id='view-purchases';sec.className='view-pane';
    sec.innerHTML=`
<div class="card no-print">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
    <div><h2 style="font-size:17px" id="pur-form-title">🛒 ثبت فاکتور خرید</h2><input type="hidden" id="pur-edit-id" value="" /></div>
    <label class="btn btn-secondary btn-inline" style="min-height:34px;padding:4px 10px;font-size:12px">📥 ورود اقلام از اکسل<input type="file" style="display:none" accept=".xlsx,.xls" onchange="purImportExcel(event)" /></label>
  </div>
  <div class="form-row" style="background:#f1f5f9;padding:12px;border-radius:10px;margin-bottom:14px">
    <div class="form-group" style="margin-bottom:0"><label>تاریخ</label><input type="text" id="pur-date" class="form-control" /></div>
    <div class="form-group" style="margin-bottom:0"><label>شماره فاکتور فروشنده</label><input type="text" id="pur-number" class="form-control" /></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>تأمین‌کننده (فروشنده)</label><select id="pur-supplier" class="form-control" onchange="purRefreshProjects()"></select></div>
    <div class="form-group"><label>مرکز هزینه / پروژه <span style="color:var(--text-muted);font-weight:normal">(خرید بابت کدام پروژه؟)</span></label><select id="pur-costcenter" class="form-control"></select></div>
    <div class="form-group"><label>شماره پیمان / صورت وضعیت (اختیاری)</label><input type="text" id="pur-contract" class="form-control" /></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>نحوه تسویه خرید</label><select id="pur-payment-method" class="form-control"><option value="cash">نقدی / تسویه‌شده</option><option value="credit">نسیه / ایجاد بدهی</option></select></div>
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
  <div class="table-responsive"><table><thead><tr><th>شماره</th><th>تاریخ</th><th>تأمین‌کننده</th><th>مرکز هزینه</th><th>پیمان</th><th>مبلغ</th><th>عملیات</th></tr></thead><tbody id="pur-list-body"></tbody></table></div>
</div>`;
    const main=document.querySelector('main.main-surface');
    const anchor=$('printable-invoice');
    if(main){anchor?main.insertBefore(sec,anchor):main.appendChild(sec);}
  }

  window.purAddRow=function(prodId,qty,price,unit){
    const tb=$('pur-items-body');if(!tb)return;
    const prods=getMyProducts();
    const opts=prods.map(p=>`<option value="${esc(p.id)}" data-price="${esc(p.buy_price||0)}" data-unit="${esc(p.unit||'عدد')}" ${p.id===prodId?'selected':''}>${esc(p.name)} ${esc(p.spec?'('+p.spec+')':'')}</option>`).join('');
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
    const purNumber=$('pur-number').value.trim();
    if(purNumber&&myPurchases().some(p=>p.id!==editId&&p.supplierId===supSel.value&&String(p.number||'').trim()===purNumber)){alert('این شماره فاکتور برای تأمین‌کننده انتخاب‌شده قبلاً ثبت شده است.');return;}
    const payload={number:purNumber,date:$('pur-date').value.trim()||getJalaliNumeric(),supplierId:supSel.value,supplierName:supSel.options[supSel.selectedIndex].text,costCenterId:ccSel.value,costCenterLabel:ccSel.value?ccSel.options[ccSel.selectedIndex].text:'',contractNumber:$('pur-contract').value.trim(),paymentMethod,paymentMethodLabel:paymentMethod==='credit'?'نسیه':'نقدی',items,subtotal:t.sub,discount:t.disc,vat:t.vat,grandTotal:t.grand,description:$('pur-desc').value.trim()};
    if(editId){
      const old=datastore.purchases.find(p=>p.id===editId&&p.ownerUserId===currentUser.id);
      if(!old){alert('فاکتور خرید پیدا نشد.');return;}
      Object.assign(old,payload);
      alert('فاکتور خرید اصلاح شد.');
    }else{
      datastore.purchases.push({id:'PUR_'+Date.now(),ownerUserId:currentUser.id,...payload});
      alert('فاکتور خرید ثبت شد.');
    }
    saveDatastore();
    purCancelEdit();
    refreshAllSurfaces();
  };
  window.purCancelEdit=function(){
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
  window.purEdit=function(id){
    const p=myPurchases().find(x=>x.id===id);if(!p)return;
    $('pur-edit-id').value=p.id;$('pur-form-title').innerText='✏️ اصلاح فاکتور خرید '+(p.number||'');
    $('pur-save-btn').innerText='💾 ذخیره اصلاحات';$('pur-cancel-edit').style.display='inline-flex';
    $('pur-date').value=p.date||'';$('pur-number').value=p.number||'';$('pur-supplier').value=p.supplierId||'';purRefreshProjects();$('pur-costcenter').value=p.costCenterId||'';if($('pur-payment-method'))$('pur-payment-method').value=p.paymentMethod||'cash';$('pur-contract').value=p.contractNumber||'';$('pur-desc').value=p.description||'';$('pur-discount').value=(p.discount||0).toLocaleString('en-US');$('pur-vat-mode').value=(p.vat||0)>0?'with_vat':'none';
    $('pur-items-body').innerHTML='';(p.items||[]).forEach(it=>purAddRow(it.prodId,it.qty,it.price,it.unit));purRecalc();
    switchView('view-purchases');$('pur-form-title').scrollIntoView({behavior:'smooth',block:'center'});
  };
  window.purPrint=function(id){
    const p=myPurchases().find(x=>x.id===id);if(!p)return;
    const cur=(typeof getCurrencyLabel==='function'?getCurrencyLabel():'ریال');
    const itemRows=(p.items||[]).map((it,i)=>`<tr><td>${(i+1).toLocaleString('fa-IR')}</td><td>${esc(it.prodName||'')}</td><td>${esc(it.unit||'')}</td><td>${Number(it.qty||0).toLocaleString('fa-IR')}</td><td>${fmt(it.price)}</td><td>${fmt(it.lineTotal)}</td></tr>`).join('');
    const w=window.open('','_blank','width=900,height=700');if(!w){alert('مرورگر پنجره چاپ را مسدود کرده است.');return;}
    w.document.write(`<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>فاکتور خرید ${esc(p.number||'')}</title><style>@page{size:A4 portrait;margin:10mm}body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#111}h2{text-align:center}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border:1px solid #555;padding:7px;text-align:center;font-size:12px}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;font-size:13px}.sum{margin-top:12px;text-align:left;line-height:2}</style></head><body><h2>فاکتور خرید</h2><div class="meta"><div><b>شماره:</b> ${esc(p.number||'—')}</div><div><b>تاریخ:</b> ${esc(p.date||'—')}</div><div><b>تأمین‌کننده:</b> ${esc(p.supplierName||'—')}</div><div><b>پروژه/مرکز هزینه:</b> ${esc(p.costCenterLabel||'—')}</div><div><b>شماره پیمان:</b> ${esc(p.contractNumber||'—')}</div><div><b>نحوه تسویه:</b> ${esc(p.paymentMethodLabel||(p.paymentMethod==='credit'?'نسیه':'نقدی'))}</div></div><table><thead><tr><th>#</th><th>شرح</th><th>واحد</th><th>مقدار</th><th>فی</th><th>مبلغ</th></tr></thead><tbody>${itemRows}</tbody></table><div class="sum"><div>جمع اقلام: <b>${fmt(p.subtotal)} ${cur}</b></div><div>تخفیف: <b>${fmt(p.discount)} ${cur}</b></div><div>مالیات: <b>${fmt(p.vat)} ${cur}</b></div><div>قابل پرداخت: <b>${fmt(p.grandTotal)} ${cur}</b></div></div><p>${esc(p.description||'')}</p><script>window.onload=()=>{window.print();};<\/script></body></html>`);
    w.document.close();
  };
  window.purDelete=function(id){
    if(!requireWrite()||!confirm('این فاکتور خرید حذف شود؟'))return;
    datastore.purchases=datastore.purchases.filter(p=>!(p.id===id&&p.ownerUserId===currentUser.id));
    saveDatastore();refreshAllSurfaces();
  };
  window.purImportExcel=function(ev){
    if(!requireWrite())return;
    const f=ev.target.files[0];if(!f)return;
    const rd=new FileReader();
    rd.onload=function(e){
      try{
        const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
        const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
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
    const sel=$('pur-supplier'),cc=$('pur-costcenter');if(!sel||!cc)return;
    const current=cc.value;
    const contact=getMyContacts().find(c=>c.id===sel.value);
    let html='<option value="">بدون پروژه (هزینه عمومی)</option>';
    if(contact&&contact.project_mode==='multi'&&Array.isArray(contact.projects)){
      contact.projects.filter(p=>(p.direction||'both')!=='sale').forEach(p=>{
        html+=`<option value="${esc(p.id)}">${esc(p.name)}</option>`;
        (p.subprojects||[]).forEach(s=>{html+=`<option value="${esc(s.id)}">↳ ${esc(p.name)} / ${esc(s.name)}</option>`;});
      });
    }
    cc.innerHTML=html;
    if(current&&[...cc.options].some(o=>o.value===current))cc.value=current;
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
    const list=myPurchases();let total=0;
    $('pur-list-body').innerHTML=list.length?list.map(p=>{total+=p.grandTotal||0;return `<tr><td>${esc(p.number||'—')}</td><td>${esc(p.date)}</td><td>${esc(p.supplierName)}</td><td>${esc(p.costCenterLabel||'—')}</td><td>${esc(p.contractNumber||'—')}</td><td>${fmt(p.grandTotal)}</td><td><button class="btn btn-secondary btn-inline" style="padding:4px 8px;font-size:12px;min-height:30px" onclick="purEdit('${esc(p.id)}')">✏️ اصلاح</button> <button class="btn btn-secondary btn-inline" style="padding:4px 8px;font-size:12px;min-height:30px" onclick="purPrint('${esc(p.id)}')">🖨️ چاپ</button> <button class="btn btn-danger btn-inline" style="padding:4px 8px;font-size:12px;min-height:30px" onclick="purDelete('${esc(p.id)}')">حذف</button></td></tr>`;}).join(''):'<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px">فاکتور خریدی ثبت نشده است.</td></tr>';
    $('pur-total-all').innerText=list.length?('جمع کل خریدها: '+fmt(total)):'';
  }

  // اتصال به چرخه‌ی به‌روزرسانی برنامه
  const oldRefresh=window.refreshAllSurfaces;
  window.refreshAllSurfaces=function(){oldRefresh.apply(this,arguments);try{render();}catch(e){console.error('purchases render',e);}};
  document.addEventListener('DOMContentLoaded',injectUI);
  injectUI();
})();
