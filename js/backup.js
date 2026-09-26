function exportDataBlob(){
  const userExport={user:currentUser?.username,exportedAt:new Date().toISOString(),companies:getMyCompanies(),contacts:getMyContacts(),products:getMyProducts(),invoices:getMyInvoices(),cheques:getMyCheques(),expenses:getMyExpenses(),settings:getMySettings()};
  const blobString="data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(userExport,null,2));
  const anchor=document.createElement('a');
  anchor.setAttribute("href",blobString);
  anchor.setAttribute("download",`finora-${currentUser?.username||'data'}-${Date.now()}.json`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
function importDataBlob(event){
  if(!requireWrite())return;
  if(!currentUser)return;
  const file=event.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const imported=JSON.parse(e.target.result);
      if(!imported||typeof imported!=='object')throw new Error('bad');
      absorbRecords(imported);
      saveDatastore();refreshAllSurfaces();
      alert('اطلاعات با موفقیت به حساب کاربری شما اضافه شد.');
    }catch(err){alert('فایل نامعتبر است.');}
  };
  reader.readAsText(file);
}
