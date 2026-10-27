import os from "node:os";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

/* --------------------------------------------------------------------------
   Host side of the 86 ZONE theme.

   Only two routes, both read-only and both local:
     /86-ui/metrics  → CPU / memory / disk / load, sampled in-process
     /86-ui/avatar   → the operator portrait the user dropped into assets/

   Deliberately no outbound network calls (no IP geolocation, no weather, no
   CDN): the theme must work offline and must not tell anyone where the machine
   is. The reference plugin this one was modelled on does call two geolocation
   services — that behaviour is not copied here.
   -------------------------------------------------------------------------- */

const NS = "86-zone-ui";
const BASE = "/86-ui";
const METRICS_PATH = `${BASE}/metrics`;
const AVATAR_PATH = `${BASE}/avatar`;
const BACKGROUND_PATH = `${BASE}/background`;

const ASSET_DIR = fileURLToPath(new URL("./assets/", import.meta.url));

/* Both drop-in assets use the same rule: whatever the user puts in assets/ with
   one of these names is served, first hit wins, no code change needed. */
const AVATAR_CANDIDATES = [
  ["avatar.png", "image/png"],
  ["avatar.webp", "image/webp"],
  ["avatar.jpg", "image/jpeg"],
  ["avatar.jpeg", "image/jpeg"],
  ["avatar.svg", "image/svg+xml"],
];

/* Alternate scenes, chosen with ?scene=. The first entry of each list is
   preferred; the rest are format fallbacks so a JPEG can be swapped for a PNG
   without touching code. */
const SCENES = {
  rail: [
    ["background.jpg", "image/jpeg"],
    ["background.jpeg", "image/jpeg"],
    ["background.png", "image/png"],
  ],
  flowers: [
    ["background-flowers.jpg", "image/jpeg"],
    ["background-flowers.png", "image/png"],
  ],
};

const BACKGROUND_CANDIDATES = [
  ["background.jpg", "image/jpeg"],
  ["background.jpeg", "image/jpeg"],
  ["background.png", "image/png"],
  ["background.webp", "image/webp"],
];

/* Minimal query reader — the host module is deliberately free of URL/origin
   construction so a static check can prove it never reaches the network. */
function queryParam(requestUrl, key) {
  const raw = String(requestUrl || "");
  const mark = raw.indexOf("?");
  if (mark === -1) return null;
  const query = raw.slice(mark + 1).split("#")[0];
  for (const pair of query.split("&")) {
    const eq = pair.indexOf("=");
    const name = eq === -1 ? pair : pair.slice(0, eq);
    if (name !== key) continue;
    try {
      return decodeURIComponent(eq === -1 ? "" : pair.slice(eq + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function resolveAsset(candidates) {
  for (const [file, mime] of candidates) {
    try {
      const stat = fs.statSync(ASSET_DIR + file);
      if (stat.isFile() && stat.size > 0) {
        return { file: ASSET_DIR + file, mime, size: stat.size };
      }
    } catch {
      /* not present: try the next extension */
    }
  }
  return null;
}

function resolveAvatar() {
  return resolveAsset(AVATAR_CANDIDATES);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return null;
  return Math.max(min, Math.min(max, value));
}

/* ---------------------------------------------------------------- sampling */

function cpuTotals() {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    const t = cpu.times || {};
    idle += Number(t.idle) || 0;
    total += Object.values(t).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }
  return { idle, total };
}

let previousCpu = cpuTotals();

function readCpuPercent() {
  const current = cpuTotals();
  const idleDelta = current.idle - previousCpu.idle;
  const totalDelta = current.total - previousCpu.total;
  previousCpu = current;
  if (totalDelta <= 0) return null;
  return clamp((1 - idleDelta / totalDelta) * 100, 0, 100);
}

/* os.freemem() counts only truly free pages, so on macOS it reports ~99% used
   on a healthy machine (inactive + cache pages are not free, but they are
   available). vm_stat gives the breakdown, and free + inactive + speculative is
   the closest thing to "available" macOS offers without private APIs. It is
   read at most every 5s through a fixed argv call, never a shell string. */
let darwinMemory = null;
let darwinMemoryAt = 0;

async function refreshDarwinMemory() {
  if (process.platform !== "darwin") return;
  if (Date.now() - darwinMemoryAt < 5000) return;
  darwinMemoryAt = Date.now();
  try {
    const { stdout } = await execFileAsync("/usr/bin/vm_stat", [], { timeout: 2500, maxBuffer: 256 * 1024 });
    const pageSize = Number((/page size of (\d+)/.exec(stdout) || [])[1] || 0);
    const pages = (label) => Number((new RegExp(String.raw`Pages ${label}:\s+(\d+)`).exec(stdout) || [])[1] || 0);
    const availablePages = pages("free") + pages("inactive") + pages("speculative") + pages("purgeable");
    const total = os.totalmem();
    if (!(pageSize > 0) || !(availablePages > 0) || !(total > 0)) return;
    const available = Math.min(total, availablePages * pageSize);
    darwinMemory = {
      total,
      used: Math.max(0, total - available),
      percent: clamp((1 - available / total) * 100, 0, 100),
    };
  } catch {
    /* no vm_stat: fall back to the portably-wrong reading below */
  }
}

function readMemory() {
  const total = os.totalmem();
  if (!(total > 0)) return null;
  if (process.platform === "darwin" && darwinMemory && darwinMemory.total === total) {
    return darwinMemory;
  }
  const free = os.freemem();
  const used = Math.max(0, total - free);
  return { total, used, percent: clamp((used / total) * 100, 0, 100) };
}

/* statfs works on macOS and Linux as well as Windows (where a drive prefix is
   needed). Falling back to the home directory covers every platform without a
   platform branch. */
function readDisk() {
  try {
    const stats = fs.statfsSync(os.homedir());
    const blockSize = Number(stats.bsize) || 0;
    const blocks = Number(stats.blocks) || 0;
    const free = Number(stats.bfree ?? stats.bavail) || 0;
    const total = blockSize * blocks;
    const freeBytes = blockSize * free;
    if (!(total > 0)) return null;
    return {
      total,
      free: freeBytes,
      used: Math.max(0, total - freeBytes),
      percent: clamp((1 - free / blocks) * 100, 0, 100),
    };
  } catch {
    return null;
  }
}

/* Network throughput. Both platforms expose cumulative byte counters, so the
   same delta logic serves them; only the sampling differs.

   macOS: netstat -ib, summed over physical en* rows that publish a MAC address
          (the <Link#N> rows omit the address column and would shift the parse
          by one field).
   Windows: netstat -e prints a single "Bytes" row with received/sent totals.
          It is machine-wide rather than per-interface, which is exactly what
          a single throughput readout wants. */
let previousNet = null;

function rateFrom(rx, tx) {
  const now = Date.now();
  const sample = { rx, tx, at: now };
  const previous = previousNet;
  previousNet = sample;
  if (!previous) return null;
  const seconds = (now - previous.at) / 1000;
  if (!(seconds > 0.2)) return null;
  /* Compare against the *previous* sample — overwriting the reference before
     subtracting made every rate come out as exactly zero. */
  return {
    rxBps: Math.max(0, (sample.rx - previous.rx) / seconds),
    txBps: Math.max(0, (sample.tx - previous.tx) / seconds),
  };
}

async function readDarwinCounters() {
  const { stdout } = await execFileAsync("/usr/sbin/netstat", ["-ibn"], { timeout: 2000, maxBuffer: 512 * 1024 });
  let rx = 0;
  let tx = 0;
  let seen = 0;
  const line = /^en\d+\s+\d+\s+<Link#\d+>\s+([0-9a-f:]{11,17})\s+(\d+)\s+\d+\s+(\d+)\s+\d+\s+\d+\s+(\d+)/;
  for (const row of stdout.split("\n")) {
    const match = line.exec(row);
    if (!match) continue;
    rx += Number(match[3]) || 0;
    tx += Number(match[4]) || 0;
    seen += 1;
  }
  return seen ? { rx, tx } : null;
}

async function readWindowsCounters() {
  const exe = `${process.env.SystemRoot || "C:\\Windows"}\\System32\\netstat.exe`;
  const { stdout } = await execFileAsync(exe, ["-e"], { timeout: 2000, maxBuffer: 256 * 1024, windowsHide: true });
  for (const row of stdout.split("\n")) {
    const match = /^\s*Bytes\s+(\d+)\s+(\d+)/i.exec(row);
    if (match) return { rx: Number(match[1]), tx: Number(match[2]) };
  }
  return null;
}

async function readNetwork() {
  try {
    let counters = null;
    if (process.platform === "darwin") counters = await readDarwinCounters();
    else if (process.platform === "win32") counters = await readWindowsCounters();
    if (!counters) return null;
    return rateFrom(counters.rx, counters.tx);
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- sampling */


let networkCache = null;

function snapshot() {
  return {
    cpu: readCpuPercent(),
    memory: readMemory(),
    disk: readDisk(),
    load: os.loadavg(),
    network: networkCache,
    uptime: os.uptime(),
    platform: os.platform(),
    hostname: os.hostname(),
    cores: os.cpus().length,
    rss: process.memoryUsage().rss,
    updatedAt: Date.now(),
  };
}

/* --------------------------------------------------------------- transport */

function sendJson(res, code, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": String(body.length),
  });
  res.end(body);
}

function apply(ctx) {
  let webServer;
  try {
    webServer = (typeof ctx?.get === "function" ? ctx.get("webServer") : undefined) || ctx?.webServer;
  } catch {
    webServer = ctx?.webServer;
  }
  if (!webServer || typeof webServer.register !== "function") {
    try { ctx?.logger?.warn?.(`[${NS}] webServer unavailable; routes skipped`); } catch {}
    return;
  }

  /* Reuse DSH's own connection gate instead of inventing auth: the same check
     the shell applies to every other route. */
  const rejected = (req, res) => {
    try {
      const connection = (typeof ctx?.get === "function" ? ctx.get("connection") : undefined) || ctx?.connection;
      if (!connection || typeof connection.requestRejection !== "function") return false;
      const code = connection.requestRejection(req);
      if (code === undefined || code === null || code === false) return false;
      res.statusCode = typeof code === "number" ? code : 403;
      res.end();
      return true;
    } catch {
      return false;
    }
  };

  let latest = snapshot();
  let timer = setInterval(async () => {
    try {
      await refreshDarwinMemory();
      try { networkCache = (await readNetwork()) || networkCache; } catch { /* keep previous */ }
      latest = snapshot();
    } catch {
      /* keep the previous sample */
    }
  }, 2000);
  if (typeof timer.unref === "function") timer.unref();

  const metricsRoute = webServer.register({
    kind: "exact",
    path: METRICS_PATH,
    handler: (req, res) => {
      if (rejected(req, res)) return;
      if (req.method !== "GET") {
        sendJson(res, 405, { ok: false, error: "method not allowed" });
        return;
      }
      /* Refresh on read so the first paint is never a stale zero. The macOS
         memory sample is async and cached; a miss just keeps the last value. */
      try {
        readNetwork().then((value) => { networkCache = value || networkCache; }).catch(() => {});
  refreshDarwinMemory().catch(() => {});
        latest = snapshot();
      } catch {
        /* fall back to the cached sample */
      }
      sendJson(res, 200, { ok: true, data: latest });
    },
  });

  /* One handler for every drop-in image: resolve by candidate list, then
     stream it. Resolved per request so the user can swap a file while DSH
     keeps running and the next paint picks it up. */
  const registerAssetRoute = (path, candidates, label) => webServer.register({
    kind: "exact",
    path,
    handler: (req, res) => {
      if (rejected(req, res)) return;
      if (req.method !== "GET") {
        sendJson(res, 405, { ok: false, error: "method not allowed" });
        return;
      }
      /* /86-ui/avatar?art=03 → assets/portraits/03.png when present.
         Falls back to the normal candidate list so an empty portraits/
         folder never breaks the header. */
      let asset = null;
      try {
        const scene = queryParam(req.url, "scene");
        if (scene && SCENES[scene]) {
          const picked = resolveAsset(SCENES[scene]);
          if (picked) asset = picked;
        }
      } catch {
        /* malformed query: fall through to the default asset */
      }
      try {
        const art = queryParam(req.url, "art");
        if (art && /^[0-9]{2}$/.test(art)) {
          const portrait = resolveAsset([[`portraits/${art}.png`, "image/png"]]);
          if (portrait) asset = portrait;
        }
      } catch {
        /* malformed query: fall through to the default asset */
      }
      if (!asset) asset = resolveAsset(candidates);
      if (!asset) {
        sendJson(res, 404, { ok: false, error: `no ${label} in assets/` });
        return;
      }
      res.writeHead(200, {
        "Content-Type": asset.mime,
        "Content-Length": String(asset.size),
        "Cache-Control": "no-cache",
      });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      const stream = fs.createReadStream(asset.file);
      stream.on("error", () => { try { res.destroy(); } catch { /* gone */ } });
      stream.pipe(res);
    },
  });

  const avatarRoute = registerAssetRoute(AVATAR_PATH, AVATAR_CANDIDATES, "avatar");
  const backgroundRoute = registerAssetRoute(BACKGROUND_PATH, BACKGROUND_CANDIDATES, "background");

  const dispose = () => {
    try { clearInterval(timer); } catch {}
    try { if (typeof metricsRoute === "function") metricsRoute(); } catch {}
    try { if (typeof avatarRoute === "function") avatarRoute(); } catch {}
    try { if (typeof backgroundRoute === "function") backgroundRoute(); } catch {}
  };

  readNetwork().then((value) => { networkCache = value || networkCache; }).catch(() => {});
  refreshDarwinMemory().catch(() => {});
  if (typeof ctx?.effect === "function") ctx.effect(() => dispose, `${NS}: routes`);
  try {
    ctx?.logger?.info?.(`[${NS}] routes ready: ${METRICS_PATH}, ${AVATAR_PATH}, ${BACKGROUND_PATH}`);
  } catch {}

  return dispose;
}

const inject = ["webServer", "connection"];
const name = NS;

export { apply, inject, name };
