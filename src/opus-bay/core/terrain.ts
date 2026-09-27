import { COIT_POS, DISTRICT, LAND, SECTION, STATIONS, at, hillHeight } from '../data/district';
import type { District, Polygon, SurfaceKind, Vec2 } from './types';

/**
 * Pure geometric queries over the district.
 *
 * Everything is rasterised once, on first use, into 0.5 u typed-array grids (walkable surface, ground
 * height, land/water/deck class, "standable" for a 0.45 u disc), so per-frame queries are O(1).
 * Blockers (buildings, sheds, landmark colliders, blocking props) live in a 4 u spatial hash.
 *
 * Height model: Telegraph Hill is analytic (see data/district hillHeight); ramps (Filbert Steps …)
 * interpolate along their corridor and the surrounding hillside is blended into them; walk areas and pier
 * decks with an explicit height are flat. Water cells report the height the land would have (0), so
 * nothing dips at the seawall — use isWater()/isLand() to tell them apart.
 *
 * Walkable = DISTRICT.walk polygons (ground-level paving) ∪ piers with walkable: true (Pier 7, Pier 14,
 * Pier 39 incl. its sea-lion viewing edge, the Fog Bridge, the ferry gangway) ∪ ramp corridors.
 *
 * For actors: heightAt / surfaceAt / groundAt / canStand / blockersNear / pushOutOfBlockers / nearestWalkable,
 * buildNavGrid(cell) for A*. For world: terrainGrid() (height/surface/kind rasters), isLand / isWater, LAND.
 */

// ---------------------------------------------------------------------------
// Polygon helpers
// ---------------------------------------------------------------------------

export function pointInPolygon(p: Vec2, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function segDist2(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  let t = L2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / L2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = px - ax - dx * t, ez = pz - az - dz * t;
  return ex * ex + ez * ez;
}

/** Distance from p to a polygon (0 inside). */
export function distanceToPolygon(x: number, z: number, poly: Polygon): number {
  if (pointInPolygon({ x, z }, poly)) return 0;
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, segDist2(x, z, poly[j].x, poly[j].z, poly[i].x, poly[i].z));
  return Math.sqrt(d);
}

// ---------------------------------------------------------------------------
// Grids
// ---------------------------------------------------------------------------

export const TERRAIN_CELL = 0.5;
/** Surface codes stored in the surface grid (0 = not walkable). */
export const SURFACE_CODES: SurfaceKind[] = ['pavement', 'wood', 'grass', 'sand', 'plaza', 'stairs', 'dirt', 'road'];
const surfCode = (s: SurfaceKind) => SURFACE_CODES.indexOf(s) + 1;
/** Class codes stored in the kind grid. */
export const KIND = { outside: 0, water: 1, land: 2, deck: 3 } as const;
/** Radius used for the precomputed standable grid (nav + nearestWalkable). */
export const STAND_RADIUS = 0.45;
/** Width of the hillside that blends into a ramp corridor. */
const RAMP_BLEND = 3;
const PIER_SURFACE: Record<string, SurfaceKind> = { pier14: 'pavement', 'ferry-gates': 'wood' };

export interface TerrainGrid {
  cell: number;
  minX: number;
  minZ: number;
  cols: number;
  rows: number;
  /** ground height at cell centres */
  height: Float32Array;
  /** 0 = not walkable, else SURFACE_CODES[code − 1] */
  surface: Uint8Array;
  /** KIND codes: 0 outside slab, 1 water, 2 land, 3 pier deck */
  kind: Uint8Array;
  /** 1 where a disc of STAND_RADIUS fits (walkable around, no blockers) */
  stand: Uint8Array;
}

function bboxOf(polys: Polygon[]) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const p of polys) for (const q of p) { if (q.x < minX) minX = q.x; if (q.x > maxX) maxX = q.x; if (q.z < minZ) minZ = q.z; if (q.z > maxZ) maxZ = q.z; }
  return { minX, minZ, maxX, maxZ };
}

/** Even-odd scanline fill: calls fn(index) for every cell whose centre is inside poly. */
function fillPolygon(g: { minX: number; minZ: number; cols: number; rows: number; cell: number }, poly: Polygon, fn: (i: number) => void) {
  const { minX, minZ, cols, rows, cell } = g;
  let pz0 = Infinity, pz1 = -Infinity;
  for (const p of poly) { if (p.z < pz0) pz0 = p.z; if (p.z > pz1) pz1 = p.z; }
  const r0 = Math.max(0, Math.floor((pz0 - minZ) / cell - 0.5)), r1 = Math.min(rows - 1, Math.ceil((pz1 - minZ) / cell - 0.5));
  const xs: number[] = [];
  for (let r = r0; r <= r1; r++) {
    const z = minZ + (r + 0.5) * cell;
    xs.length = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.z > z) !== (b.z > z)) xs.push(a.x + ((z - a.z) * (b.x - a.x)) / (b.z - a.z));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] - minX) / cell - 0.5)), c1 = Math.min(cols - 1, Math.floor((xs[k + 1] - minX) / cell - 0.5));
      for (let c = c0; c <= c1; c++) fn(r * cols + c);
    }
  }
}

let GRID: TerrainGrid | null = null;
let HASH: BlockerHash | null = null;
let BLOCKERS: Blocker[] | null = null;

function district(): District { return DISTRICT; }

function buildGrid(): TerrainGrid {
  const d = district();
  const hill = (x: number, z: number) => hillHeight(x, z, d.hills);
  const bb = bboxOf([d.slab]);
  const cell = TERRAIN_CELL;
  const minX = Math.floor(bb.minX) - 1, minZ = Math.floor(bb.minZ) - 1;
  const cols = Math.ceil((bb.maxX + 1 - minX) / cell), rows = Math.ceil((bb.maxZ + 1 - minZ) / cell);
  const n = cols * rows;
  const g = { minX, minZ, cols, rows, cell };
  const height = new Float32Array(n);
  const surface = new Uint8Array(n);
  const kind = new Uint8Array(n);
  const stand = new Uint8Array(n);

  // class: slab → water, land, decks
  fillPolygon(g, d.slab, i => { kind[i] = KIND.water; });
  fillPolygon(g, LAND, i => { if (kind[i]) kind[i] = KIND.land; });
  for (const p of d.piers) fillPolygon(g, p.deck, i => { if (kind[i] === KIND.water) kind[i] = KIND.deck; });

  // hills
  for (const h of d.hills) {
    const c0 = Math.max(0, Math.floor((h.center.x - h.radiusX - minX) / cell)), c1 = Math.min(cols - 1, Math.ceil((h.center.x + h.radiusX - minX) / cell));
    const r0 = Math.max(0, Math.floor((h.center.z - h.radiusZ - minZ) / cell)), r1 = Math.min(rows - 1, Math.ceil((h.center.z + h.radiusZ - minZ) / cell));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) height[r * cols + c] = hill(minX + (c + 0.5) * cell, minZ + (r + 0.5) * cell);
  }

  // flat walk areas / decks with explicit heights
  for (const w of d.walk) if (w.height !== undefined) { const hh = w.height; fillPolygon(g, w.polygon, i => { height[i] = hh; }); }
  for (const p of d.piers) { const hh = p.deckHeight; fillPolygon(g, p.deck, i => { if (kind[i] === KIND.deck) height[i] = hh; }); }

  // walkable surfaces (later areas win), then walkable pier decks
  for (const w of d.walk) { const code = surfCode(w.surface); fillPolygon(g, w.polygon, i => { if (kind[i]) surface[i] = code; }); }
  for (const p of d.piers) if (p.walkable) { const code = surfCode(PIER_SURFACE[p.id] ?? 'wood'); fillPolygon(g, p.deck, i => { if (kind[i]) surface[i] = code; }); }

  // ramps: corridor heights (nearest segment wins) + hillside blend
  const rampDist = new Float32Array(n).fill(Infinity);
  const rampH = new Float32Array(n);
  const rampSurf = new Uint8Array(n);
  const rampHalf = new Float32Array(n);
  for (const ramp of d.ramps) {
    const half = ramp.width / 2, reach = half + RAMP_BLEND, code = surfCode(ramp.surface);
    for (let s = 1; s < ramp.points.length; s++) {
      const a = ramp.points[s - 1], b = ramp.points[s], ha = ramp.heights[s - 1], hb = ramp.heights[s];
      const c0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - reach - minX) / cell)), c1 = Math.min(cols - 1, Math.ceil((Math.max(a.x, b.x) + reach - minX) / cell));
      const r0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - reach - minZ) / cell)), r1 = Math.min(rows - 1, Math.ceil((Math.max(a.z, b.z) + reach - minZ) / cell));
      const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
      for (let r = r0; r <= r1; r++) {
        const z = minZ + (r + 0.5) * cell;
        for (let c = c0; c <= c1; c++) {
          const x = minX + (c + 0.5) * cell, i = r * cols + c;
          let t = ((x - a.x) * dx + (z - a.z) * dz) / L2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const dist = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
          // compare distances relative to each corridor's own half width so a wider ramp is not shadowed
          if (dist <= reach && dist - half < rampDist[i] - rampHalf[i]) { rampDist[i] = dist; rampHalf[i] = half; rampH[i] = ha + (hb - ha) * t; rampSurf[i] = code; }
        }
      }
    }
  }
  for (let i = 0; i < n; i++) {
    const dist = rampDist[i];
    if (dist === Infinity) continue;
    const half = rampHalf[i];
    if (dist <= half) { height[i] = rampH[i]; if (kind[i]) surface[i] = rampSurf[i]; continue; }
    // blend the hillside toward the corridor (walk areas keep their own height)
    if (surface[i]) continue;
    const t = Math.min(1, (dist - half) / RAMP_BLEND), s = t * t * (3 - 2 * t);
    height[i] = rampH[i] + (height[i] - rampH[i]) * s;
  }

  const grid: TerrainGrid = { cell, minX, minZ, cols, rows, height, surface, kind, stand };
  GRID = grid;
  return grid;
}

let STAND_READY = false;
/** Fill the standable grid for STAND_RADIUS (needs blockers; built lazily for nav / nearestWalkable / terrainGrid). */
function ensureStand(): TerrainGrid {
  const g = GRID ?? buildGrid();
  if (STAND_READY) return g;
  STAND_READY = true;
  const { cols, rows, minX, minZ, cell, surface, stand } = g;
  const hash = blockerHash();
  const o = STAND_RADIUS * 0.7071;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!surface[i]) continue;
      const x = minX + (c + 0.5) * cell, z = minZ + (r + 0.5) * cell;
      if (!walkableAt(x + STAND_RADIUS, z) || !walkableAt(x - STAND_RADIUS, z) || !walkableAt(x, z + STAND_RADIUS) || !walkableAt(x, z - STAND_RADIUS)
        || !walkableAt(x + o, z + o) || !walkableAt(x - o, z + o) || !walkableAt(x + o, z - o) || !walkableAt(x - o, z - o)) continue;
      if (hash.hits(x, z, STAND_RADIUS)) continue;
      stand[i] = 1;
    }
  }
  return g;
}

/** The raw rasterised grids (built on first call). World can use this for the terrain mesh / shoreline. */
export function terrainGrid(): TerrainGrid {
  return ensureStand();
}

function cellIndex(x: number, z: number): number {
  const g = GRID ?? buildGrid();
  const c = Math.floor((x - g.minX) / g.cell), r = Math.floor((z - g.minZ) / g.cell);
  if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return -1;
  return r * g.cols + c;
}
function walkableAt(x: number, z: number) {
  const i = cellIndex(x, z);
  return i >= 0 && GRID!.surface[i] !== 0;
}

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

/** Ground height at (x, z) for rendering and actors (hills, ramps, pier decks). Bilinear, O(1). */
export function heightAt(x: number, z: number): number {
  const g = GRID ?? buildGrid();
  if (CITY !== null && heroIndex(x, z) < 0) return CITY.heightAt(x, z) ?? 0;
  const fx = (x - g.minX) / g.cell - 0.5, fz = (z - g.minZ) / g.cell - 0.5;
  let c = Math.floor(fx), r = Math.floor(fz);
  let tx = fx - c, tz = fz - r;
  if (c < 0) { c = 0; tx = 0; } else if (c >= g.cols - 1) { c = g.cols - 2; tx = 1; }
  if (r < 0) { r = 0; tz = 0; } else if (r >= g.rows - 1) { r = g.rows - 2; tz = 1; }
  const i = r * g.cols + c, h = g.height;
  const a = h[i] + (h[i + 1] - h[i]) * tx;
  const b = h[i + g.cols] + (h[i + g.cols + 1] - h[i + g.cols]) * tx;
  return a + (b - a) * tz;
}

/** Surface under (x, z) if walkable, otherwise null. O(1). */
export function surfaceAt(x: number, z: number): SurfaceKind | null {
  if (CITY !== null) { const c = cityCode(x, z); return c ? SURFACE_CODES[c - 1] : null; }
  const i = cellIndex(x, z);
  if (i < 0) return null;
  const code = GRID!.surface[i];
  return code ? SURFACE_CODES[code - 1] : null;
}

/** Height + surface in one lookup. */
export function groundAt(x: number, z: number): { height: number; surface: SurfaceKind | null } {
  return { height: heightAt(x, z), surface: surfaceAt(x, z) };
}

/** True on the land mass (inside the slab, landward of the seawall). */
export function isLand(x: number, z: number): boolean {
  if (CITY !== null) { const h = heroIndex(x, z); return h >= 0 ? GRID!.kind[h] === KIND.land : CITY.kindAt(x, z) === KIND.land; }
  const i = cellIndex(x, z);
  return i >= 0 && GRID!.kind[i] === KIND.land;
}
/** True over open water inside the slab (not land, not a pier deck). */
export function isWater(x: number, z: number): boolean {
  if (CITY !== null) { const h = heroIndex(x, z); return h >= 0 ? GRID!.kind[h] === KIND.water : CITY.kindAt(x, z) === KIND.water; }
  const i = cellIndex(x, z);
  return i >= 0 && GRID!.kind[i] === KIND.water;
}
/** True inside the diorama slab. */
export function inSlab(x: number, z: number): boolean {
  const i = cellIndex(x, z);
  return i >= 0 && GRID!.kind[i] !== KIND.outside;
}

/**
 * True inside the playable model: the slab in district mode; the slab or the streamed city in city mode
 * (the city provider extends this — call sites in actors/ use inWorld, not inSlab).
 */
export function inWorld(x: number, z: number): boolean {
  if (CITY !== null) return inSlab(x, z) || CITY.kindAt(x, z) !== KIND.outside;
  return inSlab(x, z);
}

/** Highest walkable ground in the model (ground-picker ray bound): district 28 u; the city provider raises it. */
export let MAX_GROUND_Y = 28;
/** Internal: the city terrain provider sets the ceiling when it registers. */
export function setMaxGroundY(y: number) { MAX_GROUND_Y = y; }

// ---------------------------------------------------------------------------
// Blockers
// ---------------------------------------------------------------------------

/** `top` (world y of the wall top) is set on city building blockers in city mode; hero and landmark blockers leave it out. */
export type Blocker = { kind: 'circle'; x: number; z: number; r: number; top?: number } | { kind: 'polygon'; polygon: Polygon; top?: number };

/** Static blocking shapes (buildings, sheds, landmark colliders, blocking props). Cached. */
export function blockers(): Blocker[] {
  if (BLOCKERS) return BLOCKERS;
  const d = district();
  const out: Blocker[] = [];
  for (const l of d.landmarks) {
    if (!l.collider) continue;
    if ('radius' in l.collider) out.push({ kind: 'circle', x: l.position.x, z: l.position.z, r: l.collider.radius });
    else out.push({ kind: 'polygon', polygon: l.collider.polygon });
  }
  for (const p of d.piers) if (p.shed) out.push({ kind: 'polygon', polygon: p.shed.footprint });
  for (const b of d.blocks) out.push({ kind: 'polygon', polygon: b.footprint });
  for (const p of d.props) if (p.blockRadius && !p.pushable) out.push({ kind: 'circle', x: p.x, z: p.z, r: p.blockRadius });
  BLOCKERS = out;
  return out;
}

interface Box { x0: number; z0: number; x1: number; z1: number }
class BlockerHash {
  private cellSize = 4;
  private map = new Map<number, number[]>();
  private boxes: Box[] = [];
  private stamp: Uint32Array;
  private tick = 0;
  private list: Blocker[];
  constructor(list: Blocker[]) {
    this.list = list;
    this.stamp = new Uint32Array(list.length);
    list.forEach((b, i) => {
      const box = b.kind === 'circle' ? { x0: b.x - b.r, z0: b.z - b.r, x1: b.x + b.r, z1: b.z + b.r } : (() => { const bb = bboxOf([b.polygon]); return { x0: bb.minX, z0: bb.minZ, x1: bb.maxX, z1: bb.maxZ }; })();
      this.boxes.push(box);
      for (let cz = Math.floor(box.z0 / this.cellSize); cz <= Math.floor(box.z1 / this.cellSize); cz++) {
        for (let cx = Math.floor(box.x0 / this.cellSize); cx <= Math.floor(box.x1 / this.cellSize); cx++) {
          const key = this.key(cx, cz);
          let arr = this.map.get(key);
          if (!arr) this.map.set(key, (arr = []));
          arr.push(i);
        }
      }
    });
  }
  private key(cx: number, cz: number) { return (cx + 4096) * 8192 + (cz + 4096); }
  /** Blocker indices whose bbox overlaps the disc. */
  near(x: number, z: number, r: number, out: number[] = []): number[] {
    this.tick = (this.tick + 1) >>> 0;
    if (this.tick === 0) { this.stamp.fill(0); this.tick = 1; }
    for (let cz = Math.floor((z - r) / this.cellSize); cz <= Math.floor((z + r) / this.cellSize); cz++) {
      for (let cx = Math.floor((x - r) / this.cellSize); cx <= Math.floor((x + r) / this.cellSize); cx++) {
        const arr = this.map.get(this.key(cx, cz));
        if (!arr) continue;
        for (const i of arr) {
          if (this.stamp[i] === this.tick) continue;
          this.stamp[i] = this.tick;
          const b = this.boxes[i];
          if (x + r < b.x0 || x - r > b.x1 || z + r < b.z0 || z - r > b.z1) continue;
          out.push(i);
        }
      }
    }
    return out;
  }
  hits(x: number, z: number, r: number): boolean {
    const idx = this.near(x, z, r, SCRATCH);
    let hit = false;
    for (let k = 0; k < idx.length && !hit; k++) hit = overlaps(this.list[idx[k]], x, z, r);
    SCRATCH.length = 0;
    return hit;
  }
  get items() { return this.list; }
}
const SCRATCH: number[] = [];

function overlaps(b: Blocker, x: number, z: number, r: number): boolean {
  if (b.kind === 'circle') { const dx = x - b.x, dz = z - b.z, rr = r + b.r; return dx * dx + dz * dz < rr * rr; }
  return distanceToPolygon(x, z, b.polygon) < r;
}

function blockerHash(): BlockerHash {
  return (HASH ??= new BlockerHash(blockers()));
}

/** Blockers whose shape intersects the disc (for actor collision response). */
export function blockersNear(x: number, z: number, r: number): Blocker[] {
  const h = CH?.hash ?? blockerHash();
  const idx = h.near(x, z, r + 0.01, []);
  const out = idx.map(i => h.items[i]).filter(b => overlaps(b, x, z, r));
  if (CITY !== null) CITY.forEachBlockerNear(x, z, r + 0.01, b => { if (overlaps(b, x, z, r)) out.push(b); });
  return out;
}

/** Push a disc out of static blockers (a few relaxation passes). Returns the corrected position. */
export function pushOutOfBlockers(x: number, z: number, r: number): Vec2 {
  let px = x, pz = z;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const b of blockersNear(px, pz, r)) {
      if (b.kind === 'circle') {
        const dx = px - b.x, dz = pz - b.z, L = Math.hypot(dx, dz) || 1e-6, need = r + b.r - L;
        if (need > 0) { px += (dx / L) * need; pz += (dz / L) * need; moved = true; }
      } else {
        // nearest point on the polygon boundary
        let best = Infinity, bx = px, bz = pz;
        const poly = b.polygon;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const ax = poly[j].x, az = poly[j].z, cx = poly[i].x, cz = poly[i].z, dx = cx - ax, dz = cz - az, L2 = dx * dx + dz * dz || 1;
          let t = ((px - ax) * dx + (pz - az) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const qx = ax + dx * t, qz = az + dz * t, dd = (px - qx) ** 2 + (pz - qz) ** 2;
          if (dd < best) { best = dd; bx = qx; bz = qz; }
        }
        const inside = pointInPolygon({ x: px, z: pz }, poly);
        let nx = px - bx, nz = pz - bz, L = Math.hypot(nx, nz);
        if (L < 1e-6) { nx = 1; nz = 0; L = 1; }
        if (inside) { nx = -nx; nz = -nz; }
        const target = r + 0.001;
        const cur = inside ? -L : L;
        if (cur < target) { px = bx + (nx / L) * target; pz = bz + (nz / L) * target; moved = true; }
      }
    }
    if (!moved) break;
  }
  return { x: px, z: pz };
}

// ---------------------------------------------------------------------------
// Standing / navigation
// ---------------------------------------------------------------------------

/** True if a disc of `radius` at (x, z) is on walkable ground and not intersecting blockers. */
export function canStand(x: number, z: number, radius = 0.4): boolean {
  if (!GRID) buildGrid();
  if (CITY !== null) return cityCanStand(x, z, radius);
  if (!walkableAt(x, z)) return false;
  if (radius > 0) {
    const o = radius * 0.7071;
    if (!walkableAt(x + radius, z) || !walkableAt(x - radius, z) || !walkableAt(x, z + radius) || !walkableAt(x, z - radius)
      || !walkableAt(x + o, z + o) || !walkableAt(x - o, z + o) || !walkableAt(x + o, z - o) || !walkableAt(x - o, z - o)) return false;
  }
  return !blockerHash().hits(x, z, Math.max(radius, 0.001));
}

/** Nearest point (cell centre) where a STAND_RADIUS disc fits, searching up to maxDist. */
export function nearestWalkable(p: Vec2, maxDist = 40): Vec2 | null {
  const g = ensureStand();
  if (CITY !== null) return cityNearestWalkable(p, maxDist);
  const c0 = Math.floor((p.x - g.minX) / g.cell), r0 = Math.floor((p.z - g.minZ) / g.cell);
  const maxK = Math.ceil(maxDist / g.cell);
  let best: Vec2 | null = null, bestD = Infinity;
  for (let k = 0; k <= maxK; k++) {
    for (let dr = -k; dr <= k; dr++) {
      for (let dc = -k; dc <= k; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== k) continue;
        const c = c0 + dc, r = r0 + dr;
        if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) continue;
        if (!g.stand[r * g.cols + c]) continue;
        const x = g.minX + (c + 0.5) * g.cell, z = g.minZ + (r + 0.5) * g.cell, d = (x - p.x) ** 2 + (z - p.z) ** 2;
        if (d < bestD) { bestD = d; best = { x, z }; }
      }
    }
    // once found, one more ring can still hold a closer point (diagonal), then stop
    if (best && (k + 1) * g.cell > Math.sqrt(bestD)) break;
  }
  return best;
}

export interface NavGrid {
  cell: number;
  minX: number;
  minZ: number;
  cols: number;
  rows: number;
  /** 1 = a STAND_RADIUS disc fits at the cell centre */
  walkable: Uint8Array;
  /** ground height at cell centres (for step costs) */
  heights: Float32Array;
}

/** Walkability grid for A* (cell size in world units). Derived from the precomputed standable grid. */
export function buildNavGrid(cell = 1): NavGrid {
  const g = ensureStand();
  const cols = Math.ceil((g.cols * g.cell) / cell), rows = Math.ceil((g.rows * g.cell) / cell);
  const walkable = new Uint8Array(cols * rows), heights = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = g.minX + (c + 0.5) * cell, z = g.minZ + (r + 0.5) * cell;
      const gc = Math.floor((x - g.minX) / g.cell), gr = Math.floor((z - g.minZ) / g.cell);
      if (gc < 0 || gr < 0 || gc >= g.cols || gr >= g.rows) continue;
      const i = gr * g.cols + gc;
      walkable[r * cols + c] = g.stand[i];
      heights[r * cols + c] = g.height[i];
    }
  }
  return { cell, minX: g.minX, minZ: g.minZ, cols, rows, walkable, heights };
}

/** Zone (top-left place label) containing (x, z): first match wins. */
export function zoneAt(x: number, z: number): District['zones'][number] | null {
  if (CITY !== null) return cityZoneAt(x, z);
  for (const zone of district().zones) if (pointInPolygon({ x, z }, zone.polygon)) return zone;
  return null;
}

/** City mode: hero zones (the catch-all last one only on the hero waterfront core), then the city neighbourhood. */
function cityZoneAt(x: number, z: number): District['zones'][number] | null {
  const zones = district().zones, last = zones.length - 1, p = { x, z };
  for (let k = 0; k < last; k++) if (pointInPolygon(p, zones[k].polygon)) return zones[k];
  const i = heroIndex(x, z);
  if (i >= 0 && CH!.core[i] && pointInPolygon(p, zones[last].polygon)) return zones[last];
  return CITY!.zoneAt?.(x, z) ?? (i >= 0 && pointInPolygon(p, zones[last].polygon) ? zones[last] : null);
}

// ---------------------------------------------------------------------------
// City mode: the streamed San Francisco around the hero (plan §5.1 seam rules, §5.6)
// ---------------------------------------------------------------------------
//
// District mode never registers a provider, so every query above keeps its exact district behaviour (one null
// check). With a provider (setCityTerrain), each query dispatches on the hero grid:
// - on the hero slab (grid cell with kind ≠ outside) → the hero rasters above, extended for city mode:
//   · heights: always the hero's (seam rule 2 — the published city DEM already blends from the hero edge over 40 u);
//   · surfaces: hero surfaces first; then the landward Embarcadero sidewalk and the stop crosswalks carried across the
//     tracks and south lanes (so the waterfront connects to the city); then every other hero land cell outside the
//     hero core (the waterfront strip seaward of the building line incl. the Embarcadero roadway — a barrier except at
//     crosswalks —, Pioneer Park around Coit, Levi's Plaza) is walkable: hero street corridors as 'road', the rest
//     'pavement' — unless steeper than CITY_MAX_GRADE or inside a kept hero lot (seam rule 4);
//   · blockers: hero blockers minus `heroDropLots` (the city's seam-block buildings stand there), plus city blockers;
// - elsewhere → the city provider (not resident → height from the far DEM, not walkable, standAt −1).
// Call setCityTerrain after the hero World is built (world/ground builds from district-mode surfaceAt).

/** The streamed city's terrain (core/sfTerrain createCityTerrain implements it). */
export interface CityTerrain {
  /** ground height (far 16 u DEM where no chunk is resident), or null when nothing is known there */
  heightAt(x: number, z: number): number | null;
  /** SURFACE_CODES index + 1 (0 = not walkable or not resident) */
  surfaceCode(x: number, z: number): number;
  /** KIND code (outside = beyond the city model) */
  kindAt(x: number, z: number): number;
  /** 1 = a STAND_RADIUS disc fits, 0 = not, −1 = chunk not resident (counts as blocked) */
  standAt(x: number, z: number): 0 | 1 | -1;
  /** blockers whose bbox meets the disc (callers test the exact shape) */
  forEachBlockerNear(x: number, z: number, r: number, fn: (b: Blocker) => void): void;
  /** true if a disc of radius r overlaps any city blocker */
  hitsBlocker(x: number, z: number, r: number): boolean;
  /** true if a city blocker lies within STAND_RADIUS of the 0.5 u cell at (x, z) (raster bit; false when not resident) */
  blockedAt(x: number, z: number): boolean;
  /**
   * Fast bulk fill of a regular grid (cell centres minX + (c + 0.5)·cell): walk = raw stand bits of the 0.5 u cell
   * (1 = a STAND_RADIUS disc fits, 2 = a blocker within STAND_RADIUS; 0 where not resident), heights = ground height.
   */
  fillGrid?(minX: number, minZ: number, cell: number, cols: number, rows: number, walk: Uint8Array, heights: Float32Array): void;
  /** neighbourhood zone (DataSF), shaped like a DISTRICT zone */
  zoneAt?(x: number, z: number): District['zones'][number] | null;
  /** chunk attach / detach notifications */
  onChange?(fn: (cx: number, cz: number) => void): () => void;
}

/** MAX_GROUND_Y in city mode (Twin Peaks ≈ 50 u, landmark decks and towers) */
export const CITY_MAX_GROUND_Y = 120;
const DISTRICT_MAX_GROUND_Y = MAX_GROUND_Y;
/** steeper hero ground (not stairs) is never a city-mode fallback surface */
const CITY_MAX_GRADE = 0.9;

interface CityHero {
  /** surface codes on the hero grid in city mode */
  surf: Uint8Array;
  /** 1 where a STAND_RADIUS disc fits (city-mode surfaces, hero blockers minus dropped lots; off-slab neighbours count as walkable) */
  stand: Uint8Array;
  /** 1 = hero core (no city-mode fallback surface) */
  core: Uint8Array;
  /** hero blockers minus heroDropLots */
  hash: BlockerHash;
}

let CITY: CityTerrain | null = null;
let CH: CityHero | null = null;
let CITY_EPOCH = 0;
const CHUNK_EPOCH = new Map<number, number>();
let CITY_UNSUB: (() => void) | null = null;
const chunkKeyN = (cx: number, cz: number) => (cx + 1024) * 4096 + (cz + 1024);

/**
 * Register (or clear, with null) the city provider. `heroDropLots` are DISTRICT.blocks indices hidden in city mode
 * (manifest.heroDropLots); `heroCore` overrides the default hero-core mask (seam rule 4).
 */
export function setCityTerrain(t: CityTerrain | null, o: { heroDropLots?: Set<number>; heroCore?: (x: number, z: number) => boolean } = {}): void {
  CITY_UNSUB?.();
  CITY_UNSUB = null;
  CITY = null;
  CH = null;
  CITY_EPOCH++;
  CHUNK_EPOCH.clear();
  setMaxGroundY(t ? CITY_MAX_GROUND_Y : DISTRICT_MAX_GROUND_Y);
  if (!t) return;
  CH = buildCityHero(o.heroDropLots ?? new Set(), o.heroCore);
  CITY = t;
  CITY_UNSUB = t.onChange?.((cx, cz) => { CITY_EPOCH++; CHUNK_EPOCH.set(chunkKeyN(cx, cz), CITY_EPOCH); }) ?? null;
}

/** The registered city provider (null in district mode). */
export function cityTerrain(): CityTerrain | null { return CITY; }
/** Bumped on every provider change (register / chunk attach / detach). */
export function cityEpoch(): number { return CITY_EPOCH; }
/** Epoch of the last change of one 128 u chunk (0 if never). */
export function cityChunkEpoch(cx: number, cz: number): number { return CHUNK_EPOCH.get(chunkKeyN(cx, cz)) ?? 0; }

function circlePoly(c: Vec2, r: number, seg = 32): Polygon {
  const out: Polygon = [];
  for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2; out.push({ x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r }); }
  return out;
}
/** Strip in (station, offset) space along the waterfront, as consecutive quads. */
function forStrip(st0: number, st1: number, d0: number, d1: number, fn: (q: Polygon) => void, step = 2) {
  for (let st = st0; st < st1; st += step) {
    const s1 = Math.min(st1, st + step);
    fn([at(st, d0), at(s1, d0), at(s1, d1), at(st, d1)]);
  }
}

function buildCityHero(drop: Set<number>, heroCore?: (x: number, z: number) => boolean): CityHero {
  const g = ensureStand();
  const d = district();
  const { cols, rows, minX, minZ, cell, kind, surface, height } = g;
  const n = cols * rows;
  const PAVE = surfCode('pavement'), ROAD = surfCode('road');
  const surf = surface.slice();

  // 1. city-mode walk additions: landward sidewalk, stop crosswalks across the tracks + south lanes, and the waterfront
  //    walk continued past the hero's two ends (land cells only)
  const add = (q: Polygon) => fillPolygon(g, q, i => { if (kind[i] === KIND.land && !surf[i]) surf[i] = PAVE; });
  forStrip(-60, 460, SECTION.sidewalk[0], SECTION.buildingLine - 0.4, add);
  for (const st of [STATIONS.stopFerry, STATIONS.stopGreen, STATIONS.stopBay, STATIONS.stopPier39]) forStrip(st - 1.6, st + 1.6, SECTION.platform[1] + 0.1, SECTION.sidewalk[0] - 0.4, add, 3.2);
  forStrip(-60, STATIONS.east - 18, SECTION.promenade[0], SECTION.seawall, add);
  forStrip(STATIONS.west - 2, 460, SECTION.promenade[0], SECTION.seawall, add);

  // 2. hero core: no fallback surface there
  const core = new Uint8Array(n);
  if (heroCore) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (kind[i] === KIND.land && heroCore(minX + (c + 0.5) * cell, minZ + (r + 0.5) * cell)) core[i] = 1;
    }
  } else {
    forStrip(-80, 480, SECTION.buildingLine, SECTION.seawall + 8, q => fillPolygon(g, q, i => { core[i] = 1; }));
    fillPolygon(g, circlePoly(COIT_POS, 16), i => { core[i] = 1; });
    for (const w of d.walk) if (w.id === 'levis-plaza' || w.id === 'levis-lawn') fillPolygon(g, w.polygon, i => { core[i] = 1; });
  }

  // 3. fallback: every other hero land cell — street corridors 'road', the rest 'pavement' — unless steep
  const street = new Uint8Array(n);
  for (const road of d.roads) {
    if (!(road.kind === 'roadway' || road.kind === 'path') || road.id.startsWith('embarcadero')) continue;
    const half = road.width / 2;
    for (let s = 1; s < road.points.length; s++) {
      const a = road.points[s - 1], b = road.points[s];
      const c0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - half - minX) / cell)), c1 = Math.min(cols - 1, Math.ceil((Math.max(a.x, b.x) + half - minX) / cell));
      const r0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - half - minZ) / cell)), r1 = Math.min(rows - 1, Math.ceil((Math.max(a.z, b.z) + half - minZ) / cell));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        if (segDist2(minX + (c + 0.5) * cell, minZ + (r + 0.5) * cell, a.x, a.z, b.x, b.z) <= half * half) street[r * cols + c] = 1;
      }
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (surf[i] || kind[i] !== KIND.land || core[i]) continue;
      const cl = c > 0 ? i - 1 : i, cr = c < cols - 1 ? i + 1 : i, ru = r > 0 ? i - cols : i, rd = r < rows - 1 ? i + cols : i;
      const gx = (height[cr] - height[cl]) / ((cr - cl) * cell || 1), gz = (height[rd] - height[ru]) / (((rd - ru) / cols) * cell || 1);
      if (gx * gx + gz * gz > CITY_MAX_GRADE * CITY_MAX_GRADE) continue;
      surf[i] = street[i] ? ROAD : PAVE;
    }
  }

  // 4. kept hero lots are solid; dropped lots leave their ground to the city's seam buildings
  const dropped = new Set<Polygon>();
  d.blocks.forEach((b, i) => { if (drop.has(i)) dropped.add(b.footprint); else fillPolygon(g, b.footprint, k => { if (!surface[k]) surf[k] = 0; }); });
  const hash = new BlockerHash(blockers().filter(b => !(b.kind === 'polygon' && dropped.has(b.polygon))));

  // 5. stand for STAND_RADIUS (8 neighbours walkable; neighbours off the slab are the city's call)
  const stand = new Uint8Array(n);
  const open = (i: number) => kind[i] === KIND.outside || surf[i] !== 0;
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const i = r * cols + c;
      if (!surf[i]) continue;
      if (!open(i - 1) || !open(i + 1) || !open(i - cols) || !open(i + cols) || !open(i - cols - 1) || !open(i - cols + 1) || !open(i + cols - 1) || !open(i + cols + 1)) continue;
      if (hash.hits(minX + (c + 0.5) * cell, minZ + (r + 0.5) * cell, STAND_RADIUS)) continue;
      stand[i] = 1;
    }
  }
  return { surf, stand, core, hash };
}

/** Hero-grid index of (x, z) when it lies on the hero slab (city mode), else −1. */
function heroIndex(x: number, z: number): number {
  const g = GRID!;
  const c = Math.floor((x - g.minX) / g.cell), r = Math.floor((z - g.minZ) / g.cell);
  if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return -1;
  const i = r * g.cols + c;
  return g.kind[i] !== KIND.outside ? i : -1;
}

function cityCode(x: number, z: number): number {
  const i = heroIndex(x, z);
  return i >= 0 ? CH!.surf[i] : CITY!.surfaceCode(x, z);
}

function cityCanStand(x: number, z: number, radius: number): boolean {
  if (!cityCode(x, z)) return false;
  if (radius > 0) {
    const o = radius * 0.7071;
    if (!cityCode(x + radius, z) || !cityCode(x - radius, z) || !cityCode(x, z + radius) || !cityCode(x, z - radius)
      || !cityCode(x + o, z + o) || !cityCode(x - o, z + o) || !cityCode(x + o, z - o) || !cityCode(x - o, z - o)) return false;
  }
  const r = Math.max(radius, 0.001);
  return !CH!.hash.hits(x, z, r) && !CITY!.hitsBlocker(x, z, r);
}

/** STAND_RADIUS standable at the 0.5 u cell containing (x, z): 1 / 0, or −1 when that city chunk is not resident. */
function cityStand(x: number, z: number): 0 | 1 | -1 {
  const i = heroIndex(x, z);
  if (i >= 0) return CH!.stand[i] === 1 && !CITY!.blockedAt(x, z) ? 1 : 0;
  return CITY!.standAt(x, z);
}

/**
 * STAND_RADIUS standable at the 0.5 u cell containing (x, z) (precomputed rasters, O(1)): 1 / 0, or −1 in city mode
 * where the city chunk is not resident.
 */
export function standAt(x: number, z: number): 0 | 1 | -1 {
  if (CITY !== null) return cityStand(x, z);
  const g = ensureStand();
  const i = cellIndex(x, z);
  return i >= 0 && g.stand[i] ? 1 : 0;
}

/**
 * City mode: the ground at (x, z) — and, with r > 0, at four rim points r away — belongs to a city chunk that is not
 * resident (standAt −1): unknown, not blocked. Walkers pause their stuck timers there and never unstick onto the Ferry
 * gate; vehicles slow down instead of bumping (lane E2, checkpoint CS-4 / E2-14). Always false in district mode.
 */
export function groundPending(x: number, z: number, r = 0): boolean {
  if (CITY === null) return false;
  if (cityStand(x, z) === -1) return true;
  return r > 0 && (cityStand(x + r, z) === -1 || cityStand(x - r, z) === -1 || cityStand(x, z + r) === -1 || cityStand(x, z - r) === -1);
}

function cityNearestWalkable(p: Vec2, maxDist: number): Vec2 | null {
  const cell = TERRAIN_CELL, c0 = Math.floor(p.x / cell), r0 = Math.floor(p.z / cell), maxK = Math.ceil(maxDist / cell);
  let best: Vec2 | null = null, bestD = Infinity;
  for (let k = 0; k <= maxK; k++) {
    for (let dr = -k; dr <= k; dr++) {
      const edge = dr === -k || dr === k;
      for (let dc = -k; dc <= k; dc += edge || k === 0 ? 1 : 2 * k) {
        const x = (c0 + dc + 0.5) * cell, z = (r0 + dr + 0.5) * cell;
        if (cityStand(x, z) !== 1) continue;
        const dd = (x - p.x) ** 2 + (z - p.z) ** 2;
        if (dd < bestD) { bestD = dd; best = { x, z }; }
      }
    }
    if (best && (k + 1) * cell > Math.sqrt(bestD)) break;
  }
  return best;
}

/**
 * City mode: fill a nav grid (cell centres minX + (c + 0.5)·cell, …) with standable cells (1 / 0) and ground heights —
 * the provider's bulk fill for the city, the city-mode hero rasters on the slab. actors/nav builds its window with this.
 */
export function fillCityNavGrid(g: NavGrid): void {
  if (!CITY || !CH) throw new Error('fillCityNavGrid: no city terrain registered');
  const { minX, minZ, cell, cols, rows, walkable, heights } = g;
  const n = cols * rows;
  // walkable holds raw stand bits first (1 = stand, 2 = a city blocker within STAND_RADIUS)
  if (CITY.fillGrid) CITY.fillGrid(minX, minZ, cell, cols, rows, walkable, heights);
  else {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = minX + (c + 0.5) * cell, z = minZ + (r + 0.5) * cell, k = r * cols + c;
      walkable[k] = (CITY.standAt(x, z) === 1 ? 1 : 0) | (CITY.blockedAt(x, z) ? 2 : 0);
      heights[k] = CITY.heightAt(x, z) ?? 0;
    }
  }
  const h = GRID!, hk = h.kind, hs = CH.stand, hh = h.height, inv = 1 / h.cell;
  const c0 = Math.max(0, Math.floor((h.minX - minX) / cell)), c1 = Math.min(cols - 1, Math.ceil((h.minX + h.cols * h.cell - minX) / cell));
  const r0 = Math.max(0, Math.floor((h.minZ - minZ) / cell)), r1 = Math.min(rows - 1, Math.ceil((h.minZ + h.rows * h.cell - minZ) / cell));
  for (let r = r0; r <= r1; r++) {
    const hr = Math.floor((minZ + (r + 0.5) * cell - h.minZ) * inv);
    if (hr < 0 || hr >= h.rows) continue;
    for (let c = c0; c <= c1; c++) {
      const hc = Math.floor((minX + (c + 0.5) * cell - h.minX) * inv);
      if (hc < 0 || hc >= h.cols) continue;
      const i = hr * h.cols + hc;
      if (hk[i] === KIND.outside) continue;
      const k = r * cols + c;
      walkable[k] = hs[i] === 1 && !(walkable[k] & 2) ? 3 : 2;
      heights[k] = hh[i];
    }
  }
  for (let k = 0; k < n; k++) walkable[k] &= 1;
}
