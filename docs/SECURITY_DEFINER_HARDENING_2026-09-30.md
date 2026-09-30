# Finora — SECURITY DEFINER hardening evidence

Date: 2026-09-30
Production project: `hcsixhqbyuhpshfwqpjx`
Migration: `20260930041735_harden_public_security_definer_rpc_grants_search_path`

## Scope
This change hardens the seven public `SECURITY DEFINER` helpers currently reported by the Supabase security advisor:

- `admin_cancel_license(uuid)`
- `admin_extend_license(uuid, integer)`
- `admin_set_company_limit(uuid, integer)`
- `admin_set_license(uuid, text, integer, text)`
- `admin_set_license_modules(uuid, text[])`
- `has_active_license()`
- `is_admin()`

## Applied controls
- Every function now has an empty `search_path`.
- `EXECUTE` is explicitly revoked from `PUBLIC` and `anon`.
- `EXECUTE` is explicitly granted only to `authenticated` and `service_role` because these functions are intentionally part of the authenticated application RPC surface.
- The five administrative mutators retain their internal `public.is_admin()` authorization check before mutation.
- No license or financial data was changed by the hardening migration.

## Verification
Live production catalog verification after migration showed all seven functions with `search_path=""`, `anon_exec=false`, `authenticated=true`, and `service_role=true`.

A transactional negative test impersonated an authenticated non-admin user and attempted all five administrative mutators. Every call raised SQLSTATE `42501` (`forbidden`); the transaction was rolled back. `public.is_admin()` returned `false` for the same test principal.

## Advisor disposition
The Supabase advisor still reports seven `authenticated_security_definer_function_executable` warnings. This is expected because the functions remain intentionally callable by signed-in application users and the advisor flags exposure, not a proven authorization bypass. The warning is therefore **reviewed but not silently closed**.

For a future zero-warning architecture, move privileged license mutation behind a non-exposed/private execution boundary (for example a server/Edge Function that performs explicit authorization) and remove authenticated Data API execution of the public definer mutators. That is an architectural change and must be regression-tested before rollout.

Leaked-password protection remains a separate open P1 item.
