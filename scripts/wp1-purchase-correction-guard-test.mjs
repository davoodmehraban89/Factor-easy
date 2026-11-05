import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
function fixture(reply){
 const p={id:'P',ownerUserId:'U',companyId:'C',number:'1',items:[{prodId:'PRODUCT',qty:1}],accountingStatus:'posted'};
 const v={id:'V',sourceType:'purchase',sourceId:'P',status:'posted',fiscalYearId:'Y'};
 const counts={reverse:0,save:0,sync:0};
 const c={console,Date,Math,Number,String,Array,Set,Promise,setTimeout,clearTimeout,COLLS:[],currentUser:{id:'U',organizationId:'O'},
 document:{getElementById:id=>id==='view-purchases'?{}:null,addEventListener(){}},datastore:{purchases:[p]},
 requireWrite:()=>true,afCompanyId:()=> 'C',afId:()=> 'NEW',getJalaliNumeric:()=> '1405/07/24',
 getMyFiscalYears:()=>[{id:'Y',status:'open'}],jeFiscalForDate:()=>({id:'Y',status:'open'}),getMyPayments:()=>[],getMyProducts:()=>[{id:'PRODUCT'}],productMovement:()=>({available:5}),jeSourceVoucher:()=>v,
 jeReverse:()=>{counts.reverse++;return {id:'REV'};},saveDatastore:()=>counts.save++,invoicePilotAwaitSync:async()=>counts.sync++,refreshAllSurfaces(){},sb:{rpc:async()=> typeof reply==='function'?reply(c):reply}};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/purchases.js','utf8'),c);return {c,counts};
}
for(const action of ['returnPostedPurchaseAsDraft','cancelPostedPurchasePilot']){
 for(const [name,reply] of [['enforce',{data:'enforce',error:null}],['network',{error:{code:'NETWORK',message:'private detail'}}],['unknown',{data:null,error:null}],['changed',c=>{c.currentUser={id:'OTHER',organizationId:'OTHER'};return {data:'off',error:null};}]]){
  const {c,counts}=fixture(reply);await assert.rejects(c[action]('P','fixture reason'),undefined,name+' must reject');
  assert.deepEqual(counts,{reverse:0,save:0,sync:0},name+' must not touch local/remote ledger');assert.equal(c.datastore.purchases.length,1);
 }
 for(const reply of [{data:'off',error:null},{data:'audit',error:null},{data:null,error:{code:'PGRST202'}}]){
  const {c,counts}=fixture(reply);await c[action]('P','fixture reason');assert.equal(counts.reverse,1);assert.equal(counts.sync,1);
 }
}
console.log('PASS purchase correction/cancel guards: enforce, transport, malformed mode, changed identity reject before mutation; off/audit/missing RPC retain legacy path.');
