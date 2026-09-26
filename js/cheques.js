function commitSaveCheque(){
  if(!requireWrite())return;
  if(!currentUser)return;
  const direction=document.getElementById('chq-direction-input').value;
  const contactSelect=document.getElementById('chq-contact-select');
  const contactName=contactSelect.options[contactSelect.selectedIndex]?.text||'';
  const sayad_id=document.getElementById('chq-sayad-input').value;
  const bank=document.getElementById('chq-bank-input').value;
  const amount=parseFloat(document.getElementById('chq-amount-input').value)||0;
  if(!sayad_id||amount<=0){alert('اطلاعات چک نامعتبر است.');return;}
  datastore.cheques.push({id:'CHQ_'+Date.now(),ownerUserId:currentUser.id,direction,contactName,sayad_id,bank,amount,due_date:document.getElementById('chq-due-input').value,status:document.getElementById('chq-status-input').value});
  saveDatastore();
  alert('چک ثبت شد.');
  refreshAllSurfaces();
}
function renderCheques(){
  const tbody=document.getElementById('cheques-ledger-table-body');
  const myCheques=getMyCheques();
  tbody.innerHTML=myCheques.length===0?'<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">چکی ثبت نشده است.</td></tr>':myCheques.map(c=>`<tr><td>${c.direction==='inbound'?'دریافتی':'پرداختی'}</td><td>${esc(c.contactName)}</td><td>${esc(c.bank)} - ${esc(c.sayad_id)}</td><td>${c.amount.toLocaleString('fa-IR')}</td><td>${esc(c.due_date)}</td><td>${esc(c.status)}</td></tr>`).join('');
}
