import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 6 · lane W · W6-W3 the Lyon Street Steps stair course (play/stairCourses.ts `lyon`; the stair races of
 * play/stairs.ts run it like the Filbert and Tiled courses — tests/opus-bay-w5-play-acts.test.ts "W5-A8 stair courses"
 * walks every course on the published city). Here: the middle landing's bed no longer closes the steps (the site's
 * blocker leaves a walker's disc on the wall side), the course runs up the flights from Green St's end to the top
 * landing over the Palace of Fine Arts, and its record row exists.
 */

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const T = await import('../src/opus-bay/core/terrain');
const N = await import('../src/opus-bay/actors/nav');
const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
const { lyonStreetSteps } = await import('../src/opus-bay/world/sf/landmarks/lyon-street-steps');
const SC = await import('../src/opus-bay/play/stairCourses');
const { BEST_ROWS } = await import('../src/opus-bay/economy/records');
const { sfDisk } = await import('./opus-bay-sf-disk');

const L = lyonStreetSteps;
const W = (lx: number, lz: number) => ({ x: L.x + lx * Math.cos(L.yaw) + lz * Math.sin(L.yaw), z: L.z - lx * Math.sin(L.yaw) + lz * Math.cos(L.yaw) });

test('W6-W3 the Lyon course: from Green St up the flights to the top landing, the whole way on the steps, standable, and walked', async () => {
  const c = SC.stairCourse('lyon');
  assert.ok(c, 'the lyon course');
  assert.equal(c.steps, 300);
  assert.ok(c.source.startsWith('https://') && c.verifiedAt === '2026-09-29');
  // the top is the site's top landing (the view over the Palace of Fine Arts), the foot ≈ 25 u down the steps' axis
  const top = SC.courseTop(c), foot = SC.courseFoot(c);
  assert.ok(Math.hypot(top.x - W(0, -1.2).x, top.z - W(0, -1.2).z) < 1, 'the finish on the top landing');
  const lzOf = (p: { x: number; z: number }) => (p.x - L.x) * Math.sin(L.yaw) + (p.z - L.z) * Math.cos(L.yaw);
  assert.ok(lzOf(foot) > 20, `the foot ${lzOf(foot).toFixed(1)} u down the axis`);
  // every vertex stays within the corridor between the hedges and the Presidio wall (|lx| ≤ 1.2 in the site's frame)
  for (let i = 0; i < c.line.length; i += 2) {
    const dx = c.line[i] - L.x, dz = c.line[i + 1] - L.z, lx = dx * Math.cos(L.yaw) - dz * Math.sin(L.yaw);
    assert.ok(Math.abs(lx) <= 1.2, `vertex ${i / 2} at lx ${lx.toFixed(2)}`);
  }
  const sf = sfDisk();
  const LMS = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  await sf.attachAround(city, L.x - 10, L.z - 8, 80, LMS);
  T.setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    // the middle landing: the walk past the bed on the wall side takes a walker (it closed the steps in wave 5)
    const pass = W(0.72, 9.3);
    assert.ok(T.canStand(pass.x, pass.z, T.STAND_RADIUS), 'past the bed');
    // the nav walks straight down the steps from the top to the foot (not round through the Presidio's trees)
    N.setNavFocus(top);
    const r = N.findPath(top, foot, 1), pts = r?.points ?? [];
    assert.ok(r && pts.length, 'walked');
    const len = N.pathLength(top, pts);
    assert.ok(len < Math.hypot(top.x - foot.x, top.z - foot.z) * 1.4, `${len.toFixed(1)} u (round through the trees it was ≥ 42)`);
    const rise = T.heightAt(top.x, top.z) - T.heightAt(foot.x, foot.z);
    assert.ok(rise > 10, `climbs ${rise.toFixed(1)} u`);
  } finally { T.setCityTerrain(null); }
});

test('W6-W3 the notebook keeps the Lyon race\'s best (economy/records.ts)', () => {
  const row = BEST_ROWS.find(r => r.key === 'stairs-lyon');
  assert.ok(BEST_ROWS.some(r => r.key === 'hide-seek' && r.unit === 'seconds'), 'and the hide & seek time');
  assert.ok(row && row.unit === 'seconds' && row.name.zh.includes('里昂街'));
});
