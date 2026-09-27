import assert from 'node:assert/strict';
import test from 'node:test';

// Wave 4 · lane C · W4-C6 / W4-C1 (early, pure parts): arrival moments (game/arrival.ts), the trip state machine on
// the frozen TripState (game/trips.ts) and the Grand Tour recap model (ui/tourRecapModel.ts).

const arrival = await import('../src/opus-bay/game/arrival');
const { ArrivalWatcher, arrivalAnchors, arrivalBeats, ARRIVAL_MIN_R, HINT_QUIET_MS, HOP_OFF_GRACE_MS, POSTCARD_HINT } = arrival;
const trips = await import('../src/opus-bay/game/trips');
const { tripReducer, tripEvents, currentLeg, isArrived, legTarget, tripRemaining, walkLeg, freeLeadTrip, pickObjective, createTripStore, OBJECTIVE_ORDER } = trips;
const { tourStopOption, tourStationName } = await import('../src/opus-bay/game/tourTrips');
const { tripPillText: gTripPillText } = await import('../src/opus-bay/ui/guideText');
const { defaultArrivalLine } = arrival;
const { CITY_SUBJECT_FACTS } = await import('../src/opus-bay/data/sf/cityPois');
const { loadPlaceCards } = await import('../src/opus-bay/data/sf/placeCardTypes');
const fs = await import('node:fs');
const { ATTRACTIONS } = await import('../src/opus-bay/data/sf/attractions');
const { ARRIVAL_LINES } = await import('../src/opus-bay/data/sf/tourLines');
const { SF_GRAND, targetAt, tourStops, TOUR_GEO } = await import('../src/opus-bay/data/sf/tours');
const { tourRecapModel } = await import('../src/opus-bay/ui/tourRecapModel');
const { TRIP_MODES } = await import('../src/opus-bay/game/tripTypes');
type TripOption = import('../src/opus-bay/game/tripTypes').TripOption;
type ArrivalAnchor = import('../src/opus-bay/game/arrival').ArrivalAnchor;

const bi = (zh: string, en: string) => ({ zh, en });
const A = (id: string, x: number, z: number, rank: 1 | 2 | 3, extra: Partial<ArrivalAnchor> = {}): ArrivalAnchor => ({ attraction: id, place: `place-${id}`, rank, x, z, name: bi(id, id), ...extra });
const sample = (x: number, z: number, now: number, extra: Partial<Parameters<InstanceType<typeof ArrivalWatcher>['step']>[0]> = {}) => ({ x, z, now, onFoot: true, busy: false, travelling: false, ...extra });

// ---------------------------------------------------------------------------------------------------------------
// Arrival moments
// ---------------------------------------------------------------------------------------------------------------

test('arrival: the first arrival within max(12, r) on foot fires once; leaving past 1.6 × r re-arms it (first: false)', () => {
  const w = new ArrivalWatcher([A('palace', 0, 0, 1)]);
  assert.equal(w.step(sample(20, 0, 0)), null, 'outside 12 u');
  const hit = w.step(sample(ARRIVAL_MIN_R - 1, 0, 100))!;
  assert.ok(hit);
  assert.equal(hit.first, true);
  assert.equal(hit.via, 'foot');
  assert.deepEqual(hit.event, { type: 'arrival', place: 'place-palace', tier: 1, first: true, attraction: 'palace' });
  assert.equal(w.step(sample(5, 0, 200)), null, 'no repeat while inside');
  assert.equal(w.step(sample(16, 0, 300)), null, 'still armed-out on the edge (< 19.2 u)');
  assert.equal(w.step(sample(5, 0, 400)), null, 'came back without leaving far enough');
  w.step(sample(30, 0, 500));
  const again = w.step(sample(3, 0, 600))!;
  assert.equal(again.first, false, 'a later arrival is quiet');
  assert.deepEqual(w.seen(), ['palace']);
});

test('arrival: bikes / cars / transit do not count unless the player just hopped off; fast travel never; busy holds', () => {
  const w = new ArrivalWatcher([A('zoo', 0, 0, 2)]);
  assert.equal(w.step(sample(2, 0, 0, { onFoot: false })), null, 'riding past');
  assert.equal(w.step(sample(2, 0, 1000, { onFoot: false, hoppedOffAt: 1000 - HOP_OFF_GRACE_MS - 1 })), null, 'hopped off too long ago');
  assert.equal(w.step(sample(2, 0, 2000, { travelling: true })), null, 'fast travel');
  assert.equal(w.step(sample(2, 0, 3000, { busy: true })), null, 'a dialogue is open');
  const hit = w.step(sample(2, 0, 4000, { onFoot: false, hoppedOffAt: 3500 }))!;
  assert.equal(hit.via, 'hop-off');
  assert.equal(hit.first, true);
});

test('arrival: the nearest anchor wins where several overlap, and the neighbours do not fire right after', () => {
  const w = new ArrivalWatcher([A('de-young', 0, 0, 2), A('cal-academy', 10, 0, 2), A('far', 500, 0, 3)]);
  const hit = w.step(sample(7, 0, 0))!;
  assert.equal(hit.anchor.attraction, 'cal-academy');
  assert.equal(w.step(sample(6, 0, 100)), null, 'de Young was inside too: no second hit');
  assert.equal(w.step(sample(500, 3, 200))!.anchor.attraction, 'far', 'the spatial grid finds far anchors');
});

test('arrival: the higher tier wins over a nearer lower tier (a T3 neighbour never swallows a T1 moment)', () => {
  // synthetic: the T3 anchor is nearer, both are inside
  const w = new ArrivalWatcher([A('coit', 0, 0, 1, { panorama: true }), A('steps', 8, 0, 3)]);
  const hit = w.step(sample(7, 0, 0))!;
  assert.equal(hit.anchor.attraction, 'coit', 'T1 over the nearer T3');
  assert.equal(arrivalBeats(hit).panorama, true);
  assert.equal(w.step(sample(8, 0, 100)), null, 'the T3 inside too: no second moment');
  // only the T3 inside: it fires alone, and the T1 still fires later on the way up
  const w2 = new ArrivalWatcher([A('coit', 0, 0, 1), A('steps', 8, 0, 3)]);
  assert.equal(w2.step(sample(19, 0, 0))!.anchor.attraction, 'steps');
  assert.equal(w2.step(sample(3, 0, 100))!.anchor.attraction, 'coit');
  // the real pair: walking up the Greenwich Steps to Coit Tower gets Coit's moment
  const anchors = arrivalAnchors(ATTRACTIONS);
  const coit = anchors.find(a => a.attraction === 'coit-tower')!, steps = anchors.find(a => a.attraction === 'greenwich-steps')!;
  const w3 = new ArrivalWatcher(anchors);
  const mid = { x: (coit.x * 0.45 + steps.x * 0.55), z: (coit.z * 0.45 + steps.z * 0.55) };
  assert.ok(Math.hypot(mid.x - coit.x, mid.z - coit.z) <= ARRIVAL_MIN_R && Math.hypot(mid.x - steps.x, mid.z - steps.z) <= ARRIVAL_MIN_R, 'a spot inside both');
  assert.equal(w3.step(sample(mid.x, mid.z, 0))!.anchor.attraction, 'coit-tower');
});

test('arrival: islands you cannot walk to get no anchor (standing at the Pier 33 telescope is not arriving at Alcatraz)', () => {
  const anchors = arrivalAnchors(ATTRACTIONS);
  const off = ATTRACTIONS.filter(a => a.offWalk);
  assert.ok(off.some(a => a.id === 'alcatraz'), 'Alcatraz is off the walkable city');
  for (const a of off) assert.equal(anchors.find(x => x.attraction === a.id), undefined, `${a.id} has no arrival anchor`);
  const alca = ATTRACTIONS.find(a => a.id === 'alcatraz')!;
  const w = new ArrivalWatcher(anchors);
  const hit = w.step(sample(alca.arrival!.x, alca.arrival!.z, 0));
  assert.notEqual(hit?.anchor.attraction, 'alcatraz');
});

test('arrival lines: the built landmarks and the district places speak their card bark (not a silent moment)', async () => {
  await loadPlaceCards();
  const anchors = arrivalAnchors(ATTRACTIONS);
  const silent = anchors.filter(a => a.rank <= 2 && !defaultArrivalLine(a.attraction, a)).map(a => a.attraction).sort();
  // the only T1 / T2 places with no card anywhere (Requests: cards at integration)
  assert.deepEqual(silent, ['bay-bridge', 'marina-green']);
  const ggb = anchors.find(a => a.attraction === 'golden-gate-bridge')!;
  const line = arrivalBeats({ anchor: ggb, first: true, via: 'foot', event: { type: 'arrival', place: ggb.place, tier: 1, first: true, attraction: ggb.attraction } });
  assert.deepEqual(line.line, CITY_SUBJECT_FACTS['golden-gate-bridge'].fact, 'GGB: the landmark card bark, glossed');
  assert.equal(line.voice, null, 'no recorded clip for built landmarks (text bubble)');
  const coit = anchors.find(a => a.attraction === 'coit-tower')!;
  assert.ok(defaultArrivalLine(coit.attraction, coit)?.text.zh.includes('观景点'), 'Coit: the district POI bark');
  const md = anchors.find(a => a.attraction === 'mission-dolores')!;
  assert.equal(defaultArrivalLine(md.attraction, md)?.mood, 'thinking', 'a quiet landmark speaks softly');
});

test('arrival: the soft hint stays quiet 60 s after an arrival; seen ids survive a save', () => {
  const w = new ArrivalWatcher([A('x', 0, 0, 1)], ['x']);
  assert.equal(w.hintSuppressed(0), false);
  const hit = w.step(sample(0, 0, 1000))!;
  assert.equal(hit.first, false, 'seen in an earlier session');
  assert.equal(w.hintSuppressed(1000 + HINT_QUIET_MS - 1), true);
  assert.equal(w.hintSuppressed(1000 + HINT_QUIET_MS + 1), false);
});

test('arrival beats: T1 on foot gets the reveal; T2 no reveal; T3 and later arrivals are quiet; quiet places speak softly', () => {
  const w = new ArrivalWatcher([A('sf-state-university', 0, 0, 1), A('cal-academy', 100, 0, 2), A('tiny', 200, 0, 3), A('national-aids-memorial-grove', 300, 0, 3, { quiet: true }), A('mount-davidson', 400, 0, 2, { quiet: true, panorama: true })]);
  const t1 = arrivalBeats(w.step(sample(0, 0, 0))!, { postcardNear: true });
  assert.equal(t1.reveal, true);
  assert.deepEqual(t1.toast, bi('抵达 · sf-state-university', 'Arrived · sf-state-university'));
  assert.equal(t1.line?.zh, ARRIVAL_LINES['sf-state-university'].zh, 'the frozen arrival line');
  assert.equal(t1.voice, 'arrive-sf-state-university');
  assert.deepEqual(t1.postcardHint, POSTCARD_HINT);
  assert.equal(t1.stamp && t1.stampSound && t1.peek && t1.discover, true);
  assert.equal(arrivalBeats(w.step(sample(100, 0, 1))!).reveal, false, 'T2: no reveal camera');
  const t3 = arrivalBeats(w.step(sample(200, 0, 2))!);
  assert.equal(t3.toast, null); assert.equal(t3.peek, false); assert.equal(t3.line, null); assert.equal(t3.stamp, true);
  const quiet = arrivalBeats(w.step(sample(400, 0, 3))!);
  assert.equal(quiet.stampSound, false); assert.equal(quiet.mood, 'thinking'); assert.equal(quiet.reveal, false);
  assert.equal(quiet.panorama, true);
  assert.deepEqual(quiet.toast, bi('mount-davidson', 'mount-davidson'), 'no 抵达 fanfare');
  // reduced motion / low quality: no reveal
  const w2 = new ArrivalWatcher([A('p', 0, 0, 1)]);
  assert.equal(arrivalBeats(w2.step(sample(0, 0, 0))!, { reducedMotion: true }).reveal, false);
  // hopped off: no reveal (the ride camera is still settling), the rest of the moment plays
  const w3 = new ArrivalWatcher([A('p', 0, 0, 1)]);
  const hop = arrivalBeats(w3.step(sample(0, 0, 10, { onFoot: false, hoppedOffAt: 5 }))!);
  assert.equal(hop.reveal, false); assert.equal(hop.peek, true);
});

test('arrival anchors from lane P\'s ATTRACTIONS: arrival spot, place id, tone', () => {
  const anchors = arrivalAnchors(ATTRACTIONS);
  assert.equal(anchors.length, ATTRACTIONS.filter(a => !a.offWalk).length);
  assert.equal(anchors.find(a => a.attraction === 'painted-ladies' || a.attraction === 'alamo-square-painted-ladies')!.landmark, 'painted-ladies');
  const stones = anchors.find(a => a.attraction === 'stonestown-galleria')!;
  const src = ATTRACTIONS.find(a => a.id === 'stonestown-galleria')!;
  assert.equal(stones.x, src.arrival?.x ?? src.x);
  assert.equal(stones.place, src.placeId ?? src.id);
  assert.equal(anchors.find(a => a.attraction === 'st-ignatius-church')!.quiet, true);
  // every new T1 / T2 attraction's arrival line is a frozen tourLines line
  for (const a of ATTRACTIONS.filter(x => x.rank <= 2)) if (ARRIVAL_LINES[a.id]) assert.equal(ARRIVAL_LINES[a.id].id, `arrive-${a.id}`);
});

// ---------------------------------------------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------------------------------------------

const opt = (): TripOption => {
  const a = walkLeg({ x: 0, z: 0 }, { x: 42, z: 0, station: 'loop-castro' });
  const ride = { via: 'line' as const, line: 'sf-loop', board: 'loop-castro', alight: 'loop-twin-peaks', wait: 15, stops: 1, from: { x: 42, z: 0, station: 'loop-castro' }, to: { x: 42, z: 200, station: 'loop-twin-peaks' }, seconds: 90, length: 674 };
  const b = walkLeg({ x: 42, z: 200 }, { x: 30, z: 240, place: 'twin-peaks' });
  return { mode: 'line', legs: [a, ride, b], seconds: a.seconds + 90 + b.seconds };
};

test('trips: start → leg → end; skip, replan, cancel, clear; the events of each transition', () => {
  const o = opt();
  const s0 = tripReducer(null, { type: 'start', placeId: 'twin-peaks', attraction: 'twin-peaks', option: o, now: 5, source: 'map' })!;
  assert.equal(s0.leg, 0); assert.equal(s0.legs, o.legs); assert.equal(s0.startedAt, 5); assert.equal(s0.source, 'map');
  assert.deepEqual(tripEvents(null, s0, { type: 'start', placeId: 'twin-peaks', option: o, now: 5 }), [{ type: 'trip', what: 'start', place: 'twin-peaks', mode: 'line', leg: 0 }]);
  assert.equal(currentLeg(s0)!.via, 'walk');
  assert.deepEqual(legTarget(currentLeg(s0)), { x: 42, z: 0, station: 'loop-castro' });
  const s1 = tripReducer(s0, { type: 'leg-arrived' })!;
  assert.deepEqual(tripEvents(s0, s1, { type: 'leg-arrived' }), [{ type: 'trip', what: 'leg', place: 'twin-peaks', mode: 'line', leg: 1 }]);
  assert.deepEqual(legTarget(currentLeg(s1), 'approach'), { x: 42, z: 0, station: 'loop-castro' }, 'lead to the boarding stop first');
  assert.deepEqual(legTarget(currentLeg(s1), 'underway'), { x: 42, z: 200, station: 'loop-twin-peaks' });
  // the point keeps its name for the waypoint label
  const named = walkLeg({ x: 0, z: 0 }, { x: 5, z: 0, place: 'p', name: bi('双峰', 'Twin Peaks') });
  assert.deepEqual(legTarget(named), { x: 5, z: 0, place: 'p', name: bi('双峰', 'Twin Peaks') });
  const s2 = tripReducer(s1, { type: 'skip-leg' })!;
  const s3 = tripReducer(s2, { type: 'leg-arrived' })!;
  assert.equal(isArrived(s3), true);
  assert.deepEqual(tripEvents(s2, s3, { type: 'leg-arrived' }), [{ type: 'trip', what: 'end', place: 'twin-peaks', mode: 'line' }]);
  assert.equal(tripReducer(s3, { type: 'leg-arrived' }), s3, 'arrived stays arrived');
  assert.deepEqual(tripEvents(s3, null, { type: 'cancel' }), [], 'no cancel after the end');
  assert.equal(tripReducer(s3, { type: 'clear' }), null);
  // replan keeps the destination, restarts the legs
  const walk: TripOption = { mode: 'walk', legs: [walkLeg({ x: 0, z: 0 }, { x: 30, z: 240 })], seconds: 60 };
  const r = tripReducer(s1, { type: 'replan', option: walk })!;
  assert.equal(r.placeId, 'twin-peaks'); assert.equal(r.leg, 0); assert.equal(r.option.mode, 'walk');
  // a new trip over an unfinished one cancels it first
  assert.deepEqual(tripEvents(s1, r, { type: 'start', placeId: 'x', option: walk, now: 9 }).map(e => e.what), ['cancel', 'start']);
  assert.deepEqual(tripEvents(s1, null, { type: 'cancel' }), [{ type: 'trip', what: 'cancel', place: 'twin-peaks', mode: 'line' }]);
  assert.equal(tripReducer(null, { type: 'start', placeId: 'x', option: { mode: 'walk', legs: [], seconds: 0 }, now: 0 }), null, 'no empty trips');
  // every TripMode is a valid option mode for the pill
  assert.ok(TRIP_MODES.includes(o.mode));
});

test('trips: honest remaining time, the free lead as a one-leg walking trip; the pill words are lane G\'s', () => {
  const s = tripReducer(null, { type: 'start', placeId: 'twin-peaks', option: opt(), now: 0 })!;
  const total = s.legs.reduce((a, l) => a + l.seconds, 0);
  assert.ok(Math.abs(tripRemaining(s) - total) < 1e-9);
  assert.ok(Math.abs(tripRemaining(s, 0.5) - (total - s.legs[0].seconds / 2)) < 1e-9);
  assert.equal(tripRemaining(tripReducer(tripReducer(tripReducer(s, { type: 'leg-arrived' }), { type: 'leg-arrived' }), { type: 'leg-arrived' })), 0);
  // W4-C review: lane C kept its own pill / time words with other rounding; lane G's ui/guideText is the one rule
  assert.equal('tripPillText' in trips, false);
  assert.equal('durationText' in trips, false);
  const pill = gTripPillText(s, tripRemaining(s), { compact: true, destination: bi('旧金山州立大学', 'SF State') });
  assert.ok(pill.title.zh.length > 0);
  const lead = freeLeadTrip({ x: 0, z: 0 }, { x: 84, z: 0, place: 'city-hall' }, 7);
  assert.equal(lead.source, 'free-lead'); assert.equal(lead.legs.length, 1); assert.equal(lead.option.mode, 'walk');
  assert.ok(Math.abs(lead.legs[0].seconds - (84 * 1.25) / 4.2) < 1e-9, 'straight × 1.25 at 4.2 u/s');
  assert.equal(lead.legs[0].estimate, true);
});

test('trips: objectiveTarget priority freeLead > trip > tour > week > mapTarget > freeHint; the store', () => {
  assert.deepEqual([...OBJECTIVE_ORDER], ['freeLead', 'trip', 'tour', 'week', 'mapTarget', 'freeHint']);
  assert.equal(pickObjective({ freeHint: {}, trip: {}, tour: true }), 'trip');
  assert.equal(pickObjective({ freeLead: 'x', trip: {} }), 'freeLead');
  assert.equal(pickObjective({ mapTarget: 'x', freeHint: {} }), 'mapTarget');
  assert.equal(pickObjective({ trip: null, tour: false }), null);
  const store = createTripStore();
  let calls = 0;
  const off = store.subscribe(() => { calls++; });
  const ev = store.dispatch({ type: 'start', placeId: 'p', option: opt(), now: 0 });
  assert.equal(ev[0].what, 'start'); assert.equal(calls, 1);
  assert.deepEqual(store.dispatch({ type: 'clear' }), []);
  assert.equal(store.get(), null); assert.equal(calls, 2);
  off();
  store.dispatch({ type: 'start', placeId: 'p', option: opt(), now: 0 });
  assert.equal(calls, 2, 'unsubscribed');
});

test('trips: every Grand Tour stop converts into a trip option (walk, or walk → wait → ride) with named points', () => {
  let prev = targetAt('transit-loop-ferry-building')!;
  for (const c of SF_GRAND.chapters) for (const stop of c.stops) {
    const o = tourStopOption(stop, prev)!;
    assert.ok(o, `${stop.id} converts`);
    assert.ok(o.seconds > 0 || stop.id === 'bay-start' || stop.moment === 'deck', `${stop.id} takes time`);
    if (stop.leg.via === 'line') {
      const ride = o.legs.at(-1)!;
      assert.equal(ride.via, 'line');
      if (ride.via === 'line') {
        assert.equal(ride.board, stop.leg.from); assert.equal(ride.alight, stop.leg.to);
        assert.ok(ride.stops >= 1);
        if (stop.leg.line === 'm-ocean-view' && stop.leg.from === 'muni-church') assert.equal(ride.underground, true);
        // lane G's pill reads leg.to.name ("下一站 名称"): every ride end and boarding point is named
        assert.ok(ride.to.name?.zh && ride.from.name?.zh, `${stop.id}: named stations`);
        assert.deepEqual(ride.to.name, tourStationName(stop.leg.to));
      }
    } else assert.equal(o.mode, 'walk');
    if (!stop.optional) prev = targetAt(stop.target)!;
  }
  // targets are named by the integration's resolver (interactableById(target).name)
  const vista = SF_GRAND.chapters[0].stops.find(s => s.id === 'bay-vista')!;
  const o = tourStopOption(vista, prev, t => (t === vista.target ? bi('游客中心', 'Welcome Center') : null))!;
  assert.equal(o.legs[0].to.name?.zh, '游客中心');
});

test('trips.ts stays light: no runtime import of the tour data (flow.ts, the main graph, imports it)', () => {
  const src = fs.readFileSync(new URL('../src/opus-bay/game/trips.ts', import.meta.url), 'utf8');
  const runtimeImports = src.split('\n').filter(l => /^import (?!type )/.test(l));
  assert.ok(runtimeImports.every(l => !/data\/sf\/(tours|tourLines|placeCards)/.test(l)), runtimeImports.join('\n'));
});

// ---------------------------------------------------------------------------------------------------------------
// The recap model
// ---------------------------------------------------------------------------------------------------------------

test('recap model: the route in line colours, chapters counted, complete when every stop is done', () => {
  const none = tourRecapModel(SF_GRAND, []);
  const total = SF_GRAND.chapters.reduce((n, c) => n + c.stops.filter(s => !s.optional).length, 0);
  assert.equal(none.total, total); assert.equal(none.done, 0); assert.equal(none.complete, false);
  assert.ok(none.segments.some(s => s.color === '#2f6fb0') && none.segments.some(s => s.color === '#2f8f5b') && none.segments.some(s => s.color === '#e0563f'), 'loop, N and M drawn');
  assert.ok(none.segments.every(s => /^M-?[\d.]+ -?[\d.]+(L-?[\d.]+ -?[\d.]+)+$/.test(s.d)), 'valid path data');
  const [x, z, w, h] = none.viewBox.split(' ').map(Number);
  assert.ok(w > 700 && h > 1300 && x < -700 && z < 0, `the sketch spans the city (${none.viewBox})`);
  const all = SF_GRAND.chapters.flatMap(c => c.stops.map(s => s.id));
  const full = tourRecapModel(SF_GRAND, all);
  assert.equal(full.complete, true); assert.equal(full.done, total);
  assert.ok(full.chapters.every(c => c.done === c.total));
  const one = tourRecapModel(SF_GRAND, SF_GRAND.chapters[0].stops.map(s => s.id));
  assert.equal(one.chapters[0].done, one.chapters[0].total); assert.equal(one.chapters[1].done, 0);
});

test('recap model, express: a finished express run is complete (the skipped side stops are not "missing")', () => {
  const expressIds = tourStops(SF_GRAND, { express: true }).map(f => f.stop.id);
  const ex = tourRecapModel(SF_GRAND, expressIds, undefined, true);
  assert.equal(ex.complete, true, 'express complete');
  assert.equal(ex.total, expressIds.length);
  assert.equal(tourRecapModel(SF_GRAND, expressIds).complete, false, 'the same ids are not the full tour');
  // the express sketch rides GGB → the windmill (expressTo) and never walks to the skipped Sutro Baths
  const windmill = TOUR_GEO['sf-loop'].stations['loop-ocean-beach-windmill'];
  assert.ok(ex.segments.some(s => s.color === '#e0563f' && s.d.endsWith(`L${Math.round(windmill.x * 10) / 10} ${Math.round(windmill.z * 10) / 10}`)), 'the merged bus ride ends at the windmill');
  const sutro = targetAt('sf:sutro-baths')!;
  assert.ok(!ex.dots.some(d => Math.hypot(d.x - sutro.x, d.y - sutro.z) < 1), 'no dot at the skipped Sutro Baths');
});
