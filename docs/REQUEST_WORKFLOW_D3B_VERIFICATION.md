# Request Workflow D3b Verification

Date: 2026-10-01

## Scope
D3b adds a visual request-workflow editor on top of D3a, a bounded server-validated condition DSL, persisted skipped-step condition evidence, and an authorized read-only runtime timeline. It does not merge Requests with the C8 correspondence workflow.

## Implementation
- UI: `js/request-workflow-d3b.js`, loaded after D2 from `js/bootstrap.js`.
- Database: `supabase/migrations/20261001233000_request_workflow_d3b_conditions_timeline.sql`.
- Static contract: `scripts/request-workflow-d3b-check.mjs`.
- Real DOM: `scripts/request-workflow-d3b.spec.js`.
- Disposable PostgreSQL: `supabase/tests/request_d3b_condition_timeline.sql`.

## Condition boundary
The D3b condition language is intentionally bounded to one predicate per step: a validated field key plus one of `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `exists`, `not_exists` and an optional scalar value. Field keys are restricted to `[a-z][a-z0-9_]{0,63}`. No arbitrary SQL, JavaScript, function name, expression string, nested executable expression or user-supplied operator is evaluated.

Conditions are evaluated by the database against the immutable request values at instance creation. False conditions create a retained `skipped` step instance with `condition_json` and `condition_matched=false`; they are not silently deleted. The first matched step becomes active. If every D3b step is skipped, the request is server-completed as approved with a `workflow_auto_complete` immutable event and revision advance.

## Timeline authorization
`public.request_workflow_timeline(uuid)` is SECURITY INVOKER and executable by `authenticated`, not `anon`. The private implementation rechecks authentication, organization membership, module entitlement and requester/approve/edit visibility before reading private step state. It returns request state, ordered step state/approval counts/condition evidence and immutable request events.

## TDD evidence
- Red commit `8371918f8a0792a2c156161820ed622117d0006c` added D3b contracts before production implementation; `static-quality` failed because the D3b production files did not yet exist.
- Green implementation commit `175c00529e4005c15cea352f7c5e9fb11867e96e` made static contracts, disposable PostgreSQL behavior and the initial D3b real-DOM tests pass.
- A follow-up regression test commit `ca1fe68dc8c8624281824e43f16d4a20d7f49030` intentionally failed Real DOM because publishing replaced the D2 builder DOM and removed the D3b editor.
- Fix commit `eb04c5a2cc2160d6f1abab22104336ff522b89de` remounts the editor after publish. Quality run `36915696611` completed with `static-quality`, `d1-request-database`, and `c8-policy-database` all SUCCESS; Real DOM smoke passed all 33 tests including the D3b editor/timeline cases.

## Production verification
Migration `request_workflow_d3b_conditions_timeline` was applied to Supabase project `hcsixhqbyuhpshfwqpjx` after disposable-DB verification. Production checks confirmed:
- `condition_json` and `condition_matched` exist on private request step instances.
- authenticated can execute the public timeline RPC; anon cannot.
- the public timeline wrapper is SECURITY INVOKER.
- numeric comparisons safely handle form values stored as numeric strings (`1200 >= 1000` true; `500 >= 1000` false).
- the post-migration security advisor added no D3b/request-workflow SECURITY DEFINER warning; the existing 20 public SECURITY DEFINER warnings, C8 private-RLS informational notices and leaked-password protection warning remain pre-existing open items.
- the performance advisor reports no unindexed-foreign-key finding; only expected unused-index informational notices on the low-traffic dataset.

## Preserved boundaries
- D2 legacy request records remain preserved for rollback/audit and are not reactivated as the runtime source.
- C8 correspondence registration/approval/workflow evidence remains independent from Requests.
- D3b does not implement SLA/escalation, delegation/substitution, cross-module outbox actions, external BPM adapters or qualified digital signatures. Those remain D3c/external work.
- Authenticated two-real-user production browser E2E remains outside verified scope because no persistent legitimate second member was provisioned for this slice.
