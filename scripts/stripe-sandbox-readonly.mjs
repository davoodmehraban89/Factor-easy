// Server-side, read-only Stripe sandbox evidence adapter. Never import in the public Finora UI.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const STRIPE_API = 'https://api.stripe.com';
const EXPECTED_REF = 'FINORA-QA-20261011-A';
const requireValue = (condition, code) => { if (!condition) throw new Error(code); };

export function normalizeStripeSandboxInvoice(raw, options = {}) {
  const expectedRef = options.expectedRef ?? EXPECTED_REF;
  const expectedAmount = options.expectedAmount ?? 1250;
  requireValue(raw && typeof raw === 'object', 'INVALID_INVOICE_OBJECT');
  requireValue(/^in_[a-zA-Z0-9]+$/.test(raw.id || ''), 'INVALID_INVOICE_ID');
  requireValue(raw.livemode === false, 'LIVE_MODE_FORBIDDEN');
  requireValue(raw.status === 'draft' && raw.auto_advance === false, 'NON_DRAFT_OR_AUTOMATIC_INVOICE');
  requireValue(raw.metadata?.finora_qa === 'true' && raw.metadata?.environment === 'sandbox', 'NOT_A_FINORA_SANDBOX_FIXTURE');
  requireValue(raw.metadata?.finora_test_ref === expectedRef, 'REFERENCE_MISMATCH');
  requireValue(raw.currency === 'usd', 'CURRENCY_MISMATCH');
  requireValue(Number.isSafeInteger(raw.amount_due) && Number.isSafeInteger(raw.subtotal) && Number.isSafeInteger(raw.total), 'INVALID_AMOUNT');
  requireValue(raw.amount_due >= 0 && raw.subtotal >= 0 && raw.total >= 0, 'NEGATIVE_AMOUNT');
  requireValue(raw.amount_due === raw.total && raw.total === raw.subtotal, 'INVOICE_TOTAL_MISMATCH');
  requireValue(raw.total === expectedAmount, 'UNEXPECTED_TEST_AMOUNT');
  requireValue(raw.lines?.has_more === false && Array.isArray(raw.lines.data), 'LINES_NOT_FULLY_RETRIEVED');
  requireValue(raw.lines.data.length > 0, 'EMPTY_INVOICE_LINES');
  const lineIds = new Set();
  const lines = raw.lines.data.map(line => {
    requireValue(typeof line.id === 'string' && !lineIds.has(line.id), 'DUPLICATE_OR_INVALID_LINE');
    lineIds.add(line.id);
    requireValue(Number.isSafeInteger(line.amount) && line.amount >= 0, 'INVALID_LINE_AMOUNT');
    requireValue(!line.currency || line.currency === raw.currency, 'LINE_CURRENCY_MISMATCH');
    return { id: line.id, amountMinor: line.amount, currency: raw.currency };
  });
  requireValue(lines.reduce((sum, line) => sum + line.amountMinor, 0) === raw.subtotal, 'LINE_SUM_MISMATCH');
  return {
    provider: 'stripe',
    sandbox: true,
    id: raw.id,
    reference: expectedRef,
    customerId: raw.customer,
    status: raw.status,
    currency: raw.currency,
    subtotalMinor: raw.subtotal,
    totalMinor: raw.total,
    lineCount: lines.length,
    lines,
    safeForLedgerPosting: false,
    note: 'Sandbox evidence only. Requires verified company mapping, exchange-rate policy and posting authorization.'
  };
}

export async function readStripeSandboxInvoice(id, key, fetchImpl = fetch) {
  requireValue(/^in_[a-zA-Z0-9]+$/.test(id || ''), 'INVALID_INVOICE_ID');
  // Restricted sandbox-only key; never pass in query strings, logs, or a public UI.
  requireValue(/^rk_test_[a-zA-Z0-9]+$/.test(key || ''), 'RESTRICTED_SANDBOX_KEY_REQUIRED');
  const response = await fetchImpl(`${STRIPE_API}/v1/invoices/${id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000)
  });
  requireValue(response && response.ok, `STRIPE_HTTP_${response?.status || 'FAILED'}`);
  return normalizeStripeSandboxInvoice(await response.json());
}

async function runCli() {
  const [mode, arg] = process.argv.slice(2);
  if (mode === '--fixture' && arg) {
    console.log(JSON.stringify(normalizeStripeSandboxInvoice(JSON.parse(fs.readFileSync(arg, 'utf8'))), null, 2));
  } else if (mode === '--live' && arg) {
    console.log(JSON.stringify(await readStripeSandboxInvoice(arg, process.env.STRIPE_SANDBOX_RESTRICTED_KEY), null, 2));
  } else {
    throw new Error('Usage: node scripts/stripe-sandbox-readonly.mjs --fixture file.json OR --live in_... (requires STRIPE_SANDBOX_RESTRICTED_KEY)');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli().catch(error => { console.error('Stripe sandbox probe failed:', error.message); process.exitCode = 1; });
}
