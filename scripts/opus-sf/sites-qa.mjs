// Wave-4 site QA (lane L, W4-L8): for every new site, 8 samples on a ring around it plus the named views (street,
// high), each with renderer.info (calls / triangles / programs), the city's per-group breakdown, the site's own lod-0
// state and its on-screen fraction (the projected box of its lod-0 group over the viewport), and a JPEG.
//
//   node scripts/opus-sf/sites-qa.mjs --out C:/Users/willy/opus-qa/w4/w4-l/qa [--port 5303] [--sites stonestown,sfsu]
//        [--time golden|night|day|morning] [--quality high|mid] [--ring 8] [--views ring,street,high] [--wait 9000]
//        [--preview 1]   early phase: the not-yet-registered sites through scripts/opus-sf/sites-preview.html
//        [--mobile 1]    390 × 844 at dpr 3 with touch (the phone profile, quality mid)
//
// Writes <out>/sites.json (every number), <out>/sites.md (a table per site) and <out>/<site>-<view>.jpg. Needs the dev
// server (npx vite --config vite.opus.config.ts --port <port>): the helpers import game modules by their dev URLs.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, cur, i, arr) => {
  if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));

const HELPERS = `window.__sq = {
  m: null,
  async mods() {
    if (!this.m) this.m = { w4: await import('/src/opus-bay/world/sf/landmarks/w4sites.ts'), flow: await import('/src/opus-bay/game/flow.ts'), nav: await import('/src/opus-bay/actors/nav.ts'), cinema: await import('/src/opus-bay/game/cinema.ts'), terrain: await import('/src/opus-bay/core/terrain.ts') };
    return this.m;
  },
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); },
  async ready(timeout) {
    const t0 = performance.now();
    while (performance.now() - t0 < timeout) { const ob = window.__opusBay; if (ob && ob.city && ob.world && ob.city.stats().status === 'streaming') return true; await this.sleep(500); }
    return false;
  },
  async sites() { const m = await this.mods(); return JSON.stringify(m.w4.W4_SITES.map(s => s.id)); },
  /** local → world for a site */
  w(s, x, z) { const c = Math.cos(s.yaw), n = Math.sin(s.yaw); return { x: s.x + x * c + z * n, z: s.z - x * n + z * c }; },
  extent(s) { let r = 0; for (const p of s.exclude.poly) r = Math.max(r, Math.hypot(p.x - s.x, p.z - s.z)); return r; },
  async view(id, kind, k, n) {
    const m = await this.mods(); const s = m.w4.w4Site(id); const ob = window.__opusBay;
    if (!s) return JSON.stringify({ error: 'unknown site ' + id });
    const R = Math.max(30, this.extent(s) * 1.5), top = s.base + (s.w4.height ? Math.min(s.w4.height.u, 14) : 6) * 0.45;
    let p, t;
    if (kind === 'ring') { const a = s.yaw + (k / n) * Math.PI * 2; p = [s.x + Math.sin(a) * R, s.base + 12 + R * 0.12, s.z + Math.cos(a) * R]; t = [s.x, top, s.z]; }
    else if (kind === 'high') { const a = s.yaw + 0.6; p = [s.x + Math.sin(a) * R * 1.1, s.base + 60, s.z + Math.cos(a) * R * 1.1]; t = [s.x, s.base, s.z]; }
    else { // street: a player's eye 4 u behind the arrival spot (walkable ground), looking at the photo target
      const ar = s.w4.arrival, ph = s.w4.photo;
      const hx = Math.sin(ar.heading), hz = Math.cos(ar.heading);
      const eye = this.w(s, ar.x - hx * 4, ar.z - hz * 4), tw = this.w(s, ph.target[0], ph.target[2]);
      ob.world.cam(eye.x, s.base + 40, eye.z, tw.x, s.base, tw.z, s.x, s.z);
      await Promise.race([ob.city.whenReady(s.x, s.z, 150), this.sleep(60000)]);
      const gy = m.terrain.heightAt(eye.x, eye.z);
      p = [eye.x, (Number.isFinite(gy) && gy > 0 ? gy : s.base + 1) + 3.2, eye.z]; t = [tw.x, s.base + ph.target[1], tw.z];
    }
    ob.world.cam(p[0], p[1], p[2], t[0], t[1], t[2], s.x, s.z);
    const ready = await Promise.race([ob.city.whenReady(s.x, s.z, 150).then(() => true), this.sleep(90000).then(() => false)]);
    return JSON.stringify({ ready, p: p.map(v => +v.toFixed(1)), t: t.map(v => +v.toFixed(1)) });
  },
  frac(id) {
    const ob = window.__opusBay; const cam = ob.world.camera;
    let root = ob.city.streamer.group; while (root.parent) root = root.parent;
    const g = root.getObjectByName('sf:' + id);
    if (!g) return { drawn: false, frac: 0 };
    const V = cam.position.constructor; const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity]; let tris = 0, meshes = 0;
    g.updateMatrixWorld(true);
    g.traverse(o => {
      if (!o.isMesh) return; meshes++;
      o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox;
      tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
        const v = new V(x, y, z).applyMatrix4(o.matrixWorld).project(cam);
        if (v.z > 1) continue;
        lo[0] = Math.min(lo[0], v.x); lo[1] = Math.min(lo[1], v.y); hi[0] = Math.max(hi[0], v.x); hi[1] = Math.max(hi[1], v.y);
      }
    });
    const cl = v => Math.max(-1, Math.min(1, v));
    const f = lo[0] === Infinity ? 0 : ((cl(hi[0]) - cl(lo[0])) * (cl(hi[1]) - cl(lo[1]))) / 4;
    return { drawn: true, meshes, tris, frac: +f.toFixed(3) };
  },
  measure(id, view) {
    const ob = window.__opusBay; const r = ob.renderer.info; const s = ob.city.stats(); const b = ob.city.breakdown();
    const top = rec => Object.fromEntries(Object.entries(rec).sort((a, c) => c[1].triangles - a[1].triangles).slice(0, 6));
    return JSON.stringify({ id, view, calls: r.render.calls, triangles: r.render.triangles, programs: r.programs.length, site: this.frac(id),
      sites: s.sites, breakdown: b && { groups: top(b.groups), total: b.total, shadowTotal: b.shadowTotal } });
  },
};
'ok'`;

const out = path.resolve(args.out || 'C:/Users/willy/opus-qa/w4/w4-l/qa');
fs.mkdirSync(out, { recursive: true });
const port = args.port || 5303;
const q = new URLSearchParams({ start: 'free', world: 'city', time: args.time || 'golden', quality: args.quality || (args.mobile ? 'mid' : 'high'), save: 'off' });
const page = args.preview ? 'scripts/opus-sf/sites-preview.html' : 'opus-bay';
const url = `http://localhost:${port}/${page}?${q}`;
const ring = Number(args.ring ?? 8);
const kinds = String(args.views || 'ring,street,high').split(',');
const wait = Number(args.wait || 9000);
const sites = args.sites ? String(args.sites).split(',') : null;
if (!sites) { console.error('--sites a,b,c is required (the ids in world/sf/landmarks/w4sites.ts)'); process.exit(2); }

const acts = [
  { do: 'eval', label: 'helpers', expr: HELPERS },
  { do: 'eval', label: 'boot', expr: 'window.__sq.ready(180000)' },
  { do: 'wait', ms: 6000 },
  { do: 'eval', label: 'hud', expr: "(() => { const c = document.querySelector('canvas'); let n = 0; for (const e of document.body.querySelectorAll('*')) if (c && !e.contains(c) && e !== c) { e.style.visibility = 'hidden'; n++; } return n; })()" },
];
const tag = `${args.time || 'golden'}${args.mobile ? '-phone' : ''}`;
for (const id of sites) {
  const views = [];
  for (const k of kinds) {
    if (k === 'ring') for (let i = 0; i < ring; i++) views.push(['ring', i]);
    else views.push([k, 0]);
  }
  for (const [kind, i] of views) {
    const name = kind === 'ring' ? `ring${i}` : kind;
    acts.push({ do: 'eval', label: `pos ${id} ${name}`, expr: `window.__sq.view(${JSON.stringify(id)}, ${JSON.stringify(kind)}, ${i}, ${ring})` });
    acts.push({ do: 'wait', ms: wait });
    acts.push({ do: 'eval', label: `measure ${id} ${name}`, expr: `window.__sq.measure(${JSON.stringify(id)}, ${JSON.stringify(name)})` });
    acts.push({ do: 'shot', name: path.join(out, `${id}-${name}-${tag}.jpg`) });
  }
}
const shotArgs = ['scripts/opus-shot.mjs', '--url', url, '--out', path.join(out, 'x.png'), '--wait', '4000', '--actions', JSON.stringify(acts)];
if (args.mobile) shotArgs.push('--mobile', '--dpr', '3');
else shotArgs.push('--w', String(args.w || 1440), '--h', String(args.h || 900));
console.error(`sites-qa: ${url} · ${sites.join(', ')} · ${kinds.join('/')}`);
const child = spawn(process.execPath, shotArgs, { stdio: ['ignore', 'pipe', 'inherit'] });
let buf = '';
child.stdout.on('data', d => { buf += d; process.stdout.write(d); });
child.on('exit', code => {
  const rows = [];
  for (const line of buf.split('\n')) {
    try { const j = JSON.parse(line); if (typeof j.eval === 'string' && j.eval.startsWith('measure') && typeof j.value === 'string') rows.push(JSON.parse(j.value)); } catch { /* not a measure line */ }
  }
  fs.writeFileSync(path.join(out, `sites-${tag}.json`), JSON.stringify({ url, rows }, null, 1));
  const md = ['| site | view | calls | triangles | programs | site drawn / tris / on-screen |', '|---|---|---|---|---|---|'];
  for (const r of rows) md.push(`| ${r.id} | ${r.view} | ${r.calls} | ${r.triangles.toLocaleString('en-US')} | ${r.programs} | ${r.site.drawn ? `yes / ${r.site.tris} / ${(r.site.frac * 100).toFixed(1)} %` : 'no'} |`);
  fs.writeFileSync(path.join(out, `sites-${tag}.md`), md.join('\n') + '\n');
  console.error(`sites-qa: ${rows.length} measures → ${path.join(out, `sites-${tag}.md`)} (exit ${code})`);
  process.exit(code ?? 0);
});
