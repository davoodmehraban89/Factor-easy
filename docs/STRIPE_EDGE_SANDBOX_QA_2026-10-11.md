# Finora — restricted Stripe sandbox Edge gateway (2026-10-11)

## Purpose / rollout
The only endpoint is a **QA preview** of the previously verified synthetic USD 12.50 Stripe draft invoice. It does not handle actual financial records, payments, subscriptions, document posting, exchange rates, production Stripe keys or Stripe webhooks.

This code is deliberately **fail-closed by default**. No result is returned without both an explicitly configured restricted **test** Stripe API key and one exact approved Supabase user UUID. The Supabase platform must set `verify_jwt=true` (mandatory), and the handler re-verifies the caller with Supabase Auth before checking the exact user ID.

Project: `hcsixhqbyuhpshfwqpjx`; function slug: `finora-stripe-qa-read`. No DB migrations, RLS changes, licenses, auth metadata, or financial-history writes.

## Owner-only secrets — never send to ChatGPT or commit
1. In **Stripe Dashboard**, switch the account picker to the sandbox called **Finora ERP sandbox**. Under **Developers → API keys**, create a **restricted** API key, not a secret/unrestricted key. Set **Invoices: Read**, all other resource permissions **None**. The key must begin with `rk_test_`. If Stripe's interface requires an associated resource for invoice reads, grant read-only access to that resource only, and remove any unnecessary permissions after testing.
2. Open the Finora Supabase project's [Edge Functions → Secrets](https://supabase.com/dashboard/project/hcsixhqbyuhpshfwqpjx/functions/secrets). Add `STRIPE_SANDBOX_RESTRICTED_KEY` with the new sandbox-only key value. It must stay *only* inside Supabase secrets.
3. In the same page, set `FINORA_STRIPE_QA_ALLOWED_USER_ID` to the **Auth → Users → User UID** of the ONE intended authorized Finora tester. Do not paste tokens or keys into chats, browser code, GitHub, or plaintext files.
4. Tell the development assistant only **"دو مقدار امن ثبت شد"** (no key/UID shared). Re-test with an authenticated tester account. Supabase Secrets updates do not require an Edge Function redeploy.

Official guidance: https://docs.stripe.com/keys/restricted-api-keys and https://supabase.com/docs/guides/functions/secrets

## Request contract
Requires a current valid Supabase user JWT and the exact allowlisted user. Only POST and OPTIONS. Browsers accept only the actual Finora origins:
- https://factoreasy.ir
- https://davoodmehraban89.github.io

Endpoint (no query parameters): `https://hcsixhqbyuhpshfwqpjx.supabase.co/functions/v1/finora-stripe-qa-read`.
With an existing signed-in Supabase browser client, a development tester may invoke:
```js
const response = await sb.functions.invoke('finora-stripe-qa-read', { body: {} });
console.log(response.data, response.error);
```
This example MUST NOT be treated as a production UI feature or embedded in normal customer workflows. It never inserts Finora invoices or books journal entries.

## Reproducible tests
```sh
node scripts/stripe-edge-sandbox-test.mjs
node scripts/stripe-sandbox-readonly-test.mjs
node scripts/golden-accounting-core-check.mjs
```
All mock API traffic stays in process. Tests assert denied origins/verbs/missing config, exact authenticated allowlist, no live Stripe key, fixed invoice ID, sandbox status, amount, currency and line consistency.

## Approval gates for a future real integration
- Live Stripe account authorization is NOT granted by this sandbox connector.
- Written decision on multi-company/tenant authorization, organization ownership, audit trail, idempotency, exchange rates, tax treatment and accounting posting rules.
- Signed webhook verification, minimal backend permission roles, replay resistance and event-to-ledger reconciliation.
- Review actual costs/eligibility before activating any production payment features.
