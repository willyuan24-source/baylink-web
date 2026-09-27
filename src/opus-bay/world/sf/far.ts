import { CELL, STREET_ROW } from '../../core/geo';
import type { Vec2 } from '../../core/types';
import { C, hash2, mixColor, shade } from '../builder';
import { CITY_PAL } from '../palette';
import { WIN } from '../recipes/shapes';
import { AREA_CLASSES, AREA_FLAG, type FarData, ROAD_CLASSES, demSample } from './format';
import { HILL, type LookZones, asphaltInfo, farPrismColors, hillMix, lookZones, slopeEarth, zoneAt } from './look';
import { CityBatch, GROUND_CITY, type PoolArrays, buildGround, clipOutside, clipPolyline, ribbon } from './mesh';
import { type Raster, chamfer, fillPoly, fillRing, inPoly, makeRaster, pushOutOf, sampleField, sampleNearest, signedDistance } from './raster';

/**
 * The far city (L2, plan §5.3) from far.obc, built once in a stream worker during the arrival cinematic:
 *
 *   per 64 u cell   block prisms + tower boxes (TOY, the averaged wall / roof tints, procedural windows so the whole
 *                   city glows at night) and 16 u ground (GROUND: marching-squares coast, parks / woods / beaches,
 *                   the main streets as ribbons)
 *   lakes           flat water surfaces at their level (Stow Lake, Spreckels, Mountain Lake …): the sea plane cannot
 *                   show through a lake on a hill; every ground tier cuts lakes out
 *   shore texture   R8 distance to land (0 … 24 u) over the city bbox at 2 u — depth tint and foam of the city water;
 *                   the hero district's own land / piers (sent by the main thread) replace the city land inside the slab
 *
 * Pure (three core math only), no DOM.
 */

const A = Object.fromEntries(AREA_CLASSES.map((c, i) => [c, i])) as Record<(typeof AREA_CLASSES)[number], number>;
const R = Object.fromEntries(ROAD_CLASSES.map((c, i) => [c, i])) as Record<(typeof ROAD_CLASSES)[number], number>;
/** far raster (2 u) extent = manifest bbox */
export const FAR_BOX = { x0: -1024, z0: -896, x1: 1536, z1: 2176 } as const;
export const SHORE_MAX = 24;

export interface FarInit {
  slab: Vec2[];
  excludes: { x: number; z: number; r?: number; poly?: Vec2[] }[];
  /** hero land + decks (1) at the slab, from core/terrain's grid, downsampled */
  heroLand?: { x0: number; z0: number; step: number; cols: number; rows: number; data: Uint8Array };
  /** extra land for the shore texture (backdrop islands that are not in the data) */
  islands?: { x: number; z: number; rx: number; rz: number; rot: number }[];
}

export interface FarCell { ix: number; iz: number; toy: PoolArrays | null; ground: PoolArrays | null }
export interface FarResult {
  cells: FarCell[];
  lakes: { position: Float32Array; index: Uint32Array } | null;
  shore: { data: Uint8Array; x0: number; z0: number; step: number; cols: number; rows: number };
  ms: number;
  triangles: number;
}

const P = { none: 0, grass: 4, asphalt: 5, earth: 7 } as const;
const FAR_CLASS: Record<number, string> = { [A.park]: CITY_PAL.park, [A.golf]: CITY_PAL.golf, [A.forest]: CITY_PAL.forest, [A.sand]: CITY_PAL.sand, [A.grass]: CITY_PAL.grass, [A.scrub]: CITY_PAL.scrub };
const LINE_W: Partial<Record<number, number>> = { [R.motorway]: STREET_ROW.motorway, [R.trunk]: STREET_ROW.trunk, [R.primary]: STREET_ROW.primary, [R.secondary]: STREET_ROW.secondary, [R.tertiary]: STREET_ROW.tertiary };
const hexOf = (b: Uint8Array, i: number) => `#${((b[i * 3] << 16) | (b[i * 3 + 1] << 8) | b[i * 3 + 2]).toString(16).padStart(6, '0')}`;

export function buildFar(far: FarData, init: FarInit): FarResult {
  const t0 = performance.now();
  const r = makeRaster(FAR_BOX.x0, FAR_BOX.z0, FAR_BOX.x1, FAR_BOX.z1, 2);
  const n = r.cols * r.rows;
  const land = new Uint8Array(n), cls = new Uint8Array(n), lakeId = new Int16Array(n).fill(-1);
  const ar = far.areas;
  const lakes: { i0: number; i1: number; level: number }[] = [];
  const excl = (x: number, z: number) => init.excludes.some(e => (e.poly ? inPoly(x, z, e.poly) : Math.hypot(x - e.x, z - e.z) < (e.r ?? 0)));
  const landmarkLake = (xz: ArrayLike<number>, i0: number, i1: number) => {
    let cx = 0, cz = 0;
    for (let k = i0; k < i1; k++) { cx += xz[k * 2]; cz += xz[k * 2 + 1]; }
    return i1 > i0 && excl(cx / (i1 - i0), cz / (i1 - i0));
  };
  for (let i = 0; i < ar.count; i++) {
    const k = ar.cls[i], i0 = ar.pStart[i], i1 = ar.pStart[i + 1];
    if (k === A.land) { fillRing(r, ar.xz, i0, i1, j => { land[j] = 1; }); continue; }
    if (k === A.water) {
      // a landmark's own lagoon / basins (Palace of Fine Arts, Sutro Baths) stay ground: the landmark draws the water
      if (!(ar.flags[i] & AREA_FLAG.hole) && landmarkLake(ar.xz, i0, i1)) continue;
      fillRing(r, ar.xz, i0, i1, j => { land[j] = 0; });
      if (ar.flags[i] & AREA_FLAG.hole) continue;
      // lake level: the lowest shore point (DEM smoothed at 16 u → a touch below it)
      let lo = Infinity;
      for (let p = i0; p < i1; p++) lo = Math.min(lo, demSample(far.dem, ar.xz[p * 2], ar.xz[p * 2 + 1]));
      if (lo > 0.3) {
        const id = lakes.length;
        lakes.push({ i0, i1, level: lo - 0.2 });
        fillRing(r, ar.xz, i0, i1, j => { lakeId[j] = id; });
      }
      continue;
    }
    if (ar.flags[i] & AREA_FLAG.hole) fillRing(r, ar.xz, i0, i1, j => { if (cls[j] === k) cls[j] = 0; });
    else fillRing(r, ar.xz, i0, i1, j => { cls[j] = k; });
  }

  // shore distance (sea side): real land outside the slab, the hero's own land / decks inside it, backdrop islands
  const shoreSrc = new Uint8Array(land);
  fillPoly(r, init.slab, j => { shoreSrc[j] = 0; });
  const hl = init.heroLand;
  if (hl) {
    for (let j = 0; j < r.rows; j++) for (let i = 0; i < r.cols; i++) {
      const x = r.x0 + (i + 0.5) * r.step, z = r.z0 + (j + 0.5) * r.step;
      const hi = Math.floor((x - hl.x0) / hl.step), hj = Math.floor((z - hl.z0) / hl.step);
      if (hi < 0 || hj < 0 || hi >= hl.cols || hj >= hl.rows) continue;
      if (!inPoly(x, z, init.slab)) continue;
      shoreSrc[j * r.cols + i] = hl.data[hj * hl.cols + hi];
    }
  }
  for (const is of init.islands ?? []) {
    const c = Math.cos(-is.rot), s = Math.sin(-is.rot);
    const i0 = Math.max(0, Math.floor((is.x - is.rx - r.x0) / r.step)), i1 = Math.min(r.cols - 1, Math.ceil((is.x + is.rx - r.x0) / r.step));
    const j0 = Math.max(0, Math.floor((is.z - is.rx - r.z0) / r.step)), j1 = Math.min(r.rows - 1, Math.ceil((is.z + is.rx - r.z0) / r.step));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = r.x0 + (i + 0.5) * r.step - is.x, z = r.z0 + (j + 0.5) * r.step - is.z;
      const lx = x * c - z * s, lz = x * s + z * c;
      if ((lx / is.rx) ** 2 + (lz / is.rz) ** 2 < 1) shoreSrc[j * r.cols + i] = 1;
    }
  }
  const D = new Float32Array(n);
  for (let i = 0; i < n; i++) D[i] = shoreSrc[i] ? 0 : 1e6;
  chamfer(D, r.cols, r.rows, r.step);
  const shore = new Uint8Array(n);
  for (let i = 0; i < n; i++) shore[i] = Math.round(Math.min(1, D[i] / SHORE_MAX) * 255);

  // ground mask: land minus lakes and the hero slab
  const gm = land;
  fillPoly(r, init.slab, j => { gm[j] = 0; });
  const sdf = signedDistance(gm, r, 48);

  // prisms per cell (by centroid)
  const pr = far.prisms;
  const byCell = new Map<number, number[]>();
  for (let i = 0; i < pr.count; i++) {
    let cx = 0, cz = 0;
    const a = pr.vStart[i], b = pr.vStart[i + 1];
    for (let k = a; k < b; k++) { cx += pr.xz[k * 2]; cz += pr.xz[k * 2 + 1]; }
    cx /= b - a; cz /= b - a;
    if (inPoly(cx, cz, init.slab) || excl(cx, cz)) continue;
    const key = Math.floor(cx / CELL) * 65536 + Math.floor(cz / CELL);
    let l = byCell.get(key);
    if (!l) { l = []; byCell.set(key, l); }
    l.push(i);
  }
  // lines per cell (clipped later)
  const ln = far.lines;
  const lineBox: { i: number; x0: number; z0: number; x1: number; z1: number }[] = [];
  for (let i = 0; i < ln.count; i++) {
    if (LINE_W[ln.cls[i]] === undefined) continue;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let k = ln.pStart[i]; k < ln.pStart[i + 1]; k++) { const x = ln.xyz[k * 3], z = ln.xyz[k * 3 + 2]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    lineBox.push({ i, x0, z0, x1, z1 });
  }

  const cells: FarCell[] = [];
  const zones = lookZones(far);
  let triangles = 0;
  const demAt = (x: number, z: number) => demSample(far.dem, x, z);
  const paint = (x: number, z: number, h: number, slope: number) => {
    const k = sampleNearest(cls, r, x, z);
    let col = C(FAR_CLASS[k] ?? CITY_PAL.land);
    col = mixColor(col, shade(col, 0.93), hash2(Math.floor(x / 16), Math.floor(z / 16)) * 0.5);
    // green hills: the rules of the near tiers (look.ts HILL) on the 16 u grid
    if (!FAR_CLASS[k] && h > HILL.y0) col = mixColor(col, CITY_PAL.hillGrass, hillMix(h));
    if (slope > HILL.slope0) col = mixColor(col, CITY_PAL.earth, slopeEarth(slope));
    return { color: col, pattern: FAR_CLASS[k] ? P.grass : P.earth };
  };
  const slabClamp = pushOutOf([init.slab]);
  const i0c = Math.floor(FAR_BOX.x0 / CELL), i1c = Math.ceil(FAR_BOX.x1 / CELL), j0c = Math.floor(FAR_BOX.z0 / CELL), j1c = Math.ceil(FAR_BOX.z1 / CELL);
  const slabBox = init.slab.reduce((b, p) => ({ x0: Math.min(b.x0, p.x), z0: Math.min(b.z0, p.z), x1: Math.max(b.x1, p.x), z1: Math.max(b.z1, p.z) }), { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity });
  for (let iz = j0c; iz < j1c; iz++) for (let ix = i0c; ix < i1c; ix++) {
    const x0 = ix * CELL, z0 = iz * CELL;
    // any ground in the cell?
    let has = false;
    for (let z = z0; z <= z0 + CELL && !has; z += 8) for (let x = x0; x <= x0 + CELL && !has; x += 8) if (sampleField(sdf, r, x, z) > -12) has = true;
    const prisms = byCell.get(ix * 65536 + iz);
    if (!has && !prisms) continue;
    const g = new CityBatch(512), t = new CityBatch(prisms ? prisms.length * 40 : 16);
    const heroCellAny = !(x0 - 32 > slabBox.x1 || x0 + CELL + 32 < slabBox.x0 || z0 - 32 > slabBox.z1 || z0 + CELL + 32 < slabBox.z0);
    g.clampXZ = heroCellAny ? slabClamp : null;
    if (has) {
      buildGround(g, { x0, z0, size: CELL, step: 16, sdf: (x, z) => sampleField(sdf, r, x, z), height: demAt, paint, lip: 1.4, lipColor: () => C(CITY_PAL.lip), skirt: 5 });
      const heroCell = !(x0 > slabBox.x1 || x0 + CELL < slabBox.x0 || z0 > slabBox.z1 || z0 + CELL < slabBox.z0);
      for (const lb of lineBox) {
        if (lb.x1 < x0 || lb.x0 > x0 + CELL || lb.z1 < z0 || lb.z0 > z0 + CELL) continue;
        const k = ln.cls[lb.i];
        let pieces = clipPolyline(ln.xyz, ln.pStart[lb.i], ln.pStart[lb.i + 1], x0, z0, x0 + CELL, z0 + CELL);
        if (heroCell) pieces = pieces.flatMap(l => clipOutside(l, init.slab, (x, z) => inPoly(x, z, init.slab)));
        const w = (LINE_W[k] ?? STREET_ROW.tertiary as number) * 0.85;
        const col = C(k === R.motorway ? CITY_PAL.motorway : k === R.trunk || k === R.primary ? CITY_PAL.asphaltMajor : CITY_PAL.asphalt);
        const info = asphaltInfo(ROAD_CLASSES[k], w / 2, P.asphalt, GROUND_CITY);
        for (const l of pieces) ribbon(g, l, w, 0.4, col, info, 0, (x, z, y) => Math.max(y, demAt(x, z)));
      }
    }
    if (prisms) for (const i of prisms) prism(t, far, i, heroCellAny ? slabClamp : null, zones);
    const toy = t.toPool(), ground = g.toPool();
    triangles += (toy?.indexCount ?? 0) / 3 + (ground?.indexCount ?? 0) / 3;
    if (toy || ground) cells.push({ ix, iz, toy, ground });
  }

  return { cells, lakes: lakeSurfaces(far, r, lakeId, lakes), shore: { data: shore, x0: r.x0, z0: r.z0, step: r.step, cols: r.cols, rows: r.rows }, ms: performance.now() - t0, triangles };
}

const _pc = { x: 0, z: 0 };
/**
 * One far prism: walls (sunk 1.2 u) with procedural windows and a flat roof in the block's roof tint. A block
 * straddling the hero slab (its centroid outside) stops at the slab edge (`clamp`), the hero owns the inside.
 */
function prism(t: CityBatch, far: FarData, i: number, clamp: CityBatch['clampXZ'], zones: LookZones) {
  const pr = far.prisms;
  const poly: Vec2[] = [];
  let cx = 0, cz = 0;
  for (let k = pr.vStart[i]; k < pr.vStart[i + 1]; k++) {
    cx += pr.xz[k * 2]; cz += pr.xz[k * 2 + 1];
    if (clamp) { clamp(pr.xz[k * 2], pr.xz[k * 2 + 1], _pc); poly.push({ x: _pc.x, z: _pc.z }); } else poly.push({ x: pr.xz[k * 2], z: pr.xz[k * 2 + 1] });
  }
  cx /= poly.length; cz /= poly.length;
  // the SF look (look.ts) from the same tables as L0 / L1: lane A's averaged walls lifted toward the white / pastel
  // city, the top = the neighbourhood's expected mix of flat tops and pitched roofs
  const look = farPrismColors({ wall: hexOf(pr.wallRgb, i), roof: hexOf(pr.roofRgb, i), kind: pr.kind[i], tall: pr.height[i] > 12, zone: zoneAt(zones, cx, cz), u: hash2(cx * 0.37, cz * 0.53) });
  const wall = C(look.wall), roof = C(look.roof);
  const base = pr.baseY[i], top = base + pr.height[i];
  const tower = pr.kind[i] === 1;
  const style = tower ? (pr.height[i] > 20 ? WIN.glass : WIN.office) : pr.height[i] > 9 ? WIN.office : WIN.res;
  const seed = -(0.05 + 0.9 * hash2(poly[0].x, poly[0].z));
  t.walls(poly, base - 1.2, top, wall, [style, base, seed, 0], shade(wall, 0.8));
  t.polygon(poly, top, roof);
  if (tower && pr.height[i] > 14) {
    // a small crown so towers keep their toy silhouette from Twin Peaks
    const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length, cz = poly.reduce((s, p) => s + p.z, 0) / poly.length;
    const up = poly.map(p => ({ x: cx + (p.x - cx) * 0.6, z: cz + (p.z - cz) * 0.6 }));
    t.walls(up, top, top + Math.min(4, pr.height[i] * 0.1), shade(wall, 0.97), [style, base, seed, 0]);
    t.polygon(up, top + Math.min(4, pr.height[i] * 0.1), shade(roof, 1.05));
  }
}

/** Flat lake surfaces (4 u marching squares of each lake, grown 1.5 u under its shore) as one water geometry. */
function lakeSurfaces(far: FarData, r: Raster, lakeId: Int16Array, lakes: { i0: number; i1: number; level: number }[]) {
  if (!lakes.length) return null;
  const m = new Uint8Array(lakeId.length);
  for (let i = 0; i < m.length; i++) m[i] = lakeId[i] >= 0 ? 1 : 0;
  const sdf = signedDistance(m, r, 16);
  const b = new CityBatch(4096);
  lakes.forEach((lk, id) => {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let p = lk.i0; p < lk.i1; p++) { const x = far.areas.xz[p * 2], z = far.areas.xz[p * 2 + 1]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    x0 = Math.floor((x0 - 6) / 4) * 4; z0 = Math.floor((z0 - 6) / 4) * 4;
    const size = Math.ceil((Math.max(x1 - x0, z1 - z0) + 8) / 4) * 4;
    // only this lake (its bbox), flat at its level
    buildGround(b, {
      x0, z0, size, step: 4,
      sdf: (x, z) => { const o = sampleNearest(lakeId, r, x, z); return o >= 0 && o !== id ? -1 : sampleField(sdf, r, x, z) + 1.5; },
      height: () => lk.level,
      paint: () => ({ color: C('#ffffff'), pattern: 0 }),
      lip: 0, lipColor: () => C('#ffffff'), skirt: 0,
    });
  });
  const a = b.toArrays();
  if (!a.vertexCount) return null;
  return { position: a.position, index: Uint32Array.from(a.index) };
}
