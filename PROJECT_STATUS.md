# Project status — 2026-09-28

**Phase 3: IN PROGRESS / NOT ACCEPTED.**

The user's last handoff said Phase 3 was incomplete. A remote document said
COMPLETED at `8761d21189d9c4058c3019ea6e42d4103fc83556`. Independent behavioral
verification found real defects, so the completion claim was reopened.

- Current roadmap: [six phases](docs/SIX_PHASE_ROADMAP.md), not the older four-phase plan.
- Implemented recovery: client ledger/source/import/UI fixes with 55 behavioral tests.
- Preserved: original financial records, server configuration, main branch/release boundary.
- Not claimed: authenticated production E2E, database transaction/immutability
  enforcement, complete cheque accounting, controlled ledger restore or migration.
- Supabase target `hcsixhqbyuhpshfwqpjx` is reachable by its exact ID. The earlier
  unavailable claim was incorrect: project-list discovery omitted it, but direct
  metadata and SQL reads succeeded. The observed SQL role is read-only; see the
  [connection and server audit](docs/PHASE_3_CONNECTION_AUDIT.md).
- Live metadata confirms owner/license RLS, but not accounting-specific server
  invariants or a posting/reversal RPC. Phase 3 is still not accepted.
- Dependency review remains blocked by repository Dependency graph configuration;
  its gate has not been disabled.
- Recovery changes are prepared on `fix/phase3-behavioral-verification`; production
  acceptance is withheld. See the latest Git commit/PR for publication evidence.

Details: [Phase 3 verification](docs/PHASE_3_REDESIGN_VERIFICATION.md) and
[latest handoff](docs/handoff/LATEST_HANDOFF.md).
