import assert from 'node:assert/strict';
import fs from 'node:fs';
import { handleStripeQaPreview, QA_INVOICE_ID } from '../supabase/functions/finora-stripe-qa-read/handler.mjs';

const sample = JSON.parse(fs.readFileSync('scripts/fixtures/stripe-sandbox-invoice-synthetic.json', 'utf8'));
const allowed = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const envData = {
  FINORA_STRIPE_QA_ALLOWED_USER_ID: allowed,
  STRIPE_SANDBOX_RESTRICTED_KEY: 'rk_test_' + 'X'.repeat(28),
  SUPABASE_URL: 'https://example-project.supabase.co',
  SUPABASE_ANON_KEY: 'public-synthetic-anon-value',
};
const environment = data => name => (data || envData)[name];
const createRequest = (origin = 'https://factoreasy.ir', method = 'POST', token = 'Bearer ' + 'mock-user-jwt-example-very-long') =>
  new Request('https://edge.invalid/functions/v1/finora-stripe-qa-read', { method, headers: { Origin: origin, Authorization: token } });
const mockedFetch = ({ user = allowed, invoice = sample, authStatus = 200, stripeStatus = 200 } = {}) => async (url, opts) => {
  assert.equal(opts.method, 'GET');
  if (url === 'https://example-project.supabase.co/auth/v1/user') {
    assert.equal(opts.headers.apikey, envData.SUPABASE_ANON_KEY);
    assert.equal(opts.headers.Authorization, 'Bearer mock-user-jwt-example-very-long');
    return new Response(JSON.stringify({ id: user }), { status: authStatus });
  }
  assert.equal(url, 'https://api.stripe.com/v1/invoices/' + QA_INVOICE_ID);
  assert.equal(opts.headers.Authorization, 'Bearer ' + envData.STRIPE_SANDBOX_RESTRICTED_KEY);
  return new Response(JSON.stringify(invoice), { status: stripeStatus });
};
async function run(expectedStatus, { req = createRequest(), env = environment(), fetchImpl = mockedFetch() } = {}) {
  const result = await handleStripeQaPreview(req, { env, fetchImpl });
  assert.equal(result.status, expectedStatus);
  assert.equal(result.headers.get('Cache-Control'), 'no-store, max-age=0');
  const body = await result.json();
  return { result, body };
}
let count = 0;
const check = async (code, config) => { await run(code, config); count++; };
const success = await run(200);
assert.deepEqual(success.body.invoice, {
  provider: 'stripe',
  environment: 'sandbox',
  reference: 'FINORA-QA-20261011-A',
  invoiceId: QA_INVOICE_ID,
  invoiceStatus: 'draft',
  currency: 'USD',
  amountMinor: 1250,
  lineCount: 1,
  ledgerPostingAllowed: false,
});
assert.equal(success.result.headers.get('Access-Control-Allow-Origin'), 'https://factoreasy.ir');
assert.ok(!JSON.stringify(success.body).includes('cus_'));
count++;

const noNetwork = async () => { throw Error('network must not run'); };
await check(503, { env: environment({ ...envData, STRIPE_SANDBOX_RESTRICTED_KEY: '' }), fetchImpl: noNetwork });
await check(503, { env: environment({ ...envData, STRIPE_SANDBOX_RESTRICTED_KEY: 'rk_live_not_allowed' }), fetchImpl: noNetwork });
await check(503, { env: environment({ ...envData, FINORA_STRIPE_QA_ALLOWED_USER_ID: '' }), fetchImpl: noNetwork });
await check(503, { env: environment({ ...envData, FINORA_STRIPE_QA_ALLOWED_USER_ID: 'not-a-uuid' }), fetchImpl: noNetwork });
await check(503, { env: environment({ ...envData, SUPABASE_ANON_KEY: '' }), fetchImpl: noNetwork });
await check(503, { env: environment({ ...envData, SUPABASE_URL: 'https://not-supabase.example' }), fetchImpl: noNetwork });
await check(403, { req: createRequest('https://evil.example'), fetchImpl: noNetwork });
await check(405, { req: createRequest('https://factoreasy.ir', 'GET'), fetchImpl: noNetwork });
await check(401, { req: createRequest('https://factoreasy.ir', 'POST', 'Bearer bad'), fetchImpl: noNetwork });
await check(401, { fetchImpl: mockedFetch({ authStatus: 401 }) });
await check(403, { fetchImpl: mockedFetch({ user: other }) });
await check(502, { fetchImpl: mockedFetch({ stripeStatus: 403 }) });
await check(502, { fetchImpl: async () => { throw Error('secret leak prohibited'); } });
for (const mutate of [
  x => { x.livemode = true; },
  x => { x.status = 'paid'; },
  x => { x.auto_advance = true; },
  x => { x.metadata.finora_test_ref = 'wrong'; },
  x => { x.amount_due = 1300; },
  x => { x.currency = 'irr'; },
  x => { x.lines.has_more = true; },
  x => { x.lines.data[0].amount = 1249; },
  x => { x.lines.data.push({ ...x.lines.data[0] }); },
  x => { x.id = 'in_wrong'; },
]) {
  const copy = structuredClone(sample);
  mutate(copy);
  await check(502, { fetchImpl: mockedFetch({ invoice: copy }) });
}
const options = await run(200, { req: createRequest('https://factoreasy.ir', 'OPTIONS'), fetchImpl: noNetwork });
assert.equal(options.result.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
count++;
const untrustedOptions = await run(403, { req: createRequest('https://evil.example', 'OPTIONS'), fetchImpl: noNetwork });
assert.equal(untrustedOptions.result.headers.get('Access-Control-Allow-Origin'), null);
count++;
console.log('PASS: Finora Stripe Edge function tested with', count, 'sandbox access and adversarial cases; no production writes');
