// Budget views (lane C2-1): drives /opus-bay?world=city through a fixed list of views with scripts/opus-shot.mjs and
// records, per view, renderer.info (calls / triangles / programs), the city streamer stats and the per-group
// breakdown of world/sf/stats.ts breakdown() (main pass after frustum culling + the sun's shadow pass), plus a JPEG.
//
//   node scripts/opus-sf/qa/budget-views.mjs --out /tmp/c2/base-golden [--port 5201] [--time golden] [--quality high]
//        [--views tp-walk,tp-high] [--pool tile] [--wait 20000] [--w 960 --h 600] [--karl 0] [--hud 1] [--mobile [--dpr 3]]
//        [--shot "node scripts/opus-shot.mjs"]   (cloud: --shot /tmp/claude-0/bin/opus-shot)
//
// Writes <out>/views.json (every number), <out>/views.md (the table) and <out>/<view>.jpg. Needs the dev server
// (npx vite --config vite.opus.config.ts --port <port>): the helpers import game modules by their dev URLs.
// `node scripts/opus-sf/qa/budget-views.mjs --table <out>/views.json` re-prints the table of an earlier run.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, cur, i, arr) => {
  if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));

/**
 * The views. `go`: stream there, teleport the player (nav.arrivalSpot within 30 u when `arrival`), face the camera
 * toward (fx, fz): the walking camera. `cam`: the QA camera (world.cam) at p looking at t, streaming focused on f.
 */
export const VIEWS = [
  { id: 'ferry', note: 'Ferry gate (hero district, walking)', go: { anchor: 'ferry-gate', fx: 100, fz: 60 } },
  // the perf table's own spots (scripts/opus-sf/qa/perf, wave 3): the Ferry gate facing (60, 120), the Dragon Gate
  { id: 'perf-ferry', note: 'Ferry gate as the perf table stands there (facing 60, 120)', go: { anchor: 'ferry-gate', fx: 60, fz: 120 } },
  { id: 'perf-chinatown', note: 'Chinatown, the Dragon Gate, as the perf table stands there', go: { x: 86.3, z: 178.1, fx: 81.9, fz: 174.7, arrival: true } },
  { id: 'tp-walk', note: 'Twin Peaks summit, walking view toward downtown', go: { x: 128.9, z: 922.7, fx: 125, fz: 500, arrival: true } },
  { id: 'tp-high', note: 'Twin Peaks high (≈ 70 u above the summit) → Ferry Building', cam: { p: [140, 115, 1000], t: [132, 0, 15], f: [128.9, 922.7] } },
  { id: 'tp-high250', note: 'Twin Peaks 250 u (wave-1 worst case)', cam: { p: [180, 250, 1150], t: [60, 0, 400], f: [128, 900] } },
  { id: 'coit-high', note: 'Coit Tower top → the city', cam: { p: [-60, 65, 30], t: [60, 0, 400], f: [-30, 100] } },
  { id: 'glide-mission', note: '80 u over the Mission (195, 648)', cam: { p: [195, 85, 700], t: [195, 5, 600], f: [195, 648] } },
  { id: 'painted', note: 'Alamo Square, Painted Ladies (walking)', go: { x: -7.1, z: 585.2, fx: 10.2, fz: 570.4, arrival: true } },
  { id: 'mission', note: 'Mission blocks at 40 u', cam: { p: [440, 45, 640], t: [330, 0, 540], f: [370, 580] } },
  { id: 'sunset', note: 'Sunset district at 60 u → the ocean', cam: { p: [-60, 70, 1560], t: [-330, 0, 1520], f: [-150, 1545] } },
  { id: 'marina', note: 'Marina at 40 u → the Bay', cam: { p: [-280, 45, 420], t: [-400, 0, 320], f: [-360, 360] } },
  { id: 'ocean', note: 'Ocean Beach (walking)', go: { x: -478.1, z: 1416, fx: -530, fz: 1466, arrival: true } },
  // Karl the Fog / night light field (lane C2-8 / C2-9)
  { id: 'tp-west', note: 'Twin Peaks high → the Sunset / Richmond and the Pacific (Karl)', cam: { p: [150, 120, 1000], t: [-420, 0, 1180], f: [128.9, 922.7] } },
  { id: 'tp-gate', note: 'Twin Peaks high → the Golden Gate (Karl pours in at golden hour)', cam: { p: [150, 120, 1000], t: [-865, 0, 505], f: [128.9, 922.7] } },
  // Karl at walking height (M3, wave 3): the owner's Twin Peaks look (eye height ≈ 15 u over the summit, the camera
  // turned west / to the Gate: the rig's own summit view faces downtown, faceCameraToward yields to its zone view there),
  // the Sunset inside the bank, Crissy Field → the Gate
  { id: 'tp-eye-west', note: 'Twin Peaks summit at eye height → the Sunset and the Pacific (Karl rolling in)', cam: { p: [140, 62, 935], t: [-420, 20, 1180], f: [128.9, 922.7] } },
  { id: 'tp-eye-gate', note: 'Twin Peaks summit at eye height → the Golden Gate', cam: { p: [140, 62, 935], t: [-865, 20, 505], f: [128.9, 922.7] } },
  { id: 'sunset-walk', note: 'walking in the Outer Sunset → Ocean Beach (inside the bank in the morning)', go: { x: -250, z: 1330, fx: -470, fz: 1440, arrival: true } },
  { id: 'crissy-walk', note: 'walking on Crissy Field → the Golden Gate Bridge (Karl through the Gate)', go: { x: -560, z: 545, fx: -860, fz: 505, arrival: true } },
  { id: 'ggb-crissy', note: 'the Golden Gate Bridge from above Crissy Field (deck and tower lights at night)', cam: { p: [-500, 38, 470], t: [-865, 15, 508], f: [-560, 520] } },
  { id: 'hero-far', note: 'the hero district from Nob Hill, ≈ 400 u (hero far: L1 boxes + ground stand-in)', cam: { p: [-60, 55, 470], t: [20, 0, 70], f: [-40, 460] } },
  // the Marin and East Bay boards, the Bay Bridge east span, the world's edges (lane C2-7 / C2-13, wave 3)
  { id: 'marin-gate', note: 'above Crissy Field → the Golden Gate and the Marin Headlands (Hawk Hill, the north end)', cam: { p: [-560, 55, 600], t: [-1100, 20, 520], f: [-600, 560] } },
  { id: 'ggb-north', note: 'the GGB north end (deck 15.2 meets the Marin ground), looking north up the Waldo grade', cam: { p: [-975, 26, 430], t: [-1120, 20, 250], f: [-940, 470] } },
  { id: 'sausalito', note: 'over the Bay off Sausalito → the hillside town', cam: { p: [-1150, 45, 60], t: [-1400, 10, 180], f: [-900, 250] } },
  { id: 'ferry-east', note: 'over the Ferry Building → the Bay Bridge, Oakland and the East Bay hills', cam: { p: [160, 45, 40], t: [600, 0, -900], f: [140, 40] } },
  { id: 'tp-east', note: 'Twin Peaks high → downtown and the East Bay (the far edge)', cam: { p: [140, 115, 1000], t: [520, 0, -600], f: [128.9, 922.7] } },
  { id: 'bridge-east', note: 'off Yerba Buena → the east span (SAS tower, skyway) to the Oakland touchdown', cam: { p: [150, 40, -440], t: [500, 8, -950], f: [180, -420] } },
  { id: 'world-high', note: 'high over the Presidio → the whole Bay (the world edges, the far fade)', cam: { p: [-500, 420, 900], t: [300, 0, -700], f: [-400, 700] } },
  { id: 'oakland', note: 'a glide over the Port of Oakland → downtown Oakland and the hills (the board dressing up close)', cam: { p: [560, 70, -560], t: [1080, 10, -1180], f: [300, -300] } },
  { id: 'sausalito-close', note: 'low over Richardson Bay → Sausalito and Belvedere', cam: { p: [-1180, 22, 20], t: [-1330, 12, 140], f: [-900, 250] } },
  { id: 'ybi-east', note: 'above Treasure Island → the east span leaving Yerba Buena (the SAS tower)', cam: { p: [120, 45, -380], t: [240, 5, -520], f: [180, -420] } },
  { id: 'touchdown', note: 'the skyway coming down to the Oakland touchdown and the toll plaza', cam: { p: [380, 30, -700], t: [520, 2, -900], f: [300, -300] } },
];

const HELPERS = `window.__qb = {
  m: null,
  async mods() {
    if (!this.m) this.m = { flow: await import('/src/opus-bay/game/flow.ts'), cinema: await import('/src/opus-bay/game/cinema.ts'), nav: await import('/src/opus-bay/actors/nav.ts'), district: await import('/src/opus-bay/data/district.ts') };
    return this.m;
  },
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); },
  async ready(timeout) {
    const t0 = performance.now();
    while (performance.now() - t0 < timeout) { const ob = window.__opusBay; if (ob && ob.city && ob.world && ob.city.stats().status === 'streaming') return true; await this.sleep(500); }
    return false;
  },
  async go(v) {
    const m = await this.mods(); const ob = window.__opusBay; const t0 = performance.now();
    ob.world.clearCam();
    let x = v.x, z = v.z;
    if (v.anchor) { const a = m.district.DISTRICT.anchors[v.anchor]; x = a.x; z = a.z; }
    const ready = await Promise.race([ob.city.focus(x, z, 150).then(() => true), this.sleep(120000).then(() => false)]);
    let p = { x, z };
    if (v.arrival) { const a = m.nav.arrivalSpot(p, 30); if (a) p = a; }
    m.flow.teleportPlayer(p);
    ob.city.focus(null);
    if (v.fx !== undefined) m.cinema.faceCameraToward(v.fx, v.fz);
    return JSON.stringify({ ready, ms: Math.round(performance.now() - t0), p: { x: +p.x.toFixed(1), z: +p.z.toFixed(1) } });
  },
  async cam(v) {
    const ob = window.__opusBay; const t0 = performance.now();
    ob.world.cam(...v.p, ...v.t, ...v.f);
    const ready = await Promise.race([ob.city.whenReady(v.f[0], v.f[1], 150).then(() => true), this.sleep(120000).then(() => false)]);
    return JSON.stringify({ ready, ms: Math.round(performance.now() - t0) });
  },
  measure(id) {
    try { return this.measure1(id); } catch (e) { return 'measure failed: ' + (e && e.message) + ' @ ' + location.href; }
  },
  measure1(id) {
    const ob = window.__opusBay; const r = ob.renderer.info; const s = ob.city.stats();
    const b = ob.city.breakdown();
    const round = rec => Object.fromEntries(Object.entries(rec).sort((a, b) => b[1].triangles - a[1].triangles));
    return JSON.stringify({ id, calls: r.render.calls, triangles: r.render.triangles, programs: r.programs.length,
      city: { l0: s.l0, l1: s.l1, l2: s.l2, l0T: s.l0Triangles, l1T: s.l1Triangles, l2T: s.l2Triangles, queued: s.queued, inflight: s.inflight, errors: s.errors, heroFar: s.heroFar, camH: s.camH, hazeDepth: s.hazeDepth, boards: s.boards, props: s.props, sites: s.sites },
      breakdown: b && { groups: round(b.groups), shadow: round(b.shadow), total: b.total, shadowTotal: b.shadowTotal },
      quality: ob.game ? ob.game.get().settings.quality : null, lost: ob.renderer.getContext().isContextLost() });
  },
};
'ok'`;

function table(rows) {
  const k = n => (n / 1000).toFixed(0) + 'k';
  const top = (b, n = 5) => b ? Object.entries(b.groups).slice(0, n).map(([g, r]) => `${g} ${r.calls}/${k(r.triangles)}`).join(', ') : '';
  const lines = ['| view | calls | triangles | programs | L0 / L1 / L2 | est. main + shadow (calls / tris) | biggest groups (calls / tris) |', '|---|---|---|---|---|---|---|'];
  for (const r of rows) {
    if (!r.m) { lines.push(`| ${r.id} | — | — | — | — | — | not measured |`); continue; }
    const b = r.m.breakdown;
    lines.push(`| ${r.id} | ${r.m.calls} | ${r.m.triangles.toLocaleString('en-US')} | ${r.m.programs} | ${r.m.city.l0} / ${r.m.city.l1} / ${r.m.city.l2} | ${b ? `${b.total.calls}+${b.shadowTotal.calls} / ${k(b.total.triangles)}+${k(b.shadowTotal.triangles)}` : ''} | ${top(b)} |`);
  }
  return lines.join('\n');
}

if (args.table) {
  console.log(table(JSON.parse(fs.readFileSync(args.table, 'utf8')).rows));
  process.exit(0);
}

const out = path.resolve(args.out || 'budget-views');
fs.mkdirSync(out, { recursive: true });
const port = args.port || 5201;
const q = new URLSearchParams({ start: 'free', world: 'city', time: args.time || 'golden', quality: args.quality || 'high' });
if (args.pool) q.set('pool', args.pool);
if (args.karl !== undefined) q.set('karl', args.karl);
const url = `http://localhost:${port}/opus-bay?${q}`;
const pick = args.views ? String(args.views).split(',') : null;
const views = VIEWS.filter(v => !pick || pick.includes(v.id));
const wait = Number(args.wait || 20000);

const acts = [
  { do: 'eval', label: 'helpers', expr: HELPERS },
  { do: 'eval', label: 'boot', expr: 'window.__qb.ready(180000)' },
  { do: 'wait', ms: 8000 },
];
// clean frames: hide the HUD (every element that is not the canvas or one of its ancestors); --hud 1 keeps it
const HIDE = "(() => { const c = document.querySelector('canvas'); let n = 0; for (const e of document.body.querySelectorAll('*')) if (c && !e.contains(c) && e !== c) { e.style.visibility = 'hidden'; n++; } return n; })()";
const clean = String(args.hud ?? '0') === '0';
if (clean) acts.push({ do: 'eval', label: 'hud', expr: HIDE });
for (const v of views) {
  acts.push({ do: 'eval', label: `pos ${v.id}`, expr: v.go ? `window.__qb.go(${JSON.stringify(v.go)})` : `window.__qb.cam(${JSON.stringify(v.cam)})` });
  acts.push({ do: 'wait', ms: v.wait ?? wait });
  acts.push({ do: 'eval', label: `measure ${v.id}`, expr: `window.__qb ? window.__qb.measure('${v.id}') : 'no helpers: ' + location.href` });
  // cards and toasts that opened since (a discovery, a place card) are hidden too
  if (clean) acts.push({ do: 'eval', label: 'hud', expr: HIDE });
  acts.push({ do: 'shot', name: path.join(out, `${v.id}.jpg`) });
}
const shot = String(args.shot || 'node scripts/opus-shot.mjs').split(' ');
const cmd = [...shot.slice(1), '--url', url, '--w', String(args.w || 960), '--h', String(args.h || 600), '--wait', String(args.bootwait || 30000), '--out', path.join(out, 'last.jpg'), ...(args.mobile ? ['--mobile', '--dpr', String(args.dpr || 3)] : []), '--actions', JSON.stringify(acts)];
console.error(`[budget-views] ${views.length} views → ${out}\n  ${url}`);
const child = spawn(shot[0], cmd, { stdio: ['ignore', 'pipe', 'inherit'] });
let buf = '';
const events = [];
child.stdout.on('data', d => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    try { const e = JSON.parse(line); events.push(e); if (e.eval || e.shot || e.exception || e.error) console.error('  ', line.slice(0, 200)); } catch { /* not ours */ }
  }
});
child.on('close', code => {
  const rows = views.map(v => {
    const pos = events.find(e => e.eval === `pos ${v.id}`);
    const m = events.find(e => e.eval === `measure ${v.id}`);
    let pv = null, mv = null;
    try { pv = pos && JSON.parse(pos.value); } catch { pv = pos?.value ?? null; }
    try { mv = m && JSON.parse(m.value); } catch { mv = null; }
    return { id: v.id, note: v.note, view: v.go ?? v.cam, pos: pv, m: mv };
  });
  const console_ = events.filter(e => e.console || e.exception).map(e => e.console ? `${e.console}: ${e.text}` : `exception: ${e.exception}`);
  fs.writeFileSync(path.join(out, 'views.json'), JSON.stringify({ url, date: new Date().toISOString(), exit: code, rows, console: console_ }, null, 1));
  const md = `# budget views\n\n${url}\n\n${table(rows)}\n`;
  fs.writeFileSync(path.join(out, 'views.md'), md);
  console.log(md);
  process.exit(code ?? 1);
});
