import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave-2 day-0 contracts (docs/opus-bay/sf-w2-contracts.md). FROZEN with the contracts: the hooks every lane codes
 * against exist, are harmless while empty, and keep the district exactly as it was. Lanes test their own fillings in
 * their own test files.
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
const { NPC_DEFS, npcDefsFor } = await import('../src/opus-bay/actors/npcs');
const moveApi = await import('../src/opus-bay/actors/moveApi');
const { input } = await import('../src/opus-bay/core/input');
const l0 = await import('../src/opus-bay/world/sf/l0index');
const { TypedBatch } = await import('../src/opus-bay/world/typedBatch');
const { TOY, patchToyShader } = await import('../src/opus-bay/world/materials');
const { ASSETS, SF_KIT, SF_KIT_IDS, listAssetUrls } = await import('../src/opus-bay/data/assets');
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
  assert.equal(inter.interactableById('place:ocean-beach'), undefined);
  inter.setExtraResolver(id => (id.startsWith('place:') ? { ...station, id, source: 'place', action: 'info' } : undefined));
  assert.equal(inter.interactableById('place:ocean-beach')?.source, 'place');
  assert.equal(inter.interactables().some(it => it.id === 'place:ocean-beach'), false, 'resolved places are not offered for E');
  inter.setExtraResolver(null);

  assert.equal(inter.subjectPosition('sutro-tower'), null);
  const offSubject = inter.registerSubjectResolver(s => (s === 'sutro-tower' ? { x: 1, y: 2, z: 3 } : null));
  assert.deepEqual(inter.subjectPosition('sutro-tower'), { x: 1, y: 2, z: 3 });
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
  assert.equal(flowMod.goalKeyOf('ferry-ride'), 'streetcar', "'ride' still wins for ids that name both");
  assert.deepEqual(flowMod.goalIdsFor('cable-car'), []);
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
  assert.equal(registry.sceneSystems(), snap, 'same array until something changes');
  const Comp = () => null;
  const off = registry.registerSceneSystem('x', Comp);
  assert.notEqual(registry.sceneSystems(), snap);
  assert.equal(registry.sceneSystems()[0].Component, Comp);
  off();
  assert.equal(registry.sceneSystems().length, 0);

  const it = inter.buildInteractables()[0];
  assert.deepEqual(registry.extraProxies(it), []);
  const offP = registry.registerProxySource(x => (x.id === it.id ? [{ x: 0, y: 5, z: 0, r: 3 }] : null));
  assert.deepEqual(registry.extraProxies(it), [{ x: 0, y: 5, z: 0, r: 3 }]);
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
  view.collectObstacles(out, 0, 0, 8);
  assert.equal(out.length, 0);
  const offObs = view.registerObstacleSource((o, x, z) => { o.push({ x: x + 1, z, r: 0.4, kind: 'crowd' }); });
  view.collectObstacles(out, 0, 0, 8);
  assert.deepEqual(out, [{ x: 1, z: 0, r: 0.4, kind: 'crowd' }]);
  offObs();

  assert.equal(npcDefsFor('district'), NPC_DEFS);
  assert.deepEqual(NPC_DEFS.filter(d => d.talks !== false).map(d => d.id).sort(), ['npc-family', 'npc-fisher', 'npc-jogger', 'npc-streetcar', 'npc-vendor']);

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
  assert.equal(Object.keys(ASSETS.voice).length, 10, 'no city lines yet');
  assert.equal(game.get().worldMode, 'district');
});
