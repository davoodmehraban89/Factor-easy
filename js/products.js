function commitSaveProduct(){
  if(!requireWrite())return;
  if(!currentUser)return;
  const myProducts=getMyProducts();
  const code=document.getElementById('prod-code-input').value||(myProducts.length+1).toString();
  const name=document.getElementById('prod-name-input').value;
  const spec=document.getElementById('prod-spec-input').value||'';
  const unit=document.getElementById('prod-unit-input').value||'عدد';
  const buy_price=parseFloat(document.getElementById('prod-buy-input').value)||0;
  const sale_price=parseFloat(document.getElementById('prod-sale-input').value)||0;
  const internal_id=document.getElementById('prod-internal-id-input').value||'';
  if(!name){alert('عنوان کالا الزامی است.');return;}
  datastore.products.push({id:'P_'+Date.now(),ownerUserId:currentUser.id,code,name,spec,type:'good',unit,buy_price,sale_price,stock:0,internal_id});
  saveDatastore();
  alert('کالا ثبت شد.');
  document.getElementById('prod-name-input').value='';
  document.getElementById('prod-spec-input').value='';
  document.getElementById('prod-internal-id-input').value='';
  refreshAllSurfaces();
}
function renderProducts(){
  const tbody=document.getElementById('products-catalog-table-body');
  const myProducts=getMyProducts();
  if(myProducts.length===0){tbody.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px">هیچ کالایی ثبت نشده است.</td></tr>';return;}
  tbody.innerHTML=myProducts.map(p=>`<tr><td>${esc(p.code)}</td><td><strong>${esc(p.name)}</strong></td><td>${esc(p.spec||'—')}</td><td>${esc(p.unit)}</td><td>${p.sale_price.toLocaleString('fa-IR')}</td><td>${esc(p.internal_id||'—')}</td><td><button class="btn btn-danger btn-inline" style="padding:4px 8px;font-size:12px;min-height:30px" onclick="deleteProduct('${p.id}')">حذف</button></td></tr>`).join('');
}
function deleteProduct(id){
  if(!requireWrite())return;
  if(!currentUser)return;
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
  const price=parseFloat(document.getElementById('quick-p-price').value)||0;
  const internal_id=document.getElementById('quick-p-internal-id').value||'';
  if(!name){alert('عنوان کالا الزامی است.');return;}
  const newId='P_'+Date.now();
  datastore.products.push({id:newId,ownerUserId:currentUser.id,code,name,spec,unit,buy_price:0,sale_price:price,stock:0,type:'good',internal_id});
  saveDatastore();
  closeQuickProductModal();
  refreshAllSurfaces();
  addInvoiceItemRow(newId,1,price);
}
function downloadProductsExcelTemplate(){
  const ws_data=[["کد کالا","نام کالا","مشخصه و نوع","واحد","قیمت فروش (ریال)","شناسه کالا/خدمت داخلی"],["1","سوئیچ شبکه 24 پورت","با 2 پاور","عدد",2180000000,""],["2","هارد 2.5 اینچ سرور","","عدد",37000000,""]];
  const ws=XLSX.utils.aoa_to_sheet(ws_data);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"کالاها");
  XLSX.writeFile(wb,"نمونه_کالاها_فینورا.xlsx");
}
function importProductsFromExcel(event){
  if(!requireWrite())return;
  if(!currentUser)return;
  const file=event.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const data=new Uint8Array(e.target.result);
      const workbook=XLSX.read(data,{type:'array'});
      const rows=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      const myProducts=getMyProducts();
      rows.forEach((r,idx)=>{
        const name=r["نام کالا"]||r["عنوان"];
        if(name){
          datastore.products.push({id:'P_'+Date.now()+'_'+idx,ownerUserId:currentUser.id,code:(r["کد کالا"]||(myProducts.length+idx+1)).toString(),name:name.toString(),spec:(r["مشخصه و نوع"]||'').toString(),unit:(r["واحد"]||'عدد').toString(),buy_price:0,sale_price:parseFloat(r["قیمت فروش (ریال)"]||r["قیمت فروش"]||0)||0,stock:0,type:'good',internal_id:(r["شناسه کالا/خدمت داخلی"]||'').toString()});
        }
      });
      saveDatastore();refreshAllSurfaces();
      alert('کالاها ایمپورت شدند.');
    }catch(err){alert('خطا در فایل اکسل!');}
  };
  reader.readAsArrayBuffer(file);
}
