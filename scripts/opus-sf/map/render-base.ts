// Base render of the whole board for the painted map (lane H2b, H2b-2): our own geometry, drawn top-down into
// MAP_FRAME (data/mapPaper.ts), 4 × 4 supersampled (raster2d.ts), **no text**. It is the structure the image models
// repaint (H2b-3) and the reference the candidates are registered against (H2b-4).
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/map/render-base.ts [--out C:/Users/willy/opus-qa/w3/h2b/base] [--size 4096]
//
// Writes <out>/base-<size>.png and base-<size/2>.png (RGB), land-<size>.png and land-<size/2>.png (grey: land coverage
// 0..255 — far.obc land rings plus the hero district's land and pier decks; the coast the registration is checked
// against), and base.json (frame, sizes, counts, timings).
//
// Layers, bottom to top: cream table → the board's soft shadow on the table → board water (shallow → deep with the
// distance from the shore, the cooler Pacific west of the Golden Gate) → land → the hero slab (its water, land and
// piers) → areas in file order (parks, grass, forest, sand, plazas, parking, lakes, piers …) → relief shading from the
// far DEM → streets by class → block pads → building shadows → building fronts → roofs (world/sf/look.ts colours, the
// same the 3D city draws) → trees → bridges → the board's glass rim.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { MAP_FRAME } from '../../../src/opus-bay/data/mapPaper';
import { DISTRICT, LAND as HERO_LAND } from '../../../src/opus-bay/data/district';
import {
  AREA_CLASSES, AREA_FLAG, PROP_KINDS, ROAD_CLASSES, ROOFS, STYLES,
  type ChunkData, type FarData, type SfCurrent, type SfManifest, decodeChunkFile, decodeFarFile,
} from '../../../src/opus-bay/world/sf/format';
import { type LookInput, type LookStyle, lookZones, sfLook, zoneAt } from '../../../src/opus-bay/world/sf/look';
import { boardPolygon } from '../../../src/opus-bay/world/sf/water';
import { projectCity } from '../../../src/opus-bay/core/geo';
import { ANGEL_ISLAND, CITY_BACKDROP } from '../../../src/opus-bay/world/backdrop';
import {
  type RGB, Mask, composite, distanceTransform, fillDisc, fillShape, halve, halveBytes, mix, rgb, strokePolyline, toRgba,
} from './raster2d';

const REPO = path.resolve(import.meta.dirname, '../../..');
const arg = (name: string, def: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def; };
const OUT = path.resolve(arg('out', 'C:/Users/willy/opus-qa/w3/h2b/base'));
const N = Number(arg('size', '4096'));

// ---------------------------------------------------------------------------------------------------------------------
// paint (world/palette.ts PAL / CITY_PAL; the map is a little lighter than the 3D ground, like a painted chart)
// ---------------------------------------------------------------------------------------------------------------------

const PAINT = {
  table: rgb('#f3ecdf'),
  tableShadow: rgb('#b9a78a'),
  shallow: rgb('#94d0c8'),
  deep: rgb('#62abab'),
  pacific: rgb('#4b8a98'),
  rimLight: rgb('#e8f4ef'),
  rimDark: rgb('#6f9c98'),
  land: rgb('#ebe2cf'),
  pad: rgb('#e6dcc8'),
  street: rgb('#d9d1c3'),
  streetMajor: rgb('#cdc4b4'),
  motorway: rgb('#b9b1a4'),
  path: rgb('#e4d6bb'),
  shadow: rgb('#6f604c'),
  treeShadow: rgb('#4f5a3a'),
  tree: [rgb('#6f9a5b'), rgb('#7ea463'), rgb('#5f8c4f'), rgb('#88ad6a')] as RGB[],
  pine: rgb('#4d7247'),
  palm: rgb('#7aa65e'),
  pierDeck: rgb('#c9b08c'),
  pierShed: rgb('#e6ddcb'),
  ggb: rgb('#c4553a'),
  bridge: rgb('#b8c0c4'),
};
const AREA_PAINT: Partial<Record<(typeof AREA_CLASSES)[number], RGB>> = {
  water: rgb('#86c8c1'),
  park: rgb('#a6c47f'),
  grass: rgb('#afcb88'),
  forest: rgb('#86ab69'),
  sand: rgb('#efdcad'),
  pier: PAINT.pierDeck,
  plaza: rgb('#eee4d1'),
  parking: rgb('#dcd4c7'),
  golf: rgb('#b2d08c'),
  pitch: rgb('#9cc576'),
  scrub: rgb('#b0c384'),
  rock: rgb('#c4b397'),
};

// ---------------------------------------------------------------------------------------------------------------------
// load
// ---------------------------------------------------------------------------------------------------------------------

const t0 = Date.now();
const SF = path.join(REPO, 'public/opus-bay/sf');
const current = JSON.parse(fs.readFileSync(path.join(SF, 'current.json'), 'utf8')) as SfCurrent;
const BASE = path.join(SF, current.version);
const manifest = JSON.parse(fs.readFileSync(path.join(BASE, 'manifest.json'), 'utf8')) as SfManifest;
const far: FarData = await decodeFarFile(new Uint8Array(fs.readFileSync(path.join(BASE, 'far.obc'))));
const chunks: ChunkData[] = [];
for (const c of manifest.chunks) chunks.push(await decodeChunkFile(new Uint8Array(fs.readFileSync(path.join(BASE, `c/${c.k}.obc`)))));
const tLoad = Date.now() - t0;

// world → px
const F = MAP_FRAME, SX = N / (F.maxX - F.minX), SZ = N / (F.maxZ - F.minZ);
const px = (x: number) => (x - F.minX) * SX;
const pz = (z: number) => (z - F.minZ) * SZ;
const U = SX; // px per world unit
const ringPx = (xz: ArrayLike<number>, s: number, e: number, stride = 2): Float64Array => {
  const out = new Float64Array((e - s) * 2);
  for (let k = s; k < e; k++) { out[(k - s) * 2] = px(xz[k * stride]); out[(k - s) * 2 + 1] = pz(xz[k * stride + stride - 1]); }
  return out;
};
const polyPx = (p: readonly { x: number; z: number }[]) => Float64Array.from(p.flatMap(q => [px(q.x), pz(q.z)]));

const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const img = new Float32Array(N * N * 3);
const layer = new Mask(N, N);
const scratch = new Mask(N, N);
const land = new Mask(N, N);
const counts: Record<string, number> = {};
const count = (k: string, n = 1) => { counts[k] = (counts[k] ?? 0) + n; };

// ---------------------------------------------------------------------------------------------------------------------
// table, board shadow, water
// ---------------------------------------------------------------------------------------------------------------------

for (let i = 0; i < N * N; i++) img.set(PAINT.table, i * 3);

const board = boardPolygon().map(p => ({ x: px(p.x), y: pz(p.z) }));
const segDist = (x: number, y: number, a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
  let t = ((x - a.x) * dx + (y - a.y) * dy) / L2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(a.x + t * dx - x, a.y + t * dy - y);
};
const inPoly = (x: number, y: number, p: { x: number; y: number }[]) => {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if ((p[i].y > y) !== (p[j].y > y) && x < ((p[j].x - p[i].x) * (y - p[i].y)) / (p[j].y - p[i].y) + p[i].x) inside = !inside;
  }
  return inside;
};
{
  // a soft contact shadow, offset toward the lower right (the table light comes from the upper left)
  const off = { x: N * 0.004, y: N * 0.006 }, R = N * 0.012;
  const sh = board.map(p => ({ x: p.x + off.x, y: p.y + off.y }));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (inPoly(x + 0.5, y + 0.5, board)) continue;
    let d = Infinity;
    for (let i = 0; i < sh.length; i++) d = Math.min(d, segDist(x + 0.5, y + 0.5, sh[i], sh[(i + 1) % sh.length]));
    const inside = inPoly(x + 0.5, y + 0.5, sh);
    const a = inside ? 0.34 : 0.34 * Math.max(0, 1 - d / R) ** 2;
    if (a <= 0.002) continue;
    const o = (y * N + x) * 3;
    for (let c = 0; c < 3; c++) img[o + c] += (PAINT.tableShadow[c] - img[o + c]) * a;
  }
}

// the table as it is now: everything is clipped to the board at the end (a few park rings run past the county line)
const tableImg = img.slice();
const boardMask = new Mask(N, N);
fillShape(boardMask, [board.flatMap(p => [p.x, p.y])]);

// land coverage first (the water tint needs the distance from the shore)
const landShapes: Float64Array[][] = [];
{
  const a = far.areas;
  for (let i = 0; i < a.count; i++) {
    if (AREA_CLASSES[a.cls[i]] !== 'land') continue;
    const ring = ringPx(a.xz, a.pStart[i], a.pStart[i + 1]);
    if (a.flags[i] & AREA_FLAG.hole) landShapes[landShapes.length - 1]?.push(ring);
    else landShapes.push([ring]);
  }
  for (const s of landShapes) fillShape(land, s);
  count('landRings', a.count);
}
// Angel Island (Marin County, not in the streamed data): world/backdrop.ts draws it in city mode with islandFn's coast
const ANGEL = (() => {
  const { x, z } = CITY_BACKDROP['angel-island'], A = ANGEL_ISLAND, seed = 8, peak = 1.1, WATER = -0.6;
  const c = Math.cos(-A.rot), sn = Math.sin(-A.rot);
  const wob = (a: number) => 1 + Math.sin(a * 3 + seed) * 0.08 + Math.sin(a * 7 + seed * 2) * 0.04;
  const ring: number[] = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2, t = wob(a) / Math.hypot(Math.cos(a) / A.rx, Math.sin(a) / A.rz);
    const lx = Math.cos(a) * t, lz = Math.sin(a) * t;
    ring.push(px(x + lx * c + lz * sn), pz(z - lx * sn + lz * c));
  }
  const height = (wx: number, wz: number) => {
    const lx = (wx - x) * c - (wz - z) * sn, lz = (wx - x) * sn + (wz - z) * c;
    const r = Math.hypot(lx / A.rx, lz / A.rz) / wob(Math.atan2(lz, lx));
    return r >= 1 ? null : WATER - 0.4 + (A.H + 0.4 - WATER) * Math.pow(1 - r * r, peak);
  };
  return { ring: Float64Array.from(ring), height };
})();
fillShape(land, [ANGEL.ring]);
// the hero slab: inside it, the district's own land (seawall line) replaces the city coast
const slab = polyPx(DISTRICT.slab);
const heroLand = polyPx(HERO_LAND);
const slabMask = new Mask(N, N);
fillShape(slabMask, [slab]);
{
  // land = (city land − slab) ∪ hero land ∪ hero pier decks
  for (let y = slabMask.y0; y <= slabMask.y1; y++) for (let x = slabMask.x0; x <= slabMask.x1; x++) {
    const i = y * N + x;
    land.bits[i] &= ~slabMask.bits[i];
  }
  fillShape(land, [heroLand]);
}
// (pier decks are drawn over the water but are not land: the coast the painting is checked against is the seawall)
const ringArea = (r: ArrayLike<number>) => { let a = 0; for (let i = 0, k = r.length >> 1; i < k; i++) { const j = (i + 1) % k; a += r[i * 2] * r[j * 2 + 1] - r[j * 2] * r[i * 2 + 1]; } return Math.abs(a) / 2 / (U * U); };

// shore distance on a 1/4 grid (in world units)
const Q = 4, NQ = N / Q;
const landQ = new Uint8Array(NQ * NQ);
for (let y = 0; y < NQ; y++) for (let x = 0; x < NQ; x++) {
  let s = 0;
  for (let k = 0; k < Q; k++) for (let j = 0; j < Q; j++) s += land.at(x * Q + j, y * Q + k);
  landQ[y * NQ + x] = s / (Q * Q) > 0.4 ? 1 : 0;
}
const shoreQ = distanceTransform(landQ, NQ, NQ);
const shoreAt = (x: number, y: number) => {
  const gx = Math.min(NQ - 1, Math.max(0, x / Q - 0.5)), gy = Math.min(NQ - 1, Math.max(0, y / Q - 0.5));
  const x0 = Math.floor(gx), y0 = Math.floor(gy), x1 = Math.min(NQ - 1, x0 + 1), y1 = Math.min(NQ - 1, y0 + 1), fx = gx - x0, fy = gy - y0;
  const v = (shoreQ[y0 * NQ + x0] * (1 - fx) + shoreQ[y0 * NQ + x1] * fx) * (1 - fy) + (shoreQ[y1 * NQ + x0] * (1 - fx) + shoreQ[y1 * NQ + x1] * fx) * fy;
  return (v * Q) / U; // world units
};
// Pacific side of the Golden Gate (world/sf/water.ts patchPacific)
const pac = (() => {
  const a = projectCity(37.8199, -122.4783), b = projectCity(37.8083, -122.4756);
  let nx = -(b.z - a.z), nz = b.x - a.x;
  const L = Math.hypot(nx, nz); nx /= L; nz /= L;
  const ocean = projectCity(37.76, -122.53);
  if ((ocean.x - a.x) * nx + (ocean.z - a.z) * nz < 0) { nx = -nx; nz = -nz; }
  return { nx, nz, d: -(a.x * nx + a.z * nz) };
})();
const smooth = (e0: number, e1: number, v: number) => { const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const waterColor = (x: number, y: number): RGB => {
  const d = shoreAt(x + 0.5, y + 0.5);
  let c = mix(PAINT.shallow, PAINT.deep, smooth(2, 45, d));
  const wx = (x + 0.5) / U + F.minX, wz = (y + 0.5) / U + F.minZ;
  const p = smooth(-250, 350, wx * pac.nx + wz * pac.nz + pac.d) * smooth(6, 40, d);
  c = mix(c, PAINT.pacific, p * 0.6);
  return c;
};
composite(img, boardMask, waterColor);
const tWater = Date.now() - t0;

// ---------------------------------------------------------------------------------------------------------------------
// land, hero slab, areas
// ---------------------------------------------------------------------------------------------------------------------

// city land outside the slab (the land mask minus the hero parts is the same coverage)
for (const s of landShapes) fillShape(layer, s);
for (let y = slabMask.y0; y <= slabMask.y1; y++) for (let x = slabMask.x0; x <= slabMask.x1; x++) layer.bits[y * N + x] &= ~slabMask.bits[y * N + x];
composite(img, layer, PAINT.land);
layer.clear();
const forestExtra: Float64Array[] = [];
// the slab's own water (between the piers) and land
composite(img, slabMask, waterColor);
fillShape(layer, [heroLand]);
composite(img, layer, PAINT.land);
layer.clear();
// Angel Island: sand rim, then grass and woods (world/backdrop.ts naturalColor greens), trees stamped later
fillShape(layer, [ANGEL.ring]);
composite(img, layer, AREA_PAINT.sand!);
layer.clear();
{
  const { x, z } = CITY_BACKDROP['angel-island'];
  const inner: number[] = [];
  for (let i = 0; i < ANGEL.ring.length; i += 2) {
    const cx = px(x), cy = pz(z);
    inner.push(cx + (ANGEL.ring[i] - cx) * 0.93, cy + (ANGEL.ring[i + 1] - cy) * 0.93);
  }
  fillShape(layer, [Float64Array.from(inner)]);
  composite(img, layer, rgb('#9fbb78'));
  forestExtra.push(Float64Array.from(inner.map((v, i) => (i % 2 ? pz(z) + (v - pz(z)) * 0.8 : px(x) + (v - px(x)) * 0.8))));
  layer.clear();
}

// areas from the chunks (finer than far), one layer per class in file order; a hole ring cuts the preceding outer ring
const AREA_ORDER = ['plaza', 'parking', 'sand', 'rock', 'park', 'grass', 'golf', 'pitch', 'scrub', 'forest', 'water', 'pier'] as const;
const forest = new Mask(N, N);
for (const r of forestExtra) fillShape(forest, [r]);
for (const cls of AREA_ORDER) {
  const code = AREA_CLASSES.indexOf(cls);
  for (const c of chunks) {
    const a = c.areas;
    let shape: Float64Array[] | null = null;
    const flush = () => { if (shape) fillShape(layer, shape); shape = null; };
    for (let i = 0; i < a.count; i++) {
      if (a.cls[i] !== code) { flush(); continue; }
      const ring = ringPx(a.xz, a.pStart[i], a.pStart[i + 1]);
      if (cls === 'pier' && !(a.flags[i] & AREA_FLAG.hole) && ringArea(ring) < 40) { flush(); continue; } // pilings, dolphins
      if (a.flags[i] & AREA_FLAG.hole) { if (shape) (shape as Float64Array[]).push(ring); }
      else { flush(); shape = [ring]; }
      count(`area:${cls}`);
    }
    flush();
  }
  if (cls === 'forest') forest.or(layer);
  composite(img, layer, AREA_PAINT[cls]!);
  layer.clear();
}
// hero pier decks and sheds
for (const p of DISTRICT.piers) fillShape(layer, [polyPx(p.deck)]);
composite(img, layer, PAINT.pierDeck);
layer.clear();
const tAreas = Date.now() - t0;

// ---------------------------------------------------------------------------------------------------------------------
// relief: heights on an 8 u grid over the frame (the far DEM; Angel Island's dome outside it), gradients by central
// differences at the nodes, bilinear between them (smooth shading, no facets)
// ---------------------------------------------------------------------------------------------------------------------

{
  const dem = far.dem;
  const demAt = (x: number, z: number): number | null => {
    const fx = (x - dem.originX) / dem.step, fz = (z - dem.originZ) / dem.step;
    const i0 = Math.floor(fx), j0 = Math.floor(fz);
    if (i0 < 0 || j0 < 0 || i0 >= dem.cols - 1 || j0 >= dem.rows - 1) return null;
    const tx = fx - i0, tz = fz - j0, k = j0 * dem.cols + i0, y = dem.y;
    return (y[k] * (1 - tx) + y[k + 1] * tx) * (1 - tz) + (y[k + dem.cols] * (1 - tx) + y[k + dem.cols + 1] * tx) * tz;
  };
  const STEP = 8, cols = Math.ceil((F.maxX - F.minX) / STEP) + 1, rows = Math.ceil((F.maxZ - F.minZ) / STEP) + 1;
  const hg = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = F.minX + i * STEP, z = F.minZ + j * STEP;
    hg[j * cols + i] = Math.max(demAt(x, z) ?? 0, ANGEL.height(x, z) ?? 0);
  }
  const gx = new Float32Array(cols * rows), gz = new Float32Array(cols * rows);
  const h = (i: number, j: number) => hg[Math.min(rows - 1, Math.max(0, j)) * cols + Math.min(cols - 1, Math.max(0, i))];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    gx[j * cols + i] = (h(i + 1, j) - h(i - 1, j)) / (2 * STEP);
    gz[j * cols + i] = (h(i, j + 1) - h(i, j - 1)) / (2 * STEP);
  }
  const bil = (g: Float32Array, fx: number, fz: number) => {
    const i0 = Math.min(cols - 2, Math.max(0, Math.floor(fx))), j0 = Math.min(rows - 2, Math.max(0, Math.floor(fz)));
    const tx = Math.min(1, Math.max(0, fx - i0)), tz = Math.min(1, Math.max(0, fz - j0)), k = j0 * cols + i0;
    return (g[k] * (1 - tx) + g[k + 1] * tx) * (1 - tz) + (g[k + cols] * (1 - tx) + g[k + cols + 1] * tx) * tz;
  };
  // light from the upper left of the sheet, 45° up; slopes exaggerated ×3 (toy heights are gentle)
  const L = (() => { const v = [-0.55, 0.9, -0.55]; const n = Math.hypot(...v); return v.map(c => c / n); })();
  const EX = 3, flat = L[1];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const cov = land.at(x, y);
    if (!cov) continue;
    const fx = ((x + 0.5) / U) / STEP, fz = ((y + 0.5) / U) / STEP;
    const dx = bil(gx, fx, fz) * EX, dz = bil(gz, fx, fz) * EX;
    const nl = Math.hypot(dx, 1, dz);
    const lam = (-dx * L[0] + L[1] - dz * L[2]) / nl / flat; // 1 on the flat
    const k = Math.min(1.15, Math.max(0.74, 1 + (lam - 1) * 0.7)) * cov + (1 - cov); // never black on a steep island
    const o = (y * N + x) * 3;
    for (let c = 0; c < 3; c++) img[o + c] = Math.min(1, img[o + c] * (k > 1 ? 1 + (k - 1) * 0.6 : k));
  }
}
const tRelief = Date.now() - t0;

// ---------------------------------------------------------------------------------------------------------------------
// streets (chunk roads, freeway viaducts included; rails and tram tracks are left to the streets they run in)
// ---------------------------------------------------------------------------------------------------------------------

const RC = (n: (typeof ROAD_CLASSES)[number]) => ROAD_CLASSES.indexOf(n);
const STREET_PASSES: { classes: number[]; color: RGB; widthK: number; min: number }[] = [
  { classes: [RC('footway'), RC('path'), RC('cycleway'), RC('track'), RC('steps')], color: PAINT.path, widthK: 0.9, min: 0.45 },
  { classes: [RC('service'), RC('pedestrian')], color: PAINT.street, widthK: 0.8, min: 0.6 },
  { classes: [RC('residential'), RC('tertiary')], color: PAINT.street, widthK: 0.8, min: 0.8 },
  { classes: [RC('primary'), RC('secondary')], color: PAINT.streetMajor, widthK: 0.8, min: 1.1 },
  { classes: [RC('motorway'), RC('trunk')], color: PAINT.motorway, widthK: 0.8, min: 1.3 },
];
for (const pass of STREET_PASSES) {
  for (const c of chunks) {
    const r = c.roads;
    for (let i = 0; i < r.count; i++) {
      if (!pass.classes.includes(r.cls[i])) continue;
      strokePolyline(layer, ringPx(r.xyz, r.pStart[i], r.pStart[i + 1], 3), Math.max(pass.min, (r.width[i] * pass.widthK * U) / 2));
      count('roads');
    }
  }
  composite(img, layer, pass.color);
  layer.clear();
}
// the hero district's roadways and tracks
for (const r of DISTRICT.roads) {
  if (r.kind === 'crosswalk') continue;
  strokePolyline(layer, polyPx(r.points), Math.max(0.8, (r.width * U) / 2));
}
composite(img, layer, PAINT.street);
layer.clear();
const tStreets = Date.now() - t0;

// ---------------------------------------------------------------------------------------------------------------------
// blocks and buildings
// ---------------------------------------------------------------------------------------------------------------------

// block pads (far prisms, kind 0): the sidewalk-coloured ground each block of houses stands on
{
  const p = far.prisms;
  for (let i = 0; i < p.count; i++) if (p.kind[i] === 0) fillShape(layer, [ringPx(p.xz, p.vStart[i], p.vStart[i + 1])]);
  composite(img, layer, PAINT.pad, 0.55);
  layer.clear();
}

interface Bld { ring: Float64Array; H: number; roof: RGB; wall: RGB }
const blds: Bld[] = [];
const zones = lookZones(far);
for (const c of chunks) {
  const b = c.buildings;
  for (let i = 0; i < b.count; i++) {
    const s = b.vStart[i], e = b.vStart[i + 1];
    let area = 0, cx = 0, cz = 0;
    for (let k = s; k < e; k++) {
      const k2 = k + 1 < e ? k + 1 : s;
      area += b.xz[k * 2] * b.xz[k2 * 2 + 1] - b.xz[k2 * 2] * b.xz[k * 2 + 1];
      cx += b.xz[k * 2]; cz += b.xz[k * 2 + 1];
    }
    cx /= e - s; cz /= e - s;
    const pal = manifest.palettes[b.palette[i]] ?? null;
    const input: LookInput = {
      style: STYLES[b.style[i]] as LookStyle, roof: ROOFS[b.roof[i]], pal: pal ? { wall: pal.wall, trim: pal.trim, roof: pal.roof } : null,
      seed: b.osmId[i], area: Math.abs(area) / 2, H: b.height[i], zone: zoneAt(zones, cx, cz), flags: b.flags[i],
    };
    const look = sfLook(input);
    const wall = rgb(look.wall), top = rgb(look.roofColor);
    // from above: the roof, warmed toward the wall colour a little (the city reads white and pastel from Twin Peaks)
    const roof = look.roof === 'flat' ? mix(top, wall, 0.45) : mix(top, wall, 0.15);
    blds.push({ ring: ringPx(b.xz, s, e), H: b.height[i], roof, wall });
  }
}
count('buildings', blds.length);
// hero lots and the district's big landmarks (sheds, the Ferry Building)
const HERO_TOPS = ['#eee7da', '#e2ddd4', '#f0e3cf', '#e7d7cf', '#dde2da', '#e9dcc4', '#d9d4cc'].map(rgb);
for (const lot of DISTRICT.blocks) {
  const wall = rgb(lot.color ?? '#efe3cc');
  const [lx, ly] = [px(lot.footprint[0].x), pz(lot.footprint[0].z)];
  const top = HERO_TOPS[Math.floor(hash(lx, ly) * HERO_TOPS.length) % HERO_TOPS.length];
  blds.push({ ring: polyPx(lot.footprint), H: lot.height, roof: lot.roof && lot.roof !== 'flat' ? mix(rgb('#c9876a'), wall, 0.15) : mix(top, wall, 0.3), wall });
}
for (const p of DISTRICT.piers) if (p.shed) blds.push({ ring: polyPx(p.shed.footprint), H: p.shed.height, roof: PAINT.pierShed, wall: rgb('#d8cdb8') });
for (const l of DISTRICT.landmarks) {
  if (l.collider && 'polygon' in l.collider) blds.push({ ring: polyPx(l.collider.polygon), H: 10, roof: rgb('#eadcc2'), wall: rgb('#d9c7a6') });
}
count('heroBuildings', DISTRICT.blocks.length);

// shadows: one union layer (never darker where two overlap), a sweep of the footprint toward the lower right
const SH = { x: 0.2, y: 0.28 }; // px offset per u of height, ×U
for (const b of blds) {
  const len = b.H * U, steps = Math.min(24, Math.max(1, Math.ceil((len * Math.hypot(SH.x, SH.y)) / 1.2)));
  for (let s = 1; s <= steps; s++) {
    const t = (s / steps) * len;
    const r = new Float64Array(b.ring.length);
    for (let k = 0; k < r.length; k += 2) { r[k] = b.ring[k] + t * SH.x; r[k + 1] = b.ring[k + 1] + t * SH.y; }
    fillShape(layer, [r]);
  }
}
composite(img, layer, PAINT.shadow, 0.26);
layer.clear();
// fronts (a hint of the wall below each roof edge: a short sweep downward), then the roofs
const FRONT = 0.07;
for (const b of blds) {
  const len = Math.min(10, b.H * U * FRONT), steps = Math.max(1, Math.ceil(len / 0.8));
  for (let s = 1; s <= steps; s++) {
    const t = (s / steps) * len;
    const r = new Float64Array(b.ring.length);
    for (let k = 0; k < r.length; k += 2) { r[k] = b.ring[k]; r[k + 1] = b.ring[k + 1] + t; }
    fillShape(scratch, [r]);
  }
  composite(img, scratch, mix(b.wall, rgb('#6b5b48'), 0.22));
  scratch.clear();
  fillShape(scratch, [b.ring]);
  composite(img, scratch, b.roof);
  scratch.clear();
}
const tBuildings = Date.now() - t0;

// ---------------------------------------------------------------------------------------------------------------------
// trees: the city's street and park trees (chunk props) plus a jittered canopy over the forests
// ---------------------------------------------------------------------------------------------------------------------

interface Tree { x: number; y: number; r: number; c: RGB }
const trees: Tree[] = [];
const TREE = PROP_KINDS.indexOf('tree'), PINE = PROP_KINDS.indexOf('pine'), PALM = PROP_KINDS.indexOf('palm');
for (const c of chunks) {
  const p = c.props;
  for (let i = 0; i < p.count; i++) {
    const k = p.kind[i];
    if (k !== TREE && k !== PINE && k !== PALM) continue;
    const x = px(p.xz[i * 2]), y = pz(p.xz[i * 2 + 1]);
    const u = hash(x, y);
    trees.push({ x, y, r: (k === PALM ? 1.0 : k === PINE ? 1.3 : p.variant[i] === 2 ? 1.1 : 1.5) * U * (0.85 + u * 0.3), c: k === PINE ? PAINT.pine : k === PALM ? PAINT.palm : PAINT.tree[Math.floor(u * 4) % 4] });
  }
}
count('propTrees', trees.length);
{
  const spacing = 4.2 * U;
  for (let y = forest.y0; y <= forest.y1; y += spacing) for (let x = forest.x0; x <= forest.x1; x += spacing) {
    const jx = x + (hash(x, y) - 0.5) * spacing * 0.9, jy = y + (hash(y, x) - 0.5) * spacing * 0.9;
    const ix = Math.floor(jx), iy = Math.floor(jy);
    if (ix < 0 || iy < 0 || ix >= N || iy >= N || forest.at(ix, iy) < 0.99) continue;
    const u = hash(jx * 1.3, jy * 0.7);
    trees.push({ x: jx, y: jy, r: (1.5 + u * 0.8) * U, c: u < 0.3 ? PAINT.pine : PAINT.tree[Math.floor(u * 7) % 4] });
  }
}
count('trees', trees.length);
for (const t of trees) fillDisc(layer, t.x + t.r * 0.45, t.y + t.r * 0.6, t.r);
composite(img, layer, PAINT.treeShadow, 0.28);
layer.clear();
for (const t of trees) { fillDisc(scratch, t.x, t.y, t.r); composite(img, scratch, t.c); scratch.clear(); }
// a light dab on each crown (upper left): reads as a rounded toy tree
for (const t of trees) fillDisc(layer, t.x - t.r * 0.3, t.y - t.r * 0.32, t.r * 0.42);
composite(img, layer, rgb('#b9d39a'), 0.35);
layer.clear();
const tTrees = Date.now() - t0;

// ---------------------------------------------------------------------------------------------------------------------
// bridges: the city's deck roads (freeway viaducts) with the streets already; over the water the two landmark bridges
// as the 3D world builds them — the Golden Gate (world/sf/landmarks/golden-gate-bridge.ts frame: deck −230 … +192 along
// the span, towers at ±89.29, 5.3 u deck) in international orange, the Bay Bridge west crossing (world/backdrop.ts
// city mode: from the SF anchorage to the Yerba Buena tunnel portal, 6.8 u deck, towers at W2 / W3 / W5 / W6) silver
// ---------------------------------------------------------------------------------------------------------------------

{
  const ggb = { x0: -865.81, z0: 508.555, yaw: 2.4662 };
  const gp = (s: number, t = 0) => {
    // three.js rotation.y: local (s, 0, t) → world (s cos + t sin, −s sin + t cos)
    const c = Math.cos(ggb.yaw), sn = Math.sin(ggb.yaw);
    return [px(ggb.x0 + s * c + t * sn), pz(ggb.z0 - s * sn + t * c)] as const;
  };
  const bb = DISTRICT.backdrop.find(d => d.kind === 'bay-bridge')!.position, ybi = CITY_BACKDROP['ybi-tunnel'];
  const deck = (m: Mask, a: readonly [number, number], b: readonly [number, number], halfU: number) => strokePolyline(m, [a[0], a[1], b[0], b[1]], halfU * U);
  const gg = new Mask(N, N), bay = new Mask(N, N);
  deck(gg, gp(-230), gp(192), 2.9);
  deck(bay, [px(bb.x), pz(bb.z)], [px(ybi.x), pz(ybi.z)], 3.6);
  // shadows on the water (a sweep toward the lower right: the decks stand 10–15 u above it)
  const sh = new Mask(N, N);
  for (const m of [gg, bay]) {
    for (let y = m.y0; y <= m.y1; y++) for (let x = m.x0; x <= m.x1; x++) {
      const bits = m.bits[y * N + x];
      if (!bits) continue;
      for (let s = 2; s <= 12 * U; s += 1) {
        const tx = Math.round(x + s * 0.55), ty = Math.round(y + s * 0.8);
        if (tx >= N || ty >= N) break;
        sh.bits[ty * N + tx] |= bits;
        sh.touch(tx, ty, tx, ty);
      }
    }
  }
  composite(img, sh, PAINT.shadow, 0.18);
  composite(img, gg, PAINT.ggb);
  composite(img, bay, PAINT.bridge);
  // towers: darker blocks across the deck
  const towers = new Mask(N, N), bayTowers = new Mask(N, N);
  for (const s of [-89.29, 89.29]) deck(towers, gp(s - 1.4, 0), gp(s + 1.4, 0), 4.2);
  const P = CITY_BACKDROP['bay-bridge-piers'];
  const dx = ybi.x - bb.x, dz = ybi.z - bb.z, L = Math.hypot(dx, dz);
  for (const q of [P.w2, P.w3, P.w5, P.w6]) {
    const t = ((q.x - bb.x) * dx + (q.z - bb.z) * dz) / (L * L);
    const cx = bb.x + dx * t, cz = bb.z + dz * t;
    deck(bayTowers, [px(cx - (dx / L) * 1.2), pz(cz - (dz / L) * 1.2)], [px(cx + (dx / L) * 1.2), pz(cz + (dz / L) * 1.2)], 4.6);
  }
  composite(img, towers, mix(PAINT.ggb, rgb('#5a2a1f'), 0.35));
  composite(img, bayTowers, rgb('#8f989d'));
  count('bridges', 2);
}
const tBridges = Date.now() - t0;

// clip to the board
for (let i = 0; i < N * N; i++) {
  const a = boardMask.bits[i] === 0xffff ? 1 : boardMask.at(i % N, (i / N) | 0);
  if (a >= 1) continue;
  for (let c = 0; c < 3; c++) img[i * 3 + c] = tableImg[i * 3 + c] + (img[i * 3 + c] - tableImg[i * 3 + c]) * a;
}
for (let i = 0; i < N * N; i++) land.bits[i] &= boardMask.bits[i];

// ---------------------------------------------------------------------------------------------------------------------
// the board's rim: a light glass edge with a darker line outside it
// ---------------------------------------------------------------------------------------------------------------------

{
  const ring = board.flatMap(p => [p.x, p.y]);
  ring.push(ring[0], ring[1]);
  strokePolyline(layer, ring, N * 0.0012);
  composite(img, layer, PAINT.rimDark, 0.9);
  layer.clear();
  const inset = board.map(p => ({ x: p.x, y: p.y }));
  const cx = inset.reduce((s, p) => s + p.x, 0) / inset.length, cy = inset.reduce((s, p) => s + p.y, 0) / inset.length;
  const k = 1 - (N * 0.0022) / Math.max(...inset.map(p => Math.hypot(p.x - cx, p.y - cy)));
  const r2 = inset.flatMap(p => [cx + (p.x - cx) * k, cy + (p.y - cy) * k]);
  r2.push(r2[0], r2[1]);
  strokePolyline(layer, r2, N * 0.0006);
  composite(img, layer, PAINT.rimLight, 0.75);
  layer.clear();
}

// ---------------------------------------------------------------------------------------------------------------------
// write
// ---------------------------------------------------------------------------------------------------------------------

fs.mkdirSync(OUT, { recursive: true });
const writePng = (file: string, w: number, h: number, data: Uint8Array, grey = false) => {
  const png = new PNG({ width: w, height: h, colorType: grey ? 0 : 2, inputColorType: grey ? 0 : 6, inputHasAlpha: !grey });
  png.data = Buffer.from(data);
  fs.writeFileSync(file, PNG.sync.write(png, { colorType: grey ? 0 : 2, inputColorType: grey ? 0 : 6, inputHasAlpha: !grey }));
};
const landBytes = land.toBytes();
writePng(path.join(OUT, `base-${N}.png`), N, N, toRgba(img, N, N));
writePng(path.join(OUT, `land-${N}.png`), N, N, landBytes, true);
const half = halve(img, N, N);
writePng(path.join(OUT, `base-${N / 2}.png`), N / 2, N / 2, toRgba(half, N / 2, N / 2));
writePng(path.join(OUT, `land-${N / 2}.png`), N / 2, N / 2, halveBytes(landBytes, N, N), true);
const meta = {
  frame: MAP_FRAME, size: N, pxPerUnit: U, sfVersion: current.version, built: new Date().toISOString(),
  counts, ms: { load: tLoad, water: tWater, areas: tAreas, relief: tRelief, streets: tStreets, buildings: tBuildings, trees: tTrees, bridges: tBridges, total: Date.now() - t0 },
};
fs.writeFileSync(path.join(OUT, 'base.json'), JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta));
