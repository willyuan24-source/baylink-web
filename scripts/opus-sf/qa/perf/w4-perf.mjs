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
// Wave 5 (lane V, W5-V1): --file w5-spots.json takes the wave-5 table (the wave-4 spots + the new views; default
// w4-spots.json). A spot with `time` (e.g. irving-night) runs only when the run's --time is its time, and a run whose
// --time some spot carries measures only those spots (`--time night --rides 0`: Irving St at night alone).
// Part b (W5-V1 / V6): --date YYYY-MM-DDTHH:mm starts the Bay clock there (the dev server honours ?date, game/bayNow.ts):
// the event views run on their day — Castro fair day and Hellman Hollow on 2026-10-04T12:00, the jets over Marina Green
// on 2026-10-09T12:40 (`--date … --spots castro,hellman-hollow --rides 0`).
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
const SPOTS = JSON.parse(fs.readFileSync(here(`./${args.file || 'w4-spots.json'}`), 'utf8'));

export function gateRow(r, gate = SPOTS.gate) {
  const fails = [];
  const m = r.m || {};
  const am = r.aim?.cam ? r.aim.m || {} : {};
  const calls = Math.max(m.calls ?? 0, am.calls ?? 0, r.idle?.calls ?? 0, r.walk?.calls ?? 0, r.ride?.maxCalls ?? 0);
  const tris = Math.max(m.triangles ?? 0, am.triangles ?? 0, r.idle?.tris ?? 0, r.walk?.tris ?? 0, r.ride?.maxTris ?? 0);
  if (r.profile === 'desktop' && calls > gate.desktop.calls) fails.push('calls');
  if (r.profile === 'desktop' && tris > gate.desktop.triangles) fails.push('tris');
  const fps = Math.min(...[r.idle?.fps, r.walk?.fps, r.ride?.fps].filter(v => typeof v === 'number'));
  if (r.profile === 'phone' && fps < gate.phone.fps) fps < Infinity && fails.push('fps<45');
  const over100 = (r.idle?.over100 ?? 0) + (r.walk?.over100 ?? 0) + (r.ride?.over100 ?? 0);
  if (over100 > 0) fails.push('>100ms');
  // a spot whose player was moved away before the measure (e.g. back to the district) measured another place: void
  if (m.player && r.pos?.p && Math.hypot(m.player.x - r.pos.p.x, m.player.z - r.pos.p.z) > 40) fails.push(`void: player at ${m.player.x}, ${m.player.z}`);
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
    const id = r.aim?.cam ? `${r.id} (aimed: the walking camera looked ${r.aim.off}° away)` : r.id;
    lines.push(`| ${id} | ${g.calls || '—'} | ${g.tris ? k(g.tris) : '—'} | ${r.m?.programs ?? r.ride?.programs ?? '—'} | ${fpsCol} | ${p95 ?? '—'} | ${g.over100} | ${g.fails.length ? 'fail: ' + g.fails.join(', ') : 'pass'} |`);
  }
  const sess = res.programs?.sessions;
  if (sess && sess.length > 1) lines.push('', `programs first → last, per session: ${sess.map(p => `${p.first} → ${p.last}${p.first !== p.last ? ' (drift)' : ''}`).join(' · ')}`);
  else lines.push('', `programs first → last: ${res.programs?.first} → ${res.programs?.last}${res.programs && res.programs.first !== res.programs.last ? ' (drift)' : ''}`);
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
    // W5-Z: a dialogue the previous spot opened is answered first, as a player would (the HUD is hidden here): the
    // pelican moment at the Twin Peaks spot (a viewpoint unlocks it) otherwise stays open through the next teleports and
    // BAYBAY keeps walking back to it, re-planning a 370 u path every ~4 s (120-170 ms frames at 4x CPU on the phone
    // profile, sf-w5-final-verify.md); no player can leave a dialogue open and travel
    if (ob.game.get().dialogue.nodeId && ob.actions && ob.actions.closeDialogue) ob.actions.closeDialogue();
    let x = v.x, z = v.z;
    if (v.anchor) { const a = m.district.DISTRICT.anchors[v.anchor]; x = a.x; z = a.z; }
    const ready = await Promise.race([ob.city.focus(x, z, 150).then(() => true), this.sleep(120000).then(() => false)]);
    let p = { x, z };
    const a = m.nav.arrivalSpot(p, 30); if (a) p = a;
    m.flow.teleportPlayer(p);
    ob.city.focus(null);
    // the camera's automatic turn is capped at 100° (actors/camera.ts) and an arrival reveal (lane G, wave 4) may play
    // right after the teleport: face uncapped, and again once a reveal is over
    if (v.fx !== undefined) { m.cinema.faceCameraToward(v.fx, v.fz, { uncapped: true }); await this.sleep(6000); m.cinema.faceCameraToward(v.fx, v.fz, { uncapped: true }); }
    return JSON.stringify({ ready, ms: Math.round(performance.now() - t0), p: { x: +p.x.toFixed(1), z: +p.z.toFixed(1) } });
  },
  // the walking camera may still look away from the spot's subject (lane G's camera keeps a clear line of sight: at the
  // Ferry gate it looks over the Bay, not at the Ferry Building): then a QA camera at the walking camera's distance and
  // height behind the player looks at the subject, and that view is measured too ('aim', the gate takes the larger)
  async aimSet(v) {
    const m = await this.mods(); const ob = window.__opusBay; const cam = ob.world.camera; const p = ob.game.get().playerPos;
    if (v.fx === undefined) return JSON.stringify({ off: 0, cam: false });
    const want = Math.atan2(v.fx - p.x, v.fz - p.z); const d = cam.position.clone(); cam.getWorldDirection(d);
    const off = Math.abs(((Math.atan2(d.x, d.z) - want + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 180 / Math.PI;
    if (off < 30) return JSON.stringify({ off: Math.round(off), cam: false });
    const dist = Math.max(4, Math.hypot(cam.position.x - p.x, cam.position.z - p.z)), ux = Math.sin(want), uz = Math.cos(want);
    const tx = p.x + ux * 15, tz = p.z + uz * 15;
    ob.world.cam(p.x - ux * dist, cam.position.y, p.z - uz * dist, tx, m.terrain.heightAt(tx, tz) + 1.5, tz, p.x, p.z);
    return JSON.stringify({ off: Math.round(off), cam: true });
  },
  measure() {
    const ob = window.__opusBay; const r = ob.renderer.info; const s = ob.city.stats();
    return JSON.stringify({ calls: r.render.calls, triangles: r.render.triangles, programs: r.programs.length,
      city: { l0: s.l0, l1: s.l1, l2: s.l2, queued: s.queued, errors: s.errors, sites: s.sites },
      quality: ob.game ? ob.game.get().settings.quality : null,
      // wave 5 (W5-V1): the per-group split of the view (world/sf/stats.ts breakdown: main pass + the sun's shadow pass),
      // the ten biggest groups of each as [group, calls, triangles]: where the headroom goes
      bd: (() => { try { const b = ob.city.breakdown && ob.city.breakdown(); if (!b) return null; const top = rec => Object.entries(rec).sort((p, q) => q[1].triangles - p[1].triangles).slice(0, 10).map(([k, v]) => [k, v.calls, v.triangles]); return { groups: top(b.groups), shadow: top(b.shadow), total: b.total, shadowTotal: b.shadowTotal }; } catch (e) { return String(e); } })(),
      // where the player really is when measured (a spot whose player was moved away, e.g. to the district, is void)
      player: ob.game ? { x: +ob.game.get().playerPos.x.toFixed(1), z: +ob.game.get().playerPos.z.toFixed(1) } : null });
  },
  // a camera ride: along path [[x, z], ...] at speed u/s, camH above the ground, looking lookAhead u ahead
  async ride(rd) {
    const m = await this.mods(); const ob = window.__opusBay; const hAt = m.terrain.heightAt;
    const P = rd.path; const seg = []; let L = 0;
    for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); seg.push(d); L += d; }
    const at = a => { let i = 0; while (i < seg.length - 1 && a > seg[i]) { a -= seg[i]; i++; } const t = Math.min(1, a / (seg[i] || 1)); return [P[i][0] + (P[i + 1][0] - P[i][0]) * t, P[i][1] + (P[i + 1][1] - P[i][1]) * t]; };
    const [sx, sz] = at(0); await Promise.race([ob.city.whenReady(sx, sz, 150), this.sleep(60000)]);
    // part c (W5-V11): stand the camera at the ride's start for 3 s first, so the city the previous spot streamed has
    // unloaded before the maxima are taken (after Pier 45 the rides read 367k / 394k on their first frames, 248k alone)
    { const [tx, tz] = at(Math.min(L, rd.lookAhead)); ob.world.cam(sx, hAt(sx, sz) + rd.camH, sz, tx, hAt(tx, tz) + 1.5, tz, sx, sz); await this.sleep(3000); }
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
if (args.date) q.set('date', String(args.date));
const url = `http://localhost:${port}/opus-bay?${q}`;
const pick = args.spots ? String(args.spots).split(',') : null;
const runTime = args.time || 'golden';
// a timed spot runs only at its time; the untimed ones run unless the file has spots of the run's own time
const timed = SPOTS.spots.some(s => s.time === runTime);
const spots = SPOTS.spots.filter(s => (!pick || pick.includes(s.id)) && (s.time ? s.time === runTime : !timed));
const rides = String(args.rides ?? '1') === '1' ? SPOTS.rides.filter(r => !pick || pick.includes(r.id)) : [];
const ms = Number(args.ms || 10000), wait = Number(args.wait || 20000);
const perfHelpers = fs.readFileSync(here('./perf-helpers.js'), 'utf8');

/** One Chrome session's actions: boot, then the given spots and rides (the helpers are sent with every session). */
function sessionActs(sp, rd) {
  const acts = [
    { do: 'eval', label: 'helpers', expr: HELPERS },
    { do: 'eval', label: 'perf-helpers', expr: perfHelpers },
    { do: 'eval', label: 'info', expr: 'window.__perf.info()' },
    { do: 'eval', label: 'boot', expr: 'window.__w4.ready(180000)' },
    { do: 'wait', ms: 8000 },
    { do: 'eval', label: 'hud', expr: "(() => { const c = document.querySelector('canvas'); let n = 0; for (const e of document.body.querySelectorAll('*')) if (c && !e.contains(c) && e !== c) { e.style.visibility = 'hidden'; n++; } return n; })()" },
  ];
  if (args.throttle) acts.push({ do: 'throttle', rate: Number(args.throttle) });
  for (const s of sp) {
    acts.push({ do: 'eval', label: `pos ${s.id}`, expr: `window.__w4.go(${JSON.stringify(s.go)})` });
    acts.push({ do: 'wait', ms: wait });
    acts.push({ do: 'eval', label: `measure ${s.id}`, expr: 'window.__w4.measure()' });
    acts.push({ do: 'shot', name: path.join(out, `${s.id}.jpg`) });
    acts.push({ do: 'eval', label: `aim ${s.id}`, expr: `window.__w4.aimSet(${JSON.stringify(s.go)})` });
    acts.push({ do: 'wait', ms: 4000 });
    acts.push({ do: 'eval', label: `measure-aim ${s.id}`, expr: 'window.__w4.measure()' });
    acts.push({ do: 'shot', name: path.join(out, `${s.id}-aim.jpg`) });
    acts.push({ do: 'eval', label: `unaim ${s.id}`, expr: 'window.__opusBay.world.clearCam() || "ok"' });
    acts.push({ do: 'eval', label: `idle ${s.id}`, expr: `window.__perf.frames(${ms}, false)` });
    acts.push({ do: 'eval', label: `walk ${s.id}`, expr: `window.__perf.frames(${ms}, true)` });
  }
  for (const r of rd) {
    acts.push({ do: 'eval', label: `ride ${r.id}`, expr: `window.__w4.ride(${JSON.stringify(r)})` });
    acts.push({ do: 'shot', name: path.join(out, `ride-${r.id}.jpg`) });
  }
  if (args.throttle) acts.push({ do: 'throttle', rate: 1 });
  acts.push({ do: 'eval', label: 'programs-last', expr: 'window.__opusBay.renderer.info.programs.length' });
  return acts;
}

// part c (W5-V11): a long table no longer fits one command line (Windows: 32k characters, ENAMETOOLONG with 20 spots +
// 3 rides): the spots and rides are split over as few Chrome sessions as fit, one after the other; each session boots
// the city again, and "programs first → last" is kept per session (the table shows every session's pair)
const MAX_CMD = 26000;
const items = [...spots.map(s => ({ s })), ...rides.map(r => ({ r }))];
const sessions = [];
for (const it of items) {
  const cur = sessions[sessions.length - 1];
  const tryIt = cur ? [...cur, it] : [it];
  const len = JSON.stringify(sessionActs(tryIt.filter(x => x.s).map(x => x.s), tryIt.filter(x => x.r).map(x => x.r))).length;
  if (cur && len > MAX_CMD) sessions.push([it]); else if (cur) cur.push(it); else sessions.push([it]);
}
if (!sessions.length) sessions.push([]);

const shot = String(args.shot || 'node scripts/opus-shot.mjs').split(' ');
const size = phone ? ['--mobile', ...(args.dpr ? ['--dpr', String(args.dpr)] : [])] : ['--w', String(args.w || 1440), '--h', String(args.h || 900)];
console.error(`[w4-perf] ${spots.length} spots + ${rides.length} rides in ${sessions.length} session(s) → ${out}
  ${url}`);

/** Run one Chrome session; resolves with its events and exit code. */
function runSession(acts) {
  const cmd = [...shot.slice(1), '--url', url, ...size, '--wait', String(args.bootwait || 30000), '--out', path.join(out, 'last.jpg'), '--actions', JSON.stringify(acts)];
  return new Promise(resolve => {
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
    child.on('close', code => resolve({ events, code }));
  });
}

const all = [];
const programs = [];
let code = 0;
for (const sess of sessions) {
  const sp = sess.filter(x => x.s).map(x => x.s), rd = sess.filter(x => x.r).map(x => x.r);
  const r = await runSession(sessionActs(sp, rd));
  const val = label => { const e = r.events.find(x => x.eval === label); try { return e && JSON.parse(e.value); } catch { return e?.value ?? null; } };
  const rows = [
    ...sp.map(s => ({ id: s.id, pos: val(`pos ${s.id}`), m: val(`measure ${s.id}`), aim: { ...(val(`aim ${s.id}`) || {}), m: val(`measure-aim ${s.id}`) }, idle: val(`idle ${s.id}`), walk: val(`walk ${s.id}`) })),
    ...rd.map(x => ({ id: x.id, ride: val(`ride ${x.id}`) })),
  ];
  programs.push({ first: rows.find(x => x.m)?.m?.programs ?? null, last: val('programs-last') });
  all.push({ rows, events: r.events, info: val('info') });
  code = code || (r.code ?? 1);
}
{
  const rows = all.flatMap(a => a.rows);
  const events = all.flatMap(a => a.events);
  const res = { url, profile: phone ? 'phone' : 'desktop', date: new Date().toISOString(), exit: code, info: all[0]?.info ?? null,
    programs: { first: programs[0]?.first ?? null, last: programs[programs.length - 1]?.last ?? null, sessions: programs }, rows,
    console: events.filter(e => e.console || e.exception).map(e => e.console ? `${e.console}: ${e.text}` : `exception: ${e.exception}`).slice(0, 50) };
  fs.writeFileSync(path.join(out, 'w4-perf.json'), JSON.stringify(res, null, 1));
  const md = `# w4 perf\n\n${table(res)}\n`;
  fs.writeFileSync(path.join(out, 'w4-perf.md'), md);
  console.log(md);
  process.exit(code);
}

