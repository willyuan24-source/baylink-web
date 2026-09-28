import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Wave 5 · lane N (plan sf-w5-plan.md §4.5): the navigation hooks and one-tap travel.
 *   W5-N1  goTo() resolution and choice, the tiny hook module, registerFlagSource + pickFlags extras, FootprintsTab
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;

const { resolveGoToTarget, chooseGoToOption, goToSource, pointPlaceId, POINT_NAME } = await import('../src/opus-bay/game/goToRun');
const { ATTRACTION_INDEX, tripDestination } = await import('../src/opus-bay/data/sf/attractions');
const flags = await import('../src/opus-bay/game/flags');
const { ROLE_CODE } = await import('../src/opus-bay/world/sf/flags');
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
