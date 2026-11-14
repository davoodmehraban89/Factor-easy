# Draft-first accounting and existing-document conversion

Owner instruction: every financial event first produces a temporary journal; explicit finalization is separate. On 2026-11-13 the owner additionally requested all existing documents across all users/companies become temporary and explicitly waived the external backup prerequisite. Do not request the database secret again for this operation. No backup or restore is claimed.

## Accounting contract

- Document type, journal status and approval state are independent. Source types include sale, purchase, receipt/payment, incoming/outgoing cheque, manual, opening and closing. Approval does not itself post a journal.
- Draft reporting is a projected ledger: visible posted-only, draft-only and draft+posted filters; print/export must carry the selected scope. Preserve original-plus-compensator accounting in posted history. Right-click actions supplement visible keyboard-accessible actions.
- One permanent reference reservation per logical document, never reassigned, including after deletion. Keep a minimal reservation/audit tombstone when deleting a draft; hide the deleted document from ordinary lists. Do not repurpose the existing external `reference` field.
- New temporary/final numbers use separate company/fiscal-year sequences, e.g. `1405-T-00001` and `1405-P-00001`; permanent reference is company-monotonic across years. Allocate on the server under concurrency control; no browser max+1. Preserve legacy numbers as historical identifiers. A correction retains the logical reference, while a copied independent document receives a new one.
- Source, draft journal, lines/dimensions and links must be saved atomically. Finalization validates the current version, rights, period, accounts, dimensions and balance, then allocates the final number. No implicit finalization on ordinary Save.
- Cheque issuance: draft Dr payable / Cr notes payable; clearance: a separate draft Dr notes payable / Cr bank. Draft-inclusive reports show the projected reduction in supplier debt. One instrument and its linked settlement count once. Incoming cheques have a separate symmetric contract.

## Existing documents

Never reset every `posted`/`reversed` status independently. Build complete same-owner, organization and company reversal chains. Validate links in both directions and equal/opposite postings at account and analytical-dimension level. A fully cancelled chain needs no replacement business event. A reversal of a reversal can have a net effective event and cannot be discarded just because its original is labelled reversed.

For an effective event, the intended conversion is a compensating journal plus an editable, linked replacement draft, retaining original history. Do not invent missing source relationships, choose between disagreeing companies, strip electronic-document metadata or regenerate an old journal using today's account defaults. Classify legacy sources without journals and registered cheques separately from posted journals.

The converter must operate in one transaction using an expected graph fingerprint, lock/recheck dependencies and periods, preserve dimensions, reject partial/inconsistent graphs, and be idempotent. Test commit/rollback and stale-client synchronization before activation. Existing frontend source finalizers do not support attached draft journals consistently; conversion must not create drafts users cannot finalize. The backup waiver does not remove these functional requirements.

## Official product evidence (read 2026-11-13)

| Source | Verified documented behavior | Design use |
| --- | --- | --- |
| [Odoo 19 reporting](https://www.odoo.com/documentation/19.0/applications/finance/accounting/reporting.html) | Reports can select posted/draft entries; default is posted entries | Explicit report scope, no silent mixed totals |
| [Odoo invoice sequence](https://www.odoo.com/documentation/19.0/applications/finance/accounting/customer_invoices/sequence.html) | Confirmation generates a unique year-based invoice number; sequence controls exist | Separate allocation from draft creation; do not adopt resequencing of the owner's permanent reference |
| [Business Central number series](https://learn.microsoft.com/en-us/dynamics365/business-central/ui-create-number-series) | Entity/document number series and dated series lines | Company/year-specific transactional counters |
| [Business Central approval](https://learn.microsoft.com/en-us/dynamics365/business-central/across-how-use-approval-workflows) | Request, approve/reject/delegate, pending and released states | Approval state distinct from ledger posting |
| [Payvast accounting](https://payvast.com/financial/accounting/) | Draft, temporary, approval/signature and final stages; integrated subsystem journals | Staged review workflow; this cited product page describes Windows/SQL Server, not a verified web product |

These are vendor documentation observations, not hands-on comparative acceptance or a claim of regulatory compliance. No production conversion, draft-first source adapter or numbering cutover has been completed by this specification.
