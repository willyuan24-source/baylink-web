import type { Bilingual, Vec2 } from '../core/types';
import { ATTRACTION_CAT_STYLE, type Attraction, type AttractionCat } from '../data/sf/attractionTypes';
import type { MapTier } from '../data/sf/attractions';
import type { CityPlace } from '../data/sf/places';
import type { SfPlaceKind } from '../world/sf/format';
import { type MapFrameBox, type MapView, clampView } from './cityMapDraw';
import { BADGE_INK, type BadgeSize, type BadgeState, badgeNodes, badgeSize, scaleRules } from './mapBadges';
import { type MapFilter, filterLines, filterPlaces } from './mapFilterRules';
import { type AttractionMarker, type LayoutItem, type LayoutResult, attractionMarkers, layoutMap, layoutPriority, stationItem } from './mapLayout';
import { MAP_FONT_FAMILY, type MapStation, type RouteStroke, type StationCtx, type StationSymbol, drawStationMarks, stationSymbol } from './mapLines';

/**
 * Wave 4 · the city map's scene for one view (lane P, integration of W4-P4 … P10; plan sf-w4-plan.md §4.1). Pure: the
 * CityMap panel memoises it per view / filter / selection / discovery epoch and draws it — the attraction badges
 * (ui/mapLayout attractionMarkers), the other places (curated rows no attraction speaks for as T3, the discovered OSM
 * rows as T4 dots), the stations (canvas marks, layout obstacles and labels: lane P2), the visited neighbourhood
 * names, all through ONE layoutMap (clusters, labels beside their own badge, the SVG node budget). Plus the framing
 * helpers (the SF-land fit, the smart first open), hit testing and the canvas pass over the base map.
 */

/** What is selected on the map: an attraction's badge, a plain place, or a station. */
export interface MapSel { kind: 'attraction' | 'place' | 'station'; id: string }

/** The trip / map target: an attraction's badge becomes the gold pin-flag, or a plain place (the island piers). */
export interface MapTarget { attraction?: string | null; place?: string | null }

/** The SF land the whole-city fit frames (lane P's early review: Fort Funston z 1842, Candlestick Point x 1094). */
export const SF_LAND: MapFrameBox = { minX: -900, maxX: 1100, minZ: -100, maxZ: 1860 };

/** True north on the map: the game frame is turned, north points up-left (core/geo projectCity: −46° from screen up). */
export const NORTH_DEG = -46;

/** The category a plain place's badge borrows from its kind (curated rows without an attraction). */
const KIND_CAT: Partial<Record<SfPlaceKind, AttractionCat>> = {
  museum: 'museum', park: 'park', garden: 'park', zoo: 'park', trail: 'park', viewpoint: 'viewpoint', peak: 'viewpoint', hill: 'viewpoint',
  beach: 'coast', waterfront: 'coast', island: 'coast', water: 'coast', campus: 'campus', shopping: 'shopping', stadium: 'sports',
  religious: 'culture', historic: 'culture', neighbourhood: 'neighbourhood', street: 'neighbourhood', plaza: 'neighbourhood',
};
export const placeCat = (kind: string): AttractionCat => KIND_CAT[kind as SfPlaceKind] ?? 'landmark';

/** A plain place on the map (a row no attraction speaks for). */
export interface PlaceMark { p: CityPlace; x: number; y: number; tier: MapTier; size: BadgeSize; state: BadgeState; cat: AttractionCat; label: string | null }
/** A station mark (drawn on the canvas; tappable through hitTest). */
export interface StationMark { st: MapStation; sym: StationSymbol; x: number; y: number }

export interface SceneInput {
  view: MapView;
  attractions: readonly Attraction[];
  /** the place index rows (null until loaded) */
  places: readonly CityPlace[] | null;
  /** place ids an attraction badge stands for (attractions.ts coveredPlaceIds) */
  covered: ReadonlySet<string>;
  stations: readonly MapStation[];
  /** stop ids at the ends of a line (their names show from s 0.45) */
  termini?: ReadonlySet<string>;
  /** visited neighbourhoods' label anchors */
  zones?: readonly { id: string; x: number; z: number; name: Bilingual }[];
  discovered: (placeId: string) => boolean;
  arrived?: (attractionId: string) => boolean;
  selected: MapSel | null;
  target?: MapTarget | null;
  tourNext?: { id: string; n: number } | null;
  filter: MapFilter;
  /** lane V's T1 sticker atlas is decoded (and not `?stickers=0`) */
  stickers?: boolean;
  /** the 线路 tab's highlighted line: its stations show at every scale (tappable: 坐到这一站), the others hide */
  highlight?: string | null;
  /** the UI locale ('en' or a Chinese one) */
  locale: 'zh' | 'en';
  t: (b: Bilingual) => string;
  /** SVG node budget (150 desktop, 120 on a coarse pointer) */
  maxNodes: number;
  /** markers drawn outside the layout that labels keep off (you, BAYBAY, the rideables), px */
  obstacles?: readonly { x: number; y: number; r: number }[];
  toolRight?: number;
  creditBottom?: number;
}

export interface MapScene {
  layout: LayoutResult;
  attractions: Map<string, AttractionMarker>;
  /** keyed by layout id (`place:<id>`) */
  places: Map<string, PlaceMark>;
  stations: StationMark[];
  /** keyed by layout id (`zone:<id>`) */
  zones: Map<string, { id: string }>;
  /** attractions / places pushed to the canvas by the node budget: plain dots, no tap target */
  canvasDots: { x: number; y: number; r: number; color: string; alpha: number }[];
  s: number;
}

export const placeLayoutId = (id: string) => `place:${id}`;
export const zoneLayoutId = (id: string) => `zone:${id}`;
const OBSTACLE_PREFIX = 'obstacle:';

/** The scene for one view (pure; see the header). */
export function buildScene(o: SceneInput): MapScene {
  const v = o.view, s = v.scale, rules = scaleRules(s);
  const k = s, ox = v.w / 2 - v.cx * k, oy = v.h / 2 - v.cz * k;
  const inView = (x: number, y: number, m = 24) => x >= -m && y >= -m && x <= v.w + m && y <= v.h + m;
  const name = (b: Bilingual) => (o.locale === 'en' || s >= 1.2 ? o.t(b) : b.zh);
  const sel = o.selected, tgt = o.target ?? {};
  // 1. attractions
  const { items, markers } = attractionMarkers(o.attractions, v, {
    discovered: o.discovered, arrived: o.arrived, selected: sel?.kind === 'attraction' ? sel.id : null, target: tgt.attraction ?? null,
    tourNext: o.tourNext ?? null, filter: o.filter, name, stickers: o.stickers,
  });
  const all: LayoutItem[] = [...items];
  // 2. the other places: curated rows no attraction speaks for (T3), discovered OSM rows (T4); the selected / target always
  const places = new Map<string, PlaceMark>();
  for (const p of o.places ?? []) {
    // attraction rows speak through their badge, stations through their mark
    if (o.covered.has(p.id) || p.station) continue;
    const selected = sel?.kind === 'place' && sel.id === p.id, target = tgt.place === p.id;
    if (!selected && !target && !filterPlaces(o.filter)) continue;
    const tier: MapTier = p.curated || p.landmark ? 3 : 4;
    const found = o.discovered(p.id);
    if (tier === 4 && !found && !selected && !target) continue;
    let size = badgeSize(tier, s);
    if (size.kind === 'none') { if (!selected && !target) continue; size = { kind: 'dot', r: 5, glyph: 0, font: 10.5, weight: 700 }; }
    const x = p.x * k + ox, y = p.z * k + oy;
    if (!inView(x, y)) continue;
    const state: BadgeState = { discovered: found, selected, target };
    const wantLabel = selected || target || (tier === 3 ? rules.t3Labels : rules.t4Labels);
    const label = wantLabel ? name(p.name) : null;
    const id = placeLayoutId(p.id);
    places.set(id, { p, x, y, tier, size, state, cat: placeCat(p.kind), label });
    all.push({
      id, x, y, r: size.r, prio: layoutPriority({ selected, target, tier, fame: p.curated ? 30 : 0 }), clusterable: !selected && !target,
      ...(label ? { label, fontPx: size.font } : {}), nodes: badgeNodes(size, state),
    });
  }
  // 3. stations (lane P2: canvas marks, obstacles for labels, a label when the symbol asks)
  const stations: StationMark[] = [];
  if (filterLines(o.filter).stations) {
    for (const st of o.stations) {
      const x = st.x * k + ox, y = st.z * k + oy;
      if (!inView(x, y, 40)) continue;
      const onLine = !!o.highlight && st.lines.includes(o.highlight);
      if (o.highlight && !onLine && !(sel?.kind === 'station' && sel.id === st.id)) continue;
      const sym = stationSymbol(st, onLine ? Math.max(s, 0.45) : s, { locale: o.locale, tourStop: st.lines.includes('sf-loop'), terminus: st.ids.some(id => o.termini?.has(id)) });
      if (!sym) continue;
      stations.push({ st, sym, x, y });
      const selected = sel?.kind === 'station' && sel.id === st.id;
      // a stop named for the attraction it serves (the loop's 艺术宫) says nothing while that badge shows its own name
      const quiet = !selected && !!st.attractions[0] && !!markers.get(st.attractions[0])?.label;
      const item = stationItem(st, sym, x, y, (sym.label && !quiet) || selected ? o.t(st.name) : null, 10, { canvas: true });
      if (selected) { item.prio = layoutPriority({ selected: true }); if (!item.label) { item.label = o.t(st.name); item.fontPx = 10; } }
      all.push(item);
    }
  }
  // 4. visited neighbourhood names (lowest priority, label only)
  const zones = new Map<string, { id: string }>();
  if (rules.zoneNames) {
    for (const z of o.zones ?? []) {
      const x = z.x * k + ox, y = z.z * k + oy;
      if (!inView(x, y, 0)) continue;
      const id = zoneLayoutId(z.id);
      zones.set(id, { id: z.id });
      all.push({ id, x, y, r: 0, prio: layoutPriority({ zone: true }), label: o.t(z.name), fontPx: 10, clusterable: false, host: false, nodes: 0 });
    }
  }
  // 5. you, BAYBAY, the rideables: labels keep off them, nothing merges with them, they cost no node here
  (o.obstacles ?? []).forEach((b, i) => all.push({ id: `${OBSTACLE_PREFIX}${i}`, x: b.x, y: b.y, r: b.r, prio: 0.5, clusterable: false, host: false, nodes: 0 }));
  const layout = layoutMap(all, { w: v.w, h: v.h, clusters: rules.clusters, maxNodes: o.maxNodes, toolRight: o.toolRight ?? 48, creditBottom: o.creditBottom ?? 18 });
  layout.kept = layout.kept.filter(kk => !kk.id.startsWith(OBSTACLE_PREFIX));
  // the budget's leftovers: plain canvas dots
  const canvasDots: MapScene['canvasDots'] = [];
  for (const id of layout.overBudget) {
    const a = markers.get(id), pm = places.get(id);
    if (a) canvasDots.push({ x: a.x, y: a.y, r: Math.min(4, a.size.r), color: a.state.discovered ? catColorOf(a.a.cat) : BADGE_INK.cream, alpha: a.alpha });
    else if (pm) canvasDots.push({ x: pm.x, y: pm.y, r: Math.min(3.5, pm.size.r), color: pm.state.discovered ? catColorOf(pm.cat) : BADGE_INK.cream, alpha: 1 });
  }
  return { layout, attractions: markers, places, stations, zones, canvasDots, s };
}

const catColorOf = (c: AttractionCat) => ATTRACTION_CAT_STYLE[c].color;

/** What a tap at (px, py) hits: the nearest kept badge / place / station within `r` px (the selected wins ties). */
export function hitTest(scene: MapScene, px: number, py: number, r = 22): (MapSel & { members?: string[] }) | null {
  // distances to the mark's edge (a tap inside counts 0); the SVG badges lie over the canvas stations, so a badge wins a tie
  let best: (MapSel & { members?: string[] }) | null = null, bd = r;
  for (const m of scene.stations) {
    const d = Math.max(0, Math.abs(m.x - px) - m.sym.w / 2, Math.abs(m.y - py) - m.sym.h / 2);
    if (d < bd) { best = { kind: 'station', id: m.st.id }; bd = d; }
  }
  for (const k of scene.layout.kept) {
    const d = Math.max(0, Math.hypot(k.x - px, k.y - py) - k.r);
    if (d > bd || (d === bd && best && best.kind !== 'station')) continue;
    if (scene.attractions.has(k.id)) { best = { kind: 'attraction', id: k.id, members: k.members }; bd = d; }
    else if (scene.places.has(k.id)) { best = { kind: 'place', id: scene.places.get(k.id)!.p.id, members: k.members }; bd = d; }
  }
  return best;
}

/** The world points a clustered badge stands for (its own and its members'), to zoom to them. */
export function clusterPoints(scene: MapScene, attractions: ReadonlyMap<string, Pick<Attraction, 'x' | 'z'>>, id: string, members: readonly string[]): Vec2[] {
  const out: Vec2[] = [];
  for (const m of [id, ...members]) {
    const a = attractions.get(m);
    if (a) { out.push({ x: a.x, z: a.z }); continue; }
    const pm = scene.places.get(m);
    if (pm) out.push({ x: pm.p.x, z: pm.p.z });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Framing (absolute scale: s = CSS px per world unit)
// ---------------------------------------------------------------------------------------------------------------------

/** The view that shows `pts` with `pad` px to spare, its scale kept in [sMin, sMax] (then the usual limits). */
export function fitAbs(v: MapView, frame: MapFrameBox, pts: readonly Vec2[], pad: number, sMin: number, sMax: number): MapView {
  if (!pts.length) return v;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  const sx = (v.w - 2 * pad) / Math.max(1, x1 - x0), sz = (v.h - 2 * pad) / Math.max(1, z1 - z0);
  const scale = Math.min(sMax, Math.max(sMin, Math.min(sx, sz)));
  return clampView({ ...v, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, scale }, frame);
}

/** 全城: the SF land box, as large as it fits (phone ≈ 0.185, desktop ≈ 0.231). */
export function sfLandView(v: MapView, frame: MapFrameBox, pad = 6): MapView {
  const b = SF_LAND;
  return fitAbs(v, frame, [{ x: b.minX, z: b.minZ }, { x: b.maxX, z: b.maxZ }], pad, 0, Infinity);
}

/**
 * The map's first view (plan §4.1 "Framing"): with a trip / tour / target, the player + the target (+ the next stop),
 * 48 px padding, s in [0.25, 1.2]; otherwise the player + the 3 nearest T1 not visited yet, s in [0.3, 0.8] (from the
 * Ferry that frames Coit, Chinatown and Union Square instead of the Bay); nothing left to find: the player at s 0.6.
 */
export function firstOpenView(v: MapView, frame: MapFrameBox, o: { player: Vec2; focus?: readonly Vec2[]; t1: readonly (Vec2 & { found: boolean })[] }): MapView {
  if (o.focus?.length) return fitAbs(v, frame, [o.player, ...o.focus], 48, 0.25, 1.2);
  const near = o.t1.filter(a => !a.found).map(a => ({ a, d: Math.hypot(a.x - o.player.x, a.z - o.player.z) })).sort((p, q) => p.d - q.d).slice(0, 3).map(q => q.a);
  if (!near.length) return clampView({ ...v, cx: o.player.x, cz: o.player.z, scale: 0.6 }, frame);
  return fitAbs(v, frame, [o.player, ...near], 40, 0.3, 0.8);
}

// ---------------------------------------------------------------------------------------------------------------------
// The canvas pass over the base map (after cityMapDraw.drawCityMap and mapLines.drawTransitLines)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * The trip route (mapLines.tripRouteStrokes: walk legs dashed gold, rides in the line colour, finished legs grey), the
 * white board / alight dots, the station marks and the over-budget dots, in that order. Returns the operation count.
 */
export function drawMapExtras(ctx: StationCtx, v: MapView, o: {
  route?: { strokes: readonly RouteStroke[]; dots: readonly Vec2[] } | null; stations?: readonly StationMark[]; stationAlpha?: number; dots?: MapScene['canvasDots'];
  /** a walking route of data/sf/routes.ts (the 线路 tab's 步行路线): its walk (flat x, z) and its numbered stops */
  walk?: { xz: readonly number[]; stops: readonly Vec2[] } | null;
}): number {
  let ops = 0;
  const k = v.scale, ox = v.w / 2 - v.cx * k, oy = v.h / 2 - v.cz * k;
  if (o.walk && o.walk.xz.length >= 4) {
    const xz = o.walk.xz;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(xz[0] * k + ox, xz[1] * k + oy);
    for (let i = 2; i < xz.length; i += 2) ctx.lineTo(xz[i] * k + ox, xz[i + 1] * k + oy);
    ctx.setLineDash([]);
    ctx.strokeStyle = BADGE_INK.cream;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = BADGE_INK.goldDeep;
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    ops += 2;
    ctx.font = `800 9px ${MAP_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    o.walk.stops.forEach((p, i) => {
      const x = p.x * k + ox, y = p.z * k + oy;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = BADGE_INK.gold;
      ctx.fill();
      ctx.strokeStyle = BADGE_INK.cream;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillText(String(i + 1), x, y + 3.2);
      ops += 3;
    });
    ctx.restore();
  }
  if (o.route) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const st of o.route.strokes) {
      const path = () => { ctx.beginPath(); ctx.moveTo(st.xz[0] * k + ox, st.xz[1] * k + oy); for (let i = 2; i < st.xz.length; i += 2) ctx.lineTo(st.xz[i] * k + ox, st.xz[i + 1] * k + oy); };
      path();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = BADGE_INK.cream;
      ctx.lineWidth = st.width + 3;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = st.color;
      ctx.lineWidth = st.width;
      ctx.setLineDash(st.dash ? [...st.dash] : []);
      ctx.stroke();
      ops += 2;
    }
    ctx.setLineDash([]);
    for (const d of o.route.dots) {
      ctx.beginPath();
      ctx.arc(d.x * k + ox, d.z * k + oy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(60, 40, 20, .45)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ops += 2;
    }
    ctx.restore();
  }
  if (o.stations?.length) ops += drawStationMarks(ctx, o.stations, { alpha: o.stationAlpha ?? 1 });
  if (o.dots?.length) {
    ctx.save();
    for (const d of o.dots) {
      ctx.globalAlpha = d.alpha;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(60, 40, 20, .35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ops += 2;
    }
    ctx.restore();
  }
  return ops;
}

