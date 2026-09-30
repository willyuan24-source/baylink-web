import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Wave 7 · lane H, part b: the Día de los Muertos procession (the route, the head's walk with its corner pauses, the
// walkers: two instanced meshes, candles, the toy traffic stops for them) and the pumpkin patches at the season's pumpkin
// events (lane S's kits, the catalog's windows).

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { TOY, TOY_INST, TOY_INST_TINT } = await import('../src/opus-bay/world/materials');
const MS = await import('../src/opus-bay/halloween/muertosSpots');
const MW = await import('../src/opus-bay/halloween/muertosWalkers');
const MU = await import('../src/opus-bay/halloween/muertos');
const RP = await import('../src/opus-bay/world/sf/roadPeople');
const WV = await import('../src/opus-bay/halloween/worldVenues');
const { EVENT_VENUES } = await import('../src/opus-bay/realsf/eventVenues');
const { __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const { runtime } = await import('../src/opus-bay/core/runtime');

test('W7-H6 the procession route: a closed loop 22nd & Bryant → 24th → Mission → 22nd, its four corners by the street crossings', () => {
  const r = MW.processionRoute();
  assert.ok(Math.abs(r.length - MS.PROCESSION_LENGTH) < 1, `${r.length} vs ${MS.PROCESSION_LENGTH}`);
  assert.ok(r.length > 250 && r.length < 400);
  // no gap between samples (≤ 2.5 u), the last joins the first
  const n = r.x.length;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; assert.ok(Math.hypot(r.x[j] - r.x[i], r.z[j] - r.z[i]) < 2.5, `sample ${i}`); }
  const C = MS.ROUTE_CORNERS;
  const corners = MW.processionCorners();
  assert.equal(corners.length, 4);
  // in route order: 22nd & Bryant (the start), 24th & Bryant, 24th & Mission, 22nd & Mission — each within 4 u of the crossing
  const want = [C.bryant22, C.bryant24, C.mission24, C.mission22];
  corners.forEach((s, k) => { const p = MW.routeAt(s); assert.ok(Math.hypot(p.x - want[k].x, p.z - want[k].z) < 4, `corner ${k} at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`); });
  // it starts south along Bryant: from 22nd toward 24th
  const a = MW.routeAt(5), b = MW.routeAt(40);
  assert.ok(Math.hypot(b.x - C.bryant24.x, b.z - C.bryant24.z) < Math.hypot(a.x - C.bryant24.x, a.z - C.bryant24.z));
});

test('W7-H6 the head leaves the gathering at 19:00 at a slow walk and pauses at every corner', () => {
  const count = 26;
  const h0 = MW.headAt(0, count);
  assert.equal(h0.s, MW.gatherHead(count));
  assert.equal(h0.paused, false);
  const corners = MW.processionCorners();
  const toFirst = (corners[1] - MW.gatherHead(count)) / MW.WALK.speed;
  assert.equal(MW.headAt(toFirst - 1, count).paused, false);
  const p = MW.headAt(toFirst + MW.WALK.pause / 2, count);
  assert.ok(p.paused && Math.abs(p.s - corners[1]) < 1e-3, 'standing at 24th & Bryant');
  assert.equal(MW.headAt(toFirst + MW.WALK.pause + 1, count).paused, false);
  // never goes back, laps on
  let prev = -Infinity;
  for (let t = 0; t < 7200; t += 7) { const s = MW.headAt(t, count).s; assert.ok(s >= prev - 1e-6, `t ${t}`); prev = s; }
  const L = MW.processionRoute().length, lap = L / MW.WALK.speed + 4 * MW.WALK.pause;
  assert.ok(Math.abs(MW.headAt(lap + 10, count).s - MW.headAt(10, count).s - L) < 1e-3, 'one lap later: one route further');
  // two hours ≈ a few laps (a slow walk, not a race)
  assert.ok(MW.headAt(7200, count).s / L > 5 && MW.headAt(7200, count).s / L < 30);
});

test('W7-H6 the walkers: two instanced meshes on the warmed toy programs, marigold crowns and candles, on the route, halos only while they gather', () => {
  const w = MW.createWalkers();
  const n = w.count();
  assert.ok(n >= MW.WALKERS_BY_QUALITY.low && n <= MW.WALKERS_BY_QUALITY.high);
  const meshes = w.group.children as import('three').InstancedMesh[];
  assert.equal(meshes.length, 2);
  const mats = meshes.map(m => m.material);
  assert.ok(mats.includes(TOY_INST_TINT) && mats.includes(TOY_INST));
  for (const m of meshes) { assert.ok(m.receiveShadow && !m.castShadow); assert.ok(m.boundingSphere && m.boundingSphere.radius > 50); }
  const tint = meshes.find(m => m.material === TOY_INST_TINT)!;
  assert.ok(tint.instanceColor, 'the robes are the instance colour');
  const geo = MW.walkerGeometry();
  const tris = ((geo.robe.index?.count ?? 0) + (geo.rest.index?.count ?? 0)) / 3;
  assert.ok(tris < 420, `${tris} triangles a walker`);
  // the candle flame always glows (aInfo.w in (1, 2])
  const inf = geo.rest.getAttribute('aInfo');
  let glow = 0;
  for (let i = 0; i < inf.count; i++) if (inf.getW(i) > 1) glow++;
  assert.ok(glow > 0);
  w.step('gather', 0, 0);
  assert.equal(w.halos().length, n, 'a candle halo each while they stand');
  const onRoute = () => {
    const r = MW.processionRoute();
    w.each((x, z) => {
      let d = Infinity;
      for (let i = 0; i < r.x.length; i++) d = Math.min(d, Math.hypot(r.x[i] - x, r.z[i] - z));
      assert.ok(d < MW.WALK.spread + 1.2, `a walker ${d.toFixed(2)} u off the route`);
    });
  };
  onRoute();
  // gathering on Bryant just south of 22nd
  const C = MS.ROUTE_CORNERS.bryant22;
  w.each((x, z) => assert.ok(Math.hypot(x - C.x, z - C.z) < MW.gatherHead(n) + 3));
  w.step('walk', 600, 600);
  assert.equal(w.halos().length, 0, 'walking: the flames glow, no halos trailing');
  onRoute();
  assert.ok(w.near(MW.routeAt(MW.headAt(600, n).s).x, MW.routeAt(MW.headAt(600, n).s).z, 3));
  w.dispose();
});

test('W7-H6 the toy traffic stops for them: a road-people provider the city\'s traffic reads (cityLife), removed on teardown', () => {
  const got: number[] = [];
  const off = RP.addRoadPeople(put => { put(1, 2, 0.35); });
  RP.eachRoadPerson((x, z, r) => got.push(x, z, r));
  assert.deepEqual(got, [1, 2, 0.35]);
  off();
  got.length = 0;
  RP.eachRoadPerson((x, z, r) => got.push(x, z, r));
  assert.equal(got.length, 0);
  const src = fs.readFileSync(path.join(ROOT, 'src/opus-bay/world/sf/cityLife.ts'), 'utf8');
  assert.match(src, /eachRoadPerson\(put\)/);
});

test('W7-H6 muertos on 2 November: the walkers come at 18:00, walk from 19:00, go at 21:00; BAYBAY\'s procession line near them', () => {
  const m = MU.createMuertos();
  const at = MS.ROUTE_CORNERS.bryant22;
  runtime.move.mode = 'foot';
  try {
    __setBayNowForTests('2026-11-02T17:30');
    m.step(1, at.x, 3, at.z, true);
    assert.equal(m.stats().walkers, 0);
    __setBayNowForTests('2026-11-02T18:20');
    m.step(1, at.x, 3, at.z, true);
    assert.equal(m.stats().procession, 'gather');
    assert.ok(m.stats().walkers > 0);
    assert.ok(m.halos().length > 20, 'the altars\' and the gathering candles');
    assert.ok(m.near(at.x, at.z).some(l => l.line === 'processionGather'));
    __setBayNowForTests('2026-11-02T19:05');
    m.step(1, at.x, 3, at.z, true);
    assert.equal(m.stats().procession, 'walk');
    const head = MW.routeAt(MW.headAt(300, m.stats().walkers).s);
    m.step(0.016, head.x, 3, head.z, true);
    assert.ok(m.near(head.x, head.z).some(l => l.line === 'processionWalk'), 'BAYBAY: 游行的队伍过来了');
    let people = 0;
    RP.eachRoadPerson(() => { people++; });
    assert.equal(people, m.stats().walkers, 'the traffic sees every walker');
    __setBayNowForTests('2026-11-02T21:00');
    m.step(1, at.x, 3, at.z, true);
    assert.equal(m.stats().walkers, 0);
    people = 0;
    RP.eachRoadPerson(() => { people++; });
    assert.equal(people, 0);
  } finally {
    m.dispose();
    __setBayNowForTests(null);
  }
});

test('W7-H7 pumpkin patches at the pumpkin events: beside S\'s kits, only in the catalog\'s window, mirrored, carved faces glow', async () => {
  const ids = new Set(EVENT_VENUES.flatMap(v => v.events));
  for (const id of WV.PUMPKIN_EVENTS) assert.ok(ids.has(id), `${id} has a venue row (lane S)`);
  const sunny = EVENT_VENUES.find(v => v.events.includes('sf-sunnydale-pumpkin-fest-2026'))!;
  const kit = sunny.kitAt!;
  const spots = WV.patchSpots(kit, sunny.kit);
  assert.equal(spots.length, 14);
  // beside the kit: past its own footprint's side (a fair ±5.5), never inside it
  const { KIT_FOOTPRINT } = await import('../src/opus-bay/realsf/eventKit');
  for (const s of spots) {
    const dx = s.x - kit.x, dz = s.z - kit.z;
    const lx = dx * Math.cos(kit.yaw) - dz * Math.sin(kit.yaw);
    assert.ok(Math.abs(lx) > KIT_FOOTPRINT[sunny.kit][1] + 0.5 && Math.abs(lx) < KIT_FOOTPRINT[sunny.kit][1] + 4, `lx ${lx.toFixed(2)}`);
  }
  const halos: import('../src/opus-bay/halloween/worldHalos').HaloSpot[] = [];
  const r = WV.buildPatch(kit, halos, () => true, () => 5, sunny.kit);
  assert.equal(r.placed, 14);
  assert.equal(halos.length, 4, 'the carved ones glow at night');
  assert.ok((r.geo!.index?.count ?? 0) / 3 < 2000);
  r.geo!.dispose();
  // a spot that fails the ground check is left out
  assert.equal(WV.buildPatch(kit, [], (x) => x > kit.x, () => 5).placed < 14, true);
  // the window: a fake catalog window for the event while it is on, nothing otherwise, nothing far away
  const win = (id: string) => [{ event: { id } as never, venue: sunny, dateKey: '2026-10-17', open: 0, close: 1 }];
  let on = win('sf-sunnydale-pumpkin-fest-2026');
  const p = WV.createVenuePatches(() => on, () => true, () => 5);
  p.step(kit.x + 10, kit.z, true);
  assert.equal(p.stats().event, 'sf-sunnydale-pumpkin-fest-2026');
  assert.equal(p.stats().placed, 14);
  assert.equal(p.near(kit.x + 5, kit.z, WV.VENUE_LINE_NEAR), 'sf-sunnydale-pumpkin-fest-2026');
  const mesh = p.group.children[0] as import('three').Mesh;
  assert.equal(mesh.material, TOY);
  p.step(kit.x + WV.VENUE_NEAR + 5, kit.z, true);
  assert.equal(p.stats().event, null, 'far away: nothing');
  p.step(kit.x, kit.z, false);
  assert.equal(p.stats().event, null, 'the season is off');
  on = win('sf-some-other-event');
  p.step(kit.x, kit.z, true);
  assert.equal(p.stats().event, null, 'not a pumpkin event');
  on = [];
  p.step(kit.x, kit.z, true);
  assert.equal(p.stats().event, null, 'not on now');
  p.dispose();
});

test('W7-H5 no stoop dressing beside a trick-or-treat door: the placement leaves them out, the guard keeps clear of doors added later', async () => {
  const WD = await import('../src/opus-bay/halloween/worldDress');
  const { TREAT_DOORS } = await import('../src/opus-bay/halloween/treatDoors');
  const { KNOCK_OUT } = await import('../src/opus-bay/halloween/treatStreets');
  assert.equal(WD.stoopsByDoors().size, 0, 'the generated stoops already keep clear');
  let nearest = Infinity;
  for (let i = 0; i < WD.stoopCount(); i++) {
    const s = WD.stoopAt(i);
    for (const d of TREAT_DOORS) {
      nearest = Math.min(nearest, Math.hypot(s.x - d.x, s.z - d.z), Math.hypot(s.x - d.x - Math.sin(d.f) * KNOCK_OUT, s.z - d.z - Math.cos(d.f) * KNOCK_OUT));
    }
  }
  assert.ok(nearest >= WD.DOOR_CLEAR - 0.06, `the nearest stoop is ${nearest.toFixed(2)} u from a door or knock spot`);
  assert.ok(WD.stoopCount() > 2000, 'the season still dresses ≈ 2 000 doorsteps');
  const indexed = [...WD.stoopIndex().values()].reduce((a, l) => a + l.length, 0);
  assert.equal(indexed, WD.stoopCount() - WD.stoopsByDoors().size);
});
