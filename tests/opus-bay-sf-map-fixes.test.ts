import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { sfDisk } from './opus-bay-sf-disk';

/**
 * Lane P (wave 4 integration part b): the wave-3 / wave-4 verify findings on lane P's files.
 * - verify-visual F2: the painted paper and the vector map disagree when close → the map cross-fades from the paper to
 *   the vector base between s 0.5 and 0.8, and never strokes a second (vector) coastline over the paper.
 * - verify-content C2 / C6 / C12, verify-phone m3: place and short names (glossary, junk OSM names, addresses).
 * - verify-phone M3 / m2: the search field is 16 px (no iOS zoom), the map's tool buttons have 44 px touch areas.
 */

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : noop), set: () => true });
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const sf = sfDisk();
const far = await sf.far();
const { MAP_FRAME } = await import('../src/opus-bay/data/mapPaper');
const { drawCityMap, paperShare, PAPER_FULL_UNTIL, PAPER_GONE_FROM, MAP_PAINT, clampView, fitScale } = await import('../src/opus-bay/ui/cityMapDraw');
const { applyW4Places, PLACE_HIDDEN } = await import('../src/opus-bay/data/sf/extraPlaces');
const { ATTRACTIONS, ATTRACTION_INDEX } = await import('../src/opus-bay/data/sf/attractions');
const placesFile = JSON.parse(fs.readFileSync(path.join(sf.base, 'places.json'), 'utf8'));
const rows = applyW4Places(placesFile);

type Ctx2D = import('../src/opus-bay/ui/cityMapDraw').Ctx2D;
function recorder() {
  const ops: { op: string; style: string; alpha: number }[] = [];
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineJoin: 'round', lineCap: 'round', globalAlpha: 1,
    save() {}, restore() {}, beginPath() {}, closePath() {}, setLineDash() {}, moveTo() {}, lineTo() {},
    fill() { ops.push({ op: 'fill', style: String(ctx.fillStyle), alpha: ctx.globalAlpha }); },
    stroke() { ops.push({ op: 'stroke', style: String(ctx.strokeStyle), alpha: ctx.globalAlpha }); },
    fillRect() { ops.push({ op: 'rect', style: String(ctx.fillStyle), alpha: ctx.globalAlpha }); },
  };
  return { ctx: ctx as unknown as Ctx2D, ops };
}
const W = 390, H = 388;
const view = (scale: number) => clampView({ cx: 130, cz: 200, scale, w: W, h: H }, MAP_FRAME);

test('paper → vector: the whole paper up to s 0.5, the vector base alone from s 0.8, smooth and monotonic between', () => {
  assert.equal(PAPER_FULL_UNTIL, 0.5);
  assert.equal(PAPER_GONE_FROM, 0.8);
  assert.equal(paperShare(0.17), 1, 'the phone SF-land fit');
  assert.equal(paperShare(0.34), 1, 'the phone first open');
  assert.equal(paperShare(0.5), 1);
  assert.equal(paperShare(0.8), 0);
  assert.equal(paperShare(2.2), 0, '4 zoom steps in (verify-visual F2)');
  let last = 1;
  for (let s = 0.5; s <= 0.8; s += 0.01) { const k = paperShare(s); assert.ok(k <= last + 1e-12 && k >= 0 && k <= 1); last = k; }
  assert.ok(Math.abs(paperShare(0.65) - 0.5) < 1e-9);
});

test('draw over the paper: no second coastline; half way the vector base fills at half strength with the sea outside the land only', () => {
  const fit = fitScale(MAP_FRAME, W, H);
  // the whole paper (the map's city views): no vector fills and, with coast: false, no coast stroke either
  const full = recorder();
  drawCityMap(full.ctx, { far, visited: () => true, paper: 1, coast: false }, view(Math.max(fit, 0.3)));
  assert.ok(!full.ops.some(o => o.op === 'rect' || o.style === MAP_PAINT.land || o.style === MAP_PAINT.sea), 'no vector base');
  assert.ok(!full.ops.some(o => o.style === MAP_PAINT.paperCoast), 'no vector coast over the paper');
  // H2b's DEV export (paper: true, coast by default) keeps its coastline
  const dev = recorder();
  drawCityMap(dev.ctx, { far, visited: () => true, paper: true }, view(0.3));
  assert.ok(dev.ops.some(o => o.style === MAP_PAINT.paperCoast));
  // half way: sea (a path, not the full rect) and land at alpha 0.5, no coast stroke
  const half = recorder();
  drawCityMap(half.ctx, { far, visited: id => id !== 'mission', paper: 0.5, coast: false }, view(0.65));
  const sea = half.ops.find(o => o.style === MAP_PAINT.sea), land = half.ops.find(o => o.style === MAP_PAINT.land);
  assert.ok(sea && sea.op === 'fill' && Math.abs(sea.alpha - 0.5) < 1e-9, 'the sea as a path at half strength');
  assert.ok(land && Math.abs(land.alpha - 0.5) < 1e-9);
  assert.ok(!half.ops.some(o => o.op === 'rect'));
  assert.ok(!half.ops.some(o => o.style === MAP_PAINT.paperCoast));
  assert.ok(half.ops.some(o => o.style === 'rgba(241, 232, 216, 0.760)'), 'the fog between the paper fog (.7) and the vector fog (.82)');
  // close: the plain vector map, exactly as without paper
  const close = recorder(), plain = recorder();
  drawCityMap(close.ctx, { far, visited: () => true, paper: 0, coast: false }, view(1.2));
  drawCityMap(plain.ctx, { far, visited: () => true }, view(1.2));
  assert.deepEqual(close.ops, plain.ops);
});

test('place names: the glossary (唐人街, 卡斯特罗, 南市场, 要塞高地, 双峰 …), no postal address, no lowercase OSM name, "tiat" hidden', () => {
  const by = new Map(rows.map(r => [r.id, r]));
  const want: Record<string, [string, string]> = {
    'osm-n3639535348': ['唐人街', 'Chinatown'],
    'osm-w120479810': ['金门亭', 'Chinese Pavilion'],
    'osm-n599157316': ['圣诞树观景点', 'Christmas Tree Point'],
    'osm-n3111994564': ['卡斯特罗', 'Castro District'],
    'osm-n1281064684': ['南市场', 'South of Market'],
    'osm-n2297131599': ['西南市场', 'West SoMa'],
    'osm-n1680264818': ['要塞高地', 'Presidio Heights'],
    'osm-n11055875368': ['鹰角 · 天涯海角', 'Eagles Point (Lands End)'],
    'osm-n3789606760': ['ARC 画廊与工作室', 'ARC Gallery & Studios'],
    'osm-w1214385020': ['莫斯科尼遛狗区', 'Moscone Dog Play Area'],
    'twin-peaks': ['双峰', 'Twin Peaks'],
  };
  for (const [id, [zh, en]] of Object.entries(want)) assert.deepEqual(by.get(id)?.name, { zh, en }, id);
  assert.ok(PLACE_HIDDEN.has('osm-n13702829029') && !by.has('osm-n13702829029'), 'the "tiat" node is not a place');
  // the whole index: glossary words, addresses and lowercase-only names (the discovery toast says them)
  const BAD_ZH = /缆车|双子峰|中国城|笛洋|索玛|卡斯楚|普雷西迪奥|金门停/;
  for (const r of rows) {
    assert.ok(!BAD_ZH.test(r.name.zh), `${r.id} zh "${r.name.zh}"`);
    assert.ok(!/, CA \d{5}|\bUSA\b/.test(r.name.en + r.name.zh), `${r.id} is an address`);
    assert.ok(!/^[a-z][a-z &'.-]*$/.test(r.name.en), `${r.id} lowercase OSM name "${r.name.en}"`);
    assert.ok(!/Pavillion/.test(r.name.en), r.id);
  }
});

test('attraction short names read as the place (verify-content C12) and 码头区 stays the Embarcadero piers\' word (C6)', () => {
  const short = (id: string) => ATTRACTION_INDEX.get(id)!.short!.zh;
  assert.equal(short('buena-vista-park'), '布埃纳公园');
  assert.equal(short('buena-vista-cafe'), '布埃纳咖啡');
  assert.equal(short('greenwich-steps'), '电报山台阶');
  assert.equal(short('ina-coolbrith-park'), '伊娜公园');
  assert.equal(short('harvey-milk-plaza'), '米尔克广场');
  assert.equal(short('pier-39'), ATTRACTION_INDEX.get('pier-39')!.name.zh, 'one spacing for 39 号码头');
  assert.ok(!(ATTRACTION_INDEX.get('marina-green')!.aliases ?? []).includes('码头区'));
  for (const a of ATTRACTIONS) assert.ok(!(a.aliases ?? []).includes('码头区') || a.area === 'north-downtown', `${a.id}: 码头区 is the Embarcadero piers`);
});

test('touch: the search field is 16 px (iOS zooms into smaller fields); the tools, compass and chips have 44 px touch areas', () => {
  const css = fs.readFileSync(path.resolve(import.meta.dirname, '../src/opus-bay/ui/city-ui.css'), 'utf8');
  const w4 = fs.readFileSync(path.resolve(import.meta.dirname, '../src/opus-bay/ui/map-w4.css'), 'utf8');
  const rule = (src: string, sel: string) => { const i = src.indexOf(`${sel} {`); assert.ok(i >= 0, sel); return src.slice(i, src.indexOf('}', i)); };
  const px = (r: string, prop: string) => Number(new RegExp(`(?:^|[\\s;{])${prop}:\\s*(-?[\\d.]+)px`).exec(r)?.[1] ?? NaN);
  assert.ok(px(rule(css, '.ob-citymap-search input'), 'font-size') >= 16);
  const btn = rule(css, '.ob-citymap-tools .ob-icon-btn'), hit = rule(css, '.ob-citymap-tools .ob-icon-btn::before');
  assert.ok(px(btn, 'width') - 2 * px(hit, 'inset') >= 44, 'tool button touch area');
  const gap = px(rule(css, '.ob-citymap-tools'), 'gap');
  assert.ok(gap >= -2 * px(hit, 'inset'), 'neighbouring touch areas do not overlap');
  assert.ok(px(rule(w4, '.mw-compass'), 'width') - 2 * px(rule(w4, '.mw-compass::before'), 'inset') >= 44, 'compass');
  const chip = rule(w4, '.mw-chip'), chipHit = rule(w4, '.mw-chip::before');
  assert.ok(px(chip, 'height') - 2 * Number(/inset:\s*(-?[\d.]+)px/.exec(chipHit)![1]) >= 44, 'chip');
});
