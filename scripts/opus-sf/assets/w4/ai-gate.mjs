// Lane V (wave 4, part 2) · AI swap gate runner: the procedural site vs the AI model, in SoloView and in the city,
// through scripts/opus-sf/assets/w4/ai-gate.html (see ai-gate.tsx). One headless Chrome per run (scripts/opus-shot.mjs).
//
//   node scripts/opus-sf/assets/w4/ai-gate.mjs --port 5306 --site geary-west --out C:/Users/willy/opus-qa/w4/w4-v/gate
//        [--mode solo|city] [--ai 0|1] [--tag name] [--extra "hv=w4-holy-virgin-fit.glb&hvs=1,1,1"] [--time golden]
//
// solo: SoloView (?solo=all with only this site in the registry): the ¾ ('three'), 'street' and 'far' views, the
//       64 px thumbnail (SoloView's own `thumb(64)`: the far view downsampled) and the silhouette coverage.
// city: the streaming city at `--time` (quality high): the site's photo pose (its w4.photo), a street view from the
//       arrival spot, and a far view whose distance makes the site's model height span ~64 px on the 900 px screen
//       (plus one at ~128 px), each after `city.whenReady`; HUD hidden. The AI part only loads within 220 u of the
//       focus (C2), so every view sets the focus on the site. Karl the Fog is off (?karl=0) unless --karl 1: at golden
//       hour it would hide the far views, and the gate judges the model.
// Writes <out>/<site>-<tag>-<view>.jpg (+ -thumb64.png in solo) and <out>/<site>-<tag>.json (stats per view).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, cur, i, arr) => {
  if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const port = args.port || 5306;
const site = args.site;
if (!site) { console.error('--site <w4 site id> is required'); process.exit(2); }
const mode = args.mode || 'solo';
const ai = String(args.ai ?? '1');
const time = args.time || 'golden';
const tag = args.tag || `${mode}-ai${ai}`;
const out = path.resolve(args.out || 'C:/Users/willy/opus-qa/w4/w4-v/gate');
fs.mkdirSync(out, { recursive: true });
const extra = args.extra ? `&${args.extra}` : '';
const base = `http://localhost:${port}/scripts/opus-sf/assets/w4/ai-gate.html?sites=${site}&ai=${ai}&time=${time}${args.karl ? '' : '&karl=0'}${extra}`;
const file = name => path.join(out, `${site}-${tag}-${name}`);

const acts = [];
let url;
if (mode === 'solo') {
  url = `${base}&solo=all&sheet=0&view=three`;
  acts.push({ do: 'eval', label: 'ready', expr: `(async () => { for (let i = 0; i < 120; i++) { if (window.__opusSolo) return 'ok'; await new Promise(r => setTimeout(r, 250)); } return 'no solo'; })()` });
  acts.push({ do: 'wait', ms: 5000 });
  acts.push({ do: 'eval', label: 'select', expr: 'JSON.stringify(window.__opusSolo.select(0))' });
  acts.push({ do: 'wait', ms: 1500 });
  for (const v of ['three', 'street', 'far', 'front', 'right']) {
    acts.push({ do: 'eval', label: `view ${v}`, expr: `JSON.stringify(window.__opusSolo.view(${JSON.stringify(v)}))` });
    acts.push({ do: 'wait', ms: 1200 });
    acts.push({ do: 'shot', name: file(`${v}.jpg`) });
  }
  acts.push({ do: 'eval', label: 'thumb64', expr: 'window.__opusSolo.thumb(64)' });
  acts.push({ do: 'eval', label: 'thumb128', expr: 'window.__opusSolo.thumb(128)' });
  acts.push({ do: 'eval', label: 'silhouette', expr: 'JSON.stringify((({ mask, ...r }) => r)(window.__opusSolo.silhouette(64)))' });
} else {
  const HELPERS = `window.__ag = {
    sleep(ms) { return new Promise(r => setTimeout(r, ms)); },
    async ready(timeout) {
      const t0 = performance.now();
      while (performance.now() - t0 < timeout) { const ob = window.__opusBay; if (ob && ob.city && ob.world && ob.city.stats().status === 'streaming') return true; await this.sleep(500); }
      return false;
    },
    async site() { const m = await import('/src/opus-bay/world/sf/landmarks/w4list.ts'); return m.W4_SITES.find(s => s.id === ${JSON.stringify(site)}); },
    w(s, x, z) { const c = Math.cos(s.yaw), n = Math.sin(s.yaw); return { x: s.x + x * c + z * n, z: s.z - x * n + z * c }; },
    async pose(kind) {
      const s = await this.site(); const ob = window.__opusBay; const cam = ob.world.camera;
      const ph = s.w4.photo; const H = s.w4.height ? s.w4.height.u : 6;
      const t = this.w(s, ph.target[0], ph.target[2]); const ty = s.base + ph.target[1];
      let p, tt = [t.x, ty, t.z];
      const yaw = s.yaw + ph.bearing;
      if (kind === 'photo') {
        const d = ph.distance, e = ph.elevation;
        p = [t.x + Math.sin(yaw) * Math.cos(e) * d, ty + Math.sin(e) * d, t.z + Math.cos(yaw) * Math.cos(e) * d];
      } else if (kind === 'street') {
        const ar = s.w4.arrival; const hx = Math.sin(ar.heading), hz = Math.cos(ar.heading);
        const eye = this.w(s, ar.x - hx * 10, ar.z - hz * 10);
        p = [eye.x, s.base + 4.5, eye.z]; tt = [t.x, s.base + H * 0.55, t.z];
      } else {
        // far: the model height spans N px on the screen (kind = 'far64' | 'far128'), seen 12° from above
        const px = Number(kind.slice(3)); const fov = cam.fov * Math.PI / 180; const Hs = innerHeight;
        const d = (Hs * H) / (2 * px * Math.tan(fov / 2)); const e = 12 * Math.PI / 180;
        const mid = s.base + H * 0.5; tt = [s.x, mid, s.z];
        p = [s.x + Math.sin(yaw) * Math.cos(e) * d, mid + Math.sin(e) * d, s.z + Math.cos(yaw) * Math.cos(e) * d];
      }
      ob.world.cam(p[0], p[1], p[2], tt[0], tt[1], tt[2], s.x, s.z);
      await Promise.race([ob.city.whenReady(s.x, s.z, 160), this.sleep(90000)]);
      await this.sleep(2500);
      const g = (() => { let root = ob.city.streamer.group; while (root.parent) root = root.parent; return root.getObjectByName('sf:' + s.id); })();
      let aiParts = 0, tris = 0; g && g.traverse(o => { if (o.isMesh) { tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; if (/:ai:/.test(o.name)) aiParts++; } });
      const r = ob.renderer.info;
      return JSON.stringify({ kind, p: p.map(v => +v.toFixed(1)), t: tt.map(v => +v.toFixed(1)), drawn: !!g, aiParts, siteTris: tris, calls: r.render.calls, triangles: r.render.triangles });
    },
  }; 'ok'`;
  const s0 = args.at ? `&at=xz:${args.at}` : '';
  url = `${base}&world=city&start=free&quality=${args.quality || 'high'}&save=off${s0}`;
  acts.push({ do: 'eval', label: 'helpers', expr: HELPERS });
  acts.push({ do: 'eval', label: 'boot', expr: 'window.__ag.ready(180000)' });
  acts.push({ do: 'wait', ms: 5000 });
  acts.push({ do: 'eval', label: 'hud', expr: "(() => { const c = document.querySelector('canvas'); let n = 0; for (const e of document.body.querySelectorAll('*')) if (c && !e.contains(c) && e !== c) { e.style.visibility = 'hidden'; n++; } return n; })()" });
  for (const v of (args.views || 'photo,street,far128,far64').split(',')) {
    acts.push({ do: 'eval', label: `pose ${v}`, expr: `window.__ag.pose(${JSON.stringify(v)})` });
    acts.push({ do: 'shot', name: file(`${v}.jpg`) });
  }
}

const shotArgs = ['scripts/opus-shot.mjs', '--url', url, '--out', path.join(out, 'x.png'), '--wait', String(args.wait || 5000), '--actions', JSON.stringify(acts), '--w', String(args.w || 1440), '--h', String(args.h || 900)];
console.error(`ai-gate: ${url}`);
const child = spawn(process.execPath, shotArgs, { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, CHROME_FLAGS: process.env.CHROME_FLAGS || '--force_high_performance_gpu' } });
let buf = '';
child.stdout.on('data', d => { buf += d; });
child.on('exit', code => {
  const rows = [];
  for (const line of buf.split('\n')) {
    let j; try { j = JSON.parse(line); } catch { continue; }
    if (typeof j.value === 'string' && j.value.startsWith('data:image/png;base64,')) {
      const name = file(`${j.eval}.png`);
      fs.writeFileSync(name, Buffer.from(j.value.split(',')[1], 'base64'));
      rows.push({ eval: j.eval, file: name });
    } else rows.push(j);
  }
  fs.writeFileSync(file('stats.json').replace(/-stats\.json$/, '.json'), JSON.stringify({ url, rows }, null, 1));
  for (const r of rows) if (!r.shot) console.log(JSON.stringify(r).slice(0, 400));
  process.exit(code ?? 0);
});
