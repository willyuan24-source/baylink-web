import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * City transit (lane F, wave 2, part a: cable cars): data (lines, stations, turntables), the pure cable-car motion
 * (constant cable, grip / brake, dwell, block signalling, turntables, dispatch, pitch = grade), the platform contract
 * with pitch, and the ride flow (a ride counts only after a real stop-to-stop segment).
 */

// --- headless canvas stub (world modules create label atlases at import time) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const THREE = await import('three');
const T = await import('../src/opus-bay/data/transit');
const { CABLE, RIDE_MIN_ODOMETER, buildTransit, pointAt, stopPos } = T;
const { CableSystem, PUSH_BOOST, setActiveCableSystem } = await import('../src/opus-bay/world/transitLine');
const platform = await import('../src/opus-bay/actors/platform');
const { CABLE_PLATFORM, cableCarGeometry } = await import('../src/opus-bay/world/cablecar');
const { discGeometry } = await import('../src/opus-bay/world/turntable');
const { extraSpans } = await import('../src/opus-bay/world/rails');
const { game } = await import('../src/opus-bay/core/store');
const { onEvent } = await import('../src/opus-bay/core/events');
const { flow } = await import('../src/opus-bay/game/flowStore');
const transit = await import('../src/opus-bay/game/transit');
const ride = await import('../src/opus-bay/game/ride');

const FILE = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1/transit.json'), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson;
const DATA = buildTransit(FILE);
const line = (id: string) => DATA.lines.find(l => l.id === id)!;
const DT = 1 / 30;

test('data: three cable lines with their published lengths, turntable stubs and termini on the discs', () => {
  assert.deepEqual(DATA.lines.map(l => l.id), ['powell-hyde', 'powell-mason', 'california']);
  const want: Record<string, number> = { 'powell-hyde': 456, 'powell-mason': 346, california: 320 };
  for (const l of DATA.lines) {
    assert.ok(Math.abs(l.osmLength - want[l.id]) < 0.6, `${l.id} ${l.osmLength}`);
    // arc table monotone and consistent with the length
    for (let i = 1; i < l.cum.length; i++) assert.ok(l.cum[i] >= l.cum[i - 1]);
    assert.ok(Math.abs(l.cum[l.cum.length - 1] - l.length) < 1e-3);
    assert.equal(l.stops[0].terminus, true);
    assert.equal(l.stops[l.stops.length - 1].terminus, true);
  }
  const stubs = Object.fromEntries(DATA.turntables.map(t => [t.id, t.stub]));
  assert.ok(Math.abs(stubs['powell-market'] - 2.7) < 0.1, `Powell & Market ${stubs['powell-market']}`);
  assert.ok(Math.abs(stubs['hyde-beach'] - 11.7) < 0.1, `Hyde & Beach ${stubs['hyde-beach']}`);
  assert.ok(Math.abs(stubs['taylor-bay'] - 5.6) < 0.1, `Taylor & Bay ${stubs['taylor-bay']}`);
  assert.deepEqual(DATA.turntables.find(t => t.id === 'powell-market')!.lines.sort(), ['powell-hyde', 'powell-mason']);
  assert.equal(DATA.turntables.find(t => t.id === 'powell-market')!.landmark, true, 'D2 draws the static disc there');
  // the turntable lines start / end on the disc centre; California is double-ended without one
  const ph = line('powell-hyde');
  const start = pointAt(ph, 0), end = pointAt(ph, ph.length);
  assert.ok(Math.hypot(start.x - 130.44, start.z - 257.57) < 0.05 && Math.hypot(end.x + 233.95, end.z - 137.45) < 0.05);
  assert.equal(line('california').doubleEnded, true);
  assert.equal(line('california').turntableStart, null);
  assert.equal(line('california').turntableEnd, null);
});

test('data: stops merge into stations (ids [a-z0-9-], shared Powell & Market, a three-line Powell & California)', () => {
  const ids = new Set<string>();
  for (const st of DATA.stations) {
    assert.match(st.id, /^[a-z0-9-]{1,64}$/);
    assert.ok(!ids.has(st.id), `unique ${st.id}`);
    ids.add(st.id);
  }
  for (let i = 0; i < DATA.stations.length; i++) for (let j = i + 1; j < DATA.stations.length; j++) {
    const a = DATA.stations[i], b = DATA.stations[j];
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= CABLE.stationMerge, `${a.id} / ${b.id} are merged`);
  }
  const pm = DATA.stations.find(s => s.id === 'powell-market')!;
  assert.deepEqual(pm.lines.map(l => l.line).sort(), ['powell-hyde', 'powell-mason']);
  const pc = DATA.stations.find(s => s.id === 'powell-california')!;
  assert.deepEqual(pc.lines.map(l => l.line).sort(), ['california', 'powell-hyde', 'powell-mason']);
  for (const l of DATA.lines) for (const st of l.stops) assert.ok(ids.has(st.station), `${l.id} stop → station`);
  // the Powell lines share their track up to Jackson & Mason (the checkpoint's 0–160.8 u and a little more)
  assert.ok(line('powell-hyde').shared.find(s => s.line === 'powell-mason')!.until > 160);
  // Powell × California: one crossing, a few units before the shared station on both lines
  const cross = line('powell-hyde').crossings.find(c => c.line === 'california')!;
  const phStation = line('powell-hyde').stops.find(s => s.station === 'powell-california')!;
  assert.ok(cross && Math.abs(phStation.at - cross.at) < 0.01 && phStation.near > 0 && phStation.dwell);
  assert.ok(Math.abs(cross.at - line('powell-hyde').s0 - 115.4) < 5 && Math.abs(cross.otherAt - 164.7) < 5);
  // dwell at every second stop (plus termini and the crossing)
  const ph = line('powell-hyde');
  const plain = ph.stops.filter(s => !s.terminus && s.near === 0);
  const dwellShare = plain.filter(s => s.dwell).length / plain.length;
  assert.ok(dwellShare > 0.4 && dwellShare < 0.6, `dwell share ${dwellShare}`);
});

test('motion: the cable runs at 9 u/s, gripping at 3 u/s², and Powell–Hyde is ≈ 51 s of motion', () => {
  // a Powell–Hyde car alone with no intermediate dwell stops: time from the published start to the published end
  const solo = buildTransit({ ...FILE, lines: FILE.lines.filter(l => l.id === 'powell-hyde') });
  for (const st of solo.lines[0].stops) if (!st.terminus) st.dwell = false;
  const sys = new CableSystem(solo, { perLine: 1 });
  const car = sys.cars[0];
  const l = solo.lines[0];
  let t = 0, tStart = -1, tEnd = -1, maxV = 0, maxA = 0, prevV = 0;
  while (t < 120 && tEnd < 0) {
    sys.step(DT); t += DT;
    maxV = Math.max(maxV, car.v);
    if (car.mode === 'run') maxA = Math.max(maxA, (car.v - prevV) / DT);
    prevV = car.v;
    if (tStart < 0 && car.s >= l.s0) tStart = t;
    if (tEnd < 0 && car.s >= l.s0 + l.osmLength - 0.01) tEnd = t;
  }
  assert.ok(Math.abs(maxV - CABLE.speed) < 0.01, `top speed ${maxV}`);
  assert.ok(maxA <= CABLE.grip + 1e-6, `grip ${maxA}`);
  const motion = tEnd - tStart;
  assert.ok(Math.abs(motion - 51) < 5, `Powell–Hyde motion ${motion.toFixed(1)} s`);
});

test('motion: dwell 4 s at stops; 10 simulated minutes with no block violation and every car moving', () => {
  const sys = new CableSystem(DATA);
  const arrivals = new Array(sys.cars.length).fill(0);
  const dwellStart = new Map<number, number>();
  const dwells: number[] = [];
  let t = 0, maxStill = 0;
  for (; t < 600; t += DT) {
    sys.step(DT);
    for (const e of sys.events) {
      if (e.what === 'arrive') { arrivals[e.car]++; dwellStart.set(e.car, t); }
      if (e.what === 'depart' && dwellStart.has(e.car)) { dwells.push(t - dwellStart.get(e.car)!); dwellStart.delete(e.car); }
    }
    sys.events.length = 0;
    const v = sys.violations();
    assert.deepEqual(v, [], `t=${t.toFixed(1)}`);
    for (const c of sys.cars) maxStill = Math.max(maxStill, c.still);
  }
  for (const n of arrivals) assert.ok(n >= 25, `every car keeps going (${arrivals})`);
  assert.ok(Math.min(...dwells) >= CABLE.dwell - 0.05, `shortest dwell ${Math.min(...dwells)}`);
  assert.ok(maxStill < 60, `longest standstill ${maxStill.toFixed(1)} s`);
});

test('turntables: an unpushed 180° turn takes ≈ 9 s; pushing (+14°/s a press) makes it quicker', () => {
  const run = (pushesPerSecond: number) => {
    const sys = new CableSystem(DATA);
    // car 0 is the Powell–Hyde car waiting on the Powell & Market disc: send it to Hyde & Beach and time the turn there
    let t = 0, started = -1, ended = -1, next = 0;
    while (t < 400 && ended < 0) {
      sys.step(DT); t += DT;
      for (const e of sys.events) {
        if (e.what === 'turn' && e.turntable === 'hyde-beach' && started < 0) started = t;
        if (e.what === 'turned' && e.turntable === 'hyde-beach' && started >= 0) ended = t;
      }
      sys.events.length = 0;
      if (started >= 0 && ended < 0 && pushesPerSecond > 0 && t >= next) { sys.push('hyde-beach'); next = t + 1 / pushesPerSecond; }
    }
    assert.ok(started >= 0 && ended > started, 'a car turned at Hyde & Beach');
    return ended - started;
  };
  const plain = run(0);
  assert.ok(Math.abs(plain - CABLE.turnSeconds) < 0.3, `unpushed ${plain.toFixed(2)} s`);
  const pushed = run(3.5);
  assert.ok(pushed < plain * 0.6, `pushed ${pushed.toFixed(2)} s`);
  assert.ok(Math.abs(PUSH_BOOST - (14 * Math.PI) / 180) < 1e-9);
});

test('dispatch: a waiting rider gets a car within 5 s (an unseen car is brought in)', () => {
  const sys = new CableSystem(DATA);
  const st = sys.request({ line: 'powell-hyde', station: 'hyde-greenwich', dir: 1, to: 'hyde-beach' })!;
  assert.ok(st, 'request accepted');
  let t = 0;
  while (t < 20 && sys.rideStatus()!.phase !== 'here') { sys.step(DT); t += DT; }
  assert.equal(sys.rideStatus()!.phase, 'here');
  assert.ok(t <= CABLE.dispatchSeconds + 0.1, `car at the stop after ${t.toFixed(2)} s`);
  const car = sys.cars[st.car];
  assert.equal(car.station, 'hyde-greenwich');
  assert.equal(car.dir, 1);
  assert.deepEqual(sys.violations(), []);
});

test('pose: car pitch equals the track grade (over the bogie base), heading follows travel', () => {
  const sys = new CableSystem(DATA);
  const mason = line('powell-mason');
  // the steepest published grade on Mason
  let best = 0, bestS = 0;
  for (let s = 10; s < mason.length - 10; s += 0.5) {
    const a = pointAt(mason, s - CABLE.bogie), b = pointAt(mason, s + CABLE.bogie);
    const gr = (b.y - a.y) / Math.hypot(b.x - a.x, b.z - a.z);
    if (Math.abs(gr) > Math.abs(best)) { best = gr; bestS = s; }
  }
  assert.ok(Math.abs(best) > 0.3, `steep Mason grade ${best}`);
  const car = sys.cars.find(c => c.line === mason)!;
  for (const dir of [1, -1] as const) {
    car.s = bestS; car.dir = dir; car.mode = 'run'; car.lateral = 0;
    sys.updatePose(car);
    const a = pointAt(mason, bestS - dir * CABLE.bogie), b = pointAt(mason, bestS + dir * CABLE.bogie);
    const want = Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z));
    assert.ok(Math.abs(car.pose.pitch - want) < 1e-6, `pitch ${car.pose.pitch} vs grade ${want}`);
    assert.ok(Math.abs(Math.tan(car.pose.pitch) - best * dir) < 0.02);
    const fwd = { x: Math.sin(car.pose.heading), z: Math.cos(car.pose.heading) };
    assert.ok(fwd.x * (b.x - a.x) + fwd.z * (b.z - a.z) > 0, 'faces the way it travels');
    const mid = pointAt(mason, bestS);
    assert.ok(Math.abs(car.pose.y - (mid.y + CABLE.railLift)) < 0.05, 'stands on the track');
  }
});

test('platform: the pitched deck carries the rider exactly like the car body; spots mirror to the camera side', () => {
  const pose = { x: 10, y: 5, z: -3, heading: 0.7, roll: 0, pitch: 0.4 };
  const body = new THREE.Matrix4().compose(new THREE.Vector3(pose.x, pose.y, pose.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-pose.pitch, pose.heading, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
  for (const spot of [CABLE_PLATFORM.railLeft!, CABLE_PLATFORM.railRight!, CABLE_PLATFORM.seatLeft, CABLE_PLATFORM.rail, { x: 0.2, z: -2.4, heading: 0 }]) {
    for (const ly of [CABLE_PLATFORM.floor, CABLE_PLATFORM.floor + CABLE_PLATFORM.seatY]) {
      const w = platform.toWorld(pose, spot.x, ly, spot.z);
      const want = new THREE.Vector3(spot.x, ly, spot.z).applyMatrix4(body);
      assert.ok(Math.hypot(w.x - want.x, w.y - want.y, w.z - want.z) < 1e-9, `on the deck at ${spot.x},${ly},${spot.z}`);
      const back = platform.toLocal(pose, w.x, w.z, ly);
      assert.ok(Math.abs(back.x - spot.x) < 1e-9 && Math.abs(back.z - spot.z) < 1e-9, 'toLocal inverts toWorld');
    }
  }
  // without pitch the old flat maths (the F-line) are unchanged; with it the rider is no longer up to ~1 u off
  const flat = platform.toWorld({ ...pose, pitch: 0 }, 1.22, CABLE_PLATFORM.floor, 2.5);
  assert.deepEqual(flat, platform.toWorld({ x: 10, y: 5, z: -3, heading: 0.7, roll: 0 }, 1.22, CABLE_PLATFORM.floor, 2.5));
  const tilted = platform.toWorld(pose, 1.22, CABLE_PLATFORM.floor, 2.5);
  assert.ok(tilted.y - flat.y > 0.8, 'the front of a pitched car is higher');
  // the platform shape: running boards at x ±1.25 (±0.05), 12° lean, mirror to the camera side
  platform.definePlatform('test-cable', CABLE_PLATFORM);
  const p = platform.platforms.get('test-cable')!;
  assert.equal(p.kind, 'cable-car');
  assert.ok(Math.abs(Math.abs(p.railLeft!.x) - 1.25) <= 0.05 && Math.abs(Math.abs(p.railRight!.x) - 1.25) <= 0.05);
  assert.ok(Math.abs(p.hangLean! - (12 * Math.PI) / 180) < 1e-9);
  assert.equal(platform.spotFor(p, 'rail', 1), p.railLeft);
  assert.equal(platform.spotFor(p, 'rail', -1), p.railRight);
  assert.equal(platform.spotFor(p, 'seat', 1).heading, Math.PI / 2, 'outward bench on the camera side, facing it');
  // pitch is published with the pose
  platform.setPlatformPose('test-cable', pose, 1 / 60);
  assert.equal(platform.platforms.get('test-cable')!.pitch, 0.4);
  platform.platforms.delete('test-cable');
});

test('model: the toy cable car and the turntable disc stay within their triangle budgets, lamps glow at night', () => {
  const car = cableCarGeometry();
  const tris = car.getIndex()!.count / 3;
  assert.ok(tris <= 3000, `cable car ${tris} triangles`);
  car.computeBoundingBox();
  const bb = car.boundingBox!;
  assert.ok(Math.abs(bb.max.y - CABLE.height) < 0.12, `height ${bb.max.y}`);
  assert.ok(bb.max.z - bb.min.z <= CABLE.length + 0.4 && bb.max.z - bb.min.z >= CABLE.length - 0.1, `length ${bb.max.z - bb.min.z}`);
  assert.ok(bb.max.x <= 1.45 && bb.min.x >= -1.45, 'running boards within ±1.4');
  const info = car.getAttribute('aInfo');
  let lamps = 0, windows = 0;
  for (let i = 0; i < info.count; i++) { if (info.getW(i) > 0) lamps++; if (info.getX(i) === 7) windows++; }
  assert.ok(lamps > 0 && windows > 0, 'night lamps and warm windows');
  const disc = discGeometry();
  assert.ok(disc.getIndex()!.count / 3 < 1500);
});

test('rails: F draws the hero spans, the non-landmark stubs and the corner gap, nothing the city already lays', () => {
  const spans = extraSpans(DATA);
  const cal = spans.filter(s => s.line === 'california');
  assert.deepEqual(cal.map(s => s.why), ['hero']);
  assert.ok(cal[0].a === 0 && Math.abs(cal[0].b - 71.8) < 0.01);
  assert.ok(spans.some(s => s.line === 'powell-hyde' && s.why === 'stub' && Math.abs(s.b - line('powell-hyde').length) < 1e-6));
  // the Taylor & Bay tail is in the hero: its span runs on to the disc
  assert.ok(spans.some(s => s.line === 'powell-mason' && s.why === 'hero' && Math.abs(s.b - line('powell-mason').length) < 1e-6));
  // Powell & Market's rails are the landmark's
  assert.ok(!spans.some(s => s.a < 3 && s.line !== 'california'));
});

test('ride: boarding waits for the car; a ride counts only after a real stop-to-stop segment of ≥ 150 u', async () => {
  T.setTransitData(DATA);
  const sys = new CableSystem(DATA);
  setActiveCableSystem(sys);
  const events: string[] = [];
  const off = onEvent(e => { if (e.type === 'transit') events.push(`${e.what}${e.real ? ':real' : ''}`); });
  try {
    game.set({ phase: 'playing' });
    const step = (n: number, until?: () => boolean) => { for (let i = 0; i < n; i++) { sys.step(DT); transit.stepTransit(DT); if (until?.()) return true; } return false; };
    // (1) hop off before any stop: nothing counts
    transit.rideCable('powell-hyde', 'powell-market', 'hyde-beach');
    assert.equal(game.get().move.mode, 'transit');
    assert.equal(game.get().move.line, 'powell-hyde');
    assert.equal(flow.get().ride?.stage, 'waiting');
    assert.equal(flow.get().ride?.kind, 'cable-car');
    assert.ok(step(30 * 60, () => ride.currentRide()?.mode === 'follow'), 'the car comes and the rider boards');
    assert.ok(events.includes('board'));
    step(30 * 3);
    transit.hopOffRide();
    assert.equal(ride.currentRide(), null);
    assert.equal(game.get().move.mode, 'foot');
    assert.ok(!game.get().goalsDone.includes('cable-car'));
    assert.deepEqual(transit.rideLog(), {});
    assert.ok(!events.includes('ride:real'));
    // (2) a ride with a fast-travel trip in between (epoch changed) never counts
    const r = ride.beginLineRide('powell-hyde', 'powell-geary', 'hyde-beach', 1, 7);
    assert.ok(r);
    let counted = false;
    for (let i = 0; i < 30 * 120 && ride.currentRide(); i++) { sys.step(DT); const tk = ride.stepRide(DT, 0); if (tk?.count) counted = true; }
    assert.equal(counted, false, 'travel epoch changed since boarding');
    ride.endRide(); sys.cancel();
    // (3) the hop-off brake: E2 requests the stop, the car brakes to 0 within 1.2 s and holds; the HUD shows it
    transit.rideCable('powell-hyde', 'powell-geary', 'hyde-beach');
    assert.ok(step(30 * 90, () => ride.currentRide()?.mode === 'follow'));
    assert.ok(step(30 * 30, () => { const c = sys.riderCarOf('powell-hyde'); return !!c && c.v > 8; }), 'the car gets going');
    platform.requestPlatformStop('powell-hyde', 1.2);
    const car = sys.riderCarOf('powell-hyde')!;
    let tStop = 0;
    while (car.v > 0.02 && tStop < 3) { sys.step(DT); transit.stepTransit(DT); tStop += DT; }
    assert.ok(tStop <= 1.25, `braked in ${tStop.toFixed(2)} s`);
    assert.equal(flow.get().ride?.stage, 'braking');
    step(30);
    assert.ok(car.v < 0.02, 'holds while the request stands');
    transit.hopOffRide();
    assert.equal(platform.platformStop('powell-hyde'), null, 'hopOffRide releases the brake');
    step(30 * 3);
    assert.ok(car.v > 0.5, 'the car goes on');
    assert.ok(!game.get().goalsDone.includes('cable-car'));
    // (4) a real segment: board at Powell & Market, ride past 150 u to a stop → counted once, goal, save, event
    transit.rideCable('powell-hyde', 'powell-market', 'hyde-beach');
    assert.ok(step(30 * 120, () => ride.currentRide()?.mode === 'follow'));
    assert.ok(step(30 * 200, () => transit.rideLog()['powell-hyde'] === 1), 'counted at a stop');
    const st = sys.rideStatus()!;
    assert.ok(st.odometer >= RIDE_MIN_ODOMETER, `odometer ${st.odometer}`);
    assert.ok(game.get().goalsDone.includes('cable-car'));
    assert.equal(events.filter(e => e === 'ride:real').length, 1);
    // ride on to the terminus: the ride finishes there and the player steps off
    assert.ok(step(30 * 300, () => ride.currentRide() === null), 'arrives at Hyde & Beach');
    assert.equal(game.get().move.mode, 'foot');
    assert.equal(transit.rideLog()['powell-hyde'], 1, 'one count per ride');
    // HUD label for a cable ride
    const label = transit.rideLabel({ stage: 'riding', from: 'powell-market', to: 'hyde-beach', line: 'powell-hyde', kind: 'cable-car' });
    assert.equal(label.icon, 'cable-car');
    assert.equal(label.dest?.en, 'Hyde & Beach');
  } finally {
    off();
    setActiveCableSystem(null);
    T.setTransitData(null);
    ride.endRide();
    game.set({ riding: null });
    flow.set({ ride: null });
  }
});

test('stations: interactables only in city mode, the push prompt only at a turning turntable', () => {
  T.setTransitData(DATA);
  try {
    assert.deepEqual(transit.transitInteractables(), [], 'district: none');
    game.set({ worldMode: 'city' });
    const items = transit.transitInteractables();
    assert.equal(items.length, DATA.stations.length);
    assert.ok(items.every(it => it.source === 'transit' && it.action === 'streetcar' && it.id === `transit-${it.refId}`));
    const choices = transit.cableChoices(DATA, 'powell-market');
    assert.deepEqual(choices.map(c => `${c.line.id}>${c.to}`).sort(), ['powell-hyde>hyde-beach', 'powell-mason>taylor-bay']);
    assert.equal(transit.cableChoices(DATA, 'powell-california').length, 6, 'three lines, both ways');
    assert.ok(stopPos(line('powell-hyde').stops[0], 1) === 0);
  } finally {
    game.set({ worldMode: 'district' });
    T.setTransitData(null);
  }
});
