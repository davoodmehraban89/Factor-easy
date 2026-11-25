import fs from 'node:fs';import vm from 'node:vm';
const accounts=[{id:'A1',code:'X-01',title:'منبع مالی یک',systemRole:'cash_default',accountType:'asset',postingAllowed:true},{id:'A2',code:'X-02',title:'عنوان سفارشی درآمد',accountType:'revenue',postingAllowed:true},{id:'A3',code:'X-03',title:'عنوان سفارشی هزینه',accountType:'expense',postingAllowed:true},{id:'A4',code:'X-04',title:'کنترل دارایی الف',systemRole:'receivable_control',accountType:'asset',postingAllowed:true},{id:'A5',code:'X-05',title:'کنترل بدهی ب',systemRole:'payable_control',accountType:'liability',postingAllowed:true},{id:'A6',code:'X-06',title:'تراز افتتاحی',accountType:'equity',postingAllowed:true}];
const vouchers={V1:{id:'V1',number:'1',date:'1405/01/01',status:'posted',sourceType:'sale'},V2:{id:'V2',number:'2',date:'1405/01/02',status:'posted',sourceType:'expense'},V3:{id:'V3',number:'3',date:'1405/01/01',status:'posted',sourceType:'opening'},V4:{id:'V4',number:'4',date:'1405/02/20',status:'posted',sourceType:'opening'}};
const rows=[{id:'L1',voucherId:'V1',accountId:'A1',debit:100,credit:0,voucher:vouchers.V1,account:accounts[0]},{id:'L2',voucherId:'V1',accountId:'A2',debit:0,credit:100,voucher:vouchers.V1,account:accounts[1]},{id:'L3',voucherId:'V2',accountId:'A3',debit:30,credit:0,voucher:vouchers.V2,account:accounts[2]},{id:'L4',voucherId:'V2',accountId:'A1',debit:0,credit:30,voucher:vouchers.V2,account:accounts[0]},{id:'L5',voucherId:'V3',accountId:'A4',debit:40,credit:0,voucher:vouchers.V3,account:accounts[3]},{id:'L6',voucherId:'V3',accountId:'A6',debit:0,credit:40,voucher:vouchers.V3,account:accounts[5]},{id:'L7',voucherId:'V4',accountId:'A6',debit:25,credit:0,voucher:vouchers.V4,account:accounts[5]},{id:'L8',voucherId:'V4',accountId:'A5',debit:0,credit:25,voucher:vouchers.V4,account:accounts[4]}];
const ctx={window:{},console,jeLedgerRows:()=>rows,getMyAccounts:()=>accounts,getMyJournalLineDimensions:()=>[{journalLineId:'L1',dimensionValueId:'D1'}],getMyDimensionTypes:()=>[],getMyGlobalProjects:()=>[{id:'PR1',name:'پروژه آزمون'}],getMyContracts:()=>[{id:'C1',projectId:'PR1',value:500}],getMyContractStatements:()=>[{id:'ST1',contractId:'C1',status:'posted',netAmount:120}],p4ContractProfit:()=>({profit:45}),getMyInvoices:()=>[{id:'I1',number:'11',date:'1405/01/01',kind:'formal',grandTotal:100}],jeActiveSourceVoucher:()=>null,jeReceivableAccount:()=>accounts[3],jePayableAccount:()=>accounts[4],jeRevenueAccount:()=>({id:'REV'}),jeCashAccount:()=>accounts[0],getJalaliNumeric:()=> '1405/01/30',requireWrite:()=>true,confirm:()=>false,esc:x=>String(x)};vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/phase6-reporting.js','utf8'),ctx);const P=ctx.window.P6Reports;if(!P)throw new Error('P6Reports not exported');
const f=P.financials('1405/01/01','1405/01/31');if(f.revenue!==100||f.expense!==30||f.profit!==70)throw new Error('profit/loss mismatch');
const cf=P.cashFlow('1405/01/01','1405/01/31');if(cf.operating!==70||cf.total!==70)throw new Error('cash-flow mismatch');const age=P.aging('1405/03/15');if(age.receivable['61-90']!==40||age.payable['0-30']!==25)throw new Error('role-aware AR/AP aging mismatch');const pc=P.projectContractSummary();if(pc.length!==1||pc[0].contracts!==1||pc[0].value!==500||pc[0].statements!==120||pc[0].profit!==45)throw new Error('project/contract consolidated report mismatch');
const l=P.ledger({dimensionValueId:'D1'});if(l.length!==1||l[0].id!=='L1')throw new Error('analytic ledger filter mismatch');
const cut=P.legacyCutoverPreview();if(cut.length!==1||cut[0].readiness!=='ready')throw new Error('legacy cutover preview mismatch');
const dr=P.rollup().reduce((s,x)=>s+x.debit,0),cr=P.rollup().reduce((s,x)=>s+x.credit,0);if(dr!==cr)throw new Error('trial balance mismatch');
console.log('Phase 6 reporting/reconciliation scenarios passed.');
const perfVoucher={id:'VP',number:'P',date:'1405/01/15',status:'posted',sourceType:'performance'};const baseLen=rows.length;for(let i=0;i<10000;i++){rows.push({id:'PD'+i,voucherId:'VP',accountId:'A3',debit:1,credit:0,voucher:perfVoucher,account:accounts[2]},{id:'PC'+i,voucherId:'VP',accountId:'A2',debit:0,credit:1,voucher:perfVoucher,account:accounts[1]})}
const perfStart=Date.now(),perfRoll=P.rollup('1405/01/01','1405/01/31'),perfFin=P.financials('1405/01/01','1405/01/31'),perfLedger=P.ledger({from:'1405/01/01',to:'1405/01/31'}),perfMs=Date.now()-perfStart;if(perfRoll.reduce((s,x)=>s+x.debit,0)!==perfRoll.reduce((s,x)=>s+x.credit,0))throw new Error('large-dataset trial balance mismatch');if(perfFin.revenue!==10100||perfFin.expense!==10030||perfFin.profit!==70)throw new Error('large-dataset financial report mismatch');if(perfLedger.length!==20006)throw new Error('large-dataset ledger row loss: expected 20006, got '+perfLedger.length);if(perfMs>5000)throw new Error('large-dataset reporting performance regression: '+perfMs+'ms for '+perfLedger.length+' rows');console.log('Phase 6 20k-line reporting performance passed in '+perfMs+'ms.');

 // G01: exercise the actual journal read projection rather than a pre-filtered
 // jeLedgerRows stub. Synthetic historical rows only: no save/post operations.
 {
  const ownerUserId='G01_QA',companyId='G01_COMPANY';
  const book={journalVouchers:[],journalLines:[],journalLineDimensions:[]};
  const a=[
   {id:'AR',code:'1102',title:'Receivable',accountType:'asset',postingAllowed:true},
   {id:'REV',code:'4101',title:'Revenue',accountType:'revenue',postingAllowed:true},
   {id:'EXP',code:'5101',title:'Expense',accountType:'expense',postingAllowed:true},
   {id:'AP',code:'2101',title:'Payable',accountType:'liability',postingAllowed:true}
  ];
  const add=(id,date,status,amount,debitAccount,creditAccount)=>{
   book.journalVouchers.push({id,number:id,date,status,ownerUserId,companyId,totalDebit:amount,totalCredit:amount});
   book.journalLines.push({id:id+'D',voucherId:id,accountId:debitAccount,debit:amount,credit:0,ownerUserId,companyId},
    {id:id+'C',voucherId:id,accountId:creditAccount,debit:0,credit:amount,ownerUserId,companyId});
  };
  add('SALE','1405/01/01','reversed',100,'AR','REV');
  add('PURCHASE','1405/01/02','posted',170,'EXP','AP');
  add('REVERSAL','1405/01/03','posted',100,'REV','AR');
  add('REPLACEMENT','1405/01/03','posted',120,'AR','REV');
  add('DRAFT','1405/01/04','draft',999,'AR','REV');
  const before=JSON.stringify(book);
  const actual={window:{},console,datastore:book,currentUser:{id:ownerUserId},afCompanyId:()=>companyId,getMyAccounts:()=>a};
  vm.createContext(actual);
  vm.runInContext(fs.readFileSync('js/journal-engine.js','utf8'),actual);
  vm.runInContext(fs.readFileSync('js/phase6-reporting.js','utf8'),actual);
  const reports=actual.window.P6Reports;
  const check=(label,got,want)=>{
   if(JSON.stringify(got)!==JSON.stringify(want))throw new Error('G01 '+label+': '+JSON.stringify({got,want}));
  };
  const result=(from,to)=>{
   const f=reports.financials(from,to);
   return {revenue:f.revenue,expense:f.expense,profit:f.profit,assets:f.assets,liabilities:f.liabilities,
    debit:f.trial.reduce((s,x)=>s+x.debit,0),credit:f.trial.reduce((s,x)=>s+x.credit,0)};
  };
  check('before correction',result('1405/01/01','1405/01/02'),
   {revenue:100,expense:170,profit:-70,assets:100,liabilities:170,debit:270,credit:270});
  check('after reversal and replacement',result('1405/01/01','1405/01/04'),
   {revenue:120,expense:170,profit:-50,assets:120,liabilities:170,debit:490,credit:490});
  const ledger=reports.ledger({});
  check('effective voucher IDs',[...new Set(ledger.map(x=>x.voucherId))].sort(),['PURCHASE','REPLACEMENT','REVERSAL','SALE']);
  check('effective line count',ledger.length,8);
  check('account balances',reports.rollup().map(x=>[x.accountId,x.balance]),
   [['AR',120],['AP',-170],['REV',-120],['EXP',170]]);
  check('draft only date',result('1405/01/04','1405/01/04'),
   {revenue:0,expense:0,profit:0,assets:0,liabilities:0,debit:0,credit:0});
  check('read projection preserves journal input',JSON.stringify(book),before);
  console.log('G01 actual journal/report reconciliation passed: draft exclusion, reversal, replacement, date range and read-only input.');
 }
