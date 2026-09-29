/* Phase 5 pure domain rules — deterministic and DOM-free */
(function(root){
'use strict';
const num=v=>Number(v)||0;
function stockFromEvents(events){return (events||[]).reduce((q,e)=>q+num(e.delta),0)}
function weightedAverage(openingQty,openingUnitCost,receipts){
 let qty=Math.max(0,num(openingQty)),value=qty*Math.max(0,num(openingUnitCost));
 for(const r of receipts||[]){const q=Math.max(0,num(r.qty)),c=Math.max(0,num(r.unitCost));qty+=q;value+=q*c}
 return qty>0?value/qty:0;
}
function monthlyDepreciation(cost,salvage,usefulMonths){
 cost=Math.max(0,num(cost));salvage=Math.max(0,num(salvage));usefulMonths=Math.max(1,Math.trunc(num(usefulMonths)||1));
 if(salvage>cost)throw new Error('salvage exceeds cost');
 return (cost-salvage)/usefulMonths;
}
function convert(amount,rate){rate=num(rate);if(rate<=0)throw new Error('invalid exchange rate');return num(amount)*rate}
function validateMovement(m){
 if(!m||!['opening','adjustment_in','adjustment_out','transfer'].includes(m.kind))throw new Error('invalid movement kind');
 if(!m.productId||!m.warehouseId||num(m.qty)<=0)throw new Error('invalid movement');
 if(m.kind==='transfer'&&(!m.toWarehouseId||m.toWarehouseId===m.warehouseId))throw new Error('invalid transfer');
 return true;
}
function validateRestore(payload,allowed){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('invalid backup');
 const keys=Object.keys(payload).filter(k=>!['user','exportedAt','formatVersion','checksum'].includes(k));
 const bad=keys.filter(k=>!allowed.includes(k)||!Array.isArray(payload[k]));
 if(bad.length)throw new Error('unsupported backup collections: '+bad.join(','));
 return true;
}
root.P5Domain={num,stockFromEvents,weightedAverage,monthlyDepreciation,convert,validateMovement,validateRestore};
})(typeof window!=='undefined'?window:globalThis);
