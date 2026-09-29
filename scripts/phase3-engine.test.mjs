import test from 'node:test';
import assert from 'node:assert/strict';
import {journalFixture, sale} from './test-helpers/journal-fixture.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
function manual(app, overrides = {}) {
  const cash = app.state.accounts.find(a=>a.code==='1101').id;
  const revenue = app.state.accounts.find(a=>a.code==='4101').id;
  return {date:'1405/07/06',lines:[{accountId:cash,debit:100,credit:0},{accountId:revenue,debit:0,credit:100}],...overrides};
}

test('posted original and reversal cancel account balances, retaining both movements',()=>{
  const a=journalFixture(), v=a.context.jeCreateDraft(manual(a));a.context.jePost(v.id);a.context.jeReverse(v.id,'1405/07/06','correction');
  const rows=a.context.jeTrialBalance();
  assert.deepEqual(copy(rows.map(r=>[r.debit,r.credit,r.balance])),[[100,100,0],[100,100,0]]);
  assert.equal(a.context.jeLedgerRows().length,4);
});

test('Gregorian payment date posts in its Jalali fiscal year without opening journal UI',()=>{
  const a=journalFixture(); const v=a.context.jeAutoPost('receipt',sale({id:'receipt-a',amount:30,date:'2026-09-28T10:00:00.000Z'}));
  assert.equal(v.date,'1405/07/06');assert.equal(v.status,'posted');assert.equal(v.totalDebit,30);
});

test('failed duplicate source posting leaves no orphan draft or lines',()=>{
  const a=journalFixture();a.context.jeAutoPost('sale',sale());const before=copy(a.state);
  assert.throws(()=>a.context.jeAutoPost('sale',sale()));assert.deepEqual(copy(a.state),before);
});

test('duplicate voucher numbers in the same fiscal year are rejected',()=>{
  const a=journalFixture();a.context.jeCreateDraft(manual(a,{number:'17'}));
  assert.throws(()=>a.context.jeCreateDraft(manual(a,{number:'17'})));
});

test('posting revalidates a draft date against its fiscal year',()=>{
  const a=journalFixture(),v=a.context.jeCreateDraft(manual(a));v.date='1404/07/06';
  assert.throws(()=>a.context.jePost(v.id));assert.equal(v.status,'draft');
});

for(const value of [NaN,Infinity,-0.1])test(`invalid opposite-side amount ${String(value)} cannot be silently coerced to zero`,()=>{
  const a=journalFixture(), input=manual(a);input.lines[0].credit=value;
  assert.throws(()=>a.context.jeCreateDraft(input));assert.equal(a.state.journalVouchers.length,0);
});

test('duplicate assignments for a dimension are rejected instead of last-value-wins',()=>{
  const a=journalFixture(), input=manual(a), d=a.state.dimensionTypes.find(x=>x.sourceEntity==='branch');
  a.state.branches.push({id:'branch-a',ownerUserId:'user-a',companyId:'company-a',name:'Branch',active:true});
  input.lines[0].dimensions=[{dimensionTypeId:d.id,dimensionValueId:'invalid'},{dimensionTypeId:d.id,dimensionValueId:'branch-a'}];
  assert.throws(()=>a.context.jeCreateDraft(input));
});

test('unscoped posting accounts are not shared across companies',()=>{
  const a=journalFixture(), input=manual(a);delete a.state.accounts.find(x=>x.id===input.lines[0].accountId).companyId;
  assert.throws(()=>a.context.jeCreateDraft(input));
});

test('source company cannot silently post into the currently selected company',()=>{
  const a=journalFixture();assert.throws(()=>a.context.jeAutoPost('sale',sale({companyId:'company-b'})));
  assert.equal(a.state.journalVouchers.length,0);
});

test('pre-invoice is saved without a revenue journal',()=>{
  const a=journalFixture(), record=a.context.jeSaveOperationalRecord('sale',sale({kind:'pre_invoice'}));
  assert.equal(a.state.invoices.length,1);assert.equal(a.state.journalVouchers.length,0);assert.notEqual(record.accountingStatus,'posted');
});

test('legacy invoicing remains usable before accounting setup',()=>{
  const a=journalFixture({template:false});const record=a.context.jeSaveOperationalRecord('sale',sale());
  assert.equal(a.state.invoices.length,1);assert.equal(record.accountingStatus,'not_configured');assert.equal(a.state.journalVouchers.length,0);
});

test('partial accounting setup fails closed and preserves existing sources',()=>{
  const a=journalFixture();a.state.accounts=a.state.accounts.filter(x=>x.code!=='4101'&&x.code!=='4107');const before=copy(a.state);
  assert.throws(()=>a.context.jeSaveOperationalRecord('sale',sale()));assert.deepEqual(copy(a.state),before);
});

test('source reversal and correction produce new version and correct net balances',()=>{
  const a=journalFixture();const original=a.context.jeSaveOperationalRecord('sale',sale({grandTotal:100,vat:0}));
  a.context.jeReverse(original.journalVoucherId,'1405/07/06','wrong amount');
  const corrected=a.context.jeSaveOperationalRecord('sale',{...original,grandTotal:150});
  assert.equal(corrected.accountingVersion,2);assert.equal(a.state.invoices.length,1);assert.equal(a.state.journalVouchers.length,3);
  const ar=a.context.jeTrialBalance().find(r=>r.code==='1102');assert.equal(ar.balance,150);
});

test('a failed correction leaves old source and journal untouched',()=>{
  const a=journalFixture(), source=a.context.jeSaveOperationalRecord('sale',sale());a.context.jeReverse(source.journalVoucherId,'1405/07/06','correction');
  const before=copy(a.state);assert.throws(()=>a.context.jeSaveOperationalRecord('sale',{...source,date:'1404/01/01',grandTotal:200}));
  assert.deepEqual(copy(a.state),before);
});

test('source lock survives missing client-side voucher pointer',()=>{
  const a=journalFixture(),source=sale();a.context.jePostSourceRecord('sale',source);delete source.journalVoucherId;
  assert.throws(()=>a.context.jeGuardSourceMutation(source));
});

test('reversed journal history protects source from destructive deletion',()=>{
  const a=journalFixture(),source=sale();a.context.jePostSourceRecord('sale',source);a.context.jeReverse(source.journalVoucherId,'1405/07/06','correction');
  assert.throws(()=>a.context.jeGuardSourceDeletion(source));
});

test('cheque settlement is rejected before cash is recognized',()=>{
  const a=journalFixture();a.context.jeEnsureDefaultProfiles();const before=copy(a.state);
  assert.throws(()=>a.context.jeAutoPost('receipt',sale({amount:100,method:'cheque'})));
  assert.deepEqual(copy(a.state),before);
});

test('non-cash sales use configured posting profile accounts',()=>{
  const a=journalFixture();a.context.jeEnsureDefaultProfiles();
  const profile=a.state.postingProfiles.find(p=>p.kind==='sale'),custom=a.state.accounts.find(x=>x.code==='4107');profile.creditAccountId=custom.id;
  const v=a.context.jeAutoPost('sale',sale({grandTotal:100,vat:0}));
  assert.equal(a.state.journalLines.find(l=>l.voucherId===v.id&&l.credit===100).accountId,custom.id);
});

test('dimension rule of a posted account cannot be overwritten in place',()=>{
  const a=journalFixture();a.context.jeAutoPost('sale',sale());
  const rule=a.state.accountDimensionRules.find(r=>r.applicability==='required');
  for(const [id,value] of Object.entries({'af-rule-account':rule.accountId,'af-rule-dimension':rule.dimensionTypeId,'af-rule-app':'unavailable'}))a.elements.set(id,{value});
  a.context.afSaveRule();assert.equal(rule.applicability,'required');assert.ok(a.alerts.length);
});

test('backup import cannot overwrite a posted voucher or its lines',()=>{
  const a=journalFixture(),v=a.context.jeCreateDraft(manual(a));a.context.jePost(v.id);const before=copy(a.state);
  const line=a.state.journalLines[0];assert.throws(()=>a.context.absorbRecords({journalVouchers:[{...v,status:'draft'}],journalLines:[{...line,debit:999}]}));
  assert.deepEqual(copy(a.state),before);
});

test('backup import cannot replace an operational source locked by a journal',()=>{
  const a=journalFixture(),v=a.context.jeSaveOperationalRecord('sale',sale());const before=copy(a.state);
  assert.throws(()=>a.context.absorbRecords({invoices:[{...v,grandTotal:999}]}));assert.deepEqual(copy(a.state),before);
});

test('unbalanced and locked-year postings are rejected before any mutation',()=>{
  const a=journalFixture(),input=manual(a);input.lines[1].credit=90;assert.throws(()=>a.context.jeCreateDraft(input));
  a.state.fiscalYears[0].status='locked';assert.throws(()=>a.context.jeCreateDraft(manual(a)));assert.equal(a.state.journalVouchers.length,0);
});

test('switching active company does not unlock a previously posted source',()=>{
  const a=journalFixture(),source=a.context.jeSaveOperationalRecord('sale',sale());
  a.state.companies.push({id:'company-b',ownerUserId:'user-a'});a.run("getMySettings().default_company_id='company-b'");
  assert.throws(()=>a.context.jeGuardSourceMutation(source));assert.throws(()=>a.context.jeGuardSourceDeletion(source));
});

test('a reversal cannot itself be reversed and unlock a double-counted correction',()=>{
  const a=journalFixture(),source=a.context.jeSaveOperationalRecord('sale',sale({grandTotal:100,vat:0}));
  const reversal=a.context.jeReverse(source.journalVoucherId,'1405/07/06','correction');const before=copy(a.state);
  assert.throws(()=>a.context.jeReverse(reversal.id,'1405/07/06','undo correction'));
  assert.deepEqual(copy(a.state),before);
});

for(const date of ['2026-02-31','1405/12/30','1405/07/31'])test(`invalid calendar date ${date} is rejected without rollover`,()=>{
  const a=journalFixture();assert.throws(()=>a.context.jeDate(date));
});

test('valid leap day and localized short Jalali dates normalize correctly',()=>{
  const a=journalFixture();assert.equal(a.context.jeDate('۱۳۹۹/۱۲/۳۰'),'1399/12/30');assert.equal(a.context.jeDate('۱۴۰۵/۷/۶'),'1405/07/06');
});

test('an unchanged backup can be re-imported without replacing journal history',()=>{
  const a=journalFixture();a.context.jeSaveOperationalRecord('sale',sale());const before=copy(a.state);
  a.context.absorbRecords(copy(a.state));assert.deepEqual(copy(a.state),before);
});

test('journal import preflight rejects the whole file before applying unrelated records',()=>{
  const a=journalFixture();const before=copy(a.state);
  assert.throws(()=>a.context.absorbRecords({products:[{id:'new-product',name:'Must not persist'}],journalVouchers:[{id:'unvalidated',status:'posted'}]}));
  assert.deepEqual(copy(a.state),before);
});

test('read-only user cannot save sources or journals',()=>{
  const a=journalFixture();a.context.writable=false;const before=copy(a.state);
  assert.throws(()=>a.context.jeSaveOperationalRecord('sale',sale()));assert.throws(()=>a.context.jeCreateDraft(manual(a)));
  assert.deepEqual(copy(a.state),before);
});

for(const [kind,source,want] of [
  ['sale',sale({paymentMethod:'cash',grandTotal:100,vat:0}),[['1101',100,0],['4101',0,100]]],
  ['purchase',sale({paymentMethod:'credit',supplierId:'party-a',grandTotal:100,vat:0}),[['2101',0,100],['5101',100,0]]],
  ['receipt',sale({amount:30,method:'bank'}),[['1101',30,0],['1102',0,30]]],
  ['payment',sale({amount:40,method:'bank'}),[['1101',0,40],['2101',40,0]]],
  ['expense',sale({amount:50}),[['1101',0,50],['6103',50,0]]],
  ['income',sale({amount:60}),[['1101',60,0],['4201',0,60]]],
])test(`${kind} integration recognizes independently checked account movements`,()=>{
  const a=journalFixture();a.context.jeSaveOperationalRecord(kind,source);
  assert.deepEqual(copy(a.context.jeTrialBalance().map(r=>[r.code,r.debit,r.credit])),want);
});
