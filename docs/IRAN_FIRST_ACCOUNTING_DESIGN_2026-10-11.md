# Finora Iran-first accounting architecture — design baseline
Date: 2026-10-11
Status: DESIGN DRAFT — not implemented or certified
Baseline: main 127fffc184d6bc36af3eda45d1fbb2737f7a37a4
Owner decision: Iranian accounting standards first, extensible to international frameworks.

## Sources and scope
Existing project sources: docs/ACCOUNTING_CORE_ROADMAP_V1.md, docs/IRAN_COMPLIANCE_MATRIX_V1.md, docs/CHART_OF_ACCOUNTS_RESEARCH_2026-10-03.md, docs/FINORA_UX_ACCOUNTING_BENCHMARK_V3.md, js/journal-engine.js and existing QA scripts. ERPNext/Frappe and Odoo are proposed external design comparators, not imported code or verified live integrations. Beancount/Ledger are proposed independent test oracles, not replacements for the ledger.

## Non-negotiable invariants
1. Every posted voucher balances in minor currency units and has at least two valid posting lines; no direct posting to parent/non-postable accounts.
2. Posted records are immutable: corrections use linked reversals or authorized adjustments, preserving source, user, time, reason, and rule version.
3. Every financial record is scoped by company/tenant and fiscal period; access is enforced server-side, not only in the UI.
4. Posting, inventory effects, receivable/payable effects, and idempotency keys must commit atomically or fail together.
5. Fiscal-period lock prevents retroactive postings except explicitly audited authorized workflows.
6. Tax and payroll rates, exemptions, document schemas, and effective dates are versioned and source-referenced; historical records retain the applied version.
7. Reconciliation differences are explicit, never silently auto-balanced.
8. AI can recommend classification and journal drafts but cannot post, delete, approve, or alter posted financial history autonomously.

## Domain design contracts
- AccountingContext: tenantId, companyId, fiscalYearId, accountingBasisVersion, currencyCode, locale, reportingStandard.
- ChartAccount: stable ID, parent ID, account type, normal balance, postingAllowed, activation window, company scope. Existing historical account IDs must remain stable.
- JournalVoucher: ID, sourceType, sourceId, date, fiscalPeriodId, status (draft/posted/reversed), reversalOf, postedAt, postedBy, ruleVersion, idempotencyKey.
- JournalLine: voucher ID, account ID, debitMinor, creditMinor, currencyCode, FX rate snapshot, dimensions, counterparty/project/contract links.
- PostingProfile: effective-dated rules mapping sale, purchase, receipt, payment, return, adjustment, inventory and payroll events to balanced entries.
- TaxRule: jurisdiction, tax category, effectiveFrom/To, source reference, calculation/rounding, reporting schema version.
- ReconciliationCase: account/source pair, unmatched items, variance, assigned reviewer, resolution evidence, approval history.

## International extensibility
Keep Iranian chart/accounting and tax reporting as the default profile. Do not hard-code IFRS or another standard into postings. Separate transaction recognition from financial statement presentation, localization packs, chart mapping, exchange-rate policies, and disclosures. International reporting requires a separately versioned policy and reconciliation bridge; a display-language switch is not IFRS compliance.

## Prioritized design and implementation gates
P0 — Validate real invoice save/reload/edit in an isolated environment; audit journal balance, reversals, company isolation, fiscal locks, atomic posting and idempotency. Create reproducible failing tests before changes.
P1 — Map actual modules to ERPNext/Odoo workflow concepts; specify purchase/sale/return/receipt/payment/stock/COGS and their journal effects; implement missing audited invariants with migration and rollback plans.
P2 — Add independently checked trial balance, subsidiary-ledger reconciliation, bank matching, period close and exception dashboard.
P3 — Add OCR and accounting copilot only on permission-filtered, traceable data with human approval and evaluation against curated Iranian accounting scenarios.

## Verification gates
- Unit/property tests: balanced postings, nonnegative monetary constraints, rounding, reversal equivalence, duplicate event idempotency.
- Integration tests: same-transaction invoice + journal + inventory; failure injection and rollback; tenant isolation and RLS.
- End-to-end: draft -> approve -> post -> print -> reload -> reverse -> trial balance; offline and concurrent edits.
- Domain acceptance: Iranian qualified accountant reviews standard-specific treatments and effective-date legal/tax rules before compliance claims.

## Explicitly unverified
This document is an architecture decision record, not a claim that the current runtime satisfies these invariants. ERPNext/Odoo/Beancount have not been installed or connected. No database schema, live financial data, deployment, or production code has been changed by this document.
