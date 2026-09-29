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
const rules=[],dimensions=[],dimensionValues=[];
const ctx={console,datastore,currentUser:{id:'U1'},requireWrite:()=>true,afCompanyId:()=> 'C1',afId:p=>p+'_'+(++seq),toEnDigits:String,getJalaliNumeric:()=> '1405/07/07',
getMyFiscalYears:()=>fiscal,getMyAccounts:()=>accounts,getMyAccountDimensionRules:()=>rules,getMyDimensionTypes:()=>dimensions,afResolvedValues:t=>dimensionValues.filter(v=>v.dimensionTypeId===t.id),saveDatastore:()=>true,
getMyInvoices:()=>[],getMyPurchases:()=>[],getMyPayments:()=>[],getMyExpenses:()=>[]};
vm.createContext(ctx);vm.runInContext(source,ctx);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
ctx.jeEnsureDefaultProfiles();
let unbalanced=false;try{ctx.jeCreateDraft({date:'1405/07/07',description:'bad',sourceType:'manual',sourceId:'BAD1',lines:[{accountId:'cash',debit:100,credit:0,dimensions:[]},{accountId:'rev',debit:0,credit:90,dimensions:[]}]})}catch(_){unbalanced=true}assert(unbalanced,'unbalanced journal must be rejected');
dimensions.push({id:'D_PARTY',sourceEntity:'contact',active:true});dimensionValues.push({id:'CUST1',dimensionTypeId:'D_PARTY',postable:true},{id:'OTHER',dimensionTypeId:'D_PARTY',postable:false});rules.push({accountId:'ar',dimensionTypeId:'D_PARTY',applicability:'required',active:true});
let missingDim=false;try{ctx.jeCreateDraft({date:'1405/07/07',description:'missing dim',sourceType:'manual',sourceId:'BAD2',lines:[{accountId:'ar',debit:100,credit:0,dimensions:[]},{accountId:'rev',debit:0,credit:100,dimensions:[]}]})}catch(_){missingDim=true}assert(missingDim,'required analytic dimension must be enforced');
let invalidDim=false;try{ctx.jeCreateDraft({date:'1405/07/07',description:'invalid dim',sourceType:'manual',sourceId:'BAD3',lines:[{accountId:'ar',debit:100,credit:0,dimensions:[{dimensionTypeId:'D_PARTY',dimensionValueId:'OTHER'}]},{accountId:'rev',debit:0,credit:100,dimensions:[]}]})}catch(_){invalidDim=true}assert(invalidDim,'non-postable analytic value must be rejected');
rules.push({accountId:'rev',dimensionTypeId:'D_PARTY',applicability:'unavailable',active:true});
let forbiddenDim=false;try{ctx.jeCreateDraft({date:'1405/07/07',description:'forbidden dim',sourceType:'manual',sourceId:'BAD4',lines:[{accountId:'cash',debit:100,credit:0,dimensions:[]},{accountId:'rev',debit:0,credit:100,dimensions:[{dimensionTypeId:'D_PARTY',dimensionValueId:'CUST1'}]}]})}catch(_){forbiddenDim=true}assert(forbiddenDim,'unavailable analytic dimension must be rejected');
let duplicateDim=false;try{ctx.jeCreateDraft({date:'1405/07/07',description:'duplicate dim',sourceType:'manual',sourceId:'BAD5',lines:[{accountId:'ar',debit:100,credit:0,dimensions:[{dimensionTypeId:'D_PARTY',dimensionValueId:'CUST1'},{dimensionTypeId:'D_PARTY',dimensionValueId:'CUST1'}]},{accountId:'rev',debit:0,credit:100,dimensions:[]}]})}catch(_){duplicateDim=true}assert(duplicateDim,'duplicate analytic assignment must be rejected');
const receipt={id:'PAY1',date:'1405/07/07',amount:125000,contactId:'CUST1'};
const v=ctx.jePostSourceRecord('receipt',receipt);
assert(v.status==='posted','receipt must post');
const lines=datastore.journalLines.filter(x=>x.voucherId===v.id);
assert(lines.reduce((s,x)=>s+x.debit,0)===lines.reduce((s,x)=>s+x.credit,0),'receipt must balance');
assert(v.fiscalYearId==='FY1','Jalali fiscal year resolution failed');
let dup=false;try{ctx.jePostSourceRecord('receipt',{...receipt,journalVoucherId:''})}catch(_){dup=true}assert(dup,'duplicate source/version must fail');
const rv=ctx.jeReverse(v.id,'1405/07/08','test reversal');
assert(v.status==='reversed'&&rv.status==='posted','reversal lifecycle failed');
let mutationBlocked=false;try{ctx.jeGuardSourceMutation(receipt,'receipt')}catch(_){mutationBlocked=true}assert(mutationBlocked,'reversed source mutation must fail');
let repostBlocked=false;try{ctx.jePostSourceRecord('receipt',receipt)}catch(_){repostBlocked=true}assert(repostBlocked,'reversed source repost must fail');
assert(ctx.jeTrialBalance().every(x=>Math.abs(x.balance)<0.0001),'reversal must net original ledger to zero');
const ev=ctx.jePostSourceRecord('expense',{id:'EXP_OK',date:'1405/07/08',amount:700});assert(ev.status==='posted','expense source must post');const iv=ctx.jePostSourceRecord('income',{id:'INC_OK',date:'1405/07/08',amount:900});assert(iv.status==='posted','income source must post');
fiscal[0].status='locked';let locked=false;try{ctx.jePostSourceRecord('expense',{id:'EXP1',date:'1405/07/09',amount:1000})}catch(_){locked=true}assert(locked,'locked fiscal year must reject posting');
console.log('Phase 3 behavioral accounting scenarios passed.');
