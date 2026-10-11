# Stripe sandbox invoice integration probe — 2026-10-11

## Verified with the connected Stripe plugin (actual API operations)
- Account: **Finora ERP sandbox**, `livemode=false`.
- Created synthetic customer without an email address or payment method.
- Created a **draft**, `auto_advance=false`, USD invoice; did not finalize, send, or charge.
- Added one synthetic line for **USD 12.50 (1,250 cents)**.
- Read invoice back by ID and through list endpoint. Stripe returned `status=draft`, `subtotal=total=amount_due=1250`, one line, `livemode=false`.
- Verified Stripe invoice ID `in_1UPFYbGnbcoujdbeXnuN3Jf0` and marker `FINORA-QA-20261011-A`.
- Initial attempt to create `send_invoice` without a customer email was **rejected by Stripe**; used `charge_automatically` plus `auto_advance=false`, with **no attached payment method**. No attempt to finalize or take payment.
- Stripe ChatGPT plugin succeeded; this does **not** grant Finora's static Pages client or Supabase backend an API key.

## Delivered repository-side acceptance gate
- `scripts/stripe-sandbox-readonly.mjs`: server-side only, read-only GET adapter that rejects live keys, non-sandbox/non-draft/non-marked invoices, mismatched currency/amount/lines, and incomplete line pagination. It cannot create invoices or post accounting entries.
- `scripts/stripe-sandbox-readonly-test.mjs`: deterministic positive and adversarial tests; uses a deliberately synthetic reconstruction of the observed sandbox invoice.
- `scripts/fixtures/stripe-sandbox-invoice-synthetic.json`: **synthetic QA snapshot**, not a production/customer export.
- CI invokes the tests; no secret or credential is stored in the repository.

## Test locally without credentials
```sh
node scripts/stripe-sandbox-readonly-test.mjs
node scripts/stripe-sandbox-readonly.mjs --fixture scripts/fixtures/stripe-sandbox-invoice-synthetic.json
```

## Optional DIRECT API connectivity test — still NOT VERIFIED
The installed ChatGPT Stripe connection cannot be reused as a server credential. To test direct access from the Finora execution environment, an owner-controlled **restricted Stripe sandbox key** with only invoice-read scope must be provided via environment variable on a trusted server (never in Git, chat, GitHub Pages, or browser JS).
```sh
# Set the environment variable privately in the trusted server shell:
node scripts/stripe-sandbox-readonly.mjs --live in_1UPFYbGnbcoujdbeXnuN3Jf0
```
Variable name: `STRIPE_SANDBOX_RESTRICTED_KEY`. The adapter accepts only `rk_test_` keys. The test cannot run until this server-only key is configured.

## Full Finora integration boundaries (NOT IMPLEMENTED)
- Require authenticated, authorized company-to-Stripe-account mapping stored **server-side**, with tenant-scoped verification and an auditable least-privilege role.
- Enforce idempotent external invoice identifiers, reconciliation, event replay protection, signed webhooks, and controlled error/retry handling.
- Never convert USD cents directly into IRR/toman journal rows. Apply explicit currency/exchange-rate policy and Iranian tax rules subject to accounting review.
- Production Stripe financial writes, posting, Supabase schema/auth changes, protected key provisioning, and public release require separately reviewed scopes and safety checks.
- ERPNext/Odoo/Beancount are **not** installed/connected by this Stripe test.

## Acceptance
Sandbox draft create/line append/read verified via plugin. Repository read-only adapter + fixture tests are separately checked by CI. A full production financial integration or authenticated tenant E2E **must not be claimed**.
