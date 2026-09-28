import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { mock } from 'node:test';

/**
 * Wave 4 · lane C · integration review: the Grand Tour and the player's own trips (换个方式 on the trip card, a trip
 * from the map elsewhere, the trip card's 结束 / a fast travel, a trip started while the tour waits at a stop), and the
 * journal's Bay 101 count while the Grand Tour holds `game.tour`.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
let clock = 400_000;
mock.method(performance, 'now', () => clock);
const tick = (ms: number) => { clock += ms; };

const { game, initialGameState, DEFAULT_TOUR_ID } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { onEvent } = await import('../src/opus-bay/core/events');
const flowMod = await import('../src/opus-bay/game/flow');
const { flow, initialFlowState } = await import('../src/opus-bay/game/flowStore');
const { buildInteractables, setInteractables } = await import('../src/opus-bay/game/interactables');
const { resetBrain } = await import('../src/opus-bay/game/brain');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const { setStorageForTests, districtTourProgress } = await import('../src/opus-bay/data/wishlist');
const save = await import('../src/opus-bay/data/save');
const tripRun = await import('../src/opus-bay/game/tripRun');
const { walkLeg } = await import('../src/opus-bay/game/trips');
const { GRAND_TOUR } = await import('../src/opus-bay/data/sf/copy');
const cityTour = await import('../src/opus-bay/game/cityTour');

setStorageForTests(null);
tripRun.initTripRun();
cityTour.initCityTour();

const events: string[] = [];
onEvent(e => { if (e.type === 'trip') events.push(`${e.what}:${e.place}`); });

function reset() {
  if (cityTour.cityTourRun()) flowMod.endTour();
  if (flow.get().trip) flowMod.endTrip();
  game.set({ ...initialGameState(), phase: 'playing', worldMode: 'city', mode: 'free' });
  flow.set(initialFlowState());
  save.resetSaveCache();
  Object.assign(runtime.player, { x: 0, y: 0, z: 0, heading: 0, moving: false, running: false, locked: false, pendingInteract: null, pathTarget: null });
  Object.assign(runtime.guide, { x: 1, y: 0, z: 0, state: 'follow', target: null, run: false, emote: 'none', arrived: false });
  resetBrain();
  setInteractables(buildInteractables());
  events.length = 0;
  tick(5000);
}
/** 120 ms frames (the tour ticks at 2 Hz, the trips at 10 Hz) */
const frames = (n = 1, ms = 120) => { for (let i = 0; i < n; i++) { tick(ms); stepFrameSystems(ms / 1000, clock); } };
const walk = (to: { x: number; z: number }, name = 'Somewhere') => {
  const leg = walkLeg({ x: runtime.player.x, z: runtime.player.z }, { ...to, name: { zh: name, en: name } });
  return { mode: 'walk' as const, legs: [leg], seconds: leg.seconds };
};
/** The Grand Tour (完整版) at its first stop, led by its trip. */
function startGrandTour() {
  flowMod.startTour(GRAND_TOUR.id);
  flowMod.chooseDialogue(0);
  flowMod.closeDialogue();
  const trip = flow.get().trip!;
  assert.equal(trip.source, 'tour');
  assert.equal(cityTour.cityTourRun()?.stop, 'bay-start');
  return trip;
}
const endOf = (t: { legs: { to: { x: number; z: number } }[] }) => t.legs[t.legs.length - 1].to;
const callRows = () => { flowMod.openCallMenu(); const rows = flowMod.nodeById('flow.call')!.choices!; flowMod.closeDialogue(); return rows; };

test('换个方式 on a Grand Tour stop (the map / a card to the same stop) goes on as the tour’s trip; its arrival ends the stop', () => {
  reset();
  const t0 = startGrandTour();
  const end = endOf(t0);
  events.length = 0;
  // the trip card's 换个方式 opens the map; the player picks another way to the same stop (lane P: source 'map')
  flowMod.startTrip(walk({ x: end.x + 4, z: end.z - 3 }, 'Ferry Building'), { placeId: 'ferry-building' }, 'map');
  const t1 = flow.get().trip!;
  assert.equal(t1.source, 'tour', 'still the tour’s trip');
  assert.equal(t1.placeId, t0.placeId, 'to the tour’s stop');
  assert.ok(!events.some(e => e.startsWith('cancel')), `no cancel: ${events.join(' ')}`);
  assert.equal(tripRun.sameDestination(t0, walk({ x: end.x + 40, z: end.z }), { placeId: 'city-hall' }), false, 'somewhere else is not the stop');
  tripRun.dispatchTrip({ type: 'leg-arrived' });
  assert.equal(cityTour.cityTourRun()?.phase, 'dwell', 'the stop ended');
  assert.deepEqual(cityTour.cityTourRun()?.completed, ['bay-start']);
});

test('a trip elsewhere pauses the Grand Tour: it never takes the trip over, says so once, and the call menu leads on', () => {
  reset();
  startGrandTour();
  const toasts = game.get().toasts.length;
  flowMod.startTrip(walk({ x: 400, z: 300 }, '市政厅'), { placeId: 'city-hall' }, 'map');
  frames(20);
  assert.equal(cityTour.cityTourRun()?.paused, true, 'paused');
  assert.equal(game.get().toasts.length, toasts + 1, 'one toast');
  assert.match(game.get().toasts.at(-1)!.text, /一日游|Grand Tour/);
  frames(300);
  assert.equal(flow.get().trip?.source, 'map', 'the player’s trip keeps running');
  assert.equal(game.get().toasts.length <= toasts + 1, true, 'said once');
  const row = callRows()[0];
  assert.match(row.label.zh, /^继续一日游/);
  assert.equal(row.action?.type, 'tour-next');
  flowMod.tourNext();
  assert.equal(flow.get().trip?.source, 'tour', '继续一日游 leads to the stop again');
  assert.equal(cityTour.cityTourRun()?.paused, false);
  assert.equal(cityTour.cityTourRun()?.stop, 'bay-start');
  assert.equal(callRows()[0].action?.type, 'tour-next', 'led again: 继续：带我去 hands the walking back to BAYBAY (W5-C5)');
});

test('the trip card’s 结束 (or a fast travel) on a tour trip pauses the tour; reaching the stop anyway counts', () => {
  reset();
  const t0 = startGrandTour();
  const end = endOf(t0);
  flowMod.endTrip();
  assert.equal(flow.get().trip, null);
  frames(20);
  assert.equal(cityTour.cityTourRun()?.paused, true);
  assert.equal(cityTour.cityTourRun()?.phase, 'leading');
  runtime.player.x = end.x + 3; runtime.player.z = end.z + 2;
  frames(6);
  assert.equal(cityTour.cityTourRun()?.phase, 'dwell', 'got there: the stop’s moment');
  assert.deepEqual(cityTour.cityTourRun()?.completed, ['bay-start']);
  assert.equal(cityTour.cityTourRun()?.paused, false);
  // the dwell ends and the tour leads on by itself
  frames(260);
  assert.equal(cityTour.cityTourRun()?.stop, 'bay-ride-ggb');
  assert.equal(flow.get().trip?.source, 'tour');
});

test('a trip the player starts while the tour waits at a stop is never replaced by the next stop; 结束一日游 leaves it running', () => {
  reset();
  startGrandTour();
  tripRun.dispatchTrip({ type: 'leg-arrived' });
  assert.equal(cityTour.cityTourRun()?.phase, 'dwell');
  // at the stop, before its dwell is over, the player picks somewhere on the map
  frames(3);
  flowMod.startTrip(walk({ x: -300, z: 200 }, 'Somewhere'), { placeId: 'somewhere' }, 'map');
  frames(400);
  assert.equal(flow.get().trip?.source, 'map', 'the dwell’s end did not start the next stop over it');
  assert.equal(cityTour.cityTourRun()?.phase, 'dwell');
  assert.equal(cityTour.cityTourRun()?.paused, true);
  assert.equal(callRows()[0].label.zh, '继续一日游 · 去下一站');
  flowMod.endTour();
  assert.equal(cityTour.cityTourRun(), null);
  assert.equal(flow.get().trip?.source, 'map', 'ending the tour keeps the player’s own trip');
  flowMod.closePanel();
  flowMod.endTrip();
});

test('the journal’s Bay 101 counts the first lesson’s stops, never the Grand Tour’s held in game.tour', () => {
  reset();
  startGrandTour();
  for (let k = 0; k < 3; k++) {
    let guard = 0;
    while (flow.get().trip && flow.get().trip!.leg < flow.get().trip!.legs.length && guard++ < 6) tripRun.dispatchTrip({ type: 'leg-arrived' });
    if (k < 2) flowMod.tourNext();
  }
  assert.equal(game.get().tour.completed.length, 3, 'game.tour holds three Grand Tour stops');
  flowMod.endTour();
  flowMod.closePanel();
  assert.notEqual(game.get().tour.id, DEFAULT_TOUR_ID);
  assert.deepEqual(districtTourProgress(game.get()).completed, [], 'the first lesson was never started');
  const journal = readFileSync(new URL('../src/opus-bay/ui/Journal.tsx', import.meta.url), 'utf8');
  assert.match(journal, /tourIdOf\(s\.tour\) === DEFAULT_TOUR_ID \? s\.tour\.completed : districtTourProgress\(s\)\.completed/, 'the journal reads the first lesson’s own progress');
});
