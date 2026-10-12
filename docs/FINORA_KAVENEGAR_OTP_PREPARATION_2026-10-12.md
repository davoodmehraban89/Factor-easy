# Finora — Kavenegar SMS OTP integration preparation (2026-10-12)

**Status: OFFLINE PREPARATION ONLY; NO LIVE SMS, NO AUTH CONFIG CHANGE, NO LIVE EDGE DEPLOY.**

## Authority / current factual baseline
Owner has **approved preparation** of mobile OTP integration, **not claimed that Kavenegar approved** the template. Last Kavenegar screenshot of `FinoraLogin` displayed `در حال بررسی`. Do not infer approved from chat shorthand. Sender/real delivery/provider credit have NOT been verified.

The existing application uses Supabase Auth email OTP / password / Google; `public.profiles.phone` and unique non-null phone index exist; prior live migration `phone_identity_profile` was recorded, but that does **not** prove matching `auth.users.phone` or securely linked identities. Historic phone PR #58 is open/stale; do not merge it or reapply its migration without reconciliation. Supabase currently has **no deployed** `finora-kavenegar-send-sms` Edge Function.

An authorized Remote Desktop Commander device `DESKTOP-71SJ63M` is online. Local checkout `C:\Temp\Factor-easy` was read-only checked: branch `main`, SHA `b1a35fdc1df71c46c287bec47be54fa6e8641428`, 0 tracked changes and 2189 untracked files. **It is stale and has many untracked files**: do not reset, clean, overwrite or sync it without separate review. This preparation is authored on a GitHub feature branch.

## Proposed integration
`Supabase Auth` creates and validates OTP; it calls its **Send SMS HTTP Hook** with a signed Standard Webhooks event (`user.phone`, `sms.otp`). Server-side Deno Edge Function verifies **raw-body signature and timestamp**, validates E.164 `+989xxxxxxxxx` phone and 6–10 digit OTP, converts phone to local `09...` and posts `application/x-www-form-urlencoded` to Kavenegar `/v1/<API_KEY>/verify/lookup.json` with fixed `template=FinoraLogin`. Supabase alone issues Auth JWT/session and existing Finora membership/license/RLS rules remain authoritative.

Function files: `supabase/functions/finora-kavenegar-send-sms/{index.ts,handler.mjs}`. It rejects all requests unless `FINORA_KAVENEGAR_OTP_ENABLED=true`, and even then rejects unsigned, expired, malformed or missing-secret events. It **never** receives a browser call or generates, stores or verifies the OTP. No customer identity search, tenant data access, service-role key, SQL or business record write is required.

## Activation gates (do not perform in preparation phase)
1. Independently see `FinoraLogin` in Kavenegar state **تأیید شده**. Confirm verify/lookup is allowed on this tariff, short-SMS unit cost/credit and live sender deliverability.
2. Set `KAVENEGAR_API_KEY` and `SEND_SMS_HOOK_SECRET` **only in Supabase server-side encrypted Edge secrets**, not in messages, public GitHub, logs, browser, desktop env files or screenshots. Generate hook signing secret through Supabase Auth Hooks (use actual value, not the sample). Configure Edge Function for `verify_jwt=false` **only at activation**, because incoming signed Auth hook requests have no end-user JWT; the handler enforces signature verification. This setting is sensitive; require owner confirmation.
3. Deploy the Edge Function under owner-approved rollout, while `FINORA_KAVENEGAR_OTP_ENABLED` remains unset/false; configure Auth's `Send SMS Hook` to its HTTPS URL and enable the phone provider only in a controlled window after explicit owner confirmation. **Never** configure a fail-closed disabled hook as the active route for real users.
4. Stage one real SMS to an explicitly approved test number; external messaging **and cost** require owner authorization. A Kavenegar API status 200 means *accepted by provider*, not verified delivery. Verify real handset receipt and OTP expiry/attempt limit, no 1-to-many runaway resends.
5. **Before real login rollout:** authenticated owner must securely link a verified phone to **the existing `auth.users.id`**, reconcile any conflicting existing phone identity and preserve memberships, licenses and all tenant/financial records. The existing profile's phone text is not, by itself, a validated Auth login method. Do not directly mutate Auth or RLS without explicit authorization. Keep `shouldCreateUser:false` for existing-user sign-in; do not auto-create anonymous phone users.
6. Implement the mobile-first login form in a separately gated PR **after** provider, identity linking and server hooks pass. Preserve email/password and Google fallback. Verify browser CSP handlers, retry/rate limiting, CAPTCHA, account lockout, RTL mobile UX, session restore, +98 normalization, masking/error states, and correct org isolation; validate on owner's affected ISP.
7. Merge/release only after full static/Chromium/Golden/3 PostgreSQL/Security checks, gated Pages and owner test. F0-01 and Phase 0 remain open until real acceptance. Rollback via removing SMS entry point and restoring existing Auth settings after coordinated owner approval.

## Offline acceptance and limitations
- Run `node scripts/kavenegar-otp-preflight-test.mjs` (no internet, no SMS, synthetic token / hook signing secret); CI also executes it.
- No secrets or credential data in repo. Never log the webhook body/provider URL, phone, token or upstream response JSON.
- The hook enforces a 5-minute signed-message timestamp window but does **not** persist event-id replay deduplication. Supabase Auth rate limits and a later approved cost/sending control remain required before production.
- Provider timeout is 3.5 seconds to fit Supabase Auth HTTP hook timeout (~5 seconds). Invalid provider response fails closed and returns non-200; it never falsely acknowledges SMS delivery.
- **Not verified:** Kavenegar approval, actual SMS/charges, Supabase Auth phone setting, provider SMS hook wiring, live sender, actual phone-to-existing-user secure linking, site UI and mobile sign-in. Do not mark any as complete from passing synthetic tests.

## Public technical references
- Supabase: https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
- Supabase Auth Hook security: https://supabase.com/docs/guides/auth/auth-hooks
- Standard Webhooks spec: https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md
- Kavenegar SDK verification example: https://github.com/KaveNegar/kavenegar-node

