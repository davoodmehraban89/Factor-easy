// Derived inventory and project profitability. No mutable stock side effects.
(function(){
const n=v=>Number(v)||0;
// Historical unlinked purchase snapshots keep their legacy treatment; a reversed
// posting or unposted corrective draft must not create inventory or project cost.
function purchaseAffectsBalance(p){const state=typeof purchaseDocumentStatus==='function'?purchaseDocumentStatus(p):'legacy_review';return state==='posted'||state==='legacy_review';}
function productMovement(productId){
  const opening=n(getMyProducts().find(p=>p.id===productId)?.stock);
  const companies=getMyCompanies(),active=getMySettings().default_company_id||companies[0]?.id||'';
  const legacyOk=companies.length===1;
  const purchased=getMyPurchases().filter(p=>(!active||p.companyId===active||(!p.companyId&&legacyOk))&&purchaseAffectsBalance(p)).reduce((sum,p)=>sum+(p.items||[]).filter(i=>(i.prodId||i.productId)===productId).reduce((s,i)=>s+n(i.qty??i.quantity),0),0);
  const sold=getMyInvoices().filter(p=>(!active||p.companyId===active||(!p.companyId&&legacyOk))&&typeof invoiceDocumentStatus==='function'&&invoiceDocumentStatus(p)==='posted').reduce((sum,p)=>sum+(p.items||[]).filter(i=>(i.prodId||i.productId)===productId).reduce((s,i)=>s+n(i.qty??i.quantity),0),0);
  return {opening,purchased,sold,available:opening+purchased-sold};
}
function getInventorySnapshot(){return getMyProducts().map(p=>({productId:p.id,code:p.code,name:p.name,unit:p.unit||'عدد',...productMovement(p.id)}));}
function getProjectFinancials(projectId){
  const companies=getMyCompanies(),active=getMySettings().default_company_id||companies[0]?.id||'',legacyOk=companies.length===1,companyOk=i=>!active||i.companyId===active||(!i.companyId&&legacyOk);
  const sales=getMyInvoices().filter(i=>companyOk(i)&&i.projectId===projectId&&typeof invoiceDocumentStatus==='function'&&invoiceDocumentStatus(i)==='posted').reduce((s,i)=>s+n(i.grandTotal),0);
  const purchases=getMyPurchases().filter(i=>companyOk(i)&&purchaseAffectsBalance(i)&&(i.projectId===projectId||i.costCenterId===projectId)).reduce((s,i)=>s+n(i.grandTotal),0);
  const expenses=getMyExpenses().filter(e=>companyOk(e)&&e.projectId===projectId&&e.kind==='expense').reduce((s,e)=>s+n(e.amount),0);
  const income=getMyExpenses().filter(e=>companyOk(e)&&e.projectId===projectId&&e.kind==='income').reduce((s,e)=>s+n(e.amount),0);
  const receipts=(typeof paymentEffectiveRecords==='function'?paymentEffectiveRecords():getMyPayments()).filter(p=>companyOk(p)&&p.projectId===projectId&&p.direction==='inbound').reduce((s,p)=>s+n(p.amount),0);
  const payments=(typeof paymentEffectiveRecords==='function'?paymentEffectiveRecords():getMyPayments()).filter(p=>companyOk(p)&&p.projectId===projectId&&p.direction==='outbound').reduce((s,p)=>s+n(p.amount),0);
  return {sales,purchases,expenses,income,receipts,payments,accrualProfit:sales+income-purchases-expenses,cashNet:receipts+income-payments-expenses};
}
window.productMovement=productMovement;window.getInventorySnapshot=getInventorySnapshot;window.getProjectFinancials=getProjectFinancials;
})();