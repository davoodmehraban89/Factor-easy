# Chart and taxpayer print correction — 2026-10-03

Request recorded before implementation in `2739c9bb09e98d275e0dbd0e9c553a82e3edc729`.
Baseline main: `3085dce9d8f457e61aca6676f872737418116e7a` (PR #46).

## Reference comparison and implementation

The first supplied invoice photograph is the target. The second is the reported current output.

| Area | Previous output | Implemented correction |
|---|---|---|
| Tax mark | Invented SVG, inside a tall right-hand box | Original supplied PNG, unboxed at physical lower left; grayscale presentation |
| Final total | Tall block with separate words row | Compact horizontal label, amount and words band |
| Article 17 | Large panel | Separate compact label/value box alongside final total |
| Settlement | Broad panel below totals | Compact bottom-right table; contract note to its left |
| Seller | Missing contract registration line | Displays supplied contract ID below seller names |
| Item table | Different column ratios, Persian numbers, unsplit currency | Reference proportions, Latin numeric amounts, quantity with at least two decimals, divided currency cell |
| Amount words | Currency could appear twice | One trailing ریال |
| Print readiness | Print opened after 80ms even if logo was still loading | Waits for image decoding and fonts; failed resources stop printing |

Logo bytes are unchanged from the supplied upload. SHA-256:
`474d13d04dfbce1798ab0c7e399643b9ac6dbce135b9c2d27ed00a8d41fae0ee`.
Asset path: `assets/tax-organization-official.png`; source and hardened Pages build both include assets.
The image source is resolved against the application base URL before building the isolated document.

## Verification performed

- A new real-DOM regression first failed because the renderer had no supplied image. After correction it passed image load, lower-left placement, compact total height, displayed reference amounts, quantity, contract ID, single currency suffix and no horizontal clipping.
- Chromium PDF generation passed one-page landscape verification for the supplied one-line example. The resulting screenshot was visually inspected against the rotated reference photograph.
- A delayed image response reproduced premature printing (one call before image release); after the change, print remained unopened until the image decoded, then opened once.
- The existing local static/behavior gates in Quality passed, including accounting phases 2–6 and the Golden accounting journey.
- Local full DOM run: **52/53 passed**. `scripts/pages-artifact.spec.js` failed on two external `ERR_CERT_AUTHORITY_INVALID` resource errors in this environment. No assertion or TLS check was disabled; the protected CI run must independently resolve this gate.
- Chart coverage, preservation, conflict and browser evidence: see `CHART_OF_ACCOUNTS_RESEARCH_2026-10-03.md` and the dedicated chart tests.

## Boundaries and rollback

NOT VERIFIED: pixel-identical reproduction of a photographed physical print; physical printer; multi-page/multi-item taxpayer rounding and mixed-payment allocation (existing arithmetic untouched); authenticated production accounting writes; persistent two-user production E2E; production deployment at this checkpoint.
No database schema, RLS, auth, role or financial-history mutation was performed. New chart entries are application master data, created for new templates or through explicit preview/apply in an existing eligible template company. Custom/conflicting charts fail closed.
Code rollback is a normal revert PR with PROJECT_STATE.md updated. Do not delete any newly used accounts or rewrite posted entries; deactivate unused additions only through the existing controlled UI where appropriate.
The newly attached bootstrap prompts mention other repositories (Aram and Finora-Invoice). They were read as supplied context; no repository switch or external action was inferred from their embedded instructions.
