# Request Workflow Slice D3a — Sequential / Parallel Step Runtime Verification

Date: 2026-10-01

## Scope
D3a adds versioned server semantics for sequential and parallel approval steps without reusing or mutating the C8 correspondence workflow runtime.

## Server model
Archived migrations:
- `supabase/migrations/20261001230000_request_workflow_d3a_step_runtime.sql`
- `supabase/migrations/20261001230500_request_workflow_d3a_security_hardening.sql`

The D3 schema version is `schemaVersion: 2`. A workflow contains 1–50 ordered steps. Each step has a unique machine key, title, mode (`sequential` or `parallel`), approval quorum and required capability. Sequential steps require exactly one approval; parallel steps require 2–20 approvals. Allowed decision capabilities are `approve`, `edit`, or `configure`.

Runtime state is held in non-exposed private tables:
- `private.request_step_instances`
- `private.request_step_votes`

Signed-in users have no direct table grants. Public mutation is through `public.request_step_decide`, a SECURITY INVOKER wrapper around a non-exposed privileged implementation.

## Runtime behavior
- Instance creation validates the pinned workflow snapshot and materializes ordered step instances only for schema version 2.
- The first step activates; later steps remain pending.
- Every decision is capability-checked against the active step on the server.
- Every accepted vote advances the request optimistic revision and appends immutable public request-event evidence.
- A sequential approval completes its step and activates the next step.
- A parallel step remains active until its approval quorum is reached; distinct actors are enforced by a unique step/actor vote constraint.
- Rejection terminates the active step/request as rejected.
- Decision retries are idempotent by organization/idempotency key.
- Tenant/module authorization is checked before an idempotent replay result can be returned, preventing cross-tenant information disclosure through guessed request/key pairs.

## Automated verification
Quality run `36913565943` on commit `4f362f925de7afb4f29008b1d670aa9ad340578d` completed successfully:
- `d1-request-database`: SUCCESS, including D1, D2 and D3a behavioral assertions.
- `static-quality`: SUCCESS, including full existing static suite and real-DOM smoke regression suite.
- `c8-policy-database`: SUCCESS.

D3a disposable PostgreSQL assertions verify:
- two-step initialization and activation ordering;
- sequential completion;
- parallel quorum does not complete early;
- idempotent retry does not duplicate a vote or revision;
- a second distinct approver reaches quorum and final approval;
- immutable `step_approve:*` event evidence;
- invalid parallel schema rejection before publish;
- active-step capability denial.

The first D3a test run correctly failed because the authenticated test role attempted to inspect private runtime tables directly. The test was corrected to inspect private state only as the disposable database owner; production grants were not weakened.

## Production verification
Both D3a migrations were applied to Supabase project `hcsixhqbyuhpshfwqpjx` after the disposable DB gate passed. Production verification confirms:
- both private runtime tables exist;
- `authenticated` can execute `public.request_step_decide`;
- `anon` cannot execute it;
- the public wrapper is SECURITY INVOKER.

A fresh Supabase security advisor run reported no new request-workflow SECURITY DEFINER warning; the pre-existing warning set remained at 20. A fresh performance advisor run reported no unindexed-foreign-key finding for D3a; only expected unused-index informational findings exist on the currently low-traffic/new indexes.

## Boundary / next slice
D3a is server semantics only. D3b remains responsible for the visual workflow editor, runtime timeline and safe condition DSL. D3c remains responsible for SLA/escalation, delegation/substitution and transactional cross-module outbox actions.
