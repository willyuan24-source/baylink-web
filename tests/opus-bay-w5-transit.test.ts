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
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

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
type TransitLine = import('../src/opus-bay/world/sf/format').TransitLine;
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

test('W5-T1 rideEta on a cable car: the quote × the line still ahead; the turntable beat and a stronger push on it', () => {
  T.setTransitData(DATA);
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
