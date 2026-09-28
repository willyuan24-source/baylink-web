import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 5 · lane T (tests/opus-bay-w5-transit.test.ts): W5-T1 the hooks other lanes use (crowd spots with the 3 u clear
 * lane, the crowd's wave back, rideEta from real progress, the turntable beat and push strength, the ride banner's pads)
 * and W5-T2 / T3 (the bus watch, the stalls, the caps, 直接到站 after 10 s, the tour bus) — driven in node exactly as the
 * world does.
 */

// --- headless canvas stub (world modules create label atlases at import time), as tests/opus-bay-sf-lines-int.test.ts
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
// (the 直接到站 veil is plain DOM: a stub element that takes a style, an attribute and goes away)
const el = () => ({ width: 0, height: 0, style: {} as Record<string, string>, textContent: '', getContext: () => ctx2d, setAttribute: noop, remove: noop, appendChild: noop });
g.document ??= { createElement: el, querySelector: () => null, body: el() };
g.requestAnimationFrame ??= (fn: () => void) => setTimeout(fn, 0);

const CS = await import('../src/opus-bay/world/sf/crowdSpots');
const { CrowdSim, CrowdLayer, WAVE_TIME } = await import('../src/opus-bay/world/sf/crowd');
const { StreetNet } = await import('../src/opus-bay/world/sf/streetNet');
const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
const { canStand, cityChunkEpoch, heightAt, setCityTerrain, surfaceAt } = await import('../src/opus-bay/core/terrain');
const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
const { personGeometry, crowdPeopleMaterial } = await import('../src/opus-bay/world/life');
const { sfDisk } = await import('./opus-bay-sf-disk');
const T = await import('../src/opus-bay/data/transit');
const { LineFleet } = await import('../src/opus-bay/world/sf/lineFleet');
const { CableSystem, PUSH_BOOST, setActiveCableSystem } = await import('../src/opus-bay/world/transitLine');
const { game } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const transit = await import('../src/opus-bay/game/transit');
const ride = await import('../src/opus-bay/game/ride');
const slots = await import('../src/opus-bay/ui/rideSlots');
const { flow } = await import('../src/opus-bay/game/flowStore');
const { TRAFFIC, TrafficSim, bodyDistance, queuedBehind } = await import('../src/opus-bay/world/sf/traffic');
const { CityLife, cityProbe } = await import('../src/opus-bay/world/sf/cityLife');
const { registerRoadVehicles, collectRoadVehicles } = await import('../src/opus-bay/world/sf/streetNet');
const { BUS, BusSystem, busTrack } = await import('../src/opus-bay/world/busSystem');
const busWatch = await import('../src/opus-bay/game/busWatch');
const { startTravel, stepTravel, travelActive } = await import('../src/opus-bay/game/fastTravel');
const { requestPlatformStop, releasePlatformStop } = await import('../src/opus-bay/actors/platform');
const { U } = await import('../src/opus-bay/world/materials');
const { createElement: h } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
type TransitLine = import('../src/opus-bay/world/sf/format').TransitLine;
type RoadVehicle = import('../src/opus-bay/world/sf/streetNet').RoadVehicle;
type StreetProbe = import('../src/opus-bay/world/sf/streetNet').StreetProbe;
type FlowRide = import('../src/opus-bay/game/flowStore').FlowRide;

const PUB = path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1');
const FILE = JSON.parse(fs.readFileSync(path.join(PUB, 'transit.json'), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson;
const DATA = T.buildTransit(FILE);
const W4 = T.buildTransitW4(FILE)!;
const DT = 1 / 30;

// ---------------------------------------------------------------------------------------------------------------------
// W5-T1 · crowd spots (pure registry)
// ---------------------------------------------------------------------------------------------------------------------

test('W5-T1 crowd spots: count, spacing, facing the sight, the 3 u clear lane toward it, capped, replaced, removed', () => {
  CS.__resetCrowdSpotsForTests();
  const stage = { x: 10, z: 0 };
  const off = CS.addCrowdSpots('event:test', [{ x: 0, z: 0, r: 6 }], { face: stage, count: 16 });
  let pins = CS.crowdPins();
  assert.equal(pins.length, 16);
  const lane = CS.crowdLanes().find(l => l.key === 'event:test')!.lane;
  // the default lane runs from behind the group to the stage, through the middle
  assert.ok(Math.hypot(lane.bx - stage.x, lane.bz - stage.z) < 1e-6, 'the lane ends at the sight');
  for (const p of pins) {
    assert.ok(CS.laneDistance(lane, p.x, p.z).d >= CS.CLEAR_LANE / 2 - 1e-6, `pin ${p.id} out of the 3 u lane`);
    const want = Math.atan2(stage.x - p.x, stage.z - p.z);
    assert.ok(Math.abs(Math.atan2(Math.sin(p.face - want), Math.cos(p.face - want))) < 1e-6, 'faces the stage');
  }
  // they stand apart (packed over the disc, a few pushed to the lane's edges)
  let close = 0;
  for (const a of pins) for (const b of pins) if (a !== b && Math.hypot(a.x - b.x, a.z - b.z) < 0.5) close++;
  assert.ok(close <= 2, `pairs closer than 0.5 u: ${close / 2}`);
  // a walk down the lane from behind the group to the stage meets nobody within 1.5 u
  for (let k = 0; k <= 40; k++) {
    const x = lane.ax + (lane.bx - lane.ax) * (k / 40), z = lane.az + (lane.bz - lane.az) * (k / 40);
    for (const p of pins) assert.ok(Math.hypot(p.x - x, p.z - z) >= 1.5 - 1e-6);
  }
  // capped at CROWD_SPOT_MAX; the same key replaces; a second group keeps out of the first one's lane too
  CS.addCrowdSpots('event:test', [{ x: 0, z: 0, r: 8 }], { face: stage, count: 99 });
  assert.equal(CS.crowdPins().length, CS.CROWD_SPOT_MAX);
  const v = CS.crowdPinsVersion();
  CS.addCrowdSpots('corner:queue', [{ x: -2, z: -3 }, { x: -1, z: -3 }, { x: 0, z: -3 }, { x: 1, z: -3 }, { x: 2, z: -3 }]);
  assert.ok(CS.crowdPinsVersion() > v);
  pins = CS.crowdPins();
  assert.equal(pins.length, CS.CROWD_SPOT_MAX + 5);
  const lanes = CS.crowdLanes();
  for (const p of pins) for (const l of lanes) assert.ok(CS.laneDistance(l.lane, p.x, p.z).d >= CS.CLEAR_LANE / 2 - 1e-6, `${p.id} clear of ${l.key}'s lane`);
  // a queue facing nothing in particular: its lane crosses it (split in two), people face the middle
  const q = lanes.find(l => l.key === 'corner:queue')!.lane;
  assert.ok(Math.abs(q.ax - q.bx) < 1e-6 || Math.abs((q.bz - q.az) / (q.bx - q.ax)) > 5, 'the lane runs across the queue (along z)');
  // removing a group lets its pins go; the remover of a replaced group does nothing
  off();
  assert.equal(CS.crowdPins().filter(p => p.key === 'event:test').length, CS.CROWD_SPOT_MAX, 'an old remover never removes the replacement');
  CS.removeCrowdSpots('event:test');
  assert.deepEqual([...new Set(CS.crowdPins().map(p => p.key))], ['corner:queue']);
  // an explicit lane (the GGB deck's centre)
  CS.addCrowdSpots('deck', [{ x: 0, z: 50, r: 3 }], { count: 8, lane: { ax: 0, az: 40, bx: 0, bz: 60 } });
  for (const p of CS.crowdPins().filter(p => p.key === 'deck')) assert.ok(Math.abs(p.x) >= 1.5 - 1e-6);
  CS.__resetCrowdSpotsForTests();
  assert.equal(CS.crowdPins().length, 0);
});

// ---------------------------------------------------------------------------------------------------------------------
// W5-T1 · the crowd: pinned standers and the wave back (on the published city round Union Square)
// ---------------------------------------------------------------------------------------------------------------------

const sf = sfDisk();
const LMS = landmarkWalkInputs(SF_LANDMARKS);
const SPOT = { x: 78, z: 222 };
const probe: StreetProbe = { surface: surfaceAt, stand: canStand, height: heightAt, epoch: (x, z) => cityChunkEpoch(Math.floor(x / 128), Math.floor(z / 128)) };

async function withCity<R>(at: { x: number; z: number }, radius: number, fn: (net: InstanceType<typeof StreetNet>) => R | Promise<R>): Promise<R> {
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  await sf.attachAround(city, at.x, at.z, radius, LMS);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try { return await fn(new StreetNet(await sf.graphIndex(), probe)); } finally { setCityTerrain(null); }
}

/** Walkable sidewalk / plaza points round (x, z): where a group can stand (not the roadway). */
function standable(x0: number, z0: number, r: number, n: number): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (let k = 0; k < 4000 && out.length < n; k++) {
    const a = k * 2.399, d = r * Math.sqrt(k / 4000);
    const x = x0 + Math.cos(a) * d, z = z0 + Math.sin(a) * d;
    if (surfaceAt(x, z) !== 'road' && canStand(x, z, 0.3) && !out.some(p => Math.hypot(p.x - x, p.z - z) < 1.2)) out.push({ x, z });
  }
  return out;
}

test('W5-T1 crowd: one sightseer on each registered spot near the player, facing the sight; removed → they go', async () => {
  await withCity(SPOT, 260, net => {
    CS.__resetCrowdSpotsForTests();
    const focus = { ...SPOT };
    const sim = new CrowdSim(net, { focus: () => focus, avoid: () => {}, visible: () => false, vehicles: () => [], pins: () => CS.crowdPins() }, { seed: 11 });
    for (let i = 0; i < 30 * 3; i++) sim.step(DT);
    const spots = standable(SPOT.x + 8, SPOT.z + 10, 14, 10);
    assert.ok(spots.length >= 8, `standable spots round the plaza: ${spots.length}`);
    const face = { x: SPOT.x + 8, z: SPOT.z + 30 };
    CS.addCrowdSpots('event:ybg-test', spots.map(p => ({ x: p.x, z: p.z })), { face });
    const pins = CS.crowdPins();
    for (let i = 0; i < 30 * 4; i++) sim.step(DT);
    const placeable = pins.filter(p => surfaceAt(p.x, p.z) !== 'road' && canStand(p.x, p.z, 0.22));
    const pinned = sim.walkers.filter(w => w.on && w.pin);
    assert.equal(pinned.length, placeable.length, `every placeable spot has its stander (${pinned.length} / ${placeable.length} of ${pins.length})`);
    assert.equal(sim.active, sim.target, 'the crowd stays at its size: the others made room');
    for (const w of pinned) {
      const p = pins.find(q => q.id === w.pin)!;
      assert.ok(Math.hypot(w.x - p.x, w.z - p.z) < 0.6, `on its spot (${Math.hypot(w.x - p.x, w.z - p.z).toFixed(2)} u)`);
      const want = Math.atan2(face.x - w.x, face.z - w.z);
      assert.ok(Math.abs(Math.atan2(Math.sin(w.heading - want), Math.cos(w.heading - want))) < 0.75, 'facing the sight');
      assert.equal(w.mode, 'stand');
    }
    // 60 s on: still there (a registered spot's stander is never recycled)
    const ids = new Set(pinned.map(w => w.id));
    for (let i = 0; i < 30 * 60; i++) sim.step(DT);
    assert.deepEqual(new Set(sim.walkers.filter(w => w.on && w.pin).map(w => w.id)), ids);
    // removed: they are let go (and recycled once their stand is over, out of view)
    CS.removeCrowdSpots('event:ybg-test');
    for (let i = 0; i < 30 * 2; i++) sim.step(DT);
    assert.equal(sim.walkers.filter(w => w.on && w.pin).length, 0);
    for (let i = 0; i < 30 * 3; i++) sim.step(DT);
    assert.ok(sim.walkers.filter(w => w.on && ids.has(w.id) && w.mode === 'stand' && Math.hypot(w.x0 - pins[0].x, w.z0 - pins[0].z) < 20).length === 0, 'the former standers left');
    // a spot far behind the player waits (nobody is placed beyond the crowd's radius)
    CS.addCrowdSpots('far', [{ x: SPOT.x + 400, z: SPOT.z }]);
    for (let i = 0; i < 30; i++) sim.step(DT);
    assert.equal(sim.walkers.filter(w => w.on && w.pin).length, 0);
    CS.__resetCrowdSpotsForTests();
  });
});

test('W5-T1 wave back: walkers within 6 u stop, turn to the player and lift a hand (aWalk < 0); nobody farther', async () => {
  await withCity(SPOT, 200, net => {
    CS.__resetCrowdSpotsForTests();
    const focus = { ...SPOT };
    const layer = new CrowdLayer(net, { focus: () => focus, avoid: () => {}, visible: () => true, vehicles: () => [], waves: () => CS.takeCrowdWaves() });
    const sim = layer.sim;
    const cam = { x: SPOT.x, y: heightAt(SPOT.x, SPOT.z) + 6, z: SPOT.z + 8 };
    for (let i = 0; i < 30 * 4; i++) layer.update(DT, cam);
    // stand the player where walkers are about: the walker nearest the spot
    const near = sim.walkers.filter(w => w.on && w.mode !== 'cross').sort((a, b) => Math.hypot(a.x - SPOT.x, a.z - SPOT.z) - Math.hypot(b.x - SPOT.x, b.z - SPOT.z))[0];
    const me = { x: near.x + 2, z: near.z };
    const within = sim.walkers.filter(w => w.on && w.mode !== 'cross' && w.hopT < 0 && Math.hypot(w.x - me.x, w.z - me.z) <= 6 - 0.3).map(w => w.id);
    assert.ok(within.length >= 1, 'someone within 6 u');
    CS.crowdWave(me.x, me.z);
    layer.update(DT, cam);
    const waving = sim.walkers.filter(w => w.on && w.waveT > 0);
    for (const id of within) assert.ok(waving.some(w => w.id === id), `walker ${id} within 6 u waves back`);
    for (const w of waving) assert.ok(Math.hypot(w.x - me.x, w.z - me.z) <= 6 + 0.5, 'nobody farther than 6 u');
    // 0.8 s later: turned to the player, the hand up (the near figure's aWalk < 0), standing still
    const at = new Map(waving.map(w => [w.id, { x: w.x, z: w.z }]));
    for (let i = 0; i < 24; i++) layer.update(DT, cam);
    let up = 0;
    for (const w of waving) {
      if (!w.on) continue;
      const want = Math.atan2(me.x - w.x, me.z - w.z);
      assert.ok(Math.abs(Math.atan2(Math.sin(w.heading - want), Math.cos(w.heading - want))) < 0.35, 'turned to the player');
      assert.ok(Math.hypot(w.x - at.get(w.id)!.x, w.z - at.get(w.id)!.z) < 0.5, 'stopped to wave');
      if (sim.waveAmount(w) > 0.5) up++;
    }
    assert.ok(up >= Math.min(1, waving.length), 'hands up');
    const walk = (layer as unknown as { near: { walk: { array: Float32Array } } }).near.walk.array;
    assert.ok([...walk].some(v => v < -0.5), 'a near figure draws with aWalk < 0 (the hand up)');
    // done after the wave
    for (let i = 0; i < 30 * (WAVE_TIME + 0.8); i++) layer.update(DT, cam);
    assert.equal(sim.walkers.filter(w => w.on && w.waveT > 0).length, 0);
    layer.dispose();
  });
});

test('W5-T1 people material: the right hand carries the wave channel; the legs ignore a negative aWalk (the promenade unchanged)', () => {
  const geo = personGeometry();
  const info = geo.getAttribute('aInfo'), pos = geo.getAttribute('position');
  let marked = 0, minX = Infinity;
  for (let i = 0; i < info.count; i++) if (info.getZ(i) > 0.5) { marked++; minX = Math.min(minX, pos.getX(i)); }
  assert.ok(marked > 0 && marked < 60, `one hand's vertices (${marked})`);
  assert.ok(minX > 0.1, 'only the right hand (x > 0)');
  const shader = { uniforms: {} as Record<string, unknown>, vertexShader: '#include <common>\n#include <color_vertex>\n#include <begin_vertex>', fragmentShader: '' };
  crowdPeopleMaterial().onBeforeCompile(shader as never, undefined as never);
  assert.match(shader.vertexShader, /max\(aWalk, 0\.0\)/, 'the legs swing with max(aWalk, 0)');
  assert.match(shader.vertexShader, /aInfo\.z > 0\.5\) \{ float wv = max\(-aWalk, 0\.0\)/, 'the hand lifts with max(-aWalk, 0)');
  geo.dispose();
});

// ---------------------------------------------------------------------------------------------------------------------
// W5-T1 · rideEta from real progress, the turntable beat, the ride banner's pads
// ---------------------------------------------------------------------------------------------------------------------

/** The fleet (buses + trains), installed as the active fleet. */
function makeFleet() {
  const fleet = new LineFleet({ loop: W4.loop as TransitLine & { speeds?: [number, number, number][] }, metro: W4.metro, props: W4.props }, { emitEvents: false });
  T.setActiveLineFleet(fleet);
  return fleet;
}

/** Step the fleet and the game's transit flow together (the transit layer and Systems' ticker do this in the game). */
function stepAll(fleet: InstanceType<typeof LineFleet>, seconds: number, until?: () => boolean, each?: (t: number) => void) {
  for (let t = 0; t < seconds; t += DT) {
    fleet.update(DT, runtime.player, runtime.player);
    transit.stepTransit(DT);
    each?.(t);
    if (until?.()) return true;
  }
  return false;
}

test('W5-T1 rideEta: a loop ride — waiting = the bus ETA + the quote; aboard it counts down from real progress, never frozen past a dwell', async () => {
  T.setTransitW4(W4);
  T.setTransitData(DATA);
  const fleet = makeFleet();
  const lr = await transit.loadLineRides();
  try {
    game.set({ phase: 'playing' });
    const at = T.boardAt(W4, W4.loop.stops.find(s => s.id === 'loop-castro')!);
    runtime.player.x = at.x; runtime.player.z = at.z;
    assert.equal(transit.rideEta(), null, 'no ride, no ETA');
    lr.rideLine('sf-loop', 'loop-castro', 'loop-mission-dolores');
    const quote = lr.lineRideSeconds('sf-loop', 'loop-castro', 'loop-mission-dolores');
    stepAll(fleet, DT);
    const w = transit.rideEta()!;
    assert.equal(w.stage, 'waiting');
    assert.ok(Math.abs(w.rideLeft - quote) < 1e-6, 'the whole quote while waiting');
    assert.ok(Math.abs(w.seconds - (w.waitLeft + quote)) < 1e-6);
    assert.equal(w.progress, 0);
    assert.ok(stepAll(fleet, 40, () => ride.currentRide()?.mode === 'follow'), 'boarded');
    const t0 = fleet.bus.time;
    const first = transit.rideEta()!;
    assert.equal(first.stage, 'riding');
    // sample once a second: the ETA falls; the longest stretch it stays put is a dwell (8 s), never 15 s
    let last = first.seconds, same = 0, worst = 0, lastProgress = 0;
    const done = stepAll(fleet, 400, () => !ride.currentRide(), t => {
      if (Math.abs((t % 1) - 0) > DT / 2 && Math.abs((t % 1) - 1) > DT / 2) return;
      const e = transit.rideEta();
      if (!e) return;
      if (Math.abs(e.seconds - last) < 0.5) same++; else same = 0;
      worst = Math.max(worst, same);
      last = e.seconds;
      const rb = fleet.bus.buses[fleet.bus.rideStatus()!.car];
      assert.ok(e.progress >= lastProgress - 0.02, `progress never goes back (${lastProgress.toFixed(3)} → ${e.progress.toFixed(3)}, ${e.seconds.toFixed(1)} s, bus s ${rb.s.toFixed(1)} v ${rb.v.toFixed(2)} ${rb.mode} timer ${rb.timer.toFixed(2)})`);
      lastProgress = e.progress;
    });
    assert.ok(done, 'arrived');
    const took = fleet.bus.time - t0;
    assert.ok(worst <= 10, `the ETA stood still for ${worst} s at most`);
    assert.ok(Math.abs(first.seconds - took) / took < 0.2, `the ETA at boarding (${first.seconds.toFixed(0)} s) is the ride (${took.toFixed(0)} s) within 20 %`);
    assert.ok(lastProgress > 0.9, `progress reached ${lastProgress.toFixed(2)}`);
  } finally { transit.cancelRide(); T.setActiveLineFleet(null); fleet.dispose(); game.set({ phase: 'title' }); }
});

test('W5-T1 rideEta on a cable car: the quote × the line still ahead; the turntable beat and a stronger push on it', async () => {
  T.setTransitData(DATA);
  await transit.loadLineRides();
  const sys = new CableSystem(DATA);
  setActiveCableSystem(sys);
  try {
    game.set({ phase: 'playing', worldMode: 'city' } as never);
    // a car turning on a turntable, the player beside it: the push prompt and the beat
    let car = sys.cars.find(c => c.mode === 'turn');
    for (let i = 0; i < 30 * 240 && !car; i++) { sys.step(DT); car = sys.cars.find(c => c.mode === 'turn'); }
    assert.ok(car, 'a car turns within 4 minutes');
    const tt = sys.turntableOf(car)!;
    runtime.player.x = tt.x + 6; runtime.player.z = tt.z;
    transit.stepTransit(0.3);
    const near = transit.turntableNear();
    assert.equal(near?.id, tt.id);
    assert.ok(near!.progress >= 0 && near!.progress < 1);
    const b1 = transit.turntableBeat(tt.id, 100)!;
    assert.ok(b1 && b1.period === transit.TURN_BEAT && b1.n >= 1);
    const b2 = transit.turntableBeat(tt.id, b1.next + 0.01)!;
    assert.ok(Math.abs(b2.next - b1.next - transit.TURN_BEAT) < 1e-9 && b2.n === b1.n + 1, 'beats every TURN_BEAT on the same clock');
    const boost0 = car.boost;
    assert.equal(transit.pushTurntable(tt.id, 2), true);
    assert.ok(Math.abs(car.boost - boost0 - 2 * PUSH_BOOST) < 1e-9, 'an on-beat push is twice a press');
    assert.equal(transit.pushTurntable('nowhere'), false);
    // a cable-car ride: rideEta falls back to the quote × the distance left
    const line = DATA.lines.find(l => l.id === 'powell-mason')!;
    const [a, b] = [line.stops[1], line.stops[line.stops.length - 2]];
    const st = DATA.stations.find(s => s.id === a.station)!;
    runtime.player.x = st.x; runtime.player.z = st.z;
    transit.rideCable(line.id, a.station, b.station);
    const r = ride.currentRide()!;
    assert.ok(r.quote && r.quote > 0 && r.dist && r.dist > 0);
    let boarded = false, lastLeft = Infinity, rose = 0;
    for (let i = 0; i < 30 * 400 && ride.currentRide(); i++) {
      sys.step(DT);
      transit.stepTransit(DT);
      const e = transit.rideEta();
      if (!e) continue;
      if (e.stage === 'riding') { boarded = true; if (e.rideLeft > lastLeft + 0.01) rose++; lastLeft = e.rideLeft; }
    }
    assert.ok(boarded, 'rode the cable car');
    assert.equal(rose, 0, 'the time left only falls');
  } finally { transit.cancelRide(); setActiveCableSystem(null); game.set({ phase: 'title', worldMode: 'district' } as never); }
});

test('W5-T1 ride banner pads: registered by order, replaced by id, removed; a pad whose visible() throws is left out', () => {
  const ride0: FlowRide = { stage: 'riding', from: 'a', to: 'b', line: 'powell-hyde', kind: 'cable-car' };
  const Comp = () => null;
  const offA = slots.registerRidePad({ id: 'bell', order: 10, visible: r => r.kind === 'cable-car' && r.stage !== 'waiting', Component: Comp });
  const offB = slots.registerRidePad({ id: 'other', order: 5, visible: () => true, Component: Comp });
  const offC = slots.registerRidePad({ id: 'bad', order: 1, visible: () => { throw new Error('x'); }, Component: Comp });
  try {
    assert.deepEqual(slots.ridePads().map(p => p.id), ['bad', 'other', 'bell']);
    assert.deepEqual(slots.visibleRidePads(ride0).map(p => p.id), ['other', 'bell']);
    assert.deepEqual(slots.visibleRidePads({ ...ride0, stage: 'waiting' }).map(p => p.id), ['other']);
    let calls = 0;
    const unsub = slots.subscribeRidePads(() => { calls++; });
    const offA2 = slots.registerRidePad({ id: 'bell', order: 20, visible: () => true, Component: Comp });
    assert.deepEqual(slots.ridePads().map(p => p.id), ['bad', 'other', 'bell']);
    offA();
    assert.ok(slots.ridePads().some(p => p.id === 'bell'), 'an old remover never removes the replacement');
    offA2();
    assert.ok(!slots.ridePads().some(p => p.id === 'bell'));
    assert.equal(calls, 2);
    unsub();
  } finally { offB(); offC(); }
  assert.equal(slots.ridePads().length, 0);
});

// ---------------------------------------------------------------------------------------------------------------------
// W5-T2 · the bus stalls: the toy traffic never waits for the bus behind it, gives way, the caps, the watch
// ---------------------------------------------------------------------------------------------------------------------

test('W5-T2 queuedBehind / bodyDistance: behind in the lane (from the car, or from the bus looking ahead on a curve), a body\'s long axis', () => {
  const car = { x: 0, z: 0, heading: 0 };
  const bus = (x: number, z: number, heading = 0): RoadVehicle => ({ x, z, heading, v: 0, halfL: BUS.length / 2, halfW: BUS.width / 2, kind: 'bus', line: 'sf-loop' });
  assert.equal(queuedBehind(car, bus(0, -7)), true, 'right behind in the lane');
  assert.equal(queuedBehind(car, bus(0, 7)), false, 'ahead of the car');
  assert.equal(queuedBehind(car, bus(0, -7, Math.PI)), false, 'coming the other way');
  assert.equal(queuedBehind(car, bus(4, -7)), false, 'in another lane');
  assert.equal(queuedBehind(car, bus(0, -40)), false, 'far back');
  // a curve: the bus 7.2 u behind, heading 43° off the car, looking at it straight ahead (Ocean Beach, 40 s)
  const a = 0.76, b = bus(-Math.sin(a) * 7.2, -Math.cos(a) * 7.2, a);
  assert.equal(queuedBehind(car, b), true, 'the bus looks at the car ahead of it');
  // bodyDistance: along the body's long axis (a car beside the middle of the bus is inside it)
  assert.ok(bodyDistance(bus(0, 0), 0.5, 2) < 0.6 && bodyDistance(bus(0, 0), 3, 0) > 2.9);
});

/** A fresh traffic sim round Union Square with a crafted set of road vehicles and people, stepped until a car waits at a stop line. */
async function carAtStopLine(net: InstanceType<typeof StreetNet>, vehicles: RoadVehicle[], people: { x: number; z: number; r: number }[]) {
  const focus = { ...SPOT };
  const sim = new TrafficSim(net, { focus: () => focus, visible: () => true, vehicles: () => vehicles, people: out => { out.push(...people); } }, { seed: 21 });
  const internal = sim as unknown as { canEnter(c: unknown, node: number, next: unknown, v: readonly RoadVehicle[]): boolean; span(s: unknown): [number, number] };
  for (let i = 0; i < 30 * 30; i++) {
    sim.step(DT);
    for (const c of sim.cars) {
      if (!c.on || c.mode !== 'lane' || c.next < 0) continue;
      const e = net.edge(c.e)!, g = sim.usable(c.next);
      if (!g || net.degree(e.v) < 3 || internal.span(e)[1] - c.s > 0.3) continue;
      return { sim, car: c, e, g, internal };
    }
  }
  throw new Error('no car reached a stop line');
}

test('W5-T2 traffic: a toy car at its stop line never waits for the bus queued behind it; one still holding a bus up 5 s (or inside its body) shrinks away', async () => {
  await withCity(SPOT, 260, async net => {
    const vehicles: RoadVehicle[] = [];
    const people: { x: number; z: number; r: number }[] = [];
    const { sim, car, e, g, internal } = await carAtStopLine(net, vehicles, people);
    // a bus closing in behind the car at 6 u/s: where it will be within 2 s reaches the junction box, so the old rule kept
    // the car at its line while the bus braked for the car (Marina Blvd by Mason St: both stood 38.8 s)
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    const nx = net.ix.x(e.v), nz = net.ix.z(e.v);
    const back = TRAFFIC.length / 2 + 2.2 + BUS.length / 2 + 6;
    const bus: RoadVehicle = { x: car.x - fx * back, z: car.z - fz * back, heading: car.heading, v: 6, halfL: BUS.length / 2, halfW: BUS.width / 2, kind: 'bus', line: 'sf-loop' };
    const box = net.setback(e.v) + 1.6 + bus.halfL;
    assert.ok([0, 0.7, 1.4, 2].some(t => Math.hypot(bus.x + fx * 6 * t - nx, bus.z + fz * 6 * t - nz) < box), 'the bus would be in the box within 2 s');
    assert.equal(internal.canEnter(car, e.v, g, [bus]), true, 'the car goes: the bus waits for it, not the other way round');
    // the bus now stands right behind it (its front 2.2 u short of the car's tail)
    bus.v = 0; bus.x += fx * 6; bus.z += fz * 6;
    assert.ok(bodyDistance(bus, car.x, car.z) > BUS.width / 2 + TRAFFIC.width, 'not touching the car');
    // someone in the junction keeps the car at its line; with the bus stopped behind it, after 5 s it shrinks away
    people.push({ x: nx, z: nz, r: 0.45 });
    vehicles.push(bus);
    const id = car.id;
    let left = -1;
    for (let t = 0; t < 8; t += DT) {
      sim.step(DT);
      const c = sim.cars[id];
      if (left < 0 && c.leaving) left = t;
      if (!c.on || c.e !== e.e && !c.leaving) break;
    }
    assert.ok(left >= TRAFFIC.giveWay - 0.2 && left <= TRAFFIC.giveWay + 0.5, `gave way after ${left.toFixed(1)} s`);
    assert.ok(sim.stats.gaveWay >= 1);
    // a car inside a transit vehicle's body leaves at once
    people.length = 0; vehicles.length = 0;
    const other = sim.cars.find(c => c.on && !c.leaving)!;
    vehicles.push({ x: other.x, z: other.z, heading: other.heading + 1.2, v: 0, halfL: BUS.length / 2, halfW: BUS.width / 2, kind: 'bus', line: 'sf-loop' });
    sim.step(DT);
    assert.equal(other.leaving, true, 'inside the bus: gone');
    // a car leaving is nobody's obstacle any more (the bus behind it moves at once)
    const out: RoadVehicle[] = [];
    sim.vehicles(out);
    assert.ok(!out.some(v => Math.hypot(v.x - other.x, v.z - other.z) < 1e-6));
  });
});

test('W5-T2 the rider on the bus deck (and BAYBAY beside them) is not a pedestrian on the roadway for the toy traffic', async () => {
  await withCity(SPOT, 200, net => {
    const life = new CityLife({ visible: () => true });
    try {
      life.start(net);
      const env = (life.traffic!.sim as unknown as { env: { people(out: { x: number; z: number; r: number }[]): void } }).env;
      // a roadway point by Union Square
      let road: { x: number; z: number } | null = null;
      for (let k = 0; k < 4000 && !road; k++) { const x = SPOT.x + (k % 60) - 30, z = SPOT.z + Math.floor(k / 60) - 30; if (surfaceAt(x, z) === 'road') road = { x, z }; }
      assert.ok(road);
      runtime.player.x = road.x; runtime.player.z = road.z;
      runtime.guide.x = road.x + 0.8; runtime.guide.z = road.z;
      const people = (): { x: number; z: number; r: number }[] => { const out: { x: number; z: number; r: number }[] = []; env.people(out); return out; };
      game.set({ move: { mode: 'foot' } });
      runtime.move.mode = 'foot';
      assert.ok(people().some(p => Math.hypot(p.x - road!.x, p.z - road!.z) < 0.01), 'on foot on the roadway: the cars stop for the player');
      game.set({ move: { mode: 'transit', line: 'sf-loop', spot: 'seat' } });
      runtime.move.mode = 'transit';
      assert.equal(people().filter(p => Math.hypot(p.x - road!.x, p.z - road!.z) < 1.5).length, 0, 'aboard: neither the player nor BAYBAY beside them');
    } finally { life.dispose(); game.set({ move: { mode: 'foot' } }); runtime.move.mode = 'foot'; }
  });
});

test('W5-T2 the waiting rider at the Ferry Building: a bus is brought in although the stretch before the stop is in view (relaxed after 12 s) — picked up within 45 s', () => {
  const pole = T.boardAt(W4, W4.loop.stops.find(s => s.id === 'loop-ferry-building')!);
  const cam = { x: pole.x, z: pole.z - 12 };
  // the camera looks north up the approach: everything within 170 u in front of it is in view (world/transitLayer.ts's cone)
  const visible = (x: number, z: number) => { const dx = x - cam.x, dz = z - cam.z, d = Math.hypot(dx, dz); return d <= 170 && (d < 25 || dz / d > 0.25); };
  const sys = new BusSystem(busTrack(W4.loop as TransitLine & { speeds?: [number, number, number][] }), { visible, viewer: () => ({ x: pole.x, z: pole.z, onFoot: true }) });
  // run the buses until none is due at the Ferry Building within 60 s
  const idx = sys.stopIndex('loop-ferry-building');
  for (let i = 0; i < 30 * 900 && Math.min(...sys.buses.map(b => sys.eta(b, idx))) < 60; i++) sys.step(DT);
  assert.ok(Math.min(...sys.buses.map(b => sys.eta(b, idx))) >= 60, 'no bus due soon');
  sys.request({ line: 'sf-loop', station: 'loop-ferry-building', to: 'loop-pier-39' });
  let t = 0;
  for (; t < 90 && sys.rideStatus()?.phase === 'coming'; t += DT) sys.step(DT);
  assert.equal(sys.rideStatus()?.phase, 'here');
  assert.ok(t <= 45, `picked up after ${t.toFixed(1)} s`);
  assert.ok(sys.events.some(e => e.what === 'dispatch'), 'a bus was brought in');
  const b = sys.buses[sys.rideStatus()!.car];
  assert.equal(b.station, 'loop-ferry-building');
});

test('W5-T2 bus watch: every bus says why it stands; a hold of 6 s off its stop is a stall, logged with the reason, closed when it moves', () => {
  let blocked = true;
  // a toy car standing on the road 30 u past where bus 0 pulls away (its tail at that arc)
  let carAt = NaN;
  const sys = new BusSystem(busTrack(W4.loop as TransitLine & { speeds?: [number, number, number][] }), {
    roadAhead: (b, who) => {
      if (!blocked || b.index !== 0 || b.mode !== 'run') return Infinity;
      if (Number.isNaN(carAt)) carAt = b.s + 30;
      who.kind = 'traffic';
      return carAt - b.s;
    },
  });
  const fleet = { bus: sys } as unknown as InstanceType<typeof LineFleet>;
  busWatch.resetBusWatch();
  // bus 0 leaves its stop, then a toy car stands 3 u ahead of it for 12 s
  let poll = 0;
  for (let t = 0; t < 60 && !(sys.buses[0].mode === 'run' && sys.buses[0].v < 0.3 && sys.buses[0].why === 'road' && t > 12); t += DT) {
    sys.step(DT);
    if ((poll += DT) >= 0.25) { poll = 0; busWatch.watchBuses(0.25, fleet); }
  }
  for (let t = 0; t < 12; t += DT) { sys.step(DT); if ((poll += DT) >= 0.25) { poll = 0; busWatch.watchBuses(0.25, fleet); } }
  assert.equal(sys.buses[0].why, 'road');
  assert.equal(sys.buses[0].whyOf, 'traffic');
  const stall = busWatch.busStalls().find(s => s.bus === 0);
  assert.ok(stall && stall.open && stall.why === 'road' && stall.of === 'traffic' && stall.seconds >= 10, JSON.stringify(stall));
  assert.ok(busWatch.busWatchNow(fleet).find(n => n.bus === 0)!.still >= 10);
  blocked = false;
  for (let t = 0; t < 3; t += DT) { sys.step(DT); if ((poll += DT) >= 0.25) { poll = 0; busWatch.watchBuses(0.25, fleet); } }
  assert.equal(stall.open, false, 'closed once it moves');
  assert.ok(['run', 'stop', 'bus-ahead'].includes(sys.buses[0].why));
  // a dwell at a stop is never a stall (the other buses dwelt at theirs meanwhile)
  assert.ok(!busWatch.busStalls().some(s => s.why === 'dwell' || s.why === 'stop' || s.why === 'board'));
  busWatch.resetBusWatch();
});

test('W5-T2 the loop on the real streets with the crowd and the toy traffic: Ferry Building → Golden Gate Bridge → Lands End, no stall over 6 s, each leg within 1.3 × its quote, the ETA never frozen 15 s', async () => {
  // (on the wave-4 code this ride stood 38.8 s on Marina Blvd by Mason St and 38 s on Lincoln Blvd: a toy car waiting at
  // its stop line for the bus behind it, and for the rider and BAYBAY on its deck)
  T.setTransitW4(W4);
  T.setTransitData(DATA);
  const legs: [string, string][] = [['loop-ferry-building', 'loop-golden-gate-bridge'], ['loop-golden-gate-bridge', 'loop-lands-end-sutro']];
  const LMS2 = LMS;
  const city = createCityTerrain(sf.manifest, { landmarks: LMS2 });
  city.setFar(await sf.far());
  const start = T.boardAt(W4, W4.loop.stops.find(s => s.id === legs[0][0])!);
  await sf.attachAround(city, start.x, start.z, 240, LMS2);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  const net = new StreetNet(await sf.graphIndex(), cityProbe);
  const visible = (x: number, z: number) => {
    const c = U.uCam.value, p = runtime.player, dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
    if (d > 170) return false;
    if (d < 25) return true;
    const fx = p.x - c.x, fz = p.z - c.z, fl = Math.hypot(fx, fz) || 1;
    return (dx * fx + dz * fz) / (d * fl) > 0.25;
  };
  game.set({ phase: 'playing', worldMode: 'city', settings: { ...game.get().settings, quality: 'mid' } } as never);
  const fleet = new LineFleet({ loop: W4.loop as TransitLine & { speeds?: [number, number, number][] }, metro: W4.metro, props: W4.props }, {
    groundY: (x, z) => heightAt(x, z), visible,
    viewer: () => ({ x: runtime.player.x, z: runtime.player.z, onFoot: runtime.move.mode === 'foot' }),
    roadUsers: out => collectRoadVehicles(out), emitEvents: false,
  });
  T.setActiveLineFleet(fleet);
  const offFleet = registerRoadVehicles(out => fleet.roadVehicles(out, runtime.player));
  const life = new CityLife({ visible });
  life.start(net);
  const lr = await transit.loadLineRides();
  busWatch.resetBusWatch();
  let last = { ...start };
  try {
    for (const [from, to] of legs) {
      const at = T.boardAt(W4, W4.loop.stops.find(s => s.id === from)!);
      runtime.player.x = at.x; runtime.player.z = at.z;
      await sf.attachAround(city, at.x, at.z, 240, LMS2);
      const quote = lr.lineRideSeconds('sf-loop', from, to);
      lr.rideLine('sf-loop', from, to);
      let boarded = -1, t = 0, lastEta = -1, same = 0, worst = 0, poll = 0;
      for (let k = 0; k < 30 * 600 && ride.currentRide(); k++, t += DT) {
        const p = runtime.player, hd = p.heading ?? 0;
        U.uCam.value.set(p.x - Math.sin(hd) * 12, heightAt(p.x, p.z) + 6, p.z - Math.cos(hd) * 12);
        runtime.guide.x = p.x + 0.8; runtime.guide.z = p.z + 0.6;
        runtime.move.mode = game.get().move.mode;
        fleet.update(DT, { x: U.uCam.value.x, z: U.uCam.value.z }, p);
        transit.stepTransit(DT);
        life.update(DT);
        if ((poll += DT) >= 0.25) { poll = 0; busWatch.watchBuses(0.25, fleet); }
        if (boarded < 0 && ride.currentRide()?.mode === 'follow') boarded = t;
        if (k % 30 === 0) { const e = transit.rideEta(); if (e && e.stage === 'riding') { same = Math.abs(e.seconds - lastEta) < 0.25 ? same + 1 : 0; worst = Math.max(worst, same); lastEta = e.seconds; } }
        if (k % 15 === 0 && Math.hypot(p.x - last.x, p.z - last.z) > 50) { last = { x: p.x, z: p.z }; await sf.attachAround(city, p.x, p.z, 240, LMS2); }
      }
      assert.equal(ride.currentRide(), null, `${from} → ${to} arrived`);
      const rideT = t - boarded;
      assert.ok(rideT <= 1.3 * quote, `${from} → ${to}: ${rideT.toFixed(0)} s aboard, quote ${quote.toFixed(0)} s`);
      assert.ok(worst < 15, `${from} → ${to}: the ETA stood ${worst} s at most`);
    }
    const stalls = busWatch.busStalls().filter(s => s.rider);
    assert.equal(stalls.length, 0, `the rider's bus never stood 6 s off a stop: ${JSON.stringify(stalls)}`);
  } finally {
    transit.cancelRide(); offFleet(); life.dispose(); T.setActiveLineFleet(null); fleet.dispose(); setCityTerrain(null);
    game.set({ phase: 'title', worldMode: 'district' } as never); runtime.move.mode = 'foot'; busWatch.resetBusWatch();
  }
});

/** A loop ride from the Castro to Civic Center (330 u: 直接到站 goes under the veil), boarded. */
async function boardedFarRide() {
  T.setTransitW4(W4);
  T.setTransitData(DATA);
  const fleet = makeFleet();
  const lr = await transit.loadLineRides();
  game.set({ phase: 'playing', worldMode: 'city' } as never);
  const at = T.boardAt(W4, W4.loop.stops.find(s => s.id === 'loop-castro')!);
  runtime.player.x = at.x; runtime.player.z = at.z;
  lr.rideLine('sf-loop', 'loop-castro', 'loop-civic-center');
  assert.ok(stepAll(fleet, 40, () => ride.currentRide()?.mode === 'follow'), 'boarded');
  stepAll(fleet, 12);
  return fleet;
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

test('W5-T2 直接到站 under the veil: a hop-off wins (off beside the bus, no jump later); a fly-to started under it wins (the ride ends where it is)', async () => {
  const civic = T.boardAt(W4, W4.loop.stops.find(s => s.id === 'loop-civic-center')!);
  let fleet = await boardedFarRide();
  try {
    transit.finishRide();
    assert.ok(ride.currentRide(), 'the veil waits for the city to stream in: the ride goes on');
    const r0 = ride.currentRide()!;
    stepAll(fleet, 0.1);
    transit.hopOffRide();
    assert.equal(ride.currentRide(), null, 'the hop-off is honoured under the veil');
    const bus = fleet.bus.buses.reduce((a, b) => (Math.hypot(b.pose.x - runtime.player.x, b.pose.z - runtime.player.z) < Math.hypot(a.pose.x - runtime.player.x, a.pose.z - runtime.player.z) ? b : a));
    assert.ok(Math.hypot(bus.pose.x - runtime.player.x, bus.pose.z - runtime.player.z) < 8, 'off beside the bus');
    const off = { x: runtime.player.x, z: runtime.player.z };
    await sleep(550);
    assert.deepEqual({ x: runtime.player.x, z: runtime.player.z }, off, 'the veil\'s jump never came');
    assert.ok(Math.hypot(off.x - civic.x, off.z - civic.z) > 50);
    void r0;
  } finally { transit.cancelRide(); T.setActiveLineFleet(null); fleet.dispose(); }
  fleet = await boardedFarRide();
  try {
    transit.finishRide();
    assert.ok(ride.currentRide());
    const at = { x: runtime.player.x, z: runtime.player.z };
    assert.equal(startTravel({ id: 'test-dest', name: { zh: '测试', en: 'Test' }, x: at.x + 300, z: at.z }), true);
    await sleep(550);
    assert.equal(ride.currentRide(), null, 'the flight ended the ride');
    assert.equal(flow.get().ride, null);
    assert.ok(Math.hypot(runtime.player.x - civic.x, runtime.player.z - civic.z) > 50, 'never put at the stop mid-flight');
    for (let t = 0; t < 60 && travelActive(); t += 0.25) stepTravel(0.25);
    assert.equal(travelActive(), false);
  } finally { transit.cancelRide(); T.setActiveLineFleet(null); fleet.dispose(); game.set({ phase: 'title', worldMode: 'district' } as never); }
});

test('W5-T2 the ride banner: after 10 s without the bus moving, 直接到站 is the big button and it says the ride is held up', async () => {
  const fleet = await boardedFarRide();
  const { default: RideBanner } = await import('../src/opus-bay/ui/RideBanner');
  try {
    const before = renderToStaticMarkup(h(RideBanner));
    assert.doesNotMatch(before, /is-big/);
    assert.match(before, /直接到站/);
    // the rider's hop-off brake holds the bus (anything that stands it still will do)
    const bus = fleet.bus.riderCarOf('sf-loop')!;
    requestPlatformStop('sf-loop', 1);
    stepAll(fleet, 3);
    assert.ok(bus.v < 0.05);
    stepAll(fleet, transit.STALL_BIG);
    assert.ok((transit.rideEta()?.stalled ?? 0) >= transit.STALL_BIG);
    const held = renderToStaticMarkup(h(RideBanner));
    assert.match(held, /ob-ride-skip is-big/);
    assert.match(held, /车停住了/);
    assert.doesNotMatch(held, /ob-btn ob-btn-primary ob-btn-sm"[^>]*>.*下一站下车/, 'the bell steps back to a soft button');
    releasePlatformStop('sf-loop');
    stepAll(fleet, 4);
    assert.ok((transit.rideEta()?.stalled ?? 0) < 1, 'moving again');
    assert.doesNotMatch(renderToStaticMarkup(h(RideBanner)), /is-big/);
  } finally { releasePlatformStop('sf-loop'); transit.cancelRide(); T.setActiveLineFleet(null); fleet.dispose(); game.set({ phase: 'title', worldMode: 'district' } as never); }
});

// ---------------------------------------------------------------------------------------------------------------------
// W5-T3 · the tour's own bus boards without the driver question
// ---------------------------------------------------------------------------------------------------------------------

test('W5-T3 a Grand Tour leg boards the loop bus at once (no driver question); a plain trip still gets the pre-filled question', async () => {
  T.setTransitW4(W4);
  T.setTransitData(DATA);
  const fleet = makeFleet();
  await transit.loadLineRides();
  const savedTrip = flow.get().trip;
  try {
    game.set({ phase: 'playing', worldMode: 'city', dialogue: { nodeId: null } } as never);
    const at = T.boardAt(W4, W4.loop.stops.find(s => s.id === 'loop-castro')!);
    runtime.player.x = at.x; runtime.player.z = at.z;
    flow.set({ trip: { placeId: 'twin-peaks', legs: [], leg: 0, startedAt: 0, option: { mode: 'line', legs: [], seconds: 0 }, source: 'tour' } as never });
    transit.boardLine('loop-castro', { to: 'loop-twin-peaks', line: 'sf-loop' });
    assert.equal(game.get().dialogue.nodeId, null, 'no dialogue on a tour leg');
    assert.equal(flow.get().ride?.stage, 'waiting');
    assert.equal(flow.get().ride?.to, 'loop-twin-peaks');
    assert.equal(ride.currentRide()?.line, 'sf-loop');
    assert.ok(stepAll(fleet, 40, () => ride.currentRide()?.mode === 'follow'), 'and rides the bus');
    transit.cancelRide();
    // a trip the player planned on the map: the one pre-filled row, as before (an explicit auto: true skips it too)
    flow.set({ trip: { placeId: 'twin-peaks', legs: [], leg: 0, startedAt: 0, option: { mode: 'line', legs: [], seconds: 0 }, source: 'map' } as never });
    transit.boardLine('loop-castro', { to: 'loop-twin-peaks', line: 'sf-loop' });
    assert.equal(game.get().dialogue.nodeId, 'flow.bus');
    assert.equal(ride.currentRide(), null);
    game.set({ dialogue: { nodeId: null } } as never);
    transit.boardLine('loop-castro', { to: 'loop-twin-peaks', line: 'sf-loop', auto: true });
    assert.equal(game.get().dialogue.nodeId, null);
    assert.equal(flow.get().ride?.stage, 'waiting');
  } finally { transit.cancelRide(); flow.set({ trip: savedTrip }); T.setActiveLineFleet(null); fleet.dispose(); game.set({ phase: 'title', worldMode: 'district', dialogue: { nodeId: null } } as never); }
});

// =====================================================================================================================
// Part b · W5-T4 the levers, W5-T5 the crowds, W5-T6 the audio hooks' internals
// =====================================================================================================================

const THREE = await import('three');
const { Life, LIFE_FAR } = await import('../src/opus-bay/world/life');
const { DISTRICT } = await import('../src/opus-bay/data/district');
const { cableCarGeometry, cableCarMidGeometry, cableCarFarGeometry } = await import('../src/opus-bay/world/cablecar');
const { carGeometry, carFarGeometry } = await import('../src/opus-bay/world/streetcar');
const { carMidGeometry } = await import('../src/opus-bay/world/flineLayer');
const { EXTRA_SHADOW_NEAR, FAR_LOD, SHADOW_NEAR } = await import('../src/opus-bay/world/sf/lineFleet');
const { deckLanes } = await import('../src/opus-bay/world/sf/cityLife');
const { RESIDENTS } = await import('../src/opus-bay/data/sf/residents');
const LR = await transit.loadLineRides();

/** Triangles the visible meshes of a group draw (instanced meshes × their live count). */
function drawnTriangles(root: import('three').Object3D): number {
  let tris = 0;
  root.traverse(o => {
    const m = o as import('three').Mesh;
    if (!m.isMesh) return;
    for (let p: import('three').Object3D | null = m; p; p = p.parent) if (!p.visible) return;
    const g = m.geometry;
    tris += ((g.index ? g.index.count : g.attributes.position.count) / 3) * ((m as import('three').InstancedMesh).isInstancedMesh ? (m as import('three').InstancedMesh).count : 1);
  });
  return tris;
}

test('W5-T4 district life, city mode: each kind draws only its instances within reach of the camera (Chinatown: no promenade walkers, gulls or carousel); district mode unchanged', () => {
  const prevCam = U.uCam.value.clone();
  game.set({ phase: 'free' } as never);
  try {
    const life = new Life([]);
    life.heroFarSource = () => false;
    const people = life.group.getObjectByName('pedestrians') as import('three').InstancedMesh;
    const all = people.instanceMatrix.count;
    // district mode (no cull): every walker in its own slot, every frame, as before
    life.cullFar = () => false;
    const ferryGate = DISTRICT.anchors['ferry-gate'];
    U.uCam.value.set(86, 22, 196);
    for (let i = 0; i < 6; i++) life.update(0.1, i * 0.1, 0);
    assert.equal(people.count, all);
    for (let k = 0; k < all; k++) assert.equal(life.peopleSlot(k), k, 'slot k = walker k');
    const full = drawnTriangles(life.group);
    // city mode at Chinatown (the capacity scout's view, ≈ 180 u from the promenade): none of them
    life.cullFar = () => true;
    for (let i = 6; i < 12; i++) life.update(0.1, i * 0.1, 0);
    const d = life.drawn();
    assert.equal(d.people, 0); assert.equal(d.dogs, 0); assert.equal(d.gulls, 0); assert.equal(d.carousel, false);
    assert.equal(people.visible, false, 'no draw call for an empty kind');
    const culled = drawnTriangles(life.group);
    assert.ok(full - culled > 24_000, `Chinatown saves ${full - culled} triangles (${full} → ${culled}; the GLB sailboats and pelicans are not loaded in node)`);
    // at the Ferry gate: the walkers within reach are drawn, each slot carrying its own walker's phase
    U.uCam.value.set(ferryGate.x, 8, ferryGate.z + 14);
    for (let i = 12; i < 20; i++) life.update(0.1, i * 0.1, 0);
    const near = life.drawn();
    assert.ok(near.people > 5 && near.people < all, `some walkers near the gate (${near.people} of ${all})`);
    assert.ok(near.gulls > 0, 'birds by the gate');
    const phase = people.geometry.getAttribute('aPhase') as import('three').InstancedBufferAttribute;
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    const walkerPh = (life as unknown as { walkers: { ph: number }[] }).walkers.map(w => w.ph);
    for (let k = 0; k < people.count; k++) {
      const src = life.peopleSlot(k);
      assert.ok(Math.abs(phase.getX(k) - walkerPh[src]) < 1e-6, `slot ${k} carries walker ${src}'s phase`);
      people.getMatrixAt(k, m); m.decompose(p, q, s);
      assert.ok(Math.hypot(p.x - U.uCam.value.x, p.y + 0.8 - U.uCam.value.y, p.z - U.uCam.value.z) <= LIFE_FAR.people + 1, 'within reach');
    }
    // back in district mode: all of them again, in their own slots
    life.cullFar = () => false;
    for (let i = 20; i < 24; i++) life.update(0.1, i * 0.1, 0);
    assert.equal(people.count, all);
    for (let k = 0; k < all; k++) assert.equal(life.peopleSlot(k), k);
    assert.ok(Math.abs(phase.getX(3) - walkerPh[3]) < 1e-6, 'phases back in their own slots');
    life.dispose();
  } finally { U.uCam.value.copy(prevCam); game.set({ phase: 'title' } as never); }
});

test('W5-T4 cable cars and F-line cars: the middle look (45–110 u) and a shadow only within 45 u; kinds without one unchanged', () => {
  const tri = (g: import('three').BufferGeometry) => g.getIndex()!.count / 3;
  const cable = [cableCarGeometry(), cableCarMidGeometry(), cableCarFarGeometry()].map(tri);
  const fline = [carGeometry('#2f7d5a', true), carMidGeometry('#2f7d5a'), carFarGeometry('#2f7d5a')].map(tri);
  assert.ok(cable[1] <= 600 && cable[1] < cable[0] * 0.3 && cable[1] > cable[2], `cable car near / mid / far: ${cable.join(' / ')}`);
  assert.ok(fline[1] <= 500 && fline[1] < fline[0] * 0.46 && fline[1] > fline[2], `F-line car near / mid / far: ${fline.join(' / ')}`);
  const fleet = new LineFleet({
    loop: W4.loop as TransitLine & { speeds?: [number, number, number][] }, metro: W4.metro, props: W4.props,
    extra: [{ key: 'cable', near: cableCarGeometry(), mid: cableCarMidGeometry(), far: cableCarFarGeometry(), count: 1 }, { key: 'plain', near: cableCarGeometry(), far: cableCarFarGeometry(), count: 1 }],
  }, { emitEvents: false });
  try {
    // every bus and train far out of sight: only the two test cars count
    const cam = { x: 1e5, z: 1e5 };
    fleet.update(0, cam, cam);
    const car = (key: string, d: number) => { fleet.drawExtra(key, 0, { x: cam.x + d, y: 0, z: cam.z, heading: 0, pitch: 0, roll: 0 } as never, false, cam); };
    const look = (d: number) => { car('plain', 1e4); car('cable', d); return fleet.stats(); };
    let s = look(30);
    assert.deepEqual([s.nearVehicles, s.midVehicles, s.farVehicles], [1, 0, 0]);
    assert.equal(s.shadowTris, cable[0], '30 u: the full car with its shadow');
    s = look(EXTRA_SHADOW_NEAR + 5);
    assert.deepEqual([s.nearVehicles, s.midVehicles, s.shadowTris], [0, 1, 0]);
    assert.equal(s.tris, cable[1], '50 u: the middle look, no shadow');
    s = look(FAR_LOD - 1);
    assert.equal(s.tris, cable[1]);
    s = look(FAR_LOD + 20);
    assert.equal(s.tris, cable[2], 'beyond FAR_LOD: the far look');
    // a kind without a middle look keeps the old bands (full car + shadow ≤ SHADOW_NEAR, the full car without ≤ FAR_LOD)
    car('cable', 1e4);
    car('plain', SHADOW_NEAR - 5);
    s = fleet.stats();
    assert.deepEqual([s.nearVehicles, s.shadowTris], [1, cable[0]]);
    car('plain', SHADOW_NEAR + 20);
    s = fleet.stats();
    assert.deepEqual([s.midVehicles, s.tris, s.shadowTris], [1, cable[0], 0]);
  } finally { fleet.dispose(); }
});

/** The GGB deck frame for the tests: along the span from the south end, across (+ = left of south → north). */
function deckFrame() {
  const L = deckLanes()[0].lane, dx = L.bx - L.ax, dz = L.bz - L.az, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
  return {
    L, len,
    local: (x: number, z: number) => ({ along: (x - L.ax) * ux + (z - L.az) * uz, across: (x - L.ax) * -uz + (z - L.az) * ux }),
    at: (along: number, across = 0) => ({ x: L.ax + ux * along - uz * across, z: L.az + uz * along + ux * across }),
  };
}

test('W5-T5 the Golden Gate Bridge deck: the crowd keeps a 3 u lane down the centre (walkers on the sidewalks, nobody crosses the roadway); a walk down the middle meets nobody', async () => {
  const D = deckFrame();
  const mid = D.at(D.len * 0.45);
  await withCity(mid, 330, net => {
    CS.__resetCrowdSpotsForTests();
    const off = CS.addClearLane(deckLanes()[0].key, D.L, undefined, { noCross: true });
    const focus = { ...mid };
    const player = { x: 0, z: 0 };
    const sim = new CrowdSim(net, { focus: () => focus, avoid: out => { out.push(player); }, visible: () => false, vehicles: () => [], lanes: () => CS.walkerLanes() }, { seed: 7 });
    let onDeck = 0, inLane = 0, deep = 0, nearMe = 0;
    // the player walks the deck's centre line end to end at 4 u/s (the crowd round them), then back
    const T0 = D.len / 4;
    for (let i = 0; i < 30 * 2 * T0; i++) {
      const t = i / 30, s = t < T0 ? t * 4 : (2 * T0 - t) * 4;
      Object.assign(player, D.at(Math.max(2, Math.min(D.len - 2, s))));
      Object.assign(focus, player);
      sim.step(DT);
      if (i < 30 * 8 || i % 6) continue;
      for (const w of sim.walkers) {
        if (!w.on) continue;
        const l = D.local(w.x, w.z);
        if (Math.abs(l.across) > 3 || l.along < 3 || l.along > D.len - 3 || w.y < 10) continue;
        onDeck++;
        if (Math.abs(l.across) < 1.5 + 0.28) inLane++;
        if (Math.abs(l.across) < 1.2) deep++;
        if (Math.hypot(w.x - player.x, w.z - player.z) < 0.9) nearMe++;
      }
    }
    assert.ok(onDeck > 2000, `walkers on the deck: ${onDeck} samples`);
    assert.ok(inLane / onDeck < 0.03, `bodies in the 3 u lane: ${inLane} of ${onDeck} samples (${(100 * inLane / onDeck).toFixed(1)} %; ≈ 25 % before the lane)`);
    assert.ok(deep / onDeck < 0.005, `deep in the lane: ${deep}`);
    assert.equal(nearMe, 0, 'nobody within 0.9 u of the player walking the centre line');
    off();
    assert.equal(CS.walkerLanes().length, 0);
    CS.__resetCrowdSpotsForTests();
  });
});

test('W5-T5 an event crowd of 20: its aisle stays clear of standers and of walkers going along it (crossing it is fine); sightseers never spawn in it', async () => {
  await withCity(SPOT, 260, net => {
    CS.__resetCrowdSpotsForTests();
    const spots = standable(SPOT.x + 8, SPOT.z + 10, 14, 12);
    const face = { x: SPOT.x + 8, z: SPOT.z + 30 };
    CS.addCrowdSpots('event:test-20', spots, { face, count: 20 });
    const lane = CS.walkerLanes().find(l => l.key === 'event:test-20')!;
    assert.equal(lane.half, CS.CLEAR_LANE / 2);
    const focus = { ...SPOT };
    const sim = new CrowdSim(net, {
      focus: () => focus, avoid: () => {}, visible: () => false, vehicles: () => [], pins: () => CS.crowdPins(), lanes: () => CS.walkerLanes(),
      // sightseers are offered the aisle's own middle too: they must never take it
      standSpots: () => [{ x: (lane.lane.ax + lane.lane.bx) / 2, z: (lane.lane.az + lane.lane.bz) / 2, r: 4 }],
    }, { seed: 21 });
    let standIn = 0, alongIn = 0, samples = 0, pinned = 0;
    const dx = lane.lane.bx - lane.lane.ax, dz = lane.lane.bz - lane.lane.az, L = Math.hypot(dx, dz);
    for (let i = 0; i < 30 * 60; i++) {
      sim.step(DT);
      if (i < 30 * 6 || i % 10) continue;
      for (const w of sim.walkers) {
        if (!w.on) continue;
        const q = CS.laneDistance(lane.lane, w.x, w.z);
        if (q.t <= 0.02 || q.t >= 0.98) continue;
        samples++;
        if (w.pin) pinned++;
        if (q.d >= lane.half) continue;
        if (w.mode === 'stand') standIn++;
        else if (w.mode === 'walk' && Math.abs(Math.sin(w.heading) * dx / L + Math.cos(w.heading) * dz / L) > 0.8 && w.lx === 0 && w.lz === 0) alongIn++;
      }
    }
    assert.ok(pinned > 50, `the visitors stand round the stage (${pinned} samples)`);
    assert.equal(standIn, 0, 'nobody stands in the aisle');
    assert.ok(alongIn <= 2, `walkers going along the aisle inside it without stepping out: ${alongIn} of ${samples}`);
    CS.__resetCrowdSpotsForTests();
  });
});

test('W5-T5 the six residents: city walkers step round them — never into Ray at the Powell turntable (≥ 0.6 u centre to centre: two bodies side by side; 0.39 u in the wave-3 review)', async () => {
  const ray = RESIDENTS.find(r => r.key === 'gripman')!;
  await withCity(ray.at, 240, async net => {
    CS.__resetCrowdSpotsForTests();
    const prevCam = U.uCam.value.clone();
    const night = U.uNight.value;
    U.uNight.value = 0;
    game.set({ phase: 'playing', worldMode: 'city', settings: { ...game.get().settings, quality: 'high' } } as never);
    runtime.player.x = ray.at.x + 12; runtime.player.z = ray.at.z + 8;
    runtime.guide.x = runtime.player.x + 1; runtime.guide.z = runtime.player.z;
    U.uCam.value.set(ray.at.x + 10, heightAt(ray.at.x, ray.at.z) + 8, ray.at.z + 18);
    const life = new CityLife({ visible: () => true });
    life.start(net);
    let closest = Infinity, samples = 0;
    try {
      for (let i = 0; i < 30 * 60; i++) {
        life.update(DT);
        if (i < 30 * 4) continue;
        for (const w of life.crowd!.sim.walkers) {
          if (!w.on) continue;
          const d = Math.hypot(w.x - ray.at.x, w.z - ray.at.z);
          if (d < 5) samples++;
          closest = Math.min(closest, d);
        }
      }
    } finally { life.dispose(); U.uCam.value.copy(prevCam); U.uNight.value = night; game.set({ phase: 'title', worldMode: 'district' } as never); }
    assert.ok(samples > 100, `walkers come by Ray (${samples} samples within 5 u)`);
    assert.ok(closest >= 0.6, `closest walker ${closest.toFixed(2)} u from Ray`);
  });
});

test('W5-T5 Metro rows on a phone: every Metro station offers the M to Stonestown and SF State (and the N to Ocean Beach where it runs) within its 6 rows', () => {
  T.setTransitW4(W4); T.setTransitData(DATA);
  const fleet = makeFleet();
  const device = runtime.input.device;
  try {
    runtime.input.device = 'touch';
    for (const station of ['muni-embarcadero', 'muni-montgomery', 'muni-powell', 'muni-civic-center', 'muni-van-ness', 'muni-church', 'muni-castro', 'muni-west-portal']) {
      const rows = LR.stationChoices(station).filter(c => c.kind === 'ride');
      const to = rows.map(r => r.to);
      assert.ok(rows.length <= 6, `${station}: ${rows.length} rows`);
      assert.ok(to.includes('muni-19th-winston') && to.includes('muni-19th-holloway'), `${station}: the M to Stonestown and SF State (${to.join(', ')})`);
      if (LR.stationLines(station).some(l => l.id === 'n-judah')) assert.ok(to.includes('muni-judah-la-playa'), `${station}: the N to Ocean Beach`);
      assert.equal(rows[0].rank, 0, `${station}: a next stop first`);
    }
    // the station card (lane N's StationPanel) lists the same rides
    const card = LR.stationRides('muni-powell').map(r => r.to);
    assert.ok(card.includes('muni-19th-winston') && card.includes('muni-19th-holloway'));
  } finally { runtime.input.device = device; T.setActiveLineFleet(null); fleet.dispose(); }
});

test('W5-T6 audio hooks internals: clean options, per-sound and shared rate limits, a throwing recipe switched off, setLoop before registerLoop, at most MAX_LOOPS built, duck capped', async () => {
  const ah = await import('../src/opus-bay/audio/hooks');
  const ducks: [string, number, number][] = [];
  const ctx = { state: 'running', currentTime: 40 };
  const bus = (name: string) => ({ duck: (a: number, until: number) => { ducks.push([name, a, until]); } });
  const engine = { ctx, get now() { return ctx.currentTime; }, buses: { music: bus('music'), ambience: bus('ambience'), sfx: bus('sfx'), voice: bus('voice') } } as unknown as import('../src/opus-bay/audio/engine').AudioEngine;
  ah.bindAudioHooks(engine, () => true);
  const got: unknown[] = [];
  const offs = [ah.registerSound('t6-chime', (_e, o) => { got.push(o); })];
  try {
    // options: only the given keys, finite and clamped
    ah.playSound('t6-chime', { gain: 5, pan: -3, pitch: Number.NaN });
    ah.playSound('t6-chime');
    assert.deepEqual(got, [{ gain: 2, pan: -1 }, undefined]);
    // a runaway caller: one id plays at most SOUND_BURST at once, then SOUND_RATE a second
    got.length = 0;
    const before = ah.audioHooksStats().throttled;
    for (let i = 0; i < 60; i++) ah.playSound('t6-chime');
    assert.ok(got.length <= ah.SOUND_BURST, `${got.length} plays in one instant`);
    assert.ok(ah.audioHooksStats().throttled - before >= 60 - ah.SOUND_BURST);
    await sleep(260);
    got.length = 0;
    for (let i = 0; i < 60; i++) ah.playSound('t6-chime');
    assert.ok(got.length >= 3 && got.length <= ah.SOUND_BURST, `refilled at ${ah.SOUND_RATE} a second: ${got.length} after 0.26 s`);
    // many ids together share ALL_BURST
    await sleep(1100);
    const many: number[] = [];
    for (let k = 0; k < 40; k++) offs.push(ah.registerSound(`t6-many-${k}`, () => { many.push(k); }));
    for (let k = 0; k < 40; k++) ah.playSound(`t6-many-${k}`);
    assert.ok(many.length <= ah.ALL_BURST, `${many.length} different sounds in one instant`);
    // a recipe that keeps throwing is switched off after RECIPE_STRIKES (until registered again)
    await sleep(500);
    let calls = 0;
    const error = console.error;
    console.error = () => {};
    try {
      offs.push(ah.registerSound('t6-bad', () => { calls++; throw new Error('bad recipe'); }));
      for (let i = 0; i < 5; i++) { await sleep(80); ah.playSound('t6-bad'); }
    } finally { console.error = error; }
    assert.equal(calls, ah.RECIPE_STRIKES);
    assert.ok(ah.audioHooksStats().off.includes('t6-bad'));
    offs.push(ah.registerSound('t6-bad', () => { calls++; }));
    ah.playSound('t6-bad');
    assert.equal(calls, ah.RECIPE_STRIKES + 1, 'registered again: plays');
    // setLoop before registerLoop is remembered
    ah.setLoop('t6-early', 0.8, 0);
    assert.ok(ah.audioHooksStats().pending.includes('t6-early'));
    const built: string[] = [];
    const loop = (id: string) => ah.registerLoop(id, () => { built.push(id); return { setGain: () => {}, stop: () => { built.push(`-${id}`); } }; });
    const loopOffs = [loop('t6-early')];
    ah.stepAudioHooks(0.1);
    assert.deepEqual(built, ['t6-early'], 'built at the remembered target');
    // at most MAX_LOOPS at once: the loudest first, the others wait for a place
    for (let k = 0; k < 8; k++) { loopOffs.push(loop(`t6-loop-${k}`)); ah.setLoop(`t6-loop-${k}`, 0.1 + k * 0.1, 0); }
    ah.stepAudioHooks(0.1);
    const st = ah.audioHooksStats();
    assert.equal(st.running.length, ah.MAX_LOOPS);
    assert.ok(st.running.includes('t6-loop-7') && st.running.includes('t6-loop-6') && !st.running.includes('t6-loop-0'), `the loudest run: ${st.running.join(', ')}`);
    assert.ok(st.waiting.includes('t6-loop-0'));
    const waitingBefore = st.waiting.length;
    ah.setLoop('t6-loop-7', 0, 0);
    ah.stepAudioHooks(0.1);
    ah.stepAudioHooks(0.1);
    const after = ah.audioHooksStats();
    assert.equal(after.running.length, ah.MAX_LOOPS, 'the freed place is taken');
    assert.equal(after.waiting.length, waitingBefore - 1);
    for (const off of loopOffs) off();
    // duck: capped at MAX_DUCK_MS
    ah.duck('ambience', 0.5, 10 * 60_000);
    assert.deepEqual(ducks.at(-1), ['ambience', 0.5, 40 + ah.MAX_DUCK_MS / 1000]);
  } finally { for (const off of offs) off(); ah.bindAudioHooks(null); }
});

test('W5-T6 a bus keeps several ducks: the lowest in force applies and each ends on its own (a short deep duck no longer outlasts itself)', async () => {
  const { Bus } = await import('../src/opus-bay/audio/engine');
  const gain = () => ({ gain: { value: 1, cancelScheduledValues: () => {}, setTargetAtTime: () => {} }, connect: (n: unknown) => n });
  const ctx = { currentTime: 0, createGain: gain };
  const node = { connect: (n: unknown) => n };
  const b = new Bus(ctx as never, node as never, node as never, 0.26);
  b.duck(0.45, 12);   // a slow look (12 s)
  b.duck(0.2, 3);     // a jet roar (3 s)
  assert.deepEqual(b.ducking, { amount: 0.2, count: 2 });
  b.update(2);
  assert.equal(b.ducking.amount, 0.2);
  b.update(3.5);
  assert.deepEqual(b.ducking, { amount: 0.45, count: 1 }, 'the roar ended: back to the slow look level, not held at 0.2');
  b.duck(0.45, 14);
  assert.equal(b.ducking.count, 1, 'the same amount extends its duck');
  b.update(14.5);
  assert.deepEqual(b.ducking, { amount: 1, count: 0 });
  for (let i = 0; i < 20; i++) b.duck(0.5 + i * 0.01, 20 + i);
  assert.ok(b.ducking.count <= 8, 'a bounded list');
  b.update(19.9);
  assert.ok(Math.abs(b.ducking.amount - (0.5 + 12 * 0.01)) < 1e-9, 'the ones ending first made room');
});

// ---------------------------------------------------------------------------
// Part c · the mid-wave checkpoint's CP-3 (stops you can walk away from) and CP-11 (the bus at the cable-car boxes, the
// rider who just got off)
// ---------------------------------------------------------------------------

const PUB_TRANSIT = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1/transit.json'), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson & { props: Record<string, [number, number]> };

test('W5-T part c (CP-11) the loop and the cable cars for an hour: no bus stands > 15 s at a box (it was 23–46 s at California & Drumm and at the Hyde St turntable), no car stands > 40 s, nothing overlaps', async () => {
  const { busInterlocks } = await import('../src/opus-bay/world/sf/lineFleet');
  const { interlockLines, boxBlocked } = await import('../src/opus-bay/world/sf/lineInterlocks');
  const W4 = T.buildTransitW4(PUB_TRANSIT)!;
  const data = T.buildTransit(PUB_TRANSIT);
  T.setTransitW4(W4);
  T.setTransitData(data);
  const sys = new CableSystem(data, {});
  const fleet = new LineFleet({ loop: W4.loop, metro: W4.metro, props: W4.props }, {
    boxes: bt => busInterlocks(bt, interlockLines(data, null), (line, b0, b1) => boxBlocked(sys, null, line, b0, b1)),
    emitEvents: false,
  });
  T.setActiveLineFleet(fleet);
  try {
    const bus = fleet.bus;
    assert.ok(bus.boxes.some(b => b.id.startsWith('california@')) && bus.boxes.some(b => b.other?.line === 'powell-hyde' && b.a0 < 600), 'the California St and Hyde St boxes');
    const DT = 1 / 20, held = new Map<number, number>();
    let worstHold = 0, worstCar = 0, bad: string[] = [];
    for (let t = 0; t < 3600; t += DT) {
      sys.step(DT);
      bus.step(DT);
      for (const b of bus.buses) {
        const h = b.why === 'box' && b.v < 0.3 ? (held.get(b.index) ?? 0) + DT : 0;
        held.set(b.index, h);
        worstHold = Math.max(worstHold, h);
      }
      for (const c of sys.cars) worstCar = Math.max(worstCar, c.still);
      const v = [...sys.violations(), ...bus.violations()];
      if (v.length) bad = v;
    }
    assert.ok(worstHold <= 15, `longest bus hold at a box ${worstHold.toFixed(1)} s`);
    assert.ok(worstCar <= 40, `longest cable car stand ${worstCar.toFixed(1)} s`);
    assert.deepEqual(bad, []);
  } finally { T.setActiveLineFleet(null); fleet.dispose(); }
});

test('W5-T part c (CP-11) a car outside a box part leaves it to a bus due there; the car carrying the rider never yields; a car inside hurries its stop', () => {
  const data = T.buildTransit(PUB_TRANSIT);
  T.setTransitData(data);
  const sys = new CableSystem(data);
  const car = sys.cars.find(c => c.line.id === 'california' && c.mode === 'dwell')!;
  assert.ok(car);
  let due = true;
  // the part: a stretch of California St ahead of the car, not under it
  const part = car.dir > 0 ? { b0: car.s + 12, b1: car.s + 60 } : { b0: car.s - 60, b1: car.s - 12 };
  const fake = { bus: { boxes: [{ id: 'california@t', a0: 0, a1: 1, blocked: () => false, other: { line: 'california', ...part } }], occupies: () => false, boxDue: () => due } };
  T.setActiveLineFleet(fake as unknown as InstanceType<typeof LineFleet>);
  try {
    const s0 = car.s;
    for (let i = 0; i < 30 * 20; i++) sys.step(1 / 20);
    assert.ok(Math.abs(car.s - s0) < 0.01, 'held at its stop while the bus is due');
    due = false;
    for (let i = 0; i < 30 * 20; i++) sys.step(1 / 20);
    assert.ok(Math.abs(car.s - s0) > 1, 'goes once the bus has passed');
    // a car standing inside the part while the bus waits: its stop is cut to a second
    const inPart = sys.cars.find(c => c.line.id === 'california' && c !== car)!;
    fake.bus.boxes[0].other = { line: 'california', b0: inPart.s - 10, b1: inPart.s + 10 };
    due = true;
    inPart.mode = 'dwell'; inPart.v = 0; inPart.timer = 4;
    sys.step(1 / 20);
    assert.ok(inPart.timer <= 1, `the stop in the part is hurried (${inPart.timer.toFixed(2)} s left)`);
    inPart.rider = true; inPart.timer = 4;
    sys.step(1 / 20);
    assert.ok(inPart.timer > 3, 'not with the rider aboard');
    inPart.rider = false;
  } finally { T.setActiveLineFleet(null); }
});

test('W5-T part c (CP-11) off at a loop stop: the rider stands by the pole, clear of the bus path; a bus is held only by someone on its path ahead, measured along the bend', async () => {
  const { clearOfPath, PATH_CLEAR } = await import('../src/opus-bay/game/lineRides');
  const W4 = T.buildTransitW4(PUB_TRANSIT)!;
  const path3 = W4.loop.path;
  const toPath = (x: number, z: number) => {
    let d = Infinity;
    for (let i = 3; i + 2 < path3.length; i += 3) {
      const ax = path3[i - 3], az = path3[i - 1], dx = path3[i] - ax, dz = path3[i + 2] - az, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
    return d;
  };
  for (const s of W4.loop.stops) {
    const p = W4.props[s.id], q = clearOfPath(path3, { x: p[0], z: p[1] });
    assert.ok(Math.hypot(q.x - p[0], q.z - p[1]) <= 2.5, `${s.id}: by its pole`);
    // a pole already clear of the path is where the rider stands
    if (toPath(p[0], p[1]) >= PATH_CLEAR) assert.deepEqual(q, { x: p[0], z: p[1] }, s.id);
  }
  // the bus's "someone ahead" follows the track: the Golden Gate Bridge stop, the rider at the pole beside the bend
  const ggb = W4.loop.stops.find(s => s.id === 'loop-golden-gate-bridge')!;
  const pole = W4.props[ggb.id];
  let viewer = { x: pole[0], z: pole[1], onFoot: true };
  const sys = new BusSystem(busTrack(W4.loop as never), { viewer: () => viewer } as never);
  const b = sys.buses[0];
  for (const o of sys.buses) if (o !== b) o.s = (ggb.at + 2000) % sys.track.length;
  b.s = ggb.at - 3; b.mode = 'run'; b.v = 0; b.next = (sys.stopIndex(ggb.id) + 1) % W4.loop.stops.length;
  sys.updatePose(b);
  let personT = 0;
  for (let k = 0; k < 20 * 30; k++) { sys.step(1 / 30); if (b.why === 'person') personT += 1 / 30; }
  assert.ok(personT < 1, `held ${personT.toFixed(1)} s by the rider standing at the pole`);
  // someone on the road ahead does hold it
  const LT = await import('../src/opus-bay/world/lineTrack');
  const ahead = LT.trackPoint(sys.track, b.s + BUS.length / 2 + 8);
  viewer = { x: ahead.x, z: ahead.z, onFoot: true };
  personT = 0;
  for (let k = 0; k < 5 * 30; k++) { sys.step(1 / 30); if (b.why === 'person') personT += 1 / 30; }
  assert.ok(personT > 3, 'someone standing on its path ahead');
});

test('W5-T part c (CP-3) every loop / Metro pole and kiosk: reached from the streets, and the real controller walks off 3 u in 3 of 4 directions (the sweep rule; four named corridors: 2 ways); the Sausalito quay is not a place anyone lands', async () => {
  const sidecar = await import('../scripts/opus-sf/transit-sidecar');
  const W4 = T.buildTransitW4(PUB_TRANSIT)!;
  const ids = new Map<string, { x: number; z: number }>();
  for (const l of W4.lines) for (const s of l.stops) if (!ids.has(s.id)) ids.set(s.id, { x: W4.props[s.id][0], z: W4.props[s.id][1] });
  // (the two hero stops keep their promenade-kerb poles on the district slab)
  ids.delete('loop-ferry-building'); ids.delete('loop-pier-39');
  const CORRIDORS = new Set(['loop-haight-ashbury', 'loop-castro', 'muni-church', 'muni-castro']);
  const { judge } = await sidecar.openJudge([...ids.values()]);
  const px = runtime.player.x, pz = runtime.player.z;
  try {
    const bad: string[] = [];
    for (const [id, p] of ids) {
      const j = judge(p.x, p.z);
      const moving = j.moves.filter(m => m >= 3).length;
      if (j.reach === null || j.reach > 1.1 || moving < (CORRIDORS.has(id) ? 2 : 3)) bad.push(`${id} reach ${j.reach} moves ${j.moves.join('/')}`);
    }
    assert.deepEqual(bad, []);
  } finally { setCityTerrain(null); runtime.player.x = px; runtime.player.z = pz; }
  // the Sausalito boat is data only (running: false): no terminal, no prompt, no trip ends on its quay
  const ferry = await import('../src/opus-bay/data/ferry');
  assert.equal(ferry.ferryTerminal('sausalito'), null);
  assert.equal(ferry.FERRY_ROUTES.find(r => r.id === 'ferry-sausalito')?.running, false);
});

// ---------------------------------------------------------------------------
// W5-T7 (should): honest service rows, the barn after the real hours, the plaza pigeons
// ---------------------------------------------------------------------------

test('W5-T7 service rows: every real line carries its SFMTA route page and the date it was read; hours by the Bay clock; zh short', async () => {
  const { LINE_SERVICE, serviceRow } = await import('../src/opus-bay/data/sf/serviceHours');
  for (const [id, s] of Object.entries(LINE_SERVICE)) {
    assert.equal(s.line, id);
    assert.match(s.sourceUrl, /^https:\/\/www\.sfmta\.com\/routes\/[a-z-]+$/, id);
    assert.match(s.verifiedAt, /^2026-\d\d-\d\d$/, id);
    const r = serviceRow(id, { hour: 12, minute: 0 })!;
    assert.ok(r.running, `${id} runs at noon`);
    assert.ok([...r.text.zh].length <= 45 && [...r.state.zh].length <= 8, `${id}: ${r.text.zh}`);
  }
  assert.equal(serviceRow('sf-loop', { hour: 12, minute: 0 }), null, 'the game\'s own loop: no real row');
  const at = (h: number, m = 0) => Object.fromEntries(Object.keys(LINE_SERVICE).map(id => [id, serviceRow(id, { hour: h, minute: m })!.running]));
  // SFMTA route pages (2026-09-28): PH / PM 7 a.m.–11 p.m., California 7 a.m.–9 p.m., F 7 a.m.–12 a.m., M 6 a.m.–12 a.m., N 24 hours
  assert.deepEqual(at(22, 30), { 'powell-hyde': true, 'powell-mason': true, california: false, 'f-line': true, 'n-judah': true, 'm-ocean-view': true });
  assert.deepEqual(at(23, 5), { 'powell-hyde': false, 'powell-mason': false, california: false, 'f-line': true, 'n-judah': true, 'm-ocean-view': true });
  assert.deepEqual(at(5, 30), { 'powell-hyde': false, 'powell-mason': false, california: false, 'f-line': false, 'n-judah': true, 'm-ocean-view': false });
  assert.deepEqual(at(7, 0), { 'powell-hyde': true, 'powell-mason': true, california: true, 'f-line': true, 'n-judah': true, 'm-ocean-view': true });
  assert.equal(serviceRow('powell-hyde', { hour: 9, minute: 0 })!.text.zh, '海德线 7:00–23:00 · 约9–10分钟一班');
  // the station card renders them (the loop's stop has none)
  const { ServiceRows } = await import('../src/opus-bay/ui/serviceRows');
  const html = renderToStaticMarkup(h(ServiceRows, { lines: ['sf-loop', 'powell-hyde', 'california'] }));
  assert.ok(html.includes('ob-svc') && html.includes('SFMTA') && (html.match(/<li/g) ?? []).length === 2, html);
  assert.equal(renderToStaticMarkup(h(ServiceRows, { lines: ['sf-loop'] })), '');
});

test('W5-T7 the barn: after the real hours each line keeps one car out and the idle ones go in unseen; a rider brings them out; at 7:00 they are all back', () => {
  const data = T.buildTransit(PUB_TRANSIT);
  T.setTransitData(data);
  let open = false;
  const sys = new CableSystem(data, { realService: () => open });
  const DT = 1 / 20, run = (secs: number) => { for (let t = 0; t < secs; t += DT) sys.step(DT); };
  run(600);
  for (const l of data.lines) {
    const out = sys.cars.filter(c => c.line === l && !c.parked);
    assert.equal(out.length, 1, `${l.id}: one car out after hours`);
  }
  assert.equal(sys.parkedCars(), sys.cars.length - data.lines.length);
  assert.deepEqual(sys.violations(), []);
  const parked = sys.cars.find(c => c.parked)!;
  const s0 = parked.s;
  run(60);
  assert.equal(parked.s, s0, 'a parked car stays in the barn');
  assert.equal(sys.eta(parked, 0, 1), Infinity);
  // a rider on that line: the barn car comes out if its stretch is free, and the ride is served
  const line = parked.line, stop = line.stops.find(st => !st.terminus)!;
  const req = sys.request({ line: line.id, station: stop.station, dir: 1, to: line.stops[line.stops.length - 1].station });
  assert.ok(req, 'a ride is available after hours');
  assert.ok(sys.cars.filter(c => c.line === line && !c.parked).length >= 1);
  sys.cancel();
  // 7:00: everyone out again (unseen, stretch free)
  open = true;
  run(120);
  assert.equal(sys.parkedCars(), 0);
  run(300);
  assert.deepEqual(sys.violations(), []);
});

test('W5-T7 plaza pigeons: in city mode the flock flies to the plaza nearest the player (≤ 120 u; lands, 0 new meshes), not while you watch; district mode keeps it home', async () => {
  const { PIGEON_PLAZAS } = await import('../src/opus-bay/world/life');
  const union = PIGEON_PLAZAS.find(p => p.id === 'union-square')!;
  const prevCam = U.uCam.value.clone();
  game.set({ phase: 'free' } as never);
  try {
    await withCity(union, 60, () => {
      const life = new Life([]);
      life.heroFarSource = () => false;
      const meshes = (() => { let n = 0; life.group.traverse(o => { if ((o as import('three').Mesh).isMesh) n++; }); return n; })();
      const gulls = (life as unknown as { gulls: { pigeon?: boolean; mode: string; perch?: { x: number; z: number }; x: number; z: number }[] }).gulls;
      const flock = gulls.filter(g => g.pigeon);
      assert.ok(flock.length >= 6, `${flock.length} pigeons`);
      // district mode: never moves
      life.cullFar = () => false;
      assert.equal(life.movePigeons(3, union.x, union.z, { x: union.x + 80, z: union.z }), false);
      life.cullFar = () => true;
      // the camera right on the plaza: they do not pop in under your eyes
      assert.equal(life.movePigeons(3, union.x, union.z, { x: union.x + 10, z: union.z }), false);
      // from 70 u off: they fly in and land round the plaza
      assert.equal(life.movePigeons(3, union.x, union.z, { x: union.x + 70, z: union.z }), true);
      assert.equal(life.pigeonAt, 'union-square');
      for (const g of flock) { assert.ok(Math.hypot(g.perch!.x - union.x, g.perch!.z - union.z) < 4.5, 'perched round the plaza'); assert.equal(g.mode, 'return'); }
      U.uCam.value.set(union.x + 70, 20, union.z);
      runtime.player.x = union.x + 60; runtime.player.z = union.z;
      for (let i = 0; i < 60; i++) life.update(0.1, i * 0.1, 0);
      assert.ok(flock.every(g => g.mode === 'perched'), 'landed');
      // run through: they scatter
      runtime.player.x = union.x; runtime.player.z = union.z; runtime.player.running = true;
      life.update(0.1, 7, 0);
      assert.ok(flock.some(g => g.mode === 'flee'), 'scatter when you run through');
      runtime.player.running = false;
      assert.equal((() => { let n = 0; life.group.traverse(o => { if ((o as import('three').Mesh).isMesh) n++; }); return n; })(), meshes, 'no new mesh');
      // far from every plaza (> 120 u): the flock stays where it is
      assert.equal(life.movePigeons(3, union.x + 400, union.z + 400, { x: union.x + 470, z: union.z + 400 }), false);
      life.dispose();
    });
  } finally { U.uCam.value.copy(prevCam); game.set({ phase: 'title' } as never); runtime.player.running = false; }
});

test('W5-T7 the station rows and lane R\'s 现实中怎么去 rows read the same SFMTA pages: same hours, same sources (two copies may not drift)', async () => {
  const { LINE_SERVICE } = await import('../src/opus-bay/data/sf/serviceHours');
  const { REAL_LINES } = await import('../src/opus-bay/realsf/transitReal');
  for (const [id, s] of Object.entries(LINE_SERVICE)) {
    const r = REAL_LINES[id];
    assert.ok(r, `${id} in both`);
    assert.deepEqual(s.span ? [...s.span] : null, r.hours ? [...r.hours] : null, `${id} hours`);
    assert.equal(s.sourceUrl, r.sourceUrl, `${id} source`);
  }
});
