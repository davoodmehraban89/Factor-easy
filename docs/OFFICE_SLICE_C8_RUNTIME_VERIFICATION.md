# Office Slice C8 — Workflow Runtime Verification

Date: 2026-10-01

## Scope
C8 adds internal, tenant-scoped correspondence workflow policy and runtime state. It does not replace C1 correspondence status/history, C5 approval evidence, accounting state, external BPM, qualified digital signature, or external delivery.

## Production migrations
- `20261001173917_office_slice_c8_workflow_policy`
- `20261001180610_office_slice_c8_workflow_runtime`
- `20261001180949_office_c8_policy_publisher_fk_index`

Exact applied SQL is archived under `supabase/migrations/` using the live migration versions.

## Runtime contract
- One pinned workflow instance per correspondence.
- Append-only event history with `(instance_id, revision)` uniqueness.
- Organization-scoped idempotency key uniqueness.
- `office_workflow_attach`, `office_workflow_transition`, and `office_workflow_read` are public `SECURITY INVOKER` wrappers.
- Private implementation functions re-check authentication, active organization membership, module entitlement, record visibility/scope, and required edge capability.
- Write paths require active writable entitlement; read preserves expired/read-only entitlement semantics.
- Attach/transition only accept canonical C1 `registered` / `submitted` correspondence states; draft/closed/null states fail closed.
- Transition uses source-letter then workflow-instance row locking plus `expected_revision`; stale competing writes return SQLSTATE `40001`.
- Same request ID + same actor + same payload replays the original result without duplicate evidence; authorization is re-evaluated before replay.
- Event labels are copied into immutable history so historical text does not drift with later policy versions.

## Verification evidence
The disposable PostgreSQL 17 CI job applies the archived policy and runtime migrations, then runs:
- `supabase/tests/office_c8_workflow.sql`
- `supabase/tests/office_c8_runtime.sql`
- `scripts/office-c8-concurrency.mjs`
- `supabase/tests/office_c8_runtime_security.sql`

Verified scenarios include legal attach/transition, exact retry idempotency, stale revision, illegal edge, null/negative revision, terminal stage, cursor/limit validation, invalid correspondence states, expired/read-only behavior, capability revocation before retry, suspended membership, foreign tenant, unreadable correspondence, anonymous denial, direct-table grant closure, immutable event history, pinned-policy immutability, private-entry authorization, FK index coverage, and a real two-session race producing exactly one success, one stale result and one revision-1 event.

CI database gate `36903736300` passed the archived runtime migration, transactional behavior and two-session concurrency test before production deployment. Subsequent hardening added the missing policy `published_by` FK index after the Supabase performance advisor identified it; the corresponding regression assertion is now part of the C8 database gate.

## Production verification
After deployment, live catalog verification confirmed both runtime tables and all three public RPCs exist; RLS is enabled on both private runtime tables; authenticated direct table SELECT/INSERT privileges remain closed; persistent workflow instance/event row counts remained zero. Supabase performance advisor no longer reports any unindexed foreign key. Security advisor reports only the pre-existing public SECURITY DEFINER warnings plus private-table no-policy informational notices and leaked-password protection warning; C8 public wrappers did not add a public SECURITY DEFINER warning.

## Remaining C8 work
Runtime UI integration, retry/stale UX, safe text rendering, focused real-DOM coverage, live authenticated browser flow where legitimate fixtures exist, and final C8 closure evidence remain to be completed in the next C8 task.
