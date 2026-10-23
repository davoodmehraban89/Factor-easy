#!/usr/bin/env node
// FINORA Stage3: source-contract readiness classification only. READ ONLY.
// Accepts local explicitly provided JSON; NEVER fetches DB or mutates rows.
// Does NOT guess historical VAT mode, currency unit, version, or account mapping.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const required=['vatMode','currencyCode','accountingVersion','discountType',
 'discountInput','vatType','vatRate','paymentMethod','items','subtotal',
 'discount','vat','grandTotal'];
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const integer=(v,min=0)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min;
const summarize=(rows)=>{
 if(!Array.isArray(rows))throw Error('FINORA_AUDIT_SOURCE_ARRAY_REQUIRED');
 const result={
  total:rows.length,eligible:0,reconciliationRequired:0,unsupported:0,
  contractMismatch:0,outOfScope:0,postedWithGaps:0,reasonCounts:{}
 };
 for(const row of rows){
  if(!row||!['invoices','purchases'].includes(row.collection)
   ||!row.data||typeof row.data!=='object'||Array.isArray(row.data))
   throw Error('FINORA_AUDIT_INVALID_SOURCE_SHAPE');
  const d=row.data;
  const eligibleKind=row.collection==='purchases'||
    ['formal','non_formal'].includes(d.kind);
  const posted=d.accountingStatus==='posted'||d.documentStatus==='posted';
  let status='eligible',reason='';
  if(!eligibleKind){
   status='outOfScope';reason='NON_POSTING_INVOICE_KIND';
  }else{
   const missing=required.filter(k=>!own(d,k));
   if(missing.length){
    status='reconciliationRequired';reason='MISSING_'+missing.join('_');
   }else if(d.currencyCode!=='IRR'){
    status='unsupported';reason='CURRENCY_NOT_APPROVED';
   }else if(!['cash','credit'].includes(d.paymentMethod)){
    status='unsupported';reason='PAYMENT_METHOD_UNSUPPORTED';
   }else if(!['none','with_vat'].includes(d.vatMode)||
       !['fixed','percent'].includes(d.discountType)||
       !['fixed','percent'].includes(d.vatType)||
       ![1,'1'].includes(d.accountingVersion)){
    status='unsupported';reason='SOURCE_CONTRACT_UNSUPPORTED';
   }else if(!Array.isArray(d.items)||d.items.length===0||
      !d.items.every(x=>x&&integer(x.qty,1)&&x.qty<=999999999&&
       integer(x.price)&&integer(x.lineTotal))){
    status='unsupported';reason='ITEM_QUANTITY_OR_AMOUNT_UNSUPPORTED';
   }else if(!['subtotal','discount','discountInput','vat','vatRate','grandTotal']
       .every(k=>integer(d[k]))){
    status='unsupported';reason='MONEY_PRECISION_UNSUPPORTED';
   }else{
    const subtotal=d.items.reduce((s,x)=>s+x.qty*x.price,0);
    const validLines=d.items.every(x=>x.qty*x.price===x.lineTotal);
    const expectedDiscount=Math.min(subtotal,d.discountType==='percent'?
     Math.round(subtotal*d.discountInput/100):d.discountInput);
    const net=subtotal-expectedDiscount;
    const expectedVat=d.vatMode==='none'?0:
     d.vatType==='percent'?Math.round(net*d.vatRate/100):d.vatRate;
    if(!Number.isSafeInteger(subtotal)||!validLines||
      subtotal<=0||d.subtotal!==subtotal||
      d.discount!==expectedDiscount||expectedDiscount>subtotal||net<=0||
      (d.discountType==='percent'&&d.discountInput>100)||
      (d.vatType==='percent'&&d.vatRate>100)||
      (row.collection==='invoices'&&d.kind==='non_formal'&&d.vat!==0)||
      d.vat!==expectedVat||d.grandTotal!==net+expectedVat||d.grandTotal<=0){
     status='contractMismatch';reason='SERVER_V1_AMOUNT_MISMATCH';
    }
   }
  }
  result[status]++;
  if(posted&&status!=='eligible')result.postedWithGaps++;
  if(reason)result.reasonCounts[reason]=(result.reasonCounts[reason]||0)+1;
 }
 // Deliberately never include record IDs, amounts, names, organizations or raw data.
 result.reasonCounts=Object.fromEntries(Object.entries(result.reasonCounts)
   .sort(([a],[b])=>a.localeCompare(b)));
 return result;
};
export {summarize as auditSourceRecords};
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const pathname=process.argv[2];
 if(!pathname||pathname.startsWith('http:')||pathname.startsWith('https:'))
  throw Error('FINORA_AUDIT_LOCAL_EXPLICIT_FILE_ONLY');
 const report=summarize(JSON.parse(readFileSync(pathname,'utf8')));
 console.log('FINORA_STAGE3_LEGACY_READONLY_REPORT '+JSON.stringify(report));
}
