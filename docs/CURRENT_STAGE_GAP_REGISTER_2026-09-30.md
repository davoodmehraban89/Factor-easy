# Finora — Current-stage completion gap register

Date: 2026-09-30  
Updated: 2026-10-01 after Office C8 closure  
Scope: what remains before the current Finora stage can be called high-assurance and operationally complete. This is deliberately narrower than the full long-term ERP roadmap.

## Severity model
- **P0 / Critical** — blocks a defensible production-complete claim for the current stage or can materially compromise financial/tenant correctness.
- **P1 / High** — must be closed before broad organizational rollout; current operation may continue with an explicit boundary.
- **P2 / Medium** — important completeness/hardening/operational evidence, but not a current core-data blocker.
- **P3 / Low** — hygiene/optimization; monitor and clean up after higher-risk work.

## Prioritized register

| # | Severity | Gap | Type | Current evidence / completion condition |
|---|---|---|---|---|
| 1 | **P0 Critical** | Two-real-user authenticated production E2E for organization isolation/RBAC/confidentiality/Storage | QA + Security | Transactional DB tests pass, but authenticated two-real-user production browser E2E remains unverified because production has no legitimate persistent non-owner fixture. Complete only after real non-admin principals exercise allowed and denied cross-user/cross-organization paths in the deployed app. |
| 2 | **P0 Critical** | Controlled accounting cutover for existing production invoices | Financial correctness + Migration | Production history was intentionally not auto-posted. Complete only after chart initialization, owner-reviewed source mapping, preview, controlled source-linked posting, reconciliation and rollback evidence. |
| 3 | **P0 Critical if marketed as legally complete; otherwise scope boundary** | Statutory/compliance workflows not yet end-to-end | Compliance + Accounting | Do not claim full Taxpayer System submission, statutory consolidation, full payroll/HR or complete standards compliance merely because menus/calculations exist. Completion requires effective-dated sourced rules, lifecycle validation, posting/reversal, RLS, reconciliation, negative tests and acknowledged external submission where applicable. |
| 4 | **CLOSED for bounded internal office scope; external adapters remain P2 boundaries** | Mature office lifecycle (Slice C) | Product + Office automation | **C1-C8 complete for their bounded scope:** immutable correspondence/read evidence, referrals/SLA, related-letter/archive graph, versioned templates, content-bound internal approval, reminder/escalation evidence, tenant-safe full-text archive/OCR provenance, and versioned correspondence workflow policy/runtime with immutable transition evidence, idempotency, optimistic concurrency and safe UI. C8 final main `398e044`; Quality `36907314330`, Security `36907314457`, Pages `36907313039` PASS. Remaining external scope: qualified-signature provider, real OCR provider/accuracy validation, external delivery/BPM adapters and legitimate live two-user browser E2E. |
| 5 | **P1 High — NEXT PRODUCT SLICE** | Versioned configurable workflow engine (Slice D) | Product + Workflow | Requests have a form/type/draft foundation, but versioned request schemas, sequential/parallel steps, conditions, delegation/substitution, SLA/escalation, immutable action history and cross-module actions are not yet a complete workflow engine. Must be designed as a separate request-workflow subsystem while reusing proven C8 patterns rather than coupling request state to correspondence workflow state. |
| 6 | **CLOSED** | Member invitation/onboarding without pre-existing Finora account | Identity + UX | Closed by ELI-3: hash-only email-bound invitations, expiry/revocation, authenticated acceptance, role assignment, seat enforcement, duplicate handling, audit and UI are production/Real-DOM/security verified. Automatic external invitation email delivery remains a separate adapter boundary. |
| 7 | **P1 High** | Supabase leaked-password protection | Security | Live Supabase advisor reports leaked-password protection disabled. Enable and verify authentication behavior before broad rollout. |
| 8 | **P1 High** | SECURITY DEFINER RPC hardening / warning closure | Security + Database | Live advisor reports 20 authenticated-callable public SECURITY DEFINER functions. Current definitions include internal authorization checks, so this is not evidence of an exploit by itself; nevertheless each RPC needs an explicit exposure decision, least-privilege grants/search_path review, negative tests and warning disposition. C8 public wrappers are SECURITY INVOKER and did not add to this warning count. |
| 9 | **P1 High** | GitHub dependency graph / enforceable dependency review | Supply-chain security + CI | Dependency Review is skipped/unavailable while Dependency graph is disabled. A green Security workflow is not equivalent to dependency review being active. Complete only when the repository setting is enabled and a PR run proves the check works. |
| 10 | **P1 High** | Accountant daily-control workbench gaps | Accounting operations | Bank statement import/reconciliation, formal period-close checklist/locks/evidence, sensitive journal/payment approval and segregation-of-duties, and a usable critical audit-log viewer remain required accountant-first controls unless separately verified in a later slice. |
| 11 | **P2 Medium** | Real Persian OCR accuracy | Office + QA | C7 provides server full-text archive search, append-only OCR provenance, attachment binding and human correction. What remains unverified is the OCR engine itself: complete only with a real provider, representative Persian scans, measured extraction/search quality and failure handling. |
| 12 | **P2 Medium** | Qualified digital-signature integration | Office + Security/Legal integration | Internal approval/signature UX is not equivalent to a qualified digital signature. Complete only with a real provider/certificate trust flow, signed payload verification, timestamp/evidence retention and revocation/error handling. |
| 13 | **P2 Medium** | Live external adapters (email/ECE/webhook/BPM/etc.) | Integration + Operations | Third-party delivery/acknowledgement remains unverified. Complete per adapter with secrets isolation, retry/idempotency, delivery receipts, failure queue and audit evidence. |
| 14 | **P2 Medium** | Physical printer / real document output validation | QA + Operations | Chromium/PDF tests pass, but physical printer output remains unverified. Complete with A4/A5 Persian samples, margins/page breaks, common printer drivers and archived acceptance evidence. |
| 15 | **P2 Medium** | PostgreSQL platform upgrade | Platform + Security | PostgreSQL 17.11 platform upgrade remains pending. Upgrade only with backup/rollback window and post-upgrade accounting/RLS regression verification. |
| 16 | **P2 Medium** | Finish GitHub Actions runtime modernization without weakening invariants | CI maintenance | `checkout` and `setup-node` are on v7. CodeQL remains on supported v3 because the repository invariant still asserts v3. Complete by updating the invariant and CodeQL action together in one tested change before v3 deprecation. |
| 17 | **P3 Low** | Newly-created unused indexes | Performance | Supabase performance advisor currently reports unused-index informational notices. Do not delete prematurely; reassess after representative workload/query statistics. |

## C8 closure evidence
- Production migrations: `20261001173917 office_slice_c8_workflow_policy`, `20261001180610 office_slice_c8_workflow_runtime`, `20261001180949 office_c8_policy_publisher_fk_index`.
- Runtime/server evidence: `docs/OFFICE_SLICE_C8_WORKFLOW_RUNTIME_VERIFICATION.md`.
- Runtime UI evidence: `docs/OFFICE_SLICE_C8_RUNTIME_UI_VERIFICATION.md`.
- Final main: `398e044eb6570345bff1b34c858d0e6089ab770a`.
- Quality `36907314330`: PASS including accounting/Golden/C1-C8, disposable PostgreSQL C8 policy/runtime/security/concurrency gate and real-DOM.
- Security `36907314457`: CodeQL PASS; dependency review skipped remains item #9.
- Pages `36907313039`: PASS.
- Production post-check: workflow instances/events/policy versions remained zero in the checked persistent state; no C8 test residue.

## Historical Run-failed audit
Earlier GitHub failure notifications were intermediate failures, not evidence that the verified final heads remained broken. Relevant examples include Real-DOM fixture interception, an intermediate Slice-B migration-count assertion, Dependency Review failing while Dependency graph was disabled, and the product Kardex nullish/OR syntax defect. Later commits repaired the code/test paths and subsequent canonical Quality/Security runs passed. Dependency Review itself remains unavailable and is still tracked above.

## Current-stage completion rule
The current stage can be called complete only when P0 items are closed, P1 items that belong to the marketed current scope are closed (or explicitly removed/disabled from that scope), release gates are green, and every remaining P2/P3 item is documented as a non-blocking external/operational boundary rather than silently presented as implemented.
