import fs from 'node:fs';import assert from 'node:assert/strict';
const org=fs.readFileSync('js/organization-rbac.js','utf8'),backup=fs.readFileSync('js/backup.js','utf8');
for(const s of ['revalidateFinoraMembership','clearFinoraTenantMemory','finora-membership-lock','setInterval','visibilitychange'])assert(org.includes(s),s+' missing');
assert(org.includes("localStorage.removeItem(STORAGE_KEY)"),'legacy local cache must be purged on known revocation');
assert(org.includes("currentUser=null;showFinoraMembershipLock"),'stale currentUser must not survive known revocation');
assert(org.includes("await sb.auth.signOut()"),'no-membership path must close auth session');
assert(backup.includes("await window.requireFreshFinoraMembership()"),'bulk export must require fresh membership');
console.log('Wave 5b offboarding/revocation invariants passed');
