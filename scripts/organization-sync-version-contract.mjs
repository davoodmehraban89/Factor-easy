import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('js/organization-rbac.js','utf8');
assert.doesNotMatch(source,/runSync\s*=\s*async\s*function/,'organization layer must not override version-aware runSync');
assert.match(source,/syncVersionSnap\.clear\(\)/,'organization pull must reset version snapshot');
assert.match(source,/snapVersions\.forEach\(\(v,k\)=>syncVersionSnap\.set\(k,v\)\)/,'organization pull must restore server versions');
assert.match(source,/FINORA_SERVER_VERSION_MISSING/,'organization pull must reject rows without valid server version');
console.log('organization sync preserves optimistic concurrency and server version snapshots');
