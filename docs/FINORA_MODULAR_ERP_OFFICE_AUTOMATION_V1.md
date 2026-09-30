# Finora Modular ERP + Office Automation Architecture v1

Date: 2026-09-30  
Status: APPROVED DIRECTION / first vertical slice implemented in production schema

## Product decision
Finora is no longer modeled as “accounting plus extra pages”. It is a modular organization platform. A customer may buy one or several modules or the full suite. A signed-in person must only see and use modules that are both commercially entitled and individually authorized.

**Effective access = customer/module entitlement ∩ member permission ∩ record/tenant scope.**

The first production slice implements server-enforced commercial module entitlements and working single-account office/request foundations. Multi-login organization membership/RBAC is intentionally a separate migration because the existing production record store is owned by `auth.uid()`; UI-only sharing would be insecure.

## Research synthesis — patterns adopted, not copied
Research was used as product evidence, not as a UI/template to clone.

### Barid / ParGar
Public Barid material describes ParGar as a unified organizational desk spanning financial, HR and office automation rather than isolated systems. Public product material and company posts emphasize paperless correspondence, work desk/inbox, archive and OCR so scanned correspondence becomes searchable. These patterns support Finora's unified launcher, correspondence archive, attachment/OCR-ready metadata and later cross-module work inbox.

Evidence:
- https://www.linkedin.com/company/baridsoft
- https://www.linkedin.com/products/baridsoft-%D8%B3%DB%8C%D8%B3%D8%AA%D9%85-%D8%AC%D8%A7%D9%85%D8%B9-%D9%BE%D8%B1%DA%AF%D8%A7%D8%B1
- https://www.linkedin.com/posts/baridsoft_%D9%BE%D8%B1%D8%AF%D8%A7%D8%B2%D8%B4%D8%AA%D8%B5%D9%88%DB%8C%D8%B1-ocr-%D8%A7%D8%AA%D9%88%D9%85%D8%A7%D8%B3%DB%8C%D9%88%D9%86%D8%A7%D8%AF%D8%A7%D8%B1%DB%8C-activity-7266786695159664640-kH26

### Chargoon / Didgah
Chargoon material describes correspondence as part of a broader office-automation family, with production/circulation of letters, mobile access, tasks, meetings and organizational information. Public implementation material also stresses preserving historical letters/attachments and removing referral bottlenecks. Finora therefore treats correspondence history and attachments as durable records and keeps tasks/meetings as future modules rather than cramming them into “letters”.

Evidence:
- https://www.linkedin.com/products/chargoon-%D9%86%D8%B1%D9%85-%D8%A7%D9%81%D8%B2%D8%A7%D8%B1-%D8%A7%D8%AA%D9%88%D9%85%D8%A7%D8%B3%DB%8C%D9%88%D9%86-%D8%A7%D8%AF%D8%A7%D8%B1%DB%8C/
- https://www.linkedin.com/posts/chargoon_%D8%AF%DB%8C%D8%AF%DA%AF%D8%A7%D9%87-%D8%A7%D8%AA%D9%88%D9%85%D8%A7%D8%B3%DB%8C%D9%88%D9%86%D8%A7%D8%AF%D8%A7%D8%B1%DB%8C-activity-7210897661120417793-DLXE

### Faragostar
Public Faragostar material exposes a useful mature capability split: correspondence inbox/circulation, web secretariat, document/archive, tasks, file exchange, meetings, communication channels, multi-organization gateways, classified correspondence and modular add-ons. Its public product material also explicitly separates user groups such as managers, secretariat operators and ordinary experts. Finora adopts the capability separation and security concepts, not product-specific terminology or screens.

Evidence:
- https://www.linkedin.com/products/faragostar-%D8%A7%D8%AA%D9%88%D9%85%D8%A7%D8%B3%DB%8C%D9%88%D9%86-%D9%BE%D8%A7%DB%8C%D9%87/
- https://www.linkedin.com/products/faragostar-%D8%A7%D9%85%D9%86%DB%8C%D8%AA/
- https://www.linkedin.com/products/faragostar-%D9%85%D8%AF%DB%8C%D8%B1%DB%8C%D8%AA-%D8%A7%D8%B1%D8%AA%D8%A8%D8%A7%D8%B7%D8%A7%D8%AA/

## Module catalog
### Operational now
- `core` — company/account/platform settings; always present.
- `accounting` — GL, chart, dimensions, journals, fiscal years, financial statements/control.
- `commerce` — contacts, products/services, sales and purchases.
- `treasury` — receipts/payments, cheques, cashboxes and petty cash.
- `contracting` — projects/contracts, amendments, deductions, guarantees, statements.
- `inventory` — warehouses, stock movement/counting/cost.
- `assets` — fixed assets and depreciation.
- `hr_payroll` — employees, employment contracts, leave, payroll and employee accruals.
- `office_automation` — secretariat registries, correspondence, scan/attachments, archive/search foundations.
- `requests_workflow` — admin-defined request types/fields and request submission foundation.
- `group_consolidation` — existing group/intercompany management controls; statutory consolidation remains a roadmap item.
- `analytics` — reporting/management surfaces.

### Planned, not sold/exposed as operational yet
- `crm` — lead/opportunity/activity/service lifecycle.
- `transport` — fleet, driver, vehicle request/dispatch/trip/fuel/maintenance linkage.
- `manufacturing` — BOM/MRP/work orders/production costing.
- `maintenance` — equipment/work order/preventive maintenance.

The license schema already knows these future keys so commercial packaging can evolve without another entitlement redesign, but the admin UI disables unimplemented modules to prevent selling fake capability.

## License model
`licenses.modules text[]` is independent of plan duration and `max_companies`.

- `['full_suite']` means all modules, including future modules when released.
- Otherwise the array contains explicit module keys.
- Existing licenses were grandfathered to `full_suite` because they previously had no module boundary; this avoids silently removing already purchased/used functionality.
- New module enforcement occurs in Postgres RLS and the atomic sync RPC. Hiding a rail button is only UX, never the security boundary.
- Admin module changes use `admin_set_license_modules`; the function rechecks the server-side admin role and validates module keys.

## Office automation domain contract
### Secretariat registry (`officeRegistries`)
`id, companyId, code, title, prefix, nextNumber, active, createdAt`.

Each registry is an independent numbering gateway. Registration is performed by `office_register_correspondence` inside one database transaction with `FOR UPDATE`; two sessions cannot legitimately consume the same counter value. A unique index on owner + registry + register number is the second collision guard.

### Correspondence (`correspondence`)
- identity: `id`, `companyId`, `registryId`, `registerNumber`.
- kind: `incoming | outgoing | internal`.
- external metadata: external number/date, sender/recipient.
- content: subject, body, tags (next UI slice).
- controls: priority, confidentiality, due date, status.
- OCR-ready: `ocrStatus`, `ocrText`; **no OCR accuracy claim until a real engine is connected and tested on Persian scans**.
- lifecycle: draft → registered → circulation/follow-up → closed. The first slice implements draft and atomic registration; shared circulation waits for tenant RBAC.

### Attachments (`correspondenceAttachments`)
Binary content is not stored inside JSON records. Files use a private Supabase Storage bucket `office-attachments`, maximum 20 MB each, PDF/JPEG/PNG/TIFF. Object paths begin with the authenticated UID. Storage RLS requires both object ownership and the `office_automation` entitlement. Record metadata stores correspondence id, private storage path, original filename, MIME type, size and timestamp.

### Referrals and audit
Collections are reserved now (`correspondenceReferrals`, `correspondenceAudit`) but shared-user referral is not exposed until organization membership and server-side member permissions exist.

## Configurable requests
`requestTypes` stores an admin-defined schema (`fields[]`) instead of hard-coding “vehicle request” or “stationery request”. The first UI supports text/number/date/long-text field definitions and required flags. `requests` stores the chosen type, values, number and status. `requestActions` is reserved for approval/reject/return/delegate history once member RBAC exists.

Recommended packaged templates after the workflow engine is complete:
- vehicle/transport request → transport dispatch;
- stationery/office supplies → procurement/inventory issue;
- leave/overtime/mission → HR/payroll;
- purchase request → procurement/budget approval;
- payment request → treasury/accounting;
- IT/service request → service desk/maintenance;
- contract/legal review → contracting/legal;
- visitor/access request → facilities/security.

## Multi-user RBAC target (next high-risk slice)
Do not overload `profiles.role` (`user/admin`) for organization permissions. Introduce explicit tenant structures:

1. `organizations` / legal tenant.
2. `organization_members` mapping auth users to tenant + employment/position identity.
3. `module_roles` such as module-admin, manager, operator, viewer.
4. `member_module_permissions` with capabilities: `read`, `create`, `edit`, `delete`, `approve`, `register`, `refer`, `archive`, `configure`.
5. row scope: own / unit / branch / company / all organization.
6. confidentiality clearance independent from generic read permission.
7. immutable action/audit ledger for permission changes, registration, referral, approval and document access where required.

Examples:
- Accounting user: accounting entitlement + `read/write` accounting role; no office module.
- Office ordinary user: office entitlement + draft/read own inbox; cannot allocate registry numbers.
- Secretariat operator: `register`, scan/attachment correction and archive metadata; no global module configuration.
- Office module admin: configure registries/templates/routing and see module audit according to tenant policy.
- Approver/manager: read/approve/refer within assigned scope; cannot silently alter registered history.

## Entry experience
After authentication Finora derives the purchased module list from the server license. When multiple modules are available, a workspace launcher is shown. The primary rail is also filtered to entitled modules. A user can switch workspaces without a second login. This is the product-level equivalent of a unified organizational desk while preserving module boundaries.

## Security invariants
1. UI visibility never grants or denies data access by itself.
2. RLS blocks unentitled collections on SELECT/INSERT/UPDATE/DELETE.
3. `finora_sync_records` rejects mixed upsert/delete payloads containing an unentitled collection.
4. Office files are private and owner/module restricted.
5. Registration numbers are allocated atomically server-side.
6. Module license and member permission remain independent.
7. Registered correspondence must gain immutable registration-history/audit guards before shared multi-user editing is enabled.
8. No “module manager” or “secretariat shared inbox” claim before tenant membership/RBAC RLS passes positive and negative tests.

## Delivery roadmap
### Slice A — implemented in this checkpoint
Server module entitlements; admin module picker; module launcher; office/request collections; private scan bucket; secretariat registry; draft/atomic registered correspondence; attachment upload/download; archive metadata search; configurable request type/fields and request submission.

### Slice B — tenant + permissions
Organization/membership migration, row ownership conversion strategy, module roles/capabilities, unit/branch scopes, secretariat operator and module-admin roles, shared inbox and referral, permission audit.

### Slice C — mature office automation
Letter templates/Word-like editor, signatures/approval, referral chains, read receipts, deadlines/reminders, reply/related-letter graph, archive folders/classification, OCR service + Persian quality benchmark, full-text/OCR search, ECE/API/email gateway adapters, meeting/task integration.

### Slice D — workflow/BPMS-lite
Versioned request schemas, visual step definitions, conditions, parallel/sequential approvals, SLA/escalation, delegation/substitution, form versioning, audit, cross-module actions.

### Slice E — logistics/operations
Transport/fleet/dispatch/fuel/maintenance, procurement request-to-order, office supplies issue, service desk, CRM and manufacturing/maintenance only as complete vertical products with accounting/permissions/reporting integration.

## Acceptance criteria for Slice A
- Production `licenses.modules` exists and old licenses remain functional through explicit `full_suite` grandfathering.
- An explicit module subset is enforced in RLS and atomic sync, not only the UI.
- Admin can assign full suite or implemented module subset independently of duration/company capacity.
- Office and Requests appear only when licensed.
- Secretariat registry can be created; registered correspondence gets a server-allocated unique number.
- Scan files use private Storage with owner + module RLS.
- Request type builder can add fields and create a request from the resulting schema.
- Existing accounting/domain/Real-DOM gates remain green.
