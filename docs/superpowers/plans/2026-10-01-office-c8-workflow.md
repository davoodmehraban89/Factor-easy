# Office C8 Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver optional, tenant-safe versioned correspondence workflows with atomic authorized transitions and immutable evidence.
**Architecture:** Add three private relational tables and checked private RPC implementations behind public invoker wrappers. Keep correspondence status, C5 approvals and accounting history independent. Add one focused browser module loaded after office-mature.js.
**Tech Stack:** Existing browser JavaScript, PostgreSQL 17/Supabase, Node checks and Playwright Chromium.
**Spec:** docs/superpowers/specs/2026-10-01-office-c8-workflow-design.md

## Global Constraints
- Policy: 2–20 stages, at most 60 edges, exactly one start, at least one terminal; all stages reachable from start and able to reach a terminal.
- No terminal outgoing edge, duplicate stage/edge, self edge, user executable code or arbitrary conditions.
- Edge capability is edit, refer or approve in office_automation; no role or auth-provider changes.
- Immutable published policy/event history; one workflow per correspondence; pinned policy version.
- Posted financial history, C1–C7, Golden and ELI gates remain intact.
- C8 schema/RLS changes approved; deletion, destructive data operations and auth changes excluded.
- Every durable commit includes PROJECT_STATE.md. Never infer feature completion from CI status alone.
- Exact migration SQL must be archived under supabase/migrations before production application and reconciled to actual history afterwards.

## Review Focus
1. Lost HTTP response followed by retry must not duplicate events; revoked users must not retrieve prior results through retry.
2. Organization switch while a request is pending must not render another organization's response.
3. Two tabs transitioning the same letter must yield exactly one change for the expected revision.
4. Unknown/null status or malformed JSON must fail closed, not behave as registered.
5. Persian titles containing HTML/quotes must remain text, including historical event labels.
These cases are assigned to tasks 1–3 below.

## Files and interface decisions
Create js/office-workflow.js; scripts/office-slice-c8-check.mjs; scripts/office-slice-c8.spec.js; supabase/tests/office_c8_workflow.sql; scripts/office-c8-concurrency.mjs; docs/OFFICE_SLICE_C8_VERIFICATION.md.
Modify js/bootstrap.js (load after office-mature.js), js/office-mature.js only to provide a successful-open integration hook if needed, .github/workflows/quality.yml, and PROJECT_STATE.md.
Generate the migration filename with the installed Supabase CLI's migration new command after checking --help; do not guess its timestamp. Use the suffix office_slice_c8_workflow_policy.
Do not restructure office-mature.js or redesign the shell.

### Task 1: Policy publication and catalog vertical slice
**Owner:** database/runtime implementer; security reviewer examines grants and checks before production.
**Interfaces:**
- Definition JSON: {stages:[{id,label,start,terminal}],edges:[{id,from,to,label,capability}]}.
- IDs match ^[A-Za-z][A-Za-z0-9_-]{0,63}$; labels 1–160 Unicode characters after trim; note at most 2000 characters; definition at most 64 KiB UTF-8. Reject unknown keys and non-boolean flags.
- public.office_workflow_publish(p_organization_id uuid,p_policy_key text,p_title text,p_definition jsonb) returns integer server version.
- public.office_workflow_catalog(p_organization_id uuid) returns JSON array of {policy_key,version,title,definition}; newest versions only, sorted policy_key.
- Private implementations end in _impl, public wrappers SECURITY INVOKER. Publication requires active membership, write entitlement and office configure or owner; catalog requires active membership and read entitlement/capability.

- [ ] Read existing authorization helpers, current C1 terminal statuses and table grants; run baseline accounting and DOM before edits. If baseline fails, diagnose separately before extending.
- [ ] Write SQL behavioral assertions: accept valid two-stage graph; reject 1/21 stages, 61 edges, duplicate IDs/edges, unknown targets, terminal outgoing edge, unreachable/no-exit graph, missing boolean, unknown capability, null definition, invalid UTF-8-size bound; accept Persian labels within limit.
- [ ] Run SQL tests against a local/disposable nonproduction database and record missing-function failure.
- [ ] Generate migration; create private.office_workflow_policy_versions with composite organization/policy_key/version primary key, organization FK, definition, title, published_by and server time; enable RLS and deny direct client DML. Reject UPDATE/DELETE by trigger.
- [ ] Implement validation with bounded graph traversal (visited set handles allowed nonterminal cycles). Serialize publication per organization/policy_key; allocate version server-side. All private entry points check auth independently.
- [ ] Add browser policy editor/catalog in js/office-workflow.js using DOM creation/textContent and labeled inputs; load after office-mature.js in bootstrap. Expose officeWorkflowPolicies() and officeWorkflowPublish() within the office screen; controls reflect capability but server is authoritative.
- [ ] Add actual Playwright clicks filling a two-stage policy, publishing through a mocked RPC and rendering returned version; reject malicious titles as HTML. Label this UI integration, not production E2E.
- [ ] Execute SQL tests and node scripts/office-slice-c8-check.mjs; execute npx playwright test scripts/office-slice-c8.spec.js --reporter=line --workers=1 against localhost:4173. Require successful assertions, not merely function presence.
- [ ] Review, update PROJECT_STATE.md with exact commands/results and commit task 1 together. Keep production UI gated until required RPCs are deployed.

### Task 2: Attach/transition/read transactional vertical slice
**Interfaces:**
- office_workflow_attach(p_organization_id uuid,p_correspondence_id text,p_policy_key text,p_policy_version integer,p_request_id uuid) returns JSON {instance_id,stage_id,revision,event_id}.
- office_workflow_transition(p_organization_id uuid,p_instance_id uuid,p_edge_id text,p_expected_revision bigint,p_request_id uuid,p_note text) returns same shape.
- office_workflow_read(p_organization_id uuid,p_correspondence_id text,p_after_revision bigint,p_limit integer) returns JSON {instance,allowed_edges,events,next_after_revision}; limit 1–100, initial cursor -1; instance null when readable letter has no workflow.
- All are public SECURITY INVOKER wrappers with private checked implementations.
- SQLSTATE: 42501 denied/not visible; 22023 invalid input/state; 40001 stale revision; 23505 reused request key with different payload.
- read.allowed_edges is server-authorized at observation time, not an authorization token.

- [ ] Write failing SQL tests for attach revision 0 + one event, legal transfer revision 1, pinned policy, illegal edge, negative/null revision, anonymous/foreign tenant/unreadable/suspended/expired denial and read-only expired access.
- [ ] Confirm public.records composite PK (organization_id,collection,id); create private.office_workflow_instances FK using collection fixed to correspondence, and policy composite FK. Unique organization/correspondence; revision >=0. Create private.office_workflow_events with unique instance/revision and organization/request_id; add indexed FKs, RLS, revoked client DML and immutable triggers.
- [ ] Implement source-letter lock followed by instance lock consistently; verify active membership, read access, write entitlement and row-scoped required capability under lock. Allow only registered/in_circulation if those are confirmed canonical C1 states; explicitly reconcile any different live token with C1 before implementation. Unknown/draft/closed/archived status denied. Never modify source status, content or approval evidence.
- [ ] Bind actor to auth.uid and timestamps to server; attachment and transition insert evidence + state atomically. Recheck current authorization before replaying a request result. Same actor/payload returns original result; mismatched actor or payload denied; store comparison payload including expected revision and note.
- [ ] Implement read paging by revision, source visibility, and read entitlement. Deny direct private calls identically to wrapper calls. Protect instance policy and correspondence identity from mutation.
- [ ] Add SQL tests for direct insert/actor spoofing, update/delete evidence/policy, pinned-version mutation, tenant FK, duplicate request replay after permission removal, and full transaction rollback.
- [ ] Create scripts/office-c8-concurrency.mjs using two nonproduction PostgreSQL sessions and task-relevant configured credentials (no secrets in logs); race expected revision 0, assert exactly one success/one stale conflict and one event at revision 1. Do not claim this covered by sequential tests.
- [ ] Run nonproduction SQL and concurrency tests with deterministic fixtures. No production user creation, membership/seat changes or permanent fixture insertion.
- [ ] Review SQL authorization and race results, then commit with PROJECT_STATE.md. If no suitable database/credentials exist, mark BLOCKED/NOT VERIFIED and do not apply untested production DDL.

### Task 3: Correspondence workflow UI vertical slice
**Consumes:** task 2 RPC contracts and task 1 catalog.
**Produces:** officeWorkflowOpen(correspondenceId), officeWorkflowAttach(), officeWorkflowTransition(edgeId), and a labeled workflow panel in #view-office.
- [ ] Write failing Playwright tests for attachment, allowed-edge click, returned revision/history, double-click during pending request, stale-error refresh without auto-transition, denied writes, expired read-only state, and tenant switch during request.
- [ ] Integrate via officeOpenRecord only after successful existing read-evidence check; prevent showing C8 against a stale/failed-open letter. Add a scoped data-correspondence-id hook if existing functions cannot reliably indicate success.
- [ ] Render workflow stage separately from letter status. Exact notice: «مرحله گردش، جایگزین ثبت دبیرخانه یا تأیید داخلی نامه نیست.» History uses server actor/time/revision; textContent for untrusted content.
- [ ] Retain request_id for retry of same intent, generate a new key for a new intent; disable controls while pending. On 40001 refresh and request explicit user action. Capture organization and request generation, discard late responses after navigation/tenant change.
- [ ] Test real DOM behavior with mocked transport; additionally run real authenticated nonproduction integration when legitimate test identities are available. Distinguish results in evidence.
- [ ] Run all prior Playwright specs and accounting checks; fix regressions, retest, update PROJECT_STATE.md and commit UI slice.

### Task 4: Release verification and evidence
**Files:** .github/workflows/quality.yml; docs/OFFICE_SLICE_C8_VERIFICATION.md; PROJECT_STATE.md; exact migration archive.
- [ ] Add C8 Node and Playwright commands to existing Quality workflow without removing C1–C7/accounting/Golden/ELI steps.
- [ ] Run every Node command listed in quality.yml and all existing DOM specs plus C8. Preserve test output with tested SHA. Inspect logs, not only run conclusion.
- [ ] Before production apply, independently review private entry-point checks, grants, FK indexes, lock order, retry semantics and migration immutability. Resolve important defects and rerun tests.
- [ ] Refresh live head/migrations/RLS; stop on unexpected drift. Apply only the approved additive migration after nonproduction tests pass. Keep exact SQL recoverable even if deployment or Git update fails.
- [ ] Reconcile applied migration version/name/content to repository file in the same durable commit as state; never silently replay or repair history.
- [ ] Run security/performance advisors, grant/RLS catalog checks and read-only deployment checks. Production transactional test writes need separately justified safe scope; never manufacture persistent users.
- [ ] Verify head, CI job/test logs, Pages status and browser entry point. Record UI-mock/nonproduction/production evidence separately.
- [ ] Mark COMPLETED only with actual C8 DOM and accounting invariant PASS, plus implemented acceptance criteria and disclosed external limits. Otherwise keep precise IN PROGRESS/BLOCKED and NOT VERIFIED entries.
- [ ] Operational rollback is disable C8 UI/write entry points preserving data, never DROP or deletion; confirm rollback procedure before release.
- [ ] Commit final evidence with PROJECT_STATE.md, reread remote head/files and report Persian <=15 lines including SHAs, run IDs, unverified items and next action.

## Self-review / handoff
Spec coverage: graph/versioning task 1; immutable transactional authorization task 2; Persian UI/accessibility task 3; regression/deployment/archival task 4.
Five review-focus cases assigned: retry/permissions + two-tab concurrency task 2; tenant-switch and HTML task 3; malformed status/JSON tasks 1–2.
No implementation/test execution is claimed by this plan.
Recommended execution: subagent-driven with serialized owners (database, UI, independent QA/security), because a workflow authorization defect could cross a tenant boundary. Shared files and commits remain coordinator-owned. Owner reviews this plan and chooses/confirms execution before code changes.
