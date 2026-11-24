import fs from 'node:fs';import vm from 'node:vm';
const src=fs.readFileSync('js/phase5-domain.js','utf8');const ctx={window:{}};vm.createContext(ctx);vm.runInContext(src,ctx);const D=ctx.window.P5Domain;
const eq=(a,b,m)=>{if(Math.abs(a-b)>1e-9)throw new Error(m+': '+a+' != '+b)};
eq(D.stockFromEvents([{delta:10},{delta:-3},{delta:2}]),9,'stock event balance');
eq(D.weightedAverage(10,100,[{qty:10,unitCost:200}]),150,'weighted average');
eq(D.monthlyDepreciation(1200,0,12),100,'straight-line depreciation');
eq(D.monthlyDepreciation(1200,120,12),90,'salvage depreciation');
eq(D.convert(10,600000),6000000,'fx conversion');
D.validateMovement({kind:'transfer',productId:'P1',warehouseId:'W1',toWarehouseId:'W2',qty:1});
let rejected=false;try{D.validateMovement({kind:'transfer',productId:'P1',warehouseId:'W1',toWarehouseId:'W1',qty:1})}catch{rejected=true}if(!rejected)throw new Error('same-warehouse transfer accepted');
D.validateRestore({formatVersion:5,warehouses:[]},['warehouses']);rejected=false;try{D.validateRestore({evil:[]},['warehouses'])}catch{rejected=true}if(!rejected)throw new Error('unknown restore collection accepted');
const app=fs.readFileSync('js/phase5-enterprise.js','utf8');for(const x of ['p5PostMovement','p5SaveCount','p5RunDepreciation','p5DepreciationActive','p5ReverseDepreciation','p5SaveRate','p5SaveCostCenter','p5PreviewRestore','p5QueueEvent','p5ValidateIntegrationEndpoint','20*1024*1024','salvage<0','getMyExchangeRates().length','accountType:typeof afAccountTypeForCode','p5Stock(m.productId,m.warehouseId)<m.qty','status:\'posted\''])if(!app.includes(x))throw new Error('Phase5 application invariant missing '+x);
const intCtx={URL};vm.createContext(intCtx);vm.runInContext(app,intCtx);if(vm.runInContext("p5ValidateIntegrationEndpoint('https://hooks.example.com/events')",intCtx)!=='https://hooks.example.com/events')throw new Error('valid HTTPS integration endpoint rejected');for(const bad of ['http://hooks.example.com','https://user:pass@hooks.example.com','https://localhost/hook','https://192.168.1.20/hook']){let blocked=false;try{intCtx.bad=bad;vm.runInContext("p5ValidateIntegrationEndpoint(bad)",intCtx)}catch{blocked=true}if(!blocked)throw new Error('unsafe integration endpoint accepted: '+bad)}
const backup=fs.readFileSync('js/backup.js','utf8');if(!backup.includes('20*1024*1024'))throw new Error('backup import size bound missing');
console.log('Phase 5 behavioral/domain scenarios passed.');
const depStore={assetDepreciations:[{id:'D1',ownerUserId:'u1',companyId:'C1',assetId:'A1',period:'1405/07',amount:100,status:'posted',journalVoucherId:'JV1'}],journalVouchers:[{id:'JV1',ownerUserId:'u1',companyId:'C1',status:'posted'}],phase5Audit:[]};const depCtx={console,URL,currentUser:{id:'u1'},datastore:depStore,afCompanyId:()=> 'C1',getMyJournalVouchers:()=>depStore.journalVouchers,requireWrite:()=>true,getJalaliNumeric:()=> '1405/07/30',saveDatastore:()=>true,confirm:()=>true,alert:()=>{},document:{getElementById:()=>null}};vm.createContext(depCtx);vm.runInContext(app,depCtx);
if(!vm.runInContext("p5DepreciationActive(datastore.assetDepreciations[0])",depCtx))throw new Error('posted depreciation should be active');
vm.runInContext("datastore.journalVouchers[0].status='reversed'",depCtx);if(vm.runInContext("p5DepreciationActive(datastore.assetDepreciations[0])",depCtx))throw new Error('reversed depreciation voucher still affects book value');
vm.runInContext("datastore.journalVouchers[0].status='posted';jeReverse=(id)=>{datastore.journalVouchers[0].status='reversed';return{id:'RV1'}};p5RenderAssets=()=>{};p5ReverseDepreciation('D1')",depCtx);
if(vm.runInContext("datastore.assetDepreciations[0].status",depCtx)!=='posted'||vm.runInContext("datastore.journalVouchers[0].status",depCtx)!=='reversed')throw new Error('depreciation reversal must preserve immutable source while reversing ledger effect');
console.log('Phase 5 depreciation reversal semantics passed.');
const syncSrc=fs.readFileSync('js/sync.js','utf8');const syncCtx={console,currentUser:{id:'u1'},COLLS:[],neutralize:x=>JSON.parse(JSON.stringify(x)),safeId:(id,p)=>String(id||p),window:{addEventListener:()=>{}},document:{getElementById:()=>null,addEventListener:()=>{},visibilityState:'visible'},setTimeout:()=>0,clearTimeout:()=>{},localStorage:{getItem:()=>null,setItem:()=>{}},confirm:()=>true,alert:()=>{},refreshAllSurfaces:()=>{},requireWrite:()=>true};vm.createContext(syncCtx);vm.runInContext(syncSrc,syncCtx);
vm.runInContext("datastore.products.push({id:'P1',ownerUserId:'u1',name:'Before'});datastore.journalVouchers.push({id:'JV1',ownerUserId:'u1',status:'posted'});datastore.journalLines.push({id:'JL1',ownerUserId:'u1',voucherId:'JV1',debit:100,credit:0});",syncCtx);
let restoreRejected=false;try{vm.runInContext("absorbRecords({products:[{id:'P1',name:'After'}],journalLines:[{id:'JL1',voucherId:'JV1',debit:999,credit:0}]})",syncCtx)}catch{restoreRejected=true}if(!restoreRejected)throw new Error('restore overwrote posted journal history');
const atomicState=vm.runInContext("({product:datastore.products.find(x=>x.id==='P1').name,debit:datastore.journalLines.find(x=>x.id==='JL1').debit})",syncCtx);if(atomicState.product!=='Before'||atomicState.debit!==100)throw new Error('failed restore was not atomic');
vm.runInContext("absorbRecords({products:[{id:'P1',name:'After'}]})",syncCtx);if(vm.runInContext("datastore.products.find(x=>x.id==='P1').name",syncCtx)!=='After')throw new Error('safe mutable restore merge failed');
console.log('Phase 5 restore atomicity and posted-history protection passed.');
// The owner-approved preservation contract supersedes automatic conflict reload:
 // a rejected/ambiguous write must not erase pending data or advance its CAS base.
syncCtx.pullAllCalls=0;syncCtx.rpcCalls=0;
syncCtx.sb={rpc:async()=>{syncCtx.rpcCalls++;throw new Error('paused conflict must not retry')}};
vm.runInContext("pullAll=async()=>{pullAllCalls++;};refreshAllSurfaces=()=>{};alert=()=>{}; finoraHydratedTenant=finoraTenantKey(finoraSyncContext()); syncPending=true; syncSnap.set('products|P1',JSON.stringify({id:'P1',name:'Before'})); syncVersionSnap.set('products|P1',7);",syncCtx);
const conflictState=()=>vm.runInContext("JSON.stringify([datastore,[...syncSnap],[...syncVersionSnap]])",syncCtx);
for(const [code,message] of [['23505','duplicate key value violates unique constraint'],['P0001','posted/reversed journal voucher is immutable']]){
 const before=conflictState();const readsBefore=syncCtx.pullAllCalls;const writesBefore=syncCtx.rpcCalls;
 await vm.runInContext(`handleSyncError(${JSON.stringify({code,message})})`,syncCtx);
 if(syncCtx.pullAllCalls!==readsBefore||!vm.runInContext("syncPending && finoraSyncIsPaused()",syncCtx)||conflictState()!==before)throw new Error(code+' conflict discarded pending data, changed CAS base, or did not pause');
 await vm.runInContext("runSync()",syncCtx);
 if(syncCtx.rpcCalls!==writesBefore||conflictState()!==before)throw new Error(code+' conflict triggered an unsafe retry or mutated pending state');
}
console.log('Phase 5 financial conflict preservation and retry inhibition passed.');
