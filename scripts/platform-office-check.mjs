import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const platform=read('js/platform-modules.js'),office=read('js/office-automation.js'),m1=read('supabase/migrations/20260930025546_modular_entitlements_office_automation_foundation.sql'),m2=read('supabase/migrations/20260930025647_office_secretariat_atomic_registration.sql'),doc=read('docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md');
const checks=[
 ['full-suite entitlement',m1.includes("'full_suite'")&&m1.includes('admin_set_license_modules')],
 ['server collection entitlement',m1.includes('private.has_collection_entitlement(collection)')&&m1.includes("raise exception 'module entitlement required'")],
 ['office private storage',m1.includes("'office-attachments'")&&m1.includes('finora_office_files_insert')&&m1.includes("private.has_module_entitlement('office_automation')")],
 ['atomic registry allocation',m2.includes('for update')&&m2.includes('ux_finora_correspondence_registry_number')&&m2.includes('office_register_correspondence')],
 ['module launcher',platform.includes('finora-module-launcher')&&platform.includes('hasLicensedModule')&&platform.includes('admin_set_license_modules')],
 ['future modules disabled',platform.includes("transport:{title:'حمل‌ونقل و ناوگان'")&&platform.includes('implemented:false')],
 ['office scan upload',office.includes("sb.storage.from('office-attachments').upload")&&office.includes('officeRegister')],
 ['configurable request fields',office.includes('requestFields')&&office.includes('saveRequestType')&&office.includes('submitDynamicRequest')],
 ['rbac boundary documented',doc.includes('Effective access = customer/module entitlement')&&doc.includes('Multi-user RBAC target')]
];
const failed=checks.filter(x=>!x[1]);
if(failed.length){console.error('Platform/office checks failed:',failed.map(x=>x[0]).join(', '));process.exit(1)}
console.log('Platform/office foundation checks PASS:',checks.map(x=>x[0]).join(' | '));
