import assert from 'node:assert/strict';
import test from 'node:test';
import * as district from '../src/opus-bay/data/district';
import {
  CELL, CHUNK, STREET_ROW, WATERFRONT_WARP, buildingH, buildingHeightM, cellOf, chunkKey, chunkOf, demFromY, parseChunkKey,
  project, projectCity, projectRaw, terrainY, unproject, unprojectCity, unwarpCity, warpCity, warpOffset,
} from '../src/opus-bay/core/geo';

// SF bbox of the z14 DEM plus the task bbox corners and a few landmarks
const POINTS: [number, number][] = [
  [37.835, -122.52], [37.835, -122.35], [37.70, -122.52], [37.70, -122.35], // DEM corners
  [37.8083, -122.5329], [37.7085, -122.5157], [37.7081, -122.3574], [37.8327, -122.3565], // SF corners (NW, SW, SE, NE)
  [37.80238, -122.40583], [37.79517, -122.40279], [37.78978, -122.39691], [37.795, -122.3937], // Coit, Transamerica, Salesforce, Ferry
  [37.81401, -122.47789], [37.7596, -122.4476], [37.7694, -122.5107], // GGB south tower, Twin Peaks, Ocean Beach
];
for (let i = 0; i < 15; i++) for (let j = 0; j < 15; j++) POINTS.push([37.70 + (0.135 * i) / 14, -122.52 + (0.17 * j) / 14]);

test('geo.project / unproject are bit-identical to data/district.ts on ≥ 200 points incl. the SF corners', () => {
  assert.ok(POINTS.length >= 200);
  for (const [lat, lng] of POINTS) {
    const a = project(lat, lng), b = district.project(lat, lng);
    assert.equal(a.x, b.x, `x at ${lat},${lng}`);
    assert.equal(a.z, b.z, `z at ${lat},${lng}`);
    const r = projectRaw(lat, lng);
    assert.ok(Math.abs(r.x - a.x) <= 0.005 + 1e-9 && Math.abs(r.z - a.z) <= 0.005 + 1e-9, 'raw within rounding');
    const u = unproject(a), v = district.unproject(a);
    assert.equal(u.lat, v.lat); assert.equal(u.lng, v.lng);
    const back = unproject(r);
    assert.ok(Math.abs(back.lat - lat) < 1e-9 && Math.abs(back.lng - lng) < 1e-9, 'unproject(projectRaw) round-trips');
  }
});

test('terrain curve matches the §2.2 table and inverts', () => {
  const table: [number, number][] = [[23.8, 4.95], [46.4, 10.33], [86.7, 19.92], [91.5, 21.06], [104.4, 23.18], [138.6, 28.47], [255, 46.48], [277.8, 50.01], [284, 50.96]];
  for (const [dem, y] of table) assert.ok(Math.abs(terrainY(dem) - y) < 0.01, `terrainY(${dem}) = ${terrainY(dem)} ≈ ${y}`);
  assert.equal(terrainY(3), 0); assert.equal(terrainY(-40), 0); assert.equal(terrainY(Number.NaN), 0);
  for (const dem of [3.5, 10, 50, 89.9, 93, 150, 283]) assert.ok(Math.abs(demFromY(terrainY(dem)) - dem) < 1e-9, `inverse at ${dem}`);
  // monotone and continuous at the knee (DEM 93 m)
  assert.ok(Math.abs(terrainY(93 - 1e-6) - terrainY(93 + 1e-6)) < 1e-5);
});

test('building height rule reproduces the §2.3 anchors', () => {
  assert.equal(buildingH(0), 3.6);
  assert.ok(Math.abs(buildingH(10) - 4.75) < 1e-9);
  assert.ok(Math.abs(buildingH(260) - 43.5) < 1e-9);
  assert.ok(Math.abs(buildingH(326) - 53.73) < 1e-9);
  assert.ok(Math.abs(buildingHeightM(buildingH(120)) - 120) < 1e-9);
  assert.equal(STREET_ROW.residential, 3.6); assert.equal(STREET_ROW.primary, 5.6); assert.equal(STREET_ROW.secondary, 4.4);
});

test('chunk grid helpers', () => {
  assert.equal(CHUNK, 128); assert.equal(CELL, 64);
  assert.deepEqual(chunkOf(0, 0), { cx: 0, cz: 0 });
  assert.deepEqual(chunkOf(-0.01, 127.99), { cx: -1, cz: 0 });
  assert.deepEqual(chunkOf(-1024, 2175), { cx: -8, cz: 16 });
  assert.deepEqual(cellOf(-1, 64), { ix: -1, iz: 1 });
  assert.equal(chunkKey(-3, 12), '-3_12');
  assert.deepEqual(parseChunkKey('-3_12'), { cx: -3, cz: 12 });
  assert.throws(() => parseChunkKey('3-12'));
});

test('waterfront warp: exact at the anchors, zero far away, invertible', () => {
  for (const e of WATERFRONT_WARP) {
    const d = warpOffset(e.ox, e.oz);
    assert.ok(Math.abs(d.x - e.dx) < 1e-9 && Math.abs(d.z - e.dz) < 1e-9, `${e.id} anchor moves by the full offset`);
    const far = warpOffset(e.ox + e.tx * 400, e.oz + e.tz * 400);
    assert.equal(far.x + far.z, 0, `${e.id}: no warp 400 u along the coast`);
    const inland = warpOffset(e.ox + e.mx * 120, e.oz + e.mz * 120);
    assert.equal(inland.x + inland.z, 0, `${e.id}: no warp 120 u inland`);
  }
  // Twin Peaks / Ocean Beach / Coit are untouched
  for (const [lat, lng] of [[37.7596, -122.4476], [37.7694, -122.5107], [37.80238, -122.40583]] as const) {
    const a = projectRaw(lat, lng), b = projectCity(lat, lng);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-9);
  }
  // inverse on a grid around both ends
  for (const e of WATERFRONT_WARP) {
    for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
      const p = { x: e.ox + i * 12, z: e.oz + j * 12 };
      const q = warpCity(p), back = unwarpCity(q);
      assert.ok(Math.hypot(back.x - p.x, back.z - p.z) < 1e-5, `unwarp(warp(p)) at ${p.x},${p.z}`);
    }
  }
  const ll = unprojectCity(projectCity(37.8087, -122.4098)); // Pier 39 area
  assert.ok(Math.abs(ll.lat - 37.8087) < 1e-8 && Math.abs(ll.lng + 122.4098) < 1e-8);
});
