import { projectCity, terrainY } from '../../core/geo';
import type { Polygon } from '../../core/types';

/**
 * The satellite boards around San Francisco (lane C2-7, wave 3): data side. Pure and worker-safe (no three.js, no DOM
 * beyond DecompressionStream), shared by the offline build (scripts/opus-sf/boards.ts), the runtime (world/sf/boards.ts,
 * its own lazy chunk), the city water (water.ts: the world polygon) and the node tests.
 *
 *   world polygon  the whole diorama board (city water, its glass / earth cut and the table shadow): convex, from the
 *                  Pacific off Ocean Beach round the Marin Headlands, the north Bay and the East Bay to the county line
 *   marin          Terrarium z13 DEM resampled at 4 u (Hawk Hill, Sausalito, Fort Baker, Belvedere / Tiburon)
 *   eastbay        the same at 8 u (Oakland, Alameda, Emeryville, Berkeley, the hills up to the crest, where the world
 *                  polygon cuts them: the far side of the ridge is never seen from the city)
 *
 * Heights are DEM metres (decimetres on disk) on the city terrain curve (core/geo terrainY), so the boards meet the
 * city's own hills and the Golden Gate Bridge deck (15.2 u at its north end, where the Marin ground ramps to it).
 *
 * File `<id>.obb` (gzip) = OBB1: a 32-byte header (magic u32 'OBB1' | version u16 | flags u16 | cols u16 | rows u16 |
 * step f32 | originX f32 | originZ f32 | sea f32 | totalBytes u32 | 4 B zero), then cols × rows i16 samples (DEM
 * decimetres; BOARD_NONE outside the board), zigzag deltas along each row (a row's first sample against the row
 * above's first), split into a low-byte and a high-byte plane. `boards.json` lists the files (BoardIndex).
 */

export const BOARD_MAGIC = 0x3142424f; // 'OBB1'
export const BOARD_VERSION = 1;
export const BOARD_HEADER = 32;
/** sample outside the board (no ground, never interpolated) */
export const BOARD_NONE = -32768;
/** land where the DEM is above this (m); the coast is the contour at this level */
export const BOARD_SEA = 0.6;

export type BoardId = 'marin' | 'eastbay';

export interface BoardSpec {
  id: BoardId;
  /** grid step (u) */
  step: number;
  /** lat / lng region the grid covers (the world polygon and the city's own land cut it further) */
  s: number; n: number; w: number; e: number;
}

/**
 * Marin (checkpoint C2-7a: lat 37.81–37.885, lng −122.545…−122.465 at 4 u) runs east to −122.425 for Belvedere and
 * Tiburon (else open water behind Angel Island) and north to the world polygon; East Bay (37.76–37.90, −122.33…−122.18
 * at 8 u) south to 37.705 for the whole of Alameda and east to the ridge.
 */
export const BOARD_SPECS: readonly BoardSpec[] = [
  { id: 'marin', step: 4, s: 37.805, n: 37.9, w: -122.55, e: -122.425 },
  { id: 'eastbay', step: 8, s: 37.705, n: 37.905, w: -122.34, e: -122.16 },
];

/** The San Mateo county line (the city's south cut). */
export const SOUTH_LAT = 37.7093;
/**
 * The world board (lat, lng), convex, counter-clockwise from the south-west: 180 u of Pacific off Ocean Beach and
 * Lands End, round Point Bonita and the Marin Headlands, along the north Bay above Belvedere to Albany, down the
 * Berkeley / Oakland ridge (the cut runs along the crest) and back along the county line.
 */
export const WORLD_LL: readonly (readonly [number, number])[] = [
  [SOUTH_LAT, -122.5205], [SOUTH_LAT, -122.353], [37.735, -122.2], [37.795, -122.165], [37.9, -122.245], [37.9, -122.33],
  [37.885, -122.545], [37.81, -122.545],
];

export function worldPolygon(): Polygon {
  return WORLD_LL.map(([lat, lng]) => projectCity(lat, lng));
}

/** The Golden Gate Bridge's north deck end (world/sf/landmarks/golden-gate-bridge.ts END_N) and its deck height. */
export const GGB_NORTH = { x: -1015.7, z: 388.6, y: 15.2, /** deck direction north → south */ dx: 0.7812, dz: 0.6243 } as const;
/** Marin Headlands · Hawk Hill (landmarks.json backdrop point) */
export const HAWK_HILL = { x: -1107.84, z: 629.86 } as const;
/**
 * Sausalito's ferry landing (the float at the foot of El Portal), for lane F's ferry routes (F8): the float stands in
 * the water, the shore (the Marin board's land) is ≈ 10 u along `toShore`.
 */
export const SAUSALITO_FERRY = { ...projectCity(37.8559, -122.478), toShore: { x: -0.7071, z: 0.7071 } } as const;

/** Decoded board. `h` = DEM decimetres (BOARD_NONE outside), sample (i, j) at (originX + i·step, originZ + j·step). */
export interface BoardGrid {
  id: string;
  step: number;
  originX: number;
  originZ: number;
  cols: number;
  rows: number;
  sea: number;
  h: Int16Array;
}

export interface BoardIndexEntry { id: BoardId; file: string; bytes: number; step: number; originX: number; originZ: number; cols: number; rows: number; land: number }
/** A freeway carriageway run on a board's land (OSM motorway / trunk; `pts` = x, z pairs in world units, 1/8 u). */
export interface BoardRoad { ref: string; /** carriageway width (u) */ w: number; pts: number[] }
/** boards.json */
export interface BoardIndex {
  version: number; created: string; source: string; sea: number; boards: BoardIndexEntry[]; ggbNorth: { x: number; z: number; y: number };
  roads: BoardRoad[];
  /** the Bay Bridge east span's two decks, Yerba Buena → the Oakland touchdown (OSM I-80 bridge ways; x, z pairs) */
  eastSpan: { pts: number[] }[];
}

// ---------------------------------------------------------------------------
// OBB1
// ---------------------------------------------------------------------------

export class BoardFormatError extends Error {
  constructor(message: string) { super(message); this.name = 'BoardFormatError'; }
}

export function encodeBoard(g: BoardGrid): Uint8Array {
  const n = g.cols * g.rows;
  const out = new Uint8Array(BOARD_HEADER + n * 2);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, BOARD_MAGIC, true);
  dv.setUint16(4, BOARD_VERSION, true);
  dv.setUint16(6, 0, true);
  dv.setUint16(8, g.cols, true);
  dv.setUint16(10, g.rows, true);
  dv.setFloat32(12, g.step, true);
  dv.setFloat32(16, g.originX, true);
  dv.setFloat32(20, g.originZ, true);
  dv.setFloat32(24, g.sea, true);
  dv.setUint32(28, out.byteLength, true);
  const lo = BOARD_HEADER, hi = BOARD_HEADER + n;
  for (let j = 0; j < g.rows; j++) for (let i = 0; i < g.cols; i++) {
    const k = j * g.cols + i;
    const prev = i > 0 ? g.h[k - 1] : j > 0 ? g.h[(j - 1) * g.cols] : 0;
    // the delta wraps in 16 bits (a jump to or from BOARD_NONE): the decoder's Int16Array store wraps it back
    let d = (g.h[k] - prev) & 0xffff;
    if (d >= 0x8000) d -= 0x10000;
    const z = ((d << 1) ^ (d >> 31)) & 0xffff;
    out[lo + k] = z & 0xff;
    out[hi + k] = z >> 8;
  }
  return out;
}

export function decodeBoard(bytes: Uint8Array, id = ''): BoardGrid {
  if (bytes.byteLength < BOARD_HEADER) throw new BoardFormatError(`board ${id}: ${bytes.byteLength} B`);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== BOARD_MAGIC) throw new BoardFormatError(`board ${id}: bad magic`);
  if (dv.getUint16(4, true) !== BOARD_VERSION) throw new BoardFormatError(`board ${id}: version ${dv.getUint16(4, true)}`);
  const cols = dv.getUint16(8, true), rows = dv.getUint16(10, true);
  const total = dv.getUint32(28, true), n = cols * rows;
  if (total !== bytes.byteLength || total !== BOARD_HEADER + n * 2) throw new BoardFormatError(`board ${id}: ${bytes.byteLength} B, header says ${total} for ${cols}×${rows}`);
  const h = new Int16Array(n);
  const lo = BOARD_HEADER, hi = BOARD_HEADER + n;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i;
    const z = bytes[lo + k] | (bytes[hi + k] << 8);
    const d = (z >>> 1) ^ -(z & 1);
    const prev = i > 0 ? h[k - 1] : j > 0 ? h[(j - 1) * cols] : 0;
    h[k] = prev + d;
  }
  return { id, step: dv.getFloat32(12, true), originX: dv.getFloat32(16, true), originZ: dv.getFloat32(20, true), cols, rows, sea: dv.getFloat32(24, true), h };
}

// ---------------------------------------------------------------------------
// sampling
// ---------------------------------------------------------------------------

/** DEM metres at a world point (bilinear); NaN outside the grid or next to a BOARD_NONE sample. */
export function boardDem(g: BoardGrid, x: number, z: number): number {
  const fx = (x - g.originX) / g.step, fz = (z - g.originZ) / g.step;
  const i = Math.floor(fx), j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= g.cols - 1 || j >= g.rows - 1) {
    // on the last row / column exactly
    if (i === g.cols - 1 && fx === i && j >= 0 && j < g.rows) return sampleAt(g, i, Math.min(j, g.rows - 1));
    return Number.NaN;
  }
  const tx = fx - i, tz = fz - j, c = g.cols, k = j * c + i;
  const a = g.h[k], b = g.h[k + 1], d = g.h[k + c], e = g.h[k + c + 1];
  if (a === BOARD_NONE || b === BOARD_NONE || d === BOARD_NONE || e === BOARD_NONE) return Number.NaN;
  return ((a * (1 - tx) + b * tx) * (1 - tz) + (d * (1 - tx) + e * tx) * tz) / 10;
}

function sampleAt(g: BoardGrid, i: number, j: number) {
  const v = g.h[j * g.cols + i];
  return v === BOARD_NONE ? Number.NaN : v / 10;
}

/** World height of the board ground at a point (the city terrain curve), NaN off the board. Water reads 0. */
export function boardY(g: BoardGrid, x: number, z: number): number {
  const h = boardDem(g, x, z);
  return Number.isNaN(h) ? h : terrainY(h);
}

/** Signed distance to a convex polygon (+ inside), in u. */
export function convexSdf(poly: Polygon, x: number, z: number): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; area += p.x * q.z - q.x * p.z; }
  const s = area >= 0 ? 1 : -1;
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ex = b.x - a.x, ez = b.z - a.z, L = Math.hypot(ex, ez);
    if (L < 1e-9) continue;
    // inward normal of a CCW (s > 0) edge in the x / z plane
    d = Math.min(d, (s * (ex * (z - a.z) - ez * (x - a.x))) / L);
  }
  return d;
}
