# Finora — Phase 1 Verification

Date: 2026-09-28
Status: COMPLETED

## Scope

Phase 1 redesigns the application shell and information architecture without replacing or deleting the existing operational data model.

Implemented:
- compact RTL module rail
- contextual second-level module panel
- collapsible desktop navigation with persisted preference
- global command/menu search with Ctrl/Cmd+K shortcut
- top bar with active company, current Jalali fiscal-year context and quick action
- workspace title/context synchronization
- canonical mapping from every existing operational view to one primary module
- responsive mobile navigation preserving all current working views
- print isolation from application chrome
- visual normalization of dashboard KPI cards into the new shell language
- existing sales, purchases, treasury, contacts, products, reports, settings and admin capabilities retained
- no future accounting/contracts/inventory screens exposed as fake operational functionality

## Navigation ownership

- Home: dashboard
- Sales: invoices; links to customers and products
- Purchases: purchase invoices; links to suppliers and expenses
- Treasury: receipts/payments, cheques, expenses/income
- People: counterparties
- Catalog: products/services
- Reports: current financial reports and analytical dashboard
- Settings: company/settings and authorized admin panel

Views shared by several workflows have one canonical module for direct navigation so the shell does not jump unpredictably.

## UX invariants

1. Desktop shell reserves a narrow module rail and contextual submenu; content width expands when submenu is collapsed.
2. Mobile removes both desktop side panels and retains the existing bottom dock.
3. A view switch always updates module selection and workspace context.
4. Admin navigation remains authorization-gated.
5. Search returns only real, currently implemented destinations.
6. Print output never includes shell chrome.
7. Collapsed submenu state is local UI preference only and does not touch financial data.

## Regression gates

The repository quality gate validates:
- unique static IDs
- required operational views/scripts
- Phase 1 shell IDs and responsive CSS
- canonical view mapping
- command search and workspace context code
- purchase/payment primary navigation
- prior financial, print, project, settlement and security invariants

A deterministic JavaScript syntax diagnostic checks every `js/*.js` module before application invariants.

## Data and migration

Phase 1 contains no destructive financial-data migration. Supabase production collections and RLS remain unchanged. Existing records continue to use the same storage and synchronization paths.

## Verification boundary

Automated repository checks, GitHub Pages deployment and security workflows are release gates. An authenticated interactive browser/device walkthrough is not available in the current execution environment and is therefore not claimed as performed.
