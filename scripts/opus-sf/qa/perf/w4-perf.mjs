// Wave-4 perf gate runner (lane V, W4-V1 / W4-V9): drives /opus-bay?world=city through the spots and rides of
// w4-spots.json with scripts/opus-shot.mjs (one headless Chrome), records per spot renderer.info (calls / triangles /
// programs), the city stats, 10 s of frame times standing and walking (perf-helpers.js), a JPEG; per ride the frame
// times while a camera travels the ride path at ride speed (streaming focused on the camera), max calls / triangles and
// the worst frame. Writes <out>/w4-perf.json and <out>/w4-perf.md (the gate table: calls ≤ 150, triangles ≤ 400k at
// quality high on desktop; fps ≥ 45 on the phone profile; programs equal at the first and the last measure).
//
//   node scripts/opus-sf/qa/perf/w4-perf.mjs --port 5306 --out C:/Users/willy/opus-qa/w4/w4-v/perf/base [--spots a,b]
//        [--rides 1|0] [--mobile] [--dpr 3] [--quality high|mid] [--throttle 4] [--ms 10000] [--time golden] [--wait 20000]
//   node scripts/opus-sf/qa/perf/w4-perf.mjs --table <out>/w4-perf.json
//
// Desktop gate: CHROME_FLAGS=--force_high_performance_gpu, --quality high (1440 × 900). Phone gate: --mobile --dpr 3
// --quality mid --throttle 4. Needs the dev server (the page imports game modules by their dev URLs).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, cur, i, arr) => {
  if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const here = f => new URL(f, import.meta.url);
const SPOTS = JSON.parse(fs.readFileSync(here('./w4-spots.json'), 'utf8'));

export function gateRow(r, gate = SPOTS.gate) {
  const fails = [];
  const m = r.m || {};
  const calls = Math.max(m.calls ?? 0, r.idle?.calls ?? 0, r.walk?.calls ?? 0, r.ride?.maxCalls ?? 0);
  const tris = Math.max(m.triangles ?? 0, r.idle?.tris ?? 0, r.walk?.tris ?? 0, r.ride?.maxTris ?? 0);
  if (r.profile === 'desktop' && calls > gate.desktop.calls) fails.push('calls');
  if (r.profile === 'desktop' && tris > gate.desktop.triangles) fails.push('tris');
  const fps = Math.min(...[r.idle?.fps, r.walk?.fps, r.ride?.fps].filter(v => typeof v === 'number'));
  if (r.profile === 'phone' && fps < gate.phone.fps) fps < Infinity && fails.push('fps<45');
  const over100 = (r.idle?.over100 ?? 0) + (r.walk?.over100 ?? 0) + (r.ride?.over100 ?? 0);
  if (over100 > 0) fails.push('>100ms');
  return { calls, tris, fps: fps === Infinity ? null : fps, over100, fails };
}

function table(res) {
  const k = n => `${(n / 1000).toFixed(0)}k`;
  const lines = [`profile **${res.profile}** · ${res.url} · ${res.date}`, '',
    '| spot / ride | calls | triangles | programs | fps idle / walk (ride) | p95 ms | frames > 100 ms | gate |', '|---|---|---|---|---|---|---|---|'];
  for (const r of res.rows) {
    const g = gateRow({ ...r, profile: res.profile });
    const fpsCol = r.ride ? `(${r.ride.fps})` : `${r.idle?.fps ?? '—'} / ${r.walk?.fps ?? '—'}`;
    const p95 = r.ride ? r.ride.p95 : r.walk?.p95;
    lines.push(`| ${r.id} | ${g.calls || '—'} | ${g.tris ? k(g.tris) : '—'} | ${r.m?.programs ?? r.ride?.programs ?? '—'} | ${fpsCol} | ${p95 ?? '—'} | ${g.over100} | ${g.fails.length ? 'fail: ' + g.fails.join(', ') : 'pass'} |`);
  }
  lines.push('', `programs first → last: ${res.programs?.first} → ${res.programs?.last}${res.programs && res.programs.first !== res.programs.last ? ' (drift)' : ''}`);
  return lines.join('\n');
}

if (args.table) { console.log(table(JSON.parse(fs.readFileSync(args.table, 'utf8')))); process.exit(0); }

const HELPERS = `window.__w4 = {
  m: null,
  async mods() {
    if (!this.m) this.m = { flow: await import('/src/opus-bay/game/flow.ts'), cinema: await import('/src/opus-bay/game/cinema.ts'), nav: await import('/src/opus-bay/actors/nav.ts'), district: await import('/src/opus-bay/data/district.ts'), terrain: await import('/src/opus-bay/core/terrain.ts') };
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
    const a = m.nav.arrivalSpot(p, 30); if (a) p = a;
    m.flow.teleportPlayer(p);
    ob.city.focus(null);
    if (v.fx !== undefined) m.cinema.faceCameraToward(v.fx, v.fz);
    return JSON.stringify({ ready, ms: Math.round(performance.now() - t0), p: { x: +p.x.toFixed(1), z: +p.z.toFixed(1) } });
  },
  measure() {
    const ob = window.__opusBay; const r = ob.renderer.info; const s = ob.city.stats();
    return JSON.stringify({ calls: r.render.calls, triangles: r.render.triangles, programs: r.programs.length,
      city: { l0: s.l0, l1: s.l1, l2: s.l2, queued: s.queued, errors: s.errors, sites: s.sites },
      quality: ob.game ? ob.game.get().settings.quality : null });
  },
  // a camera ride: along path [[x, z], ...] at speed u/s, camH above the ground, looking lookAhead u ahead
  async ride(rd) {
    const m = await this.mods(); const ob = window.__opusBay; const hAt = m.terrain.heightAt;
    const P = rd.path; const seg = []; let L = 0;
    for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); seg.push(d); L += d; }
    const at = a => { let i = 0; while (i < seg.length - 1 && a > seg[i]) { a -= seg[i]; i++; } const t = Math.min(1, a / (seg[i] || 1)); return [P[i][0] + (P[i + 1][0] - P[i][0]) * t, P[i][1] + (P[i + 1][1] - P[i][1]) * t]; };
    const [sx, sz] = at(0); await Promise.race([ob.city.whenReady(sx, sz, 150), this.sleep(60000)]);
    return await new Promise(done => {
      const d = []; let t0 = 0, last = 0, maxCalls = 0, maxTris = 0;
      requestAnimationFrame(function f(now) {
        if (!t0) t0 = last = now; else { d.push(now - last); last = now; }
        const a = Math.min(L, (now - t0) / 1000 * rd.speed);
        const [x, z] = at(a); const [tx, tz] = at(Math.min(L, a + rd.lookAhead));
        const y = hAt(x, z) + rd.camH;
        ob.world.cam(x, y, z, tx, hAt(tx, tz) + 1.5, tz, x, z);
        const i = ob.renderer.info; maxCalls = Math.max(maxCalls, i.render.calls); maxTris = Math.max(maxTris, i.render.triangles);
        if (a < L) return requestAnimationFrame(f);
        ob.world.clearCam();
        const s = [...d].sort((p, q) => p - q), qn = p => s[Math.min(s.length - 1, Math.floor(p * s.length))];
        done(JSON.stringify({ length: +L.toFixed(0), seconds: +((last - t0) / 1000).toFixed(1), fps: +(1000 * d.length / (last - t0)).toFixed(1),
          p95: +qn(0.95).toFixed(1), p99: +qn(0.99).toFixed(1), over50: d.filter(x => x > 50).length, over100: d.filter(x => x > 100).length,
          worst: +Math.max(...d).toFixed(1), maxCalls, maxTris, programs: i0().programs.length }));
      });
      function i0() { return ob.renderer.info; }
    });
  },
};
'ok'`;

const out = path.resolve(args.out || 'w4-perf');
fs.mkdirSync(out, { recursive: true });
const port = args.port || 5306;
const phone = !!args.mobile;
const q = new URLSearchParams({ start: 'free', world: 'city', time: args.time || 'golden', quality: args.quality || (phone ? 'mid' : 'high') });
const url = `http://localhost:${port}/opus-bay?${q}`;
const pick = args.spots ? String(args.spots).split(',') : null;
const spots = SPOTS.spots.filter(s => !pick || pick.includes(s.id));
const rides = String(args.rides ?? '1') === '1' ? SPOTS.rides.filter(r => !pick || pick.includes(r.id)) : [];
const ms = Number(args.ms || 10000), wait = Number(args.wait || 20000);
const perfHelpers = fs.readFileSync(here('./perf-helpers.js'), 'utf8');

const acts = [
  { do: 'eval', label: 'helpers', expr: HELPERS },
  { do: 'eval', label: 'perf-helpers', expr: perfHelpers },
  { do: 'eval', label: 'info', expr: 'window.__perf.info()' },
  { do: 'eval', label: 'boot', expr: 'window.__w4.ready(180000)' },
  { do: 'wait', ms: 8000 },
  { do: 'eval', label: 'hud', expr: "(() => { const c = document.querySelector('canvas'); let n = 0; for (const e of document.body.querySelectorAll('*')) if (c && !e.contains(c) && e !== c) { e.style.visibility = 'hidden'; n++; } return n; })()" },
];
if (args.throttle) acts.push({ do: 'throttle', rate: Number(args.throttle) });
for (const s of spots) {
  acts.push({ do: 'eval', label: `pos ${s.id}`, expr: `window.__w4.go(${JSON.stringify(s.go)})` });
  acts.push({ do: 'wait', ms: wait });
  acts.push({ do: 'eval', label: `measure ${s.id}`, expr: 'window.__w4.measure()' });
  acts.push({ do: 'shot', name: path.join(out, `${s.id}.jpg`) });
  acts.push({ do: 'eval', label: `idle ${s.id}`, expr: `window.__perf.frames(${ms}, false)` });
  acts.push({ do: 'eval', label: `walk ${s.id}`, expr: `window.__perf.frames(${ms}, true)` });
}
for (const r of rides) {
  acts.push({ do: 'eval', label: `ride ${r.id}`, expr: `window.__w4.ride(${JSON.stringify(r)})` });
  acts.push({ do: 'shot', name: path.join(out, `ride-${r.id}.jpg`) });
}
if (args.throttle) acts.push({ do: 'throttle', rate: 1 });
acts.push({ do: 'eval', label: 'programs-last', expr: 'window.__opusBay.renderer.info.programs.length' });

const shot = String(args.shot || 'node scripts/opus-shot.mjs').split(' ');
const size = phone ? ['--mobile', ...(args.dpr ? ['--dpr', String(args.dpr)] : [])] : ['--w', String(args.w || 1440), '--h', String(args.h || 900)];
const cmd = [...shot.slice(1), '--url', url, ...size, '--wait', String(args.bootwait || 30000), '--out', path.join(out, 'last.jpg'), '--actions', JSON.stringify(acts)];
console.error(`[w4-perf] ${spots.length} spots + ${rides.length} rides → ${out}\n  ${url}`);
const child = spawn(shot[0], cmd, { stdio: ['ignore', 'pipe', 'inherit'] });
let buf = '';
const events = [];
child.stdout.on('data', d => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    try { const e = JSON.parse(line); events.push(e); if (e.eval || e.exception || e.error) console.error('  ', line.slice(0, 220)); } catch { /* not ours */ }
  }
});
child.on('close', code => {
  const val = label => { const e = events.find(x => x.eval === label); try { return e && JSON.parse(e.value); } catch { return e?.value ?? null; } };
  const rows = [
    ...spots.map(s => ({ id: s.id, pos: val(`pos ${s.id}`), m: val(`measure ${s.id}`), idle: val(`idle ${s.id}`), walk: val(`walk ${s.id}`) })),
    ...rides.map(r => ({ id: r.id, ride: val(`ride ${r.id}`) })),
  ];
  const firstProg = rows.find(r => r.m)?.m?.programs ?? null;
  const res = { url, profile: phone ? 'phone' : 'desktop', date: new Date().toISOString(), exit: code, info: val('info'),
    programs: { first: firstProg, last: val('programs-last') }, rows,
    console: events.filter(e => e.console || e.exception).map(e => e.console ? `${e.console}: ${e.text}` : `exception: ${e.exception}`).slice(0, 50) };
  fs.writeFileSync(path.join(out, 'w4-perf.json'), JSON.stringify(res, null, 1));
  const md = `# w4 perf\n\n${table(res)}\n`;
  fs.writeFileSync(path.join(out, 'w4-perf.md'), md);
  console.log(md);
  process.exit(code ?? 1);
});
