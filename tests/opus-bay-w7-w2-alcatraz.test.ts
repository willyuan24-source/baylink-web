import assert from 'node:assert/strict';
import test from 'node:test';
import type * as THREE from 'three';
import { projectCity } from '../src/opus-bay/core/geo';
import { pointInPolygon } from '../src/opus-bay/core/terrain';
import { CITY_BACKDROP } from '../src/opus-bay/world/backdrop';
import { demSample } from '../src/opus-bay/world/sf/format';
import { ALCATRAZ, ALCA_COAST, ALCA_PARTS } from '../src/opus-bay/world/sf/landmarks/alcatraz';
import { ALCA_GRID, ALCA_X, ALCA_Z, alcaGround } from '../src/opus-bay/world/sf/landmarks/alcatrazGround';
import { SF_SITES, TIER_TRIANGLES, W7_SITES, buildLandmark, sfLandmark } from '../src/opus-bay/world/sf/landmarks/index';
import { LANDMARK_TOPS } from '../src/opus-bay/world/sf/landmarks/tops';
import { sfDisk } from './opus-bay-sf-disk';

// W7-W2 · Alcatraz, a T1 site (sf-w7-lead.md §3 row W2 (1)): registered, within the T1 budget, standing on the
// published island, and its exclusion drops every OSM box the city streamed on the island.

const triCount = (g: THREE.BufferGeometry) => (g.getIndex()?.count ?? g.getAttribute('position').count) / 3;

test('W7-W2 Alcatraz: a registered T1 site at the island, lod 0 ≤ 6k triangles, lod 2 ≤ 10 %', () => {
  const l = sfLandmark('alcatraz');
  assert.ok(l && W7_SITES.includes(l) && SF_SITES.includes(l));
  assert.equal(l.tier, 1);
  const c = projectCity(37.8267, -122.423);
  assert.ok(Math.hypot(l.x - c.x, l.z - c.z) < 0.05 && l.x === ALCATRAZ.x && l.x === ALCA_X && l.z === ALCA_Z);
  assert.ok(Math.hypot(CITY_BACKDROP.alcatraz.x - l.x, CITY_BACKDROP.alcatraz.z - l.z) < 0.05, 'the backdrop and the site share the island centre');
  const t0 = triCount(buildLandmark(l, 0)), t2 = triCount(buildLandmark(l, 2));
  assert.ok(t0 > 2000 && t0 <= TIER_TRIANGLES[1], `lod 0 ${t0}`);
  assert.ok(t2 > 40 && t2 <= t0 * 0.1, `lod 2 ${t2} of ${t0}`);
  assert.ok(LANDMARK_TOPS.alcatraz, 'a tops row');
  assert.equal(l.sink, 0, 'the island ground is not sunk');
  assert.equal(typeof l.base, 'number');
});

test('W7-W2 Alcatraz: the ground grid is the published DEM; the cellhouse, water tower and lighthouse heights', async () => {
  const sf = sfDisk();
  const chunk = (await sf.chunk(Math.floor(ALCA_X / 128), Math.floor(ALCA_Z / 128)))!;
  let worst = 0;
  for (let j = 0; j < ALCA_GRID.rows; j++) for (let i = 0; i < ALCA_GRID.cols; i++) {
    const lx = ALCA_GRID.x0 + i * ALCA_GRID.step, lz = ALCA_GRID.z0 + j * ALCA_GRID.step;
    worst = Math.max(worst, Math.abs(alcaGround(lx, lz) - Math.max(0, demSample(chunk.dem, ALCA_X + lx, ALCA_Z + lz))));
  }
  assert.ok(worst < 0.03, `grid vs the published DEM: ${worst.toFixed(3)} (re-run scripts/opus-sf/alcatraz-ground.mts)`);
  // the cellhouse stands on the island's crest (≈ 7 u), 5.4 u to its parapet; the water tower's cap ≈ 7.6 u over its
  // ground (94 ft) and one foot short of the lighthouse (95 ft): the backdrop lighthouse clears the cellhouse
  const lo = ALCA_PARTS.cellLo();
  assert.ok(lo > 6 && lo < 8.5, `cellhouse ground ${lo}`);
  assert.ok(Math.abs(ALCA_PARTS.cellTop() - lo - 5.4) < 1e-9);
  assert.ok(ALCA_PARTS.towerTop() > 12 && ALCA_PARTS.towerTop() < 14, `tower top ${ALCA_PARTS.towerTop()}`);
  const lh = CITY_BACKDROP['alcatraz-lighthouse'], osm = projectCity(37.82625, -122.4223);
  assert.ok(Math.hypot(lh.x - osm.x, lh.z - osm.z) < 0.01, 'the lighthouse at its OSM place');
  const lhGround = alcaGround(lh.x - ALCA_X, lh.z - ALCA_Z);
  assert.ok(Math.abs(lhGround - 9.0) < 0.3, `lighthouse ground ${lhGround}`);
  assert.ok(9.0 + 6.7 > ALCA_PARTS.cellTop() + 1.07 + 0.5, 'the lamp shines over the clerestory');
  // the model's tallest tops (tops.ts, measured from the drawn lod 0) stay under the lamp
  assert.ok(Math.max(...LANDMARK_TOPS.alcatraz.blockers) < 9.0 + 6.7);
});

test('W7-W2 Alcatraz: the exclusion covers the island, so every OSM box the city streamed there is dropped', async () => {
  const l = sfLandmark('alcatraz')!;
  const ex = (l.exclude as { poly: { x: number; z: number }[] }).poly;
  const coast = ALCA_COAST.map(p => ({ x: p.x + ALCA_X, z: p.z + ALCA_Z }));
  for (const p of coast) assert.ok(pointInPolygon({ x: p.x * 0.999 + ALCA_X * 0.001, z: p.z * 0.999 + ALCA_Z * 0.001 }, ex), 'the coast lies inside the exclusion');
  const sf = sfDisk();
  const chunk = (await sf.chunk(Math.floor(ALCA_X / 128), Math.floor(ALCA_Z / 128)))!;
  const B = chunk.buildings;
  let onIsland = 0;
  for (let i = 0; i < B.count; i++) {
    let cx = 0, cz = 0;
    const n = B.vStart[i + 1] - B.vStart[i];
    for (let k = B.vStart[i]; k < B.vStart[i + 1]; k++) { cx += B.xz[k * 2]; cz += B.xz[k * 2 + 1]; }
    cx /= n; cz /= n;
    if (!pointInPolygon({ x: cx, z: cz }, coast)) continue;
    onIsland++;
    assert.ok(pointInPolygon({ x: cx, z: cz }, ex), `OSM ${B.osmId[i]} is excluded`);
  }
  assert.ok(onIsland >= 10, `the chunk's island buildings: ${onIsland}`);
});
