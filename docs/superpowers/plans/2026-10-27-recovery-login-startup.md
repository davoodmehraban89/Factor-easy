# Recovery login startup repair implementation plan

> **For agentic workers:** Use superpowers:executing-plans to execute the single repair and independent review before release.

**Goal:** Remove the newly introduced standalone recovery download from the production login critical path.

**Architecture:** In generated Pages only, prepend the existing processed recovery IIFE to the existing core asset and remove its separate script tag. Preserve recovery-before-core and CSP-handler-before-core execution. Derive both core script and preload version from the combined content hash.

**Tech Stack:** Existing classic JavaScript, Node Pages builder, Playwright; no dependencies.

**Spec:** PROJECT_STATE.md, 2026-10-27 owner-requested regression entry.

## Constraints and review focus
- No Auth transport, production backend/configuration, DNS, financial or source-script order changes.
- Normal login must remain ready when the former standalone recovery URL cannot complete.
- Valid recovery must sanitize callback fragments before the SDK reads them, including with another cached identity.
- Invalid and marker-only callbacks must fail closed and allow Cancel.
- Generated strict CSP event handlers must work before later ERP bundles finish.
- Both preload and executing core URL must match the combined-content hash; recovery and core execute once.

## Task: Remove the recovery download barrier
- [x] Add a generated-Pages browser test holding the standalone recovery request; assert login controls and actual normal-login hydration work without releasing it.
- [x] Build unchanged main and observe the assertion fail because core never executes.
- [x] Modify only scripts/build-pages.mjs to combine processed recovery/core, verify syntax, remove the standalone tag and hash both core references.
- [x] Run the new test plus existing startup, transport, recovery, admin and Pages suites; repeat full recovery suite against generated strict CSP.
- [x] Run all existing Quality commands/Golden and the complete workflow browser suite; obtain independent application/security review.
- [x] Record local results and actual limits in PROJECT_STATE.md:184/184full,28/28generated-focused,51checks/Golden/45server PASS; independent review has no findings.
- Release gate: publish a separate PR, verify exact-head checks, protected merge and exact-main gated Pages/readback under existing owner release authorization. Record subsequent SHA/run/public evidence in the PR description. Never claim owner-network login acceptance from cloud tests alone.
