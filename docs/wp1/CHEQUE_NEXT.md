# Cheque issuance — source-backed next contract

Status 2026-11-13: owner now requires draft-first for every financial operation; this supersedes automatic-final issuance. Diagnosis complete; **no implemented/activated server cheque adapter**. Payment formatting PR198 is released. Contact operational summary PR199 is separate. No production financial writes or historical backfill have occurred.

## Confirmed runtime gaps

- `operations.js` overrides `commitSaveCheque`; it saves only the cheque record. Patching the earlier `cheques.js` handler alone cannot fix runtime posting.
- `journal-engine.js` uses the generic payment profile (AP/cash) for `method=cheque`. Issuance must use AP/notes-payable; bank movement belongs to clearance.
- `drilldown.js` previously summed outstanding invoices without unallocated settlements and mixed companies. PR199 fixes that operational display, not missing journals or a complete general ledger.
- The staged journal source allowlist has no cheque source. Adding an allowlist value alone does not derive financial amounts/accounts or ensure atomic source linkage.
- Current staged `write_lines`/`validate_saved` require separate `dimensionValues`; the browser's contact dimension refers directly to `contacts`. Caller-supplied `counterpartyId` is discarded by SQL line creation. Passing an empty dimension list would lose supplier analysis, so it is not an acceptable shortcut.

## Implementation order

1. Prove and implement the entity-dimension contract using the existing `dimensionTypes.sourceEntity`: company-scoped types/rules and organization-visible contact entities, with server permission checks, required/optional/unavailable rules, active/leaf semantics and derived counterparty/project identifiers. Original reversal tags must remain usable if a master record is later disabled. Do not copy or regenerate historical master data to bypass the contract.
2. A dedicated atomic issuance RPC owns new outgoing-cheque + linked settlement + draft voucher, with explicit authorized finalization as a separate operation. Stable request ID/fingerprint and instrument identity prevent duplicate/replayed issuance. Server selects one valid payable-control account and notes-payable account (`2111`, not `2103`); ambiguity or missing accounts fails without partial rows. No caller-supplied debit/credit lines. Validate company/contact/open fiscal date, positive safe integer IRR, permissions, expected record version for explicit reconciliation and instrument state. Due date is not issuance date.
3. Issuance draft: Dr trade payable / Cr notes payable. Clearing draft: Dr notes payable / Cr bank. Draft-inclusive reports project these effects; posted-only reports include them only after explicit finalization. Bounce/cancellation requires a distinct compensating event; no in-place posted edits/deletions. Model lifecycle transition legality explicitly. Incoming cheques need their own symmetric contract; don't pretend they are covered by outgoing acceptance.
4. Both UI entry points share the same instrument and settlement. A cheque-method payment selects/registers an instrument through this contract; it cannot independently credit cash. One register row plus one payment row is one event, not two settlements. Pending/uncertain outcomes retain stable intent and user edits; no blind retry/new ID and no success before server acknowledgement. Publish source+settlement+full graph atomically into the hydrated client snapshot without overwriting unrelated dirty records.
5. Historical reconciliation is explicit and read-only first. Identify exact organization/company/contact, sources, vouchers and payments by stable identifiers. Amount/name/reference matches are review candidates only. Existing unlinked cheques are not automatically posted; independent prior payments must be reconciled before producing a concrete repair batch. Preserve old rows and retain compensating history.

## Acceptance and release

Meaningful RED→GREEN for issuance/balance/bank unchanged, replay vs changed payload, concurrent duplicate instrument, cancellation/clearance/bounce, invalid scope/period/amount/accounts/dimensions, revoked/read-only users, uncertain write and company switch. Require rollback with retained history, source-derived SQL + real nonproduction JWT/PostgREST + full UI/Pages regression and independent financial SQL review. The owner explicitly waived the external backup prerequisite for the global return-to-draft operation. Do not repeat the connection request. Transactional/source compatibility and controlled activation still need proof; current work does not satisfy those functional requirements.

After this urgent source contract, resume MANUAL_RPC_NEXT steps3–4 and the remaining WP1 source coverage/rollout work. Earlier successful WP1 CI does not prove these new workflows.

## Global conversion checkpoint

The owner authorized all users/companies and confirmed the original source company for one historic source/journal mismatch. Read-only preflight and draft-first specification are on `hardening/global-draft-conversion-20261113`;25graph tests and1isolatedPG17test pass. No financial conversion has executed. Original reversal history must remain; new source-linked drafts must be usable by the existing finalization UI before activation. The branch includes the exact remaining implementation plan and current execution status.
