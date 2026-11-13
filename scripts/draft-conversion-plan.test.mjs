import test from 'node:test';
import assert from 'node:assert/strict';
import {planDraftConversion} from './lib/draft-conversion-plan.mjs';

const lines = (sign = 1, scope = 'A') => [
  {account:scope+'-AP', dimensions:['contact:C'], debit:sign > 0 ? '100' : '0', credit:sign > 0 ? '0' : '100'},
  {account:scope+'-BANK', dimensions:[], debit:sign > 0 ? '0' : '100', credit:sign > 0 ? '100' : '0'}
];
function voucher(id='J1', extra={}) {
  return {key:id, owner:'U', organization:'O', company:'A', status:'posted', sourceType:'sale',
    parent:null, reversal:null, fiscalOpen:true, childrenScopeValid:true, totalDebit:'100', totalCredit:'100', lines:lines(),
    source:{key:'I'+id, owner:'U', organization:'O', company:'A', voucher:id, electronicMetadata:false, dependencyCount:0}, ...extra};
}
function chain(count) {
  return Array.from({length:count}, (_,i)=>voucher('J'+(i+1), {
    status:i === count-1 ? 'posted' : 'reversed',
    reversal:i === count-1 ? null : 'J'+(i+2),
    parent:i ? 'J'+i : null, sourceType:i ? 'reversal' : 'sale',
    source:i ? null : voucher().source, lines:lines(i%2 ? -1 : 1)
  }));
}
const codes = rows => planDraftConversion(rows).blockers.map(x=>x.code);

test('one active journal produces a linked conversion candidate without mutating the graph',()=>{
  const rows=[voucher()], before=JSON.stringify(rows), p=planDraftConversion(rows);
  assert.equal(p.integrityReady,true); assert.equal(p.executable,false);
  assert.deepEqual(p.candidates,[{root:'J1', leaf:'J1', source:'IJ1', chain:['J1']}]);
  assert.equal(JSON.stringify(rows),before);
});
test('a cancelled pair is retained as history, not reopened',()=>{
  const p=planDraftConversion(chain(2)); assert.equal(p.integrityReady,true);
  assert.equal(p.candidates.length,0); assert.deepEqual(p.cancelledChains,[['J1','J2']]);
});
test('a reversal of a reversal is an effective event',()=>{
  const p=planDraftConversion(chain(3)); assert.equal(p.integrityReady,true);
  assert.equal(p.candidates[0].leaf,'J3'); assert.equal(p.candidates[0].source,'IJ1');
});
test('four linked reversals cancel without resurrecting the original',()=>{
  assert.equal(planDraftConversion(chain(4)).cancelledChains.length,1);
});
test('source company disagreement blocks the complete batch',()=>{
  const bad=voucher('J2'); bad.source.company='B';
  const p=planDraftConversion([voucher(),bad]);
  assert.equal(p.integrityReady,false); assert.ok(codes([bad]).includes('SOURCE_SCOPE_MISMATCH'));
  assert.equal(p.candidates.length,1); assert.equal(p.executable,false);
});
test('owner and organization mismatches fail even when company strings match',()=>{
  for(const field of ['owner','organization']){const v=voucher(); v.source[field]='OTHER'; assert.ok(codes([v]).includes('SOURCE_SCOPE_MISMATCH'));}
});
test('missing source and mismatched back-link are distinguished',()=>{
  assert.ok(codes([voucher('J1',{source:null})]).includes('SOURCE_MISSING'));
  const v=voucher();v.source.voucher='OTHER';assert.ok(codes([v]).includes('SOURCE_LINK_MISMATCH'));
});
test('tax metadata and settlements require explicit reconciliation',()=>{
  const v=voucher();v.source.electronicMetadata=true;v.source.dependencyCount=1;
  assert.ok(codes([v]).includes('ELECTRONIC_SOURCE_REVIEW'));
  assert.ok(codes([v]).includes('DEPENDENT_RECORDS'));
});
test('a missing reversal is not treated as a cancelled document',()=>{
  assert.ok(codes([chain(2)[0]]).includes('REVERSAL_MISSING'));
});
test('an orphan reversal is not a business document',()=>{
  assert.ok(codes([chain(2)[1]]).includes('REVERSAL_PARENT_MISSING'));
});
test('a reversal must refer back to exactly its predecessor',()=>{
  const c=chain(2);c[1].parent='OTHER'; assert.ok(codes(c).includes('REVERSAL_BACKLINK_MISMATCH'));
});
test('branching reversal graph is rejected',()=>{
  const c=chain(2);c.push({...c[1],key:'J3'}); assert.ok(codes(c).includes('REVERSAL_FORK'));
});
test('cycles, including cycles without a business root, are rejected',()=>{
  const c=chain(2);c[0].sourceType='reversal';c[0].source=null;c[0].parent='J2';c[1].reversal='J1';c[1].status='reversed';
  assert.ok(codes(c).includes('REVERSAL_CYCLE'));
});
test('a cross-company reversal cannot cancel another company',()=>{
  const c=chain(2);c[1].company='B'; assert.ok(codes(c).includes('REVERSAL_SCOPE_MISMATCH'));
});
test('equal totals do not prove equal and opposite account/dimension entries',()=>{
  const c=chain(2);c[1].lines[0].dimensions=['contact:OTHER'];
  assert.ok(codes(c).includes('REVERSAL_CONTENT_MISMATCH'));
});
test('missing lines, invalid monetary values and header mismatch are rejected',()=>{
  assert.ok(codes([voucher('J1',{lines:[]})]).includes('INVALID_JOURNAL_LINES'));
  for(const amount of ['NaN','100.5','-1',100000000000000000000]){
    const v=voucher();v.lines[0].debit=amount;assert.ok(codes([v]).includes('INVALID_JOURNAL_LINES'));
  }
  assert.ok(codes([voucher('J1',{totalDebit:'101'})]).includes('HEADER_TOTAL_MISMATCH'));
});
test('integer strings use exact arithmetic beyond floating-point precision',()=>{
  const v=voucher();v.lines[0].debit='9007199254740993';v.lines[1].credit='9007199254740993';
  v.totalDebit=v.totalCredit='9007199254740993';assert.equal(planDraftConversion([v]).integrityReady,true);
});
test('locked or absent fiscal scope blocks conversion',()=>{
  for(const fiscalOpen of [false,null,undefined]) assert.ok(codes([voucher('J1',{fiscalOpen})]).includes('FISCAL_SCOPE_NOT_OPEN'));
});
test('duplicate snapshot keys and missing scope fail closed',()=>{
  assert.ok(codes([voucher(),voucher()]).includes('DUPLICATE_KEY'));
  assert.ok(codes([voucher('J1',{company:''})]).includes('MISSING_SCOPE'));
});
test('existing drafts stay untouched and unknown statuses do not silently disappear',()=>{
  const p=planDraftConversion([voucher('D',{status:'draft'})]); assert.deepEqual(p.existingDrafts,['D']);
  assert.ok(codes([voucher('J1',{status:'weird'})]).includes('UNKNOWN_STATUS'));
});
test('all persisted reversed nodes must have a real compensator',()=>{
  assert.ok(codes([voucher('J1',{status:'reversed'})]).includes('REVERSED_WITHOUT_COMPENSATOR'));
});
test('a posted predecessor with a compensator is inconsistent',()=>{
  const c=chain(2);c[0].status='posted';assert.ok(codes(c).includes('POSTED_WITH_COMPENSATOR'));
});
test('children in another tenant and unsupported source adapters are not silently accepted',()=>{
  assert.ok(codes([voucher('J1',{childrenScopeValid:false})]).includes('CHILD_SCOPE_MISMATCH'));
  assert.ok(codes([voucher('J1',{sourceType:'payroll_run'})]).includes('SOURCE_ADAPTER_NOT_SUPPORTED'));
});
test('confirmed source company preserves reversal scope and explicitly locates the new draft',()=>{
  const v=voucher();v.source.company='B';
  const options={sourceCompanyResolutions:{J1:{company:'B',reason:'Owner confirmed source company'}}};
  const p=planDraftConversion([v],options);assert.equal(p.integrityReady,true);
  assert.deepEqual(p.candidates[0].scopeCorrection,{reverseInCompany:'A',draftInCompany:'B',reason:'Owner confirmed source company'});
  assert.equal(v.company,'A');assert.equal(v.source.company,'B');
  options.sourceCompanyResolutions.J1.company='C';assert.equal(planDraftConversion([v],options).integrityReady,false);
});
test('company resolution cannot authorize a different owner or organization',()=>{
  for(const field of ['owner','organization']){
    const v=voucher();v.source.company='B';v.source[field]='OTHER';
    assert.equal(planDraftConversion([v],{sourceCompanyResolutions:{J1:{company:'B',reason:'Owner choice'}}}).integrityReady,false);
  }
});
