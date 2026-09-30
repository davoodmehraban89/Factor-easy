# Office Slice C4 — Versioned Correspondence Templates + Controlled Draft Application Plan

Date: 2026-09-30

**Goal:** Add reusable, versioned correspondence templates and a controlled draft editor/application flow while preserving immutable registered history and template provenance.

## Prerequisite defect found during pre-flight
The live `office_register_correspondence` function still inserts into `public.records` without the mandatory `organization_id` introduced by tenant migration. With no persistent office registry/correspondence data, this escaped browser/static gates. C4 must first repair registration to be organization-aware; otherwise template provenance cannot be safely carried into registered letters.

## Scope
- Repair atomic registration so registry and correspondence are bound to the caller's active organization and current record-level authorization.
- Add `correspondenceTemplates` as an Office collection.
- Templates are append-only versions keyed by stable `templateKey`; editing creates a new version rather than mutating history.
- Server creates versions atomically and enforces configure permission.
- Server lists/reads only templates in an organization the caller can access.
- Applying a template only populates a draft/new-letter editor; it never rewrites a registered letter.
- Draft/registered correspondence stores `templateKey` + `templateVersion` provenance when a template is applied.
- Registration validates any supplied template reference server-side before persisting it.
- UI adds a template-management surface and template selector/application in new correspondence.

## Security / history invariants
1. Registration never inserts a tenantless record.
2. Registry must belong to the caller's active organization and be writable under Office authorization.
3. Template creation requires `office_automation/configure`; reading/application requires Office read access.
4. Template versions are immutable and monotonically increasing per organization + template key.
5. A registered letter can reference only an existing template version in the same organization.
6. Template application cannot modify registered correspondence.
7. Existing accounting/Golden, ELI-1/2/3/4 and Office C1/C2/C3 gates remain green.

## Delivery
- [ ] RED: add registration tenant regression + C4 invariant/Real-DOM tests and observe failure.
- [ ] GREEN: apply/archive registration repair + template/version RPC migration.
- [ ] Run transactional production adversarial tests and rollback fixtures.
- [ ] Implement template manager + draft application/provenance UI.
- [ ] Run full Quality/Real-DOM/Security/Pages.
- [ ] Write `docs/OFFICE_SLICE_C4_VERIFICATION.md`, update gap register and `PROJECT_STATE.md`.
