# Request Workflow D4a Verification

Date: 2026-10-02

## Scope
D4a adds an actionable request work queue for direct approvers and valid time-bounded delegates. It does not dispatch outbox effects and does not alter posted accounting history.

## Implementation
- UI: `js/request-workflow-d4a.js`, loaded after D3c.
- Migration: `supabase/migrations/20261002033000_request_workflow_d4a_work_queue.sql`.
- Disposable DB assertions: `supabase/tests/request_d4a_work_queue.sql`.
- Static contract: `scripts/request-workflow-d4a-check.mjs`.
- Real DOM: `scripts/request-workflow-d4a.spec.js`.
- Menu task: `workqueue` under Requests → My work.

## Security and behavior
The queue is organization-scoped and entitlement-gated. An active step is returned only when the caller has its required capability or a currently valid delegation for that exact capability. Actors who already voted on the active step are excluded. Delegation provenance is projected to the UI. Decisions reuse the existing server-authorized `request_step_decide` path with expected revision and stable retry idempotency keys; D4a does not add a second mutation path.

## Verification
PR #21 head `328c7079ebdf7bb030fc8c058ffabcd4772ab93e` passed required Quality/Security checks. The disposable request database verified direct approver visibility, delegated visibility/provenance, post-decision removal and read-only unauthorized denial. Real-DOM smoke passed after correcting the production/test Supabase-client resolution and a strict locator ambiguity.

Squash merge: `4583703396a7ddb00bdad76b52c22932d634cbef`.
Main Quality run `36961361891`: SUCCESS. Static-quality job `110695556210` passed accounting phases 2–6, Golden accounting journey, D4a static invariants and 38/38 real-DOM tests. D1 request DB job `110695556278`: SUCCESS. C8 DB job `110695556042`: SUCCESS.
Main Security run `36961361897`: SUCCESS. Exact-SHA Release gate `36961459328`: SUCCESS. Gated Pages `36961492170`: SUCCESS.

Production Supabase `hcsixhqbyuhpshfwqpjx` recorded migration `20261002034311 request_workflow_d4a_work_queue`. Reconciliation confirmed the private implementation is SECURITY DEFINER with authenticated-only execution and contains both valid-delegation and prior-vote guards; the public wrapper is SECURITY INVOKER.

## Preserved boundaries
D4a is an inbox/decision slice only. D3c outbox delivery remains pending intent. External/destination consumers remain disabled until destination idempotency, retries/dead-letter handling and authorization are separately implemented and adversarially verified. Dependency review remains blocked by the repository Dependency graph boundary already documented in PROJECT_STATE.
