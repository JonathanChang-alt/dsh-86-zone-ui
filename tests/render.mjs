/* Render smoke test.

   A component that throws takes its whole slot down with it — which is exactly
   how the status rail once vanished from the screen while the header avatar
   stayed. The contract test never calls the component bodies, so this file
   does: every registered slot component is invoked once with stub hooks and a
   plausible props object. Anything undefined at render time throws here.

   Run: node tests/render.mjs */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8');

const results = [];
let failed = 0;
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed += 1;
}

function makeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

function makeReact() {
  const element = (type, props, ...children) => ({ type, props: props || {}, children });
  return {
    createElement: element,
    Fragment: 'Fragment',
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {},
    useRef: (initial) => ({ current: initial === undefined ? null : initial }),
  };
}

let captured = null;
const sandbox = {
  window: {
    __ModuleLoader__: { load: (entry) => { captured = entry; } },
    localStorage: makeStorage({ 'e86:railOpen': '1' }),
    innerWidth: 1440,
    innerHeight: 900,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
    getComputedStyle: () => ({ position: 'static', zIndex: 'auto', backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'none' }),
    fetch: () => Promise.resolve({ ok: false }),
    location: { reload() {} },
  },
  document: {
    documentElement: { setAttribute() {}, removeAttribute() {}, style: { setProperty() {}, removeProperty() {} } },
    body: { appendChild() {}, removeChild() {}, insertBefore() {}, firstChild: null, children: [], querySelectorAll: () => [], querySelector: () => null },
    title: 'DSH',
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({ style: { cssText: '' }, setAttribute() {}, appendChild() {}, getContext: () => ({ clearRect() {}, fillText() {}, set font(v) {} }) }),
    addEventListener() {},
    removeEventListener() {},
    elementsFromPoint: () => [],
    hidden: false,
  },
  console,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'client.js' });

const React = makeReact();
const plugin = captured.factory((id) => {
  if (id === 'react') return React;
  throw new Error('unexpected require: ' + id);
});

/* collect registrations exactly like the contract test does */
const registered = [];
let ctx;
const disposers = [];
ctx = {
  theme: { register: () => () => {}, overrideTokens: () => () => {} },
  slots: {
    inject: (name, fn) => fn(),
    register: (spec, component) => { registered.push({ name: spec.name, id: spec.id || spec.priority, component }); return () => {}; },
  },
  effect: (fn) => { try { const d = fn(); if (typeof d === 'function') disposers.push(d); } catch (e) { check('apply effect ran', false, e.message); } },
  on: () => {},
  logger: { info() {}, warn() {}, debug() {} },
};

try {
  plugin.apply(ctx);
  check('apply() ran', true);
} catch (error) {
  check('apply() ran', false, error.message);
}

const sampleData = {
  cpu: 24.5,
  memory: { total: 17179869184, used: 12884901888, percent: 75 },
  disk: { total: 500107862016, used: 250053931008, percent: 50 },
  load: [3.9, 3.2, 3.0],
  network: { rxBps: 1840, txBps: 460 },
  rss: 314572800,
  uptime: 494979,
  platform: 'darwin',
  hostname: 'test.local',
  cores: 10,
  updatedAt: Date.now(),
};

const PROPS = { data: sampleData, metrics: sampleData, blips: 3 };

/* A component can also "render fine" and still return null — that is how the
   rail disappeared once. Walk the tree and look for the expected root class. */
function findClass(node, cls, depth = 0) {
  if (!node || depth > 12) return false;
  if (node.props && typeof node.props.className === 'string' && node.props.className.split(/\s+/).includes(cls)) return true;
  const children = node.children || [];
  return children.some((child) => (child && typeof child === 'object' ? findClass(child, cls, depth + 1) : false));
}

const EXPECT_CLASS = {
  'shell.overlay:e86-rail': 'e86-rail',
  'shell.overlay:e86-logo': 'e86-logo',
  'shell.overlay:e86-ticker': 'e86-ticker',
  'shell.overlay:e86-rain': null,
};

for (const entry of registered) {
  const label = entry.name + (entry.id ? ':' + entry.id : '');
  try {
    const tree = entry.component(PROPS);
    check('renders ' + label, tree !== undefined, typeof tree);
    const wanted = EXPECT_CLASS[label];
    if (wanted) {
      const found = findClass(tree, wanted);
      check(label + ' yields .' + wanted, found, found ? '' : 'returned ' + (tree === null ? 'null' : 'a tree without it'));
    }
  } catch (error) {
    check('renders ' + label, false, (error && error.message) || String(error));
  }
}

/* ---------------------------------------------------------------- report */

const pad = Math.max(...results.map((r) => r.name.length));
for (const result of results) {
  console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${result.name.padEnd(pad)}  ${result.detail ?? ''}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
