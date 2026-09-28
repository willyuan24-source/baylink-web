import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { sfDisk } from './opus-bay-sf-disk';

/**
 * Lane P (wave 4, integration): the city map as the game draws it — the scene of one view on the real data
 * (ui/cityMapModel.ts buildScene: attraction badges, other places, stations, labels, clusters, the node budget), the
 * framing (the SF-land fit, the smart first open, the zoom limit), taps, the category chips and the highlighted line,
 * the map panel ids (game/mapPanel.ts), stations as places (data/sf/stationPlaces.ts: search, discovery, fly), the
 * rides a station offers and where the map's trips end (ui/mapTrips.ts).
 */

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

type TransitLine = import('../src/opus-bay/world/sf/format').TransitLine;
type TFile = import('../src/opus-bay/data/transit').TransitFileJson;

const sf = sfDisk();
const { buildScene, hitTest, firstOpenView, sfLandView, fitAbs, SF_LAND, NORTH_DEG, placeLayoutId } = await import('../src/opus-bay/ui/cityMapModel');
const { MAP_FRAME } = await import('../src/opus-bay/data/mapPaper');
const { maxScale, MAX_SCALE, clampView, labelWidth } = await import('../src/opus-bay/ui/cityMapDraw');
const { ATTRACTIONS, ATTRACTION_INDEX, coveredPlaceIds } = await import('../src/opus-bay/data/sf/attractions');
const { buildPlaceIndex, landmarkInputsFrom, poiInputs } = await import('../src/opus-bay/data/sf/places');
const { applyW4Places } = await import('../src/opus-bay/data/sf/extraPlaces');
const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
const { sfLandmarkAnchor } = await import('../src/opus-bay/world/sf/landmarks/context');
const { sfLandmarkInfo } = await import('../src/opus-bay/data/sf/landmarks');
const { buildTransit, setTransitData } = await import('../src/opus-bay/data/transit');
const { mapLinesFrom, mapStations } = await import('../src/opus-bay/ui/mapLines');
const { lineTermini } = await import('../src/opus-bay/ui/mapData');
const { w4Of } = await import('../src/opus-bay/data/sf/mapTransit');
const { stationRows } = await import('../src/opus-bay/data/sf/stationPlaces');
const { mapPanelId, parseMapPanelId } = await import('../src/opus-bay/game/mapPanel');
const { placeTripDest, stationRides, tripLineInfos } = await import('../src/opus-bay/ui/mapTrips');

const transitFile = JSON.parse(fs.readFileSync(path.join(sf.base, 'transit.json'), 'utf8')) as TFile & { props?: Record<string, [number, number]> };
const W4 = w4Of(transitFile).lines.length ? w4Of(transitFile) : w4Of(JSON.parse(fs.readFileSync(path.join(sf.base, 'transit-w4.json'), 'utf8')));
const cable = buildTransit(transitFile);
const LINES = mapLinesFrom(cable, transitFile.lines.find(l => l.id === 'f-line')!, W4.lines as TransitLine[]);
const STATIONS = mapStations(LINES);
const TERMINI = lineTermini(LINES);
const placesFile = JSON.parse(fs.readFileSync(path.join(sf.base, 'places.json'), 'utf8')) as import('../src/opus-bay/world/sf/format').PlacesFile;
const rows = applyW4Places(placesFile);
const stationPlaceRows = stationRows(STATIONS, W4.props, new Set(rows.map(r => r.id)), placesFile.verifiedAt);
const ix = buildPlaceIndex({ places: [...rows, ...stationPlaceRows] }, landmarkInputsFrom(SF_LANDMARKS, sfLandmarkInfo, sfLandmarkAnchor), poiInputs());
const covered = coveredPlaceIds();
const t = (b: { zh: string; en: string }) => b.zh;
const FERRY = { x: 133, z: 10 };

type SceneOpts = Partial<Parameters<typeof buildScene>[0]>;
function scene(w: number, h: number, view: { cx: number; cz: number; scale: number }, o: SceneOpts = {}) {
  return buildScene({
    view: { ...view, w, h }, attractions: ATTRACTIONS, places: ix.list, covered, stations: STATIONS, termini: TERMINI, zones: [],
    discovered: () => false, selected: null, filter: 'all', locale: 'zh', t, maxNodes: 120, ...o,
  });
}
type Box = [number, number, number, number];
const labelBoxes = (s: ReturnType<typeof scene>) => s.layout.kept.filter(k => k.label).map(k => [k.label!.x, k.label!.y, k.label!.x + k.label!.w, k.label!.y + k.label!.h] as Box);
const overlap = (a: Box, b: Box) => !(a[2] <= b[0] || a[0] >= b[2] || a[3] <= b[1] || a[1] >= b[3]);

test('framing: 全城 fits the SF land (x −900…1100, z −100…1860); the zoom limit reaches s 4 on a phone; north is up-left', () => {
  assert.deepEqual(SF_LAND, { minX: -900, maxX: 1100, minZ: -100, maxZ: 1860 });
  const v = sfLandView({ cx: 0, cz: 0, scale: 1, w: 352, h: 388 }, MAP_FRAME);
  assert.ok(v.scale > 0.16 && v.scale < 0.19, `phone SF fit s ${v.scale.toFixed(3)}`);
  const vis = { x0: v.cx - v.w / 2 / v.scale, x1: v.cx + v.w / 2 / v.scale, z0: v.cz - v.h / 2 / v.scale, z1: v.cz + v.h / 2 / v.scale };
  assert.ok(vis.x0 <= -900 && vis.x1 >= 1100 && vis.z0 <= -100 && vis.z1 >= 1860, 'the whole SF land in view');
  const d = sfLandView({ cx: 0, cz: 0, scale: 1, w: 900, h: 600 }, MAP_FRAME);
  assert.ok(d.scale > 0.28 && d.scale < 0.31, `desktop frame s ${d.scale.toFixed(3)}`);
  // zoom in: 18× the frame fit, or s 4 when that is closer (a phone's 18× is only ≈ 2)
  assert.equal(MAX_SCALE, 4);
  assert.equal(maxScale(MAP_FRAME, 352, 388), 4);
  assert.equal(clampView({ cx: 0, cz: 0, scale: 50, w: 352, h: 388 }, MAP_FRAME).scale, 4);
  assert.ok(maxScale(MAP_FRAME, 1536, 1024) > 5.9, 'a big desktop map keeps 18×');
  // the game frame is turned: true north points up-left (core/geo)
  assert.equal(NORTH_DEG, -46);
});

test('framing: the first open from the Ferry frames the 3 nearest T1 not visited yet (Coit, Chinatown …), s in [0.3, 0.8]; a trip frames player + target', () => {
  const base = { cx: 0, cz: 0, scale: 0.5, w: 352, h: 388 };
  const t1 = ATTRACTIONS.filter(a => a.rank === 1).map(a => ({ x: a.x, z: a.z, found: false, id: a.id }));
  const v = firstOpenView(base, MAP_FRAME, { player: FERRY, t1 });
  assert.ok(v.scale >= 0.3 && v.scale <= 0.8, `s ${v.scale}`);
  const near = [...t1].sort((a, b) => Math.hypot(a.x - FERRY.x, a.z - FERRY.z) - Math.hypot(b.x - FERRY.x, b.z - FERRY.z)).slice(0, 3);
  assert.ok(near.some(a => a.id === 'coit-tower') && near.some(a => a.id === 'chinatown-dragon-gate'), near.map(a => a.id).join(', '));
  const inView = (p: { x: number; z: number }) => Math.abs(p.x - v.cx) * v.scale <= v.w / 2 && Math.abs(p.z - v.cz) * v.scale <= v.h / 2;
  for (const p of [FERRY, ...near]) assert.ok(inView(p), `(${p.x}, ${p.z}) in the first view`);
  // everything found: the player at s 0.6
  const done = firstOpenView(base, MAP_FRAME, { player: FERRY, t1: t1.map(a => ({ ...a, found: true })) });
  assert.equal(done.scale, 0.6);
  // a trip / target: player + target, s in [0.25, 1.2]
  const sfsu = ATTRACTION_INDEX.get('sf-state-university')!;
  const trip = firstOpenView(base, MAP_FRAME, { player: FERRY, focus: [{ x: sfsu.x, z: sfsu.z }], t1 });
  assert.ok(trip.scale >= 0.25 - 1e-9 && trip.scale <= 1.2);
  assert.ok(fitAbs(base, MAP_FRAME, [FERRY, FERRY], 40, 0.3, 0.8).scale <= 0.8);
});

test('scene: the phone\'s whole-city fit (352 × 388) labels ≥ 11 of the 16 T1, never two labels over each other, ≤ 120 SVG nodes; clusters carry "+n"', () => {
  const v = sfLandView({ cx: 0, cz: 0, scale: 1, w: 352, h: 388 }, MAP_FRAME);
  const s = scene(352, 388, v);
  const t1 = s.layout.kept.filter(k => s.attractions.get(k.id)?.a.rank === 1);
  const labelled = t1.filter(k => k.label).length + t1.reduce((n, k) => n + k.members.filter(m => ATTRACTION_INDEX.get(m)?.rank === 1).length * (k.label ? 1 : 0), 0);
  assert.ok(t1.filter(k => k.label).length >= 9, `${t1.filter(k => k.label).length} T1 badges labelled`);
  assert.ok(labelled >= 11, `${labelled} of 16 T1 named (a "+n" label names its cluster)`);
  assert.ok(s.layout.nodes <= 120, `${s.layout.nodes} nodes`);
  const boxes = labelBoxes(s);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!overlap(boxes[i], boxes[j]), 'labels overlap');
  // the Golden Gate Bridge is always named at the whole-city fit (lane P's early review: its badge stands on the south tower)
  const ggb = s.layout.kept.find(k => k.id === 'golden-gate-bridge');
  assert.ok(ggb?.label, 'the Golden Gate Bridge is labelled');
  // below s 0.3: no T2 badges, no stations
  assert.equal(s.stations.length, 0);
  assert.ok(![...s.attractions.values()].some(m => m.a.rank === 2));
});

test('scene: downtown at s 0.7 on a phone — stations on the canvas, badges and labels within 120 nodes, taps find badges and stations', () => {
  const s = scene(352, 388, { cx: 110, cz: 150, scale: 0.7 });
  assert.ok(s.stations.length >= 10, `${s.stations.length} stations`);
  assert.ok(s.layout.nodes <= 120, `${s.layout.nodes} nodes`);
  const boxes = labelBoxes(s);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!overlap(boxes[i], boxes[j]));
  // a tap on a kept attraction badge selects it; on a station mark, the station
  const badge = s.layout.kept.find(k => s.attractions.has(k.id) && !k.members.length)!;
  assert.deepEqual(hitTest(s, badge.x + 2, badge.y - 1), { kind: 'attraction', id: badge.id, members: [] });
  const badges = s.layout.kept.filter(k => s.attractions.has(k.id) || s.places.has(k.id));
  const far = s.stations.find(m => badges.every(k => Math.hypot(k.x - m.x, k.y - m.y) > 30))!;
  assert.ok(far, 'a station away from every badge');
  assert.equal(hitTest(s, far.x, far.y)?.kind, 'station');
  assert.equal(hitTest(s, far.x, far.y)?.id, far.st.id);
  assert.equal(hitTest(s, -500, -500), null);
});

test('scene: the 校园 chip shows every campus at the whole-city fit; a highlighted line shows only its stations, at every scale', () => {
  const v = sfLandView({ cx: 0, cz: 0, scale: 1, w: 352, h: 388 }, MAP_FRAME);
  const all = scene(352, 388, v);
  const campus = scene(352, 388, v, { filter: 'campus' });
  const campuses = (s: ReturnType<typeof scene>) => [...s.attractions.values()].filter(m => m.a.cat === 'campus');
  assert.equal(campuses(all).length, 1, 'only SF State (T1) at the fit without the chip');
  assert.ok(campuses(campus).length >= 8, `${campuses(campus).length} campuses with the chip`);
  assert.ok(campuses(campus).filter(m => m.a.rank === 2).every(m => m.label), 'the T2 campuses are named');
  for (const m of campus.attractions.values()) if (m.a.cat !== 'campus') assert.ok(m.alpha < 1, `${m.a.id} dimmed`);
  // the N highlighted: only N stations, drawn even below s 0.3
  const n = scene(352, 388, v, { highlight: 'n-judah' });
  assert.ok(n.stations.length >= 10, `${n.stations.length} N stations`);
  assert.ok(n.stations.every(m => m.st.lines.includes('n-judah')));
});

test('scene: plain places — the selected place always shows; station rows never draw as place dots; T4 only once found, from s 1.5', () => {
  const pl = ix.list.find(p => !p.curated && !covered.has(p.id) && !p.station && Math.hypot(p.x - 300, p.z - 600) < 200)!;
  const v = { cx: pl.x, cz: pl.z, scale: 0.4 };
  assert.ok(!scene(352, 388, v).places.has(placeLayoutId(pl.id)), 'not found, s 0.4: hidden');
  assert.ok(scene(352, 388, v, { selected: { kind: 'place', id: pl.id } }).places.has(placeLayoutId(pl.id)), 'selected: shown');
  assert.ok(scene(352, 388, { ...v, scale: 1.6 }, { discovered: id => id === pl.id }).places.has(placeLayoutId(pl.id)), 'found, s 1.6: shown');
  const st = scene(352, 388, { cx: 110, cz: 150, scale: 2 }, { discovered: () => true });
  for (const m of st.places.values()) assert.ok(!m.p.station, `${m.p.id} is a station`);
});

test('map panel ids: a place, an attraction, a station, a line (lane T\'s 看线路图)', () => {
  for (const tg of [{ kind: 'place', id: 'osm-w120483945' }, { kind: 'attraction', id: 'palace-of-fine-arts' }, { kind: 'station', id: 'muni-castro' }, { kind: 'line', id: 'n-judah' }] as const) {
    assert.deepEqual(parseMapPanelId(mapPanelId(tg)), tg);
  }
  assert.equal(mapPanelId({ kind: 'place', id: 'chinatown-dragon-gate' }), 'chinatown-dragon-gate', 'G1\'s 足迹 rows keep their bare ids');
  assert.equal(parseMapPanelId(''), null);
  assert.equal(parseMapPanelId(undefined), null);
});

test('stations as places: one row per map station, kind transit, walkable, arriving at the placed pole / kiosk; search, discovery at 12 u and fly', async () => {
  assert.equal(stationPlaceRows.length, STATIONS.length, 'no station id collides with a place row');
  const ids = new Set(stationPlaceRows.map(r => r.id));
  assert.equal(ids.size, stationPlaceRows.length);
  for (const r of stationPlaceRows) { assert.equal(r.kind, 'transit'); assert.equal(r.station, true); }
  const castro = ix.get('muni-castro')!;
  assert.ok(castro && castro.station && castro.walkable);
  const prop = W4.props['muni-castro'];
  if (prop) assert.deepEqual(castro.arrival, { x: prop[0], z: prop[1] }, 'boards at its kiosk');
  // discovery: standing at a station finds it
  const { newlyDiscovered } = await import('../src/opus-bay/game/discovery');
  assert.ok(newlyDiscovered(ix, { x: castro.x + 5, z: castro.z }, () => false).some(p => p.id === 'muni-castro'));
  // search by zh and en
  assert.ok(ix.search('卡斯特罗站').some(p => p.id === 'muni-castro'));
  // fly once discovered (lane G's planner: a fly row only to discovered places)
  const { planTrips } = await import('../src/opus-bay/game/tripPlan');
  const dest = { placeId: castro.id, x: castro.arrival.x, z: castro.arrival.z, name: castro.name };
  assert.ok(!planTrips(FERRY, dest, { discovered: () => false }).some(o => o.mode === 'fly'));
  assert.ok(planTrips(FERRY, dest, { discovered: id => id === 'muni-castro' }).some(o => o.mode === 'fly'), 'fly to a discovered station');
});

test('station rides: per line the next ★ stop and the terminus each way, the loop\'s 坐一圈 with its lap time; the F-line offers none', () => {
  setTransitData(cable);
  try {
    const infos = tripLineInfos(LINES);
    assert.ok(infos.has('powell-hyde') && infos.has('n-judah') && infos.has('sf-loop'));
    const castro = STATIONS.find(s => s.id === 'muni-castro')!;
    const rides = stationRides(castro, infos);
    const m = rides.filter(r => r.line === 'm-ocean-view');
    assert.ok(m.length >= 2, 'the M both ways');
    for (const r of rides) { assert.ok(r.seconds! > 0, `${r.line} → ${r.to.stop}`); assert.ok(r.to.name.zh.length > 0); }
    const lap = rides.find(r => r.lap);
    if (castro.lines.includes('sf-loop')) { assert.ok(lap, 'the loop stops here: 坐一圈'); assert.ok(lap!.seconds! > 10 * 60, `lap ${lap!.seconds} s`); }
    assert.ok(!rides.some(r => r.line === 'f-line'));
    // a cable-car terminus offers the ride to the other end
    const pm = STATIONS.find(s => s.lines.includes('powell-hyde') && s.ids.some(id => TERMINI.has(id)))!;
    assert.ok(stationRides(pm, infos).some(r => r.line === 'powell-hyde'));
  } finally { setTransitData(null); }
});

test('trips from the map: the islands end at their piers, the others at their arrival; label widths stay sane', () => {
  const alcatraz = ATTRACTION_INDEX.get('alcatraz')!;
  const row = ix.get(alcatraz.placeId!) ?? ix.get('alcatraz-landing')!;
  const d = placeTripDest(row, alcatraz);
  assert.equal(d.placeId, 'alcatraz-landing');
  assert.equal(d.attraction, 'alcatraz');
  const palace = ATTRACTION_INDEX.get('palace-of-fine-arts')!;
  const pd = placeTripDest(ix.get('palace-of-fine-arts')!, palace);
  assert.deepEqual([pd.x, pd.z], [palace.arrival!.x, palace.arrival!.z]);
  const plain = ix.get('osm-w120483945')!;
  assert.deepEqual(placeTripDest(plain), { placeId: plain.id, x: plain.arrival.x, z: plain.arrival.z, name: plain.name });
  assert.ok(labelWidth('州立大学 +1', 12) < 90);
});

test('足迹 (W4-P13): 必看 x / 16, every attraction whose place was found, lines ridden / known; the old counts stay', async () => {
  const { footprintsSummary } = await import('../src/opus-bay/ui/footprintsData');
  const found = ['palace-of-fine-arts', 'twin-peaks', 'stonestown-galleria', 'osm-w120483945', 'muni-castro'];
  const s = footprintsSummary(ix, found, 3, 41, { 'n-judah': 2, 'powell-hyde': 1 }, id => ({ zh: id, en: id }), 8, ATTRACTIONS, 8);
  assert.deepEqual(s.mustSee, { found: 3, total: 16 });
  assert.equal(s.attractions.total, ATTRACTIONS.length);
  assert.equal(s.attractions.found, 3);
  assert.deepEqual(s.lines, { ridden: 2, total: 8 });
  assert.equal(s.places, 5, 'a station is a place too');
  const old = footprintsSummary(ix, found, 3, 41, {}, () => null);
  assert.deepEqual([old.mustSee.total, old.attractions.total, old.lines.total], [0, 0, 0], 'without the lists: zeros, the old fields unchanged');
  assert.equal(old.landmarks.total, 24);
});

test('the tour recap map (lane C\'s mapSlot): the Grand Tour over the paper, finished legs full strength, chapters numbered', async () => {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RecapMap } = await import('../src/opus-bay/ui/RecapMap');
  const { SF_GRAND } = await import('../src/opus-bay/data/sf/tours');
  const first = SF_GRAND.chapters[0].stops.map(s => s.id);
  const html = renderToStaticMarkup(h(RecapMap, { tour: SF_GRAND, completed: first }));
  assert.match(html, /^<svg class="mw-recap" viewBox="[-\d. ]+"/);
  assert.ok((html.match(/<path /g) ?? []).length >= 10, 'route segments with their casing');
  assert.ok((html.match(/<circle /g) ?? []).length >= 10, 'stops and chapter discs');
  assert.ok(html.includes('>1<') && html.includes(`>${SF_GRAND.chapters.length}<`), 'every chapter numbered');
  assert.ok(html.includes('opacity="1"') && html.includes('opacity="0.35"'), 'done and to-do legs differ');
});

test('stickers (lane V\'s T1 sheet): from s 0.45 once the atlas is decoded, never under 0.45 or when off; the node count is the markup\'s', async () => {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MapBadge } = await import('../src/opus-bay/ui/MapBadge');
  const { badgeNodes, badgeSize } = await import('../src/opus-bay/ui/mapBadges');
  const on = scene(352, 388, { cx: 110, cz: 150, scale: 0.7 }, { stickers: true });
  const st = [...on.attractions.values()].filter(m => m.state.sticker);
  assert.ok(st.length >= 2, `${st.length} stickers downtown`);
  assert.ok(st.every(m => m.a.rank === 1));
  assert.ok(![...scene(352, 388, { cx: 110, cz: 150, scale: 0.4 }, { stickers: true }).attractions.values()].some(m => m.state.sticker), 'below s 0.45: glyphs');
  assert.ok(![...scene(352, 388, { cx: 110, cz: 150, scale: 0.7 }).attractions.values()].some(m => m.state.sticker), 'not decoded / off: glyphs');
  const a = ATTRACTION_INDEX.get('coit-tower')!, size = badgeSize(1, 0.7);
  for (const state of [{ discovered: false, sticker: true }, { discovered: true, sticker: true, selected: true }, { discovered: true, sticker: true, arrived: true, cluster: 2, tourStop: 3 }]) {
    const html = renderToStaticMarkup(h('svg', null, h(MapBadge, { a, tier: 1, s: 0.7, state, x: 10, y: 10, size })));
    assert.equal((html.match(/<[a-z]+[\s/>]/g) ?? []).length - 1, badgeNodes(size, state), JSON.stringify(state));
    assert.match(html, /<image href="\/opus-bay\/map\/stickers-t1\.webp"/);
  }
});

test('walking routes (lane D2\'s SF_ROUTES): the canvas pass draws the walk and a numbered disc per stop', async () => {
  const { drawMapExtras } = await import('../src/opus-bay/ui/cityMapModel');
  const { SF_ROUTES, routePath } = await import('../src/opus-bay/data/sf/routes');
  let strokes = 0, fills = 0; const texts: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (o, k) => (k === 'stroke' ? () => { strokes++; } : k === 'fill' ? () => { fills++; } : k === 'fillText' ? (s: string) => { texts.push(s); } : k in o ? o[k as string] : noop),
    set: (o, k, v) => { o[k as string] = v; return true; },
  });
  const r = SF_ROUTES[0], p = routePath(r.id)!;
  const ops = drawMapExtras(ctx as never, { cx: -20, cz: 120, scale: 1, w: 400, h: 400 }, { walk: { xz: p.points, stops: r.stops.map(s => ({ x: s.x, z: s.z })) } });
  assert.equal(ops, 2 + 3 * r.stops.length);
  assert.deepEqual(texts, r.stops.map((_, i) => String(i + 1)));
  assert.equal(fills, r.stops.length);
  assert.equal(strokes, 2 + r.stops.length);
});

test('a stop named for the attraction it serves says nothing while that badge shows its name (the loop\'s 艺术宫 beside the Palace)', () => {
  const palace = ATTRACTION_INDEX.get('palace-of-fine-arts')!;
  const s = scene(352, 388, { cx: palace.x, cz: palace.z, scale: 1.4 });
  const stop = s.stations.find(m => m.st.attractions[0] === 'palace-of-fine-arts');
  assert.ok(stop, 'a station serving the Palace in view');
  assert.ok(s.attractions.get('palace-of-fine-arts')?.label, 'the Palace badge is named');
  const item = s.layout.kept.find(k => k.id === `station:${stop!.st.id}`);
  assert.ok(!item?.label, 'its stop stays quiet');
  // selected, the stop names itself
  const sel = scene(352, 388, { cx: palace.x, cz: palace.z, scale: 1.4 }, { selected: { kind: 'station', id: stop!.st.id } });
  assert.ok(sel.layout.kept.find(k => k.id === `station:${stop!.st.id}`)?.label);
});

// Integration part b: the open items of part a
test('station marks move clear of the attraction badges (the turntable over Powell\'s 叮当, 唐人街 over Montgomery\'s N): ≤ 24 px, fewer covered marks', async () => {
  const { nudgeClear, STATION_NUDGE_PX } = await import('../src/opus-bay/ui/cityMapModel');
  // unit: a 30 × 14 pill under a 13 px badge moves straight down, just clear; a far disc changes nothing
  const [x, y] = nudgeClear(100, 100, 15, 7, [{ x: 100, y: 100, r: 13 }]);
  assert.equal(x, 100);
  assert.ok(y > 100 && y - 100 <= STATION_NUDGE_PX && y - 7 >= 113 - 1e-9, `moved to ${y}`);
  assert.deepEqual(nudgeClear(10, 10, 5, 5, [{ x: 100, y: 100, r: 13 }]), [10, 10]);
  // a disc too big to clear within the cap: the mark stays on its point
  assert.deepEqual(nudgeClear(0, 0, 5, 5, [{ x: 0, y: 0, r: 60 }]), [0, 0]);
  // the real downtown views (phone s 0.7 and 1.0, desktop s 0.7): count marks a kept badge still covers (T3 dots are
  // small and sit over a mark without hiding it: they do not move marks)
  const covered = (sc: ReturnType<typeof scene>) => sc.stations.filter(m => sc.layout.kept.some(kk => {
    const a = sc.attractions.get(kk.id);
    if (!a || a.state.dim || a.size.kind !== 'badge') return false;
    const dx = Math.max(0, Math.abs(kk.x - m.x) - m.sym.w / 2), dy = Math.max(0, Math.abs(kk.y - m.y) - m.sym.h / 2);
    return Math.hypot(dx, dy) < kk.r;
  })).length;
  for (const [w, h, v] of [[352, 388, { cx: 110, cz: 150, scale: 0.7 }], [352, 388, { cx: 120, cz: 200, scale: 1 }], [900, 600, { cx: 60, cz: 200, scale: 0.7 }]] as const) {
    const sc = scene(w, h, v);
    const moved = sc.stations.filter(m => Math.hypot(m.x - (m.st.x * v.scale + w / 2 - v.cx * v.scale), m.y - (m.st.z * v.scale + h / 2 - v.cz * v.scale)) > 0.5);
    assert.ok(moved.every(m => Math.hypot(m.x - (m.st.x * v.scale + w / 2 - v.cx * v.scale), m.y - (m.st.z * v.scale + h / 2 - v.cz * v.scale)) <= STATION_NUDGE_PX + 1e-6));
    const left = covered(sc);
    assert.ok(left <= 1, `${w}×${h} s ${v.scale}: ${left} station marks under a badge (${moved.length} moved)`);
    // taps still find the moved marks where they are drawn
    for (const m of moved.slice(0, 5)) if (hitTest(sc, m.x, m.y)?.kind === 'station') assert.equal(hitTest(sc, m.x, m.y)?.id, m.st.id);
  }
});

test('a walking route\'s stop an attraction badge stands for wears its number on the badge (gold), shown at any scale', async () => {
  const { SF_ROUTES } = await import('../src/opus-bay/data/sf/routes');
  const { badgePaint, BADGE_INK } = await import('../src/opus-bay/ui/mapBadges');
  const r = SF_ROUTES.find(x => x.id === 'r2') ?? SF_ROUTES[1];
  const numbers = new Map<string, number>();
  r.stops.forEach((st, i) => { const a = st.attraction ? ATTRACTION_INDEX.resolve(st.attraction) : st.placeId ? ATTRACTION_INDEX.primary(st.placeId) : undefined; if (a) numbers.set(a.id, i + 1); });
  assert.ok(numbers.size >= 3, `${numbers.size} stops on badges`);
  const xs = r.stops.map(s => s.x), zs = r.stops.map(s => s.z);
  const v = { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cz: (Math.min(...zs) + Math.max(...zs)) / 2, scale: 0.35 };
  const sc = scene(352, 388, v, { stops: numbers, highlight: `route:${r.id}` });
  for (const [id, n] of numbers) {
    const m = sc.attractions.get(id);
    assert.ok(m, `${id} shown`);
    assert.equal(m!.state.tourStop, n);
    assert.equal(m!.state.stopTone, 'walk');
    assert.equal(badgePaint(m!.a, m!.size, m!.state).tourDisc?.fill, BADGE_INK.gold);
  }
  // the Grand Tour's number stays coral
  const pal = scene(352, 388, v, { tourNext: { id: [...numbers.keys()][0], n: 3 } }).attractions.get([...numbers.keys()][0])!;
  assert.equal(badgePaint(pal.a, pal.size, pal.state).tourDisc?.fill, BADGE_INK.coral);
});

test('framing a line, a route or a trip keeps the tool column clear (a walk\'s first stop sat under the zoom buttons)', () => {
  const pts = [{ x: -382, z: 300 }, { x: -760, z: 590 }, { x: -600, z: 420 }];
  const v = fitAbs({ cx: 0, cz: 0, scale: 1, w: 352, h: 388 }, MAP_FRAME, pts, 36, 0.2, 2, 48);
  const px = (p: { x: number; z: number }) => (p.x - v.cx) * v.scale + v.w / 2;
  for (const p of pts) assert.ok(px(p) >= 36 - 1e-6 && px(p) <= 352 - 36 - 48 + 1e-6, `x ${px(p).toFixed(1)}`);
  // without the reserve the old framing (the default) is unchanged
  const old = fitAbs({ cx: 0, cz: 0, scale: 1, w: 352, h: 388 }, MAP_FRAME, pts, 36, 0.2, 2);
  assert.ok(Math.abs(old.cx - (-382 - 760) / 2) < 1e-6);
});

// --- integration review (W4-P-int-review) --------------------------------------------------------------------------------

test('review: opened mid-trip, the first view keeps you and the target clear of the tool column (desktop 484 × 430, phone 352 × 388, 375 px two-wide column)', () => {
  const palace = ATTRACTION_INDEX.get('palace-of-fine-arts')!, lombard = ATTRACTION_INDEX.get('lombard-crooked')!;
  const t1 = ATTRACTIONS.filter(a => a.rank === 1).map(a => ({ x: a.x, z: a.z, found: false }));
  for (const [w, h, right] of [[484, 430, 48], [352, 388, 48], [327, 290, 90]] as const) {
    for (const a of [palace, lombard]) {
      const target = a.arrival ?? a;
      const base = { cx: 0, cz: 0, scale: 0.5, w, h };
      const v = firstOpenView(base, MAP_FRAME, { player: FERRY, focus: [target], t1, right });
      const px = (p: { x: number; z: number }) => (p.x - v.cx) * v.scale + w / 2;
      // you (r 9) and BAYBAY beside you stay left of the column; the target too
      for (const p of [FERRY, target]) assert.ok(px(p) <= w - right - 40, `${w}×${h} → ${a.id}: x ${px(p).toFixed(1)} under the ${right} px column`);
      // the old framing put the Ferry under the buttons on the desktop (the bug)
      if (w === 484 && a === palace) {
        const old = firstOpenView(base, MAP_FRAME, { player: FERRY, focus: [target], t1 });
        assert.ok((FERRY.x - old.cx) * old.scale + w / 2 > w - 48 - 10, 'the old view: the Ferry at the tool column');
      }
    }
    // the first open with no trip keeps the column clear too
    const free = firstOpenView({ cx: 0, cz: 0, scale: 0.5, w, h }, MAP_FRAME, { player: FERRY, t1, right });
    assert.ok((FERRY.x - free.cx) * free.scale + w / 2 <= w - right - 30);
  }
});

test('review: the trip\'s ETA chip is a box the labels keep off (it covered the target\'s own name); a wide chip no longer clears a disc of labels', () => {
  const palace = ATTRACTION_INDEX.get('palace-of-fine-arts')!;
  const w = 484, h = 430, v = { cx: palace.x + 200, cz: palace.z - 80, scale: 0.8 };
  const base = scene(w, h, v, { target: { attraction: palace.id } });
  const k = base.layout.kept.find(kk => kk.id === palace.id)!;
  assert.ok(k && k.label, 'the target is named');
  // a 150 × 20 chip whose centre is 60 px left of that name: its box covers the name's start, a disc of r 10 at its
  // centre (what the scene made of every obstacle before) does not
  const lb = k.label!;
  const chip = { x: lb.x - 60, y: lb.y + lb.h / 2, r: 10, hw: 75, hh: 10 };
  const boxOf = (o: typeof chip) => [o.x - o.hw, o.y - o.hh, o.x + o.hw, o.y + o.hh] as Box;
  const labelBox = (l: NonNullable<typeof k.label>) => [l.x, l.y, l.x + l.w, l.y + l.h] as Box;
  assert.ok(overlap(labelBox(lb), boxOf(chip)), 'the chip box covers the name where it was');
  const withChip = scene(w, h, v, { target: { attraction: palace.id }, obstacles: [chip] });
  for (const kk of withChip.layout.kept) if (kk.label) assert.ok(!overlap([kk.label.x, kk.label.y, kk.label.x + kk.label.w, kk.label.y + kk.label.h], boxOf(chip)), `${kk.text} under the chip`);
  assert.ok(withChip.layout.kept.find(kk => kk.id === palace.id)?.label, 'the target keeps its name beside the pin');
  // a box, not a disc of radius 75: no fewer labels than the disc left
  const labelled = (s: ReturnType<typeof scene>) => s.layout.kept.filter(kk => kk.label).length;
  const asDisc = scene(w, h, v, { target: { attraction: palace.id }, obstacles: [{ x: chip.x, y: chip.y, r: 75 }] });
  assert.ok(labelled(withChip) >= labelled(asDisc), `${labelled(withChip)} labels with the box, ${labelled(asDisc)} with the disc`);
  // the obstacles never show as badges
  assert.ok(!withChip.layout.kept.some(kk => kk.id.startsWith('obstacle:')));
});

test('review: the canvas key follows the station marks and dots, not you / BAYBAY moving (no base-map redraw at 10 Hz while walking with the map open)', async () => {
  const { canvasMarksKey } = await import('../src/opus-bay/ui/cityMapModel');
  const v = { cx: 60, cz: 120, scale: 0.7 };
  const a = scene(352, 388, v, { obstacles: [{ x: 120, y: 200, r: 10 }, { x: 140, y: 210, r: 12 }] });
  const b = scene(352, 388, v, { obstacles: [{ x: 128, y: 203, r: 10 }, { x: 150, y: 214, r: 12 }] });
  assert.ok(a.stations.length > 5);
  assert.equal(canvasMarksKey(a), canvasMarksKey(b), 'you and BAYBAY moved: the same marks');
  assert.notEqual(canvasMarksKey(a), canvasMarksKey(scene(352, 388, { ...v, cx: v.cx + 10 })), 'a pan moves the marks');
  assert.notEqual(canvasMarksKey(a), canvasMarksKey(a, true), 'a highlighted walk adds the kept badges');
});

test('review: a station ride the planner does not offer is still that ride (walk to the tapped stop, then the line); the card\'s walk time stays once the route is known; the ETA text', async () => {
  const { stationRideOption, stationWalkSeconds, tripEta } = await import('../src/opus-bay/ui/mapTrips');
  const { timeLabel } = await import('../src/opus-bay/game/tripText');
  const { tripRemainingSeconds, LINE_MODELS } = await import('../src/opus-bay/game/tripPlan');
  setTransitData(cable);
  try {
    const infos = tripLineInfos(LINES);
    const loop = infos.get('sf-loop')!;
    const ferry = STATIONS.find(s => s.lines.includes('sf-loop') && Math.hypot(s.x - FERRY.x, s.z - FERRY.z) < 80)!;
    assert.ok(ferry, 'the loop stops at the Ferry');
    const board = loop.stops.find(s => ferry.ids.includes(s.id))!;
    const rides = stationRides(ferry, infos).filter(r => r.line === 'sf-loop' && !r.lap);
    assert.ok(rides.length >= 1 && rides.every(r => r.dir === 1), 'the loop rides carry their direction');
    const to = rides[0].to.stop;
    const from = { x: FERRY.x + 30, z: FERRY.z + 25 };
    const o = stationRideOption(from, loop, board.id, to, { dir: 1, wait: 42, rideSeconds: 60 })!;
    assert.ok(o, 'a ride option');
    assert.equal(o.mode, 'line');
    assert.deepEqual(o.legs.map(l => l.via), ['walk', 'line']);
    const walk = o.legs[0], ride = o.legs[1] as import('../src/opus-bay/game/tripTypes').TripLineLeg;
    assert.equal(walk.estimate, true);
    assert.equal(walk.to.station, board.id);
    assert.equal(ride.board, board.id);
    assert.equal(ride.alight, to);
    assert.equal(ride.wait, 42);
    assert.equal(ride.seconds, 42 + 60 + 2);
    assert.ok(ride.path && ride.path.length >= 4, 'the ride is drawn along the line');
    assert.ok(ride.stops >= 1 && !!ride.label?.zh.includes('坐'));
    assert.ok(Math.abs(o.seconds - (walk.seconds + ride.seconds)) < 1e-9);
    // standing at the stop: the ride alone; no ETA from the system: the line's own wait
    const at = stationRideOption({ x: board.x, z: board.z }, loop, board.id, to)!;
    assert.deepEqual(at.legs.map(l => l.via), ['line']);
    assert.equal((at.legs[0] as typeof ride).wait, LINE_MODELS.bus.wait);
    // nothing to ride: the same stop, an unknown stop; a two-way line the wrong way
    assert.equal(stationRideOption(from, loop, board.id, board.id), null);
    assert.equal(stationRideOption(from, loop, board.id, 'nope'), null);
    const n = infos.get('n-judah')!;
    const [n0, n1] = [n.stops[2], n.stops[5]];
    assert.ok(stationRideOption(from, n, n0.id, n1.id, { dir: 1 }));
    assert.equal(stationRideOption(from, n, n0.id, n1.id, { dir: -1 }), null, 'outbound stops, inbound direction');
    assert.equal((stationRideOption(from, n, n1.id, n0.id)!.legs.at(-1) as typeof ride).dir, -1, 'the direction follows the stops when not given');
    // the walk time on 带我去车站: the route's once known, the estimate meanwhile, none without a way
    assert.equal(stationWalkSeconds({ state: 'ok' }, 37, 100), 37);
    assert.ok(Math.abs(stationWalkSeconds({ state: 'pending' }, null, 100)! - 125 / 4.2) < 1e-9);
    assert.ok(Math.abs(stationWalkSeconds(null, null, 100)! - 125 / 4.2) < 1e-9);
    assert.equal(stationWalkSeconds({ state: 'none' }, null, 100), null);
    // the ETA the chip and the selected card share: the mode and the strip's time
    const trip = { option: o, legs: o.legs, leg: 1 };
    const eta = tripEta(trip);
    assert.equal(eta.zh, `坐车 ${timeLabel(tripRemainingSeconds(trip)).zh}`);
    assert.equal(eta.en, `Ride ${timeLabel(tripRemainingSeconds(trip)).en}`);
  } finally { setTransitData(null); }
});

test('review: during a trip here the place card changes its way (换个方式: the ways from here, the running one pressed, a pick replans); without the hook it offers no second trip', async () => {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PlaceActions } = await import('../src/opus-bay/ui/PlaceActions');
  const coit = ATTRACTION_INDEX.get('coit-tower')!;
  const place = ix.get(coit.placeId ?? coit.id)!;
  const eta = { zh: '跑过去 约 1 分钟', en: 'Run ~1 min' };
  const changing = renderToStaticMarkup(h(PlaceActions, { place, attraction: coit, onTrip: true, tripTime: eta, onReplan: () => undefined, tripMode: 'walk', startOpen: true }));
  assert.match(changing, /跑过去 约 1 分钟/, 'the trip\'s own way and time in the head');
  assert.match(changing, /换个方式/);
  assert.match(changing, /mw-trip-row[^"]*is-on/, 'the running way pressed');
  assert.match(changing, /class="mw-trip"/, 'the ways listed (in node: the walk row of the planner)');
  assert.doesNotMatch(changing, /跟 BAYBAY 去/, 'no second trip');
  const plain = renderToStaticMarkup(h(PlaceActions, { place, attraction: coit, onTrip: true, tripTime: eta }));
  assert.doesNotMatch(plain, /换个方式|其他方式|跟 BAYBAY 去/);
  const idle = renderToStaticMarkup(h(PlaceActions, { place, attraction: coit }));
  assert.match(idle, /跟 BAYBAY 去/);
});

test('review: a Grand Tour stop\'s trip (its placeId an interactable id) gets its pin and its selection on the map; a station opener takes any of the station\'s stop ids', async () => {
  const { mapTargetOf, mapOpenFallback } = await import('../src/opus-bay/ui/mapTrips');
  // the tour's trip to the Ferry Building stop: the stop's interactable, the stop's attraction → the attraction's badge
  const ferryA = ATTRACTION_INDEX.get('ferry-building-marketplace')!;
  assert.deepEqual(mapTargetOf('transit-loop-ferry-building', ferryA.id), { attraction: ferryA.id });
  assert.deepEqual(mapTargetOf('sf:city-hall', 'city-hall'), { attraction: 'city-hall' });
  // the island piers stay plain places (the badge stays); a map trip to an attraction stays its badge
  assert.deepEqual(mapTargetOf('alcatraz-landing', 'alcatraz'), { place: 'alcatraz-landing' });
  assert.deepEqual(mapTargetOf('coit-tower', 'coit-tower'), { attraction: 'coit-tower' });
  // the openers the map could not select: the trip card's 换个方式 on a tour stop, transit-<stop>, sf:<id>
  const loopFerry = STATIONS.find(s => s.ids.includes('loop-ferry-building'));
  assert.ok(loopFerry, 'the loop stops at the Ferry Building');
  assert.deepEqual(mapOpenFallback('transit-loop-ferry-building', STATIONS), { kind: 'station', id: loopFerry!.id });
  assert.deepEqual(mapOpenFallback('transit-loop-ferry-building', STATIONS, { placeId: 'transit-loop-ferry-building', attraction: ferryA.id }), { kind: 'attraction', id: ferryA.id });
  assert.deepEqual(mapOpenFallback('sf:city-hall', STATIONS), { kind: 'attraction', id: 'city-hall' });
  assert.equal(mapOpenFallback('osm-nothing-here', STATIONS), null);
  // a merged station holds several stop ids: every one finds it
  const merged = STATIONS.find(s => s.ids.length > 1)!;
  assert.deepEqual(mapOpenFallback(`transit-${merged.ids[merged.ids.length - 1]}`, STATIONS), { kind: 'station', id: merged.id });
});

test('review: 换个方式 on a station a running trip ends at (a Grand Tour stop): the trip\'s way and time, the ways listed once open, the running one pressed', async () => {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ChangeWay } = await import('../src/opus-bay/ui/PlaceActions');
  const to = { placeId: 'transit-loop-ferry-building', x: 133, z: 10.1, name: { zh: '渡轮大厦', en: 'Ferry Building' } };
  const open = renderToStaticMarkup(h(ChangeWay, { to, tripTime: { zh: '步行 约 12 秒', en: 'Walk ~12s' }, tripMode: 'walk', startOpen: true, onPick: () => undefined }));
  assert.match(open, /当前：步行 约 12 秒/);
  assert.match(open, /换个方式/);
  assert.match(open, /class="mw-trip"/);
  const closed = renderToStaticMarkup(h(ChangeWay, { to, onPick: () => undefined }));
  assert.match(closed, /换个方式/);
  assert.doesNotMatch(closed, /class="mw-trip"/, 'planned only once opened');
});
