import assert from 'node:assert/strict';
import test from 'node:test';
import { MAP_FRAME } from '../src/opus-bay/data/mapPaper';
import { MAX_ZOOM, MIN_ZOOM, type Ctx2D, type MapView, clampView, drawCityMap, fitScale, toPx, toWorld, zoomAt } from '../src/opus-bay/ui/cityMapDraw';
import { sfDisk } from './opus-bay-sf-disk';

/** Lane G1 (G1-5): the city map base layer on a recording 2D context (op budget, fog, culling) and the view maths. */

const far = await sfDisk().far();

function recorder() {
  const ops: string[] = [];
  let pts = 0;
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineJoin: 'round', lineCap: 'round', globalAlpha: 1,
    save() {}, restore() {}, beginPath() {}, closePath() {}, setLineDash() {},
    moveTo() { pts++; }, lineTo() { pts++; },
    fill() { ops.push(`fill:${ctx.fillStyle}`); }, stroke() { ops.push(`stroke:${ctx.strokeStyle}`); }, fillRect() { ops.push('rect'); },
  };
  return { ctx: ctx as unknown as Ctx2D, ops, pts: () => pts };
}

const W = 1536, H = 1024;
const fitView = (): MapView => clampView({ cx: (MAP_FRAME.minX + MAP_FRAME.maxX) / 2, cz: (MAP_FRAME.minZ + MAP_FRAME.maxZ) / 2, scale: fitScale(MAP_FRAME, W, H), w: W, h: H }, MAP_FRAME);

test('draw: a whole-city redraw is a few dozen fills / strokes and fast', () => {
  const r = recorder();
  const t0 = performance.now();
  const ops = drawCityMap(r.ctx, { far, visited: () => false, transit: [{ xyz: new Float32Array([0, 0, 0, 100, 0, 100]), color: '#c33' }] }, fitView());
  const ms = performance.now() - t0;
  assert.equal(ops, r.ops.length);
  assert.ok(ops <= 24, `${ops} ops`);
  assert.ok(r.ops.includes('fill:rgba(241, 232, 216, .82)'), 'fog over unvisited neighbourhoods');
  assert.ok(r.ops.includes('stroke:#c33'), 'cable-car line');
  assert.ok(ms < 150, `${ms.toFixed(1)} ms (node, first call incl. bbox cache)`);
  const t1 = performance.now();
  drawCityMap(recorder().ctx, { far, visited: () => false }, fitView());
  console.log(`# citymap redraw at ${W}px: ${(performance.now() - t1).toFixed(1)} ms, ${r.pts()} path points`);
});

test('draw: visiting every neighbourhood lifts the fog; the painted paper replaces sea and land', () => {
  const all = recorder();
  drawCityMap(all.ctx, { far, visited: () => true }, fitView());
  assert.ok(!all.ops.some(o => o.startsWith('fill:rgba(241, 232, 216')));
  const paper = recorder();
  drawCityMap(paper.ctx, { far, visited: () => true, paper: true }, fitView());
  assert.ok(!paper.ops.includes('rect') && !paper.ops.includes('fill:#f3ead8'));
});

test('draw: street zoom culls to the view (far fewer points than the whole city)', () => {
  const whole = recorder(), street = recorder();
  drawCityMap(whole.ctx, { far, visited: () => true }, fitView());
  const v = clampView({ ...fitView(), cx: 180, cz: 640, scale: fitScale(MAP_FRAME, W, H) * 14 }, MAP_FRAME);
  const ops = drawCityMap(street.ctx, { far, visited: () => true }, v);
  assert.ok(ops <= 24);
  assert.ok(street.pts() < whole.pts() / 5, `${street.pts()} vs ${whole.pts()}`);
});

test('view: zoom limits 0.8–18×, zoomAt keeps the point under the cursor, toPx / toWorld invert', () => {
  const v = fitView();
  const fit = fitScale(MAP_FRAME, W, H);
  assert.ok(Math.abs(clampView({ ...v, scale: fit * 100 }, MAP_FRAME).scale - fit * MAX_ZOOM) < 1e-9);
  assert.ok(Math.abs(clampView({ ...v, scale: fit * 0.1 }, MAP_FRAME).scale - fit * MIN_ZOOM) < 1e-9);
  const z = zoomAt(v, MAP_FRAME, 3, 400, 300);
  const a = toWorld(v, 400, 300), b = toWorld(z, 400, 300);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-6);
  const [px, py] = toPx(z, 123, 456);
  const back = toWorld(z, px, py);
  assert.ok(Math.hypot(back.x - 123, back.z - 456) < 1e-9);
  const out = clampView({ ...v, cx: 1e6, cz: -1e6 }, MAP_FRAME);
  assert.deepEqual([out.cx, out.cz], [MAP_FRAME.maxX, MAP_FRAME.minZ]);
});

test('labels: greedy layout drops overlaps, off-frame labels and labels over markers; priority wins', async () => {
  const { layoutLabels, labelWidth } = await import('../src/opus-bay/ui/cityMapDraw');
  assert.ok(labelWidth('唐人街', 12) > labelWidth('abc', 12));
  const items = [
    { id: 'b', x: 100, y: 100, text: 'Second place', prio: 2 },
    { id: 'a', x: 104, y: 102, text: 'First place', prio: 1 },
    { id: 'edge', x: 2, y: 50, text: 'Off the edge', prio: 3 },
    { id: 'far', x: 300, y: 200, text: 'Alone', prio: 4 },
    { id: 'hidden', x: 200, y: 60, text: 'Under a marker', prio: 5 },
  ];
  const shown = layoutLabels(items, 400, 300, 3, [{ x: 200, y: 55, r: 10 }]);
  assert.deepEqual([...shown.keys()].sort(), ['a', 'far']);
});

test('labels: a marker label never collides with its own marker, and moves beside it when the top is taken', async () => {
  const { layoutLabels } = await import('../src/opus-bay/ui/cityMapDraw');
  // the wave-2 bug: every landmark label box touched its own 10 px badge, so no place name ever showed on the map
  const own = [{ id: 'coit', x: 200, y: 150, r: 10 }];
  const one = layoutLabels([{ id: 'coit', x: 200, y: 150, r: 10, text: 'Coit Tower', prio: 1 }], 400, 300, 3, own);
  assert.deepEqual(one.get('coit'), { x: 200, y: 137, anchor: 'middle' }, 'above its own badge');
  // another marker right above: the label goes to the right of its badge, vertically centred on it
  const blocked = layoutLabels([{ id: 'coit', x: 200, y: 150, r: 10, text: 'Coit Tower', prio: 1 }], 400, 300, 3, [...own, { id: 'x', x: 200, y: 128, r: 6 }]);
  assert.equal(blocked.get('coit')?.anchor, 'start');
  assert.ok(blocked.get('coit')!.x >= 213);
  // at the right edge the right-hand spot leaves the frame: left of the badge instead
  const edge = layoutLabels([{ id: 'e', x: 385, y: 150, r: 10, text: 'Edge label', prio: 1 }], 400, 300, 3, [{ id: 'e', x: 385, y: 150, r: 10 }, { id: 'x', x: 385, y: 128, r: 6 }]);
  assert.equal(edge.get('e')?.anchor, 'end');
  // two badges side by side: both keep a label (above / beside), and no two label boxes overlap
  const pair = layoutLabels([
    { id: 'a', x: 150, y: 150, r: 10, text: 'Ferry Building', prio: 1 },
    { id: 'b', x: 160, y: 152, r: 10, text: 'Pier 1', prio: 2 },
  ], 400, 300, 3, [{ id: 'a', x: 150, y: 150, r: 10 }, { id: 'b', x: 160, y: 152, r: 10 }]);
  assert.equal(pair.size, 2);
  assert.notDeepEqual(pair.get('a'), pair.get('b'));
});
