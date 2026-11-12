// Copies src/core/schema.sql into src/core/schema.generated.ts so the app can
// run the schema without reading files at runtime.
// Run after editing schema.sql:  npm run schema
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const core = fileURLToPath(new URL('../src/core/', import.meta.url));
// Normalize Windows line endings so the embedded copy is the same on every OS.
const sql = readFileSync(core + 'schema.sql', 'utf8').replace(/\r\n/g, '\n');
const out =
  '// GENERATED from schema.sql by scripts/embed-schema.mjs. Do not edit.\n' +
  `export const SCHEMA_V1 = ${JSON.stringify(sql)};\n`;
writeFileSync(core + 'schema.generated.ts', out);
console.log('Wrote src/core/schema.generated.ts');
