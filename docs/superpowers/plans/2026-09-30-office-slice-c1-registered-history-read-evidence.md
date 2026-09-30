# Office Slice C1 — Registered History + Read Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden registered correspondence history and add server-authoritative read evidence without claiming OCR, qualified signatures or external delivery.

**Architecture:** Keep correspondence in the existing tenant-aware `records` store. Add database guards that make registration identity/history immutable after registration while allowing separately authorized operational fields to evolve. Record read evidence as organization-scoped audit events through a dedicated RPC so clients cannot forge another user's read event. Build the UI as a focused extension over the existing office view rather than rewriting the office module.

**Tech Stack:** PostgreSQL/Supabase RLS + PL/pgSQL, vanilla JavaScript, Playwright Real-DOM, GitHub Actions.

**Spec:** `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md`

## Global Constraints
- Effective access remains commercial entitlement ∩ member permission ∩ tenant/record scope/confidentiality.
- Registered correspondence registration identity (`organization_id`, `id`, `registryId`, `registerNumber`, `registeredAt`) is immutable.
- UI visibility is not security; server functions/RLS/triggers are authoritative.
- No claim of OCR accuracy, qualified digital signature, external email/ECE delivery or physical printing.
- Existing accounting/Golden and ELI-1/2/3/4 gates must remain green.

## Review Focus
- Direct generic record update must not rewrite registration identity.
- Direct delete of registered correspondence must be rejected.
- Read evidence must always identify the authenticated reader, never a caller-supplied user id.
- A user without office read permission must not create/read evidence for an inaccessible letter.
- Existing legacy registered correspondence must remain readable and must not be rewritten by migration.

---

### Task 1: Registration-history immutability

**Files:**
- Create: `supabase/migrations/<production-version>_office_registered_history_hardening.sql`
- Create: `scripts/office-slice-c1-check.mjs`
- Modify: `.github/workflows/quality.yml`

**Interfaces:**
- Consumes: `public.records`, `private.can_access_record`, existing `office_register_correspondence`.
- Produces: trigger `private.protect_registered_correspondence_history()`.

- [ ] Write failing invariant/adversarial tests for protected-field update and registered-row delete.
- [ ] Verify RED against current production/repository behavior.
- [ ] Add trigger that rejects protected registration identity changes and deletion when `collection='correspondence'` and old status is `registered` or later.
- [ ] Preserve allowed operational edits without weakening record RLS.
- [ ] Run repository + transactional production tests; archive exact migration version.

### Task 2: Server-authoritative read evidence

**Files:**
- Modify same C1 migration or add one follow-up migration if production apply already occurred.
- Modify: `scripts/office-slice-c1-check.mjs`

**Interfaces:**
- Produces: `public.office_mark_correspondence_read(p_organization_id uuid,p_correspondence_id text) returns text`.
- Persists append-only `correspondenceAudit` event with authenticated user, event `read`, correspondence id and server timestamp.

- [ ] Write failing tests for authorized read, unauthorized read, forged-user impossibility and immutable evidence.
- [ ] Implement RPC with office entitlement + record-level read check.
- [ ] Make read evidence append-only and auditable.
- [ ] Verify rollback adversarial scenarios in Production.

### Task 3: Office UI read-evidence integration

**Files:**
- Create: `js/office-mature.js`
- Modify: `js/bootstrap.js`
- Create: `scripts/office-slice-c1.spec.js`
- Modify: `.github/workflows/quality.yml`

**Interfaces:**
- Consumes: `office_mark_correspondence_read`.
- Produces: detail/open path that records a read event only after the letter is successfully visible to the user; exposes read-evidence timeline where authorized.

- [ ] Commit failing Real-DOM coverage first.
- [ ] Implement minimal extension without duplicating the office module.
- [ ] Verify Real-DOM + all existing accounting/ELI gates.

### Task 4: Evidence and continuity

**Files:**
- Create: `docs/OFFICE_SLICE_C1_VERIFICATION.md`
- Modify: `PROJECT_STATE.md`
- Modify: `docs/CURRENT_STAGE_GAP_REGISTER_2026-09-30.md`

- [ ] Record exact production migration, transactional adversarial results and CI run IDs.
- [ ] Mark only C1 registration-history/read-evidence scope complete; keep templates/signatures/SLA/OCR/adapters as open Slice C work.
- [ ] Keep external/provider and two-real-user persistent-production boundaries explicit.
