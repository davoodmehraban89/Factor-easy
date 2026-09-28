# Phase 1–2 Verification Evidence

Verified on 2026-09-28 against production repository and Supabase project.

## Phase 1 — Core, Financial Accuracy, Security and Data Integrity

- Cloud collections include purchases and first-class payments/settlements.
- Sales/purchase/contact/company/project deletion guards preserve referenced financial history.
- Sales receivables and purchase payables use allocated settlements without double-counting cheque lifecycle records.
- Runtime self-check covers sales, purchases, settlements, contacts, companies and product references.
- Production data integrity query reports zero invoice contact/company reference issues using the application's payload IDs.
- Supabase performance advisor reports no findings.
- Supabase security advisor has no critical finding. SECURITY DEFINER license helpers/admin RPCs have fixed search paths, internal authorization, and anonymous/public EXECUTE revoked. The remaining platform warning is leaked-password protection disabled.
- GitHub Quality workflow is required as executable regression evidence; Security workflow runs CodeQL on main.

## Phase 2 — Financial Operations and Accounting Completion

- Purchase invoices support supplier, project/cost center, cash/credit settlement and active-company scoping.
- Receipt/payment ledger supports inbound/outbound, partial invoice allocation, over-allocation prevention, edit/delete and cloud backup/sync.
- Settlement allocation validates contact, direction, invoice type and cash/credit semantics.
- Expenses/income support contact, project/cost-center and company attribution.
- Derived inventory computes opening + purchases - sales without mutable stock side effects.
- Project financial engine exposes sales, purchases, expenses, income, receipts, payments, accrual profit and cash net, scoped to the active company.
- Projects and companies cannot be deleted while referenced by financial documents or settlements.

## Verification boundary

Static JavaScript syntax and application invariants are executed by GitHub Actions on every main push. CodeQL is executed by the Security workflow. Interactive browser/physical printer behavior is outside Phase 1–2 acceptance and belongs to Phase 3–4 QA.
