import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Lane C (city streaming & rendering): the pure streaming state machine (tiers, hysteresis, attach budget, drops that
 * never leave a hole, whenReady), the worker-side builders on the published data (L0 / L1 / far budgets, the hero
 * seam, landmark exclusions), the pools' size classes, the city board and the hero's far stand-in, and a headless
 * city-mode World next to the unchanged district.
 */

// --- headless canvas stub (world modules create label atlases / board shadows at import or build time) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { ATTACH_BUDGET, CellTable, Lru, RADII, RESIDENCY, desiredTier, squareDist } = await import('../src/opus-bay/world/sf/cell');
const { POND_CLASS, buildL0, buildL1, chunkContext, isGround } = await import('../src/opus-bay/world/sf/build');
const { buildFar, farWaterRings, inFarWater } = await import('../src/opus-bay/world/sf/far');
const { GROUND_CITY, clipOutside, clipPolyline } = await import('../src/opus-bay/world/sf/mesh');
const { classVerts, sizeClass } = await import('../src/opus-bay/world/sf/pools');
const { inPoly } = await import('../src/opus-bay/world/sf/raster');
const { boardPolygon, southCut } = await import('../src/opus-bay/world/sf/water');
const { heroLandRaster, heroProxy } = await import('../src/opus-bay/world/sf/hero');
const { CitySites } = await import('../src/opus-bay/world/sf/sites');
const { projectCity } = await import('../src/opus-bay/core/geo');
const { DISTRICT } = await import('../src/opus-bay/data/district');
const { sfDisk } = await import('./opus-bay-sf-disk');
const { SF_KIND, rasterizeChunk } = await import('../src/opus-bay/core/sfTerrain');
const { AREA_CLASSES, AREA_FLAG, demSample } = await import('../src/opus-bay/world/sf/format');
type Vec2 = { x: number; z: number };

type Table = InstanceType<typeof CellTable>;

const sf = sfDisk();
const slab = DISTRICT.slab;
const init = { palettes: sf.manifest.palettes, slab, excludes: new CitySites().excludes() };
const chunkList = sf.manifest.chunks.map(c => ({ cx: c.cx, cz: c.cz, hero: c.hero }));

// ---------------------------------------------------------------------------
// streaming state machine
// ---------------------------------------------------------------------------

/**
 * Drives a CellTable like stream.ts does, with instant workers: every job completes the same step, results attach
 * within ATTACH_BUDGET, drops follow the table. L1 arrays are kept per cell while the chunk is wanted (stream.ts
 * l1Ready). Returns per-step checks.
 */
function simulate(t: Table, path: { x: number; z: number }[], opts: { emptyCells?: Set<number> } = {}) {
  const l1Data = new Set<number>();
  const shownBefore = new Map<number, number>();
  let maxL0 = 0, maxL1 = 0, holes = 0;
  for (const p of path) {
    t.select([p]);
    for (const j of t.jobs()) {
      if (j.kind === 'raster') j.chunk.raster = 'attached';
      else if (j.kind === 'l1') {
        j.chunk.l1 = 'ready';
        for (const c of j.chunk.cells) {
          if (c.l1 === 'attached' || (c.l1 === 'ready' && l1Data.has(c.key))) continue;
          if (opts.emptyCells?.has(c.key)) { c.empty = true; c.l1 = 'none'; continue; }
          l1Data.add(c.key); c.l1 = 'ready';
        }
      } else if (opts.emptyCells?.has(j.cell.key)) { j.cell.empty = true; j.cell.l0 = 'none'; } else j.cell.l0 = 'ready';
    }
    // a few frames per step
    for (let f = 0; f < 6; f++) {
      const a = t.nextAttaches(ATTACH_BUDGET);
      maxL0 = Math.max(maxL0, a.l0.length); maxL1 = Math.max(maxL1, a.l1.length);
      for (const c of a.l0) c.l0 = 'attached';
      for (const c of a.l1) c.l1 = 'attached';
      const d = t.drops();
      for (const c of d.l0) c.l0 = 'none';
      for (const c of d.l1) c.l1 = l1Data.has(c.key) ? 'ready' : 'none';
      for (const ch of d.chunks) { for (const c of ch.cells) { l1Data.delete(c.key); c.l1 = 'none'; } ch.l1 = 'none'; }
      for (const ch of d.rasters) ch.raster = 'none';
      // never a hole: a cell that showed a near tier keeps showing one while it is still wanted near
      for (const c of t.cells) {
        const s = CellTable.shownFor(c), was = shownBefore.get(c.key) ?? 2;
        if (was <= 1 && c.want <= 1 && s === 2 && !c.empty) holes++;
        shownBefore.set(c.key, s);
      }
    }
  }
  return { maxL0, maxL1, holes };
}

test('tiers: radii shrink with quality, hysteresis keeps a cell on its tier between the in and out radii', () => {
  for (const q of ['high', 'mid', 'low'] as const) {
    const r = RADII[q];
    assert.ok(r.l0In < r.l0Out && r.l0Out < r.l1In && r.l1In < r.l1Out, q);
  }
  assert.ok(RADII.high.l0In > RADII.mid.l0In && RADII.mid.l1In > RADII.low.l1In);
  const r = RADII.high;
  assert.equal(desiredTier(r.l0In - 1, 2, r), 0);
  assert.equal(desiredTier(r.l0In + 5, 0, r), 0, 'stays L0 inside the out radius');
  assert.equal(desiredTier(r.l0In + 5, 1, r), 1, 'comes in only below the in radius');
  assert.equal(desiredTier(r.l0Out + 1, 0, r), 1);
  assert.equal(desiredTier(r.l1Out + 1, 1, r), 2);
  assert.equal(desiredTier(r.l1In + 5, 1, r), 1);
  assert.equal(desiredTier(r.l1In + 5, 2, r), 2);
  assert.equal(squareDist(5, 5, 0, 0, 10), 0);
  assert.equal(squareDist(13, 14, 0, 0, 10), 5);
});

test('streaming walk across the city: ≤ 1 L0 + 2 L1 attaches per frame, never a hole, drops follow, ready() tracks', () => {
  const t = new CellTable(chunkList);
  // Ferry Building → Market St → the Mission → Twin Peaks → Ocean Beach, 6 u steps (≈ 1.5 s of running each)
  const way = [{ x: 150, z: -30 }, { x: 180, z: 320 }, { x: 200, z: 660 }, { x: 140, z: 947 }, { x: -431, z: 1475 }];
  const walk: { x: number; z: number }[] = [];
  for (let i = 0; i + 1 < way.length; i++) {
    const a = way[i], b = way[i + 1], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 6);
    for (let k = 0; k < n; k++) walk.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  }
  const r = simulate(t, walk);
  assert.ok(r.maxL0 <= ATTACH_BUDGET.l0 && r.maxL1 <= ATTACH_BUDGET.l1, JSON.stringify(r));
  assert.equal(r.holes, 0, 'a receding / approaching cell never falls back to L2 while wanted near');
  const end = way[way.length - 1];
  assert.ok(t.ready(end.x, end.z, 150), 'the arrival is ready after the walk');
  const n = t.counts();
  assert.ok(n.l0 > 0 && n.l0 <= 30, `L0 cells ${n.l0}`);
  // nothing near the start is still held
  for (const c of t.cells) if (Math.hypot(c.x - 150, c.z + 30) < 200) assert.notEqual(c.l0, 'attached', 'L0 left behind is dropped');
  for (const ch of t.chunks) if (ch.raster === 'attached') assert.ok(ch.dist <= RESIDENCY.out, 'rasters beyond 256 u are detached');
});

test('a cell swinging L1 → L2 → L1 while its chunk stays wanted re-attaches from kept arrays (no stuck L2)', () => {
  const t = new CellTable(chunkList);
  const r = RADII.high;
  // stand so that a chunk straddles the L1 out radius, then step out and back in
  const p0 = { x: 200, z: 660 };
  simulate(t, [p0]);
  const far = { x: p0.x + (r.l1Out - r.l1In) + 30, z: p0.z };
  // enough frames back at p0 for every returning cell to attach at 2 per frame
  simulate(t, [far, far, ...Array.from({ length: 30 }, () => p0)]);
  for (const c of t.cells) {
    if (c.empty || c.want === 2) continue;
    assert.equal(CellTable.shownFor(c), c.want, `cell ${c.ix},${c.iz} (want ${c.want}, l0 ${c.l0}, l1 ${c.l1})`);
  }
  assert.ok(t.ready(p0.x, p0.z, 150));
});

test('whenReady semantics: not ready until the rasters within the residency radius are in; empty cells never block', () => {
  const t = new CellTable(chunkList);
  const p = { x: -8, z: 587 };
  t.select([p]);
  assert.equal(t.ready(p.x, p.z, 150), false);
  // every nearby cell empty (open water) but rasters missing → still not ready
  const empty = new Set(t.cells.filter(c => Math.hypot(c.x - p.x, c.z - p.z) < 400).map(c => c.key));
  for (const c of t.cells) if (empty.has(c.key)) c.empty = true;
  assert.equal(t.ready(p.x, p.z, 150), false);
  for (const ch of t.chunks) if (squareDist(p.x, p.z, ch.cx * 128, ch.cz * 128, 128) < RESIDENCY.in) ch.raster = 'attached';
  assert.equal(t.ready(p.x, p.z, 150), true);
});

test('W4-V8 prefetch: a soft focus ahead of a ride asks for L1 and rasters within its radius, never L0, behind the player', () => {
  const t = new CellTable(chunkList);
  const player = { x: -8, z: 587 }, ahead = { x: -8, z: 1200 }; // Alamo Square, and a track point 613 u south (the Sunset)
  t.select([player]);
  const near = (p: { x: number; z: number }, r: number) => t.cells.filter(c => Math.hypot(c.x - p.x, c.z - p.z) < r);
  assert.ok(near(ahead, 120).every(c => c.want === 2), 'beyond the player\'s radii: L2');
  t.select([player, { ...ahead, soft: 120 }]);
  const soft = near(ahead, 120);
  assert.ok(soft.length > 4 && soft.every(c => c.want === 1), 'L1 within the soft radius');
  assert.ok(near(ahead, 400).filter(c => Math.hypot(c.x - ahead.x, c.z - ahead.z) >= 125 && Math.hypot(c.x - player.x, c.z - player.z) > 400).every(c => c.want === 2), 'nothing beyond it');
  assert.ok(near(player, RADII.high.l0In - 1).some(c => c.want === 0), 'the player keeps L0');
  const jobs = t.jobs();
  const softRaster = jobs.filter(j => j.kind === 'raster' && squareDist(ahead.x, ahead.z, j.chunk.cx * 128, j.chunk.cz * 128, 128) < 120);
  assert.ok(softRaster.length > 0, 'the rasters under the prefetch point are requested');
  assert.ok(!jobs.some(j => j.kind === 'l0' && Math.hypot(j.cell.x - ahead.x, j.cell.z - ahead.z) < 120), 'never an L0 job there');
  const firstSoft = jobs.findIndex(j => j.kind === 'raster' && softRaster.includes(j));
  const playerRaster = jobs.filter(j => j.kind === 'raster' && squareDist(player.x, player.z, j.chunk.cx * 128, j.chunk.cz * 128, 128) < 60);
  assert.ok(playerRaster.every(j => jobs.indexOf(j) < firstSoft), 'the player\'s own rasters first');
  // the ride passed: the point is replaced / cleared and its cells fall back
  t.select([player]);
  assert.ok(soft.every(c => c.want === 2));
});

test('LRU of compressed chunk bytes evicts least-recently used entries by byte budget', () => {
  const evicted: string[] = [];
  const l = new Lru<string, number>(100, k => evicted.push(k));
  l.set('a', 1, 40); l.set('b', 2, 40);
  assert.equal(l.get('a'), 1); // a is now the most recent
  l.set('c', 3, 40);
  assert.deepEqual(evicted, ['b']);
  assert.equal(l.bytes, 80);
  assert.ok(l.has('a') && l.has('c') && !l.has('b'));
});

// ---------------------------------------------------------------------------
// worker builders on the published data
// ---------------------------------------------------------------------------

async function ctxOf(cx: number, cz: number) {
  const c = await sf.chunk(cx, cz);
  assert.ok(c, `chunk ${cx}_${cz}`);
  return chunkContext(c, init);
}

const tris = (a: { indexCount: number } | null) => (a ? a.indexCount / 3 : 0);

/**
 * The densest L0 cell measures 17.9k triangles (2_11/0: 214 Edwardian rows at ~64 each + 3.4k ground) against the
 * plan's 14k estimate; the walk-mode budget holds through the L0 radius and frustum culling (lane A is told).
 */
test('L0 / L1 on the densest chunks stay within budget; L1 is a massing tier (≤ 1/3 of L0)', async () => {
  for (const [cx, cz] of [[-1, 1], [0, 6], [2, 11], [2, 6]]) {
    const ctx = await ctxOf(cx, cz);
    const l1 = buildL1(ctx);
    let l1t = 0, l0t = 0;
    for (const c of l1.cells) l1t += tris(c.toy) + tris(c.ground);
    for (let sub = 0; sub < 4; sub++) {
      const r = buildL0(ctx, sub);
      assert.ok(r.triangles <= 18500, `L0 ${cx}_${cz}/${sub}: ${r.triangles} triangles`);
      l0t += r.triangles;
      // city ground carries the GROUND_CITY flag (skips the hero-only contact-shadow lookup, w < 0.5); lit asphalt
      // adds its night lamp level (0.5 … 1, lane C2-9 street glow) on top, so the flag reads GROUND_CITY … GROUND_CITY + 1
      if (r.ground) {
        for (let i = 0; i < r.ground.vertexCount; i += 97) {
          const w = r.ground.info[i * 4 + 3];
          assert.ok(w >= GROUND_CITY && w <= GROUND_CITY + 1, `ground flag ${w}`);
        }
      }
    }
    assert.ok(l1t <= 18000, `L1 ${cx}_${cz}: ${l1t}`);
    assert.ok(l1t < l0t / 3, `L1 ${l1t} vs L0 ${l0t}`);
    assert.ok(l1.props.count > 0, 'street trees / lamps');
  }
});

test('hero seam: no city ground, street or prop inside the slab; seam chunks still draw their outside part', async () => {
  const slabIn = (x: number, z: number) => inPoly(x, z, slab);
  // shrink test: a point is "well inside" when it is ≥ 1 u from the slab edge
  const deep = (x: number, z: number) => slabIn(x, z) && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => slabIn(x + dx, z + dz));
  let outside = 0;
  for (const k of sf.manifest.chunks.filter(c => c.hero)) {
    const ctx = await ctxOf(k.cx, k.cz);
    const l1 = buildL1(ctx);
    for (let i = 0; i < l1.props.count; i++) assert.ok(!slabIn(l1.props.xyzr[i * 4], l1.props.xyzr[i * 4 + 2]), 'prop inside the slab');
    for (let sub = 0; sub < 4; sub++) {
      const r = buildL0(ctx, sub);
      if (!r.ground) continue;
      const p = r.ground.position;
      for (let i = 0; i < r.ground.vertexCount; i++) {
        assert.ok(!deep(p[i * 3], p[i * 3 + 2]), `ground vertex (${p[i * 3].toFixed(1)}, ${p[i * 3 + 2].toFixed(1)}) inside the slab`);
        outside++;
      }
    }
  }
  assert.ok(outside > 1000, 'seam chunks draw the city outside the slab');
  // west seam: seam-block buildings reaching into the slab where the hero has water are dropped (not where it has land)
  const heroLand = heroLandRaster();
  const c = (await sf.chunk(-2, 0))!;
  const sub = 0; // (−201, 57.5) → cell (−4, 0) of chunk −2_0
  const keep = buildL0(chunkContext(c, init), sub).toy, drop = buildL0(chunkContext(c, { ...init, heroLand }), sub).toy;
  assert.ok(keep && (drop?.indexCount ?? 0) < keep.indexCount, 'the seam building standing in the hero water is gone');
  const p = drop?.position ?? new Float32Array(0);
  for (let i = 0; i < (drop?.vertexCount ?? 0); i++) assert.ok(Math.hypot(p[i * 3] + 201, p[i * 3 + 2] - 57.5) > 1.5 || p[i * 3 + 1] < 0.5, 'no wall at (−201, 57.5)');
});

test('landmark exclusions: city buildings and streets drop out, the ground sinks under the model, the Palace lagoon is no hole', async () => {
  const sites = new CitySites();
  const ex = sites.excludes();
  const palace = ex.find(e => e.id === 'palace-of-fine-arts');
  assert.ok(palace?.poly && palace.sink && palace.sink > 0);
  assert.equal(ex.find(e => e.id === 'golden-gate-bridge')?.sink, 0);
  const ctx = await ctxOf(Math.floor(palace.x / 128), Math.floor(palace.z / 128));
  // the lagoon: every sample inside the exclusion is city ground (the landmark draws the water on top)
  let n = 0;
  for (let dz = -8; dz <= 8; dz += 2) for (let dx = -8; dx <= 8; dx += 2) {
    const x = palace.x + dx, z = palace.z + dz;
    if (!inPoly(x, z, palace.poly)) continue;
    assert.ok(isGround(ctx, x, z), `lagoon hole at (${x}, ${z})`);
    n++;
  }
  assert.ok(n > 10);
  // with vs without the exclusions: fewer city triangles on the landmark's chunk, and the ground inside its
  // footprint sinks by exactly `sink` (Lombard's lane and the Painted Ladies' stoops stay on top of it)
  for (const id of ['lombard-crooked-street', 'painted-ladies', 'city-hall']) {
    const e = ex.find(q => q.id === id)!;
    const c = await sf.chunk(Math.floor(e.x / 128), Math.floor(e.z / 128));
    assert.ok(c, id);
    const withEx = chunkContext(c, init), without = chunkContext(c, { ...init, excludes: [] });
    const sub = (e.x - c.cx * 128 >= 64 ? 1 : 0) + (e.z - c.cz * 128 >= 64 ? 2 : 0);
    assert.ok(buildL0(withEx, sub).triangles < buildL0(without, sub).triangles, `${id}: city buildings / streets dropped`);
    let n = 0;
    for (let dz = -6; dz <= 6; dz += 1.5) for (let dx = -6; dx <= 6; dx += 1.5) {
      const x = e.x + dx, z = e.z + dz;
      if (!withEx.excluded(x, z)) continue;
      assert.ok(Math.abs(without.height(x, z) - withEx.height(x, z) - (e.sink ?? 0)) < 1e-9, `${id} sink at (${x}, ${z})`);
      n++;
    }
    assert.ok(n > 3, id);
  }
});

test('street clipping: polylines clip to squares and out of polygons without losing the outside length', () => {
  const line = [0, 0, 0, 10, 0, 0, 20, 0, 0];
  const inSq = clipPolyline(line, 0, 3, 5, -5, 15, 5);
  assert.equal(inSq.length, 1);
  assert.deepEqual(inSq[0].filter((_, i) => i % 3 === 0), [5, 10, 15]);
  const sq = [{ x: 8, z: -2 }, { x: 12, z: -2 }, { x: 12, z: 2 }, { x: 8, z: 2 }];
  const out = clipOutside(line, sq, (x, z) => inPoly(x, z, sq));
  assert.equal(out.length, 2);
  const len = out.reduce((s, l) => s + Math.abs(l[l.length - 3] - l[0]), 0);
  assert.ok(Math.abs(len - 16) < 1e-6, `outside length ${len}`);
});

test('far city: L2 within budget, prisms keep out of the slab, shore texture covers the board, lakes at their level', async () => {
  const far = await sf.far();
  const r = buildFar(far, { slab, excludes: init.excludes });
  assert.ok(r.triangles < 190_000, `far triangles ${r.triangles}`);
  assert.ok(r.cells.length > 300, `far cells ${r.cells.length}`);
  for (const c of r.cells) {
    if (!c.toy) continue;
    const p = c.toy.position;
    for (let i = 0; i < c.toy.vertexCount; i += 13) {
      const x = p[i * 3], z = p[i * 3 + 2];
      const deep = inPoly(x, z, slab) && inPoly(x + 2, z, slab) && inPoly(x - 2, z, slab) && inPoly(x, z + 2, slab) && inPoly(x, z - 2, slab);
      assert.ok(!deep, `far prism vertex inside the slab (${x.toFixed(1)}, ${z.toFixed(1)})`);
    }
  }
  const s = r.shore;
  assert.equal(s.data.length, s.cols * s.rows);
  const at = (x: number, z: number) => s.data[Math.floor((z - s.z0) / s.step) * s.cols + Math.floor((x - s.x0) / s.step)];
  const mid = projectCity(37.84, -122.44); // mid-Bay between Alcatraz and Angel Island
  assert.equal(at(mid.x, mid.z), 255, 'open water is far from any shore');
  const mission = projectCity(37.7599, -122.4148);
  assert.equal(at(mission.x, mission.z), 0, 'land is distance 0');
  assert.ok(r.lakes && r.lakes.index.length > 0, 'hill lakes (Stow Lake, Mountain Lake …) get their own water');
  assert.ok(r.ms < 20_000);
  // wave 4 (lead-merge 8.4, lane V): a lake's hole rings are its islands — no lake surface deep inside Strawberry Hill
  const ar = far.areas;
  const islands: Vec2[][] = [];
  for (let i = 0; i < ar.count; i++) {
    if (!(ar.flags[i] & AREA_FLAG.hole) || AREA_CLASSES[ar.cls[i]] !== 'water') continue;
    const ring: Vec2[] = [];
    for (let p = ar.pStart[i]; p < ar.pStart[i + 1]; p++) ring.push({ x: ar.xz[p * 2], z: ar.xz[p * 2 + 1] });
    islands.push(ring);
  }
  assert.ok(islands.some(q => inPoly(-262, 1030, q)), 'far.obc carries Strawberry Hill as a water hole');
  const lp = r.lakes!.position;
  let deepIn = 0;
  for (let i = 0; i < lp.length; i += 3) for (const q of islands) if (inPoly(lp[i], lp[i + 2], q) && ringDistance(q, lp[i], lp[i + 2]) > 4) deepIn++;
  assert.equal(deepIn, 0, 'lake surface vertices deep inside an island');
});

/** Distance from (x, z) to the edges of a closed ring. */
function ringDistance(q: readonly Vec2[], x: number, z: number) {
  let best = Infinity;
  for (let k = 0; k < q.length; k++) {
    const a = q[k], b = q[(k + 1) % q.length], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2)) : 0;
    best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return best;
}

test('lake islands are drawn as ground (lead-merge 8.4): the L0 mask agrees with the walk raster on the Golden Gate Park lakes', async () => {
  // Stow Lake (Strawberry Hill and its small islands), Blue Heron … and Lake Merced (−1_12): every 0.5 u cell whose
  // 4.5 u neighbourhood is all land or all water in core/sfTerrain's raster is ground / water in the drawn mask too;
  // a pond no far lake surface covers is ground painted as a pond (POND_CLASS: the Strawberry Hill reservoir)
  const farWater = farWaterRings(await sf.far());
  const withWater = { ...init, farWater };
  for (const [cx, cz] of [[-3, 8], [-2, 7], [-2, 8], [-1, 12]]) {
    const c = (await sf.chunk(cx, cz))!;
    const ctx = chunkContext(c, withWater), r = rasterizeChunk(c);
    const pond = (x: number, z: number) => ctx.clsData[Math.floor((z - ctx.cls.z0) / ctx.cls.step) * ctx.cls.cols + Math.floor((x - ctx.cls.x0) / ctx.cls.step)] === POND_CLASS;
    const m = Math.round(Math.sqrt(r.kind.length)), A = (m - r.n) / 2;
    let land = 0, bad = 0;
    const where: string[] = [];
    for (let j = 4; j < r.n - 4; j += 2) for (let i = 4; i < r.n - 4; i += 2) {
      const k = r.kind[(j + A) * m + (i + A)];
      if (k !== SF_KIND.land && k !== SF_KIND.water) continue;
      let uniform = true;
      for (let dj = -4; dj <= 4 && uniform; dj++) for (let di = -4; di <= 4; di++) if (r.kind[(j + dj + A) * m + (i + di + A)] !== k) { uniform = false; break; }
      if (!uniform) continue;
      const x = cx * 128 + (i + 0.5) * 0.5, z = cz * 128 + (j + 0.5) * 0.5;
      if (k === SF_KIND.land) land++;
      if (isGround(ctx, x, z) !== (k === SF_KIND.land || pond(x, z))) { bad++; if (where.length < 4) where.push(`(${x}, ${z})`); }
    }
    assert.ok(land > 1000, `${cx}_${cz} land samples`);
    assert.equal(bad, 0, `${cx}_${cz}: drawn ≠ walked at ${where.join(' ')}`);
  }
  // the Chinese Pavilion (lane L's blue-heron-lake site) stands on Strawberry Hill's east shore
  const ctx = chunkContext((await sf.chunk(-2, 7))!, withWater);
  assert.ok(isGround(ctx, -251.5, 1017), 'the pavilion origin is ground');
  // the reservoir on top of Strawberry Hill (−268, 1024; far.obc drops water under 200 u²): painted, not a pit
  const top = chunkContext((await sf.chunk(-3, 8))!, withWater);
  assert.ok(isGround(top, -268, 1024) && top.clsData[Math.floor((1024 - top.cls.z0) / top.cls.step) * top.cls.cols + Math.floor((-268 - top.cls.x0) / top.cls.step)] === POND_CLASS, 'the reservoir is a painted pond');
  assert.ok(!isGround(chunkContext((await sf.chunk(-3, 8))!, init), -268, 1024), 'without far water (tests, first jobs) every lake is cut out as before');
});

test('ponds: every chunk lake above the sea that no far water covers is painted on the ground, every other lake stays cut out', async () => {
  const farWater = farWaterRings(await sf.far());
  const withWater = { ...init, farWater };
  let painted = 0, cut = 0;
  for (const k of sf.manifest.chunks) {
    if (k.hero) continue;
    const c = (await sf.chunk(k.cx, k.cz))!;
    const ar = c.areas;
    let coast = true, any = false;
    for (let i = 0; i < ar.count; i++) {
      const cls = AREA_CLASSES[ar.cls[i]];
      if (cls !== 'land' && cls !== 'water') coast = false;
      if (!coast && cls === 'water' && !(ar.flags[i] & AREA_FLAG.hole)) { any = true; break; }
    }
    if (!any) continue;
    const ctx = chunkContext(c, withWater);
    coast = true;
    for (let i = 0; i < ar.count; i++) {
      const cls = AREA_CLASSES[ar.cls[i]];
      if (cls !== 'land' && cls !== 'water') coast = false;
      if (coast || cls !== 'water' || ar.flags[i] & AREA_FLAG.hole) continue;
      const ring: Vec2[] = [];
      for (let p = ar.pStart[i]; p < ar.pStart[i + 1]; p++) ring.push({ x: ar.xz[p * 2], z: ar.xz[p * 2 + 1] });
      const cx = ring.reduce((s, p) => s + p.x, 0) / ring.length, cz = ring.reduce((s, p) => s + p.z, 0) / ring.length;
      if (!inPoly(cx, cz, ring) || ctx.excluded(cx, cz) || ringDistance(ring, cx, cz) < 1.5) continue;
      const lo = Math.min(...ring.map(p => demSample(c.dem, p.x, p.z)));
      const covered = inFarWater(farWater, cx, cz);
      if (covered || lo <= 0.6) { assert.ok(!isGround(ctx, cx, cz), `${k.k}#${i} (${cx.toFixed(0)}, ${cz.toFixed(0)}) cut out`); cut++; }
      else if (ring.filter(p => inFarWater(farWater, p.x, p.z)).length * 2 < ring.length) { assert.ok(isGround(ctx, cx, cz), `${k.k}#${i} (${cx.toFixed(0)}, ${cz.toFixed(0)}) painted`); painted++; }
    }
  }
  assert.ok(painted >= 10 && cut >= 20, `painted ${painted}, cut ${cut}`);
});

test('pools: size classes grow by 1.25 and always fit the item', () => {
  for (const v of [1, 100, 256, 257, 1000, 5000, 20000]) {
    const c = sizeClass(v, v * 1.5, 1.6);
    assert.ok(classVerts(c) >= v && Math.ceil(classVerts(c) * 1.6) >= v * 1.5);
    if (c > 0) assert.ok(classVerts(c - 1) < v || Math.ceil(classVerts(c - 1) * 1.6) < v * 1.5);
  }
});

test('city board: Ocean Beach surf and the Bay inside, the county line cut keeps San Francisco and drops Daly City', () => {
  const board = boardPolygon();
  const inside = (lat: number, lng: number) => { const p = projectCity(lat, lng); return inPoly(p.x, p.z, board); };
  assert.ok(inside(37.76, -122.515), 'Pacific off Ocean Beach');
  assert.ok(inside(37.8235, -122.3707), 'Treasure Island');
  assert.ok(inside(37.8609, -122.4326), 'Angel Island');
  assert.ok(inside(37.8267, -122.423), 'Alcatraz');
  assert.ok(!inside(37.88, -122.2), 'the far side of the Berkeley / Oakland ridge is beyond (the world polygon cuts along the crest)');
  const cut = southCut();
  const keep = (lat: number, lng: number) => { const p = projectCity(lat, lng); return p.x * cut.nx + p.z * cut.nz <= cut.d; };
  assert.ok(keep(37.72, -122.45), 'Excelsior');
  assert.ok(!keep(37.69, -122.47), 'Daly City');
});

test('hero far stand-in: one L1 box per lot and shed, inside the slab, a few thousand triangles', () => {
  const p = heroProxy();
  assert.ok(p);
  const t = p.indexCount / 3;
  const sheds = DISTRICT.piers.filter(q => q.shed).length;
  assert.ok(t >= (DISTRICT.blocks.length + sheds) * 10 && t <= (DISTRICT.blocks.length + sheds) * 14, `${t} triangles`);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const q of slab) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z); }
  for (let i = 0; i < p.vertexCount; i++) {
    const x = p.position[i * 3], z = p.position[i * 3 + 2];
    assert.ok(x > x0 - 3 && x < x1 + 3 && z > z0 - 3 && z < z1 + 3);
  }
});

test('the city code stays worker-safe: the worker graph imports no DOM, React or materials', () => {
  const root = path.resolve(import.meta.dirname, '../src/opus-bay');
  const seen = new Set<string>();
  const bad: string[] = [];
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/^import\s+(?!type\b)[^'"]*from\s+'([^']+)'/gm)) {
      const spec = m[1];
      if (!spec.startsWith('.')) { if (/react|drei|fiber/.test(spec)) bad.push(`${file}: ${spec}`); continue; }
      const f = [spec + '.ts', spec + '.tsx', spec + '/index.ts'].map(s => path.resolve(path.dirname(file), s)).find(p => fs.existsSync(p));
      if (!f) continue;
      if (/materials\.ts$|\.tsx$|world\/world\.ts$|core\/store\.ts$/.test(f)) bad.push(`${path.relative(root, file)} → ${path.relative(root, f)}`);
      visit(f);
    }
  };
  visit(path.join(root, 'world/sf/worker.ts'));
  assert.deepEqual(bad, []);
  assert.ok(seen.size > 8);
});

test('city-mode World builds headless: hero first, backdrop in its own chunks, no district water; district unchanged', async () => {
  const { World } = await import('../src/opus-bay/world/world');
  // city mode builds only once the lazy city chunk is in (world/cityLoader.ts, HC-2)
  const { loadCity } = await import('../src/opus-bay/world/cityLoader');
  await loadCity();
  const city = new World('city');
  const names = new Set<string>();
  city.root.traverse(o => { if (o.name) names.add(o.name.replace(/#\d+$/, '#')); });
  assert.ok(names.has('city#') && names.has('ground#') && names.has('backdrop#'), [...names].join(' '));
  assert.ok(!names.has('water#'), 'city water replaces the district water');
  assert.ok(names.has('city-water'));
  assert.ok(city.cityWater && city.cityWater.board.length >= 6);
  const district = new World('district');
  const dn = new Set<string>();
  district.root.traverse(o => { if (o.name) dn.add(o.name.replace(/#\d+$/, '#')); });
  assert.ok(dn.has('water#') && !dn.has('backdrop#') && !dn.has('city-water'));
});

// ---------------------------------------------------------------------------
// lane C2 (wave 2): SF look budget, drawn = walked ground, seam buildings
// ---------------------------------------------------------------------------

test('SF look: every L0 cell of the city stays ≤ 18,500 triangles with the flat-roof remap (cheap flat tops)', async () => {
  const { lookZones } = await import('../src/opus-bay/world/sf/look');
  const zinit = { ...init, zones: lookZones(await sf.far()) };
  let max = 0, at = '', total = 0;
  for (const k of sf.manifest.chunks) {
    const c = await sf.chunk(k.cx, k.cz);
    if (!c) continue;
    const ctx = chunkContext(c, zinit);
    for (let sub = 0; sub < 4; sub++) {
      const t = buildL0(ctx, sub).triangles;
      total += t;
      if (t > max) { max = t; at = `${k.cx}_${k.cz}/${sub}`; }
    }
  }
  assert.ok(max <= 18500, `densest L0 cell ${at}: ${max}`);
  assert.ok(total > 1_000_000, `${total} L0 triangles in all`);
});

test('drawn ground = walked ground: L0 height is groundRaster − sink (within 0.02 u) away from bridges and decks', async () => {
  const { groundRaster, rasterHeight } = await import('../src/opus-bay/core/sfTerrain');
  const { BRIDGE_KEEP } = await import('../src/opus-bay/world/sf/build');
  const { ROAD_FLAG } = await import('../src/opus-bay/world/sf/format');
  let n = 0, kept = 0;
  // Mission, Twin Peaks, Painted Ladies (sink), Lombard (sink), the Embarcadero freeway ramps, a hero seam chunk
  for (const [cx, cz] of [[2, 6], [1, 7], [0, 4], [-1, 2], [2, -1], [-2, 0]]) {
    const c = await sf.chunk(cx, cz);
    assert.ok(c, `${cx}_${cz}`);
    const ctx = chunkContext(c, init), gr = groundRaster(c);
    const nearBridge = (x: number, z: number) => {
      const rd = c.roads;
      for (let i = 0; i < rd.count; i++) {
        if (!(rd.flags[i] & (ROAD_FLAG.bridge | ROAD_FLAG.deckOnly))) continue;
        for (let k = rd.pStart[i]; k + 1 < rd.pStart[i + 1]; k++) {
          const ax = rd.xyz[k * 3], az = rd.xyz[k * 3 + 2], dx = rd.xyz[k * 3 + 3] - ax, dz = rd.xyz[k * 3 + 5] - az, L2 = dx * dx + dz * dz;
          const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0;
          if (Math.hypot(x - ax - dx * t, z - az - dz * t) <= rd.width[i] / 2 + BRIDGE_KEEP + 1) return true;
        }
      }
      return false;
    };
    const sinkAt = (x: number, z: number) => ctx.exclusions.find(e => inPoly(x, z, e.poly))?.sink ?? 0;
    for (let z = cz * 128 + 0.3; z < cz * 128 + 128; z += 3.1) for (let x = cx * 128 + 0.7; x < cx * 128 + 128; x += 3.1) {
      if (nearBridge(x, z)) { kept++; continue; }
      const want = rasterHeight(gr, x, z) - sinkAt(x, z);
      assert.ok(Math.abs(ctx.height(x, z) - want) <= 0.02, `${cx}_${cz} (${x.toFixed(1)}, ${z.toFixed(1)}): drawn ${ctx.height(x, z).toFixed(3)} walked ${want.toFixed(3)}`);
      n++;
    }
  }
  assert.ok(n > 8000 && kept > 0, `${n} samples, ${kept} near bridges`);
});

test('seam buildings in the hero water are dropped before rasterising: no invisible walls at the west seam', async () => {
  const { dropSeamBuildings } = await import('../src/opus-bay/world/sf/build');
  const { rasterizeChunk, SF_CELL, BLOCK_BIT } = await import('../src/opus-bay/core/sfTerrain');
  const heroLand = heroLandRaster();
  const c = (await sf.chunk(-2, 0))!;
  const before = c.buildings.count;
  const rBefore = rasterizeChunk(c);
  const dropped = dropSeamBuildings(c, { ...init, heroLand });
  assert.ok(dropped.includes(288472567) && dropped.includes(1092477935), `dropped ${dropped.join(', ')}`);
  assert.equal(c.buildings.count, before - dropped.length);
  assert.equal(c.buildings.vStart.length, c.buildings.count + 1);
  const r = rasterizeChunk(c);
  // (−201, 57.5): a wall before, none after
  const at = (rr: typeof r, x: number, z: number) => rr.stand[Math.floor((z - rr.cz * 128) / SF_CELL) * rr.n + Math.floor((x - rr.cx * 128) / SF_CELL)];
  assert.ok(at(rBefore, -201, 57.5) & BLOCK_BIT, 'the seam building blocked before');
  assert.equal(at(r, -201, 57.5) & BLOCK_BIT, 0, 'no wall after');
  assert.ok(r.blockers.count < rBefore.blockers.count);
  // idempotent, and chunks away from the slab are untouched
  assert.deepEqual(dropSeamBuildings(c, { ...init, heroLand }), []);
  const far = (await sf.chunk(2, 6))!, n0 = far.buildings.count;
  assert.deepEqual(dropSeamBuildings(far, { ...init, heroLand }), []);
  assert.equal(far.buildings.count, n0);
});
