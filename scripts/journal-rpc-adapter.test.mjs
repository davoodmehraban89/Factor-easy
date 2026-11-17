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

test('concurrent UI submissions are serialized and duplicate RPCs are blocked',async()=>{
 const h=harness();
 let release;
 const wait=new Promise(resolve=>{release=resolve});
 h.context.sb.rpc=async(name,args)=>{h.calls.push({name,args});await wait;return {data:{voucher:{id:args.p_voucher_id,version:1,status:'draft'}},error:null};};
 const input={date:'1405/07/19',description:'manual',voucherType:'manual',lines:[{accountId:'A1',debit:100,credit:0},{accountId:'A2',debit:0,credit:100}]};
 const first=h.context.jeRpcCreateDraft(input);
 await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(()=>h.context.jeRpcCreateDraft(input),/در حال اجراست/);
 release();
 await first;
 assert.equal(h.calls.filter(x=>x.name==='finora_journal_create_draft').length,1);
});

test('ambiguous draft-create retry reuses the same idempotency key',async()=>{
 const h=harness();
 let loseFirst=true;
 const original=h.context.sb.rpc;
 h.context.sb.rpc=async(name,args)=>{
  if(name==='finora_journal_create_draft'&&loseFirst){loseFirst=false;h.calls.push({name,args});throw new Error('response lost after server commit');}
  return original(name,args);
 };
 const input={date:'1405/07/19',description:'manual',voucherType:'manual',lines:[{accountId:'A1',debit:100,credit:0},{accountId:'A2',debit:0,credit:100}]};
 await assert.rejects(()=>h.context.jeRpcCreateDraft(input),/response lost/);
 const firstId=h.calls[0].args.p_voucher_id;
 const result=await h.context.jeRpcCreateDraft(input);
 assert.equal(h.calls[1].args.p_voucher_id,firstId);
 assert.equal(result.id,firstId);
});

test('unsafe or fractional Rial values are rejected before reaching the RPC',async()=>{
 const h=harness();
 await assert.rejects(()=>h.context.jeRpcCreateDraft({date:'1405/07/19',lines:[
  {accountId:'A1',debit:9007199254740992,credit:0},{accountId:'A2',debit:0,credit:9007199254740992}
 ]}),/محدوده دقت امن/);
 assert.equal(h.calls.length,0);
 const fractional=harness();
 await assert.rejects(()=>fractional.context.jeRpcCreateDraft({date:'1405/07/19',lines:[
  {accountId:'A1',debit:1.5,credit:0},{accountId:'A2',debit:0,credit:1.5}
 ]}),/محدوده دقت امن/);
 assert.equal(fractional.calls.length,0);
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

test('a posted reversal voucher can be reversed only through the server reversal RPC',async()=>{
 const h=harness({vouchers:[{id:'JV_REV',status:'posted',sourceType:'reversal',voucherType:'reversal',_serverVersion:5}]});
 await h.context.jeRpcReverse('JV_REV','1405/07/19','reason');
 assert.equal(h.calls[0].name,'finora_journal_reverse');
 assert.equal(h.calls[0].args.p_original_id,'JV_REV');
});

test('fresh membership and pending generic sync are hard preconditions before mutation',async()=>{
 const revoked=harness({failMembership:true});
 await assert.rejects(()=>revoked.context.jeRpcCreateDraft({date:'1405/07/19',lines:[{accountId:'A1',debit:1,credit:0},{accountId:'A2',debit:0,credit:1}]}),/عضویت فعال/);
 assert.equal(revoked.calls.length,0);
 const pending=harness({pending:true});
 await assert.rejects(()=>pending.context.jeRpcCreateDraft({date:'1405/07/19',lines:[{accountId:'A1',debit:1,credit:0},{accountId:'A2',debit:0,credit:1}]}),/همگام‌سازی/);
 assert.equal(pending.calls.length,0);
});


function sourceHarness(kind='sale',{journalDirty=false,failSourceSync=false,loseFirstResponse=false,rejectWithCode=false}={}){
 const h=harness(),collection=kind==='sale'?'invoices':'purchases';
 const source={id:kind==='sale'?'INV_SOURCE_1':'PUR_SOURCE_1',ownerUserId:'USER_A',companyId:'CO_A',
  date:'1405/07/19',number:'SRC-1',description:'synthetic source',reference:'REF-1',
  grandTotal:100,accountingVersion:1,kind:kind==='sale'?'formal':undefined,
  items:[{qty:1,price:100,lineTotal:100}],documentStatus:'draft'};
 const rows={[collection]:[source]};
 h.context.getMyInvoices=()=>rows.invoices||[];
 h.context.getMyPurchases=()=>rows.purchases||[];
 h.context.stripOwner=item=>{const x={...item};delete x.ownerUserId;delete x._serverVersion;delete x.accountingPostingPending;delete x.accountingPostingPendingAt;return x;};
 h.context.syncSnap=new Map();
 h.context.syncRunning=false;h.context.syncPending=false;h.context.syncFailCount=0;
 h.context.computeDiff=()=>journalDirty?{up:[{coll:'journalLines',key:'journalLines|LOCAL'}],del:[]}:{up:[],del:[]};
 h.context.saveDatastore=()=>{h.context.syncPending=true;};
 let serverSource={...source},serverVoucher=null;
 h.context.runSync=async()=>{
  if(failSourceSync){h.context.syncFailCount=1;h.context.syncPending=true;return;}
  const key=collection+'|'+source.id,payload=JSON.stringify(h.context.stripOwner(source));
  if(h.context.syncSnap.get(key)!==payload)serverSource={...h.context.stripOwner(source),ownerUserId:source.ownerUserId};
  h.context.syncSnap.set(key,payload);
  h.context.syncPending=false;
 };
 h.context.pullAll=async()=>{
  delete source.accountingPostingPending;delete source.accountingPostingPendingAt;
  Object.assign(source,serverSource);
  if(serverVoucher&&!h.records.journalVouchers.some(v=>v.id===serverVoucher.id))h.records.journalVouchers.push(serverVoucher);
 };
 let first=true;
 h.context.sb.rpc=async(name,args)=>{
  h.calls.push({name,args});
  if(name==='finora_journal_autopost'){
   if(rejectWithCode)return {data:null,error:{message:'synthetic posting validation failure',code:'23514'}};
   const voucher=serverVoucher||{id:'JV_SERVER_'+kind,status:'posted',version:2,postedAt:'1405-07-19T10:00:00Z',postedBy:'USER_A'};
   if(!serverVoucher){
    serverVoucher=voucher;
    serverSource={...serverSource,journalVoucherId:voucher.id,accountingStatus:'posted',
     accountingPostedAt:voucher.postedAt,documentStatus:'posted',documentPostedAt:voucher.postedAt,
     documentPostedBy:voucher.postedBy,documentVersion:1};
   }
   if(loseFirstResponse&&first){first=false;throw new Error('network response lost after server commit');}
   return {data:{voucher},error:null};
  }
  return {data:null,error:null};
 };
 return {...h,source,rows,collection};
}

test('sale auto-post persists source first and delegates authoritative lines to the dedicated RPC',async()=>{
 const h=sourceHarness('sale');
 const v=await h.context.jeRpcAutoPost('sale',h.source.id);
 const call=h.calls.find(x=>x.name==='finora_journal_autopost');
 assert.ok(call);
 assert.equal(call.args.p_organization_id,'ORG_A');
 assert.equal(call.args.p_source_collection,'invoices');
 assert.equal(call.args.p_source_id,h.source.id);
 assert.equal(call.args.p_header.sourceType,'sale');
 assert.equal(call.args.p_header.sourceVersion,'1');
 assert.equal(call.args.p_header.companyId,'CO_A');
 assert.deepEqual(Array.from(call.args.p_lines),[]);
 assert.equal(v.id,'JV_SERVER_sale');
 assert.equal(h.source.journalVoucherId,v.id);
 assert.equal(h.source.accountingStatus,'posted');
 assert.equal(h.source.documentStatus,'posted');
 assert.equal(h.source.accountingPostingPending,undefined);
 assert.equal(h.calls.some(x=>x.name==='finora_sync_records'),false);
});

test('purchase auto-post uses the same server-owned source contract with purchases scope',async()=>{
 const h=sourceHarness('purchase');
 const v=await h.context.jeRpcAutoPost('purchase',h.source.id);
 const call=h.calls.find(x=>x.name==='finora_journal_autopost');
 assert.equal(call.args.p_source_collection,'purchases');
 assert.equal(call.args.p_header.sourceType,'purchase');
 assert.equal(call.args.p_header.sourceId,h.source.id);
 assert.equal(v.id,'JV_SERVER_purchase');
 assert.equal(h.source.journalVoucherId,v.id);
 assert.equal(h.source.accountingStatus,'posted');
 assert.equal(h.source.documentStatus,'posted');
 assert.equal(h.source.accountingPostingPending,undefined);
});

test('auto-post fails closed when local generic sync contains dirty journal rows',async()=>{
 const h=sourceHarness('sale',{journalDirty:true});
 await assert.rejects(()=>h.context.jeRpcAutoPost('sale',h.source.id),/مسیر قدیمی/);
 assert.equal(h.calls.some(x=>x.name==='finora_journal_autopost'),false);
});

test('auto-post never calls server when source draft persistence is not acknowledged',async()=>{
 const h=sourceHarness('sale',{failSourceSync:true});
 await assert.rejects(()=>h.context.jeRpcAutoPost('sale',h.source.id),/تأیید ذخیره رکورد منبع/);
 assert.equal(h.calls.some(x=>x.name==='finora_journal_autopost'),false);
});

test('ambiguous auto-post retry reuses source identity and accepts server idempotent replay',async()=>{
 const h=sourceHarness('sale',{loseFirstResponse:true});
 await assert.rejects(()=>h.context.jeRpcAutoPost('sale',h.source.id),/network response lost/);
 assert.equal(h.source.accountingPostingPending,true);
 const v=await h.context.jeRpcAutoPost('sale',h.source.id);
 assert.equal(h.source.accountingPostingPending,undefined);
 const calls=h.calls.filter(x=>x.name==='finora_journal_autopost');
 assert.equal(calls.length,2);
 assert.equal(calls[0].args.p_source_id,calls[1].args.p_source_id);
 assert.equal(calls[0].args.p_source_collection,calls[1].args.p_source_collection);
 assert.notEqual(calls[0].args.p_voucher_id,calls[1].args.p_voucher_id);
 assert.equal(v.id,'JV_SERVER_sale');
});


test('source finalizers no longer create or post journal rows through the legacy local engine',async()=>{
 const invoiceSource=await readFile(new URL('../js/invoices.js',import.meta.url),'utf8');
 const purchaseSource=await readFile(new URL('../js/purchases.js',import.meta.url),'utf8');
 const invoiceStart=invoiceSource.indexOf('async function finalizeInvoiceDocument(invoiceId)');
 const invoiceEnd=invoiceSource.indexOf('\nasync function finalizeInvoiceDocumentUi',invoiceStart);
 const purchaseStart=purchaseSource.indexOf('window.finalizePurchasePilotDraft=async function');
 const purchaseEnd=purchaseSource.indexOf('\n  window.deletePurchasePilotDraft',purchaseStart);
 assert.ok(invoiceStart>=0&&invoiceEnd>invoiceStart);
 assert.ok(purchaseStart>=0&&purchaseEnd>purchaseStart);
 const invoiceFinalizer=invoiceSource.slice(invoiceStart,invoiceEnd);
 const purchaseFinalizer=purchaseSource.slice(purchaseStart,purchaseEnd);
 assert.match(invoiceFinalizer,/jeRpcAutoPost\('sale',invoiceId\)/);
 assert.match(invoiceFinalizer,/saveDatastore\(\)/);
 assert.doesNotMatch(invoiceFinalizer,/jePostSourceRecord|jeCreateDraft|jePost\(/);
 assert.match(purchaseFinalizer,/jeRpcAutoPost\('purchase',id\)/);
 assert.doesNotMatch(purchaseFinalizer,/jePostSourceRecord|jeCreateDraft|jePost\(/);
 const adapterSource=await readFile(new URL('../js/journal-rpc.js',import.meta.url),'utf8');
 const autoPostStart=adapterSource.indexOf('async function jeRpcAutoPost(');
 const autoPostBody=adapterSource.slice(autoPostStart);
 assert.match(autoPostBody,/jeRpcPersistSourceRecord\(collection,sourceId\)/);
});

test('sync hydration reads database row version required by journal CAS operations',async()=>{
 const syncSource=await readFile(new URL('../js/sync.js',import.meta.url),'utf8');
 assert.match(syncSource,/select\('collection,id,data,version'\)/);
 assert.match(syncSource,/obj\._serverVersion=Number\(r\.version\)/);
 assert.match(syncSource,/p_organization_id:currentUser\.organizationId\|\|null/);
 assert.match(syncSource,/delete c\.accountingPostingPending/);
});


test('initial purchase creation uses the server autopost path and remains retryable as a draft',async()=>{
 const purchaseSource=await readFile(new URL('../js/purchases.js',import.meta.url),'utf8');
 const start=purchaseSource.indexOf('window.purSave=async function(){');
 const end=purchaseSource.indexOf('window.purCancelEdit=function(){',start);
 assert.ok(start>=0&&end>start);
 const saveFlow=purchaseSource.slice(start,end);
 assert.match(saveFlow,/accountingStatus:'draft',documentStatus:'draft'/);
 assert.match(saveFlow,/jeRpcAutoPost\('purchase',record\.id\)/);
 assert.doesNotMatch(saveFlow,/jePostSourceRecord/);
 const finalizer=purchaseSource.slice(purchaseSource.indexOf('window.finalizePurchasePilotDraft=async function'),
  purchaseSource.indexOf('window.deletePurchasePilotDraft',purchaseSource.indexOf('window.finalizePurchasePilotDraft=async function')));
 assert.doesNotMatch(finalizer,/!p\.correctsPurchaseId/);
});


test('explicit server rejection clears the source freeze so a draft can be corrected',async()=>{
 const h=sourceHarness('sale',{rejectWithCode:true});
 await assert.rejects(()=>h.context.jeRpcAutoPost('sale',h.source.id),/synthetic posting validation failure/);
 assert.equal(h.source.accountingPostingPending,undefined);
 assert.equal(h.source.documentStatus,'draft');
 assert.equal(h.calls.filter(x=>x.name==='finora_journal_autopost').length,1);
});

test('source edit and delete surfaces freeze while autopost outcome is ambiguous',async()=>{
 const engine=await readFile(new URL('../js/journal-engine.js',import.meta.url),'utf8');
 const invoices=await readFile(new URL('../js/invoices.js',import.meta.url),'utf8');
 const purchases=await readFile(new URL('../js/purchases.js',import.meta.url),'utf8');
 assert.match(engine,/source\?\.accountingPostingPending/);
 assert.match(invoices,/!inv\.accountingPostingPending/);
 assert.match(invoices,/inv\.accountingPostingPending\)/);
 assert.match(purchases,/p\.accountingPostingPending/);
});


test('autopost database migration atomically links source records and has a restoring rollback',async()=>{
 const migration=await readFile(new URL('../supabase/migrations/20261117110000_wp1_autopost_source_link_atomic.sql',import.meta.url),'utf8');
 const rollback=await readFile(new URL('../supabase/rollback/20261117110000_wp1_autopost_source_link_atomic.sql',import.meta.url),'utf8');
 assert.match(migration,/FOR UPDATE/);
 assert.match(migration,/journalVoucherId/);
 assert.match(migration,/accountingStatus/);
 assert.match(migration,/documentStatus/);
 assert.match(migration,/prior\.id/);
 assert.match(migration,/posted#>>'\{voucher,postedAt\}'/);
 assert.match(rollback,/CREATE OR REPLACE FUNCTION public\.finora_journal_autopost/);
 assert.doesNotMatch(rollback,/UPDATE public\.records r SET data=/);
});


test('concurrent source autopost submissions serialize before generic source flush',async()=>{
 const h=sourceHarness('sale');
 let release;const gate=new Promise(resolve=>{release=resolve;});
 const originalRunSync=h.context.runSync;
 h.context.runSync=async()=>{await gate;return originalRunSync();};
 const first=h.context.jeRpcAutoPost('sale',h.source.id);
 await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(()=>h.context.jeRpcAutoPost('sale',h.source.id),/در حال اجراست/);
 release();
 const voucher=await first;
 assert.equal(voucher.id,'JV_SERVER_sale');
 assert.equal(h.source.journalVoucherId,voucher.id);
});
