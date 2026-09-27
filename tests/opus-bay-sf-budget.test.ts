import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type * as THREE_NS from 'three';

/**
 * Lane C2-5 (high-view budget ≤ 150 calls / ≤ 400k triangles incl. shadows) and HC-1 / HC-2 (the lazy city chunk):
 * radii and prop caps by camera height, the hero ground stand-in, and a guard that keeps the city code out of the
 * main graph.
 */

// --- headless canvas stub (world modules create label atlases / board-shadow canvases at import) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { HIGH_VIEW, RADII, radiiFor } = await import('../src/opus-bay/world/sf/cell');
const { PROP_HIGH, propCaps } = await import('../src/opus-bay/world/sf/props');

test('radiiFor: a walking camera keeps today\'s radii; the hero lowers one quality step', () => {
  for (const q of ['high', 'mid', 'low'] as const) {
    for (const camH of [0, 8, 25]) assert.deepEqual(radiiFor(q, { heroNear: false, camH }), RADII[q], `${q} ${camH}`);
  }
  assert.deepEqual(radiiFor('high', { heroNear: true, camH: 5 }), RADII.mid);
  assert.deepEqual(radiiFor('low', { heroNear: true, camH: 5 }), RADII.low);
  assert.deepEqual(radiiFor('high', { heroNear: false, camH: Number.NaN }), RADII.high, 'unknown height = walking');
});

test('radiiFor: L0 shrinks to 60 / 90 u from camH 25 to 60, L1 to 240 / 290 u from 80 to 120; gliding above 40 u = L0 60 / 90', () => {
  const r60 = radiiFor('high', { heroNear: false, camH: 60 });
  assert.equal(r60.l0In, HIGH_VIEW.l0.in); assert.equal(r60.l0Out, HIGH_VIEW.l0.out);
  assert.equal(r60.l1In, RADII.high.l1In, 'L1 untouched below 80 u');
  const r250 = radiiFor('high', { heroNear: false, camH: 250 });
  assert.deepEqual(r250, { l0In: 60, l0Out: 90, l1In: 240, l1Out: 290 });
  const mid = radiiFor('high', { heroNear: false, camH: 40 });
  assert.ok(mid.l0In < RADII.high.l0In && mid.l0In > 60, `${mid.l0In}`);
  assert.deepEqual(radiiFor('high', { heroNear: false, camH: 5, glideH: 50 }), { ...RADII.high, l0In: 60, l0Out: 90 });
  assert.deepEqual(radiiFor('high', { heroNear: false, camH: 5, glideH: 30 }), RADII.high);
  // low quality never grows, every radius on the 5 u step, out > in, monotone in camH
  assert.deepEqual(radiiFor('low', { heroNear: false, camH: 250 }), { l0In: 60, l0Out: 90, l1In: 220, l1Out: 270 });
  let prev = radiiFor('high', { heroNear: false, camH: 0 });
  for (let h = 0; h <= 300; h += 1.7) {
    const r = radiiFor('high', { heroNear: false, camH: h });
    for (const v of Object.values(r)) assert.equal(v % HIGH_VIEW.step, 0);
    assert.ok(r.l0Out > r.l0In && r.l1In > r.l0Out && r.l1Out > r.l1In);
    assert.ok(r.l0In <= prev.l0In && r.l1In <= prev.l1In, `monotone at ${h}`);
    prev = r;
  }
});

test('propCaps: full caps below 25 u, the high caps from 80 u, only a few steps in between', () => {
  assert.deepEqual(propCaps(0), { tree: 200, lolli: 600, lamp: 48, rFull: 70, rLolli: 140, rLamp: 120, step: 0 });
  assert.deepEqual(propCaps(10), propCaps(25));
  const hi = propCaps(250);
  assert.equal(hi.tree, PROP_HIGH.tree); assert.equal(hi.lolli, PROP_HIGH.lolli); assert.equal(hi.lamp, PROP_HIGH.lamp);
  assert.deepEqual(propCaps(80), hi);
  const steps = new Set<number>();
  for (let h = 0; h < 120; h += 0.5) steps.add(propCaps(h).step);
  assert.equal(steps.size, PROP_HIGH.steps + 1);
  // triangles of the props at the cap (round tree ≈ 130, lollipop 36, lamp ≈ 100): about half
  const tris = (c: ReturnType<typeof propCaps>) => c.tree * 130 + c.lolli * 36 + c.lamp * 100;
  assert.ok(tris(hi) < tris(propCaps(0)) * 0.5, `${tris(hi)} vs ${tris(propCaps(0))}`);
});

test('hero ground stand-in: ≤ 10k triangles for the ≈ 47k of the hand-made ground, same heights and colours', async () => {
  const THREE = await import('three');
  const { loadCity } = await import('../src/opus-bay/world/cityLoader');
  const cm = await loadCity();
  const { World } = await import('../src/opus-bay/world/world');
  const { TopSampler } = await import('../src/opus-bay/world/sf/heroGround');
  const { DISTRICT } = await import('../src/opus-bay/data/district');
  const world = new World('city');
  const chunks = (world as unknown as { heroGroundChunks: THREE_NS.Mesh[] }).heroGroundChunks;
  assert.ok(chunks.length >= 6 && chunks.length <= 10, `${chunks.length} hero ground chunks`);
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of DISTRICT.slab) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  const src = chunks.reduce((s, m) => s + (m.geometry.getIndex()?.count ?? m.geometry.getAttribute('position').count) / 3, 0);
  const box = { x0: x0 - 20, z0: z0 - 20, x1: x1 + 20, z1: z1 + 20 };
  // the stream runs it in ≈ 2 ms frame slices: it must yield often (every ≤ 6000 source triangles and every 64 u cell)
  const job = cm.heroGroundJob(chunks, { box });
  let yields = 0, r = job.next();
  while (!r.done) { yields++; r = job.next(); }
  const a = r.value;
  assert.ok(a, 'a stand-in');
  assert.ok(yields >= 20, `${yields} slices`);
  const tris = a.indexCount / 3;
  assert.ok(src > 40_000, `source ${src}`);
  assert.ok(tris <= 10_000, `stand-in ${tris} triangles`);
  // compare the topmost surfaces at random points of the source ground
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
  const col = new Float32Array(a.vertexCount * 3);
  for (let i = 0; i < col.length; i++) col[i] = a.color[i] / 255;
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(a.index, 1));
  const proxy = TopSampler.of([new THREE.Mesh(geo)], box);
  const full = TopSampler.of(chunks, box);
  const hs = { y: 0, r: 0, g: 0, b: 0 }, hp = { y: 0, r: 0, g: 0, b: 0 };
  let n = 0, missing = 0, far = 0, dr = 0, dg = 0, db = 0, seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  while (n < 600) {
    const x = box.x0 + rnd() * (box.x1 - box.x0), z = box.z0 + rnd() * (box.z1 - box.z0);
    if (!full.sample(x, z, hs) || hs.y < -0.6) continue;
    n++;
    if (!proxy.sample(x, z, hp)) { missing++; continue; }
    if (Math.abs(hp.y - hs.y) > 0.6) far++;
    dr += hp.r - hs.r; dg += hp.g - hs.g; db += hp.b - hs.b;
  }
  assert.ok(missing / n < 0.04, `${missing} of ${n} ground points not covered`);
  assert.ok(far / n < 0.05, `${far} of ${n} points off by more than 0.6 u`);
  const k = n - missing;
  for (const d of [dr, dg, db]) assert.ok(Math.abs(d / k) < 0.03, `mean colour shift ${(d / k).toFixed(3)}`);
});

test('HC-2: the city code stays out of the main graph (import it through world/cityLoader.ts)', () => {
  const root = path.resolve('src/opus-bay');
  const heavy = /from\s+'[./]*(?:world\/)?sf\/(stream|sites|water|pools|hero|heroGround|stats|cityMode|far|build|worker|raster|cell|fog|cloudBank|lights)'|from\s+'[./]*(?:core\/)?sfTerrain'/;
  const bad: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.tsx?$/.test(e.name)) continue;
      const rel = path.relative(root, p).replace(/\\/g, '/');
      // the city chunk itself (world/sf, except the landmark recipes the main graph reaches through moveSystem)
      if (rel.startsWith('world/sf/') && !rel.startsWith('world/sf/landmarks/')) continue;
      if (rel === 'world/cityLoader.ts') continue;
      for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
        if (!/^\s*import\s/.test(line) || /^\s*import\s+type\s/.test(line)) continue;
        if (heavy.test(line)) bad.push(`${rel}: ${line.trim()}`);
      }
    }
  };
  walk(root);
  assert.deepEqual(bad, [], 'static imports of city modules outside the city chunk (use cityLoader.ts: loadCity / cityModule / cityStreamerLazy)');
});
