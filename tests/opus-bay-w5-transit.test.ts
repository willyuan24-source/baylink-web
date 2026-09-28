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
