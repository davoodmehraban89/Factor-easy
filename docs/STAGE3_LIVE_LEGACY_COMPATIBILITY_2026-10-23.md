# Finora — Stage 3 historical source compatibility gate

**Checkpoint:** 2026-10-23. Branch `audit/finora-stage3-legacy-source-readonly-20261023`, parent `b1d290f1ce4d80c2ffaf84508062999bd2edfcfd`. **READ-ONLY Production aggregate query** through connected Supabase project explicitly named **Finora ERP – Production**, project ref ending `...pjx`. No source records, names, account balances, identifiers, authentication tokens or customer-level rows copied into GitHub.

## Verified aggregate counts (as of this SELECT)

| SQL-v1 candidate population | Count |
|---|---:|
| Invoices of kind `formal` or `non_formal` | **15** |
| Eligible purchase records | **0** |
| Candidate invoices without explicit `vatMode` | **15 / 15** |
| Without explicit `currencyCode` | **15 / 15** |
| Without `accountingVersion` | **9 / 15** |
| Source marked posted | **6 / 15** |
| Missing discount type/input | **0 / 15** |
| Missing VAT type/rate | **0 / 15** |
| Payment method absent or unsupported | **0 / 15** |
| Items field absent or not an array | **0 / 15** |

The previous read-only check also confirmed Production still lacks the Stage1 `finora_sync_records_v2` RPC; successful local CI is **not** evidence that the current Production supports the new posting path.

These counts are **not** a personal-data migration, journal-level reconciliation, proof of original VAT legality, or permission to rewrite posted financial history. They are aggregate metadata only. The six source-marked posted rows have **not** been altered or declared invalid posted journals.

## Executable compatibility gate

`scripts/stage3-legacy-source-audit.mjs` accepts a **locally supplied JSON array** of `{collection,data}` objects and only returns **aggregated counts and generic reason codes**. It makes no network calls, reads no database by itself, logs no IDs/amounts/names, never modifies objects or writes files, and never assumes:

- VAT mode from an amount of zero (including non-formal invoices).
- IRR as historical currency just because the old SQL uses `coalesce(...,'IRR')`.
- A missing `accountingVersion` is proof of version 1.
- A source-marked posted record can be edited, reposted, or backfilled without verified compensating audit.

The gate distinguishes `eligible`, `reconciliationRequired`, `unsupported`, `contractMismatch` and `outOfScope` and counts source-marked posted records with gaps separately. It conservatively supports **integer-rial** and **integer quantity** contracts only; it is not the final fiscal/tax policy.

Run against **synthetic inputs only** in CI:
```bash
node scripts/stage3-legacy-source-audit.test.mjs
```

Do **not** export live financial data to GitHub Actions, repository files, a public artifact, ChatGPT, or unencrypted cloud storage. Secure per-record owner-approved reconciliation requires a separately authorized, scoped private environment and a recoverable backup before any historic write.

## Required next gates (NOT accepted)

1. Authorize exact company fiscal/account-role mapping and explicit currency/VAT reconstruction policy; **no automatic assumptions**.
2. Preserve posted vouchers, reversals, audit and tenant permissions; design correction/compensating entries instead of in-place history rewriting.
3. Plan encrypted Production backup, verified independent restore and execution rollback; no currently authorized Production DDL/DML.
4. Execute controlled per-record compatibility checking, owner review and actual hosted browser/ISP finance flows in a truly free isolated target where available.
5. Reassess real client `finora_journal_autopost` wiring only after the source contract and owner role snapshot are approved and Stage1 SQL is applied through a separately authorized release.
6. Keep PRs **DRAFT / DO NOT MERGE / DO NOT DEPLOY**; Stage3 and Finora overall remain open.
