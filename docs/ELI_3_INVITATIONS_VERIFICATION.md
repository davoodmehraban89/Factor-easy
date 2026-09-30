# ELI-3 Secure Organization Invitations Verification

Date: 2026-09-30
Project: `hcsixhqbyuhpshfwqpjx`

## Delivered
- Tenant-scoped invitation lifecycle with pending / accepted / revoked / expired states.
- Server-generated 256-bit random invitation token; only SHA-256 token hash is persisted.
- Invitation bound to normalized email, optional unit/position and reusable role assignments.
- Create/revoke/expire management restricted to organization owner or delegated `core/configure`.
- Acceptance requires authenticated user, matching email and active organization license.
- Membership activation and invited-role assignment occur in one transaction and consume named-user seat capacity through the existing ELI-1 trigger.
- Same-user accepted-token replay is idempotent; wrong-user/wrong-email and full-seat paths reject.
- Invitation audit deliberately removes `token_hash` from before/after JSON.
- Organization admin UI creates/revokes invitations, shows the one-time invitation URL and supports copying it.
- App startup/login accepts `?invite=<token>` after authentication and removes the token from browser address state after success.
- External automatic email sending is intentionally not claimed.

## Production migrations
- `20260930051849 enterprise_invitations`
- `20260930052909 eli3_fk_index_hardening`

The second migration was added after the Supabase performance advisor identified six uncovered foreign keys across ELI-2/3 tables. After apply, the unindexed-foreign-key advisor category is clear; remaining performance notices are unused-index informational findings only.

## Transactional adversarial verification
All mutations used existing legitimate principals and were rolled back.

PASS:
1. Raw invitation token is not persisted.
2. Wrong authenticated email cannot accept the invitation.
3. Intended authenticated principal can accept.
4. Acceptance creates/reactivates active membership and assigns invited role atomically.
5. Same accepted user replay returns the same membership without duplicate side effects.
6. Full named-user capacity rejects another acceptance without creating an active member or consuming the invitation.
7. Owner can revoke a pending invitation.
8. Invitation audit contains no `token_hash` field.
9. Existing ELI-1 seat trigger remains the authoritative atomic capacity gate.
10. Post-test persistent residue: 0 invitations, 0 invitation-role links, 0 non-owner members, 0 member-role assignments.

## TDD / Real-DOM evidence
A failing Real-DOM test was committed first at `93cd9120eaaca8f0a42f25dbb8bd842f8a658999`; Quality run `36673008772` failed specifically because the invitation UI actions and URL processor were not yet implemented. The runtime/UI implementation then made the same coverage pass.

Final verified product head before this evidence commit: `71d6cd7196ef308c67f927644503f563bf4693ea`.
- Quality `36673537775`: PASS, including all accounting/Golden/ELI invariants and invitation Real-DOM tests.
- Security `36673537771`: PASS.
- Pages `36673537056`: PASS.

## Supabase advisor status
Security advisor still reports authenticated-callable SECURITY DEFINER RPC warnings, including the invitation RPCs. These invitation RPCs are intentionally exposed to authenticated clients and contain internal owner/core-configure, email, active-license and seat checks; adversarial negative paths passed. Leaked-password protection remains disabled and is an external configuration gap.

Performance advisor after FK hardening reports no unindexed foreign keys. Newly created indexes may appear as unused immediately because production traffic has not exercised them yet; no index is removed on that basis.

## NOT VERIFIED
- Automatic external invitation email delivery through a real provider.
- Authenticated production browser E2E with a deliberately persistent second non-owner organization member.
