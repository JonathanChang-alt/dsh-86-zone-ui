/* Manifest guard.

   A UTF-8 BOM in a profile's package.json makes DSH fail at startup, because
   the host reads the manifest with Node's JSON.parse and that rejects U+FEFF.
   The nasty part is that .NET's ConvertFrom-Json *tolerates* a BOM, so a
   Windows user validating the file with PowerShell sees a pass while the app
   refuses to boot.

   This checks the repository's own manifest, and — when given a path — any
   other manifest too:

     node tests/manifest.mjs
     node tests/manifest.mjs "%USERPROFILE%\.dsh\profiles\desktop\package.json"

   Exit code 1 means: fix the file before DSH touches it. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
let failed = 0;

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed += 1;
}

function inspect(file) {
  const raw = fs.readFileSync(file);
  const bom = raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
  check(`${file} has no BOM`, !bom, bom ? 'bytes start with EF BB BF — DSH will fail to start' : '');
  let parsed = null;
  try {
    parsed = JSON.parse(raw.toString('utf8'));
    check(`${file} parses with JSON.parse`, true);
  } catch (error) {
    check(`${file} parses with JSON.parse`, false, error.message);
  }
  return { raw, parsed };
}

/* ---------------------------------------------------- the repo's own files */

const own = path.join(ROOT, 'package.json');
const { parsed: pkg } = inspect(own);

for (const field of ['name', 'version', 'description', 'license']) {
  check(`package.json has "${field}"`, Boolean(pkg && pkg[field]), String(pkg && pkg[field]));
}

check('package.json keeps its dsh.client contract',
  Boolean(pkg && pkg.dsh && pkg.dsh.client && pkg.dsh.client.platform === 'web'),
  JSON.stringify(pkg && pkg.dsh && pkg.dsh.client));

/* Other text files the host reads at boot: a BOM there is at best noise. */
for (const name of ['cordis.patch.yml', 'client.js', 'index.js']) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) continue;
  const raw = fs.readFileSync(file);
  const bom = raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
  check(`${name} has no BOM`, !bom, bom ? 'strip the BOM' : '');
}

/* ------------------------------------------ an arbitrary manifest, if given */

const target = process.argv[2];
if (target) {
  const file = path.resolve(target);
  if (!fs.existsSync(file)) {
    check(`target manifest exists (${file})`, false, 'no such file');
  } else {
    const { parsed } = inspect(file);
    const bundles = (parsed && parsed.dsh && parsed.dsh.profile && parsed.dsh.profile.bundles) || [];
    check('target manifest lists dsh-86-zone-ui', bundles.includes('dsh-86-zone-ui'), bundles.join(', '));
    check('target manifest loads only one theme plugin at a time',
      bundles.filter((b) => /ui|skin|theme/i.test(b)).length <= 2,
      bundles.join(', '));
  }
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
