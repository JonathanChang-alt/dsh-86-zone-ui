/* Host-side test: import index.js, mount it against a fake webServer, and drive
   the two routes with real request/response shapes.

   Run: node tests/host.mjs */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { apply, inject, name } from '../index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
let failed = 0;
function check(label, ok, detail) {
  results.push({ label, ok, detail });
  if (!ok) failed += 1;
}

check('module name', name === '86-zone-ui', name);
check('injects webServer', inject.includes('webServer'), JSON.stringify(inject));
check('injects connection', inject.includes('connection'), JSON.stringify(inject));
check('apply is a function', typeof apply === 'function');

/* ------------------------------------------------------------- fake server */

const routes = new Map();
const webServer = {
  register(spec) {
    routes.set(spec.path, spec);
    return () => routes.delete(spec.path);
  },
};

let authorized = true;
const connection = {
  requestRejection() {
    return authorized ? false : 401;
  },
};

const disposers = [];
const ctx = {
  get(key) {
    if (key === 'webServer') return webServer;
    if (key === 'connection') return connection;
    return undefined;
  },
  effect(fn) {
    disposers.push(fn());
    return fn();
  },
  logger: { info() {}, warn() {}, debug() {} },
};

const dispose = apply(ctx);
check('routes registered', routes.size === 4, [...routes.keys()].join(', '));
check('metrics route', routes.has('/86-ui/metrics'));
check('avatar route', routes.has('/86-ui/avatar'));
check('background route', routes.has('/86-ui/background'));
check('blueprint route', routes.has('/86-ui/blueprint'));
check('dispose returned', typeof dispose === 'function');

/* ------------------------------------------------------------ fake exchage */

function fakeRes() {
  const chunks = [];
  const out = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  out.status = 0;
  out.headers = {};
  out.writeHead = (status, headers) => {
    out.status = status;
    out.headers = headers || {};
    return out;
  };
  out.body = () => Buffer.concat(chunks);
  out.text = () => out.body().toString('utf8');
  return out;
}

function call(routePath, req) {
  const res = fakeRes();
  /* The router matches on the path; the query travels in req.url, exactly as
     the host receives it. */
  const bare = routePath.split('?')[0];
  routes.get(bare).handler({ ...req, url: routePath }, res);
  return res;
}

function waitFor(res) {
  return new Promise((resolve) => {
    if (res.writableFinished) return resolve(res);
    res.on('finish', () => resolve(res));
    setTimeout(() => resolve(res), 1500);
  });
}

/* ---------------------------------------------------------------- metrics */

await new Promise((resolve) => setTimeout(resolve, 400));

{
  const res = call('/86-ui/metrics', { method: 'GET', headers: {} });
  const payload = JSON.parse(res.text());
  check('metrics 200', res.status === 200, String(res.status));
  check('metrics ok flag', payload.ok === true);
  check('metrics cpu is number or null', payload.data.cpu === null || typeof payload.data.cpu === 'number', String(payload.data.cpu));
  check('metrics cpu in range', payload.data.cpu === null || (payload.data.cpu >= 0 && payload.data.cpu <= 100), String(payload.data.cpu));
  check('metrics memory percent', typeof payload.data.memory?.percent === 'number', String(payload.data.memory?.percent));
  if (process.platform === 'darwin') {
    /* os.freemem() alone reports ~99% on a healthy Mac; the vm_stat correction
       must keep this out of the "everything is on fire" band. */
    check('macOS memory is not the naive 99%', payload.data.memory.percent < 95, payload.data.memory.percent.toFixed(1) + '%');
  }
  check('metrics disk percent', typeof payload.data.disk?.percent === 'number', String(payload.data.disk?.percent));
  check('metrics has network field', payload.data.network === null || typeof payload.data.network === 'object', String(payload.data.network));
  check('metrics reports platform', payload.data.platform === os.platform(), String(payload.data.platform));
  check('metrics cores', payload.data.cores === os.cpus().length, String(payload.data.cores));
  check('metrics no-store', /no-store/.test(res.headers['Cache-Control'] || ''), res.headers['Cache-Control']);
}

{
  const res = call('/86-ui/metrics', { method: 'POST', headers: {} });
  check('metrics rejects POST', res.status === 405, String(res.status));
}

/* --------------------------------------------------------------- auth gate */

{
  authorized = false;
  const res = call('/86-ui/metrics', { method: 'GET', headers: {} });
  check('gated without auth', res.statusCode === 401, String(res.statusCode));
  authorized = true;
}

/* ------------------------------------------------------------ background */

{
  const target = path.join(ROOT, 'assets', 'background.jpg');
  const shipped = fs.existsSync(target);
  if (!shipped) {
    check('background ships with the package', false, 'assets/background.jpg is missing');
  } else {
    const bytes = fs.readFileSync(target);
    const res = call('/86-ui/background', { method: 'GET', headers: {} });
    check('background 200 (shipped)', res.status === 200, String(res.status));
    check('background content-type', res.headers['Content-Type'] === 'image/jpeg', res.headers['Content-Type']);
    await waitFor(res);
    check('background bytes match', res.body().equals(bytes), `${res.body().length} bytes`);
  }

  const parked = target + '.test-parked';
  fs.renameSync(target, parked);
  try {
    const res = call('/86-ui/background', { method: 'GET', headers: {} });
    const payload = JSON.parse(res.text());
    check('background 404 when missing', res.status === 404, String(res.status));
    check('background 404 body', payload.ok === false && /no background/.test(payload.error), payload.error);
  } finally {
    fs.renameSync(parked, target);
  }
}

/* ----------------------------------------------------------------- avatar */

{
  const target = path.join(ROOT, 'assets', 'avatar.png');
  const shipped = fs.existsSync(target);
  const shippedBytes = shipped ? fs.readFileSync(target) : null;

  if (shipped) {
    const res = call('/86-ui/avatar', { method: 'GET', headers: {} });
    check('avatar 200 (shipped)', res.status === 200, String(res.status));
    check('avatar content-type', res.headers['Content-Type'] === 'image/png', res.headers['Content-Type']);
    check('avatar length header', res.headers['Content-Length'] === String(shippedBytes.length), res.headers['Content-Length']);
    await waitFor(res);
    check('avatar bytes match (shipped)', res.body().equals(shippedBytes), `${res.body().length} bytes`);
  } else {
    check('avatar 200 (shipped)', false, 'assets/avatar.png is missing — the HUD would fall back to the emblem');
  }

  /* Park the file to prove the 404 path, then put it straight back. */
  const parked = target + '.test-parked';
  fs.renameSync(target, parked);
  try {
    const res = call('/86-ui/avatar', { method: 'GET', headers: {} });
    const payload = JSON.parse(res.text());
    check('avatar 404 when missing', res.status === 404, String(res.status));
    check('avatar 404 body', payload.ok === false && /no avatar/.test(payload.error), payload.error);
  } finally {
    fs.renameSync(parked, target);
  }

  /* Restored: the route must see it again without any restart. */
  const back = call('/86-ui/avatar', { method: 'GET', headers: {} });
  check('avatar back after restore', back.status === 200, String(back.status));

  /* Portrait switching: ?art=NN serves assets/portraits/NN.png, and an
     unknown index falls back to the default artwork instead of 404. */
  const portrait = path.join(ROOT, 'assets', 'portraits', '03.png');
  if (fs.existsSync(portrait)) {
    const bytes = fs.readFileSync(portrait);
    const res = call('/86-ui/avatar?art=03', { method: 'GET', headers: {} });
    check('avatar ?art=03 status', res.status === 200, String(res.status));
    check('avatar ?art=03 length', res.headers['Content-Length'] === String(bytes.length), res.headers['Content-Length']);
    await waitFor(res);
    check('avatar ?art=03 bytes', res.body().equals(bytes), `${res.body().length} bytes`);
  } else {
    check('avatar ?art=03 status', false, 'assets/portraits/03.png missing');
  }

  /* Scene switching on the background route. */
  const sceneFile = path.join(ROOT, 'assets', 'background-flowers.jpg');
  if (fs.existsSync(sceneFile)) {
    const bytes = fs.readFileSync(sceneFile);
    const res = call('/86-ui/background?scene=flowers', { method: 'GET', headers: {} });
    check('background ?scene=flowers status', res.status === 200, String(res.status));
    check('background ?scene=flowers length', res.headers['Content-Length'] === String(bytes.length), res.headers['Content-Length']);
    await waitFor(res);
    check('background ?scene=flowers bytes', res.body().equals(bytes), `${res.body().length} bytes`);
  } else {
    check('background ?scene=flowers status', false, 'assets/background-flowers.jpg missing');
  }

  const bogusScene = call('/86-ui/background?scene=nope', { method: 'GET', headers: {} });
  check('background ?scene=nope falls back', bogusScene.status === 200, String(bogusScene.status));

  const unknown = call('/86-ui/avatar?art=99', { method: 'GET', headers: {} });
  check('avatar ?art=99 falls back', unknown.status === 200 && unknown.headers['Content-Length'] === String(shippedBytes.length),
    String(unknown.status));
}

/* ------------------------------------------------------------------ report */

const pad = Math.max(...results.map((r) => r.label.length));
for (const result of results) {
  console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${result.label.padEnd(pad)}  ${result.detail ?? ''}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
