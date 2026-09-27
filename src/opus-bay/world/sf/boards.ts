import * as THREE from 'three';
import { projectCity, terrainY } from '../../core/geo';
import type { Polygon, Vec2 } from '../../core/types';
import { C, type Info, hash2, mixColor, rng, shade } from '../builder';
import { CITY_PAL, PAL } from '../palette';
import { WIN } from '../recipes/shapes';
import { BOARD_SEA, type BoardGrid, type BoardIndex, type BoardRoad, GGB_NORTH, boardDem, convexSdf, decodeBoard, worldPolygon } from './boardData';
import { gunzip } from './format';
import type { LightSpec } from './lights';
import { hillMix, slopeEarth } from './look';
import { CityBatch, GROUND_CITY, type GroundPaint, type PoolArrays, buildGround, ribbon } from './mesh';

/**
 * The satellite boards at runtime (lane C2-7b / C2-13, wave 3; its own lazy chunk, loaded by the streamer once the far
 * city is in). From boards.json + the two OBB1 grids (boardData.ts):
 *
 *   ground      marching squares per 64 u cell at a step chosen by roughness (Marin 8–32 u, 4 u at the Golden Gate
 *               Bridge's north end; East Bay 16–64 u), the coast from the grid (the OSM coastline is baked into it),
 *               cut exactly along the world polygon (the water's glass / earth edge stands there); the C2-3 paint
 *               (hill grass by height, earth on steep slopes, plain land in the towns) plus woods and beaches;
 *               skirts only where two cells of different steps meet
 *   dressing    a procedural toy town in the TOY part of the same items: Sausalito's hillside and Belvedere's, Fort
 *               Baker, Point Bonita's lighthouse; Oakland's towers, the port's container cranes and stacks, the low
 *               blocks of the flats (walls toward the city only), trees in the hills; the freeways (OSM) as ribbons
 *   east span   the Bay Bridge from Yerba Buena to the Oakland touchdown (C2-13): the self-anchored suspension span's
 *               single tower at (211.0, −506.6), its cables, the skyway's twin decks on piers
 *   lights      the light field's points for all of it (town windows, freeway lamps, crane and tower aviation lights)
 *
 * Everything goes into the streamer's L1/L2 pools as static items of ≤ 256 u tiles (0 new draw calls; the pools cull
 * per item), three per tile (BoardItem.lod): the dressing always, the fine ground + trees near, a coarse copy of the
 * ground (farStep: steps doubled, ≥ 32 u) far — the streamer switches them at BOARD_LOD.near u from the camera, so the
 * city (the Ferry Building, Twin Peaks, downtown: all > 1.1 km away) draws ≈ 15k triangles less of the boards.
 * Pure except `loadBoards` (fetch); `boardsJob` is a generator the streamer runs in ≈ 2 ms frame slices.
 */

/** pool ids ≡ 3 mod 4 (never an l1Id / l2Id), after the hero stand-ins (8,999,999 / 9,000,003) */
export const BOARD_ID0 = 9_000_007;
export const BOARD_TILE = 256;
const CELL = 64;
/** the tile pool (no multi-draw) merges all board items into these few bins (≤ 2 calls each) */
export const BOARD_BINS = 3;

export interface BoardsData { index: BoardIndex; grids: BoardGrid[] }
/**
 * A pool item of the boards. `lod`: 'all' = always on (the towns, towers, cranes, the east span), 'near' = the fine ground
 * and the trees, on while the camera is within BOARD_LOD.near u of the item, 'far' = the coarse ground (steps doubled,
 * >= 32 u), on beyond it (the streamer switches them; the far ground carries the freeways too).
 */
export interface BoardItem { id: number; bin: number; lod: 'all' | 'near' | 'far'; toy: PoolArrays | null; ground: PoolArrays | null; /** the 256 u tile (a near and a far item switch together) */ tile: number }
export { BOARD_LOD } from './boardData';
/** The far ground's step for a cell of step `s` (coast cells stay <= 32 u so the shore keeps its place). */
export const farStep = (s: number, coast: boolean) => Math.min(coast ? 32 : 64, Math.max(32, s * 2));
export interface BoardsBuild {
  items: BoardItem[];
  lights: LightSpec[];
  /** the near set (what a close camera draws: 'all' + 'near'); `far`: the far ground (in place of the near ground + trees) */
  triangles: { ground: number; toy: number; bridge: number; total: number; far: number };
  cells: { marin: number; eastbay: number };
  /** triangles per part (ground / dressing of each board, the freeways, the bridge) and cells per ground step */
  parts: Record<string, number>;
  /** the city water's 64 u far tiles (tx, tz pairs) that lie wholly under board land (water.ts setBoardLand) */
  landTiles: Int32Array;
  /** the boards' ground height at (x, z), null off their land (the water's edge, QA) */
  groundAt(x: number, z: number): number | null;
  ms: number;
}

/** = water.ts TILE (the city water's far tiles) */
const WATER_TILE = 64;

/** boards.json and the grids under `<base>/boards/` (null when the data version has none). */
export async function loadBoards(base: string, fetchImpl: typeof fetch = fetch): Promise<BoardsData | null> {
  const res = await fetchImpl(`${base}/boards/boards.json`);
  if (!res.ok) return null;
  const index = (await res.json()) as BoardIndex;
  const grids = await Promise.all(index.boards.map(async b => {
    const r = await fetchImpl(`${base}/boards/${b.file}`);
    if (!r.ok) throw new Error(`board ${b.id}: HTTP ${r.status}`);
    return decodeBoard(await gunzip(new Uint8Array(await r.arrayBuffer())), b.id);
  }));
  return { index, grids };
}

// ---------------------------------------------------------------------------------------------------------------------
// terrain
// ---------------------------------------------------------------------------------------------------------------------

/** World height of a board's ground at (x, z) (NaN off the grid). */
export function boardHeight(g: BoardGrid, x: number, z: number): number {
  const h = boardDem(g, x, z);
  return Number.isNaN(h) ? h : terrainY(h);
}

/** The boards' ground at (x, z): the world height, or null where no board has land (water, off the boards). */
export function boardsGroundAt(grids: readonly BoardGrid[], x: number, z: number): number | null {
  for (const g of grids) {
    const h = boardDem(g, x, z);
    if (h > BOARD_SEA) return terrainY(h);
  }
  return null;
}

const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
/** smooth value noise in [0, 1] on a `s` u lattice */
function noise(x: number, z: number, s: number, seed = 0) {
  const fx = x / s, fz = z / s, i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
  const u = tx * tx * (3 - 2 * tx), v = tz * tz * (3 - 2 * tz);
  const a = hash2(i + seed, j), b = hash2(i + 1 + seed, j), c = hash2(i + seed, j + 1), d = hash2(i + 1 + seed, j + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** A lat / lng box as a world polygon. */
const llBox = (s: number, w: number, n: number, e: number): Polygon => [projectCity(s, w), projectCity(s, e), projectCity(n, e), projectCity(n, w)];
function inPoly(x: number, z: number, poly: Polygon) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) ins = !ins;
  }
  return ins;
}

/** Where the boards have towns (houses, plain land paint) and what kind. */
const TOWNS = {
  sausalito: llBox(37.8455, -122.4915, 37.8695, -122.4755),
  marinCity: llBox(37.868, -122.53, 37.9, -122.498),
  belvedere: llBox(37.858, -122.476, 37.9, -122.44),
  fortBaker: llBox(37.829, -122.4815, 37.8365, -122.472),
  port: llBox(37.792, -122.335, 37.8175, -122.285),
  oaklandDowntown: llBox(37.798, -122.2795, 37.8155, -122.2575),
  alamedaPoint: llBox(37.77, -122.33, 37.795, -122.295),
};
/** true north in the city frame (core/geo: the map is turned 46°) */
const NORTH = { x: -0.7193, z: -0.6947 };
/** the city lies this way from the East Bay and from Marin (the far-off houses only get the walls that face it) */
const TO_CITY = { x: -0.62, z: 0.78 };
const TO_CITY_M = { x: 0.9, z: 0.44 };

// ---------------------------------------------------------------------------------------------------------------------
// ground
// ---------------------------------------------------------------------------------------------------------------------

const P = { grass: 4, asphalt: 5, earth: 7, town: 9 } as const;
/** `near`: within `nearR` u of the Golden Gate Bridge's north end (seen close from the deck and Crissy Field) */
interface BoardCfg { steps: readonly number[]; tol: number; coastMax: number; near?: { r: number; steps: readonly number[]; tol: number } }
const CFG: Record<string, BoardCfg> = {
  marin: { steps: [16, 32], tol: 3, coastMax: 16, near: { r: 260, steps: [64 / 6, 16, 32], tol: 1.8 } },
  eastbay: { steps: [16, 32, 64], tol: 4.5, coastMax: 32 },
};

/** The step for one 64 u cell: the largest whose bilinear surface stays within `tol` of the grid (u); 0 = no land. */
function cellStep(g: BoardGrid, cfg: BoardCfg, x0: number, z0: number): { step: number; coast: boolean } {
  if (Math.hypot(x0 + CELL / 2 - GGB_NORTH.x, z0 + CELL / 2 - GGB_NORTH.z) < 60) return { step: 8, coast: true };
  const n = Math.round(CELL / g.step) + 1;
  const ys = new Float32Array(n * n);
  let wet = false, land = false;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const h = boardDem(g, x0 + i * g.step, z0 + j * g.step);
    const dry = h > BOARD_SEA;
    wet ||= !dry; land ||= dry;
    ys[j * n + i] = dry ? terrainY(h) : 0;
  }
  if (!land) return { step: 0, coast: false };
  const near = cfg.near && Math.hypot(x0 + CELL / 2 - GGB_NORTH.x, z0 + CELL / 2 - GGB_NORTH.z) < cfg.near.r ? cfg.near : null;
  const steps = near?.steps ?? cfg.steps, tol = near?.tol ?? cfg.tol;
  for (let s = steps.length - 1; s >= 0; s--) {
    const S = steps[s];
    if (wet && S > cfg.coastMax) continue;
    const k = Math.max(1, Math.round(S / g.step));
    let err = 0;
    for (let j = 0; j < n && err <= tol; j++) for (let i = 0; i < n; i++) {
      const i0 = Math.min(n - 1 - k, Math.floor(i / k) * k), j0 = Math.min(n - 1 - k, Math.floor(j / k) * k);
      const tx = (i - i0) / k, tz = (j - j0) / k;
      const y = (ys[j0 * n + i0] * (1 - tx) + ys[j0 * n + i0 + k] * tx) * (1 - tz) + (ys[(j0 + k) * n + i0] * (1 - tx) + ys[(j0 + k) * n + i0 + k] * tx) * tz;
      err = Math.max(err, Math.abs(y - ys[j * n + i]));
      if (err > tol) break;
    }
    if (err <= tol) return { step: S, coast: wet };
  }
  return { step: steps[0], coast: wet };
}

interface Zone { town: string | null; wood: number }

function zoneOf(id: string, x: number, z: number, y: number): Zone {
  let town: string | null = null;
  if (id === 'marin') {
    if (inPoly(x, z, TOWNS.sausalito) && y < 26) town = 'sausalito';
    else if (inPoly(x, z, TOWNS.belvedere) && y < 34) town = 'belvedere';
    else if (inPoly(x, z, TOWNS.marinCity) && y < 12) town = 'marin';
    else if (inPoly(x, z, TOWNS.fortBaker) && y < 6) town = 'fortBaker';
  } else if (inPoly(x, z, TOWNS.port) && y < 2) town = 'port';
  else if (y < 16) town = 'flats';
  else if (y < 44) town = 'hills';
  // woods: eucalyptus / cypress groves on the Marin slopes, the wooded Oakland / Berkeley hills
  const n = noise(x, z, id === 'marin' ? 70 : 90, id === 'marin' ? 11 : 23);
  const wood = id === 'marin'
    ? smooth(0.62, 0.72, n) * smooth(4, 10, y) * (town === 'sausalito' || town === 'belvedere' ? 1.4 : 1)
    : town === 'hills' ? smooth(0.3, 0.45, n) : town === null ? smooth(0.45, 0.6, n) * (1 - smooth(60, 80, y)) : 0;
  return { town, wood: Math.min(1, wood) };
}

/** the East Bay's street grid (true north) for the far-town ground pattern (materials.ts GROUND 9) */
const GRID_ANGLE = Math.atan2(-NORTH.x, -NORTH.z);
const TOWN_YZ: readonly [number, number] = [GRID_ANGLE, 15];

/**
 * Ground colour and pattern. aInfo interpolates between vertices, so in the East Bay every vertex carries the town
 * grid's angle and scale (a varying scale would warp the grid) and every neighbour of the far town (9) is earth (7)
 * (the brick band 8 between them reads its constant yz: flat); Marin has no town pattern and keeps grass on its hills.
 */
function paint(id: string, x: number, z: number, y: number, slope: number): GroundPaint {
  const zn = zoneOf(id, x, z, y);
  const u = hash2(Math.floor(x / 16), Math.floor(z / 16));
  const eb = id !== 'marin';
  let col: THREE.Color;
  let pattern: number = P.earth;
  const yz = eb ? TOWN_YZ : undefined;
  if (y < 0.9 && zn.town === null && !eb) col = C(CITY_PAL.sand);
  else if (zn.town === 'port') { col = mixColor(CITY_PAL.parking, '#c4c0b8', u * 0.6); pattern = P.town; }
  else if (zn.town === 'flats') {
    // the flats from afar: a street grid of pale roofs (the pattern), a little green in the gardens
    col = mixColor(mixColor(CITY_PAL.land, CITY_PAL.landShade, u), CITY_PAL.park, 0.16 * noise(x, z, 40, 5));
    pattern = P.town;
  } else if (zn.town === 'marin' || zn.town === 'fortBaker') {
    col = mixColor(mixColor(CITY_PAL.land, CITY_PAL.landShade, u), CITY_PAL.park, 0.25 * noise(x, z, 30, 5));
  } else {
    // the C2-3 hills (look.ts HILL: the same shares on the city terrain curve)
    col = mixColor(C(CITY_PAL.scrub), CITY_PAL.hillGrass, 0.4 + hillMix(y));
    col = mixColor(col, shade(col, 0.93), u * 0.5);
    pattern = eb ? P.earth : P.grass;
    if (zn.town === 'hills' || zn.town === 'sausalito' || zn.town === 'belvedere') col = mixColor(col, CITY_PAL.landShade, 0.35);
  }
  if (zn.wood > 0) { col = mixColor(col, CITY_PAL.forest, zn.wood * 0.85); if (!eb) pattern = P.grass; }
  if (slope > 0.95) col = mixColor(col, CITY_PAL.earth, slopeEarth(slope));
  return { color: col, pattern, yz };
}

interface Cell { ix: number; iz: number; step: number; coast: boolean }

/** Every land cell of a board with its step. */
function boardCells(g: BoardGrid): Map<number, Cell> {
  const cfg = CFG[g.id] ?? CFG.eastbay;
  const cells = new Map<number, Cell>();
  const i0 = Math.floor(g.originX / CELL), i1 = Math.ceil((g.originX + (g.cols - 1) * g.step) / CELL);
  const j0 = Math.floor(g.originZ / CELL), j1 = Math.ceil((g.originZ + (g.rows - 1) * g.step) / CELL);
  for (let iz = j0; iz < j1; iz++) for (let ix = i0; ix < i1; ix++) {
    const st = cellStep(g, cfg, ix * CELL, iz * CELL);
    if (st.step) cells.set(ix * 65536 + iz, { ix, iz, step: st.step, coast: st.coast });
  }
  return cells;
}

// ---------------------------------------------------------------------------------------------------------------------
// dressing helpers (TOY; aInfo = window style, base, −seed, glow)
// ---------------------------------------------------------------------------------------------------------------------

/** A rotated box standing on y0 (walls sunk 0.8 u into the slope): `faces` 4 = all walls, else only those facing `to`. */
function block(b: CityBatch, x: number, z: number, y0: number, w: number, d: number, h: number, yaw: number, wall: THREE.Color, roof: THREE.Color, info: Info, to?: { x: number; z: number }) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const pts: Vec2[] = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([a, e]) => ({ x: x + a * c - e * s, z: z + a * s + e * c }));
  const top = y0 + h;
  const bot = shade(wall, 0.82);
  for (let i = 0; i < 4; i++) {
    const a = pts[i], q = pts[(i + 1) % 4];
    const ex = q.x - a.x, ez = q.z - a.z, L = Math.hypot(ex, ez) || 1;
    // outward normal of a counter-clockwise (x / z) rectangle
    const nx = ez / L, nz = -ex / L;
    if (to && nx * to.x + nz * to.z < -0.15) continue;
    b.quad(new THREE.Vector3(a.x, y0 - 0.8, a.z), new THREE.Vector3(q.x, y0 - 0.8, q.z), new THREE.Vector3(q.x, top, q.z), new THREE.Vector3(a.x, top, a.z), new THREE.Vector3(nx, 0, nz), [bot, bot, wall, wall], info);
  }
  b.polygon(pts, top, roof, [0, 0, info[2], 0]);
}

/** A pitched roof (gable along the long side) over a block's top: 2 slopes + 2 gable ends. */
function gable(b: CityBatch, x: number, z: number, y: number, w: number, d: number, rise: number, yaw: number, roof: THREE.Color, wall: THREE.Color) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const P3 = (a: number, e: number, h: number) => new THREE.Vector3(x + a * c - e * s, y + h, z + a * s + e * c);
  const A = P3(-w / 2, -d / 2, 0), B = P3(w / 2, -d / 2, 0), Cc = P3(w / 2, d / 2, 0), D = P3(-w / 2, d / 2, 0);
  const E = P3(-w / 2, 0, rise), F = P3(w / 2, 0, rise);
  b.quad(A, B, F, E, new THREE.Vector3(0, 1, 0).add(new THREE.Vector3(s, 0, -c).multiplyScalar(0.8)).normalize(), roof);
  b.quad(Cc, D, E, F, new THREE.Vector3(0, 1, 0).add(new THREE.Vector3(-s, 0, c).multiplyScalar(0.8)).normalize(), shade(roof, 0.9));
  b.tri(A, E, D, wall, NO_GLOW);
  b.tri(B, Cc, F, wall, NO_GLOW);
}
const NO_GLOW: Info = [0, 0, 0, 0];

/** A tree: an open four-sided cone (4 triangles). */
function tree(b: CityBatch, x: number, y: number, z: number, h: number, r: number, col: THREE.Color, rot: number) {
  const top = new THREE.Vector3(x, y + h, z);
  const base: THREE.Vector3[] = [];
  for (let k = 0; k < 4; k++) { const a = rot + (k * Math.PI) / 2; base.push(new THREE.Vector3(x + Math.cos(a) * r, y - 0.3, z + Math.sin(a) * r)); }
  const dark = shade(col, 0.78);
  for (let k = 0; k < 4; k++) {
    const a = base[k], q = base[(k + 1) % 4];
    const mx = (a.x + q.x) / 2 - x, mz = (a.z + q.z) / 2 - z, L = Math.hypot(mx, mz) || 1;
    const n = new THREE.Vector3(mx / L, r / h, mz / L).normalize();
    b.tri(a, q, top, k % 2 ? col : dark, [0, 0, 0.15, 0], n);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// the build
// ---------------------------------------------------------------------------------------------------------------------

/** US-101 leaves the Golden Gate Bridge on a viaduct (OSM bridge ways, not in the file): a carriageway run that starts or
 *  ends within 70 u of the north deck end is carried on to it. */
function toBridgeEnd(r: BoardRoad): BoardRoad {
  const G = GGB_NORTH, n = r.pts.length;
  const d0 = Math.hypot(r.pts[0] - G.x, r.pts[1] - G.z), d1 = Math.hypot(r.pts[n - 2] - G.x, r.pts[n - 1] - G.z);
  if (Math.min(d0, d1) > 70) return r;
  // the two carriageways stay apart: land 1.8 u either side of the deck's centre line, on the run's side
  const end = d0 < d1 ? 0 : n - 2, side = Math.sign(-(r.pts[end] - G.x) * G.dz + (r.pts[end + 1] - G.z) * G.dx) || 1;
  const x = G.x - G.dz * side * 1.8, z = G.z + G.dx * side * 1.8;
  return { ...r, pts: d0 < d1 ? [x, z, ...r.pts] : [...r.pts, x, z] };
}

/** Segments of the freeways on the East Bay board in 64 u buckets: no low block of the flats is set on a freeway. */
function roadIndex(roads: readonly BoardRoad[]) {
  const B = 64, map = new Map<number, number[]>();
  for (const r of roads) for (let k = 0; k + 3 < r.pts.length; k += 2) {
    const ax = r.pts[k], az = r.pts[k + 1], bx = r.pts[k + 2], bz = r.pts[k + 3];
    for (let j = Math.floor(Math.min(az, bz) / B); j <= Math.floor(Math.max(az, bz) / B); j++) for (let i = Math.floor(Math.min(ax, bx) / B); i <= Math.floor(Math.max(ax, bx) / B); i++) {
      const key = (i + 512) * 1024 + j + 512;
      let l = map.get(key);
      if (!l) { l = []; map.set(key, l); }
      l.push(ax, az, bx, bz);
    }
  }
  /** distance from (x, z) to the nearest freeway within r (Infinity beyond) */
  return (x: number, z: number, r: number) => {
    let best = Infinity;
    for (let j = Math.floor((z - r) / B); j <= Math.floor((z + r) / B); j++) for (let i = Math.floor((x - r) / B); i <= Math.floor((x + r) / B); i++) {
      const l = map.get((i + 512) * 1024 + j + 512);
      if (!l) continue;
      for (let k = 0; k < l.length; k += 4) {
        const ax = l[k], az = l[k + 1], dx = l[k + 2] - ax, dz = l[k + 3] - az, L2 = dx * dx + dz * dz || 1e-9;
        const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / L2));
        best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z));
      }
    }
    return best;
  };
}

const LED = [1.0, 0.84, 0.62] as const;
const SODIUM = [1.0, 0.6, 0.28] as const;
const RED = [1.0, 0.12, 0.08] as const;
const WHITE = [1.0, 0.95, 0.85] as const;
/** light field aLevel ≥ 2 = blinking (lights.ts) */
const BLINK = 2;

/** One 256 u tile of a board: the dressing always on (`toy`), the trees near only (`detail`), the near / far ground. */
interface Tile { toy: CityBatch; detail: CityBatch; ground: CityBatch; far: CityBatch; bin: number }
class Tiles {
  private map = new Map<number, Tile>();
  private bin: number;
  constructor(bin: number) { this.bin = bin; }
  at(x: number, z: number): Tile {
    const k = (Math.floor(x / BOARD_TILE) + 64) * 256 + (Math.floor(z / BOARD_TILE) + 64);
    let t = this.map.get(k);
    if (!t) { t = { toy: new CityBatch(1024), detail: new CityBatch(256), ground: new CityBatch(2048), far: new CityBatch(512), bin: this.bin }; this.map.set(k, t); }
    return t;
  }
  get all() { return [...this.map.values()]; }
  get entries() { return [...this.map.entries()]; }
  /** triangles written so far to the near set (toy + trees, near ground) */
  tris(): [number, number] { let t = 0, g = 0; for (const v of this.map.values()) { t += (v.toy.indexCount + v.detail.indexCount) / 3; g += v.ground.indexCount / 3; } return [t, g]; }
}

/**
 * The whole build as a generator (the streamer runs it in frame slices; `buildBoards` runs it at once for tests and
 * the offline script). Yields after every few cells / pieces.
 */
export function* boardsJob(data: BoardsData): Generator<void, BoardsBuild> {
  const t0 = performance.now();
  const world = worldPolygon();
  const lights: LightSpec[] = [];
  const out: BoardItem[] = [];
  const cellsN = { marin: 0, eastbay: 0 };
  const parts: Record<string, number> = {};
  const mark = (tiles: Tiles, key: string, last: [number, number]) => { const [t, g] = tiles.tris(); parts[key] = (parts[key] ?? 0) + (t - last[0]) + (g - last[1]); last[0] = t; last[1] = g; };
  let nextId = BOARD_ID0;
  const flush = (tiles: Tiles) => {
    for (const [k, t] of tiles.entries) {
      const tile = t.bin * 65536 + k;
      const put = (lod: BoardItem['lod'], toy: PoolArrays | null, ground: PoolArrays | null) => {
        if (toy || ground) { out.push({ id: nextId, bin: t.bin, lod, toy, ground, tile }); nextId += 4; }
      };
      put('all', t.toy.toPool(), null);
      put('near', t.detail.toPool(), t.ground.toPool());
      put('far', null, t.far.toPool());
    }
  };
  for (const g of data.grids) {
    const tiles = new Tiles(g.id === 'marin' ? 0 : 1);
    const cells = boardCells(g);
    cellsN[g.id as 'marin' | 'eastbay'] = cells.size;
    for (const c of cells.values()) parts[`${g.id}.step${c.step}`] = (parts[`${g.id}.step${c.step}`] ?? 0) + 1;
    const last: [number, number] = [0, 0];
    yield;
    const height = (x: number, z: number) => { const h = boardDem(g, x, z); return Number.isNaN(h) ? 0 : terrainY(Math.max(h, 0)); };
    // + on land inside the world polygon (the dem field scaled up, so the polygon's own line is the cut where it is nearer)
    // (off the grid: the polygon's own distance, so a coarse cell's crossing still lands on the polygon's line)
    const sdf = (x: number, z: number) => {
      const h = boardDem(g, x, z), d = convexSdf(world, x, z);
      if (Number.isNaN(h)) return Math.min(-1, d);
      return Math.min((h - BOARD_SEA) * 40, d);
    };
    let n = 0;
    const nb = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (const c of cells.values()) {
      const x0 = c.ix * CELL, z0 = c.iz * CELL;
      const t = tiles.at(x0 + CELL / 2, z0 + CELL / 2);
      // the near and the far ground (BOARD_LOD); skirts only against a neighbour cell of another step
      for (const far of [false, true]) {
        const step = far ? farStep(c.step, c.coast) : c.step;
        let sides = 0;
        for (let k = 0; k < 4; k++) {
          const o = cells.get((c.ix + nb[k][0]) * 65536 + c.iz + nb[k][1]);
          if (o && (far ? farStep(o.step, o.coast) : o.step) !== step) sides |= 1 << k;
        }
        buildGround(far ? t.far : t.ground, {
          x0, z0, size: CELL, step, sdf, height,
          paint: (x, z, h, slope) => paint(g.id, x, z, h, slope),
          lip: 1.4, lipColor: () => C(CITY_PAL.lip), skirt: sides ? 3 : 0, skirtSides: sides,
        });
      }
      if (++n % 16 === 0) yield;
    }
    mark(tiles, `${g.id}.ground`, last);
    // freeways on this board (OSM carriageways): ribbons 0.35 u over the ground
    const asphalt = C(CITY_PAL.motorway);
    // (resampled every 24 u so they follow the hills; cut 3 u + half their width inside the world polygon)
    const inside = (x: number, z: number, w: number) => convexSdf(world, x, z) > 3 + w;
    for (const road of data.index.roads) {
      if (!(boardDem(g, road.pts[0], road.pts[1]) > BOARD_SEA)) continue;
      const r = g.id === 'marin' ? toBridgeEnd(road) : road;
      const lines: number[][] = [[]];
      const put = (x: number, z: number) => {
        if (inside(x, z, r.w)) lines[lines.length - 1].push(x, height(x, z), z);
        else if (lines[lines.length - 1].length) lines.push([]);
      };
      for (let k = 0; k + 1 < r.pts.length; k += 2) {
        if (k >= 2) {
          const ax = r.pts[k - 2], az = r.pts[k - 1], bx = r.pts[k], bz = r.pts[k + 1], L = Math.hypot(bx - ax, bz - az);
          for (let s = 24; s < L - 6; s += 24) put(ax + ((bx - ax) * s) / L, az + ((bz - az) * s) / L);
        }
        put(r.pts[k], r.pts[k + 1]);
      }
      for (const line of lines) {
        if (line.length < 6) continue;
        const t = tiles.at(line[0], line[2]);
        for (const b of [t.ground, t.far]) ribbon(b, line, r.w, 0.35, asphalt, [P.asphalt, 0, 0, GROUND_CITY], 0, (x, z, y) => Math.max(y, height(x, z)));
        // a lamp every 22 u along the freeways (the light field)
        for (let k = 0; k + 5 < line.length; k += 3) {
          const ax = line[k], az = line[k + 2], bx = line[k + 3], bz = line[k + 5], L = Math.hypot(bx - ax, bz - az);
          for (let s = 0; s < L; s += 22) lights.push({ x: ax + ((bx - ax) * s) / L, y: height(ax, az) + 3.2, z: az + ((bz - az) * s) / L, level: 0.8, color: SODIUM });
        }
      }
    }
    mark(tiles, `${g.id}.roads`, last);
    yield;
    const part = (key: string) => mark(tiles, `${g.id}.${key}`, last);
    if (g.id === 'marin') yield* marinTown(g, tiles, lights, part);
    else yield* eastBayTown(g, tiles, lights, part, roadIndex(data.index.roads));
    flush(tiles);
    yield;
  }
  // C2-13: the Bay Bridge east span
  const bridge = new Tiles(2);
  eastSpan(data, bridge, lights);
  const bridgeStart = out.length;
  flush(bridge);
  const tri = (a: PoolArrays | null) => (a ? a.indexCount / 3 : 0);
  let ground = 0, toy = 0, bridgeTris = 0, far = 0;
  out.forEach((it, i) => {
    if (i >= bridgeStart) bridgeTris += tri(it.toy) + tri(it.ground);
    else if (it.lod === 'far') far += tri(it.ground);
    else { ground += tri(it.ground); toy += tri(it.toy); }
  });
  parts.bridge = bridgeTris;
  parts.farGround = far;
  // water tiles wholly under board land (tested every 8 u over the tile grown by 16 u: no inlet loses its water)
  const land = (x: number, z: number) => boardsGroundAt(data.grids, x, z) !== null && convexSdf(world, x, z) > 0;
  const landTiles: number[] = [];
  let k = 0;
  for (const g of data.grids) {
    const tx0 = Math.floor(g.originX / WATER_TILE), tx1 = Math.floor((g.originX + (g.cols - 1) * g.step) / WATER_TILE);
    const tz0 = Math.floor(g.originZ / WATER_TILE), tz1 = Math.floor((g.originZ + (g.rows - 1) * g.step) / WATER_TILE);
    for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) {
      let all = true;
      for (let z = tz * WATER_TILE - 16; z <= tz * WATER_TILE + WATER_TILE + 16 && all; z += 8) for (let x = tx * WATER_TILE - 16; x <= tx * WATER_TILE + WATER_TILE + 16; x += 8) if (!land(x, z)) { all = false; break; }
      if (all) landTiles.push(tx, tz);
      if (++k % 120 === 0) yield;
    }
  }
  const grids = data.grids;
  return {
    items: out, lights, triangles: { ground, toy, bridge: bridgeTris, total: ground + toy + bridgeTris, far }, cells: cellsN, parts,
    landTiles: Int32Array.from(landTiles), groundAt: (x, z) => boardsGroundAt(grids, x, z), ms: performance.now() - t0,
  };
}

/** Run the whole job at once. */
export function buildBoards(data: BoardsData): BoardsBuild {
  const job = boardsJob(data);
  for (;;) { const r = job.next(); if (r.done) return r.value; }
}

// ---------------------------------------------------------------------------------------------------------------------
// Marin: Sausalito, Belvedere / Tiburon, Marin City, Fort Baker, Point Bonita, the groves
// ---------------------------------------------------------------------------------------------------------------------

const HOUSE_WALLS = ['#f2ede3', '#ece4d4', '#e8dcc6', '#f3e9dc', '#dfe3e0', '#efe2cf', '#e4d6c0', '#f6f1e8'];
const HOUSE_ROOFS = ['#6f6a66', '#8a7e74', '#5f6468', '#9a6b55', '#7b7d80'];

function* marinTown(g: BoardGrid, tiles: Tiles, lights: LightSpec[], part: (key: string) => void): Generator<void> {
  const r = rng(3701);
  const at = (x: number, z: number) => { const h = boardDem(g, x, z); return h > BOARD_SEA ? terrainY(h) : null; };
  const slopeAt = (x: number, z: number) => { const a = at(x + 2, z), b = at(x - 2, z), c = at(x, z + 2), d = at(x, z - 2); return a === null || b === null || c === null || d === null ? 9 : Math.hypot(a - b, c - d) / 4; };
  // houses on a jittered 6.5 u lattice over the towns, fewer higher up
  const towns: [Polygon, number, number][] = [[TOWNS.sausalito, 26, 0.75], [TOWNS.belvedere, 34, 0.42], [TOWNS.marinCity, 12, 0.22], [TOWNS.fortBaker, 6, 0.9]];
  let n = 0;
  for (const [poly, top, density] of towns) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of poly) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    const fort = poly === TOWNS.fortBaker;
    const sp = fort ? 8 : 11.5;
    for (let z = z0; z < z1; z += sp) for (let x = x0; x < x1; x += sp) {
      const px = x + (r() - 0.5) * sp * 0.7, pz = z + (r() - 0.5) * sp * 0.7;
      if (!inPoly(px, pz, poly)) continue;
      const y = at(px, pz);
      if (y === null || y < 0.4 || y > top) continue;
      const sl = slopeAt(px, pz);
      if (sl > 1.3 || r() > density * (1 - 0.55 * (y / top))) continue;
      // face downhill (the Bay): the long side along the contour
      const gx = (at(px + 2, pz) ?? y) - (at(px - 2, pz) ?? y), gz = (at(px, pz + 2) ?? y) - (at(px, pz - 2) ?? y);
      const yaw = Math.atan2(gz, gx) + Math.PI / 2 + (r() - 0.5) * 0.3;
      const w = fort ? 6 + r() * 3 : 3 + r() * 1.8, d = fort ? 3 + r() : 2.4 + r() * 1.2, h = fort ? 2.6 : 1.8 + r() * (r() < 0.2 ? 2.4 : 1.2);
      const wall = C(fort ? '#f1ece2' : HOUSE_WALLS[Math.floor(r() * HOUSE_WALLS.length)]);
      const roof = C(fort ? '#a4533f' : HOUSE_ROOFS[Math.floor(r() * HOUSE_ROOFS.length)]);
      const t = tiles.at(px, pz);
      const seed = -(0.05 + 0.9 * r());
      block(t.toy, px, pz, y, w, d, h, yaw, wall, roof, [WIN.res, y, seed, 0], fort ? undefined : TO_CITY_M);
      if (fort || r() < 0.3) gable(t.toy, px, pz, y + h, w, d, fort ? 1.3 : 0.9, yaw, roof, wall);
      if (r() < 0.3) lights.push({ x: px, y: y + h * 0.6, z: pz, level: 0.55, color: LED });
      if (++n % 60 === 0) yield;
    }
  }
  part('houses');
  // cypress / eucalyptus groves: the woods of the paint, as trees
  const wood = C(CITY_PAL.forest), wood2 = C(PAL.pine);
  for (let z = g.originZ; z < g.originZ + g.rows * g.step; z += 13) for (let x = g.originX; x < g.originX + g.cols * g.step; x += 13) {
    const px = x + (hash2(x, z) - 0.5) * 10, pz = z + (hash2(z, x) - 0.5) * 10;
    const y = at(px, pz);
    if (y === null || y < 1.5) continue;
    const zn = zoneOf('marin', px, pz, y);
    if (zn.wood < 0.55 || hash2(px * 0.7, pz * 0.3) > zn.wood * 0.5) continue;
    tree(tiles.at(px, pz).detail, px, y, pz, 3 + hash2(pz, px) * 3, 1.4 + hash2(px, 1) * 0.8, hash2(px, pz) < 0.5 ? wood : wood2, hash2(pz, 3) * 3);
  }
  part('trees');
  yield;
  // Point Bonita's lighthouse on its rock, and its light
  const pb = projectCity(37.81563, -122.52977), py = at(pb.x, pb.z) ?? 2;
  const t = tiles.at(pb.x, pb.z);
  block(t.toy, pb.x, pb.z, py, 1.1, 1.1, 2.6, 0, C('#f6f2e8'), C('#c9463a'), [0, 0, 0, 0]);
  lights.push({ x: pb.x, y: py + 3, z: pb.z, level: 1, color: WHITE });
}

// ---------------------------------------------------------------------------------------------------------------------
// East Bay: Oakland's towers, the port, the flats, Alameda, the wooded hills, the Campanile
// ---------------------------------------------------------------------------------------------------------------------

/** Downtown Oakland and around: [lat, lng, height m, footprint m, style] (approximate, from published heights) */
const OAK_TOWERS: [number, number, number, number, number][] = [
  [37.8093, -122.2648, 124, 40, WIN.office], // Ordway Building
  [37.8099, -122.2633, 118, 55, WIN.office], // Kaiser Center
  [37.8081, -122.2655, 111, 38, WIN.glass], // Lake Merritt Plaza
  [37.8053, -122.2723, 98, 30, WIN.office], // Oakland City Hall
  [37.8034, -122.2714, 93, 22, WIN.brick], // Tribune Tower
  [37.8047, -122.2745, 75, 40, WIN.office], // Federal Building (west)
  [37.8042, -122.2738, 75, 40, WIN.office], // Federal Building (east)
  [37.8025, -122.2733, 99, 32, WIN.glass], // 1111 Broadway
  [37.8049, -122.2713, 100, 34, WIN.office], // Clorox Building
  [37.8036, -122.2748, 90, 30, WIN.office], // 555 City Center
  [37.8108, -122.2627, 100, 30, WIN.glass], // Harrison Street
  [37.8018, -122.2718, 80, 30, WIN.office], // Marriott City Center
  [37.8115, -122.2685, 72, 28, WIN.glass], // uptown
  [37.8126, -122.2665, 64, 30, WIN.office],
  [37.8064, -122.2690, 70, 28, WIN.office],
  [37.8012, -122.2742, 58, 34, WIN.office],
];

function* eastBayTown(g: BoardGrid, tiles: Tiles, lights: LightSpec[], part: (key: string) => void, nearRoad: (x: number, z: number, r: number) => number): Generator<void> {
  const r = rng(5101);
  const at = (x: number, z: number) => { const h = boardDem(g, x, z); return h > BOARD_SEA ? terrainY(h) : null; };
  // the flats: low blocks on a true-north lattice (the East Bay street grid), walls toward the city only
  const yaw = Math.atan2(NORTH.z, NORTH.x);
  const E = { x: -NORTH.z, z: NORTH.x };
  const sp = 58;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const k of [0, 1]) for (const kk of [0, 1]) { const x = g.originX + k * (g.cols - 1) * g.step, z = g.originZ + kk * (g.rows - 1) * g.step; const a = x * E.x + z * E.z, b = x * NORTH.x + z * NORTH.z; x0 = Math.min(x0, a); x1 = Math.max(x1, a); z0 = Math.min(z0, b); z1 = Math.max(z1, b); }
  let n = 0;
  const downtown = TOWNS.oaklandDowntown;
  // rows offset by half a step (no long straight rows from afar) and jittered
  for (let b = z0, row = 0; b < z1; b += sp * 0.87, row++) for (let a = x0 + (row % 2) * sp * 0.5; a < x1; a += sp) {
    const ja = a + (hash2(a, b) - 0.5) * sp * 0.4, jb = b + (hash2(b, a) - 0.5) * sp * 0.35;
    const px = ja * E.x + jb * NORTH.x, pz = ja * E.z + jb * NORTH.z;
    const y = at(px, pz);
    if (y === null) continue;
    const zn = zoneOf('eastbay', px, pz, y);
    const t = tiles.at(px, pz);
    if (zn.town === 'flats') {
      if (inPoly(px, pz, downtown) || r() < 0.12) continue; // the towers' own; a gap here and there
      const k = 0.55 + r() * 0.75, tall = r() < 0.1;
      const w = (20 + r() * 14) * k, d = (17 + r() * 12) * k, h = tall ? 3.5 + r() * 4 : 1.1 + r() * r() * 2.6;
      if (nearRoad(px, pz, 30) < Math.max(w, d) * 0.6 + 4) continue; // never on a freeway (the toll plaza, the Maze)
      const wall = C(HOUSE_WALLS[Math.floor(r() * HOUSE_WALLS.length)]), roof = mixColor(C('#d8d2c7'), C('#b3aea5'), r());
      block(t.toy, px, pz, y, w, d, h, yaw + (r() - 0.5) * 0.2, wall, roof, [tall ? WIN.office : WIN.res, y, -(0.05 + 0.9 * r()), 0], TO_CITY);
      if (r() < 0.45) lights.push({ x: px + (r() - 0.5) * 12, y: y + 1.6, z: pz + (r() - 0.5) * 12, level: 0.45, color: r() < 0.7 ? SODIUM : LED });
    } else if (zn.town === 'hills' && r() < 0.4) {
      // houses among the trees on the lower hills
      block(t.toy, px, pz, y, 7 + r() * 4, 6 + r() * 3, 1.5 + r() * 1.2, yaw + (r() - 0.5) * 0.6, C(HOUSE_WALLS[Math.floor(r() * HOUSE_WALLS.length)]), C(HOUSE_ROOFS[Math.floor(r() * HOUSE_ROOFS.length)]), [WIN.res, y, -(0.05 + 0.9 * r()), 0], TO_CITY);
      if (r() < 0.4) lights.push({ x: px, y: y + 1.8, z: pz, level: 0.4, color: SODIUM });
    }
    if (++n % 80 === 0) yield;
  }
  part('flats');
  // trees: the wooded hills and the parks on the crest
  const wood = C(CITY_PAL.forest), wood2 = C(PAL.pine);
  for (let z = g.originZ; z < g.originZ + g.rows * g.step; z += 28) for (let x = g.originX; x < g.originX + g.cols * g.step; x += 28) {
    const px = x + (hash2(x, z) - 0.5) * 20, pz = z + (hash2(z, x) - 0.5) * 20;
    const y = at(px, pz);
    if (y === null || y < 8) continue;
    const zn = zoneOf('eastbay', px, pz, y);
    if (zn.wood < 0.5 || hash2(px * 0.3, pz * 0.7) > zn.wood * 0.75) continue;
    tree(tiles.at(px, pz).detail, px, y, pz, 6 + hash2(pz, px) * 5, 3.6 + hash2(px, 7) * 2, hash2(px, pz) < 0.6 ? wood : wood2, hash2(pz, 5) * 3);
  }
  part('trees');
  yield;
  // downtown Oakland
  for (const [lat, lng, hm, fm, style] of OAK_TOWERS) {
    const p = projectCity(lat, lng), y = at(p.x, p.z) ?? 0.5;
    const H = Math.max(6, hm * 0.155 + 3.2), w = fm * 0.14 * 1.2;
    const wall = C(style === WIN.glass ? '#b9c7cc' : style === WIN.brick ? '#cdb8a0' : '#e2ddd3');
    const t = tiles.at(p.x, p.z);
    const seed = -(0.05 + 0.9 * r());
    block(t.toy, p.x, p.z, y, w, w * (0.8 + r() * 0.4), H, yaw + (r() - 0.5) * 0.2, wall, shade(wall, 0.9), [style, y, seed, 0]);
    block(t.toy, p.x, p.z, y + H, w * 0.62, w * 0.55, Math.min(3, H * 0.08), yaw, shade(wall, 0.96), shade(wall, 0.85), [style, y, seed, 0]);
    if (hm > 90) lights.push({ x: p.x, y: y + H + 3.4, z: p.z, level: BLINK + r(), color: RED });
  }
  // mid-rise blocks around downtown
  {
    const c = TOWNS.oaklandDowntown.reduce((s, p) => ({ x: s.x + p.x / 4, z: s.z + p.z / 4 }), { x: 0, z: 0 });
    for (let k = 0; k < 46; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 150;
      const px = c.x + Math.cos(a) * d, pz = c.z + Math.sin(a) * d, y = at(px, pz);
      if (y === null || y > 10) continue;
      const H = 4 + r() * 8, w = 9 + r() * 7;
      const wall = C(HOUSE_WALLS[Math.floor(r() * HOUSE_WALLS.length)]);
      block(tiles.at(px, pz).toy, px, pz, y, w, w * (0.7 + r() * 0.5), H, yaw, wall, shade(wall, 0.88), [WIN.office, y, -(0.05 + 0.9 * r()), 0], TO_CITY);
    }
  }
  part('downtown');
  yield;
  // the Port of Oakland: container cranes along the wharves (the board's coast in the port), stacks behind them
  const port = TOWNS.port;
  const cranes: { x: number; z: number; nx: number; nz: number }[] = [];
  const st = g.step;
  for (let j = 1; j < g.rows - 1; j++) for (let i = 1; i < g.cols - 1; i++) {
    const x = g.originX + i * st, z = g.originZ + j * st;
    if (!inPoly(x, z, port)) continue;
    const h = g.h[j * g.cols + i] / 10;
    if (!(h > BOARD_SEA)) continue;
    // a wharf edge: water right beside it
    let wx = 0, wz = 0, wet = 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g.h[(j + dj) * g.cols + i + di] / 10 <= BOARD_SEA) { wx += di; wz += dj; wet++; }
    if (!wet || (wx === 0 && wz === 0)) continue;
    const L = Math.hypot(wx, wz);
    if (cranes.some(c => Math.hypot(c.x - x, c.z - z) < 13)) continue;
    cranes.push({ x, z, nx: wx / L, nz: wz / L });
  }
  const craneCol = C('#e9e4da'), craneRed = C('#c2503f'), dark = C('#5c6166');
  for (const c of cranes.slice(0, 24)) {
    const y = at(c.x, c.z) ?? 0.4;
    const t = tiles.at(c.x, c.z).toy;
    const side = { x: -c.nz, z: c.nx };
    // the portal (four legs), the boom out over the water, the A-frame and the machinery house
    for (const s of [-1, 1]) for (const f of [-1.6, 1.6]) { const l = new THREE.Vector3(c.x + side.x * s * 2 + c.nx * f, y, c.z + side.z * s * 2 + c.nz * f); t.beam(l, l.clone().setY(y + 8.2), 0.45, 0.45, craneCol); }
    const top = y + 8.2;
    t.beam(new THREE.Vector3(c.x - c.nx * 3, top, c.z - c.nz * 3), new THREE.Vector3(c.x + c.nx * 9.5, top, c.z + c.nz * 9.5), 3.6, 0.6, craneRed);
    t.beam(new THREE.Vector3(c.x - c.nx * 1.5, top + 0.3, c.z - c.nz * 1.5), new THREE.Vector3(c.x - c.nx * 1.5, top + 3.4, c.z - c.nz * 1.5), 0.8, 0.8, craneCol);
    block(t, c.x - c.nx * 2.4, c.z - c.nz * 2.4, top + 0.3, 3, 2.2, 1.2, Math.atan2(c.nz, c.nx), dark, craneCol, [0, 0, 0, 0], TO_CITY);
    lights.push({ x: c.x - c.nx * 1.5, y: top + 3.8, z: c.z - c.nz * 1.5, level: BLINK + hash2(c.x, c.z), color: RED });
  }
  part('cranes');
  // container yards: rows of coloured stacks behind each crane, along the wharf
  const boxes = ['#b5473a', '#3f6f8f', '#c98a3a', '#5d7f52', '#8a8f94', '#d2c7b3', '#7a4c6a'];
  for (const c of cranes.slice(0, 24)) {
    const along = { x: -c.nz, z: c.nx }, yaw = Math.atan2(along.z, along.x);
    for (let row = 0; row < 3; row++) for (let k = -1; k <= 1; k++) {
      if (r() < 0.2) continue;
      const back = 10 + row * 4.2, off = k * 6.4 + (r() - 0.5);
      const px = c.x - c.nx * back + along.x * off, pz = c.z - c.nz * back + along.z * off;
      const y = at(px, pz);
      if (y === null || y > 2 || !inPoly(px, pz, port)) continue;
      const col = C(boxes[Math.floor(r() * boxes.length)]);
      block(tiles.at(px, pz).toy, px, pz, y, 5.6, 2.6, 0.9 + Math.floor(r() * 3) * 0.55, yaw, col, shade(col, 1.06), [0, 0, 0, 0], TO_CITY);
    }
  }
  yield;
  part('containers');
  // the Campanile (Sather Tower, 94 m) and the Claremont's white hotel in the hills
  const camp = projectCity(37.8721, -122.2578), cy = at(camp.x, camp.z);
  if (cy !== null) {
    const t = tiles.at(camp.x, camp.z).toy;
    block(t, camp.x, camp.z, cy, 1.8, 1.8, 14, yaw, C('#ece6da'), C('#ece6da'), [0, 0, 0, 0]);
    block(t, camp.x, camp.z, cy + 14, 1.4, 1.4, 1.6, yaw, C('#7e9c8c'), C('#7e9c8c'), [0, 0, 0, 0]);
    lights.push({ x: camp.x, y: cy + 13, z: camp.z, level: 1, color: WHITE });
  }
  const cl = projectCity(37.8597, -122.2436), cly = at(cl.x, cl.z);
  if (cly !== null) {
    const t = tiles.at(cl.x, cl.z).toy;
    block(t, cl.x, cl.z, cly, 12, 5, 4.5, yaw + 0.3, C('#f4f0e6'), C('#8f8a84'), [WIN.res, cly, -0.4, 0]);
    block(t, cl.x, cl.z, cly + 4.5, 3, 3, 3, yaw, C('#f4f0e6'), C('#8f8a84'), [0, 0, 0, 0]);
  }
  part('extras');
}

// ---------------------------------------------------------------------------------------------------------------------
// C2-13: the Bay Bridge east span
// ---------------------------------------------------------------------------------------------------------------------

/** The self-anchored suspension span's tower (research sf-data: the OSM tower) and its spans (m → u at 0.14 u / m). */
export const SAS = { x: 211.0, z: -506.6, top: 34, deck: 10, west: 385 * 0.14, east: 180 * 0.14 } as const;

/** Arc-length parametrised polyline (x, z pairs). */
function polyline(pts: readonly number[]) {
  const s = [0];
  for (let k = 2; k < pts.length; k += 2) s.push(s[s.length - 1] + Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]));
  const L = s[s.length - 1];
  const at = (t: number) => {
    const q = Math.min(L, Math.max(0, t));
    let i = 1;
    while (i < s.length - 1 && s[i] < q) i++;
    const f = (q - s[i - 1]) / (s[i] - s[i - 1] || 1);
    const x = pts[(i - 1) * 2] + (pts[i * 2] - pts[(i - 1) * 2]) * f, z = pts[(i - 1) * 2 + 1] + (pts[i * 2 + 1] - pts[(i - 1) * 2 + 1]) * f;
    const dx = pts[i * 2] - pts[(i - 1) * 2], dz = pts[i * 2 + 1] - pts[(i - 1) * 2 + 1], dl = Math.hypot(dx, dz) || 1;
    return { x, z, dx: dx / dl, dz: dz / dl };
  };
  const nearest = (x: number, z: number) => {
    let best = Infinity, bt = 0;
    for (let t = 0; t <= L; t += 1) { const p = at(t), d = Math.hypot(p.x - x, p.z - z); if (d < best) { best = d; bt = t; } }
    return { t: bt, d: best };
  };
  return { L, at, nearest };
}

/** Chaikin corner cutting (keeps the ends): the OSM decks bend sharply on Yerba Buena. */
export function chaikin(pts: readonly number[], rounds = 2): number[] {
  let p = [...pts];
  for (let r = 0; r < rounds; r++) {
    const q = [p[0], p[1]];
    for (let k = 0; k + 3 < p.length; k += 2) {
      const ax = p[k], az = p[k + 1], bx = p[k + 2], bz = p[k + 3];
      q.push(ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25, ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75);
    }
    q.push(p[p.length - 2], p[p.length - 1]);
    p = q;
  }
  return p;
}

function eastSpan(data: BoardsData, tiles: Tiles, lights: LightSpec[]) {
  const decks = data.index.eastSpan.map(e => polyline(chaikin(e.pts))).filter(p => p.L > 100);
  if (!decks.length) return;
  const white = C('#e6e3dc'), under = C('#b7b3ab'), tower = C('#eeeae2'), cable = C('#d9d6cf');
  const eb = data.grids.find(g => g.id === 'eastbay');
  const ground = (x: number, z: number) => { const h = eb ? boardDem(eb, x, z) : Number.NaN; return h > BOARD_SEA ? terrainY(h) : null; };
  const HALF = 1.7, DEPTH = 0.9;
  for (const d of decks) {
    const tt = d.nearest(SAS.x, SAS.z).t;
    // the touchdown: where this deck reaches the board's land (the Oakland mole)
    let tEnd = d.L;
    for (let t = tt; t <= d.L; t += 2) { const p = d.at(t); if (ground(p.x, p.z) !== null) { tEnd = t; break; } }
    const yEnd = (() => { const p = d.at(tEnd); return (ground(p.x, p.z) ?? 0) + 1.2; })();
    // deck profile: level over the suspension span, then the skyway's long descent to the touchdown
    const yAt = (t: number) => (t <= tt + SAS.east ? SAS.deck : SAS.deck + (yEnd - SAS.deck) * smooth(tt + SAS.east, tEnd, t));
    const tile = tiles.at(d.at(d.L / 2).x, d.at(d.L / 2).z).toy;
    const step = 6;
    // the span starts at the suspension span's west end, on Yerba Buena's shore (the island's own viaduct streams
    // with the city); a pier carries the end down to the island
    const t0 = Math.max(0, tt - SAS.west - 4);
    { const p = d.at(t0); tile.beam(new THREE.Vector3(p.x, -1.2, p.z), new THREE.Vector3(p.x, SAS.deck - DEPTH, p.z), 2.4, 4.2, under); }
    let prev: { x: number; z: number; y: number; nx: number; nz: number } | null = null;
    for (let t = t0; t <= tEnd + 0.01; t += step) {
      const p = d.at(Math.min(t, tEnd)), y = yAt(t), nx = -p.dz, nz = p.dx;
      if (prev) {
        const A = (o: number, h: number) => new THREE.Vector3(prev!.x + prev!.nx * o, prev!.y + h, prev!.z + prev!.nz * o);
        const B = (o: number, h: number) => new THREE.Vector3(p.x + nx * o, y + h, p.z + nz * o);
        tile.quad(A(-HALF, 0), B(-HALF, 0), B(HALF, 0), A(HALF, 0), new THREE.Vector3(0, 1, 0), white);
        for (const s of [-1, 1]) tile.quad(A(s * HALF, 0), B(s * HALF, 0), B(s * HALF, -DEPTH), A(s * HALF, -DEPTH), new THREE.Vector3(nx * s, 0, nz * s), [white, white, under, under]);
        tile.quad(A(-HALF, -DEPTH), B(-HALF, -DEPTH), B(HALF, -DEPTH), A(HALF, -DEPTH), new THREE.Vector3(0, -1, 0), under);
      }
      prev = { x: p.x, z: p.z, y, nx, nz };
      // skyway piers every 24 u (none under the suspension span)
      if (t > tt + SAS.east + 8 && t < tEnd - 6 && Math.round(t) % 24 < step) {
        const gy = ground(p.x, p.z) ?? -1.2;
        tile.beam(new THREE.Vector3(p.x, gy, p.z), new THREE.Vector3(p.x, y - DEPTH, p.z), 1.1, 1.6, under);
      }
      if (Math.round(t) % 12 < step) for (const s of [-1, 1]) lights.push({ x: p.x + nx * s * HALF, y: y + 1.1, z: p.z + nz * s * HALF, level: 0.75, color: LED });
    }
  }
  // the SAS tower between the decks: four tapering legs joined by shear links, and its main cables
  const d0 = decks[0], at0 = d0.at(d0.nearest(SAS.x, SAS.z).t);
  const ax = at0.dx, az = at0.dz, sx = -az, sz = ax;
  const t = tiles.at(SAS.x, SAS.z).toy;
  for (const a of [-0.9, 0.9]) for (const b of [-0.9, 0.9]) {
    const x = SAS.x + ax * a + sx * b, z = SAS.z + az * a + sz * b;
    t.beam(new THREE.Vector3(x, -1.5, z), new THREE.Vector3(SAS.x + ax * a * 0.55 + sx * b * 0.55, SAS.top, SAS.z + az * a * 0.55 + sz * b * 0.55), 0.8, 0.8, tower, [0, 0, 0, 0.12]);
  }
  for (let y = 6; y < SAS.top - 2; y += 5.5) t.beam(new THREE.Vector3(SAS.x - sx * 1.2, y, SAS.z - sz * 1.2), new THREE.Vector3(SAS.x + sx * 1.2, y, SAS.z + sz * 1.2), 0.3, 0.5, tower);
  t.beam(new THREE.Vector3(SAS.x, -1.4, SAS.z), new THREE.Vector3(SAS.x, 1.2, SAS.z), 5, 5, C('#cfc9bd'));
  lights.push({ x: SAS.x, y: SAS.top + 0.8, z: SAS.z, level: BLINK + 0.3, color: RED }, { x: SAS.x, y: 2, z: SAS.z, level: 1, color: WHITE });
  // cables: from the tower top down to each deck's outer edge, west over the main span and east over the back span
  for (const d of decks) {
    const tt = d.nearest(SAS.x, SAS.z).t;
    const p0 = d.at(tt), side = Math.sign((p0.x - SAS.x) * sx + (p0.z - SAS.z) * sz) || 1;
    const top = new THREE.Vector3(SAS.x + sx * side * 0.5, SAS.top - 1, SAS.z + sz * side * 0.5);
    for (const tFar of [tt - SAS.west, tt + SAS.east]) {
      let prevP: THREE.Vector3 | null = null;
      for (let k = 0; k <= 10; k++) {
        // u = 0 at the far end (on the deck's outer edge), 1 at the saddle
        const u = k / 10, p = d.at(tFar + (tt - tFar) * u);
        const ex = p.x + sx * side * (HALF + 0.2), ez = p.z + sz * side * (HALF + 0.2);
        const q = new THREE.Vector3(ex + (top.x - ex) * u * u, SAS.deck + 0.6 + (top.y - SAS.deck - 0.6) * u * u, ez + (top.z - ez) * u * u);
        if (prevP) t.beam(prevP, q, 0.28, 0.28, cable);
        if (k > 0 && k < 10 && k % 2 === 0) t.beam(new THREE.Vector3(q.x, SAS.deck + 0.2, q.z), q, 0.08, 0.08, cable);
        prevP = q;
      }
    }
  }
}
