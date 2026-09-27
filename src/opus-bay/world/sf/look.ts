/**
 * The San Francisco look (lane C2-2, checkpoint §3.1 issue 1 / CS-1): a runtime remap of lane A's published styles,
 * roofs and palettes toward what the city looks like from Twin Peaks — a white and pastel city of flat roofs.
 *
 *   roofFor(b)            flat is the norm (parapet / cornice); pitched roofs only for a believable minority: Sunset /
 *                         Richmond / Parkside / Lakeshore / Oceanview stucco (≈ 18 %, tile), Marina / Seacliff (≈ 40 %
 *                         tile hips), West of Twin Peaks (≈ 20 %, tile), single cottages in Noe / Bernal / Glen Park /
 *                         Excelsior / Portola (≈ 35 %), plus the sheds, piers and civic buildings that keep lane A's roof
 *   wallFor(b)            Victorians keep their Painted-Lady pastels (a touch lighter); Edwardian / stucco / residential
 *                         pools become ≈ 35 % white, light pastels and warm creams; SoMa brick and industrial stay
 *   flatTopColor(b)       white membrane, light grey, gravel, grey, a little tar — always darker than the walls, so
 *                         blocks keep their contact from the hills (plus a few roof gardens / terracotta decks)
 *   pitchedRoofColor(b)   tile in the stucco / Mediterranean zones, slate and terracotta on the cottages
 *   farPrismColors(p)     the far tier (L2 block prisms) from the same tables: the wall tint lightened like the walls,
 *                         the top = the zone's expected mix of flat tops and pitched roofs (no more brown carpet)
 *
 * Applied by world/sf/build.ts specOf (L0 and L1 share it) and world/sf/far.ts (L2), so the three tiers agree. Zones
 * (the DataSF neighbourhoods of far.obc) reach the stream workers as a `zones` message (stream.ts onFar).
 * WORKER-SAFE and dependency-free (no three.js): G1 may import it for the canvas map.
 */

/** Styles / roofs as world/recipes/city.ts CITY_STYLES / CITY_ROOFS (= format.ts STYLES / ROOFS). */
export type LookStyle = 'victorian' | 'edwardian' | 'sunset' | 'marina' | 'chinatown' | 'brick' | 'deco' | 'office' | 'tower' | 'industrial' | 'civic' | 'pier' | 'residential';
export type LookRoof = 'flat' | 'gable' | 'hip';

/** far.obc zone lookup (FarData.zoneGrid + zone ids), structured-clone friendly (posted to the workers). */
export interface LookZones {
  originX: number;
  originZ: number;
  step: number;
  cols: number;
  rows: number;
  /** zone index + 1 per cell (0 = none) */
  idx: Uint8Array;
  /** zone ids (DataSF neighbourhood, kebab-case), index = idx − 1 */
  ids: string[];
}

export function lookZones(far: { zoneGrid: { originX: number; originZ: number; step: number; cols: number; rows: number; idx: Uint8Array }; zones: { id: string }[] }): LookZones {
  const g = far.zoneGrid;
  return { originX: g.originX, originZ: g.originZ, step: g.step, cols: g.cols, rows: g.rows, idx: g.idx, ids: far.zones.map(z => z.id) };
}

export function zoneAt(z: LookZones | null | undefined, x: number, zz: number): string | null {
  if (!z) return null;
  const i = Math.floor((x - z.originX) / z.step), j = Math.floor((zz - z.originZ) / z.step);
  if (i < 0 || j < 0 || i >= z.cols || j >= z.rows) return null;
  const v = z.idx[j * z.cols + i];
  return v ? z.ids[v - 1] ?? null : null;
}

/** What the remap needs to know about a building. */
export interface LookInput {
  style: LookStyle;
  /** lane A's roof */
  roof: LookRoof;
  /** the manifest palette entry (null when the index is out of range) */
  pal: { wall: string; trim: string; roof: string } | null;
  /** osmId (the seed) */
  seed: number;
  /** footprint area (u²) */
  area: number;
  /** wall height (u) */
  H: number;
  /** DataSF neighbourhood id at the footprint centroid, null outside every zone (or zones not loaded yet) */
  zone: string | null;
  /** BuildingSet.flags (BUILDING_FLAG.merged = 4: a row of merged footprints) */
  flags: number;
}

export interface Look {
  roof: LookRoof;
  wall: string;
  trim: string;
  /** flat top (membrane) or pitched roof colour */
  roofColor: string;
}

// ---------------------------------------------------------------------------
// tables
// ---------------------------------------------------------------------------

/** Stucco / Mediterranean zones where a tile-roofed minority is real (share of houses with a pitched roof). */
const TILE_ZONES: Record<string, number> = {
  'sunset-parkside': 0.18, 'outer-richmond': 0.18, 'inner-richmond': 0.12, 'inner-sunset': 0.12, lakeshore: 0.2,
  'oceanview-merced-ingleside': 0.18, 'golden-gate-park': 0.3, 'west-of-twin-peaks': 0.22, 'twin-peaks': 0.12,
  marina: 0.4, seacliff: 0.45, 'presidio-heights': 0.12, 'lincoln-park': 0.3,
};
/** Hill neighbourhoods of small detached cottages (single, unmerged footprints only). */
const COTTAGE_ZONES: Record<string, number> = {
  'noe-valley': 0.35, 'bernal-heights': 0.35, 'glen-park': 0.35, excelsior: 0.35, portola: 0.35,
  'outer-mission': 0.25, 'visitacion-valley': 0.25, 'bayview-hunters-point': 0.2, 'mclaren-park': 0.35, 'treasure-island': 0.25,
};
/** a cottage: one unmerged footprint of at most this area (u²; 1 u ≈ 7 m, a detached house ≈ 3–6 u²) */
export const COTTAGE_AREA = 8;
/** Zones (and styles) that may carry a pitched roof — the test checks every gable / hip against these. */
export const PITCHED_ZONES: readonly string[] = [...Object.keys(TILE_ZONES), ...Object.keys(COTTAGE_ZONES)];
/** Styles whose lane-A roof is kept as it is (sheds, piers, churches / civic halls). */
export const KEEP_ROOF_STYLES: readonly LookStyle[] = ['industrial', 'pier', 'civic'];

export const MERGED_FLAG = 4;

/** Whites / off-whites (≈ 35 % of the house walls). */
const WHITES = ['#f4f1ea', '#f2eee4', '#efebe2', '#f5f0e6', '#eeeae3'];
/** Light pastels: mint, butter, powder blue, blush, lilac, peach, sage, sky (art-direction targets, ledger C2-AD1…5). */
const PASTELS = ['#d8e8d5', '#f3e5b5', '#d5e0ee', '#f2d9d6', '#e3dcee', '#f5dcc5', '#dfe6cf', '#d3e6ea'];
/** Warm creams. */
const CREAMS = ['#efe4d0', '#ece1cc', '#f1e8d6', '#e9dfcb'];
/** Marina / Seacliff Mediterranean stucco: whites, creams, a pale peach or butter. */
const MARINA_WALLS = ['#f4efe4', '#f2ebdd', '#efe5d2', '#f3e3cf', '#f1e6c4', '#f4f1ea'];
/** Chinatown: cream and warm stone behind the painted balconies (accent colours stay in the recipe). */
const CHINATOWN_WALLS = ['#efe6d4', '#ece0c8', '#f1e9da'];

/** Flat tops (membrane / gravel): weights sum to 1; darker than every wall of the house styles. */
const FLAT_TOPS: readonly (readonly [string, number])[] = [
  ['#e2ddd4', 0.26], // white membrane (a shade under the white walls)
  ['#d5d0c7', 0.3], // light grey
  ['#c9c3b8', 0.2], // gravel
  ['#b9b4ab', 0.12], // grey
  ['#99948d', 0.05], // tar
  ['#bccaa5', 0.03], // roof garden
  ['#c9a386', 0.04], // terracotta deck
];
/** Downtown / civic flat tops: a touch lighter and cooler (big roofs read as pale slabs among the towers). */
const COMMERCIAL_TOPS: readonly (readonly [string, number])[] = [
  ['#e3dfd8', 0.3], ['#d6d2ca', 0.3], ['#cac5bc', 0.2], ['#bbb6ad', 0.12], ['#cfd9d5', 0.04], ['#c9a386', 0.04],
];
const TILES = ['#c46a4a', '#c9714f', '#b8674a', '#cf7a56'];
const SLATES = ['#8c9aa6', '#9aa3a4', '#7f8b93', '#a0928a'];

const HOUSE: ReadonlySet<LookStyle> = new Set(['victorian', 'edwardian', 'sunset', 'marina', 'residential', 'chinatown', 'deco']);

// ---------------------------------------------------------------------------
// colour helpers (sRGB hex, no three.js)
// ---------------------------------------------------------------------------

export function hexRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
export function mixHex(a: string, b: string, t: number): string {
  const p = hexRgb(a), q = hexRgb(b);
  return rgbHex(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t);
}
/** HSL lightness (0..1) of an sRGB hex colour. */
export function lightness(h: string): number {
  const [r, g, b] = hexRgb(h);
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
}

/** Deterministic 0..1 draws per building (osmId) and channel. */
export function lookRand(seed: number, channel: number): number {
  let h = Math.imul((seed >>> 0) ^ Math.imul(channel + 1, 0x9e3779b1), 0x85ebca6b);
  h ^= (seed / 4294967296) | 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Mix toward warm white by at least `t`, and further (5 % steps) until the colour is light enough (HSL L ≥ 0.79):
 * the Mission's mustard and coral stay warm accents, only paler. */
function lift(h: string, t: number): string {
  let c = mixHex(h, '#fbf7ee', t);
  for (let k = t + 0.05; lightness(c) < 0.79 && k < 0.9; k += 0.05) c = mixHex(h, '#fbf7ee', k);
  return c;
}

const pickW = (list: readonly (readonly [string, number])[], u: number) => {
  let acc = 0;
  for (const [c, w] of list) { acc += w; if (u < acc) return c; }
  return list[list.length - 1][0];
};
const pick = <T>(list: readonly T[], u: number) => list[Math.min(list.length - 1, Math.floor(u * list.length))];

// ---------------------------------------------------------------------------
// the rules
// ---------------------------------------------------------------------------

/** Share of pitched roofs for a house style in a zone (0 = always flat). */
export function pitchedShare(style: LookStyle, zone: string | null, cottage: boolean): number {
  if (!HOUSE.has(style) || style === 'chinatown' || style === 'deco') return 0;
  const tile = zone ? TILE_ZONES[zone] : undefined;
  if (tile !== undefined) return tile;
  const cot = zone ? COTTAGE_ZONES[zone] : undefined;
  if (cot !== undefined && cottage) return cot;
  return 0;
}

const isCottage = (b: LookInput) => (b.flags & MERGED_FLAG) === 0 && b.area <= COTTAGE_AREA && b.H <= 5;

export function roofFor(b: LookInput): LookRoof {
  if (KEEP_ROOF_STYLES.includes(b.style)) return b.roof;
  const share = pitchedShare(b.style, b.zone, isCottage(b));
  if (share <= 0 || lookRand(b.seed, 1) >= share) return 'flat';
  // Mediterranean zones: tile hips; cottages keep lane A's gable / hip
  const z = b.zone ?? '';
  if (z === 'marina' || z === 'seacliff' || z === 'west-of-twin-peaks' || z === 'presidio-heights') return 'hip';
  if (TILE_ZONES[z] !== undefined) return b.roof === 'gable' && lookRand(b.seed, 2) < 0.6 ? 'gable' : 'hip';
  return b.roof === 'flat' ? 'gable' : b.roof;
}

/** Wall colour (sRGB hex) before the recipe's per-building ±6 % jitter. */
export function wallFor(b: LookInput): string {
  const u = lookRand(b.seed, 3), v = lookRand(b.seed, 4);
  switch (b.style) {
    case 'victorian': {
      // the Painted Ladies keep their pastels (a touch lighter so the far city stays light); a quarter are white
      if (u < 0.25) return pick(WHITES, v);
      return b.pal ? lift(b.pal.wall, 0.1) : pick(PASTELS, v);
    }
    case 'edwardian':
    case 'residential':
      return u < 0.36 ? pick(WHITES, v) : u < 0.8 ? pick(PASTELS, v) : pick(CREAMS, v);
    case 'sunset':
      return u < 0.4 ? pick(WHITES, v) : u < 0.62 ? pick(CREAMS, v) : b.pal ? lift(b.pal.wall, 0.12) : pick(PASTELS, v);
    case 'marina':
      return pick(MARINA_WALLS, u);
    case 'chinatown':
      return pick(CHINATOWN_WALLS, u);
    case 'deco':
      return u < 0.7 ? (b.pal ? lift(b.pal.wall, 0.15) : pick(CREAMS, v)) : pick(PASTELS, v);
    default:
      // brick, industrial, office, tower, civic, pier: lane A's palette as it is
      return b.pal?.wall ?? '#e8e0d0';
  }
}

/** Flat top: the membrane / gravel pool, stepped darker until it sits under the wall (contact from the hills). */
export function flatTopColor(b: LookInput, wall = wallFor(b)): string {
  const list = HOUSE.has(b.style) ? FLAT_TOPS : COMMERCIAL_TOPS;
  let c = pickW(list, lookRand(b.seed, 5));
  const lw = lightness(wall);
  for (let k = 0; k < 4 && lightness(c) > lw - 0.04; k++) c = mixHex(c, '#99948d', 0.25);
  return c;
}

/** Pitched roof colour: tile in the stucco / Mediterranean zones, slate or terracotta on the hill cottages. */
export function pitchedRoofColor(b: LookInput): string {
  const u = lookRand(b.seed, 6);
  if (b.style === 'industrial' || b.style === 'pier' || b.style === 'civic') return b.pal?.roof ?? '#a7b3aa';
  if (b.zone && TILE_ZONES[b.zone] !== undefined) return pick(TILES, u);
  return u < 0.55 ? pick(SLATES, lookRand(b.seed, 7)) : pick(TILES, lookRand(b.seed, 7));
}

/** Trim: the palette's (white on the house styles). */
export function trimFor(b: LookInput): string {
  return b.pal?.trim ?? '#fbf6ec';
}

export function sfLook(b: LookInput): Look {
  const roof = roofFor(b), wall = wallFor(b);
  return { roof, wall, trim: trimFor(b), roofColor: roof === 'flat' ? flatTopColor(b, wall) : pitchedRoofColor(b) };
}

// ---------------------------------------------------------------------------
// far tier (L2 block prisms)
// ---------------------------------------------------------------------------

const meanW = (list: readonly (readonly [string, number])[]) => {
  let r = 0, g = 0, b = 0, w = 0;
  for (const [c, k] of list) { const p = hexRgb(c); r += p[0] * k; g += p[1] * k; b += p[2] * k; w += k; }
  return rgbHex(r / w, g / w, b / w);
};
const mean = (list: readonly string[]) => meanW(list.map(c => [c, 1] as const));
/** expected colours (what a block of the remapped city averages to) */
export const LOOK_MEANS = {
  flat: meanW(FLAT_TOPS),
  commercial: meanW(COMMERCIAL_TOPS),
  tile: mean(TILES),
  slate: mean(SLATES),
  white: mean(WHITES),
} as const;

/**
 * Colours of one far prism (lane A averaged its member buildings' old palette walls / roofs): the wall tint gets the
 * same lift toward white as the house walls, and the top becomes the zone's expected mix of flat tops and pitched
 * roofs. `kind` 1 = tower (flat, commercial top). `u` = a per-prism 0..1 draw for a little variety.
 */
export function farPrismColors(p: { wall: string; roof: string; kind: number; tall: boolean; zone: string | null; u: number }): { wall: string; roof: string } {
  if (p.kind === 1 || p.tall) {
    return { wall: mixHex(p.wall, '#f4f1ea', 0.08), roof: mixHex(LOOK_MEANS.commercial, p.u < 0.5 ? '#bdb7ad' : '#d9d5cd', 0.35) };
  }
  const z = p.zone ?? '';
  const tile = TILE_ZONES[z], cot = COTTAGE_ZONES[z];
  // pitched share of the block top (cottages: about a third of the houses are single cottages)
  const pitched = tile ?? (cot !== undefined ? cot * 0.35 : 0);
  const pitchedColor = tile !== undefined ? LOOK_MEANS.tile : mixHex(LOOK_MEANS.slate, LOOK_MEANS.tile, 0.45);
  // the flat part of the block top: membranes with their light rims; then the pitched share on top
  // lane A's wall averages: lift toward the white / pastel city like wallFor does (brick blocks stay brick-ish)
  const [r, , b] = hexRgb(p.wall);
  const warmDark = r - b > 40 && lightness(p.wall) < 0.62;
  const wall = warmDark ? mixHex(p.wall, '#e9dccb', 0.15) : mixHex(p.wall, LOOK_MEANS.white, 0.4);
  const flat = mixHex(LOOK_MEANS.flat, mixHex(wall, '#fbf7ee', 0.5), FAR_RIM);
  const top = mixHex(flat, pitchedColor, Math.min(1, pitched * 1.1));
  return { wall, roof: mixHex(top, p.u < 0.5 ? '#cdc8be' : '#e2ded6', 0.1 + p.u * 0.08) };
}
/** share of a house's flat top that is rim or cornice seen from above (L0: 0.3 u around a ≈ 2 × 3 u roof, bays) */
const FAR_RIM = 0.45;

// ---------------------------------------------------------------------------
// green hills (lane C2-3, CS-5)
// ---------------------------------------------------------------------------

/**
 * Hill ground: plain land (yards, lots) above y0 mixes toward the hill grass (up to `max` at y1), and only ground
 * steeper than `slope0` shows earth (at most `slopeMax`), so Twin Peaks, Bernal, Mt Davidson and McLaren read as
 * the green hills they are instead of an olive-brown scrub. Shared by L0 / L1 (build.ts) and L2 (far.ts).
 */
export const HILL = { y0: 30, y1: 60, max: 0.55, slope0: 0.95, slopeMax: 0.35, slopeGain: 0.9 } as const;
/** share of hill grass on plain land at height h */
export const hillMix = (h: number) => (h <= HILL.y0 ? 0 : Math.min(HILL.max, ((h - HILL.y0) / (HILL.y1 - HILL.y0)) * HILL.max));
/** share of bare earth at a slope (gradient magnitude) */
export const slopeEarth = (slope: number) => (slope <= HILL.slope0 ? 0 : Math.min(HILL.slopeMax, (slope - HILL.slope0) * HILL.slopeGain));

/**
 * Night street lamps (lane C2-9): lamp level per road class, primary 1 / secondary 0.7 / tertiary 0.5 (motorways 0.8,
 * residential streets 0: their light comes from the windows). The city ground bakes it into the asphalt ribbons'
 * aInfo.w (GROUND_CITY + level, with the arc length in y and the side in z) for the GROUND street glow, and the light
 * field (world/sf/lights.ts) puts a lamp every LAMP_STEP u along the same streets.
 */
export const STREET_LAMP: Readonly<Record<string, number>> = { motorway: 0.8, trunk: 1, primary: 1, secondary: 0.7, tertiary: 0.5 };
export const LAMP_STEP = 9;

/**
 * aInfo of an asphalt ribbon `half` u wide on each side (worker-safe): the street glow's (pattern, arc length, side
 * −1 … 1, GROUND_CITY + lamp level) for a lit class, else plain city asphalt.
 */
export function asphaltInfo(roadClass: string | undefined, half: number, pattern: number, cityFlag: number): readonly [number, number, number, number] | ((s: number, o: number) => readonly [number, number, number, number]) {
  const lvl = roadClass ? STREET_LAMP[roadClass] ?? 0 : 0;
  if (!(lvl > 0) || !(half > 0)) return [pattern, 0, 0, cityFlag];
  return (s, o) => [pattern, s, o / half, cityFlag + lvl];
}
