import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function fixture(file){
 const elements=new Map(),calls=[],alerts=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'',style:{},options:[],selectedIndex:0,innerHTML:'',textContent:'',className:''});return elements.get(id)};
 const ds={payments:[],expenses:[],cheques:[],invoices:[],purchases:[]};
 const c={console,Date,datastore:ds,currentUser:{id:'u'},document:{getElementById:element,querySelectorAll:()=>[],querySelector:()=>null,addEventListener:()=>{}},requireWrite:()=>true,getMyCompanies:()=>[{id:'c'}],getMySettings:()=>({default_company_id:'c'}),getMyContacts:()=>[{id:'person',name:'Person',projects:[]}],getMyPayments:()=>ds.payments,getMyExpenses:()=>ds.expenses,getMyInvoices:()=>ds.invoices,getMyPurchases:()=>ds.purchases,getMyCheques:()=>ds.cheques,getMyProducts:()=>[],getJalaliNumeric:()=> '1405/07/06',saveDatastore:()=>{},refreshAllSurfaces:()=>{},renderProducts:()=>{},renderInvoices:()=>{},switchView:()=>{},parseFormattedNumber:Number,esc:String,alert:m=>alerts.push(m),confirm:()=>true,jeGuardSourceMutation:()=>{},jeGuardSourceDeletion:()=>{throw Error('history protected')},jeSaveOperationalRecord:(kind,record)=>{calls.push({kind,record});throw Error('test rejection')}};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../js/'+file,import.meta.url),'utf8'),c);
 return {c,ds,element,calls,alerts};
}
for(const edited of [false,true])test(`payment ${edited?'edit':'create'} delegates atomically and retains form on failure`,()=>{
 const {c,ds,element,calls,alerts}=fixture('payments.js');
 if(edited){ds.payments.push({id:'old',ownerUserId:'u',contactId:'person',amount:10,direction:'inbound',method:'bank'});c.editPayment('old')}
 element('pay-contact').value='person';element('pay-direction').value='inbound';element('pay-amount').value='25';element('pay-method').value='bank';
 c.commitSavePayment();assert.equal(calls.length,1);assert.equal(calls[0].record.amount,25);assert.equal(ds.payments.length,edited?1:0);if(edited)assert.equal(ds.payments[0].amount,10);assert.equal(element('pay-amount').value,'25');assert.match(alerts.at(-1),/test rejection/);
});
for(const edited of [false,true])test(`expense ${edited?'edit':'create'} delegates atomically and retains form on failure`,()=>{
 const {c,ds,element,calls}=fixture('operations.js');
 if(edited){ds.expenses.push({id:'old',ownerUserId:'u',contactId:'person',amount:10,kind:'expense'});c.editExpense('old')}
 element('trx-contact-select').value='person';element('trx-kind-input').value='expense';element('trx-amount-input').value='25';
 c.commitSaveExpense();assert.equal(calls.length,1);assert.equal(ds.expenses.length,edited?1:0);if(edited)assert.equal(ds.expenses[0].amount,10);assert.equal(element('trx-amount-input').value,'25');
});
test('payment deletion protects reversed journal history',()=>{const {c,ds}=fixture('payments.js');ds.payments.push({id:'old',ownerUserId:'u'});c.deletePayment('old');assert.equal(ds.payments.length,1)});
test('journal uses routed pane and clears successful manual submission',()=>{
 const {c,element}=fixture('journal-ui.js');let section; c.document.getElementById=id=>id==='view-journal'?null:element(id);c.document.createElement=()=>({});c.document.querySelector=()=>({appendChild:s=>{section=s},insertBefore:s=>{section=s}});c.ensureJournalView();assert.equal(section.className,'view-pane');
 c.jeCollectRows=()=>[];c.jeCreateDraft=()=>({number:'1'});c.renderJournal=()=>{};element('je-lines').innerHTML='previous rows';element('je-desc').value='previous';c.jeSaveManual();assert.equal(element('je-lines').innerHTML,'');assert.equal(element('je-desc').value,'');
});
for(const edited of [false,true])test(`invoice ${edited?'edit':'create'} delegates without mutating source on rejection`,()=>{
 const {c,ds,element,calls}=fixture('invoices.js');c.getCurrencyLabel=()=> 'ریال';c.recomputeTotals=()=>({grandTotal:25,subtotal:25});
 const row={querySelector:sel=>sel==='.row-product-select'?{value:'prod',options:[{text:'Product'}],selectedIndex:0}:{value:sel==='.row-quantity'?'1':'25'}};c.document.querySelectorAll=()=>[row];
 element('invoice-company-id').value='c';element('invoice-number').value='new';element('invoice-kind').value='non_formal';
 if(edited){ds.invoices.push({id:'old',ownerUserId:'u',grandTotal:10});element('edit-invoice-id').value='old'}
 c.commitSaveInvoice();assert.equal(calls.length,1);assert.equal(calls[0].record.grandTotal,25);assert.equal(ds.invoices.length,edited?1:0);if(edited)assert.equal(ds.invoices[0].grandTotal,10);
});
for(const edited of [false,true])test(`purchase ${edited?'edit':'create'} delegates without mutating source on rejection`,()=>{
 const {c,ds,element,calls}=fixture('purchases.js');c.purRecalc=()=>({sub:25,disc:0,vat:0,grand:25});
 const row={querySelector:sel=>sel==='.pur-prod'?{value:'prod',options:[{text:'Product'}],selectedIndex:0}:{value:sel==='.pur-qty'?'1':'25'}};c.document.querySelectorAll=()=>[row];
 element('pur-supplier').value='person';element('pur-supplier').options=[{text:'Person'}];element('pur-number').value='new';if(edited){ds.purchases.push({id:'old',ownerUserId:'u',grandTotal:10});element('pur-edit-id').value='old'}
 c.purSave();assert.equal(calls.length,1);assert.equal(calls[0].record.grandTotal,25);assert.equal(ds.purchases.length,edited?1:0);if(edited)assert.equal(ds.purchases[0].grandTotal,10);
});
for(const [file,collection,method] of [['operations.js','expenses','deleteExpense'],['operations.js','invoices','deleteInvoice'],['purchases.js','purchases','purDelete'],['operations.js','cheques','deleteCheque']])test(`${collection} deletion preserves linked journal history`,()=>{const {c,ds}=fixture(file);ds[collection].push({id:'old',ownerUserId:'u'});c[method]('old');assert.equal(ds[collection].length,1)});
test('journal resets stale account rows when active company changes',()=>{
 const {c,element}=fixture('journal-ui.js');c.afCompanyId=()=> 'new-company';c.jeEnsureDefaultProfiles=()=>{};c.getMyJournalVouchers=()=>[];c.jeTrialBalance=()=>[];let added=0;c.jeAddRow=()=>added++;
 element('je-lines').dataset={scope:'u|old-company'};element('je-lines').innerHTML='old account rows';element('je-desc').value='old description';c.renderJournal();assert.equal(element('je-lines').dataset.scope,'u|new-company');assert.equal(element('je-lines').innerHTML,'');assert.equal(element('je-desc').value,'');assert.equal(added,2);
});
test('fully settled invoice stays available while editing its receipt',()=>{
 const {c,ds,element}=fixture('payments.js');ds.invoices.push({id:'inv',companyId:'c',contactId:'person',grandTotal:10,paymentMethod:'credit'});ds.payments.push({id:'old',ownerUserId:'u',contactId:'person',amount:10,direction:'inbound',method:'bank',invoiceType:'sale',invoiceId:'inv'});c.editPayment('old');assert.match(element('pay-invoice').innerHTML,/sale\|inv/);
});
