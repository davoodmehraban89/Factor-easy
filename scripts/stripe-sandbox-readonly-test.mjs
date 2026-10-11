import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeStripeSandboxInvoice, readStripeSandboxInvoice } from './stripe-sandbox-readonly.mjs';

const fixture = JSON.parse(fs.readFileSync('scripts/fixtures/stripe-sandbox-invoice-synthetic.json', 'utf8'));
const valid = normalizeStripeSandboxInvoice(fixture);
assert.equal(valid.totalMinor, 1250);
assert.equal(valid.lineCount, 1);
assert.equal(valid.sandbox, true);
assert.equal(valid.safeForLedgerPosting, false);

const bad = (change, message) => {
  const copy = structuredClone(fixture);
  change(copy);
  assert.throws(() => normalizeStripeSandboxInvoice(copy), new RegExp(message));
};
bad(v => v.livemode = true, 'LIVE_MODE_FORBIDDEN');
bad(v => v.status = 'open', 'NON_DRAFT_OR_AUTOMATIC_INVOICE');
bad(v => v.auto_advance = true, 'NON_DRAFT_OR_AUTOMATIC_INVOICE');
bad(v => v.metadata.finora_test_ref = 'OTHER', 'REFERENCE_MISMATCH');
bad(v => v.metadata.finora_qa = 'false', 'NOT_A_FINORA_SANDBOX_FIXTURE');
bad(v => v.currency = 'irr', 'CURRENCY_MISMATCH');
bad(v => v.total = 1200, 'INVOICE_TOTAL_MISMATCH');
bad(v => v.amount_due = 1251, 'INVOICE_TOTAL_MISMATCH');
bad(v => v.subtotal = 500, 'INVOICE_TOTAL_MISMATCH');
bad(v => v.lines.data[0].amount = 1249, 'LINE_SUM_MISMATCH');
bad(v => v.lines.has_more = true, 'LINES_NOT_FULLY_RETRIEVED');
bad(v => v.lines.data.push({ ...v.lines.data[0] }), 'DUPLICATE_OR_INVALID_LINE');
bad(v => v.lines.data = [], 'EMPTY_INVOICE_LINES');
bad(v => v.lines.data[0].currency = 'eur', 'LINE_CURRENCY_MISMATCH');
bad(v => v.total = -1, 'NEGATIVE_AMOUNT');

await assert.rejects(readStripeSandboxInvoice('https://evil.test', 'rk_test_qa', () => { throw Error('network must not be used'); }), /INVALID_INVOICE_ID/);
await assert.rejects(readStripeSandboxInvoice(fixture.id, 'sk_live_private', () => { throw Error('network must not be used'); }), /RESTRICTED_SANDBOX_KEY_REQUIRED/);
await assert.rejects(readStripeSandboxInvoice(fixture.id, undefined, () => { throw Error('network must not be used'); }), /RESTRICTED_SANDBOX_KEY_REQUIRED/);
let calls = 0;
const data = await readStripeSandboxInvoice(fixture.id, 'rk_test_dummyonly', async (url, opts) => {
  calls++;
  assert.equal(url, `https://api.stripe.com/v1/invoices/${fixture.id}`);
  assert.equal(opts.method, 'GET');
  assert.equal(opts.headers.Authorization, 'Bearer rk_test_dummyonly');
  return { ok: true, status: 200, json: async () => fixture };
});
assert.equal(calls, 1);
assert.deepEqual(data, valid);
await assert.rejects(readStripeSandboxInvoice(fixture.id, 'rk_test_dummyonly', async () => ({ ok: false, status: 403 })), /STRIPE_HTTP_403/);
console.log('PASS: sandbox-only read adapter + positive and adversarial checks; no writes or live credentials');
