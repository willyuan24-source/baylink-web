import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * Wave 9 · lane H · 2 November's procession played (19:10, desktop, dev 5912; docs/opus-bay/sf-w9-H.md part b): the toy
 * traffic drove the procession's four streets among the walkers (110 of 1360 car samples within 3 u of the route's line in
 * 40 s; a toy car standing in the column on Bryant). The real streets are closed from the staging at 6 p.m. (SFMTA's 2025
 * notice, https://www.sfmta.com/travel-updates/dia-de-los-muertos-procession-sunday-november-2-2025, read 2026-10-02):
 * while the walkers are out (18:00–21:00, near) the route's streets are closed to the toy traffic (world/sf/roadClosures.ts).
 */

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };
const store = new Map<string, string>();
g.localStorage ??= { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(), key: () => null, length: 0 };


const MU = await import('../src/opus-bay/halloween/muertos');
const { ROUTE_CORNERS } = await import('../src/opus-bay/halloween/muertosSpots');
const { roadClosed } = await import('../src/opus-bay/world/sf/roadClosures');
const { __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const { runtime } = await import('../src/opus-bay/core/runtime');

const C = ROUTE_CORNERS;
const mid = (a: { x: number; z: number }, b: { x: number; z: number }) => ({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
/** the four legs' centreline middles (the corners are the streets' own junctions) */
const LEGS = { bryant: mid(C.bryant22, C.bryant24), '24th': mid(C.bryant24, C.mission24), mission: mid(C.mission24, C.mission22), '22nd': mid(C.mission22, C.bryant22) };
const off = (p: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }, k: number) => {
  const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
  return { x: p.x - (dz / L) * k, z: p.z + (dx / L) * k };
};

test("W9-H procession: the route's four streets and the staging on Bryant are its streets; a block away is not", () => {
  for (const [k, p] of Object.entries(LEGS)) assert.ok(MU.onProcessionStreets(p.x, p.z), `${k}: the leg's middle`);
  // the next street over / the middle of the block: 8 u to either side of a leg
  const pairs = [[C.bryant22, C.bryant24], [C.bryant24, C.mission24], [C.mission24, C.mission22], [C.mission22, C.bryant22]] as const;
  for (const [a, b] of pairs) for (const k of [-8, 8]) { const q = off(mid(a, b), a, b, k); assert.ok(!MU.onProcessionStreets(q.x, q.z), `${k} u off a leg`); }
  // the staging: Bryant north of 22nd (back from the corner, away from 24th) for LEAD_CLOSED u
  const dx = C.bryant22.x - C.bryant24.x, dz = C.bryant22.z - C.bryant24.z, L = Math.hypot(dx, dz);
  const back = (k: number) => ({ x: C.bryant22.x + (dx / L) * k, z: C.bryant22.z + (dz / L) * k });
  assert.ok(MU.onProcessionStreets(back(20).x, back(20).z), 'the staging, 20 u up Bryant');
  assert.ok(!MU.onProcessionStreets(back(MU.LEAD_CLOSED + 12).x, back(MU.LEAD_CLOSED + 12).z), 'past the staging');
  assert.ok(!MU.onProcessionStreets(C.bryant22.x + 300, C.bryant22.z), 'far away');
});

test('W9-H procession: the streets close to the toy traffic only while the walkers are out — 2 Nov 18:00–21:00, near (red before)', () => {
  const m = MU.createMuertos();
  const mode0 = runtime.move.mode;
  const at = MU.MUERTOS_AT, far = { x: at.x + MU.MUERTOS_NEAR + 50, z: at.z };
  const closed = () => Object.values(LEGS).map(p => roadClosed(p.x, p.z));
  try {
    runtime.move.mode = 'foot';
    const step = (iso: string, p = at) => { __setBayNowForTests(iso); m.step(0.2, p.x, 3, p.z, true); };
    step('2026-11-02T17:59');
    assert.deepEqual(closed(), [false, false, false, false], 'before the staging');
    step('2026-11-02T18:00');
    assert.equal(m.stats().procession, 'gather');
    assert.deepEqual(closed(), [true, true, true, true], 'the staging');
    step('2026-11-02T19:10');
    assert.equal(m.stats().procession, 'walk');
    assert.deepEqual(closed(), [true, true, true, true], 'the walk');
    step('2026-11-02T19:10', far);
    assert.deepEqual(closed(), [false, false, false, false], 'the player far away: nothing built, nothing closed');
    step('2026-11-02T19:11');
    assert.deepEqual(closed(), [true, true, true, true], 'back near');
    step('2026-11-02T21:00');
    assert.deepEqual(closed(), [false, false, false, false], 'after the walk');
    step('2026-11-01T19:10');
    assert.deepEqual(closed(), [false, false, false, false], '1 November: no procession');
    step('2026-11-02T19:10');
    m.dispose();
    assert.deepEqual(closed(), [false, false, false, false], 'disposed: reopened');
  } finally { m.dispose(); runtime.move.mode = mode0; __setBayNowForTests(null); }
});
