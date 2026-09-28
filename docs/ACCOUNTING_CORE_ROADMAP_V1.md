# Finora Accounting Core Roadmap — v1.x

Date: 2026-09-28
Status: Architecture approved for implementation planning
Baseline: Finora 1.0

## Objective
Move Finora from document/income-expense management to a double-entry accounting system without breaking the current sales, purchase, settlement, cheque, project, print, backup or cloud-sync workflows.

## Core accounting model

### 1. Chart of Accounts
Three fixed account levels:
1. General Ledger / کل
2. Subsidiary / معین
3. Detail Account / تفصیلی

Each account has: id, code, title, parentId, level, normalBalance (debit/credit), nature, postingAllowed, active, companyId, fiscalYearId.

Posting is allowed only to the last configured posting level. Parent accounts aggregate children and never receive direct journal postings.

### 2. Floating detail dimensions
Four configurable floating-detail dimensions are attached to journal lines, not embedded below the account tree.

Default dimension definitions:
- Floating Detail 1: Branch / شعبه
- Floating Detail 2: Counterparty / طرف حساب
- Floating Detail 3: Project / پروژه
- Floating Detail 4: Contract / deduction/payment analytic dimension

The engine must not hard-code those labels. A company can rename/enable/disable dimension types and define which dimensions are allowed or required for each posting account.

Journal line shape:
accountId + debit + credit + floating1Id + floating2Id + floating3Id + floating4Id + documentRef + description.

### 3. Global projects
Projects become first-class company masters, independent from contacts. A project is defined once and can then be linked to any number of counterparties, contracts, invoices, purchases, payments, expenses and journal lines.

Existing contact-owned projects are legacy data and require a controlled migration to global project records. Historical IDs must be preserved or mapped so prior documents remain traceable.

### 4. Counterparties
Contacts remain first-class masters and automatically become values in the Counterparty floating-detail dimension.

Contact role does not itself create a ledger account. Posting profiles determine the control account:
- customer sale -> Accounts Receivable control account
- supplier purchase -> Accounts Payable control account
- both -> the same counterparty dimension can be used under both receivable and payable control accounts.

This prevents duplicate customer/supplier ledgers and preserves one counterparty identity.

### 5. Contracts
Contracts are first-class masters:
contract number, title, employer/contractor counterparty, company, branch, project, start/end date, gross value, currency, status, insurance/tax attributes, retention rules, attachments/references and guarantee links.

Contracts can be linked to sales/purchase invoices, payments, deductions, guarantees and journal entries.

### 6. Deductions
Deduction types are masters rather than free text:
- retention / حسن انجام کار
- insurance deduction / سپرده یا کسر بیمه
- withholding tax / مالیات تکلیفی
- advance recovery / استهلاک پیش‌پرداخت
- penalties / وجه التزام
- other configurable deductions

Each deduction type has a posting profile and can optionally be represented in Floating Detail 4. The financial meaning remains in the deduction record and posting rule; the floating dimension is analytic, not the accounting source of truth.

### 7. Guarantees
Guarantees are first-class masters:
type, issuer/beneficiary, bank/institution, guarantee number, contract/project, issue/expiry dates, amount, status, collateral, extension/release history and document references.

Guarantees should support memorandum/off-balance accounting through dedicated posting profiles where the company uses such accounts.

## Double-entry engine

Every financial source document creates a journal voucher with balanced journal lines. Posted vouchers are immutable; corrections use reversal/amendment rather than destructive edits.

Core entities:
- fiscalYears
- accountGroups (optional presentation layer)
- accounts
- dimensionTypes
- dimensionValues
- accountDimensionRules
- postingProfiles
- journalVouchers
- journalLines
- projects
- projectLinks
- contracts
- contractDeductions
- guarantees

Voucher lifecycle:
draft -> validated -> posted -> reversed.

Hard invariants:
- total debit = total credit
- no posting to inactive/non-posting accounts
- required dimensions must be present
- dimension value must be permitted for the account/company/fiscal year
- posted voucher cannot be silently edited/deleted
- source document can have at most one active posted voucher per posting event
- fiscal-year lock prevents backdated mutation
- all records are owner/company scoped and RLS protected.

## Default posting profiles

Sales invoice:
Dr Accounts Receivable [counterparty, branch, project, contract]
Cr Sales/Revenue [branch, project, contract]
Cr Tax/VAT Payable when applicable

Purchase invoice:
Dr Inventory/Expense/Asset [branch, project, contract]
Dr Recoverable VAT when applicable
Cr Accounts Payable [counterparty, branch, project, contract]

Receipt:
Dr Cash/Bank
Cr Accounts Receivable [counterparty/project/contract]

Payment:
Dr Accounts Payable [counterparty/project/contract]
Cr Cash/Bank

Contract deductions use configured receivable/payable/control accounts and retain the same contract/project/counterparty dimensions.

## New four-phase implementation

### Phase 5 — Accounting Foundation and Chart of Accounts
Owner: Architecture/Accounting Core
Deliverables:
- fiscal year master and opening/locking model
- three-level chart of accounts UI and coding validation
- account nature and posting-level rules
- four configurable floating-detail dimensions
- branch master
- counterparty synchronization into floating detail 2
- global project master replacing contact-owned project definition
- account-to-dimension required/allowed rules
- safe migration layer for existing projects/documents
- Supabase collections/RLS/migrations and backup/sync support
Acceptance:
- chart can be created/imported
- global project is defined once and linked to multiple contacts/documents
- contacts appear automatically as dimension values without duplication
- no existing Finora 1.0 document is orphaned.

### Phase 6 — Double-entry Journal and Automatic Posting
Owner: Financial Engine
Deliverables:
- journal voucher/line engine
- debit-credit validation and posting locks
- manual journal UI
- automatic posting profiles for sale, purchase, receipt, payment and expense/income
- account ledger, subsidiary ledger, detail ledger and floating-detail ledger
- opening entries, voucher numbering, reversal
- migration/reconciliation report comparing legacy balances to accounting balances
Acceptance:
- every posted source document generates a balanced voucher
- customer/supplier balances reconcile to control accounts
- trial balance is balanced
- no posted voucher can be destructively edited.

### Phase 7 — Contracts, Deductions, Guarantees and Advanced Analytics
Owner: Contracts/Accounting Integration
Deliverables:
- contracts menu and master
- deduction rules and contract deduction schedules
- guarantees menu and lifecycle
- contract/project/branch/counterparty analytic links
- optional memorandum posting profiles for guarantees
- project and contract profitability, retention/insurance/tax tracking
Acceptance:
- a contract can connect to multiple documents/payments/guarantees
- deductions are traceable from contract to voucher
- guarantees have expiry/status history and accounting references
- reports reconcile to journal data.

### Phase 8 — Professional Accounting Reports, Migration and Release
Owner: QA/Release
Deliverables:
- journal, general ledger, subsidiary ledger, detail ledger
- floating-detail ledgers 1..4
- trial balance 2/4/6/8-column as configured
- account turnover and balance reports
- project/branch/counterparty/contract analytic reports
- balance sheet and profit/loss mapping framework
- period close/lock
- full regression, security, performance and production migration
Acceptance:
- trial balance debit/credit equality
- source-to-voucher drilldown and voucher-to-source drillback
- legacy Finora 1.0 balances reconciled before cutover
- production backup and rollback point created before migration
- all automated quality/security/deployment gates pass.

## Workstream responsibilities
1. Architecture & requirements: accounting model, posting contracts, migration invariants.
2. Implementation: schema, engine, UI, synchronization and source-document integration.
3. UX/UI: chart editor, voucher entry, dimension selectors, contracts/guarantees and reports.
4. QA & verification: balanced-voucher tests, reconciliation, migration fixtures, regression.
5. Security & release: RLS, fiscal locks, immutable posting controls, backups and production rollout.

These are coordinated workstreams; implementation must not claim independent agents unless an actual multi-agent runtime is available.

## Key architectural decisions
- Do not create one project tree inside every counterparty.
- Do not create one ledger account per customer/supplier.
- Do not use floating details as substitutes for double-entry accounts.
- Do not let document totals remain the accounting source of truth after Phase 6; posted journal lines become the accounting ledger.
- Keep operational documents as source documents and link them bidirectionally to vouchers.
- Keep project, contract, branch and counterparty identities global within a company/fiscal context.
- Preserve Finora 1.0 source IDs during migration for auditability.
