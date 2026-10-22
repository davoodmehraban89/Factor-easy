# Finora Stage 3 — UI/source vs SQL-v1 posting contract (in progress)

Date: 2026-10-23. Work branch `feature/finora-stage3-commercial-payload-20261023` (temporary implementation branch `work/finora-stage3-payload-green-20261023`). Parent Stage 2 feature SHA `3c4efef047da58f150b8e39fa066f79b7d5b54e8`.

**Scope:** forward-only preparation for new sale/purchase source payloads, verified through an actual Playwright form path on synthetic data. No historical backfill, no Production DDL/DML, no web deployment, no cutover, no financial role-setting change. The test-first CI run is evidence only after checked by actual job/log.

## Current fixed server contract

Source: `supabase/migrations/20261016103000_phase1a_sale_monetary_contract.sql` and `20261016103500_phase1a_purchase_fixed_contract.sql`. Server accepts sale/purchase only, rejects other source kinds. It requires nonempty items; positive integral quantity; integer-valued `price`, `lineTotal`, `subtotal`, `discount`, `discountInput`, `vat`, `vatRate`, `grandTotal`; `qty*price=lineTotal`; totals exact. Allowed discount types `fixed` and `percent`, VAT `none` or `with_vat` with a valid VAT type. Payment method `cash` or `credit`; currency `IRR` only. Owner-approved versioned account-role mapping is checked during post, not client-chosen accounts.

## Forward-only UI source metadata patch

| UI | Existing gap | Stage 3 patch |
|---|---|---|
| New invoice draft | `vatMode`, explicit `currencyCode`, `accountingVersion` absent from saved source | Save explicit VAT mode, `IRR` for rial setting, non-IRR rejection sentinel, version 1 for new source |
| Invoice amendment | New correction inherits old record but edits used VAT amount to infer mode | Preserve explicit VAT mode and preserve `vatRate=0` rather than defaulting to 10 |
| New purchase | Discount/VAT type/input and rate absent from saved record; server cannot reconstruct tax from aggregate VAT | Persist `discountType=fixed`, actual `discountInput`, `vatType=percent`, `vatMode`, actual `vatRate`, `currencyCode`, new-source version 1 |
| Purchase draft edit | UI inferred `with_vat` solely from nonzero VAT and ignored stored rate | Reload explicit mode and exact rate when available; never modify posted originals |

**Invariant:** Sale/purchase amounts and journal behavior are **not** recalculated, converted or reposted by this metadata change. Existing documents are not modified in place.

## Release/acceptance blockers

1. The last read-only Production snapshot found 15/15 invoice records missing `vatMode`. This is historical evidence, not a current assertion about records. **No bulk repair, inferential VAT conversion or retroactive historical posting is permitted.**
2. `currency_mode` values beyond `rial` have no owner-approved integer-rial conversion. New source records explicitly mark non-rial as unsupported; any future server-side post MUST deny non-IRR. The legacy client posting path is not yet a safely migrated source event path.
3. Fractional quantities, line rounding, other payment methods, VAT adjustment, inventory valuation/COGS and source-account mappings require separately approved deterministic rules; until then server v1 correctly rejects unsupported forms.
4. The 1A/2.2 SQL needed for `finora_sync_records_v2` is **not** on Production. Staging-only green tests do not authorize merge to `main`. PR #162 remains Draft.
5. Stage 2.2 acceptance by owner, real hosted client staging, actual owner ISP validation, Production encrypted backup+restore and GitHub Dependency Graph remain open. Zero-paid-resource restriction applies.

## Mandatory evidence before marking this scoped patch verified

- Test-first RED on a pinned SHA in `scripts/accounting-document-workflow.spec.js` for the real new sale and purchase form paths (not a static regex).
- GREEN on the source patch SHA, entire Quality suite plus DB jobs, Security CodeQL/release safety and strict isolated Supabase real-stack regression.
- Do not claim Phase 3 complete from a patch to source payload fields alone.
