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


const scriptSrc=[...index.matchAll(/<script\s+src="([^"]+)"/g)].map(m=>m[1].split('?')[0]);
const duplicateScripts=[...new Set(scriptSrc.filter((s,i)=>scriptSrc.indexOf(s)!==i))];
if(duplicateScripts.length)throw new Error('Duplicate script loads: '+duplicateScripts.join(', '));
const files=fs.readdirSync(path.join(root,'js')).filter(n=>n.endsWith('.js'));
const all=Object.fromEntries(files.map(n=>[n,fs.readFileSync(path.join(root,'js',n),'utf8')]));
const must={
  'invoices.js':['function commitSaveInvoice','function editInvoice','paymentMethod'],
  'print.js':['function renderAndPrintDirect','FORMAL_ROWS_PER_PAGE=12','size: A4 portrait','size: A5 landscape'],
  'purchases.js':['window.purSave=function','window.purEdit=function','window.purPrint=function','window.purRefreshProjects=function','pur-payment-method','companyId'],
  'projects.js':['editContactProject','deleteContactProject','addSubproject','editSubproject','deleteSubproject','usedExpense'],
  'operations.js':['editContact','editProduct','editCheque','editExpense','deleteInvoice','refreshExpenseProjects','projectId','getMyPayments','companyId'],
  'payments.js':['commitSavePayment','invoiceOutstanding','purchaseOutstanding','amount>outstanding',"direction!=='inbound'","direction!=='outbound'",'projectId',"paymentMethod!=='credit'"],
  'accounting.js':['productMovement','getInventorySnapshot','getProjectFinancials','accrualProfit','cashNet'],
'drilldown.js':['openContactLedger','openDashboardDetail','openReportDetail',"status==='cleared'"],
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
