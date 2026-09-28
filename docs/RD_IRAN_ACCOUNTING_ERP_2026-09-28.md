# Finora R&D — Iranian Accounting/ERP Product Research

Date: 2026-09-28
Baseline: Finora 1.0
Purpose: Product discovery before implementation of the accounting-core expansion.

## Products/references reviewed
Hamkaran System / Rahkaran ecosystem, Sepidar, Tadbir, Shygun Hesabgar, Parmis Star, Mahak, Gheyas, and current Iranian cloud-accounting patterns. Research prioritizes vendor/product documentation where accessible and uses secondary material only to fill documentation gaps.

## Market patterns that matter

### A. Accounting core
Mature products converge on:
- multi-level chart of accounts
- reusable/floating detail identities
- cost centers/projects as analytic dimensions
- draft/normal/final voucher lifecycle
- automatic vouchers from operational subsystems
- year-end closing/opening
- multi-period/multi-company
- multi-currency and revaluation
- drill-down from balance -> ledger -> voucher -> source document
- attachments and audit trail
- approval/control stages for vouchers.

### B. Treasury
A professional treasury subsystem includes:
- cash, bank, POS, transfer and cheque
- cheque lifecycle and maturity alerts
- bank statement import and automatic reconciliation
- petty cash
- installments/loans
- customer credit controls
- aging and collection follow-up
- cashflow forecast.

### C. Contract/project accounting
A serious contractor module includes:
- tender
- contract and amendments
- employer/subcontractor
- price-list/BOQ structure
- progress statements (interim/final)
- physical and financial progress
- direct/indirect cost allocation
- retention, insurance, withholding tax, advance recovery and penalties
- guarantees with reduction/extension/release
- contract/project profitability and cost-to-complete.

### D. Inventory and costing
Market leaders commonly provide:
- multiple warehouses
- receipts/issues/transfers
- stock count and adjustment
- reservations
- serial/batch/expiry tracking where needed
- multiple units
- costing methods
- landed/import costs
- BOM and production
- actual/standard costing and variance.

### E. Fixed assets
Expected capabilities:
- asset classes and tags
- acquisition and subsequent expenditure
- custodian/location/cost-center tracking
- transfer
- depreciation methods/rates
- idle asset handling
- sale/disposal
- automatic accounting vouchers.

### F. Payroll
Expected capabilities:
- employee contracts
- attendance input/import
- configurable earning/deduction formulas
- loans/installments
- leave/severance/bonus
- insurance/tax/bank outputs
- payroll accounting voucher
- employee self-service can be later.

### G. Tax/legal compliance
Iran-specific product architecture should reserve independent adapters for:
- Taxpayer System electronic invoices
- VAT/tax mappings
- electronic legal/commercial books export
- payroll insurance/tax outputs
- configurable legal reports.
Compliance adapters must be versioned separately from the accounting ledger so regulatory changes do not destabilize core accounting.

### H. Enterprise controls
- role/permission matrix
- company/branch scope
- maker/checker/approver workflows
- fiscal period locks
- immutable posted vouchers + reversal
- audit log
- document attachments
- API/webhooks/import/export
- backup/restore and migration diagnostics
- configurable numbering and document templates.

## Product direction proposed for Finora

Finora should not copy the menu structure of a competitor. It should combine professional accounting depth with a cloud-first, simpler UX.

### Finora Accounting Kernel
1. Fiscal years and periods
2. Chart of accounts: Group (optional presentation), General, Subsidiary, Detail
3. Four configurable floating analytic dimensions at launch, schema designed to support more later
4. Branch, Counterparty, Project and Contract as first-class master entities
5. Account-dimension rules: allowed/required/forbidden
6. Posting profiles
7. Journal vouchers and immutable posted lines
8. Source-document <-> voucher bidirectional trace
9. Reversal/amendment
10. closing/opening and fiscal locks.

### Important refinement to the original four-floating-detail idea
Default UI presets can be:
1. Branch
2. Counterparty
3. Project
4. Contract / analytic classification

But deductions and payment methods should NOT be forced into Floating Detail 4. They are transaction semantics with their own master/rule records. They may optionally be exposed as analytic dimensions for reporting. This prevents the accounting model from becoming ambiguous.

### Global master-data rule
Counterparties, projects, branches, contracts, employees, banks and assets are defined once. Accounting accounts reference them through dimensions/posting profiles rather than cloning them into account trees.

## Recommended product modules

### Core / must build first
- Accounting
- Treasury
- Sales/Receivables
- Purchases/Payables
- Counterparties
- Branches
- Projects
- Contracts
- Tax/legal adapters
- Management reports

### Next professional tier
- Guarantees
- Contract statements/deductions
- Inventory
- Fixed assets
- Budget/control
- advanced approval workflow
- multi-currency

### Expansion tier
- Payroll
- Production/BOM/cost accounting
- procurement/orders
- CRM/sales pipeline
- distribution
- API/integration marketplace
- BI/management dashboards.

## Differentiators Finora should pursue
1. Cloud-first responsive UX instead of desktop-era form overload.
2. Accountant mode + manager mode: same ledger, different workflows.
3. Source-to-ledger transparency: every KPI can drill to voucher and source.
4. Setup wizard that generates a sane chart/posting profiles by business type.
5. Reusable floating dimensions without duplicate identities.
6. Contract/project profitability in real time.
7. Smart reconciliation assistant for bank, receivables/payables and legacy migration.
8. Rule-based anomaly warnings: unbalanced mappings, unusual balances, duplicate invoices, overdue receivables, expired guarantees.
9. Import-first migration center for Excel and legacy systems.
10. API-first integration architecture.
11. Versioned Iran-compliance adapters.
12. Audit-grade history rather than destructive edits.

## Proposed information architecture

Dashboard
Accounting
  - Journal vouchers
  - Chart of accounts
  - Floating details
  - Posting profiles
  - Fiscal years / close
Treasury
  - Receipts/payments
  - Banks/cash/POS
  - Cheques
  - Bank reconciliation
  - Petty cash
Sales
Purchases
Inventory
Counterparties
Branches
Projects
Contracts
  - Statements
  - Deductions
  - Subcontractors
Guarantees
Fixed assets
Payroll (later)
Production/Costing (later)
Reports
  - General ledger
  - Subsidiary/detail ledgers
  - Floating-detail ledgers
  - Trial balance
  - AR/AP aging
  - Cashflow
  - Project/contract profitability
  - Financial statements
Tax & Legal
Administration
  - Users/roles
  - approval workflows
  - integrations/API
  - backup/import/audit log.

## R&D decisions before coding
- Keep accounting ledger generic; never encode Iranian legal rules directly in journal storage.
- Treat operational documents as sources and journals as accounting truth after posting.
- Separate master identity from account classification.
- Model branch/project/contract/counterparty as dimensions, not duplicated chart nodes.
- Design voucher immutability and fiscal locks before automatic posting.
- Implement migration/reconciliation before replacing legacy project/contact structures.
- Introduce modules progressively; do not turn Finora into a monolith of unfinished menus.

## Proposed implementation sequence
Phase 5: accounting kernel, chart, dimensions, branches, global projects, migration.
Phase 6: journals, posting engine, treasury/accounting integration, ledgers/trial balance.
Phase 7: contracts, statements, deductions, guarantees, project/contract accounting.
Phase 8: inventory/fixed assets, advanced reports, tax/legal adapters, close/migration/release.
Phase 9 candidate: payroll, production/costing, budgeting and advanced workflow.
Phase 10 candidate: CRM/procurement/distribution/API marketplace/BI and intelligent assistants.

## Product acceptance principle
A module is not considered complete merely because its forms exist. It is complete only when master data, transaction lifecycle, posting, reversal, permissions, audit trail, reports, migration, tests and source-to-ledger reconciliation are all verified.
