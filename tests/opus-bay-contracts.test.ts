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
