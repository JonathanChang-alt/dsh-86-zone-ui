/* Self-check for the 86 ZONE theme.
   Run: node tests/selfcheck.mjs

   There is no browser in this repo, so the checks are static: manifest shape,
   syntax, CSS brace balance, slot names against the known seat list, absence of
   remote calls and of the heaviest anti-patterns, and a WCAG contrast table for
   the token pairs that actually carry text. */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
let failed = 0;

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed += 1;
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

/* ---------------------------------------------------------------- manifest */

const pkg = JSON.parse(read('package.json'));
check('package.json name', pkg.name === 'dsh-86-zone-ui', pkg.name);
check('package.json type=module', pkg.type === 'module');
check('main entry exists', fs.existsSync(path.join(ROOT, pkg.main)), pkg.main);
check('exports ./client', pkg.exports && pkg.exports['./client'] === './client.js');
check('dsh.client.platform=web', pkg.dsh?.client?.platform === 'web');
check('dsh.bundle.patch declared', pkg.dsh?.bundle?.patch === './cordis.patch.yml');
check('client.js in files', (pkg.files || []).includes('client.js'));

const patch = read('cordis.patch.yml');
check('cordis.patch.yml inserts e86-zone', /- id:\s*e86-zone/.test(patch));
check('cordis.patch.yml names the package', patch.includes(pkg.name));

/* ----------------------------------------------------------------- syntax */

for (const file of ['index.js', 'client.js']) {
  let ok = true;
  let detail = 'ok';
  try {
    execFileSync(process.execPath, ['--check', path.join(ROOT, file)], { stdio: 'pipe' });
  } catch (error) {
    ok = false;
    detail = String(error.stderr || error.message).slice(0, 300);
  }
  check(`node --check ${file}`, ok, detail);
}

/* --------------------------------------------------------------------- css */

const client = read('client.js');
const cssBlocks = [...client.matchAll(/const (\w+_CSS) = `([\s\S]*?)`;/g)];

check('at least 4 CSS layers', cssBlocks.length >= 4, `${cssBlocks.length} blocks`);
for (const [, name, css] of cssBlocks) {
  const open = (css.match(/\{/g) || []).length;
  const close = (css.match(/\}/g) || []).length;
  check(`${name} braces balanced`, open === close, `${open} { / ${close} }`);
  check(`${name} has no remote url()`, !/url\(\s*['"]?https?:/.test(css));
}

/* ------------------------------------------------------------------ slots */

const KNOWN_SLOTS = new Set([
  'shell.overlay',
  'sidebar.footer.action',
  'sidebar.brand.name',
  'sidebar.brand.mark',
  'conversation.hero.brand.mark',
  'settings.section',
]);
const slotNames = [...client.matchAll(/name:\s*'([a-z][\w.]*\.[\w.]+)'/g)].map((m) => m[1]);
check('slots found', slotNames.length > 0, `${slotNames.length} registrations`);
for (const slot of new Set(slotNames)) {
  check(`slot "${slot}" is a known seat`, KNOWN_SLOTS.has(slot));
}

/* -------------------------------------------------------------- hygiene */

check('no eval', !/\beval\s*\(/.test(client));
check('no new Function', !/new Function/.test(client));
check('no document.write', !/document\.write/.test(client));
check('no remote origin in client', !/https?:\/\/(?!www\.w3\.org)/.test(client));
const host = read('index.js');
check('no remote origin in host', !/https?:\/\//.test(host));
check('host imports only execFile', /import \{ execFile \} from "node:child_process"/.test(host));
check('host never sets shell:true', !/shell:\s*true/.test(host));
check('host vm_stat call is fixed-argv', host.includes('execFileAsync("/usr/bin/vm_stat", []'));
check('no inlined base64 media', !/data:image\/[a-z]+;base64/.test(client), 'client.js stays small');

const size = Buffer.byteLength(client, 'utf8');
check('client.js under 140 KB', size < 140 * 1024, `${(size / 1024).toFixed(1)} KB`);

/* ------------------------------------------------------------- contrast */

function luminance(hex) {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TOKENS = {};
for (const [, key, value] of client.matchAll(/'(--dsw-[\w-]+)':\s*'(#[0-9a-fA-F]{6})'/g)) {
  TOKENS[key] = value;
}

const PAIRS = [
  ['label-primary / bg-base', '--dsw-alias-label-primary', '--dsw-alias-bg-base', 7],
  ['label-primary / layer-2', '--dsw-alias-label-primary', '--dsw-alias-bg-layer-2', 7],
  ['label-secondary / bg-base', '--dsw-alias-label-secondary', '--dsw-alias-bg-base', 4.5],
  ['label-secondary / layer-1', '--dsw-alias-label-secondary', '--dsw-alias-bg-layer-1', 4.5],
  ['label-tertiary / bg-base', '--dsw-alias-label-tertiary', '--dsw-alias-bg-base', 3],
  ['brand / bg-base', '--dsw-alias-brand-primary', '--dsw-alias-bg-base', 4.5],
  ['warn / bg-base', '--dsw-alias-state-warn-primary', '--dsw-alias-bg-base', 4.5],
  ['error / bg-base', '--dsw-alias-state-error-primary', '--dsw-alias-bg-base', 4.5],
];

check('token count', Object.keys(TOKENS).length >= 15, `${Object.keys(TOKENS).length} tokens`);

for (const [label, fg, bg, min] of PAIRS) {
  if (!TOKENS[fg] || !TOKENS[bg]) {
    check(`contrast ${label}`, false, 'token missing');
    continue;
  }
  const ratio = contrast(TOKENS[fg], TOKENS[bg]);
  check(`contrast ${label} >= ${min}`, ratio >= min, ratio.toFixed(2) + ':1');
}

/* ---------------------------------------------------------------- report */

const pad = Math.max(...results.map((r) => r.name.length));
for (const result of results) {
  const mark = result.ok ? 'ok  ' : 'FAIL';
  console.log(`${mark} ${result.name.padEnd(pad)}  ${result.detail ?? ''}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
