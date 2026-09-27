import type { Bilingual } from '../core/types';
import { W4_LINES } from '../data/sf/stationNames';
import type { TransitData, TransitLineJson } from '../data/transit';
import type { TripLeg } from '../game/tripTypes';
import type { TransitLine, TransitLineKind, TransitTunnel } from '../world/sf/format';
import { type Ctx2D, type MapFrameBox, type MapView, labelWidth, visibleBox } from './cityMapDraw';

/**
 * Wave 4 · transit lines, stations and trip routes on the city map (lane P, W4-P7 / W4-P10; plan sf-w4-plan.md §3.6
 * and §4.1 "Lines and stations", "Guidance on the map"). Pure: styles, the surface / tunnel split of a line, the
 * station symbol for a scale, the route strokes of a trip, and one canvas pass (`drawTransitLines`) that replaces the
 * cable-car block of cityMapDraw.drawCityMap at the integration (same Ctx2D recorder in tests).
 *
 * Scale `s` = CSS px per world unit (the map's absolute scale, plan §4.1): phone SF fit 0.185, desktop SF fit 0.231.
 */

export type LineGlyph = 'Bus' | 'TrainFront' | 'CableCar' | 'TramFront';

export interface LineStyle {
  id: string;
  kind: TransitLineKind;
  name: Bilingual;
  /** the letter / word in the station discs and the legend (N, M, 观光 / Tour, 叮当 / Cable, F) */
  disc: Bilingual;
  color: string;
  /** the casing under the line (2 px wider): cream for the loop, a pale tint for the Metro, paper white for the rest */
  casing: string;
  /** white centre dashes along the line [dash, gap] in px (the loop: "coral, cream casing, white centre dashes") */
  centreDash?: readonly [number, number];
  /** lucide-react icon for rows and pills */
  glyph: LineGlyph;
  /** what you ride, in a trip row (观光巴士 2 站, N 线 5 站, 叮当车 3 站) */
  ride: Bilingual;
  /** search words (zh + en): 地铁 / muni / N 线 → the Metro lines, 观光巴士 → the loop … */
  aliases: readonly string[];
  /** the route in a few words for the 线路 tab */
  route: Bilingual;
  /** draw order (low first: the loop under the rails) */
  order: number;
}

const METRO_WORDS = ['地铁', '轻轨', 'metro', 'muni', 'subway', 'light rail', 'muni metro'];
const CABLE_WORDS = ['叮当车', '缆车', 'cable car', 'cable'];

/** Every line the city map knows (the wave-2 cable cars + F-line and lane T's three wave-4 lines). */
export const LINE_STYLES: Readonly<Record<string, LineStyle>> = {
  'sf-loop': {
    id: 'sf-loop', ride: { zh: '观光巴士', en: 'Tour bus' }, kind: 'bus', name: W4_LINES['sf-loop'].name, disc: { zh: '观光', en: 'Tour' }, color: W4_LINES['sf-loop'].color, casing: W4_LINES['sf-loop'].casing,
    centreDash: [4, 5], glyph: 'Bus', route: W4_LINES['sf-loop'].route, order: 0,
    aliases: ['观光', '观光巴士', '观光环线', '环线', '巴士', 'bus', 'sightseeing', 'hop-on hop-off', 'hop on', 'tour bus', 'loop'],
  },
  'n-judah': {
    id: 'n-judah', ride: { zh: 'N 线', en: 'N Judah' }, kind: 'light-rail', name: W4_LINES['n-judah'].name, disc: { zh: 'N', en: 'N' }, color: W4_LINES['n-judah'].color, casing: W4_LINES['n-judah'].casing,
    glyph: 'TrainFront', route: W4_LINES['n-judah'].route, order: 1, aliases: ['N', 'N 线', 'N线', 'N Judah', 'Judah', ...METRO_WORDS],
  },
  'm-ocean-view': {
    id: 'm-ocean-view', ride: { zh: 'M 线', en: 'M Ocean View' }, kind: 'light-rail', name: W4_LINES['m-ocean-view'].name, disc: { zh: 'M', en: 'M' }, color: W4_LINES['m-ocean-view'].color, casing: W4_LINES['m-ocean-view'].casing,
    glyph: 'TrainFront', route: W4_LINES['m-ocean-view'].route, order: 2, aliases: ['M', 'M 线', 'M线', 'M Ocean View', 'Ocean View', ...METRO_WORDS],
  },
  // wave 2 (colours = public/opus-bay/sf/v1/transit.json)
  'powell-hyde': {
    id: 'powell-hyde', ride: { zh: '叮当车', en: 'Cable car' }, kind: 'cable-car', name: { zh: '鲍威尔-海德线叮当车', en: 'Powell–Hyde cable car' }, disc: { zh: '叮当', en: 'Cable' }, color: '#d8744a', casing: '#fffaf1',
    glyph: 'CableCar', route: { zh: '叮当车 · Powell & Market ↔ 海德街（渔人码头）', en: 'Cable car · Powell & Market ↔ Hyde St (the Wharf)' }, order: 3,
    aliases: ['Powell-Hyde', 'Powell Hyde', 'Hyde', ...CABLE_WORDS],
  },
  'powell-mason': {
    id: 'powell-mason', ride: { zh: '叮当车', en: 'Cable car' }, kind: 'cable-car', name: { zh: '鲍威尔-梅森线叮当车', en: 'Powell–Mason cable car' }, disc: { zh: '叮当', en: 'Cable' }, color: '#c9a14a', casing: '#fffaf1',
    glyph: 'CableCar', route: { zh: '叮当车 · Powell & Market ↔ 梅森街（北滩）', en: 'Cable car · Powell & Market ↔ Mason St (North Beach)' }, order: 4,
    aliases: ['Powell-Mason', 'Powell Mason', 'Mason', ...CABLE_WORDS],
  },
  california: {
    id: 'california', ride: { zh: '叮当车', en: 'Cable car' }, kind: 'cable-car', name: { zh: '加州街线叮当车', en: 'California St cable car' }, disc: { zh: '叮当', en: 'Cable' }, color: '#7a5a8c', casing: '#fffaf1',
    glyph: 'CableCar', route: { zh: '叮当车 · 渡轮大厦旁 ↔ Van Ness', en: 'Cable car · by the Ferry Building ↔ Van Ness' }, order: 5,
    aliases: ['California', 'California Street', '加州街', ...CABLE_WORDS],
  },
  'f-line': {
    id: 'f-line', ride: { zh: 'F 线', en: 'F-line' }, kind: 'streetcar', name: { zh: 'F 线复古电车', en: 'F Market & Wharves streetcar' }, disc: { zh: 'F', en: 'F' }, color: '#2f8f88', casing: '#fffaf1',
    glyph: 'TramFront', route: { zh: 'F 线 · 渔人码头 ↔ 市场街', en: 'F-line · the Wharf ↔ Market St' }, order: 6,
    aliases: ['F', 'F 线', 'F线', 'F-line', 'streetcar', '电车', '复古电车', 'historic streetcar'],
  },
};

const KIND_GLYPH: Readonly<Record<TransitLineKind, LineGlyph>> = { bus: 'Bus', 'light-rail': 'TrainFront', 'cable-car': 'CableCar', streetcar: 'TramFront' };

/** The style of any line: the table's, else one derived from the published line (its colour, `short`, kind). */
export function lineStyle(line: { id: string; kind: TransitLineKind; name: Bilingual; color: string; short?: string }): LineStyle {
  const known = LINE_STYLES[line.id];
  if (known) return known;
  const short = line.short ?? line.name.en.slice(0, 1);
  return {
    id: line.id, kind: line.kind, name: line.name, disc: { zh: short, en: short }, color: line.color, casing: '#fffaf1', glyph: KIND_GLYPH[line.kind], ride: line.name,
    aliases: [short, line.name.zh, line.name.en], route: line.name, order: 10,
  };
}

/** One stroke of a line at scale s (px). */
export interface LineStroke { color: string; width: number; dash?: number[]; alpha: number }

/**
 * The strokes of a line (casing, colour, centre dashes) at scale s. `underground` dashes the colour (tunnel spans);
 * `dimmed` draws it at 30 % (another line is highlighted in the 线路 tab or a filter hides transit).
 */
export function lineStrokes(style: LineStyle, s: number, o: { underground?: boolean; dimmed?: boolean } = {}): LineStroke[] {
  const main = style.kind === 'cable-car' || style.kind === 'streetcar' ? Math.min(4, Math.max(2, 1.4 * s)) : Math.min(6, Math.max(2, 1.6 * s));
  const alpha = o.dimmed ? 0.3 : 1;
  const out: LineStroke[] = [{ color: style.casing, width: main + 2, alpha }];
  if (o.underground) {
    out.push({ color: style.color, width: main, dash: [main * 2.2, main * 1.6], alpha: alpha * 0.85 });
    return out;
  }
  out.push({ color: style.color, width: main, alpha });
  if (style.centreDash && s >= 0.3) out.push({ color: '#ffffff', width: Math.max(1, main * 0.3), dash: [...style.centreDash], alpha });
  return out;
}

/** A line as the map draws it (TransitLine and lane T's runtime lines fit). */
export interface MapLineInput {
  id: string;
  kind: TransitLineKind;
  name: Bilingual;
  color: string;
  short?: string;
  /** world [x, y, z] triples */
  path: ArrayLike<number>;
  loop?: boolean;
  tunnels?: readonly Pick<TransitTunnel, 'fromAt' | 'toAt'>[];
}

/** A stop as the map needs it (TransitStop / TransitStopJson / a cable-car station fit). */
export interface MapStopInput { id: string; name: Bilingual; x: number; z: number; major?: boolean; attractions?: readonly string[] }
/** A line with its stops: what drawTransitLines and mapStations take. */
export type MapLine = MapLineInput & { stops: readonly MapStopInput[]; tunnels?: readonly Pick<TransitTunnel, 'fromAt' | 'toAt' | 'stations'>[] };

/**
 * The map's lines from what the runtime holds (review fix: the integration's adapter, tested on the real build).
 * data/transit.ts `transitData()` keeps the three cable lines as `CableLine` (track `xyz`, stops that only name their
 * merged `station`), the F-line is `flineJson()` (published JSON) and lane T's wave-4 lines are `TransitLine`s; none
 * of them is a MapLine as is. Cable stops take their station's id, name and position (termini are major).
 */
export function mapLinesFrom(cable: Pick<TransitData, 'lines' | 'stations'> | null, fline: TransitLineJson | null, w4: readonly TransitLine[] = []): MapLine[] {
  const out: MapLine[] = [];
  if (cable) {
    const byId = new Map(cable.stations.map(st => [st.id, st]));
    for (const l of cable.lines) {
      const stops: MapStopInput[] = [];
      for (const s of l.stops) {
        const st = byId.get(s.station);
        if (st && !stops.some(q => q.id === st.id)) stops.push({ id: st.id, name: st.name, x: st.x, z: st.z, ...(s.terminus ? { major: true } : {}) });
      }
      out.push({ id: l.id, kind: l.kind, name: l.name, color: l.color, path: l.xyz, stops });
    }
  }
  if (fline) out.push({ id: fline.id, kind: fline.kind, name: fline.name, color: fline.color, path: fline.path, stops: fline.stops });
  for (const l of w4) out.push(l);
  return out;
}

/** A piece of a line: flat [x0, z0, x1, z1, …] and whether it runs underground. */
export interface LinePiece { under: boolean; xz: number[] }

/** Cumulative arc length of an xyz path (xz distance, as the transit data measures `at`). */
export function arcLengths(path: ArrayLike<number>): Float64Array {
  const n = Math.floor(path.length / 3);
  const cum = new Float64Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(path[i * 3] - path[i * 3 - 3], path[i * 3 + 2] - path[i * 3 - 1]);
  return cum;
}

/**
 * Split a line into surface and tunnel pieces by its tunnel spans (arc order, non-overlapping), cutting the path at
 * the exact span ends. Without tunnels: one surface piece.
 */
export function splitByTunnels(path: ArrayLike<number>, tunnels: readonly Pick<TransitTunnel, 'fromAt' | 'toAt'>[] = []): LinePiece[] {
  const n = Math.floor(path.length / 3);
  if (n < 2) return [];
  const cum = arcLengths(path);
  const cuts: { at: number; under: boolean }[] = [];
  for (const t of [...tunnels].sort((a, b) => a.fromAt - b.fromAt)) { cuts.push({ at: t.fromAt, under: true }, { at: t.toAt, under: false }); }
  const pieces: LinePiece[] = [];
  let cur: LinePiece = { under: false, xz: [] };
  let ci = 0;
  // a span starting at arc 0 opens the line underground
  while (ci < cuts.length && cuts[ci].at <= 0) { cur.under = cuts[ci].under; ci++; }
  const pointAt = (i: number, at: number): [number, number] => {
    const seg = cum[i + 1] - cum[i] || 1, t = (at - cum[i]) / seg;
    return [path[i * 3] + (path[i * 3 + 3] - path[i * 3]) * t, path[i * 3 + 2] + (path[i * 3 + 5] - path[i * 3 + 2]) * t];
  };
  cur.xz.push(path[0], path[2]);
  for (let i = 0; i < n - 1; i++) {
    while (ci < cuts.length && cuts[ci].at < cum[i + 1]) {
      const [x, z] = pointAt(i, Math.max(cum[i], cuts[ci].at));
      cur.xz.push(x, z);
      if (cur.xz.length >= 4) pieces.push(cur);
      cur = { under: cuts[ci].under, xz: [x, z] };
      ci++;
    }
    cur.xz.push(path[i * 3 + 3], path[i * 3 + 5]);
  }
  if (cur.xz.length >= 4) pieces.push(cur);
  return pieces;
}

interface LinePieces { pieces: LinePiece[]; box: MapFrameBox; surface: LinePiece[]; under: LinePiece[] }
const pieceCache = new WeakMap<object, LinePieces>();
/** A line's pieces, split once per line object (the map redraws on every pan / zoom step). */
function piecesOf(line: MapLineInput): LinePieces {
  let hit = pieceCache.get(line);
  if (!hit) {
    const pieces = splitByTunnels(line.path, line.tunnels ?? []);
    const box = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (let i = 0; i + 2 < line.path.length; i += 3) {
      const x = line.path[i], z = line.path[i + 2];
      if (x < box.minX) box.minX = x; if (x > box.maxX) box.maxX = x; if (z < box.minZ) box.minZ = z; if (z > box.maxZ) box.maxZ = z;
    }
    hit = { pieces, box, surface: pieces.filter(p => !p.under), under: pieces.filter(p => p.under) };
    pieceCache.set(line, hit);
  }
  return hit;
}

export interface DrawLinesOptions {
  /** the 线路 tab's highlighted line: the others draw at 30 % */
  highlight?: string | null;
  /** a filter chip that is not 交通 / 全部 dims every line */
  dimAll?: boolean;
}

const NO_DASH: number[] = [];

/**
 * Draw every line for view v (loop under the Metro under the cable cars): one path per piece style, casing first.
 * Returns the number of strokes (the op budget: ≤ 3 per piece kind per line, lines off the view cost nothing).
 */
export function drawTransitLines(ctx: Ctx2D, lines: readonly MapLineInput[], v: MapView, o: DrawLinesOptions = {}): number {
  const vb = visibleBox(v, 8);
  let ops = 0;
  const sorted = lines.length > 1 ? [...lines].sort((a, b) => lineStyle(a).order - lineStyle(b).order) : lines;
  // toPx inlined: no [x, y] tuple per vertex (a pan redraws ≈ 2,300 line vertices per stroke kind)
  const k = v.scale, ox = v.w / 2 - v.cx * k, oy = v.h / 2 - v.cz * k;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const line of sorted) {
    const lp = piecesOf(line);
    const box = lp.box;
    if (box.maxX < vb.minX || box.minX > vb.maxX || box.maxZ < vb.minZ || box.minZ > vb.maxZ) continue;
    const style = lineStyle(line);
    const dimmed = o.dimAll || (!!o.highlight && o.highlight !== line.id);
    for (const under of [false, true]) {
      const mine = under ? lp.under : lp.surface;
      if (!mine.length) continue;
      for (const st of lineStrokes(style, v.scale, { underground: under, dimmed })) {
        ctx.beginPath();
        for (const p of mine) {
          const xz = p.xz;
          ctx.moveTo(xz[0] * k + ox, xz[1] * k + oy);
          for (let i = 2; i < xz.length; i += 2) ctx.lineTo(xz[i] * k + ox, xz[i + 1] * k + oy);
        }
        ctx.globalAlpha = st.alpha;
        ctx.strokeStyle = st.color;
        ctx.lineWidth = st.width;
        ctx.setLineDash(st.dash ?? NO_DASH);
        ctx.stroke();
        ops++;
      }
    }
  }
  ctx.setLineDash(NO_DASH);
  ctx.globalAlpha = 1;
  ctx.restore();
  return ops;
}

// ---------------------------------------------------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------------------------------------------------

/** A station as the map shows it: the stops of every line that stand at one place (see `mapStations`). */
export interface MapStation {
  /** the primary stop's id (the Metro's where there is one) */
  id: string;
  /** the primary stop's name */
  name: Bilingual;
  /** the primary stop's position (the pill stays on its line) */
  x: number;
  z: number;
  /** every stop id this station stands for, the primary's first (lane T's rides and ETAs are per stop id) */
  ids: string[];
  /** the other stops' names (search finds the station by any of them) */
  names: Bilingual[];
  /** line ids stopping here, in LINE_STYLES order */
  lines: string[];
  underground: boolean;
  major: boolean;
  /** attraction ids served on foot (main first) */
  attractions: string[];
}

export interface MapStationsOptions {
  /** stops of different lines within this many u of a station's primary stop join it as a transfer (0: off) */
  mergeR?: number;
  /** stops of ONE line with the same name within this many u are its two directions (the F-line's): one station */
  sameNameR?: number;
}

/** Which stop names a merged station: the Metro's, then the loop's, the cable car's, the F-line's. */
const KIND_RANK: Readonly<Record<TransitLineKind, number>> = { 'light-rail': 0, bus: 1, 'cable-car': 2, streetcar: 3 };
const sameStopName = (a: Bilingual, b: Bilingual) => a.en.trim().toLowerCase() === b.en.trim().toLowerCase();

/**
 * The map's stations (review fix: transfers by distance, not only by a shared id):
 * 1. by stop id (N and M share their Market St stations);
 * 2. one line's stops with the same name within `sameNameR` u (the F-line's two directions, 2–5 u apart) → one
 *    station at their midpoint;
 * 3. stations sharing NO line within `mergeR` u of a station's primary stop → one transfer station (a pill of every
 *    line's disc): Castro (loop · M · F), Powell (N M · 叮当 · F), the Ferry Building (loop · F), Hyde & Beach (loop ·
 *    叮当) … Primaries go Metro first, then the loop, the cable cars, the F-line (more lines first inside a kind); a
 *    primary takes its nearest candidates first and never a second stop of a line it already has. Stops a short walk
 *    apart (the loop's Civic Center, 54 u from the Metro's) stay separate stations.
 */
export function mapStations(lines: readonly MapLine[], o: MapStationsOptions = {}): MapStation[] {
  const mergeR = o.mergeR ?? STATION_RULES.mergeR, sameNameR = o.sameNameR ?? STATION_RULES.sameNameR;
  const kinds = new Map(lines.map(l => [l.id, l.kind] as const));
  const order = (id: string) => LINE_STYLES[id]?.order ?? 10;
  // 1. by id
  const by = new Map<string, MapStation>();
  for (const line of lines) {
    const under = new Set((line.tunnels ?? []).flatMap(t => ('stations' in t ? t.stations : [])));
    for (const s of line.stops) {
      let st = by.get(s.id);
      if (!st) { st = { id: s.id, name: s.name, x: s.x, z: s.z, ids: [s.id], names: [], lines: [], underground: false, major: false, attractions: [] }; by.set(s.id, st); }
      if (!st.lines.includes(line.id)) st.lines.push(line.id);
      st.underground ||= under.has(s.id);
      st.major ||= !!s.major;
      for (const a of s.attractions ?? []) if (!st.attractions.includes(a)) st.attractions.push(a);
    }
  }
  const absorb = (into: MapStation, st: MapStation) => {
    for (const id of st.ids) if (!into.ids.includes(id)) into.ids.push(id);
    for (const n of [st.name, ...st.names]) if (!sameStopName(n, into.name) && !into.names.some(m => sameStopName(m, n))) into.names.push(n);
    for (const l of st.lines) if (!into.lines.includes(l)) into.lines.push(l);
    into.underground ||= st.underground;
    into.major ||= st.major;
    for (const a of st.attractions) if (!into.attractions.includes(a)) into.attractions.push(a);
  };
  // 2. one line's two directions
  let list: MapStation[] = [];
  const count = new Map<MapStation, number>();
  for (const st of by.values()) {
    const twin = sameNameR > 0
      ? list.find(g => g.lines.some(l => st.lines.includes(l)) && sameStopName(g.name, st.name) && Math.hypot(g.x - st.x, g.z - st.z) <= sameNameR)
      : undefined;
    if (!twin) { list.push(st); count.set(st, 1); continue; }
    const n = count.get(twin)!;
    twin.x = (twin.x * n + st.x) / (n + 1);
    twin.z = (twin.z * n + st.z) / (n + 1);
    count.set(twin, n + 1);
    absorb(twin, st);
  }
  // 3. transfers by distance
  if (mergeR > 0) {
    const rank = (st: MapStation) => Math.min(4, ...st.lines.map(id => KIND_RANK[kinds.get(id) ?? LINE_STYLES[id]?.kind ?? 'streetcar']));
    const index = new Map(list.map((st, i) => [st, i] as const));
    const primaries = [...list].sort((a, b) => rank(a) - rank(b) || b.lines.length - a.lines.length || Number(b.major) - Number(a.major) || index.get(a)! - index.get(b)!);
    const taken = new Set<MapStation>();
    for (const p of primaries) {
      if (taken.has(p)) continue;
      taken.add(p);
      const d = (c: MapStation) => Math.hypot(c.x - p.x, c.z - p.z);
      const near = list.filter(c => !taken.has(c) && d(c) <= mergeR).sort((a, b) => d(a) - d(b));
      for (const c of near) {
        if (c.lines.some(l => p.lines.includes(l))) continue;
        taken.add(c);
        count.set(c, 0);
        absorb(p, c);
      }
    }
    list = list.filter(st => count.get(st) !== 0);
  }
  for (const st of list) st.lines.sort((a, b) => order(a) - order(b));
  return list;
}

/** One line disc of a station symbol: the line's disc text, its colour, its width in the symbol's locale (px). */
export interface StationDisc { text: Bilingual; color: string; w: number }

/** How a station draws at scale s (null = hidden). */
export interface StationSymbol {
  /** dot: white 7 px with a 2 px line-colour ring; pill: white pill holding the line discs (transfers) */
  kind: 'dot' | 'pill';
  /** the ring colour of a dot (the line's) */
  ring: string;
  discs: StationDisc[];
  /** the locale the disc widths were measured in (MapStationMark writes that text) */
  locale: 'zh' | 'en';
  /** underground: a small stair glyph beside it */
  stair: boolean;
  /** show the name (≥ 1.2 all; 0.45–1.2 transfers, termini and tour stops) */
  label: boolean;
  /** drawn in the SVG overlay (tappable) from s 0.45; below that a canvas dot only */
  svg: boolean;
  /** outer size in px (hit box) */
  w: number;
  h: number;
}

export const STATION_RULES = { hideBelow: 0.3, svgFrom: 0.45, allNamesFrom: 1.2, dot: 7, disc: 12, discFont: 8, discPad: 6, mergeR: 16, sameNameR: 12 } as const;

/**
 * A disc's width for its text (review fix): 12 px holds one letter (N, M, F); two characters (观光, 叮当) or a word
 * (Tour, Cable) get a capsule as wide as the text at the disc font (8 px, weight 800) plus 3 px a side.
 */
export const discWidth = (text: string): number => Math.max(STATION_RULES.disc, Math.ceil(labelWidth(text, STATION_RULES.discFont) + STATION_RULES.discPad));

export function stationSymbol(st: Pick<MapStation, 'lines' | 'underground' | 'major'>, s: number, o: { tourStop?: boolean; terminus?: boolean; locale?: 'zh' | 'en' } = {}): StationSymbol | null {
  if (s < STATION_RULES.hideBelow || !st.lines.length) return null;
  const locale = o.locale ?? 'zh';
  const styles = st.lines.map(id => LINE_STYLES[id] ?? null).filter((x): x is LineStyle => !!x);
  // one disc per distinct disc text (the three cable lines share 叮当)
  const discs: StationDisc[] = [];
  for (const sty of styles) if (!discs.some(d => d.text.zh === sty.disc.zh)) discs.push({ text: sty.disc, color: sty.color, w: discWidth(sty.disc[locale]) });
  const transfer = discs.length > 1;
  const svg = s >= STATION_RULES.svgFrom;
  if (!svg && !(st.major || transfer || o.tourStop)) return null;
  const label = s >= STATION_RULES.allNamesFrom || (svg && (transfer || !!o.tourStop || !!o.terminus));
  if (transfer && svg) {
    const w = 4 + discs.reduce((sum, d) => sum + d.w + 2, 0) + (st.underground ? 10 : 0);
    return { kind: 'pill', ring: discs[0].color, discs, locale, stair: st.underground, label, svg, w, h: STATION_RULES.disc + 4 };
  }
  return { kind: 'dot', ring: styles[0]?.color ?? '#6f5f47', discs, locale, stair: st.underground && svg, label, svg, w: STATION_RULES.dot + 4, h: STATION_RULES.dot + 4 };
}

/**
 * SVG elements a station costs in the overlay, exactly as ui/MapBadge.tsx `MapStationMark` draws it (the layout's node
 * budget): a dot 1, a pill 1 + 2 per line disc (circle + letter); + 1 for the stair mark. Canvas-only symbols cost 0.
 */
export function stationNodes(sym: StationSymbol | null): number {
  if (!sym || !sym.svg) return 0;
  return (sym.kind === 'pill' ? 1 + sym.discs.length * 2 : 1) + (sym.stair ? 1 : 0);
}

// ---------------------------------------------------------------------------------------------------------------------
// Trip routes on the map (the active trip, plan §4.1 "Guidance on the map")
// ---------------------------------------------------------------------------------------------------------------------

export const ROUTE_GOLD = '#e0a94a';

export interface RouteStroke {
  /** flat [x0, z0, …] in the world frame */
  xz: number[];
  color: string;
  width: number;
  dash?: readonly number[];
  /** a finished leg (greyed) */
  done: boolean;
}

/**
 * The strokes of a trip's legs: walk / run legs dashed gold 3 px, ride legs solid 4 px in the line colour, drive legs
 * solid gold 3 px; legs before `current` grey; a leg without a path draws its straight from → to. Plus the white
 * board / alight dots of line legs.
 */
export function tripRouteStrokes(legs: readonly TripLeg[], current = 0, lineColor: (lineId: string) => string = id => LINE_STYLES[id]?.color ?? '#6f5f47'): { strokes: RouteStroke[]; dots: { x: number; z: number }[] } {
  const strokes: RouteStroke[] = [];
  const dots: { x: number; z: number }[] = [];
  legs.forEach((leg, i) => {
    const xz = leg.path && leg.path.length >= 4 ? [...leg.path] : [leg.from.x, leg.from.z, leg.to.x, leg.to.z];
    const done = i < current;
    if (leg.via === 'line') {
      strokes.push({ xz, color: done ? '#b9ad98' : lineColor(leg.line), width: 4, done });
      dots.push({ x: leg.from.x, z: leg.from.z }, { x: leg.to.x, z: leg.to.z });
    } else if (leg.via === 'walk' || leg.via === 'run') {
      strokes.push({ xz, color: done ? '#b9ad98' : ROUTE_GOLD, width: 3, dash: [6, 5], done });
    } else if (leg.via === 'bike' || leg.via === 'car') {
      strokes.push({ xz, color: done ? '#b9ad98' : ROUTE_GOLD, width: 3, done });
    }
    // fly legs draw nothing (the pelican has no route)
  });
  return { strokes, dots };
}
