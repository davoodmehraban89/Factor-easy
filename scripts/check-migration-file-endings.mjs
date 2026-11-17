import fs from 'node:fs';
import path from 'node:path';

const root = 'supabase/migrations';
const files = fs.readdirSync(root).filter((name) => name.endsWith('.sql')).sort();
const failures = [];

for (const name of files) {
  const file = path.join(root, name);
  const content = fs.readFileSync(file, 'utf8');
  if (/(?:\\\\[nrt]|\\\\)$/.test(content)) {
    failures.push({ file, tail: JSON.stringify(content.slice(-40)) });
  }
}

if (failures.length) {
  for (const failure of failures) {
    console.error(`INVALID_LITERAL_ESCAPE_AT_EOF ${failure.file} tail=${failure.tail}`);
  }
  process.exitCode = 1;
} else {
  console.log(`PASS: scanned ${files.length} SQL migrations; no literal escape sequences at EOF.`);
}
