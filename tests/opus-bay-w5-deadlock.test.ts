import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * W5-bus (the owner, from phone play: "riding the tour bus, or another vehicle, if a car is in front of it, it basically
 * gets stuck and never moves"): nothing on the city's streets ever waits for good.
 *
 * - Right of way: the transit vehicles and the player's own bike / car go first; a toy car never waits for one that
 *   waits for it, and one that holds it up for TRAFFIC.giveWay (2) s clears the lane (world/sf/traffic.ts); BAYBAY in
 *   the player's seat is no pedestrian (world/sf/cityLife.ts); toy cars never stop inside a loop stop zone or a transit
 *   crossing box.
 * - The player's tap-to-drive autopilot passes a car standing on a two-lane street (actors/vehicles/autopilot.ts
 *   passPath, actors/moveSystem.ts) and never waits for good.
 * - The interlock boxes (world/busSystem.ts boxDueIn, world/transitLine.ts, world/sf/lineInterlocks.ts): a cable car or a
 *   streetcar leaves a shared stretch to a bus that would find it in there.
 * - The proof: 20+ simulated minutes of the whole loop and both Metro lines on the published city with dense toy
 *   traffic and forced blockers (in the lane, in a stop zone, on a crossing): no bus or train stands more than 5 s
 *   outside its dwell; the autopilot behind (and facing) a stopped car.
 */

// --- headless canvas / DOM stubs (world modules create label atlases at import time), as tests/opus-bay-w5-transit.test.ts
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
const el = () => ({ width: 0, height: 0, style: {} as Record<string, string>, textContent: '', getContext: () => ctx2d, setAttribute: noop, remove: noop, appendChild: noop });
g.document ??= { createElement: el, querySelector: () => null, body: el() };
g.requestAnimationFrame ??= (fn: () => void) => setTimeout(fn, 0);

const THREE = await import('three');
const T = await import('../src/opus-bay/data/transit');
const { StreetNet } = await import('../src/opus-bay/world/sf/streetNet');
const { TRAFFIC, TrafficSim, inPathOf, keepClearDistance, waitsFor } = await import('../src/opus-bay/world/sf/traffic');
const { CityLife, cityProbe } = await import('../src/opus-bay/world/sf/cityLife');
const { LineFleet, busInterlocks } = await import('../src/opus-bay/world/sf/lineFleet');
const { boxBlocked, busAheadOfFCar, busWaitsForFCar, interlockLines } = await import('../src/opus-bay/world/sf/lineInterlocks');
const { CableSystem } = await import('../src/opus-bay/world/transitLine');
const { StreetcarSystem } = await import('../src/opus-bay/world/flineSystem');
const { buildFLine } = await import('../src/opus-bay/data/fline');
const { DISTRICT } = await import('../src/opus-bay/data/district');
const { BUS } = await import('../src/opus-bay/world/busSystem');
const LT = await import('../src/opus-bay/world/lineTrack');
const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
const { heightAt, setCityTerrain } = await import('../src/opus-bay/core/terrain');
const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
const { setWalkGraph } = await import('../src/opus-bay/actors/nav');
const { game } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { onEvent } = await import('../src/opus-bay/core/events');
const { U } = await import('../src/opus-bay/world/materials');
const transit = await import('../src/opus-bay/game/transit');
const ride = await import('../src/opus-bay/game/ride');
const busWatch = await import('../src/opus-bay/game/busWatch');
const { PursuitDriver, passPath } = await import('../src/opus-bay/actors/vehicles/autopilot');
const { CAR_LENGTH, CAR_SPEC, CAR_WIDTH } = await import('../src/opus-bay/actors/vehicles/toyCar');
const { sfDisk } = await import('./opus-bay-sf-disk');
type RoadVehicle = import('../src/opus-bay/world/sf/streetNet').RoadVehicle;
type StreetEdge = import('../src/opus-bay/world/sf/streetNet').StreetEdge;
type Car = import('../src/opus-bay/world/sf/traffic').Car;
type KeepClear = import('../src/opus-bay/world/sf/traffic').KeepClear;
type TransitLine = import('../src/opus-bay/world/sf/format').TransitLine;

const PUB = path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1');
const FILE = JSON.parse(fs.readFileSync(path.join(PUB, 'transit.json'), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson;
const DATA = T.buildTransit(FILE);
const W4 = T.buildTransitW4(FILE)!;
const FLINE_JSON = FILE.lines.find(l => l.id === 'f-line') ?? null;
const sf = sfDisk();
const LMS = landmarkWalkInputs(SF_LANDMARKS);
/** Union Square: a grid of two-lane streets */
const SPOT = { x: 78, z: 222 };

/**
 * (W7-B1) The runtime as it is before any test runs. A test that moves the player must not change what a later one
 * simulates: the tap-to-drive test left the player on a Union Square street heading (and a height, a claimed bike), and
 * the proof puts its camera behind the player's heading — the camera decides where the toy traffic spawns and which
 * transit vehicles count as seen, so the whole 20 minutes ran differently after it (day 0 of wave 7: 29 forced blockers
 * with the whole file, 31 with the proof alone; not load: the proof reads no clock). Tests that drive the runtime start
 * from (and leave) this.
 */
const RUNTIME0 = structuredClone({ player: runtime.player, guide: runtime.guide, vehicle: runtime.vehicle, move: runtime.move, camera: runtime.camera, input: runtime.input, glide: runtime.glide });
function freshRuntime() {
  for (const [k, v] of Object.entries(RUNTIME0)) Object.assign(runtime[k as keyof typeof RUNTIME0], structuredClone(v));
}

async function cityAround(at: { x: number; z: number }, r: number) {
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  await sf.attachAround(city, at.x, at.z, r, LMS);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  return city;
}

/** A toy car put somewhere and kept standing there (a broken-down car): until it gives way, or `secs` pass. */
interface Pin { car: Car; e: number; s: number; x: number; z: number; heading: number; until: number; kind: string; gave: string }
function pinCar(sim: InstanceType<typeof TrafficSim>, e: StreetEdge, along: number, now: number, secs: number, kind: string, avoid: { x: number; z: number }): Pin | null {
  const car = sim.cars.find(c => !c.on) ?? sim.cars.find(c => c.on && !c.leaving && Math.hypot(c.x - avoid.x, c.z - avoid.z) > 80);
  if (!car) return null;
  const p = sim.lanePoint(e, along, { x: 0, z: 0 });
  Object.assign(car, { on: true, mode: 'lane', e: e.e, s: along, next: -1, node: -1, v: 0, vmax: 0, still: 0, grow: 1, leaving: false, holdUp: 0, hurry: false, gave: '', hop: 0, x: p.x, z: p.z, heading: Math.atan2(e.dx, e.dz) });
  return { car, e: e.e, s: along, x: p.x, z: p.z, heading: car.heading, until: now + secs, kind, gave: '' };
}
/** Keep the pinned cars where they are (after the traffic's step); a car that gives way is let go. */
function keepPins(pins: Pin[], done: Pin[], now: number) {
  for (let i = pins.length - 1; i >= 0; i--) {
    const f = pins[i], c = f.car;
    if (!c.on || c.leaving || now > f.until) { f.gave = c.leaving ? c.gave : ''; c.vmax = 6; done.push(f); pins.splice(i, 1); continue; }
    c.vmax = 0; c.v = 0; c.hurry = false; c.e = f.e; c.s = f.s; c.mode = 'lane'; c.next = -1; c.node = -1; c.x = f.x; c.z = f.z; c.heading = f.heading;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Right of way: the player's vehicle, BAYBAY in its seat, the stop zones
// ---------------------------------------------------------------------------------------------------------------------

test('W5-bus inPathOf / waitsFor: the player\'s vehicle stopped with a toy car in its path (behind it or head-on) waits for it; a car beside it or behind it does not hold it', () => {
  const player = (x: number, z: number, heading = 0, v = 0): RoadVehicle => ({ x, z, heading, v, halfL: 1.05, halfW: 0.6, kind: 'player', line: 'player' });
  const car = { x: 0, z: 0, heading: 0 };
  assert.equal(waitsFor(car, player(0, -3)), true, 'the player\'s car right behind the toy car');
  assert.equal(waitsFor(car, player(0, 3, Math.PI)), true, 'head-on, stopped');
  assert.equal(waitsFor(car, player(0, 3, Math.PI, 6)), false, 'head-on but still driving: not held yet');
  assert.equal(waitsFor(car, player(3, 3, Math.PI)), false, 'in the other lane');
  assert.equal(waitsFor(car, player(0, 9, Math.PI)), false, 'far off');
  assert.equal(inPathOf(player(0, -3), car, 3), true);
  assert.equal(inPathOf(player(0, 3), car, 3), false, 'behind the player is not in its path');
});

test('W5-bus BAYBAY riding in the player\'s toy car (or on the pelican) is no pedestrian on the roadway; walking beside the player on the road she is', async () => {
  await cityAround(SPOT, 200);
  const life = new CityLife({ visible: () => true });
  try {
    life.start(new StreetNet(await sf.graphIndex(), cityProbe));
    const env = (life.traffic!.sim as unknown as { env: { people(out: { x: number; z: number; r: number }[]): void } }).env;
    const people = () => { const out: { x: number; z: number; r: number }[] = []; env.people(out); return out; };
    // a roadway point by Union Square
    const { surfaceAt } = await import('../src/opus-bay/core/terrain');
    let road: { x: number; z: number } | null = null;
    for (let k = 0; k < 4000 && !road; k++) { const x = SPOT.x + (k % 60) - 30, z = SPOT.z + Math.floor(k / 60) - 30; if (surfaceAt(x, z) === 'road') road = { x, z }; }
    assert.ok(road);
    const at = (p: { x: number; z: number }) => people().some(q => Math.hypot(q.x - p.x, q.z - p.z) < 0.01);
    runtime.player.x = road.x; runtime.player.z = road.z;
    runtime.guide.x = road.x + 0.3; runtime.guide.z = road.z;
    game.set({ move: { mode: 'foot' } }); runtime.move.mode = 'foot';
    assert.ok(at(runtime.guide), 'walking on the road: she is a pedestrian');
    // in the toy car: the player is the vehicle, BAYBAY sits in its front seat (the Union Square case: the toy car ahead
    // waited at its stop line for her, the player's car waited for the toy car — "前面过不去了" after 35 s)
    Object.assign(runtime.vehicle, { occupied: true, kind: 'car', x: road.x, z: road.z, heading: 0, speed: 0 });
    game.set({ move: { mode: 'car' } }); runtime.move.mode = 'car';
    assert.equal(at(runtime.guide), false, 'seated in the player\'s car: not a pedestrian');
    assert.equal(at(runtime.player), false);
    Object.assign(runtime.vehicle, { occupied: false, kind: null });
    game.set({ move: { mode: 'glide' } }); runtime.move.mode = 'glide';
    assert.equal(at(runtime.guide), false, 'on the pelican');
    assert.equal(at(runtime.player), false, 'gliding over a street is not standing on it');
  } finally { life.dispose(); setCityTerrain(null); game.set({ move: { mode: 'foot' } }); runtime.move.mode = 'foot'; Object.assign(runtime.vehicle, { occupied: false, kind: null }); }
});

/** A traffic sim round Union Square with a crafted set of road vehicles and people; the first car that reaches a stop line. */
async function carAtLine(net: InstanceType<typeof StreetNet>, vehicles: RoadVehicle[], people: { x: number; z: number; r: number }[], keepClear?: () => readonly KeepClear[]) {
  const focus = { ...SPOT };
  const sim = new TrafficSim(net, { focus: () => focus, visible: () => true, vehicles: () => vehicles, people: out => { out.push(...people); }, keepClear }, { seed: 21 });
  const internal = sim as unknown as { canEnter(c: Car, node: number, next: StreetEdge, v: readonly RoadVehicle[]): boolean };
  for (let i = 0; i < 30 * 30; i++) {
    sim.step(1 / 30);
    for (const c of sim.cars) {
      if (!c.on || c.mode !== 'lane' || c.next < 0) continue;
      const e = net.edge(c.e)!, gx = sim.usable(c.next);
      if (!gx || net.degree(e.v) < 3 || sim.span(e)[1] - c.s > 0.3) continue;
      return { sim, car: c, e, g: gx, internal };
    }
  }
  throw new Error('no car reached a stop line');
}

test('W5-bus toy traffic: a car at its stop line never waits for the player\'s car stopped behind it (BAYBAY in its seat); a car standing in the player\'s path — ahead or head-on — clears the lane after 2 s', async () => {
  await cityAround(SPOT, 260);
  try {
    const net = new StreetNet(await sf.graphIndex(), cityProbe);
    const vehicles: RoadVehicle[] = [];
    const people: { x: number; z: number; r: number }[] = [];
    const { sim, car, e, g: next, internal } = await carAtLine(net, vehicles, people);
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    // the player's toy car stopped 2.4 u behind it, in its lane, its nose inside the junction box's reach
    const player: RoadVehicle = { x: car.x - fx * 2.4, z: car.z - fz * 2.4, heading: car.heading, v: 0, halfL: 1.05, halfW: 0.6, kind: 'player', line: 'player' };
    assert.equal(internal.canEnter(car, e.v, next, [player]), true, 'the toy car goes: the player waits for it, not the other way round');
    // someone crossing keeps it at its line; with the player's car held behind it, after 2 s it clears the lane
    people.push({ x: net.ix.x(e.v), z: net.ix.z(e.v), r: 0.45 });
    vehicles.push(player);
    const id = car.id;
    let left = -1;
    for (let t = 0; t < 5; t += 1 / 30) {
      sim.step(1 / 30);
      const c = sim.cars[id];
      if (left < 0 && c.leaving) { left = t; assert.equal(c.gave, 'held'); }
      if (!c.on) break;
    }
    assert.ok(left >= TRAFFIC.giveWay - 0.2 && left <= TRAFFIC.giveWay + 0.4, `gave way after ${left.toFixed(1)} s`);
    // it hops to its kerb and shrinks: nobody's obstacle from the first frame, gone within half a second
    const out: { x: number; z: number; r: number; kind: string }[] = [];
    sim.obstacles(out as never, player.x, player.z, 10);
    assert.ok(!out.some(o => Math.hypot(o.x - sim.cars[id].x, o.z - sim.cars[id].z) < 1.2), 'no obstacle disc of a car giving way');
    // head-on: a toy car standing in front of the player's stopped car, facing it
    people.length = 0; vehicles.length = 0;
    const other = sim.cars.find(c => c.on && !c.leaving && c.mode === 'lane')!;
    const hx = Math.sin(other.heading), hz = Math.cos(other.heading);
    const facing: RoadVehicle = { x: other.x + hx * 3, z: other.z + hz * 3, heading: other.heading + Math.PI, v: 0, halfL: 1.05, halfW: 0.6, kind: 'player', line: 'player' };
    vehicles.push(facing);
    other.vmax = 0; other.v = 0;
    let gone = -1;
    for (let t = 0; t < 4 && gone < 0; t += 1 / 30) { sim.step(1 / 30); other.vmax = 0; if (other.leaving) gone = t; }
    assert.ok(gone > 0 && gone <= TRAFFIC.giveWay + 0.4, `head-on: gave way after ${gone.toFixed(1)} s`);
    assert.ok(sim.stats.gaveHeld >= 2);
  } finally { setCityTerrain(null); }
});

test('W5-bus stop zones: a toy car never stops inside one (it holds short behind a standing car beyond it); one caught standing in a zone gives way at once with a bus coming; none is spawned in one', async () => {
  await cityAround(SPOT, 260);
  try {
    const net = new StreetNet(await sf.graphIndex(), cityProbe);
    const vehicles: RoadVehicle[] = [];
    // find a lane stretch ≥ 30 u and put a stop zone on its middle (a bus's standing place: 9.8 u of it)
    const probe = new TrafficSim(net, { focus: () => SPOT, visible: () => true, vehicles: () => [], people: () => {} });
    let edge: StreetEdge | null = null;
    for (let n = 0; n < net.ix.nodeCount && !edge; n++) {
      if (Math.hypot(net.ix.x(n) - SPOT.x, net.ix.z(n) - SPOT.z) > 120) continue;
      for (let e = net.outStart(n); e < net.outEnd(n) && !edge; e++) { const s = probe.usable(e); if (s && probe.span(s)[1] - probe.span(s)[0] > 30) edge = s; }
    }
    assert.ok(edge, 'a long lane');
    const [a0, a1] = probe.span(edge);
    const mid = (a0 + a1) / 2, A = net.at(edge, mid - 4.9, 0, { x: 0, z: 0 }), B = net.at(edge, mid + 4.9, 0, { x: 0, z: 0 });
    const zones: KeepClear[] = [{ ax: A.x, az: A.z, bx: B.x, bz: B.z, hw: BUS.width / 2 + 0.15 }];
    const sim = new TrafficSim(net, { focus: () => SPOT, visible: () => true, vehicles: () => vehicles, people: () => {}, keepClear: () => zones }, { seed: 5 });
    const zs = sim.zonesOn(edge)!;
    assert.ok(zs && zs.length === 2 && zs[0] < mid - 4.9 && zs[1] > mid + 4.9, `the zone on the lane: ${zs && Array.from(zs).map(v => v.toFixed(1)).join('–')}`);
    assert.ok(keepClearDistance(zones[0], (A.x + B.x) / 2, (A.z + B.z) / 2) < 1e-6);
    for (let i = 0; i < 30 * 20; i++) sim.step(1 / 30);
    for (const c of sim.cars) if (c.on && c.mode === 'lane' && c.e === edge.e) assert.ok(!sim.inZone(c.e, c.s) || c.v > 0.5, 'nobody spawned or standing in the zone');
    // a car standing just past the zone, and one coming up behind it: the second holds short of the zone
    for (const c of sim.cars) if (c.on) c.on = false;
    const stopper = sim.cars[0], follower = sim.cars[1];
    const place = (c: Car, s: number, v: number) => { const p = sim.lanePoint(edge!, s, { x: 0, z: 0 }); Object.assign(c, { on: true, mode: 'lane', e: edge!.e, s, v, vmax: 7, next: -1, node: -1, still: 0, grow: 1, leaving: false, holdUp: 0, hurry: false, gave: '', hop: 0, x: p.x, z: p.z, heading: Math.atan2(edge!.dx, edge!.dz) }); };
    place(stopper, Math.min(a1 - 0.5, zs[1] + 1.5), 0);
    place(follower, Math.max(a0, zs[0] - 12), 6);
    sim.target = 2;
    for (let t = 0; t < 8; t += 1 / 30) {
      sim.step(1 / 30);
      stopper.vmax = 0; stopper.v = 0; stopper.e = edge.e; stopper.s = Math.min(a1 - 0.5, zs[1] + 1.5); stopper.mode = 'lane'; stopper.next = -1;
      if (follower.v < 0.15 && follower.e === edge.e) assert.ok(!sim.inZone(follower.e, follower.s), `stood inside the zone at ${follower.s.toFixed(1)} (zone ${zs[0].toFixed(1)}–${zs[1].toFixed(1)})`);
    }
    assert.ok(follower.e === edge.e && follower.s < zs[0], 'held short of the zone');
    assert.ok(sim.stats.keptClear > 0);
    // caught inside the zone (put there), standing: a bus coming at it within 40 u — it gives way at once
    place(follower, (zs[0] + zs[1]) / 2, 0);
    follower.vmax = 0;
    const fx = Math.sin(follower.heading), fz = Math.cos(follower.heading);
    vehicles.push({ x: follower.x - fx * 30, z: follower.z - fz * 30, heading: follower.heading + 1.1, v: 8, halfL: BUS.length / 2, halfW: BUS.width / 2, kind: 'bus', line: 'sf-loop' });
    // (the bus's own heading points it at the car: aim it)
    const q = vehicles[0];
    q.heading = Math.atan2(follower.x - q.x, follower.z - q.z);
    sim.step(1 / 30);
    assert.equal(follower.leaving, true, 'gave way at once');
    assert.ok(['zone', 'oncoming'].includes(follower.gave), follower.gave);
  } finally { setCityTerrain(null); }
});

// ---------------------------------------------------------------------------------------------------------------------
// The autopilot passes what stands on a two-lane street
// ---------------------------------------------------------------------------------------------------------------------

test('W5-bus passPath: round a car standing in the right lane on the left, clear of it and drivable; a street blocked both ways has no pass; too close: back up first', () => {
  // a straight street along +z, 2 u of roadway each way (Union Square's are 1.4–2.6); the route on its centre line
  const route = [{ x: 0, z: 0 }, { x: 0, z: 60 }];
  const d = new PursuitDriver(CAR_SPEC, route);
  const pose = { x: 0, z: 0 };
  const drivable = (x: number) => Math.abs(x) < 2 - 0.55;
  // a toy car in the right lane (heading +z: its right is −x) 12 u ahead: its two discs
  const right = -1.0;
  const car = [{ x: right, z: 11.5, r: 0.6 }, { x: right, z: 12.5, r: 0.6 }];
  const halfW = CAR_WIDTH / 2, halfL = CAR_LENGTH / 2;
  const plan = passPath(d, pose, car, halfW, halfL, x => drivable(x))!;
  assert.ok(plan && plan.back === 0, 'a pass, no back-up');
  assert.equal(plan.side, -1, 'on the left of travel (+x here)');
  const worst = Math.min(...plan.points.map(p => Math.min(...car.map(c => Math.hypot(p.x - c.x, p.z - c.z) - c.r))));
  assert.ok(worst >= halfW + 0.1, `clear of the car by ${worst.toFixed(2)} u`);
  assert.ok(plan.points.every(p => drivable(p.x)), 'drivable all the way');
  assert.ok(Math.abs(plan.points[plan.points.length - 1].x) < 1e-6 && plan.points[plan.points.length - 1].z === 60, 'back on the route to its end');
  assert.ok(plan.points.some(p => p.x > 0.35), 'swung out left of the centre line');
  // cars in both lanes side by side: no way past (then it waits: the toy cars clear the lane)
  assert.equal(passPath(d, pose, [...car, { x: 1.0, z: 11.8, r: 0.6 }, { x: 1.0, z: 12.8, r: 0.6 }], halfW, halfL, x => drivable(x)), null);
  // standing right behind it: back up first, then plan again
  const close = passPath(d, pose, [{ x: right, z: 3.2, r: 0.6 }, { x: right, z: 4.2, r: 0.6 }], halfW, halfL, x => drivable(x));
  assert.ok(close && close.back > 0 && close.points.length === 0, `back ${close?.back.toFixed(1)} u`);
  // nothing in the way
  assert.equal(passPath(d, pose, [{ x: 2.3, z: 10, r: 0.3 }], halfW, halfL, x => drivable(x)), null);
});

test('W5-bus the player\'s tap-to-drive toy car and bike behind (or facing) a stopped toy car on a two-lane street: never stand more than 5 s, pass it where there is room, and arrive', async () => {
  const { MoveSystem } = await import('../src/opus-bay/actors/moveSystem');
  const moveApi = await import('../src/opus-bay/actors/moveApi');
  const { PlayerController } = await import('../src/opus-bay/actors/controller');
  const { TERRAIN_WORLD } = await import('../src/opus-bay/actors/vehicles/collide');
  await cityAround(SPOT, 260);
  const ix = await sf.graphIndex();
  setWalkGraph(ix);
  game.set({ phase: 'playing', worldMode: 'city', settings: { ...game.get().settings, quality: 'high' } } as never);
  const tick = () => new Promise<void>(r => setImmediate(r));
  const results: string[] = [];
  try {
    for (const [kind, scenario] of [['car', 'ahead'], ['car', 'oncoming'], ['car', 'queue'], ['car', 'both'], ['bike', 'ahead']] as const) {
      const life = new CityLife({ visible: () => true });
      for (let k = 0; k < 50 && !life.traffic; k++) await tick();
      assert.ok(life.traffic, 'the traffic started on the walking graph');
      const sim = life.traffic.sim;
      const net = sim.net;
      const ms = new MoveSystem();
      moveApi.bindMoveApi(ms);
      const events: string[] = [];
      const off = onEvent(e => { if (e.type === 'vehicle:auto') events.push(e.state); });
      try {
        // a straight chain of two-lane street edges (both ways usable, kerbs ≥ 1.3 u) near Union Square, ≥ 70 u
        let chain: StreetEdge[] = [];
        for (let n = 0; n < ix.nodeCount; n++) {
          if (Math.hypot(net.ix.x(n) - SPOT.x, net.ix.z(n) - SPOT.z) > 160) continue;
          for (let e = net.outStart(n); e < net.outEnd(n); e++) {
            const s0 = sim.usable(e);
            const ok = (s: StreetEdge | null): s is StreetEdge => !!s && s.twin >= 0 && !!sim.usable(s.twin) && s.curbL >= 1.3 && s.curbR >= 1.3;
            if (!ok(s0)) continue;
            const ch = [s0];
            for (let k = 0; k < 8; k++) {
              const last = ch[ch.length - 1];
              let nx: StreetEdge | null = null;
              for (let f = net.outStart(last.v); f < net.outEnd(last.v); f++) { const s1 = sim.usable(f); if (ok(s1) && s1.dx * last.dx + s1.dz * last.dz > 0.985) nx = s1; }
              if (!nx) break;
              ch.push(nx);
            }
            if (ch.reduce((a, c) => a + c.len, 0) > chain.reduce((a, c) => a + c.len, 0)) chain = ch;
          }
        }
        const total = chain.reduce((a, c) => a + c.len, 0);
        assert.ok(total >= 70, `a straight street (${total.toFixed(0)} u)`);
        const along = (a: number): [StreetEdge, number] => { for (const c of chain) { if (a <= c.len) return [c, a]; a -= c.len; } const l = chain[chain.length - 1]; return [l, l.len]; };
        const point = (a: number) => { const [e, x] = along(a); return { x: e.ax + e.dx * x, z: e.az + e.dz * x }; };
        const S = chain[0], heading = Math.atan2(S.dx, S.dz);
        const c = new PlayerController();
        const env = { cameraYaw: heading + Math.PI, frozen: false, playing: true, controller: c, frustum: new THREE.Frustum() };
        const rideable = ms.fleet.rides.find(r => r.kind === kind)!;
        const p0 = point(6);
        rideable.sim.place(p0.x, p0.z, heading, TERRAIN_WORLD);
        rideable.dirty = true;
        const pl = runtime.player;
        pl.x = p0.x - S.nx * 1.6; pl.z = p0.z - S.nz * 1.6; pl.y = heightAt(pl.x, pl.z); pl.heading = heading; pl.pathTarget = null; pl.locked = false;
        c.sync();
        ms.onInteract(`ride:${rideable.id}`, c);
        let t = 0;
        const pins: Pin[] = [], done: Pin[] = [];
        const frame = () => {
          const p = runtime.player;
          U.uCam.value.set(p.x - Math.sin(p.heading) * 10, heightAt(p.x, p.z) + 6, p.z - Math.cos(p.heading) * 10);
          ms.update(1 / 30, t, env);
          life.update(1 / 30);
          keepPins(pins, done, t);
          t += 1 / 30;
        };
        for (let k = 0; k < 90; k++) frame();
        assert.equal(ms.mode, kind);
        // the street to ourselves, then the scenario's standing car(s) 26 u ahead
        for (const x of sim.cars) if (x.on && Math.hypot(x.x - rideable.sim.x, x.z - rideable.sim.z) < 70) x.on = false;
        const put = (a: number, dir: 1 | -1) => {
          const [e, x] = along(a);
          const edge = dir > 0 ? e : sim.usable(e.twin)!;
          const [s0, s1] = sim.span(edge);
          const pin = pinCar(sim, edge, Math.max(s0 + 0.5, Math.min(s1 - 0.5, dir > 0 ? x : e.len - x)), t, 40, scenario, rideable.sim);
          assert.ok(pin);
          pins.push(pin);
        };
        if (scenario === 'ahead') put(26, 1);
        if (scenario === 'oncoming') put(26, -1);
        if (scenario === 'queue') { put(26, 1); put(30.2, 1); put(34.4, 1); }
        if (scenario === 'both') { put(26, 1); put(26.5, -1); }
        assert.equal(moveApi.driveTo(point(Math.min(total - 4, 60))), true);
        for (let k = 0; k < 30 && !ms.autoDriving; k++) await tick();
        let stand = 0, worst = 0;
        for (let k = 0; k < 30 * 60 && !events.some(e => e === 'arrive' || e === 'stuck'); k++) {
          frame();
          if (k % 10 === 0) await tick();
          stand = Math.abs(rideable.sim.v) < 0.3 && ms.autoDriving ? stand + 1 / 30 : 0;
          worst = Math.max(worst, stand);
        }
        const gave = done.filter(p => p.gave).length + pins.filter(p => p.car.leaving).length;
        results.push(`${kind} ${scenario}: ${events.join(',')} · longest stand ${worst.toFixed(1)} s · passes ${ms.drivePasses} · toy cars gave way ${gave}`);
        assert.ok(events.includes('arrive') && !events.includes('stuck'), `${kind} ${scenario} arrived (${events.join(', ')})`);
        assert.ok(worst <= 5, `${kind} ${scenario}: stood ${worst.toFixed(1)} s`);
        // where the street has room it drives round the car (a queue of three too); both lanes blocked: the toy cars clear
        if (scenario === 'both') assert.ok(gave >= 1, 'blocked both ways: the toy cars cleared the lane');
        else assert.ok(ms.drivePasses >= 1 || gave >= 1, `${kind} ${scenario}: passed it (or it cleared the lane)`);
      } finally { off(); moveApi.bindMoveApi(null); ms.dispose(); life.dispose(); }
    }
  } finally {
    setWalkGraph(null); setCityTerrain(null); game.set({ phase: 'title', worldMode: 'district', move: { mode: 'foot' } } as never);
    freshRuntime();
  }
  console.log(results.join('\n'));
});

// ---------------------------------------------------------------------------------------------------------------------
// The interlock boxes: a bus and the cable cars / streetcars on their shared stretches
// ---------------------------------------------------------------------------------------------------------------------

/** The loop, the cable cars and the F-line wired as world/transitLayer.ts does (no terrain, no traffic). */
function sharedStreets() {
  const line = buildFLine(FLINE_JSON ?? undefined, DISTRICT.streetcar)!;
  const cable = new CableSystem(DATA, {});
  let fleet: InstanceType<typeof LineFleet> | null = null;
  const fsys = new StreetcarSystem(line, {
    roadAhead: car => (fleet ? busAheadOfFCar(fleet, host, car) : Infinity),
    hurryDwell: car => (fleet ? busWaitsForFCar(fleet, host, car) : false),
  });
  const host = { line, sys: fsys };
  fleet = new LineFleet({ loop: W4.loop as TransitLine & { speeds?: [number, number, number][] }, metro: W4.metro, props: W4.props }, {
    boxes: bt => busInterlocks(bt, interlockLines(DATA, host), (l, b0, b1) => boxBlocked(cable, host, l, b0, b1)),
    emitEvents: false,
  });
  return { cable, fsys, fleet, host, line };
}

test('W5-bus interlocks: a cable car or streetcar leaves a shared stretch to a bus that would find it in there (boxDueIn), stops short inside it while one waits — 2 × 1 h: a bus waits at a box ≤ 3 times over 5 s, never 15 s (it was 13 an hour, up to 26 s at California & Drumm and on Market St); nobody waits for good', () => {
  T.setTransitW4(W4);
  T.setTransitData(DATA);
  const report: string[] = [];
  try {
    for (const phase of [0, 111]) {
      const { cable, fsys, fleet } = sharedStreets();
      T.setActiveLineFleet(fleet);
      const bus = fleet.bus, DT = 1 / 20;
      // a different start: the buses run a while on their own first
      for (let t = 0; t < phase; t += DT) bus.step(DT);
      // boxDueIn: 0 while a bus is in the box; the soonest arrival otherwise (the profile: never later than the bus)
      const box = bus.boxes.find(b => b.id.startsWith('california@'))!;
      assert.ok(box);
      const held = new Map<number, number>(), fStand = new Map<number, number>();
      let over5 = 0, worst = 0, worstCable = 0, worstF = 0;
      for (let t = 0; t < 3600; t += DT) {
        cable.step(DT); fsys.step(DT); bus.step(DT);
        for (const b of bus.buses) {
          const was = held.get(b.index) ?? 0;
          const h = b.why === 'box' && b.v < 0.3 ? was + DT : 0;
          if (h === 0 && was > 5) over5++;
          held.set(b.index, h);
          worst = Math.max(worst, h);
          if (bus.occupies(box.id) && b.s > box.a0 && b.s < box.a1) assert.equal(bus.boxDueIn(box.id), 0);
        }
        for (const c of cable.cars) worstCable = Math.max(worstCable, c.still);
        for (const c of fsys.cars) { const s = c.mode === 'run' && c.v < 0.3 ? (fStand.get(c.index) ?? 0) + DT : 0; fStand.set(c.index, s); worstF = Math.max(worstF, s); }
      }
      assert.deepEqual([...bus.violations(), ...cable.violations()], [], 'nothing overlaps');
      report.push(`phase ${phase}: bus box waits over 5 s ${over5}, longest ${worst.toFixed(1)} s; longest cable car stand ${worstCable.toFixed(1)} s, streetcar ${worstF.toFixed(1)} s`);
      assert.ok(over5 <= 3 && worst <= 15, report[report.length - 1]);
      // the other lines wait for the bus (at a stop, or short of the stretch), never for good
      // (W7-B5) bounded where it stands: a cable car's courtesy stand ≤ 50 s (measured 48.1 s at Hyde & Chestnut — the car's
      // stop, 24 s leaving the box to the loop bus, then the bus's 8 s stop inside it — and 43.3 s near Drumm; it was ≤ 60)
      assert.ok(worstCable <= 50 && worstF <= 45, report[report.length - 1]);
      T.setActiveLineFleet(null);
      fleet.dispose();
    }
  } finally { T.setActiveLineFleet(null); }
  console.log(report.join('\n'));
});

test('W5-bus a streetcar about to run through Market St\'s shared stretch stops short of it for a bus due there first (the rider\'s car never), and its stop inside a part is cut short while a bus waits', () => {
  T.setTransitW4(W4);
  T.setTransitData(DATA);
  const { fsys, fleet, host, line } = sharedStreets();
  T.setActiveLineFleet(fleet);
  try {
    const bus = fleet.bus;
    const box = bus.boxes.find(b => b.other?.line === 'f-line' && b.a1 - b.a0 > 100)!;
    assert.ok(box, 'the long Market St box');
    // a bus 40 u short of it, running; a streetcar 45 u short of its part, slowly (it can still stop)
    const b = bus.buses[0];
    for (const o of bus.buses) if (o !== b) o.s = (box.a0 + 2500) % bus.track.length;
    b.s = LT.normArc(bus.track, box.a0 - 40 - BUS.length / 2); b.mode = 'run'; b.v = 10; b.station = null; b.next = bus.stopIndex(W4.loop.stops.find(s => s.at > box.a1)?.id ?? W4.loop.stops[0].id);
    const car = fsys.cars[0];
    car.u = ((box.other!.b0 - 45 - 4.3) % line.length + line.length) % line.length; car.v = 4; car.mode = 'run';
    const dueIn = bus.boxDueIn(box.id);
    assert.ok(dueIn > 0 && dueIn < 10, `due in ${dueIn.toFixed(1)} s`);
    const ahead = busAheadOfFCar(fleet, host, car);
    assert.ok(ahead < 60, `stops short of the part (${ahead.toFixed(1)} u)`);
    assert.equal(busAheadOfFCar(fleet, host, { ...car, rider: true }), Infinity, 'the rider\'s car goes on');
    // a car dwelling inside the part while a bus waits at the box: its stop is cut short
    const inPart = { u: (box.other!.b0 + box.other!.b1) / 2 };
    b.s = LT.normArc(bus.track, box.a0 - BUS.length / 2 - 2); b.v = 0;
    assert.equal(busWaitsForFCar(fleet, host, inPart), true);
  } finally { T.setActiveLineFleet(null); fleet.dispose(); }
});

// ---------------------------------------------------------------------------------------------------------------------
// The proof: 20+ simulated minutes on the published city
// ---------------------------------------------------------------------------------------------------------------------

test('W5-bus 20+ simulated minutes: a whole loop lap, the N and the M on the published city with dense toy traffic and forced blockers (in the lane ahead, in the next stop zone, on a crossing) — nothing on the road holds a bus or a train more than 5 s outside its dwell; an interlock never for good', async () => {
  const { TransitLayer } = await import('../src/opus-bay/world/transitLayer');
  // (on foot, no vehicle of the player's: the traffic lives round the rider; the runtime as before any test, W7-B1)
  freshRuntime();
  game.set({ move: { mode: 'foot' } });
  T.setTransitW4(W4);
  T.setFlineJson(FLINE_JSON);
  T.setTransitData(DATA);
  setWalkGraph(null);
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  const lineOf = (id: string) => W4.lines.find(l => l.id === id)!;
  const stopAt = (line: string, id: string) => T.boardAt(W4, lineOf(line).stops.find(s => s.id === id)!);
  const start = stopAt('sf-loop', 'loop-ferry-building');
  await sf.attachAround(city, start.x, start.z, 240, LMS);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  const net = new StreetNet(await sf.graphIndex(), cityProbe);
  game.set({ phase: 'playing', worldMode: 'city', settings: { ...game.get().settings, quality: 'high' } } as never);
  runtime.player.x = start.x; runtime.player.z = start.z;
  const layer = new TransitLayer(DATA);
  layer.life.start(net);
  const lines = layer.lines!;
  const sim = layer.life.traffic!.sim;
  const lr = await transit.loadLineRides();
  const DT = 1 / 20;
  let simT = 0, lastAttach = { ...start };
  const pins: Pin[] = [], done: Pin[] = [];
  const frame = () => {
    const p = runtime.player, h = p.heading ?? 0;
    U.uCam.value.set(p.x - Math.sin(h) * 12, heightAt(p.x, p.z) + 6, p.z - Math.cos(h) * 12);
    runtime.guide.x = p.x + 0.8; runtime.guide.z = p.z + 0.6;
    runtime.move.mode = game.get().move.mode;
    layer.update(DT, simT);
    transit.stepTransit(DT);
    keepPins(pins, done, simT);
    simT += DT;
  };
  const stream = async () => {
    const p = runtime.player;
    if (Math.hypot(p.x - lastAttach.x, p.z - lastAttach.z) < 50) return;
    lastAttach = { x: p.x, z: p.z };
    await sf.attachAround(city, p.x, p.z, 240, LMS);
  };
  // every bus and every visible train: how long it stands outside its dwell (a bus: not at a stop, not braking into one,
  // not boarding; a train: not dwelling), by reason
  const stand = new Map<string, { secs: number; why: string }>();
  const worst = new Map<string, { secs: number; why: string; at: string }>();
  const note = (key: string, on: boolean, why: string, at: string) => {
    const s = stand.get(key) ?? { secs: 0, why: '' };
    s.secs = on ? s.secs + DT : 0;
    if (on && !why.startsWith('run')) s.why = why;
    stand.set(key, s);
    // (the interlocks apart: a bus at a box — a cable car or streetcar in the shared stretch, see the interlock test —,
    // a train at a single-track portal stretch an opposite train holds or at a terminus another stands at)
    const interlock = s.why.startsWith('box') || s.why === 'single track' || s.why === 'terminus' || s.why === 'portal';
    const kind = interlock ? `${key.replace(/#\d+/, '')} at an interlock` : key.replace(/#\d+/, '');
    if (on && s.secs > (worst.get(kind)?.secs ?? 0)) worst.set(kind, { secs: s.secs, why: s.why, at });
  };
  const watch = () => {
    for (const b of lines.bus.buses) note(`bus#${b.index}`, b.v < 0.3 && !['dwell', 'board', 'stop'].includes(b.why), `${b.why}:${b.whyOf}`, `(${b.pose.x.toFixed(0)}, ${b.pose.z.toFixed(0)})`);
    for (const tr of lines.rail.trains) {
      const lead = lines.rail.leadCar(tr);
      // why a train stands: short of a single-track stretch round a portal (lightRail gauntlets), at a terminus, the
      // rider's train waiting for the surface at a mouth, or anything else ('rail')
      const toEdge = (e: number) => (e - tr.s) * tr.dir;
      const single = lines.rail.gauntletsOf(tr.track).some(gt => !(tr.s > gt.a && tr.s < gt.b) && toEdge(tr.dir > 0 ? gt.a : gt.b) > 0 && toEdge(tr.dir > 0 ? gt.a : gt.b) < 12);
      const terminus = toEdge(tr.dir > 0 ? tr.track.length : 0) < 30;
      const why = tr.holdingPortal ? 'portal' : single ? 'single track' : terminus ? 'terminus' : 'rail';
      note(`${tr.track.id}#${tr.index}`, !tr.hidden && tr.v < 0.3 && tr.mode !== 'dwell', why, `(${lead.x.toFixed(0)}, ${lead.z.toFixed(0)})`);
    }
  };
  // a forced blocker ahead of the rider's vehicle, a broken-down toy car:
  //   lane      in its lane 18 u ahead (the bus stops behind it: it clears the lane after 2 s)
  //   zone      in the stop zone the bus heads for (it gives way the moment the bus comes)
  //   crossing  across the rider's path where a street crosses it (a train never stops for it: it gives way first)
  const kinds = ['lane', 'zone', 'crossing'] as const;
  let forced = 0;
  const force = (kind: typeof kinds[number]): boolean => {
    const bus = lines.bus.riderCarOf('sf-loop'), train = lines.riderTrain();
    let x: number, z: number, hd: number;
    if (bus?.rider) {
      if (kind === 'zone') {
        const st = lines.bus.track.stops[bus.next];
        if (LT.arcAhead(lines.bus.track, bus.s, st.at) < 30) return false;
        const p = LT.trackPoint(lines.bus.track, st.at);
        x = p.x; z = p.z; hd = p.heading;
      } else {
        const p = LT.trackPoint(lines.bus.track, bus.s + (kind === 'lane' ? 18 : 26));
        x = p.x; z = p.z; hd = p.heading;
      }
    } else if (train?.rider && !train.hidden) {
      if (kind === 'zone') return false;
      const p = LT.trackPoint(train.track, train.s + train.dir * 34);
      x = p.x; z = p.z; hd = train.dir > 0 ? p.heading : p.heading + Math.PI;
    } else return false;
    // the lane point nearest the spot on an edge along the rider's heading (lane, zone) or across it (crossing)
    const node = net.ix.nearestNode(x, z, 40);
    if (node < 0) return false;
    let best: { e: StreetEdge; a: number; d: number } | null = null;
    const seen = new Set([node]), queue = [node];
    for (let qi = 0; qi < queue.length && qi < 40; qi++) {
      for (let e = net.outStart(queue[qi]); e < net.outEnd(queue[qi]); e++) {
        const v = net.target(e);
        if (!seen.has(v)) { seen.add(v); queue.push(v); }
        const s = sim.usable(e);
        if (!s) continue;
        const dot = s.dx * Math.sin(hd) + s.dz * Math.cos(hd);
        if (kind === 'crossing' ? Math.abs(dot) > 0.5 : dot < 0.8) continue;
        const [a0, a1] = sim.span(s);
        for (let a = kind === 'crossing' ? 0 : a0; a <= (kind === 'crossing' ? s.len : a1); a += 0.5) {
          const p = sim.lanePoint(s, a, { x: 0, z: 0 }), d = Math.hypot(p.x - x, p.z - z);
          if (!best || d < best.d) best = { e: s, a, d };
        }
      }
    }
    if (!best || best.d > (kind === 'crossing' ? 4 : 2.5)) return false;
    const pin = pinCar(sim, best.e, best.a, simT, 25, kind, runtime.player);
    if (!pin) return false;
    pins.push(pin);
    forced++;
    return true;
  };
  const legs: [string, string, string][] = [['sf-loop', 'loop-ferry-building', 'loop-ferry-building'], ['n-judah', 'muni-duboce-park', 'muni-judah-la-playa'], ['m-ocean-view', 'muni-west-portal', 'muni-san-jose-geneva']];
  const report: string[] = [];
  let riding = 0;
  try {
    // warm up round the Ferry Building: the buses, trains, cars and people settle
    for (let t = 0; t < 120; t += DT) frame();
    stand.clear(); worst.clear();
    busWatch.resetBusWatch();
    let k = 0;
    for (const [line, from, to] of legs) {
      const at = stopAt(line, from);
      runtime.player.x = at.x; runtime.player.z = at.z;
      await sf.attachAround(city, at.x, at.z, 240, LMS);
      lastAttach = { x: at.x, z: at.z };
      const quote = lr.lineRideSeconds(line, from, to);
      lr.rideLine(line, from, to);
      const t0 = simT;
      let boarded = -1, next = 20, poll = 0;
      for (let i = 0; i < 20 * 1500 && ride.currentRide(); i++) {
        frame();
        watch();
        if ((poll += DT) >= 0.25) { poll = 0; busWatch.watchBuses(0.25, lines); }
        if (i % 10 === 0) await stream();
        if (boarded < 0 && ride.currentRide()?.mode === 'follow') boarded = simT;
        // a blocker every 22 s of riding: the slot's own kind first, else the next kind that fits here (W7-B1: a train
        // has no stop zone, a bus near its stop no room for one — the slot used to pass unforced); none for 8 s: it passes
        if (boarded >= 0 && simT - boarded > next) {
          let j = 0;
          while (j < kinds.length && !force(kinds[(k + j) % kinds.length])) j++;
          if (j < kinds.length) { k += j + 1; next = simT - boarded + 22; } else if (simT - boarded > next + 8) { k++; next = simT - boarded + 22; }
        }
      }
      assert.equal(ride.currentRide(), null, `${line} ${from} → ${to} arrived`);
      const took = simT - boarded;
      riding += simT - t0;
      report.push(`${line} ${from} → ${to}: waited ${(boarded - t0).toFixed(0)} s, rode ${took.toFixed(0)} s (quote ${quote.toFixed(0)} s)`);
      assert.ok(took <= 1.3 * quote, report[report.length - 1]);
    }
    for (const p of pins.splice(0)) done.push(p);
    report.push(`forced blockers ${forced}: ${kinds.map(kd => `${kd} ${done.filter(p => p.kind === kd).length} (gave way: ${done.filter(p => p.kind === kd && p.gave).map(p => p.gave).join(',')})`).join('; ')}`);
    report.push(`longest stands outside a dwell: ${[...worst].map(([kd, w]) => `${kd} ${w.secs.toFixed(1)} s ${w.why} ${w.at}`).join(' · ')}`);
    report.push(`toy traffic: ${JSON.stringify(layer.life.traffic!.stats())}`);
    console.log(report.join('\n'));
    assert.ok(riding >= 20 * 60, `20+ simulated minutes of riding (${(riding / 60).toFixed(1)})`);
    // (W7-B1: 47 since a slot falls back to another kind — lane 15, zone 10, crossing 22 — where it was 31, one over)
    assert.ok(forced >= 30 && kinds.every(kd => done.filter(p => p.kind === kd).length >= 5), `forced blockers, ≥ 5 of every kind (${forced})`);
    // the rules at work: cars cleared the lane for the bus held behind them and for transit coming at them
    const st = layer.life.traffic!.stats();
    assert.ok(st.gaveHeld >= 5 && st.gaveOncoming >= 3, JSON.stringify(st));
    // nothing on the road holds a bus or a train more than 5 s: no toy car, no queue, no stop zone, no crossing
    for (const [kd, w] of worst) if (!kd.endsWith('at an interlock')) assert.ok(w.secs <= 5, `${kd} stood ${w.secs.toFixed(1)} s (${w.why}) at ${w.at}`);
    // at an interlock a bus or train waits for the other line's vehicle to come out of the shared stretch, never for
    // good. (W6-B) A bus ≤ 25 s: Market St — the loop runs 148 u on the F-line's single-track stem — held the rider's bus
    // 47 s while two streetcars met at a passing place in there (a car leaving the part to the bus had taken the block
    // beyond it); now the car waits at the passing place before the part without that block (world/flineSystem.ts,
    // world/sf/lineInterlocks.ts holdBefore). A train (the Sunset Tunnel's single track, a terminus) ≤ 60 s.
    for (const [kd, w] of worst) if (kd.endsWith('at an interlock')) assert.ok(w.secs <= (kd.startsWith('bus') ? 25 : 60), `${kd} stood ${w.secs.toFixed(1)} s (${w.why}) at ${w.at}`);
    // the bus watch saw no stall (≥ 6 s off a stop) of the rider's bus but at a box
    assert.deepEqual(busWatch.busStalls().filter(s => s.rider && s.why !== 'box'), []);
  } finally {
    transit.cancelRide(); layer.dispose(); T.setActiveLineFleet(null); setCityTerrain(null);
    game.set({ phase: 'title', worldMode: 'district' } as never); runtime.move.mode = 'foot'; busWatch.resetBusWatch();
  }
});
