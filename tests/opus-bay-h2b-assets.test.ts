import assert from 'node:assert/strict';
import test from 'node:test';
import { Mask, composite, distanceTransform, fillShape, halve, strokeCapsule, strokePolyline } from '../scripts/opus-sf/map/raster2d';

/** Lane H2b: the painted map's base rasteriser (H2b-2), the paper registry and loader (H2b-4 / H2b-5). */

const covered = (m: Mask) => { let s = 0; for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) s += m.at(x, y); return s; };

test('raster: a square covers exactly its area, anti-aliased on fractional edges', () => {
  const m = new Mask(32, 32);
  fillShape(m, [[4, 4, 14, 4, 14, 14, 4, 14]]);
  assert.equal(covered(m), 100);
  assert.equal(m.at(4, 4), 1);
  assert.equal(m.at(3, 3), 0);
  m.clear();
  fillShape(m, [[4.5, 4, 14, 4, 14, 14, 4.5, 14]]);
  assert.equal(covered(m), 95);
  assert.equal(m.at(4, 8), 0.5);
});

test('raster: shapes sharing an edge split its samples (no gaps, no double cover); holes are even-odd', () => {
  const a = new Mask(32, 32), b = new Mask(32, 32);
  // a diagonal cut through a square: both halves together cover the square once
  fillShape(a, [[2, 2, 20, 2, 2, 17.3]]);
  fillShape(b, [[20, 2, 20, 17.3, 2, 17.3]]);
  for (let i = 0; i < a.bits.length; i++) assert.equal(a.bits[i] & b.bits[i], 0, 'a sample in both halves');
  a.or(b);
  const sq = new Mask(32, 32);
  fillShape(sq, [[2, 2, 20, 2, 20, 17.3, 2, 17.3]]);
  assert.deepEqual(a.bits, sq.bits);
  assert.equal(covered(sq), 18 * 15.25); // sample rows at y = (k + .5) / 4: 17.125 is in, 17.375 is out
  const h = new Mask(32, 32);
  fillShape(h, [[0, 0, 20, 0, 20, 20, 0, 20], [5, 5, 15, 5, 15, 15, 5, 15]]);
  assert.equal(covered(h), 400 - 100);
  assert.equal(h.at(10, 10), 0);
});

test('raster: capsules union without double counting; composite blends by coverage', () => {
  const m = new Mask(64, 64);
  strokeCapsule(m, 10, 32, 50, 32, 4);
  const one = covered(m);
  assert.ok(Math.abs(one - (40 * 8 + Math.PI * 16)) < 3, `capsule area ${one}`);
  strokeCapsule(m, 10, 32, 50, 32, 4); // the same again: a union, unchanged
  assert.equal(covered(m), one);
  const poly = new Mask(64, 64);
  strokePolyline(poly, [10, 10, 50, 10, 50, 50], 2, 8);
  assert.ok(poly.at(50, 30) === 1 && poly.at(30, 10) === 1 && poly.at(30, 30) === 0);
  const img = new Float32Array(64 * 64 * 3);
  composite(img, m, [1, 0.5, 0], 0.5);
  const i = (32 * 64 + 30) * 3;
  assert.deepEqual([img[i], img[i + 1], img[i + 2]], [0.5, 0.25, 0]);
  m.clear();
  assert.ok(m.empty && covered(m) === 0);
});

test('raster: halve averages 2 × 2; the chamfer distance is near Euclidean', () => {
  const img = new Float32Array(4 * 4 * 3).map((_, k) => (k % 3 === 0 ? (Math.floor(k / 3) % 2) : 0));
  const h = halve(img, 4, 4);
  assert.equal(h.length, 2 * 2 * 3);
  assert.equal(h[0], 0.5);
  const f = new Uint8Array(41 * 41);
  f[20 * 41 + 20] = 1;
  const d = distanceTransform(f, 41, 41);
  assert.equal(d[20 * 41 + 30], 10);
  const diag = d[30 * 41 + 30], true_ = Math.hypot(10, 10);
  assert.ok(Math.abs(diag - true_) / true_ < 0.08, `diagonal ${diag} vs ${true_}`);
});
