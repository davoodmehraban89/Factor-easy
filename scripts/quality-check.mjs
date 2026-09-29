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
for(const needle of ["replace(/&/g,'&amp;')","replace(/</g,'&lt;')","replace(/>/g,'&gt;')","replace(/\"/g,'&quot;')","replace(/'/g,'&#39;')"])if(!fs.readFileSync(path.join(root,'js','core.js'),'utf8').includes(needle))throw new Error('HTML escaping invariant missing '+needle);
if(!index.includes('فینورا — نسخه ۱.۰')||!index.includes('نسخه ۱.۰'))throw new Error('Visible application version is inconsistent');
for(const shellId of ['module-rail','module-panel','module-panel-handle','module-panel-links','global-command-search','command-search-results','quick-create-toggle','quick-create-menu','topbar-company','topbar-fiscal-year','workspace-title','workspace-context-text'])if(!ids.includes(shellId))throw new Error('Phase 1 shell missing #'+shellId);
for(const cls of ['module-rail','module-panel','topbar','global-search'])if(!index.includes('class="'+cls)&&!index.includes('class="sidebar '+cls)&&!index.includes('class="'+cls+' '))throw new Error('Phase 1 shell class missing: '+cls);


const scriptSrc=[...index.matchAll(/<script\s+src="([^"]+)"/g)].map(m=>m[1].split('?')[0]);
const duplicateScripts=[...new Set(scriptSrc.filter((s,i)=>scriptSrc.indexOf(s)!==i))];
if(duplicateScripts.length)throw new Error('Duplicate script loads: '+duplicateScripts.join(', '));
const files=fs.readdirSync(path.join(root,'js')).filter(n=>n.endsWith('.js'));
const all=Object.fromEntries(files.map(n=>[n,fs.readFileSync(path.join(root,'js',n),'utf8')]));
const must={
  'invoices.js':['function commitSaveInvoice','function editInvoice','paymentMethod'],
  'print.js':['function renderAndPrintDirect','FORMAL_ROWS_PER_PAGE=12','const isPreInvoice=','function getInvoicePrintSpec',"kind==='non_formal'||kind==='informal'",'function buildIsolatedPrintDocument','function printIsolatedDocument',"frame.id='finora-print-frame'","paper:'A4'","paper:'A5'"],
  'purchases.js':['window.purSave=function','window.purEdit=function','window.purPrint=function','window.purRefreshProjects=function','pur-payment-method','companyId'],
  'projects.js':['editContactProject','deleteContactProject','addSubproject','editSubproject','deleteSubproject','usedExpense','usedPayment','projectDirectionLabel(s.direction||p.direction)','project-direction-select','return new Promise'],
  'companies.js':['Object.entries(datastore)',"key!=='companies'",'default_company_id','organizationSector','legalForm','organizationRole','parentCompanyId','handleCompanyEntityTypeChange','handleCompanyOrganizationRoleChange','companyLegalSummary','currentUser.maxCompanies'],
  'operations.js':['editContact','editProduct','editCheque','editExpense','deleteInvoice','refreshExpenseProjects','projectId','getMyPayments','companyId',"q.status&&q.status!=='registered'",'چک تعیین‌تکلیف‌شده برای حفظ سابقه قابل حذف نیست'],
  'selfcheck.js':['datastore.payments','invoices.has','purchases.has'],
  'payments.js':['commitSavePayment','invoiceOutstanding','purchaseOutstanding','companyOk','legacyOk','amount>outstanding',"direction!=='inbound'","direction!=='outbound'",'projectId',"paymentMethod!=='credit'","old.invoiceType===invoiceType"],
  'idle-and-reports.js':['rep-purchase-total','rep-expense-total','rep-accrual-profit','rep-cash-net','report-financial-summary'],
  'accounting-foundation.js':['getMyFiscalYears','getMyAccounts','getMyDimensionTypes','getMyGlobalProjects','afMigrateLegacyProjects','postingAllowed','linkedContactIds'],
  'accounting-foundation-ui.js':['view-accounting-foundation','af-account-level','af-rule-dimension','af-project-contacts'],
  'accounting-foundation-render.js':['renderAccountingFoundation','afResolvedValues','af-projects-list'],
  'ui.js':["dock.dataset.view===viewId",'FINORA_MODULES','FINORA_VIEW_HOME','FINORA_COMMANDS','renderModulePanel','updateShellContext','global-command-search','syncModulePanelHandle','toggleQuickCreateMenu',"localStorage.setItem('finora.shell.panelCollapsed'"],
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

for(const view of ['view-journal','view-accounting-foundation','view-dashboard','view-invoices','view-purchases','view-payments','view-cheques','view-expenses','view-contacts','view-products','view-reports','view-settings'])
  if(!all['ui.js'].includes("'"+view+"'"))throw new Error('Shell canonical view mapping missing '+view);
for(const cssNeedle of ['--shell-rail','--shell-panel','.module-tab.active','.module-panel{','.topbar{','.shell-panel-collapsed .main-surface','@media(max-width:820px)'])
  if(!index.includes(cssNeedle))throw new Error('Phase 1 responsive shell CSS missing '+cssNeedle);

for(const coll of ['fiscalYears','accounts','dimensionTypes','dimensionValues','accountDimensionRules','branches','projects','projectLinks'])if(!all['core.js'].includes("'"+coll+"'"))throw new Error('Phase 2 collection missing '+coll);
if(!index.includes('data-module="accounting"')||!index.includes('accounting-foundation.js?v=20260928-phase3-final'))throw new Error('Phase 2 accounting shell integration missing');

for(const coll of ['postingProfiles','journalVouchers','journalLines','journalLineDimensions'])if(!all['core.js'].includes("'"+coll+"'")||!all['sync.js'].includes(coll))throw new Error('Phase 3 collection missing '+coll);
for(const needle of ['jeValidateLines','jeValidateDimensions','jeCreateDraft','jePost','jeReverse','jeDeleteDraft','jeTrialBalance','sourceVersion'])if(!all['journal-engine.js']?.includes(needle))throw new Error('Phase 3 journal invariant missing '+needle);
if(!index.includes('journal-engine.js?v=20260928-phase3-final')||!index.includes('journal-ui.js?v=20260928-phase3-final'))throw new Error('Phase 3 journal scripts missing');

for(const needle of ['jeActiveSourceVoucher','jeSourceLocked','jeGuardSourceMutation','jePostSourceRecord',"['posted','reversed'].includes"])if(!all['journal-engine.js']?.includes(needle))throw new Error('Phase 3 source/ledger safety missing '+needle);
for(const [file,needles] of Object.entries({
 'invoices.js':['jeGuardSourceMutation','jePostSourceRecord'],
 'purchases.js':['jeGuardSourceMutation','jePostSourceRecord'],
 'payments.js':['jeGuardSourceMutation','jePostSourceRecord'],
 'operations.js':['jeGuardSourceMutation','jePostSourceRecord'],
 'accounting-foundation.js':["journalLines||[]","سابقه دفتر"]
}))for(const needle of needles)if(!all[file]?.includes(needle))throw new Error('Phase 3 operational integration missing '+file+' '+needle);

if(!all['ui.js'].includes("commerce:{title:'بازرگانی'"))throw new Error('Commerce module missing');
for(const v of ["'view-invoices':'commerce'","'view-purchases':'commerce'","'view-contacts':'commerce'"])if(!all['ui.js'].includes(v))throw new Error('Commerce view mapping missing '+v);
for(const legacy of ['data-module="sales"','data-module="purchases"','data-module="people"'])if(index.includes(legacy))throw new Error('Legacy top-level commerce rail remains '+legacy);
if(!index.includes('data-module="commerce"')||!index.includes('<b>بازرگانی</b>'))throw new Error('Commerce rail button missing');

const p4=fs.readFileSync('js/phase4-contracting.js','utf8');
for(const x of ['p4SaveContract','p4AddAmendment','p4AddDeduction','p4AddGuarantee','p4CreateStatement','p4PostStatement','p4ReverseStatement','p4ContractProfit','p4Audit'])if(!p4.includes(x))throw new Error('Phase4 invariant missing '+x);
for(const x of ['contracts','contractAmendments','contractParties','contractDeductions','guarantees','guaranteeEvents','contractStatements','phase4Audit']){if(!all['core.js'].includes(x)||!all['sync.js'].includes(x))throw new Error('Phase4 persistence missing '+x);}
if(!index.includes('data-module="projects"')||!index.includes('id="view-contracting"')||!index.includes('phase4-contracting.js'))throw new Error('Phase4 workspace/navigation missing');

const p5=all['phase5-enterprise.js']||'';for(const x of ['getMyWarehouses','p5PostMovement','p5SaveCount','p5RunDepreciation','p5SaveCurrency','p5SaveRate','p5SaveCostCenter','p5PreviewRestore','p5SaveIntegration','p5QueueEvent'])if(!p5.includes(x))throw new Error('Phase5 invariant missing '+x);
for(const coll of ['warehouses','stockMovements','inventoryCounts','fixedAssets','assetDepreciations','currencies','exchangeRates','costCenters','importBatches','integrationConnections','integrationOutbox','phase5Audit'])if(!all['core.js'].includes("'"+coll+"'")||!all['sync.js'].includes(coll))throw new Error('Phase5 persistence missing '+coll);
for(const v of ['view-inventory','view-assets','view-currency','view-data-center','view-integrations'])if(!index.includes('id="'+v+'"'))throw new Error('Phase5 workspace missing '+v);
for(const [view,module] of [['view-inventory','inventory'],['view-assets','assets'],['view-currency','accounting'],['view-data-center','settings'],['view-integrations','settings']])if(!all['ui.js'].includes("'"+view+"':'"+module+"'"))throw new Error('Phase5 IA v2 mapping missing '+view+' -> '+module);
if(!index.includes('phase5-domain.js')||!index.includes('phase5-enterprise.js')||!index.includes('data-module="inventory"')||!index.includes('data-module="assets"'))throw new Error('Phase5 IA v2 shell/scripts missing');
for(const legacy of ['data-module="home"','data-module="catalog"','data-module="erp"'])if(index.includes(legacy))throw new Error('Deprecated rail module remains '+legacy);
for(const required of ['data-module="dashboard"','<b>داشبورد</b>','ساختار مالی','ثبت و عملیات','دفاتر و کنترل','صورت‌های مالی و تحلیل','کدینگ حساب‌ها','تفصیلی‌های شناور'])if(!index.includes(required)&&!all['ui.js'].includes(required))throw new Error('Enterprise navigation contract missing '+required);

for(const x of ['prod-type-input','prod-category-input','prod-barcode-input','prod-min-stock-input','invoice-warehouse-id'])if(!index.includes('id="'+x+'"'))throw new Error('Phase5 refined master/source warehouse missing '+x);
for(const x of ["type:$('prod-type-input')","category:$('prod-category-input')","barcode:$('prod-barcode-input')","minStock:Math.max"])if(!all['operations.js'].includes(x))throw new Error('Phase5 product master persistence missing '+x);
for(const x of ['warehouseId','pur-warehouse'])if(!all['purchases.js'].includes(x))throw new Error('Phase5 purchase warehouse integration missing '+x);
for(const x of ['warehouseId','invoice-warehouse-id'])if(!all['invoices.js'].includes(x))throw new Error('Phase5 sales warehouse integration missing '+x);
for(const x of ['p5PostInventoryValue','invoiceCreatesAccountingEntry','p5PopulateWarehouseSelects'])if(!all['phase5-enterprise.js'].includes(x))throw new Error('Phase5 inventory integration missing '+x);

for(const x of ['p5SaveCompanyOpsSettings','p5-set-default-wh','p5-set-base-cur','RLS مالک‌محور'])if(!all['phase5-enterprise.js'].includes(x))throw new Error('Phase5 company settings/permission boundary missing '+x);

for(const x of ['p5ApplyRestore','importProductsFromExcel(event)','validated-backup.json'])if(!all['phase5-enterprise.js'].includes(x))throw new Error('Phase5 import center missing '+x);

const p6=all['phase6-reporting.js']||'';for(const x of ['ledger','cashFlow','projectContractSummary','legacyCutoverPreview','postLegacyInvoice'])if(!p6.includes(x))throw new Error('Phase6 report capability missing '+x);
if(!index.includes('id="view-accounting-reports"')||!index.includes('phase6-reporting.js'))throw new Error('Phase6 report workspace missing');


if(!all['journal-ui.js']?.includes("s.className='view-pane'")||all['journal-ui.js']?.includes('فاز ۳'))throw new Error('Journal workspace must be isolated as a view-pane without development phase labels');
for(const id of ['company-sector','company-legal-form','company-organization-box','company-registration-box','company-national-label'])if(!ids.includes(id))throw new Error('Company legal identity control missing #'+id);
if(!all['companies.js'].includes("reg_number:entity_type==='legal'")||!all['companies.js'].includes("organizationRole=entity_type==='legal'"))throw new Error('Natural-person company records must not retain legal-entity registration/group metadata');
if(index.includes('class="panel-collapse"'))throw new Error('Disappearing panel close button must not return; use persistent edge handle');

for(const id of ['modal-user-onboarding','onboarding-full-name','onboarding-professional-role','company-organization-role','company-parent-id','modal-license-company-limit'])if(!ids.includes(id))throw new Error('Accountant-first UX control missing #'+id);
for(const id of ['af-account-search','af-account-level-filter','af-account-type-filter','af-account-active-filter'])if(!all['accounting-foundation-ui.js'].includes('id="'+id+'"'))throw new Error('Chart-of-Accounts UX control missing #'+id);
if(!index.includes('title="پیمان‌ها"')||!all['ui.js'].includes("projects:{title:'پیمان‌ها'"))throw new Error('Primary projects subsystem must be visibly named پیمان‌ها');
if(!all['core.js'].includes('PROFESSIONAL_ROLE_LABELS')||!all['core.js'].includes('saveUserOnboarding'))throw new Error('Professional onboarding contract missing');
