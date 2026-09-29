# PROJECT STATE — FINORA / FACTOR-EASY

> **MANDATORY CONTINUITY FILE — READ THIS FIRST**
>
> Repository: `davoodmehraban89/Factor-easy`  
> Canonical branch: `main`  
> Working product name: **Finora**  
> Current public release identity: **Finora 1.0**
>
> This file is the single continuity/state document for any AI assistant, coding agent, developer, or future chat working on this repository. It must remain in the repository and must be updated continuously.

## Non-negotiable continuity protocol

Before doing any project work:

1. Open this file from the current remote `main` branch.
2. Inspect the actual current repository head and relevant production state. Never assume this file is newer than GitHub/Supabase evidence.
3. Read the latest user request and record any material new requirement, scope change, architectural decision, or requested phase change in **Current change ledger** below **before implementation**.
4. Continue from the latest verified checkpoint. Do not redo completed work unless a regression or contradiction is proven.
5. For financial/accounting changes, preserve data and auditability. Never perform destructive historical migration without preview, reconciliation, backup/rollback and explicit authority where required.
6. Execute continuously: **inspect → implement → test → fix → retest → commit/push → verify → continue**.
7. After every durable checkpoint/commit and before ending a work session, update this file with:
   - what changed;
   - exact completion status;
   - important commit SHA(s);
   - tests/CI/deployment evidence;
   - database migration(s), if any;
   - unresolved risks/blockers;
   - exact next executable work.
8. A phase may be marked **COMPLETED** only after its acceptance criteria and available release gates are verified. Never infer completion from chat text alone.
9. If execution is interrupted, the next worker must be able to resume using only the repository plus this file.
10. If this file conflicts with verified remote code/database evidence, correct this file immediately and record the correction in the change ledger.

## Current change ledger
| 2026-09-29 | Execute master roadmap Phase 5 end-to-end: inventory/warehouse and costing; item/service master refinement; fixed assets; multi-currency; cost centers/advanced analytics; Excel/import center; backup/restore; company settings/permissions redesign; integration/API architecture. Preserve Phase 1–4 accounting invariants and require real-DOM, accounting/domain behavior, security and deployment gates before completion. | IN VERIFICATION | Owner granted standing authorization for in-scope repository/Supabase changes. Implemented warehouse/stock/count/costing, valued adjustment journals, fixed assets + depreciation journals, FX masters/rates, cost centers, v5 backup/import preview, integration metadata/outbox, Phase 5 audit, navigation, sync/backup and behavioral/DOM gates. Production migration `20260929172129_phase5_complementary_erp_collections` applied; collection constraint, immutability trigger and five uniqueness indexes verified. RLS policies remain owner-scoped. Final-head Quality/Security/Pages verification pending. |
| 2026-09-29 | Adopt owner-specified high-assurance execution protocol: verify live GitHub/Supabase before work; latest chat is the only source of new instructions; record requests before implementation; vertical slices; PROJECT_STATE in every durable commit; archive every future Supabase migration SQL; require real-DOM smoke + accounting-invariant tests before COMPLETED; explicitly list NOT VERIFIED items. | COMPLETED | Live reconciliation found head `7d054dfa` (post-login/admin-shell fix) was not recorded here; its CI is green but real-DOM smoke was not run. Phase 4 CI workflow also did not actually execute `phase4-behavior-check.mjs` because the command was folded onto the Phase 3 command, and no `supabase/migrations/` SQL archive exists. Phase 4 completion is therefore reopened pending real-DOM + accounting-invariant verification. Verification slice prepared atomically: corrected CI command separation, strengthened Phase 4 posting/reversal accounting test, added Playwright real-DOM post-login/shell smoke, and backfilled exact historical SQL files from `supabase_migrations.schema_migrations`. No database/schema/RLS/auth/role mutation was performed. Verification slice commit `55b62db0`: all 14 existing Supabase migration statements were archived exactly from migration history under `supabase/migrations/`; no database mutation occurred. Quality run `36600894426` succeeded, including Phase 3 behavior, actual Phase 4 accounting invariants and Playwright real-DOM smoke; Security/CodeQL `36600894268` succeeded; Pages `36600893196` succeeded. Live head discrepancy `7d054dfa` is now accounted for. Authenticated production-user E2E and physical-printer validation remain NOT VERIFIED. Live reconciliation before Phase 5: current head `deedea67` is documentation-only (`PROJECT_STATE.md`); Quality `36601108479` and Security `36601108485` succeeded on its parent `312fe95a`. Pages run `36601106234` on that parent failed only after a manual partial rerun created two `github-pages` artifacts; last clean Pages deployment remains `36600893196` on `55b62db0`. Head Pages run `36601145056` was cancelled. This deployment discrepancy is recorded and must be cleared by the next normal code commit/deployment before Phase 5 completion. |
| 2026-09-29 | Execute master roadmap Phase 4 end-to-end: projects/contracts, amendments/lifecycle, employer/contractor/subcontractor links, deductions, guarantees, contractor statements/accounting, traceability, reporting, permissions/audit/sync/backup/migration/tests/reconciliation. | COMPLETED | Re-accepted under the stricter verification rule at `55b62db0`: Playwright real-DOM smoke PASS and Phase 4 accounting invariants PASS in Quality `36600894426`; Security `36600894268` PASS; Pages `36600893196` PASS. Prior implementation evidence: domain/UI `c2100228`; persistence/navigation/backup through `172aeb59`; referential guards `44154769`; behavioral CI gate `fe29b817`; deduction-specific accounting/template migration `dd3b78ed`; verification doc `e5b814a7`. Supabase migration `20260929091743 phase4_contracting_collections` applied; RLS owner isolation verified; production had zero pre-existing Phase 4 rows requiring backfill; performance advisor clean; known pre-existing security warnings unchanged. Acceptance checkpoint `95e6de99`: Quality 36549015911 success; Security/CodeQL 36549015935 success; Pages 36549015796 success. |
| 2026-09-29 | Consolidate top-level Sales, Purchases, and People navigation into a single `بازرگانی` module while preserving the underlying views and workflows. | COMPLETED | Top-level `sales`, `purchases`, `people` rail entries removed; `commerce`/بازرگانی added with فروش، خرید، اشخاص submenu and canonical view mappings. Quality run 36545021724 success; Pages run 36545024472 success; Security/CodeQL run 36545021744 success. |
| 2026-09-29 | Restore invoice print contract: formal sales invoice = A4 landscape, pre-invoice = A4 landscape, non-formal invoice = A5 landscape; preserve standard print margins and page fit. | COMPLETED | `js/print.js` fixed on main: formal/pre-invoice A4 landscape with 5mm print margin; non-formal A5 landscape with 5mm margin; page-fit widths set to printable landscape areas. Regression gates updated in `scripts/quality-check.mjs` and `scripts/phase3-check.mjs`. Implementation commits `a7e14ec1`, `baa46715`, gate correction `4550f239`; Quality run 36544154873 success; Pages run 36544154397 success. Final checkpoint head `75cf79e5` re-verified: Quality run 36544278076 success; Security/CodeQL run 36544278147 success; Pages deployment run 36544277692 success. |\n
| Date | Request / decision | Status | Evidence / next action |
|---|---|---|---|
| 2026-09-29 | Reopen and fully harden Phase 3 after independent accounting review; fix fiscal-date posting, non-accounting document posting, reversal reconciliation, atomic persistence, server-side ledger guards, concurrency uniqueness and behavioral verification. | COMPLETED | Supabase migration `20260929083130 phase3_hardening_atomic_sync_and_ledger_guards` applied. Final implementation/evidence head before state closure: `c02e714c`; Quality run 36543480690 success; Security run 36543480544 success; Pages run 36543480478 success; Supabase migration/functions/unique indexes verified; Performance advisor clean. |
| 2026-09-29 | Establish a permanent in-repository continuity file so any future AI/chat can resume without relying on conversation history. Every material request must be recorded here before implementation and every durable checkpoint must update this file. | COMPLETED | `PROJECT_STATE.md` created in commit `9436b9014f8ce59e1a8c8dc238d1050831785c8f`; root `AGENTS.md` discovery instructions added in `dcabf31e7f9454ff84441cadb1e9aef85fff964c`. |
| 2026-09-29 | Continue product under working name Finora; final commercial brand may change later. Do not block engineering on naming. | ACTIVE DECISION | Rebrand must be a controlled migration when a final name is chosen. |
| 2026-09-29 | Six-phase redesign/ERP roadmap supersedes older phase numbering. | ACTIVE ROADMAP | Phases 1–3 verified complete; Phase 4 is next. |
| 2026-09-29 | Owner reaffirmed permanent autonomous-manager behavior, five high-assurance specialist workstreams, mandatory pre/post change capture, and the approved Finora dashboard image as the visual source of truth for every future AI/chat. | COMPLETED | Root `AGENTS.md` + `PROJECT_STATE.md` are mandatory; visual path `docs/reference/finora-ui-target-v1.jpg`; original owner-upload SHA-256 `6bef9d5bbf7e309455b1014864c80026c2ed50fa716e9fa6b0554dacec4f12db`; portable bootstrap stored in `AI_BOOTSTRAP.md`. |
| 2026-09-29 | Owner reaffirmed durable cross-chat project continuity, five specialist workstreams, mandatory change capture, and the approved Finora dashboard as the visual source of truth. | COMPLETED | State/governance `69d0640c` + `041e6da4`; portable bootstrap `5dfb95ea`; UI reference docs `13def61f`; legacy pointer `897b7ad5`; README discovery `14effed9`. Canonical visual: `docs/reference/finora-ui-target-v1.jpg`; original screenshot SHA-256 `6bef9d5bbf7e309455b1014864c80026c2ed50fa716e9fa6b0554dacec4f12db`. Quality and Pages succeeded on `14effed9`; Security/CodeQL was still running when this checkpoint was written and must be rechecked by the next worker if not yet complete. |
| 2026-09-29 | Make the repository itself the durable brain for every future chat/agent; add autonomous execution governance, five specialist workstreams, and a canonical UI visual so no successor drifts from the approved product direction. | COMPLETED | Governance is encoded in this file and `AGENTS.md`; canonical visual is `docs/reference/finora-ui-target-v1.jpg`. The owner re-supplied the same approved 16:9 target on 2026-09-29; successors must use the repository reference and must not invent a replacement. |


## Execution authority and engineering standard

The worker reading this file is the **implementation owner and coordinating project manager for the current task**. Within the user's already-approved project scope, make normal, reversible engineering decisions autonomously and keep moving. Do not repeatedly ask the user to choose ordinary implementation details that can be resolved from requirements, evidence, accounting correctness, maintainability, security and UX.

This authority is operational authority inside the project; it is **not permission to impersonate the user** in external/legal/public contexts. Destructive irreversible actions, paid actions, public publication, messages to third parties, sensitive access changes, or decisions outside the approved project scope still require the appropriate explicit authority.

This is financial/accounting software. Treat correctness as safety-critical:
- prefer rejecting an invalid financial state over silently accepting it;
- preserve auditability and historical identity;
- enforce critical invariants at the data/domain boundary, not only in UI;
- use atomic writes/transactions where supported;
- posted accounting history is immutable; corrections use reversal/amendment;
- fiscal locks, authorization/RLS, source-to-ledger traceability and reconciliation are mandatory;
- never fabricate test results, migrations, deployment status or connector access;
- never present mock/demo data or an incomplete form as a completed accounting capability.

Quality target: build as if the system will be relied on for high-consequence professional financial work. Use the strongest engineering/design reasoning available, while keeping architecture proportional, maintainable and testable.

## Coordinated specialist workstreams

For substantial work, coordinate these five specialist responsibilities. If the execution environment has real sub-agent support, delegate independent tasks with one clear owner each. If it does not, execute the same responsibilities as explicit internal workstreams and **do not claim independent agents were created**.

1. **Architecture & Accounting Rules** — owns domain model, accounting invariants, posting contracts, migrations, compatibility and acceptance criteria.
2. **Implementation & Integration** — owns production code, schema/data integration, source-document flows, synchronization and maintainable implementation.
3. **UX/UI & Product Design** — owns information architecture, workflows, RTL/responsive/accessibility, visual consistency and the canonical design direction below.
4. **QA & Reconciliation** — independently validates behavior, regression, accounting balance/reconciliation, edge cases, migration fixtures and reproducible failures.
5. **Security, Data Integrity & Release** — owns RLS/permissions, immutable history, backup/rollback, performance/security gates, deployment evidence and release readiness.

The coordinating manager resolves conflicts by: accounting/data correctness -> user requirement -> security/auditability -> maintainability -> UX -> implementation convenience. Every task has one primary owner even when other workstreams review it.

## Canonical UI / visual source of truth

**Approved visual reference (fixed canonical path):** `docs/reference/finora-ui-target-v1.jpg`

![Finora canonical UI](docs/reference/finora-ui-target-v1.jpg)

The repository JPG is the canonical durable visual copy of the owner-approved 1536×864 (16:9) screenshot supplied on 2026-09-29. The original uploaded JPEG is fingerprinted by SHA-256 `6bef9d5bbf7e309455b1014864c80026c2ed50fa716e9fa6b0554dacec4f12db`; do not substitute another design or generated dashboard. This image is the canonical visual target for the current Finora desktop shell. When the user asks “محیط نرم‌افزار الان چجوره؟”, “طرح مورد تأیید چی بود؟”, or asks to continue the redesign, open this repository image first. Do not substitute a remembered/generated/random dashboard.

The owner re-confirmed this exact 16:9 design direction on 2026-09-29. The repository image is the durable visual artifact; do not rely on chat memory. If the file is missing/corrupt, treat it as a project-continuity defect and restore the approved artifact before redesign work.

The image defines the direction, not fake functionality:
- RTL professional financial dashboard;
- narrow right module rail with compact icons;
- second contextual submenu panel;
- top bar for user, notifications, quick action, active company, fiscal year and global search;
- spacious central workspace with compact KPI cards, charts/status panels, quick access and recent accounting records;
- light, restrained enterprise visual language suitable for dense accounting workflows;
- desktop-first information density with responsive behavior required on smaller screens.

When implementing new modules, preserve this shell language and extend it consistently. Existing working features must be migrated into the unified architecture; do not create a separate “old” and “new” product. Do not expose future modules as operational until their actual lifecycle, persistence, accounting integration, permissions and tests exist.

## Mandatory request/change capture

A material user request is not allowed to live only in chat. **Before implementation**, update the Current change ledger in this file with the new requirement/decision and mark it `REQUESTED` or `IN PROGRESS`. If the request changes roadmap, accounting rules, UX target, scope or acceptance criteria, update the relevant canonical section here at the same time.

After a durable implementation checkpoint, update the same ledger row with `COMPLETED`, `BLOCKED` or `DEFERRED` plus exact commit/migration/test/deployment evidence. If work is interrupted, the repository must still describe both what was requested and what remains.

## User communication mode

When the user explicitly says to execute without interim text/progress messages, honor that mode: perform tool work silently and send only the final completion notice, unless a genuine blocker requires a user decision. Do not substitute status chatter for execution.

## Continuous execution rule

For an approved phase/task, do not stop at planning, one file, one subtask, one commit or a progress explanation. Continue while executable work remains:

**verify remote state -> record request -> select highest-priority unfinished dependency -> implement -> test -> diagnose -> fix -> retest -> commit/push -> verify CI/database/deployment as applicable -> update this file -> continue**

Stop only for a real blocker that cannot be resolved with available authorized tools, or an action requiring authority not already granted. Before stopping for a blocker, finish all independent executable work and record the blocker and exact next action here.


## Current verified project state

The detailed handoff below was verified against the repository after Phase 3. Continuity bootstrap and the canonical UI reference were added on top of that state. The UI-reference commit is `1b8b87559164109c4a58781776e56a83f892e67d`; this continuity update follows it. Always re-check the live `main` head before modifying code.

# Finora / Factor-easy — Durable Handoff

Date: 2026-09-29
Repository: davoodmehraban89/Factor-easy
Canonical branch: main
Verified Phase 4 acceptance head: 55b62db07fe31f6ebd3d45f22ce510946cd02ba8
Working product name: Finora
Current public release identity: Finora 1.0

## Source-of-truth rule
A successor must verify GitHub and Supabase before changing anything. This file is a recovery map, not a substitute for remote evidence.

## Master six-phase roadmap
1. UX/product architecture redesign and scalable navigation shell.
2. Master Data + Accounting Core foundation: chart, fiscal years, branches, global projects, generic hierarchical analytic dimensions, templates.
3. Double-entry operational accounting: journal engine, automatic postings, ledgers/trial balance, source immutability.
4. Projects, contracts, deductions, guarantees and contractor accounting.
5. Complementary ERP + integrations: inventory, costing, fixed assets, multi-currency/cost centers, import/backup/permissions/settings redesign.
6. Reports, control, migration and final release: professional accounting statements/reports, reconciliation/cutover of Finora 1.0 history, QA/security/performance/audit/backup/rollback/release.

The older docs/ACCOUNTING_CORE_ROADMAP_V1.md contains historical labels “Phase 5..8”. Do not treat those numbers as the current master phase numbering. Preserve its accounting decisions, but follow the six-phase roadmap above.

## Verified completion state

### Phase 1 — COMPLETED
Verification: docs/PHASE_1_REDESIGN_VERIFICATION.md
Acceptance commit: c51e49a3f7863886e8a997858d6f2c44165eb5de

Delivered:
- compact RTL module rail
- contextual second-level panel
- collapsible desktop navigation with persisted preference
- command/menu search and Ctrl/Cmd+K
- topbar company/fiscal context and quick action
- canonical view-to-module mapping
- responsive/mobile compatibility
- print isolation
- existing operational capabilities retained

### Phase 2 — COMPLETED
Verification: docs/PHASE_2_REDESIGN_VERIFICATION.md
Acceptance commit: 39702975a08ded8997787858383e20dab7d9afa9
Acceptance CI: Quality success 36438531727; Security success 36438531722; Pages success 36438530674.

Delivered:
- three fixed account levels: GL/کل, Subsidiary/معین, Detail/تفصیلی
- generic user-defined analytic dimensions
- configurable hierarchy depth 1..8
- leaf/terminal-only posting semantics
- depth locked after values exist
- safe delete/reference guards
- account-dimension required/optional/unavailable rules
- entity-backed contacts/projects/branches
- fiscal years and locks
- branch master
- global projects and legacy contact-project migration
- company activity types and optional starter templates
- sync/backup/Supabase collection support

Critical dimension invariant:
A dimension’s hierarchy depth is explicitly configured. Once values exist, depth cannot be changed directly. Used financial identities are not destructively deleted; they are deactivated/versioned/migrated. Group nodes are non-postable when leaf-only is enabled. Storage is normalized and not limited to floating1..floating4.

### Phase 3 — COMPLETED (HARDENED & RE-VERIFIED)
Verification: docs/PHASE_3_REDESIGN_VERIFICATION.md
Final evidence commit: 8761d21189d9c4058c3019ea6e42d4103fc83556
Final head CI: Quality success 36443016075; Security success 36443016203; Pages success 36443015338.
Implementation head documented in Phase 3 verification: b0f3e2587c6cc04beaf579505cb975a939459d6e.

Delivered:
- journal vouchers/lines and normalized line dimensions
- draft -> posted -> reversed lifecycle
- balanced debit/credit validation
- posting-account and analytic-dimension validation
- fiscal-year resolution/lock
- sequential voucher numbering
- source event/version uniqueness
- immutable posted vouchers; reversal instead of destructive edit
- manual journal UI with dynamic dimensions
- journal register and trial balance
- automatic posting profiles for sale, purchase, receipt, payment, expense and other income
- cash/credit aware sales/purchases
- VAT split behavior
- source-to-voucher adapter
- sync/backup persistence
- source-document immutability when linked to posted vouchers
- protection of used accounting masters/rules from destructive mutation

Important correction:
Earlier chat messages said Phase 3 was incomplete while execution was still catching up. GitHub remote evidence later closed and verified Phase 3. Current verified truth is Phase 3 COMPLETED.

## Production Supabase
Project ref: hcsixhqbyuhpshfwqpjx
Public tables: profiles, licenses, records; RLS enabled.
At handoff: profiles 4 rows, licenses 4 rows, records 84 rows.

Relevant migrations:
- 20260928141512 allow_accounting_foundation_collections
- 20260928145306 allow_phase3_double_entry_collections

Phase 3 allowed collections:
- postingProfiles
- journalVouchers
- journalLines
- journalLineDimensions

At final Phase 3 verification there were no Phase 3 journal rows requiring conversion/backfill. Historical Finora 1.0 accounting cutover was intentionally deferred.

Security advisor at handoff:
- five WARN findings for authenticated-callable SECURITY DEFINER functions: admin_cancel_license, admin_extend_license, admin_set_license, has_active_license, is_admin. These are known and were previously reviewed as intentional with internal authorization/RLS dependencies; do not blindly revoke authenticated execute.
- leaked password protection disabled in Supabase Auth; still an external/manual hardening item.
Performance advisor: no findings.

## Existing operational capabilities that must not regress
Sales invoices, purchase invoices, contacts/counterparties, products/services, receipts/payments with partial settlement, cheques, expenses/income, companies, global projects, reporting, formal/nonformal printing, Excel import, backup/cloud sync, admin/license controls, dashboard/drilldowns.

## Phase 4 — COMPLETED (RE-VERIFIED)
Phase 4 implementation and acceptance were re-verified under the stricter owner rule: real Chromium DOM smoke and actual accounting-invariant tests passed in Quality run `36600894426` on `55b62db0`. Delivered implementation scope:
- first-class contracts
- contract amendments/status/lifecycle
- employer/contractor/subcontractor relationships
- contract/project links
- deduction masters and schedules: retention, insurance, withholding tax, advance recovery, penalties, configurable other deductions
- guarantees: type, issuer/beneficiary, bank/institution, number, amount, issue/expiry, collateral, extension/release history
- optional memorandum/off-balance posting profiles for guarantees
- project/contract profitability and deduction/guarantee reporting
- source-to-voucher traceability for all new operations
- permissions, audit, reversal, sync/backup, migration, tests

Phase 4 acceptance must require master data + transaction lifecycle + posting + reversal + permissions + audit + reports + migration + tests + reconciliation. Forms alone do not complete a module.

## Phase 5 — AFTER PHASE 4
Complementary ERP/integration:
- inventory/warehouse and costing
- standard item/service master refinement
- fixed assets
- multi-currency
- cost centers/advanced analytics
- Excel/import center
- backup/restore
- company settings/permissions redesign
- integration/API architecture

## Phase 6 — FINAL
- journal/GL/subsidiary/detail/analytic ledgers
- trial balance variants
- P&L, financial position, cash flow
- AR/AP aging
- project/contract reports
- historical Finora 1.0 reconciliation and controlled cutover
- QA/security/performance
- audit/backup/rollback
- production release

## Accounting architecture decisions that are not to be casually reversed
- posted journal lines become accounting truth; operational documents remain source documents
- posted vouchers are immutable; corrections use reversal/amendment
- counterparties/projects/branches/contracts are global masters, not cloned into account trees
- do not create one ledger account per customer/supplier
- analytic dimensions are generic normalized assignments, not fixed four columns
- account determines which dimensions are required/optional/unavailable
- group/non-leaf analytic nodes are not postable when leaf-only rules apply
- historical identity/meaning must survive structural changes
- templates are optional/editable setup accelerators, not hard-coded accounting rules
- bank design supports stable ledger account + Bank Account master/dimension as scalable default
- no destructive historical migration without preview/reconciliation/rollback

## Known verification boundary
A real Chromium DOM smoke is now required in CI for completion claims; it exercises the rendered login shell and a stubbed post-login transition without production credentials. Authenticated production-user E2E and physical-printer validation remain NOT VERIFIED unless explicitly run.

## Successor startup procedure
1. Connect official GitHub and Supabase tools.
2. Verify repository main head and read this file.
3. Read docs/PHASE_1_REDESIGN_VERIFICATION.md, docs/PHASE_2_REDESIGN_VERIFICATION.md, docs/PHASE_3_REDESIGN_VERIFICATION.md, docs/ACCOUNTING_CORE_ROADMAP_V1.md, docs/RD_IRAN_ACCOUNTING_ERP_2026-09-28.md.
4. Verify latest Quality/Security/Pages results.
5. Verify Supabase migrations/RLS/advisors.
6. Do not redo Phases 1–3 unless a regression is found.
7. Start Phase 5 from the current remote state; do not reopen Phase 4 unless verified regression evidence exists.
8. Work continuously: inspect -> implement -> test -> fix -> retest -> commit/push -> verify -> continue.
9. Never report a phase complete until its acceptance criteria and release gates are actually verified.


## Mandatory interpretation of roadmap status

The **current master roadmap is six phases**, regardless of older historical documents that use four phases or labels such as Phase 5–8.

- **Phase 1 — COMPLETED:** scalable UX/product shell and information architecture.
- **Phase 2 — COMPLETED:** master data + accounting-core foundation.
- **Phase 3 — COMPLETED:** double-entry operational accounting and automatic source posting.
- **Phase 4 — COMPLETED:** re-verified with real-DOM smoke plus accounting-invariant execution at `55b62db0` / Quality `36600894426`.
- **Phase 5 — NEXT:** complementary ERP/integrations, inventory/costing/assets/multi-currency/settings/permissions/import.
- **Phase 6 — PENDING:** professional reports, historical reconciliation/cutover, QA/security/performance/audit/backup/rollback/final release.

Do not confuse the older completed Finora 1.0 four-phase delivery with this current six-phase redesign roadmap.

## How to record future work

For every new material user request, add a row to **Current change ledger** before implementation using one of:
- `REQUESTED`
- `IN PROGRESS`
- `COMPLETED`
- `BLOCKED`
- `DEFERRED`

When completing it, update the same row with commit/migration/test evidence and adjust **Current verified project state / roadmap status / next work** if affected. Do not create a separate private handoff that can drift from this file.

## Required companion evidence

When relevant, verify rather than merely trust:
- `docs/PHASE_1_REDESIGN_VERIFICATION.md`
- `docs/PHASE_2_REDESIGN_VERIFICATION.md`
- `docs/PHASE_3_REDESIGN_VERIFICATION.md`
- `docs/ACCOUNTING_CORE_ROADMAP_V1.md`
- `docs/RD_IRAN_ACCOUNTING_ERP_2026-09-28.md`
- `docs/PRODUCTION_RUNBOOK.md`
- GitHub Actions Quality/Security/Pages results
- production Supabase migrations, RLS, advisors and data compatibility

## End-of-session requirement

**Do not leave the project after making durable changes without updating `PROJECT_STATE.md`.**  
If a session is interrupted before the final update, the next worker must first reconcile this file against GitHub/Supabase evidence, then continue.


## Current next executable phase

**Phase 5 is the next executable phase.** Phases 1–4 are complete under the current acceptance rule. Phase 5 owns complementary ERP/integrations: inventory/warehouse and costing, fixed assets, multi-currency, cost centers/advanced analytics, import/backup/permissions/settings redesign and integration/API architecture.

## Portable one-line bootstrap

When the owner starts a new ChatGPT/Claude/Gemini/Grok/Codex or other coding session, the minimum bootstrap instruction may be:

`Open GitHub repo davoodmehraban89/Factor-easy on main; read AGENTS.md then PROJECT_STATE.md in full, inspect docs/reference/finora-ui-target-v1.jpg, verify live repo/Supabase state, record my latest request in PROJECT_STATE.md, then resume the exact next executable work autonomously under its five-workstream/high-assurance accounting rules; after every durable checkpoint update PROJECT_STATE.md, and do not stop while approved executable work remains.`

This short prompt is only a pointer. The repository files are authoritative and must contain the full current roadmap, decisions, evidence and next work.
