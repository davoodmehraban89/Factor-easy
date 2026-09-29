# Phase 6 Cutover / Rollback Manifest — 2026-09-29

## Production reconciliation snapshot
Read-only production verification on Supabase project `hcsixhqbyuhpshfwqpjx` found:
- 7 legacy invoice records in total.
- 5 formal invoices, aggregate `3,371,160,000` in their stored currency unit.
- 2 pre-invoices, aggregate `3,570,000,000`; these are explicitly non-posting documents.
- 0 account-master records and 0 journal vouchers in production at the snapshot time.

Therefore **no historical accounting cutover was executed**. Posting the five formal historical invoices before each owner has an initialized/approved chart of accounts would create unreviewed accounting meaning. Phase 6 instead provides a controlled in-app cutover preview: only formal/non-formal source documents without an active journal are eligible; pre-invoices are excluded; posting requires valid accounting masters plus explicit confirmation and produces normal immutable source-linked vouchers.

## Rollback point
- Last fully accepted pre-Phase-6 repository evidence head: `e17a7f438b2478338bcf47498fabd47e56471f68`.
- Phase 6 introduces no production schema migration as of this manifest, so rollback of Phase 6 code does not require a database down-migration.
- Existing production migrations remain archived in `supabase/migrations/`.
- Full user-scoped JSON backup/export and validated merge restore are available from Phase 5.
- Posted accounting history must never be deleted for rollback; corrections use reversal.

## Cutover rule
For a production owner with legacy formal invoices:
1. initialize and review the company chart/fiscal year;
2. export a full backup;
3. review the Phase 6 legacy cutover preview;
4. post eligible historical invoices deliberately;
5. reconcile total debits = total credits and source-to-voucher links;
6. if accounting meaning is wrong, reverse the generated voucher rather than editing posted history.

This manifest is evidence of a **controlled, non-destructive cutover decision**, not a claim that legacy production invoices were silently posted.
