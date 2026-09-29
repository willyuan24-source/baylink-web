import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * Wave 6 · lane G (W6-G2) · trick-or-treat: the rules (halloween/treat.ts), the doors' data (treatDoors.ts /
 * treatStreets.ts: ids inside halloween/rewards.ts, the streets' lines in lines.ts), the geometry budget (treatMesh.ts),
 * and every door on the published city (standable knock spot off the roadway, a building's wall right behind it).
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const treat = await import('../src/opus-bay/halloween/treat');
const { TREAT_DOORS } = await import('../src/opus-bay/halloween/treatDoors');
const { TREAT_STREETS, DOORS_PER_STREET, KNOCK_OUT } = await import('../src/opus-bay/halloween/treatStreets');
const { HALLOWEEN_REWARD_IDS } = await import('../src/opus-bay/halloween/rewards');
const { HALLOWEEN_LINES } = await import('../src/opus-bay/halloween/lines');
const mesh = await import('../src/opus-bay/halloween/treatMesh');
const { REWARD_SOURCE } = await import('../src/opus-bay/core/events');

test('W6-G2 doors: numbered 1…n in order, ≤ 60, every door:n / night:n a reward id; six real streets, ≥ 8 doors each, each with its line', () => {
  assert.ok(TREAT_DOORS.length >= 54 && TREAT_DOORS.length <= 60, `${TREAT_DOORS.length} doors`);
  TREAT_DOORS.forEach((d, i) => {
    assert.equal(d.n, i + 1);
    assert.ok(HALLOWEEN_REWARD_IDS.includes(`door:${d.n}`) && HALLOWEEN_REWARD_IDS.includes(`night:${d.n}`), `door ${d.n}`);
    assert.match(treat.doorSource(d.n), REWARD_SOURCE);
    assert.ok([d.x, d.z, d.y, d.f].every(Number.isFinite));
  });
  const lines = new Set(HALLOWEEN_LINES.map(l => l.id));
  for (const st of TREAT_STREETS) {
    const n = TREAT_DOORS.filter(d => d.street === st.id).length;
    assert.ok(n >= DOORS_PER_STREET - 2 && n <= DOORS_PER_STREET, `${st.id}: ${n} doors`);
    assert.ok(lines.has(st.line), `${st.id}: line ${st.line}`);
  }
  // doors of a street stay apart (a knock spot is one door's)
  for (const a of TREAT_DOORS) for (const b of TREAT_DOORS) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 2.7, `doors ${a.n} ${b.n}`);
});

test('W6-G2 rules: the season rolls daily (more in the treat hours), the big night answers every door with two candies and night:n, again after a treat, closed out of season', () => {
  const none = () => false;
  // the season: roughly two in three doors answer; the treat hours more; the roll is stable for a day and moves the next
  const day = '2026-10-12';
  const answers = TREAT_DOORS.filter(d => treat.doorAnswers(d.n, 'season', day, false)).length;
  const evening = TREAT_DOORS.filter(d => treat.doorAnswers(d.n, 'season', day, true)).length;
  assert.ok(answers > TREAT_DOORS.length * 0.45 && answers < TREAT_DOORS.length * 0.85, `${answers} answer`);
  assert.ok(evening >= answers, 'the treat hours open more doors');
  assert.equal(TREAT_DOORS.filter(d => treat.doorAnswers(d.n, 'season', day, false)).length, answers);
  const other = TREAT_DOORS.filter(d => treat.doorAnswers(d.n, 'season', '2026-10-13', false) !== treat.doorAnswers(d.n, 'season', day, false)).length;
  assert.ok(other > 0, 'another day, other doors');
  // a door that answers gives one candy and pays door:n
  const open = TREAT_DOORS.find(d => treat.doorAnswers(d.n, 'season', day, false))!;
  const k = treat.knockResult(open.n, 'season', day, false, none);
  assert.equal(k.kind, 'treat');
  if (k.kind === 'treat') {
    assert.equal(k.pieces, 1);
    assert.deepEqual(k.pays, [{ source: `halloween:door:${open.n}`, coins: treat.DOOR_COINS }]);
  }
  const shut = TREAT_DOORS.find(d => !treat.doorAnswers(d.n, 'season', day, false))!;
  assert.equal(treat.knockResult(shut.n, 'season', day, false, none).kind, 'nobody');
  // after the treat: again (not paid twice)
  const paidOpen = (s: string) => s === `halloween:door:${open.n}`;
  assert.equal(treat.knockResult(open.n, 'season', day, false, paidOpen).kind, 'again');
  // the big night: every door, two candies, night:n (+ door:n when never knocked)
  for (const d of TREAT_DOORS) assert.ok(treat.doorAnswers(d.n, 'night', '2026-10-31', false));
  const n1 = treat.knockResult(open.n, 'night', '2026-10-31', true, paidOpen);
  assert.ok(n1.kind === 'treat' && n1.pieces === 2 && n1.pays.length === 1 && n1.pays[0].source === `halloween:night:${open.n}`);
  const n2 = treat.knockResult(shut.n, 'night', '2026-10-31', true, none);
  assert.ok(n2.kind === 'treat' && n2.pays.map(p => p.source).join() === `halloween:door:${shut.n},halloween:night:${shut.n}`);
  assert.equal(treat.knockResult(open.n, 'night', '2026-10-31', true, s => s === `halloween:night:${open.n}`).kind, 'again');
  // out of season: nothing
  for (const ph of ['off', 'muertos'] as const) assert.equal(treat.knockResult(open.n, ph, '2026-11-01', true, none).kind, 'closed');
  // the bag: one per door treat, two per night treat; every door knocked
  const paid = new Set([`halloween:door:${open.n}`, `halloween:night:${open.n}`, `halloween:door:${shut.n}`]);
  assert.equal(treat.candyCount(s => paid.has(s)), 4);
  assert.equal(treat.doorsKnocked(s => paid.has(s)), 2);
  assert.ok(!treat.allDoorsKnocked(s => paid.has(s)));
  assert.ok(treat.allDoorsKnocked(s => s.startsWith('halloween:door:')));
  // the candy of a door is one of the six, stable for the day
  assert.equal(treat.candyOf(3, day).id, treat.candyOf(3, day).id);
  assert.ok(treat.CANDIES.includes(treat.candyOf(3, day)));
});

test('W6-G2 geometry: a door ≤ DOOR_TRIS_MAX triangles (a street of ten in one mesh), glows in the treat hours, dark when nobody answers; swing and candy small', () => {
  const d = TREAT_DOORS[0];
  const one = mesh.buildDoorsGeometry([d], () => ({ answers: true, bright: true, open: false }));
  assert.ok(mesh.trianglesOf(one) <= mesh.DOOR_TRIS_MAX, `${mesh.trianglesOf(one)} triangles a door`);
  const street = mesh.buildDoorsGeometry(TREAT_DOORS.filter(x => x.street === d.street), () => ({ answers: true, bright: false, open: false }));
  assert.ok(mesh.trianglesOf(street) <= mesh.DOOR_TRIS_MAX * DOORS_PER_STREET);
  const glow = (geo: ReturnType<typeof mesh.buildDoorsGeometry>) => { const a = geo.getAttribute('aInfo'); let hi = 0; for (let i = 0; i < a.count; i++) hi = Math.max(hi, a.getW(i)); return hi; };
  assert.ok(glow(one) > 1, 'the treat hours: lit always');
  assert.ok(glow(mesh.buildDoorsGeometry([d], () => ({ answers: true, bright: false, open: false }))) <= 1, 'else lit at night only');
  assert.ok(glow(mesh.buildDoorsGeometry([d], () => ({ answers: false, bright: true, open: false }))) <= 0.5, 'nobody home: dark');
  assert.ok(glow(mesh.buildDoorsGeometry([d], () => ({ answers: true, bright: false, open: true }))) > 1, 'an open door: the lit doorway');
  assert.ok(mesh.trianglesOf(mesh.buildSwingGeometry('#6b2d5c')) <= 60);
  assert.ok(mesh.trianglesOf(mesh.buildCandyGeometry([treat.CANDIES[0], treat.CANDIES[1], treat.CANDIES[2]])) <= 120);
  // one material, the TOY_DYN program (no new program)
  assert.equal(mesh.doorMaterial().customProgramCacheKey(), 'ob-toy-dyn');
  // the knock spot is KNOCK_OUT in front of the door, toward the street
  const p = mesh.doorPoints(d, KNOCK_OUT).knock;
  assert.ok(Math.abs(Math.hypot(p.x - d.x, p.z - d.z) - KNOCK_OUT) < 1e-6);
});

test('W6-G2 on the published city: every knock spot standable and off the roadway, a building wall right behind every door', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, heightAt, setCityTerrain, surfaceAt } = await import('../src/opus-bay/core/terrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  for (const st of TREAT_STREETS) {
    const ds = TREAT_DOORS.filter(d => d.street === st.id);
    const cx = ds.reduce((s, d) => s + d.x, 0) / ds.length, cz = ds.reduce((s, d) => s + d.z, 0) / ds.length;
    await sf.attachAround(city, cx, cz, 110, lms);
  }
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    for (const d of TREAT_DOORS) {
      const s = Math.sin(d.f), c = Math.cos(d.f);
      const k = mesh.doorPoints(d, KNOCK_OUT).knock;
      assert.ok(canStand(k.x, k.z, 0.3), `door ${d.n}: the knock spot is standable`);
      assert.notEqual(surfaceAt(k.x, k.z), 'road', `door ${d.n}: not the roadway`);
      // the wall: 0.25 u behind the door is inside a building (not standable), the step 0.3 u out is
      assert.ok(!canStand(d.x - s * 0.25, d.z - c * 0.25, 0.05), `door ${d.n}: a wall behind it`);
      assert.ok(Math.abs(heightAt(d.x + s * 0.3, d.z + c * 0.3) - d.y) < 0.35, `door ${d.n}: y on the ground`);
    }
  } finally {
    setCityTerrain(null);
  }
});
