import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 4 · lane T, integration (W4-T3 … W4-T14): the published lines in transit.json, the game side of the loop and the
 * Muni Metro (game/lineRides.ts through game/transit.ts, game/ride.ts), the fleet drawing every city line's vehicles
 * (world/sf/lineFleet.ts extra kinds), the cable cars yielding to a bus in a shared box, the rails' merged runs, the line
 * sounds and the hero F-line's hop-off flag — driven in node exactly as the world does (the fleet stepped by hand, its
 * rider vehicle published as the platform).
 */

// --- headless canvas stub (world modules create label atlases at import time), as tests/opus-bay-sf-hopoff.test.ts
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const T = await import('../src/opus-bay/data/transit');
const { LineFleet, SHADOW_NEAR, FAR_LOD } = await import('../src/opus-bay/world/sf/lineFleet');
const { CableSystem } = await import('../src/opus-bay/world/transitLine');
const { RailLayer } = await import('../src/opus-bay/world/rails');
const { cableCarFarGeometry, cableCarGeometry } = await import('../src/opus-bay/world/cablecar');
const { onEvent } = await import('../src/opus-bay/core/events');
const { game } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { flow } = await import('../src/opus-bay/game/flowStore');
const transit = await import('../src/opus-bay/game/transit');
const ride = await import('../src/opus-bay/game/ride');
const { transitSound } = await import('../src/opus-bay/audio/logic');
const { busInterlocks } = await import('../src/opus-bay/world/sf/lineFleet');
const { boxBlocked, busAheadOfFCar, interlockLines } = await import('../src/opus-bay/world/sf/lineInterlocks');
const { buildFLine, FL } = await import('../src/opus-bay/data/fline');
const { StreetcarSystem } = await import('../src/opus-bay/world/flineSystem');
const { DISTRICT } = await import('../src/opus-bay/data/district');
const { BUS } = await import('../src/opus-bay/world/busSystem');
const { CABLE } = await import('../src/opus-bay/data/transit');
type TransitLine = import('../src/opus-bay/world/sf/format').TransitLine;
type GameEvent = import('../src/opus-bay/core/events').GameEvent;

const PUB = path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1');
const FILE = JSON.parse(fs.readFileSync(path.join(PUB, 'transit.json'), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson;
const W4FILE = JSON.parse(fs.readFileSync(path.join(PUB, 'transit-w4.json'), 'utf8')) as { lines: TransitLine[]; props: Record<string, [number, number]> };
const DATA = T.buildTransit(FILE);
const W4 = T.buildTransitW4(FILE)!;
const DT = 1 / 30;

test('transit.json publishes the loop, N and M (the same lines as transit-w4.json) with a placed prop for every stop', () => {
  for (const id of ['sf-loop', 'n-judah', 'm-ocean-view']) {
    const a = FILE.lines.find(l => l.id === id), b = W4FILE.lines.find(l => l.id === id);
    assert.ok(a && b, id);
    assert.equal(JSON.stringify(a), JSON.stringify(b), `${id} identical in both files`);
  }
  assert.ok(W4 && W4.loop.id === 'sf-loop' && W4.metro.map(l => l.id).join() === 'n-judah,m-ocean-view');
  for (const l of W4.lines) for (const s of l.stops) {
    const p = W4.props[s.id];
    assert.ok(p, `${s.id} has a prop`);
    assert.ok(Math.hypot(p[0] - s.x, p[1] - s.z) < 50, `${s.id} prop near its stop`);
    assert.deepEqual(T.boardAt(W4, s), { x: p[0], z: p[1] });
  }
  // the cable network is built exactly as before (the wave-4 lines are not cable lines)
  assert.deepEqual(DATA.lines.map(l => l.id).sort(), ['california', 'powell-hyde', 'powell-mason']);
});

/** The fleet with the transit layer's extra kinds (cable cars, F-line liveries), installed as the active fleet. */
function makeFleet(extra = true) {
  const fleet = new LineFleet({
    loop: W4.loop as TransitLine & { speeds?: [number, number, number][] }, metro: W4.metro, props: W4.props,
    extra: extra ? [{ key: 'cable', near: cableCarGeometry(), far: cableCarFarGeometry(), count: 6 }] : [],
  });
  T.setActiveLineFleet(fleet);
  return fleet;
}

test('rideSystemFor routes the three ids to the fleet; w4Kind; the hero ride is not a line ride', () => {
  const fleet = makeFleet();
  try {
    assert.equal(T.rideSystemFor('sf-loop'), fleet.bus);
    assert.equal(T.rideSystemFor('n-judah'), fleet.rail);
    assert.equal(T.rideSystemFor('m-ocean-view'), fleet.rail);
    assert.equal(T.w4Kind('sf-loop'), 'bus');
    assert.equal(T.w4Kind('powell-hyde'), null);
    const stops = ride.sortedStops();
    const r = ride.beginRide(stops[1].id, stops[0].id)!;
    assert.equal(r.line, 'streetcar');
    assert.equal(r.hero, true);
    assert.equal(ride.isLineRide(r), false);
    ride.endRide();
  } finally { T.setActiveLineFleet(null); fleet.dispose(); }
});

test('the fleet draws every city vehicle in 2 calls + 1 shadow call; a shadow only within SHADOW_NEAR of the camera', () => {
  const fleet = makeFleet();
  try {
    const pose = { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 };
    let worst = 0;
    for (let k = 0; k < 400; k++) {
      const s = W4.loop.stops[k % W4.loop.stops.length];
      const cam = { x: s.x + 20, z: s.z };
      fleet.update(DT * 10, cam, cam);
      // six cable cars spread round the camera: near, mid, far, hidden
      [5, 40, 70, 100, 200, 400].forEach((d, i) => { pose.x = cam.x + d; pose.z = cam.z; fleet.drawExtra('cable', i, pose, false, cam); });
      const st = fleet.stats();
      assert.ok(st.calls <= 3 && st.shadowCalls <= 1, JSON.stringify(st));
      worst = Math.max(worst, st.tris + st.shadowTris);
      // the casting instances are exactly the vehicles within SHADOW_NEAR
      assert.ok(st.nearVehicles >= 2, 'the two close cable cars cast');
    }
    // every vehicle within SHADOW_NEAR casts, beyond it none (checked on the cable cars placed by hand)
    const cam = { x: 0, z: 0 };
    fleet.update(0, { x: 5000, z: 5000 }, { x: 5000, z: 5000 });
    [10, SHADOW_NEAR - 1, SHADOW_NEAR + 1, FAR_LOD - 1, FAR_LOD + 1, 305].forEach((d, i) => { pose.x = d; pose.z = 0; fleet.drawExtra('cable', i, pose, false, cam); });
    const st = fleet.stats();
    assert.equal(st.nearVehicles, 2);
    assert.equal(st.midVehicles, 2);
    assert.equal(st.farVehicles, 1);
    assert.ok(worst < 30000, `worst fleet view ${worst} triangles incl. shadows`);
  } finally { T.setActiveLineFleet(null); fleet.dispose(); }
});

/** Step the fleet and the game's transit flow together (the transit layer and Systems' ticker do this in the game). */
function stepAll(fleet: InstanceType<typeof LineFleet>, seconds: number, until?: () => boolean) {
  for (let t = 0; t < seconds; t += DT) {
    fleet.update(DT, runtime.player, runtime.player);
    transit.stepTransit(DT);
    if (until?.()) return true;
  }
  return false;
}

test('a bus ride through the game: board at the Castro pole, ride to Twin Peaks, the banner, the events, off at the stop', async () => {
  T.setTransitW4(W4);
  T.setTransitData(DATA);
  const fleet = makeFleet(false);
  const lr = await transit.loadLineRides();
  const off = lr.initLineRides();
  const events: GameEvent[] = [];
  const offEv = onEvent(e => { if (e.type === 'transit') events.push(e); });
  try {
    game.set({ phase: 'playing' });
    const at = T.boardAt(W4, W4.loop.stops.find(s => s.id === 'loop-castro')!);
    runtime.player.x = at.x; runtime.player.z = at.z;
    // the boarding choices: the next 3 stops, the lap, the map, not now; the stations as interactables at the props
    const rows = transit.stationRides('loop-castro');
    assert.deepEqual(rows.map(r => r.to), ['loop-twin-peaks', 'loop-mission-dolores', 'loop-civic-center', 'loop-castro']);
    assert.equal(rows[3].kind, 'lap');
    assert.ok(rows.every(r => r.seconds > 0));
    const pole = lr.lineInteractables().find(i => i.refId === 'loop-castro')!;
    assert.deepEqual({ x: pole.x, z: pole.z }, at);
    assert.equal(pole.verb.zh, '上观光巴士');
    // a shared Market St station offers both Metro lines
    const shared = lr.stationChoices('muni-powell').filter(c => c.kind === 'ride');
    assert.ok(shared.some(c => c.line === 'n-judah') && shared.some(c => c.line === 'm-ocean-view'));
    // a trip leg's pre-filled boarding: one confirm row and "not now"
    const pre = lr.stationChoices('muni-embarcadero', { to: 'muni-19th-winston' });
    assert.equal(pre.length, 2);
    assert.equal(pre[0].line, 'm-ocean-view');
    assert.match(pre[0].label.zh, /^上车 · 坐到/);
    assert.ok((transit.nextArrival('loop-castro') ?? -1) >= 0);

    lr.rideLine('sf-loop', 'loop-castro', 'loop-twin-peaks');
    assert.equal(flow.get().ride?.kind, 'bus');
    assert.equal(transit.rideLabel(flow.get().ride!).icon, 'bus');
    assert.ok(stepAll(fleet, 30, () => ride.currentRide()?.mode === 'follow'), 'a bus picked the rider up within 30 s');
    stepAll(fleet, DT);
    assert.ok(events.some(e => e.type === 'transit' && e.what === 'board' && e.station === 'loop-castro'));
    const label = transit.rideLabel(flow.get().ride!);
    assert.equal(label.dest?.zh, '双峰');
    assert.equal(label.canHopOff, true);
    assert.equal(label.nextStop, true);
    assert.ok(stepAll(fleet, 200, () => !ride.currentRide()), 'arrived at Twin Peaks');
    const approach = events.find(e => e.type === 'transit' && e.what === 'approach' && e.station === 'loop-twin-peaks');
    assert.ok(approach && approach.type === 'transit' && approach.attraction, 'approach with the stop\'s attraction');
    assert.ok(events.some(e => e.type === 'transit' && e.what === 'arrive' && e.station === 'loop-twin-peaks'));
    const counted = events.find(e => e.type === 'transit' && e.what === 'ride' && e.real);
    assert.ok(counted && counted.type === 'transit' && counted.station === 'loop-twin-peaks', 'a counted ride names its stop');
    assert.equal(transit.rideLog()['sf-loop'] >= 1, true);
    const tp = W4.loop.stops.find(s => s.id === 'loop-twin-peaks')!;
    assert.ok(Math.hypot(runtime.player.x - tp.x, runtime.player.z - tp.z) < 14, 'off beside the bus at the stop');
  } finally {
    offEv(); off(); transit.cancelRide(); T.setActiveLineFleet(null); fleet.dispose(); game.set({ phase: 'title' });
  }
});

test('an M ride under ground: held at the kiosk under the overlay, no hop-off in the tunnel, off at the Church kiosk', async () => {
  T.setTransitW4(W4);
  T.setTransitData(DATA);
  const fleet = makeFleet(false);
  const lr = await transit.loadLineRides();
  try {
    game.set({ phase: 'playing' });
    const kiosk = T.boardAt(W4, W4.metro[1].stops.find(s => s.id === 'muni-embarcadero')!);
    runtime.player.x = kiosk.x; runtime.player.z = kiosk.z;
    lr.rideLine('m-ocean-view', 'muni-embarcadero', 'muni-church');
    assert.equal(flow.get().ride?.kind, 'light-rail');
    assert.ok(stepAll(fleet, 30, () => ride.currentRide()?.mode === 'follow'), 'a train picked the rider up');
    let sawOverlay = false;
    let refused = false;
    const done = stepAll(fleet, 90, () => {
      const r = ride.currentRide();
      if (!r) return true;
      const st = lr.w4Status(r);
      if (st?.underground && r.mode === 'follow') {
        // held where they went down: the kiosk (never carried to the hidden train)
        assert.ok(Math.hypot(runtime.player.x - kiosk.x, runtime.player.z - kiosk.z) < 0.01, 'held at the kiosk');
        sawOverlay ||= !!transit.subwayView();
        if (!st.station && !refused) {
          transit.hopOffRide();
          assert.ok(ride.currentRide(), 'no hop-off inside the tunnel');
          refused = true;
          const label = transit.rideLabel(flow.get().ride!);
          assert.equal(label.canHopOff, false);
          assert.equal(label.hopOffNote?.zh, '隧道里不能下车');
        }
      }
      return false;
    });
    assert.ok(done, 'arrived');
    assert.ok(sawOverlay && refused);
    const church = T.boardAt(W4, W4.metro[1].stops.find(s => s.id === 'muni-church')!);
    assert.ok(Math.hypot(runtime.player.x - church.x, runtime.player.z - church.z) < 12.5, `off at the Church kiosk (${runtime.player.x.toFixed(1)}, ${runtime.player.z.toFixed(1)})`);
  } finally { transit.cancelRide(); T.setActiveLineFleet(null); fleet.dispose(); game.set({ phase: 'title' }); }
});

test('a cable car does not claim a span through a box a bus occupies (CableSystem.free), and goes once it is clear', () => {
  const sys = new CableSystem(DATA);
  const car = sys.cars.find(c => c.line.id === 'california' && c.mode === 'dwell')!;
  assert.ok(car);
  let busInside = true;
  const fake = { bus: { boxes: [{ id: 'california@x', a0: 0, a1: 1, blocked: () => false, other: { line: 'california', b0: -1e4, b1: 1e4 } }], occupies: () => busInside } };
  T.setActiveLineFleet(fake as unknown as InstanceType<typeof LineFleet>);
  try {
    const s0 = car.s;
    for (let i = 0; i < 30 * 20; i++) sys.step(DT);
    assert.ok(Math.abs(car.s - s0) < 0.01, 'held while a bus is in the box');
    busInside = false;
    for (let i = 0; i < 30 * 20; i++) sys.step(DT);
    assert.ok(Math.abs(car.s - s0) > 1, 'goes once the box is clear');
  } finally { T.setActiveLineFleet(null); }
});

test('rails: straight steps are laid as merged runs (the California hero span: far fewer boxes than one per 0.8 u step)', () => {
  const layer = new RailLayer(DATA);
  const cells = (layer as unknown as { cells: Map<number, { pieces: { a: number; b: number; cable: boolean }[] }> }).cells;
  let steps = 0, tris = 0;
  for (const c of cells.values()) {
    const b = (layer as unknown as { build(c: unknown): { idx: ArrayLike<number> } | null }).build(c);
    if (!b) continue;
    tris += b.idx.length / 3;
    for (const p of c.pieces) steps += Math.ceil((p.b - p.a) / 0.8);
  }
  assert.ok(steps > 50, `hero rail steps ${steps}`);
  // one step used to be 3 boxes (2 rails + the slot) + a plate every third step: 40 triangles a step
  assert.ok(tris < steps * 40 * 0.55, `${tris} triangles for ${steps} steps`);
  layer.dispose();
});

test('line sounds: bus / light-rail events map to the air brake, door chimes, stop bell, gong and horn', () => {
  assert.equal(transitSound('arrive', 'bus')?.kind, 'bus-arrive');
  assert.equal(transitSound('arrive', 'light-rail')?.kind, 'door-open');
  assert.equal(transitSound('depart', 'bus')?.kind, 'door-close');
  assert.equal(transitSound('bell', 'bus')?.kind, 'stop-bell');
  assert.equal(transitSound('bell', 'light-rail')?.kind, 'lrv-gong');
  assert.equal(transitSound('horn', 'bus')?.kind, 'bus-horn');
  assert.equal(transitSound('approach', 'bus'), null);
  // the old kinds are unchanged
  assert.equal(transitSound('bell', 'cable-car')?.kind, 'cable-bell');
  assert.equal(transitSound('horn', 'ferry')?.kind, 'ferry-horn');
});

/** Do two bodies (centre, heading, half length, half width) overlap? (separating axes of the two rectangles) */
function bodiesOverlap(a: { x: number; z: number; heading: number; hl: number; hw: number }, b: typeof a): boolean {
  const axes = [a.heading, a.heading + Math.PI / 2, b.heading, b.heading + Math.PI / 2];
  const corners = (r: typeof a) => {
    const fx = Math.sin(r.heading), fz = Math.cos(r.heading), sx = fz, sz = -fx;
    return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([i, j]) => [r.x + fx * r.hl * i + sx * r.hw * j, r.z + fz * r.hl * i + sz * r.hw * j]);
  };
  const ca = corners(a), cb = corners(b);
  for (const h of axes) {
    const ax = Math.sin(h), az = Math.cos(h);
    const pa = ca.map(([x, z]) => x * ax + z * az), pb = cb.map(([x, z]) => x * ax + z * az);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}

test('shared streets, 60 simulated minutes: a sightseeing bus never drives through a cable car or an F-line car (boxes both ways), nobody waits for good', () => {
  const cable = new CableSystem(DATA);
  const line = buildFLine(FILE.lines.find(l => l.id === 'f-line'), DISTRICT.streetcar)!;
  let fleet: InstanceType<typeof LineFleet> | null = null;
  const fsys = new StreetcarSystem(line, { roadAhead: car => (fleet ? busAheadOfFCar(fleet, host, car) : Infinity) });
  const host = { line, sys: fsys };
  fleet = new LineFleet({ loop: W4.loop as TransitLine & { speeds?: [number, number, number][] }, metro: W4.metro }, {
    emitEvents: false,
    boxes: bt => busInterlocks(bt, interlockLines(DATA, host), (id, b0, b1) => boxBlocked(cable, host, id, b0, b1)),
  });
  T.setActiveLineFleet(fleet);
  try {
    assert.ok(fleet.bus.boxes.length >= 6, `${fleet.bus.boxes.length} boxes (Hyde St, Bush × Powell, California, the F-line's crossings and Market St)`);
    const inBox = new Set<string>();
    const hits: string[] = [];
    const dt = 1 / 10;
    // (the F-line's own queue: before lane T's firstInLine a car behind could take the loop exit's single track ahead of
    // the car waiting at the hold point — with the buses in the boxes that jammed the loop for good after ≈ 37 minutes)
    let maxFStill = 0, busWait = 0, maxBusWait = 0;
    for (let t = 0; t < 3600; t += dt) {
      cable.step(dt);
      fsys.step(dt);
      fleet.update(dt, { x: 1e5, z: 1e5 }, { x: 1e5, z: 1e5 });
      for (const c of fsys.cars) maxFStill = Math.max(maxFStill, c.still);
      busWait = fleet.bus.buses.some(b => b.waitBox >= 0 && b.v < 0.1) ? busWait + dt : 0;
      maxBusWait = Math.max(maxBusWait, busWait);
      for (const bx of fleet.bus.boxes) if (fleet.bus.occupies(bx.id)) inBox.add(bx.id);
      for (const b of fleet.bus.buses) {
        const bb = { x: b.pose.x, z: b.pose.z, heading: b.pose.heading, hl: BUS.length / 2, hw: BUS.width / 2 };
        for (const c of cable.cars) if (bodiesOverlap(bb, { x: c.pose.x, z: c.pose.z, heading: c.pose.heading, hl: CABLE.length / 2, hw: CABLE.width / 2 })) hits.push(`t ${t.toFixed(1)} bus#${b.index} × ${c.line.id}#${c.index}`);
        for (const c of fsys.cars) if (bodiesOverlap(bb, { x: c.pose.x, z: c.pose.z, heading: c.pose.heading, hl: FL.half, hw: 1.05 })) hits.push(`t ${t.toFixed(1)} bus#${b.index} × F#${c.index}`);
      }
    }
    assert.deepEqual(hits.slice(0, 8), [], `${hits.length} overlapping frames`);
    assert.ok(inBox.size >= 6, `the buses went through ${[...inBox].join(', ')}`);
    assert.ok(maxFStill < 60, `an F-line car stood ${maxFStill.toFixed(0)} s`);
    assert.ok(maxBusWait < 90, `a bus waited ${maxBusWait.toFixed(0)} s at a box`);
    assert.deepEqual(fleet.bus.violations(), []);
  } finally { T.setActiveLineFleet(null); fleet.dispose(); }
});

test('walker obstacles: every pole, kiosk and portal mouth is a soft obstacle, and so are the buses and visible trains', () => {
  const fleet = makeFleet(false);
  try {
    const out: { x: number; z: number; r: number; kind: string }[] = [];
    const covered = (x: number, z: number) => { out.length = 0; fleet.obstacles(out, x, z, 3); return out.some(o => Math.hypot(o.x - x, o.z - z) < o.r); };
    for (const p of fleet.props) assert.ok(covered(p.x, p.z), `${p.station} (${p.kind}) blocks its own spot`);
    for (const p of fleet.portals) {
      // a point 2 u inside the mouth, on the track
      const x = p.x + Math.sin(p.heading) * 2, z = p.z + Math.cos(p.heading) * 2;
      assert.ok(covered(x, z), `${p.id}: nobody walks into the mouth`);
    }
    fleet.update(0, { x: 0, z: 0 }, { x: 0, z: 0 });
    const b = fleet.bus.buses[0].pose;
    out.length = 0;
    fleet.obstacles(out, b.x, b.z, 2);
    assert.ok(out.some(o => o.kind === 'traffic' && Math.hypot(o.x - b.x, o.z - b.z) < 0.5), 'a bus is a moving obstacle');
    // far from everything: nothing
    out.length = 0;
    fleet.obstacles(out, 5000, 5000, 5);
    assert.equal(out.length, 0);
  } finally { T.setActiveLineFleet(null); fleet.dispose(); }
});
