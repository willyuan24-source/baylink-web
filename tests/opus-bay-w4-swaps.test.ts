import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { Vec2 } from '../src/opus-bay/core/types';
import { W4_MODELS } from '../src/opus-bay/data/sf/w4Models';
import { PLINTH_DEPTH, W4_SWAPS, w4Swap, w4SwapPart, w4SwapPlinth } from '../src/opus-bay/data/sf/w4Swaps';
import { siteGround } from '../src/opus-bay/world/sf/landmarks/siteKit';
import { w4Site } from '../src/opus-bay/world/sf/landmarks/w4sites';

/**
 * Lane V (wave 4, part 2): the AI swap rows of data/sf/w4Swaps.ts against lane L's site records and the published GLBs —
 * each row names a model whose `landmarkId` is the site, the site's AI slot names that GLB, the model's bounds and every
 * blocker lie inside the site's exclusion (the city buildings around stay clear of the AI mesh), the Holy Virgin
 * blockers match the measured ground footprint of the refit mesh, and the pavilion keeps lane L's walk data exactly.
 * File checks only (GLB JSON bounds), no WebGL, no decoding.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const stem = (url: string) => path.basename(url, '.glb');
function glbBounds(url: string): { min: number[]; max: number[] } {
  const buf = fs.readFileSync(path.join(ROOT, 'public', url));
  const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
  const acc = json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
  return { min: acc.min, max: acc.max };
}
/** world → site-local (the inverse of kit.ts worldPoly / landmarkToWorld: x' = X + x cos + z sin, z' = Z − x sin + z cos) */
const toLocal = (s: { x: number; z: number; yaw: number }, p: Vec2): Vec2 => {
  const dx = p.x - s.x, dz = p.z - s.z, c = Math.cos(s.yaw), n = Math.sin(s.yaw);
  return { x: dx * c - dz * n, z: dx * n + dz * c };
};
function inside(p: Vec2, poly: Vec2[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) hit = !hit;
  }
  return hit;
}
const corners = (x0: number, x1: number, z0: number, z1: number): Vec2[] => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];

test('w4 swaps: each row fills its site\'s AI slot with a model whose landmarkId is the site; parts are D2 swap parts', () => {
  assert.deepEqual(W4_SWAPS.map(r => r.site), ['geary-west', 'blue-heron-lake']);
  for (const row of W4_SWAPS) {
    const site = w4Site(row.site), m = W4_MODELS[row.model];
    assert.ok(site, `${row.site} is a lane L site`);
    assert.equal(m.landmarkId, row.site, `${row.model}.landmarkId`);
    assert.equal(site.w4.aiSlot?.model, stem(m.url), `${row.site} AI slot names ${stem(m.url)}`);
    // lane L's slot names the registry id and the placement it planned (d6d8c24): the row agrees within 0.05 u
    assert.equal(site.w4.aiSlot?.id, row.model, `${row.site} AI slot id`);
    // (y: a row that samples its ground elsewhere — Holy Virgin's porch on the sidewalk, review 2 — sets y from there;
    // lane L's slot still says the centre's ground until its integration takes the row)
    const g = siteGround(site.id, site.base), at = site.w4.aiSlot!.at, placed = w4SwapPart(row, g.at);
    for (const [k, v] of [[0, placed.x], [2, placed.z]] as const) assert.ok(Math.abs(at[k] - v) <= 0.05, `${row.site} placement[${k}] ${v} vs lane L's ${at[k]}`);
    if (row.ground) assert.equal(placed.y, g.at(row.ground.x, row.ground.z), `${row.site}: y = the ground at (${row.ground.x}, ${row.ground.z})`);
    else assert.ok(Math.abs(at[1] - placed.y) <= 0.05, `${row.site} placement[1] ${placed.y} vs lane L's ${at[1]}`);
    assert.equal(w4Swap(row.site), row);
    const part = w4SwapPart(row, () => 0.37);
    assert.equal(part.model, row.model);
    assert.equal(part.scale.length, 3, 'LandmarkSwapPart.scale is a per-axis tuple');
    assert.ok(part.scale.every(v => v > 0));
    assert.equal(part.y, row.part.y === 'ground' ? 0.37 : row.part.y, 'y: the site ground or the row\'s local y');
    assert.equal(typeof row.ship, 'boolean');
    assert.ok(row.note.length > 0 && row.note.length <= 120, `${row.site} note`);
    assert.ok(row.remainder.length > 0);
  }
});

test('w4 swaps: the AI model and every blocker lie inside the site\'s exclusion (the neighbours stay clear)', () => {
  for (const row of W4_SWAPS) {
    const site = w4Site(row.site)!;
    assert.ok('poly' in site.exclude, `${row.site} has an exclusion polygon`);
    const ex = (site.exclude as { poly: Vec2[] }).poly.map(p => toLocal(site, p));
    const b = glbBounds(W4_MODELS[row.model].url), s = row.part.scale, yaw = row.part.yaw ?? 0;
    assert.equal(yaw, 0, 'both rows keep the site frame (front +Z)');
    // the model's footprint box at this placement, pulled in 1 %; the pavilion's ground footprint instead (its octagonal
    // floor platform r 2.4 and the steps to r 2.7 on ±Z, measured on the decoded mesh by the lane-V review): its eaves
    // (r 2.8, 2.3 u up, as lane L's procedural roof) reach over the island path, where the city has no buildings
    const hx = Math.max(-b.min[0], b.max[0]) * s[0] * 0.99, z0 = b.min[2] * s[2] * 0.99, z1 = b.max[2] * s[2] * 0.99;
    const pts = row.model === 'sf-chinese-pavilion'
      ? [{ x: 2.45, z: 0 }, { x: -2.45, z: 0 }, { x: 0, z: -2.7 }, { x: 0, z: 2.7 }, ...corners(-1.7, 1.7, -1.7, 1.7)]
      : corners(-hx, hx, z0, z1);
    for (const p of pts) assert.ok(inside({ x: p.x + row.part.x, z: p.z + row.part.z }, ex), `${row.site}: model point (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) inside the exclusion`);
    for (const bl of row.blockers) {
      const pp = 'poly' in bl ? bl.poly : [{ x: bl.x + bl.r, z: bl.z }, { x: bl.x - bl.r, z: bl.z }, { x: bl.x, z: bl.z + bl.r }, { x: bl.x, z: bl.z - bl.r }];
      for (const p of pp) assert.ok(inside(p, ex), `${row.site}: blocker point (${p.x}, ${p.z}) inside the exclusion`);
    }
    for (const [x0, x1, z0, z1] of row.plinth?.boxes ?? []) for (const p of corners(x0, x1, z0, z1)) assert.ok(inside(p, ex), `${row.site}: plinth corner (${p.x}, ${p.z}) inside the exclusion`);
  }
});

test('w4 swaps: Holy Virgin fits lane L\'s lot at the landmark height; its blockers cover the measured footprint', () => {
  const row = w4Swap('geary-west')!, m = W4_MODELS['sf-holy-virgin'], b = glbBounds(m.url);
  assert.equal(row.ship, true);
  // OSM way 286435447: 2.8 u along Geary Blvd; 3.2 u between the neighbour behind (z ≤ −1.7) and the sidewalk (z ≥ 1.65)
  assert.ok(Math.abs(b.max[0] - b.min[0] - 2.8) < 0.02 && Math.abs(b.max[2] - b.min[2] - 3.2) < 0.02, 'fitted to the lot');
  assert.ok(Math.abs(b.max[1] - (3.2 + 0.155 * 38.1)) < 0.05, '125 ft (38.1 m) → 9.1 u by H = 3.2 + 0.155 h');
  assert.deepEqual([...row.part.scale], [1, 1, 1], 'the fit is baked into the GLB');
  // the ground footprint measured on the decoded mesh (y < 2: body x ±1.34, z −1.54…1.24; porch |x| ≤ 0.6 to z 1.6),
  // shifted by the part's z: every sample of it is inside a blocker
  const inBlocker = (p: Vec2) => row.blockers.some(bl => ('poly' in bl ? inside(p, bl.poly) : Math.hypot(p.x - bl.x, p.z - bl.z) <= bl.r));
  const dz = row.part.z;
  for (let x = -1.3; x <= 1.3; x += 0.1) for (let z = -1.5; z <= 1.2; z += 0.1) assert.ok(inBlocker({ x, z: z + dz }), `body (${x.toFixed(1)}, ${z.toFixed(1)})`);
  for (let x = -0.55; x <= 0.55; x += 0.1) for (let z = 1.2; z <= 1.58; z += 0.04) assert.ok(inBlocker({ x, z: z + dz }), `porch (${x.toFixed(2)}, ${z.toFixed(2)})`);
  // the arrival spot (lane L's, facing the cathedral) keeps the walk's stand radius (0.4 u) from every blocker, on the
  // Geary side of the facade. Integration review: the old "≥ 0.9 u in front of the porch" pinned it on Geary Blvd's
  // asphalt (the carriageway starts ≈ 0.7 u before the porch; lane L's part b request): the frontage beside the doors
  // qualifies, the doorway does not
  const edgeDist = (p: Vec2, poly: Vec2[]) => Math.min(...poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length], ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez;
    const t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.z - a.z) * ez) / L2)) : 0;
    return Math.hypot(p.x - a.x - ex * t, p.z - a.z - ez * t);
  }));
  const clearance = (p: Vec2) => Math.min(...row.blockers.map(bl => ('poly' in bl ? (inside(p, bl.poly) ? -edgeDist(p, bl.poly) : edgeDist(p, bl.poly)) : Math.hypot(p.x - bl.x, p.z - bl.z) - bl.r)));
  const arrivalOk = (p: Vec2) => clearance(p) >= 0.4 && p.z > 1.24 + dz;
  const ar = w4Site('geary-west')!.w4.arrival;
  assert.ok(!inBlocker(ar) && arrivalOk(ar), `arrival (${ar.x}, ${ar.z}): ${clearance(ar).toFixed(2)} u from the blockers, in front of the facade`);
  assert.ok(arrivalOk({ x: -1.5, z: 2.0 }) && arrivalOk({ x: 1.5, z: 2.0 }), 'the frontage beside the doors (lane L\'s proposed arrival, off the asphalt)');
  assert.ok(!arrivalOk({ x: 0, z: 1.8 }) && !arrivalOk({ x: -1.5, z: 0 }) && !arrivalOk({ x: 0, z: -2.0 }), 'not in the doorway, against the side wall or behind');
});

test('w4 swaps: Holy Virgin porch meets the Geary sidewalk and a plinth fills the fall of the lot toward the back (review 2)', () => {
  const row = w4Swap('geary-west')!, site = w4Site('geary-west')!, g = siteGround(site.id, site.base);
  const y = w4SwapPart(row, g.at).y, b = glbBounds(W4_MODELS[row.model].url);
  // the porch threshold (model z ≈ 1.6) is the sidewalk's height from the porch to the arrival spot: the door never
  // sinks under the pavement (at the centre's ground, lane L's slot, it sank 0.68 u) nor stands on a step above it
  for (let z = 1.55; z <= 2.61; z += 0.05) for (const x of [-0.6, 0, 0.6]) assert.ok(Math.abs(g.at(x, z) - y) <= 0.08, `sidewalk (${x}, ${z.toFixed(2)}) ${g.at(x, z).toFixed(3)} vs base ${y.toFixed(3)}`);
  // 125 ft to the top cross, measured from the street: 9.1 u over the sidewalk
  assert.ok(Math.abs(y + b.max[1] - g.at(0, 2) - 9.1) < 0.08, 'top cross 9.1 u over Geary Blvd');
  // no daylight under the model: wherever its ground footprint lies lower than its base, a plinth box stands under the
  // point from below the ground up into the walls (a 0.05 u grid over the body and the porch)
  const pieces = w4SwapPlinth(row, g.at);
  assert.ok(pieces.length >= 1 && pieces.every(p => p.h > 0 && p.w > 0 && p.d > 0 && p.color === row.plinth!.color));
  const covered = (x: number, z: number, ground: number) => pieces.some(p => Math.abs(x - p.x) <= p.w / 2 + 1e-9 && Math.abs(z - p.z) <= p.d / 2 + 1e-9 && p.y <= ground - 0.2 && p.y + p.h >= y);
  let lowest = Infinity;
  const check = (x: number, z: number) => { const h = g.at(x, z); lowest = Math.min(lowest, h); if (h < y - 0.02) assert.ok(covered(x, z, h), `plinth under (${x.toFixed(2)}, ${z.toFixed(2)}): ground ${h.toFixed(3)} < base ${y.toFixed(3)}`); };
  for (let x = -1.3; x <= 1.3; x += 0.05) for (let z = -1.54; z <= 1.2; z += 0.05) check(x, z);
  for (let x = -0.55; x <= 0.55; x += 0.05) for (let z = 1.22; z <= 1.52; z += 0.05) check(x, z);
  assert.ok(y - lowest > 1, `the lot falls ${(y - lowest).toFixed(2)} u toward the back (the reason for the plinth)`);
  // the plinth stays inside the model's walls (inset, never proud of them) and reaches PLINTH_DEPTH below the lowest ground
  for (const [x0, x1, z0, z1] of row.plinth!.boxes) {
    assert.ok(x0 >= -1.34 && x1 <= 1.34 && z0 + row.part.z >= -1.56 - 0.02 && z1 + row.part.z <= 1.6, `plinth box ${[x0, x1, z0, z1]} inside the footprint`);
  }
  assert.ok(Math.min(...pieces.map(p => p.y)) <= lowest - PLINTH_DEPTH + 0.05, 'the plinth reaches PLINTH_DEPTH below the lowest ground');
});

test('w4 swaps: the Chinese Pavilion swap keeps lane L\'s walk data (built to the model) and fades as one', () => {
  const row = w4Swap('blue-heron-lake')!, site = w4Site('blue-heron-lake')!;
  assert.equal(row.ship, true);
  const round = (bs: unknown[]) => JSON.stringify(bs, (_k, v) => (typeof v === 'number' ? +v.toFixed(3) : v));
  assert.equal(round(row.blockers), round(site.walk!.blockers), 'the eight column blockers = lane L\'s');
  // the model's 0.3 u floor platform tops out at lane L's floor deck (local y 0.75)
  const floor = site.walk!.surfaces!.find(s => s.surface === 'plaza' && s.poly.length === 8)!;
  assert.equal(typeof row.part.y, 'number');
  assert.ok(Math.abs((row.part.y as number) + 0.3 - (floor.y as number)) < 1e-6, 'platform top = floor deck');
  // the fade covers the roof (4.5 u model on the 0.45 base) and the eaves (r ≈ 2.8)
  assert.ok(row.fade && row.fade.r >= 2.8 && row.fade.y1 >= 0.45 + W4_MODELS['sf-chinese-pavilion'].size[1] - 1e-6 && row.fade.procedural === false);
});
