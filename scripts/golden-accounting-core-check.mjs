import fs from 'node:fs';
import vm from 'node:vm';

let seq=0;
const datastore={postingProfiles:[],journalVouchers:[],journalLines:[],journalLineDimensions:[]};
const accounts=[
 {id:'cash',code:'X-CASH',systemRole:'cash_default',title:'منبع مالی الف',accountType:'asset',active:true,postingAllowed:true},
 {id:'ar',code:'X-AR',systemRole:'receivable_control',title:'کنترل دارایی ب',accountType:'asset',active:true,postingAllowed:true},
 {id:'vatrec',code:'X-VATREC',systemRole:'vat_recoverable',title:'کنترل دارایی ج',accountType:'asset',active:true,postingAllowed:true},
 {id:'ap',code:'X-AP',systemRole:'payable_control',title:'کنترل بدهی د',accountType:'liability',active:true,postingAllowed:true},
 {id:'vatpay',code:'X-VATPAY',systemRole:'vat_payable',title:'کنترل بدهی ه',accountType:'liability',active:true,postingAllowed:true},
 {id:'rev',code:'X-REV',systemRole:'revenue_default',title:'عملیات ر',accountType:'revenue',active:true,postingAllowed:true},
 {id:'inc',code:'X-INC',systemRole:'other_income_default',title:'عملیات ز',accountType:'revenue',active:true,postingAllowed:true},
 {id:'buy',code:'X-BUY',systemRole:'purchase_default',title:'عملیات س',accountType:'expense',active:true,postingAllowed:true},
 {id:'exp',code:'X-EXP',systemRole:'expense_default',title:'عملیات ش',accountType:'expense',active:true,postingAllowed:true}
];
const fiscal=[{id:'FY1',startDate:'1405/01/01',endDate:'1405/12/29',status:'open'}];
const ctx={window:{},console,datastore,currentUser:{id:'U1'},requireWrite:()=>true,afCompanyId:()=> 'C1',afId:p=>p+'_'+(++seq),toEnDigits:String,getJalaliNumeric:()=> '1405/07/07',
 getMyFiscalYears:()=>fiscal,getMyAccounts:()=>accounts,getMyAccountDimensionRules:()=>[],getMyDimensionTypes:()=>[],afResolvedValues:()=>[],saveDatastore:()=>true,
 getMyJournalLineDimensions:()=>datastore.journalLineDimensions,getMyGlobalProjects:()=>[],getMyContracts:()=>[],getMyInvoices:()=>[],confirm:()=>false,esc:String};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/journal-engine.js','utf8'),ctx);
ctx.jeEnsureDefaultProfiles();

const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const sale={id:'S1',date:'1405/07/01',grandTotal:110,vat:10,paymentMethod:'credit',accountingVersion:1};
const saleV=ctx.jePostSourceRecord('sale',sale);
const receiptV=ctx.jePostSourceRecord('receipt',{id:'R1',date:'1405/07/02',amount:110,accountingVersion:1});
const purchase={id:'P1',date:'1405/07/03',grandTotal:55,vat:5,paymentMethod:'credit',accountingVersion:1};
const purchaseV=ctx.jePostSourceRecord('purchase',purchase);
const paymentV=ctx.jePostSourceRecord('payment',{id:'PAY1',date:'1405/07/04',amount:55,accountingVersion:1});
const expense={id:'E1',date:'1405/07/05',amount:20,accountingVersion:1};
const expenseV=ctx.jePostSourceRecord('expense',expense);
const incomeV=ctx.jePostSourceRecord('income',{id:'I1',date:'1405/07/06',amount:7,accountingVersion:1});
ctx.jeReverse(expenseV.id,'1405/07/07','golden journey reversal');

for(const v of [saleV,receiptV,purchaseV,paymentV,expenseV,incomeV]){
 const lines=datastore.journalLines.filter(x=>x.voucherId===v.id);
 assert(lines.reduce((s,x)=>s+x.debit,0)===lines.reduce((s,x)=>s+x.credit,0),'voucher '+v.id+' is not balanced');
}
const tb=ctx.jeTrialBalance(),by=id=>tb.find(x=>x.accountId===id)||{debit:0,credit:0,balance:0};
assert(by('ar').balance===0,'receivable did not settle to zero');
assert(by('ap').balance===0,'payable did not settle to zero');
assert(by('vatpay').balance===-10,'sales VAT liability mismatch');
assert(by('vatrec').balance===5,'recoverable purchase VAT mismatch');
assert(by('cash').balance===62,'cash reconciliation mismatch');
assert(Math.abs(tb.reduce((s,x)=>s+x.balance,0))<0.0001,'trial balance does not reconcile');

vm.runInContext(fs.readFileSync('js/phase6-reporting.js','utf8'),ctx);
const f=ctx.window.P6Reports.financials('1405/07/01','1405/07/31');
assert(f.revenue===107,'revenue report mismatch: expected 107, got '+f.revenue);
assert(f.expense===50,'expense report mismatch after reversal: expected 50, got '+f.expense);
assert(f.profit===57,'profit report mismatch: expected 57, got '+f.profit);
console.log('Golden accounting core journey passed: sale -> receipt -> purchase -> payment -> expense/income -> reversal -> trial balance -> financial statements.');
