import assert from 'node:assert/strict';
import test from 'node:test';

// Wave 5 · lane L · the signature corners seen against what the city draws (W5-L4 / W5-L5): the city's own buildings
// carry ground-floor bay windows 0.5 u proud of their walls (world/recipes/city.ts bay()), storefront awnings and
// cornices; a corner's plaque is only worth drawing where nothing of the city stands in front of it, and a blade sign
// must not hang inside a bay. Checked on the published city's L0 (world/sf/build.ts buildL0), as the game builds it.

// --- headless canvas stub (world modules create label atlases at import or build time) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { buildL0, chunkContext } = await import('../src/opus-bay/world/sf/build');
const { CitySites } = await import('../src/opus-bay/world/sf/sites');
const { DISTRICT } = await import('../src/opus-bay/data/district');
const { lookZones } = await import('../src/opus-bay/world/sf/look');
const { sfDisk } = await import('./opus-bay-sf-disk');
const { CORNERS } = await import('../src/opus-bay/world/sf/landmarks/corners');
const { cornerGround, cornerToWorld } = await import('../src/opus-bay/world/sf/landmarks/cornerKit');
const { sfLandmark } = await import('../src/opus-bay/world/sf/landmarks/index');

const sf = sfDisk();
const init = { palettes: sf.manifest.palettes, slab: DISTRICT.slab, excludes: new CitySites().excludes(), zones: lookZones(await sf.far()) };
const CHUNK = 128, CELL = 64;
type Tris = { pos: ArrayLike<number>; idx: ArrayLike<number> };
const cells = new Map<string, Tris | null>();
/** the city's L0 toy triangles of the cell holding (x, z) (world) */
async function cellAt(x: number, z: number): Promise<Tris | null> {
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  const sub = Math.floor((x - cx * CHUNK) / CELL) + 2 * Math.floor((z - cz * CHUNK) / CELL), k = `${cx}_${cz}_${sub}`;
  if (!cells.has(k)) {
    const c = await sf.chunk(cx, cz);
    const r = c ? buildL0(chunkContext(c, init as never), sub) : null;
    cells.set(k, r?.toy ? { pos: r.toy.position, idx: r.toy.index } : null);
  }
  return cells.get(k)!;
}
/** distances along the ray (o, d) at which it crosses the triangles, up to maxT */
function hits(o: number[], d: number[], t: Tris, maxT: number): number[] {
  const out: number[] = [], { pos, idx } = t;
  const ex = [o[0] + d[0] * maxT, o[2] + d[2] * maxT];
  const sx0 = Math.min(o[0], ex[0]), sx1 = Math.max(o[0], ex[0]), sz0 = Math.min(o[2], ex[1]), sz1 = Math.max(o[2], ex[1]);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    if (Math.max(pos[a], pos[b], pos[c]) < sx0 || Math.min(pos[a], pos[b], pos[c]) > sx1) continue;
    if (Math.max(pos[a + 2], pos[b + 2], pos[c + 2]) < sz0 || Math.min(pos[a + 2], pos[b + 2], pos[c + 2]) > sz1) continue;
    if (Math.max(pos[a + 1], pos[b + 1], pos[c + 1]) < o[1] || Math.min(pos[a + 1], pos[b + 1], pos[c + 1]) > o[1]) continue;
    const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
    const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
    if (Math.abs(det) < 1e-9) continue;
    const inv = 1 / det, s = [o[0] - pos[a], o[1] - pos[a + 1], o[2] - pos[a + 2]];
    const u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * inv;
    if (u < 0 || u > 1) continue;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
    const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) * inv;
    if (v < 0 || u + v > 1) continue;
    const tt = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
    if (tt > 1e-4 && tt <= maxT) out.push(tt);
  }
  return out;
}

test('W5-L4 / L5: no city geometry stands in front of a corner\'s plaques (≥ 80 % of the face clear within 0.6 u), and no blade sign hangs inside a building or a bay', async () => {
  const bad: string[] = [];
  let flat = 0, blades = 0;
  for (const c of CORNERS) {
    const s = sfLandmark(c.site)!, base = typeof s.base === 'number' ? s.base : 0;
    // every window's plaques (a market stall's too)
    const on = new Set(Object.keys(c.windows ?? {}));
    for (const p of c.signs(cornerGround(c, base), on)) {
      const w = cornerToWorld(c, p), yaw = p.ry + c.frame.yaw;
      const n = [Math.sin(yaw), 0, Math.cos(yaw)], r = [Math.cos(yaw), 0, -Math.sin(yaw)];
      const y = p.y + base;
      const t = await cellAt(w.x, w.z);
      if (!t) continue;
      if (p.blade) {
        // a blade hangs out from its wall in the plaque's plane (along r for one face, −r for the other): hung inside a
        // bay, the bay's front face stands just ahead of the plaque's centre on the way out to the street (the wall is
        // ≥ 0.25 u behind it, the city's shop awnings' lips 0.3 u ahead)
        blades++;
        const o = [w.x, y, w.z];
        if (hits(o, r, t, 0.2).length) bad.push(`${c.id} blade ${p.id} at local (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) hangs inside the city's geometry`);
        continue;
      }
      flat++;
      let clear = 0, all = 0;
      for (const u of [-0.4, -0.2, 0, 0.2, 0.4]) for (const v of [-0.2, 0.2]) {
        const o = [w.x + r[0] * u * p.w + n[0] * 0.02, y + v * (p.w / 2), w.z + r[2] * u * p.w + n[2] * 0.02];
        all++;
        if (!hits(o, n, t, 0.6).length) clear++;
      }
      if (clear < 0.8 * all) bad.push(`${c.id} ${p.id} at local (${p.x.toFixed(2)}, ${p.z.toFixed(2)}): ${all - clear} of ${all} rays hit the city in front of it`);
    }
  }
  assert.ok(flat >= 20 && blades >= 8, `${flat} flat plaques, ${blades} blade faces checked`);
  assert.deepEqual(bad, []);
});

test('W5-L-review: every corner crowd pin and figure stands clear of the city\'s walls and bay windows at body height (nobody stands inside a bay)', async () => {
  const bad: string[] = [];
  let n = 0;
  const R = 0.2, DIRS = 8;
  for (const c of CORNERS) {
    const s = sfLandmark(c.site)!, base = typeof s.base === 'number' ? s.base : 0, ground = cornerGround(c, base);
    const figures = [
      ...(c.crowds ?? []).flatMap(cr => cr.spots.map(p => ({ what: `${cr.key} pin`, p }))),
      ...(c.soft ?? []).filter(so => so.kind === 'person').map(so => ({ what: 'figure', p: { x: so.x, z: so.z } })),
    ];
    for (const { what, p } of figures) {
      n++;
      const w = cornerToWorld(c, p), t = await cellAt(w.x, w.z);
      if (!t) continue;
      for (const h of [0.45, 1.1]) {
        const y = ground.at(p.x, p.z) + base + h;
        // from the body's middle out to its skin in every direction: a hit is a wall or a bay inside the body
        const hit = Array.from({ length: DIRS }, (_, k) => [Math.cos((k / DIRS) * Math.PI * 2), 0, Math.sin((k / DIRS) * Math.PI * 2)]).some(d => hits([w.x, y, w.z], d, t, R).length > 0);
        if (hit) { bad.push(`${c.id} ${what} at local (${p.x}, ${p.z}): the city's geometry within ${R} u at ${h} u up`); break; }
      }
    }
  }
  assert.ok(n >= 25, `${n} figures checked`);
  assert.deepEqual(bad, []);
});
