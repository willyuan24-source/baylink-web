import assert from 'node:assert/strict';
import test from 'node:test';
import { createCityTerrain } from '../src/opus-bay/core/sfTerrain';
import { runtime } from '../src/opus-bay/core/runtime';
import { canStand, isWater, setCityTerrain } from '../src/opus-bay/core/terrain';
import type { Bilingual } from '../src/opus-bay/core/types';
import { findPath, graphNodeFilter, routeTo } from '../src/opus-bay/actors/nav';
import { game } from '../src/opus-bay/core/store';
import { ARRIVAL_MIN_R, ArrivalWatcher, arrivalAnchors } from '../src/opus-bay/game/arrival';
import { DISTRICT } from '../src/opus-bay/data/district';
import { ATTRACTIONS, ATTRACTION_INDEX } from '../src/opus-bay/data/sf/attractions';
import { W8_W1_LINES, attachSights, facing, sightAt } from '../src/opus-bay/world/sf/cornersSights';
import { demSample } from '../src/opus-bay/world/sf/format';
import { CitySites } from '../src/opus-bay/world/sf/sites';
import { OBRIEN, OBRIEN_MID, PIER35_WEST, SHIPS_MID, SHIP_BUDGET, SHIP_CULL, buildShipBatch, buildWharfShips } from '../src/opus-bay/world/sf/wharfShips';
import { sfDisk } from './opus-bay-sf-disk';

/**
 * Wave 8 · lane W1 · W8-W12 the SS Jeremiah O'Brien at Pier 35 (world/sf/wharfShips.ts) and her arrival on the
 * promenade (data/sf/attractions.ts ARRIVAL_OVERRIDES), and BAYBAY's sight lines (world/sf/cornersSights.ts).
 */

type P = { x: number; z: number };
function inPoly(x: number, z: number, p: readonly P[]) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c; }
  return c;
}
function segD(x: number, z: number, a: P, b: P) {
  const dx = b.x - a.x, dz = b.z - a.z, l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l)) : 0;
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}
const L = Math.hypot(OBRIEN.bow.x - OBRIEN.stern.x, OBRIEN.bow.z - OBRIEN.stern.z);
const U = { x: (OBRIEN.bow.x - OBRIEN.stern.x) / L, z: (OBRIEN.bow.z - OBRIEN.stern.z) / L };
/** hull frame → world (s along from the stern, t across) */
const H = (s: number, t: number): P => ({ x: OBRIEN.stern.x + U.x * s + U.z * t, z: OBRIEN.stern.z + U.z * s - U.x * t });

test('W8-W12 the O\'Brien: a Liberty ship\'s size, one mesh with the Pampanito within budget, along the toy Pier 35\'s west face', () => {
  assert.ok(L > 18.6 && L < 19.1, `${L.toFixed(2)} u long (441 ft 6 in at K 0.14 = 18.84)`);
  const b = buildShipBatch('obrien'), a = b.toArrays();
  assert.ok(a.indexCount / 3 <= 700, `${a.indexCount / 3} triangles`);
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < a.vertexCount; i++) { y0 = Math.min(y0, a.position[i * 3 + 1]); y1 = Math.max(y1, a.position[i * 3 + 1]); }
  assert.ok(y0 < -0.6 && y1 > 3 && y1 < 5, `y ${y0.toFixed(2)} … ${y1.toFixed(2)} (the keel under the water, the masts ≤ 5.4 u over it)`);
  const s = buildWharfShips();
  assert.ok(s.triangles <= SHIP_BUDGET.triangles, `${s.triangles} triangles for both ships`);
  s.toy.geometry.dispose();
  // parallel to the pier's west face, off it by its half beam and a gap
  const pier = DISTRICT.piers.find(p => p.id === 'pier35')!;
  const cos = U.x * PIER35_WEST.dir.x + U.z * PIER35_WEST.dir.z;
  assert.ok(cos > 0.999, `parallel to the pier (cos ${cos.toFixed(4)})`);
  for (let k = 0; k <= 20; k++) for (const t of [-1.2, 0, 1.2]) {
    const p = H((k / 20) * L, t);
    assert.ok(!inPoly(p.x, p.z, pier.deck), `hull point ${p.x.toFixed(2)}, ${p.z.toFixed(2)} off the pier deck`);
    const d = Math.min(...pier.deck.map((q, i) => segD(p.x, p.z, q, pier.deck[(i + 1) % pier.deck.length])));
    assert.ok(d >= 0.3, `hull point ${k}/${t} ${d.toFixed(2)} u from the deck`);
  }
  // the LOD (one mesh for both ships) reaches the O'Brien's promenade and the Pampanito's door
  assert.ok(Math.hypot(OBRIEN_MID.x - SHIPS_MID.x, OBRIEN_MID.z - SHIPS_MID.z) < SHIP_CULL - 120);
  const e = ATTRACTION_INDEX.get('ss-jeremiah-obrien')!.arrival!;
  assert.ok(Math.hypot(e.x - SHIPS_MID.x, e.z - SHIPS_MID.z) < SHIP_CULL - 80);
});

test('W8-W12 in city mode: the hull lies in the water, the arrival on the promenade faces her and is reached from the walking graph', async () => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.window ??= globalThis;
  const sf = sfDisk(), far = await sf.far();
  const sites = new CitySites(), lms = sites.walkInputs();
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(far);
  sites.onBase = (id, y) => { city.setLandmarkBase(id, y); };
  sites.attach(null as never, (x, z) => demSample(far.dem, x, z));
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  await sf.attachAround(city, -135, -5, 60, lms);
  try {
    for (let k = 0; k <= 16; k++) for (const t of [-1.1, 0, 1.1]) {
      const p = H(0.3 + (k / 16) * (L - 0.6), t * (k === 16 ? 0.2 : 1));
      assert.ok(isWater(p.x, p.z) && !canStand(p.x, p.z, 0.2), `hull ${k}/${t} at ${p.x.toFixed(2)}, ${p.z.toFixed(2)} in the water`);
    }
    // the stern lies by the seawall: the promenade within 3 u of it
    let near = false;
    for (let dz = -3; dz <= 3; dz += 0.5) for (let dx = -3; dx <= 3; dx += 0.5) if (Math.hypot(dx, dz) <= 3 && canStand(OBRIEN.stern.x + dx, OBRIEN.stern.z + dz, 0.4)) near = true;
    assert.ok(near, 'the stern by the promenade');
    // the trip end: standable, the nearest USABLE main-component graph node (actors/nav routeTo's own filter, the
    // static sweep's rule since W8-W1-review) and a nav path from it ends on it; the ship beside it (W1-RC-1 / W1-P1:
    // the wave-8 end by Pier 39's gate stood 26 u from her)
    const a = ATTRACTION_INDEX.get('ss-jeremiah-obrien')!, e = a.arrival!;
    assert.ok(canStand(e.x, e.z, 0.4), 'the arrival stands');
    const ix = await sf.graphIndex(), main = ix.mainComponent(), usable = graphNodeFilter(ix);
    const n = ix.nearestNode(e.x, e.z, 60, k => ix.component(k) === main && usable(k));
    assert.ok(n >= 0, 'a usable graph node within 60 u');
    const res = findPath({ x: ix.x(n), z: ix.z(n) }, e, 8);
    const end = res?.points[res.points.length - 1];
    assert.ok(res && (!end || Math.hypot(end.x - e.x, end.z - e.z) <= 1.1), 'a nav path reaches it');
    const d = Math.hypot(OBRIEN_MID.x - e.x, OBRIEN_MID.z - e.z);
    assert.ok(d < 12, `the ship ${d.toFixed(1)} u away`);
    assert.ok(Math.hypot(OBRIEN.stern.x - e.x, OBRIEN.stern.z - e.z) < 6, 'by her stern');
    // the game's walking route reaches it from the Embarcadero (east of Pier 35) and from Pier 39's gate (local routes)
    for (const from of [{ x: -100.9, z: -2.6 }, { x: -160.66, z: 24.1 }]) {
      const r = await routeTo(from, e, { graph: ix, budgetMs: 1000 });
      assert.ok(r && !r.snapped, `a route from ${from.x}, ${from.z}`);
      const last = r.points[r.points.length - 1];
      assert.ok(Math.hypot(last.x - e.x, last.z - e.z) < 0.5, 'ends on the trip end');
      const p = findPath(from, e, 8), pe = p?.points[p.points.length - 1];
      assert.ok(p && (!pe || Math.hypot(pe.x - e.x, pe.z - e.z) <= 1.1), `the nav grid walks it from ${from.x}, ${from.z}`);
    }
    const want = Math.atan2(OBRIEN_MID.x - e.x, OBRIEN_MID.z - e.z);
    let dh = Math.abs(want - (e.heading ?? 99)) % (Math.PI * 2);
    dh = Math.min(dh, Math.PI * 2 - dh);
    assert.ok(dh < (25 * Math.PI) / 180, `faces the ship (${((dh * 180) / Math.PI).toFixed(1)}°)`);
    // the sight lines' circles stand on walkable ground
    for (const l of W8_W1_LINES) if (Math.abs(l.x + 130) < 40) assert.ok(canStand(l.x, l.z, 0.4), `${l.id} circle stands`);
  } finally { setCityTerrain(null); sites.dispose(); }
});

test('W8-W1 sight lines: fixed zh + en, short, each said once per session, never on an attraction\'s trip end', () => {
  const ids = W8_W1_LINES.map(l => l.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const l of W8_W1_LINES) {
    assert.match(l.id, /^w8w1-[a-z0-9-]+$/);
    assert.ok([...l.zh].length <= 45 && l.en.length <= 110, `${l.id} short`);
    assert.ok(!/[{}$%]/.test(l.zh + l.en), `${l.id} has no template`);
    assert.match(l.source, /^https:\/\//);
    for (const a of ATTRACTIONS) {
      const e = a.arrival ?? a;
      assert.ok(Math.hypot(e.x - l.x, e.z - l.z) >= l.r + 1, `${l.id} clear of ${a.id}'s trip end`);
    }
  }
  const said: Bilingual[] = [];
  const sys = attachSights(t => { said.push(t); });
  const saved = { x: runtime.player.x, z: runtime.player.z, heading: runtime.player.heading };
  const at = (l: (typeof W8_W1_LINES)[number]) => {
    runtime.player.x = l.x; runtime.player.z = l.z;
    runtime.player.heading = l.face ? Math.atan2(l.face.x - l.x, l.face.z - l.z) : 0;
  };
  try {
    for (const l of W8_W1_LINES) {
      at(l);
      sys.update!(0.5, 0, null as never, 0);
      sys.update!(0.5, 0, null as never, 0);
    }
    at(W8_W1_LINES[0]);
    sys.update!(0.5, 0, null as never, 0);
    assert.deepEqual(said.map(t => t.zh), W8_W1_LINES.map(l => l.zh), 'each once, in order');
    assert.equal(sightAt(0, 0), null);
  } finally { Object.assign(runtime.player, saved); sys.dispose?.(); }
});

test('W8-W1-review sight lines: on foot only (W1-P2), the O\'Brien\'s while facing her (W1-P3), a refused line is not spent; her arrival fires by the ship (W1-RC-1)', () => {
  const saved = { x: runtime.player.x, z: runtime.player.z, heading: runtime.player.heading, move: game.get().move };
  const ob = W8_W1_LINES.find(l => l.id === 'w8w1-obrien-normandy')!;
  assert.ok(ob.face && Math.hypot(ob.face.x - OBRIEN_MID.x, ob.face.z - OBRIEN_MID.z) < 0.05, 'faces OBRIEN_MID');
  const setMode = (mode: string) => game.set({ move: { mode } } as never);
  const said: string[] = [];
  let refuse = false;
  const sys = attachSights(t => { if (refuse) return false; said.push(t.en); return true; });
  const step = () => { sys.update!(0.5, 0, null as never, 0); };
  try {
    // gliding over Grant Ave, driving through the O'Brien's circle, riding, travelling: nothing
    for (const mode of ['glide', 'car', 'transit', 'travel']) {
      setMode(mode);
      for (const l of W8_W1_LINES) { runtime.player.x = l.x; runtime.player.z = l.z; runtime.player.heading = l.face ? Math.atan2(l.face.x - l.x, l.face.z - l.z) : 0; step(); }
    }
    assert.deepEqual(said, [], 'nothing said off foot');
    setMode('foot');
    // the walk with the ship behind (heading east / south / north-east): nothing; facing her: the line
    runtime.player.x = ob.x; runtime.player.z = ob.z;
    for (const h of [Math.PI / 2, 0, Math.PI / 4]) { runtime.player.heading = h; assert.equal(facing(ob.x, ob.z, h, ob.face!), false); step(); }
    assert.deepEqual(said, [], 'not with the ship behind');
    runtime.player.heading = -Math.PI / 2 - 0.3; // walking west-north-west along the apron, the hull ahead
    refuse = true; step();
    assert.deepEqual(said, [], 'refused by the pacer');
    refuse = false; step();
    assert.deepEqual(said, [ob.en], 'offered again and said once');
    step();
    assert.equal(said.length, 1);
  } finally { game.set({ move: saved.move } as never); runtime.player.x = saved.x; runtime.player.z = saved.z; runtime.player.heading = saved.heading; sys.dispose?.(); }
  // the arrival anchor: a walk along the apron from the east to her stern arrives (the wave-8 anchor by Pier 39 never did)
  const anchors = arrivalAnchors(ATTRACTIONS), o = anchors.find(q => q.attraction === 'ss-jeremiah-obrien')!;
  assert.ok(Math.hypot(o.x - OBRIEN.stern.x, o.z - OBRIEN.stern.z) < ARRIVAL_MIN_R / 2, 'the anchor by her stern');
  const w = new ArrivalWatcher(anchors, []);
  const hits: string[] = [];
  for (let x = -100; x >= -125; x -= 0.5) {
    const h = w.step({ x, z: -9, now: 1e6 - x * 100, onFoot: true, hoppedOffAt: -1e9, busy: false, travelling: false });
    if (h) hits.push(h.anchor.attraction);
  }
  assert.ok(hits.includes('ss-jeremiah-obrien'), `arrived (${hits.join(', ')})`);
});
