import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

/**
 * Wave 4 · lane C · integration part a: flow.trip in the running flow (game/tripRun.ts), the arrival moments and paced
 * lines (game/cityMoments.ts), the wave-4 goals, the Grand Tour engine (game/cityTour.ts), save v2 `tours` /
 * `arrivals`, the progress save's first-lesson guard, the place cards in PoiCard's resolver (game/cityCards.ts).
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
let clock = 200_000;
mock.method(performance, 'now', () => clock);
const tick = (ms: number) => { clock += ms; };

const { game, initialGameState, DEFAULT_TOUR_ID } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { onEvent } = await import('../src/opus-bay/core/events');
const flowMod = await import('../src/opus-bay/game/flow');
const { flow, initialFlowState } = await import('../src/opus-bay/game/flowStore');
const { buildInteractables, setInteractables, registerInteractables, poiById } = await import('../src/opus-bay/game/interactables');
const { updateGuide, resetBrain } = await import('../src/opus-bay/game/brain');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const { setStorageForTests, snapshotProgress, readProgress, GOALS_DONE_MAX, districtTourProgress } = await import('../src/opus-bay/data/wishlist');
const save = await import('../src/opus-bay/data/save');
const tripRun = await import('../src/opus-bay/game/tripRun');
const { walkLeg } = await import('../src/opus-bay/game/trips');
const goals = { ...(await import('../src/opus-bay/data/sf/goals')), ...(await import('../src/opus-bay/data/sf/goalMarks')) };
const { GRAND_TOUR } = await import('../src/opus-bay/data/sf/copy');
const { SF_GRAND, tourResumeLabel, TOUR_GEO, SIGHTSEEING_STOPS } = await import('../src/opus-bay/data/sf/tours');
const { minutesLabel } = await import('../src/opus-bay/game/tripText');

setStorageForTests(null);
const offTrips = tripRun.initTripRun();

const events: { type: string; what?: string }[] = [];
onEvent(e => { if (e.type === 'trip' || e.type === 'arrival' || e.type === 'voice-line' || e.type === 'goal') events.push(e as { type: string; what?: string }); });

function reset(world: 'city' | 'district' = 'city') {
  if (flow.get().trip) flowMod.endTrip();
  game.set({ ...initialGameState(), phase: 'playing', worldMode: world, mode: 'free' });
  flow.set(initialFlowState());
  Object.assign(runtime.player, { x: 0, y: 0, z: 0, heading: 0, moving: false, running: false, locked: false, pendingInteract: null, pathTarget: null });
  Object.assign(runtime.guide, { x: 0, y: 0, z: 0, state: 'follow', target: null, run: false, emote: 'none', arrived: false });
  resetBrain();
  setInteractables(buildInteractables());
  events.length = 0;
  tick(5000);
}
const at = (x: number, z: number) => { runtime.player.x = x; runtime.player.z = z; runtime.guide.x = x + 1; runtime.guide.z = z; };
const frames = (n = 1, ms = 120) => { for (let i = 0; i < n; i++) { tick(ms); stepFrameSystems(ms / 1000, clock); } };
const walk = (to: { x: number; z: number }, name = 'Somewhere') => {
  const leg = walkLeg({ x: runtime.player.x, z: runtime.player.z }, { ...to, name: { zh: name, en: name } });
  return { mode: 'walk' as const, legs: [leg], seconds: leg.seconds };
};

test('trips: startTrip writes flow.trip and the start event; the waypoint follows the leg; BAYBAY leads there; the trip ends, then clears', () => {
  reset();
  flowMod.startTrip(walk({ x: 40, z: 0 }, '市政厅'), { placeId: 'city-hall', attraction: 'city-hall' }, 'map');
  const t = flow.get().trip!;
  assert.ok(t, 'flow.trip is set');
  assert.equal(t.source, 'map');
  assert.deepEqual(events.map(e => `${e.type}:${e.what}`), ['trip:start']);
  const o = flowMod.objectiveTarget()!;
  assert.equal(o.x, 40); assert.equal(o.name.zh, '市政厅', 'the waypoint names the leg end');
  // BAYBAY leads (the trip branch of the brain)
  updateGuide(clock);
  assert.equal(runtime.guide.state, 'lead');
  assert.ok(runtime.guide.target && Math.abs(runtime.guide.target.x - 40) < 3);
  // both there → the leg (and the trip) ends
  at(40, 0);
  updateGuide(clock); tick(100); updateGuide(clock);
  assert.ok(events.some(e => e.type === 'trip' && e.what === 'end'), 'trip end');
  assert.equal(flowMod.objectiveTarget(), null, 'no waypoint once arrived');
  frames(1); frames(40, 120);
  assert.equal(flow.get().trip, null, 'cleared after CLEAR_AFTER_MS');
});

test('trips: a new trip over a running one cancels it first; endTrip cancels; navigateTo / the week end the trip', () => {
  reset();
  flowMod.startTrip(walk({ x: 60, z: 0 }), { placeId: 'a' }, 'map');
  flowMod.startTrip(walk({ x: 0, z: 60 }), { placeId: 'b' }, 'card');
  assert.deepEqual(events.map(e => `${e.type}:${e.what}`), ['trip:start', 'trip:cancel', 'trip:start']);
  flowMod.endTrip();
  assert.equal(flow.get().trip, null);
  assert.equal(events.at(-1)?.what, 'cancel');
  flowMod.startTrip(walk({ x: 60, z: 0 }), { placeId: 'a' }, 'map');
  flowMod.startWeek();
  assert.equal(flow.get().trip, null, 'the week takes over');
});

test('trips: a city free lead is a one-leg walking trip; freeLeadArrived clears both; district free leads stay trip-less', () => {
  reset('city');
  const it = buildInteractables().find(i => i.source === 'poi')!;
  flowMod.startFreeLead(it.id);
  assert.equal(flow.get().freeLead, it.id);
  assert.equal(flow.get().trip?.source, 'free-lead');
  assert.equal(flow.get().trip?.legs[0].to.name?.zh, it.name.zh);
  at(it.x, it.z);
  updateGuide(clock); tick(100); updateGuide(clock);
  assert.equal(flow.get().freeLead, null, 'arrived');
  assert.ok(tripRun.tripStage() && events.some(e => e.what === 'end'));
  // district mode has no trip runner (game/cityContent only loads it in the city)
  offTrips();
  reset('district');
  flowMod.startFreeLead(it.id);
  assert.equal(flow.get().trip, null, 'district free leads unchanged');
  tripRun.initTripRun();
});

test('trips: a line leg leads to the stop, offers the pre-filled boarding, or walks when the line does not run; a ride that ends early walks on', async () => {
  reset();
  // the ride node formats (lane F's cc: / fl:, lane T's ln:)
  const run = () => true;
  assert.equal(tripRun.rideNodeFor({ line: 'california', board: 'powell-california', alight: 'california-drumm' }, run), 'flow.ride.cc:california:powell-california:california-drumm');
  assert.equal(tripRun.rideNodeFor({ line: 'sf-loop', board: 'loop-castro', alight: 'loop-twin-peaks' }, run), 'flow.ride.ln:sf-loop:loop-castro:loop-twin-peaks');
  assert.equal(tripRun.rideNodeFor({ line: 'streetcar', board: 'ferry', alight: 'f-market-church' }, run), 'flow.ride.fl:ferry:f-market-church');
  assert.equal(tripRun.rideNodeFor({ line: 'n-judah', board: 'muni-9th-irving', alight: 'muni-judah-la-playa' }), null, 'no station interactable yet: not running');
  // a trip whose ride is on a line that is not running here: at the stop BAYBAY walks on instead
  const board = { x: 10, z: 0, station: 'loop-castro', name: { zh: '卡斯特罗', en: 'Castro' } };
  const alight = { x: 200, z: 0, station: 'loop-twin-peaks', name: { zh: '双峰', en: 'Twin Peaks' } };
  const option = {
    mode: 'line' as const, seconds: 90,
    legs: [
      { via: 'walk' as const, from: { x: 0, z: 0 }, to: board, seconds: 3, length: 12 },
      { via: 'line' as const, line: 'sf-loop', board: 'loop-castro', alight: 'loop-twin-peaks', wait: 15, stops: 1, from: board, to: alight, seconds: 70, length: 190 },
    ],
  };
  flowMod.startTrip(option, { placeId: 'twin-peaks' }, 'map');
  at(10, 0); updateGuide(clock); tick(100); updateGuide(clock);
  const t = flow.get().trip!;
  assert.equal(t.legs.length, 1, 'the line is not running: the rest is one walk');
  assert.equal(t.legs[0].via, 'walk');
  // the same trip on a running line: the boarding question, then a ride that ends 150 u short walks on
  const offStation = registerInteractables('test-loop', () => [{ id: 'transit-loop-castro', source: 'transit', action: 'streetcar', verb: { zh: '上观光巴士', en: 'Board' }, name: board.name, x: 10, z: 0, radius: 4.2 }]);
  setInteractables(buildInteractables());
  at(0, 0);
  flowMod.startTrip(option, { placeId: 'twin-peaks' }, 'map');
  at(10, 0); updateGuide(clock); tick(100); updateGuide(clock); updateGuide(clock);
  // the loop / Metro board through lane T's dialogue (game/transit.ts boardLine with the pre-filled 'to')
  assert.equal(tripRun.tripStage(), 'board', 'at the stop: boarding (lane T)');
  assert.equal(flow.get().trip?.leg, 1, 'the ride leg waits for the bus');
  flowMod.closeDialogue();
  flow.set({ ride: { stage: 'riding', from: 'loop-castro', to: 'loop-twin-peaks', line: 'sf-loop', kind: 'bus' } });
  frames(2);
  assert.equal(tripRun.tripStage(), 'ride');
  assert.equal(flowMod.objectiveTarget()?.x, 200, 'riding: the waypoint is the alight stop');
  flow.set({ ride: null });
  at(50, 0);
  frames(2);
  assert.equal(flow.get().trip?.legs.length, 1, 'off early: the rest is a walk');
  assert.equal(flow.get().trip?.legs[0].to.x, 200);
  // and a ride that ends at its stop ends the leg
  flowMod.startTrip(option, { placeId: 'twin-peaks' }, 'map');
  flow.set({ trip: { ...flow.get().trip!, leg: 1 } });
  flow.set({ ride: { stage: 'riding', from: 'loop-castro', to: 'loop-twin-peaks', line: 'sf-loop', kind: 'bus' } });
  frames(2);
  flow.set({ ride: null }); at(205, 0); frames(2);
  assert.equal(events.at(-1)?.what, 'end');
  offStation();
  // lane C's own pre-filled boarding for the other lines (a running ferry here)
  const { setActiveFerrySystem } = await import('../src/opus-bay/data/transit');
  setActiveFerrySystem({ request: () => null, board() {}, cancel() {}, rideStatus: () => null, cars: [] });
  const ferry = {
    mode: 'line' as const, seconds: 90,
    legs: [{ via: 'line' as const, line: 'ferry', board: 'ferry-gate-e', alight: 'pier-41', wait: 30, stops: 1, from: { x: 0, z: 0, station: 'ferry-gate-e' }, to: { x: -300, z: 0, station: 'pier-41', name: { zh: '41 号码头', en: 'Pier 41' } }, seconds: 90, length: 300 }],
  };
  at(0, 0);
  flowMod.startTrip(ferry, { placeId: 'pier-41' }, 'map');
  updateGuide(clock); tick(100); updateGuide(clock); updateGuide(clock);
  assert.equal(game.get().dialogue.nodeId, 'flow.trip.board', 'the pre-filled boarding');
  const node = flowMod.nodeById('flow.trip.board')!;
  assert.match(node.choices![0].label.zh, /^上车 · 坐到 41 号码头（约 1 分钟）/);
  assert.equal(node.choices![0].next, 'flow.ride.fe:ferry-gate-e:pier-41');
  flowMod.closeDialogue();
  flowMod.endTrip();
  setActiveFerrySystem(null);
});

test('trips: the soft hint waits during a trip and for a minute after an arrival moment', () => {
  reset();
  game.set({ mode: 'free' });
  flowMod.startTrip(walk({ x: 500, z: 0 }), { placeId: 'far' }, 'map');
  for (let i = 0; i < 12; i++) { tick(1000); updateGuide(clock); }
  assert.equal(flow.get().freeHint, null);
  flowMod.endTrip();
  flowMod.noteArrivalMoment(clock);
  for (let i = 0; i < 30; i++) { tick(1000); updateGuide(clock); }
  assert.equal(flow.get().freeHint, null, 'quiet 30 s after the arrival');
  assert.ok(flowMod.lastArrivalAt() > 0);
});

test('goals: the three wave-4 goals count up from marks, never from another goal key', () => {
  const { CITY_GOAL, loopStopReached, campusArrived, metroRideCounts, goalProgress, SIGHTSEEING_STOPS: N, CAMPUS_TARGET } = goals;
  assert.equal(N, SIGHTSEEING_STOPS, 'one number with the tour data');
  let done: string[] = [];
  const stops = Object.keys(TOUR_GEO['sf-loop'].stations);
  for (let i = 0; i < N; i++) {
    const ids = loopStopReached(done, stops[i]);
    assert.equal(ids[0], `loop:${stops[i]}`);
    if (i < N - 1) { assert.equal(ids.length, 1); assert.equal(goalProgress(CITY_GOAL.sightseeing, [...done, ...ids]), `${i + 1}/${N}`); }
    else assert.deepEqual(ids.slice(1), [CITY_GOAL.sightseeing], 'the 8th stop completes it');
    done = [...done, ...ids];
  }
  assert.deepEqual(loopStopReached(done, stops[0]), [], 'a stop counts once');
  done = [];
  for (const id of ['sf-state-university', 'ucsf-parnassus', 'ccsf-ocean-campus']) done.push(...campusArrived(done, id));
  assert.ok(done.includes(CITY_GOAL.campuses) && done.filter(d => d.startsWith('campus:')).length === CAMPUS_TARGET);
  assert.deepEqual(campusArrived([], 'city-hall'), [], 'not a campus');
  assert.equal(metroRideCounts('n-judah', 'muni-9th-irving', 'muni-judah-la-playa', 547, 3), true);
  assert.equal(metroRideCounts('n-judah', 'muni-judah-sunset', 'muni-judah-la-playa', 120, 1), false, 'under 150 u');
  assert.equal(metroRideCounts('m-ocean-view', 'muni-church', 'muni-19th-holloway', null, 5), true, 'arc unknown: stops made');
  assert.equal(metroRideCounts('m-ocean-view', 'muni-church', 'muni-castro', 90, 1), false, 'not a goal end');
  assert.equal(metroRideCounts('n-judah', null, 'muni-judah-la-playa', 900, 4), false, 'boarding not seen');
});

test('save v2: tours and arrivals decode as untrusted input (shape, caps, ids)', () => {
  const s = save.decodeSave(JSON.stringify({
    version: 2,
    tours: { 'sf-grand': { chapter: 2.7, stop: -3, completed: ['bay-start', 'bay-start', 'BAD ID', 7, 'coast-sutro'], express: 'yes' }, 'x y': { chapter: 1 }, ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`t${i}`, { chapter: 99 }])) },
    arrivals: ['sf-state-university', 'corona-heights-randall-museum@summit', 'Bad Key', 3, 'sf-state-university'],
  }))!;
  assert.deepEqual(s.tours!['sf-grand'], { chapter: 2, stop: 0, completed: ['bay-start', 'coast-sutro'] });
  assert.equal(Object.keys(s.tours!).length, save.MAX_TOUR_SAVES);
  assert.ok(!('x y' in s.tours!));
  assert.equal(s.tours!.t0.chapter, 32, 'clamped');
  assert.deepEqual(s.arrivals, ['sf-state-university', 'corona-heights-randall-museum@summit']);
  assert.equal(save.decodeSave({ version: 2, tours: [], arrivals: 'x' })!.tours, undefined);
  assert.equal(save.decodeArrivals(Array.from({ length: 900 }, (_, i) => `a${i}`))!.length, save.MAX_ARRIVALS);
});

test('progress save: goalsDone keeps 128 ids; a city tour in game.tour never replaces the first lesson’s progress', () => {
  reset();
  const many = Array.from({ length: 150 }, (_, i) => `hood:z${i}`);
  const stored = new Map<string, string>();
  setStorageForTests({ getItem: k => stored.get(k) ?? null, setItem: (k, v) => { stored.set(k, v); }, removeItem: k => { stored.delete(k); } });
  try {
    stored.set('opus-bay:progress:v1', JSON.stringify({ v: 1, postcards: [], goalsDone: many, tour: { stop: 3, completed: ['ferry-building', 'farmers-market'] }, viewpointUnlocked: false, settings: {} }));
    assert.equal(readProgress()!.goalsDone.length, GOALS_DONE_MAX);
    assert.equal(GOALS_DONE_MAX, 128);
    game.set({ tour: { active: false, stop: 3, completed: ['ferry-building', 'farmers-market'], id: DEFAULT_TOUR_ID } });
    districtTourProgress();
    game.set({ tour: { active: true, stop: 5, completed: ['bay-start', 'bay-ride-ggb'], id: GRAND_TOUR.id } });
    const snap = snapshotProgress(game.get());
    assert.deepEqual(snap.tour.completed, ['ferry-building', 'farmers-market'], 'the first lesson’s stops');
    assert.equal(snap.tour.stop, 3);
    assert.equal(flowMod.currentStop(), null, 'no first-lesson stop while the city tour holds game.tour');
  } finally { setStorageForTests(null); }
});

test('the Grand Tour copy in the main graph equals the lazy tour data (welcome sub, call menu, resume label)', () => {
  assert.deepEqual(GRAND_TOUR.subtitle, SF_GRAND.subtitle);
  assert.equal(GRAND_TOUR.id, SF_GRAND.id);
  assert.deepEqual(GRAND_TOUR.name, SF_GRAND.name);
  const m = minutesLabel(SF_GRAND.minutes);
  assert.equal(GRAND_TOUR.call.zh, `带我环游旧金山（${m.zh}）`);
  assert.equal(GRAND_TOUR.call.en, `Take me round San Francisco (${m.en})`);
  for (const n of [1, 3, 5]) assert.deepEqual(GRAND_TOUR.resume(n), tourResumeLabel(SF_GRAND, { chapter: n - 1, stop: 0, completed: ['bay-start'] }));
});

test('the Grand Tour: welcome → 完整版 / 快速版 → each stop a tour trip → arrive line + dwell → next; end keeps the progress; the call menu resumes it', async () => {
  reset('city');
  save.resetSaveCache();
  const cityTour = await import('../src/opus-bay/game/cityTour');
  cityTour.initCityTour();
  const moments = await import('../src/opus-bay/game/cityMoments');
  flowMod.startTour(GRAND_TOUR.id);
  assert.equal(game.get().dialogue.nodeId, 'flow.tour.sf-grand', '完整版 / 快速版 first');
  const node = flowMod.nodeById('flow.tour.sf-grand')!;
  assert.match(node.choices![0].label.zh, /^完整版 · 约 26 分钟/);
  assert.match(node.choices![1].label.zh, /^快速版 · 约 18 分钟/);
  flowMod.chooseDialogue(0);
  assert.equal(game.get().tour.id, GRAND_TOUR.id);
  assert.equal(game.get().tour.active, true);
  assert.equal(game.get().mode, 'tour');
  assert.equal(flow.get().trip?.source, 'tour', 'the first stop is a tour trip');
  assert.equal(cityTour.cityTourRun()?.stop, 'bay-start');
  flowMod.closeDialogue();
  // the first stop's trip ends (the brain lead): arrive line, dwell, then the next stop's trip (the bus leg)
  tripRun.dispatchTrip({ type: 'leg-arrived' });
  assert.equal(cityTour.cityTourRun()?.phase, 'dwell');
  assert.deepEqual(cityTour.cityTourRun()?.completed, ['bay-start']);
  assert.ok(moments.linesBusy(clock / 1000), 'the chapter intro / arrive line wait in the pacer');
  flowMod.tourNext();
  assert.equal(cityTour.cityTourRun()?.stop, 'bay-ride-ggb');
  const trip = flow.get().trip!;
  assert.ok(trip.legs.some(l => l.via === 'line' && l.line === 'sf-loop'), 'a sightseeing-bus leg');
  // the call menu while the tour runs: keep going / skip / end
  flowMod.openCallMenu();
  const call = flowMod.nodeById('flow.call')!;
  assert.deepEqual(call.choices!.slice(0, 3).map(c => c.label.zh.slice(0, 2)), ['继续', '跳过', '先不']);
  flowMod.closeDialogue();
  // 结束: the recap (a stop was done), the progress kept for "继续一日游 · 第 1 章"
  flowMod.endTour();
  assert.equal(game.get().panel.kind, 'recap');
  assert.equal(game.get().tour.active, false);
  assert.equal(game.get().tour.id, GRAND_TOUR.id, 'the recap reads the city tour');
  assert.deepEqual(save.readSave()!.tours![GRAND_TOUR.id].completed, ['bay-start']);
  flowMod.closePanel();
  game.set({ mode: 'free' });
  flowMod.openCallMenu();
  const menu = flowMod.nodeById('flow.call')!.choices!;
  const labels = menu.map(c => c.label.zh);
  assert.ok(labels.includes('继续一日游 · 第 1 章'), labels.join(' | '));
  assert.ok(menu.some(c => c.action?.type === 'start-tour' && !c.action.tourId && /湾区第一课/.test(c.label.zh)), 'Bay 101 stays in the city call menu');
  flowMod.closeDialogue();
  // resuming goes straight to the first open stop of the saved version
  flowMod.startTour(GRAND_TOUR.id);
  assert.equal(game.get().dialogue.nodeId, null, 'no version question on a resume');
  assert.equal(cityTour.cityTourRun()?.stop, 'bay-ride-ggb');
  flowMod.endTour();
  flowMod.closePanel();
  // the express version merges the skipped rides: the coast ride gets off at the windmill
  const coast = SF_GRAND.chapters[1].stops[0];
  const played = cityTour.playedStop(SF_GRAND, coast, true);
  assert.equal(played.leg.via === 'line' && played.leg.to, 'loop-ocean-beach-windmill');
  assert.equal(played.target, 'transit-loop-ocean-beach-windmill');
  // the first lesson in the city after the Grand Tour starts from its own progress
  flowMod.startTour();
  assert.equal(game.get().tour.id, DEFAULT_TOUR_ID);
  assert.ok(flowMod.currentStop(), 'Bay 101 runs');
  flowMod.endTour();
});

test('arrival moments: a hit sets flow.arrival, BAYBAY’s line goes through the pacer, campus marks count, the save keeps the seen ids', async () => {
  reset('city');
  save.resetSaveCache();
  const moments = await import('../src/opus-bay/game/cityMoments');
  const { ArrivalWatcher, arrivalAnchors } = await import('../src/opus-bay/game/arrival');
  const { ATTRACTIONS } = await import('../src/opus-bay/data/sf/attractions');
  const w = new ArrivalWatcher(arrivalAnchors(ATTRACTIONS));
  const sfsu = ATTRACTIONS.find(a => a.id === 'sf-state-university')!;
  const p = sfsu.arrival ?? sfsu;
  const hit = w.step({ x: p.x, z: p.z, now: clock, onFoot: true, busy: false, travelling: false })!;
  assert.equal(hit.anchor.attraction, 'sf-state-university');
  moments.applyArrival(hit, clock);
  const a = flow.get().arrival!;
  assert.equal(a.attraction, 'sf-state-university');
  assert.equal(a.toast?.zh, '抵达 · 旧金山州立大学');
  assert.ok(events.some(e => e.type === 'arrival'));
  assert.ok(game.get().goalsDone.includes('campus:sf-state-university'));
  assert.equal(flowMod.lastArrivalAt(), clock);
  // the line is said on the next pacer step (a bubble; a voice-line only for recorded clips)
  const offMoments = moments.initCityMoments();
  moments.clearLines();
  moments.applyArrival(new ArrivalWatcher(arrivalAnchors(ATTRACTIONS)).step({ x: p.x, z: p.z, now: clock, onFoot: true, busy: false, travelling: false })!, clock);
  frames(3, 250);
  assert.equal(flow.get().bubble?.text.zh, a.line?.zh, 'BAYBAY says the arrival line');
  // the ride narration and the ride goals from lane T's transit events
  moments.onTransit({ type: 'transit', what: 'approach', line: 'sf-loop', kind: 'bus', station: 'loop-palace-of-fine-arts' }, clock / 1000);
  moments.onTransit({ type: 'transit', what: 'arrive', line: 'sf-loop', kind: 'bus', station: 'loop-palace-of-fine-arts' }, clock / 1000);
  assert.ok(game.get().goalsDone.includes('loop:loop-palace-of-fine-arts'));
  moments.onTransit({ type: 'transit', what: 'board', line: 'n-judah', kind: 'light-rail', station: 'muni-9th-irving' }, clock / 1000);
  moments.onTransit({ type: 'transit', what: 'arrive', line: 'n-judah', kind: 'light-rail', station: 'muni-judah-la-playa' }, clock / 1000);
  assert.ok(game.get().goalsDone.includes('metro'), 'a real N ride to La Playa');
  moments.noteLoopRide('loop-castro', 'loop-chinatown');
  assert.ok(game.get().goalsDone.includes('loop:loop-twin-peaks') && game.get().goalsDone.includes('loop:loop-chinatown'), '直接到站 counts every stop of the ride');
  // the planner's goal rules: only the open goals
  const rules = moments.openGoalRules(game.get().goalsDone).map(r => r.goal);
  assert.ok(!rules.includes('metro') && rules.includes('cable-car'));
  offMoments();
});

test('place cards: the POI resolver opens a card by its id; a decorated row opens its card; refreshes patch a landmark card', async () => {
  const cards = await import('../src/opus-bay/game/cityCards');
  const { loadPlaceCards } = await import('../src/opus-bay/data/sf/placeCardTypes');
  const { placeCardTarget, attractionCardId } = await import('../src/opus-bay/data/sf/cityPois');
  const off = cards.initCityCards();
  const set = await loadPlaceCards();
  cards.applyCards(set);
  const japan = poiById('sf:japan-center')!;
  assert.equal(japan?.name.en, set.byId.get('japan-center')!.name.en);
  assert.ok(Math.abs(japan.position.x - -73.1) < 0.01, 'at the attraction’s arrival spot');
  const sfsu = poiById('sf:sf-state-university')!;
  assert.match(sfsu.realInfo!.photo!.src, /sf-state-small\.webp$/);
  assert.match(sfsu.realInfo!.photo!.credit, /Wikimedia Commons/);
  const row = { id: 'sf-state-university', name: { zh: 'x', en: 'x' }, kind: 'campus' as const };
  assert.deepEqual(placeCardTarget('sf:sf-state-university', id => (id === row.id ? row : undefined), cards.cardLookup(set)), { poi: 'sf:sf-state-university' });
  const lm = { id: 'japantown-peace-pagoda', name: { zh: 'x', en: 'x' }, kind: 'landmark' as const, landmark: 'peace-pagoda' };
  assert.deepEqual(placeCardTarget('sf:japantown-peace-pagoda', () => lm, cards.cardLookup(set)), { poi: 'sf:peace-pagoda' }, 'the landmark keeps its row');
  assert.equal(attractionCardId({ id: 'japan-center', placeId: 'japantown-peace-pagoda' }, cards.cardLookup(set)), 'sf:japan-center');
  assert.equal(attractionCardId({ id: 'twin-peaks', placeId: 'twin-peaks', landmarkId: 'twin-peaks' }, cards.cardLookup(set)), 'sf:twin-peaks');
  const poi = { id: 'sf:twin-peaks', name: { zh: '双峰', en: 'Twin Peaks' }, position: { x: 0, z: 0 }, radius: 4, interaction: { kind: 'info' as const, verb: { zh: 'a', en: 'a' } }, realInfo: { summary: { zh: 's', en: 's' }, tips: [{ zh: 't', en: 't' }], sourceUrl: 'https://x', verifiedAt: '2026-01-01', lat: 37.7, lng: -122.4 } };
  const r = set.refreshes['twin-peaks'];
  const out = cards.refreshedPoi(poi, r);
  assert.equal(out.realInfo!.tips[0].zh, r.status!.text.zh, 'the status first');
  assert.equal(out.realInfo!.verifiedAt, r.verifiedAt);
  off();
});
