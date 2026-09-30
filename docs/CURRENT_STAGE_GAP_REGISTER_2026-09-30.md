# Finora — Current-stage completion gap register

Date: 2026-09-30
Scope: what remains before the current Finora stage can be called high-assurance and operationally complete. This is deliberately narrower than the full long-term ERP roadmap.

## Severity model
- **P0 / Critical** — blocks a defensible production-complete claim for the current stage or can materially compromise financial/tenant correctness.
- **P1 / High** — must be closed before broad organizational rollout; current operation may continue with an explicit boundary.
- **P2 / Medium** — important completeness/hardening/operational evidence, but not a current core-data blocker.
- **P3 / Low** — hygiene/optimization; monitor and clean up after higher-risk work.

## Prioritized register

| # | Severity | Gap | Type | Current evidence / completion condition |
|---|---|---|---|---|
| 1 | **P0 Critical** | Two-real-user authenticated production E2E for organization isolation/RBAC/confidentiality/Storage | QA + Security | Transactional DB tests pass, but the canonical state explicitly marks authenticated two-real-user production browser E2E as not verified. Complete only after two real non-admin accounts exercise allowed and denied cross-user/cross-organization paths in the deployed app. |
| 2 | **P0 Critical** | Controlled accounting cutover for existing production invoices | Financial correctness + Migration | Production currently has 7 invoice records but no account-master/journal collections. Phase 6 intentionally did not auto-post legacy history. Complete only after chart initialization, owner-reviewed source mapping, preview, controlled source-linked posting, reconciliation and rollback evidence. |
| 3 | **P0 Critical if marketed as legally complete; otherwise scope boundary** | Statutory/compliance workflows not yet end-to-end | Compliance + Accounting | Do not claim full Taxpayer System submission, statutory consolidation, full payroll/HR or complete standards compliance merely because menus/calculations exist. Completion requires effective-dated sourced rules, lifecycle validation, posting/reversal, RLS, reconciliation, negative tests and acknowledged external submission where applicable. |
| 4 | **P1 High** | Mature office lifecycle (Slice C) | Product + Office automation | **C1 complete:** registered-history immutability and server-authoritative read evidence are production/CI/adversarial verified (`docs/OFFICE_SLICE_C1_VERIFICATION.md`). Remaining Slice C scope: templates/editor, approval/signature lifecycle, richer referral-chain UX, SLA/reminders, reply/related-letter graph, archive classification, OCR/full-text and integration adapters. |
| 5 | **P1 High** | Versioned configurable workflow engine (Slice D) | Product + Workflow | Requests have a form/type foundation, but sequential/parallel steps, conditions, delegation/substitution, SLA/escalation and immutable action history are not yet a complete workflow engine. |
| 6 | **P1 High** | Member invitation/onboarding without pre-existing Finora account | Identity + UX | Current member management requires an already-registered account. Complete with invitation token/lifecycle, expiry/revocation, organization acceptance, duplicate handling and audit. |
| 7 | **P1 High** | Supabase leaked-password protection | Security | Live Supabase advisor reports leaked-password protection disabled. Enable and verify authentication behavior before broad rollout. |
| 8 | **P1 High** | SECURITY DEFINER RPC hardening / warning closure | Security + Database | Live advisor reports 7 authenticated-callable SECURITY DEFINER functions. Current definitions include internal authorization checks, so this is not evidence of an exploit by itself; nevertheless each RPC needs an explicit exposure decision, least-privilege grants/search_path review, negative tests and warning disposition. |
| 9 | **P1 High** | GitHub dependency graph / enforceable dependency review | Supply-chain security + CI | Historical `Run failed` security emails were caused by dependency review running while Dependency graph was disabled. Workflow now records this as unavailable instead of failing falsely, but actual dependency review remains absent until the repository setting is enabled and a PR run proves the check works. |
| 10 | **P1 High** | Accountant daily-control workbench gaps | Accounting operations | Bank statement import/reconciliation, formal period-close checklist/locks/evidence, sensitive journal/payment approval and segregation-of-duties, and a usable critical audit-log viewer remain required accountant-first controls unless separately verified in a later slice. |
| 11 | **P2 Medium** | Real Persian OCR accuracy and searchable archive validation | Office + QA | Schema is OCR-ready, but real Persian scan quality is not verified. Complete with representative scans, measured extraction/search quality, failure handling and human correction workflow. |
| 12 | **P2 Medium** | Qualified digital-signature integration | Office + Security/Legal integration | Approval/signature UX is not equivalent to a qualified digital signature. Complete only with a real provider/certificate trust flow, signed payload verification, timestamp/evidence retention and revocation/error handling. |
| 13 | **P2 Medium** | Live external adapters (email/ECE/webhook/etc.) | Integration + Operations | Third-party delivery/acknowledgement remains unverified. Complete per adapter with secrets isolation, retry/idempotency, delivery receipts, failure queue and audit evidence. |
| 14 | **P2 Medium** | Physical printer / real document output validation | QA + Operations | Chromium/PDF tests pass, but physical printer output remains unverified. Complete with A4/A5 Persian samples, margins/page breaks, common printer drivers and archived acceptance evidence. |
| 15 | **P2 Medium** | PostgreSQL platform upgrade | Platform + Security | Project state records PostgreSQL 17.6.1.166 while 17.11 platform upgrade remains pending. Upgrade only with backup/rollback window and post-upgrade accounting/RLS regression verification. |
| 16 | **P2 Medium** | Finish GitHub Actions runtime modernization without weakening invariants | CI maintenance | `checkout` and `setup-node` were moved to v7. A direct CodeQL v4 switch exposed that `scripts/quality-check.mjs` still intentionally asserts CodeQL v3; rather than weaken the gate, CodeQL was restored to supported v3. Complete by updating the invariant and CodeQL action together in one tested change before v3 deprecation. |
| 17 | **P3 Low** | Newly-created unused indexes | Performance | Supabase performance advisor currently reports 5 unused indexes. They are new and may not have accumulated production usage yet; do not delete prematurely. Reassess after representative workload/query statistics. |

## Historical Run-failed audit
Gmail contained multiple GitHub `Run failed` notifications. The newest relevant failures were historical, not evidence that the previously verified `main` was still broken:

- Quality on `906d78d`: Real-DOM tests failed because the module launcher intercepted the panel-handle click and the request-field test expected one input while two rendered. Later browser integration hardening fixed these paths; subsequent Real-DOM gates passed.
- Quality on Slice-B `fdfdd86`: the Slice-B invariant test expected two archived migrations but only one was present at that intermediate commit. Later Slice-B migrations and the updated invariant set closed this failure; subsequent Slice-B quality gates passed.
- Security on Slice-B `211d072` / `9d3702a`: CodeQL passed; Dependency Review failed because GitHub Dependency graph was disabled. The workflow was changed to avoid a false red build while retaining an explicit warning. This is **not equivalent to dependency review being active**; item #9 remains open.

## CI maintenance applied during this audit
- `.github/workflows/quality.yml`: `actions/checkout@v7`, `actions/setup-node@v7`, Node 22 test runtime, automatic package-manager cache explicitly disabled.
- `.github/workflows/security.yml`: `actions/checkout@v7`; CodeQL remains on supported v3 until its repository invariant is migrated in the same tested change. Dependency-review remains `actions/dependency-review-action@v4` and still requires Dependency graph.

## Current-stage completion rule
The current stage can be called complete only when P0 items are closed, P1 items that belong to the marketed current scope are closed (or explicitly removed/disabled from that scope), release gates are green, and every remaining P2/P3 item is documented as a non-blocking external/operational boundary rather than silently presented as implemented.
