import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sfDisk } from './opus-bay-sf-disk';

/**
 * Lane P (wave 4, W4-P4 / P5 / P7 / P8 / P10 / P11, early phase): the city-map modules that are not wired yet —
 * line styles, the tunnel split and the canvas pass (ui/mapLines.ts), stations, trip route strokes, badges and scale
 * rules (ui/mapBadges.ts), filters (ui/mapFilterRules.ts), trip rows (ui/tripRows.ts), the badge / label / cluster
 * layout with the own-marker regression and the SVG node budget (ui/mapLayout.ts), and the four components rendered
 * to static markup (MapFilters, MapLegend, TripOptions, StationActions).
 */

const sf = sfDisk();
const { LINE_STYLES, lineStyle, lineStrokes, splitByTunnels, arcLengths, drawTransitLines, mapStations, stationSymbol, tripRouteStrokes, ROUTE_GOLD } = await import('../src/opus-bay/ui/mapLines');
const { W4_LINES } = await import('../src/opus-bay/data/sf/stationNames');
const { badgeSize, badgePaint, badgeNodes, scaleRules, BADGE_INK } = await import('../src/opus-bay/ui/mapBadges');
const { filterAttraction, filterLines, loadMapFilter, saveMapFilter, MAP_FILTERS, MAP_FILTER_KEY } = await import('../src/opus-bay/ui/mapFilterRules');
const { tripSecondsLabel, optionTitle, optionDetail, orderOptions, optionLineGlyph } = await import('../src/opus-bay/ui/tripRows');
const { layoutMap, labelCandidates, attractionMarkers, layoutPriority } = await import('../src/opus-bay/ui/mapLayout');
const { ATTRACTIONS, T1_IDS } = await import('../src/opus-bay/data/sf/attractions');
const { ATTRACTION_CAT_STYLE, ATTRACTION_CATS } = await import('../src/opus-bay/data/sf/attractionTypes');
type TransitLine = import('../src/opus-bay/world/sf/format').TransitLine;
type TripOption = import('../src/opus-bay/game/tripTypes').TripOption;

const w1 = JSON.parse(fs.readFileSync(path.join(sf.base, 'transit.json'), 'utf8')) as { lines: TransitLine[] };
const w4 = JSON.parse(fs.readFileSync(path.join(sf.base, 'transit-w4.json'), 'utf8')) as { lines: TransitLine[] };
const ALL_LINES = [...w1.lines, ...w4.lines];

/** A Ctx2D recorder: counts strokes, remembers styles. */
function recorder() {
  const ops: { op: string; style?: unknown; width?: number; dash?: number[]; alpha?: number }[] = [];
  let pts = 0;
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineJoin: 'round', lineCap: 'round', globalAlpha: 1, dash: [] as number[],
    save() {}, restore() {}, beginPath() {}, closePath() {}, fillRect() { ops.push({ op: 'fillRect' }); },
    moveTo() { pts++; }, lineTo() { pts++; }, setLineDash(d: number[]) { this.dash = d; },
    fill() { ops.push({ op: 'fill', style: this.fillStyle }); }, stroke() { ops.push({ op: 'stroke', style: this.strokeStyle, width: this.lineWidth, dash: [...this.dash], alpha: this.globalAlpha }); },
  };
  return { ctx: ctx as unknown as import('../src/opus-bay/ui/cityMapDraw').Ctx2D, ops, points: () => pts };
}

test('lines: every published line has a style; the wave-4 colours are lane T\'s; cable cars share one disc', () => {
  for (const l of ALL_LINES) {
    const st = lineStyle(l);
    assert.equal(st, LINE_STYLES[l.id], `${l.id} has a table style`);
    assert.match(st.color, /^#[0-9a-f]{6}$/);
    assert.equal(st.color, l.color, `${l.id}: the style colour is the published colour`);
    assert.equal(st.kind, l.kind);
    assert.ok(st.ride.zh && st.ride.en && st.route.zh && st.aliases.length);
  }
  for (const id of ['sf-loop', 'n-judah', 'm-ocean-view'] as const) { assert.equal(LINE_STYLES[id].color, W4_LINES[id].color); assert.equal(LINE_STYLES[id].casing, W4_LINES[id].casing); }
  assert.equal(new Set(['powell-hyde', 'powell-mason', 'california'].map(id => LINE_STYLES[id].disc.zh)).size, 1);
  // an unknown line still draws (derived style)
  const derived = lineStyle({ id: 'x-line', kind: 'bus', name: { zh: 'X 线', en: 'X line' }, color: '#123456', short: 'X' });
  assert.equal(derived.color, '#123456');
  assert.equal(derived.disc.en, 'X');
  // strokes: casing 2 px wider, the loop's white centre dashes, dashed + faded underground, 30 % when dimmed
  const loop = lineStrokes(LINE_STYLES['sf-loop'], 1);
  assert.equal(loop.length, 3);
  assert.equal(loop[0].width, loop[1].width + 2);
  assert.equal(loop[2].color, '#ffffff');
  assert.ok(loop[2].dash);
  assert.equal(lineStrokes(LINE_STYLES['sf-loop'], 0.2).length, 2, 'no centre dashes on the whole-city view');
  assert.equal(lineStrokes(LINE_STYLES['n-judah'], 0.185)[1].width, 2, '2 px lines at the SF fit');
  const under = lineStrokes(LINE_STYLES['n-judah'], 1, { underground: true });
  assert.ok(under[1].dash && under[1].alpha < 1);
  assert.ok(lineStrokes(LINE_STYLES['m-ocean-view'], 1, { dimmed: true }).every(s => s.alpha === 0.3));
});

test('lines: the tunnel split cuts the N and M exactly at their spans; surface + underground add up to the line', () => {
  // synthetic: a straight 100 u line with a tunnel 20–50
  const path3 = [0, 0, 0, 100, 0, 0];
  const pieces = splitByTunnels(path3, [{ fromAt: 20, toAt: 50 }]);
  assert.deepEqual(pieces.map(p => [p.under, p.xz]), [[false, [0, 0, 20, 0]], [true, [20, 0, 50, 0]], [false, [50, 0, 100, 0]]]);
  assert.deepEqual(splitByTunnels(path3, [{ fromAt: 0, toAt: 30 }]).map(p => p.under), [true, false], 'a line that starts underground');
  assert.deepEqual(splitByTunnels(path3).map(p => p.under), [false]);
  const len = (xz: number[]) => { let s = 0; for (let k = 2; k < xz.length; k += 2) s += Math.hypot(xz[k] - xz[k - 2], xz[k + 1] - xz[k - 1]); return s; };
  for (const l of w4.lines) {
    const cum = arcLengths(l.path);
    const ps = splitByTunnels(l.path, l.tunnels ?? []);
    const total = ps.reduce((s, p) => s + len(p.xz), 0);
    assert.ok(Math.abs(total - cum[cum.length - 1]) < 0.5, `${l.id} pieces add up`);
    const underLen = ps.filter(p => p.under).reduce((s, p) => s + len(p.xz), 0);
    const spans = (l.tunnels ?? []).reduce((s, t) => s + (t.toAt - t.fromAt), 0);
    assert.ok(Math.abs(underLen - spans) < 2, `${l.id} underground ${underLen.toFixed(1)} vs spans ${spans.toFixed(1)}`);
    if (l.id !== 'sf-loop') assert.equal(ps[0].under, true, `${l.id} starts under Market St`);
  }
});

test('lines: one canvas pass draws every line (≤ 3 strokes per piece kind), culls off-view lines, dims for the 线路 tab', () => {
  const view = { cx: 0, cz: 800, scale: 0.185, w: 352, h: 388 };
  const r = recorder();
  const ops = drawTransitLines(r.ctx, ALL_LINES, view);
  assert.equal(ops, r.ops.length);
  assert.ok(ops <= ALL_LINES.length * 5, `${ops} strokes`);
  assert.ok(r.ops.some(o => o.style === LINE_STYLES['n-judah'].color && o.dash?.length), 'N dashed underground');
  // far away: nothing
  const far = recorder();
  assert.equal(drawTransitLines(far.ctx, ALL_LINES, { cx: 5000, cz: 5000, scale: 1, w: 300, h: 300 }), 0);
  // highlight: every other line at 30 %
  const hl = recorder();
  drawTransitLines(hl.ctx, ALL_LINES, view, { highlight: 'n-judah' });
  assert.ok(hl.ops.filter(o => o.style === LINE_STYLES['m-ocean-view'].color).every(o => (o.alpha ?? 1) <= 0.3));
  assert.ok(hl.ops.filter(o => o.style === LINE_STYLES['n-judah'].color && !o.dash?.length).every(o => o.alpha === 1));
});

test('stations: N and M share the Market St stations (underground, transfer pills); symbols follow the scale rules', () => {
  const st = mapStations(w4.lines);
  const emb = st.find(s => s.id === 'muni-embarcadero')!;
  assert.deepEqual(emb.lines, ['n-judah', 'm-ocean-view']);
  assert.equal(emb.underground, true);
  assert.equal(emb.major, true);
  const ferry = st.find(s => s.id === 'loop-ferry-building')!;
  assert.deepEqual(ferry.lines, ['sf-loop']);
  assert.equal(ferry.underground, false);
  assert.ok(st.find(s => s.id === 'muni-19th-winston')!.attractions.includes('stonestown-galleria'));
  // scale rules: hidden below 0.3, canvas dots for major stops 0.3–0.45, SVG from 0.45, all names from 1.2
  assert.equal(stationSymbol(emb, 0.2), null);
  const minor = st.find(s => !s.major && s.lines.length === 1)!;
  assert.equal(stationSymbol(minor, 0.35), null);
  assert.equal(stationSymbol(emb, 0.35)!.svg, false);
  const pill = stationSymbol(emb, 0.6)!;
  assert.equal(pill.kind, 'pill');
  assert.deepEqual(pill.discs.map(d => d.text.zh), ['N', 'M']);
  assert.equal(pill.stair, true);
  assert.equal(pill.label, true);
  const dot = stationSymbol(minor, 0.6)!;
  assert.equal(dot.kind, 'dot');
  assert.equal(dot.label, false);
  assert.equal(stationSymbol(minor, 1.3)!.label, true);
  assert.equal(stationSymbol(ferry, 0.6, { tourStop: true })!.label, true);
});

test('trip routes: walk dashed gold 3 px, rides solid 4 px in the line colour with board / alight dots, done legs grey', () => {
  const walk = { via: 'walk' as const, from: { x: 0, z: 0 }, to: { x: 10, z: 0 }, seconds: 3, length: 10 };
  const ride = { via: 'line' as const, line: 'n-judah', board: 'a', alight: 'b', wait: 10, stops: 3, from: { x: 10, z: 0 }, to: { x: 100, z: 0 }, seconds: 30, length: 90, path: [10, 0, 50, 5, 100, 0] };
  const fly = { via: 'fly' as const, place: 'x', from: { x: 0, z: 0 }, to: { x: 1, z: 1 }, seconds: 5, length: 1 };
  const r = tripRouteStrokes([walk, ride, fly], 1);
  assert.equal(r.strokes.length, 2);
  assert.equal(r.strokes[0].done, true);
  assert.equal(r.strokes[1].color, LINE_STYLES['n-judah'].color);
  assert.equal(r.strokes[1].width, 4);
  assert.deepEqual(r.strokes[1].xz, [10, 0, 50, 5, 100, 0]);
  assert.equal(r.dots.length, 2);
  const now = tripRouteStrokes([walk], 0).strokes[0];
  assert.equal(now.color, ROUTE_GOLD);
  assert.ok(now.dash);
  assert.equal(now.width, 3);
});

test('badges: sizes and visibility by absolute scale (plan §4.1), states, node costs', () => {
  assert.deepEqual([badgeSize(1, 0.185).r, badgeSize(1, 0.185).glyph], [13, 14]);
  assert.equal(badgeSize(2, 0.2).kind, 'none');
  assert.deepEqual([badgeSize(2, 0.3).r, badgeSize(2, 0.3).glyph], [10, 11]);
  assert.equal(badgeSize(3, 0.4).kind, 'none');
  assert.equal(badgeSize(3, 0.5).kind, 'dot');
  assert.equal(badgeSize(3, 0.5).r, 5);
  assert.equal(badgeSize(3, 1.2).kind, 'badge');
  assert.equal(badgeSize(4, 1.4).kind, 'none');
  assert.equal(badgeSize(4, 1.5).r, 1.75);
  const r1 = scaleRules(0.2), r2 = scaleRules(0.35), r3 = scaleRules(0.7), r4 = scaleRules(1.3), r5 = scaleRules(3);
  assert.deepEqual([r1.t2Badges, r1.stations, r1.zoneNames, r1.lineWidth, r1.clusters], [false, 'none', false, 2, true]);
  assert.deepEqual([r2.t2Badges, r2.t2Labels, r2.stations, r2.zoneNames], [true, false, 'canvas', true]);
  assert.deepEqual([r3.t2Labels, r3.t3, r3.stations], [true, 'dot', 'svg']);
  assert.deepEqual([r4.t3, r4.t3Labels, r4.clusters], ['badge', true, false]);
  assert.deepEqual([r5.t4Dots, r5.t4Labels, r5.zoneNames], [true, true, false]);
  const size = badgeSize(1, 1);
  const fresh = badgePaint({ cat: 'campus' }, size, { discovered: false });
  assert.equal(fresh.fill, BADGE_INK.cream);
  assert.equal(fresh.ring, ATTRACTION_CAT_STYLE.campus.color);
  const found = badgePaint({ cat: 'campus' }, size, { discovered: true, arrived: true, selected: true, cluster: 2, tourStop: 3, dim: true });
  assert.equal(found.fill, ATTRACTION_CAT_STYLE.campus.color);
  assert.equal(found.ring, BADGE_INK.gold);
  assert.equal(found.scale, 1.15);
  assert.equal(found.opacity, 0.25);
  assert.ok(found.tick!.x > 0 && found.tick!.y > 0, 'tick at 4 o\'clock');
  assert.ok(found.pip!.x > 0 && found.pip!.y < 0 && found.pip!.text === '+2', 'pip at 2 o\'clock');
  assert.ok(found.tourDisc!.x < 0 && found.tourDisc!.y < 0, 'tour number at 10 o\'clock');
  assert.equal(badgeNodes(size, { discovered: true }), 3);
  assert.equal(badgeNodes(badgeSize(3, 0.5), { discovered: true }), 1);
  assert.equal(badgeNodes(badgeSize(2, 0.1), { discovered: true }), 0);
});

test('filters: category chips dim the rest (T1 stay), 交通 keeps lines + stations + T1, the choice survives storage failures', () => {
  assert.equal(MAP_FILTERS.length, 8);
  const t1Park = { cat: 'park' as const, rank: 1 as const }, t2Museum = { cat: 'museum' as const, rank: 2 as const }, t3Campus = { cat: 'campus' as const, rank: 3 as const };
  assert.deepEqual(filterAttraction('all', t2Museum), { show: true, alpha: 1, label: true });
  assert.deepEqual(filterAttraction('campus', t3Campus), { show: true, alpha: 1, label: true });
  assert.deepEqual(filterAttraction('campus', t2Museum), { show: true, alpha: 0.25, label: false });
  assert.equal(filterAttraction('campus', t1Park).label, true);
  assert.ok(filterAttraction('campus', t1Park).alpha < 1);
  assert.equal(filterAttraction('must', t1Park).alpha, 1);
  assert.equal(filterAttraction('must', t2Museum).alpha, 0.25);
  assert.equal(filterAttraction('transit', t2Museum).show, false);
  assert.equal(filterAttraction('transit', t1Park).show, true);
  assert.deepEqual(filterLines('transit'), { lines: 'full', stations: true });
  assert.deepEqual(filterLines('campus'), { lines: 'dim', stations: false });
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
  assert.equal(loadMapFilter(store), 'all');
  saveMapFilter('campus', store);
  assert.equal(mem.get(MAP_FILTER_KEY), 'campus');
  assert.equal(loadMapFilter(store), 'campus');
  mem.set(MAP_FILTER_KEY, 'junk');
  assert.equal(loadMapFilter(store), 'all');
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(loadMapFilter(broken), 'all');
  assert.doesNotThrow(() => saveMapFilter('park', broken));
  assert.equal(loadMapFilter(null), 'all');
  // every category chip has attractions to show
  for (const f of MAP_FILTERS) if (f.id !== 'all' && f.id !== 'must' && f.id !== 'transit') assert.ok(ATTRACTIONS.some(a => filterAttraction(f.id, a).alpha === 1 && a.rank > 1), f.id);
});

const walkLeg = (seconds: number, estimate = false) => ({ via: 'walk' as const, from: { x: 0, z: 0 }, to: { x: 1, z: 1 }, seconds, length: seconds * 4.2, ...(estimate ? { estimate } : {}) });
const OPTS: TripOption[] = [
  { mode: 'walk', legs: [walkLeg(250)], seconds: 250 },
  { mode: 'bike', legs: [walkLeg(20), { via: 'bike', vehicle: 'bike-1', from: { x: 1, z: 1 }, to: { x: 9, z: 9 }, seconds: 100, length: 600 }], seconds: 120, recommended: true },
  { mode: 'line', legs: [walkLeg(40), { via: 'line', line: 'sf-loop', board: 'loop-ferry-building', alight: 'loop-palace-of-fine-arts', wait: 15, stops: 2, from: { x: 1, z: 1 }, to: { x: 9, z: 9 }, seconds: 135, length: 900 }, walkLeg(20)], seconds: 195 },
  { mode: 'fly', legs: [{ via: 'fly', place: 'palace-of-fine-arts', from: { x: 0, z: 0 }, to: { x: 9, z: 9 }, seconds: 6, length: 900 }], seconds: 6, note: { zh: '不算登顶 / 骑行成就', en: 'no climb / ride credit' } },
  { mode: 'car', legs: [walkLeg(30, true)], seconds: 300 },
];

test('trip rows: honest short times, "观光巴士 2 站", legs in the detail line, 推荐 first, at most 4', () => {
  assert.deepEqual(tripSecondsLabel(6), { zh: '约 6 秒', en: '~6 s' });
  assert.equal(tripSecondsLabel(42).zh, '约 40 秒');
  assert.equal(tripSecondsLabel(61).zh, '约 1 分钟');
  assert.equal(tripSecondsLabel(250).zh, '约 4 分钟');
  assert.equal(tripSecondsLabel(3700).zh, '约 1 小时 2 分');
  assert.deepEqual(optionTitle(OPTS[2]), { zh: '观光巴士 2 站', en: 'Tour bus · 2 stops' });
  assert.deepEqual(optionTitle(OPTS[0]), { zh: '步行', en: 'Walk' });
  assert.equal(optionLineGlyph(OPTS[2]), 'Bus');
  assert.equal(optionLineGlyph(OPTS[0]), null);
  assert.equal(optionDetail(OPTS[2])!.zh, '步行 40 秒 · 等 15 秒 · 坐车 2 分钟 · 步行 20 秒');
  assert.equal(optionDetail(OPTS[3])!.zh, '不算登顶 / 骑行成就');
  assert.equal(optionDetail(OPTS[0]), null);
  assert.match(optionDetail(OPTS[4])!.zh, /计算中…$/);
  const ordered = orderOptions(OPTS);
  assert.equal(ordered.length, 4);
  assert.equal(ordered[0].mode, 'bike');
  assert.deepEqual(ordered.slice(1).map(o => o.mode), ['fly', 'line', 'walk']);
  for (const o of OPTS) { const t = optionTitle(o); assert.ok([...t.zh].length <= 12, t.zh); }
});

test('layout: a label never collides with its own badge (the wave-3 bug), falls back right → left → above → below, and priority wins', () => {
  // one badge alone: labelled on the right, beside its own disc
  const one = layoutMap([{ id: 'a', x: 100, y: 100, r: 13, prio: 10, label: '金门大桥', fontPx: 12 }], { w: 400, h: 400 });
  assert.equal(one.kept[0].label?.pos, 'right');
  assert.ok(one.kept[0].label!.x >= 100 + 13, 'beside, not over, its own marker');
  // a neighbour badge right of it: left
  const two = layoutMap([{ id: 'a', x: 100, y: 100, r: 13, prio: 10, label: '金门大桥', fontPx: 12 }, { id: 'b', x: 140, y: 100, r: 10, prio: 20 }], { w: 400, h: 400, clusters: false });
  assert.equal(two.kept.find(k => k.id === 'a')!.label?.pos, 'left');
  // hemmed in left and right: above; the frame's right tool column counts
  const three = layoutMap([{ id: 'a', x: 100, y: 100, r: 13, prio: 10, label: '金门大桥', fontPx: 12 }, { id: 'b', x: 140, y: 100, r: 10, prio: 20 }, { id: 'c', x: 60, y: 100, r: 10, prio: 20 }], { w: 400, h: 400, clusters: false });
  assert.equal(three.kept.find(k => k.id === 'a')!.label?.pos, 'above');
  const edge = layoutMap([{ id: 'a', x: 340, y: 100, r: 13, prio: 10, label: '金门大桥', fontPx: 12 }], { w: 400, h: 400 });
  assert.equal(edge.kept[0].label?.pos, 'left', 'the 44 px tool column is not label space');
  // T1 beats T2 for the same spot, whatever the input order
  const clash = layoutMap([
    { id: 't2', x: 200, y: 200, r: 10, prio: 20, label: '很长的二级标签名字', fontPx: 11 },
    { id: 't1', x: 200, y: 240, r: 13, prio: 10, label: '很长的一级标签名字', fontPx: 12 },
  ], { w: 280, h: 400, clusters: false });
  assert.ok(clash.kept.find(k => k.id === 't1')!.label);
  // candidates: exactly four, in order
  assert.deepEqual(labelCandidates(0, 0, 10, 'abc', 11).map(c => c.pos), ['right', 'left', 'above', 'below']);
  assert.ok(layoutPriority({ tier: 1, fame: 100 }) < layoutPriority({ tier: 1, fame: 10 }));
  assert.ok(layoutPriority({ tier: 1, fame: 0 }) < layoutPriority({ tier: 2, fame: 100 }));
  assert.ok(layoutPriority({ selected: true }) < layoutPriority({ target: true }));
});

test('layout: clusters merge into the higher-priority badge with a +n pip; the selected badge never merges away', () => {
  const r = layoutMap([
    { id: 'hi', x: 100, y: 100, r: 13, prio: 10, label: '州立大学', fontPx: 12 },
    { id: 'lo', x: 110, y: 104, r: 13, prio: 11, label: '石镇', fontPx: 12 },
    { id: 'sel', x: 96, y: 96, r: 10, prio: 0, label: '选中', fontPx: 11, clusterable: false },
  ], { w: 400, h: 400 });
  assert.deepEqual(r.kept.map(k => k.id), ['sel'], 'the selected badge stays and takes its neighbours');
  assert.deepEqual(r.merged, { hi: 'sel', lo: 'sel' });
  assert.equal(r.kept[0].text, '选中 +2');
  const plain = layoutMap([{ id: 'hi', x: 100, y: 100, r: 13, prio: 10, label: '州立大学', fontPx: 12 }, { id: 'lo', x: 110, y: 104, r: 13, prio: 11, label: '石镇', fontPx: 12 }], { w: 400, h: 400 });
  assert.equal(plain.kept[0].text, '州立大学 +1');
  assert.equal(layoutMap([{ id: 'hi', x: 100, y: 100, r: 13, prio: 10 }, { id: 'lo', x: 110, y: 104, r: 13, prio: 11 }], { w: 400, h: 400, clusters: false }).kept.length, 2);
});

const phoneFit = { cx: 50, cz: 830, scale: 0.185, w: 352, h: 388 };
const zh = (b: { zh: string }) => b.zh;

test('layout: at 352 × 388 with the SF-land fit ≥ 11 T1 labels, no overlapping label boxes, pips counted', () => {
  const { items } = attractionMarkers(ATTRACTIONS, phoneFit, { discovered: () => false, name: zh });
  assert.equal(items.length, 16, 'the whole-city view shows the 16 T1 only');
  const r = layoutMap(items, { w: phoneFit.w, h: phoneFit.h, maxNodes: 120 });
  const labelled = r.kept.filter(k => k.label);
  const pips = r.kept.reduce((s, k) => s + k.members.length, 0);
  assert.equal(r.kept.length + pips, 16, 'every T1 is a badge or counted in a pip');
  assert.ok(labelled.length >= 11, `${labelled.length} T1 labels: ${r.kept.filter(k => !k.label).map(k => k.id).join(', ')}`);
  const boxes = labelled.map(k => k.label!);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `labels ${labelled[i].id} / ${labelled[j].id} overlap`);
  }
  // the owner's two stay findable: SF State is labelled, Stonestown is its badge or its pip
  const sfsu = r.kept.find(k => k.id === 'sf-state-university' || k.members.includes('sf-state-university'))!;
  assert.ok(sfsu.label && /州立大学|石镇/.test(sfsu.text!), sfsu.text ?? 'no label');
  // 375 × 667 (map 330 × 307, s 0.165) and desktop 480 × 430 (s 0.231)
  const small = { cx: 50, cz: 830, scale: 0.165, w: 330, h: 307 };
  const rs = layoutMap(attractionMarkers(ATTRACTIONS, small, { discovered: () => false, name: zh }).items, { w: 330, h: 307, maxNodes: 120 });
  assert.ok(rs.kept.filter(k => k.label).length >= 10, `375: ${rs.kept.filter(k => k.label).length}`);
  const desk = { cx: 50, cz: 830, scale: 0.231, w: 480, h: 430 };
  const rd = layoutMap(attractionMarkers(ATTRACTIONS, desk, { discovered: () => false, name: zh }).items, { w: 480, h: 430 });
  assert.ok(rd.kept.filter(k => k.label).length >= 13, `desktop: ${rd.kept.filter(k => k.label).length}`);
  assert.deepEqual(T1_IDS.length, 16);
});

test('layout: the SVG node budget holds at every scale (≤ 120 phone, ≤ 150 desktop) on a dense synthetic index', () => {
  // the real attractions plus 600 synthetic T3 rows packed downtown (worst case: every one of them a badge)
  const dense = [...ATTRACTIONS, ...Array.from({ length: 600 }, (_, i) => ({ id: `syn-${i}`, name: { zh: `测试地点${i}`, en: `Test ${i}` }, cat: ATTRACTION_CATS[i % 10], rank: 3 as const, fame: i % 97, x: -200 + (i % 30) * 15, z: 50 + Math.floor(i / 30) * 15 }))];
  for (const [w, hgt, max] of [[352, 388, 120], [480, 430, 150]] as const) {
    for (const s of [0.185, 0.34, 0.5, 0.8, 1.3, 2, 3, 6]) {
      for (const [cx, cz] of [[50, 830], [100, 200], [-50, 150]]) {
        const v = { cx, cz, scale: s, w, h: hgt };
        const { items } = attractionMarkers(dense, v, { discovered: id => id.length % 2 === 0, name: zh, selected: 'union-square', filter: 'all' });
        const r = layoutMap(items, { w, h: hgt, maxNodes: max, clusters: s < 1.2 });
        assert.ok(r.nodes <= max, `${w}×${hgt} s ${s} at (${cx}, ${cz}): ${r.nodes} nodes`);
        if (items.some(i => i.id === 'union-square')) assert.ok(r.kept.some(k => k.id === 'union-square'), 'the selected badge is never cut');
      }
    }
  }
});

test('components: the four render (static markup): chips, legend, trip rows with 推荐, station rows', async () => {
  const { MapFilters } = await import('../src/opus-bay/ui/MapFilters');
  const { MapLegend } = await import('../src/opus-bay/ui/MapLegend');
  const { TripOptions } = await import('../src/opus-bay/ui/TripOptions');
  const { StationActions } = await import('../src/opus-bay/ui/StationActions');
  const chips = renderToStaticMarkup(h(MapFilters, { value: 'campus', onChange: () => undefined }));
  assert.equal((chips.match(/role="radio"/g) ?? []).length, 8);
  assert.equal((chips.match(/aria-checked="true"/g) ?? []).length, 1);
  assert.match(chips, /校园/);
  const legend = renderToStaticMarkup(h(MapLegend, { onClose: () => undefined }));
  for (const c of ATTRACTION_CATS) assert.ok(legend.includes(ATTRACTION_CAT_STYLE[c].name.zh), c);
  for (const w of ['必看', '还没去过', '观光巴士环线', 'N 线', '换乘站', '浅色区域']) assert.ok(legend.includes(w), w);
  const trips = renderToStaticMarkup(h(TripOptions, { options: OPTS, onPick: () => undefined }));
  assert.equal((trips.match(/mw-trip-row/g) ?? []).length, 4);
  assert.match(trips, /推荐/);
  assert.match(trips, /观光巴士 2 站/);
  assert.match(renderToStaticMarkup(h(TripOptions, { options: [], onPick: () => undefined, busy: true })), /BAYBAY 在看路线/);
  const station = renderToStaticMarkup(h(StationActions, {
    station: { id: 'muni-castro', name: { zh: '卡斯特罗站', en: 'Castro' }, lines: ['m-ocean-view'], underground: true },
    rides: [{ line: 'm-ocean-view', to: { stop: 'muni-19th-winston', name: { zh: '石镇', en: 'Stonestown' } }, seconds: 70, stops: 6 }, { line: 'sf-loop', to: { stop: 'loop-castro', name: { zh: '卡斯特罗', en: 'Castro' } }, seconds: 840, lap: true }],
    nextIn: 20, walkSeconds: 45, onRide: () => undefined, onGo: () => undefined,
  }));
  assert.match(station, /坐 M 线 → 石镇/);
  assert.match(station, /坐一圈/);
  assert.match(station, /下一班 约 20 秒/);
  assert.match(station, /带我去车站/);
  assert.match(station, /地下站/);
});
