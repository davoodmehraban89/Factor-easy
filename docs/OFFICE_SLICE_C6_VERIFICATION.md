# Office Slice C6 — SLA Reminder / Escalation Verification

Date: 2026-10-01
Project: `hcsixhqbyuhpshfwqpjx`

## Delivered
- Server-derived SLA queue for pending Office referrals and internal approval requests.
- Overdue state and overdue hours are calculated server-side from immutable work evidence.
- Internal `sla_reminder` and `sla_escalated` events are append-only Office audit evidence.
- Event target/requester/correspondence/due time are derived from the original work item; clients cannot substitute them.
- Reminder policy window is server-derived per UTC day; escalation is a one-time `overdue-24h` policy window.
- Advisory locking plus evidence lookup rejects duplicate events in the same policy window.
- Escalation requires at least 24 hours overdue.
- Only organization owner, original requester, or Office `configure` authority can emit SLA events.
- Assigned targets can see authorized queue rows but cannot impersonate the requester/admin to emit SLA events.
- Completed referrals, decided approvals and stale content-bound approvals reject new SLA events.
- UI exposes «SLA و یادآوری», overdue hours, last reminder, escalation state and authorized actions.
- C6 performs **no external delivery**. Email/SMS/webhook adapters remain outside verified scope.

## Production migration
- `20260930204536 office_slice_c6_sla_reminder_escalation`
- Exact production SQL is archived at `supabase/migrations/20260930204536_office_slice_c6_sla_reminder_escalation.sql`.

A continuity drift found before C6 was also repaired: live migration `20260930203839 office_c5_content_digest_hardening` existed in Production but was missing from Git. Its exact SQL was recovered from `supabase_migrations.schema_migrations.statements` and archived as `supabase/migrations/20260930203839_office_c5_content_digest_hardening.sql`.

## Production adversarial verification
Transactional verification used existing legitimate principals and rolled back all temporary state.

PASS:
1. Owner/requester sees overdue referral and approval SLA rows.
2. Daily reminder evidence is created once and duplicate same-window reminder is rejected.
3. Referral overdue by 48h can be escalated; duplicate escalation is rejected.
4. Approval overdue by only 2h cannot be escalated.
5. Assigned target can see its authorized work but `can_emit=false` and cannot emit SLA evidence.
6. Completed referral rejects later SLA events.
7. Approved request rejects later SLA events.
8. Stale approval whose content changed after request is exposed as `stale`, is not treated as overdue, and cannot receive SLA reminder evidence.
9. Cross-tenant principal receives no SLA queue rows.
10. Rollback residue is zero; temporary member is absent and temporary seat expansion returned to `max_users=1`.

## Function security
- Public API functions `office_emit_sla_event` and `office_sla_work_queue` are SECURITY INVOKER.
- Privileged implementations live in `private`, use `search_path=''`, and are not executable by `anon`.
- C6 did not increase the public authenticated SECURITY DEFINER advisor warning count.

## CI evidence
Verified runtime head: `ba06af2bcaf5b63e37f5421fb49c4246d85ba762`.
- Quality `36775081078`: PASS, including JavaScript syntax, accounting/Golden/ELI/C1-C6 invariants and Real-DOM.
- Security `36775081089`: CodeQL JavaScript PASS. Dependency Review remains skipped because repository Dependency Graph is not enabled.
- Pages `36775080542`: build/deploy/report PASS.

## Advisor status
- Security advisor still reports 20 pre-existing authenticated-callable public SECURITY DEFINER warnings and leaked-password protection disabled.
- Performance advisor reports 12 unused-index informational notices.
- No new C6 public SECURITY DEFINER warning was introduced.

## Scope boundary
C6 does not claim automatic external reminders, email/SMS/webhook delivery, qualified digital signature, real Persian OCR quality, or persistent two-real-user browser E2E.
