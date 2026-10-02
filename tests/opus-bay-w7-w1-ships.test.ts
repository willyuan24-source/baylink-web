import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { PAMPANITO, SHIPS_MID, SHIP_BUDGET, SHIP_CULL, buildShipBatch, buildWharfShips } from '../src/opus-bay/world/sf/wharfShips';

/** Wave 7 · lane W1 · W7-W13 USS Pampanito alongside Pier 45 (world/sf/wharfShips.ts), city mode only. */

test('W7-W13 USS Pampanito: one mesh within budget, on OSM\'s hull (way 165601339), low in the water, seen from the Musée Mécanique door', () => {
  const s = buildWharfShips();
  assert.ok(s.triangles <= SHIP_BUDGET.triangles, `${s.triangles} triangles`);
  // (W8-W1: the mesh carries the O'Brien too; the Pampanito's own batch is checked here)
  const pg = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(buildShipBatch('pampanito').toArrays().position, 3));
  pg.computeBoundingBox();
  const bb = pg.boundingBox!;
  // OSM's ring: x −231.6 … −218.5, z 62.4 … 64.2 (a 0.35 u margin for the toy's beam)
  assert.ok(bb.min.x > -231.95 && bb.max.x < -218.1 && bb.min.z > 62.0 && bb.max.z < 64.6, `hull box x ${bb.min.x.toFixed(2)}…${bb.max.x.toFixed(2)} z ${bb.min.z.toFixed(2)}…${bb.max.z.toFixed(2)}`);
  const L = Math.hypot(PAMPANITO.bow.x - PAMPANITO.stern.x, PAMPANITO.bow.z - PAMPANITO.stern.z);
  assert.ok(L > 12.5 && L < 14, `${L.toFixed(2)} u long (311 ft 9 in)`);
  // the hull sits in the water (−0.6): its keel under it, the sail's periscopes ≤ 3.5 u over it
  assert.ok(bb.min.y < -0.6 && bb.max.y > 1 && bb.max.y < 3, `y ${bb.min.y.toFixed(2)} … ${bb.max.y.toFixed(2)}`);
  // the pier45 perf spot (the Musée Mécanique door) is within the cull (W8-W1: the LOD stands between the two ships)
  assert.ok(Math.hypot(-212.7 - SHIPS_MID.x, 70.5 - SHIPS_MID.z) < SHIP_CULL - 100);
  s.toy.geometry.dispose();
});
