function commitSaveExpense(){
  if(!requireWrite())return;
  if(!currentUser)return;
  const amount=parseFloat(document.getElementById('trx-amount-input').value)||0;
  if(amount<=0){alert('مبلغ معتبر نیست.');return;}
  datastore.expenses.push({id:'TRX_'+Date.now(),ownerUserId:currentUser.id,kind:document.getElementById('trx-kind-input').value,category:document.getElementById('trx-category-input').value,amount,desc:document.getElementById('trx-desc-input').value});
  saveDatastore();
  alert('سند ثبت شد.');
  refreshAllSurfaces();
}
function renderExpenses(){
  const tbody=document.getElementById('expenses-ledger-table-body');
  const myExpenses=getMyExpenses();
  tbody.innerHTML=myExpenses.length===0?'<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted)">موردی ثبت نشده است.</td></tr>':myExpenses.map(e=>`<tr><td>${esc(e.kind)}</td><td>${esc(e.category)}</td><td>${esc(e.desc)}</td><td>${e.amount.toLocaleString('fa-IR')}</td></tr>`).join('');
}
