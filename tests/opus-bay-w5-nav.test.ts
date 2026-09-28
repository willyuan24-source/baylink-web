import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { mock } from 'node:test';

/**
 * Wave 5 · lane N (plan sf-w5-plan.md §4.5): the navigation hooks and one-tap travel.
 *   W5-N1  goTo() resolution and choice, the tiny hook module, registerFlagSource + pickFlags extras, FootprintsTab
 *   W5-N2  the planner after the pelican unlock (fly 推荐 over 60 s, undiscovered fly, never before), fly never completes
 *          a goal, the auto-travel pace, the four ETA displays agree, T's live ride ETA
 *   W5-N3  the persistent-follow reducer, auto-travel in the trip runner (start, takeover, resume, legs, end), the go
 *          button's words, the 问 BAYBAY 带我去 item
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
// the UI modules import their CSS: an empty module in node (as tests/opus-bay-sf-guide-city.test.ts)
registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
let clock = 300_000;
mock.method(performance, 'now', () => clock);
const tick = (ms: number) => { clock += ms; };

const { resolveGoToTarget, chooseGoToOption, goToSource, pointPlaceId, POINT_NAME } = await import('../src/opus-bay/game/goToRun');
const { ATTRACTION_INDEX, tripDestination } = await import('../src/opus-bay/data/sf/attractions');
const flags = await import('../src/opus-bay/game/flags');
const { ROLE_CODE, makeFlagMaterial } = await import('../src/opus-bay/world/sf/flags');
type Opt = import('../src/opus-bay/game/tripTypes').TripOption;
type Lk = import('../src/opus-bay/game/goToRun').GoToLookups;

const bi = (zh: string, en = zh) => ({ zh, en });

// ---------------------------------------------------------------------------------------------------------------
// W5-N1 · goTo
// ---------------------------------------------------------------------------------------------------------------

/** the game's attraction index, a fake place index and interactables */
const lookups = (extra: Partial<Lk> = {}): Lk => ({
  attraction: id => ATTRACTION_INDEX.resolve(id),
  primary: id => ATTRACTION_INDEX.primary(id),
  place: id => ({
    'osm-cafe': { id: 'osm-cafe', name: bi('小咖啡馆', 'Little cafe'), arrival: { x: 10, z: 20 } },
    'twin-peaks': { id: 'twin-peaks', name: bi('双峰（地点）', 'Twin Peaks (place)'), arrival: { x: 125, z: 930 } },
  } as Record<string, { id: string; name: { zh: string; en: string }; arrival: { x: number; z: number } }>)[id],
  interactable: id => (id === 'ferry-building' ? { id, x: 131, z: 15, name: bi('渡轮大厦', 'Ferry Building') } : id === 'place:osm-far' ? { id, x: 5, z: 6, name: bi('远处', 'Far') } : undefined),
  snap: p => ({ x: p.x + 1, z: p.z }),
  ...extra,
});

test('W5-N1 goTo: an attraction id resolves to its trip destination (an island to its pier), with the attraction', () => {
  const al = resolveGoToTarget({ placeId: 'alcatraz' }, lookups())!;
  assert.equal(al.placeId, 'alcatraz-landing', 'Alcatraz → Pier 33 (lane P tripDestination)');
  assert.equal(al.attraction, 'alcatraz');
  assert.ok(Math.abs(al.x - -97.68) < 1e-6 && Math.abs(al.z - -21.16) < 1e-6);
  const su = resolveGoToTarget({ placeId: 'sutro-baths' }, lookups())!;
  const sa = ATTRACTION_INDEX.get('sutro-baths')!, sd = tripDestination(sa);
  assert.deepEqual([su.placeId, su.x, su.z, su.attraction], ['osm-w32776540', sd.x, sd.z, 'sutro-baths'], 'the arrival point, not the anchor');
  assert.ok(Math.hypot(su.x - sa.x, su.z - sa.z) > 1, 'the arrival differs from the anchor');
  assert.equal(su.name.zh, '苏特罗浴场遗址');
  // the caller's name wins
  assert.equal(resolveGoToTarget({ placeId: 'sutro-baths', name: bi('浴场') }, lookups())!.name.zh, '浴场');
});

test('W5-N1 goTo: a place-index row goes through the attraction that speaks for it, else its own arrival; prefixes are stripped', () => {
  const tp = resolveGoToTarget({ placeId: 'twin-peaks' }, lookups({ attraction: () => undefined }))!;
  assert.equal(tp.attraction, 'twin-peaks', 'the primary attraction of the row (the arrival moment, the flag)');
  const cafe = resolveGoToTarget({ placeId: 'osm-cafe' }, lookups())!;
  assert.deepEqual(cafe, { placeId: 'osm-cafe', x: 10, z: 20, name: bi('小咖啡馆', 'Little cafe') });
  assert.equal(resolveGoToTarget({ placeId: 'place:osm-cafe' }, lookups())!.placeId, 'osm-cafe');
  assert.equal(resolveGoToTarget({ placeId: 'sf:osm-cafe' }, lookups())!.placeId, 'osm-cafe');
  assert.equal(resolveGoToTarget({ placeId: 'lm-sutro-baths' }, lookups())!.attraction, 'sutro-baths', 'an SF landmark id with the lm- prefix');
});

test('W5-N1 goTo: an interactable, then a point (snapped, a pt: id, 目的地), else null', () => {
  const fb = resolveGoToTarget({ placeId: 'ferry-building' }, lookups({ attraction: () => undefined }))!;
  assert.deepEqual([fb.placeId, fb.x, fb.z, fb.name.zh], ['ferry-building', 131, 15, '渡轮大厦']);
  assert.equal(resolveGoToTarget({ placeId: 'place:osm-far' }, lookups())!.placeId, 'osm-far', 'a place: interactable keeps the place id');
  const pt = resolveGoToTarget({ point: { x: 100.4, z: -20.6 } }, lookups())!;
  assert.deepEqual(pt, { placeId: 'pt:100,-21', x: 101.4, z: -20.6, name: POINT_NAME });
  assert.equal(pointPlaceId({ x: -0.4, z: 3.6 }), 'pt:0,4');
  assert.equal(resolveGoToTarget({ point: { x: 1, z: 2 }, name: bi('音乐节') }, lookups({ snap: () => null }))!.x, 1, 'no snap: the point itself');
  // an unknown id falls back to the point; nothing at all → null
  assert.equal(resolveGoToTarget({ placeId: 'nope', point: { x: 5, z: 5 } }, lookups())!.placeId, 'pt:5,5');
  assert.equal(resolveGoToTarget({ placeId: 'nope' }, lookups()), null);
  assert.equal(resolveGoToTarget({}, lookups()), null);
  assert.equal(resolveGoToTarget({ point: { x: NaN, z: 0 } }, lookups()), null);
});

const opt = (mode: Opt['mode'], seconds: number, extra: Partial<Opt> = {}): Opt => ({ mode, seconds, legs: [], ...extra });

test('W5-N1 goTo: the option taken — 推荐 by default, the pelican for prefer fly, the best ground way for prefer ground', () => {
  const list = [opt('fly', 8), opt('line', 70, { goal: 'metro' }), opt('run', 60, { recommended: true }), opt('walk', 110)];
  assert.equal(chooseGoToOption(list)?.mode, 'run');
  assert.equal(chooseGoToOption(list, 'fly')?.mode, 'fly');
  assert.equal(chooseGoToOption([opt('walk', 50, { recommended: true })], 'fly')?.mode, 'walk', 'no pelican offered: the 推荐');
  // ground: a goal way within the planner's slack (fastest × 1.5 + 60 s) beats the fastest
  assert.equal(chooseGoToOption(list, 'ground')?.mode, 'line');
  assert.equal(chooseGoToOption([opt('fly', 8, { recommended: true }), opt('walk', 300)], 'ground')?.mode, 'walk', 'never the pelican when a ground way exists');
  assert.equal(chooseGoToOption([opt('fly', 8, { recommended: true })], 'ground')?.mode, 'fly', 'the pelican when nothing else reaches');
  assert.equal(chooseGoToOption([]), null);
  assert.equal(chooseGoToOption([opt('walk', 5), opt('run', 4)])?.mode, 'walk', 'no 推荐 flag: the first row');
});

test('W5-N1 goTo: the caller maps onto the frozen TripSource', () => {
  assert.equal(goToSource('map'), 'map');
  assert.equal(goToSource('ask'), 'call');
  assert.equal(goToSource('ask:take-me'), 'call');
  assert.equal(goToSource('panorama'), 'panorama');
  assert.equal(goToSource('realsf:today'), 'card');
  assert.equal(goToSource(undefined), 'card');
});

test('W5-N1 goTo: the hook module is tiny — type imports only, the work behind one dynamic import', () => {
  const src = readFileSync(new URL('../src/opus-bay/game/goTo.ts', import.meta.url), 'utf8');
  const imports = src.split('\n').filter(l => /^import\s/.test(l));
  assert.ok(imports.length > 0 && imports.every(l => /^import type /.test(l)), `only type imports: ${imports.join(' | ')}`);
  assert.match(src, /import\('\.\/goToRun'\)/);
  assert.ok(src.length < 5000, `${src.length} chars`);
});

// ---------------------------------------------------------------------------------------------------------------
// W5-N1 · registerFlagSource
// ---------------------------------------------------------------------------------------------------------------

type FS = import('../src/opus-bay/game/flags').FlagSource;
const T1 = (id: string, x: number, z: number): FS => ({ id, rank: 1, cat: 'landmark', x, z, name: bi(id) });
// the camera at yaw 0 looks along −z: everything north of the player (z < 0) is in view
const ATTR: FS[] = [T1('a', 0, -300), T1('b', 0, -500), T1('c', 0, -700), T1('d', 0, -900)];

test('W5-N1 flags: registerFlagSource / extraFlags prefix the keys, skip bad rows and throwing sources; unregister works', () => {
  const off1 = flags.registerFlagSource('realsf', () => [{ key: 'hsb', x: -378.2, z: 1118.8, color: '#e8705a', glyph: 'Theater' }, { key: 'bad', x: NaN, z: 0, color: '#fff' }]);
  const off2 = flags.registerFlagSource('boom', () => { throw new Error('boom'); });
  const got = flags.extraFlags({ player: { x: 0, z: 0 }, target: null, phone: true });
  assert.deepEqual(got.map(f => f.key), ['realsf:hsb']);
  assert.deepEqual(flags.flagSourceKeys().sort(), ['boom', 'realsf']);
  // the same key again replaces it; a stale unregister does not remove the new one
  const off1b = flags.registerFlagSource('realsf', () => []);
  off1();
  assert.ok(flags.flagSourceKeys().includes('realsf'));
  off1b(); off2();
  assert.deepEqual(flags.flagSourceKeys(), []);
});

test('W5-N1 flags: extras stand after the target and ahead of the T1 flags, at most half the slots (2 of the phone\'s 3)', () => {
  const extras = [
    { key: 'ev:1', x: 10, z: -200, color: '#e8705a' },
    { key: 'ev:2', x: -10, z: -250, color: '#e8705a', glyph: 'Trophy' as const },
    { key: 'ev:3', x: 0, z: -260, color: '#e8705a' },
  ];
  const base = { player: { x: 0, z: 0 }, yaw: 0, attractions: ATTR, discovered: () => false, extras };
  const phone = flags.pickFlags({ ...base, max: 3, target: { x: 0, z: -1200 } });
  assert.deepEqual(phone.map(p => `${p.role}:${p.key}`), ['target:target', 'extra:ev:1', 'extra:ev:2']);
  const e2 = phone[2];
  assert.deepEqual([e2.color, e2.glyph, e2.h, e2.attraction], ['#e8705a', 'Trophy', flags.FLAG_RULES.defaultH, null]);
  assert.equal(phone[1].glyph, 'MapPin', 'default glyph');
  const desk = flags.pickFlags({ ...base, max: 6 });
  assert.deepEqual(desk.map(p => p.key), ['ev:1', 'ev:2', 'ev:3', 'a', 'b', 'c'], 'desktop: 3 extras (half of 6), then T1');
  assert.equal(flags.extraFlagCap(3), 2); assert.equal(flags.extraFlagCap(6), 3); assert.equal(flags.extraFlagCap(8), 4);
  // during a panorama the extras still come first
  const pano = flags.pickFlags({ ...base, max: 8, panorama: true });
  assert.deepEqual(pano.slice(0, 3).map(p => p.role), ['extra', 'extra', 'extra']);
});

test('W5-N1 flags: extras follow the view cone (unless near the target), their own far, the 60 u rule and priority', () => {
  const base = { player: { x: 0, z: 0 }, yaw: 0, attractions: [] as FS[], discovered: () => false, max: 6 };
  const behind = { key: 'behind', x: 0, z: 400, color: '#e8705a' };
  assert.equal(flags.pickFlags({ ...base, extras: [behind] }).length, 0, 'behind the camera: no slot');
  assert.equal(flags.pickFlags({ ...base, extras: [behind], target: { x: 50, z: 450 } }).filter(p => p.role === 'extra').length, 1, 'within 150 u of the target: stands anyway');
  assert.equal(flags.pickFlags({ ...base, extras: [{ key: 'n', x: 0, z: -30, color: '#fff' }] }).length, 0, 'closer than 60 u');
  assert.equal(flags.pickFlags({ ...base, extras: [{ key: 'f', x: 0, z: -1700, color: '#fff' }] }).length, 0, 'beyond the default 1,600 u');
  assert.equal(flags.pickFlags({ ...base, extras: [{ key: 'f', x: 0, z: -1700, color: '#fff', far: 2500 }] }).length, 1, 'its own far');
  assert.equal(flags.pickFlags({ ...base, extras: [{ key: 'f', x: 0, z: -3500, color: '#fff', far: 9000 }] }).length, 0, 'never past the 3,000 u far plane');
  const pr = flags.pickFlags({ ...base, max: 3, extras: [{ key: 'near', x: 0, z: -100, color: '#fff' }, { key: 'vip', x: 0, z: -900, color: '#fff', priority: 5 }] });
  assert.deepEqual(pr.map(p => p.key), ['vip', 'near'], 'priority first, then nearer');
  // the shader draws an extra with the target's fades (no new program)
  assert.equal(ROLE_CODE.extra, ROLE_CODE.target);
});

test('W5-N1 flags: the flag fragment shader declares its colour once (a float col in the atlas block math broke the program)', () => {
  const frag = makeFlagMaterial().fragmentShader;
  const decls = [...frag.matchAll(/\b(float|vec[234]|int)\s+col\b/g)].map(m => m[0]);
  assert.deepEqual(decls, ['vec3 col'], 'col is declared once, as the vec3 colour (the lead\'s 4fb3e6e: acol / arow)');
  assert.match(frag, /float acol = /);
});

// ---------------------------------------------------------------------------------------------------------------
// W5-N1 · FootprintsTab
// ---------------------------------------------------------------------------------------------------------------

test('W5-N1 FootprintsTab is exported for embedding (E\'s notebook) next to the Journal\'s Footprints', () => {
  const src = readFileSync(new URL('../src/opus-bay/ui/Footprints.tsx', import.meta.url), 'utf8');
  assert.match(src, /export function FootprintsTab\(\{ embedded = false \}/);
  assert.match(src, /ob-footprints is-embedded/);
  // (the module imports its CSS, which node cannot load: the exports are checked in the source)
  assert.match(src, /export function Footprints\(\)/);
});

// ---------------------------------------------------------------------------------------------------------------
// W5-N2 · the planner after the pelican
// ---------------------------------------------------------------------------------------------------------------

const TP = await import('../src/opus-bay/game/tripPlan');
const { autoWalkSeconds, routeAhead } = await import('../src/opus-bay/game/travel');
const G = await import('../src/opus-bay/game/guideCity');
const TPV = await import('../src/opus-bay/game/tripProviders');
type Prov = import('../src/opus-bay/game/tripPlan').TripProviders;
type Dest = import('../src/opus-bay/game/tripPlan').TripDestination;

const destAt = (x: number, z: number, placeId = 'palace'): Dest => ({ placeId, x, z, name: bi('艺术宫', 'Palace') });
const straightWalk: Prov['walk'] = (a, b) => ({ length: Math.hypot(b.x - a.x, b.z - a.z), path: [a.x, a.z, b.x, b.z] });
const recOf = (list: Opt[]) => list.find(o => o.recommended);

test('W5-N2 the auto-travel pace equals the controller\'s auto-walk (travel.autoWalkSeconds) at every length', () => {
  for (const L of [0, 5, 29.9, 30, 30.5, 32, 40, 100, 777, 3000]) assert.ok(Math.abs(TP.autoTravelSeconds(L) - autoWalkSeconds(L)) < 1e-9, `L = ${L}`);
  assert.equal(TP.autoTravelSeconds(-1), 0);
  // running most of a long walk: 600 u ≈ 83 s (walking would be 143 s)
  assert.ok(Math.abs(TP.autoTravelSeconds(600) - 83.4) < 0.5, String(TP.autoTravelSeconds(600)));
});

test('W5-N2 fly: undiscovered places only once the pelican is unlocked; 推荐 = fly when the fastest other way is over 60 s', () => {
  const far = destAt(900, 0);
  // before the unlock: discovered places only, and never 推荐 while a ground way exists
  assert.equal(TP.planTrips({ x: 0, z: 0 }, far, { walk: straightWalk, discovered: () => false }).some(o => o.mode === 'fly'), false);
  const before = TP.planTrips({ x: 0, z: 0 }, far, { walk: straightWalk, discovered: () => true, flyUnlocked: () => false });
  assert.notEqual(recOf(before)?.mode, 'fly', 'never 推荐 before the unlock');
  // after: offered for an undiscovered place, and 推荐 (900 u on foot is well over 60 s)
  const after = TP.planTrips({ x: 0, z: 0 }, far, { walk: straightWalk, discovered: () => false, flyUnlocked: () => true, autoPace: true });
  const fly = after.find(o => o.mode === 'fly')!;
  assert.ok(fly, 'fly offered for an undiscovered place');
  assert.equal(fly.recommended, true);
  assert.deepEqual(fly.note, TP.FLY_NOTE);
  assert.equal(fly.legs[0].via === 'fly' && fly.legs[0].place, 'palace');
  // a short trip (the fastest ground way within 60 s) keeps walking as the 推荐; fly stays in the list
  const shortTrip = TP.planTrips({ x: 0, z: 0 }, destAt(300, 0), { walk: straightWalk, discovered: () => false, flyUnlocked: () => true, autoPace: true });
  assert.ok(TP.autoTravelSeconds(300) <= TP.FLY_REC_AFTER_S);
  assert.equal(recOf(shortTrip)?.mode, 'walk');
  assert.ok(shortTrip.some(o => o.mode === 'fly'));
  // just over the minute: fly
  const L = 470;
  assert.ok(TP.autoTravelSeconds(L) > TP.FLY_REC_AFTER_S);
  assert.equal(recOf(TP.planTrips({ x: 0, z: 0 }, destAt(L, 0), { walk: straightWalk, flyUnlocked: () => true, autoPace: true }))?.mode, 'fly');
  // nothing reaches it on the ground: fly is the one way (a discovered place, before the pelican too)
  assert.deepEqual(TP.planTrips({ x: 0, z: 0 }, far, { walk: () => null, discovered: () => true }).map(o => [o.mode, o.recommended]), [['fly', true]]);
});

test('W5-N2 fly never completes a goal: the goal way stays in the list with its note, the fly row carries FLY_NOTE', () => {
  const everything: import('../src/opus-bay/game/tripPlan').TripGoalRule = { goal: 'twin-peaks', note: bi('顺便完成登顶目标'), test: () => true };
  const list = TP.planTrips({ x: 0, z: 0 }, destAt(1200, 0, 'twin-peaks'), { walk: straightWalk, flyUnlocked: () => true, autoPace: true, goals: [everything] });
  const fly = list.find(o => o.mode === 'fly')!;
  assert.equal(fly.goal, undefined, 'flying never completes a goal');
  assert.deepEqual(fly.note, TP.FLY_NOTE);
  assert.equal(fly.recommended, true, 'the pelican is the 推荐 for a long trip');
  const walk = list.find(o => o.mode === 'walk')!;
  assert.equal(walk.goal, 'twin-peaks', 'the goal way is still offered, with its badge');
  assert.equal(walk.note?.zh, '顺便完成登顶目标');
});

test('W5-N2 autoPace: on-foot legs at the auto-travel pace, no separate run row; off: the wave-4 walk / run rows', () => {
  const d = destAt(0, 900);
  const auto = TP.planTrips({ x: 0, z: 0 }, d, { walk: straightWalk, autoPace: true });
  assert.deepEqual(auto.map(o => o.mode), ['walk']);
  assert.ok(Math.abs(auto[0].seconds - TP.autoTravelSeconds(900)) < 1e-9);
  const old = TP.planTrips({ x: 0, z: 0 }, d, { walk: straightWalk });
  assert.deepEqual(old.map(o => o.mode).sort(), ['run', 'walk']);
  assert.ok(Math.abs(old.find(o => o.mode === 'walk')!.seconds - 900 / TP.TRIP_SPEED.walk) < 1e-9);
  // the live providers carry: auto pace and the pelican unlock
  const live = TPV.tripProviders();
  assert.equal(live.autoPace, true);
  assert.equal(typeof live.flyUnlocked, 'function');
});

test('W5-N2 one ETA: the map label, the card, the option row and the pill agree (within 10 %) at the start of a carried walk', () => {
  const from = { x: 0, z: 0 }, d = destAt(420, 260);
  // a bent route (the A*'s): 3 segments
  const path = [0, 0, 200, 0, 200, 260, 420, 260];
  const walk: Prov['walk'] = () => ({ length: 200 + 260 + 220, path });
  const options = TP.planTrips(from, d, { walk, autoPace: true });
  const rec = recOf(options)!;
  const row = options.find(o => o.mode === 'walk')!;
  // the map's route label (ui/CityMap: autoWalkSeconds over the route ahead + the way onto it)
  const ahead = routeAhead([{ x: 0, z: 0 }, { x: 200, z: 0 }, { x: 200, z: 260 }, { x: 420, z: 260 }], from);
  const mapLabel = autoWalkSeconds(ahead.length + ahead.off);
  // the pill at the start (auto-travel on)
  const trip = { placeId: 'palace', option: rec, legs: rec.legs, leg: 0, startedAt: 0 };
  const pill = G.tripSecondsLeft(trip, from, false, true);
  const all = [mapLabel, rec.seconds, row.seconds, pill];
  const lo = Math.min(...all), hi = Math.max(...all);
  assert.ok(hi <= lo * 1.1, `the four agree: ${all.map(n => n.toFixed(1)).join(' / ')}`);
  // walking by hand (the player took over), the pill says the walking time
  assert.ok(Math.abs(G.tripSecondsLeft(trip, from, false, false) - 680 / 4.2) < 1e-6);
});

test('W5-N2 aboard, lane T\'s live ride ETA drives the pill (+ stepping off); without it the share of the ride left', () => {
  const leg = { via: 'line' as const, line: 'sf-loop', board: 'a', alight: 'b', wait: 10, stops: 2, from: { x: 0, z: 0 }, to: { x: 400, z: 0 }, seconds: 70, length: 400 };
  assert.equal(G.legSecondsLeft(leg, { x: 200, z: 0 }, true), 30, 'half way: half of the 60 s ride');
  assert.equal(G.legSecondsLeft(leg, { x: 200, z: 0 }, true, undefined, { rideEta: 41 }), 41 + TP.ALIGHT_S);
  // lane T's rideEta(): its rideLeft while riding; nothing while waiting (the pill takes the vehicle's ETA then)
  assert.equal(TPV.liveRideEta(() => ({ stage: 'riding', rideLeft: 12.5 })), 12.5);
  assert.equal(TPV.liveRideEta(() => ({ stage: 'waiting', rideLeft: 80 })), undefined);
  assert.equal(TPV.liveRideEta(() => null), undefined);
  assert.equal(TPV.liveRideEta(() => ({ stage: 'riding', rideLeft: NaN })), undefined, 'a bad answer is no answer');
  assert.equal(TPV.liveRideEta(() => { throw new Error('x'); }), undefined);
  assert.equal(TPV.liveRideEta(), undefined, 'not riding in node');
});

// ---------------------------------------------------------------------------------------------------------------
// W5-N3 · the persistent-follow reducer
// ---------------------------------------------------------------------------------------------------------------

const AT = await import('../src/opus-bay/game/autoTravel');
type AIn = import('../src/opus-bay/game/autoTravel').AutoInput;

const base = (over: Partial<AIn> = {}): AIn => ({ now: 1000, manualAt: -Infinity, pathTarget: null, player: { x: 0, z: 0 }, want: { p: { x: 100, z: 0 }, r: 2.5 }, blocked: false, legKey: 'L0', ...over });

test('W5-N3 reducer: off does nothing; on issues the leg target once and then lets the walk run', () => {
  assert.deepEqual(AT.autoStep(AT.AUTO_IDLE, base()).decision, { type: 'none' });
  const s0 = { ...AT.AUTO_IDLE, on: true };
  const a = AT.autoStep(s0, base());
  assert.equal(a.decision.type, 'issue');
  const issued = a.state.issued!;
  assert.deepEqual(issued, { x: 100, z: 0 });
  // walking there (the controller holds our target): nothing
  const b = AT.autoStep(a.state, base({ now: 1100, pathTarget: issued, player: { x: 20, z: 0 } }));
  assert.deepEqual(b.decision, { type: 'none' });
  assert.equal(b.state.issued, issued);
  // blocked (a dialogue, a panel, a ride): wait, never issue
  assert.deepEqual(AT.autoStep(s0, base({ blocked: true })).decision, { type: 'none' });
  // already there: nothing
  assert.deepEqual(AT.autoStep(s0, base({ player: { x: 99, z: 0 } })).decision, { type: 'none' });
});

test('W5-N3 reducer: any stick / WASD or a tap elsewhere takes over (off); the trip goes on without it', () => {
  const s = { ...AT.AUTO_IDLE, on: true };
  const a = AT.autoStep(s, base());
  const stick = AT.autoStep(a.state, base({ now: 1200, manualAt: 1150, pathTarget: null, player: { x: 10, z: 0 } }));
  assert.deepEqual(stick.decision, { type: 'takeover' });
  assert.equal(stick.state.on, false);
  const tap = AT.autoStep(a.state, base({ now: 1200, pathTarget: { x: 100, z: 0 } }));
  assert.deepEqual(tap.decision, { type: 'takeover' }, 'a tap on the same spot is a new target object: the player chose it');
  // a key held before the issue is not a takeover
  assert.equal(AT.autoStep(a.state, base({ now: 1200, manualAt: 900, pathTarget: a.state.issued })).decision.type, 'none');
});

test('W5-N3 reducer: persistent across legs; a stopped-short walk retries after 1.5 s, gives up after 3; a new target at once', () => {
  const s = { ...AT.AUTO_IDLE, on: true };
  let r = AT.autoStep(s, base());
  // the leg changes (a ride began: no on-foot target) → issued dropped, still on
  r = AT.autoStep(r.state, base({ now: 2000, legKey: 'L1', want: null, pathTarget: null }));
  assert.equal(r.state.on, true); assert.equal(r.state.issued, null);
  // the ride ended at the stop: the next walk leg is issued at once
  r = AT.autoStep(r.state, base({ now: 3000, legKey: 'L2', want: { p: { x: 0, z: 300 }, r: 2.5 } }));
  assert.equal(r.decision.type, 'issue');
  // the auto-walk stopped short (pathTarget cleared far from the target): retry only after AUTO_RETRY_MS
  const short = (now: number) => AT.autoStep(r.state, base({ now, legKey: 'L2', want: { p: { x: 0, z: 300 }, r: 2.5 }, pathTarget: null, player: { x: 0, z: 50 } }));
  assert.equal(short(3000 + AT.AUTO_RETRY_MS - 1).decision.type, 'none');
  for (let i = 1; i <= AT.AUTO_MAX_FAILS; i++) {
    r = short(r.state.issuedAt + AT.AUTO_RETRY_MS);
    assert.equal(r.decision.type, 'issue', `retry ${i}`);
    assert.equal(r.state.fails, i);
  }
  r = short(r.state.issuedAt + AT.AUTO_RETRY_MS);
  assert.deepEqual(r.decision, { type: 'giveup' });
  assert.equal(r.state.on, false);
  // a step-out done (the target moved on): issued again at once, no fail counted
  const st = { ...AT.AUTO_IDLE, on: true, issued: { x: 3, z: 0 }, issuedAt: 5000, legKey: 'L3' };
  const next = AT.autoStep(st, base({ now: 5100, legKey: 'L3', pathTarget: null, player: { x: 3, z: 0 }, want: { p: { x: 80, z: 0 }, r: 2.5 } }));
  assert.equal(next.decision.type, 'issue'); assert.equal(next.state.fails, 0);
  // a bike leg's parked vehicle is used on arrival (the interact id rides along)
  const bike = AT.autoStep({ ...AT.AUTO_IDLE, on: true }, base({ want: { p: { x: 30, z: 0 }, r: 2.5, interact: 'ride:bike-1' } }));
  assert.deepEqual(bike.decision, { type: 'issue', p: { x: 30, z: 0 }, interact: 'ride:bike-1' });
});

test('W5-N3 live state: autoBegin / autoEnd notify only when on changes; autoEnd hands back the issued target', () => {
  let n = 0;
  const off = AT.subscribeAuto(() => { n++; });
  AT.autoBegin(); AT.autoBegin();
  assert.equal(AT.autoOn(), true);
  AT.setAutoState({ ...AT.autoState(), issued: { x: 1, z: 2 } });
  assert.deepEqual(AT.autoEnd(), { x: 1, z: 2 });
  assert.equal(AT.autoOn(), false);
  assert.equal(n, 2);
  off();
});

// ---------------------------------------------------------------------------------------------------------------
// W5-N3 · auto-travel in the trip runner (the real flow, district terrain in node)
// ---------------------------------------------------------------------------------------------------------------

const { game, initialGameState } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { input } = await import('../src/opus-bay/core/input');
const flowMod = await import('../src/opus-bay/game/flow');
const { flow, initialFlowState } = await import('../src/opus-bay/game/flowStore');
const { buildInteractables, setInteractables } = await import('../src/opus-bay/game/interactables');
const { updateGuide, resetBrain } = await import('../src/opus-bay/game/brain');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const tripRun = await import('../src/opus-bay/game/tripRun');
const { walkLeg } = await import('../src/opus-bay/game/trips');
const slots = await import('../src/opus-bay/ui/slots');
const { DISTRICT } = await import('../src/opus-bay/data/district');
tripRun.initTripRun();

// standable in the node (district) terrain: the spawn and two spots near it
const S = { x: DISTRICT.spawn.x, z: DISTRICT.spawn.z };
const A = { x: S.x - 20, z: S.z };
const B = { x: S.x, z: S.z + 20 };

function resetWorld() {
  if (flow.get().trip) flowMod.endTrip();
  game.set({ ...initialGameState(), phase: 'playing', worldMode: 'city', mode: 'free' });
  flow.set(initialFlowState());
  Object.assign(runtime.player, { x: S.x, y: 0, z: S.z, heading: 0, moving: false, running: false, locked: false, pendingInteract: null, pathTarget: null });
  Object.assign(runtime.guide, { x: S.x + 1, y: 0, z: S.z, state: 'follow', target: null, run: false, emote: 'none', arrived: false });
  input.manualMove = false;
  resetBrain();
  setInteractables(buildInteractables());
  tick(5000);
}
const frames = (n = 1, ms = 120) => { for (let i = 0; i < n; i++) { tick(ms); stepFrameSystems(ms / 1000, clock); } };
const at = (p: { x: number; z: number }) => { runtime.player.x = p.x; runtime.player.z = p.z; runtime.guide.x = p.x + 1; runtime.guide.z = p.z; };
const twoLegs = () => {
  const l1 = walkLeg(S, { ...A, name: bi('甲') }), l2 = walkLeg(A, { ...B, name: bi('乙') });
  return { mode: 'walk' as const, legs: [l1, l2], seconds: l1.seconds + l2.seconds };
};

test('W5-N3 trip runner: a map trip carries the player at once, leg after leg; a tour leg does not', () => {
  resetWorld();
  flowMod.startTrip(twoLegs(), { placeId: 'b-spot', name: bi('乙') }, 'map');
  assert.equal(AT.autoOn(), true, 'one tap: carrying');
  assert.ok(runtime.player.pathTarget, 'walking at once (no second tap)');
  assert.deepEqual({ ...runtime.player.pathTarget }, { x: A.x, z: A.z });
  assert.equal(AT.autoState().issued, runtime.player.pathTarget, 'our own target object');
  // at A the first leg ends (BAYBAY there too), the second is walked by itself
  at(A); runtime.player.pathTarget = null;
  updateGuide(clock); tick(100); updateGuide(clock);
  assert.equal(flow.get().trip?.leg, 1);
  frames(2);
  assert.deepEqual({ ...runtime.player.pathTarget! }, { x: B.x, z: B.z }, 'persistent across legs');
  // a tour's leg leads as before (no auto)
  resetWorld();
  flowMod.startTrip(twoLegs(), { placeId: 'b-spot' }, 'tour');
  assert.equal(AT.autoOn(), false);
  assert.equal(runtime.player.pathTarget, null);
  flowMod.endTrip();
});

test('W5-N3 trip runner: the stick takes over, the trip goes on; 自动跟上 resumes; 结束 stops our walk (not a walk the player set)', () => {
  resetWorld();
  flowMod.startTrip(twoLegs(), { placeId: 'b-spot' }, 'card');
  assert.equal(AT.autoOn(), true);
  // the player pushes the stick for one frame (the controller cancels the path)
  input.manualMove = true; frames(1); input.manualMove = false; runtime.player.pathTarget = null;
  frames(2);
  assert.equal(AT.autoOn(), false, 'taken over');
  assert.ok(flow.get().trip, 'the trip goes on');
  assert.equal(runtime.player.pathTarget, null, 'no walk forced back on');
  // 问 BAYBAY shows 带我去 · <destination> while not carried
  frames(1);
  const ask = slots.visibleAskItems().find(a => a.id === 'n-take-me');
  assert.ok(ask, 'the ask item');
  assert.match(ask!.label.zh, /^带我去 · /);
  assert.equal(tripRun.resumeAutoTravel(), true);
  assert.equal(AT.autoOn(), true);
  assert.ok(runtime.player.pathTarget);
  assert.equal(slots.visibleAskItems().some(a => a.id === 'n-take-me'), false, 'hidden while carried');
  flowMod.endTrip();
  assert.equal(AT.autoOn(), false);
  assert.equal(runtime.player.pathTarget, null, '结束 stops the auto-walk');
  // a walk target the player set survives 结束
  resetWorld();
  flowMod.startTrip(twoLegs(), { placeId: 'b-spot' }, 'map');
  const mine = { x: S.x + 1, z: S.z - 1 };
  runtime.player.pathTarget = mine;
  frames(1);
  assert.equal(AT.autoOn(), false, 'a tap elsewhere is a takeover');
  flowMod.endTrip();
  assert.equal(runtime.player.pathTarget, mine);
  runtime.player.pathTarget = null;
});

test('W5-N3 trip runner: a panel pauses auto-travel; a start inside a blocker steps out first; the GGB deck through its entry', () => {
  resetWorld();
  flowMod.startTrip(twoLegs(), { placeId: 'b-spot' }, 'map');
  runtime.player.pathTarget = null;
  AT.setAutoState({ ...AT.autoState(), issued: null });
  game.set(s => ({ panel: { ...s.panel, kind: 'journal' } }));
  frames(2);
  assert.equal(runtime.player.pathTarget, null, 'paused under a panel');
  game.set(s => ({ panel: { ...s.panel, kind: null } }));
  frames(1);
  assert.ok(runtime.player.pathTarget, 'on again once it closes');
  flowMod.endTrip();
  // autoWant: inside a blocker → the nearest walkable spot first; else the leg's end (an elevated walkway's entry first)
  const leg = walkLeg(S, { ...A, name: bi('甲') });
  const pl = { x: 0, y: 0, z: 0 };
  assert.deepEqual(tripRun.autoWant(leg, pl, () => false, () => ({ x: 4, z: 0 })), { p: { x: 4, z: 0 }, r: 0.8 });
  assert.deepEqual(tripRun.autoWant(leg, pl, () => true), { p: { x: A.x, z: A.z }, r: tripRun.AUTO_AT_R });
  const deck = { x: -865.8, z: 508.6 };
  const onDeck = tripRun.autoWant(walkLeg(S, deck), { x: -600, y: 0, z: 700 }, () => true)!;
  assert.ok(Math.hypot(onDeck.p.x - -689.35, onDeck.p.z - 649.76) < 1e-6, 'the GGB deck: its entry first (brain leadStep)');
  assert.deepEqual([...tripRun.AUTO_SOURCES].sort(), ['call', 'card', 'free-lead', 'map', 'panorama', 'qa']);
});

test('W5-N3 the go button says the way and its time', async () => {
  const { goButtonLabel } = await import('../src/opus-bay/ui/tripRows');
  assert.deepEqual(goButtonLabel(opt('walk', 185)), { zh: 'BAYBAY 带路 · 约 3 分钟', en: 'BAYBAY leads · ~3 min' });
  assert.deepEqual(goButtonLabel(opt('fly', 8)), { zh: '飞过去 · 约 8 秒', en: 'Fly · ~8s' });
  assert.deepEqual(goButtonLabel(opt('bike', 120)), { zh: '骑车 · 约 2 分钟', en: 'Bike · ~2 min' });
});

// ---------------------------------------------------------------------------------------------------------------
// W5-N5 · the landing: open ground (F's facer), a first sight faces its landmark
// ---------------------------------------------------------------------------------------------------------------

const FT = await import('../src/opus-bay/game/fastTravel');

test('W5-N5 landing heading: a first sight faces its landmark; else the most open ground (F\'s openHeading), preferring the place\'s heading, else the travel way', () => {
  const spot = { x: 0, z: 0 };
  const seen: number[] = [];
  const facer = (_x: number, _z: number, prefer: number) => { seen.push(prefer); return 3; };
  assert.ok(Math.abs(FT.landingHeading(spot, { look: { x: 10, z: 0 } }, 1.2, facer) - Math.PI / 2) < 1e-9, 'faces the landmark (+x)');
  assert.equal(FT.landingHeading(spot, { look: { x: 1, z: 0 } }, 1.2, facer), 3, 'a landmark right here: open ground');
  assert.equal(FT.landingHeading(spot, { heading: 0.5 }, 1.2, facer), 3, 'open ground first');
  assert.deepEqual(seen, [1.2, 0.5], 'the place heading (else the travel way) is the preference on ties');
  assert.equal(FT.landingHeading(spot, { heading: 0.5 }, 1.2, () => null), 0.5);
  assert.equal(FT.landingHeading(spot, {}, 1.2, null), 1.2);
  // the default facer is lane F's openHeading: nothing standable round a point far off the world → the preference
  assert.equal(FT.landingHeading({ x: 1e6, z: 1e6 }, {}, 1.2), 1.2);
});

test('W5-N5 the descent camera: behind the player; a first sight pulls back and looks past them toward the landmark', () => {
  const plain = FT.descentShot({ x: 0, z: 0 }, 5, 0);
  assert.deepEqual(plain, { position: [0, 10, -10], target: [0, 6.6, 0] });
  const first = FT.descentShot({ x: 0, z: 0 }, 5, 0, { x: 0, z: 200 });
  assert.deepEqual(first.position, [0, 11.5, -12]);
  assert.deepEqual(first.target, [0, 9, 30], 'at most 30 u ahead, toward the landmark');
  assert.deepEqual(FT.descentShot({ x: 0, z: 0 }, 5, 0, { x: 0, z: 40 }).target, [0, 9, 16], '0.4 of a near landmark');
});

test('W5-N5 a flight to an attraction not found yet is its first sight; found places and plain places land as before', () => {
  const coit = ATTRACTION_INDEX.get('coit-tower')!;
  const t = { placeId: coit.placeId ?? coit.id, attraction: coit.id };
  assert.deepEqual(tripRun.firstSight(t, () => false), { look: { x: coit.x, z: coit.z } });
  assert.deepEqual(tripRun.firstSight(t, () => true), {});
  assert.deepEqual(tripRun.firstSight({ placeId: 'osm-cafe' }, () => false), {});
});

// ---------------------------------------------------------------------------------------------------------------
// W5-N6 · title resume
// ---------------------------------------------------------------------------------------------------------------

const RS = await import('../src/opus-bay/game/resume');
const save = await import('../src/opus-bay/data/save');

test('W5-N6 resume lands on the saved spot itself when it is standable, else by the arrival rule', () => {
  const spot = { x: 12.5, z: -3.25 };
  assert.deepEqual(RS.resumePlace(spot, () => true, () => ({ x: 0, z: 0 })), spot);
  assert.deepEqual(RS.resumePlace(spot, () => false, () => ({ x: 20, z: 1 })), { x: 20, z: 1 });
});

test('W5-N6 the title: with a saved city spot 继续旅程 resumes (primary) and 从头开始 starts at the Ferry Building; district unchanged', async () => {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { TitleScreen } = await import('../src/opus-bay/ui/TitleScreen');
  const render = () => renderToStaticMarkup(h(TitleScreen, { onStart: () => undefined }));
  try {
    save.clearSave();
    game.set({ ...initialGameState(), phase: 'title', worldMode: 'city' });
    const fresh = render();
    assert.match(fresh, /ob-title-start[^>]*><span>开始<\/span>/);
    assert.doesNotMatch(fresh, /ob-title-resume/);
    save.patchSave(s => { s.lastSafe = { world: 'city', x: -300, z: 900, heading: 0.4, zone: 'golden-gate-park' }; });
    const back = render();
    assert.match(back, /ob-title-start[^>]*><span>继续旅程<\/span>/, 'the primary button resumes');
    assert.match(back, /ob-title-resume[^>]*>.*从头开始 · 渡轮大厦/, 'the secondary starts over (progress kept)');
    assert.match(back, /欢迎回来！接着逛吗？/);
    assert.doesNotMatch(back, /继续上次的位置/, 'one resume button, not two');
    // the district title never offers the city spot
    game.set({ ...initialGameState(), phase: 'title', worldMode: 'district' });
    assert.doesNotMatch(render(), /ob-title-resume|从头开始/);
  } finally { save.clearSave(); game.set({ ...initialGameState() }); }
});

test('W5-N6 startOrResume: a resume request with a saved city spot skips the arrival cinematic; without one, the old start', async () => {
  try {
    save.clearSave();
    game.set({ ...initialGameState(), phase: 'title', worldMode: 'city' });
    save.patchSave(s => { s.lastSafe = { world: 'city', x: S.x, z: S.z, heading: 0 }; });
    save.requestResume();
    RS.startOrResume();
    assert.equal(game.get().phase, 'arrival', 'waiting for the city at the saved spot (no ferry cinematic)');
    assert.equal(save.takeResumeRequest(), false, 'the request was taken');
    assert.ok(Math.hypot(runtime.player.x - S.x, runtime.player.z - S.z) < 1e-6, 'placed on the saved spot at once');
    // no streamer in node: the wait gives up after READY_MAX_MS (the mocked clock moves on), then play begins there
    tick(20_000);
    for (let i = 0; i < 20 && game.get().phase !== 'playing'; i++) await new Promise(r => setTimeout(r, 120));
    assert.equal(game.get().phase, 'playing');
    assert.ok(Math.hypot(runtime.player.x - S.x, runtime.player.z - S.z) < 1e-6, 'the standable saved spot itself');
  } finally { save.clearSave(); game.set({ ...initialGameState() }); }
});

// ---------------------------------------------------------------------------------------------------------------
// W5-N4 · the phone map: the pinned card, the chooser, long-press 去这里, search results with the go button
// ---------------------------------------------------------------------------------------------------------------

const MG = await import('../src/opus-bay/ui/mapGo');
type Bx = { l: number; t: number; r: number; b: number };
const insideFrame = (a: Bx, f: { w: number; h: number }) => a.l >= 0 && a.t >= 0 && a.r <= f.w && a.b <= f.h;
const apart = (a: Bx, b: Bx) => a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t;

test('W5-N4 the pinned card never hides its go button: inside the 352 × 388 phone map (and 337 × 307), clear of the tools and the compass', () => {
  for (const f of [{ w: 352, h: 388 }, { w: 337, h: 307 }, { w: 1200, h: 430 }]) {
    const card = MG.goCardBox(f), go = MG.goButtonBox(f);
    assert.ok(insideFrame(card, f) && insideFrame(go, f), `${f.w} × ${f.h}: card and button inside the frame`);
    assert.ok(go.l >= card.l && go.r <= card.r && go.t >= card.t && go.b <= card.b, 'the button inside the card');
    assert.ok(go.b - go.t >= 48 && go.r - go.l >= 200, `a big button: ${go.r - go.l} × ${go.b - go.t}`);
    // the tool column (top 8 px, right 8 px) stops above the card when one shows; the compass (8…44 top-left) is above it
    const toolsBottom = MG.GO_CARD.toolsTop + MG.toolsMaxHeight(f.h, true);
    assert.ok(toolsBottom <= card.t - MG.GO_CARD.toolsGap + 1e-9, `${f.w} × ${f.h}: tools end at ${toolsBottom}, the card starts at ${card.t}`);
    assert.ok(apart(go, { l: f.w - 8 - 36, t: 8, r: f.w - 8, b: toolsBottom }), 'the go button clear of the tool column');
    assert.ok(apart(card, { l: 8, t: 8, r: 44, b: 44 }), 'clear of the compass');
    // at least three tool buttons (36 px + 8 gap) per column above the card
    assert.ok(MG.toolsMaxHeight(f.h, true) >= 3 * 36 + 2 * 8, 'three buttons a column');
  }
  // the short frame (375 × 667) takes the one-line head: 96 px instead of 114
  assert.equal(MG.goCardHeight(388), 114);
  assert.equal(MG.goCardHeight(307), 96);
  assert.equal(MG.toolsMaxHeight(388, false), 358, 'no card: the wave-4 column');
});

test('W5-N4 a selection under the card pans above it; a clear one stays', () => {
  const v = { cx: 0, cz: 0, scale: 1, w: 352, h: 388 };
  const top = MG.goCardBox(v).t;
  assert.equal(MG.panForCard(v, { x: 0, z: 0 }), null, 'the centre is clear');
  const under = { x: 10, z: 150 };            // y = 194 + 150 = 344: under the card
  const moved = MG.panForCard(v, under)!;
  const y = (under.z - moved.cz) * moved.scale + moved.h / 2;
  assert.ok(y <= top - 28 && y >= 36, `now at ${y}`);
  assert.equal(moved.cx, v.cx, 'only moved up / down');
  const hugTop = MG.panForCard(v, { x: 0, z: -180 })!;
  assert.ok((-180 - hugTop.cz) + 194 >= 36, 'off the top edge');
});

test('W5-N4 long-press → the nearest walkable arrival spot (standable, snapped, graph, place, land), its name; the sea → null', () => {
  type PL = import('../src/opus-bay/ui/mapGo').PressLookups;
  const places = [{ id: 'coit', name: bi('科伊特塔', 'Coit Tower'), x: 100, z: 100, arrival: { x: 104, z: 98 } }];
  const lk = (o: Partial<PL> = {}): PL => ({
    stand: () => 1, nearestWalkable: p => ({ x: p.x + 3, z: p.z }), graphNear: p => ({ x: p.x, z: p.z + 7 }),
    placesNear: (x, z, r) => places.filter(p => Math.hypot(p.x - x, p.z - z) <= r), onLand: () => true, area: () => bi('北滩', 'North Beach'), ...o,
  });
  // standable: the pressed point itself, named by the place near it
  const a = MG.pressSpot({ x: 120, z: 110 }, lk())!;
  assert.deepEqual([a.x, a.z, a.moved], [120, 110, 0]);
  assert.deepEqual(a.name, { zh: '科伊特塔附近', en: 'Near Coit Tower' });
  // a roof / a wall on a loaded chunk: the nearest standable spot
  const b = MG.pressSpot({ x: 120, z: 110 }, lk({ stand: () => 0 }))!;
  assert.deepEqual([b.x, b.z, b.moved], [123, 110, 3]);
  assert.equal(MG.pressSpot({ x: 120, z: 110 }, lk({ stand: () => 0, nearestWalkable: () => null })), null, 'water on a loaded chunk');
  // a chunk not loaded: the walking graph's node, else the nearest walkable place arrival, else the point on land
  assert.equal(MG.pressSpot({ x: 500, z: 500 }, lk({ stand: () => -1 }))!.z, 507);
  const c = MG.pressSpot({ x: 110, z: 110 }, lk({ stand: () => -1, graphNear: () => null }))!;
  assert.deepEqual([c.x, c.z], [104, 98], 'the place arrival');
  const d = MG.pressSpot({ x: 900, z: 900 }, lk({ stand: () => -1, graphNear: () => null }))!;
  assert.deepEqual([d.x, d.z, d.near], [900, 900, null]);
  assert.deepEqual(d.name, bi('北滩', 'North Beach'), 'no place near: the area');
  assert.deepEqual(MG.pressSpot({ x: 900, z: 900 }, lk({ stand: () => -1, graphNear: () => null, area: () => null }))!.name, { zh: '这里', en: 'This spot' });
  assert.equal(MG.pressSpot({ x: 900, z: -900 }, lk({ stand: () => -1, graphNear: () => null, onLand: () => false })), null, 'the sea');
  // the trip's place id follows goTo's rule (the map does not load the goTo runner)
  for (const p of [{ x: 100.4, z: -20.6 }, { x: -0.5, z: 3.5 }, { x: 12, z: 7 }]) assert.equal(MG.pressPlaceId(p), pointPlaceId(p));
  // held 0.52 s without moving past 8 px, one pointer
  assert.equal(MG.isLongPress(520, 3, 1), true);
  assert.equal(MG.isLongPress(519, 0, 1), false);
  assert.equal(MG.isLongPress(900, 9, 1), false);
  assert.equal(MG.isLongPress(900, 0, 2), false, 'a pinch is no press');
});

test('W5-N4 the quick rows plan from the route cache only (no search starts), with the card\'s rules', () => {
  const cache = TPV.tripRouteCache();
  const before = cache.pending();
  const peek = TPV.peekTripProviders();
  const list = TP.planTrips({ x: 0, z: 0 }, destAt(600, 0, 'somewhere'), peek);
  assert.equal(cache.pending(), before, 'no route search started');
  const rec = recOf(list)!;
  assert.ok(rec, 'a way from the estimates');
  assert.ok(rec.legs.every(l => l.via !== 'walk' || l.estimate), 'on-foot legs are estimates until the routes land');
  assert.equal(peek.autoPace, true, 'the carried pace, as the card');
});

test('W5-N4 the list time is the carried pace (straight × 1.25), as the card\'s go button before its route lands', async () => {
  const { listWalkSeconds } = await import('../src/opus-bay/ui/mapListData');
  const est = TP.planTrips({ x: 0, z: 0 }, destAt(0, 700), { autoPace: true, walk: () => undefined });
  assert.ok(Math.abs(listWalkSeconds({ x: 0, z: 0 }, { x: 0, z: 700 }) - recOf(est)!.seconds) < 1e-9);
});

test('W5-N4 the pinned card and the chooser render the way, the time and the words', async () => {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MapGoCard, ClusterChooser } = await import('../src/opus-bay/ui/MapGoCard');
  const html = renderToStaticMarkup(h(MapGoCard, { title: bi('艺术宫', 'Palace'), meta: '码头区', option: opt('fly', 7), onGo: () => undefined, onMore: () => undefined, onClose: () => undefined }));
  assert.match(html, /mw-gocard/);
  assert.match(html, /飞过去 · 约 7 秒/);
  assert.match(html, /码头区/);
  assert.match(html, /aria-label="其他方式和详情"/);
  const none = renderToStaticMarkup(h(MapGoCard, { title: bi('去这里'), option: null, noWay: bi('那里去不了，长按陆地试试'), onGo: () => undefined, onClose: () => undefined, short: true }));
  assert.match(none, /is-short/);
  assert.match(none, /那里去不了，长按陆地试试/);
  assert.doesNotMatch(none, /mw-go"/);
  const rows = [
    { key: 'a:coit-tower', placeId: 'coit-tower', x: 1, z: 2, name: bi('科伊特塔'), attraction: 'coit-tower' },
    { key: 'p:osm-1', placeId: 'osm-1', x: 3, z: 4, name: bi('小广场'), sub: '去过' },
  ];
  const ch = renderToStaticMarkup(h(ClusterChooser, { rows, ways: new Map([['a:coit-tower', opt('walk', 50)], ['p:osm-1', null]]), onPick: () => undefined, onZoom: () => undefined, onClose: () => undefined }));
  assert.match(ch, /这里有 2 个地方/);
  assert.match(ch, /放大看看/);
  assert.equal((ch.match(/class="mw-rowgo/g) ?? []).length, 1, 'a go button where a way is known');
  assert.match(ch, /aria-label="出发：步行，约 50 秒/);
});

// ---------------------------------------------------------------------------------------------------------------
// W5-N7 · the quiet HUD: the discovery chip, the 金门大桥 area on the deck, one waypoint owner
// ---------------------------------------------------------------------------------------------------------------

test('W5-N7 finds batch into one chip: every place but a T1 / T2 attraction on foot (its arrival moment toasts); T3 joins', () => {
  const found = [{ id: 'osm-cafe', name: bi('小咖啡馆') }, { id: 'coit', name: bi('科伊特塔') }, { id: 'steps', name: bi('格林尼治台阶') }];
  const rank = (id: string) => ({ coit: 1, steps: 3 } as Record<string, number>)[id];
  assert.deepEqual(G.chipFinds(found, true, rank).map(p => p.id), ['osm-cafe', 'steps'], 'on foot: Coit is its arrival moment');
  assert.deepEqual(G.chipFinds(found, false, rank).map(p => p.id), ['osm-cafe', 'coit', 'steps'], 'riding by: no moment, the chip counts it');
  // a showing chip grows (same key); a new one starts at the finds' count with the first name
  const a = G.bumpFound(null, [found[0]], 7)!;
  assert.deepEqual(a, { key: 7, n: 1, first: bi('小咖啡馆') });
  const b = G.bumpFound(a, [found[2], found[1]], 8)!;
  assert.deepEqual([b.key, b.n, b.first.zh], [7, 3, '小咖啡馆']);
  assert.equal(G.bumpFound(b, [], 9), b, 'nothing new: unchanged');
  assert.ok(G.FOUND_CHIP_MS >= 3000 && G.FOUND_CHIP_MS <= 6000);
});

test('W5-N7 discovery hands its finds to the city guide (no gold toast each); without it the wave-3 toast', async () => {
  const D = await import('../src/opus-bay/game/discovery');
  const seen: string[][] = [];
  try {
    D.setDiscoveryAnnouncer(list => { seen.push(list.map(p => p.id)); });
    game.set({ ...initialGameState(), worldMode: 'city', phase: 'playing', toasts: [] });
    const ix = { near: () => [{ id: 'osm-x', name: bi('某处'), x: 0, z: 0 }] } as unknown as Parameters<typeof D.newlyDiscovered>[0];
    for (const pl of D.newlyDiscovered(ix, { x: 0, z: 0 }, D.isDiscovered)) D.markDiscovered(pl);
    tick(D.STAMP_GAP_MS + 10);
    D.updateDiscovery({ x: 9999, z: 9999 }, performance.now());
    assert.deepEqual(seen, [['osm-x']], 'the announcer got the find');
    assert.equal(game.get().toasts.length, 0, 'no toast');
  } finally { D.setDiscoveryAnnouncer(null); D.resetDiscovery(); save.clearSave(); game.set({ ...initialGameState() }); }
});

test('W5-N7 the area chip says 金门大桥 on the deck (over the water; with a height: up on it anywhere), not at Fort Point under it', async () => {
  const CZ = await import('../src/opus-bay/data/cityZones');
  const { ELEVATED_WALKS } = await import('../src/opus-bay/game/brain');
  const deck = ELEVATED_WALKS.find(w => w.id === 'ggb-deck')!;
  const span = CZ.LANDMARK_SPANS.find(s => s.id === 'golden-gate-bridge')!;
  assert.deepEqual([span.a, span.b], [deck.span.a, deck.span.b], 'the brain\'s walkway');
  const at = (t: number, off = 0) => { const ax = span.b.x - span.a.x, az = span.b.z - span.a.z, L = Math.hypot(ax, az); return { x: span.a.x + ax * t - (az / L) * off, z: span.a.z + az * t + (ax / L) * off }; };
  const mid = at(0.5);
  assert.deepEqual(CZ.cityAreaAt(mid.x, mid.z), { id: 'golden-gate-bridge', name: bi('金门大桥', 'Golden Gate Bridge') });
  assert.equal(CZ.cityAreaAt(mid.x, mid.z, 15.2)?.id, 'golden-gate-bridge');
  assert.equal(CZ.landmarkAreaAt(mid.x, mid.z)?.name.zh, '金门大桥');
  const edge = at(0.5, 9);
  assert.equal(CZ.landmarkSpanAt(edge.x, edge.z)?.id, 'golden-gate-bridge', 'the deck\'s width');
  const off = at(0.5, 14);
  assert.equal(CZ.landmarkSpanAt(off.x, off.z), null, 'beside the bridge: the water');
  // Fort Point, under the deck's south end (local −149 ≈ 18 % of the way): not without a height; on the deck with one
  const fort = at(0.18);
  assert.equal(CZ.landmarkSpanAt(fort.x, fort.z), null);
  assert.equal(CZ.landmarkSpanAt(fort.x, fort.z, 4), null, 'down at Fort Point');
  assert.equal(CZ.landmarkSpanAt(fort.x, fort.z, 15.2)?.id, 'golden-gate-bridge', 'up on the approach');
  assert.equal(CZ.zoneName('golden-gate-bridge').zh, '金门大桥', 'a saved lastSafe zone names it (welcome back)');
  // the landmark circles still answer (Chinatown at the Dragon Gate)
  assert.equal(CZ.cityAreaAt(82, 176)?.id, 'chinatown');
});

test('W5-N7 one waypoint owner: a running trip\'s leg over the map target and the soft goal hint (the hint waits during a trip)', async () => {
  const T = await import('../src/opus-bay/game/trips');
  assert.equal(T.pickObjective({ trip: true, mapTarget: 'x', freeHint: { x: 1 } }), 'trip');
  assert.equal(T.pickObjective({ mapTarget: 'x', freeHint: { x: 1 } }), 'mapTarget');
  assert.equal(T.pickObjective({ freeHint: { x: 1 } }), 'freeHint');
  const { freeHintSuppressed } = await import('../src/opus-bay/game/waypoint');
  assert.equal(freeHintSuppressed({ trip: true, nowMs: 0 }), true);
});

// ---------------------------------------------------------------------------------------------------------------
// W5-N8 · flags: the sources' pennants on phones near the player / the waypoint; V's glyphs; bad input
// ---------------------------------------------------------------------------------------------------------------

test('W5-N8 phones: a source\'s pennant stands near the player (≤ 600 u) or the waypoint, the waypoint\'s first; desktop keeps its far', () => {
  const player = { x: 0, z: 0 }, yaw = Math.PI; // the camera looks toward +z
  const ev = (key: string, z: number, extra: Partial<import('../src/opus-bay/game/flags').ExtraFlag> = {}) => ({ key, x: 0, z, color: '#e8705a', glyph: 'CalendarDays' as const, far: 3000, ...extra });
  const extras = [ev('far', 1200), ev('near', 400), ev('wp', 2200)];
  const target = { x: 0, z: 2150 };
  const phone = flags.pickFlags({ player, yaw, attractions: [], discovered: () => false, target, max: 3, extras, phone: true });
  assert.deepEqual(phone.filter(p => p.role === 'extra').map(p => p.key), ['wp', 'near'], 'the waypoint\'s event first, then the near one; the far one waits');
  const desk = flags.pickFlags({ player, yaw, attractions: [], discovered: () => false, target, max: 6, extras });
  assert.deepEqual(desk.filter(p => p.role === 'extra').map(p => p.key), ['wp', 'near', 'far'], 'desktop: every one in view within its far');
  // V's glyphs draw; an unknown glyph is the pin; a bad colour falls back
  const odd = flags.pickFlags({ player, yaw, attractions: [], discovered: () => false, max: 6, extras: [ev('a', 300, { glyph: 'Music' }), ev('b', 320, { glyph: 'Nope' as never, color: 'red' })] });
  assert.deepEqual(odd.map(p => [p.key, p.glyph, p.color]), [['a', 'Music', '#e8705a'], ['b', 'MapPin', flags.EXTRA_FALLBACK_COLOR]]);
});

test('W5-N8 every flag glyph has its atlas drawing (V\'s 512² cells in FLAG_GLYPHS order: coins, calendar, sparkles, music)', async () => {
  const { FLAG_GLYPH_NODES } = await import('../src/opus-bay/world/sf/flagGlyphs');
  for (const g of flags.FLAG_GLYPHS) assert.ok(FLAG_GLYPH_NODES[g]?.length, g);
  for (const g of ['Coins', 'CalendarDays', 'Sparkles', 'Music']) assert.equal(flags.extraGlyph(g), g);
  assert.equal(flags.extraGlyph(undefined), 'MapPin');
});

test('W5-N7 an attraction passed on a trip\'s way goes quiet (the chip); the trip\'s own end, and free roam, keep the moment', () => {
  const trip = { placeId: 'coit-tower', attraction: 'coit-tower', leg: 0, legs: [{ via: 'walk' as const, from: { x: 0, z: 0 }, to: { x: -50, z: 51 }, seconds: 60, length: 400 }] };
  assert.equal(G.arrivalPassBy({ attraction: 'transamerica-pyramid', place: 'osm-tp' }, trip, { x: 60, z: 90 }), true, 'passed on the way');
  assert.equal(G.arrivalPassBy({ attraction: 'coit-tower', place: 'coit-tower' }, trip, { x: -50, z: 51 }), false, 'the destination');
  assert.equal(G.arrivalPassBy({ attraction: 'pioneer-park', place: 'osm-pp' }, trip, { x: -60, z: 60 }), false, 'beside the trip end (a pier, a stop)');
  assert.equal(G.arrivalPassBy({ attraction: 'transamerica-pyramid', place: 'osm-tp' }, null, { x: 60, z: 90 }), false, 'free roam');
  assert.equal(G.arrivalPassBy({ attraction: 'transamerica-pyramid', place: 'osm-tp' }, { ...trip, leg: 1 }, { x: 60, z: 90 }), false, 'a finished trip');
});

test('W5-N8 the map\'s 这周: one pin per venue (soonest first), today\'s under 全部, the week under 这周, the when words', async () => {
  const ME = await import('../src/opus-bay/ui/mapEvents');
  const { parseBayDate } = await import('../src/opus-bay/game/bayNow');
  const at = (s: string) => parseBayDate(s)!.getTime();
  const venue = (id: string, x: number) => ({ id, name: bi(id), x, z: 0 });
  const now = at('2026-10-03T10:30');
  const windows = [
    { event: { id: 'hsb', title: '蓝草音乐节' }, venue: venue('hellman-hollow', 1), open: at('2026-10-03T11:00'), close: at('2026-10-03T19:00') },
    { event: { id: 'african', title: '非洲艺术节' }, venue: venue('ybg', 2), open: at('2026-10-03T10:00'), close: at('2026-10-03T17:00') },
    { event: { id: 'castro', title: '卡斯特罗街集' }, venue: venue('castro', 3), open: at('2026-10-04T11:00'), close: at('2026-10-04T18:00') },
    { event: { id: 'dumplings', title: '饺子节' }, venue: venue('ferry', 4), open: at('2026-10-06T11:00'), close: at('2026-10-06T15:00') },
    { event: { id: 'hsb-2', title: '蓝草音乐节 · 第二天' }, venue: venue('hellman-hollow', 1), open: at('2026-10-04T11:00'), close: at('2026-10-04T19:00') },
    { event: { id: 'over', title: '已结束' }, venue: venue('old', 5), open: at('2026-10-02T11:00'), close: at('2026-10-02T12:00') },
  ];
  const pins = ME.weekPins(windows, now);
  assert.deepEqual(pins.map(p => p.key), ['ev:ybg', 'ev:hellman-hollow', 'ev:castro', 'ev:ferry'], 'one per venue, a closed window gone');
  const hh = pins.find(p => p.venue.id === 'hellman-hollow')!;
  assert.deepEqual(hh.events.map(e => e.id), ['hsb', 'hsb-2']);
  assert.deepEqual([hh.today, hh.live], [true, false]);
  assert.deepEqual(hh.events[0].when, { zh: '今天 11:00–19:00', en: 'Today 11:00–19:00' });
  assert.equal(pins[0].live, true, 'YBG is on');
  assert.equal(pins[0].events[0].when.zh, '进行中 · 到 17:00');
  assert.equal(pins.find(p => p.venue.id === 'castro')!.events[0].when.zh, '明天 11:00–18:00');
  assert.equal(pins.find(p => p.venue.id === 'ferry')!.events[0].when.zh, '10/6 周二 11:00–15:00');
  assert.deepEqual(ME.pinsFor('all', pins).map(p => p.key), ['ev:ybg', 'ev:hellman-hollow'], '全部: today\'s');
  assert.equal(ME.pinsFor('week', pins).length, 4);
  assert.equal(ME.pinsFor('park', pins).length, 0, 'a category chip: none');
});
