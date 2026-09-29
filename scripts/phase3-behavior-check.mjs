import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('js/journal-engine.js','utf8');
let seq=0;
const datastore={postingProfiles:[],journalVouchers:[],journalLines:[],journalLineDimensions:[]};
const accounts=[
{id:'cash',code:'1101',title:'بانک',active:true,postingAllowed:true},{id:'ar',code:'1102',title:'دریافتنی',active:true,postingAllowed:true},
{id:'ap',code:'2101',title:'پرداختنی',active:true,postingAllowed:true},{id:'vatp',code:'2102',title:'مالیات پرداختنی',active:true,postingAllowed:true},
{id:'rev',code:'4101',title:'فروش',active:true,postingAllowed:true},{id:'buy',code:'5101',title:'خرید',active:true,postingAllowed:true},
{id:'exp',code:'6103',title:'هزینه',active:true,postingAllowed:true},{id:'inc',code:'4201',title:'سایر درآمد',active:true,postingAllowed:true}];
const fiscal=[{id:'FY1',startDate:'1405/01/01',endDate:'1405/12/29',status:'open'}];
const ctx={console,datastore,currentUser:{id:'U1'},requireWrite:()=>true,afCompanyId:()=> 'C1',afId:p=>p+'_'+(++seq),toEnDigits:String,getJalaliNumeric:()=> '1405/07/07',
getMyFiscalYears:()=>fiscal,getMyAccounts:()=>accounts,getMyAccountDimensionRules:()=>[],getMyDimensionTypes:()=>[],afResolvedValues:()=>[],saveDatastore:()=>true,
getMyInvoices:()=>[],getMyPurchases:()=>[],getMyPayments:()=>[],getMyExpenses:()=>[]};
vm.createContext(ctx);vm.runInContext(source,ctx);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
ctx.jeEnsureDefaultProfiles();
const receipt={id:'PAY1',date:'1405/07/07',amount:125000,contactId:'CUST1'};
const v=ctx.jePostSourceRecord('receipt',receipt);
assert(v.status==='posted','receipt must post');
const lines=datastore.journalLines.filter(x=>x.voucherId===v.id);
assert(lines.reduce((s,x)=>s+x.debit,0)===lines.reduce((s,x)=>s+x.credit,0),'receipt must balance');
assert(v.fiscalYearId==='FY1','Jalali fiscal year resolution failed');
let dup=false;try{ctx.jePostSourceRecord('receipt',{...receipt,journalVoucherId:''})}catch(_){dup=true}assert(dup,'duplicate source/version must fail');
const rv=ctx.jeReverse(v.id,'1405/07/08','test reversal');
assert(v.status==='reversed'&&rv.status==='posted','reversal lifecycle failed');
assert(ctx.jeTrialBalance().every(x=>Math.abs(x.balance)<0.0001),'reversal must net original ledger to zero');
fiscal[0].status='locked';let locked=false;try{ctx.jePostSourceRecord('expense',{id:'EXP1',date:'1405/07/09',amount:1000})}catch(_){locked=true}assert(locked,'locked fiscal year must reject posting');
console.log('Phase 3 behavioral accounting scenarios passed.');
