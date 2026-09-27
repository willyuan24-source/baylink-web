import { CELL, CHUNK } from '../../core/geo';
import type { Quality } from '../../core/store';

/**
 * Streaming bookkeeping for the city (plan §5.3 / §5.4), pure (no three.js, no DOM) so the node tests can drive it:
 * which 64 u cell shows which tier, which chunk jobs to run in what order, what to attach this frame and what to
 * drop, and when a place is "ready" (teleports / fast travel wait on it).
 *
 * Tiers, per 64 u cell, exactly one visible at a time:
 *   L0 (0) near:   full toy buildings, road-flattened 2 u ground, streets with sidewalks  — radius 125/165 (high)
 *   L1 (1) middle: one box per building, 4 u ground, main streets                        — radius 300/350 (high)
 *   L2 (2) far:    block prisms + 16 u ground from far.obc, always resident
 * The first radius is "come in", the second "go out" (hysteresis: oscillating ±10 u on a border never flaps).
 * The plan's L1 ring (520 u) assumed ~1k triangles per L1 cell; with the published data (57k buildings, 10–14
 * triangles each) a dense L1 cell is ~3.5k, so the ring is 300 u on high (~25 visible cells ≈ 90k triangles) and the
 * far city (L2, block prisms) starts there. A dense L0 cell is ~13k triangles (lane A's estimate, measured): the L0
 * disc of 125 u keeps ~8 of them in view (walk-mode budget ≤ 400k with the hero, plan §5.10).
 *
 * Data per chunk (128 u = 2×2 cells), independent of the render tier: the walking rasters (lane B) are resident
 * within 192 u of the focus and dropped beyond 256 u.
 */

export type Tier = 0 | 1 | 2;
export interface Radii { l0In: number; l0Out: number; l1In: number; l1Out: number }
export const RADII: Record<Quality, Radii> = {
  high: { l0In: 125, l0Out: 165, l1In: 300, l1Out: 350 },
  mid: { l0In: 105, l0Out: 145, l1In: 260, l1Out: 310 },
  low: { l0In: 85, l0Out: 125, l1In: 220, l1Out: 270 },
};
/** one quality step down (hero near: the hand-made district already costs ~200k triangles) */
export const LOWER_QUALITY: Record<Quality, Quality> = { high: 'mid', mid: 'low', low: 'low' };

/**
 * High-view budget (lane C2-5, plan §5.10: ≤ 150 calls / ≤ 400k triangles incl. shadows): radii by camera height
 * above the ground. A high camera sees a wide disc, and the full toy houses of L0 (≈ 13k triangles per dense cell)
 * are too small up there to be worth it, so the L0 disc shrinks to 60 / 90 u as camH goes 25 → 60 u, and above
 * 80 u the L1 ring shrinks to 240 / 290 u (at 120 u) where the far prisms take over. Radii step by 5 u so a camera
 * bobbing up and down does not re-select every frame. Gliding above 40 u keeps its old rule (L0 60 / 90).
 */
export const HIGH_VIEW = { l0: { h0: 25, h1: 60, in: 60, out: 90 }, l1: { h0: 80, h1: 120, in: 240, out: 290 }, glideH: 40, step: 5 } as const;
export interface RadiiInput { heroNear: boolean; camH: number; glideH?: number | null }
const ramp = (h: number, h0: number, h1: number) => Math.min(1, Math.max(0, (h - h0) / (h1 - h0)));
const toward = (a: number, b: number, t: number) => Math.round((a + (Math.min(a, b) - a) * t) / HIGH_VIEW.step) * HIGH_VIEW.step;
/** Tier radii for quality q (one step lower near the hero), shrunk for a high camera (see HIGH_VIEW). */
export function radiiFor(q: Quality, o: RadiiInput): Radii {
  const base = RADII[o.heroNear ? LOWER_QUALITY[q] : q];
  const h = Number.isFinite(o.camH) ? o.camH : 0;
  const H = HIGH_VIEW;
  let t0 = ramp(h, H.l0.h0, H.l0.h1);
  if (o.glideH != null && o.glideH > H.glideH) t0 = 1;
  const t1 = ramp(h, H.l1.h0, H.l1.h1);
  const r = {
    l0In: toward(base.l0In, H.l0.in, t0), l0Out: toward(base.l0Out, H.l0.out, t0),
    l1In: toward(base.l1In, H.l1.in, t1), l1Out: toward(base.l1Out, H.l1.out, t1),
  };
  r.l0Out = Math.max(r.l0Out, r.l0In + 20);
  r.l1Out = Math.max(r.l1Out, r.l1In + 30);
  return r;
}
/** walking rasters: attach within, detach beyond (u from the focus to the chunk square) */
export const RESIDENCY = { in: 192, out: 256 } as const;
/** re-select after the focus moved this far (u) or the view turned this much (rad) */
export const RESELECT_MOVE = 16;
export const RESELECT_YAW = (20 * Math.PI) / 180;
/** per-frame main-thread attach budget (plan §5.4): ≤ 1 L0 cell and ≤ 2 L1 cells */
export const ATTACH_BUDGET = { l0: 1, l1: 2 } as const;

/** cell (ix, iz) covers [ix·64, ix·64 + 64) × [iz·64, iz·64 + 64); packed into one integer key */
export const cellKey = (ix: number, iz: number) => (ix + 1024) * 4096 + (iz + 1024);
export const chunkKeyN = (cx: number, cz: number) => (cx + 1024) * 4096 + (cz + 1024);
/** sub-cell index inside its chunk: 0 = (−x, −z), 1 = (+x, −z), 2 = (−x, +z), 3 = (+x, +z) */
export function cellsOfChunk(cx: number, cz: number): { ix: number; iz: number; sub: number }[] {
  return [0, 1, 2, 3].map(sub => ({ ix: cx * 2 + (sub & 1), iz: cz * 2 + (sub >> 1), sub }));
}
/** origin (min corner) of sub-cell `sub` of chunk (cx, cz) */
export function subOrigin(cx: number, cz: number, sub: number) {
  return { x: cx * CHUNK + (sub & 1) * CELL, z: cz * CHUNK + (sub >> 1) * CELL };
}
/** sub-cell of a point inside chunk (cx, cz) */
export function subOf(cx: number, cz: number, x: number, z: number) {
  const i = x - cx * CHUNK >= CELL ? 1 : 0, j = z - cz * CHUNK >= CELL ? 1 : 0;
  return i + j * 2;
}

/** distance from (px, pz) to the axis-aligned square [x0, x0 + s] × [z0, z0 + s] (0 inside) */
export function squareDist(px: number, pz: number, x0: number, z0: number, s: number) {
  const dx = px < x0 ? x0 - px : px > x0 + s ? px - x0 - s : 0;
  const dz = pz < z0 ? z0 - pz : pz > z0 + s ? pz - z0 - s : 0;
  return Math.hypot(dx, dz);
}

/** Desired tier for a cell centre at distance d, with hysteresis against the tier it wants now. */
export function desiredTier(d: number, cur: Tier, r: Radii): Tier {
  if (d < r.l0In || (cur === 0 && d < r.l0Out)) return 0;
  if (d < r.l1In || (cur <= 1 && d < r.l1Out)) return 1;
  return 2;
}

export type DataState = 'none' | 'queued' | 'ready' | 'attached';

export interface CellInfo {
  key: number;
  ix: number;
  iz: number;
  cx: number;
  cz: number;
  sub: number;
  /** centre */
  x: number;
  z: number;
  want: Tier;
  /** distance from the nearest focus (predicted), last selection */
  dist: number;
  l0: DataState;
  l1: DataState;
  /** tier on screen */
  shown: Tier;
  /** the chunk has no content for this cell at L0/L1 (e.g. open water): L2 stays */
  empty: boolean;
}

export interface ChunkInfo {
  key: number;
  cx: number;
  cz: number;
  /** distance from the nearest focus to the chunk square */
  dist: number;
  cells: CellInfo[];
  /** L1 job result (L1 arrays of the 4 cells + props) */
  l1: DataState;
  raster: DataState;
  hero: boolean;
}

export interface Focus { x: number; z: number; vx?: number; vz?: number }

export type Job =
  | { kind: 'raster'; chunk: ChunkInfo; pri: number }
  | { kind: 'l1'; chunk: ChunkInfo; pri: number }
  | { kind: 'l0'; chunk: ChunkInfo; cell: CellInfo; pri: number };

/** prediction horizon for job priorities (plan §5.4: focus + 1.5 s · velocity) */
const LOOKAHEAD = 1.5;

/**
 * Per-cell / per-chunk state machine. The streamer (stream.ts) owns the workers and the GPU side; this decides.
 *
 *   select(foci, radii)            → recompute wanted tiers and distances (call on RESELECT_* or radius changes)
 *   jobs(inView?)                  → wanted jobs not queued yet, most urgent first
 *   nextAttaches()                 → ready data to attach this frame within ATTACH_BUDGET
 *   drops()                        → attached data no longer wanted (free it)
 *   shownFor(cell)                 → the tier to display given what is attached (never a hole)
 *   ready(p, r)                    → every cell within r of p shows its wanted tier and its chunk rasters are in
 */
export class CellTable {
  readonly cells: CellInfo[] = [];
  readonly chunks: ChunkInfo[] = [];
  private byChunk = new Map<number, ChunkInfo>();
  private byCell = new Map<number, CellInfo>();
  radii: Radii = RADII.high;

  constructor(chunks: readonly { cx: number; cz: number; hero?: boolean }[]) {
    for (const c of chunks) {
      const ch: ChunkInfo = { key: chunkKeyN(c.cx, c.cz), cx: c.cx, cz: c.cz, dist: Infinity, cells: [], l1: 'none', raster: 'none', hero: !!c.hero };
      for (const { ix, iz, sub } of cellsOfChunk(c.cx, c.cz)) {
        const cell: CellInfo = { key: cellKey(ix, iz), ix, iz, cx: c.cx, cz: c.cz, sub, x: ix * CELL + CELL / 2, z: iz * CELL + CELL / 2, want: 2, dist: Infinity, l0: 'none', l1: 'none', shown: 2, empty: false };
        ch.cells.push(cell);
        this.cells.push(cell);
        this.byCell.set(cell.key, cell);
      }
      this.chunks.push(ch);
      this.byChunk.set(ch.key, ch);
    }
  }

  chunk(cx: number, cz: number) { return this.byChunk.get(chunkKeyN(cx, cz)); }
  cell(ix: number, iz: number) { return this.byCell.get(cellKey(ix, iz)); }

  /** Recompute distances (nearest focus, predicted LOOKAHEAD s ahead) and wanted tiers. */
  select(foci: readonly Focus[], radii: Radii = this.radii) {
    this.radii = radii;
    const pts = foci.map(f => ({ x: f.x + (f.vx ?? 0) * LOOKAHEAD, z: f.z + (f.vz ?? 0) * LOOKAHEAD, x0: f.x, z0: f.z }));
    for (const ch of this.chunks) {
      let dc = Infinity;
      for (const p of pts) dc = Math.min(dc, squareDist(p.x0, p.z0, ch.cx * CHUNK, ch.cz * CHUNK, CHUNK));
      ch.dist = dc;
      for (const c of ch.cells) {
        // the wanted tier follows the real focus (no flapping from velocity noise); priorities use the prediction
        let d = Infinity, dp = Infinity;
        for (const p of pts) { d = Math.min(d, Math.hypot(c.x - p.x0, c.z - p.z0)); dp = Math.min(dp, Math.hypot(c.x - p.x, c.z - p.z)); }
        c.want = desiredTier(d, c.want, radii);
        c.dist = dp;
      }
    }
  }

  /**
   * Jobs to request, most urgent first (lower pri = sooner). Walking rasters come first (collision beats looks), then
   * the near L0 cells, then L1 chunks; cells outside the view (inView false) wait behind the visible ones.
   */
  jobs(inView: (c: CellInfo) => boolean = () => true): Job[] {
    const out: Job[] = [];
    for (const ch of this.chunks) {
      if (ch.raster === 'none' && ch.dist < RESIDENCY.in) out.push({ kind: 'raster', chunk: ch, pri: ch.dist - 2000 });
      let best = Infinity, visible = false;
      for (const c of ch.cells) {
        if (c.want <= 1) { best = Math.min(best, c.dist); visible ||= inView(c); }
        if (c.want === 0 && c.l0 === 'none' && !c.empty) out.push({ kind: 'l0', chunk: ch, cell: c, pri: c.dist - 400 + (inView(c) ? 0 : 150) });
      }
      // a chunk's L1 arrays stay while any of its cells is wanted; a cell that lost them anyway (worker error) re-asks
      const needL1 = ch.l1 === 'none' || (ch.l1 === 'ready' && ch.cells.some(c => c.want <= 1 && !c.empty && c.l1 === 'none'));
      if (needL1 && best < Infinity) out.push({ kind: 'l1', chunk: ch, pri: best + (visible ? 0 : 300) });
    }
    return out.sort((a, b) => a.pri - b.pri);
  }

  /** Ready data worth attaching now, nearest first, within the per-frame budget. */
  nextAttaches(budget: { l0: number; l1: number } = ATTACH_BUDGET): { l0: CellInfo[]; l1: CellInfo[] } {
    const l0: CellInfo[] = [], l1: CellInfo[] = [];
    for (const c of this.cells) {
      if (c.l0 === 'ready' && c.want === 0) l0.push(c);
      if (c.l1 === 'ready' && c.want <= 1) l1.push(c);
    }
    l0.sort((a, b) => a.dist - b.dist);
    l1.sort((a, b) => a.dist - b.dist);
    return { l0: l0.slice(0, budget.l0), l1: l1.slice(0, budget.l1) };
  }

  /**
   * Attached (or received) data that is no longer wanted. L0 goes once the cell is back to L1 and its L1 is on
   * screen (or it is L2, always there), so a receding cell never leaves a hole. An L1 cell leaves the pool when it
   * falls to L2 but keeps its arrays ('ready') while its chunk is still wanted; the chunk's arrays go when all four
   * cells are at L2 (`chunks`).
   */
  drops(): { l0: CellInfo[]; l1: CellInfo[]; chunks: ChunkInfo[]; rasters: ChunkInfo[] } {
    const l0: CellInfo[] = [], l1: CellInfo[] = [], chunks: ChunkInfo[] = [], rasters: ChunkInfo[] = [];
    for (const c of this.cells) {
      if ((c.l0 === 'attached' || c.l0 === 'ready') && c.want >= 1 && (c.want === 2 || c.l1 === 'attached' || c.l0 === 'ready')) l0.push(c);
      if (c.l1 === 'attached' && c.want === 2) l1.push(c);
    }
    for (const ch of this.chunks) {
      if (ch.l1 === 'ready' && ch.cells.every(c => c.want === 2)) chunks.push(ch);
      if ((ch.raster === 'attached' || ch.raster === 'ready') && ch.dist > RESIDENCY.out) rasters.push(ch);
    }
    return { l0, l1, chunks, rasters };
  }

  /** Tier to display for a cell given what is attached right now (never a hole, never two tiers). */
  static shownFor(c: CellInfo): Tier {
    if (c.empty) return 2;
    if (c.want === 0) return c.l0 === 'attached' ? 0 : c.l1 === 'attached' ? 1 : 2;
    if (c.want === 1) return c.l1 === 'attached' ? 1 : c.l0 === 'attached' ? 0 : 2;
    return 2;
  }

  /** true when every cell within r of p shows the tier it wants and the chunks within min(r, RESIDENCY.in) have rasters */
  ready(px: number, pz: number, r: number): boolean {
    for (const c of this.cells) {
      if (Math.hypot(c.x - px, c.z - pz) > r || c.empty) continue;
      if (c.want === 2) continue;
      if (CellTable.shownFor(c) !== c.want) return false;
    }
    const rr = Math.min(r, RESIDENCY.in);
    for (const ch of this.chunks) {
      if (squareDist(px, pz, ch.cx * CHUNK, ch.cz * CHUNK, CHUNK) < rr && ch.raster !== 'attached') return false;
    }
    return true;
  }

  counts() {
    const n = { l0: 0, l1: 0, l2: 0, want0: 0, want1: 0, resident: 0 };
    for (const c of this.cells) {
      const s = CellTable.shownFor(c);
      if (s === 0) n.l0++; else if (s === 1) n.l1++; else n.l2++;
      if (c.want === 0) n.want0++; else if (c.want === 1) n.want1++;
    }
    for (const ch of this.chunks) if (ch.raster === 'attached') n.resident++;
    return n;
  }
}

/** Least-recently-used map bounded by a byte budget (the worker's compressed-chunk cache: walking back never re-downloads). */
export class Lru<K, V> {
  private map = new Map<K, { v: V; bytes: number }>();
  private total = 0;
  readonly maxBytes: number;
  private onEvict?: (k: K, v: V) => void;
  constructor(maxBytes: number, onEvict?: (k: K, v: V) => void) { this.maxBytes = maxBytes; this.onEvict = onEvict; }
  get size() { return this.map.size; }
  get bytes() { return this.total; }
  get(k: K): V | undefined {
    const e = this.map.get(k);
    if (!e) return undefined;
    this.map.delete(k);
    this.map.set(k, e);
    return e.v;
  }
  has(k: K) { return this.map.has(k); }
  set(k: K, v: V, bytes: number) {
    const old = this.map.get(k);
    if (old) { this.total -= old.bytes; this.map.delete(k); }
    this.map.set(k, { v, bytes });
    this.total += bytes;
    for (const [key, e] of this.map) {
      if (this.total <= this.maxBytes || this.map.size <= 1) break;
      this.map.delete(key);
      this.total -= e.bytes;
      this.onEvict?.(key, e.v);
    }
  }
  delete(k: K) {
    const e = this.map.get(k);
    if (!e) return;
    this.map.delete(k);
    this.total -= e.bytes;
  }
}
