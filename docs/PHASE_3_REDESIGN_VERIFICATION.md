# Finora — Phase 3 Verification

Date: 2026-09-28
Status: COMPLETED — final operational integration verified

## Scope
Phase 3 introduces the first operational double-entry ledger on top of the Phase 2 accounting foundation.

Implemented:
- journal voucher and journal line collections
- normalized journal-line dimension assignments
- draft -> posted -> reversed lifecycle
- balanced debit/credit validation before creation and again before posting
- posting-account validation
- account/dimension required/optional/unavailable validation
- leaf/postable analytic-dimension validation
- fiscal-year resolution and lock enforcement
- sequential voucher numbering per fiscal year
- source event/version uniqueness guard
- immutable posted vouchers; destructive delete is draft-only
- reversal by a new opposite posted voucher
- manual journal-entry UI with dynamic dimension selectors
- journal register and trial balance
- default posting profiles for sale, purchase, receipt, payment, expense and other income
- cash/credit aware sale and purchase posting
- sales VAT payable split when tax exists
- purchase VAT split when a recoverable-VAT account exists; otherwise gross purchase remains balanced
- legacy source posting adapter with source-to-voucher reference
- cloud sync, backup/import persistence for all Phase 3 ledger collections
- accounting navigation integrated into the Phase 1 shell

## Ledger invariants
1. A voucher cannot post unless total debit equals total credit and is positive.
2. A journal line cannot contain both debit and credit and cannot be zero-sided.
3. Only active posting accounts are accepted.
4. Required analytic dimensions must be supplied and valid terminal/postable values.
5. Dimensions marked unavailable cannot be posted.
6. A posted voucher cannot be destructively edited or deleted.
7. Corrections to posted vouchers use reversal.
8. A source event/version cannot have two active posted vouchers.
9. A locked fiscal year rejects new posting.
10. Trial balance is derived only from posted/reversed ledger history, never from draft lines.

## Production persistence
Supabase project: hcsixhqbyuhpshfwqpjx

The records collection constraint was extended by migration:
- postingProfiles
- journalVouchers
- journalLines
- journalLineDimensions

Existing production financial rows were not rewritten or deleted. At migration verification, production contained the existing companies, contacts, invoices, products and settings and no Phase 3 journal records yet.

## Compatibility
Existing Finora source documents remain operational. Phase 3 does not bulk-post historical documents automatically because that would create accounting history without an explicit reconciliation/cutover. The adapter can post source records under the configured chart; controlled historical reconciliation remains a later release/cutover responsibility.

## Automated gates
- JavaScript syntax check
- repository application invariants
- Phase 2 accounting-foundation invariants
- Phase 3 double-entry invariants
- CodeQL security workflow
- GitHub Pages deployment

## Boundary
Interactive authenticated browser/device E2E is not available in the current execution environment and is not claimed. Production release acceptance is based on source verification, CI gates, Supabase schema verification/advisors and deployment status.


## Final operational integration

Final Phase 3 integration verifies automatic balanced posting for newly created sales, purchases, receipts, payments, expenses and other income when the accounting foundation is configured. Operational records linked to a posted voucher are protected from direct edit/delete until the accounting voucher is reversed. Accounts referenced by journal history are protected from destructive deletion, and account-dimension rules with ledger history are protected from destructive removal.

The trial balance uses active posted movements. A reversed original is excluded while its posted reversal supplies the opposite movement, avoiding double counting.

Production verification confirmed that the Phase 3 collections are allowed by the records constraint and there were no pre-existing production journal records requiring conversion during this final integration.


## Final release evidence — 2026-09-28

Implementation head verified: `b0f3e2587c6cc04beaf579505cb975a939459d6e`.

Release gates on that head:
- Quality checks: success (run 36441164994)
- Pages build and deployment: success (run 36441163803)
- Security checks: success (run 36441164870)

Production verification confirms migration `20260928145306 allow_phase3_double_entry_collections` is applied, RLS remains enabled on `public.records`, and the records constraint accepts all four Phase 3 ledger collections. Production currently has no Phase 3 ledger rows, so this verification did not rewrite or backfill historical accounting data. Performance advisor returned no findings.

Phase 3 is closed for the implemented scope. Historical cutover and reconciliation remain intentionally assigned to the later migration/release phase.


## Hardening pass — 2026-09-29

Phase 3 was reopened after an independent accounting review found defects not exercised by the earlier static gates. The implementation now corrects canonical Jalali receipt/payment dates, prevents pre-invoices and contract statements from recognizing sales automatically, preserves reversed originals in ledger history so reversal vouchers reconcile to zero, extends duplicate source/version protection across reversed history, routes datastore diffs through one transactional Supabase RPC, and adds server-side immutability/uniqueness controls.

Production migration applied: `phase3_hardening_atomic_sync_and_ledger_guards`.

A behavioral engine gate now executes receipt posting, debit/credit balance, Jalali fiscal-year resolution, duplicate source rejection, reversal reconciliation, and fiscal lock rejection. Acceptance evidence: Quality run 36543480690 success; Security run 36543480544 success; Pages deployment run 36543480478 success. Production migration `20260929083130 phase3_hardening_atomic_sync_and_ledger_guards` is applied. The transactional sync RPC is SECURITY INVOKER with anonymous execution revoked and authenticated execution granted. Ledger voucher-number and source/version unique indexes are present. Supabase performance advisor returned no findings. Phase 3 hardening is accepted.
