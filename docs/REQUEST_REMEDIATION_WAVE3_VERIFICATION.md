# Request Remediation F-412 + Wave 3 Verification — 2026-10-02

## Scope
- F-412: deterministic legacy request-type duplicate-code collision detection.
- F-415: authorization before decision replay.
- F-416: stable idempotent decision replay response.

## Repository evidence
- PR: #23
- Merge SHA: `d13498f3af03f544c05168727b440f053de1d733`
- Main Quality: `36973781026` — SUCCESS.
- Main Security: `36973781055` — SUCCESS.
- Exact-SHA Release gate: `36973927530` — SUCCESS.
- Gated Pages: `36973959986` — SUCCESS.
- PR Dependency Review failed only because GitHub Dependency Graph is disabled; the protected required Release/QA safety and CodeQL checks passed.

## Database evidence
- Production project: `hcsixhqbyuhpshfwqpjx`.
- `20261002063121 request_wave2_duplicate_code_guard`.
- `20261002063123 request_wave3_decision_idempotency`.
- Production read-only reconciliation after apply:
  - same-organization normalized duplicate legacy request-type code groups: 0;
  - current `private.request_step_decide` contains actor-bound replay;
  - current replay rechecks capability/delegation authorization;
  - replay returns immutable event `to_status/revision` rather than later request state.

## Behavioral acceptance
The disposable D1 database job applies the new migrations and runs:
- a two-owner / same-organization / same-code F-412 negative test that must abort and report the colliding code/record;
- an F-415 negative replay test with authorization removed;
- an actor-mismatch replay negative test;
- an F-416 test that advances a parallel quorum after the first vote and proves retry returns the original first-vote response without mutation.

## Boundary
No external D4c outbox consumer was enabled. Wave 4 F-420/F-421/F-422, scheduler/claim policy, destination idempotency, retry/dead-letter and external adapter E2E remain open.
