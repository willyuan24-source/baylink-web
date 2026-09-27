// Route QA (lane D2, D2-14): walks each finished route (data/sf/routes.ts, the generated walks of data/sf/routePaths.ts)
// in the running app and measures what the player sees.
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/routes-qa.mjs [--route r1|r2|r3] [--port 5174] [--step 25]
//        [--out <dir>] [--mobile] [--extra "&time=night"] [--shots stops|all|none]
//
// Every `step` u along the walk the player is teleported onto it (the city focused and ready there first), the follow
// camera faces the walking direction, and after the view settles it records: the city's draw calls, triangles (shadows
// included) and programs; D2's AI landmark parts in the view (sites.counts().ai: triangles, draws; their shadow casters);
// and whether a T1 / T2 landmark (the SF registry, plus the district's Coit Tower / Transamerica / Salesforce / Ferry
// Building in city mode) is on screen: any corner of its bounding box projected through the real camera inside the
// viewport, within 1,000 u (T1) / 520 u (T2) — the plan's G5 check (occlusion ignored). JPEGs at every stop (or every
// sample with --shots all) go to --out (default C:/Users/willy/opus-qa/routes). Prints one JSON line per sample and a
// summary per route; exits 1 when a route misses the gates (on-screen ≥ 90 %, calls ≤ 150, triangles ≤ 400k, AI ≤ 60k
// triangles / 12 draws / 6 casters per view).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROUTE_PATHS } from '../../src/opus-bay/data/sf/routePaths.ts';
import { SF_ROUTES, routePointAt } from '../../src/opus-bay/data/sf/routes.ts';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const ROOT = path.resolve(import.meta.dirname, '../..');
const port = arg('port', '5174'), step = Number(arg('step', '25')), only = arg('route', null);
const out = arg('out', 'C:/Users/willy/opus-qa/routes'), extra = arg('extra', ''), shots = arg('shots', 'stops');
const mobile = process.argv.includes('--mobile');
fs.mkdirSync(out, { recursive: true });

/**
 * Installed once per page as window.__rq (the command line stays short): go(x, z, fx, fz) focuses the city on the
 * sample, teleports the player there and faces the walking direction; measure() returns the counts below.
 */
const setupExpr = `(() => { window.__rq = {
go: async (x, z, fx, fz) => {
  const ob = window.__opusBay;
  const flow = await import('/src/opus-bay/game/flow.ts');
  const cinema = await import('/src/opus-bay/game/cinema.ts');
  ob.world.clearCam();
  await ob.city.focus(x, z, 150);
  flow.teleportPlayer({ x, z });
  ob.city.focus(null);
  cinema.faceCameraToward(fx, fz);
  return 'ok';
},
measure: async () => {
  const ob = window.__opusBay, cam = ob.world.camera;
  const lm = await import('/src/opus-bay/world/sf/landmarks/index.ts');
  const info = await import('/src/opus-bay/data/sf/landmarks.ts');
  const sites = ob.city.streamer.opts.sites;
  const baseOf = new Map(sites.sites.map(s => [s.l.id, s.baseY]));
  const targets = [];
  for (const l of lm.SF_LANDMARKS) {
    if (l.tier === 3) continue;
    const e = l.exclude, r = Math.min(40, 'r' in e ? e.r : Math.max(...e.poly.map(p => Math.hypot(p.x - l.x, p.z - l.z))));
    const b = baseOf.get(l.id) ?? 0, h = Math.max(4, info.sfLandmarkInfo(l.id)?.height.u ?? 6);
    if (l.id === 'golden-gate-bridge') {
      const c = Math.cos(l.yaw), s = Math.sin(l.yaw);
      for (let x = -230; x <= 192; x += 40) targets.push({ id: l.id, x: l.x + x * c, z: l.z - x * s, r: 3, y0: 0, y1: Math.abs(Math.abs(x) - 89.3) < 25 ? 42.2 : 16.2, far: 1000 });
      continue;
    }
    targets.push({ id: l.id, x: l.x, z: l.z, r, y0: b, y1: b + h, far: l.tier === 1 ? 1000 : 520 });
  }
  const H = { 'coit-tower': 26, transamerica: 33, 'salesforce-tower': 45, 'ferry-building': 13 };
  for (const d of ob.district.landmarks) if (H[d.kind]) targets.push({ id: d.id, x: d.position.x, z: d.position.z, r: 3, y0: d.baseY ?? 0, y1: (d.baseY ?? 0) + H[d.kind], far: 1000 });
  cam.updateMatrixWorld();
  const P = cam.projectionMatrix.elements, V = cam.matrixWorldInverse.elements;
  const project = (x, y, z) => {
    const vx = V[0] * x + V[4] * y + V[8] * z + V[12], vy = V[1] * x + V[5] * y + V[9] * z + V[13], vz = V[2] * x + V[6] * y + V[10] * z + V[14];
    const cx = P[0] * vx + P[4] * vy + P[8] * vz + P[12], cy = P[1] * vx + P[5] * vy + P[9] * vz + P[13], cw = P[3] * vx + P[7] * vy + P[11] * vz + P[15];
    return cw > 0 ? [cx / cw, cy / cw] : null;
  };
  const onScreen = [];
  for (const t of targets) {
    if (Math.hypot(t.x - cam.position.x, t.z - cam.position.z) > t.far) continue;
    let hit = false;
    for (const [ox, oz] of [[0, 0], [t.r, 0], [-t.r, 0], [0, t.r], [0, -t.r]]) for (const y of [t.y0 + 0.5, (t.y0 + t.y1) / 2, t.y1]) {
      const q = project(t.x + ox, y, t.z + oz);
      if (q && Math.abs(q[0]) <= 1 && Math.abs(q[1]) <= 1) hit = true;
    }
    if (hit && !onScreen.includes(t.id)) onScreen.push(t.id);
  }
  const st = ob.city.stats(), ai = st.sites.ai;
  let casters = 0;
  for (const s of sites.sites) if (s.mesh && s.ai) s.mesh.traverse(o => { if (o.isMesh && o.name.includes(':ai:') && o.castShadow) casters++; });
  const p = ob.runtime.player;
  return JSON.stringify({ calls: st.calls, tris: st.triangles, programs: st.programs, ai: { tris: ai.triangles, draws: ai.draws, casters }, onScreen, player: [+p.x.toFixed(1), +p.z.toFixed(1)] });
} }; return 'rq'; })()`;
/** samples per Chrome session (the Windows command line holds ≈ 32k characters of actions) */
const BATCH = 20;

let failed = false;
for (const r of SF_ROUTES) {
  if (only && r.id !== only) continue;
  const walk = ROUTE_PATHS[r.id], samples = [];
  for (let s = 0; s <= walk.length + 1e-6; s += step) samples.push(s);
  if (samples[samples.length - 1] < walk.length - 1) samples.push(walk.length);
  const stopSample = new Set(walk.stopAt.map(a => samples.reduce((b, s, i) => (Math.abs(s - a) < Math.abs(samples[b] - a) ? i : b), 0)));
  const hide = `(() => { const s = document.createElement('style'); s.textContent = 'body *{visibility:hidden !important} canvas{visibility:visible !important}'; document.head.appendChild(s); return 'hud off'; })()`;
  const url = `http://localhost:${port}/opus-bay?start=free&world=city&time=golden&quality=high&save=off${extra}`;
  const rows = [];
  for (let b0 = 0; b0 < samples.length; b0 += BATCH) {
    const actions = [{ do: 'wait', ms: 9000 }, { do: 'eval', label: 'hud', expr: hide }, { do: 'eval', label: 'setup', expr: setupExpr }];
    for (let i = b0; i < Math.min(samples.length, b0 + BATCH); i++) {
      const s = samples[i], p = routePointAt(r.id, s), f = routePointAt(r.id, Math.min(walk.length, s + 30));
      actions.push({ do: 'eval', label: `go ${i}`, expr: `window.__rq.go(${p.x.toFixed(2)}, ${p.z.toFixed(2)}, ${f.x.toFixed(2)}, ${f.z.toFixed(2)})` });
      actions.push({ do: 'wait', ms: 2600 });
      if (shots === 'all' || (shots === 'stops' && stopSample.has(i))) actions.push({ do: 'shot', name: path.join(out, `${r.id}-${String(Math.round(s)).padStart(4, '0')}.jpg`) });
      actions.push({ do: 'eval', label: `m ${i}`, expr: 'window.__rq.measure()' });
    }
    const argv = [path.join(ROOT, 'scripts/opus-shot.mjs'), '--url', url, '--out', path.join(out, `${r.id}.jpg`), '--wait', '9000', '--actions', JSON.stringify(actions)];
    if (mobile) argv.push('--mobile', '--dpr', '3');
    const res = execFileSync('node', argv, { cwd: ROOT, env: { ...process.env, CHROME_FLAGS: process.env.CHROME_FLAGS ?? '--force_high_performance_gpu' }, encoding: 'utf8', maxBuffer: 256 << 20, timeout: 30 * 60 * 1000 });
    for (const line of res.split('\n')) {
      let o; try { o = JSON.parse(line); } catch { continue; }
      if (typeof o.eval === 'string' && o.eval.startsWith('m ') && typeof o.value === 'string' && o.value.startsWith('{')) {
        const v = JSON.parse(o.value), i = Number(o.eval.slice(2));
        rows.push({ route: r.id, at: Math.round(samples[i]), ...v });
        console.log(JSON.stringify(rows[rows.length - 1]));
      } else if (o.exception || o.console === 'error') console.log(JSON.stringify({ route: r.id, problem: (o.exception ?? o.text ?? '').slice(0, 200) }));
    }
  }
  const seen = rows.filter(q => q.onScreen.length).length / Math.max(1, rows.length);
  const max = k => Math.max(...rows.map(q => (k === 'ai.tris' ? q.ai.tris : k === 'ai.draws' ? q.ai.draws : k === 'ai.casters' ? q.ai.casters : q[k])));
  const summary = {
    route: r.id, samples: rows.length, onScreen: +(seen * 100).toFixed(1), misses: rows.filter(q => !q.onScreen.length).map(q => q.at),
    maxCalls: max('calls'), maxTris: max('tris'), programs: [Math.min(...rows.map(q => q.programs)), max('programs')],
    maxAiTris: max('ai.tris'), maxAiDraws: max('ai.draws'), maxAiCasters: max('ai.casters'),
  };
  const ok = summary.onScreen >= 90 && summary.maxCalls <= 150 && summary.maxTris <= 400_000 && summary.maxAiTris <= 60_000 && summary.maxAiDraws <= 12 && summary.maxAiCasters <= 6;
  if (!ok) failed = true;
  console.log(JSON.stringify({ summary, gates: ok ? 'pass' : 'FAIL' }));
  fs.writeFileSync(path.join(out, `${r.id}.json`), JSON.stringify({ summary, rows }, null, 1));
}
process.exit(failed ? 1 : 0);
