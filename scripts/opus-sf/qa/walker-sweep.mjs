// W5-F4 (lane F, plan sf-w5-plan.md §2 MF2 "the sweep") · the live walk sweep: the real game in headless Chrome, the real
// controller, camera and streaming, driven through the DEV `__opusBay` hooks (a dev server: `npx vite --config
// vite.opus.config.ts --port <PORT>`). One Chrome at a time; never while C:/Users/willy/opus-qa/w5/PERF-LOCK exists.
//
//   CHROME_FLAGS="--force_high_performance_gpu" node scripts/opus-sf/qa/walker-sweep.mjs --port 5501 \
//     [--targets C:/Users/willy/opus-qa/w5/sweep/targets.json] [--static C:/.../static.json] [--only fails|all|<kind,…>]
//     [--limit N] [--deck] [--routes] [--mobile] [--out C:/Users/willy/opus-qa/w5/sweep/live]
//
// Phases (each optional):
//   targets  teleport to each target (targets.json from sweep-static.mts; `--only fails` = the static sweep's non-ok
//            ones), wait for its ground to stream in, push W, D, S, A for 1.5 s each (camera-relative: four directions
//            90° apart), back to the spot between pushes. STUCK = fewer than 3 of 4 directions move ≥ 3 u (plan MF2).
//            A shot of every stuck target (JPEG) for the contact sheet.
//   deck     the Golden Gate Bridge deck end to end, both ways, holding W with the follow camera: the slowest 3 s
//            window (u/s), the camera yaw's largest angle to the deck axis, whether it reached the far end (plan MF2:
//            speed never under 3 u/s over any 3 s, camera within 25° of the axis).
//   routes   the three walking routes stop to stop with a tap-to-walk target (runtime.player.pathTarget): a leg stalls
//            when the player makes < 1 u of progress in 5 s, or runs past 2.5 × its straight-line time.
// Output: <out>/live.json and <out>/sheet.html (every failure's shot with its numbers). Console: one line per failure.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes(k);
const PORT = arg('--port', '5501');
const MOBILE = flag('--mobile');
const W = MOBILE ? 390 : 1440, H = MOBILE ? 844 : 900;
const SWEEP = 'C:/Users/willy/opus-qa/w5/sweep';
const OUT = path.resolve(arg('--out', `${SWEEP}/live${MOBILE ? '-phone' : ''}`));
const TARGETS = arg('--targets', `${SWEEP}/targets.json`);
const STATIC = arg('--static', `${SWEEP}/static.json`);
const ONLY = arg('--only', 'fails');
const LIMIT = Number(arg('--limit', '9999'));
const PHASES = { targets: !flag('--no-targets'), deck: flag('--deck'), routes: flag('--routes') };
fs.mkdirSync(OUT, { recursive: true });
if (fs.existsSync('C:/Users/willy/opus-qa/w5/PERF-LOCK')) { console.error('PERF-LOCK exists: a perf gate is running — try again later'); process.exit(3); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = o => console.log(JSON.stringify(o));

// ---------------------------------------------------------------------------------------------------------------
// Chrome over the DevTools protocol (as scripts/opus-shot.mjs: its own profile, a port Chrome picks)
// ---------------------------------------------------------------------------------------------------------------

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-walker-'));
const chromePath = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const extra = process.env.CHROME_FLAGS ? process.env.CHROME_FLAGS.split(' ') : [];
const chrome = spawn(chromePath, [...extra, '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--enable-gpu', '--ignore-gpu-blocklist', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params })); });
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`${expr.slice(0, 80)}: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
  return r.result?.value;
};
const key = async (type, code) => {
  const k = code.startsWith('Key') ? code.slice(3).toLowerCase() : code;
  await send('Input.dispatchKeyEvent', { type, code, key: k, text: type === 'keyDown' && k.length === 1 ? k : undefined });
};
const hold = async (code, ms) => { await key('keyDown', code); await sleep(ms); await key('keyUp', code); };
const shot = async (file) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 72 }); fs.writeFileSync(file, Buffer.from(r.data, 'base64')); return file; };

async function connect() {
  let port = 0;
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !port; i++) { try { port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]) || 0; } catch { /* not yet */ } if (!port) await sleep(100); }
  if (!port) throw new Error('Chrome did not start');
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find(t => t.type === 'page')) break; } catch { /* retry */ } await sleep(200); }
  const page = targets.find(t => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
    else if (m.method === 'Runtime.exceptionThrown') log({ exception: (m.params.exceptionDetails.exception?.description ?? '').slice(0, 300) });
  });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: MOBILE ? 3 : 1, mobile: MOBILE });
  if (MOBILE) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
}

// ---------------------------------------------------------------------------------------------------------------
// In-page helpers
// ---------------------------------------------------------------------------------------------------------------

const Q = 'window.__opusBay';
const pos = () => evaluate(`(()=>{const p=${Q}.runtime.player;return {x:p.x,z:p.z,y:p.y,locked:p.locked,mode:${Q}.game.get().move.mode,cam:${Q}.runtime.camera.yaw}})()`);
/** teleport and wait (≤ 8 s) for the ground there to be resident (canStand true) and a quiet frame */
async function teleport(x, z, heading = 0) {
  await evaluate(`(()=>{const f=${Q}.flow.get(); if(${Q}.game.get().dialogue.nodeId) ${Q}.actions.closeDialogue(); ${Q}.actions.teleportPlayer({x:${x},z:${z}},${heading}); return 1})()`);
  let ok = false;
  for (let i = 0; i < 40 && !ok; i++) { await sleep(200); ok = await evaluate(`${Q}.terrain.canStand(${x},${z},0.4)`); }
  await evaluate(`(()=>{${Q}.actions.teleportPlayer({x:${x},z:${z}},${heading}); return 1})()`);
  await sleep(350);
  return ok;
}
/** keep the screen free for the sweep: close a dialogue, the goals card, a panel */
const tidy = () => evaluate(`(()=>{const a=${Q}.actions; if(${Q}.game.get().dialogue.nodeId) a.closeDialogue(); if(${Q}.game.get().panel.kind) a.closePanel(); if(${Q}.flow.get().goalsCard) ${Q}.flow.set({goalsCard:false}); return 1})()`);

// ---------------------------------------------------------------------------------------------------------------

const results = { at: new Date().toISOString(), url: null, device: MOBILE ? 'phone 390x844' : 'desktop 1440x900', targets: [], deck: [], routes: [] };
const failures = [];
try {
  await connect();
  const url = `http://localhost:${PORT}/opus-bay?world=city&start=free&at=ferry-gate${MOBILE ? '&quality=mid' : ''}`;
  results.url = url;
  await send('Page.navigate', { url });
  for (let i = 0; i < 60; i++) { await sleep(1000); if (await evaluate(`!!(${Q} && ${Q}.actors && ${Q}.terrain && ${Q}.actions)`).catch(() => false)) break; }
  await sleep(4000);
  await tidy();

  // --- targets --------------------------------------------------------------------------------------------------
  if (PHASES.targets) {
    let list = JSON.parse(fs.readFileSync(TARGETS, 'utf8'));
    if (ONLY === 'fails') { const st = JSON.parse(fs.readFileSync(STATIC, 'utf8')); const bad = new Set(st.results.filter(r => r.verdict !== 'ok' && r.verdict !== 'CORRIDOR').map(r => r.id)); list = list.filter(t => bad.has(t.id)); }
    else if (ONLY !== 'all') { const kinds = ONLY.split(','); list = list.filter(t => kinds.includes(t.kind)); }
    list = list.slice(0, LIMIT);
    for (const [i, t] of list.entries()) {
      const ground = await teleport(t.x, t.z);
      const dirs = [];
      for (const code of ['KeyW', 'KeyD', 'KeyS', 'KeyA']) {
        await teleport(t.x, t.z);
        await tidy();
        const a = await pos();
        await hold(code, 1500);
        const b = await pos();
        dirs.push(+Math.hypot(b.x - a.x, b.z - a.z).toFixed(2));
      }
      const moving = dirs.filter(d => d >= 3).length;
      const r = { id: t.id, owner: t.owner, kind: t.kind, x: t.x, z: t.z, ground, dirs, moving, stuck: moving < 3 };
      if (r.stuck || !ground) {
        await teleport(t.x, t.z);
        await tidy();
        r.shot = await shot(path.join(OUT, `${t.id.replace(/[^a-z0-9-]+/gi, '_')}.jpg`));
        failures.push({ phase: 'target', ...r });
        log({ fail: r.id, owner: r.owner, dirs, ground });
      }
      results.targets.push(r);
      if ((i + 1) % 20 === 0) console.error(`[walker] ${i + 1} / ${list.length}`);
    }
  }

  const allTargets = JSON.parse(fs.readFileSync(TARGETS, 'utf8'));

  // --- the GGB deck ------------------------------------------------------------------------------------------------
  if (PHASES.deck) {
    const deck = allTargets.filter(t => t.kind === 'deck').sort((a, b) => Number(a.id.split(':')[2]) - Number(b.id.split(':')[2]));
    const s = deck[0], n = deck[deck.length - 1], L = Math.hypot(n.x - s.x, n.z - s.z), ax = (n.x - s.x) / L, az = (n.z - s.z) / L;
    for (const [from, to, sign] of [[s, n, 1], [n, s, -1]]) {
      const heading = Math.atan2(ax * sign, az * sign);
      await teleport(from.x, from.z, heading);
      await sleep(1500);
      await tidy();
      // R: the camera behind the heading (a player turning round at a deck end does the same; a short teleport onto the
      // spot they already stood on does not move the camera by itself)
      await hold('KeyR', 80);
      await sleep(900);
      const samples = [];
      await key('keyDown', 'KeyW');
      const t0 = Date.now();
      let reached = false, midShot = null;
      while (Date.now() - t0 < 150000) {
        await sleep(500);
        const p = await pos();
        const along = ((p.x - s.x) * ax + (p.z - s.z) * az) * sign + (sign < 0 ? L : 0);
        const camFwd = Math.atan2(-Math.sin(p.cam), -Math.cos(p.cam));
        const off = Math.abs(Math.atan2(Math.sin(camFwd - heading), Math.cos(camFwd - heading)));
        samples.push({ t: (Date.now() - t0) / 1000, along: +along.toFixed(1), camOffDeg: Math.round((off * 180) / Math.PI), across: +(((p.x - s.x) * -az + (p.z - s.z) * ax)).toFixed(1) });
        // (W5-F6: one shot half-way over, the camera behind along the deck — the report's evidence)
        if (!midShot && along >= L / 2) { midShot = await shot(path.join(OUT, `deck_mid_${sign > 0 ? 'northbound' : 'southbound'}.jpg`)); }
        if (along >= L - 3) { reached = true; break; }
        const k = samples.length;
        if (k > 12 && samples[k - 1].along - samples[k - 11].along < 1) break;   // no progress for 5 s
      }
      await key('keyUp', 'KeyW');
      let slowest = Infinity;
      for (let i = 6; i < samples.length; i++) slowest = Math.min(slowest, (samples[i].along - samples[i - 6].along) / (samples[i].t - samples[i - 6].t));
      const worstCam = Math.max(...samples.map(q => q.camOffDeg));
      const pulls = await evaluate(`${Q}.actors.feet ? ${Q}.actors.feet.count : -1`);
      const r = { dir: sign > 0 ? 'south → north' : 'north → south', length: +L.toFixed(1), reached, seconds: samples.at(-1)?.t ?? 0, slowest3s: +slowest.toFixed(2), worstCamDeg: worstCam, pulls, midShot, last: samples.at(-1) };
      if (!reached || slowest < 3 || worstCam > 25) { r.shot = await shot(path.join(OUT, `deck_${sign > 0 ? 'north' : 'south'}.jpg`)); failures.push({ phase: 'deck', id: `deck ${r.dir}`, owner: 'F', ...r }); }
      results.deck.push({ ...r, samples });
      log({ deck: r.dir, reached, slowest3s: r.slowest3s, worstCamDeg: worstCam });
    }
  }

  // --- the three routes ------------------------------------------------------------------------------------------
  if (PHASES.routes) {
    const stops = allTargets.filter(t => t.kind === 'route' && !/:via\d+$/.test(t.id));
    for (const rid of ['r1', 'r2', 'r3']) {
      const list = stops.filter(t => t.id.startsWith(`route:${rid}-`));
      if (list.length < 2) continue;
      await teleport(list[0].x, list[0].z);
      for (let i = 1; i < list.length; i++) {
        const to = list[i], a = await pos();
        const straight = Math.hypot(to.x - a.x, to.z - a.z), limit = Math.max(10, (straight / 4.2) * 2.5);
        await tidy();
        await evaluate(`(()=>{${Q}.runtime.player.pathTarget={x:${to.x},z:${to.z}}; return 1})()`);
        const t0 = Date.now();
        let last = a, lastAt = t0, done = false, stalled = false;
        while ((Date.now() - t0) / 1000 < limit) {
          await sleep(500);
          const p = await pos();
          if (Math.hypot(p.x - to.x, p.z - to.z) < 3) { done = true; break; }
          if (Math.hypot(p.x - last.x, p.z - last.z) >= 1) { last = p; lastAt = Date.now(); }
          else if (Date.now() - lastAt > 5000) { stalled = true; break; }
          const tgt = await evaluate(`${Q}.runtime.player.pathTarget`);
          if (!tgt) await evaluate(`(()=>{${Q}.runtime.player.pathTarget={x:${to.x},z:${to.z}}; return 1})()`);
        }
        const p = await pos();
        const r = { route: rid, leg: `${list[i - 1].id} → ${to.id}`, straight: +straight.toFixed(1), seconds: +((Date.now() - t0) / 1000).toFixed(1), done, stalled, left: +Math.hypot(p.x - to.x, p.z - to.z).toFixed(1), at: { x: +p.x.toFixed(1), z: +p.z.toFixed(1) } };
        if (!done) { r.shot = await shot(path.join(OUT, `route_${rid}_${i}.jpg`)); failures.push({ phase: 'route', id: r.leg, owner: 'L', ...r }); log({ routeFail: r.leg, stalled, left: r.left }); }
        results.routes.push(r);
        if (!done) await teleport(to.x, to.z);
      }
    }
  }
} catch (e) { log({ error: String(e) }); }
finally {
  results.failures = failures.length;
  fs.writeFileSync(path.join(OUT, 'live.json'), JSON.stringify(results, null, 1));
  const cards = failures.map(f => `<figure><img src="${path.basename(f.shot ?? '')}" loading="lazy"><figcaption><b>${f.id}</b> · ${f.owner} · ${f.phase}<br>${f.dirs ? `W D S A: ${f.dirs.join(' / ')} u` : f.leg ? `${f.stalled ? 'stalled' : 'too slow'} · ${f.left} u short` : `reached ${f.reached} · slowest 3 s ${f.slowest3s} u/s · camera ≤ ${f.worstCamDeg}°`}</figcaption></figure>`).join('\n');
  fs.writeFileSync(path.join(OUT, 'sheet.html'), `<!doctype html><meta charset="utf-8"><title>Walk sweep failures</title><style>body{font:13px system-ui;margin:16px;background:#f6efe2}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}figure{margin:0;background:#fff;border-radius:8px;overflow:hidden}img{width:100%;display:block}figcaption{padding:6px 8px}</style><h1>Walk sweep · ${results.device} · ${failures.length} failures · ${results.at}</h1><main>${cards}</main>`);
  log({ done: true, targets: results.targets.length, failures: failures.length, out: OUT });
  chrome.kill(); await sleep(300); try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* locked */ }
}
