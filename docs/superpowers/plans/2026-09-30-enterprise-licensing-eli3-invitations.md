# Enterprise Licensing ELI-3 — Invitations Plan

Date: 2026-09-30

Goal: securely invite a named user who does not need to be an existing organization member, while keeping seat enforcement atomic and commercial entitlements independent.

Vertical steps:
1. Server lifecycle: invitation + role links; token generated server-side and only SHA-256 hash persisted.
2. Create/revoke/expire management restricted to owner or delegated `core/configure`.
3. Acceptance bound to authenticated email, active organization license and atomic seat trigger.
4. Acceptance creates/reactivates membership and role assignments in one transaction; same-user duplicate acceptance is idempotent.
5. UI: organization admin can create/revoke invitations and copy one-time invitation URL; login/app startup can detect `?invite=` and accept.
6. External email sending remains an adapter boundary and NOT VERIFIED until a provider is connected.
7. Production adversarial tests: wrong email, expired/revoked token, replay, full-seat rejection, cross-tenant roles, audit and rollback.
