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

| Date | Request / decision | Status | Evidence / next action |
|---|---|---|---|
| 2026-09-29 | Establish a permanent in-repository continuity file so any future AI/chat can resume without relying on conversation history. Every material request must be recorded here before implementation and every durable checkpoint must update this file. | COMPLETED | Canonical file created at repository root: `PROJECT_STATE.md`. |
| 2026-09-29 | Continue product under working name Finora; final commercial brand may change later. Do not block engineering on naming. | ACTIVE DECISION | Rebrand must be a controlled migration when a final name is chosen. |
| 2026-09-29 | Six-phase redesign/ERP roadmap supersedes older phase numbering. | ACTIVE ROADMAP | Phases 1–3 verified complete; Phase 4 is next. |

## Current verified project state

The detailed handoff below was verified against the repository after Phase 3. Always re-check the live `main` head before modifying code.

# Finora / Factor-easy — Durable Handoff

Date: 2026-09-29
Repository: davoodmehraban89/Factor-easy
Canonical branch: main
Verified head at handoff: 8761d21189d9c4058c3019ea6e42d4103fc83556
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

### Phase 3 — COMPLETED
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

## Phase 4 — NEXT WORK
Phase 4 is the next master phase. Scope:
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
The execution environment used for these phases did not provide an authenticated interactive browser/device walkthrough. Do not claim browser E2E or physical-printer validation unless actually performed. CI, source verification, Supabase checks and Pages deployment were used as release evidence.

## Successor startup procedure
1. Connect official GitHub and Supabase tools.
2. Verify repository main head and read this file.
3. Read docs/PHASE_1_REDESIGN_VERIFICATION.md, docs/PHASE_2_REDESIGN_VERIFICATION.md, docs/PHASE_3_REDESIGN_VERIFICATION.md, docs/ACCOUNTING_CORE_ROADMAP_V1.md, docs/RD_IRAN_ACCOUNTING_ERP_2026-09-28.md.
4. Verify latest Quality/Security/Pages results.
5. Verify Supabase migrations/RLS/advisors.
6. Do not redo Phases 1–3 unless a regression is found.
7. Start Phase 4 from the current remote state.
8. Work continuously: inspect -> implement -> test -> fix -> retest -> commit/push -> verify -> continue.
9. Never report a phase complete until its acceptance criteria and release gates are actually verified.


## Mandatory interpretation of roadmap status

The **current master roadmap is six phases**, regardless of older historical documents that use four phases or labels such as Phase 5–8.

- **Phase 1 — COMPLETED:** scalable UX/product shell and information architecture.
- **Phase 2 — COMPLETED:** master data + accounting-core foundation.
- **Phase 3 — COMPLETED:** double-entry operational accounting and automatic source posting.
- **Phase 4 — NEXT:** projects/contracts/deductions/guarantees and contractor accounting.
- **Phase 5 — PENDING:** complementary ERP/integrations, inventory/costing/assets/multi-currency/settings/permissions/import.
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
