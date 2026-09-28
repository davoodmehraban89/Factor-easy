# Finora / Factor Easy — Historical Four-Phase Completion Plan

Superseded for current execution by [SIX_PHASE_ROADMAP.md](SIX_PHASE_ROADMAP.md).
The phase numbers below describe the earlier Finora 1.0 work, not the current
six-phase redesign. In particular, this document's UX Phase 3 is not the
current double-entry/treasury Phase 3. Retained for traceability only.

## Phase 1 — Foundation, correctness, and data integrity (historical)
Owner: Architecture & implementation. Review: QA + security.
Exit criteria:
- Cloud collections, backup, sync, authentication and license boundaries are internally consistent.
- Sales, purchases, cheques, balances and deletion rules cannot silently corrupt financial history.
- Static quality gates cover critical finance and script-loading invariants.
- Security workflow is present and production Supabase policies/RPC boundaries are reviewed.
- No known duplicate runtime definitions or malformed script-loader separators remain.

## Phase 2 — Complete financial operations
Owner: Product + implementation. Review: accounting/data.
Scope:
- First-class receipts/payments with allocation to sales and purchase invoices.
- Partial settlement and invoice-level outstanding balances.
- Company/contact/project/subproject attribution for cashflow and expenses.
- Project profitability, payable/receivable ledgers, cheque lifecycle integration.
Exit criteria: every financial balance is traceable to source documents and settlement records.

## Phase 3 — UX, reporting, documents, and print
Owner: UX/design + implementation. Review: QA.
Scope:
- Unified create/edit/delete patterns and safe archive behavior.
- Polished project/subproject management without prompt-based controls.
- Drill-down dashboards and reports backed by the accounting ledger.
- Formal A4, non-formal A5, purchase and statement print templates; responsive/mobile cleanup.
Exit criteria: core workflows are consistent, drillable, printable and usable on desktop/mobile.

## Phase 4 — Release hardening and production handoff
Owner: Delivery/operations. Review: security + QA.
Scope:
- Regression suite, runtime smoke checks, security scan review, performance/error-log review.
- Production data compatibility/migration checks and rollback notes.
- Versioning, deployment verification, operator documentation and final release checklist.
Exit criteria: release candidate passes available automated checks and verified production smoke tests; remaining external/manual checks are explicitly recorded.

## Execution rule
Work proceeds in dependency order. A phase closes only after its exit criteria are verified; unresolved blockers are carried explicitly rather than marked complete.
