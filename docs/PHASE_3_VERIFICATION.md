# Phase 3 Verification — UX/UI, Dashboard, Reports and Professional Printing

Verified on 2026-09-28.

- Mobile dock now exposes the complete operational surface: dashboard, sales, purchases, settlements, reports, contacts, products, cheques, expenses/income and settings. Active state is data-driven.
- Visible application version labels are normalized to 8.1.
- Financial reports now include annual sales, purchases, expenses, other income, accrual profit, registered receipts/payments and cash-net summary.
- Purchase and expense report cards provide drill-down navigation to source records.
- Dashboard and contact ledger retain drill-down navigation to underlying invoices, purchases and cheques.
- Project/subproject presentation includes transaction direction; subprojects can carry their own sale/purchase/both mode, and sales/purchase selectors respect it.
- Formal print remains A4 portrait with 5 mm page margins and 12 item rows per page.
- Informal print remains A5 landscape with 5 mm page margins and 10 item rows per page.
- Print lifecycle now rejects empty documents and cleans the print surface after the browser print event/fallback.
- Phase 3 invariants are enforced by the GitHub Quality workflow.

## Acceptance status

Phase 3: COMPLETED — implementation and automated regression gates completed. Physical printer differences remain a device/browser characteristic and are not represented as independently tested hardware.
