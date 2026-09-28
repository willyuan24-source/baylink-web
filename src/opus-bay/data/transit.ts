import type { Bilingual } from '../core/types';
import type { StreetcarSystem } from '../world/flineSystem';
import type { TransitLine, TransitLineKind, TransitTunnel } from '../world/sf/format';
import type { LineFleet } from '../world/sf/lineFleet';
import type { CableSystem, RideStatus, RiderRequest } from '../world/transitLine';

/**
 * City transit data (lane F, plan §6.5), pure: no three.js, no DOM, no fetch at import. Built from the published
 * `public/opus-bay/sf/<version>/transit.json` (OSM route relations, ODbL; track heights from the terrain curve) into
 * what the cable-car simulation (world/transitLine.ts), the stations (game/transit.ts) and other lanes' read-only
 * imports (G1's map lines / station icons) need:
 *
 *   buildTransit(file)   → TransitData: cable lines with arc-length tables, merged stations, turntables
 *   loadTransit()        → Promise<TransitData | null> (browser: current.json → manifest → transit.json, cached)
 *   transitData()        → the loaded data, or null before it arrives (tests set it with setTransitData)
 *
 * Cable-car lines (Powell–Hyde 456 u, Powell–Mason 346 u, California 320 u) are extended by their turntable stubs
 * (Powell & Market 2.7 u, Hyde & Beach 11.7 u, Taylor & Bay 5.6 u): arc length 0 is the start turntable's centre when
 * the line has one. Stops within 8 u merge into stations (ids `[a-z0-9-]`, shared across lines: the Powell lines share
 * their first 11 stops, Powell & California is a three-line station). Cars dwell at every second stop, at the termini
 * and at the crossing station; the other stations are request stops (a rider waiting or getting off).
 */

export const CABLE = {
  /** the cable runs at a constant speed (u/s) */
  speed: 9,
  /** gripping the cable: acceleration (u/s²) */
  grip: 3,
  /** service brake into a stop (u/s²) */
  brake: 3,
  /** dwell at a stop (s) */
  dwell: 4,
  /** unpushed 180° turn on a turntable (s) */
  turnSeconds: 9,
  /** body (u): length, width, height (plan §6.5) */
  length: 5.6,
  width: 2.0,
  height: 2.6,
  /** half the distance between the two bogie centres (u): pitch = track grade over this base */
  bogie: 1.75,
  /** lateral offset of two cars passing at a stop (u, each to its own right) */
  passOffset: 1.05,
  /** cars farther than this from the camera are hidden (u) */
  hideBeyond: 300,
  /** a waiting rider is picked up within this many seconds (an unseen car is brought closer if needed) */
  dispatchSeconds: 5,
  /** stops closer than this merge into one station (u) */
  stationMerge: 8,
  /** rail top above the ground (u): the car's origin */
  railLift: 0.08,
} as const;

/** A ride counts (goal, save, `transit` ride event) only at another station after this many units on board. */
export const RIDE_MIN_ODOMETER = 150;
/**
 * (verify D3) Someone on foot standing at least this far past the spot a vehicle's nose rests at when it stops at its next
 * stop is not in its way: the cable car / F-line car / bus / Metro train runs in to its stop instead of halting a few
 * units short of them (the Powell & Market turntable's card spot stands 2.8 u past the nose of a car on the turntable) (u)
 */
export const PERSON_CLEAR = 0.8;

/** Distance of a car's centre from a crossing it stops in front of (half a car + half the crossing car + margin). */
export const CROSSING_STOP = 4.4;
/** Half width of the crossing box a car must own before it enters (u): the other car's body, not its stop. */
export const CROSSING_HALF = 1.2;

export interface TransitStopJson { id: string; name: Bilingual; at: number; x: number; z: number; osmId: number | null; major?: boolean; attractions?: string[] }
export interface TransitLineJson {
  id: string;
  /** wave 2: 'cable-car' / 'streetcar'; wave 4 (lane T): the sightseeing loop 'bus', the Muni Metro 'light-rail' */
  kind: TransitLineKind;
  name: Bilingual;
  short?: string;
  loop?: boolean;
  tunnels?: TransitTunnel[];
  speeds?: [number, number, number][];
  osmRelation: number;
  sourceUrl: string;
  color: string;
  /** world [x, y, z] triples */
  path: number[];
  length: number;
  stops: TransitStopJson[];
  turntables: { x: number; z: number; osmId: number | null; name: string }[];
  doubleEnded: boolean;
  heroSpans: [number, number][];
}
export interface TransitFileJson {
  version: string;
  source: string;
  lines: TransitLineJson[];
  /** wave 4: where each loop / Metro stop's pole or kiosk stands (the sidecar's placement on the built city), by stop id */
  props?: Record<string, [number, number]>;
}

/**
 * The wave-4 lines as published (lane T, plan §3): the sightseeing loop and the Muni Metro N / M, plus where each stop's
 * pole / kiosk stands. The stops' own x, z are the track-side points (lane C's TOUR_GEO pins them); you board at the
 * prop (`boardAt`).
 */
export interface TransitW4 {
  loop: TransitLine;
  metro: TransitLine[];
  /** loop first, then N, M */
  lines: TransitLine[];
  props: Readonly<Record<string, readonly [number, number]>>;
}

/** The wave-4 part of a transit file (null when it has no loop or no Metro line: an older file). */
export function buildTransitW4(file: TransitFileJson): TransitW4 | null {
  const lines = file.lines.filter(l => l.kind === 'bus' || l.kind === 'light-rail') as unknown as TransitLine[];
  const loop = lines.find(l => l.kind === 'bus' && l.loop);
  const metro = lines.filter(l => l.kind === 'light-rail');
  if (!loop || !metro.length) return null;
  return { loop, metro, lines: [loop, ...metro], props: file.props ?? {} };
}

/** Where a rider boards / alights for stop `id` of a wave-4 line: its placed pole / kiosk, else the stop point. */
export function boardAt(w4: Pick<TransitW4, 'props'>, stop: { id: string; x: number; z: number }): { x: number; z: number } {
  const p = w4.props[stop.id];
  return p ? { x: p[0], z: p[1] } : { x: stop.x, z: stop.z };
}

export interface TransitStation {
  /** `[a-z0-9-]{1,64}`, from the street names ("powell-market") */
  id: string;
  name: Bilingual;
  x: number;
  z: number;
  /** every line stopping here, with the arc position (extended path) and whether cars always dwell here */
  lines: { line: string; at: number; dwell: boolean }[];
}

export interface CableStop {
  station: string;
  /** arc position on the extended path (u) */
  at: number;
  /** cars always stop here (every second stop, termini, crossings); otherwise only on request */
  dwell: boolean;
  terminus: boolean;
  /** a crossing station: the car stops this far before the crossing centre (in its direction of travel) */
  near: number;
}

export interface Turntable {
  id: string;
  name: Bilingual;
  x: number;
  z: number;
  /** lines turning here */
  lines: string[];
  /** true where lane D2's landmark draws the static disc (Powell & Market): F only adds the spinning top */
  landmark: boolean;
  /** stub length from the line's end to the disc centre (u) */
  stub: number;
}

export interface Crossing {
  /** the other line */
  line: string;
  /** arc position of the crossing on this line / on the other line */
  at: number;
  otherAt: number;
}

export interface CableLine {
  id: string;
  kind: 'cable-car';
  name: Bilingual;
  color: string;
  sourceUrl: string;
  doubleEnded: boolean;
  /** extended track centreline (turntable stubs included), world [x, y, z] triples */
  xyz: Float32Array;
  /** cumulative arc length at each point */
  cum: Float32Array;
  length: number;
  /** length of the published OSM path (without stubs) */
  osmLength: number;
  /** arc position of the published path's start on the extended path (the start stub's length, 0 without) */
  s0: number;
  /** every stop, sorted by `at` (termini sit on the turntable centre when the line has one) */
  stops: CableStop[];
  turntableStart: Turntable | null;
  turntableEnd: Turntable | null;
  /** spans (extended arc) inside the hero slab */
  heroSpans: [number, number][];
  crossings: Crossing[];
  /** lines sharing this line's track from arc 0 up to `until` (the Powell lines: 0 … Powell & Jackson) */
  shared: { line: string; until: number }[];
}

export interface TransitData {
  version: string;
  source: string;
  lines: CableLine[];
  stations: TransitStation[];
  turntables: Turntable[];
}

// ---------------------------------------------------------------------------
// Arc-length helpers (pure)
// ---------------------------------------------------------------------------

export interface TrackPoint { x: number; y: number; z: number; heading: number; grade: number }

/** Point on a line at arc s (clamped): position, heading of increasing s (three.js: faces (sin h, cos h)), grade dy/ds. */
export function pointAt(line: Pick<CableLine, 'xyz' | 'cum' | 'length'>, s: number, out: TrackPoint = { x: 0, y: 0, z: 0, heading: 0, grade: 0 }): TrackPoint {
  const { xyz, cum } = line;
  const n = cum.length;
  const ss = s <= 0 ? 0 : s >= line.length ? line.length : s;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= ss) lo = mid; else hi = mid; }
  const seg = cum[hi] - cum[lo] || 1;
  const t = (ss - cum[lo]) / seg;
  const ax = xyz[lo * 3], ay = xyz[lo * 3 + 1], az = xyz[lo * 3 + 2];
  const bx = xyz[hi * 3], by = xyz[hi * 3 + 1], bz = xyz[hi * 3 + 2];
  out.x = ax + (bx - ax) * t;
  out.y = ay + (by - ay) * t;
  out.z = az + (bz - az) * t;
  out.heading = Math.atan2(bx - ax, bz - az);
  out.grade = (by - ay) / seg;
  return out;
}

/** Nearest arc position on a line to (x, z) and the distance (u). */
export function nearestAt(line: Pick<CableLine, 'xyz' | 'cum'>, x: number, z: number): { at: number; d: number } {
  const { xyz, cum } = line;
  let best = { at: 0, d: Infinity };
  for (let i = 1; i < cum.length; i++) {
    const ax = xyz[i * 3 - 3], az = xyz[i * 3 - 1], bx = xyz[i * 3], bz = xyz[i * 3 + 2];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best.d) best = { at: cum[i - 1] + (cum[i] - cum[i - 1]) * t, d };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

const STREET_WORDS = /\b(street|st|avenue|ave|boulevard|blvd|place|pl)\b\.?/gi;

/** "Powell Street & Market Street" → "Powell & Market". */
export function shortStationName(name: string): string {
  return name.replace(STREET_WORDS, '').replace(/\s+/g, ' ').replace(/\s*&\s*/g, ' & ').trim();
}

/** "Powell & Market" → "powell-market" (`[a-z0-9-]`, ≤ 64). */
export function stationSlug(name: string): string {
  const s = shortStationName(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (s || 'stop').slice(0, 60);
}

type P3 = [number, number, number];

function pointsOf(path: number[]): P3[] {
  const out: P3[] = [];
  for (let i = 0; i + 2 < path.length; i += 3) out.push([path[i], path[i + 1], path[i + 2]]);
  return out;
}

/** A smooth stub from `from` (tangent `dir`) to the turntable centre `to`: straight when nearly in line, else a quadratic curve. */
function stubPoints(from: P3, dir: { x: number; z: number }, to: { x: number; z: number }, y: number): P3[] {
  const tx = to.x - from[0], tz = to.z - from[2];
  const along = tx * dir.x + tz * dir.z, side = tx * dir.z - tz * dir.x;
  if (Math.abs(side) < 0.6 || along <= 0) return [[to.x, y, to.z]];
  const c = { x: from[0] + dir.x * along * 0.6, z: from[2] + dir.z * along * 0.6 };
  const out: P3[] = [];
  const steps = Math.max(4, Math.ceil(Math.hypot(tx, tz) / 1.2));
  for (let k = 1; k <= steps; k++) {
    const t = k / steps, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, d = t * t;
    out.push([a * from[0] + b * c.x + d * to.x, from[1] + (y - from[1]) * t, a * from[2] + b * c.z + d * to.z]);
  }
  return out;
}

function cumulative(pts: P3[]): Float32Array {
  const cum = new Float32Array(pts.length);
  for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
  return cum;
}

const TURNTABLE_NAMES: Record<string, Bilingual> = {
  'powell-market': { zh: 'Powell & Market 转车台', en: 'Powell & Market turntable' },
  'hyde-beach': { zh: 'Hyde & Beach 转车台', en: 'Hyde & Beach turntable' },
  'taylor-bay': { zh: 'Taylor & Bay 转车台', en: 'Taylor & Bay turntable' },
};

/** zh glossary (G2): transit.json says 缆车; everything the player reads says 叮当车 ("鲍威尔-海德线叮当车"). */
export const glossName = (name: Bilingual): Bilingual => ({ zh: name.zh.replace(/缆车/g, '叮当车'), en: name.en });

/** Build the cable-car network from transit.json (the F-line entry is left to world/streetcar.ts). */
export function buildTransit(file: TransitFileJson): TransitData {
  const cableJson = file.lines.filter(l => l.kind === 'cable-car');
  const turntables: Turntable[] = [];
  const turntableAt = (x: number, z: number, line: string, stub: number, stationName: string): Turntable => {
    let t = turntables.find(tt => Math.hypot(tt.x - x, tt.z - z) < 1);
    if (!t) {
      const id = stationSlug(stationName);
      t = { id, name: TURNTABLE_NAMES[id] ?? { zh: `${shortStationName(stationName)} 转车台`, en: `${shortStationName(stationName)} turntable` }, x, z, lines: [], landmark: id === 'powell-market', stub };
      turntables.push(t);
    }
    if (!t.lines.includes(line)) t.lines.push(line);
    return t;
  };

  const lines: CableLine[] = cableJson.map(j => {
    const pts = pointsOf(j.path);
    const n = pts.length;
    const dirOf = (a: P3, b: P3) => { const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1; return { x: dx / L, z: dz / L }; };
    let head: P3[] = [], tail: P3[] = [];
    let ttStart: Turntable | null = null, ttEnd: Turntable | null = null;
    const first = j.stops[0], last = j.stops[j.stops.length - 1];
    for (const tt of j.turntables) {
      const dStart = Math.hypot(tt.x - pts[0][0], tt.z - pts[0][2]), dEnd = Math.hypot(tt.x - pts[n - 1][0], tt.z - pts[n - 1][2]);
      if (dStart <= dEnd && dStart < 20) {
        ttStart = turntableAt(tt.x, tt.z, j.id, dStart, first.name.en);
        head = stubPoints(pts[0], dirOf(pts[1], pts[0]), tt, pts[0][1]).reverse();
      } else if (dEnd < 20) {
        ttEnd = turntableAt(tt.x, tt.z, j.id, dEnd, last.name.en);
        tail = stubPoints(pts[n - 1], dirOf(pts[n - 2], pts[n - 1]), tt, pts[n - 1][1]);
      }
    }
    // (the head stub runs from the path start out to the disc; reversed, it leads from the disc centre to the start)
    const all: P3[] = [...head, ...pts, ...tail];
    const cum = cumulative(all);
    const s0 = head.length ? cum[head.length] : 0;
    const length = cum[cum.length - 1];
    const xyz = new Float32Array(all.length * 3);
    all.forEach((p, i) => { xyz[i * 3] = p[0]; xyz[i * 3 + 1] = p[1]; xyz[i * 3 + 2] = p[2]; });
    const stops: CableStop[] = j.stops.map((st, i) => {
      const terminus = i === 0 || i === j.stops.length - 1;
      // termini with a turntable sit on the disc centre
      const at = i === 0 && ttStart ? 0 : i === j.stops.length - 1 && ttEnd ? length : st.at + s0;
      return { station: '', at, dwell: terminus || i % 2 === 0, terminus, near: 0 };
    });
    return {
      id: j.id, kind: 'cable-car', name: glossName(j.name), color: j.color, sourceUrl: j.sourceUrl, doubleEnded: j.doubleEnded,
      xyz, cum, length, osmLength: j.length, s0, stops, turntableStart: ttStart, turntableEnd: ttEnd,
      heroSpans: j.heroSpans.map(([a, b]) => [a + s0, b + s0] as [number, number]),
      crossings: [], shared: [],
    };
  });

  // stations: stops within CABLE.stationMerge u merge (across lines too), ids from the street names
  const stations: TransitStation[] = [];
  const used = new Set<string>();
  lines.forEach((line, li) => {
    const json = cableJson[li];
    json.stops.forEach((st, i) => {
      const stop = line.stops[i];
      let station = stations.find(s => Math.hypot(s.x - st.x, s.z - st.z) < CABLE.stationMerge);
      if (!station) {
        let id = stationSlug(st.name.en), k = 2;
        while (used.has(id)) id = `${stationSlug(st.name.en)}-${k++}`;
        used.add(id);
        const short = shortStationName(st.name.en);
        station = { id, name: { zh: short, en: short }, x: st.x, z: st.z, lines: [] };
        stations.push(station);
      }
      if (!station.lines.some(l => l.line === line.id)) station.lines.push({ line: line.id, at: stop.at, dwell: stop.dwell });
      stop.station = station.id;
    });
  });

  // shared track: two lines whose paths coincide from the start (the Powell lines up to Powell & Jackson)
  for (const a of lines) for (const b of lines) {
    if (a === b) continue;
    let until = 0;
    const p = { x: 0, y: 0, z: 0, heading: 0, grade: 0 }, q = { ...p };
    for (let s = 0; s <= Math.min(a.length, b.length); s += 0.5) {
      pointAt(a, s, p); pointAt(b, s, q);
      if (Math.hypot(p.x - q.x, p.z - q.z) > 0.3) break;
      until = s;
    }
    if (until > 10) a.shared.push({ line: b.id, until });
  }

  // crossings between lines that do not share the track there (Powell × California)
  for (const a of lines) for (const b of lines) {
    if (a === b) continue;
    for (let i = 1; i < a.cum.length; i++) {
      const ax = a.xyz[i * 3 - 3], az = a.xyz[i * 3 - 1], bx = a.xyz[i * 3], bz = a.xyz[i * 3 + 2];
      for (let k = 1; k < b.cum.length; k++) {
        const cx = b.xyz[k * 3 - 3], cz = b.xyz[k * 3 - 1], dx = b.xyz[k * 3], dz = b.xyz[k * 3 + 2];
        const den = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
        if (Math.abs(den) < 1e-9) continue;
        const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / den;
        const u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / den;
        if (t < 0 || t > 1 || u < 0 || u > 1) continue;
        const at = a.cum[i - 1] + (a.cum[i] - a.cum[i - 1]) * t, otherAt = b.cum[k - 1] + (b.cum[k] - b.cum[k - 1]) * u;
        if (a.shared.some(sh => sh.line === b.id && at <= sh.until + 1)) continue;
        if (!a.crossings.some(c => c.line === b.id && Math.abs(c.at - at) < 2)) a.crossings.push({ line: b.id, at, otherAt });
      }
    }
  }
  // a station within 10 u of a crossing becomes a dwell stop on the near side of it
  for (const line of lines) {
    for (const c of line.crossings) {
      const stop = line.stops.filter(st => !st.terminus).sort((p, q) => Math.abs(p.at - c.at) - Math.abs(q.at - c.at))[0];
      if (stop && Math.abs(stop.at - c.at) < 10) { stop.dwell = true; stop.at = c.at; stop.near = CROSSING_STOP; }
    }
    for (const st of line.stops) {
      const station = stations.find(s => s.id === st.station);
      const entry = station?.lines.find(l => l.line === line.id);
      if (entry) { entry.at = st.at; entry.dwell = st.dwell; }
    }
  }
  return { version: file.version, source: file.source, lines, stations, turntables };
}

/** Where a car stops for a stop, travelling in `dir` (crossing stations: on the near side). */
export const stopPos = (stop: CableStop, dir: 1 | -1) => stop.at - dir * stop.near;

// ---------------------------------------------------------------------------
// Loading (browser) and the shared instance
// ---------------------------------------------------------------------------

let DATA: TransitData | null = null;
/** the published F-line entry: city mode builds the Castro line from it (data/fline.ts, in the lazy transit layer) */
let FLINE_JSON: TransitLineJson | null = null;
/** the wave-4 lines (null until loadTransit resolves, or with a file that has none) */
let W4: TransitW4 | null = null;
let loading: Promise<TransitData | null> | null = null;
const listeners = new Set<(d: TransitData) => void>();

/** The loaded transit data (null until loadTransit resolves, or in district mode). */
export function transitData(): TransitData | null { return DATA; }

/** The published 'f-line' route (null until loadTransit resolves). */
export function flineJson(): TransitLineJson | null { return FLINE_JSON; }

/** The published wave-4 lines (the loop, N, M) and their stop props; null until loadTransit resolves. */
export function transitW4(): TransitW4 | null { return W4; }

/** Tests / QA: install (or clear) the wave-4 lines directly (before setTransitData, whose listeners read them). */
export function setTransitW4(w: TransitW4 | null) { W4 = w; }

/** Tests / QA: install (or clear) the data directly. */
export function setTransitData(d: TransitData | null) {
  DATA = d;
  loading = d ? Promise.resolve(d) : null;
  if (d) for (const fn of listeners) fn(d);
}

/** Called once the data is available (at once if it already is). Returns the unsubscribe. */
export function onTransitData(fn: (d: TransitData) => void): () => void {
  listeners.add(fn);
  if (DATA) fn(DATA);
  return () => { listeners.delete(fn); };
}

/** Fetch current.json → manifest → transit.json (once; later calls share the promise). Resolves null on failure. */
export function loadTransit(root = '/opus-bay/sf'): Promise<TransitData | null> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const cur = (await (await fetch(`${root}/current.json`)).json()) as { version: string };
      const base = `${root}/${cur.version}`;
      const manifest = (await (await fetch(`${base}/manifest.json`)).json()) as { transit?: string };
      const res = await fetch(`${base}/${manifest.transit ?? 'transit.json'}`);
      if (!res.ok) throw new Error(`transit.json: HTTP ${res.status}`);
      const file = (await res.json()) as TransitFileJson;
      FLINE_JSON = file.lines.find(l => l.id === 'f-line') ?? null;
      W4 = buildTransitW4(file);
      const d = buildTransit(file);
      setTransitData(d);
      return d;
    } catch (error) {
      if (import.meta.env?.DEV) console.warn('[opus-bay transit]', error);
      loading = null;
      return null;
    }
  })();
  return loading;
}

export const cableLine = (id: string): CableLine | undefined => DATA?.lines.find(l => l.id === id);
export const transitStation = (id: string): TransitStation | undefined => DATA?.stations.find(s => s.id === id);

// ---------------------------------------------------------------------------
// The running cable-car system (world/transitLayer.ts installs it; game/ride.ts and game/transit.ts read it). Kept here
// so the main bundle never pulls world/transitLine.ts in (checkpoint F14 / HC-1: the city transit modules load lazily).
// ---------------------------------------------------------------------------

let ACTIVE: CableSystem | null = null;
export function setActiveCableSystem(sys: CableSystem | null) { ACTIVE = sys; }
export function activeCableSystem(): CableSystem | null { return ACTIVE; }

/** The city F-line (world/flineSystem.ts, installed by the transit layer in city mode; null in district mode). */
let STREETCAR: StreetcarSystem | null = null;
export function setActiveStreetcarSystem(sys: StreetcarSystem | null) { STREETCAR = sys; }
export function activeStreetcarSystem(): StreetcarSystem | null { return STREETCAR; }

/** What game/ride.ts needs from any running line (cable cars, the city F-line, the ferry): the waiting-rider protocol. */
export interface LineRideSystem {
  request(req: RiderRequest): RideStatus | null;
  board(): void;
  cancel(): void;
  rideStatus(): RideStatus | null;
  readonly cars: readonly { pose: { x: number; y: number; z: number; heading: number; roll: number; pitch?: number } }[];
}
let FERRY: LineRideSystem | null = null;
export function setActiveFerrySystem(sys: LineRideSystem | null) { FERRY = sys; }
export function activeFerrySystem(): LineRideSystem | null { return FERRY; }
/** City mode: the ferry layer (world/ferry.ts) waiting for life's ferry 0 to lie at Gate E; world/life.ts hands it over. */
let FERRY_PENDING: { takeOver(): void } | null = null;
export function setPendingFerry(f: { takeOver(): void } | null) { FERRY_PENDING = f; }
export function pendingFerry(): { takeOver(): void } | null { return FERRY_PENDING; }

// the ferry route table (lane F, F8) lives in data/ferry.ts
export { FERRY, FERRY_ROUTES, buildFerryLine, ferryTerminal, type FerryLine, type FerryRouteDef, type FerryTerminal } from './ferry';

/**
 * The wave-4 fleet (world/sf/lineFleet.ts `LineFleet`: the sightseeing buses and the Muni Metro trains), installed by the
 * city transit layer; null in district mode and before the lazy chunk runs. Game code reads it here, never from world/.
 */
let FLEET: LineFleet | null = null;
export function setActiveLineFleet(f: LineFleet | null) { FLEET = f; }
export function activeLineFleet(): LineFleet | null { return FLEET; }

/** The wave-4 line ids and their kinds (the published ids, pinned by the frozen sf-data test). */
export const W4_BUS_LINE = 'sf-loop';
export const W4_RAIL_LINES: readonly string[] = ['n-judah', 'm-ocean-view'];
/** 'bus' / 'light-rail' for a wave-4 line id, else null. */
export const w4Kind = (line: string): 'bus' | 'light-rail' | null => (line === W4_BUS_LINE ? 'bus' : W4_RAIL_LINES.includes(line) ? 'light-rail' : null);

/**
 * The system running ride line `line`: 'streetcar' = the city F-line, 'ferry', the loop → the fleet's buses, N / M → the
 * fleet's light rail, else a cable-car line.
 */
export function rideSystemFor(line: string): LineRideSystem | null {
  if (line === 'streetcar') return STREETCAR;
  if (line === 'ferry') return FERRY;
  const k = w4Kind(line);
  if (k) return k === 'bus' ? FLEET?.bus ?? null : FLEET?.rail ?? null;
  return ACTIVE;
}
