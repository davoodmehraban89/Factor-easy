let editingProductId='';
function productCategoryKey(v){return String(v||'').trim().replace(/\s+/g,' ').toLowerCase()}
function productGroupCode(category){const key=productCategoryKey(category);if(!key)return '99';const groups=[...new Set(getMyProducts().map(p=>productCategoryKey(p.category)).filter(Boolean))].sort();const idx=groups.indexOf(key);return String(idx>=0?idx+1:groups.length+1).padStart(2,'0').slice(-2)}
function nextProductCode(category){const prefix=productGroupCode(category),used=getMyProducts().map(p=>String(p.code||'')).filter(c=>/^\d{6}$/.test(c)&&c.startsWith(prefix)).map(c=>Number(c.slice(2)));return prefix+String(Math.max(0,...used)+1).padStart(4,'0')}
function refreshProductCategories(){const dl=document.getElementById('prod-category-list');if(dl)dl.innerHTML=[...new Set(getMyProducts().map(p=>p.category).filter(Boolean))].sort().map(x=>'<option value="'+esc(x)+'"></option>').join('')}
window.nextProductCode=nextProductCode;
function syncProductDefaultPrices(items,direction){
  if(!Array.isArray(items))return false;let changed=false;for(const it of items){const id=it.prodId||it.productId,p=getMyProducts().find(x=>x.id===id),price=Number(it.price||it.unitPrice||0);if(!p||price<=0)continue;const key=direction==='purchase'?'buy_price':'sale_price';if(Number(p[key]||0)!==price){p[key]=price;p.priceUpdatedAt=new Date().toISOString();p.priceUpdatedFrom=direction;changed=true}}return changed;
}
function commitSaveProduct(){
  if(!requireWrite())return;
  if(!currentUser)return;
  const myProducts=getMyProducts();
  const category=document.getElementById('prod-category-input')?.value.trim()||'';const requestedCode=document.getElementById('prod-code-input').value.trim(),code=editingProductId?(requestedCode||getMyProducts().find(x=>x.id===editingProductId)?.code||''):(requestedCode||nextProductCode(category));
  const name=document.getElementById('prod-name-input').value;
  const spec=document.getElementById('prod-spec-input').value||'';
  const unit=document.getElementById('prod-unit-input').value||'عدد';
  const buy_price=parseFormattedNumber(document.getElementById('prod-buy-input').value);
  const sale_price=parseFormattedNumber(document.getElementById('prod-sale-input').value);
  const internal_id=code;
  const official_id=document.getElementById('prod-official-id-input')?.value.trim()||'';
  if(!name){alert('عنوان کالا الزامی است.');return;}
  const type=document.getElementById('prod-type-input')?.value||'good',barcode=document.getElementById('prod-barcode-input')?.value.trim()||'',min_stock=parseFormattedNumber(document.getElementById('prod-min-stock-input')?.value||0);
  if(editingProductId){
    const row=datastore.products.find(x=>x.id===editingProductId&&x.ownerUserId===currentUser.id);if(!row)return alert('کالا/خدمت برای اصلاح یافت نشد.');
    Object.assign(row,{code,name,spec,type,category,barcode,unit,buy_price,sale_price,min_stock,internal_id,official_id});editingProductId='';alert('کالا/خدمت اصلاح شد.');
  }else datastore.products.push({id:'P_'+Date.now(),ownerUserId:currentUser.id,code,name,spec,type,category,barcode,unit,buy_price,sale_price,stock:0,min_stock,internal_id,official_id});
  saveDatastore();
  if(!editingProductId)alert('کالا ثبت شد.');
  document.getElementById('prod-name-input').value='';
  document.getElementById('prod-spec-input').value='';
  if(document.getElementById('prod-official-id-input'))document.getElementById('prod-official-id-input').value='';
  cancelProductEdit(false);
  refreshAllSurfaces();
}
function renderProducts(){
  const tbody=document.getElementById('products-catalog-table-body');
  const myProducts=getMyProducts();
  if(myProducts.length===0){tbody.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:20px">هیچ کالایی ثبت نشده است.</td></tr>';return;}
  tbody.innerHTML=myProducts.map(p=>`<tr><td>${esc(p.code)}</td><td><strong>${esc(p.name)}</strong><small style="display:block;color:var(--text-muted)">${esc(p.spec||'')}</small></td><td>${p.type==='service'?'خدمت':'کالا'}</td><td>${esc(p.category||'—')}</td><td>${esc(p.unit)}</td><td>${p.sale_price.toLocaleString('fa-IR')}</td><td>${esc(p.barcode||p.internal_id||'—')}</td><td style="display:flex;gap:5px;flex-wrap:wrap"><button class="btn btn-secondary btn-inline" style="padding:4px 8px;font-size:12px;min-height:30px" onclick="editProduct('${p.id}')">اصلاح</button><button class="btn btn-secondary btn-inline" style="padding:4px 8px;font-size:12px;min-height:30px" onclick="openProductKardex('${p.id}')">کاردکس</button><button class="btn btn-danger btn-inline" style="padding:4px 8px;font-size:12px;min-height:30px" onclick="deleteProduct('${p.id}')">حذف</button></td></tr>`).join('');
}
function deleteProduct(id){
  if(!requireWrite())return;
  if(!currentUser)return;
  const referenced=Object.entries(datastore).some(([key,rows])=>key!=='products'&&Array.isArray(rows)&&rows.some(r=>{try{return JSON.stringify(r).includes('"'+id+'"')}catch(_){return false}}));if(referenced){alert('این کالا/خدمت در فاکتور، انبار، شمارش یا سابقه عملیاتی استفاده شده و برای حفظ تاریخچه قابل حذف نیست.');return;}
  if(confirm('حذف شود؟')){
    datastore.products=datastore.products.filter(p=>!(p.id===id&&p.ownerUserId===currentUser.id));
    saveDatastore();refreshAllSurfaces();
  }
}
function openQuickProductModal(){document.getElementById('modal-quick-product').classList.add('active');}
function closeQuickProductModal(){document.getElementById('modal-quick-product').classList.remove('active');}
function saveQuickProduct(){
  if(!requireWrite())return;
  if(!currentUser)return;
  const myProducts=getMyProducts();
  const code=document.getElementById('quick-p-code').value||(myProducts.length+1).toString();
  const name=document.getElementById('quick-p-name').value;
  const spec=document.getElementById('quick-p-spec').value||'';
  const unit=document.getElementById('quick-p-unit').value||'عدد';
  const price=parseFormattedNumber(document.getElementById('quick-p-price').value);
  const internal_id=code;
  const official_id=document.getElementById('quick-p-official-id')?.value.trim()||'';
  if(!name){alert('عنوان کالا الزامی است.');return;}
  const newId='P_'+Date.now();
  datastore.products.push({id:newId,ownerUserId:currentUser.id,code,name,spec,unit,buy_price:0,sale_price:price,stock:0,type:'good',internal_id,official_id});
  saveDatastore();
  closeQuickProductModal();
  refreshAllSurfaces();
  addInvoiceItemRow(newId,1,price);
}
function downloadProductsExcelTemplate(){
  const ws_data=[["کد کالا","نام کالا","مشخصه و نوع","واحد","قیمت فروش (ریال)","شناسه کالا/خدمت داخلی","شناسه کالا/خدمت سامانه مالیاتی"],["1","سوئیچ شبکه 24 پورت","با 2 پاور","عدد",2180000000,""],["2","هارد 2.5 اینچ سرور","","عدد",37000000,""]];
  const ws=XLSX.utils.aoa_to_sheet(ws_data);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"کالاها");
  XLSX.writeFile(wb,"نمونه_کالاها_فینورا.xlsx");
}
function importProductsFromExcel(event){
  if(!requireWrite())return;
  if(!currentUser)return;
  const file=event.target.files[0];
  if(!file)return;if(file.size>5*1024*1024){event.target.value='';alert('حجم فایل اکسل نباید بیشتر از ۵ مگابایت باشد.');return;}
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const data=new Uint8Array(e.target.result);
      const workbook=XLSX.read(data,{type:'array'});
      const rows=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);if(rows.length>10000)throw new Error('too many rows');
      const myProducts=getMyProducts();
      rows.forEach((r,idx)=>{
        const name=r["نام کالا"]||r["عنوان"];
        if(name){
          datastore.products.push({id:'P_'+Date.now()+'_'+idx,ownerUserId:currentUser.id,code:(r["کد کالا"]||(myProducts.length+idx+1)).toString(),name:name.toString(),spec:(r["مشخصه و نوع"]||'').toString(),unit:(r["واحد"]||'عدد').toString(),buy_price:0,sale_price:parseFloat(r["قیمت فروش (ریال)"]||r["قیمت فروش"]||0)||0,stock:0,type:'good',internal_id:(r["شناسه کالا/خدمت داخلی"]||'').toString(),official_id:(r["شناسه کالا/خدمت سامانه مالیاتی"]||'').toString()});
        }
      });
      saveDatastore();refreshAllSurfaces();
      alert('کالاها ایمپورت شدند.');
    }catch(err){alert('خطا در فایل اکسل!');}
  };
  reader.readAsArrayBuffer(file);
}

function editProduct(id){
  const p=getMyProducts().find(x=>x.id===id);if(!p)return;editingProductId=id;
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v??''};
  set('prod-code-input',p.code);set('prod-name-input',p.name);set('prod-spec-input',p.spec);set('prod-unit-input',p.unit||'عدد');set('prod-type-input',p.type||'good');set('prod-category-input',p.category);set('prod-barcode-input',p.barcode);set('prod-min-stock-input',p.min_stock||0);set('prod-buy-input',p.buy_price||0);set('prod-sale-input',p.sale_price||0);set('prod-official-id-input',p.official_id);
  const b=document.getElementById('product-save-btn'),c=document.getElementById('product-edit-cancel-btn');if(b)b.textContent='💾 ذخیره اصلاحات';if(c)c.style.display='inline-flex';
}
function cancelProductEdit(clear=true){editingProductId='';const b=document.getElementById('product-save-btn'),c=document.getElementById('product-edit-cancel-btn');if(b)b.textContent='➕ ثبت کالا';if(c)c.style.display='none';if(clear){['prod-code-input','prod-name-input','prod-spec-input','prod-category-input','prod-barcode-input','prod-official-id-input'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});}}
function productKardexRows(id){
 const out=[];const add=(kind,doc,qty,date,number)=>out.push({kind,doc,qty:Number(qty)||0,date:date||'',number:number||''});
 getMyPurchases().forEach(x=>(x.items||[]).filter(i=>(i.prodId||i.productId)===id).forEach(i=>add('خرید',x.id,i.qty??i.quantity,x.date,x.number)));
 getMyInvoices().forEach(x=>(x.items||[]).filter(i=>(i.prodId||i.productId)===id).forEach(i=>add('فروش',x.id,-Number((i.qty??i.quantity)||0),x.date,x.number)));
 (datastore.stockMovements||[]).filter(x=>x.ownerUserId===currentUser?.id&&(x.productId===id||x.prodId===id)).forEach(x=>add(x.type||x.kind||'گردش انبار',x.id,x.quantity??x.qty,x.date,x.number));
 return out.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
function openProductKardex(id){const p=getMyProducts().find(x=>x.id===id);if(!p)return;let balance=Number(p.stock||0),lines=productKardexRows(id).map(x=>{balance+=x.qty;return (x.date||'—')+' | '+x.kind+' | '+(x.number||x.doc||'—')+' | '+x.qty.toLocaleString('fa-IR')+' | مانده '+balance.toLocaleString('fa-IR')});alert('کاردکس '+p.name+'\nموجودی اولیه: '+Number(p.stock||0).toLocaleString('fa-IR')+'\n\n'+(lines.join('\n')||'گردشی ثبت نشده است.'));}
