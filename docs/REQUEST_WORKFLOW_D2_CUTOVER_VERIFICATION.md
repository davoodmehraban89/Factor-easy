# Request Workflow Slice D2 — UI / Read-Model Cutover Verification

Date: 2026-10-01

## Scope
D2 cuts the Requests UI/runtime away from legacy `records` requestTypes/requests for new operation and onto the server-authorized D1 model. Legacy records are retained non-destructively for rollback/audit.

## Implemented
- `js/request-workflow-d2.js` loads after legacy office automation and replaces the Requests render/runtime surface.
- Request types and published immutable versions are read from `request_type_definitions` / `request_type_versions`.
- Publishing uses `request_publish_type_version` with expected definition revision; stale revisions refresh rather than overwrite.
- New request creation uses `request_create_instance` and retains the same client idempotency key across a failed retry.
- Configure actions are hidden/blocked unless `requests_workflow.configure` is effective; creation requires create capability.
- Published-version and unsaved UI draft-change state are visible.
- Legacy request-store writes are not used by D2.

## Production data cutover
Archived repo migration: `supabase/migrations/20261001223500_request_workflow_d2_legacy_cutover.sql`.
Production Supabase migration history name: `request_workflow_d2_legacy_cutover` (production version `20261001190938`).

The migration is non-destructive and traceable:
- Adds `legacy_record_id` trace columns and `legacy_number` on request instances.
- Imports legacy request types into D1 definitions + immutable version 1 + workflow snapshot.
- Imports legacy requests into pinned D1 instances with `legacy_import` immutable evidence.
- Uses deterministic IDs / unique legacy indexes / conflict-safe inserts so rerun is idempotent.
- Does not delete or update source `public.records` rows.

Production reconciliation immediately after migration:
- legacy request types in `records`: 2
- legacy requests in `records`: 4
- migrated D1 definitions: 2
- migrated D1 type versions: 2
- migrated D1 request instances: 4
- immutable `legacy_import` events: 4

## Performance hardening
Archived repo migration: `supabase/migrations/20261001224500_request_workflow_d2_fk_indexes.sql`.
Production migration applied as `request_workflow_d2_fk_indexes`.
Eight covering FK indexes were added for request actor/instance/version/requester/publisher relations. The production Supabase performance advisor was re-run afterwards: the prior request-workflow `unindexed_foreign_keys` findings were eliminated; only unused-index informational findings remained for the newly created/other low-traffic indexes.

## Security verification
Production Supabase security advisor after D2 reports no new request-workflow security warning. The D1 public request RPCs remain SECURITY INVOKER wrappers; the advisor still reports the pre-existing 20 public SECURITY DEFINER warnings outside D1/D2, the three pre-existing private C8 RLS-without-policy informational findings, and leaked-password protection disabled.

## Automated verification
Quality run `36912668369` on commit `ef3e9c1c9e580ab273beb6372027523a9aec03ca` completed successfully:
- JavaScript syntax: SUCCESS
- all existing static/accounting/platform/office gates: SUCCESS
- Request Workflow D1 static/security gates: SUCCESS
- Request Workflow D2 UI/read-model static gate: SUCCESS
- Real DOM smoke suite including `scripts/request-workflow-d2.spec.js`: SUCCESS
- C8 disposable PostgreSQL suite: SUCCESS
- D1 + D2 disposable PostgreSQL suite: SUCCESS

D2 database assertions cover legacy preservation, immutable version/workflow snapshots, migrated submitted instances, legacy number/value preservation, immutable import evidence, migration idempotency, and all eight FK covering indexes.

## Verified boundary
D2 does not yet implement the D3 visual workflow designer, sequential/parallel step semantics, conditions DSL, SLA/escalation, delegation/substitution, or cross-module outbox actions. Those remain next-slice work. External BPM/provider integration remains outside verified scope.
