import fs from 'node:fs';
const ui=fs.readFileSync('js/ui.js','utf8');
const contacts=fs.readFileSync('js/contacts.js','utf8');
const commerce=fs.readFileSync('js/commercial-rnd.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const purchase=fs.readFileSync('js/purchases.js','utf8');
function ok(v,m){if(!v)throw new Error(m);}
ok(ui.includes("['فاکتورها','view-invoices'"),'Commerce must expose one invoice workspace.');
ok(!ui.includes("['فاکتور خرید','view-purchases'"),'Purchase must not be a separate Commerce menu item.');
ok(contacts.includes("FINORA_QUICK_CONTACT_ROLE"),'Quick contact must preserve customer/supplier context.');
ok(commerce.includes("openQuickContactModal('supplier')"),'Purchase must support quick supplier creation.');
ok(commerce.includes('downloadInvoiceItemsExcelTemplate')&&commerce.includes('purDownloadExcelTemplate'),'Both invoice imports need downloadable templates.');
ok(commerce.includes("FACTORY_PRESERVE=new Set(['companies','settings'])"),'Factory reset must preserve company/settings.');
ok(commerce.includes("companies.length>1&&candidates.some"),'Factory reset must fail closed for legacy unscoped multi-company data.');
ok(commerce.includes("company.accountingTemplate=''")&&commerce.includes("company.activityType=''"),'Factory reset must restart accounting setup.');
ok(html.includes('js/commercial-rnd.js'),'Commerce slice must be loaded.');
ok(purchase.includes("jePostSourceRecord('purchase',record)"),'Purchase posting must remain automatic.');
console.log('Commercial R&D invariants passed.');