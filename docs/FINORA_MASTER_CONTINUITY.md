# FINORA — MASTER CONTINUITY & AUTONOMOUS EXECUTION FILE
Version: 1.0-continuity
Repository: davoodmehraban89/Factor-easy
Default branch: main
Production domain: factoreasy.ir
Working product name: Finora
Current public release identity: Finora 1.0
Supabase production project ref: hcsixhqbyuhpshfwqpjx

> THIS FILE IS THE SINGLE SOURCE OF TRUTH FOR CONTINUING THE PROJECT ACROSS CHATS, MODELS AND CODING AGENTS.
> Every agent MUST read this file before making project decisions and MUST update it after every confirmed work batch, changed requirement, completed milestone, migration, release, blocker, or architectural decision.

## 0. Mandatory startup protocol

When given the bootstrap instruction for this repository:

1. Open this repository and read this file completely.
2. Inspect the ACTUAL current repository state, latest commits, workflows, migrations and relevant production configuration. Never trust this file over contradictory live evidence; reconcile and update this file if drift exists.
3. Read the roadmap and verification documents referenced below.
4. Resume from the latest VERIFIED checkpoint. Do not redo completed work.
5. Before implementing a new user-requested change, record the new requirement in this file under Change Log / Current Queue so it survives interruption.
6. Execute continuously: INSPECT → IMPLEMENT → TEST → FIX → RETEST → VERIFY → COMMIT/PUSH → UPDATE THIS FILE → CONTINUE.
7. Never mark a phase complete until its acceptance criteria and automated gates are verified.
8. After every confirmed work batch, update this file with exact status, important decisions, commit SHA(s), migrations, test results, unresolved risks and next executable item.

## 1. Authority and operating mode

Act as the autonomous implementation owner and coordinated project manager for Finora within the authority delegated by the repository owner.

You are NOT merely an adviser. For reversible, in-scope repository work, make normal engineering decisions and execute them without repeatedly asking for approval. Do not impersonate the human owner in legal, financial, public, contractual, destructive or access-sensitive actions. Those require explicit authorization when needed.

This is financial/accounting software. Treat correctness as safety-critical business logic: a silent wrong balance, journal, settlement, migration or report is worse than rejecting an operation. Prefer fail-safe behavior, atomic transactions, explicit invariants, immutable posted history, auditability, controlled migration and reconciliation.

Engineering quality target: mission-critical professional software. Do not optimize for demos. Do not expose fake future screens as completed features. Do not fabricate tests, browser verification, production state, integrations or agent execution.

## 2. Coordinated specialist workstreams

The coordinating manager owns integration, dependencies and final acceptance. Use five specialist workstreams when the environment supports them; otherwise execute these roles sequentially and DO NOT claim independent agents existed.

1. Architecture & Requirements — product boundaries, accounting invariants, data contracts, migration design, acceptance criteria.
2. Implementation — frontend, domain logic, persistence, integrations and migrations.
3. UX/UI — RTL information architecture, interaction design, responsive behavior, accessibility, visual consistency.
4. QA & Verification — independent regression, financial invariants, migration/reconciliation tests, failure reproduction, release gates.
5. Security & Release — RLS/auth, permissions, audit, dependency/code scanning, production deployment, rollback and operational documentation.

Each task has exactly one primary owner. Workstreams may review each other but must not make conflicting concurrent edits to shared files.

## 3. Product direction

Finora is evolving from invoice/financial-management software into a unified accounting/ERP platform. Existing features are not a separate legacy product. Every current capability must be reviewed, redesigned where necessary, aligned to the accounting core, migrated without data loss and retested.

Working name remains Finora until a later controlled rebrand. Do not rename repository, production domain, Supabase project or integrations merely for branding without an approved rebrand migration.

## 4. Approved UX reference — DO NOT DRIFT

The approved target is the RTL enterprise shell shown by the owner in the Phase-1 reference screenshot:
- compact fixed module rail on the far right;
- contextual second-level menu panel beside it;
- top bar for global search, active company, fiscal year, quick action, notification/user context;
- accounting dashboard with clean white cards, restrained teal/blue accents, compact icons, generous content area;
- submenu can collapse so forms/reports gain width;
- desktop uses compact iconography and strong first-glance findability;
- mobile preserves practical navigation rather than reproducing desktop panels.

Canonical screenshot target path:
`docs/reference/FINORA_PHASE1_APPROVED_UI.webp`

If that binary asset is unavailable in the execution environment, DO NOT invent a different design. Use this section plus the Phase-1 implementation as the design source and flag the missing binary asset in this file. The screenshot supplied by the owner is 1536×864 (16:9). Its visual content is the exact approved Finora accounting-dashboard reference.

## 5. Master six-phase roadmap

### Phase 1 — Product/UX architecture redesign
Approved shell, dashboard/navigation architecture, two-layer navigation, top bar, global command search, responsive behavior; migrate current working features into the new information architecture without loss.

STATUS: COMPLETED and verified.
Acceptance commit: c51e49a3f7863886e8a997858d6f2c44165eb5de
Evidence: docs/PHASE_1_REDESIGN_VERIFICATION.md
Verified gates on acceptance commit: Quality SUCCESS; GitHub Pages SUCCESS; Security/CodeQL SUCCESS.
Important boundary: no authenticated interactive browser/device walkthrough was available in that execution environment, so it was not claimed.

### Phase 2 — Master Data + Accounting Core redesign
Build real accounting foundations: GL / Subsidiary / Detail chart, fiscal years, branches, counterparties, products/services, global projects and normalized analytical dimensions. Migrate contact-owned legacy project concepts safely.

STATUS: NOT VERIFIED COMPLETE.
Do not skip this phase because later phase requests were issued. Inspect current repository and finish all acceptance criteria before declaring complete.

### Phase 3 — Double-entry financial operations
Redesign sales/formal/nonformal invoices, purchases, expenses/income, receipts/payments and cheques onto the posting engine; journals, ledger lines, treasury, bank/cash/POS/petty cash, reconciliation and AR/AP.

STATUS: NOT COMPLETE / NOT VERIFIED.
Prior attempts to start/continue Phase 3 were interrupted before a complete implement→test→fix→retest→verify cycle. Never report Phase 3 complete without repository and production evidence.

### Phase 4 — Projects, contracts, deductions, guarantees
Global projects, contracts/pacts, statements, subcontractors, retention, insurance, tax, advances, penalties, guarantees and appropriate memo/off-balance treatment.

STATUS: PLANNED.

### Phase 5 — Complementary ERP + integration
Standard item/service master, inventory, costing, fixed assets, multi-currency, cost centers; redesign Excel import, backup, print, company settings and permissions around the unified core.

STATUS: PLANNED.

### Phase 6 — Reports, control, migration, final release
Journal/GL/subsidiary/detail/analytic ledgers, trial balance, P&L, financial position, cash flow, aging, project/contract reporting; reconcile/migrate Finora 1.0; QA/security/performance/audit/backup/rollback/release.

STATUS: PLANNED.

Future expansion after these six phases may include payroll, production/BOM, industrial costing, budget, CRM, procurement, distribution, BI and intelligent capabilities.

## 6. Accounting-core non-negotiable rules

Chart of Accounts has three fixed accounting levels: General Ledger (کل), Subsidiary (معین), Detail (تفصیلی).

Analytical/floating dimensions MUST NOT be stored as fixed floating1..floating4 fields. Use normalized line assignments such as journalLineDimension(lineId, dimensionId, dimensionValueId), allowing zero/one/many dimensions per line.

A dimension has explicit Hierarchy Depth. Example depth 1: کارکنان ← علی رضایی. Example depth 2: کارکنان ← واحد مالی ← علی رضایی. Intermediate/group nodes are non-postable; valid terminal leaf nodes are postable.

Once child/value data exists, hierarchy depth cannot be directly changed. Structural reduction/change requires first proving dependent values are unused. If any journal, posting, mapping, rule, master data or history references a value, physical deletion is forbidden; deactivate/close or controlled versioned migration only.

After posted financial activity, structural meaning is immutable historically. Use effective dating/versioning or explicit controlled migration; never silently rewrite posted meaning.

Each account+dimension relation declares required / optional / unavailable. Selecting an account in journal entry exposes only applicable dimensions and blocks posting when required dimensions are missing.

Entity-backed dimensions should reuse master identities instead of duplicate data: Contact, Project, Branch, Employee, Bank Account, Contract, etc.

Counterparty roles map naturally to AR/AP. Projects are global, not owned by a contact.

Optional company-type onboarding templates may seed recommended chart, posting profiles, dimensions and mappings, but users may start empty and templates are not hard-coded accounting law.

Initial template families: Trading, Service, Manufacturing, Contracting, Retail, Distribution, Nonprofit, Professional Services; multi-company/holding later.

Recommended scalable bank model: stable ledger account + Bank Account master/dimension for treasury/reconciliation, while still supporting traditional chart-oriented structures when needed.

Financial posting controls belong at database/API/transaction boundaries, not only UI. Posted vouchers require immutable history with reversal/amendment, period locks, audit trail and reconciliation.

## 7. Existing production architecture and verified legacy capabilities

Repository: davoodmehraban89/Factor-easy
Production Supabase: hcsixhqbyuhpshfwqpjx
Public records table uses owner_id, collection, id, data jsonb, updated_at with RLS.
Known collections include companies, contacts, products, invoices, cheques, expenses, settings, purchases, payments.

Existing v1.0 capabilities include sales/purchases, contacts/products, expenses/income, cheque lifecycle, payment allocations, companies, projects/subprojects, financial reporting, print, cloud sync/backup and admin/license flows.

Payment allocation is the current source of receivable/payable settlement. Cheques are lifecycle/status records and must not independently reduce balances without an explicit accounting design, to avoid double counting.

Known residual/operational items from v1.0:
- Supabase Leaked Password Protection was previously observed disabled.
- SECURITY DEFINER advisor warnings exist for admin/license/helper functions; do not blindly revoke authenticated execution because current RLS/admin flows depend on them. Inspect current definitions before changing.
- PWA offline support not implemented.
- Taxpayer System API not live.
- CSP still contains unsafe-inline because of current architecture.
- SMTP production provider remains an operational requirement.
- no previously verified live physical printer test.
- legacy project storage exists inside contacts and must be migrated to global projects.
- current accounting.js is derived accounting/project/inventory logic, not the final double-entry core.

## 8. Key historical verified milestones

Original pre-redesign four-phase v1.0 program was completed and released before the new six-phase transformation.
Important v1.0 final/audit/version work included:
- Phase 1/2 acceptance: f31401d3aec77a8fa365f9c2b85c878030618e8e
- Phase 3 verification line: 32a5a76b...
- Phase 4 verification line: 967cb8b...
- Full project audit: 441f32003881aac0b5520412d117a39981efa544
- Final v1.0 cache/version line: 08be8c441fa6cb26c59aec99d2286e60bd76d721
These refer to the OLD v1.0 delivery program, not completion of the NEW six-phase ERP transformation.

New transformation:
- R&D market research: docs/RD_IRAN_ACCOUNTING_ERP_2026-09-28.md
- Accounting roadmap: docs/ACCOUNTING_CORE_ROADMAP_V1.md
- New Phase 1 redesign acceptance: c51e49a3f7863886e8a997858d6f2c44165eb5de

## 9. Required documents to read

Read these when present:
- docs/ACCOUNTING_CORE_ROADMAP_V1.md
- docs/RD_IRAN_ACCOUNTING_ERP_2026-09-28.md
- docs/PHASE_1_REDESIGN_VERIFICATION.md
- docs/FULL_PROJECT_AUDIT_2026-09-28.md
- docs/PRODUCTION_RUNBOOK.md
- docs/COMPLETION_PHASES.md

Do not assume documents are current without comparing them to live code and migrations.

## 10. Definition of Done for any phase

A phase is COMPLETE only when:
- scoped implementation exists in the real repository;
- migrations are applied safely where required;
- old data is preserved/reconciled;
- automated syntax/quality/regression checks pass;
- security implications are reviewed;
- failure cases and accounting invariants are tested;
- relevant deployment succeeds;
- acceptance evidence is written;
- THIS FILE is updated with exact commit/migration/test status;
- no critical unresolved defect in phase scope remains.

A form or menu alone never completes an accounting module.

## 11. Continuity/change-control protocol

This file must remain current.

When the owner asks for a new feature/change:
1. Record it first in Current Queue / Change Log with date and intended phase.
2. Resolve dependencies and architecture impact.
3. Implement.
4. Verify.
5. Replace the queue item status with VERIFIED or BLOCKED and record evidence.
6. Update roadmap status if scope changed.

When interrupted, the next agent starts from this file plus actual repo state. Never depend on chat memory as the only project record.

## 12. Current Queue / next executable work

Priority 1: reconcile actual repository state after Phase-1 acceptance and any commits made afterward.
Priority 2: complete NEW Phase 2 before Phase 3 can be truthfully closed:
- normalized accounting master-data schema;
- three fixed account levels;
- fiscal-year/period model;
- global projects migration design;
- generic hierarchical analytic dimensions and depth invariants;
- account-dimension applicability;
- company templates;
- migration/reconciliation and regression gates.
Priority 3: then execute NEW Phase 3 posting engine and migrate all financial operations to double entry.

Do not declare Phase 2 or Phase 3 complete merely because a chat previously requested completion.

## 13. Change Log

2026-09-28 — New six-phase ERP transformation roadmap established.
2026-09-28 — Finora retained as working name; Nivaro rejected due brand collision concern. Rebrand deferred.
2026-09-28 — Hybrid RTL shell approved: compact right module rail + contextual submenu + top global bar/search.
2026-09-28 — New Phase 1 redesign completed and accepted at c51e49a3f7863886e8a997858d6f2c44165eb5de with Quality, Pages and Security/CodeQL success.
2026-09-28/29 — Requests to complete new Phase 2/3 were interrupted; no verified completion evidence recorded. Status remains incomplete until proven from repository.
2026-09-29 — Continuity protocol established: this file becomes mandatory cross-chat source of truth and must be updated after every confirmed work batch or requirement change.
2026-09-29 — Owner re-supplied the approved 1536×864 Phase-1 UI reference and required it to remain the canonical visual target.

## 14. Absolute prohibitions

- Never fabricate completion, tests, deployments, production state or agent activity.
- Never silently alter posted financial history.
- Never delete referenced financial/master records merely to simplify migration.
- Never create parallel “old” and “new” products as the final architecture.
- Never let UI-only validation substitute for accounting/database invariants.
- Never drift from the approved UX reference without an explicit newer owner decision.
- Never leave this file stale after a confirmed project change.
