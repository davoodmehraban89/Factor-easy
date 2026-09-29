# Phase 4 Verification — Final QA, Security, Performance, Release

> **Legacy verification note:** this file belongs to the older Finora 1.0 four-phase release sequence (2026-09-28). It is **not** the current six-phase roadmap's Phase 4 contracting verification. For the current master roadmap Phase 4, use [`PHASE_4_REDESIGN_VERIFICATION.md`](PHASE_4_REDESIGN_VERIFICATION.md). Historical evidence below is retained for audit continuity.

Verified on 2026-09-28.

## Automated release gates
- Quality checks: PASS on production head `b7335fe45ace75dd8f43e56fb0c39fcd87f69447`.
- CodeQL JavaScript: PASS on production head.
- GitHub Pages build/deployment: PASS on production head.
- Production CSP now denies framing and upgrades insecure requests; strict-origin referrer metadata is present.
- Release and rollback runbook is committed at `docs/PRODUCTION_RUNBOOK.md`.

## Database validation
- Supabase performance advisor: no findings.
- Production record collections contain 5 companies, 3 contacts, 7 invoices, 59 products and 2 settings records at verification time.
- Payment-to-contact referential audit: zero invalid references.
- RLS remains enabled on the production data model.

## Security advisor disposition
Supabase reports warnings for five authenticated-callable SECURITY DEFINER functions. These functions are intentional application API/authorization helpers: anonymous execution is revoked, fixed `search_path=public` is set, and the three mutating admin RPCs enforce `public.is_admin()` before changing licenses. They are retained because the admin UI depends on authenticated RPC execution.

Supabase also reports Leaked Password Protection disabled. This is an external Auth dashboard control and cannot be changed by repository code; it remains an operational hardening item, documented in the production runbook.

## Release status
Phase 4: COMPLETED for repository-controlled implementation, QA, security scan, performance review and production deployment.

External service hardening item: enable Supabase Leaked Password Protection in the Auth dashboard when available for this project.
