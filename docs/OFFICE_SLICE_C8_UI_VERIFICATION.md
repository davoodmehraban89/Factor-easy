# Office Slice C8 — Runtime UI Verification

Date: 2026-10-01

## Scope
This checkpoint integrates the already-deployed C8 workflow runtime into correspondence UI. It does not change production schema, workflow policy semantics, C1 registration/read evidence, C5 approval evidence, accounting state, qualified digital signature, external BPM, or external delivery.

## Runtime behavior
- `js/office-workflow.js` reads workflow state through `office_workflow_read` and renders server-originated policy/stage/event text with DOM `textContent`, not HTML injection.
- A correspondence with no workflow can attach one published policy version with a UUID request id.
- Allowed transition buttons come only from the server-returned `allowed_edges`; transition requests send the current `expected_revision` and a UUID request id.
- The same pending user intent retains its request id across a transport retry. Duplicate in-flight intent is suppressed.
- SQLSTATE `40001` is treated as stale state: the client refreshes and requires the user to choose the action again; it never blind-retries the mutation.
- Authorization denial is not treated as a successful mutation.
- Runtime reads are bound to the organization/generation captured when the panel opens. A late response after organization switch is discarded.
- Mutation results are kept unless a post-mutation read is at least as new as the returned revision, preventing an older/no-instance response from undoing a confirmed client result.
- The runtime module is duplicate-load guarded because the production bootstrap and focused Playwright fixtures can otherwise race while loading the same script.
- Production bootstrap loads C8 after `office-mature.js`. The C8 integration wraps the existing C1 read-evidence hook and opens the workflow panel only after the existing read gate succeeds (draft correspondence remains exempt exactly as in C1).
- UI copy explicitly states that workflow stage is not a replacement for دبیرخانه registration or internal approval.

## TDD / verification evidence
The RED contract was observed in Quality run `36906122585`: the disposable C8 database job passed, prior accounting/static gates passed, and the real-DOM suite failed only in the new C8 runtime expectations (`24 passed / 3 failed`).

After implementation and hardening, head `eeab2b88a4ceb9cb597c44852662d04f218b9af0` passed Quality run `36906544480`:
- all accounting Phase 2–6 and Golden accounting checks passed;
- C1–C8 static/runtime checks passed;
- disposable PostgreSQL C8 policy/runtime/security/concurrency job passed;
- Chromium real-DOM suite: `27 passed (16.1s)` including safe server-text rendering, transition revision/idempotency, stale refresh, retry request-id reuse, attach flow, duplicate-intent suppression and tenant-switch late-response discard.

Security run `36906544425` passed CodeQL and dependency-review workflow checks for the same head.

## Remaining C8 closure work
- Reconcile `PROJECT_STATE.md` with the Task 2 merge and this Task 3 evidence, then merge the verified PR.
- Re-check production catalog/advisors and zero-residue counts after merge; Task 3 itself has no database DDL.
- Live authenticated browser verification against a legitimate persistent production correspondence remains unavailable while production has no legitimate fixture; do not fabricate persistent production data solely to claim browser E2E.
- Final C8 closure must keep qualified digital signature and external delivery/provider integration explicitly outside verified scope.
