# Phase 4 Redesign Verification — Projects & Contracting

Date: 2026-09-29

## Scope delivered
- First-class contracts linked to global projects and counterparties.
- Employer, contractor and subcontractor relationships.
- Controlled contract lifecycle and approved amendments.
- Configurable deduction schedules: retention, insurance, withholding tax, advance recovery, penalties and other.
- Guarantees with issuer, amount, expiry, extension and release event history.
- Contractor statements with calculated deductions/net amount.
- Double-entry posting for approved contractor statements with project/counterparty dimensions.
- Reversal through the Phase 3 immutable voucher reversal mechanism.
- Contract/project profitability view from posted statements, project purchases and expenses.
- Audit trail for Phase 4 lifecycle events.
- Cloud sync and JSON backup/restore collections.
- Referential guards for contacts/projects used by contracts.

## Accounting contract
A contract or operational statement is a source document, not accounting truth. A statement becomes accounting truth only after posting a balanced journal voucher. Posted vouchers remain immutable and corrections use reversal. Source IDs and source versions flow into the journal engine. Phase 3 fiscal locks, dimension validation and duplicate source/version protection remain mandatory.

Default contractor-statement posting for the current company-as-contractor workflow:
- Debit accounts receivable (1102) for net receivable.
- Debit retention receivable (1105) for deductions when present.
- Credit contract revenue (4301), falling back to standard revenue when 4301 is unavailable.
The contracting template provides deduction-specific accounts: 1105 retention receivable, 1106 insurance withholding receivable, 1107 withholding-tax receivable, 2105 advance/prepayment liability recovery and 6109 penalties/other non-recoverable deductions, plus 4301 contract revenue. Existing Finora contracting templates are non-destructively version-migrated to add missing Phase 4 deduction accounts.

## Persistence
Supabase migration: `phase4_contracting_collections`.
Collections: contracts, contractAmendments, contractParties, contractDeductions, guarantees, guaranteeEvents, contractStatements, phase4Audit.

## Acceptance gates
- Syntax/quality checks.
- Phase 4 behavioral reconciliation test.
- Security/CodeQL.
- Pages deployment.
- Supabase security/performance advisors after migration.
- Repository state updated with exact final evidence.

## Known product boundary
Guarantee memorandum/off-balance journal posting remains optional by roadmap wording; guarantee lifecycle and audit are implemented, while no mandatory accounting entry is generated merely by issuing a guarantee.
