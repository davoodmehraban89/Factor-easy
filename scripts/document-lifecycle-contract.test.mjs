import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../supabase/migrations/20261118100000_document_lifecycle_temp_permanent_atef.sql',import.meta.url),'utf8')
 + readFileSync(new URL('../supabase/migrations/20261118101000_document_identity_trigger.sql',import.meta.url),'utf8')
 + readFileSync(new URL('../supabase/migrations/20261118102000_document_lifecycle_security.sql',import.meta.url),'utf8');
const rpc=readFileSync(new URL('../js/journal-rpc.js',import.meta.url),'utf8');
const invoices=readFileSync(new URL('../js/invoices.js',import.meta.url),'utf8');
const purchases=readFileSync(new URL('../js/purchases.js',import.meta.url),'utf8');
const payments=readFileSync(new URL('../js/payments.js',import.meta.url),'utf8');

test('lifecycle contract: ATEF is immutable and deletion is auditable',()=>{
  assert.match(migration,/finora_next_atef/);
  assert.match(migration,/DELETED_WITH_SOURCE/);
  assert.match(migration,/DELETED_DRAFT_VOUCHER/);
  assert.match(migration,/finora_document_lifecycle_audit/);
  assert.match(migration,/FINORA_DELETE_SOURCE_REQUIRED/);
  assert.match(migration,/DELETED_BEFORE_REPOST/);
  assert.match(migration,/CREATE TRIGGER finora_document_identity_trigger/);
});

test('lifecycle contract: all listed transactional families are converted to draft',()=>{
  for(const c of ['journalVouchers','invoices','purchases','payments','expenses','cheques','contractStatements','payrollRuns','employeeBenefitAccruals','pettyCashTransactions']){
    assert.match(migration,new RegExp(c));
  }
  assert.match(migration,/'status','draft'/);
  assert.match(migration,/'documentStatus','draft'/);
});

test('lifecycle contract: posting allocates permanent number but never changes ATEF',()=>{
  assert.match(migration,/finora_assign_permanent_document_number/);
  assert.match(migration,/never changes ATEF/i);
  assert.match(rpc,/finora_assign_permanent_document_number/);
  assert.match(rpc,/finora_document_identity/);
});

test('lifecycle contract: sale and purchase start as drafts',()=>{
  assert.match(invoices,/documentStatus:'draft',accountingStatus:'draft'/);
  assert.match(purchases,/documentStatus:'draft',accountingStatus:'draft'/);
  assert.match(purchases,/فاکتور خرید به‌صورت پیش‌نویس ذخیره شد/);
  assert.match(payments,/v\?\.status==='draft'\|\|p\.accountingStatus==='draft'/);
});

test('lifecycle contract: linked voucher deletion must go through source',()=>{
  assert.match(rpc,/finora_delete_draft_voucher/);
  assert.match(migration,/finora_delete_draft_source/);
  assert.match(migration,/FINORA_DELETE_SOURCE_REQUIRED/);
});
