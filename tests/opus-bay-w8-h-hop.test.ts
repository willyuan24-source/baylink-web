import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * Wave 8 · lane H · the trick-or-treaters hop (halloween/worldDress.ts): W7-H2 made them rock from the feet (the toy
 * shader's horizontal sway); now each child also does a small vertical hop now and then — on the CPU, only the hopping
 * children's vertex ranges of the stoops' merged mesh are rewritten and uploaded (addUpdateRange): no new material,
 * program or call. Still with reduced motion.
 */

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const THREE = await import('three');
const WD = await import('../src/opus-bay/halloween/worldDress');
const { Batch } = await import('../src/opus-bay/world/builder');

test('W8-H hop: a short, small hop now and then (hopAt), the figure is the last thing on its stoop (its vertex range)', () => {
  // the hop curve: 0 outside the hop, up to HOP.h at its middle, back to 0
  assert.equal(WD.hopAt(0, 3, 0), 0);
  assert.ok(Math.abs(WD.hopAt(WD.HOP.dur / 2, 3, 0) - WD.HOP.h) < 1e-9);
  assert.equal(WD.hopAt(WD.HOP.dur + 0.01, 3, 0), 0);
  assert.ok(WD.HOP.h >= 0.08 && WD.HOP.h <= 0.2 && WD.HOP.dur <= 0.6, 'small and quick');
  let up = 0;
  for (let t = 0; t < 30; t += 0.05) if (WD.hopAt(t, 3.4, 1.1) > 0) up++;
  assert.ok(up / 600 < 0.2, 'mostly on the ground');
  // addStoop returns where its child starts: the child's vertices run to the batch's end
  const i = Array.from({ length: WD.stoopCount() }, (_, k) => k).find(k => WD.stoopFigure(k) >= 0)!;
  const b = new Batch();
  const start = WD.addStoop(b, WD.stoopAt(i), [], true);
  assert.ok(start > 0 && start < b.vertexCount, `start ${start} of ${b.vertexCount}`);
  const s = WD.stoopAt(i);
  let lowest = Infinity;
  for (let v = start; v < b.vertexCount; v++) lowest = Math.min(lowest, b.pos[v * 3 + 1]);
  assert.ok(Math.abs(lowest - s.y) < 0.15, 'the range is the child (its feet on the stoop\'s ground)');
  assert.equal(WD.addStoop(new Batch(), WD.stoopAt(i), [], false), -1, 'no figure: −1');
});

test('W8-H hop: a cell\'s hop ranges move only the children (by HOP.h at most), upload only their ranges, and stand still with reduced motion', () => {
  // a cell with children
  const keys = [...WD.stoopIndex().keys()];
  const key = keys.find(k => (WD.stoopIndex().get(k) ?? []).some(i => WD.stoopFigure(i) >= 0))!;
  const cell = WD.buildCell(key, true);
  assert.ok(cell.figRanges.length > 0 && cell.figRanges.length === cell.figures.length);
  const pos = new Float32Array(cell.pos);
  const hops = WD.hopRanges([cell], pos);
  assert.equal(hops.length, cell.figRanges.length);
  const attr = new THREE.BufferAttribute(pos.slice(), 3);
  const before = attr.array.slice();
  // find a time when the first child is mid-hop
  const h0 = hops[0];
  const t = h0.period - h0.phase % h0.period + WD.HOP.dur / 2;
  const v0 = attr.version;
  assert.ok(WD.stepHops(hops, attr, t, false));
  assert.ok(attr.version > v0, 'needsUpdate');
  assert.ok(attr.updateRanges.length >= 1 && attr.updateRanges.every(r => hops.some(h => r.start === h.start * 3 && r.count === h.count * 3)), 'only children\'s ranges');
  // the first child is up by ≈ HOP.h; x / z untouched; vertices outside every child untouched
  const inChild = new Set<number>();
  for (const h of hops) for (let j = 0; j < h.count; j++) inChild.add(h.start + j);
  for (let v = 0; v < pos.length / 3; v++) {
    assert.equal(attr.array[v * 3], before[v * 3]);
    assert.equal(attr.array[v * 3 + 2], before[v * 3 + 2]);
    const dy = attr.array[v * 3 + 1] - before[v * 3 + 1];
    if (!inChild.has(v)) assert.equal(dy, 0);
    else assert.ok(dy >= -1e-6 && dy <= WD.HOP.h + 1e-6);
  }
  assert.ok(Math.abs(attr.array[h0.start * 3 + 1] - before[h0.start * 3 + 1] - WD.HOP.h) < 1e-3, 'the first child at the top of its hop');
  // the same time again: nothing to upload
  attr.clearUpdateRanges();
  assert.equal(WD.stepHops(hops, attr, t, false), false);
  // reduced motion: everyone back on the ground and still
  assert.ok(WD.stepHops(hops, attr, t, true));
  for (let v = 0; v < pos.length / 3; v++) assert.equal(attr.array[v * 3 + 1], before[v * 3 + 1]);
  attr.clearUpdateRanges();
  assert.equal(WD.stepHops(hops, attr, t + 0.1, true), false);
});
