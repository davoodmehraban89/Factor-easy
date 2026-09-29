# FINORA — PROJECT CONTINUITY & AUTONOMOUS EXECUTION CONTROL FILE

> **Canonical continuity file. Read this before doing any work on this repository.**
>
> Repository: `davoodmehraban89/Factor-easy`
>
> Product working name: **Finora**
>
> Production data: existing Supabase production project/data must be preserved. Never create a replacement production database merely for redesign/rebranding.
>
> This file is the single handoff/checkpoint source for ChatGPT, Codex, Claude Code, Gemini, Grok, or any other capable implementation agent.

## 1. Operating mandate

Act as the **implementation owner and coordinating project manager**, not as a passive adviser. Inspect the real repository state before making claims. Make ordinary, reversible, in-scope engineering decisions autonomously. Continue implementation in dependency order until the requested phase is genuinely complete or a real external blocker is reached.

This is financial/accounting software. Treat correctness like safety-critical business software: a silent wrong balance, duplicated posting, destructive history edit, broken migration, unauthorized access, or false reconciliation is a release-blocking defect. Prefer rejection of an invalid financial state over silently accepting it.

Never claim a test, deployment, database migration, browser check, integration, commit, push, or multi-agent execution happened unless it actually happened.

Do not stop at planning, explanation, one task, one file, or one milestone. Normal loop:

`INSPECT → IMPLEMENT → VERIFY → FIX → RE-VERIFY → COMMIT → UPDATE THIS FILE → CONTINUE`

When a user introduces a new requirement, **first update the Current Requirements / Roadmap / Decision Log in this file**, then implement it. At every stable checkpoint and before ending a work session, update this file with the exact current state so another agent can resume without chat history.

## 2. Coordinated specialist workstreams

The coordinating manager owns final integration. Use these five specialist workstreams when the runtime supports real delegation; otherwise execute them as disciplined internal workstreams and **do not falsely claim independent agents**.

1. **Architecture & Accounting Requirements** — accounting model, invariants, data contracts, migration design, scope control.
2. **Implementation & Integration** — frontend, data layer, Supabase integration, accounting engine, source-document integration.
3. **UX/UI & Product Design** — information architecture, RTL usability, responsive shell, forms, discoverability, accessibility.
4. **QA & Financial Verification** — independent regression checks, accounting invariants, reconciliation, migration fixtures, failure reproduction.
5. **Security, Data Integrity & Release** — RLS/authorization, auditability, locks, backup/rollback, CI/security/deployment evidence.

Every task has one primary owner. Cross-workstream findings are handed to the owning workstream and re-verified after correction.

## 3. User communication rule

The user frequently requests autonomous execution with no progress chatter. When that instruction is active, do not send interim prose. Execute, verify, and only report after the requested scope is complete or a genuine blocker requires user action.

## 4. Product baseline and verified history

### Finora 1.0 legacy baseline
Before the current ERP redesign, the repository already contained working financial-management capabilities including sales, purchases, contacts, products/services, cheques, expenses/income, receipts/payments, companies, projects/subprojects, reports, printing, cloud sync/backup, authentication/admin and production Supabase integration.

Earlier four-phase stabilization/release work was completed before the new six-phase ERP redesign began. Do not confuse that old phase numbering with the **current six-phase master roadmap** below.

### Current redesign Phase 1 — COMPLETED
Verification file: `docs/PHASE_1_REDESIGN_VERIFICATION.md`

Implemented and accepted:
- compact RTL primary module rail
- contextual second-level panel
- collapsible desktop navigation
- global command/menu search
- top bar context
- responsive/mobile preservation
- existing operational views mapped into the new shell without fake future modules
- print isolation and quality-gate coverage

Acceptance commit recorded in repository history: `c51e49a3f7863886e8a997858d6f2c44165eb5de`.

### Current redesign Phase 2 — STATUS MUST BE RE-VERIFIED
Chat execution was interrupted and later phase requests overlapped. Do **not** infer completion from conversation. Inspect repository commits, schema, docs and tests. If Phase 2 is incomplete, resume it before Phase 3 unless the current repository proves its acceptance criteria are satisfied.

### Current redesign Phase 3 — NOT VERIFIED COMPLETE
The prior chat explicitly determined Phase 3 had **not** reached the full implementation → test → fix → retest → final acceptance cycle. Resume from repository reality, not from optimistic chat claims.

## 5. Current six-phase master roadmap

This roadmap supersedes earlier “Phase 5–8” numbering in old planning documents. Existing useful work must be absorbed into this unified product; do not create a disconnected legacy/new product split.

### Phase 1 — Product shell, UX and information architecture
Status: **COMPLETED / verified**.

Goal: scalable Finora shell, dashboard/navigation hierarchy, top bar/search/responsiveness, and migration of existing operational features into one coherent IA without losing functionality.

### Phase 2 — Master Data + Accounting Core foundation
Status: **RE-VERIFY AND COMPLETE IF NEEDED**.

Required scope:
- three fixed account levels: General Ledger / کل, Subsidiary / معین, Detail / تفصیلی
- fiscal years/period concepts
- branches
- counterparties as reusable master identities
- global projects (not contact-owned project trees)
- generic analytic/floating dimensions
- account ↔ dimension applicability rules
- company-type setup templates
- safe migration/mapping from legacy structures
- sync/backup/Supabase support and RLS/integrity controls

### Phase 3 — Double-entry financial operations
Status: **INCOMPLETE UNTIL VERIFIED**.

Redesign existing source documents onto a real double-entry accounting engine:
- journal vouchers + journal lines
- balanced debit/credit validation
- voucher lifecycle: draft → validated → posted → reversed
- immutable posted vouchers; corrections via reversal/amendment
- posting profiles
- automatic posting for sales, purchases, expense/income, receipt/payment and relevant cheque/treasury events
- treasury masters for bank/cash/POS/petty cash as needed
- AR/AP settlement and source ↔ voucher traceability
- fiscal/period locks
- manual journal entry
- source-to-ledger and ledger-to-source drill-through
- reconciliation proving legacy operational balances and accounting balances agree

A form alone is not completion. Posting, reversal, permissions, audit, reports/reconciliation, migration and tests must all work.

### Phase 4 — Projects, contracts, deductions and guarantees
- global projects
- contracts/pacts and amendments
- statements/progress billing where applicable
- subcontractors
- retention, insurance, withholding tax, advances, penalties
- guarantees lifecycle
- appropriate memo/off-balance posting profiles
- project/contract profitability and traceability

### Phase 5 — Complementary ERP and integrations
- standard product/service master
- inventory and costing
- fixed assets
- multi-currency
- cost centers
- Excel/import migration center
- backup/restore
- professional printing
- company settings and permissions redesign
- integrations/API boundaries
- Iran compliance adapters kept versioned/separate from the generic ledger

### Phase 6 — Reports, control, migration and final Finora release
- journal/general/subsidiary/detail/analytic ledgers
- trial balance
- profit & loss
- financial position
- cash flow
- AR/AP aging
- project/contract reporting
- close/lock/opening controls
- full Finora 1.0 reconciliation/migration
- QA, security, performance, audit, backup, rollback and production release
- all automated quality/security/deployment gates passing

Possible later ERP expansion after the six phases: payroll, production/BOM, industrial costing, budgeting, CRM, procurement, distribution, BI/intelligent assistants.

## 6. Non-negotiable accounting architecture

### Account structure
Three fixed account levels:
1. کل
2. معین
3. تفصیلی

Posting is only to valid posting accounts. Parent/group accounts never receive direct postings.

### Generic analytic dimensions — NOT four hard-coded columns
Do **not** implement storage as `floating1..floating4`. The system may offer four convenient UI slots initially, but storage must be normalized, conceptually:

`journalLineDimension(lineId, dimensionId, dimensionValueId)`

A posting account may require zero, one, or many dimensions.

### Hierarchy depth
Each dimension definition has an explicit **Hierarchy Depth / عمق ساختار**.

Example depth 1:
`کارکنان ← علی رضایی`

Example depth 2:
`کارکنان ← واحد مالی ← علی رضایی`

Intermediate/group nodes are non-postable. Posting selects terminal leaf nodes when leaf-only posting is enabled.

Hard rules:
- after values/children exist, depth cannot be casually changed
- changing structural depth requires removal/migration of lower values first
- physical deletion is forbidden if any journal, mapping, rule, master, source document or history references a value
- referenced values become inactive/closed instead
- after posted activity, structural changes are versioned/effective-dated or handled through controlled migration
- historical posted lines retain their original identity/meaning
- required dimensions must exist and be valid before posting

### Entity-backed dimensions
Do not duplicate business identities merely to satisfy accounting:
- Counterparty ← Contacts
- Project ← Projects
- Branch ← Branches
- Employee ← Employees
- Bank Account ← Bank Account master
- Contract ← Contracts

### Account-dimension rule
For each account + dimension:
- required
- optional
- unavailable

Only relevant dimensions appear when posting to that account.

### Company templates
Optional onboarding templates, editable after installation:
- Trading / بازرگانی
- Service / خدماتی
- Manufacturing / تولیدی
- Contracting / پیمانکاری
- Retail / فروشگاهی
- Distribution / پخش
- Nonprofit / غیرانتفاعی
- Professional services / خدمات حرفه‌ای
- Holding/multi-company later

User may choose recommended template or start empty. Templates seed configuration; they are not hard-coded business logic.

### Bank design
Support traditional chart-based bank detail when desired, but scalable default is a stable ledger account plus a Bank Account master/dimension used consistently by treasury, reconciliation, payments and accounting.

## 7. Financial safety invariants

At minimum:
- every posted voucher is balanced
- no negative/zero-invalid posting semantics are silently normalized
- no posting to inactive/non-posting account
- required analytic assignments enforced
- dimension values valid for company/account/effective period
- posted vouchers immutable
- reversal/amendment preserves audit history
- locked fiscal periods reject mutation
- source posting is idempotent: retry cannot duplicate the accounting event
- each source posting event has at most one active posted voucher
- migrations are atomic where possible and produce reconciliation evidence
- production changes require backup/rollback strategy
- ownership/company scope and RLS/authorization enforced server-side
- never rely on UI-only validation for critical financial integrity
- no destructive deletion of referenced financial masters/history

## 8. Current production/integration facts

Repository: `davoodmehraban89/Factor-easy`, default branch `main`.

Production Supabase project previously used by this product: `hcsixhqbyuhpshfwqpjx`. Before any database change, verify this is still the connected production project.

Current custom domain in repository baseline: `factoreasy.ir`.

Working product name remains **Finora**. A later rebrand is allowed, but do not rename repository/domain/Supabase or create a replacement database merely to change branding. Rebranding must be a controlled migration preserving production data and integrations.

Known operational/security residuals from the prior release that must not be falsely reported as fixed:
- Supabase Leaked Password Protection required dashboard-level attention unless subsequently verified
- intentional SECURITY DEFINER helper/RPC warnings must be reviewed by behavior, not blindly “fixed”
- no claim of physical printer validation without actually testing it
- no claim of authenticated browser E2E unless actually performed
- Taxpayer System API was not live in the 1.0 baseline
- PWA offline support was not part of 1.0 baseline

## 9. Approved UX visual target

The canonical visual reference for the redesign is stored at:

**`docs/reference/finora-approved-accounting-dashboard-16x9.jpg`**

This image is a **design target/reference**, not proof that every displayed future accounting feature is already implemented.

When asked “what should the Finora environment look like?” or when implementing the shell/dashboard, inspect this exact image first. Do not substitute a random ERP screenshot or invent a conflicting navigation system.

Visual principles encoded by the reference:
- RTL enterprise accounting workspace
- narrow primary module rail on the far right
- contextual second-level navigation beside it
- top bar with global search, fiscal year, active company and quick action
- dense but calm financial dashboard
- compact professional icons, not oversized decorative UI
- white/light neutral surfaces, restrained accent colors
- high information density without visual clutter
- clear drill-down paths and quick access
- desktop-first accounting efficiency with responsive behavior

## 10. Existing project research/docs to read

Before architectural/accounting changes, inspect:
- `docs/ACCOUNTING_CORE_ROADMAP_V1.md`
- `docs/RD_IRAN_ACCOUNTING_ERP_2026-09-28.md`
- `docs/PHASE_1_REDESIGN_VERIFICATION.md`
- this file

Important: older roadmap docs contain superseded numbering and an early “four floating details” formulation. **This continuity file contains the latest decisions**: normalized unlimited analytic dimensions and the six-phase master roadmap.

## 11. Required checkpoint protocol

At the beginning of every session:
1. Read this file completely.
2. Inspect current `main`, recent commits, relevant source, migrations and CI state.
3. Reconcile repository reality with the status recorded here.
4. If reality differs, update this file before continuing.

Whenever the user changes scope:
1. Add/update the requirement here.
2. Record any architecture decision affected.
3. Implement.
4. Test.
5. Update Current Execution Checkpoint below.

At every stable checkpoint/end:
- exact phase/status
- work completed
- files/schema changed
- migrations applied
- tests/checks run and their actual result
- latest relevant commit SHA
- unresolved defects/blockers
- next executable task
- any user decision still required

Never mark a phase COMPLETE merely because code was written. Completion requires its acceptance criteria and verification evidence.

## 12. Current execution checkpoint

**Checkpoint date:** 2026-09-29

**Last trusted redesign milestone:** Phase 1 accepted and verified.

**Phase 2:** must be re-audited against the six-phase scope before claiming completion.

**Phase 3:** not verified complete. Previous chat execution was interrupted while attempting to inspect/continue the double-entry redesign. Resume only after confirming Phase 2 prerequisites.

**Immediate next action for a new agent:**
- inspect current `main` and recent commits after the Phase 1 acceptance commit
- inspect Supabase migrations/schema
- map actual implemented Phase 2 artifacts against Section 5 acceptance scope
- complete/verify Phase 2 if necessary
- then execute Phase 3 continuously through implementation, tests, fixes, reconciliation, security/deployment gates
- update this file after each stable checkpoint

## 13. Decision log

- Finora remains the working name; Nivaro was rejected due to naming collision concerns.
- The product is evolving from simple invoice/financial management into a true accounting/ERP system.
- Current features are to be redesigned/absorbed into one unified architecture, not kept as a separate legacy generation.
- Global projects replace per-contact project ownership.
- Counterparties are one identity reused across AR/AP through dimensions/posting profiles.
- Analytic dimensions are generic, hierarchical, configurable and normalized; not limited to four storage slots.
- Dimension hierarchy depth is explicit and structurally protected after use.
- Posted accounting history is immutable; corrections are reversal/amendment.
- The approved dashboard image in `docs/reference/` is the canonical visual reference.
- This file is the canonical cross-chat/cross-agent continuity mechanism and must stay current.
