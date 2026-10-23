#!/usr/bin/env node
import assert from 'node:assert/strict';
import {auditSourceRecords} from './stage3-legacy-source-audit.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const sale={kind:'formal',companyId:'SYNTHETIC_ONLY',accountingVersion:1,
 currencyCode:'IRR',paymentMethod:'cash',
 items:[{qty:2,price:100,lineTotal:200}],
 subtotal:200,discountType:'fixed',discountInput:0,discount:0,
 vatMode:'with_vat',vatType:'percent',vatRate:10,vat:20,grandTotal:220,
 accountingStatus:'draft',name:'Secret-Client-Name'};
const purchase={...clone(sale),kind:undefined,paymentMethod:'credit',
 subtotal:200,discountType:'fixed',discountInput:10,discount:10,
 vat:19,grandTotal:209};
const wrap=(collection,data,id)=>({collection,id,data});
const first=clone(sale);first.accountingStatus='posted';
delete first.vatMode;delete first.currencyCode;delete first.accountingVersion;
const zeroVat=clone(sale);zeroVat.kind='non_formal';
zeroVat.vat=0;zeroVat.grandTotal=200;zeroVat.vatMode='none';
delete zeroVat.vatMode;
const foreign=clone(sale);foreign.currencyCode='UNSUPPORTED_NON_RIAL';
const fractional=clone(sale);fractional.items[0].qty=1.5;
const tampered=clone(sale);tampered.grandTotal=221;
const proforma=clone(sale);proforma.kind='pre_invoice';
const rows=[
 wrap('invoices',clone(sale),'SAFE_SALE'),
 wrap('purchases',clone(purchase),'SAFE_PURCHASE'),
 wrap('invoices',first,'LEGACY_POSTED'),
 wrap('invoices',zeroVat,'LEGACY_ZERO_VAT'),
 wrap('invoices',foreign,'NON_RIAL'),
 wrap('invoices',fractional,'FRACTIONAL'),
 wrap('invoices',tampered,'TAMPERED'),
 wrap('invoices',proforma,'OPERATIONAL')
];
const before=JSON.stringify(rows);
const result=auditSourceRecords(rows);
assert.deepEqual(
 {total:result.total,eligible:result.eligible,
  reconciliationRequired:result.reconciliationRequired,
  unsupported:result.unsupported,contractMismatch:result.contractMismatch,
  outOfScope:result.outOfScope,postedWithGaps:result.postedWithGaps},
 {total:8,eligible:2,reconciliationRequired:2,unsupported:2,
  contractMismatch:1,outOfScope:1,postedWithGaps:1}
);
assert.equal(result.reasonCounts.CURRENCY_NOT_APPROVED,1);
assert.equal(result.reasonCounts.ITEM_QUANTITY_OR_AMOUNT_UNSUPPORTED,1);
assert.equal(result.reasonCounts.SERVER_V1_AMOUNT_MISMATCH,1);
assert.equal(result.reasonCounts.NON_POSTING_INVOICE_KIND,1);
assert.equal(Object.values(result.reasonCounts).reduce((a,b)=>a+b,0),6);
assert.equal(JSON.stringify(rows),before,'Classifier must not change historical sources');
assert.equal(JSON.stringify(auditSourceRecords(rows)),JSON.stringify(result),'Deterministic report required');
assert.ok(!JSON.stringify(result).includes('Secret-Client-Name'),'Never leak names');
assert.ok(!JSON.stringify(result).includes('LEGACY_POSTED'),'Never leak IDs');
assert.throws(()=>auditSourceRecords({}),/FINORA_AUDIT_SOURCE_ARRAY_REQUIRED/);
assert.throws(()=>auditSourceRecords([{collection:'unknown',data:{}}]),/FINORA_AUDIT_INVALID_SOURCE_SHAPE/);
// SQL-v1 requires a positive net line even if a fixed VAT creates a positive gross.
// A fully discounted source must not become apparently eligible for auto-posting.
const fullDiscount=clone(sale);
fullDiscount.discountInput=200;
fullDiscount.discount=200;
fullDiscount.vatType='fixed';
fullDiscount.vatRate=10;
fullDiscount.vat=10;
fullDiscount.grandTotal=10;
assert.equal(auditSourceRecords([wrap('invoices',fullDiscount,'FULL_DISCOUNT')]).contractMismatch,1);
// A zero-VAT historic document with no vatMode is NOT automatically fixed.
assert.equal(auditSourceRecords([wrap('invoices',zeroVat,'ZERO')]).reconciliationRequired,1);
console.log('FINORA_STAGE3_LEGACY_CLASSIFIER_PASS '+JSON.stringify({
 synthetic:8,eligible:2,reconciliation:2,unsupported:2,
 mismatch:1,outOfScope:1,postedWithGaps:1,
 originalRowsMutated:false,financialDataOutput:false,
 productionConnection:false}));
