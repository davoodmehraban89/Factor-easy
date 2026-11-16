import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../js/journal-rpc.js',import.meta.url),'utf8');

function harness({vouchers=[],statuses=[],failMembership=false,pending=false}={}){
 const calls=[],records={journalVouchers:vouchers.map(x=>({...x})),journalLines:[],journalLineDimensions:[]};
 let idCounter=0;
 const context={
  currentUser:{id:'USER_A',organizationId:'ORG_A'},
  window:{requireFreshFinoraMembership:async()=>!failMembership},
  syncPending:pending,syncRunning:false,
  requireWrite:()=>true,afCompanyId:()=> 'CO_A',
  getJalaliNumeric:()=> '1405/07/19',toEnDigits:x=>String(x),
  getMyFiscalYears:()=>[{id:'FY_A',startDate:'1405/01/01',endDate:'1405/12/29',status:'open'}],
  jeFiscalForDate:()=>({id:'FY_A',startDate:'1405/01/01',endDate:'1405/12/29',status:'open'}),
  jeValidateLines:()=>true,jeNum:x=>Number(x)||0,afId:()=> 'JV_'+(++idCounter),
  getMyJournalVouchers:()=>records.journalVouchers,
  jeVoucherDraftInput:id=>({voucher:records.journalVouchers.find(v=>v.id===id),lines:[]}),
  pullAll:async()=>{},
  sb:{
   rpc:async(name,args)=>{calls.push({name,args});if(name==='finora_journal_create_draft')return {data:{voucher:{id:args.p_voucher_id,version:1,status:'draft'}},error:null};return {data:{voucher:{id:args.p_voucher_id||args.p_original_id,version:8,status:'posted'}},error:null};},
   from:()=>({select(){return this;},eq(){return this;},then(resolve){return Promise.resolve({data:statuses,error:null}).then(resolve);}})
  },
  console
 };
 vm.createContext(context);vm.runInContext(source,context);
 return {context,calls,records};
}

test('manual draft create calls only the dedicated server RPC with active organization scope',async()=>{
 const h=harness();
 const result=await h.context.jeRpcCreateDraft({date:'1405/07/19',description:'manual',voucherType:'manual',lines:[{accountId:'A1',debit:100,credit:0},{accountId:'A2',debit:0,credit:100}]});
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].name,'finora_journal_create_draft');
 assert.equal(h.calls[0].args.p_organization_id,'ORG_A');
 assert.equal(h.calls[0].args.p_header.companyId,'CO_A');
 assert.equal(h.calls[0].args.p_header.fiscalYearId,'FY_A');
 assert.equal(h.calls[0].args.p_header.date,'1405/07/19');
 assert.equal(h.calls[0].args.p_lines.length,2);
 assert.equal(h.calls.some(x=>x.name==='finora_sync_records'),false);
 assert.equal(result.id,'JV_1');
});

test('draft update uses the server row version as compare-and-swap token',async()=>{
 const h=harness({vouchers:[{id:'JV_D',status:'draft',sourceType:'manual',companyId:'CO_A',fiscalYearId:'FY_A',_serverVersion:7}]});
 await h.context.jeRpcUpdateDraft('JV_D',{date:'1405/07/19',description:'edited',voucherType:'manual',lines:[{accountId:'A1',debit:100,credit:0},{accountId:'A2',debit:0,credit:100}]});
 assert.equal(h.calls[0].name,'finora_journal_update_draft');
 assert.equal(h.calls[0].args.p_expected_version,7);
});

test('post and delete use dedicated RPCs and exact server version',async()=>{
 const h=harness({vouchers:[{id:'JV_D',status:'draft',sourceType:'manual',companyId:'CO_A',fiscalYearId:'FY_A',_serverVersion:12}]});
 await h.context.jeRpcPost('JV_D');
 assert.equal(h.calls[0].name,'finora_journal_post');
 assert.equal(h.calls[0].args.p_expected_version,12);
 h.calls.length=0;
 h.records.journalVouchers[0].status='draft';
 h.records.journalVouchers[0]._serverVersion=13;
 await h.context.jeRpcDeleteDraft('JV_D');
 assert.equal(h.calls[0].name,'finora_journal_delete_draft');
 assert.equal(h.calls[0].args.p_expected_version,13);
});

test('reverse is rejected after full/partial reversal and only sends null allocations for untouched originals',async()=>{
 const h=harness({vouchers:[{id:'JV_O',status:'posted',sourceType:'manual',_serverVersion:4}]});
 await h.context.jeRpcReverse('JV_O','1405/07/19','reason');
 assert.equal(h.calls[0].name,'finora_journal_reverse');
 assert.equal(h.calls[0].args.p_expected_version,4);
 assert.equal(h.calls[0].args.p_allocations,null);
 const partial=harness({vouchers:[{id:'JV_O',status:'posted',sourceType:'manual',_serverVersion:4}],statuses:[{voucher_id:'JV_O',effective_status:'partially_reversed'}]});
 await assert.rejects(()=>partial.context.jeRpcReverse('JV_O','1405/07/19','reason'),/برگشت جزئی/);
 assert.equal(partial.calls.length,0);
});

test('a reversal voucher cannot itself be reversed from the manual journal UI adapter',async()=>{
 const h=harness({vouchers:[{id:'JV_REV',status:'posted',sourceType:'reversal',voucherType:'reversal',_serverVersion:5}]});
 await assert.rejects(()=>h.context.jeRpcReverse('JV_REV','1405/07/19','reason'),/نمی‌توان دوباره معکوس کرد/);
 assert.equal(h.calls.length,0);
});

test('fresh membership and pending generic sync are hard preconditions before mutation',async()=>{
 const revoked=harness({failMembership:true});
 await assert.rejects(()=>revoked.context.jeRpcCreateDraft({date:'1405/07/19',lines:[{accountId:'A1',debit:1,credit:0},{accountId:'A2',debit:0,credit:1}]}),/عضویت فعال/);
 assert.equal(revoked.calls.length,0);
 const pending=harness({pending:true});
 await assert.rejects(()=>pending.context.jeRpcCreateDraft({date:'1405/07/19',lines:[{accountId:'A1',debit:1,credit:0},{accountId:'A2',debit:0,credit:1}]}),/همگام‌سازی/);
 assert.equal(pending.calls.length,0);
});
