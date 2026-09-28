# Finora 8.1 — Production Runbook

Release date: 2026-09-28

## Release source
Production is built from the `main` branch. Every production commit must pass the Quality checks workflow and the JavaScript CodeQL workflow. GitHub Pages is the deployment target.

## Pre-release gates
1. JavaScript syntax check for every file under `js/`.
2. Product invariant check via `scripts/quality-check.mjs`.
3. CodeQL JavaScript/TypeScript analysis.
4. Supabase security and performance advisors reviewed.
5. Production records checked for supported collections and referential consistency.

## Rollback
Use the last known-good production commit SHA. Move/revert `main` to a new revert commit based on that SHA rather than deleting production history, then allow GitHub Pages to redeploy. Database schema changes are migration-managed and must not be rolled back by deleting production data.

## Database safety
RLS remains the server-side authorization boundary. The public Supabase key is a publishable client key; a service-role key must never be committed to this repository. Admin license RPCs perform an internal `is_admin()` authorization check. Do not remove that check.

## Operational follow-up
Supabase Leaked Password Protection is a dashboard-level Auth control and should be enabled when available for the project. SMTP delivery should use a production provider. Review Supabase advisors after every schema/auth change.

## Known external limitations
The Taxpayer System API integration is not live in 8.1. Offline PWA caching is not part of 8.1. Physical printer/driver variation cannot be fully covered by repository CI.
