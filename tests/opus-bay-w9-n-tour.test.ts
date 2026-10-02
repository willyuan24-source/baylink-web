import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

/**
 * Wave 9 · lane N · W9-N3 / W9-N4 (plan sf-w9-lead.md §3 N (3), (4)): the Grand Tour's chapter card (postcards claimed,
 * coins, 下一章 with its minutes, 想去, a rest), the resume card on return (继续一日游 · 第 n 章（约 m 分钟）), the trip
 * end's arrival heading. The harness is tests/opus-bay-w5-tours.test.ts' (a node city with the flow, the trip runner,
 * the tour engine, a mocked clock). Red before: no chapter card, no resume card, a walking trip ended facing its way in.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.location = { search: '?world=city&save=off', href: 'http://localhost/opus-bay?world=city&save=off', pathname: '/opus-bay', hostname: 'localhost' };
g.window ??= globalThis;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, toBlob: (cb: (b: null) => void) => cb(null) }) };
let clock = 500_000;
mock.method(performance, 'now', () => clock);
const tick = (ms: number) => { clock += ms; };

const { game, initialGameState } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const flowMod = await import('../src/opus-bay/game/flow');
const { flow, initialFlowState } = await import('../src/opus-bay/game/flowStore');
const { buildInteractables, setInteractables } = await import('../src/opus-bay/game/interactables');
const { resetBrain } = await import('../src/opus-bay/game/brain');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const { setStorageForTests } = await import('../src/opus-bay/data/wishlist');
const save = await import('../src/opus-bay/data/save');
// (loaded for their side effects: the city's detectors and lines, as the w5-tours harness)
await import('../src/opus-bay/game/cityDetectors');
await import('../src/opus-bay/data/sf/linesW5');
await import('../src/opus-bay/data/sf/tourLines');
const { SF_GRAND, tourStops } = await import('../src/opus-bay/data/sf/tours');
const { GRAND_TOUR } = await import('../src/opus-bay/data/sf/copy');
const tripRun = await import('../src/opus-bay/game/tripRun');
const auto = await import('../src/opus-bay/game/autoTravel');
const pelican = await import('../src/opus-bay/game/pelicanFirst');
setStorageForTests(null);
const offTrips = tripRun.initTripRun();


function reset() {
  if (flow.get().trip) flowMod.endTrip();
  if (game.get().dialogue.nodeId) flowMod.closeDialogue();
  game.set({ ...initialGameState(), phase: 'playing', worldMode: 'city', mode: 'free' });
  flow.set(initialFlowState());
  Object.assign(runtime.player, { x: 0, y: 0, z: 0, heading: 0, moving: false, running: false, locked: false, pendingInteract: null, pathTarget: null });
  Object.assign(runtime.guide, { x: 1, y: 0, z: 0, state: 'follow', target: null, run: false, emote: 'none', arrived: false });
  resetBrain();
  setInteractables(buildInteractables());
  save.resetSaveCache();
  auto.autoEnd();
  tick(5000);
}
const frames = (n = 1, ms = 120) => { for (let i = 0; i < n; i++) { tick(ms); stepFrameSystems(ms / 1000, clock); } };

const attention = await import('../src/opus-bay/game/attention');
const { minutesLabel } = await import('../src/opus-bay/game/tripText');

test('W9-N3 tourResumeChoice: the first open stop\'s chapter and the minutes left at the measured scale', () => {
  const done = SF_GRAND.chapters[0].stops.filter(s => !s.optional).map(s => s.id);
  const pick = tripRun.tourResumeChoice(SF_GRAND, done)!;
  assert.equal(pick.chapter, 2);
  const model = SF_GRAND.chapters.slice(1).flatMap(c => c.stops.filter(s => !s.optional)).reduce((a, s) => a + s.minutes, 0);
  assert.equal(pick.minutes, Math.round(model * SF_GRAND.minutes / SF_GRAND.modelMinutes!));
  assert.ok(pick.minutes > 20 && pick.minutes < 36, `${pick.minutes} min left`);
  assert.equal(pick.label.zh, `继续一日游 · 第 2 章（${minutesLabel(pick.minutes).zh}）`);
  assert.equal(tripRun.tourResumeChoice(SF_GRAND, tourStops(SF_GRAND).map(f => f.stop.id)), null, 'nothing left');
  assert.equal(tripRun.RESUME_LINE.zh, '上次的一日游还没走完，接着走吗？');
});

test('W9-N4 arrivalHeading: the place row\'s, else the landmark arrival\'s; trips end facing it', () => {
  assert.equal(tripRun.arrivalHeading('pier-35', id => (id === 'pier-35' ? { arrival: { heading: 1.25 } } : undefined), {}), 1.25);
  assert.equal(tripRun.arrivalHeading('sf:golden-gate-bridge', () => undefined), 4.037);
  assert.equal(tripRun.arrivalHeading('nowhere', () => undefined, {}), null);
});

test('W9-N3 the chapter card: at the end of 海湾 the chapter\'s postcards are claimed, the card asks F\'s title slot and offers 下一章 / 想去 / a rest', async () => {
  reset();
  pelican.resetPelicanForTests(null, () => true);
  const cityTour = await import('../src/opus-bay/game/cityTour');
  cityTour.initCityTour();
  Object.assign(runtime.player, { x: 150, z: -20 });
  flowMod.startTour(GRAND_TOUR.id);
  assert.notEqual(game.get().dialogue.nodeId, 'flow.tour.sf-grand', 'no version question (W9-N3)');
  const firstChapter = tourStops(SF_GRAND).filter(f => f.chapter === 0);
  for (let k = 0; k < firstChapter.length; k++) {
    assert.equal(cityTour.cityTourRun()?.stop, firstChapter[k].stop.id);
    tripRun.dispatchTrip({ type: 'leg-arrived' });
    while (flow.get().trip && flow.get().trip!.leg < flow.get().trip!.legs.length) tripRun.dispatchTrip({ type: 'leg-arrived' });
    if (k < firstChapter.length - 1) { if (game.get().dialogue.nodeId) flowMod.closeDialogue(); flowMod.tourNext(); }
  }
  assert.equal(cityTour.cityTourRun()?.phase, 'dwell');
  assert.ok(game.get().postcards.includes('sf-golden-gate-fog'), 'the chapter\'s stop postcard is claimed (the recap said 0/24)');
  const asked = attention.slotHolder('title') === 'n:flow.tour.chapter' || attention.slotQueue('title').includes('n:flow.tour.chapter');
  assert.ok(asked, `the card asked the title slot (holder ${attention.slotHolder('title')}, queue ${attention.slotQueue('title').join(',')})`);
  // the outro is paced: the card opens once BAYBAY has said it (the pacer's clock is the mocked one)
  for (let i = 0; i < 80 && game.get().dialogue.nodeId !== 'flow.tour.chapter'; i++) { frames(1, 500); await new Promise(r => setTimeout(r, 30)); }
  assert.equal(game.get().dialogue.nodeId, 'flow.tour.chapter');
  const node = flowMod.nodeById('flow.tour.chapter')!;
  assert.match(node.text.zh, /^第 1 章 · 海湾 完成！/);
  assert.match(node.text.zh, /明信片 \d\/\d/);
  assert.match(node.choices![0].label.zh, /^下一章：海岸（约 \d+ 分钟）$/);
  assert.deepEqual(node.choices![0].action, { type: 'tour-next' });
  assert.deepEqual(node.choices!.map(c => c.hotkey), ['1', '2', '3']);
  // 先在这儿逛逛: the tour waits (the call menu's 继续一日游 leads on)
  flowMod.chooseDialogue(2);
  frames(2);
  assert.equal(cityTour.cityTourRun()?.paused, true);
  assert.notEqual(attention.slotHolder('title'), 'n:flow.tour.chapter', 'the slot is free again');
  flowMod.endTour();
  if (game.get().panel.kind) flowMod.closePanel();
});

test('W9-N3 the resume card: on return with a Grand Tour half done, one card after 6 s of free play — 继续一日游 · 第 n 章（约 m 分钟）', async () => {
  reset();
  save.resetSaveCache();
  save.patchSave(s => { s.tours = { 'sf-grand': { chapter: 1, stop: 0, completed: SF_GRAND.chapters[0].stops.filter(x => !x.optional).map(x => x.id) } }; });
  offTrips();
  const off = tripRun.initTripRun();
  try {
    frames(10, 500);
    for (let i = 0; i < 40 && game.get().dialogue.nodeId !== 'flow.tour.resume'; i++) { frames(1, 200); await new Promise(r => setTimeout(r, 20)); }
    assert.equal(game.get().dialogue.nodeId, 'flow.tour.resume');
    const node = flowMod.nodeById('flow.tour.resume')!;
    assert.deepEqual(node.text, tripRun.RESUME_LINE);
    assert.match(node.choices![0].label.zh, /^继续一日游 · 第 2 章（约 \d+ 分钟）$/);
    assert.deepEqual(node.choices![0].action, { type: 'start-tour', tourId: 'sf-grand' });
    flowMod.closeDialogue();
    frames(80, 500);
    assert.notEqual(game.get().dialogue.nodeId, 'flow.tour.resume', 'once');
  } finally { off(); }
});

test('W9-N3 the tour bus menu: E at the pole of the Grand Tour\'s next ride pre-fills that ride (review R§6: no 金门大桥 in the menu)', async () => {
  const LR = await import('../src/opus-bay/game/lineRides');
  const legs = [
    { via: 'walk' },
    { via: 'line', line: 'sf-loop', board: 'loop-ferry-building', alight: 'loop-golden-gate-bridge' },
  ];
  assert.deepEqual(LR.tourRideFrom('loop-ferry-building', { source: 'tour', leg: 0, legs }), { to: 'loop-golden-gate-bridge', line: 'sf-loop' });
  assert.equal(LR.tourRideFrom('loop-pier-39', { source: 'tour', leg: 0, legs }), null, 'another pole: the menu as ever');
  assert.equal(LR.tourRideFrom('loop-ferry-building', { source: 'map', leg: 0, legs }), null, 'not a tour trip');
  assert.equal(LR.tourRideFrom('loop-ferry-building', { source: 'tour', leg: 2, legs }), null, 'that ride is behind us');
});

test('W9-N3 the recap: the tour\'s stop postcards (not every postcard of the city), events this week near the stops, the day words', async () => {
  const styles = (await import('node:module')).registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
  const R = await import('../src/opus-bay/ui/CityTourRecap');
  styles.deregister();
  const all = SF_GRAND.chapters.flatMap(c => c.stops.filter(s => s.postcard && !s.optional).map(s => s.postcard!));
  const pc = R.tourPostcards(SF_GRAND, false, [all[0], 'not-a-tour-card']);
  assert.equal(pc.total, new Set(all).size);
  assert.ok(pc.total >= 8 && pc.total < 24, `${pc.total} stop postcards (the city has 24)`);
  assert.equal(pc.found, 1);
  const venue = (x: number, z: number) => ({ id: 'v', name: { zh: '某处', en: 'Somewhere' }, x, z, match: /x/, events: [], kit: 'board' }) as never;
  const win = (id: string, x: number, z: number) => ({ event: { id, title: id }, venue: venue(x, z), dateKey: '2026-10-03', open: 0, close: 1 }) as never;
  const near = R.eventsNearStops(SF_GRAND, [win('a', 133, 20), win('far', 5000, 5000), win('a', 133, 20), win('b', -700, 600), win('c', 150, 980), win('d', 200, 1550)]);
  assert.deepEqual(near.map((w: { event: { id: string } }) => w.event.id), ['a', 'b', 'c'], 'near a stop, once each, at most 3');
  assert.deepEqual(R.dayLabel('2026-10-03'), { zh: '周六 10/3', en: 'Sat 10/3' });
});

test('W9-N4 goTo onArrive: called once when THAT trip arrives (the event card again), never after a cancel or another trip', async () => {
  reset();
  attention.clearAttention();
  tick(5000);
  // (goToRun inits the runner before it starts the trip: the start is synchronous then)
  const offRun = tripRun.initTripRun();
  const GR = await import('../src/opus-bay/game/goToRun');
  const walkTo = (x: number) => ({ mode: 'walk' as const, legs: [{ via: 'walk' as const, from: { x: 0, z: 0 }, to: { x, z: 0 }, seconds: 5, length: 20 }], seconds: 5 });
  let arrived = 0;
  flowMod.startTrip(walkTo(20), { placeId: 'ferry-building', x: 20, z: 0 }, 'card');
  GR.whenArrived(() => { arrived++; }, 'ferry-building');
  tripRun.dispatchTrip({ type: 'leg-arrived' });
  await new Promise(r => setTimeout(r, GR.ARRIVE_CARD_MS + 300));
  assert.equal(arrived, 1, 'the arrival runs it (after the arrival moment)');
  tick(5000);
  // cancelled: never
  flowMod.endTrip();
  flowMod.startTrip(walkTo(30), { placeId: 'ferry-building', x: 30, z: 0 }, 'card');
  GR.whenArrived(() => { arrived++; }, 'ferry-building');
  flowMod.endTrip();
  flowMod.startTrip(walkTo(40), { placeId: 'ferry-building', x: 40, z: 0 }, 'card');
  tripRun.dispatchTrip({ type: 'leg-arrived' });
  await new Promise(r => setTimeout(r, GR.ARRIVE_CARD_MS + 300));
  assert.equal(arrived, 1, 'a cancelled trip\'s callback never runs, not even when the next trip arrives');
  flowMod.endTrip();
  offRun();
});
