import { CHUNK } from '../../core/geo';
import type { StreetClass, WarpEnd } from '../../core/geo';
import { importRetry } from '../../game/importRetry';

/**
 * Binary formats of the streamed San Francisco (plan §5.2). Pure and worker-safe: no three.js, no DOM beyond
 * DecompressionStream / Blob / Response, which exist in module Web Workers and in node ≥ 18.
 *
 * Files under public/opus-bay/sf/<version>/ (the version comes from public/opus-bay/sf/current.json):
 * - `manifest.json`  SfManifest — chunk list, geo constants, palettes, enum tables, hero seam data.
 * - `c/<cx>_<cz>.obc` OBC1 chunk (gzip) — decodeChunk → ChunkData. A chunk that is not in the manifest is open water or
 *   off-model and has no content.
 * - `far.obc`        OBF1 (gzip) — decodeFar → FarData: the whole city at L2 plus names and zones. Always loaded.
 * - `graph.obc`      OBG1 (gzip) — decodeGraph → WalkGraph: the city-wide walking graph (CSR). Load lazily.
 * - `transit.json`   TransitFile; `places.json` PlacesFile.
 *
 * All binary files share one container: a 32-byte header, a section table, then the sections (little-endian).
 *   header: magic u32 | version u16 | flags u16 | cx i16 | cz i16 | nSections u16 | reserved u16 | totalBytes u32 | 12 B zero
 *   section table entry (12 B): id u16 | pad u16 | offset u32 (from file start) | len u32
 * Decoders check magic, version, totalBytes and every section's length, and throw SfFormatError on any mismatch.
 *
 * Coordinates: every *decoded* x / z is in WORLD units in the city frame (core/geo.ts projectCity), every y is world
 * height (u, ≥ 0; water level is −0.6). On disk, chunk coordinates are quantised to 1/128 u relative to the chunk
 * origin (cx·128, cz·128); far and graph coordinates to 1/8 u in world space; heights to 1/500 u, building heights to
 * 1/100 u, widths to 1/10 u, graph costs to 1/100 u (≤ 655 u per edge).
 *
 * Section encoding (see "Shared section codecs"): columnar — each per-item field is its own array — with coordinates
 * and heights as zigzag deltas from the previous point (continuing across items), and multi-byte arrays split into
 * byte planes. So gzip sees long runs of small similar bytes (≈ 3× smaller than packed structs). Readers never need to
 * know this: decode* return plain typed arrays.
 */

// ---------------------------------------------------------------------------
// Enums (code = index; the manifest repeats these tables)
// ---------------------------------------------------------------------------

export const FORMAT_VERSION = 1;
export const MAGIC = { chunk: 0x3143424f /* 'OBC1' */, far: 0x3146424f /* 'OBF1' */, graph: 0x3147424f /* 'OBG1' */ } as const;
export const HEADER_BYTES = 32;

/** Road classes: `STREET_ROW[class]` (core/geo) is the right-of-way. 'tram' = street-running rail (F-line, cable car, Muni), 'rail' = heavy rail at grade. */
export const ROAD_CLASSES = [
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service',
  'pedestrian', 'footway', 'path', 'cycleway', 'steps', 'track', 'tram', 'rail',
] as const;
export type RoadClass = (typeof ROAD_CLASSES)[number];
/** exhaustive check that every StreetClass has a road code */
export const STREET_CLASS_CODE: Readonly<Record<StreetClass, number>> = {
  motorway: 0, trunk: 1, primary: 2, secondary: 3, tertiary: 4, residential: 5, service: 6,
  pedestrian: 7, footway: 8, path: 9, cycleway: 10, steps: 11, track: 12,
};
export const ROAD_FLAG = {
  /** OSM bridge=* (deck; y follows the deck, not the ground) */
  bridge: 1,
  /** tunnel (never written to chunks; reserved) */
  tunnel: 2,
  /** stairs surface */
  steps: 4,
  oneway: 8,
  /** carries street-running rails (class 'tram' entries, or a road with tracks) */
  rail: 16,
  /** cable-car track (with 'tram') */
  cable: 32,
  /** visual-only elevated deck on pillars (freeway viaducts): not walkable, never flattened into the ground */
  deckOnly: 64,
  /** at-grade but fenced (freeways): not walkable, drawn as a strip */
  noWalk: 128,
} as const;

/** Area classes, painted in file order (land first). A ring with AREA_FLAG.hole cuts the preceding outer ring of the same class. */
export const AREA_CLASSES = ['land', 'water', 'park', 'grass', 'forest', 'sand', 'pier', 'plaza', 'parking', 'golf', 'pitch', 'scrub', 'rock'] as const;
export type AreaClass = (typeof AREA_CLASSES)[number];
export const AREA_FLAG = {
  hole: 1,
  /** walkable deck (piers): y = the deck, not the ground */
  deck: 2,
} as const;

/** Prop kinds (S5). variant: tree 0 round / 1 tall / 2 small, pine 0 cypress / 1 pine; others 0. */
export const PROP_KINDS = ['tree', 'pine', 'palm', 'lamp', 'bench', 'bike-rack', 'stop'] as const;
export type PropKindSf = (typeof PROP_KINDS)[number];

/** Building style families (§2.3). Hint for recipes: victorian→victorian, edwardian/sunset/marina→residential,
 *  chinatown→shop, brick/industrial/pier→warehouse, deco/civic→deco, office→office, tower→tower. */
export const STYLES = ['victorian', 'edwardian', 'sunset', 'marina', 'chinatown', 'brick', 'deco', 'office', 'tower', 'industrial', 'civic', 'pier', 'residential'] as const;
export type SfStyle = (typeof STYLES)[number];
export const ROOFS = ['flat', 'gable', 'hip'] as const;
export type SfRoof = (typeof ROOFS)[number];
export const BUILDING_FLAG = {
  /** bits 0–1: height source 0 = OSM height, 1 = DataSF LiDAR 2010, 2 = building:levels × 3.2 m, 3 = default 6.6 m */
  heightSourceMask: 3,
  /** merged from ≥ 2 OSM footprints along a block face */
  merged: 4,
  /** osmId is a relation id (else a way id) */
  relation: 8,
  /** stands on a pier deck */
  onPier: 16,
  /** the OSM feature of a landmarks.json landmark: a hand-made landmark may replace it */
  landmark: 32,
  /** real height ≥ 60 m */
  tall: 64,
  /** in a city-owned block that straddles the hero slab (drawn in city mode next to hero lots) */
  seam: 128,
  /** a street corridor was carved out of the footprint */
  carved: 256,
} as const;

export const CHUNK_FLAG = { land: 1, shore: 2, water: 4, hero: 8 } as const;
export const GRAPH_EDGE = ['street', 'steps', 'path', 'pedestrian', 'service'] as const;
export const GRAPH_NODE_FLAG = { hero: 1, junction: 2 } as const;

/** Section ids */
export const SECTION = {
  // chunk
  dem: 1, buildings: 2, roads: 3, areas: 4, props: 5, places: 6,
  // far
  farDem: 11, prisms: 12, farAreas: 13, lines: 14, zones: 15, names: 16, landmarks: 17, zoneGrid: 18,
  // graph
  nodes: 21, offsets: 22, targets: 23, cost: 24, edgeKind: 25, nodeFlags: 26,
} as const;

/** chunk DEM: 65 × 65 samples, 2 u apart, sample (i, j) at (cx·128 + 2i, cz·128 + 2j); shared edges equal the neighbours' */
export const DEM_N = 65;
export const DEM_STEP = CHUNK / (DEM_N - 1);
const XZ_Q = 128; // chunk-local 1/128 u
const FAR_Q = 8; // far world 1/8 u
const Y_Q = 500;
const H_Q = 100;
const W_Q = 10;
const COST_Q = 100;

export class SfFormatError extends Error {
  constructor(message: string) { super(message); this.name = 'SfFormatError'; }
}

// ---------------------------------------------------------------------------
// Decoded structures (all coordinates world units, city frame)
// ---------------------------------------------------------------------------

/** Regular height grid; y[j·cols + i] is the height at (originX + i·step, originZ + j·step). */
export interface DemGrid {
  originX: number;
  originZ: number;
  step: number;
  cols: number;
  rows: number;
  y: Float32Array;
}

/** Struct-of-arrays building list. Building i owns vertices vStart[i] … vStart[i+1]−1 of xz (x, z pairs, CCW from above). */
export interface BuildingSet {
  count: number;
  /** STYLES code */
  style: Uint8Array;
  /** ROOFS code */
  roof: Uint8Array;
  /** index into SfManifest.palettes */
  palette: Uint8Array;
  /** BUILDING_FLAG bits */
  flags: Uint16Array;
  /** toy wall height (u) above baseY (core/geo buildingH); walls start WALL_SINK below baseY */
  height: Float32Array;
  /** world y of the lowest ground under the footprint (u) */
  baseY: Float32Array;
  /** OSM way id (relation id when flags & relation) of the largest merged part */
  osmId: Uint32Array;
  vStart: Uint32Array;
  /** footprint vertices, world x, z pairs, 3–12 per building */
  xz: Float32Array;
}

/** Polylines with per-vertex centreline height. Road i owns points pStart[i] … pStart[i+1]−1 of xyz (x, y, z triples). */
export interface RoadSet {
  count: number;
  /** ROAD_CLASSES code */
  cls: Uint8Array;
  /** right-of-way (u) */
  width: Float32Array;
  /** index into FarData.names (street name), NO_NAME if unnamed */
  nameIdx: Uint16Array;
  /** ROAD_FLAG bits */
  flags: Uint8Array;
  pStart: Uint32Array;
  /** world x, centreline y (ground-flattened, or the deck for bridge/deckOnly), world z */
  xyz: Float32Array;
}
export const NO_NAME = 0xffff;

/** Polygons (rings). Ring i owns points pStart[i] … pStart[i+1]−1 of xz. */
export interface AreaSet {
  count: number;
  /** AREA_CLASSES code */
  cls: Uint8Array;
  /** AREA_FLAG bits */
  flags: Uint8Array;
  pStart: Uint32Array;
  xz: Float32Array;
}

export interface PropSet {
  count: number;
  /** PROP_KINDS code */
  kind: Uint8Array;
  variant: Uint8Array;
  /** world x, z pairs; y = ground (heightAt) */
  xz: Float32Array;
  /** heading (three.js rotation.y, radians, quantised to 256 steps) */
  rot: Float32Array;
}

/** References from a chunk to places.json entries whose anchor lies in the chunk. */
export interface PlaceRefSet {
  count: number;
  /** index into PlacesFile.places */
  place: Uint16Array;
  /** anchor world x, z pairs */
  xz: Float32Array;
}

export interface ChunkData {
  cx: number;
  cz: number;
  /** CHUNK_FLAG bits */
  flags: number;
  /** 65 × 65 at 2 u, origin (cx·128, cz·128) */
  dem: DemGrid;
  buildings: BuildingSet;
  roads: RoadSet;
  areas: AreaSet;
  props: PropSet;
  places: PlaceRefSet;
}

/** Far-city prisms: one per street block (median height, averaged colours) plus one per tower (≥ 60 m real). */
export interface PrismSet {
  count: number;
  /** 0 = block, 1 = tower */
  kind: Uint8Array;
  /** ROOFS code (dominant) */
  roof: Uint8Array;
  /** wall tint sRGB bytes (3 per prism) */
  wallRgb: Uint8Array;
  /** roof tint sRGB bytes (3 per prism) */
  roofRgb: Uint8Array;
  height: Float32Array;
  baseY: Float32Array;
  vStart: Uint32Array;
  xz: Float32Array;
}

export interface SfZone {
  /** stable id (kebab-case of the DataSF `nhood`) */
  id: string;
  zh: string;
  en: string;
  rings: { hole: boolean; xz: Float32Array }[];
}

export interface LandmarkProxy {
  /** landmarks.json id */
  id: string;
  x: number;
  z: number;
  /** ground y under it */
  baseY: number;
  /** toy height (u) of the structure above baseY (0 for hills / areas) */
  height: number;
  /** footprint radius (u) */
  radius: number;
}

export interface FarData {
  /** 16 u DEM over the city bbox */
  dem: DemGrid;
  prisms: PrismSet;
  /** land, water, park, forest, sand, golf (world) */
  areas: AreaSet;
  /** motorway … tertiary and tram centrelines (world), for L2 and the map */
  lines: RoadSet;
  zones: SfZone[];
  /** strings table: street names referenced by RoadSet.nameIdx */
  names: string[];
  landmarks: LandmarkProxy[];
  /** zone lookup raster: idx[j·cols + i] = zone index + 1 (0 = none) at cell centre (originX + (i + .5)·step, …) */
  zoneGrid: { originX: number; originZ: number; step: number; cols: number; rows: number; idx: Uint8Array };
}

/** Walking graph in CSR form. Node i's out-edges are targets[offsets[i] … offsets[i+1]−1]. Both directions are stored. */
export interface WalkGraph {
  nodeCount: number;
  edgeCount: number;
  /** world x, y, z per node */
  xyz: Float32Array;
  /** GRAPH_NODE_FLAG bits */
  nodeFlags: Uint8Array;
  offsets: Uint32Array;
  targets: Uint32Array;
  /** edge cost (u): length × (1 + 2·max(0, |grade| − 0.25)) × (1.3 on steps); quantised to 0.01 */
  cost: Float32Array;
  /** GRAPH_EDGE code */
  kind: Uint8Array;
}

// ---------------------------------------------------------------------------
// JSON files
// ---------------------------------------------------------------------------

export interface SfCurrent { version: string }

export interface SfManifestChunk {
  /** chunkKey "cx_cz" → c/<k>.obc */
  k: string;
  cx: number;
  cz: number;
  /** gzip bytes on disk / raw bytes */
  bytes: number;
  raw: number;
  sha256: string;
  land: boolean;
  shore: boolean;
  water: boolean;
  /** intersects the hero slab */
  hero: boolean;
  buildings: number;
  roads: number;
}

export interface SfPalette {
  /** STYLES family this entry belongs to */
  family: SfStyle;
  /** wall, trim and roof colours (sRGB hex) */
  wall: string;
  trim: string;
  roof: string;
}

export interface SfManifest {
  format: 'opus-sf';
  formatVersion: number;
  version: string;
  built: string;
  osmBase: string;
  geo: {
    K: number; ROT_DEG: number; LAT0: number; LNG0: number;
    curve: { datum: number; a: number; knee: number; s: number };
    buildingH: { min: number; a: number; b: number };
    warp: { ends: WarpEnd[]; along: number; inside: number; in0: number; in1: number };
  };
  chunk: number;
  cell: number;
  /** world bbox covered by the data (u) */
  bbox: { minX: number; minZ: number; maxX: number; maxZ: number };
  chunks: SfManifestChunk[];
  /** max distance (u) a chunk's buildings / roads reach beyond its own square: look this far into neighbours */
  maxOverhang: number;
  /** hash of the hero district this build was cut against (computeDistrictHash); mismatch → rebuild */
  districtHash: string;
  /** indices into DISTRICT.blocks of hero lots whose centroid lies in a city-owned block: hide them in city mode */
  heroDropLots: number[];
  far: { file: string; bytes: number; raw: number; sha256: string };
  graph: { file: string; bytes: number; raw: number; sha256: string; nodes: number; edges: number };
  transit: string;
  places: string;
  palettes: SfPalette[];
  enums: { styles: readonly string[]; roofs: readonly string[]; roadClasses: readonly string[]; areaClasses: readonly string[]; propKinds: readonly string[]; graphEdges: readonly string[] };
  counts: Record<string, number>;
  attribution: string[];
}

export interface TransitStop {
  id: string;
  /** wave 4: for Metro stops the English sign name stays primary and zh carries the gloss (data/sf/stationNames.ts) */
  name: { zh: string; en: string };
  /** arc length along TransitLine.path (u) */
  at: number;
  x: number;
  z: number;
  osmId: number | null;
  /** wave 4: a major stop (transfers, ★ attraction stops, termini): light rail dwells here; minor stops on request */
  major?: boolean;
  /** wave 4: attraction ids this stop serves on foot (data/sf/attractionTypes.ts), the main one first */
  attractions?: string[];
}

/** Line kinds in transit.json (wave 4 adds the sightseeing loop 'bus' and the Muni Metro 'light-rail'). */
export const TRANSIT_LINE_KINDS = ['cable-car', 'streetcar', 'bus', 'light-rail'] as const;
export type TransitLineKind = (typeof TRANSIT_LINE_KINDS)[number];

/** A tunnel mouth: where the track goes underground / comes back up (world city frame; y = surface height there). */
export interface TransitPortal { x: number; y: number; z: number; name?: { zh: string; en: string } }

/**
 * Wave 4: an underground span of a line, [fromAt, toAt] in arc length along `path` (no tunnel geometry is built: the
 * ride runs under the subway overlay there). `portalA` is the mouth at fromAt, `portalB` at toAt; null = the span
 * starts / ends underground at the line's own end (the N and M start underground at Embarcadero). `stations` = ids of
 * the line's stops inside the span, in arc order (boarded at their street kiosks).
 */
export interface TransitTunnel {
  fromAt: number;
  toAt: number;
  portalA: TransitPortal | null;
  portalB: TransitPortal | null;
  stations: string[];
  name?: { zh: string; en: string };
}

export interface TransitLine {
  id: string;
  kind: TransitLineKind;
  name: { zh: string; en: string };
  /** wave 4: the letter / short name on discs, headsigns and the map ('N', 'M', '观光'); ≤ 4 characters */
  short?: string;
  /**
   * wave 4: a one-way loop (the sightseeing bus): the path ends where it starts (≤ 2 u) so `length` is the full lap and
   * arc positions wrap modulo `length`; never doubleEnded
   */
  loop?: boolean;
  /** wave 4: underground spans in arc order, non-overlapping (Metro lines) */
  tunnels?: TransitTunnel[];
  /**
   * wave 4 (lane T's request): cruise-speed spans `[fromAt, toAt, speed u/s]` along `path`, in arc order and not
   * overlapping (the sightseeing loop bakes contiguous spans over the whole lap: 12 / 11 / 9 u/s by street); arc
   * positions outside every span use the line system's default cruise. world/lineTrack.ts reads them.
   */
  speeds?: [number, number, number][];
  /** OSM route relation used (sourceUrl = https://www.openstreetmap.org/relation/<id>) */
  osmRelation: number;
  sourceUrl: string;
  color: string;
  /** track centreline, world [x, y, z] triples (y = terrain / flattened street height), ordered start → end */
  path: number[];
  /** total arc length (u) */
  length: number;
  stops: TransitStop[];
  /** turntables along the line (cable cars) */
  turntables: { x: number; z: number; osmId: number | null; name: string }[];
  /** double-ended cars that reverse instead of turning (California line) */
  doubleEnded: boolean;
  /** [startAt, endAt] arc-length spans of the path inside the hero slab (splice with DISTRICT.streetcar there) */
  heroSpans: [number, number][];
}
export interface TransitFile { version: string; source: string; lines: TransitLine[] }

/** Wave 4: the tunnel span containing arc position `at` (loops wrap modulo length), or null on the surface. */
export function tunnelAt(line: Pick<TransitLine, 'length' | 'loop' | 'tunnels'>, at: number): TransitTunnel | null {
  if (!line.tunnels?.length) return null;
  const s = line.loop && line.length > 0 ? ((at % line.length) + line.length) % line.length : at;
  for (const t of line.tunnels) if (s >= t.fromAt && s <= t.toAt) return t;
  return null;
}

/**
 * Wave 4: structural problems of one transit.json line (empty = valid). Pure; the frozen sf-data / sf-format tests and
 * lane T's sidecar use it. Checks: known kind, path triples, stops in arc order inside [0, length], `short` 1–4
 * characters, a loop closes on itself (≤ 2 u) and is not double-ended, tunnel spans ordered / non-overlapping / inside
 * the path with a null portal only at the line's own end, and every tunnel station a stop of the line inside its span;
 * speed spans (`speeds`) ordered / non-overlapping / inside the path with a finite speed > 0.
 */
export function transitLineProblems(l: TransitLine): string[] {
  const out: string[] = [];
  const bad = (m: string) => out.push(`${l.id}: ${m}`);
  if (!(TRANSIT_LINE_KINDS as readonly string[]).includes(l.kind)) bad(`unknown kind ${String(l.kind)}`);
  if (l.path.length < 6 || l.path.length % 3) bad(`path has ${l.path.length} numbers (xyz triples, ≥ 2 points)`);
  if (!l.path.every(Number.isFinite)) bad('path has a non-finite number');
  if (!(l.length > 0)) bad(`length ${l.length}`);
  const tol = 0.5;
  for (let i = 0; i < l.stops.length; i++) {
    const s = l.stops[i];
    if (!(s.at >= -tol && s.at <= l.length + tol)) bad(`stop ${s.id} at ${s.at} outside [0, ${l.length}]`);
    if (i > 0 && s.at < l.stops[i - 1].at) bad(`stop ${s.id} before ${l.stops[i - 1].id}`);
    if (!s.name?.en || !s.name?.zh) bad(`stop ${s.id} needs zh + en names`);
  }
  if (new Set(l.stops.map(s => s.id)).size !== l.stops.length) bad('duplicate stop ids');
  if (l.short !== undefined && !(l.short.length >= 1 && l.short.length <= 4)) bad(`short "${l.short}" must be 1–4 characters`);
  if (l.loop) {
    if (l.doubleEnded) bad('a loop is never double-ended');
    const n = l.path.length;
    if (n >= 6 && Math.hypot(l.path[n - 3] - l.path[0], l.path[n - 1] - l.path[2]) > 2) bad('a loop path must end where it starts (≤ 2 u)');
  }
  const stopAt = new Map(l.stops.map(s => [s.id, s.at]));
  let prevTo = -Infinity;
  for (const t of l.tunnels ?? []) {
    const what = `tunnel [${t.fromAt}, ${t.toAt}]`;
    if (!(t.fromAt < t.toAt)) bad(`${what}: fromAt must be < toAt`);
    if (t.fromAt < -tol || t.toAt > l.length + tol) bad(`${what}: outside [0, ${l.length}]`);
    if (t.fromAt < prevTo) bad(`${what}: overlaps or precedes the previous span`);
    prevTo = t.toAt;
    if (t.portalA === null && t.fromAt > tol) bad(`${what}: portalA may be null only when the span starts at the line start`);
    if (t.portalB === null && t.toAt < l.length - tol) bad(`${what}: portalB may be null only when the span ends at the line end`);
    for (const p of [t.portalA, t.portalB]) if (p && !Number.isFinite(p.x + p.y + p.z)) bad(`${what}: portal position`);
    let prevAt = -Infinity;
    for (const id of t.stations) {
      const at = stopAt.get(id);
      if (at === undefined) { bad(`${what}: station ${id} is not a stop of the line`); continue; }
      if (at < t.fromAt - 1 || at > t.toAt + 1) bad(`${what}: station ${id} (at ${at}) outside the span`);
      if (at < prevAt) bad(`${what}: stations out of arc order at ${id}`);
      prevAt = at;
    }
  }
  let prevSpeedTo = -Infinity;
  for (const sp of l.speeds ?? []) {
    const [a, b, v] = Array.isArray(sp) ? sp : [NaN, NaN, NaN];
    const what = `speed span [${a}, ${b}]`;
    if (!Array.isArray(sp) || sp.length !== 3 || !Number.isFinite(a + b + v)) { bad(`${what}: not [fromAt, toAt, speed] numbers`); continue; }
    if (!(a < b)) bad(`${what}: fromAt must be < toAt`);
    if (a < -tol || b > l.length + tol) bad(`${what}: outside [0, ${l.length}]`);
    if (a < prevSpeedTo - 0.05) bad(`${what}: overlaps or precedes the previous span`);
    if (!(v > 0)) bad(`${what}: speed ${v} must be > 0`);
    prevSpeedTo = b;
  }
  return out;
}

/**
 * Wave 4 place kinds (plan §3.7: campus, shopping mall, zoo, church / temple / cathedral). Part of `SfPlaceKind` since
 * the wave-4 integration phase (lead note §6 item 2; data/sf/cityPois.ts `PLACE_KIND_NAMES` names them in the same
 * commit: 校园 · 购物中心 · 动物园 · 宗教场所).
 */
export const SF_PLACE_KINDS_W4 = ['campus', 'shopping', 'zoo', 'religious'] as const;
export type SfPlaceKindW4 = (typeof SF_PLACE_KINDS_W4)[number];
export type SfPlaceKind =
  | 'landmark' | 'bridge' | 'island' | 'skyscraper' | 'park' | 'museum' | 'waterfront' | 'transit' | 'street' | 'plaza'
  | 'civic' | 'stadium' | 'historic' | 'neighbourhood' | 'garden' | 'beach' | 'trail' | 'hill' | 'tower' | 'water'
  | 'attraction' | 'viewpoint' | 'peak'
  | SfPlaceKindW4;
/** The early-phase alias for wave-4 code (the same type as `SfPlaceKind` since the integration; kept so it compiles). */
export type SfPlaceKindAll = SfPlaceKind;

export interface SfPlace {
  id: string;
  name: { zh: string; en: string };
  kind: SfPlaceKind;
  /** anchor, world city frame */
  x: number;
  z: number;
  /** ground y at the anchor */
  y: number;
  /** SfZone id (DataSF neighbourhood) or null */
  zone: string | null;
  osmType: 'node' | 'way' | 'relation' | null;
  osmId: number | null;
  /** where the name/position fact comes from */
  sourceUrl: string;
  verifiedAt: string;
  /** landmarks.json entry (curated) vs. a named OSM POI */
  curated: boolean;
  /** nearest walking-graph node (largest component), −1 if none within 60 u */
  graphNode: number;
  /** BAYLINK planner place id, only when it exists in public/planner-catalog.json */
  plannerId?: string;
  /** BAYLINK guide slug from the planner catalog entry */
  guideSlug?: string;
  /** anchor lies inside the hand-made hero slab (its own content already covers it; map / merge, don't duplicate) */
  hero?: boolean;
}
export interface PlacesFile { version: string; verifiedAt: string; places: SfPlace[] }

// ---------------------------------------------------------------------------
// Byte IO
// ---------------------------------------------------------------------------

class Writer {
  private buf = new ArrayBuffer(1 << 16);
  private dv = new DataView(this.buf);
  private u8 = new Uint8Array(this.buf);
  pos = 0;
  private need(n: number) {
    if (this.pos + n <= this.buf.byteLength) return;
    let size = this.buf.byteLength * 2;
    while (size < this.pos + n) size *= 2;
    const next = new ArrayBuffer(size);
    new Uint8Array(next).set(this.u8);
    this.buf = next; this.dv = new DataView(next); this.u8 = new Uint8Array(next);
  }
  u8v(v: number) { this.need(1); this.dv.setUint8(this.pos, v); this.pos += 1; }
  u16(v: number) { this.need(2); this.dv.setUint16(this.pos, v, true); this.pos += 2; }
  i16(v: number) { this.need(2); this.dv.setInt16(this.pos, v, true); this.pos += 2; }
  u32(v: number) { this.need(4); this.dv.setUint32(this.pos, v, true); this.pos += 4; }
  f32(v: number) { this.need(4); this.dv.setFloat32(this.pos, v, true); this.pos += 4; }
  bytes(b: Uint8Array) { this.need(b.length); this.u8.set(b, this.pos); this.pos += b.length; }
  setU32(at: number, v: number) { this.dv.setUint32(at, v, true); }
  done() { return this.u8.slice(0, this.pos); }
}

class Reader {
  private dv: DataView;
  private b: Uint8Array;
  private what: string;
  pos: number;
  readonly end: number;
  constructor(b: Uint8Array, start: number, len: number, what: string) {
    if (start + len > b.byteLength) throw new SfFormatError(`${what}: section runs past the end`);
    this.b = b; this.what = what;
    this.dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    this.pos = start; this.end = start + len;
  }
  private need(n: number) { if (this.pos + n > this.end) throw new SfFormatError(`${this.what}: truncated at ${this.pos}`); }
  u8() { this.need(1); return this.dv.getUint8(this.pos++); }
  u16() { this.need(2); const v = this.dv.getUint16(this.pos, true); this.pos += 2; return v; }
  i16() { this.need(2); const v = this.dv.getInt16(this.pos, true); this.pos += 2; return v; }
  u32() { this.need(4); const v = this.dv.getUint32(this.pos, true); this.pos += 4; return v; }
  f32() { this.need(4); const v = this.dv.getFloat32(this.pos, true); this.pos += 4; return v; }
  bytes(n: number) { this.need(n); const v = this.b.subarray(this.pos, this.pos + n); this.pos += n; return v; }
  finish() { if (this.pos !== this.end) throw new SfFormatError(`${this.what}: ${this.end - this.pos} unread bytes (length mismatch)`); }
}

const qi16 = (v: number, what: string) => {
  const q = Math.round(v);
  if (q < -32768 || q > 32767 || !Number.isFinite(q)) throw new SfFormatError(`${what}: ${v} out of i16 range`);
  return q;
};
const qu16 = (v: number, what: string) => {
  const q = Math.round(v);
  if (q < 0 || q > 65535 || !Number.isFinite(q)) throw new SfFormatError(`${what}: ${v} out of u16 range`);
  return q;
};
const ROT_Q = 256 / (Math.PI * 2);
const encRot = (r: number) => ((Math.round(r * ROT_Q) % 256) + 256) % 256;
const decRot = (q: number) => { const r = q / ROT_Q; return r > Math.PI ? r - Math.PI * 2 : r; };

function writeContainer(magic: number, flags: number, cx: number, cz: number, sections: [number, Uint8Array][]): Uint8Array {
  const w = new Writer();
  w.u32(magic); w.u16(FORMAT_VERSION); w.u16(flags); w.i16(cx); w.i16(cz); w.u16(sections.length); w.u16(0);
  w.u32(0); // totalBytes, patched below
  while (w.pos < HEADER_BYTES) w.u8v(0);
  let offset = HEADER_BYTES + sections.length * 12;
  for (const [id, data] of sections) {
    w.u16(id); w.u16(0); w.u32(offset); w.u32(data.length);
    offset += data.length + ((4 - (data.length % 4)) % 4);
  }
  for (const [, data] of sections) { w.bytes(data); while (w.pos % 4) w.u8v(0); }
  w.setU32(16, w.pos);
  return w.done();
}

interface Container { flags: number; cx: number; cz: number; sections: Map<number, { offset: number; len: number }> }

function readContainer(b: Uint8Array, magic: number, what: string): Container {
  if (b.byteLength < HEADER_BYTES) throw new SfFormatError(`${what}: ${b.byteLength} bytes is shorter than the header`);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const m = dv.getUint32(0, true);
  if (m !== magic) throw new SfFormatError(`${what}: bad magic 0x${m.toString(16)}`);
  const version = dv.getUint16(4, true);
  if (version !== FORMAT_VERSION) throw new SfFormatError(`${what}: version mismatch (file ${version}, reader ${FORMAT_VERSION})`);
  const total = dv.getUint32(16, true);
  if (total !== b.byteLength) throw new SfFormatError(`${what}: byte length mismatch (header ${total}, got ${b.byteLength})`);
  const n = dv.getUint16(12, true);
  const sections = new Map<number, { offset: number; len: number }>();
  for (let i = 0; i < n; i++) {
    const at = HEADER_BYTES + i * 12;
    if (at + 12 > b.byteLength) throw new SfFormatError(`${what}: section table truncated`);
    const id = dv.getUint16(at, true), offset = dv.getUint32(at + 4, true), len = dv.getUint32(at + 8, true);
    if (offset + len > b.byteLength) throw new SfFormatError(`${what}: section ${id} runs past the end`);
    sections.set(id, { offset, len });
  }
  return { flags: dv.getUint16(6, true), cx: dv.getInt16(8, true), cz: dv.getInt16(10, true), sections };
}

function sectionReader(b: Uint8Array, c: Container, id: number, what: string): Reader | null {
  const s = c.sections.get(id);
  return s ? new Reader(b, s.offset, s.len, `${what} section ${id}`) : null;
}

// ---------------------------------------------------------------------------
// Shared section codecs. Bulk data is columnar: each per-item field is its own array; coordinates are quantised
// integers stored as zigzag deltas from the previous point (every ring / polyline continues from the previous one's
// last point); multi-byte values are split into byte planes (all low bytes, then all high bytes). gzip then sees long
// runs of small, similar bytes. Every stream is length-checked on read.
// ---------------------------------------------------------------------------

type Quant = { ox: number; oz: number; q: number; big: boolean };
/** plain i16 point (small tables: zones, landmark proxies) */
const writeXZ = (w: Writer, x: number, z: number, t: Quant, what: string) => { w.i16(qi16((x - t.ox) * t.q, what)); w.i16(qi16((z - t.oz) * t.q, what)); };
const readXZ = (r: Reader, out: Float32Array, i: number, t: Quant) => { out[i] = t.ox + r.i16() / t.q; out[i + 1] = t.oz + r.i16() / t.q; };
const zz =(v: number) => ((v << 1) ^ (v >> 31)) >>> 0;
const unzz = (u: number) => (u >>> 1) ^ -(u & 1);

function put8(w: Writer, vals: ArrayLike<number>) { for (let i = 0; i < vals.length; i++) w.u8v(vals[i]); }
function get8(r: Reader, n: number): Uint8Array { return r.bytes(n).slice(); }
function put16(w: Writer, vals: ArrayLike<number>, what: string) {
  for (let i = 0; i < vals.length; i++) { const v = vals[i]; if (!(v >= 0 && v <= 65535 && Number.isInteger(v))) throw new SfFormatError(`${what}: ${v} out of u16 range`); }
  for (let i = 0; i < vals.length; i++) w.u8v(vals[i] & 255);
  for (let i = 0; i < vals.length; i++) w.u8v(vals[i] >>> 8);
}
function get16(r: Reader, n: number): Uint16Array {
  const lo = r.bytes(n), hi = r.bytes(n), out = new Uint16Array(n);
  for (let i = 0; i < n; i++) out[i] = lo[i] | (hi[i] << 8);
  return out;
}
function put32(w: Writer, vals: ArrayLike<number>) {
  for (let b = 0; b < 4; b++) for (let i = 0; i < vals.length; i++) w.u8v((vals[i] >>> (b * 8)) & 255);
}
function get32(r: Reader, n: number): Uint32Array {
  const planes = [r.bytes(n), r.bytes(n), r.bytes(n), r.bytes(n)], out = new Uint32Array(n);
  for (let i = 0; i < n; i++) out[i] = (planes[0][i] | (planes[1][i] << 8) | (planes[2][i] << 16) | (planes[3][i] << 24)) >>> 0;
  return out;
}
const quant = (v: number, q: number, what: string) => {
  const r = Math.round(v * q);
  if (!Number.isFinite(r) || Math.abs(r) > 1 << 24) throw new SfFormatError(`${what}: ${v} out of range`);
  return r;
};

/** x, z pairs (stride 2) or x, y, z triples (stride 3; y handled by putHeights) as zigzag-delta u16 planes. */
function putPoints(w: Writer, p: ArrayLike<number>, stride: 2 | 3, t: Quant, what: string) {
  const n = p.length / stride, dx = new Array<number>(n), dz = new Array<number>(n);
  let px = 0, pz = 0;
  for (let i = 0; i < n; i++) {
    const qx = quant(p[i * stride] - t.ox, t.q, what), qz = quant(p[i * stride + stride - 1] - t.oz, t.q, what);
    dx[i] = zz(qx - px); dz[i] = zz(qz - pz); px = qx; pz = qz;
  }
  put16(w, dx, `${what} x delta`); put16(w, dz, `${what} z delta`);
}
function getPoints(r: Reader, n: number, t: Quant, out: Float32Array, stride: 2 | 3) {
  const dx = get16(r, n), dz = get16(r, n);
  let qx = 0, qz = 0;
  for (let i = 0; i < n; i++) {
    qx += unzz(dx[i]); qz += unzz(dz[i]);
    out[i * stride] = t.ox + qx / t.q; out[i * stride + stride - 1] = t.oz + qz / t.q;
  }
}
/** heights (y ≥ 0, 1/500 u) as zigzag-delta u16 planes */
function putHeights(w: Writer, ys: ArrayLike<number>, stride: number, offset: number, what: string) {
  const n = ys.length / stride, d = new Array<number>(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const q = Math.round(ys[i * stride + offset] * Y_Q);
    if (!(q >= 0 && q <= 65535)) throw new SfFormatError(`${what}: y ${ys[i * stride + offset]} out of range`);
    d[i] = zz(q - prev); prev = q;
  }
  put16(w, d, `${what} y delta`);
}
function getHeights(r: Reader, n: number, out: Float32Array, stride: number, offset: number) {
  const d = get16(r, n);
  let q = 0;
  for (let i = 0; i < n; i++) { q += unzz(d[i]); out[i * stride + offset] = q / Y_Q; }
}
const countsFrom = (start: Uint32Array, n: number) => { const c = new Array<number>(n); for (let i = 0; i < n; i++) c[i] = start[i + 1] - start[i]; return c; };
function startsFrom(counts: ArrayLike<number>): Uint32Array {
  const s = new Uint32Array(counts.length + 1);
  for (let i = 0; i < counts.length; i++) s[i + 1] = s[i] + counts[i];
  return s;
}

/** DEM: row-major u16 (y·500) as zigzag deltas along each row (row starts from the previous row's start). */
function encodeDem(d: DemGrid, withHeader: boolean): Uint8Array {
  const w = new Writer();
  if (withHeader) { w.f32(d.originX); w.f32(d.originZ); w.f32(d.step); w.u16(d.cols); w.u16(d.rows); }
  const n = d.cols * d.rows, out = new Array<number>(n);
  let rowStart = 0;
  for (let j = 0; j < d.rows; j++) {
    let prev = rowStart;
    for (let i = 0; i < d.cols; i++) {
      const q = qu16(d.y[j * d.cols + i] * Y_Q, 'dem y');
      out[j * d.cols + i] = zz(q - prev);
      prev = q;
      if (i === 0) rowStart = q;
    }
  }
  put16(w, out, 'dem delta');
  return w.done();
}
function decodeDem(r: Reader, fixed: Omit<DemGrid, 'y'> | null): DemGrid {
  const g = fixed ?? { originX: r.f32(), originZ: r.f32(), step: r.f32(), cols: r.u16(), rows: r.u16() };
  const d = get16(r, g.cols * g.rows), y = new Float32Array(g.cols * g.rows);
  let rowStart = 0;
  for (let j = 0; j < g.rows; j++) {
    let q = rowStart;
    for (let i = 0; i < g.cols; i++) { q += unzz(d[j * g.cols + i]); y[j * g.cols + i] = q / Y_Q; if (i === 0) rowStart = q; }
  }
  r.finish();
  return { ...g, y };
}

function encodeBuildings(s: BuildingSet, t: Quant): Uint8Array {
  const w = new Writer();
  if (s.count > 65535) throw new SfFormatError('too many buildings');
  w.u16(s.count);
  const nv = countsFrom(s.vStart, s.count);
  for (let i = 0; i < s.count; i++) if (nv[i] < 3 || nv[i] > 255) throw new SfFormatError(`building ${i}: ${nv[i]} vertices`);
  put8(w, nv); put8(w, s.style); put8(w, s.roof); put8(w, s.palette);
  put16(w, Array.from(s.height, h => qu16(h * H_Q, 'building height')), 'building height');
  put16(w, Array.from(s.baseY, y => qu16(y * Y_Q, 'building baseY')), 'building baseY');
  put16(w, s.flags, 'building flags');
  let prev = 0;
  put32(w, Array.from(s.osmId, id => { const d = (id - prev) >>> 0; prev = id; return d; }));
  putPoints(w, s.xz.subarray(0, s.vStart[s.count] * 2), 2, t, 'building');
  return w.done();
}
function decodeBuildings(r: Reader, t: Quant): BuildingSet {
  const count = r.u16();
  const nv = get8(r, count), style = get8(r, count), roof = get8(r, count), palette = get8(r, count);
  const height = Float32Array.from(get16(r, count), v => v / H_Q), baseY = Float32Array.from(get16(r, count), v => v / Y_Q), flags = get16(r, count);
  const d = get32(r, count), osmId = new Uint32Array(count);
  let prev = 0;
  for (let i = 0; i < count; i++) { prev = (prev + d[i]) >>> 0; osmId[i] = prev; }
  const vStart = startsFrom(nv);
  const xz = new Float32Array(vStart[count] * 2);
  getPoints(r, vStart[count], t, xz, 2);
  r.finish();
  return { count, style, roof, palette, flags, height, baseY, osmId, vStart, xz };
}

function encodeRoads(s: RoadSet, t: Quant): Uint8Array {
  const w = new Writer();
  if (t.big) w.u32(s.count); else { if (s.count > 65535) throw new SfFormatError('too many roads'); w.u16(s.count); }
  const np = countsFrom(s.pStart, s.count);
  for (let i = 0; i < s.count; i++) if (np[i] < 2 || np[i] > 65535) throw new SfFormatError(`road ${i}: ${np[i]} points`);
  put8(w, s.cls); put8(w, Array.from(s.width, v => Math.min(255, qu16(v * W_Q, 'road width')))); put16(w, s.nameIdx, 'road name'); put8(w, s.flags);
  put16(w, np, 'road points');
  const pts = s.xyz.subarray(0, s.pStart[s.count] * 3);
  putPoints(w, pts, 3, t, 'road');
  putHeights(w, pts, 3, 1, 'road');
  return w.done();
}
function decodeRoads(r: Reader, t: Quant): RoadSet {
  const count = t.big ? r.u32() : r.u16();
  const cls = get8(r, count), width = Float32Array.from(get8(r, count), v => v / W_Q), nameIdx = get16(r, count), flags = get8(r, count);
  const pStart = startsFrom(get16(r, count));
  const xyz = new Float32Array(pStart[count] * 3);
  getPoints(r, pStart[count], t, xyz, 3);
  getHeights(r, pStart[count], xyz, 3, 1);
  r.finish();
  return { count, cls, width, nameIdx, flags, pStart, xyz };
}

function encodeAreas(s: AreaSet, t: Quant): Uint8Array {
  const w = new Writer();
  w.u32(s.count);
  const np = countsFrom(s.pStart, s.count);
  for (let i = 0; i < s.count; i++) if (np[i] < 3) throw new SfFormatError(`area ${i}: ${np[i]} points`);
  put8(w, s.cls); put8(w, s.flags); put32(w, np);
  putPoints(w, s.xz.subarray(0, s.pStart[s.count] * 2), 2, t, 'area');
  return w.done();
}
function decodeAreas(r: Reader, t: Quant): AreaSet {
  const count = r.u32();
  const cls = get8(r, count), flags = get8(r, count), pStart = startsFrom(get32(r, count));
  const xz = new Float32Array(pStart[count] * 2);
  getPoints(r, pStart[count], t, xz, 2);
  r.finish();
  return { count, cls, flags, pStart, xz };
}

function encodeProps(s: PropSet, t: Quant): Uint8Array {
  const w = new Writer();
  if (s.count > 65535) throw new SfFormatError('too many props');
  w.u16(s.count);
  put8(w, s.kind); put8(w, s.variant); put8(w, Array.from(s.rot, encRot));
  putPoints(w, s.xz.subarray(0, s.count * 2), 2, t, 'prop');
  return w.done();
}
function decodeProps(r: Reader, t: Quant): PropSet {
  const count = r.u16();
  const kind = get8(r, count), variant = get8(r, count), rot = Float32Array.from(get8(r, count), decRot);
  const xz = new Float32Array(count * 2);
  getPoints(r, count, t, xz, 2);
  r.finish();
  return { count, kind, variant, xz, rot };
}

function encodePlaces(s: PlaceRefSet, t: Quant): Uint8Array {
  const w = new Writer();
  w.u16(s.count);
  put16(w, s.place, 'place index');
  putPoints(w, s.xz.subarray(0, s.count * 2), 2, t, 'place');
  return w.done();
}
function decodePlaces(r: Reader, t: Quant): PlaceRefSet {
  const count = r.u16();
  const place = get16(r, count), xz = new Float32Array(count * 2);
  getPoints(r, count, t, xz, 2);
  r.finish();
  return { count, place, xz };
}

// ---------------------------------------------------------------------------
// Empty sets (handy for writers and tests)
// ---------------------------------------------------------------------------

export const emptyBuildings = (): BuildingSet => ({
  count: 0, style: new Uint8Array(0), roof: new Uint8Array(0), palette: new Uint8Array(0), flags: new Uint16Array(0),
  height: new Float32Array(0), baseY: new Float32Array(0), osmId: new Uint32Array(0), vStart: new Uint32Array(1), xz: new Float32Array(0),
});
export const emptyRoads = (): RoadSet => ({
  count: 0, cls: new Uint8Array(0), width: new Float32Array(0), nameIdx: new Uint16Array(0), flags: new Uint8Array(0), pStart: new Uint32Array(1), xyz: new Float32Array(0),
});
export const emptyAreas = (): AreaSet => ({ count: 0, cls: new Uint8Array(0), flags: new Uint8Array(0), pStart: new Uint32Array(1), xz: new Float32Array(0) });
export const emptyProps = (): PropSet => ({ count: 0, kind: new Uint8Array(0), variant: new Uint8Array(0), xz: new Float32Array(0), rot: new Float32Array(0) });
export const emptyPlaces = (): PlaceRefSet => ({ count: 0, place: new Uint16Array(0), xz: new Float32Array(0) });

// ---------------------------------------------------------------------------
// OBC1 chunk
// ---------------------------------------------------------------------------

const chunkQuant = (cx: number, cz: number): Quant => ({ ox: cx * CHUNK, oz: cz * CHUNK, q: XZ_Q, big: false });

export function encodeChunk(d: ChunkData): Uint8Array {
  const t = chunkQuant(d.cx, d.cz);
  if (d.dem.cols !== DEM_N || d.dem.rows !== DEM_N) throw new SfFormatError('chunk DEM must be 65 × 65');
  return writeContainer(MAGIC.chunk, d.flags, d.cx, d.cz, [
    [SECTION.dem, encodeDem(d.dem, false)],
    [SECTION.buildings, encodeBuildings(d.buildings, t)],
    [SECTION.roads, encodeRoads(d.roads, t)],
    [SECTION.areas, encodeAreas(d.areas, t)],
    [SECTION.props, encodeProps(d.props, t)],
    [SECTION.places, encodePlaces(d.places, t)],
  ]);
}

/** Decode an OBC1 chunk (already inflated — see gunzip / decodeChunkFile). */
export function decodeChunk(bytes: Uint8Array): ChunkData {
  const what = 'OBC1';
  const c = readContainer(bytes, MAGIC.chunk, what);
  const t = chunkQuant(c.cx, c.cz);
  const demR = sectionReader(bytes, c, SECTION.dem, what);
  if (!demR) throw new SfFormatError(`${what}: no DEM section`);
  const dem = decodeDem(demR, { originX: t.ox, originZ: t.oz, step: DEM_STEP, cols: DEM_N, rows: DEM_N });
  const sec = <T>(id: number, dec: (r: Reader) => T, empty: () => T): T => { const r = sectionReader(bytes, c, id, what); return r ? dec(r) : empty(); };
  return {
    cx: c.cx, cz: c.cz, flags: c.flags, dem,
    buildings: sec(SECTION.buildings, r => decodeBuildings(r, t), emptyBuildings),
    roads: sec(SECTION.roads, r => decodeRoads(r, t), emptyRoads),
    areas: sec(SECTION.areas, r => decodeAreas(r, t), emptyAreas),
    props: sec(SECTION.props, r => decodeProps(r, t), emptyProps),
    places: sec(SECTION.places, r => decodePlaces(r, t), emptyPlaces),
  };
}

// ---------------------------------------------------------------------------
// OBF1 far city
// ---------------------------------------------------------------------------

const FAR_T: Quant = { ox: 0, oz: 0, q: FAR_Q, big: true };

function encodePrisms(s: PrismSet): Uint8Array {
  const w = new Writer();
  w.u32(s.count);
  const nv = countsFrom(s.vStart, s.count);
  for (let i = 0; i < s.count; i++) if (nv[i] < 3 || nv[i] > 255) throw new SfFormatError(`prism ${i}: ${nv[i]} vertices`);
  put8(w, nv); put8(w, s.kind); put8(w, s.roof); put8(w, s.wallRgb.subarray(0, s.count * 3)); put8(w, s.roofRgb.subarray(0, s.count * 3));
  put16(w, Array.from(s.height, h => qu16(h * H_Q, 'prism height')), 'prism height');
  put16(w, Array.from(s.baseY, y => qu16(y * Y_Q, 'prism baseY')), 'prism baseY');
  putPoints(w, s.xz.subarray(0, s.vStart[s.count] * 2), 2, FAR_T, 'prism');
  return w.done();
}
function decodePrisms(r: Reader): PrismSet {
  const count = r.u32();
  const nv = get8(r, count), kind = get8(r, count), roof = get8(r, count), wallRgb = get8(r, count * 3), roofRgb = get8(r, count * 3);
  const height = Float32Array.from(get16(r, count), v => v / H_Q), baseY = Float32Array.from(get16(r, count), v => v / Y_Q);
  const vStart = startsFrom(nv), xz = new Float32Array(vStart[count] * 2);
  getPoints(r, vStart[count], FAR_T, xz, 2);
  r.finish();
  return { count, kind, roof, wallRgb, roofRgb, height, baseY, vStart, xz };
}

const utf8 = new TextEncoder(), utf8d = new TextDecoder();
function encodeNames(names: string[]): Uint8Array {
  const w = new Writer();
  w.u32(names.length);
  for (const s of names) { const b = utf8.encode(s); w.u16(b.length); w.bytes(b); }
  return w.done();
}
function decodeNames(r: Reader): string[] {
  const n = r.u32(), out: string[] = [];
  for (let i = 0; i < n; i++) out.push(utf8d.decode(r.bytes(r.u16())));
  r.finish();
  return out;
}

/** Zones reference the names table for id / zh / en. */
function encodeZones(zones: SfZone[], nameIndex: (s: string) => number): Uint8Array {
  const w = new Writer();
  w.u16(zones.length);
  for (const z of zones) {
    w.u16(nameIndex(z.id)); w.u16(nameIndex(z.zh)); w.u16(nameIndex(z.en)); w.u16(z.rings.length);
    for (const ring of z.rings) {
      w.u8v(ring.hole ? 1 : 0); w.u32(ring.xz.length / 2);
      for (let i = 0; i < ring.xz.length; i += 2) writeXZ(w, ring.xz[i], ring.xz[i + 1], FAR_T, 'zone xz');
    }
  }
  return w.done();
}
function decodeZones(r: Reader, names: string[]): SfZone[] {
  const n = r.u16(), out: SfZone[] = [];
  const name = (i: number) => { if (i >= names.length) throw new SfFormatError(`zone name ${i} out of range`); return names[i]; };
  for (let i = 0; i < n; i++) {
    const id = name(r.u16()), zh = name(r.u16()), en = name(r.u16()), nr = r.u16();
    const rings: SfZone['rings'] = [];
    for (let k = 0; k < nr; k++) {
      const hole = r.u8() === 1, np = r.u32(), xz = new Float32Array(np * 2);
      for (let p = 0; p < np; p++) readXZ(r, xz, p * 2, FAR_T);
      rings.push({ hole, xz });
    }
    out.push({ id, zh, en, rings });
  }
  r.finish();
  return out;
}

function encodeLandmarks(list: LandmarkProxy[], nameIndex: (s: string) => number): Uint8Array {
  const w = new Writer();
  w.u16(list.length);
  for (const l of list) {
    w.u16(nameIndex(l.id)); writeXZ(w, l.x, l.z, FAR_T, 'landmark xz');
    w.u16(qu16(l.baseY * Y_Q, 'landmark baseY')); w.u16(qu16(l.height * H_Q, 'landmark height')); w.u16(qu16(l.radius * H_Q, 'landmark radius'));
  }
  return w.done();
}
function decodeLandmarks(r: Reader, names: string[]): LandmarkProxy[] {
  const n = r.u16(), out: LandmarkProxy[] = [];
  for (let i = 0; i < n; i++) {
    const id = names[r.u16()];
    const x = r.i16() / FAR_Q, z = r.i16() / FAR_Q;
    out.push({ id, x, z, baseY: r.u16() / Y_Q, height: r.u16() / H_Q, radius: r.u16() / H_Q });
  }
  r.finish();
  return out;
}

export function encodeFar(d: FarData): Uint8Array {
  // zone / landmark strings are appended to the names table (street names keep their indices)
  const names = d.names.slice();
  const index = new Map<string, number>();
  names.forEach((s, i) => { if (!index.has(s)) index.set(s, i); });
  const nameIndex = (s: string) => {
    let i = index.get(s);
    if (i === undefined) { i = names.length; names.push(s); index.set(s, i); }
    if (i > 0xfffe) throw new SfFormatError('names table overflow');
    return i;
  };
  const zones = encodeZones(d.zones, nameIndex);
  const landmarks = encodeLandmarks(d.landmarks, nameIndex);
  const g = d.zoneGrid;
  const zg = new Writer();
  zg.f32(g.originX); zg.f32(g.originZ); zg.f32(g.step); zg.u16(g.cols); zg.u16(g.rows); zg.bytes(g.idx);
  return writeContainer(MAGIC.far, 0, 0, 0, [
    [SECTION.farDem, encodeDem(d.dem, true)],
    [SECTION.prisms, encodePrisms(d.prisms)],
    [SECTION.farAreas, encodeAreas(d.areas, FAR_T)],
    [SECTION.lines, encodeRoads(d.lines, FAR_T)],
    [SECTION.names, encodeNames(names)],
    [SECTION.zones, zones],
    [SECTION.landmarks, landmarks],
    [SECTION.zoneGrid, zg.done()],
  ]);
}

export function decodeFar(bytes: Uint8Array): FarData {
  const what = 'OBF1';
  const c = readContainer(bytes, MAGIC.far, what);
  const need = (id: number) => { const r = sectionReader(bytes, c, id, what); if (!r) throw new SfFormatError(`${what}: missing section ${id}`); return r; };
  const names = decodeNames(need(SECTION.names));
  const zgR = need(SECTION.zoneGrid);
  const zoneGrid = { originX: zgR.f32(), originZ: zgR.f32(), step: zgR.f32(), cols: zgR.u16(), rows: zgR.u16(), idx: new Uint8Array(0) };
  zoneGrid.idx = zgR.bytes(zoneGrid.cols * zoneGrid.rows).slice();
  zgR.finish();
  return {
    dem: decodeDem(need(SECTION.farDem), null),
    prisms: decodePrisms(need(SECTION.prisms)),
    areas: decodeAreas(need(SECTION.farAreas), FAR_T),
    lines: decodeRoads(need(SECTION.lines), FAR_T),
    zones: decodeZones(need(SECTION.zones), names),
    names,
    landmarks: decodeLandmarks(need(SECTION.landmarks), names),
    zoneGrid,
  };
}

// ---------------------------------------------------------------------------
// OBG1 walking graph
// ---------------------------------------------------------------------------

/**
 * Nodes: x, z at 1/8 u (zigzag deltas in file order — the build sorts nodes spatially), y at 1/500 u; per-node
 * degree (u8) instead of offsets; targets as zigzag (target − source) u32 planes; cost u16 (1/100 u); kind u8.
 */
export function encodeGraph(g: WalkGraph): Uint8Array {
  const nodes = new Writer();
  nodes.u32(g.nodeCount);
  putPoints(nodes, g.xyz.subarray(0, g.nodeCount * 3), 3, FAR_T, 'graph node');
  putHeights(nodes, g.xyz.subarray(0, g.nodeCount * 3), 3, 1, 'graph node');
  const deg = new Writer();
  const d = new Array<number>(g.nodeCount);
  for (let i = 0; i < g.nodeCount; i++) { d[i] = g.offsets[i + 1] - g.offsets[i]; if (d[i] > 255) throw new SfFormatError(`graph node ${i}: degree ${d[i]}`); }
  put8(deg, d);
  const tgt = new Writer(), dt = new Array<number>(g.edgeCount);
  for (let i = 0; i < g.nodeCount; i++) for (let e = g.offsets[i]; e < g.offsets[i + 1]; e++) dt[e] = zz(g.targets[e] - i);
  put32(tgt, dt);
  const cost = new Writer();
  put16(cost, Array.from(g.cost.subarray(0, g.edgeCount), c => qu16(c * COST_Q, 'edge cost')), 'edge cost');
  return writeContainer(MAGIC.graph, 0, 0, 0, [
    [SECTION.nodes, nodes.done()],
    [SECTION.nodeFlags, g.nodeFlags.slice(0, g.nodeCount)],
    [SECTION.offsets, deg.done()],
    [SECTION.targets, tgt.done()],
    [SECTION.cost, cost.done()],
    [SECTION.edgeKind, g.kind.slice(0, g.edgeCount)],
  ]);
}

export function decodeGraph(bytes: Uint8Array): WalkGraph {
  const what = 'OBG1';
  const c = readContainer(bytes, MAGIC.graph, what);
  const need = (id: number) => { const r = sectionReader(bytes, c, id, what); if (!r) throw new SfFormatError(`${what}: missing section ${id}`); return r; };
  const nr = need(SECTION.nodes);
  const nodeCount = nr.u32();
  const xyz = new Float32Array(nodeCount * 3);
  getPoints(nr, nodeCount, FAR_T, xyz, 3);
  getHeights(nr, nodeCount, xyz, 3, 1);
  nr.finish();
  const fr = need(SECTION.nodeFlags);
  const nodeFlags = get8(fr, nodeCount);
  fr.finish();
  const dr = need(SECTION.offsets);
  const offsets = startsFrom(get8(dr, nodeCount));
  dr.finish();
  const edgeCount = offsets[nodeCount];
  const tr = need(SECTION.targets);
  const dt = get32(tr, edgeCount), targets = new Uint32Array(edgeCount);
  tr.finish();
  for (let i = 0; i < nodeCount; i++) for (let e = offsets[i]; e < offsets[i + 1]; e++) {
    const t = i + unzz(dt[e]);
    if (t < 0 || t >= nodeCount) throw new SfFormatError(`${what}: edge target ${t} out of range`);
    targets[e] = t;
  }
  const cr = need(SECTION.cost);
  const cost = Float32Array.from(get16(cr, edgeCount), v => v / COST_Q);
  cr.finish();
  const kr = need(SECTION.edgeKind);
  const kind = get8(kr, edgeCount);
  kr.finish();
  return { nodeCount, edgeCount, xyz, nodeFlags, offsets, targets, cost, kind };
}

// ---------------------------------------------------------------------------
// Compression and loading (module worker / node)
// ---------------------------------------------------------------------------

const isGzip = (b: Uint8Array) => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const src = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(src).arrayBuffer());
}

/**
 * Inflate gzip bytes with DecompressionStream; bytes that are not gzip (a server already inflated them) pass through.
 * W9-E-review (E-RC-1): an engine without DecompressionStream (Safari / iOS before 16.4, Firefox before 113) inflates
 * them with world/sf/inflate.ts, loaded only then.
 */
export async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (!isGzip(bytes)) return bytes;
  if (typeof DecompressionStream === 'undefined') return (await importRetry(() => import('./inflate'))).gunzipSync(bytes);
  return pipe(bytes, new DecompressionStream('gzip'));
}
export async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  return pipe(bytes, new CompressionStream('gzip'));
}

export const decodeChunkFile = async (bytes: Uint8Array) => decodeChunk(await gunzip(bytes));
export const decodeFarFile = async (bytes: Uint8Array) => decodeFar(await gunzip(bytes));
export const decodeGraphFile = async (bytes: Uint8Array) => decodeGraph(await gunzip(bytes));

/** Public root of the published data (served from public/opus-bay/sf). */
export const SF_ROOT = '/opus-bay/sf';
export const versionBase = (version: string, root = SF_ROOT) => `${root}/${version}`;
export const chunkPath = (cx: number, cz: number) => `c/${cx}_${cz}.obc`;

/** Fetch current.json → manifest.json. `base` is the folder every other file path in the manifest is relative to. */
export async function loadManifest(root = SF_ROOT, fetchImpl: typeof fetch = fetch): Promise<{ base: string; manifest: SfManifest }> {
  const cur = (await (await fetchImpl(`${root}/current.json`)).json()) as SfCurrent;
  const base = versionBase(cur.version, root);
  const manifest = (await (await fetchImpl(`${base}/manifest.json`)).json()) as SfManifest;
  if (manifest.formatVersion !== FORMAT_VERSION) throw new SfFormatError(`manifest format ${manifest.formatVersion}, reader ${FORMAT_VERSION}`);
  return { base, manifest };
}

export async function fetchChunk(base: string, cx: number, cz: number, fetchImpl: typeof fetch = fetch): Promise<ChunkData> {
  const res = await fetchImpl(`${base}/${chunkPath(cx, cz)}`);
  if (!res.ok) throw new SfFormatError(`chunk ${cx}_${cz}: HTTP ${res.status}`);
  return decodeChunkFile(new Uint8Array(await res.arrayBuffer()));
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Bilinear height from a DemGrid (clamped to its extent). */
export function demSample(d: DemGrid, x: number, z: number): number {
  const fx = Math.min(d.cols - 1, Math.max(0, (x - d.originX) / d.step));
  const fz = Math.min(d.rows - 1, Math.max(0, (z - d.originZ) / d.step));
  const i = Math.min(d.cols - 2, Math.floor(fx)), j = Math.min(d.rows - 2, Math.floor(fz));
  const tx = fx - i, tz = fz - j, c = d.cols;
  const a = d.y[j * c + i], b = d.y[j * c + i + 1], e = d.y[(j + 1) * c + i], f = d.y[(j + 1) * c + i + 1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (e * (1 - tx) + f * tx) * tz;
}

/**
 * Stable hash of the hero district (slab + lot footprints), so a runtime can tell whether the published city was cut
 * against the district it is running (SfManifest.districtHash). FNV-1a 32 over a canonical string, hex.
 */
export function computeDistrictHash(d: { slab: { x: number; z: number }[]; blocks: { id: string; footprint: { x: number; z: number }[]; height: number }[] }): string {
  let h = 0x811c9dc5;
  const feed = (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } };
  const pt = (p: { x: number; z: number }) => `${p.x.toFixed(2)},${p.z.toFixed(2)};`;
  feed('slab:'); d.slab.forEach(p => feed(pt(p)));
  for (const b of d.blocks) { feed(`|${b.id}:${b.height.toFixed(2)}:`); b.footprint.forEach(p => feed(pt(p))); }
  return h.toString(16).padStart(8, '0');
}
