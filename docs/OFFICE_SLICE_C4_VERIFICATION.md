# Office Slice C4 — Versioned Templates + Controlled Draft Application Verification

Date: 2026-09-30
Project: `hcsixhqbyuhpshfwqpjx`

## Delivered
- Repaired atomic correspondence registration after tenant migration: the legacy 3-argument overload was removed, eliminating the ambiguous RPC path; the remaining registration RPC writes an explicit organization id.
- Registration now validates optional template provenance before a letter becomes registered.
- Added a private, non-Data-API template-version store: `private.correspondence_template_versions`.
- Template edits are append-only versions; per organization + template key, version allocation is serialized with a transaction advisory lock.
- Public template RPCs are SECURITY INVOKER wrappers; privileged implementations remain in the unexposed `private` schema with empty `search_path` and explicit grants.
- Direct `authenticated` / `anon` table access to the private template store is revoked.
- Office UI now has «قالب‌های نامه», version creation, latest-template catalog, and controlled application to the new-letter editor.
- Applied template provenance (`templateKey`, `templateVersion`) is carried into draft/registration and validated server-side.
- Applying a template only populates the editable new-letter form; it does not mutate registered correspondence.

## Production migrations
- `20260930202526 office_registration_tenant_repair`
- `20260930202701 office_slice_c4_versioned_templates`

Archived SQL:
- `supabase/migrations/20260930202526_office_registration_tenant_repair.sql`
- `supabase/migrations/20260930202701_office_slice_c4_versioned_templates.sql`

## RED / defect evidence
Pre-flight inspection found both:
- `office_register_correspondence(text,text,jsonb)` — legacy owner-only implementation that omitted mandatory `organization_id`;
- `office_register_correspondence(text,text,jsonb,uuid default null)` — tenant-aware implementation.

A three-argument SQL call was ambiguous because both overloads matched. The C4 repair drops the legacy overload and keeps one tenant-aware RPC. A transactional production test then registered a letter through the three-argument/default path and verified organization id, owner id, assigned number and `registered` status.

## Transactional production adversarial verification
All template versions, test registry/correspondence, temporary membership/permission and temporary seat expansion were rolled back.

PASS:
1. Owner/configurator created template version 1 and then version 2 under one stable key.
2. Catalog returned only the latest version for the key.
3. Registered correspondence accepted an existing same-organization template version and persisted its provenance.
4. Registration with nonexistent template version was rejected.
5. Read-only organization member could read the active template catalog.
6. Read-only member could not create a template version.
7. Authenticated role could not directly SELECT/INSERT the private template store.
8. Cross-tenant principal received no template catalog rows.
9. Rollback left zero C4 records/template/member residue and restored `max_users=1`.

## GitHub verification
Verified C4 runtime/test head: `481f9fed434f127eaa32ccf8d69c649e783b5cad`.
- Quality `36773156535`: PASS, including JavaScript syntax, accounting/Golden, ELI-1/2/3/4, Office C1/C2/C3/C4 invariants and Real-DOM.
- Security `36773156559`: CodeQL JavaScript PASS. Dependency Review remains skipped because Dependency Graph is still disabled.
- Pages `36773155535`: build/deploy/report PASS.

An earlier C4 run correctly exposed a Real-DOM readiness race: C1/C4 tests waited only for base `officeRender` while mature-office extensions were still loading. The tests were corrected to wait for their actual mature-runtime functions; the full Real-DOM suite then passed.

## Security/advisor disposition
The public C4 API functions are SECURITY INVOKER. The necessary SECURITY DEFINER helpers are kept in the private schema, use an empty search path and are not exposed as public Data API RPCs. This follows current Supabase guidance to keep definer helpers out of exposed schemas and to restrict function/table privileges.

The live security advisor remains at 20 public authenticated-callable SECURITY DEFINER warnings; C4 did not add another public warning. Leaked-password protection remains disabled.

## Scope boundary / NOT VERIFIED
C4 is a controlled text-template/editor foundation, not a Word-compatible document engine. It does not claim approval/signature lifecycle, qualified digital signature, Persian OCR quality, external document gateways or persistent two-real-user browser E2E.
