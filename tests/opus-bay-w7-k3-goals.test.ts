import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';

/**
 * W7-K3 (lane B's wave-6 phone note: "the new-save goals card ended an N ride ~40 s in", seen once): neither the goals
 * step (the new save's card, opened by the welcome's 我自己逛逛 while a ride runs), nor its pause (the 'panel' lock it
 * holds, which freezes the feet), nor closing it (我自己逛 / Escape), nor the old goals card ends or cancels a city ride:
 * it rides on to its stop. Scripted on lane F's CableSystem in node (the car published as the platform like
 * world/transitLayer, as tests/opus-bay-w6-k2-pause.test.ts). Played live too: sf-w7-K.md part b.
 */

// --- headless canvas stub (world modules create label atlases at import time)
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const flowMod = await import('../src/opus-bay/game/flow');
const goalsStep = await import('../src/opus-bay/game/goalsStep');
styles.deregister();
const T = await import('../src/opus-bay/data/transit');
const { CableSystem, setActiveCableSystem } = await import('../src/opus-bay/world/transitLine');
const platform = await import('../src/opus-bay/actors/platform');
const { CABLE_PLATFORM } = await import('../src/opus-bay/world/cablecar');
const { game } = await import('../src/opus-bay/core/store');
const { flow } = await import('../src/opus-bay/game/flowStore');
const transit = await import('../src/opus-bay/game/transit');
const ride = await import('../src/opus-bay/game/ride');
const { registerOverlay, closeOverlay, openOverlays } = await import('../src/opus-bay/ui/slots');
const { GOALS_STEP_ID } = await import('../src/opus-bay/data/sf/goals');
const { holdLock } = await import('../src/opus-bay/game/playerLock');
const save = await import('../src/opus-bay/data/save');

const FILE = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1/transit.json'), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson;
const DATA = T.buildTransit(FILE);
const DT = 1 / 30;
const LINE = 'powell-hyde';

test('W7-K3: the goals step opened, held and closed during a cable-car ride never ends it — the ride reaches its stop', () => {
  save.resetSaveCache();
  save.clearSave();
  T.setTransitData(DATA);
  const sys = new CableSystem(DATA);
  setActiveCableSystem(sys);
  platform.definePlatform(LINE, CABLE_PLATFORM);
  const offStep = registerOverlay({ id: GOALS_STEP_ID, Component: () => null });
  let arrived: string | null = null;
  const frame = () => {
    sys.step(DT);
    const car = sys.riderCarOf(LINE);
    if (car) platform.setPlatformPose(LINE, car.pose, DT);
    const before = ride.currentRide(), st = sys.rideStatus();
    transit.stepTransit(DT);
    if (before && !ride.currentRide() && st?.phase === 'arrived') arrived = st.lastStation ?? 'arrived';
  };
  const run = (maxS: number, until: () => boolean) => { for (let i = 0; i < maxS / DT; i++) { frame(); if (until()) return true; } return false; };
  let release: (() => void) | null = null;
  try {
    // a new save in the city, still in the welcome (onboarding): the player boards a cable car
    game.set({ phase: 'playing', worldMode: 'city', mode: 'onboarding', goalsDone: [], dialogue: { nodeId: null }, panel: { kind: null }, paused: false });
    transit.rideCable(LINE, 'powell-geary', 'hyde-beach');
    assert.ok(run(240, () => ride.currentRide()?.mode === 'follow'), 'boarded');
    assert.ok(run(20, () => (sys.riderCarOf(LINE)?.v ?? 0) > 3), 'under way');
    // the welcome's 我自己逛逛 mid-ride: startFree() opens the goals step (a new save) …
    flowMod.startFree();
    assert.ok(openOverlays().some(o => o.id === GOALS_STEP_ID), 'the goals step is open');
    // … and the step holds the feet while it is up (ui/GoalsStep.tsx holdLock('panel', 'goals-step'))
    release = holdLock('panel', 'goals-step');
    run(40, () => !ride.currentRide());
    assert.ok(ride.currentRide(), 'still riding after 40 s under the goals step');
    assert.ok(flow.get().ride, 'the ride banner stays');
    // 我自己逛 (or Escape / the backdrop): the step closes, BAYBAY's goal line — the ride goes on
    release(); release = null;
    closeOverlay(GOALS_STEP_ID);
    goalsStep.afterGoalsStep('self', 'pelican:coit');
    run(5, () => !ride.currentRide());
    assert.ok(ride.currentRide(), 'still riding after the step closed');
    // the old goals card (the district's, or the city's when the step's chunk was missing) mid-ride: nothing either
    flow.set({ goalsCard: true });
    run(10, () => !ride.currentRide());
    assert.ok(ride.currentRide(), 'still riding under the old goals card');
    flow.set({ goalsCard: false });
    // on to the stop: the ride ends by arriving, not before
    assert.ok(run(400, () => !ride.currentRide()), 'the ride ended');
    assert.equal(arrived, 'hyde-beach', `it ended by arriving at its stop (${arrived})`);
  } finally {
    release?.();
    closeOverlay(GOALS_STEP_ID);
    offStep();
    if (ride.currentRide()) transit.cancelRide();
    setActiveCableSystem(null as never);
    game.set({ phase: 'title', mode: 'onboarding', worldMode: 'district' });
  }
});
