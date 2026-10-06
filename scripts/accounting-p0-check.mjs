import fs from 'node:fs';
const foundation=fs.readFileSync('js/accounting-foundation.js','utf8');
const engine=fs.readFileSync('js/journal-engine.js','utf8');
const ui=fs.readFileSync('js/journal-ui.js','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(foundation.includes("['COST_CENTER','مرکز هزینه','costCenter',0]"),'P0 must seed an independent cost-center analytic dimension.');
ok(foundation.includes('function afEnsureAccountingP0Compatibility()'),'P0 compatibility upgrader is missing.');
ok(foundation.includes("['receivable_control','payable_control'].includes(role)"),'Receivable/payable roles must drive counterparty rules.');
ok(foundation.includes("compatibilityMode:legacyRequired?'legacy-history-preserved':'recommended-p0'"),'Legacy posted history must not be retroactively broken by new required rules.');
ok(engine.includes("projectId:source.projectId||'',branchId"),'Project context must not fall back to cost center.');
ok(engine.includes('function jeVoucherNumberTaken'),'Journal number uniqueness guard is missing.');
ok(engine.includes('function jeCopyVoucherToDraft'),'Journal copy-to-draft workflow is missing.');
ok(engine.includes("jeDimensionValueBySource(dims,'contact')")&&engine.includes("jeDimensionValueBySource(dims,'project')"),'Generic analytic dimensions must maintain compatibility fields.');
ok(ui.includes('id="je-number"')&&ui.includes('id="je-reference"')&&ui.includes('id="je-voucher-type"'),'Journal header must expose number, type, and reference.');
ok(ui.includes('id="je-totals"')&&ui.includes('function jeUpdateTotals()'),'Journal must show live debit/credit/difference totals.');
ok(ui.includes('function jeFilterAccounts')&&ui.includes('function jeCopyRow'),'Journal must support account search and row copy.');
console.log('Accounting P0 invariants passed.');
