import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * Wave 8 · lane H (W8-H) · the door-to-street check on all six trick-or-treat streets (W7-G checked Belvedere only):
 * every live door of halloween/treatDoors.ts stands on its own street's frontage — straight out of the door the ground
 * is standable up to the roadway (no wall, no other house between), the roadway is within FRONT_MAX, the street there is
 * the door's own and the door faces square to it (tests/opus-bay-w8-h-doorcheck.ts). The numbers stay: a door that
 * moved keeps its n (its ledger id `halloween:door:<n>`), the list keeps its length and order.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { TREAT_DOORS } = await import('../src/opus-bay/halloween/treatDoors');
const { TREAT_STREETS, KNOCK_OUT } = await import('../src/opus-bay/halloween/treatStreets');

test('W8-H doors: every live treat door fronts its own street (straight out: standable to the kerb, its street, square to it)', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { doorProblem, roadsOf } = await import('./opus-bay-w8-h-doorcheck');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, setCityTerrain, surfaceAt } = await import('../src/opus-bay/core/terrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const sf = sfDisk();
  const far = await sf.far();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(far);
  const keys = new Set<string>();
  for (const st of TREAT_STREETS) {
    const ds = TREAT_DOORS.filter(d => d.street === st.id);
    const cx = ds.reduce((s, d) => s + d.x, 0) / ds.length, cz = ds.reduce((s, d) => s + d.z, 0) / ds.length;
    for (const k of await sf.attachAround(city, cx, cz, 110, lms)) keys.add(k);
  }
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    const chunks = [];
    for (const k of keys) { const [cx, cz] = k.split('_').map(Number); const ch = await sf.chunk(cx, cz); if (ch) chunks.push(ch); }
    const roads = roadsOf(chunks, far.names as unknown as string[]);
    const bad: string[] = [];
    for (const d of TREAT_DOORS) {
      if (d.gone) continue;
      const st = TREAT_STREETS.find(s => s.id === d.street)!;
      const why = doorProblem(d, KNOCK_OUT, st.osm, roads, { canStand, surfaceAt });
      if (why) bad.push(`door ${d.n} (${d.street}): ${why}`);
    }
    assert.deepEqual(bad, [], `${bad.length} doors off their street's frontage:\n${bad.join('\n')}`);
  } finally {
    setCityTerrain(null);
  }
});

test('W8-H doors: the numbers never change (1 … 54 in order, the gone doors stay gone, ≥ 7 live doors a street)', () => {
  assert.deepEqual(TREAT_DOORS.map(d => d.n), Array.from({ length: TREAT_DOORS.length }, (_, i) => i + 1));
  assert.equal(TREAT_DOORS.length, 54);
  assert.ok(TREAT_DOORS.find(d => d.n === 8)?.gone, 'Belvedere door 8 (a Clayton St house, W7-G7) stays gone');
  for (const st of TREAT_STREETS) assert.ok(TREAT_DOORS.filter(d => d.street === st.id && !d.gone).length >= 7, st.id);
});
