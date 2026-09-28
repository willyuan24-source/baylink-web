import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 4 · lane T, integration part b: the wave-4 verify findings on lane T's files, driven in node as the world runs them.
 *   D3  a cable car pulls in to its stop past someone standing beyond its nose; someone on the stop itself still holds it,
 *       and after a few seconds BAYBAY asks them to step aside; a station's prompt stands beside the track, not on it
 *   M2  直接到站 to a stop that has not streamed in waits under the veil and puts the rider at the stop (never mid-route
 *       with "到站" said)
 *   D11 / m5  the ferry offer counts the wait for the boat
 *   m6  the crowd never spawns a sightseer on the player; a sightseer the player walks up to shuffles out of the way
 *   F4  the obstacle / road-vehicle sources reuse their records
 */

// --- headless canvas / DOM stubs (world modules create label atlases at import time; the veil is one DOM element)
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
const veils: { removed: boolean }[] = [];
const fakeEl = () => {
  const el = { width: 0, height: 0, style: {} as Record<string, string>, textContent: '', removed: false, getContext: () => ctx2d, setAttribute: noop, appendChild: noop, remove() { el.removed = true; } };
  return el;
};
g.window ??= globalThis;
g.document ??= { createElement: fakeEl };
const doc = g.document as Record<string, unknown>;
doc.querySelector ??= () => null;
doc.body ??= { appendChild: (el: { removed: boolean }) => { veils.push(el); } };
g.requestAnimationFrame ??= (fn: () => void) => setTimeout(fn, 0);

const T = await import('../src/opus-bay/data/transit');
const { CableSystem } = await import('../src/opus-bay/world/transitLine');
const { FerrySystem } = await import('../src/opus-bay/world/ferry');
const { game } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { flow } = await import('../src/opus-bay/game/flowStore');
const flowMod = await import('../src/opus-bay/game/flow');
const transit = await import('../src/opus-bay/game/transit');
const ride = await import('../src/opus-bay/game/ride');
const { sfDisk } = await import('./opus-bay-sf-disk');
const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
const { canStand, setCityTerrain, heightAt, surfaceAt, cityChunkEpoch } = await import('../src/opus-bay/core/terrain');
const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
const { CrowdSim, CLEAR_OF_PEOPLE } = await import('../src/opus-bay/world/sf/crowd');
const { StreetNet } = await import('../src/opus-bay/world/sf/streetNet');
const { TrafficSim } = await import('../src/opus-bay/world/sf/traffic');
const { RecordPool } = await import('../src/opus-bay/world/sf/recordPool');
type StreetProbe = import('../src/opus-bay/world/sf/streetNet').StreetProbe;

const PUB = path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1');
const FILE = JSON.parse(fs.readFileSync(path.join(PUB, 'transit.json'), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson;
const DATA = T.buildTransit(FILE);
const DT = 1 / 30;
const sf = sfDisk();
const LMS = landmarkWalkInputs(SF_LANDMARKS);

async function withCityAround(points: { x: number; z: number }[], r: number, fn: () => void | Promise<void>) {
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  for (const p of points) await sf.attachAround(city, p.x, p.z, r, LMS);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try { await fn(); } finally { setCityTerrain(null); }
}

/** A Powell–Hyde car coming in to the Powell & Market turntable (s → 0) from 40 u out; the line's other car parked far off. */
function inbound(viewer: { x: number; z: number; onFoot: boolean }) {
  const sys = new CableSystem(DATA, { viewer: () => viewer });
  const line = DATA.lines.find(l => l.id === 'powell-hyde')!;
  const cars = sys.cars.filter(c => c.line === line);
  for (const c of sys.cars) if (c !== cars[1]) { c.mode = 'dwell'; c.timer = 1e6; c.s = c.line === line ? 300 : c.s; c.station = null; }
  const car = cars[1];
  Object.assign(car, { s: 40, dir: -1, mode: 'run', v: 0, timer: 0, turned: false, station: null, authority: 0, authStation: 'powell-market' });
  sys.updatePose(car);
  // the approach: the car's nose points toward the disc centre; `past(d)` is d u beyond the resting car's nose
  const c = T.pointAt(line, 0), q = T.pointAt(line, 3);
  const fx = (c.x - q.x) / 3, fz = (c.z - q.z) / 3;
  const past = (d: number) => ({ x: c.x + fx * (T.CABLE.length / 2 + d), z: c.z + fz * (T.CABLE.length / 2 + d) });
  return { sys, car, past, centre: c };
}

test('verify D3: a cable car pulls in to the Powell & Market turntable past someone 2.8 u beyond its nose (it used to stand 0.4 u short for good)', () => {
  const viewer = { x: 0, z: 0, onFoot: true };
  const { sys, car, past } = inbound(viewer);
  Object.assign(viewer, past(2.8));
  let arrived = false;
  for (let i = 0; i < 30 * 30 && !arrived; i++) { sys.step(DT); if (car.station === 'powell-market' && car.s < 0.05) arrived = true; }
  assert.ok(arrived, `the car reached its stop (s ${car.s.toFixed(2)}, mode ${car.mode})`);
  assert.ok(T.PERSON_CLEAR > 0 && T.PERSON_CLEAR < 2.8);
  // it turns on the disc and leaves the other way (the person stays clear of the turning body)
  let turned = false;
  for (let i = 0; i < 30 * 30 && !turned; i++) { sys.step(DT); if (car.dir === 1 && car.mode !== 'turn') turned = true; }
  assert.ok(turned, 'turned on the turntable');
});

test('verify D3: someone on the stop itself still holds the car (it never runs into them), and after a few seconds BAYBAY asks them to step aside', () => {
  const viewer = { x: 0, z: 0, onFoot: true };
  const { sys, car, past } = inbound(viewer);
  Object.assign(viewer, past(-2.0)); // inside the resting body
  T.setTransitData(DATA);
  T.setActiveCableSystem(sys);
  const prev = game.get();
  try {
    game.set({ phase: 'playing', worldMode: 'city', move: { mode: 'foot' } } as never);
    runtime.player.x = viewer.x; runtime.player.z = viewer.z;
    flow.set({ bubble: null });
    let asked = -1;
    for (let i = 0; i < 30 * 25; i++) {
      sys.step(DT);
      transit.stepTransit(DT);
      if (asked < 0 && flow.get().bubble) asked = i * DT;
    }
    assert.ok(car.s > 2, `the car stands short of the person (s ${car.s.toFixed(2)})`);
    assert.ok(Math.abs(car.v) < 0.05, 'standing');
    assert.ok(sys.viewerHeld() >= transit.STEP_ASIDE_AFTER, `held ${sys.viewerHeld().toFixed(1)} s`);
    assert.ok(asked >= transit.STEP_ASIDE_AFTER && asked < 25, `BAYBAY asked after ${asked.toFixed(1)} s`);
    assert.match(flow.get().bubble!.text.zh, /让路/);
    // the person steps aside: the car pulls in
    viewer.x += 6; viewer.z -= 6;
    let arrived = false;
    for (let i = 0; i < 30 * 20 && !arrived; i++) { sys.step(DT); if (car.station === 'powell-market') arrived = true; }
    assert.ok(arrived, 'in once the way is clear');
    assert.equal(sys.viewerHeld(), 0);
  } finally {
    T.setActiveCableSystem(null);
    game.set({ phase: prev.phase, worldMode: prev.worldMode, move: prev.move } as never);
    flow.set({ bubble: null });
  }
});

test('verify D3: every cable-car station\'s prompt stands beside the track on walkable ground (a terminus: clear of the turning car)', async () => {
  const stations = DATA.stations;
  assert.equal(stations.length, 56);
  T.setTransitData(DATA);
  await withCityAround(stations, 20, () => {
    const prev = game.get();
    game.set({ worldMode: 'city' } as never);
    try {
      const items = transit.transitInteractables();
      for (const st of stations) {
        const it = items.find(i => i.id === `transit-${st.id}`)!;
        assert.ok(it, st.id);
        const off = Math.min(...st.lines.map(e => T.nearestAt(DATA.lines.find(l => l.id === e.line)!, it.x, it.z).d));
        const tt = DATA.turntables.find(t => Math.hypot(t.x - st.x, t.z - st.z) < 6);
        assert.ok(canStand(it.x, it.z, 0.45), `${st.id}: the prompt is on walkable ground`);
        assert.ok(off >= 2.45, `${st.id}: ${off.toFixed(2)} u off the track (a passing car's body reaches 2.05 u)`);
        if (tt) assert.ok(Math.hypot(it.x - tt.x, it.z - tt.z) >= 5, `${st.id}: clear of the turntable`);
        assert.ok(Math.hypot(it.x - st.x, it.z - st.z) <= 5.6 + (tt ? 5 : 0), `${st.id}: still at the station`);
      }
    } finally { game.set({ worldMode: prev.worldMode } as never); }
  });
});

test('verify M2: 直接到站 on a cable car to a stop that has not streamed in goes under the veil and ends at the stop, "到站" said once the rider is there', async () => {
  const sys = new CableSystem(DATA);
  T.setTransitData(DATA);
  T.setActiveCableSystem(sys);
  await transit.loadLineRides();
  const pm = DATA.stations.find(s => s.id === 'powell-market')!, dest = DATA.stations.find(s => s.id === 'hyde-beach')!;
  const prev = game.get();
  await withCityAround([pm], 60, async () => {
    try {
      game.set({ phase: 'playing', worldMode: 'city', toasts: [] } as never);
      runtime.player.x = pm.x + 3; runtime.player.z = pm.z;
      assert.ok(transit.skipNeedsVeil(dest, 250), 'Hyde & Beach is far and not streamed in');
      assert.ok(!transit.skipNeedsVeil({ x: pm.x + 3, z: pm.z }, 250), 'a streamed-in stop close by needs no veil');
      transit.rideCable('powell-hyde', 'powell-market', 'hyde-beach');
      const step = (n: number, until?: () => boolean) => { for (let i = 0; i < n; i++) { sys.step(DT); transit.stepTransit(DT); if (until?.()) return true; } return false; };
      assert.ok(step(30 * 60, () => ride.currentRide()?.mode === 'follow'), 'boarded');
      step(30 * 4);
      const before = veils.length;
      transit.finishRide();
      assert.ok(ride.currentRide(), 'the ride goes on under the veil while the stop streams in');
      assert.equal(veils.length, before + 1, 'one veil');
      transit.finishRide();
      assert.equal(veils.length, before + 1, 'a second tap starts no second veil');
      assert.ok(!game.get().toasts.some(t => /Hyde & Beach|到站/.test(t.text)), 'nothing announced yet');
      await new Promise(r => setTimeout(r, 500));
      assert.equal(ride.currentRide(), null, 'the ride ended under the veil');
      // at the stop: its prompt beside the track once that ground is known (never on the rails), else the station point
      const p = runtime.player, at = transit.stationBoardSpot(dest);
      assert.ok(Math.hypot(p.x - at.x, p.z - at.z) < 1.5 && Math.hypot(p.x - dest.x, p.z - dest.z) < 8, `at Hyde & Beach (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
      assert.ok(game.get().toasts.some(t => /Hyde & Beach/.test(t.text)), 'arrival announced');
      assert.equal(game.get().move.mode, 'foot');
    } finally {
      ride.endRide(); sys.cancel();
      T.setActiveCableSystem(null);
      game.set({ phase: prev.phase, worldMode: prev.worldMode, move: prev.move, toasts: [] } as never);
      flow.set({ ride: null });
    }
  });
});

test('verify D11 / m5: the ferry offer counts the wait for the boat (boat at Gate E, rider at Pier 41)', () => {
  const sys = new FerrySystem(T.buildFerryLine(T.FERRY_ROUTES.find(r => r.running)!));
  T.setActiveFerrySystem(sys);
  const prev = game.get();
  try {
    game.set({ phase: 'playing', worldMode: 'city' } as never);
    const wait = transit.ferryWaitSeconds('pier-41');
    assert.ok(wait > 40, `the boat lies at Gate E: ~${wait.toFixed(0)} s to Pier 41`);
    assert.equal(transit.ferryWaitSeconds('ferry-building'), 0, 'lying here: no wait');
    transit.boardFerry('pier-41');
    const node = flowMod.nodeById(game.get().dialogue.nodeId);
    const label = node?.choices?.[0].label;
    assert.ok(label, 'the deckhand offers Gate E');
    const secs = Number(/约 (\d+) 秒，船约 (\d+) 秒后到/.exec(label!.zh)?.[1]);
    assert.ok(secs >= Math.round(wait) + Math.round(transit.ferryRideSeconds('pier-41', 'ferry-building')) - 1, `${label!.zh}`);
    assert.match(label!.en, /boat in ~\d+s/);
    // the estimate holds: request, then time the wait for the boat to board
    transit.rideFerry('pier-41', 'ferry-building');
    let t = 0;
    for (; t < 400 && ride.currentRide()?.mode !== 'follow'; t += DT) { sys.step(DT); transit.stepTransit(DT); }
    assert.ok(Math.abs(t - wait) < Math.max(12, wait * 0.2), `boarded after ${t.toFixed(0)} s (said ~${wait.toFixed(0)})`);
  } finally {
    ride.endRide(); sys.cancel();
    T.setActiveFerrySystem(null);
    flowMod.closeDialogue();
    game.set({ phase: prev.phase, worldMode: prev.worldMode, move: prev.move, dialogue: prev.dialogue } as never);
    flow.set({ ride: null });
  }
});

test('verify m5: while waiting for the ferry, 直接到站 puts the rider on the other quay (the label offers it); it does not count as a ride', async () => {
  const sys = new FerrySystem(T.buildFerryLine(T.FERRY_ROUTES.find(r => r.running)!));
  T.setActiveFerrySystem(sys);
  const prev = game.get();
  try {
    game.set({ phase: 'playing', worldMode: 'city', toasts: [] } as never);
    const q41 = T.ferryTerminal('pier-41')!.terminal.quay, gate = T.ferryTerminal('ferry-building')!.terminal.quay;
    runtime.player.x = q41.x; runtime.player.z = q41.z;
    transit.rideFerry('pier-41', 'ferry-building');
    assert.equal(ride.currentRide()?.mode, 'wait');
    assert.equal(transit.rideLabel(flow.get().ride!).skipWhileWaiting, true);
    transit.finishRide();
    // 350 u away: under the veil first (it waits for that part of the city), then ashore there
    await new Promise(r => setTimeout(r, 500));
    assert.equal(ride.currentRide(), null);
    assert.ok(Math.hypot(runtime.player.x - gate.x, runtime.player.z - gate.z) < 16, `on the Gate E quay (${runtime.player.x.toFixed(1)}, ${runtime.player.z.toFixed(1)})`);
    assert.ok(game.get().toasts.some(t => /Gate E|E 号登船口/.test(t.text)), 'arrival said');
    assert.equal(transit.rideLog().ferry ?? 0, 0, 'not a ride');
    assert.equal(game.get().move.mode, 'foot');
  } finally {
    ride.endRide(); sys.cancel();
    T.setActiveFerrySystem(null);
    game.set({ phase: prev.phase, worldMode: prev.worldMode, move: prev.move, toasts: [] } as never);
    flow.set({ ride: null });
  }
});

test('verify m6: no sightseer spawns on the player (an arrival spot); one the player walks up to shuffles out of the way', async () => {
  const SPOT = { x: 78, z: 222 };
  const probe: StreetProbe = { surface: surfaceAt, stand: canStand, height: heightAt, epoch: (x, z) => cityChunkEpoch(Math.floor(x / 128), Math.floor(z / 128)) };
  await withCityAround([SPOT], 200, async () => {
    const net = new StreetNet(await sf.graphIndex(), probe);
    const player = { x: SPOT.x, z: SPOT.z };
    // plaza spots right on the player, and a few round them (the arrival ring)
    const spots = [0, 1, 2, 3, 4, 5].map(k => ({ x: SPOT.x + (k === 0 ? 0 : Math.cos(k) * 1.2), z: SPOT.z + (k === 0 ? 0 : Math.sin(k) * 1.2), r: 0.6, exact: true }));
    let avoid = [player];
    const crowd = new CrowdSim(net, { focus: () => SPOT, avoid: out => { out.push(...avoid); }, visible: () => false, vehicles: () => [], standSpots: () => spots }, { seed: 5 });
    for (let i = 0; i < 30 * 8; i++) {
      crowd.step(DT);
      for (const w of crowd.walkers) if (w.on && w.mode === 'stand') assert.ok(Math.hypot(w.x - player.x, w.z - player.z) >= CLEAR_OF_PEOPLE - 0.3, 'no sightseer in the arrival ring');
    }
    // a sightseer on a spot 3 u off; the player walks up to 0.4 u from it: it shuffles back to ≥ 1.2 u
    const far = { x: SPOT.x + 3, z: SPOT.z, r: 0.6, exact: true };
    spots.length = 0; spots.push(far);
    avoid = [];
    const crowd2 = new CrowdSim(net, { focus: () => SPOT, avoid: out => { out.push(...avoid); }, visible: () => false, vehicles: () => [], standSpots: () => spots }, { seed: 9 });
    let stander = null as null | (typeof crowd2.walkers)[number];
    for (let i = 0; i < 30 * 8 && !stander; i++) { crowd2.step(DT); stander = crowd2.walkers.find(w => w.on && w.mode === 'stand' && Math.hypot(w.x - far.x, w.z - far.z) < 0.7) ?? null; }
    assert.ok(stander, 'a sightseer on the spot');
    const me = { x: stander!.x - 0.4, z: stander!.z };
    avoid = [me];
    for (let i = 0; i < 30 * 2; i++) crowd2.step(DT);
    assert.ok(Math.hypot(stander!.x - me.x, stander!.z - me.z) >= 1.2, `shuffled to ${Math.hypot(stander!.x - me.x, stander!.z - me.z).toFixed(2)} u`);
  });
});

test('verify F4: the obstacle and road-vehicle sources reuse their records (one pool per consumer array)', async () => {
  const pool = new RecordPool(() => ({ x: 0, z: 0, r: 0, kind: '' }));
  const a: { x: number }[] = [], b: { x: number }[] = [];
  const fill = (out: { x: number }[], n: number) => { out.length = 0; pool.begin(out); for (let i = 0; i < n; i++) { const o = pool.next(); o.x = i; out.push(o); } };
  fill(a, 3);
  const first = a.slice();
  fill(b, 2);
  assert.deepEqual(a.map(o => o.x), [0, 1, 2], 'another consumer does not overwrite this one');
  fill(a, 4);
  assert.ok(first.every((o, i) => a[i] === o), 'the same records next frame');
  // the toy traffic: vehicles() and obstacles() hand out the same objects frame after frame
  const SPOT = { x: 78, z: 222 };
  const probe: StreetProbe = { surface: surfaceAt, stand: canStand, height: heightAt, epoch: (x, z) => cityChunkEpoch(Math.floor(x / 128), Math.floor(z / 128)) };
  await withCityAround([SPOT], 200, async () => {
    const net = new StreetNet(await sf.graphIndex(), probe);
    const sim = new TrafficSim(net, { focus: () => SPOT, visible: () => false, vehicles: () => [], people: () => {} }, { seed: 3 });
    for (let i = 0; i < 30 * 3; i++) sim.step(DT);
    const v: import('../src/opus-bay/world/sf/streetNet').RoadVehicle[] = [];
    v.length = 0; sim.vehicles(v);
    const v1 = v.slice();
    sim.step(DT);
    v.length = 0; sim.vehicles(v);
    assert.ok(v1.length > 5 && v1.every((o, i) => v[i] === o), `${v1.length} cars, the same records`);
    const o: { x: number; z: number; r: number; kind: string }[] = [];
    sim.obstacles(o, SPOT.x, SPOT.z, 200);
    const o1 = o.slice();
    o.length = 0; sim.obstacles(o, SPOT.x, SPOT.z, 200);
    assert.ok(o1.length > 0 && o1.every((q, i) => o[i] === q), 'the same obstacle records');
  });
});
