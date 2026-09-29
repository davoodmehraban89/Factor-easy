import fs from 'node:fs';
const e=fs.readFileSync('js/journal-engine.js','utf8'),u=fs.readFileSync('js/journal-ui.js','utf8'),c=fs.readFileSync('js/core.js','utf8'),s=fs.readFileSync('js/sync.js','utf8'),b=fs.readFileSync('js/backup.js','utf8'),i=fs.readFileSync('index.html','utf8');
const need=(src,x,label)=>{for(const n of x)if(!src.includes(n))throw new Error(label+' missing '+n)};
need(e,['jeActiveSourceVoucher','jeGuardSourceMutation','jePostSourceRecord','jeValidateLines','jeValidateDimensions','sourceVersion','jeReverse','reversalVoucherId','jeDeleteDraft','jeTrialBalance','journalLineDimensions','paymentMethod===\'credit\'','jeVatPayableAccount'],'engine');
need(u,['view-journal','jeSaveManual','jePostUi','jeReverseUi','je-trial'],'ui');
for(const x of ['postingProfiles','journalVouchers','journalLines','journalLineDimensions']){if(!c.includes("'"+x+"'")||!s.includes(x)||!b.includes(x))throw new Error('persistence missing '+x)}
need(i,['journal-engine.js?v=20260928-phase3-recovery-v2','journal-ui.js?v=20260928-phase3-recovery-v2'],'index');
if(e.includes('datastore.journalVouchers=datastore.journalVouchers.filter')&&!e.includes("v.status!=='draft'"))throw new Error('posted voucher destructive delete guard missing');
console.log('Phase 3 wiring checks passed (behavioral tests run separately).');
