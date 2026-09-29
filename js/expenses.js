function commitSaveExpense(){
  if(!requireWrite())return;
  if(!currentUser)return;
  const amount=parseFormattedNumber(document.getElementById('trx-amount-input').value);
  if(amount<=0){alert('مبلغ معتبر نیست.');return;}
  const kind=document.getElementById('trx-kind-input').value,contactId=document.getElementById('trx-contact-select')?.value||'',projectId=document.getElementById('trx-project-select')?.value||'',record={id:'TRX_'+Date.now(),ownerUserId:currentUser.id,companyId:typeof afCompanyId==='function'?afCompanyId():'',kind,category:document.getElementById('trx-category-input').value,amount,desc:document.getElementById('trx-desc-input').value,contactId,projectId,date:getJalaliNumeric(),accountingVersion:1};
  datastore.expenses.push(record);
  if(typeof jePostSourceRecord==='function'){try{jePostSourceRecord(kind,record);}catch(e){datastore.expenses=datastore.expenses.filter(x=>x.id!==record.id);alert('هزینه/درآمد ثبت نشد: '+e.message);return;}}
  saveDatastore();
  alert('هزینه/درآمد و سند حسابداری با موفقیت ثبت شد.');
  refreshAllSurfaces();
}
function renderExpenses(){
  const tbody=document.getElementById('expenses-ledger-table-body');
  const myExpenses=getMyExpenses();
  tbody.innerHTML=myExpenses.length===0?'<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted)">موردی ثبت نشده است.</td></tr>':myExpenses.map(e=>`<tr><td>${esc(e.kind)}</td><td>${esc(e.category)}</td><td>${esc(e.desc)}</td><td>${e.amount.toLocaleString('fa-IR')}</td></tr>`).join('');
}
