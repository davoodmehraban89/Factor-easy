# Phase 3 connection and server audit

Verified: 2026-09-28, approximately 16:48 UTC. This is a read-only audit, not a
production migration, authenticated application test or completed Phase 3 release.

## Canonical targets and actual access

| Component | Verified target | Result |
| --- | --- | --- |
| GitHub | `davoodmehraban89/Factor-easy` | Authenticated account matches owner; draft PR #6 remains open |
| Main branch | `8761d21189d9c4058c3019ea6e42d4103fc83556` | Not changed by this recovery |
| Recovery branch | `fix/phase3-behavioral-verification` | Published client patch at `8209c6f13eb6389260c8528744e5e282d1dd90f3` |
| Supabase | `hcsixhqbyuhpshfwqpjx` | Direct project lookup: Finora, ACTIVE_HEALTHY; metadata and SQL reads succeed |
| Supabase SQL session | `supabase_read_only_user` | `transaction_read_only=on`; CREATE on public is false |

Both required plugins are installed and working for these verified operations.
The project and organization lists omit the target, while exact-ID lookup works.
The cause is unknown; absence from the list must not be treated as proof of denied
access. No new OAuth connection, write access or permission change is claimed.
Historical context identifies GitHub Pages for Factor-easy; Cloudflare deployment
details from Finora-Invoice belong to a different project.

## Reproducible server findings

Run `scripts/sql/phase3-server-audit.sql` against the exact project. It selects
system metadata only and was executed successfully through the official connector.
No customer financial rows, profile identities, tokens or keys are included.

- `public.records` has RLS enabled. SELECT requires owner identity; INSERT,
  UPDATE and DELETE require owner identity plus an active license. UPDATE includes
  both USING and WITH CHECK. These are access checks, not accounting checks.
- The Phase 3 collections are allowed by `records_collection_check`; migration
  `20260928145306 allow_phase3_double_entry_collections` exists among 12 migrations.
- Other records constraints restrict ID format and JSON size and enforce the owner
  FK and `(owner_id, collection, id)` primary key. No voucher balance, fiscal/company,
  account/dimension, posted-history, source revision or voucher-number constraint
  was found in this table's inspected metadata.
- The only records index is `records_pkey`. The only user trigger is
  `records_touch`, calling a function that updates `updated_at`.
- All seven public functions were inspected: three admin license RPCs, the new-user
  trigger helper, two owner-role/license helpers and the timestamp helper. None is
  an accounting posting or reversal transaction RPC.
- Both anon and authenticated have table-level DML privileges. RLS still applies;
  the inspected policies target authenticated only. These grants alone do NOT mean
  anonymous data access, and no anonymous/authenticated exploit was executed.

Conclusion: the inspected records write boundary does not enforce the client
ledger invariants. Combined with separate client sync chunks, this is a release
gap requiring a transactional server API and protected direct-write path.

## Advisor warnings, not confirmed exploits

Security advisors report five authenticated-callable SECURITY DEFINER functions.
The admin RPC bodies do check `is_admin()`, so the warning alone is not proof of
privilege escalation. The role/license helpers support current RLS and must not
be blindly revoked. Review the [advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
with actual function grants and authenticated tests before changing them.

Advisors also report [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Auth settings were not changed in this audit.

## GitHub CI evidence and remaining administration task

On the client patch commit `8209c6f`:

- [Quality checks succeeded](https://github.com/davoodmehraban89/Factor-easy/actions/runs/36452460077).
- [CodeQL JavaScript succeeded](https://github.com/davoodmehraban89/Factor-easy/actions/runs/36452459920/job/109030340507).
- [Dependency review failed](https://github.com/davoodmehraban89/Factor-easy/actions/runs/36452459920/job/109030340206): Dependency review is not supported under the repository's current configuration; the log asks for Dependency graph to be enabled.

The connected GitHub interface does not expose repository administration writes.
The [security analysis setting](https://github.com/davoodmehraban89/Factor-easy/settings/security_analysis)
was not changed, and the failing gate was not suppressed. These historical results
are tied to that exact SHA; subsequent commits must have their own CI checked.

## Next safe implementation boundary

1. Use a verified writable development environment for schema/API implementation;
   preserve the observed read-only production diagnostic connection.
2. Test atomic source/voucher/line/dimension posting, reversal, immutable history,
   owner/company and fiscal locks, numbering/source concurrency and idempotency.
3. Integrate durable server acknowledgments into the client and prevent the generic
   records-sync path from bypassing ledger rules. Test rollback and interrupted sync.
4. Complete cheque lifecycle and authenticated browser/device acceptance.
5. Resolve repository security configuration and verify all gates before rollout.

The user has authorized normal commits and pushes. No repeated approval for those
is needed. This does not turn a read-only SQL role into a writer, authorize paid
resources without cost confirmation, or justify mutating production to probe access.
