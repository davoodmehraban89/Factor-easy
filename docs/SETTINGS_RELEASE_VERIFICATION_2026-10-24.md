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
