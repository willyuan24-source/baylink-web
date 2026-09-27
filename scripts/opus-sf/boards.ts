// Offline build of the satellite boards around San Francisco (lane C2-7a, wave 3): Marin at 4 u and the East Bay at
// 8 u from Terrarium z13 tiles, with the Golden Gate Bridge's north end ramped to its 15.2 u deck, the OSM coastline for
// crisp shores and the freeways / the Bay Bridge east span from the OSM backdrop snapshot.
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/boards.ts [--cache <dir>] [--osm <file>] [--out <dir>] [--offline]
//
// --cache    Terrarium PNG cache (default C:/Users/willy/opus-qa/terrarium; tiles are fetched once from
//            s3.amazonaws.com/elevation-tiles-prod/terrarium/13/x/y.png, never with --offline)
// --osm      the OSM backdrop snapshot (default C:/Users/willy/opus-qa/sf-data/raw/osm-backdrop.json: coastline and
//            the motorway bridges of the whole Bay, ODbL)
// --roads    motorway / trunk ways over the boards (default C:/Users/willy/opus-qa/sf-data/raw/osm-boards.json: one
//            Overpass query, `(way["highway"~"^(motorway|trunk)$"](37.70,-122.56,37.91,-122.15););out tags geom;`,
//            fetched 2026-09-27; without the file the boards have no freeways)
// --out      default public/opus-bay/sf/v1/boards (NEW files only: boards.json, marin.obb, eastbay.obb, ATTRIBUTION.md;
//            nothing else in public/opus-bay/sf/v1 is ever touched)
//
// Formats: world/sf/boardData.ts (OBB1, BoardIndex). The script prints the land samples, the heights at Hawk Hill and at
// the bridge's north end, and the triangles of the runtime build (world/sf/boards.ts) against the 40k budget.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PNG } from 'pngjs';
import { demFromY, projectCity, terrainY, unprojectCity } from '../../src/opus-bay/core/geo';
import type { Vec2 } from '../../src/opus-bay/core/types';
import { ANGEL_ISLAND, CITY_BACKDROP } from '../../src/opus-bay/world/backdrop';
import {
  BOARD_NONE, BOARD_SEA, BOARD_SPECS, type BoardGrid, type BoardIndex, type BoardSpec, GGB_NORTH, HAWK_HILL, type BoardRoad,
  boardDem, convexSdf, encodeBoard, worldPolygon,
} from '../../src/opus-bay/world/sf/boardData';
import { AREA_CLASSES, AREA_FLAG, decodeFar, gunzip } from '../../src/opus-bay/world/sf/format';
import { fillRing, makeRaster } from '../../src/opus-bay/world/sf/raster';

const args = Object.fromEntries(process.argv.slice(2).reduce<[string, string | true][]>((acc, cur, i, arr) => {
  if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const REPO = path.resolve(import.meta.dirname, '../..');
const CACHE = String(args.cache ?? 'C:/Users/willy/opus-qa/terrarium');
const OSM = String(args.osm ?? 'C:/Users/willy/opus-qa/sf-data/raw/osm-backdrop.json');
const ROADS = String(args.roads ?? 'C:/Users/willy/opus-qa/sf-data/raw/osm-boards.json');
const OUT = path.resolve(String(args.out ?? path.join(REPO, 'public/opus-bay/sf/v1/boards')));
const OFFLINE = !!args.offline;
const Z = 13;
const URL = (x: number, y: number) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`;
const log = (s: string) => console.log(s);

// ---------------------------------------------------------------------------------------------------------------------
// Terrarium tiles → one Web Mercator mosaic per board
// ---------------------------------------------------------------------------------------------------------------------

const lng2x = (lng: number) => ((lng + 180) / 360) * 2 ** Z;
const lat2y = (lat: number) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** Z; };

async function tile(x: number, y: number): Promise<Float32Array> {
  const file = path.join(CACHE, `z${Z}`, `${x}_${y}.png`);
  if (!fs.existsSync(file)) {
    if (OFFLINE) throw new Error(`missing ${file} (--offline)`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(URL(x, y), { headers: { 'User-Agent': 'OpusBay-boards/1.0 (BAYLINK diorama prototype)' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
        break;
      } catch (e) {
        if (attempt >= 4) throw new Error(`tile ${Z}/${x}/${y}: ${String(e)}`);
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }
  const png = PNG.sync.read(fs.readFileSync(file));
  const out = new Float32Array(256 * 256);
  for (let i = 0; i < 256 * 256; i++) out[i] = png.data[i * 4] * 256 + png.data[i * 4 + 1] + png.data[i * 4 + 2] / 256 - 32768;
  return out;
}

interface Mosaic { x0: number; y0: number; W: number; H: number; h: Float32Array; tiles: number }

async function mosaic(s: BoardSpec): Promise<Mosaic> {
  const x0 = Math.floor(lng2x(s.w)) , x1 = Math.floor(lng2x(s.e)), y0 = Math.floor(lat2y(s.n)), y1 = Math.floor(lat2y(s.s));
  const W = (x1 - x0 + 1) * 256, H = (y1 - y0 + 1) * 256;
  const h = new Float32Array(W * H);
  let tiles = 0;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = await tile(tx, ty);
    tiles++;
    for (let r = 0; r < 256; r++) h.set(t.subarray(r * 256, r * 256 + 256), ((ty - y0) * 256 + r) * W + (tx - x0) * 256);
  }
  return { x0, y0, W, H, h, tiles };
}

/** DEM metres at lat / lng (bilinear on the mosaic's pixel centres). */
function demAt(m: Mosaic, lat: number, lng: number): number {
  const px = (lng2x(lng) - m.x0) * 256 - 0.5, py = (lat2y(lat) - m.y0) * 256 - 0.5;
  const i = Math.min(m.W - 2, Math.max(0, Math.floor(px))), j = Math.min(m.H - 2, Math.max(0, Math.floor(py)));
  const tx = Math.min(1, Math.max(0, px - i)), ty = Math.min(1, Math.max(0, py - j));
  const k = j * m.W + i;
  return (m.h[k] * (1 - tx) + m.h[k + 1] * tx) * (1 - ty) + (m.h[k + m.W] * (1 - tx) + m.h[k + m.W + 1] * tx) * ty;
}

// ---------------------------------------------------------------------------------------------------------------------
// OSM backdrop: coastline (land on the left of every way), motorways, the Bay Bridge east span
// ---------------------------------------------------------------------------------------------------------------------

interface OsmEl { type: string; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }
const osm = JSON.parse(fs.readFileSync(OSM, 'utf8')) as { elements: OsmEl[]; osm_base?: string; fetched?: string };
const toWorld = (g: { lat: number; lon: number }[]) => g.map(p => projectCity(p.lat, p.lon));

/** coastline segments in world space, bucketed on a 64 u grid (land to the left of a → b) */
const COAST_B = 64;
const coast = new Map<number, number[]>();
const bkey = (i: number, j: number) => (i + 1024) * 4096 + (j + 1024);
for (const e of osm.elements) {
  if (e.type !== 'way' || e.tags?.natural !== 'coastline' || !e.geometry) continue;
  const p = toWorld(e.geometry);
  for (let k = 0; k + 1 < p.length; k++) {
    const a = p[k], b = p[k + 1];
    const i0 = Math.floor(Math.min(a.x, b.x) / COAST_B), i1 = Math.floor(Math.max(a.x, b.x) / COAST_B);
    const j0 = Math.floor(Math.min(a.z, b.z) / COAST_B), j1 = Math.floor(Math.max(a.z, b.z) / COAST_B);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      let l = coast.get(bkey(i, j));
      if (!l) { l = []; coast.set(bkey(i, j), l); }
      l.push(a.x, a.z, b.x, b.z);
    }
  }
}

/** Signed distance to the OSM coastline within r (land +), or null when no coastline is that near. */
function coastSdf(x: number, z: number, r: number): number | null {
  let best = Infinity, sign = 0;
  const i0 = Math.floor((x - r) / COAST_B), i1 = Math.floor((x + r) / COAST_B), j0 = Math.floor((z - r) / COAST_B), j1 = Math.floor((z + r) / COAST_B);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const l = coast.get(bkey(i, j));
    if (!l) continue;
    for (let k = 0; k < l.length; k += 4) {
      const ax = l[k], az = l[k + 1], bx = l[k + 2], bz = l[k + 3];
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
      const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / L2));
      const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      if (d < best - 1e-9) {
        best = d;
        // OSM: land on the left of the way. In the city frame (x east-ish, z south-ish: a left-handed x / z view from
        // above), "left" is the side where the 2D cross (b − a) × (p − a) is negative.
        sign = dx * (z - az) - dz * (x - ax) < 0 ? 1 : -1;
      }
    }
  }
  return best <= r ? sign * best : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// the city's own land (never drawn twice) and the other exclusions
// ---------------------------------------------------------------------------------------------------------------------

const far = decodeFar(await gunzip(new Uint8Array(fs.readFileSync(path.join(REPO, 'public/opus-bay/sf/v1/far.obc')))));
const LAND = AREA_CLASSES.indexOf('land');
/** The Golden Gate strait's axis (Lands End / Point Bonita → Alcatraz): Marin lies north of it. */
const GATE = (() => {
  const a = projectCity(37.8035, -122.53), b = projectCity(37.8265, -122.445), m = projectCity(37.8185, -122.4778);
  let nx = -(b.z - a.z), nz = b.x - a.x;
  const L = Math.hypot(nx, nz); nx /= L; nz /= L;
  const north = projectCity(37.85, -122.49);
  if ((north.x - m.x) * nx + (north.z - m.z) * nz < 0) { nx = -nx; nz = -nz; }
  return { nx, nz, d: m.x * nx + m.z * nz };
})();

/** 1 where the city data has land (grown by `grow` samples) on a board grid. */
function cityLand(g: { originX: number; originZ: number; step: number; cols: number; rows: number }, grow: number): Uint8Array {
  const r = makeRaster(g.originX - g.step / 2, g.originZ - g.step / 2, g.originX + (g.cols - 0.5) * g.step, g.originZ + (g.rows - 0.5) * g.step, g.step);
  const m = new Uint8Array(g.cols * g.rows);
  const ar = far.areas;
  for (let i = 0; i < ar.count; i++) if (ar.cls[i] === LAND && !(ar.flags[i] & AREA_FLAG.hole)) fillRing(r, ar.xz, ar.pStart[i], ar.pStart[i + 1], k => { m[k] = 1; });
  for (let n = 0; n < grow; n++) {
    const src = m.slice();
    for (let j = 0; j < g.rows; j++) for (let i = 0; i < g.cols; i++) {
      if (src[j * g.cols + i]) continue;
      for (let dj = -1; dj <= 1 && !m[j * g.cols + i]; dj++) for (let di = -1; di <= 1; di++) {
        const a = i + di, b = j + dj;
        if (a >= 0 && b >= 0 && a < g.cols && b < g.rows && src[b * g.cols + a]) { m[j * g.cols + i] = 1; break; }
      }
    }
  }
  return m;
}

const ANGEL = { ...CITY_BACKDROP['angel-island'], rx: ANGEL_ISLAND.rx * 1.12, rz: ANGEL_ISLAND.rz * 1.12, rot: ANGEL_ISLAND.rot };
function inAngel(x: number, z: number) {
  const c = Math.cos(-ANGEL.rot), s = Math.sin(-ANGEL.rot), dx = x - ANGEL.x, dz = z - ANGEL.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return (lx / ANGEL.rx) ** 2 + (lz / ANGEL.rz) ** 2 < 1;
}

// ---------------------------------------------------------------------------------------------------------------------
// the boards
// ---------------------------------------------------------------------------------------------------------------------

const WORLD = worldPolygon();
/** where the stored value near the coast encodes the OSM coastline: metres per u of distance (below terrainY's 3 m datum) */
const COAST_K = 0.35;
const WATER_DM = -30;

/** The Golden Gate Bridge's north end: a plateau at exactly the deck height, and the ground under the approach deck
 *  kept below it (the real approach crosses Lime Point / Fort Baker on a viaduct and a cut in the hill). */
function ggbEdit(x: number, z: number, h: number): number {
  const G = GGB_NORTH, deck = demFromY(G.y);
  const px = x - G.x, pz = z - G.z;
  const along = px * G.dx + pz * G.dz, across = Math.abs(-px * G.dz + pz * G.dx), d = Math.hypot(px, pz);
  let out = h;
  // under the approach (from the north tower, 102.7 u south of the end, to the end): ≥ 1.6 u of clearance, easing to
  // 0 at the end itself and over 5 → 7 u across the deck line
  if (along > 0 && along < 108 && across < 7) {
    const cap = demFromY(Math.max(0, G.y - 1.6 * Math.min(1, along / 14)));
    const w = 1 - smooth(5, 7, across);
    out = h * (1 - w) + Math.min(h, cap) * w;
  }
  // the plateau (5 u) and the ramp to the natural ground (to 25 u)
  const w = 1 - smooth(5, 25, d);
  if (w > 0) out = out + (deck - out) * w;
  return out;
}
function smooth(e0: number, e1: number, x: number) { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }

/**
 * Water that is not connected to the Bay or the ocean (DEM voids and quarry floors up in the hills) would open a hole
 * down to the sea plane: flood the sea from the open water (bathymetry between −200 and −1 m) and raise every "water"
 * sample it never reaches to the highest land around it.
 */
function fillInlandWater(value: Float32Array, raw: Float32Array, cols: number, rows: number) {
  const n = cols * rows, sea = new Uint8Array(n), queue: number[] = [];
  const wet = (k: number) => !Number.isNaN(value[k]) && value[k] <= BOARD_SEA;
  for (let k = 0; k < n; k++) {
    if (!wet(k)) continue;
    const i = k % cols, j = (k - i) / cols;
    // real bathymetry (terrarium voids decode far below it)
    if (raw[k] < -1 && raw[k] > -200) { sea[k] = 1; queue.push(k); }
  }
  while (queue.length) {
    const k = queue.pop()!, i = k % cols, j = (k - i) / cols;
    for (let d = 0; d < 4; d++) {
      const a = i + [1, -1, 0, 0][d], b = j + [0, 0, 1, -1][d];
      if (a < 0 || b < 0 || a >= cols || b >= rows) continue;
      const q = b * cols + a;
      if (!sea[q] && wet(q)) { sea[q] = 1; queue.push(q); }
    }
  }
  let lakes = 0;
  for (let pass = 0; pass < 64; pass++) {
    let left = 0;
    for (let k = 0; k < n; k++) {
      if (!wet(k) || sea[k]) continue;
      const i = k % cols, j = (k - i) / cols;
      let hi = -Infinity;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const a = i + di, b = j + dj;
        if (a >= 0 && b >= 0 && a < cols && b < rows && value[b * cols + a] > BOARD_SEA) hi = Math.max(hi, value[b * cols + a]);
      }
      if (hi > BOARD_SEA) { value[k] = hi; lakes++; } else left++;
    }
    if (!left) break;
  }
  if (lakes) log(`  ${lakes} inland "water" samples raised to the land around them`);
}

interface Built { grid: BoardGrid; land: number; ms: number; tiles: number }

async function buildBoard(s: BoardSpec): Promise<Built> {
  const t0 = performance.now();
  const m = await mosaic(s);
  // world bbox of the lat / lng region, cut to the world polygon's bbox, snapped to the step
  const corners = [projectCity(s.s, s.w), projectCity(s.s, s.e), projectCity(s.n, s.e), projectCity(s.n, s.w)];
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of corners) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  let wx0 = Infinity, wx1 = -Infinity, wz0 = Infinity, wz1 = -Infinity;
  for (const p of WORLD) { wx0 = Math.min(wx0, p.x); wx1 = Math.max(wx1, p.x); wz0 = Math.min(wz0, p.z); wz1 = Math.max(wz1, p.z); }
  const st = s.step;
  x0 = Math.floor(Math.max(x0, wx0 - 2 * st) / st) * st; z0 = Math.floor(Math.max(z0, wz0 - 2 * st) / st) * st;
  x1 = Math.ceil(Math.min(x1, wx1 + 2 * st) / st) * st; z1 = Math.ceil(Math.min(z1, wz1 + 2 * st) / st) * st;
  const cols = Math.round((x1 - x0) / st) + 1, rows = Math.round((z1 - z0) / st) + 1;
  const grid: BoardGrid = { id: s.id, step: st, originX: x0, originZ: z0, cols, rows, sea: BOARD_SEA, h: new Int16Array(cols * rows) };
  const city = cityLand(grid, 1);
  const raw = new Float32Array(cols * rows);
  const inRegion = (lat: number, lng: number) => lat >= s.s && lat <= s.n && lng >= s.w && lng <= s.e;
  // box filter over the sample footprint (≈ 2 × 2 pixels at 4 u, 4 × 4 at 8 u): no aliasing on the ridges
  const taps = st >= 8 ? [-0.3, 0, 0.3] : [-0.2, 0.2];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = x0 + i * st, z = z0 + j * st, k = j * cols + i;
    const ll = unprojectCity({ x, z });
    if (!inRegion(ll.lat, ll.lng) || convexSdf(WORLD, x, z) < -2 * st) { raw[k] = Number.NaN; continue; }
    let sum = 0, n = 0;
    for (const a of taps) for (const b of taps) { const q = unprojectCity({ x: x + a * st, z: z + b * st }); sum += demAt(m, q.lat, q.lng); n++; }
    raw[k] = sum / n;
  }
  // land / water: the OSM coastline within 3 samples, else the DEM; the city's own land, the other side of the Golden
  // Gate (Marin) and Angel Island (the backdrop's) are water here
  let land = 0;
  const excluded = (x: number, z: number, k: number) => city[k] === 1 || (s.id === 'marin' && (x * GATE.nx + z * GATE.nz < GATE.d || inAngel(x, z)));
  const value = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i, x = x0 + i * st, z = z0 + j * st;
    const h = raw[k];
    if (Number.isNaN(h)) { value[k] = Number.NaN; continue; }
    if (excluded(x, z, k)) { value[k] = -3; continue; }
    const c = coastSdf(x, z, 3 * st);
    let v: number;
    if (c !== null) v = c >= 0 ? Math.max(h, BOARD_SEA + 0.1 + Math.min(2.2, c * COAST_K)) : Math.min(BOARD_SEA - 0.1 + Math.max(-3.5, c * COAST_K), h);
    else v = h > BOARD_SEA ? h : Math.max(-3, Math.min(h, BOARD_SEA - 0.1));
    if (s.id === 'marin') v = ggbEdit(x, z, v);
    value[k] = v;
  }
  fillInlandWater(value, raw, cols, rows);
  for (let k = 0; k < value.length; k++) {
    const v = value[k];
    if (Number.isNaN(v)) { grid.h[k] = BOARD_NONE; continue; }
    if (v > BOARD_SEA) { land++; grid.h[k] = Math.round(v * 10); continue; }
    // open water far from any land compresses to one value
    const i = k % cols, j = (k - i) / cols;
    let near = false;
    for (let dj = -1; dj <= 1 && !near; dj++) for (let di = -1; di <= 1; di++) {
      const a = i + di, b = j + dj;
      if (a >= 0 && b >= 0 && a < cols && b < rows && value[b * cols + a] > BOARD_SEA) { near = true; break; }
    }
    grid.h[k] = near ? Math.max(WATER_DM, Math.round(v * 10)) : WATER_DM;
  }
  return { grid, land, ms: performance.now() - t0, tiles: m.tiles };
}

// ---------------------------------------------------------------------------------------------------------------------
// vectors: the freeways on the boards and the Bay Bridge east span (OSM)
// ---------------------------------------------------------------------------------------------------------------------

/** Douglas–Peucker in x / z. */
function simplify(p: Vec2[], tol: number): Vec2[] {
  if (p.length <= 2) return p;
  const keep = new Uint8Array(p.length);
  keep[0] = keep[p.length - 1] = 1;
  const stack: [number, number][] = [[0, p.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let best = -1, bi = -1;
    const dx = p[b].x - p[a].x, dz = p[b].z - p[a].z, L = Math.hypot(dx, dz) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dx * (p[i].z - p[a].z) - dz * (p[i].x - p[a].x)) / L;
      if (d > best) { best = d; bi = i; }
    }
    if (best > tol) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return p.filter((_, i) => keep[i]);
}

function roadsOn(grids: BoardGrid[]): BoardRoad[] {
  if (!fs.existsSync(ROADS)) { log(`no ${ROADS}: boards without freeways`); return []; }
  const src = JSON.parse(fs.readFileSync(ROADS, 'utf8')) as { elements: OsmEl[] };
  const out: BoardRoad[] = [];
  const onBoard = (p: Vec2) => grids.some(g => boardDem(g, p.x, p.z) > BOARD_SEA);
  for (const e of src.elements) {
    const hw = e.tags?.highway;
    if (e.type !== 'way' || (hw !== 'motorway' && hw !== 'trunk') || !e.geometry || e.tags!.tunnel === 'yes') continue;
    const pts = toWorld(e.geometry);
    // the runs of the way on a board's land (one carriageway: motorways are mapped one way per direction)
    let run: Vec2[] = [];
    const flush = () => { if (run.length >= 2) out.push({ ref: e.tags!.ref ?? '', w: hw === 'motorway' ? 3.2 : 2.6, pts: simplify(run, 1.5).flatMap(q => [Math.round(q.x * 8) / 8, Math.round(q.z * 8) / 8]) }); run = []; };
    for (const p of pts) { if (onBoard(p)) run.push(p); else flush(); }
    flush();
  }
  return out;
}

/** The east span's two decks (OSM I-80 bridge ways east of Yerba Buena), each as one polyline YBI → Oakland. */
function eastSpan(): { pts: number[] }[] {
  const ways = osm.elements.filter(e => e.type === 'way' && e.geometry && e.tags?.bridge === 'yes' && /I 80/.test(e.tags.ref ?? '') && /Bay Bridge/.test(`${e.tags['bridge:name'] ?? ''} ${e.tags.name ?? ''}`) && e.geometry.every(p => p.lon > -122.368 && p.lon < -122.31));
  const lines = ways.map(e => toWorld(e.geometry!));
  // chain the pieces end to end (greedy by nearest endpoint), westbound and eastbound separately
  const chains: Vec2[][] = [];
  const used = new Set<number>();
  for (let s = 0; s < lines.length; s++) {
    if (used.has(s)) continue;
    let chain = [...lines[s]];
    used.add(s);
    for (let grew = true; grew;) {
      grew = false;
      for (let t = 0; t < lines.length; t++) {
        if (used.has(t)) continue;
        const l = lines[t], a = chain[0], b = chain[chain.length - 1];
        const d = (p: Vec2, q: Vec2) => Math.hypot(p.x - q.x, p.z - q.z);
        if (d(b, l[0]) < 0.5) { chain = [...chain, ...l.slice(1)]; used.add(t); grew = true; }
        else if (d(l[l.length - 1], a) < 0.5) { chain = [...l.slice(0, -1), ...chain]; used.add(t); grew = true; }
      }
    }
    chains.push(chain);
  }
  // west → east (toward Oakland: larger x)
  return chains.filter(c => c.length >= 2).map(c => (c[0].x > c[c.length - 1].x ? c.reverse() : c)).sort((a, b) => b.length - a.length).slice(0, 2)
    .map(c => ({ pts: simplify(c, 0.4).flatMap(q => [Math.round(q.x * 8) / 8, Math.round(q.z * 8) / 8]) }));
}

// ---------------------------------------------------------------------------------------------------------------------

fs.mkdirSync(OUT, { recursive: true });
const grids: BoardGrid[] = [];
const index: BoardIndex = {
  version: 1, created: new Date().toISOString(),
  source: `Terrarium z${Z} (AWS Open Data Terrain Tiles); OSM backdrop snapshot ${osm.osm_base ?? osm.fetched ?? ''}`,
  sea: BOARD_SEA, boards: [], ggbNorth: { x: GGB_NORTH.x, z: GGB_NORTH.z, y: GGB_NORTH.y }, roads: [], eastSpan: [],
};
for (const s of BOARD_SPECS) {
  const b = await buildBoard(s);
  const bytes = zlib.gzipSync(Buffer.from(encodeBoard(b.grid)), { level: 9 });
  const file = `${s.id}.obb`;
  fs.writeFileSync(path.join(OUT, file), bytes);
  grids.push(b.grid);
  index.boards.push({ id: s.id, file, bytes: bytes.byteLength, step: s.step, originX: b.grid.originX, originZ: b.grid.originZ, cols: b.grid.cols, rows: b.grid.rows, land: b.land });
  log(`${s.id}: ${b.tiles} tiles, ${b.grid.cols}×${b.grid.rows} at ${s.step} u, ${b.land} land samples, ${(bytes.byteLength / 1024).toFixed(1)} KB, ${b.ms.toFixed(0)} ms`);
}
index.roads = roadsOn(grids);
index.eastSpan = eastSpan();
fs.writeFileSync(path.join(OUT, 'boards.json'), `${JSON.stringify(index)}\n`);
const marin = grids.find(g => g.id === 'marin')!;
log(`roads: ${index.roads.length} runs, ${index.roads.reduce((s, r) => s + r.pts.length / 2, 0)} points; east span: ${index.eastSpan.map(e => e.pts.length / 2).join(' + ')} points`);
log(`GGB north end: ${terrainY(boardDem(marin, GGB_NORTH.x, GGB_NORTH.z)).toFixed(3)} u (deck ${GGB_NORTH.y}); Hawk Hill: ${terrainY(boardDem(marin, HAWK_HILL.x, HAWK_HILL.z)).toFixed(1)} u`);

fs.writeFileSync(path.join(OUT, 'ATTRIBUTION.md'), `# Opus Bay — satellite boards (Marin, East Bay)

Built ${index.created} by \`scripts/opus-sf/boards.ts\` (lane C2-7a). Files: \`boards.json\` (index, freeways, the Bay
Bridge east span), \`marin.obb\` (4 u), \`eastbay.obb\` (8 u); format in \`src/opus-bay/world/sf/boardData.ts\`.

## Sources and licences

- **Terrain**: AWS Open Data Terrain Tiles (Mapzen "terrarium", zoom ${Z}), which include USGS 3DEP / NED (public domain),
  NOAA ETOPO1 / CUDEM and GMRT bathymetry and SRTM. Attribution per https://github.com/tilezen/joerd/blob/master/docs/attribution.md.
- **OpenStreetMap** (the backdrop snapshot ${osm.osm_base ?? ''} and a motorway / trunk query of 2026-09-27): the coastline that sharpens the shores, the freeways
  drawn on the boards and the alignment of the Bay Bridge east span. © OpenStreetMap contributors, Open Database
  License 1.0 (https://www.openstreetmap.org/copyright); these files are a derived database and also ODbL.
- The toy-town dressing (Sausalito houses, Oakland towers, the port cranes, the Berkeley flats, trees) is procedural,
  placed at the runtime from the terrain and a few hand-picked real positions (\`src/opus-bay/world/sf/boards.ts\`).
`);
log(`wrote ${OUT}`);
