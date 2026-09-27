// ============== ورود اقلام فاکتور از فایل اکسل (ستون‌ها: کد کالا، شرح، تعداد، واحد، فی) ==============
function importInvoiceItemsFromExcel(event){
  if(!requireWrite())return;
  const file=event.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const data=new Uint8Array(e.target.result);
      const workbook=XLSX.read(data,{type:'array'});
      const rows=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      const myProducts=getMyProducts();
      let added=0;
      rows.forEach(r=>{
        const code=(r['کد کالا']||r['کد']||'').toString().trim();
        const name=(r['شرح']||r['نام کالا']||r['عنوان']||'').toString().trim();
        const qty=parseFormattedNumber(r['تعداد']||r['مقدار']||1)||1;
        const unit=(r['واحد']||'عدد').toString();
        const price=parseFormattedNumber(r['فی']||r['قیمت']||r['قیمت واحد']||0);
        if(!name&&!code)return;
        let prod=myProducts.find(p=>(code&&p.code===code)||(name&&p.name===name));
        let prodId;
        if(prod){
          prodId=prod.id;
        }else{
          prodId='P_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
          const newProd={id:prodId,ownerUserId:currentUser.id,code:code||(myProducts.length+added+1).toString(),name:name||code,spec:'',type:'good',unit,buy_price:0,sale_price:price,stock:0,internal_id:''};
          datastore.products.push(newProd);
          myProducts.push(newProd);
        }
        addInvoiceItemRow(prodId,qty,price);
        const tbody=document.getElementById('invoice-items-table-body');
        const lastRow=tbody.lastElementChild;
        if(lastRow){
          const unitInput=lastRow.querySelector('.row-unit-input');
          if(unitInput)unitInput.value=unit;
        }
        added++;
      });
      if(added>0){
        saveDatastore();
        updateInvoiceItemRowNumbers();
        recomputeTotals();
        alert(added+' ردیف از اکسل به فاکتور اضافه شد.');
      }else{
        alert('هیچ ردیف معتبری در فایل پیدا نشد. ستون‌های موردنیاز: کد کالا، شرح، تعداد، واحد، فی.');
      }
    }catch(err){alert('خطا در خواندن فایل اکسل!');}
    event.target.value='';
  };
  reader.readAsArrayBuffer(file);
}
