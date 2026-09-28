import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ids=[...index.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
const dup=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
if(dup.length)throw new Error('Duplicate static HTML ids: '+dup.join(', '));

const requiredIds=['view-dashboard','view-invoices','view-products','view-contacts','view-cheques','view-expenses','invoice-payment-method','contacts-ledger-table-body','printable-invoice'];
for(const id of requiredIds)if(!ids.includes(id))throw new Error('Missing required element #'+id);

const requiredScripts=['js/core.js','js/sync.js','js/invoices.js','js/print.js','js/contacts.js','js/companies.js','js/projects.js','js/purchases.js','js/operations.js','js/payments.js','js/accounting.js','js/drilldown.js','js/selfcheck.js'];
if(index.includes('</script>\\n<script'))throw new Error('Literal \\n found between script tags');
for(const s of requiredScripts)if(!index.includes(s))throw new Error('Missing script load: '+s);
for(const v of ['view-purchases','view-payments'])if(!index.includes(`data-view="${v}"`))throw new Error('Missing primary navigation: '+v);
if(!index.includes("frame-ancestors 'none'")||!index.includes('upgrade-insecure-requests'))throw new Error('Production CSP hardening missing');
if(!index.includes('name="referrer" content="strict-origin-when-cross-origin"'))throw new Error('Referrer policy metadata missing');
if(!index.includes('فینورا — نسخه ۱.۰')||!index.includes('نسخه ۱.۰'))throw new Error('Visible application version is inconsistent');
for(const shellId of ['module-rail','module-panel','module-panel-links','global-command-search','command-search-results','topbar-company','topbar-fiscal-year','workspace-title','workspace-context-text'])if(!ids.includes(shellId))throw new Error('Phase 1 shell missing #'+shellId);
for(const cls of ['module-rail','module-panel','topbar','global-search'])if(!index.includes('class="'+cls)&&!index.includes('class="sidebar '+cls)&&!index.includes('class="'+cls+' '))throw new Error('Phase 1 shell class missing: '+cls);


const scriptSrc=[...index.matchAll(/<script\s+src="([^"]+)"/g)].map(m=>m[1].split('?')[0]);
const duplicateScripts=[...new Set(scriptSrc.filter((s,i)=>scriptSrc.indexOf(s)!==i))];
if(duplicateScripts.length)throw new Error('Duplicate script loads: '+duplicateScripts.join(', '));
const files=fs.readdirSync(path.join(root,'js')).filter(n=>n.endsWith('.js'));
const all=Object.fromEntries(files.map(n=>[n,fs.readFileSync(path.join(root,'js',n),'utf8')]));
const must={
  'invoices.js':['function commitSaveInvoice','function editInvoice','paymentMethod'],
  'print.js':['function renderAndPrintDirect','FORMAL_ROWS_PER_PAGE=12','size: A4 portrait','size: A5 landscape'],
  'purchases.js':['window.purSave=function','window.purEdit=function','window.purPrint=function','window.purRefreshProjects=function','pur-payment-method','companyId'],
  'projects.js':['editContactProject','deleteContactProject','addSubproject','editSubproject','deleteSubproject','usedExpense','usedPayment','projectDirectionLabel(s.direction||p.direction)','project-direction-select','return new Promise'],
  'companies.js':['usedSales','usedPurchases','usedExpenses','usedPayments','usedCheques'],
  'operations.js':['editContact','editProduct','editCheque','editExpense','deleteInvoice','refreshExpenseProjects','projectId','getMyPayments','companyId'],
  'selfcheck.js':['datastore.payments','invoices.has','purchases.has'],
  'payments.js':['commitSavePayment','invoiceOutstanding','purchaseOutstanding','companyOk','legacyOk','amount>outstanding',"direction!=='inbound'","direction!=='outbound'",'projectId',"paymentMethod!=='credit'","old.invoiceType===invoiceType"],
  'idle-and-reports.js':['rep-purchase-total','rep-expense-total','rep-accrual-profit','rep-cash-net','report-financial-summary'],
  'accounting-foundation.js':['getMyFiscalYears','getMyAccounts','getMyDimensionTypes','getMyGlobalProjects','afMigrateLegacyProjects','postingAllowed','linkedContactIds'],
  'accounting-foundation-ui.js':['view-accounting-foundation','af-account-level','af-rule-dimension','af-project-contacts'],
  'accounting-foundation-render.js':['renderAccountingFoundation','afResolvedValues','af-projects-list'],
  'ui.js':["dock.dataset.view===viewId",'FINORA_MODULES','FINORA_VIEW_HOME','FINORA_COMMANDS','renderModulePanel','updateShellContext','global-command-search',"localStorage.setItem('finora.shell.panelCollapsed'"],
  'accounting.js':['productMovement','getInventorySnapshot','getProjectFinancials','accrualProfit','cashNet','i.prodId||i.productId','companyId===active','companyOk'],
'drilldown.js':['openContactLedger','openDashboardDetail','openReportDetail','openFinancialSummaryDetail',"status==='cleared'"],
  'sync.js':['getMyPurchases'],
  'backup.js':['purchases:getMyPurchases()','payments:getMyPayments()']
};
for(const [file,needles] of Object.entries(must)){
  for(const needle of needles)if(!all[file]?.includes(needle))throw new Error(file+' missing '+needle);
}
const purchaseGetterCount=(all['sync.js']?.match(/function getMyPurchases\s*\(/g)||[]).length;
if(purchaseGetterCount!==1)throw new Error('Expected exactly one getMyPurchases definition, found '+purchaseGetterCount);
const securityWorkflow=fs.readFileSync(path.join(root,'.github','workflows','security.yml'),'utf8');
for(const needle of ['github/codeql-action/init@v3','github/codeql-action/analyze@v3','actions/dependency-review-action@v4'])if(!securityWorkflow.includes(needle))throw new Error('Security workflow missing '+needle);
console.log('Static quality and security invariants passed for '+files.length+' JavaScript modules.');
if(all['invoices.js']?.includes('inboundSettlements'))throw new Error('Dashboard must not double count cheque settlements');
if(!all['drilldown.js']?.includes('const net=receivable-payable'))throw new Error('Contact ledger must use allocated invoice balances');

for(const view of ['view-accounting-foundation','view-dashboard','view-invoices','view-purchases','view-payments','view-cheques','view-expenses','view-contacts','view-products','view-reports','view-settings'])
  if(!all['ui.js'].includes("'"+view+"'"))throw new Error('Shell canonical view mapping missing '+view);
for(const cssNeedle of ['--shell-rail','--shell-panel','.module-tab.active','.module-panel{','.topbar{','.shell-panel-collapsed .main-surface','@media(max-width:820px)'])
  if(!index.includes(cssNeedle))throw new Error('Phase 1 responsive shell CSS missing '+cssNeedle);

for(const coll of ['fiscalYears','accounts','dimensionTypes','dimensionValues','accountDimensionRules','branches','projects','projectLinks'])if(!all['core.js'].includes("'"+coll+"'"))throw new Error('Phase 2 collection missing '+coll);
if(!index.includes('data-module="accounting"')||!index.includes('accounting-foundation.js?v=20260928-phase2-v1'))throw new Error('Phase 2 accounting shell integration missing');
