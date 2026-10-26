/* Contract test: mount the client bundle against a fake cordis context.

   This is the closest thing to "does it register correctly" without launching
   DSH. It executes the real client.js in a VM with a stub React and a stub
   `window`, then drives apply() and inspects what the plugin registered.

   Run: node tests/contract.mjs */

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

/* ------------------------------------------------------------------ stubs */

function makeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    _map: map,
  };
}

function makeReact() {
  const element = (type, props, ...children) => ({ type, props: props || {}, children });
  return {
    createElement: element,
    Fragment: 'Fragment',
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {},
    useRef: (initial) => ({ current: initial }),
  };
}

function boot(seed) {
  const storage = makeStorage(seed);
  const root = {
    attrs: {},
    setAttribute(name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    style: {
      props: {},
      setProperty(name, value) { this.props[name] = value; },
      removeProperty(name) { delete this.props[name]; },
    },
  };
  let captured = null;
  const sandbox = {
    window: {
      __ModuleLoader__: { load: (entry) => { captured = entry; } },
      localStorage: storage,
      setTimeout: () => 0,
      clearTimeout: () => {},
      setInterval: () => 0,
      clearInterval: () => {},
      location: { reload: () => {} },
    },
    document: {
      documentElement: root,
      title: 'DSH',
      querySelector: () => null,
      addEventListener: () => {},
    },
    React: makeReact(),
    console,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'client.js' });
  const plugin = captured.factory((id) => {
    if (id === 'react') return sandbox.React;
    throw new Error('unexpected require: ' + id);
  });
  return { plugin, captured, root, storage };
}

function makeCtx() {
  const calls = {
    themeRegister: [],
    themeOverride: [],
    slotsInject: [],
    slotsRegister: [],
    effects: [],
    disposers: [],
  };
  const ctx = {
    theme: {
      register(spec) {
        calls.themeRegister.push(spec);
        const dispose = () => calls.disposers.push('theme:' + spec.id);
        return dispose;
      },
      overrideTokens(id, tokens) {
        calls.themeOverride.push({ id, tokens });
        return () => calls.disposers.push('override:' + id);
      },
    },
    slots: {
      inject(name, fn) {
        calls.slotsInject.push(name);
        return fn();
      },
      register(spec, component) {
        calls.slotsRegister.push({ spec, component });
        return () => calls.disposers.push('slot:' + (spec.id || spec.name));
      },
    },
    effect(fn) {
      const dispose = fn();
      calls.effects.push(dispose);
      return dispose;
    },
  };
  return { ctx, calls };
}

/* ------------------------------------------------------------------ case 1 */

{
  const { plugin, captured, root } = boot({});
  check('module id', captured.id === 'dsh-86-zone-ui', captured.id);
  check('factory returns inject array', Array.isArray(plugin.inject), JSON.stringify(plugin.inject));
  check('injects slots + theme', plugin.inject.includes('slots') && plugin.inject.includes('theme'));
  check('factory returns apply', typeof plugin.apply === 'function');

  const { ctx, calls } = makeCtx();
  plugin.apply(ctx);

  check('theme registered', calls.themeRegister.length === 1, String(calls.themeRegister.length));
  const theme = calls.themeRegister[0];
  check('theme id', theme.id === 'e86-zone', theme.id);
  check('theme is dark', theme.colorScheme === 'dark', theme.colorScheme);
  check('theme tokens >= 15', Object.keys(theme.tokens || {}).length >= 15, String(Object.keys(theme.tokens || {}).length));
  check('tokens are flat values', Object.values(theme.tokens).every((v) => typeof v === 'string' && v.startsWith('#')));

  const override = calls.themeOverride[0];
  check('overrideTokens called', Boolean(override), override ? override.id : 'missing');
  const pairs = Object.values(override.tokens || {});
  check('override carries light+dark', pairs.length > 0 && pairs.every((v) => v.light && v.dark));

  check('settings section always registered', calls.slotsInject.includes('settings.section'));
  const seats = calls.slotsRegister.map((entry) => entry.spec.name);
  /* backdrop + rain + decor + lockup + rail + ticker all render into the shell overlay */
  check('overlay carries every overlay layer', seats.filter((s) => s === 'shell.overlay').length === 6, seats.join(','));
  check('hero mark registered', seats.includes('conversation.hero.brand.mark'), seats.join(','));
  check('footer action registered', seats.includes('sidebar.footer.action'));
  check('brand name registered', seats.includes('sidebar.brand.name'));
  check('settings section component', seats.includes('settings.section'));
  check('every registration got a component', calls.slotsRegister.every((entry) => typeof entry.component === 'function'));

  check('effect registered', calls.effects.length === 1 && typeof calls.effects[0] === 'function');
  check('html marked', root.attrs['data-e86'] === 'on', JSON.stringify(root.attrs));
  check('accent vars written', Boolean(root.style.props['--e86-line']), String(root.style.props['--e86-line']));

  /* teardown must release every registration and unmark the root */
  calls.effects[0]();
  check('teardown disposes theme', calls.disposers.some((d) => d.startsWith('theme:')), calls.disposers.join(','));
  /* Four sealed slots belong to the switch; settings.section is deliberately
     left mounted so the theme can be re-armed from the UI that turned it off. */
  const slotDisposers = calls.disposers.filter((d) => d.startsWith('slot:'));
  check('teardown disposes the switched slots', slotDisposers.length === 9, `${slotDisposers.length}: ${slotDisposers.join(',')}`);
  check('teardown unmarks html', !root.attrs['data-e86'], JSON.stringify(root.attrs));
  check('teardown clears accent var', !root.style.props['--e86-line']);
}

/* ------------------------------------------------------------------ case 2 */

{
  /* Master switch off: no theme, no decorative slots, but the settings page
     that turns it back on must still be reachable. */
  const { plugin, captured } = boot({ 'e86:enabled': '0' });
  const { ctx, calls } = makeCtx();
  plugin.apply(ctx);
  check('disabled: theme not registered', calls.themeRegister.length === 0, String(calls.themeRegister.length));
  check('disabled: settings reachable', calls.slotsInject.includes('settings.section'));
  check('disabled: overlay not mounted', !calls.slotsInject.includes('shell.overlay'), calls.slotsInject.join(','));
  check('disabled: module still loads', captured.id === 'dsh-86-zone-ui');
}

/* ---------------------------------------------------------------- report */

const pad = Math.max(...results.map((r) => r.name.length));
for (const result of results) {
  console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${result.name.padEnd(pad)}  ${result.detail ?? ''}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
