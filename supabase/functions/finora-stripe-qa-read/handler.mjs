// Fail-closed Finora Stripe QA gateway. ONLY a single synthetic sandbox draft can be read.
// No Stripe write verbs, accounting record writes, service-role key, or customer PII in responses.
export const QA_INVOICE_ID = 'in_1UPFYbGnbcoujdbeXnuN3Jf0';
const QA_REFERENCE = 'FINORA-QA-20261011-A';
const QA_AMOUNT_MINOR = 1250;
const TRUSTED_ORIGINS = new Set(['https://factoreasy.ir', 'https://davoodmehraban89.github.io']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const restrictedKey = /^rk_test_[a-zA-Z0-9]{12,}$/;
const resourceId = /^in_[a-zA-Z0-9]+$/;
const getEnv = (env, key) => (env(key) || '').trim();

function respond(status, body, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
  };
  if (TRUSTED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function safeInvoice(raw) {
  if (!raw || raw.id !== QA_INVOICE_ID || !resourceId.test(raw.id)) throw Error('id');
  if (raw.livemode !== false || raw.status !== 'draft' || raw.auto_advance !== false) throw Error('mode');
  if (raw.metadata?.finora_qa !== 'true' || raw.metadata?.environment !== 'sandbox' || raw.metadata?.finora_test_ref !== QA_REFERENCE) throw Error('marker');
  if (raw.currency !== 'usd' || raw.subtotal !== QA_AMOUNT_MINOR || raw.total !== QA_AMOUNT_MINOR || raw.amount_due !== QA_AMOUNT_MINOR) throw Error('amount');
  if (!raw.lines || raw.lines.has_more !== false || !Array.isArray(raw.lines.data) || raw.lines.data.length !== 1) throw Error('lines');
  const line = raw.lines.data[0];
  if (!line || line.amount !== QA_AMOUNT_MINOR || (line.currency && line.currency !== 'usd')) throw Error('line-amount');
  return {
    provider: 'stripe',
    environment: 'sandbox',
    reference: QA_REFERENCE,
    invoiceId: raw.id,
    invoiceStatus: 'draft',
    currency: 'USD',
    amountMinor: QA_AMOUNT_MINOR,
    lineCount: 1,
    ledgerPostingAllowed: false,
  };
}

export async function handleStripeQaPreview(request, { env, fetchImpl = fetch } = {}) {
  const origin = request.headers.get('origin');
  if (origin && !TRUSTED_ORIGINS.has(origin)) return respond(403, { error: 'origin_forbidden' }, origin);
  if (request.method === 'OPTIONS') return respond(200, { ok: true }, origin);
  if (request.method !== 'POST') return respond(405, { error: 'method_not_allowed' }, origin);

  const userId = getEnv(env, 'FINORA_STRIPE_QA_ALLOWED_USER_ID');
  const key = getEnv(env, 'STRIPE_SANDBOX_RESTRICTED_KEY');
  const apiUrl = getEnv(env, 'SUPABASE_URL').replace(/\/+$/, '');
  const supabaseKey = getEnv(env, 'SUPABASE_ANON_KEY');
  // Both user allowlist and restricted sandbox key must be deliberately provisioned.
  if (!uuid.test(userId) || !restrictedKey.test(key) || !apiUrl || !supabaseKey) {
    return respond(503, { error: 'sandbox_gateway_not_configured' }, origin);
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(apiUrl)) {
    return respond(503, { error: 'invalid_server_configuration' }, origin);
  }
  const bearer = request.headers.get('authorization') || '';
  if (!/^Bearer [A-Za-z0-9._~-]{20,}$/.test(bearer)) return respond(401, { error: 'authentication_required' }, origin);

  try {
    // Live Supabase Auth identity lookup; never trust a client-supplied user ID or JWT claims alone.
    const authResult = await fetchImpl(apiUrl + '/auth/v1/user', {
      method: 'GET',
      headers: { Authorization: bearer, apikey: supabaseKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    if (!authResult.ok) return respond(authResult.status === 401 || authResult.status === 403 ? 401 : 502, { error: 'authentication_failed' }, origin);
    const user = await authResult.json();
    if (!uuid.test(user?.id)) return respond(401, { error: 'authentication_failed' }, origin);
    if (user.id.toLowerCase() !== userId.toLowerCase()) return respond(403, { error: 'sandbox_access_denied' }, origin);

    // The only external financial request is a GET of the fixed, known QA draft.
    const stripeResult = await fetchImpl('https://api.stripe.com/v1/invoices/' + QA_INVOICE_ID, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    if (!stripeResult.ok) return respond(502, { error: 'stripe_sandbox_read_failed' }, origin);
    const preview = safeInvoice(await stripeResult.json());
    return respond(200, { ok: true, invoice: preview }, origin);
  } catch {
    // No exception body or API key is ever reflected to the client or logs.
    return respond(502, { error: 'sandbox_gateway_unavailable' }, origin);
  }
}
