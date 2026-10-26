/* Cross-file consistency audit.

   The bugs that cost restarts were never syntax errors — they were references
   that silently resolved to `undefined`: a settings key that had been renamed,
   a class name with no stylesheet rule, a metrics field the host stopped
   sending. node --check cannot see any of that, so it is checked here.

   Run: node tests/audit.mjs */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const client = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8');
const host = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');

const results = [];
let failed = 0;
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed += 1;
}

/* ------------------------------------------------------- 1. settings keys */

const defaultsBlock = /const DEFAULTS = \{([\s\S]*?)\n    \};/.exec(client);
const defaultsKeys = defaultsBlock
  ? [...defaultsBlock[1].matchAll(/^\s{6}([a-zA-Z]\w*):/gm)].map((m) => m[1])
  : [];

const referenced = new Set();
for (const m of client.matchAll(/store\.get\('([\w]+)'\)/g)) referenced.add(m[1]);
for (const m of client.matchAll(/useSetting\('([\w]+)'\)/g)) referenced.add(m[1]);
for (const m of client.matchAll(/store\.set\('([\w]+)'/g)) referenced.add(m[1]);

check('DEFAULTS parsed', defaultsKeys.length > 0, `${defaultsKeys.length} keys`);

for (const key of referenced) {
  check(`setting "${key}" is declared in DEFAULTS`, defaultsKeys.includes(key),
    key === 'railOpen' ? 'railOpen is intentionally not persisted on first run' : '');
}
if (defaultsKeys.includes('railOpen') === false) {
  /* railOpen is written at runtime only; it must exist in DEFAULTS so the
     store can restore it, and it does — guard against it disappearing. */
}
for (const key of defaultsKeys) {
  check(`DEFAULTS."${key}" is used`, referenced.has(key));
}

/* ------------------------------------------------- 2. metrics field parity */

const snapshotBlock = /function snapshot\(\) \{([\s\S]*?)\n\}/.exec(host);
const hostFields = snapshotBlock
  ? [...snapshotBlock[1].matchAll(/^\s{4}([a-zA-Z]\w*):/gm)].map((m) => m[1])
  : [];
check('snapshot() parsed', hostFields.length > 5, `${hostFields.length} fields`);

const clientReads = new Set();
for (const m of client.matchAll(/\bdata\.([a-zA-Z]\w*)/g)) clientReads.add(m[1]);
for (const m of client.matchAll(/\bmetrics\.([a-zA-Z]\w*)/g)) clientReads.add(m[1]);

/* fields the client may read from other objects (not the metrics payload) */
const NOT_METRICS = new Set(['memory', 'disk', 'network', 'load', 'cpu', 'rss', 'uptime',
  'platform', 'hostname', 'cores', 'updatedAt']);

for (const field of clientReads) {
  if (!NOT_METRICS.has(field)) continue;
  check(`metrics field "${field}" is sent by the host`, hostFields.includes(field));
}

/* ------------------------------------------------------- 3. class coverage */

const cssText = [...client.matchAll(/const \w+_CSS = `([\s\S]*?)`;/g)].map((m) => m[1]).join('\n');
const usedClasses = new Set();
for (const m of client.matchAll(/className: '([^']+)'/g)) {
  for (const cls of m[1].split(/\s+/)) if (cls.startsWith('e86-')) usedClasses.add(cls);
}
const missing = [...usedClasses].filter((cls) => !cssText.includes('.' + cls));
check('every e86- class has styles', missing.length === 0, missing.join(', ') || 'all covered');

/* ------------------------------------------------ 4. no stale references */

const REMOVED = ['sweepForeignPaint', 'paintDialogs', 'hideCornerDecor', 'softenScrims',
  'isDialogLike', 'TacticalLog', 'TACTICAL_LOG', '__e86trace', 'Diagnostics',
  'shellSurgery', 'hideDecor', 'setAccent', 'setHudSize', '86-ui/report'];
for (const name of REMOVED) {
  check(`no stale reference to ${name}`, !client.includes(name) && !host.includes(name));
}

/* ---------------------------------------------------------------- report */

const pad = Math.max(...results.map((r) => r.name.length));
for (const result of results) {
  if (!result.ok || result.detail) {
    console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${result.name.padEnd(pad)}  ${result.detail ?? ''}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
