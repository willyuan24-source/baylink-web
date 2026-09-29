import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { runtime } from '../src/opus-bay/core/runtime';
import { heightAt, nearestWalkable, setCityTerrain } from '../src/opus-bay/core/terrain';
import { createCityTerrain, landmarkWalkInputs } from '../src/opus-bay/core/sfTerrain';
import { SF_LANDMARKS } from '../src/opus-bay/world/sf/landmarks/index';
import { PlayerController } from '../src/opus-bay/actors/controller';
import { setWalkGraph } from '../src/opus-bay/actors/nav';
import { flow } from '../src/opus-bay/game/flowStore';
import { sfDisk } from './opus-bay-sf-disk';

// Wave 4 · lane G · the integration review (W4-G-int-review): the defects found in the lane's integration work, each
// with a test that fails on the lane's pushed code.

const DT = 1 / 60;
const tick = () => new Promise<void>(r => setImmediate(r));
// game/guideCity imports ui/guide-ui.css (Vite): an empty module in node
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const G = await import('../src/opus-bay/game/guideCity');
styles.deregister();

/** The published city from the Wharf to Civic Center (every chunk the walks below cross), with the walking graph. */
async function cityRegion() {
  const sf = sfDisk();
  const LMS = landmarkWalkInputs(SF_LANDMARKS);
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  for (let x = -260; x <= 220; x += 120) for (let z = -60; z <= 480; z += 120) await sf.attachAround(city, x, z, 130, LMS);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  setWalkGraph(await sf.graphIndex());
}

test('W4-G-int-review: a long auto-walk whose route is longer than the straight line is never given up while it makes progress (Ferry gate → Pier 39: 407 u of route for 285 u, gave up after 14 s)', async () => {
  await cityRegion();
  try {
    const from = nearestWalkable({ x: 125, z: 35 }, 16)!;
    const goal = nearestWalkable({ x: -154.6, z: 26.6 }, 20)!;
    assert.ok(from && goal);
    const c = new PlayerController();
    const pl = runtime.player;
    pl.x = from.x; pl.z = from.z; pl.y = heightAt(from.x, from.z); pl.heading = 0; pl.pathTarget = null; pl.locked = false;
    runtime.input.moveX = 0; runtime.input.moveY = 0; runtime.input.run = false; runtime.input.jump = false;
    c.sync();
    pl.pathTarget = goal;
    const failedBefore = c.pathFailedAt;
    let t = 0, routeLen = 0;
    for (; t < 180 && pl.pathTarget; t += DT) {
      c.step({ dt: DT, now: t, cameraYaw: Math.PI, frozen: false, riding: false });
      routeLen = Math.max(routeLen, c.route.walker?.route.length ?? 0);
      if (Math.round(t / DT) % 30 === 0) await tick();
    }
    const straight = Math.hypot(goal.x - from.x, goal.z - from.z);
    assert.ok(routeLen > straight + 60, `the route (${routeLen.toFixed(0)} u) is well over the straight line (${straight.toFixed(0)} u)`);
    assert.equal(c.pathFailedAt, failedBefore, `never given up (it was at 14 s: "这边走不过去了"), t ${t.toFixed(1)} s`);
    assert.ok(Math.hypot(goal.x - pl.x, goal.z - pl.z) < 3, `arrived (${Math.hypot(goal.x - pl.x, goal.z - pl.z).toFixed(1)} u left after ${t.toFixed(0)} s)`);
  } finally { setCityTerrain(null); runtime.player.pathTarget = null; }
});

test('W4-G-int-review: a frozen stretch (a dialogue, a cinematic) is not "no progress" — the walk goes on after it', async () => {
  // the watchdog runs on long walks only: Ferry gate → City Hall down Market Street (the route close to the straight
  // line, so only the freeze can trip it), 20 s frozen 3 s into the walk; the watchdog's clock ran on while frozen
  await cityRegion();
  try {
    const from = nearestWalkable({ x: 125, z: 35 }, 16)!;
    const goal = nearestWalkable({ x: 92.3, z: 418.2 }, 20)!;
    const c = new PlayerController();
    const pl = runtime.player;
    pl.x = from.x; pl.z = from.z; pl.y = heightAt(from.x, from.z); pl.pathTarget = null; pl.locked = false;
    c.sync();
    pl.pathTarget = goal;
    const failedBefore = c.pathFailedAt;
    let t = 0;
    for (; t < 3; t += DT) { c.step({ dt: DT, now: t, cameraYaw: Math.PI, frozen: false, riding: false }); if (Math.round(t / DT) % 30 === 0) await tick(); }
    assert.ok(pl.pathTarget, 'walking');
    for (const end = t + 20; t < end; t += DT) c.step({ dt: DT, now: t, cameraYaw: Math.PI, frozen: true, riding: false });
    c.step({ dt: DT, now: t, cameraYaw: Math.PI, frozen: false, riding: false });
    assert.equal(c.pathFailedAt, failedBefore, 'not given up the moment the freeze ends');
    assert.ok(pl.pathTarget, 'still walking');
  } finally { setCityTerrain(null); runtime.player.pathTarget = null; }
});

test('W4-G-int-review: trip time while waiting at the stop counts the live wait (a ride in its waiting stage is not "aboard")', async () => {
  const walk = { via: 'walk' as const, from: { x: 0, z: 0 }, to: { x: 100, z: 0 }, seconds: 100 / 4.2, length: 100, path: [0, 0, 100, 0] };
  const ride = { via: 'line' as const, line: 'ferry', board: 'a', alight: 'b', wait: 30, stops: 1, from: { x: 100, z: 0 }, to: { x: 400, z: 0 }, seconds: 130, length: 300 };
  assert.equal(G.legSecondsLeft(ride, { x: 100, z: 0 }, false, 85), 100 + 85, 'waiting: the ride + the boat\'s live ETA');
  assert.equal(G.legSecondsLeft(ride, { x: 100, z: 0 }, false), 130, 'not at the stop yet: the planned wait + ride');
  const trip = { placeId: 'p', option: { mode: 'line' as const, legs: [walk, ride], seconds: 154 }, legs: [walk, ride], leg: 1, startedAt: 0 };
  const saved = flow.get().ride;
  try {
    flow.set({ ride: { stage: 'waiting', from: 'ferry-building', to: 'pier-41', line: 'ferry', kind: 'ferry', eta: 85 } });
    assert.deepEqual(G.rideNow(), { aboard: false, waitLeft: 85 });
    assert.equal(G.tripSecondsLeft(trip, { x: 100, z: 0 }), 185, 'the pill while the boat is 85 s away (it said 100: the wait dropped)');
    flow.set({ ride: { stage: 'waiting', from: 'ferry-building', to: 'pier-41', line: 'ferry', kind: 'ferry', eta: 20 } });
    assert.equal(G.tripSecondsLeft(trip, { x: 100, z: 0 }), 120, 'and it counts down with the ETA');
    flow.set({ ride: { stage: 'riding', from: 'ferry-building', to: 'pier-41', line: 'ferry', kind: 'ferry' } });
    assert.equal(G.rideNow().aboard, true);
    assert.ok(Math.abs(G.tripSecondsLeft(trip, { x: 250, z: 0 }) - 50) < 1e-6, 'aboard, half way: half of the 100 s ride');
  } finally { flow.set({ ride: saved }); }
});

test('W4-G-int-review: the ride banner offers 直接到站 while waiting for the ferry (lane T\'s skipWhileWaiting, verify-phone m5) and (W6-K2, the lead\'s decision) for a cable car, not for the loop bus', async () => {
  const { default: RideBanner } = await import('../src/opus-bay/ui/RideBanner');
  const saved = flow.get().ride;
  try {
    flow.set({ ride: { stage: 'waiting', from: 'pier-41', to: 'ferry-building', line: 'ferry', kind: 'ferry', eta: 81 } });
    const ferry = renderToStaticMarkup(h(RideBanner));
    assert.match(ferry, /等渡轮靠岸…约 81 秒/);
    assert.match(ferry, /不坐了/);
    assert.match(ferry, /直接到站/, 'the skip while the boat is 80–140 s away');
    flow.set({ ride: { stage: 'waiting', from: 'powell-market', to: 'powell-california', line: 'powell-hyde', kind: 'cable-car', eta: 20 } });
    const cable = renderToStaticMarkup(h(RideBanner));
    assert.match(cable, /不坐了/);
    assert.match(cable, /直接到站/, 'W6-K2: a cable car can be 60–85 s away at a turntable');
    flow.set({ ride: { stage: 'waiting', from: 'loop-ferry-building', to: 'loop-wharf-hyde', line: 'sf-loop', kind: 'bus', eta: 20 } });
    const bus = renderToStaticMarkup(h(RideBanner));
    assert.match(bus, /不坐了/);
    assert.doesNotMatch(bus, /直接到站/, 'lines without skipWhileWaiting keep 不坐了 alone');
  } finally { flow.set({ ride: saved }); }
});

test('W4-G-int-review: the on-board E / touch button says what the tap does — deck → the rail (the ferry boards onto its deck), rail → a seat, seat → standing', async () => {
  const { MoveMachine } = await import('../src/opus-bay/actors/modes');
  const { spotActionLabel } = await import('../src/opus-bay/ui/spotLabel');
  const m = new MoveMachine();
  m.beginTransit('ferry', 'deck');
  for (let t = 0; t < 0.6; t += DT) m.tick(DT, { vehicleSpeed: 0, findExitSlot: () => null });
  const said: Record<string, string> = { rail: '坐下', seat: '站起来', deck: '扶好栏杆' };
  for (const from of ['deck', 'rail', 'seat'] as const) {
    if (from === 'deck') m.walkDeck();
    else while (m.spot !== from) m.switchSpot();
    const label = spotActionLabel(m.spot!, 'ferry').zh;
    assert.equal(label, said[from], `on the ${from}`);
    m.switchSpot();
    // the words match the spot the tap leads to
    if (from === 'rail') assert.equal(m.spot, 'seat');
    else assert.equal(m.spot, 'rail', `${from} → the rail, so not "坐下" (the ferry starts on its deck: 坐下 stood the rider at the rail)`);
  }
  assert.equal(spotActionLabel('deck', 'cable-car').zh, '抓紧扶杆');
  for (const s of ['deck', 'rail', 'seat'] as const) for (const k of ['ferry', 'cable-car']) {
    const w = spotActionLabel(s, k, true);
    assert.ok([...w.zh].length <= 3 && w.en.length <= 8, `the round touch button's words fit (${w.zh} / ${w.en})`);
  }
});
