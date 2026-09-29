function exportDataBlob(){
  const userExport={user:currentUser?.username,exportedAt:new Date().toISOString(),companies:getMyCompanies(),contacts:getMyContacts(),products:getMyProducts(),invoices:getMyInvoices(),purchases:getMyPurchases(),cheques:getMyCheques(),expenses:getMyExpenses(),payments:getMyPayments(),fiscalYears:getMyFiscalYears(),accounts:getMyAccounts(),dimensionTypes:getMyDimensionTypes(),dimensionValues:getMyDimensionValues(),accountDimensionRules:getMyAccountDimensionRules(),branches:getMyBranches(),projects:getMyGlobalProjects(),projectLinks:afOwned('projectLinks'),postingProfiles:getMyPostingProfiles(),journalVouchers:getMyJournalVouchers(),journalLines:getMyJournalLines(),journalLineDimensions:getMyJournalLineDimensions(),contracts:getMyContracts(),contractAmendments:getMyContractAmendments(),contractParties:getMyContractParties(),contractDeductions:getMyContractDeductions(),guarantees:getMyGuarantees(),guaranteeEvents:getMyGuaranteeEvents(),contractStatements:getMyContractStatements(),phase4Audit:getMyPhase4Audit(),warehouses:getMyWarehouses(),stockMovements:getMyStockMovements(),inventoryCounts:getMyInventoryCounts(),fixedAssets:getMyFixedAssets(),assetDepreciations:getMyAssetDepreciations(),currencies:getMyCurrencies(),exchangeRates:getMyExchangeRates(),costCenters:getMyCostCenters(),importBatches:getMyImportBatches(),integrationConnections:getMyIntegrationConnections(),integrationOutbox:getMyIntegrationOutbox(),phase5Audit:getMyPhase5Audit(),settings:getMySettings()};
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
      if(!imported||typeof imported!=='object'||Array.isArray(imported))throw new Error('bad');
      if(typeof P5Domain==='object')P5Domain.validateRestore(imported,COLLS);
      const summary=COLLS.filter(k=>Array.isArray(imported[k])&&imported[k].length).map(k=>k+': '+imported[k].length).join(' | ');
      if(!confirm('بازگردانی به‌صورت ادغام امن انجام می‌شود و سابقه قطعی موجود بازنویسی نخواهد شد. ادامه؟\n'+summary))return;
      absorbRecords(imported);
      saveDatastore();refreshAllSurfaces();
      alert('اطلاعات با موفقیت به حساب کاربری شما اضافه شد.');
    }catch(err){alert('فایل نامعتبر است.');}
  };
  reader.readAsText(file);
}
