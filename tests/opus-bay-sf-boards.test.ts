import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';
import * as THREE from 'three';
import { projectCity, terrainY } from '../src/opus-bay/core/geo';
import {
  BOARD_NONE, BOARD_SEA, type BoardGrid, type BoardIndex, BoardFormatError, GGB_NORTH, HAWK_HILL, SAUSALITO_FERRY, WORLD_LL,
  boardDem, boardY, convexSdf, decodeBoard, encodeBoard, worldPolygon,
} from '../src/opus-bay/world/sf/boardData';
import { BOARD_ID0, boardsGroundAt, buildBoards, SAS } from '../src/opus-bay/world/sf/boards';
import { CITY_FAR_FADE, FAR_FADE, patchFog } from '../src/opus-bay/world/fogShader';
import { TilePool } from '../src/opus-bay/world/sf/pools';
import { boardPolygon } from '../src/opus-bay/world/sf/water';

/**
 * Lane C2-7a / C2-7b / C2-13 (wave 3): the satellite boards. The OBB1 format round-trips; the published boards (public/
 * opus-bay/sf/v1/boards, built by scripts/opus-sf/boards.ts from Terrarium z13) meet the Golden Gate Bridge's deck at
 * its north end, put Hawk Hill where the research put it, keep off the city's own land and stay inside the world
 * polygon; the runtime build (ground + toy-town dressing) fits 40k triangles, the Bay Bridge east span its own few
 * thousand; the tile pool merges the boards into a few bins; the soft world edge is a no-op until the city sets it.
 */

const DIR = path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1/boards');
const index = JSON.parse(fs.readFileSync(path.join(DIR, 'boards.json'), 'utf8')) as BoardIndex;
const grids: BoardGrid[] = index.boards.map(b => decodeBoard(new Uint8Array(zlib.gunzipSync(fs.readFileSync(path.join(DIR, b.file)))), b.id));
const marin = grids.find(g => g.id === 'marin')!;
const eastbay = grids.find(g => g.id === 'eastbay')!;
const build = buildBoards({ index, grids });

test('OBB1 round trip: every sample back, jumps to and from BOARD_NONE included; bad files are refused', () => {
  const cols = 37, rows = 23, h = new Int16Array(cols * rows);
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let k = 0; k < h.length; k++) h[k] = rnd() < 0.2 ? BOARD_NONE : Math.round((rnd() - 0.2) * 8000);
  h[0] = BOARD_NONE; h[1] = 32767; h[2] = BOARD_NONE; h[cols] = -32767;
  const g: BoardGrid = { id: 't', step: 4, originX: -1234.5, originZ: 678, cols, rows, sea: BOARD_SEA, h };
  const bytes = encodeBoard(g);
  const back = decodeBoard(bytes, 't');
  assert.deepEqual([back.cols, back.rows, back.step, back.originX, back.originZ], [cols, rows, 4, -1234.5, 678]);
  assert.ok(Math.abs(back.sea - BOARD_SEA) < 1e-6);
  assert.deepEqual(Array.from(back.h), Array.from(h));
  const bad = bytes.slice(); bad[0] ^= 0xff;
  assert.throws(() => decodeBoard(bad), BoardFormatError);
  assert.throws(() => decodeBoard(bytes.slice(0, bytes.length - 2)), BoardFormatError);
});

test('the published boards: Marin at 4 u, the East Bay at 8 u, index and files agree', () => {
  assert.equal(marin.step, 4);
  assert.equal(eastbay.step, 8);
  for (const e of index.boards) {
    const g = grids.find(q => q.id === e.id)!;
    assert.deepEqual([g.cols, g.rows, g.originX, g.originZ], [e.cols, e.rows, e.originX, e.originZ]);
    assert.equal(fs.statSync(path.join(DIR, e.file)).size, e.bytes);
    assert.ok(e.land > 20_000, `${e.id}: ${e.land} land samples`);
  }
  assert.ok(fs.readFileSync(path.join(DIR, 'ATTRIBUTION.md'), 'utf8').includes('OpenStreetMap'));
});

test('the Golden Gate Bridge lands on Marin: the ground at the north deck end is within 0.3 u of the 15.2 u deck', () => {
  const y = boardY(marin, GGB_NORTH.x, GGB_NORTH.z);
  assert.ok(Math.abs(y - 15.2) <= 0.3, `north end ${y.toFixed(3)}`);
  // and it stays under the approach deck back to the north tower (clearance, not a hill through the roadway)
  for (let s = 16; s < 100; s += 6) {
    const x = GGB_NORTH.x + GGB_NORTH.dx * s, z = GGB_NORTH.z + GGB_NORTH.dz * s;
    const g = boardY(marin, x, z);
    if (!Number.isNaN(g)) assert.ok(g <= 15.2 - 1.4, `${s} u south of the end: ground ${g.toFixed(2)}`);
  }
});

test('Hawk Hill ≈ 43 ± 4 u (the research point); Sausalito, Oakland, Berkeley, Alameda are land; the straits are water', () => {
  const hawk = boardY(marin, HAWK_HILL.x, HAWK_HILL.z);
  assert.ok(Math.abs(hawk - 43) <= 4, `Hawk Hill ${hawk.toFixed(1)}`);
  const land = (lat: number, lng: number) => { const p = projectCity(lat, lng); return boardsGroundAt(grids, p.x, p.z); };
  for (const [n, lat, lng] of [['Sausalito', 37.858, -122.483], ['Belvedere', 37.872, -122.466], ['Oakland downtown', 37.8044, -122.2712], ['Berkeley', 37.8715, -122.273], ['Alameda', 37.77, -122.26], ['the Oakland touchdown', 37.8236, -122.3175]] as const) {
    assert.ok(land(lat, lng) !== null, `${n} is land`);
  }
  for (const [n, lat, lng] of [['the Golden Gate', 37.818, -122.478], ['Richardson Bay', 37.87, -122.49], ['the Bay off Oakland', 37.815, -122.335], ['the Estuary', 37.7935, -122.2805]] as const) {
    assert.equal(land(lat, lng), null, `${n} is water`);
  }
  // the Sausalito ferry landing (lane F): the float in the water, the shore a few units toward toShore
  const F = SAUSALITO_FERRY;
  assert.equal(boardsGroundAt(grids, F.x, F.z), null, 'the float is on the water');
  assert.ok(boardsGroundAt(grids, F.x + F.toShore.x * 16, F.z + F.toShore.z * 16) !== null, 'the shore is right there');
});

test('never over the city: no board land on San Francisco, Treasure Island, Yerba Buena, Alcatraz or Angel Island', () => {
  for (const [n, lat, lng] of [['Fort Point', 37.8106, -122.4771], ['the Presidio', 37.798, -122.466], ['Treasure Island', 37.8235, -122.3707], ['Yerba Buena', 37.8105, -122.3637], ['Alcatraz', 37.8267, -122.423], ['Angel Island', 37.8609, -122.4326], ['Hunters Point', 37.725, -122.37]] as const) {
    const p = projectCity(lat, lng);
    assert.equal(boardsGroundAt(grids, p.x, p.z), null, n);
  }
});

test('the world polygon: convex, the city board inside it, the far side of the ridge and Daly City outside', () => {
  const poly = worldPolygon();
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[(i + poly.length - 1) % poly.length], b = poly[i], c = poly[(i + 1) % poly.length];
    const cr = Math.sign((b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x));
    if (!sign) sign = cr;
    assert.equal(cr, sign, `vertex ${i} (${WORLD_LL[i].join(', ')}) keeps the turn`);
  }
  assert.deepEqual(boardPolygon(), poly, 'the city water uses it');
  const inside = (lat: number, lng: number) => { const p = projectCity(lat, lng); return convexSdf(poly, p.x, p.z) > 0; };
  for (const [lat, lng] of [[37.76, -122.515], [37.8235, -122.3707], [37.858, -122.483], [37.8044, -122.2712], [37.8721, -122.2578], [37.8156, -122.5298]]) assert.ok(inside(lat, lng), `${lat}, ${lng} inside`);
  for (const [lat, lng] of [[37.69, -122.47], [37.88, -122.2], [37.93, -122.35], [37.9, -122.6]]) assert.ok(!inside(lat, lng), `${lat}, ${lng} outside`);
});

test('the runtime build: ≤ 40k triangles for the two boards, the east span apart; ground inside the world polygon', () => {
  const boards = build.triangles.ground + build.triangles.toy;
  assert.ok(boards <= 40_000, `boards ${boards}`);
  assert.ok(boards >= 20_000, `boards ${boards} (the dressing is there)`);
  assert.ok(build.triangles.bridge >= 800 && build.triangles.bridge <= 4000, `east span ${build.triangles.bridge}`);
  const poly = worldPolygon();
  let outside = 0, n = 0;
  for (const it of build.items) {
    const a = it.ground;
    if (!a) continue;
    for (let v = 0; v < a.vertexCount; v++, n++) if (convexSdf(poly, a.position[v * 3], a.position[v * 3 + 2]) < -0.05) outside++;
  }
  assert.ok(n > 10_000);
  assert.equal(outside, 0, 'every ground vertex stands inside the world polygon (the water edge cuts there)');
  // pool ids ≡ 3 mod 4 (never an L1 / L2 id), unique, three bins (Marin, East Bay, the bridge)
  const ids = new Set(build.items.map(i => i.id));
  assert.equal(ids.size, build.items.length);
  for (const i of build.items) { assert.equal(i.id % 4, BOARD_ID0 % 4); assert.equal(BOARD_ID0 % 4, 3); }
  assert.deepEqual([...new Set(build.items.map(i => i.bin))].sort(), [0, 1, 2]);
  assert.ok(build.lights.length >= 1000, `${build.lights.length} lights`);
  assert.ok(build.landTiles.length / 2 > 100, 'the water under the boards is dropped');
});

test('the east span: the SAS tower at (211.0, −506.6), both decks from Yerba Buena to the Oakland touchdown', () => {
  assert.equal(index.eastSpan.length, 2);
  for (const d of index.eastSpan) {
    const x0 = d.pts[0], z0 = d.pts[1], x1 = d.pts[d.pts.length - 2], z1 = d.pts[d.pts.length - 1];
    assert.ok(Math.hypot(x0 - 212, z0 + 407) < 40, `starts at Yerba Buena (${x0}, ${z0})`);
    assert.ok(x1 > x0 + 150, 'runs east to Oakland');
    // passes the tower within a deck width or two
    let best = Infinity;
    for (let k = 0; k + 3 < d.pts.length; k += 2) {
      const ax = d.pts[k], az = d.pts[k + 1], bx = d.pts[k + 2], bz = d.pts[k + 3];
      const L2 = (bx - ax) ** 2 + (bz - az) ** 2, t = Math.max(0, Math.min(1, ((SAS.x - ax) * (bx - ax) + (SAS.z - az) * (bz - az)) / L2));
      best = Math.min(best, Math.hypot(ax + (bx - ax) * t - SAS.x, az + (bz - az) * t - SAS.z));
    }
    assert.ok(best < 8, `deck passes the tower at ${best.toFixed(1)} u`);
    assert.ok(boardsGroundAt(grids, x1 + (x1 - d.pts[d.pts.length - 4]) * 0.2, z1 + (z1 - d.pts[d.pts.length - 3]) * 0.2) !== null || boardDem(eastbay, x1, z1) > -2, 'ends at the East Bay shore');
  }
  assert.ok(terrainY(demAtTouchdown()) < 3, 'the touchdown is low fill');
});
function demAtTouchdown() { const p = projectCity(37.8236, -122.3175); return boardDem(eastbay, p.x, p.z); }

test('the tile pool (no multi-draw) merges the board items into their bins: ≤ 2 meshes per bin', () => {
  const pool = new TilePool();
  for (const it of build.items) pool.add(it.id, { toy: it.toy, ground: it.ground, bin: it.bin }, false, true);
  for (let k = 0; k < 4; k++) pool.update();
  const st = pool.stats();
  assert.ok(st.drawObjects <= 6, `${st.drawObjects} meshes for ${build.items.length} items`);
  assert.equal(st.visible, build.items.length);
  pool.dispose();
});

test('the soft world edge: patchFog fades to the fog colour past uObFar; out of reach until the city sets it', () => {
  assert.ok(FAR_FADE.uObFar.value.x >= 1e8, 'district: never');
  assert.ok(CITY_FAR_FADE.from < CITY_FAR_FADE.to && CITY_FAR_FADE.to < 3000, 'city: before the 3,000 u far plane');
  const sh = { vertexShader: '#include <fog_pars_vertex>\n#include <fog_vertex>', fragmentShader: '#include <fog_pars_fragment>\n#include <fog_fragment>', uniforms: {} as Record<string, THREE.IUniform> };
  patchFog(sh);
  assert.equal(sh.uniforms.uObFar, FAR_FADE.uObFar);
  assert.ok(sh.fragmentShader.indexOf('smoothstep(uObFar.x, uObFar.y, vFogDepth)') > sh.fragmentShader.indexOf('#include <fog_fragment>'), 'after three\'s own fog');
});
