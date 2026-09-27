import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
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

// ---------------------------------------------------------------------------------------------------------------------
// the painted map (H2b-4 / H2b-5)
// ---------------------------------------------------------------------------------------------------------------------

const { MAP_FRAME, MAP_PAPER, MAP_PAPER_V1, mapPaperUrls } = await import('../src/opus-bay/data/mapPaper');
const { paperWidthFor, paperUrl } = await import('../src/opus-bay/ui/mapPaper');

const publicFile = (url: string) => path.resolve(import.meta.dirname, '../public', url.replace(/^\//, ''));

/** Width and height of a WebP (VP8 / VP8L / VP8X headers). */
function webpSize(b: Buffer): [number, number] {
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 8, 12), 'WEBP');
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
  if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  throw new Error(`unknown WebP chunk ${kind}`);
}

test('map paper: v1 is registered over MAP_FRAME, every file exists at its size, within the byte caps', () => {
  assert.ok(MAP_PAPER, 'MAP_PAPER is on (node has no ?paper=0)');
  assert.deepEqual(MAP_PAPER_V1.bounds, MAP_FRAME);
  // the frame is square (the paper is square) and covers the whole board
  assert.equal(MAP_FRAME.maxX - MAP_FRAME.minX, MAP_FRAME.maxZ - MAP_FRAME.minZ);
  const urls = mapPaperUrls();
  assert.equal(urls.length, 3);
  const caps: Record<number, number> = { 1024: 200_000, 2048: 650_000, 4096: 1_600_000 };
  for (const w of [1024, 2048, 4096] as const) {
    const url = MAP_PAPER_V1.sizes[w]!;
    assert.ok(urls.includes(url) && url.startsWith('/opus-bay/map/'), url);
    const buf = fs.readFileSync(publicFile(url));
    assert.deepEqual(webpSize(buf), [w, w], url);
    assert.ok(buf.length <= caps[w], `${url} ${buf.length} B ≤ ${caps[w]}`);
    assert.equal(buf.length, MAP_PAPER_V1.bytes?.[w], `${url} bytes recorded`);
  }
  const sha = crypto.createHash('sha256').update(fs.readFileSync(publicFile(MAP_PAPER_V1.sizes[2048]))).digest('hex');
  assert.equal(sha, MAP_PAPER_V1.sha256);
});

test('map paper: phones and tablets stop at 2048; a request picks the next size up', () => {
  assert.equal(paperWidthFor(4096, false), 4096);
  assert.equal(paperWidthFor(4096, true), 2048);
  assert.equal(paperWidthFor(4096, false, false), 2048);
  assert.equal(paperWidthFor(2048, true), 2048);
  assert.equal(paperWidthFor(1024, false), 1024);
  assert.equal(paperWidthFor(1500, false), 2048);
  assert.equal(paperWidthFor(3000, false), 4096);
  assert.equal(paperUrl(1024), MAP_PAPER_V1.sizes[1024]);
  assert.equal(paperUrl(4096), MAP_PAPER_V1.sizes[4096]);
});

test('map paper: the registration check of v1 passed the coast gate and describes the committed files', () => {
  const r = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../docs/opus-bay/h2b/paper-v1-check.json'), 'utf8')) as {
    pass: boolean; p95: number; gatePx: number; coastPx2048: { fitted: { candToBaseP95: number; baseToCandP95: number } };
    export: Record<string, { path: string; bytes: number; sha256: string }>;
  };
  // coast p95 ≤ 1.5 % of the width, both ways (candidate → base coast, base → candidate coast)
  assert.ok(Math.abs(r.gatePx - 0.015 * 2048) < 1e-6);
  assert.ok(r.pass && r.p95 <= r.gatePx);
  assert.ok(r.coastPx2048.fitted.candToBaseP95 <= r.gatePx && r.coastPx2048.fitted.baseToCandP95 <= r.gatePx);
  for (const w of [1024, 2048, 4096] as const) {
    const e = r.export[w];
    const buf = fs.readFileSync(path.resolve(import.meta.dirname, '..', e.path));
    assert.equal(buf.length, e.bytes, e.path);
    assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), e.sha256, e.path);
    assert.equal(`/${e.path.replace(/^public\//, '')}`, MAP_PAPER_V1.sizes[w]);
  }
});
