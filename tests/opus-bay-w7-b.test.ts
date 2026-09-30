import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 7 · lane B (transit).
 *
 * - W7-B2: the game's pause (Settings open: game/transit.ts holdRideForPause asks the rider's line for a stop, PAUSE_BRAKE_S)
 *   holds a Muni Metro train under ground too. It used to run on under the subway overlay to its next surface stretch
 *   (world/lightRail.ts: no stop request honoured in a tunnel or under a hood — that rule is for the hop-off brake, which
 *   still never starts there).
 */

// --- headless canvas / DOM stubs (world modules create label atlases at import time), as tests/opus-bay-w5-deadlock.test.ts
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

const platform = await import('../src/opus-bay/actors/platform');
const { LightRailSystem, railTrack } = await import('../src/opus-bay/world/lightRail');
const { PAUSE_BRAKE_S } = await import('../src/opus-bay/game/transit');
const { LineFleet } = await import('../src/opus-bay/world/sf/lineFleet');
const T = await import('../src/opus-bay/data/transit');
const { game } = await import('../src/opus-bay/core/store');
type TransitLine = import('../src/opus-bay/world/sf/format').TransitLine;
type TransitFile = import('../src/opus-bay/world/sf/format').TransitFile;

const PUB = path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1');
const W4FILE = JSON.parse(fs.readFileSync(path.join(PUB, 'transit-w4.json'), 'utf8')) as TransitFile;
const N = W4FILE.lines.find(l => l.id === 'n-judah')!;
const TN = railTrack(N);
const DT = 1 / 20;
type Rail = InstanceType<typeof LightRailSystem>;
const until = (sys: Rail, cond: () => boolean, max: number) => { let t = 0; while (!cond() && t < max) { sys.step(DT); t += DT; } return t; };
const run = (sys: Rail, secs: number, each?: () => void) => { for (let t = 0; t < secs; t += DT) { sys.step(DT); each?.(); } };

/** A rider aboard the N from `from` towards `to` (the train pulling away). */
function ride(sys: Rail, from: string, to: string) {
  sys.request({ line: 'n-judah', station: from, dir: 1, to });
  until(sys, () => sys.rideStatus()!.phase !== 'coming', 40);
  assert.equal(sys.rideStatus()!.phase, 'here', `picked up at ${from}`);
  sys.board();
  return sys.riderCarOf('n-judah')!;
}

test('W7-B2: the Settings pause holds the rider\'s Metro train in the subway — it brakes to a stand there (hidden), holds for the whole pause, and goes on to its stop after it', () => {
  let paused = false;
  const sys = new LightRailSystem([TN], { paused: () => paused });
  try {
    const train = ride(sys, 'muni-embarcadero', 'muni-van-ness');
    until(sys, () => sys.rideStatus()!.underground && train.v > 10 && train.mode === 'run', 30);
    assert.ok(sys.rideStatus()!.underground && train.v > 10, `running in the subway (v ${train.v.toFixed(1)})`);
    assert.equal(sys.canHopOffAt(TN, train.s), false, 'no hop-off brake here');
    // Settings opens: the pause brake (game/transit.ts asks it on the next frame)
    paused = true;
    platform.requestPlatformStop('n-judah', PAUSE_BRAKE_S);
    const braked = until(sys, () => train.v < 0.02, 6);
    assert.ok(train.v < 0.02, `stood in the tunnel (v ${train.v.toFixed(2)} after ${braked.toFixed(1)} s)`);
    assert.ok(braked <= PAUSE_BRAKE_S + 0.2, `within the pause brake (${braked.toFixed(1)} s)`);
    assert.ok(train.hidden && sys.rideStatus()!.underground, 'standing under ground (the overlay shows)');
    const s = train.s;
    run(sys, 60);
    assert.ok(Math.abs(train.s - s) < 0.01, `held a whole minute (moved ${Math.abs(train.s - s).toFixed(2)} u)`);
    assert.notEqual(sys.rideStatus()!.phase, 'arrived');
    // Settings closes: the brake is released and the ride goes on to Van Ness
    paused = false;
    platform.releasePlatformStop('n-judah');
    until(sys, () => sys.rideStatus()!.phase === 'arrived', 90);
    assert.equal(sys.rideStatus()!.phase, 'arrived');
    assert.equal(sys.rideStatus()!.lastStation, 'muni-van-ness');
  } finally { platform.releasePlatformStop('n-judah'); }
});

test('W7-B2: paused at an underground station the rider\'s train keeps dwelling there (not 3 s and away into the tunnel); not paused, a stop request under ground is still ignored (the hop-off rule)', () => {
  let paused = false;
  const sys = new LightRailSystem([TN], { paused: () => paused });
  try {
    const train = ride(sys, 'muni-embarcadero', 'muni-van-ness');
    // the next underground stop: Montgomery
    until(sys, () => train.mode === 'dwell' && train.station === 'muni-montgomery', 60);
    assert.equal(train.station, 'muni-montgomery');
    assert.ok(train.hidden);
    paused = true;
    platform.requestPlatformStop('n-judah', PAUSE_BRAKE_S);
    const s = train.s;
    run(sys, 20);
    assert.equal(train.mode, 'dwell', 'still at Montgomery after 20 s');
    assert.ok(Math.abs(train.s - s) < 0.01);
    paused = false;
    platform.releasePlatformStop('n-judah');
    until(sys, () => train.v > 5, 10);
    assert.ok(train.v > 5, 'pulled away once the pause ended');
    // a stop request with the game running (never the rider's: moveSystem does not start one here) is ignored
    until(sys, () => train.hidden && train.v > 10 && train.mode === 'run', 20);
    platform.requestPlatformStop('n-judah', 1);
    run(sys, 2);
    assert.ok(train.v > 5 || train.mode === 'dwell', `no braking in the tunnel unpaused (v ${train.v.toFixed(1)})`);
  } finally { platform.releasePlatformStop('n-judah'); }
});

test('W7-B2: paused under a portal hood in a single-track stretch, the train stands there and the opposite one waits at the stretch\'s edge (never both in it); after the pause both go on', () => {
  let paused = false;
  const sys = new LightRailSystem([TN], { paused: () => paused });
  try {
    const train = ride(sys, 'muni-van-ness', 'muni-carl-cole');
    const stretch = (s: number) => sys.gauntletsOf(TN).find(gt => s > gt.a && s < gt.b) ?? null;
    // under the Duboce hood (or in the tunnel), inside the single-track stretch round the mouth
    until(sys, () => !!stretch(train.s) && !sys.canHopOffAt(TN, train.s) && train.v > 2 && train.mode === 'run', 90);
    const gt = stretch(train.s);
    assert.ok(gt && !sys.canHopOffAt(TN, train.s), `in a single-track stretch under ground (s ${train.s.toFixed(1)})`);
    paused = true;
    platform.requestPlatformStop('n-judah', PAUSE_BRAKE_S);
    until(sys, () => train.v < 0.02, 6);
    assert.ok(train.v < 0.02 && stretch(train.s) === gt, `stood in the stretch (s ${train.s.toFixed(1)})`);
    const s = train.s, other = sys.trains.find(o => o !== train)!;
    let bad: string[] = [], both = 0;
    run(sys, 90, () => {
      const v = sys.violations();
      if (v.length) bad = v;
      if (other.dir !== train.dir && other.s > gt!.a && other.s < gt!.b) both++;
    });
    assert.ok(Math.abs(train.s - s) < 0.01, 'held there for the pause');
    assert.deepEqual(bad, []);
    assert.equal(both, 0, 'the opposite train never came into the stretch');
    paused = false;
    platform.releasePlatformStop('n-judah');
    until(sys, () => sys.rideStatus()!.phase === 'arrived', 120);
    assert.equal(sys.rideStatus()!.lastStation, 'muni-carl-cole');
    run(sys, 60, () => { const v = sys.violations(); if (v.length) bad = v; });
    assert.deepEqual(bad, []);
    for (const t of sys.trains) assert.ok(t.still < 40, `${t.track.id}#${t.index} still ${t.still.toFixed(1)} s after the pause`);
  } finally { platform.releasePlatformStop('n-judah'); }
});

test('W7-B2: the city fleet wires the game\'s pause into its Metro (world/sf/lineFleet.ts)', () => {
  const W4 = T.buildTransitW4(JSON.parse(fs.readFileSync(path.join(PUB, 'transit.json'), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson)!;
  const fleet = new LineFleet({ loop: W4.loop as TransitLine & { speeds?: [number, number, number][] }, metro: W4.metro, props: W4.props }, { emitEvents: false });
  const sys = fleet.rail;
  try {
    const train = ride(sys, 'muni-embarcadero', 'muni-van-ness');
    until(sys, () => sys.rideStatus()!.underground && train.v > 10 && train.mode === 'run', 30);
    game.set({ paused: true });
    platform.requestPlatformStop('n-judah', PAUSE_BRAKE_S);
    const braked = until(sys, () => train.v < 0.02, 6);
    assert.ok(train.v < 0.02 && train.hidden && train.mode !== 'dwell' && braked <= PAUSE_BRAKE_S + 0.2, `the fleet's train stood in the subway (v ${train.v.toFixed(2)} after ${braked.toFixed(1)} s, ${train.mode})`);
    game.set({ paused: false });
    run(sys, 3);
    assert.ok(train.v < 0.02, 'the brake (not the flag) holds it until released');
    platform.releasePlatformStop('n-judah');
    until(sys, () => train.v > 5, 10);
    assert.ok(train.v > 5, 'released: goes on');
  } finally { game.set({ paused: false }); platform.releasePlatformStop('n-judah'); fleet.dispose?.(); }
});

test('W7-B2: a sheet opened on an underground ride (Esc → Settings, which stands the train) shows above the subway overlay (ui/transit-ui.css)', () => {
  const css = fs.readFileSync(path.resolve(import.meta.dirname, '../src/opus-bay/ui/transit-ui.css'), 'utf8');
  const z = (re: RegExp) => Number(re.exec(css)?.[1] ?? NaN);
  const subway = z(/\.ob-subway \{[^}]*z-index: *(\d+)/);
  const sheet = z(/\.ob-overlay:has\(\.ob-subway\.is-on\) \.ob-sheet \{[^}]*z-index: *(\d+)/);
  assert.ok(subway > 0 && sheet > subway, `sheet ${sheet} over the subway ${subway}`);
});
