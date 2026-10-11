# Finora — Owner-approved eight-phase execution roadmap
**Approval:** 2026-10-11 | **Status:** Approved / Phase 0 started | **Canonical product:** Finora V1.0, repository `davoodmehraban89/Factor-easy`, protected branch `main`.

> This roadmap defines **execution order**, not a claim that existing modules are unimplemented. Partial implementation, controlled-browser QA, authenticated-production verification and actual release are **distinct statuses**. Prior documentation, including the 260-chapter master specification, is not automatically superseded. Chapter 251 sets the V1 scope and chapter 259 guides acceptance; resolve any exact scope discrepancies against the original artifacts before expanding V1.

## Decision and priorities
- **Before V1 release:** phases **0–5**. Severity P0 means actual access failures, unsafe financial operations, tenant exposure, silent data loss, false totals, incorrect postings, and blocking defects. Fix security/financial P0 immediately even when another phase is active.
- **After V1:** phase **6** (advanced operations), then phase **7** (group/industry/international). Production needs and approved scope can reorder *independent* post-V1 slices.
- Target **stable accounting and verifiable transactions**, not maximum menu count.
- Any phase is **Accepted** only with traceable test evidence, reviewer, exact code/data versions, and no undisclosed critical defect. CI success alone is insufficient. Production deployment and authenticated customer E2E are separate gates.
- Owners: one accountable owner per phase; coordinators integrate evidence but do not claim nonexistent parallel agents.

## Phase map and acceptance gates

| Phase | Priority | Accountable domain | Scope and primary deliverable | Dependencies | Acceptance gate |
|---|---|---|---|---|---|
| **0 — Stabilization / ممیزی** | **P0 immediate** | QA and validation lead | Inventory current defects and live state; reproduce sign-in/ISP network failure, real tenant-scoped contact/product search, 1,000+ options stress, invoice save/edit/print, forms/buttons; classify by severity, attach before/after evidence; close regression tickets in reversible slices. | Existing repo & legitimate test login (no credential sharing). | Verified minimal real-user login, sale/purchase search, invoice save/reload and print, and no unresolved user-blocking defect. All untestable points explicitly flagged. |
| **1 — Security / Data integrity** | **P0 critical** | Security and risk lead | Review 21 `SECURITY DEFINER` execution advisories, three no-policy contracts, leaked-password protection, RLS and tenant boundaries; verify session revocation, invited/offboarded second user, production migration equivalence, secret handling, restore/rollback. | Phase 0 evidence; durable authorized test identities and separate approvals for policy/auth/schema changes. | Negative permission tests and two-user offboarding; tenant isolation; tested backup/restore in isolated authorized scope; no critical unresolved security findings. |
| **2 — Ledger/accounting core** | **P0 critical** | Architecture / accounting-engine lead | Validate chart and posting mappings, floating dimensions, journal validation, balanced double entry, reversible corrections, fiscal locks, source idempotency, audit trail, legacy chart preview/cutover and isolated save→post→reverse. | Phases 0 and 1 contracts; owner selects historical company chart/mapping before posting. | Per-source balanced voucher exactly once; failure atomicity and fiscal locks proven with adverse tests; no unauthorized mutation of posted history; production cutover separately approved. |
| **3 — Sale/purchase/inventory/treasury** | **P0** | Implementation / commerce lead | Connect orders and returns, receipts, payables, collections, cheque/bank and warehouse movements to source documents, ledger and stock cost. No duplicate master records. | Phase 2 posting and inventory contract; phase 1 permissions. | Purchase→receipt→inventory→sale→settlement→ledger and return/reversal traced end-to-end with reconciliation and failure rollback. |
| **4 — Iran-first compliance & reports** | **P0** | Finance compliance / reporting lead | Versioned Iranian tax rules and document schemas; taxpayer print/output, mixed payment and multirow arithmetic; trial balance, subsidiary ledger, GL-AR/AP/bank/stock reconciliation, period close and exception evidence. | Phases 2–3 financial events and balances. | Reviewed with qualified Iranian accounting specialist and dated legal references; independent calculations and printed/reference documents agree; no unsupported compliance claim. |
| **5 — V1 system acceptance & release** | **P0 release gate** | QA / release operations lead | Multi-user authenticated E2E, concurrency, stress, real-printer evidence, regression, backup/restore, monitoring and rollback rehearsal, documentation and owner sign-off. | Phase 0–4 critical acceptance gates. | Exact-SHA Quality + Security + Release + Pages, role-based production/approved staging E2E, finance reconciliation, no P0, explicit unresolved P1 and signed owner acceptance. |
| **6 — Advanced business ERP** | **P1 after V1** | Product / business modules lead | CRM pipeline, quotation/order/procurement depth, budgeting, project/contract analytics, HR/payroll (with separate confidentiality and tax controls). | Phase 5 accepted; each slice traces permissions, posting and reporting impacts. | Each module independently integrated, audited, operable and regression-tested. |
| **7 — Enterprise / industry / international** | **P2/P3** | Architecture / extensibility lead | Holding/consolidation, intercompany and multicurrency, manufacturing/BOM/WIP, industry extensions, versioned international country/reporting packs, permission-filtered AI recommendations with human approval. | Phase 5 and separately proven company/ledger foundations; market-approved scope. | Multi-entity reconciliation, industry-specific accounting, safe migrations and audited legal/regulatory localization per target profile. |

### Non-negotiable execution rules
1. No speculative refactor or mass migration of financial history. Every change is a narrow, reviewable PR with rollback path.
2. Each item has one owner, reproducible source evidence, affected tenant/company scope, source commit, acceptance tests and closure evidence.
3. Execution status sequence: **UNVERIFIED → REPRODUCED / SPECIFIED → IMPLEMENTED → CONTROLLED-QA-PASSED → AUTHENTICATED-E2E-PASSED → RELEASED → OWNER-ACCEPTED**. Never collapse adjacent states.
4. Store IDs, amounts, timestamps, serialized tax documents and source journal data immutably; local display formatting cannot alter legal stored values.
5. Approvals for **auth, schema, RLS, role/capability, destructive reset, finance cutover, new paid service, real payment or external messaging** are separate from this roadmap approval.
6. Parallelize only independent tasks; dependency order governs finance/security gates. Phase 1 may run in parallel with Phase 0 read-only audits; Phase 3 awaits Phase 2 posting contracts.
7. Do not assign delivery dates before Phase 0 defect count, test environment, scope and capacity are measured. Use evidence-based estimates.

## Phase 0 — first authorized execution slice (read-only)
**Inputs:** confirmed main head and exact-SHA CI/deployment; latest PROJECT_STATE.md; live Supabase status/advisors; earlier user screenshots and controlled browser tests.

**Sequence and acceptance:**
1. **Baseline pinned:** record commit, CI, release, Supabase migration head, currently open PRs and outstanding authentication limitations.
2. **Smoke test:** public site loads and versioned JS assets match exact deployment; login diagnosis without user password, selected product lookup on disposable in-browser records; no write to production.
3. **Defect register:** user-visible, reproducible failures with category, severity, expected/actual, owner, dependency and test; distinguish synthetic browser success from real authenticated account success.
4. **Authenticated checks only with authorized existing user session:** login from user's affected ISP, tenant-scoped product lookup using their existing item, invoice save/reload/print only in isolated or approved safe test scope. Never seed/post the production financial ledger as a test without approval.
5. **QA report:** pass/fail/unverified for each acceptance criterion and exact next executable fix. If P0 remains, Phase 0 stays open.

## Current outstanding external gates (not assumed approved)
- Persistent authorized second test user and supervised dual-role test for membership revocation, concurrent delegation, RLS.
- Company type, chart mapping and backup approval for historical invoice posting; existing chartless history **must remain unposted**.
- Authenticated owner-context product/invoice printing and network sign-in tests (not substituted by mock Chromium).
- Private Stripe **sandbox** `STRIPE_SANDBOX_RESTRICTED_KEY` and `FINORA_STRIPE_QA_ALLOWED_USER_ID` settings if pursuing read-only server integration, with no key pasted into chat.
- Regulatory accountant review before claiming standards/tax compliance.
- Supabase warnings are review inputs, **not** evidence of an exploitable issue.

## References
- `PROJECT_STATE.md`
- `docs/FINORA_ERP_EXPANSION_ROADMAP_V4.md`
- `docs/IRAN_FIRST_ACCOUNTING_DESIGN_2026-10-11.md`
- `docs/PRODUCTION_ACCOUNTING_CUTOVER_READINESS_2026-09-30.md`
- `docs/ACCOUNTING_CORE_ROADMAP_V1.md`
- Primary 260-chapter master specification (chapters 251 and 259) supplied in project context; full line-by-line reconciliation with this plan is **not claimed** in this task.
