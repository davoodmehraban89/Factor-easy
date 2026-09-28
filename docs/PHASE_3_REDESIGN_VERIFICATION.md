# Finora — Phase 3 Verification

Date: 2026-09-28
Status: IN PROGRESS — reopened by behavioral verification; NOT production-accepted

## Recovery correction — 2026-09-28

The earlier COMPLETED claim was not supported by adequate behavioral coverage.
The former phase3-check script tested source-string presence, not actual journal
results. Fresh Node VM tests execute the real foundation, synchronization/import,
and journal modules. Separate UI boundary tests execute the actual form handlers.

Verified client repairs include reversal netting; Gregorian-to-Jalali conversion
and invalid-date rejection; duplicate/invalid posting rejection; company-safe
source locks; automatic posting profiles independent of visiting the journal UI;
atomic in-memory source correction and versioned reposting after reversal;
pro-forma exclusion; no cheque-to-cash misclassification; history-safe import;
dimension-rule mutation protection; and journal navigation/form reset.

Current test command:
`node --test scripts/phase3-engine.test.mjs scripts/phase3-ui.test.mjs`

This client patch has 55 passing behavioral tests. This is not production E2E
or proof of database transaction/security guarantees.

### Open acceptance blockers

1. The configured Supabase project `hcsixhqbyuhpshfwqpjx` is not listed by the
   current official connection. No substitute project was queried or changed.
2. `saveDatastore` schedules asynchronous sync; `jeAtomic` is only an in-memory
   rollback boundary. The generic 200-record upsert chunks are not a financial
   transaction. Posting, reversal, numbering, idempotency, fiscal/company checks,
   and immutable-history enforcement must be verified/enforced server-side.
3. Cheque registration remains an operational tracker. Accounting lifecycle for
   registration, clearance, bounce and cancellation is incomplete. Cheque-method
   settlement is rejected in configured accounting rather than recognized as cash.
4. Controlled ledger restore, legacy cutover/reconciliation, and authenticated
   device/browser E2E remain unverified. Import may not introduce/overwrite journal
   records; unchanged existing journal backup content is allowed as a no-op.

No production data or schema was changed during this recovery. The patch does
not represent completion of Phase 3 or permission to claim release acceptance.

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

## Historical production-persistence report (not reverified in this recovery)
Supabase project: hcsixhqbyuhpshfwqpjx

The prior report states that the records constraint was extended for:
- postingProfiles
- journalVouchers
- journalLines
- journalLineDimensions

The prior report states that no existing financial rows were rewritten/deleted and no Phase 3 journals existed then. These are historical claims, not current database evidence.

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
Interactive authenticated browser/device E2E is not claimed. Source checks and successful CI/deployment alone do not establish production release acceptance. See the open blockers above.


## Final operational integration

Final Phase 3 integration verifies automatic balanced posting for newly created sales, purchases, receipts, payments, expenses and other income when the accounting foundation is configured. Operational records linked to a posted voucher are protected from direct edit/delete until the accounting voucher is reversed. Accounts referenced by journal history are protected from destructive deletion, and account-dimension rules with ledger history are protected from destructive removal.

The trial balance includes both the reversed original and its posted opposite entry. Their balances cancel; excluding the original incorrectly leaves an opposite balance. Reversing a reversal is rejected until a complete reversal-chain workflow exists.

The current recovery did not reverify the production collections or journal counts because the configured project is unavailable to the connector.


## Historical CI/deployment evidence — 2026-09-28 (not acceptance)

Implementation head verified: `b0f3e2587c6cc04beaf579505cb975a939459d6e`.

Release gates on that head:
- Quality checks: success (run 36441164994)
- Pages build and deployment: success (run 36441163803)
- Security checks: success (run 36441164870)

The prior report claimed migration `20260928145306 allow_phase3_double_entry_collections`, RLS and advisor verification. Those database claims could not be independently reverified during recovery. RLS ownership alone would not prove balanced or immutable accounting.

Phase 3 remains OPEN. Historical cutover and reconciliation belong to Phase 6, but transaction integrity and the core treasury acceptance gaps must not be deferred merely to close Phase 3.
