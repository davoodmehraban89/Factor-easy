# Request Workflow D3c Verification

Date: 2026-10-01

## Scope
D3c completes the bounded request-workflow roadmap slice with step SLA/deadline evidence, explicit time-bounded delegation/substitution, and a transactional cross-module outbox. It does not dispatch external/module side effects directly and it does not mutate posted accounting history.

## Implementation
- UI: `js/request-workflow-d3c.js`, loaded after D3b.
- Main migration: `supabase/migrations/20261001235500_request_workflow_d3c_operations.sql`.
- Escalation idempotency follow-up: `supabase/migrations/20261002000500_request_workflow_d3c_escalation_conflict_fix.sql`.
- Delegation FK index: `supabase/migrations/20261002001000_request_delegation_to_user_fk_index.sql`.
- Static contract: `scripts/request-workflow-d3c-check.mjs`.
- Real DOM: `scripts/request-workflow-d3c.spec.js`.
- Disposable PostgreSQL: `supabase/tests/request_d3c_operations.sql`.

## SLA and escalation
Workflow schema v2 accepts optional `slaHours` per step, server-validated to 1..8760. Runtime step instances materialize `sla_hours` and `due_at` when a step becomes active. `request_escalate_overdue` is configure-capability gated, marks overdue active steps once, increments explicit escalation evidence and appends immutable `step_escalated:<step>` events. The UI exposes SLA configuration, timeline evidence and a controlled overdue scan action. No background scheduler was invented; automatic scheduling remains an operations boundary.

## Delegation/substitution
Delegations are private, explicit, time-bounded (maximum 90 days), organization-scoped and capability-specific. A user can delegate only a workflow capability they currently hold to another active member. Decision authorization revalidates that the source user still holds the delegated capability. Delegated votes retain `delegated_from_user_id`; the actor is never impersonated. Create/revoke operations are organization-audited and public RPC wrappers are SECURITY INVOKER.

## Transactional outbox
A workflow may declare at most 10 `onApproved` actions. Target modules are allowlisted, action keys are restricted identifiers and payload configuration must be a bounded JSON object. Final approval and outbox insertion occur in the same database transaction. The outbox stores pending intent only; no dispatcher in D3c directly calls another module or external provider. Unique request/revision/module/action keys make enqueue retry-safe.

## TDD / defect evidence
- Red contract commit `d7f5972476cabde22b340bbcfa94ac2aa7e57093` added D3c static/DOM/database expectations before production implementation; static quality failed because D3c production files did not exist.
- Implementation commit `8e93dcb67534e6b1b302fd435c714f392eb0ca6a` added D3c UI/database behavior.
- The first disposable DB run exposed a test-bootstrap compatibility regression (`organizations.name` lacked a default); commit `cba9fec2be2b469d4ccfa8bea9a260b8c0ee73e5` repaired the disposable bootstrap without weakening production schema.
- The next D3c behavior run exposed an incorrect escalation `ON CONFLICT` target. Migration `20261002000500` corrected it to the real `(organization_id,idempotency_key)` uniqueness boundary.
- Production performance advisor then found the delegation target FK lacked a leading index; migration `20261002001000` added `request_delegations_to_user_idx` and a fresh advisor run removed all unindexed-FK findings.

## Verification
Quality run `36917772952` on commit `be4f85b21ba3c608fcba0d0812182d0e063d6391` completed with all three jobs SUCCESS:
- `static-quality`: D3c static invariants and full Real DOM smoke SUCCESS.
- `d1-request-database`: D1/D2/D3a/D3b regressions plus D3c SLA, delegated approval provenance, transactional outbox, escalation evidence, invalid SLA and unsafe action-key rejection all SUCCESS.
- `c8-policy-database`: C8 correspondence workflow regression suite SUCCESS.

Production Supabase `hcsixhqbyuhpshfwqpjx` received D3c main/follow-up/index migrations. Production reconciliation confirmed private delegation/outbox tables, SLA/delegation columns, authenticated-only public RPC execution, SECURITY INVOKER public wrappers and no direct authenticated grants on private D3c tables. Security advisor shows no new D3c public SECURITY DEFINER warning. Performance advisor shows no unindexed foreign key after the target-user index fix; only expected unused-index informational findings remain on the low-traffic dataset.

## Preserved boundaries
- Requests remain independent from C8 correspondence workflow state.
- Legacy D2 request source records remain preserved for rollback/audit.
- Outbox delivery/dispatch is intentionally not claimed verified; no downstream module adapter is executed by D3c.
- Automatic scheduled escalation is not claimed verified; D3c provides deterministic server-side escalation evidence and a controlled trigger.
- Two-real-user production browser E2E with a persistent legitimate non-owner member remains outside verified scope; delegated multi-user behavior is verified in disposable PostgreSQL with distinct authenticated identities.
- Qualified digital signature, external BPM/delivery providers and real OCR provider remain external boundaries.
