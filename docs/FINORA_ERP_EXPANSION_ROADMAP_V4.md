# Finora ERP Expansion Roadmap V4 — Accountant-first, group-ready

Date: 2026-09-30

## Product principle
Finora should not become a menu catalog. A capability enters the product only when its master data, transaction lifecycle, accounting impact, permissions, audit trail, reporting, migration and tests are coherent. The current financial/accounting core remains the system of record.

## Evidence from mature ERP suites
- Microsoft Dynamics 365 Finance separates General Ledger, AP, AR, Budgeting, Cash/Bank, Cost Accounting and Fixed Assets, and pairs them with Supply Chain, Project Operations and Human Resources. Chart of Accounts is explicitly designed around main accounts + financial dimensions + account structures.
  https://learn.microsoft.com/en-us/dynamics365/finance/
  https://learn.microsoft.com/en-us/dynamics365/finance/general-ledger/plan-chart-of-accounts
- Oracle Fusion groups ERP around Financials, Accounting Hub, Procurement, Project Management, Risk/Compliance and Analytics, while SCM, HCM, Sales and Service remain integrated suites.
  https://docs.oracle.com/en/cloud/saas/index.html
- SAP describes ERP as an integrated system across finance, HR, manufacturing, procurement, supply chain and sales.
  https://www.sap.com/products/erp/what-is-erp.html
- NetSuite OneWorld, Acumatica and Odoo all treat multi-company/entity operation as more than “many company records”: subsidiaries/entities, intercompany flows, currencies, consolidation/reporting and permissions matter.
  https://www.netsuite.com/portal/products/erp/financial-management/finance-accounting/consolidation.shtml
  https://www.acumatica.com/cloud-erp-software/financial-management/
  https://www.odoo.com/documentation/18.0/applications/general/companies/multi_company.html
- Odoo CRM models leads → opportunities plus assigned sales teams, next activities, calls/meetings/tasks and pipeline/forecasting.
  https://www.odoo.com/documentation/18.0/applications/sales/crm.html
- Iranian suites such as Rahkaran/System Group, Sepidar, Parmis and Mahak reinforce the local need for accounting, treasury, sales/purchase, inventory, payroll and industry-specific flows rather than a single flat workspace.
  https://www.systemgroup.net/
  https://www.sepidarsystem.com/products/sepidar/
  https://www.parmisit.com/products/parmis-star-erp-solution
  https://www.mahaksoft.com/

## Company vs license vs holding
These are three different concepts and must never be merged:
1. **License company capacity** — commercial entitlement. Default = 1. Admin may sell 2, 10, N companies. This does not create a group relationship.
2. **Company/legal entity** — an accounting/reporting entity with person type, ownership/sector, legal form, activity type and its own books.
3. **Holding/group structure** — parent/subsidiary hierarchy. A real holding module additionally requires intercompany counterparties, due-to/due-from rules, intercompany matching, group currency, ownership/effective dates, consolidation mapping, elimination journals, minority/NCI treatment where relevant, consolidated statements, group close and access boundaries.

Current implementation records organizational position and parent-company relation only. It does **not** claim consolidation.

## Prioritized ERP gaps

### P0 — Financial control / accountant daily work
- Chart of Accounts UX: fast search/filter, hierarchy/path, safe edit/deactivate, duplicate/role validation, Excel import/export, account usage visibility.
- Account inquiry/drill-down from balance → voucher → source document.
- Bank accounts + bank statement import/reconciliation + unmatched items.
- Reconciliation workspace: GL ↔ AR/AP/bank/tax/inventory.
- Period-close workspace/checklist, period locks, closing evidence and exception list.
- Approval workflow for sensitive journals/payments and separation of duties.
- Audit log viewer with who/when/before/after for critical masters and transactions.
- Saved filters/favorites/recent items and keyboard-first navigation.

### P1 — Commercial ERP
- CRM: lead, opportunity, pipeline stage, probability, expected revenue, activities, reminders, salesperson/team, quote conversion, customer 360.
- Sales order lifecycle: quotation → order → delivery/service → invoice → collection.
- Procurement: request → RFQ → supplier quote comparison → PO → receipt → supplier invoice → payment.
- Inventory: reservations, transfers, multi-warehouse, reorder points, valuation layers and stock/account reconciliation.
- Budgeting: versions, dimensions, approval, actual-vs-budget, commitment control.
- Tax/local compliance workflow around Iranian invoicing/tax requirements with controlled mappings and audit evidence.

### P1 — People / payroll
- HR master: employee, employment, organization/unit, position, contract, attendance/leave.
- Payroll engine: earnings/deductions, benefits, loans/advances, insurance/tax parameters, payroll period, calculation preview, approval, payslip.
- Payroll posting: generated accounting voucher with traceability and reversal; cost-center/project allocation.
- Access segregation: HR confidentiality must not reuse ordinary accounting visibility.

### P2 — Group / enterprise
- Holding/group master, subsidiaries and ownership/effective dates.
- Intercompany documents and automated due-to/due-from.
- Group chart mapping and reporting dimensions.
- Currency translation, consolidation, elimination and consolidated statements.
- Group close monitor and subsidiary submission/lock workflow.

### P2 — Operations / industry depth
- Manufacturing: BOM, routing, work order, material issue/receipt, WIP, overhead and production costing.
- Service management: service orders, SLA, technician scheduling and service profitability.
- Advanced project/contract costing: WBS, budget, commitments, progress, change orders, retention/guarantees, revenue recognition policy.
- Asset maintenance / maintenance orders where asset-heavy customers need it.

### P3 — Platform
- Role/permission matrix by company + module + action; professional role remains separate from privileged system role.
- Notifications/action center.
- Document attachments and immutable evidence links.
- API/webhook delivery service with secrets stored server-side and DNS-aware SSRF protection.
- Import/migration workbench with preview, validation, mapping, rollback and reconciliation.
- Observability, job queue, background processing and release/rollback controls.

## Next vertical slices
1. Finish/verify current accountant-first shell + Chart of Accounts slice.
2. Apply company-capacity server migration only after explicit approval; verify non-admin denial and rollback-only boundary tests.
3. Build Account Inquiry + drill-down + reconciliation foundations.
4. Build bank account/reconciliation vertical slice.
5. Build CRM MVP integrated with existing contacts/quotes/invoices, without duplicating customer master.
6. Design payroll security/data model before exposing any payroll menu.
7. Design holding consolidation model only after ordinary multi-company licensing is stable.
