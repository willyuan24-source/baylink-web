import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave-2 day-0 contracts (docs/opus-bay/sf-w2-contracts.md). FROZEN with the contracts: the hooks every lane codes
 * against exist, are harmless while empty, and keep the district exactly as it was. Lanes test their own fillings in
 * their own test files.
 *
 * Registries are checked RELATIVE to what is registered when the test starts (a lane may register from its own
 * init code), with ids no lane uses; nothing here pins a count that a lane's filling is expected to change.
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
const { game, initialGameState, syncMovePatch } = await import('../src/opus-bay/core/store');
const { POSTCARDS, activePostcardCount, activePostcardTotal, allPostcardsFound } = await import('../src/opus-bay/data/postcards');
const inter = await import('../src/opus-bay/game/interactables');
const flowMod = await import('../src/opus-bay/game/flow');
const transit = await import('../src/opus-bay/game/transit');
const { flow } = await import('../src/opus-bay/game/flowStore');
const registry = await import('../src/opus-bay/game/systemsRegistry');
const platform = await import('../src/opus-bay/actors/platform');
const view = await import('../src/opus-bay/actors/view');
const { npcDefsFor } = await import('../src/opus-bay/actors/npcs');
const moveApi = await import('../src/opus-bay/actors/moveApi');
const { input } = await import('../src/opus-bay/core/input');
const l0 = await import('../src/opus-bay/world/sf/l0index');
const { TypedBatch } = await import('../src/opus-bay/world/typedBatch');
const { TOY, patchToyShader } = await import('../src/opus-bay/world/materials');
const { ASSETS, SF_KIT, SF_KIT_IDS, VOICE_CLIPS, listAssetUrls } = await import('../src/opus-bay/data/assets');
const { SF_VOICE_CLIPS } = await import('../src/opus-bay/data/voiceLinesSf');
const { DISTRICT } = await import('../src/opus-bay/data/district');

test('store: any transit line counts as riding (cable car, ferry), and riding alone keeps the line', () => {
  const s = initialGameState();
  assert.equal(syncMovePatch(s, { move: { mode: 'transit', line: 'powell-hyde', spot: 'rail' } }).riding, 'streetcar');
  assert.equal(syncMovePatch(s, { move: { mode: 'transit', line: 'ferry', spot: 'deck' } }).riding, 'streetcar');
  const onCable = { ...s, riding: 'streetcar' as const, move: { mode: 'transit' as const, line: 'powell-hyde', spot: 'rail' as const } };
  assert.equal(syncMovePatch(onCable, { riding: 'streetcar' }).move, undefined, 'the cable-car line is kept');
  assert.deepEqual(syncMovePatch(onCable, { riding: null }).move, { mode: 'foot' });
  assert.equal(syncMovePatch(onCable, { move: { mode: 'foot' } }).riding, null);
});

test('postcard counts only count the active set', () => {
  const ids = POSTCARDS.map(c => c.id);
  assert.equal(activePostcardTotal(), POSTCARDS.length);
  assert.equal(activePostcardCount([...ids.slice(0, 2), 'sf-some-city-card']), 2);
  assert.equal(allPostcardsFound(ids.slice(1)), false);
  assert.equal(allPostcardsFound([...ids, 'sf-some-city-card']), true);
});

test('interactables: registered sources append (deduped), the extra resolver and subject resolvers answer the rest', () => {
  const base = inter.buildInteractables();
  const epoch = inter.interactablesEpoch();
  let fired = 0;
  const unsub = inter.subscribeInteractables(() => { fired++; });
  const station: import('../src/opus-bay/game/interactables').Interactable = { id: 'transit-test', source: 'transit', action: 'streetcar', verb: { zh: '上车', en: 'Board' }, name: { zh: '站', en: 'Stop' }, x: 1, z: 2, radius: 3, refId: 'test' };
  const off = inter.registerInteractables('test', () => [station, { ...station }, { ...base[0] }]);
  assert.ok(inter.interactablesEpoch() > epoch && fired === 1);
  const list = inter.buildInteractables();
  assert.equal(list.length, base.length + 1, 'one new id, duplicates skipped');
  assert.equal(list[list.length - 1].id, 'transit-test');
  off();
  assert.equal(inter.buildInteractables().length, base.length);
  unsub();

  inter.setInteractables(base);
  assert.equal(inter.interactableById('place:contract-test'), undefined);
  inter.setExtraResolver(id => (id.startsWith('place:') ? { ...station, id, source: 'place', action: 'info' } : undefined));
  assert.equal(inter.interactableById('place:contract-test')?.source, 'place');
  assert.equal(inter.interactables().some(it => it.id === 'place:contract-test'), false, 'resolved places are not offered for E');
  inter.setExtraResolver(null);

  assert.equal(inter.subjectPosition('contract-test-subject'), null);
  const offSubject = inter.registerSubjectResolver(s => (s === 'contract-test-subject' ? { x: 1, y: 2, z: 3 } : null));
  assert.deepEqual(inter.subjectPosition('contract-test-subject'), { x: 1, y: 2, z: 3 });
  assert.ok(inter.subjectPosition('alcatraz'), 'district subjects still resolve first');
  offSubject();
});

test('transit: the ride section moved to game/transit.ts, flow re-exports it; the HUD label is the old F-line text', () => {
  assert.equal(flowMod.boardStreetcar, transit.boardStreetcar);
  assert.equal(flowMod.hopOffRide, transit.hopOffRide);
  assert.equal(flowMod.finishRide, transit.finishRide);
  assert.equal(flowMod.cancelRide, transit.cancelRide);
  const stop = DISTRICT.streetcar.stops[0];
  const label = transit.rideLabel({ stage: 'waiting', from: 'x', to: stop.id, eta: 3 });
  assert.deepEqual(label.waiting, { zh: '等电车进站…约 3 秒', en: 'Waiting for the streetcar… ~3s' });
  assert.deepEqual(label.lineTo, { zh: 'F 线电车 · 开往', en: 'F-line · to' });
  assert.deepEqual(label.dest, stop.name);
  assert.deepEqual(transit.transitInteractables(), []);
  assert.deepEqual(transit.rideLog(), {});
  // the district goal words are unchanged: no FREE_GOALS id maps to the new keys
  assert.equal(flowMod.goalKeyOf('streetcar'), 'streetcar');
  assert.equal(flowMod.goalKeyOf('cable-car'), 'cable-car');
  assert.deepEqual(flowMod.goalIdsFor('cable-car'), []);
  assert.deepEqual(flowMod.goalIdsFor('ferry'), []);
  // a ride through the stepper still ends at the stop (stepTransit replaces the Ticker's inline code)
  flowMod.boardStreetcar('');
  assert.equal(flow.get().ride, null);
});

test('systems registry: ordered frame steps, stable scene snapshots, extra click proxies', () => {
  const calls: string[] = [];
  const offB = registry.registerFrameSystem('b', () => calls.push('b'), 2);
  const offA = registry.registerFrameSystem('a', () => calls.push('a'), 1);
  const offBad = registry.registerFrameSystem('bad', () => { throw new Error('boom'); }, 0);
  registry.stepFrameSystems(0.016, 0);
  assert.deepEqual(calls, ['a', 'b'], 'ordered, and a throwing step does not stop the others');
  offA(); offB(); offBad();
  registry.stepFrameSystems(0.016, 0);
  assert.equal(calls.length, 2);

  const snap = registry.sceneSystems();
  const scenes0 = snap.length;
  assert.equal(registry.sceneSystems(), snap, 'same array until something changes');
  const Comp = () => null;
  const off = registry.registerSceneSystem('contract-test', Comp);
  assert.notEqual(registry.sceneSystems(), snap);
  assert.equal(registry.sceneSystems().find(s => s.key === 'contract-test')?.Component, Comp);
  off();
  assert.equal(registry.sceneSystems().length, scenes0);

  const it = { ...inter.buildInteractables()[0], id: 'contract-test' };
  assert.deepEqual(registry.extraProxies(it), []);
  const offP = registry.registerProxySource(x => (x.id === it.id ? [{ x: 0, y: 5, z: 0, r: 3 }] : null));
  assert.deepEqual(registry.extraProxies(it), [{ x: 0, y: 5, z: 0, r: 3 }]);
  const e0 = registry.systemsRegistryEpoch();
  registry.invalidateProxies();
  assert.ok(registry.systemsRegistryEpoch() > e0, 'invalidateProxies makes Systems rebuild the click proxies');
  offP();
});

test('actors: platform stop requests, obstacle sources, residents from npcDefsFor, moveApi before the bind', () => {
  assert.equal(platform.platformStop('cable-1'), null);
  platform.requestPlatformStop('cable-1', 1.2);
  const r = platform.platformStop('cable-1');
  assert.ok(r && r.hold && r.within === 1.2 && r.since >= 0);
  platform.releasePlatformStop('cable-1');
  assert.equal(platform.platformStop('cable-1'), null);

  const out: { x: number; z: number; r: number; kind: string }[] = [];
  const far = 1e6; // no lane has obstacles out here
  view.collectObstacles(out, far, far, 8);
  assert.equal(out.length, 0);
  const offObs = view.registerObstacleSource((o, x, z) => { o.push({ x: x + 1, z, r: 0.4, kind: 'crowd' }); });
  view.collectObstacles(out, far, far, 8);
  assert.deepEqual(out, [{ x: far + 1, z: far, r: 0.4, kind: 'crowd' }]);
  offObs();

  assert.deepEqual(npcDefsFor('district').map(d => d.id), ['npc-vendor', 'npc-fisher', 'npc-jogger', 'npc-family', 'npc-family-kid', 'npc-streetcar'], 'district residents unchanged');
  assert.deepEqual(npcDefsFor('district').filter(d => d.talks !== false).map(d => d.id).sort(), ['npc-family', 'npc-fisher', 'npc-jogger', 'npc-streetcar', 'npc-vendor']);

  assert.equal(moveApi.driveTo({ x: 0, z: 0 }), false);
  assert.deepEqual(moveApi.fleetSnapshot(), {});
  assert.equal(moveApi.glideUnlocked(), false);
  const before = input.hopOffCount;
  moveApi.requestHopOff();
  assert.equal(input.hopOffCount, before + 1);
});

test('l0index: recorded ranges tile the building triangles; hide / restore is a round trip', () => {
  const b = new TypedBatch(64);
  const rec = new l0.L0Recorder();
  const c = new THREE.Color('#ffffff');
  const quad = (x: number) => {
    const v = [b.vert(x, 0, 0, 0, 1, 0, c), b.vert(x + 1, 0, 0, 0, 1, 0, c), b.vert(x + 1, 0, 1, 0, 1, 0, c), b.vert(x, 0, 1, 0, 1, 0, c)];
    (b as unknown as { index3(a: number, b: number, c: number): void }).index3(v[0], v[1], v[2]);
    (b as unknown as { index3(a: number, b: number, c: number): void }).index3(v[0], v[2], v[3]);
  };
  const desc = (x: number): import('../src/opus-bay/world/sf/l0index').L0BuildingDesc => ({ osmId: 1e10 + x, style: 0, roof: 1, flags: 0, baseY: 2, H: 5, wall: [1, 0.5, 0.25], poly: [{ x, z: 0 }, { x: x + 1, z: 0 }, { x: x + 1, z: 1 }, { x, z: 1 }], front: 0, slope: 0.3 });
  for (const x of [0, 4, 8]) { rec.begin(b); quad(x); rec.end(b, desc(x)); }
  rec.begin(b); rec.end(b, desc(20)); // wrote nothing: not recorded
  const res = rec.result()!;
  assert.equal(res.count, 3);
  assert.deepEqual([...res.ranges], [0, 6, 6, 6, 12, 6]);
  const v = l0.l0Building(res, 1);
  assert.equal(v.osmId, 1e10 + 4, 'OSM ids survive as f64');
  assert.ok(Math.abs(v.cx - 4.5) < 1e-6 && Math.abs(v.cz - 0.5) < 1e-6 && v.hasFront && v.H === 5);
  assert.equal(l0.l0Transferables(res).length, 3);
  const near: number[] = [];
  l0.l0Near(res, 4.5, 0.5, 1, k => near.push(k));
  assert.deepEqual(near, [1]);

  const geo = TypedBatch.toGeometry(b.toArrays());
  const before = Array.from(geo.getIndex()!.array);
  const hidden = new Map() as import('../src/opus-bay/world/sf/l0index').L0Hidden;
  assert.ok(l0.setRangeHidden(geo, res, 1, true, hidden));
  assert.ok(!l0.setRangeHidden(geo, res, 1, true, hidden), 'already hidden');
  const mid = Array.from(geo.getIndex()!.array);
  assert.deepEqual(mid.slice(0, 6), before.slice(0, 6));
  assert.ok(mid.slice(6, 12).every(i => i === mid[6]), 'degenerate');
  assert.ok(l0.setRangeHidden(geo, res, 1, false, hidden));
  assert.deepEqual(Array.from(geo.getIndex()!.array), before);
});

test('materials: patchToyShader is exactly the TOY patch (district programs unchanged)', () => {
  const lib = THREE.ShaderLib.standard;
  const fresh = () => ({ vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, uniforms: {} }) as unknown as import('three').WebGLProgramParametersWithUniforms;
  const a = fresh(), b2 = fresh();
  TOY.onBeforeCompile(a, undefined as unknown as import('three').WebGLRenderer);
  patchToyShader(b2, { sway: true });
  assert.equal(a.vertexShader, b2.vertexShader);
  assert.equal(a.fragmentShader, b2.fragmentShader);
  assert.equal(TOY.customProgramCacheKey(), 'ob-toy');
});

test('assets: the SF house kit is registered; the H2b modules merge in empty', () => {
  assert.equal(SF_KIT_IDS.length, 11);
  for (const id of SF_KIT_IDS) {
    const k = SF_KIT[id];
    assert.ok(k.url.endsWith(`/models/sf/kit/${id}.glb`) && k.mask.endsWith(`/models/sf/kit/${id}-mask.webp`));
    assert.equal(ASSETS.models[id], k);
    assert.ok(k.styles.length > 0 && k.triangles < 3000);
  }
  const urls = listAssetUrls();
  assert.ok(urls.includes('/opus-bay/models/sf/kit/deco-apartment.glb'));
  assert.equal(new Set(urls).size, urls.length);
  // ASSETS.voice = the district clips merged with lane H2b's SF_VOICE_CLIPS (a city line or a re-record), nothing else
  assert.deepEqual(Object.keys(ASSETS.voice).sort(), [...new Set([...Object.keys(VOICE_CLIPS), ...Object.keys(SF_VOICE_CLIPS)])].sort());
  for (const [id, clip] of Object.entries(SF_VOICE_CLIPS)) assert.ok(urls.includes(clip.m4a) && urls.includes(clip.ogg), id);
  assert.equal(game.get().worldMode, 'district');
});

// --- wave 4 day 0 (docs/opus-bay/sf-w4-lead.md §4): the new frozen hooks ---

test('wave 4: transit kinds + approach, the arrival / trip events travel the bus', async () => {
  const events = await import('../src/opus-bay/core/events');
  assert.deepEqual([...events.TRANSIT_KINDS], ['streetcar', 'cable-car', 'ferry', 'bus', 'light-rail']);
  assert.deepEqual([...events.TRANSIT_WHATS], ['bell', 'board', 'depart', 'arrive', 'ride', 'grip', 'push', 'turned', 'horn', 'hop-aside', 'approach']);
  const got: import('../src/opus-bay/core/events').GameEvent[] = [];
  const off = events.onEvent(e => { if (e.type === 'arrival' || e.type === 'trip' || (e.type === 'transit' && e.what === 'approach')) got.push(e); });
  events.emit({ type: 'arrival', place: 'sf-state-university', tier: 1, first: true, attraction: 'sf-state-university' });
  events.emit({ type: 'trip', what: 'start', place: 'palace-of-fine-arts', mode: 'line' });
  events.emit({ type: 'trip', what: 'leg', place: 'palace-of-fine-arts', mode: 'line', leg: 1 });
  events.emit({ type: 'transit', what: 'approach', line: 'sf-loop', kind: 'bus', station: 'palace-of-fine-arts', attraction: 'palace-of-fine-arts' });
  off();
  assert.deepEqual(got.map(e => e.type), ['arrival', 'trip', 'trip', 'transit']);
});

test('wave 4: game.tour.id defaults to the first lesson whoever writes `tour`; FIRST_TOUR is unchanged', async () => {
  const { DEFAULT_TOUR_ID, tourIdOf } = await import('../src/opus-bay/core/store');
  const { FIRST_TOUR, FIRST_TOUR_PASSES } = await import('../src/opus-bay/data/tours');
  assert.equal(DEFAULT_TOUR_ID, 'first-lesson');
  assert.equal(FIRST_TOUR.id, DEFAULT_TOUR_ID);
  const s = initialGameState();
  assert.deepEqual(s.tour, { active: false, stop: 0, completed: [], id: 'first-lesson' });
  assert.equal(syncMovePatch(s, { tour: { active: true, stop: 2, completed: [] } }).tour?.id, 'first-lesson', 'a district writer (no id)');
  assert.equal(syncMovePatch(s, { tour: { active: true, stop: 0, completed: [], id: 'sf-grand' } }).tour?.id, 'sf-grand');
  assert.equal('tour' in syncMovePatch(s, { focus: 'x' }), false, 'no tour key is added to other patches');
  assert.equal(tourIdOf({ active: false, stop: 0, completed: [] }), 'first-lesson');
  assert.equal(tourIdOf({ active: false, stop: 0, completed: [], id: 'sf-grand' }), 'sf-grand');
  const before = game.get().tour;
  game.set({ tour: { active: false, stop: 1, completed: ['x'] } });
  assert.equal(game.get().tour.id, 'first-lesson');
  game.set(st => ({ tour: { ...st.tour, id: 'sf-grand' } }));
  game.set(st => ({ tour: { ...st.tour, active: false } }));
  assert.equal(game.get().tour.id, 'sf-grand', 'a spread keeps the id');
  game.set({ tour: before });

  const stop = (poiId: string) => ({ poiId, arriveNode: `tour.${poiId}.arrive`, doneNode: `tour.${poiId}.done` });
  assert.equal(JSON.stringify(FIRST_TOUR), JSON.stringify({
    id: 'first-lesson', name: { zh: '湾区第一课', en: 'Bay 101' }, introNode: 'tour.intro', outroNode: 'tour.outro',
    stops: ['ferry-building', 'farmers-market', 'pier7', 'exploratorium', 'filbert-steps', 'coit-tower', 'sea-lions'].map(stop),
  }), 'FIRST_TOUR byte-identical (hero regression of the district tour)');
  assert.deepEqual([...FIRST_TOUR_PASSES], ['levis-plaza', 'pier33']);
});

test('wave 4: trip types (game/tripTypes.ts) and attraction types (data/sf/attractionTypes.ts) are exported', async () => {
  const trip = await import('../src/opus-bay/game/tripTypes');
  assert.deepEqual([...trip.TRIP_MODES], ['walk', 'run', 'bike', 'car', 'line', 'fly']);
  assert.deepEqual(Object.keys(trip.TRIP_MODE_NAMES), [...trip.TRIP_MODES]);
  for (const m of trip.TRIP_MODES) assert.ok(trip.TRIP_MODE_NAMES[m].zh && trip.TRIP_MODE_NAMES[m].en, m);
  // the shapes lanes G / C / P / T code against (types are erased here; this documents a valid value)
  const walk: import('../src/opus-bay/game/tripTypes').TripLeg = { via: 'walk', from: { x: 128, z: 16, place: 'ferry-building' }, to: { x: 132, z: 80, station: 'embarcadero' }, seconds: 16, length: 66 };
  const ride: import('../src/opus-bay/game/tripTypes').TripLeg = { via: 'line', line: 'm-ocean-view', board: 'embarcadero', alight: 'winston', from: walk.to, to: { x: 195.2, z: 1471.5 }, seconds: 75, length: 1420, wait: 12, stops: 12, dir: 1, underground: true };
  const option: import('../src/opus-bay/game/tripTypes').TripOption = { mode: 'line', legs: [walk, ride], seconds: 91, recommended: true };
  const state: import('../src/opus-bay/game/tripTypes').TripState = { placeId: 'stonestown-galleria', attraction: 'stonestown-galleria', option, legs: option.legs, leg: 0, startedAt: 0, source: 'map' };
  assert.equal(state.legs.reduce((sum, l) => sum + l.seconds, 0), option.seconds);

  const at = await import('../src/opus-bay/data/sf/attractionTypes');
  assert.deepEqual([...at.ATTRACTION_RANKS], [1, 2, 3]);
  assert.deepEqual([...at.ATTRACTION_CATS], ['landmark', 'museum', 'park', 'viewpoint', 'coast', 'campus', 'shopping', 'sports', 'culture', 'neighbourhood']);
  assert.deepEqual(Object.keys(at.ATTRACTION_CAT_STYLE), [...at.ATTRACTION_CATS]);
  assert.deepEqual(Object.keys(at.ATTRACTION_AREAS), ['north-downtown', 'bridge-presidio', 'coast', 'park-sunset', 'twin-peaks-mission', 'south']);
  assert.deepEqual([...at.ATTRACTION_TREATMENTS], ['ai', 'proc', 'plaza', 'card', 'stop', 'defer']);
  assert.deepEqual({ ...at.ATTRACTION_FLAG_H }, { min: 28, max: 70 });
  const lucide = await import('lucide-react') as unknown as Record<string, unknown>;
  for (const glyph of at.ATTRACTION_GLYPHS) assert.ok(lucide[glyph], `lucide-react exports ${glyph}`);
  for (const cat of at.ATTRACTION_CATS) {
    const st = at.ATTRACTION_CAT_STYLE[cat];
    assert.match(st.color, /^#[0-9a-f]{6}$/, cat);
    assert.ok((at.ATTRACTION_GLYPHS as readonly string[]).includes(st.glyph) && st.name.zh && st.name.en, cat);
  }
  const sfsu: import('../src/opus-bay/data/sf/attractionTypes').Attraction = {
    id: 'sf-state-university', name: { zh: '旧金山州立大学', en: 'San Francisco State University' }, short: { zh: '州立大学', en: 'SF State' },
    cat: 'campus', rank: 1, x: 198.2, z: 1555.6, arrival: { x: 198.4, z: 1555.9 }, aliases: ['SFSU', '州大', '大学'], flag: { x: 198.2, z: 1555.6, h: 30 },
    area: 'south', siteId: 'sfsu', treatment: 'proc', priority: 1,
  };
  assert.ok(sfsu.flag!.h >= at.ATTRACTION_FLAG_H.min && sfsu.flag!.h <= at.ATTRACTION_FLAG_H.max);
});

// --- wave 4 integration (docs/opus-bay/sf-w4-lead.md §6 + §8): the deferred frozen items the lead landed ---

test('wave 4 integration: flow.trip and flow.arrival start null; the transit event carries dir; start-tour takes a tour id', async () => {
  const { initialFlowState } = await import('../src/opus-bay/game/flowStore');
  assert.equal(initialFlowState().trip, null);
  assert.equal(initialFlowState().arrival, null);
  assert.equal(flow.get().trip, null, 'no trip at start');
  assert.equal(flow.get().arrival, null, 'no arrival moment at start');
  assert.ok('trip' in flow.get() && 'arrival' in flow.get(), 'both keys exist on the live store');

  const events = await import('../src/opus-bay/core/events');
  const got: import('../src/opus-bay/core/events').GameEvent[] = [];
  const off = events.onEvent(e => { if (e.type === 'transit') got.push(e); });
  events.emit({ type: 'transit', what: 'approach', line: 'n-judah', kind: 'light-rail', station: 'muni-carl-cole', dir: -1 });
  events.emit({ type: 'transit', what: 'arrive', line: 'sf-loop', kind: 'bus', station: 'loop-palace-of-fine-arts' });
  off();
  assert.deepEqual(got.map(e => (e.type === 'transit' ? e.dir : 'x')), [-1, undefined], 'dir travels the bus; absent when unknown');

  // the shapes lane C codes against (types are erased here; this documents valid values)
  const tourChoice: import('../src/opus-bay/core/types').DialogueAction = { type: 'start-tour', tourId: 'sf-grand' };
  const districtChoice: import('../src/opus-bay/core/types').DialogueAction = { type: 'start-tour' };
  assert.equal(tourChoice.type, districtChoice.type);
});

test('wave 4 integration: SfPlaceKind absorbed the wave-4 kinds and every kind has a card name', async () => {
  const { SF_PLACE_KINDS_W4 } = await import('../src/opus-bay/world/sf/format');
  const { PLACE_KIND_NAMES } = await import('../src/opus-bay/data/sf/cityPois');
  assert.deepEqual([...SF_PLACE_KINDS_W4], ['campus', 'shopping', 'zoo', 'religious']);
  assert.deepEqual(SF_PLACE_KINDS_W4.map(k => PLACE_KIND_NAMES[k]), [
    { zh: '校园', en: 'Campus' }, { zh: '购物中心', en: 'Shopping centre' }, { zh: '动物园', en: 'Zoo' }, { zh: '宗教场所', en: 'Place of worship' },
  ]);
  for (const [kind, name] of Object.entries(PLACE_KIND_NAMES)) assert.ok(name.zh && name.en, kind);
  const zoo: import('../src/opus-bay/world/sf/format').SfPlace['kind'] = 'zoo';
  assert.equal(zoo, 'zoo');
});

test('landmark helpers (D2, world/sf/landmarks/context.ts): glide tall structures, world arrival anchors, plaza spots', async () => {
  const ctx = await import('../src/opus-bay/world/sf/landmarks/context');
  const tall = ctx.landmarkTallStructures(l => (typeof l.base === 'number' ? l.base : 0));
  assert.ok(tall.length > 0 && tall.every(t => typeof t.id === 'string' && Number.isFinite(t.x + t.z + t.top) && t.r > 0));
  assert.ok(tall.filter(t => t.id === 'golden-gate-bridge').length >= 2, 'the Golden Gate Bridge by its towers');
  const a = ctx.sfLandmarkAnchor('golden-gate-bridge');
  assert.ok(a && Number.isFinite(a.x + a.z + a.heading));
  assert.equal(ctx.sfLandmarkAnchor('no-such-landmark'), null);
  assert.ok(Array.isArray(ctx.landmarkPlazaSpots()));
});

// --- wave 5 day 0 (docs/opus-bay/sf-w5-lead.md §4; plan sf-w5-plan.md §4.2 W5-0d): the frozen contracts ---

test('wave 5: the new GameEvent members travel the bus; FIND_KINDS and the reward source grammar are exact', async () => {
  const events = await import('../src/opus-bay/core/events');
  assert.deepEqual([...events.FIND_KINDS], ['egg', 'view', 'sound', 'pebble', 'cache', 'souvenir', 'nature']);
  assert.deepEqual([...events.REWARD_PREFIXES], ['arrive', 'postcard', 'favour', 'goal', 'egg', 'view', 'sound', 'pebble', 'cache', 'trail', 'ring', 'event', 'daily', 'page', 'medal', 'pelican']);
  assert.equal(events.REWARD_SOURCE.source, '^(arrive|postcard|favour|goal|egg|view|sound|pebble|cache|trail|ring|event|daily|page|medal|pelican):[a-z0-9:@-]{1,80}$', 'the plan §4.2 grammar, character for character');
  assert.equal(events.REWARD_SOURCE.flags, '');
  assert.equal(events.REWARD_SOURCE.source.slice(2, events.REWARD_SOURCE.source.indexOf(')')), events.REWARD_PREFIXES.join('|'), 'the prefix list is the grammar\'s');
  for (const ok of ['arrive:coit-tower', 'postcard:sf-painted-ladies', 'egg:telegraph-hill-parrots', 'trail:filbert-steps:3', 'daily:2026-10-03:1', 'medal:slides:2', 'arrive:coit-tower@summit', `cache:${'a'.repeat(80)}`, 'pelican:unlock']) {
    assert.ok(events.REWARD_SOURCE.test(ok), ok);
    assert.equal(events.rewardPrefix(ok), ok.slice(0, ok.indexOf(':')));
  }
  for (const bad of ['', 'coins:5', 'arrive:', 'arrive:Coit', 'arrive:coit tower', 'Arrive:coit', 'shop:scarf', `cache:${'a'.repeat(81)}`, 'arrive-coit', ' arrive:coit', 'egg:parrots\n']) {
    assert.equal(events.REWARD_SOURCE.test(bad), false, JSON.stringify(bad));
    assert.equal(events.rewardPrefix(bad), null);
  }
  const sample: import('../src/opus-bay/core/events').GameEvent[] = [
    { type: 'reward', source: 'arrive:coit-tower', coins: 10, stamp: 'coit-tower' },
    { type: 'coins', total: 52, delta: 10, source: 'arrive:coit-tower' },
    { type: 'find', kind: 'egg', id: 'telegraph-hill-parrots', first: true },
    { type: 'play', activity: 'slides', what: 'end', tier: 2 },
    { type: 'shop', what: 'buy', item: 'scarf-fog' },
    { type: 'realsf', what: 'event-enter', id: 'hardly-strictly-bluegrass-2026' },
    { type: 'stuck', x: 1, z: 2, what: 'pull' },
    { type: 'self-tap', who: 'baybay', double: true },
  ];
  const got: import('../src/opus-bay/core/events').GameEvent[] = [];
  const wanted = new Set(sample.map(e => e.type));
  const off = events.onEvent(e => { if (wanted.has(e.type)) got.push(e); });
  for (const e of sample) events.emit(e);
  off();
  assert.deepEqual(got, sample);
});

test('wave 5: game/playerLock.ts — the frozen API (holdLock releases once, lockHeld, lockReport, setLockRefresher)', async () => {
  const lock = await import('../src/opus-bay/game/playerLock');
  const { runtime } = await import('../src/opus-bay/core/runtime');
  const held0 = lock.lockReport().length;
  const release = lock.holdLock('activity', 'contract-test');
  assert.equal(lock.lockHeld(), true);
  assert.equal(runtime.player.locked, true);
  const mine = lock.lockReport().filter(h => h.key === 'contract-test');
  assert.equal(mine.length, 1);
  assert.equal(mine[0].source, 'activity');
  assert.ok(Number.isFinite(mine[0].since));
  release();
  release();
  assert.equal(lock.lockReport().length, held0, 'released once, a second call does nothing');
  const sources: import('../src/opus-bay/game/playerLock').LockSource[] = ['dialogue', 'fishing', 'cinema', 'ride', 'phase', 'travel', 'panel', 'activity', 'shop'];
  for (const s of sources) lock.holdLock(s)();
  assert.equal(lock.lockReport().length, held0);
  assert.equal(typeof lock.setLockRefresher, 'function');
});

test('wave 5: game/bayNow.ts — Bay wall-clock parts, the ?date= parser, DST, no URL shift outside DEV / QA builds', async () => {
  const bay = await import('../src/opus-bay/game/bayNow');
  assert.equal(bay.BAY_TZ, 'America/Los_Angeles');
  // Mon Sep 28 2026 12:00 PDT
  assert.deepEqual(bay.bayParts(new Date('2026-09-28T19:00:00Z')), { year: 2026, month: 9, day: 28, hour: 12, minute: 0, weekday: 1, dateKey: '2026-09-28' });
  // the Bay date is not the UTC date in the evening
  assert.equal(bay.bayParts(new Date('2026-10-03T03:30:00Z')).dateKey, '2026-10-02');
  assert.equal(bay.bayParts(new Date('2026-10-03T03:30:00Z')).weekday, 5, 'a Friday evening in SF');
  // DST ends Sun Nov 1 2026 at 02:00 PDT: 01:30 happens twice
  assert.deepEqual([bay.bayParts(new Date('2026-11-01T08:30:00Z')).hour, bay.bayParts(new Date('2026-11-01T09:30:00Z')).hour], [1, 1]);
  assert.equal(bay.bayParts(new Date('2026-12-21T12:00:00Z')).hour, 4, 'PST in December');
  assert.equal(bay.parseBayDate('2026-10-03T10:30')?.toISOString(), '2026-10-03T17:30:00.000Z');
  assert.equal(bay.parseBayDate('2026-12-21T17:10')?.toISOString(), '2026-12-22T01:10:00.000Z');
  assert.equal(bay.parseBayDate('2026-11-01T01:30')?.toISOString(), '2026-11-01T08:30:00.000Z', 'a repeated minute: the first (daylight) one');
  assert.equal(bay.parseBayDate('2027-03-14T02:30')?.toISOString(), '2027-03-14T10:30:00.000Z', 'a skipped minute: an hour later (03:30 PDT)');
  for (const bad of ['', '2026-10-03', '2026-10-03T10:30:00', '2026-13-01T00:00', '2026-02-30T10:00', '2026-10-03T24:00', '2026-10-03T10:60', '1999-01-01T00:00', 'x2026-10-03T10:30']) assert.equal(bay.parseBayDate(bad), null, bad);
  // node is neither DEV nor a QA build: the URL never shifts the clock
  assert.equal(bay.bayDateOverrideAllowed(), false);
  const gl = globalThis as unknown as { location?: unknown };
  const hadLocation = 'location' in gl, oldLocation = gl.location;
  gl.location = { search: '?date=2020-01-01T00:00' };
  try {
    bay.__setBayNowForTests(null);
    assert.ok(Math.abs(bay.bayNow().getTime() - Date.now()) < 5000, 'production: the real time');
  } finally { if (hadLocation) gl.location = oldLocation; else delete gl.location; }
  // tests / node QA: a shifted clock runs on from the given Bay minute
  assert.equal(bay.__setBayNowForTests('2026-10-09T12:40'), true);
  const now = bay.bayParts();
  assert.deepEqual([now.year, now.month, now.day, now.hour, now.minute, now.weekday], [2026, 10, 9, 12, 40, 5]);
  assert.equal(bay.__setBayNowForTests('nonsense'), false);
  assert.equal(bay.bayParts().dateKey, '2026-10-09', 'a bad spec changes nothing');
  bay.__setBayNowForTests(null);
  assert.ok(Math.abs(bay.bayNow().getTime() - Date.now()) < 5000);
  const p = bay.bayParts();
  p.year = 1;
  assert.notEqual(bay.bayParts().year, 1, 'callers get a copy of the cached parts');
});
test('wave 5: data/playSave.ts — the frozen format, bitsets, decodePlay clamps untrusted input (fuzz)', async () => {
  const ps = await import('../src/opus-bay/data/playSave');
  assert.deepEqual([...ps.PLAY_BIT_KINDS], ['coin', 'cache', 'ring', 'egg', 'view', 'sound', 'pebble', 'stamp', 'own', 'souvenir', 'page']);
  assert.deepEqual([...ps.WEAR_SLOTS], ['baybay-scarf', 'baybay-hat', 'player-hat', 'player-pack', 'bike', 'car', 'pelican', 'frame']);
  assert.deepEqual([ps.MAX_COINS, ps.MAX_BITSET_CHARS, ps.MAX_PLAY_BITS, ps.MAX_BESTS, ps.MAX_ONE_OFFS, ps.MAX_ONE_OFF_CHARS], [999999, 256, 1536, 32, 128, 40]);
  // bitsets: LSB first, standard base64 alphabet, no padding, trailing zero bytes trimmed
  assert.equal(ps.bitSet(undefined, 0), 'AQ');
  assert.equal(ps.bitSet('', 7), 'gA');
  assert.equal(ps.bitSet('AQ', 8), 'AQE');
  assert.equal(ps.bitSet(undefined, 23), 'AACA');
  let b = '';
  const idx = [0, 1, 7, 8, 9, 63, 64, 500, 1000, 1535];
  for (const i of idx) b = ps.bitSet(b, i);
  for (let i = 0; i < ps.MAX_PLAY_BITS; i++) assert.equal(ps.bitGet(b, i), idx.includes(i), `bit ${i}`);
  assert.equal(ps.bitCount(b), idx.length);
  assert.ok(b.length <= ps.MAX_BITSET_CHARS);
  let full = '';
  for (let i = 0; i < ps.MAX_PLAY_BITS; i++) full = ps.bitSet(full, i);
  assert.equal(full.length, ps.MAX_BITSET_CHARS, '1,536 bits fill exactly 256 characters');
  assert.equal(ps.bitCount(full), ps.MAX_PLAY_BITS);
  for (const i of [-1, 1.5, ps.MAX_PLAY_BITS, Number.NaN]) { assert.equal(ps.bitSet('AQ', i), 'AQ', `out of range ${i}`); assert.equal(ps.bitGet(full, i), false); }
  for (const junk of ['!!', 'A', 'AQ==x', 'A'.repeat(257)]) { assert.equal(ps.bitGet(junk, 0), false, junk); assert.equal(ps.normalBits(junk), undefined, junk); }
  assert.equal(ps.normalBits('AQ=='), 'AQ', 'padding is accepted and normalised away');
  assert.equal(ps.normalBits('AQAA'), 'AQ', 'trailing zero bytes trimmed');

  const good = {
    v: 1, c: 42.9, g: { coin: 'AQ', egg: 'gA', bogus: 'AQ', view: '!!' }, t: { d: '2026-10-03', b: 'Bw' }, w: { 'baybay-scarf': 2, bike: 300, hat: 1 },
    b: { slides: 18.2, 'stairs:filbert': 95, 'Bad Key': 1, nan: Number.NaN }, d: { d: '2026-10-03', m: 5 }, e: ['favour:baker', 'favour:baker', 'shop:x', 'not a source', `egg:${'a'.repeat(40)}`],
  };
  const out = ps.decodePlay(good)!;
  assert.deepEqual(out, { v: 1, c: 42, g: { coin: 'AQ', egg: 'gA' }, t: { d: '2026-10-03', b: 'Bw' }, w: { 'baybay-scarf': 2 }, b: { slides: 18.2, 'stairs:filbert': 95 }, d: { d: '2026-10-03', m: 5 }, e: ['favour:baker', 'shop:x'] });
  assert.deepEqual(ps.decodePlay(JSON.parse(JSON.stringify(out))), out, 'round trip');
  for (const raw of [undefined, null, 1, 'x', [], {}, { v: 2 }, { v: '1' }]) assert.equal(ps.decodePlay(raw), undefined, JSON.stringify(raw));
  assert.equal(ps.decodePlay({ v: 1, c: -5 })!.c, 0);
  assert.equal(ps.decodePlay({ v: 1, c: 5e9 })!.c, ps.MAX_COINS);
  assert.equal(ps.decodePlay({ v: 1, c: Infinity })!.c, 0);
  assert.equal(Object.keys(ps.decodePlay({ v: 1, c: 0, b: Object.fromEntries(Array.from({ length: 99 }, (_, i) => [`k${i}`, i])) })!.b!).length, ps.MAX_BESTS);
  assert.equal(ps.decodePlay({ v: 1, c: 0, e: Array.from({ length: 300 }, (_, i) => `egg:e${i}`) })!.e!.length, ps.MAX_ONE_OFFS);
  assert.deepEqual(ps.emptyPlay(), { v: 1, c: 0, g: {} });

  // fuzz: never throws; the output is always valid and a fixed point of the decoder
  let seed = 11;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const junk = (): unknown => {
    const r = rnd();
    if (r < 0.08) return null;
    if (r < 0.16) return rnd() * 2e6 - 1e6;
    if (r < 0.22) return [Number.NaN, Infinity, -Infinity, -0, 2 ** 53][Math.floor(rnd() * 5)];
    if (r < 0.32) return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=!'.slice(Math.floor(rnd() * 60)).repeat(1 + Math.floor(rnd() * 6));
    if (r < 0.4) return [junk(), junk(), `egg:x${Math.floor(rnd() * 9)}`];
    if (r < 0.5) return { d: rnd() < 0.5 ? '2026-10-03' : junk(), b: junk(), m: junk() };
    if (r < 0.58) return true;
    if (r < 0.66) return { __proto__: { v: 1 }, constructor: 1 };
    if (r < 0.8) return Object.fromEntries([...ps.PLAY_BIT_KINDS, ...ps.WEAR_SLOTS].filter(() => rnd() < 0.3).map(k => [k, rnd() < 0.5 ? junk() : Math.floor(rnd() * 400)]));
    return `id-${Math.floor(rnd() * 99)}`;
  };
  const keys = ['v', 'c', 'g', 't', 'w', 'b', 'd', 'e'] as const;
  for (let i = 0; i < 3000; i++) {
    const s: Record<string, unknown> = JSON.parse(JSON.stringify(out));
    for (let m = 0; m < 1 + Math.floor(rnd() * 4); m++) {
      const k = keys[Math.floor(rnd() * keys.length)];
      if (k === 'v' && rnd() < 0.8) continue;
      if (rnd() < 0.5 && s[k] && typeof s[k] === 'object') { const o = s[k] as Record<string, unknown>; const ks = Object.keys(o); if (ks.length) o[ks[Math.floor(rnd() * ks.length)]] = junk(); }
      else s[k] = junk();
    }
    let p: ReturnType<typeof ps.decodePlay>;
    assert.doesNotThrow(() => { p = ps.decodePlay(rnd() < 0.3 ? JSON.parse(JSON.stringify(s)) : s); });
    const v = p!;
    if (!v) continue;
    assert.equal(v.v, 1);
    assert.ok(Number.isInteger(v.c) && v.c >= 0 && v.c <= ps.MAX_COINS);
    for (const [k, bits] of Object.entries(v.g)) { assert.ok((ps.PLAY_BIT_KINDS as readonly string[]).includes(k)); assert.equal(ps.normalBits(bits), bits); assert.ok(bits!.length <= ps.MAX_BITSET_CHARS && bits!.length > 0); }
    if (v.t) { assert.match(v.t.d, ps.PLAY_DATE_RE); assert.equal(ps.normalBits(v.t.b), v.t.b); }
    for (const [k, n] of Object.entries(v.w ?? {})) { assert.ok((ps.WEAR_SLOTS as readonly string[]).includes(k)); assert.ok(Number.isInteger(n) && n! >= 0 && n! <= ps.MAX_WEAR_INDEX); }
    assert.ok(Object.values(v.b ?? {}).every(Number.isFinite) && Object.keys(v.b ?? {}).length <= ps.MAX_BESTS);
    if (v.d) { assert.match(v.d.d, ps.PLAY_DATE_RE); assert.ok(Number.isInteger(v.d.m) && v.d.m >= 0 && v.d.m <= 255); }
    if (v.e) { assert.ok(v.e.length <= ps.MAX_ONE_OFFS && new Set(v.e).size === v.e.length); for (const id of v.e) assert.ok(id.length <= ps.MAX_ONE_OFF_CHARS && ps.ONE_OFF_RE.test(id)); }
    assert.deepEqual(ps.decodePlay(JSON.parse(JSON.stringify(v))), v, 'a fixed point');
  }
});

test('wave 5: data/save.ts — SaveV2.play is decoded; encodeSave trims discovered then arrivals and never drops play / unlocked / tours / lastSafe (the size test at every cap)', async () => {
  const sv = await import('../src/opus-bay/data/save');
  const ps = await import('../src/opus-bay/data/playSave');
  assert.deepEqual([sv.SAVE_MAX_BYTES, sv.SAVE_TRIM_DISCOVERED, sv.SAVE_TRIM_ARRIVALS, sv.MAX_DISCOVERED, sv.MAX_ARRIVALS, sv.MAX_TOUR_SAVES], [65536, 500, 128, 2000, 512, 8]);
  const s0 = sv.decodeSave({ version: 2, play: { v: 1, c: 12, g: { egg: 'AQ' } } })!;
  assert.deepEqual(s0.play, { v: 1, c: 12, g: { egg: 'AQ' } });
  assert.equal(sv.decodeSave({ version: 2, play: { v: 9, c: 12 } })!.play, undefined, 'an unknown play version is dropped, the save stays');
  assert.deepEqual(sv.decodeSave(sv.encodeSave(s0)), s0, 'round trip');

  // the largest play block the decoder lets through
  let bits = '';
  for (let i = 0; i < ps.MAX_PLAY_BITS; i++) bits = ps.bitSet(bits, i);
  const fullPlay = ps.decodePlay({
    v: 1, c: ps.MAX_COINS, g: Object.fromEntries(ps.PLAY_BIT_KINDS.map(k => [k, bits])), t: { d: '2026-10-03', b: bits },
    w: Object.fromEntries(ps.WEAR_SLOTS.map(k => [k, ps.MAX_WEAR_INDEX])), b: Object.fromEntries(Array.from({ length: ps.MAX_BESTS }, (_, i) => [`${'k'.repeat(36)}${String(i).padStart(4, '0')}`, -123456789.123456])),
    d: { d: '2026-10-03', m: 255 }, e: Array.from({ length: ps.MAX_ONE_OFFS }, (_, i) => `egg:${String(i).padStart(36, 'x')}`),
  })!;
  assert.equal(Object.keys(fullPlay.g).length, ps.PLAY_BIT_KINDS.length);
  assert.equal(fullPlay.e!.length, ps.MAX_ONE_OFFS);
  assert.equal(Object.keys(fullPlay.b!).length, ps.MAX_BESTS);
  const id = (n: number, len: number) => `${'p'.repeat(Math.max(0, len - 6))}${String(n).padStart(6, '0')}`.slice(-len);
  const tours = (len: number) => Object.fromEntries(Array.from({ length: sv.MAX_TOUR_SAVES }, (_, t) => [`t${t}${'x'.repeat(40)}`.slice(0, len), { chapter: 32, stop: 32, completed: Array.from({ length: 64 }, (_, k) => `s${String(k).padStart(2, '0')}${'y'.repeat(40)}`.slice(0, len)), express: true }]));
  const arrival = (n: number, len: number) => len > 64 ? `a${String(n).padStart(5, '0')}${'z'.repeat(58)}@${'s'.repeat(24)}` : `a${String(n).padStart(5, '0')}${'z'.repeat(58)}`.slice(0, len);
  for (const c of [{ name: 'realistic ids', idLen: 16, arrLen: 24, tourLen: 20 }, { name: 'the longest ids', idLen: 80, arrLen: 89, tourLen: 40 }]) {
    const save: import('../src/opus-bay/data/save').SaveV2 = {
      version: 2, lastSafe: { world: 'city', x: 120.5, z: 640, heading: 1, zone: 'mission' },
      discovered: Array.from({ length: sv.MAX_DISCOVERED }, (_, i) => id(i, c.idLen)),
      zones: Array.from({ length: sv.MAX_ZONES }, (_, i) => id(i, c.idLen)),
      rides: Object.fromEntries(Array.from({ length: sv.MAX_RIDE_LINES }, (_, i) => [id(i, c.idLen), 999999])),
      vehicles: { bike: { id: id(1, c.idLen), x: 1, z: 2, heading: 0 }, car: { x: 3, z: 4, heading: 0 } },
      unlocked: { glide: true }, tours: tours(c.tourLen), arrivals: Array.from({ length: sv.MAX_ARRIVALS }, (_, i) => arrival(i, c.arrLen)),
      play: fullPlay, savedAt: 1790000000000,
    };
    const input = sv.decodeSave(save)!;
    assert.equal(input.discovered!.length, sv.MAX_DISCOVERED, `${c.name}: the input sits at every cap`);
    assert.equal(input.arrivals!.length, sv.MAX_ARRIVALS, c.name);
    assert.equal(Object.keys(input.tours!).length, sv.MAX_TOUR_SAVES, c.name);
    const text = sv.encodeSave(input);
    assert.ok(text.length <= sv.SAVE_MAX_BYTES, `${c.name}: ${text.length} ≤ 64 KB`);
    const back = sv.decodeSave(text)!;
    assert.ok(back, `${c.name}: the written save reads back`);
    assert.deepEqual(back.play, input.play, `${c.name}: play kept whole`);
    assert.deepEqual(back.unlocked, { glide: true }, c.name);
    assert.deepEqual(back.tours, input.tours, `${c.name}: tours kept whole`);
    assert.deepEqual(back.lastSafe, input.lastSafe, c.name);
    assert.equal(back.savedAt, input.savedAt, c.name);
    // what was trimmed is the oldest part, in the plan's order (discovered first, then arrivals)
    if (back.discovered) assert.deepEqual(back.discovered, input.discovered!.slice(-back.discovered.length), `${c.name}: the newest discoveries kept`);
    if (back.arrivals) {
      if (back.arrivals.length < sv.MAX_ARRIVALS) assert.ok(!back.discovered || back.discovered.length <= sv.SAVE_TRIM_DISCOVERED, `${c.name}: arrivals are trimmed only after discovered`);
      assert.deepEqual(back.arrivals, input.arrivals!.slice(-back.arrivals.length), `${c.name}: the newest arrivals kept`);
    }
  }
  // realistic ids at the caps: only the discoveries are trimmed (to the newest 500), everything else stays
  const real = sv.decodeSave(sv.encodeSave(sv.decodeSave({
    version: 2, discovered: Array.from({ length: sv.MAX_DISCOVERED }, (_, i) => id(i, 24)), arrivals: Array.from({ length: sv.MAX_ARRIVALS }, (_, i) => arrival(i, 30)),
    tours: tours(20), play: fullPlay, unlocked: { glide: true }, lastSafe: { world: 'city', x: 0, z: 0, heading: 0 },
  })!))!;
  assert.equal(real.discovered!.length, sv.SAVE_TRIM_DISCOVERED);
  assert.equal(real.arrivals!.length, sv.MAX_ARRIVALS);
  // the essentials alone, at their longest, stay far below the cap
  const essentials = JSON.stringify({ version: 2, lastSafe: { world: 'district', x: -1024.123456789, z: 2176.123456789, heading: -3.14159265358979, zone: 'z'.repeat(80) }, unlocked: { glide: true }, tours: tours(40), play: fullPlay, savedAt: 1790000000000 });
  assert.ok(essentials.length < sv.SAVE_MAX_BYTES * 0.75, `the kept core is ${essentials.length} characters`);
});
test('wave 5: ui/slots.ts — registries (order, last wins, unregister), overlays, the Journal request, ask items', async () => {
  const slots = await import('../src/opus-bay/ui/slots');
  assert.deepEqual({ ...slots.JOURNAL_BUILTIN_ORDER }, { cards: 10, goals: 20, wish: 30, steps: 40 });
  assert.deepEqual({ ...slots.MORE_BUILTIN_ORDER }, { photo: 10, settings: 90 });
  const Icon = () => null;
  const base = slots.moreItems.list().length;
  let changes = 0;
  const unsub = slots.moreItems.subscribe(() => { changes++; });
  const offB = slots.registerMoreItem({ id: 'w5-test-b', order: 50, label: { zh: '乙', en: 'B' }, icon: Icon, onSelect: () => undefined });
  const offA = slots.registerMoreItem({ id: 'w5-test-a', order: 20, label: { zh: '甲', en: 'A' }, icon: Icon, onSelect: () => undefined });
  const snap = slots.moreItems.list();
  assert.equal(slots.moreItems.list(), snap, 'a stable snapshot until something changes');
  assert.deepEqual(snap.filter(m => m.id.startsWith('w5-test')).map(m => m.id), ['w5-test-a', 'w5-test-b'], 'by order');
  let picked = '';
  const offA2 = slots.registerMoreItem({ id: 'w5-test-a', order: 60, label: { zh: '甲2', en: 'A2' }, icon: Icon, onSelect: () => { picked = 'a2'; } });
  assert.deepEqual(slots.moreItems.list().filter(m => m.id.startsWith('w5-test')).map(m => m.id), ['w5-test-b', 'w5-test-a'], 'the same id again: the last wins');
  offA();
  assert.ok(slots.moreItems.get('w5-test-a'), 'the earlier unregister no longer removes the replacement');
  slots.runMoreItem('w5-test-a');
  assert.equal(picked, 'a2');
  offA2(); offB();
  assert.equal(slots.moreItems.list().length, base);
  assert.ok(changes >= 5);
  unsub();

  // overlays: only registered ids open; reopening moves to the top; Escape closes the most recent; unregistering closes
  const Comp = () => null;
  slots.openOverlay('w5-test-none');
  assert.equal(slots.openOverlays().some(o => o.id === 'w5-test-none'), false);
  const offO1 = slots.registerOverlay({ id: 'w5-test-o1', Component: Comp });
  const offO2 = slots.registerOverlay({ id: 'w5-test-o2', Component: Comp });
  slots.openOverlay('w5-test-o1', { n: 1 });
  slots.openOverlay('w5-test-o2');
  slots.openOverlay('w5-test-o1', { n: 2 });
  assert.deepEqual(slots.openOverlays().filter(o => o.id.startsWith('w5-test')), [{ id: 'w5-test-o2' }, { id: 'w5-test-o1', props: { n: 2 } }]);
  assert.equal(slots.closeTopOverlay(), true);
  assert.deepEqual(slots.openOverlays().map(o => o.id), ['w5-test-o2']);
  offO2();
  assert.deepEqual(slots.openOverlays(), [], 'unregistering an open overlay closes it');
  assert.equal(slots.closeTopOverlay(), false);
  offO1();

  // ask items: visible() asked each time (a throwing one hides its item); runAskItem contains a throwing onSelect
  let ran = 0;
  const offK1 = slots.registerAskItem({ id: 'w5-test-k1', order: -1, label: { zh: '挥手', en: 'Wave' }, icon: Icon, onSelect: () => { ran++; } });
  const offK2 = slots.registerAskItem({ id: 'w5-test-k2', order: 5, label: { zh: '带我去', en: 'Take me' }, icon: Icon, onSelect: () => { throw new Error('boom'); }, visible: () => { throw new Error('no'); } });
  assert.deepEqual(slots.visibleAskItems().filter(a => a.id.startsWith('w5-test')).map(a => a.id), ['w5-test-k1']);
  assert.equal(slots.runAskItem('w5-test-k1'), true);
  assert.equal(ran, 1);
  assert.equal(slots.runAskItem('w5-test-k2'), true, 'a throwing onSelect is contained');
  assert.equal(slots.runAskItem('w5-test-nope'), false);
  offK1(); offK2();

  // openJournal: flow binds the opener (panel 'journal' with the tab as its id); every request bumps seq
  const before = game.get().panel;
  const seq = slots.lastJournalRequest().seq;
  slots.openJournal('goals');
  assert.deepEqual(game.get().panel, { kind: 'journal', id: 'goals' });
  assert.deepEqual(slots.lastJournalRequest(), { tab: 'goals', seq: seq + 1 });
  slots.openJournal('goals');
  assert.equal(slots.lastJournalRequest().seq, seq + 2, 'the same tab again is a new request');
  flowMod.closePanel();
  game.set({ panel: before });
});

test('wave 5: the render points — the pill badge and the desktop 更多 (Hud), a registered Journal tab, the ask items in 问 BAYBAY, the act dispatch', async () => {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const slots = await import('../src/opus-bay/ui/slots');
  // the UI modules import their stylesheets: stub .css while loading them (as tests/opus-bay-sf-guide-review.test.ts)
  const { registerHooks } = await import('node:module');
  const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
  const { Hud } = await import('../src/opus-bay/ui/Hud');
  const { Journal } = await import('../src/opus-bay/ui/Journal');
  styles.deregister();
  const saved = { mode: game.get().mode, phase: game.get().phase, panel: game.get().panel };
  try {
    game.set({ mode: 'free', phase: 'playing' });
    const plain = renderToStaticMarkup(h(Hud));
    assert.doesNotMatch(plain, /ob-pill-badge|ob-hud-more/, 'nothing registered: the HUD is as before');
    const Coins = () => h('span', null, '🪙 42');
    const offBadge = slots.registerPillBadge({ id: 'w5-test-coins', order: 0, Component: Coins });
    const offMore = slots.registerMoreItem({ id: 'w5-test-shop', order: 50, label: { zh: '小铺', en: 'Shop' }, icon: () => null, onSelect: () => undefined });
    const withSlots = renderToStaticMarkup(h(Hud));
    assert.match(withSlots, /<em>[^<]*<\/em><span class="ob-pill-badges"><span class="ob-pill-badge"><span>🪙 42<\/span><\/span><\/span><\/strong>/, 'the badge sits inside the pill after 明信片 n/m');
    assert.match(withSlots, /class="ob-hud-more"/, 'desktop: the 更多 button appears with a registered item');
    offBadge(); offMore();
    assert.equal(renderToStaticMarkup(h(Hud)), plain, 'unregistered: exactly as before');

    const offTab = slots.registerJournalTab({ id: 'w5-test-today', order: 0, label: { zh: '今天', en: 'Today' }, icon: () => null, count: () => '3', load: async () => ({ default: () => null }) });
    game.set({ panel: { kind: 'journal', id: 'w5-test-today' } });
    const journal = renderToStaticMarkup(h(Journal));
    const tabs = [...journal.matchAll(/role="tab" aria-selected="(true|false)"[^>]*>(?:<svg[\s\S]*?<\/svg>)?<span>([^<]+)<\/span>/g)].map(m => `${m[2]}${m[1] === 'true' ? '*' : ''}`);
    assert.deepEqual(tabs.slice(0, 4), ['今天*', '明信片', '目标', '想去'], 'the registered tab by its order, opened on it through the panel id');
    assert.match(journal, /翻开中…/, 'its body is loading');
    offTab();
  } finally { game.set(saved); }

  // 问 BAYBAY: order < 0 on top, order ≥ 0 before 打开地图; choosing one runs it and closes the menu
  let chosen = '';
  const offTop = slots.registerAskItem({ id: 'w5-test-emote', order: -10, label: { zh: '跳个舞', en: 'Dance' }, icon: () => null, onSelect: () => { chosen = 'emote'; } });
  const offGo = slots.registerAskItem({ id: 'w5-test-go', order: 10, label: { zh: '带我去', en: 'Take me' }, icon: () => null, onSelect: () => { chosen = 'go'; } });
  const offHidden = slots.registerAskItem({ id: 'w5-test-hidden', order: 1, label: { zh: '藏', en: 'Hidden' }, icon: () => null, onSelect: () => undefined, visible: () => false });
  try {
    flowMod.openCallMenu();
    const menu = flowMod.nodeById(game.get().dialogue.nodeId)!;
    const labels = menu.choices!.map(c => c.label.zh);
    assert.equal(labels[0], '跳个舞');
    assert.ok(!labels.includes('藏'));
    assert.equal(labels.indexOf('带我去'), labels.indexOf('打开地图') - 1);
    assert.deepEqual(menu.choices![labels.indexOf('带我去')].action, { type: 'ask', id: 'w5-test-go' });
    flowMod.runAction({ type: 'ask', id: 'w5-test-go' });
    assert.equal(chosen, 'go');
    assert.equal(game.get().dialogue.nodeId, null, 'the menu closed');
  } finally { offTop(); offGo(); offHidden(); flowMod.closeDialogue(); }
  flowMod.openCallMenu();
  assert.equal(flowMod.nodeById(game.get().dialogue.nodeId)!.choices!.some(c => c.action?.type === 'ask'), false, 'nothing registered: no ask choice');
  flowMod.closeDialogue();

  // the act dispatch: the four new sources run act() (and nothing else); an old source never does
  assert.deepEqual([...flowMod.ACT_SOURCES].sort(), ['activity', 'event', 'find', 'shop']);
  const base = inter.interactables();
  const phase = game.get().phase;
  const acted: string[] = [];
  const mk = (id: string, source: import('../src/opus-bay/game/interactables').InteractableSource): import('../src/opus-bay/game/interactables').Interactable => ({ id, source, action: 'info', verb: { zh: '滑下去', en: 'Slide' }, name: { zh: '滑梯', en: 'Slides' }, x: 0, z: 0, radius: 2, act: () => { acted.push(id); } });
  try {
    game.set({ phase: 'playing' });
    inter.setInteractables([...base, mk('w5-test-activity', 'activity'), mk('w5-test-find', 'find'), mk('w5-test-shop', 'shop'), mk('w5-test-event', 'event'), mk('w5-test-poi', 'poi')]);
    for (const id of ['w5-test-activity', 'w5-test-find', 'w5-test-shop', 'w5-test-event', 'w5-test-poi']) flowMod.performInteraction(id);
    assert.deepEqual(acted, ['w5-test-activity', 'w5-test-find', 'w5-test-shop', 'w5-test-event']);
  } finally { inter.setInteractables(base); game.set({ phase }); }
});

test('wave 5: actors/charApi.ts — the frozen emote list; null until lane F registers', async () => {
  const ca = await import('../src/opus-bay/actors/charApi');
  assert.deepEqual([...ca.EMOTES], ['wave', 'cheer', 'clap', 'point', 'pose', 'dance', 'lie', 'sit', 'float', 'pet']);
  assert.equal(ca.charApi(), null);
  const calls: string[] = [];
  const stub: import('../src/opus-bay/actors/charApi').CharApi = {
    emote: (who, name) => { calls.push(`${who}:${name}`); }, sitGround: () => true, stand: () => undefined, attach: () => undefined,
    tint: () => undefined, vehiclePaint: () => undefined, glideSoftBox: () => undefined,
  };
  ca.setCharApi(stub);
  ca.charApi()?.emote('baybay', 'dance', { loop: true, seconds: 2 });
  assert.deepEqual(calls, ['baybay:dance']);
  ca.setCharApi(null);
  assert.equal(ca.charApi(), null);
});

test('wave 5: audio/hooks.ts — sounds and loops reach the bound engine only while live; audioNow; duck', async () => {
  const ah = await import('../src/opus-bay/audio/hooks');
  const ducks: [number, number][] = [];
  const ctx = { state: 'running', currentTime: 12.5 };
  const bus = () => ({ duck: (a: number, until: number) => { ducks.push([a, until]); } });
  const engine = { ctx, get now() { return ctx.currentTime; }, buses: { music: bus(), ambience: bus(), sfx: bus(), voice: bus() } } as unknown as import('../src/opus-bay/audio/engine').AudioEngine;
  const played: unknown[] = [];
  const off = ah.registerSound('w5-test-chime', (_e, opts) => { played.push(opts); });
  // before audio is live: nothing plays, and the clock is the performance clock (seconds)
  ah.playSound('w5-test-chime');
  assert.deepEqual(played, []);
  assert.ok(Math.abs(ah.audioNow() - performance.now() / 1000) < 1);
  let live = true;
  ah.bindAudioHooks(engine, () => live);
  ah.playSound('w5-test-chime', { gain: 0.5, pitch: 1.2 });
  ah.playSound('w5-test-unknown');
  assert.deepEqual(played, [{ gain: 0.5, pitch: 1.2 }]);
  assert.equal(ah.audioNow(), 12.5, 'AudioContext time while running');
  ah.duck('music', 0.4, 2000);
  assert.deepEqual(ducks, [[0.4, 14.5]]);
  live = false;
  ah.playSound('w5-test-chime');
  assert.equal(played.length, 1, 'sound off / suspended: nothing');
  live = true;
  const off2 = ah.registerSound('w5-test-bad', () => { throw new Error('recipe'); });
  assert.doesNotThrow(() => ah.playSound('w5-test-bad'));

  // loops: built on the first gain > 0, faded at the tick, stopped (released) after fading to 0
  const log: string[] = [];
  const offLoop = ah.registerLoop('w5-test-banjo', () => { log.push('build'); return { setGain: g => { log.push(`g${g.toFixed(2)}`); }, stop: () => { log.push('stop'); } }; });
  ah.stepAudioHooks(0.1);
  assert.deepEqual(log, [], 'gain 0: never built');
  ah.setLoop('w5-test-banjo', 1, 200);
  ah.stepAudioHooks(0.1);
  ah.stepAudioHooks(0.1);
  ah.stepAudioHooks(0.1);
  assert.deepEqual(log, ['build', 'g0.50', 'g1.00']);
  assert.deepEqual(ah.audioHooksStats().running, ['w5-test-banjo']);
  ah.setLoop('w5-test-banjo', 0, 0);
  ah.stepAudioHooks(0.1);
  assert.deepEqual(log.slice(3), ['g0.00', 'stop']);
  ah.setLoop('w5-test-banjo', 0.5, 0);
  ah.stepAudioHooks(0.1);
  assert.deepEqual(log.slice(5), ['build', 'g0.50']);
  ah.bindAudioHooks(null);
  assert.deepEqual(log.slice(7), ['stop'], 'teardown stops every loop');
  assert.ok(Math.abs(ah.audioNow() - performance.now() / 1000) < 1, 'unbound: the performance clock again');
  offLoop(); off(); off2();
  assert.equal(ah.audioHooksStats().loops, 0);
});

test('wave 5: game/w5Features.ts — the frozen four, the economy initialised first, failures contained, teardown in reverse', async () => {
  const w5 = await import('../src/opus-bay/game/w5Features');
  assert.deepEqual([...w5.W5_FEATURES], ['economy', 'play', 'eggs', 'realsf']);
  assert.deepEqual(Object.keys(w5.W5_LOADERS), [...w5.W5_FEATURES]);
  const log: string[] = [];
  const later = <T,>(ms: number, v: T) => new Promise<T>(r => setTimeout(() => r(v), ms));
  const feature = (id: string) => ({ init: () => { log.push(`init:${id}`); return () => { log.push(`off:${id}`); }; } });
  const { off, ready } = w5.initW5Features({
    economy: () => later(30, feature('economy')),
    play: () => later(1, feature('play')),
    eggs: () => Promise.reject(new Error('chunk failed')),
    realsf: () => later(5, { init: () => { throw new Error('init failed'); } }),
  });
  await ready;
  assert.deepEqual(log, ['init:economy', 'init:play'], 'the economy first although it loaded last; a failed load or init stops nothing else');
  off();
  assert.deepEqual(log.slice(2), ['off:play', 'off:economy']);
  off();
  assert.equal(log.length, 4, 'teardown once');
  // torn down before the chunks arrive: nothing starts
  const r2 = w5.initW5Features({ economy: () => later(5, feature('e2')), play: () => later(5, feature('p2')), eggs: () => later(5, feature('g2')), realsf: () => later(5, feature('r2')) });
  r2.off();
  await r2.ready;
  assert.equal(log.length, 4);
  // the real day-0 stubs: init() returns its undo, harmless
  for (const id of w5.W5_FEATURES) {
    const m = await w5.W5_LOADERS[id]();
    const undo = m.init();
    assert.equal(typeof undo, 'function', id);
    undo();
  }
});

test('wave 5: the four feature folders stay out of the GameRoot graph (dynamic imports only, through game/w5Features.ts)', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const root = path.resolve('src/opus-bay');
  const spec = /^\s*(?:import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?['"](\.[^'"]+)['"]/gm;
  const rel = (p: string) => path.relative(root, p).split(path.sep).join('/');
  const resolve = (from: string, s: string) => {
    const b = path.resolve(path.dirname(from), s);
    for (const c of [b, `${b}.ts`, `${b}.tsx`, path.join(b, 'index.ts'), path.join(b, 'index.tsx')]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    return null;
  };
  const start = path.join(root, 'game/GameRoot.tsx');
  const seen = new Set<string>([rel(start)]);
  const queue = [start];
  while (queue.length) {
    const f = queue.shift()!;
    for (const m of fs.readFileSync(f, 'utf8').matchAll(spec)) {
      const r = resolve(f, m[1]);
      if (r && !seen.has(rel(r))) { seen.add(rel(r)); queue.push(r); }
    }
  }
  assert.ok(seen.has('game/cityContent.ts') && seen.has('game/w5Features.ts') && seen.has('ui/slots.ts'), 'the day-0 glue is in the main graph');
  assert.deepEqual([...seen].filter(m => /^(economy|play|eggs|realsf)\//.test(m)), [], 'the feature folders are lazy chunks');
  const glue = fs.readFileSync(path.join(root, 'game/w5Features.ts'), 'utf8');
  for (const dir of ['economy', 'play', 'eggs', 'realsf']) {
    assert.ok(fs.existsSync(path.join(root, dir, 'index.ts')), `${dir}/index.ts exists`);
    assert.match(glue, new RegExp(`import\\('\\.\\./${dir}/index'\\)`), dir);
  }
  assert.match(fs.readFileSync(path.join(root, 'game/cityContent.ts'), 'utf8'), /const w5 = initW5Features\(\);/, 'started once from initCityContent (it returns early in district mode)');
});
