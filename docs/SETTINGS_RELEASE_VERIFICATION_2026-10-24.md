# Settings persistence and release verification — 2026-10-24

The owner expanded the original checkbox report to all ordinary Settings controls
and authorized merging/releasing the settings and login repairs after verification.
PR #175 contains the settings repair; #176 contains the separate startup repair.
Navigation #174 and the next accounting roadmap phase remain separate.

## Controls and evidence

| Area | Verified locally with synthetic records and blocked production transport |
| --- | --- |
| Appearance and keyboard | Theme and all four flags, checked and explicitly unchecked, real save/sync/logout/reload, account switching, unsaved-edit preservation. |
| Excel fields | All five schemas: products, contacts, accounts, sales items, purchase items. Save/sync/logout/reload, initial product selector, account switch, unsaved edits and denied-write guard. |
| Invoice defaults | Document kind, VAT mode, VAT rate including zero, rial/toman/custom currency and custom label; actual save, mock-server acknowledgement, logout and restored cloud read; fresh invoice default also retains zero. |
| Company | Entity/sector/legal form/organization role/parent/activity, name/phone/national/economic/registration/postal/address/footer fields; save/logout/restored edit; active-company selection. No chart/template or financial records created. |
| Operational settings | Warehouse, base currency, current inventory method; actual UI save/sync/pull, logout/page reload and synthetic profile restoration, audit before/after, expired-license rejection and no financial records. |
| Keyboard routing | Ctrl+S, Ctrl+Enter, F2 and enabled Enter use the focused appearance/Excel card's existing save action; operational card uses its existing handler. Unrelated account form does not save invoice defaults. Existing company/defaults and purchase-confirmation checks remain. |

## Additional defects reproduced before correction

1. Operational save referenced undeclared `defaultWarehouseId` in the audit payload,
   throwing before `saveDatastore`. Use the already-validated `warehouseId`.
2. Excel fields retained anonymous/default selections after account restoration.
   Hydrate on a new host/settings record/type; ordinary refresh preserves unsaved
   checkboxes. Apply the same existing write guard as other preference saves.
3. Invoice default rendering used `vat_rate || 10`, replacing a saved zero with ten.
   Use a nullish fallback in the two default-display locations. Posted invoice
   content and tax calculation rules are unchanged.
4. Settings keyboard save always chose invoice defaults even when editing another
   card. Resolve the current card's existing action and validate that card.

The initial theme/keyboard rehydration correction remains included. No dependency,
schema/RLS/Auth-policy/role/grant, financial engine or frozen-module change is part
of these repairs. Password changes, data restore/import/reset, chart application,
integration changes and financial postings are excluded from real-account tests.

## Real browser status

TinyFish baseline run `fbdc69b2-9206-4dfb-84b9-d5f01966f574` used the owner-confirmed
test/work profile but ended at the login gate without usable session or vault
credentials. This is **BLOCKED**, not a successful real-account persistence test.
Its hidden/pre-login DOM values are not evidence of saved settings, and its
unconfirmed session-expiry explanation is not treated as an Auth diagnosis.

A secure profile setup link was supplied after the owner's instruction to continue.
The user signs in there and uses **Save profile**; no password, cookie or token is
requested in chat or copied into this repository. Real-account save/reload and
logout/login acceptance remain pending that saved authenticated profile.

Local source suite: **135/135 PASS (3.1m)**; all **50** existing static/behavioral/backup/release-safety checks PASS including Golden Accounting. After adding operational logout/reload and the stable Pages selector, all eight full-page settings regressions against generated strict-CSP Pages passed (**8/8**, 16.2s); all 21 existing/expanded UX+keyboard tests passed. Independent review found no remaining application findings.

Combined totals, exact PR/main SHAs, CI and gated Pages results are
recorded in `PROJECT_STATE.md` and the PR descriptions after they actually run.
Owner-ISP/browser acceptance remains distinct from the remote test browser.

## Release and fresh browser checkpoint — 2026-10-25

Settings PR175 is merged as `a691e92bb56355c41963e9fa31e743f4497029b8`.
Its exact-main Quality40122724474, Security40122724458, Release gate40122974685
and Pages40122993125 succeeded. Public HTML and seven relevant transformed
assets/bundles matched a fresh build of that exact commit byte-for-byte at
02:28 UTC. Login PR176 subsequently merged normally as
`0ced2316f743817c9528152a0214656133323561`, after the strict up-to-date PR head
passed all checks, 150 browser tests and Golden Accounting.

Final application main `0ced2316f743817c9528152a0214656133323561` passed
Quality40154558971 (**150 tests, 3.3m**, Golden and all three disposable DB jobs),
Security40154559079, Release gate40154827728 and Pages40154873796. Independent
public readback matched 14/14 relevant files byte-for-byte against its fresh
generated build. The earlier concurrent gate40154644004 was cancelled; the
successful gate above is the release evidence. Both repairs are published.

Actual TinyFish run `3de24f55-7824-4f76-b909-8688017e4c72` reached the visible
login gate without usable vault credentials and stopped after 17 seconds without
preference changes. This short run does not establish session expiry or exclude
a delayed restore. True/false/theme save-reload, restoration, all other real-account
Settings and logout/re-entry were **NOT EXECUTED**. Earlier reported UI access
is not evidence that the saved profile restores an authenticated session.
Another secure setup handoff was supplied. Synthetic persistence coverage and
public asset equality do not replace these pending real-account checks.
