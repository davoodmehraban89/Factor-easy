# Finora — Production accounting cutover readiness

Date: 2026-09-30
Production project: `hcsixhqbyuhpshfwqpjx`
Mode: read-only evidence; **no historical invoice was posted or mutated**.

## Live snapshot
Two organizations currently contain invoice history.

### Organization `238af0f9-36dd-4655-915e-7054bd628ff5`
- 1 company record.
- 1 fiscal-year record.
- 0 account-master records.
- 1 formal invoice, total `388,500,000` in the stored currency unit.
- The invoice is scoped to company `COMP_1790278339547`.
- Company `organizationSector` is unset.

### Organization `c57b38ce-bc27-454f-a75c-e5c5439156c7`
- 4 company records.
- 1 fiscal-year record.
- 0 account-master records.
- Company `COMP_1789884425629`: 3 formal invoices totaling `2,652,260,000`, 1 non-formal invoice totaling `330,400,000`, and 1 pre-invoice totaling `1,770,000,000`.
- Company `COMP_1789888720411`: 1 pre-invoice totaling `1,800,000,000`.
- Company `organizationSector` is unset for the organization records inspected.

## Reconciled source population
Current production has 7 invoice records total:
- 4 formal invoices.
- 1 non-formal invoice.
- 2 `pre_invoice` records.
- Accounting-eligible historical source total (formal + non-formal): `3,371,160,000`.
- Pre-invoice total excluded from accounting posting: `3,570,000,000`.

This reconciles the monetary totals from the earlier Phase 6 manifest while correcting its descriptive split: the current live data is **4 formal + 1 non-formal**, not 5 formal.

## Why automatic posting remains prohibited
The organizations have fiscal-year records but no account masters. In addition, company sector/type is unset, so Finora cannot safely infer whether the owner intends the trading, service, manufacturing, or custom chart template. Auto-creating a chart and posting history would assign accounting meaning without owner review.

## Required cutover gate
For each company that has eligible historical invoices:
1. Owner selects/accepts the company type and chart template, or approves a custom chart.
2. Required system-role posting accounts are present and posting-enabled.
3. Full backup/export is taken.
4. `legacyCutoverPreview()` is reviewed; `pre_invoice` rows remain excluded.
5. Each eligible source is posted through the normal source-linked double-entry path only after explicit confirmation.
6. Reconcile source eligible total to generated vouchers and verify total debit = total credit.
7. Verify every posted source has exactly one active source voucher.
8. Corrections use reversal; posted history is never deleted or rewritten.

## Current disposition
The technical preview/posting path exists and production source population is now reconciled. P0 cutover is **not closed** because the owner-controlled accounting mapping decision is intentionally still missing. This is a real financial-safety gate, not an implementation omission to bypass automatically.
