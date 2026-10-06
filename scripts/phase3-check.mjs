import fs from 'node:fs';
const pr=fs.readFileSync('js/print.js','utf8');
const e=fs.readFileSync('js/journal-engine.js','utf8'),u=fs.readFileSync('js/journal-ui.js','utf8'),c=fs.readFileSync('js/core.js','utf8'),s=fs.readFileSync('js/sync.js','utf8'),b=fs.readFileSync('js/backup.js','utf8'),i=fs.readFileSync('index.html','utf8'),pay=fs.readFileSync('js/payments.js','utf8'),inv=fs.readFileSync('js/invoices.js','utf8'),exp=fs.readFileSync('js/expenses.js','utf8'),sourceGuard=fs.readFileSync('supabase/migrations/20260929193348_posted_source_immutability_guard.sql','utf8');
const need=(src,x,label)=>{for(const n of x)if(!src.includes(n))throw new Error(label+' missing '+n)};
need(e,['jeSourceVoucher','jeActiveSourceVoucher','jeSourceLocked','jeGuardSourceMutation','jePostSourceRecord','jeValidateLines','jeValidateDimensions','sourceVersion','jeReverse','reversalVoucherId','jeDeleteDraft','jeTrialBalance','journalLineDimensions','paymentMethod===\'credit\'','jeVatPayableAccount',"jeAccountByCode('1108')",'jeTemplateType',"trading:'4107'","service:'4106'","jeTemplateType()==='trading'?'5102'"],'engine');
need(u,['view-journal','jeSaveManual','jePostUi','jeReverseUi','je-trial'],'ui');
for(const x of ['postingProfiles','journalVouchers','journalLines','journalLineDimensions']){if(!c.includes("'"+x+"'")||!s.includes(x)||!b.includes(x))throw new Error('persistence missing '+x)}
need(i,['journal-engine.js?v=20261007-p0-r1','journal-ui.js?v=20261007-p0-r1'],'index');
need(s,["sb.rpc('finora_sync_records'",'p_upserts','p_deletes'],'atomic sync');
need(pay,["date:old?.date||getJalaliNumeric()"],'payment fiscal date');
need(inv,['invoiceCreatesAccountingEntry',"kind==='formal'||kind==='non_formal'"],'invoice posting semantics');
need(exp,['jePostSourceRecord(kind,record)','contactId','projectId','accountingVersion:1'],'expense/income posting semantics');
need(sourceGuard,['finora_guard_posted_source_records',"'invoices','purchases','payments','expenses','cheques','contractStatements'",'posted/reversed accounting history is immutable',"old.collection='cheques'"],'prepared source immutability migration');
need(e,["['posted','reversed'].includes(v.status)","['posted','reversed'].includes(x.status)"],'reversal history');
if(e.includes('datastore.journalVouchers=datastore.journalVouchers.filter')&&!e.includes("v.status!=='draft'"))throw new Error('posted voucher destructive delete guard missing');
console.log('Phase 3 double-entry invariants passed.');

need(pr,['const isPreInvoice=','function getInvoicePrintSpec','function buildIsolatedPrintDocument','function printIsolatedDocument',"frame.id='finora-print-frame'","paper:'A4'","paper:'A5'"],'isolated invoice print contract');
