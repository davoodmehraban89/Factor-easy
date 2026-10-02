import fs from 'node:fs';import assert from 'node:assert/strict';
const backup=fs.readFileSync('js/backup.js','utf8');
assert(backup.includes("!window.finoraCanManageOrganization()"),'privileged backup authorization gate missing');
assert(backup.includes("async function importDataBlob"),'restore must support fresh asynchronous membership verification');
assert((backup.match(/requireFreshFinoraMembership/g)||[]).length>=2,'export and restore must both revalidate membership');
console.log('Wave 5c privileged backup authorization invariants passed');
