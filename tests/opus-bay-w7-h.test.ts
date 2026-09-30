import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Wave 7 · lane H: the Halloween world, part a — the pumpkin dusk (Karl's golden colour, pushed by the feature), the
// trick-or-treaters and hanging ghosts that move (the toy shader's sway), bats readable at night, the stoops' glow
// nearest first, the lantern guide (which way + the wisps), Día de los Muertos by the hour, the new fixed lines.

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const zhLen = (s: string) => [...s].length;
const hasZh = (s: string) => /[一-鿿]/.test(s);

const THREE = await import('three');
const { KARL } = await import('../src/opus-bay/world/fogShader');
const { KarlState, KARL_TIME } = await import('../src/opus-bay/world/sf/fog');
const { Batch } = await import('../src/opus-bay/world/builder');
const { TOY, TOY_DYN } = await import('../src/opus-bay/world/materials');
const WL = await import('../src/opus-bay/halloween/worldLines');
const WD = await import('../src/opus-bay/halloween/worldDress');
const HG = await import('../src/opus-bay/halloween/huntGuide');
const MU = await import('../src/opus-bay/halloween/muertos');
const { duskTintFor, DUSK_TINT } = await import('../src/opus-bay/halloween/world');
const { parseBayDate } = await import('../src/opus-bay/game/bayNow');

test('W7-H1 the pumpkin dusk: Karl\'s golden colour leans toward #f2a65a by DUSK_TINT (0.35) while the feature pushes it, only at golden hour; fog.ts reads no calendar', () => {
  const k = new KarlState();
  k.setTime('golden', true);
  const plain = KARL.uKarlColor.value.clone();
  assert.equal(plain.getHexString(), new THREE.Color(KARL_TIME.golden.color).getHexString());
  k.setGoldenTint(DUSK_TINT.color, DUSK_TINT.amount, true);
  assert.equal(DUSK_TINT.color, '#f2a65a');
  assert.ok(DUSK_TINT.amount >= 0.15 && DUSK_TINT.amount <= 0.4, 'a touch, not a filter');
  const want = new THREE.Color(KARL_TIME.golden.color).lerp(new THREE.Color('#f2a65a'), DUSK_TINT.amount);
  const got = KARL.uKarlColor.value;
  for (const c of ['r', 'g', 'b'] as const) assert.ok(Math.abs(got[c] - want[c]) < 1e-6, `${c} ${got[c]} vs ${want[c]}`);
  assert.equal(k.goldenTint, DUSK_TINT.amount);
  // by day the tint does nothing (the day colour as it is)
  k.setTime('day', true);
  assert.equal(KARL.uKarlColor.value.getHexString(), new THREE.Color(KARL_TIME.day.color).getHexString());
  // back to golden: tinted again; a later push slides (t restarts), `null` clears
  k.setTime('golden', true);
  assert.notEqual(KARL.uKarlColor.value.getHexString(), plain.getHexString());
  k.setGoldenTint(null, 0, false);
  assert.equal(k.t, 0, 'a later change slides with Karl');
  k.update(60);
  assert.equal(KARL.uKarlColor.value.getHexString(), plain.getHexString());
  // the same push twice is not a new slide
  k.setGoldenTint('#f2a65a', 0.18, true);
  const ep = k.epoch;
  k.setGoldenTint('#f2a65a', 0.18, false);
  assert.equal(k.epoch, ep);
  // the phases that want it; fog.ts never imports the season
  assert.equal(duskTintFor('off'), null);
  for (const p of ['season', 'night', 'muertos'] as const) assert.deepEqual(duskTintFor(p), DUSK_TINT);
  const src = fs.readFileSync(path.join(ROOT, 'src/opus-bay/world/sf/fog.ts'), 'utf8');
  assert.doesNotMatch(src, /from ['"][^'"]*halloween/, 'fog.ts imports nothing of the Halloween feature');
  const world = fs.readFileSync(path.join(ROOT, 'src/opus-bay/halloween/world.ts'), 'utf8');
  assert.match(world, /offer\('dusk', 'dusk'\)/, 'the recorded w6-h-dusk line is on offer at the season\'s golden hour');
});

test('W7-H2 trick-or-treaters rock from the feet and the hanging ghosts swing from their hooks (aInfo.z on the static TOY program, no new call)', () => {
  for (const costume of [0, 1, 2]) {
    const b = new Batch();
    WD.addFigure(b, [10, 5, 20], 0.4, costume);
    let lo = Infinity, hi = -Infinity, zLo = 0, zHi = 0;
    for (let v = 0; v < b.vertexCount; v++) {
      const y = b.pos[v * 3 + 1], z = b.inf[v * 4 + 2];
      assert.ok(z >= 0 && z <= WD.FIGURE_SWAY + 1e-9, `costume ${costume}: sway weight ${z}`);
      if (y < lo) { lo = y; zLo = z; }
      if (y > hi) { hi = y; zHi = z; }
    }
    assert.ok(zLo < 0.05, `costume ${costume}: the feet stay put (${zLo})`);
    assert.ok(zHi > 0.6, `costume ${costume}: the head rocks (${zHi})`);
    // the offset the shader applies at the top: ≈ 0.16 · z² (uWind 1) — visible, not a wobble
    assert.ok(0.16 * zHi * zHi > 0.06 && 0.16 * zHi * zHi < 0.12, `costume ${costume}: ${0.16 * zHi * zHi} u`);
  }
  // a stoop with a hanging ghost (variant 16…19): its lowest ghost vertex swings more than the string's top
  let found = false;
  for (let i = 0; i < WD.stoopCount() && !found; i++) {
    if (WD.stoopHash(i) % 20 < 16) continue;
    const b = new Batch();
    WD.addStoop(b, WD.stoopAt(i), [], false);
    let maxZ = 0;
    for (let v = 0; v < b.vertexCount; v++) maxZ = Math.max(maxZ, b.inf[v * 4 + 2]);
    assert.ok(maxZ > 0.8 && maxZ <= WD.GHOST_SWAY + 1e-9, `the ghost's hem swings (${maxZ})`);
    found = true;
  }
  assert.ok(found);
  // a stoop without a figure or ghost keeps z = 0 (pumpkins never sway)
  for (let i = 0; i < 400; i++) {
    if (WD.stoopHash(i) % 20 >= 16) continue;
    const b = new Batch();
    WD.addStoop(b, WD.stoopAt(i), [], false);
    for (let v = 0; v < b.vertexCount; v++) assert.equal(b.inf[v * 4 + 2], 0);
  }
  // the stoop mesh is drawn with the static TOY material (its sway), and TOY is the city cells' own program key
  const src = fs.readFileSync(path.join(ROOT, 'src/opus-bay/halloween/worldDress.ts'), 'utf8');
  assert.match(src, /mesh = new THREE\.Mesh\(geo, TOY\);/);
  assert.equal(TOY.customProgramCacheKey(), 'ob-toy');
  assert.notEqual(TOY_DYN.customProgramCacheKey(), TOY.customProgramCacheKey());
});

test('W7-H3 bats at full night: the wing tips carry a pale rim that glows at night, the body stays dark', () => {
  const bats = WD.createBats();
  const geo = bats.mesh.geometry;
  const col = geo.getAttribute('color'), inf = geo.getAttribute('aInfo');
  const lum = (i: number) => 0.2126 * col.getX(i) + 0.7152 * col.getY(i) + 0.0722 * col.getZ(i);
  for (let k = 0; k < WD.BATS_PER_COLONY; k++) {
    const o = k * 12;
    for (const tip of [6, 7, 10, 11]) {
      assert.ok(Math.abs(inf.getW(o + tip) - WD.BAT_GLOW.tip) < 1e-6);
      assert.ok(lum(o + tip) > lum(o) * 4, 'the rim is much lighter than the body');
    }
    for (const b of [0, 1, 2, 3]) assert.ok(Math.abs(inf.getW(o + b) - WD.BAT_GLOW.body) < 1e-6);
  }
  // night glow only ((0, 1] in the toy shader): nothing glows by day
  assert.ok(WD.BAT_GLOW.tip > 0 && WD.BAT_GLOW.tip <= 1);
  geo.dispose();
});

test('W7-H4 the stoops\' night glow keeps the nearest halos when the cap cuts', () => {
  const c = new THREE.Color(1, 0.6, 0.2);
  const cell = (x0: number) => Array.from({ length: 50 }, (_, i) => ({ x: x0 + i, y: 0, z: 0, size: 1, color: c }));
  // the far cell first (W6 kept whole cells in their order): the result is still the nearest
  const out = WD.nearestHalos([cell(100), cell(0)], 10, 0, 30);
  assert.equal(out.length, 30);
  // the 30 nearest of x = 0…49 to x = 10: 0…29 (the far cell at 100… never)
  const worst = Math.max(...out.map(h => Math.abs(h.x - 10)));
  assert.equal(worst, 19);
  assert.ok(out.every(h => h.x < 50));
  for (let i = 1; i < out.length; i++) assert.ok(Math.abs(out[i].x - 10) >= Math.abs(out[i - 1].x - 10));
  assert.equal(WD.nearestHalos([cell(0)], 0, 0, 500).length, 50);
  assert.ok(WD.HALO_RESORT > 0 && WD.HALO_RESORT <= 12);
});

test('W7-H8 the lantern guide: which way from the camera, once a lantern, a gap between lines, not when already there', () => {
  // the camera sits at (sin yaw, cos yaw) · d from the player: yaw 0 looks toward −z, its right is +x
  assert.equal(HG.sniffSide(0, 0, 0, 0, -30), 'ahead');
  assert.equal(HG.sniffSide(0, 0, 0, 0, 30), 'behind');
  assert.equal(HG.sniffSide(0, 0, 0, 30, -5), 'right');
  assert.equal(HG.sniffSide(0, 0, 0, -30, 5), 'left');
  assert.equal(HG.sniffSide(0, 0, Math.PI / 2, -30, 0), 'ahead', 'yaw π/2 looks toward −x');
  const guide = HG.createHuntGuide();
  const L = { n: 7, x: 0, z: -40 };
  assert.equal(guide.step(0, 0, 0, 0, L, false), null, 'BAYBAY may not speak');
  assert.equal(guide.step(1, 0, 0, 0, L, true), 'huntAhead');
  assert.equal(guide.step(100, 0, 0, 0, L, true), null, 'once a lantern');
  assert.equal(guide.step(2, 0, 0, 0, { n: 8, x: 40, z: 0 }, true), null, 'a gap between lines');
  assert.equal(guide.step(1 + HG.SNIFF_GAP, 0, 0, 0, { n: 8, x: 40, z: 0 }, true), 'huntRight');
  assert.equal(guide.step(500, 0, 0, 0, { n: 9, x: 0, z: 5 }, true), null, 'right there: the glint and the wisp do it');
  assert.equal(guide.step(500, 0, 0, 0, { n: 9, x: 0, z: HG.HUNT_RADAR + 1 }, true), null, 'out of reach');
  assert.deepEqual(guide.told(), [7, 8]);
  for (const s of ['ahead', 'left', 'right', 'behind'] as const) assert.ok(HG.sniffLine(s) in WL.HALLOWEEN_WORLD_LINES);
  const hunt = fs.readFileSync(path.join(ROOT, 'src/opus-bay/halloween/hunt.ts'), 'utf8');
  assert.match(hunt, /WISP_UP/);
  assert.match(hunt, /new THREE\.Mesh\(b\.build\(\), TOY\)/, 'the wisps sway on the lanterns\' own mesh (no new call)');
});

test('W7-H6 Día de los Muertos by the hour: 1 Nov the flags and Acción Latina, 2 Nov the park 08:00–21:00, the procession 18:00 / 19:00–21:00', () => {
  const at = (s: string) => parseBayDate(s)!;
  const none = '';
  const d1 = MU.muertosSchedule(at('2026-11-01T12:00'), none);
  assert.deepEqual({ ...d1, walkS: 0 }, { day: 1, altars: false, procession: 'none', walkS: 0 });
  assert.equal(MU.muertosSchedule(at('2026-11-02T07:59'), none).altars, false);
  assert.equal(MU.muertosSchedule(at('2026-11-02T08:00'), none).altars, true);
  assert.equal(MU.muertosSchedule(at('2026-11-02T17:59'), none).procession, 'none');
  assert.equal(MU.muertosSchedule(at('2026-11-02T18:00'), none).procession, 'gather');
  const w = MU.muertosSchedule(at('2026-11-02T19:30'), none);
  assert.equal(w.procession, 'walk');
  assert.ok(Math.abs(w.walkS - 1800) < 1, `${w.walkS}`);
  const late = MU.muertosSchedule(at('2026-11-02T21:00'), none);
  assert.equal(late.procession, 'none');
  assert.equal(late.altars, false);
  assert.equal(MU.muertosSchedule(at('2026-10-31T19:30'), none).day, 0);
  // a preview on another date: 2 November, the altars at any hour, the procession by the clock
  const pv = MU.muertosSchedule(at('2026-09-29T23:00'), '?halloween=muertos');
  assert.equal(pv.day, 2);
  assert.equal(pv.altars, true);
  assert.equal(pv.procession, 'none');
  assert.equal(MU.muertosSchedule(at('2026-09-29T19:10'), '?halloween=muertos').procession, 'walk');
  // which finds stand
  const accion = { where: 'accion-latina' }, park = { where: 'potrero-del-sol' }, arch = { where: 'procession-start' };
  assert.equal(MU.spotShown(accion, d1), true);
  assert.equal(MU.spotShown(park, d1), false);
  assert.equal(MU.spotShown(arch, d1), false);
  assert.equal(MU.spotShown(park, MU.muertosSchedule(at('2026-11-02T10:00'), none)), true);
  // the build without the park's altars has fewer triangles and only Acción Latina's candles
  const all: import('../src/opus-bay/halloween/worldHalos').HaloSpot[] = [], eve: typeof all = [];
  const a = MU.buildMuertos(all, true), b = MU.buildMuertos(eve, false);
  assert.ok((b.index?.count ?? 0) < (a.index?.count ?? 0));
  assert.ok(eve.length > 0 && eve.length < all.length);
  a.dispose(); b.dispose();
});

test('W7-H lines: the new fixed lines (w7-h-*) are short, bilingual, never templated; the dated ones hedge; wave 6\'s recording list unchanged', () => {
  const ids = new Set<string>();
  for (const l of WL.W7_WORLD_LINES) {
    assert.match(l.id, /^w7-h-[a-z0-9-]+$/, l.id);
    assert.ok(!ids.has(l.id));
    ids.add(l.id);
    assert.ok(hasZh(l.zh) && !hasZh(l.en) && l.en.trim().length > 0, `${l.id}: bilingual`);
    assert.ok(zhLen(l.zh) <= 45, `${l.id}: ${zhLen(l.zh)} zh characters`);
    assert.doesNotMatch(l.zh + l.en, /\$\{|undefined|NaN|\d{1,2}:\d{2}/, `${l.id}: fixed text`);
  }
  for (const k of ['muertosEve', 'processionGather', 'venuePumpkins'] as const) {
    assert.match(WL.HALLOWEEN_WORLD_LINES[k].zh, /以官网为准/, k);
    assert.match(WL.HALLOWEEN_WORLD_LINES[k].en, /official/, k);
  }
  assert.ok(WL.ALL_WORLD_LINES.every(l => l.id.startsWith('w6-h-')), 'ALL_WORLD_LINES stays wave 6\'s recorded list');
  assert.equal(WL.EVERY_WORLD_LINE.length, WL.ALL_WORLD_LINES.length + WL.W7_WORLD_LINES.length);
  assert.ok(WL.W7_WORLD_LINES.length >= 9);
});
