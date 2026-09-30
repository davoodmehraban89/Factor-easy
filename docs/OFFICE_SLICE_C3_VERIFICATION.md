# Office Slice C3 — Related-Letter Graph + Archive Classification/Search Verification

Date: 2026-09-30
Project: `hcsixhqbyuhpshfwqpjx`

## Delivered
- Append-only correspondence relations: `reply_to` and symmetric `related`.
- Server rejection of self-links, duplicate reply parents, reply cycles and duplicate reverse related links.
- Append-only archive classification events with folder, classification code and bounded tags.
- Latest-classification semantics hardened with `clock_timestamp()`.
- Server-authoritative archive search over readable correspondence and classification metadata.
- Related-letter search through `p_related_to`.
- Office archive UI for search/filter, classification and relation creation.

## Production migrations
- `20260930154625 office_slice_c3_related_archive`
- `20260930154720 office_c3_event_time_ordering`

Archived SQL:
- `supabase/migrations/20260930154625_office_slice_c3_related_archive.sql`
- `supabase/migrations/20260930154720_office_c3_event_time_ordering.sql`

## TDD / implementation evidence
- Plan: `3b38982986df7e44daeeeef1c655cad250063082`.
- Failing static gate: `dfa379e6b874bcb3132dce9574338a8a26afbcb0`.
- Failing Real-DOM gate: `55b872c5632537acf1de64405b50e5e2a5197b03`.
- CI gate wiring: `9051709e7c83329062ecae2dd6c57cc33092d7d3`.
- Event-ordering regression captured before hardening: `4a591be83a3b2415efbe8591c700e82902875a8a`.
- Production migration archives: `e5c16b07a4f280ec7d7735b375c0ac23062e2b71`, `500c519af90f1633eb2a8cb926a41db3ecf517dc`.
- Runtime/UI: `07da0f88649412a87fde8d75a45c2a604b3b26f9`, asset refresh `cd975c74b5e7eef2b8ac14f1fc520efe58eaca22`.

## Transactional production adversarial verification
All C3 correspondence fixtures, temporary membership, permission grant and temporary license-seat expansion were created inside one transaction and rolled back.

PASS:
1. A scoped member's archive search returned only the correspondence inside that member's company scope.
2. Linking a readable source to an unreadable target was rejected server-side.
3. Scoped member could classify a readable correspondence.
4. Classification of an unreadable correspondence was rejected.
5. Self relation was rejected.
6. A reply source received exactly one reply parent; a second parent was rejected.
7. A three-letter reply cycle was rejected.
8. Reverse duplicate `related` relation was rejected.
9. Latest classification replaced older classification for search semantics without mutating old evidence.
10. Related-graph search from one letter returned the expected three-node fixture graph.
11. Cross-tenant principal received no C3 archive rows.
12. Rollback left zero correspondence/audit/member residue and restored `max_users=1`.

## GitHub verification
Verified main head containing C3: `44bea5e8e63bf37e6de8cbbd369168ea4a9bfb19`.
- Quality `36740544828`: PASS, including accounting/Golden, ELI-1/2/3/4, Office C1/C2/C3 and Real-DOM.
- Security `36740544795`: CodeQL JavaScript PASS. Dependency Review remains skipped because the repository Dependency Graph boundary is unchanged.
- Pages `36740543917`: build/deploy/report PASS.

## Security/advisor disposition
Current Supabase guidance recommends `SECURITY INVOKER` by default and, when `SECURITY DEFINER` is necessary, an empty `search_path`, schema-qualified relations and restricted EXECUTE grants. C3 follows the latter controls and has explicit negative authorization tests. The advisor still reports authenticated-callable SECURITY DEFINER RPC warnings; broader RPC exposure redesign remains a tracked P1 security item rather than being silently treated as closed.

Leaked-password protection remains disabled. Performance advisor currently reports unused-index informational notices.

## Scope boundary / NOT VERIFIED
C3 does not claim OCR quality, qualified digital signature, templates/editor, approval/signature lifecycle, external archive adapters or persistent two-real-user browser E2E.
