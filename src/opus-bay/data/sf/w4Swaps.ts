/**
 * Wave-4 AI swap rows (lane V, part 2): the verdict of the SoloView-equivalent gate for each wave-4 site that holds an
 * AI slot, and the exact `swap` lane L adds to the site record at the integration (world/sf/landmarks/<site>.ts, the
 * D2 swap API of landmarks/index.ts: `swap: { parts: [w4SwapPart(row, g.at)], build: <remainder>, ship: row.ship,
 * note: row.note }`, plus `walk.blockers` / `fade` from the row when the AI part ships; the remainder draws the row's
 * plinth boxes, `w4SwapPlinth(row, g.at)`, with kit `box()`).
 *
 * The gate (2026-09-27, scripts/opus-sf/assets/w4/ai-gate.{html,tsx,mjs}): the site with `swap.ship` false / true in
 * SoloView (golden hour: ¾, street, far, front, and SoloView's own 64 px thumbnail of the far view) and in the
 * streaming city (golden hour, quality high: the site's photo pose, a street view from the arrival spot, far views at
 * which the model spans ≈ 128 / 64 px). Shots: docs/opus-bay/qa/w4/V/v-gate-*.jpg; report docs/opus-bay/sf-w4-V.md
 * ("Early phase, part 2", "Early review 2").
 *
 * Only `cal-academy` and `st-ignatius-church` are not here yet: their gate needs lane L's remainder builds (their AI
 * meshes replace part of a larger procedural site); lane L runs it in SoloView after the registration.
 *
 * Dependency-free at runtime (type imports only), so a site module can import it without joining any cycle.
 */
import type { Vec2 } from '../../core/types';
import type { LandmarkFade, LandmarkSwapPart, WalkBlocker } from '../../world/sf/landmarks/index';
import type { W4ModelId } from './w4Models';

/** A foundation box (LOCAL x0, x1, z0, z1) under the AI part. */
export type W4PlinthBox = readonly [x0: number, x1: number, z0: number, z1: number];

export interface W4SwapRow {
  /** lane L's site id (world/sf/landmarks/w4list.ts); the model's `landmarkId` */
  site: string;
  model: W4ModelId;
  /** the gate's verdict: the city draws the AI part (`swap.ship`) */
  ship: boolean;
  /** the AI part in the site's LOCAL frame; `y: 'ground'` = the site's ground (lane L's `g.at`) at `ground` */
  part: Omit<LandmarkSwapPart, 'model' | 'y'> & { y: number | 'ground' };
  /** where `y: 'ground'` samples the site ground (LOCAL); default the part's own (x, z) */
  ground?: Vec2;
  /**
   * Foundation boxes the remainder draws where the lot falls away below the part's base (a GLB's flat bottom cannot
   * follow a slope): from PLINTH_DEPTH below the lowest ground under each box up to the base (+ PLINTH_OVERLAP), inset
   * a hair inside the model's walls so the two never fight. `w4SwapPlinth()` turns them into kit `box()` arguments.
   */
  plinth?: { boxes: readonly W4PlinthBox[]; color: string };
  /** what `swap.build` (the procedural remainder drawn with the AI part) keeps of the site's lod-0 build */
  remainder: string;
  /** the site's walk blockers while the AI part ships (LOCAL; measured on the decoded GLB at this placement) */
  blockers: WalkBlocker[];
  /** the whole-landmark hero fade (TOY OB_HERO) while the AI part ships, when the site should have one */
  fade?: LandmarkFade;
  /** SoloView's QA note (`swap.note`): the gate's reason, short */
  note: string;
}

/** a plinth reaches this far below the lowest ground under it (the city ground may sit a little lower between samples) */
export const PLINTH_DEPTH = 0.3;
/** and this far up into the model's walls */
export const PLINTH_OVERLAP = 0.02;
/** the ground under a plinth box is sampled on this grid (u; the site terrain grids are 0.5–1 u) */
export const PLINTH_SAMPLE = 0.25;

const box = (x0: number, x1: number, z0: number, z1: number): Vec2[] => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
/** the eight column blockers of the pavilion (= lane L's blue-heron-lake walk data: r 0.25 on a ring r 2.15 at 22.5° + k·45°) */
const PAVILION_COLUMNS: WalkBlocker[] = Array.from({ length: 8 }, (_, k) => {
  const a = (k * Math.PI) / 4 + Math.PI / 8;
  return { x: Math.sin(a) * 2.15, z: Math.cos(a) * 2.15, r: 0.25 };
});

export const W4_SWAPS: readonly W4SwapRow[] = [
  {
    site: 'geary-west',
    model: 'sf-holy-virgin',
    ship: true,
    // the model's origin at the lot's centre, front (the porch) +Z = Geary Blvd; 2.8 × 9.1 × 3.2 u. Its base stands at
    // the sidewalk in front of the porch (review 2): the lot rises 1.15 u from the back (local ground 0.08) to Geary
    // (1.22), so at the centre's ground (0.54, lane L's slot) the porch door sank 0.68 u under the sidewalk. 125 ft is
    // measured from the street, so the 9.1 u now stand over Geary Blvd; the plinth fills the fall toward the back.
    part: { x: 0, y: 'ground', z: -0.02, yaw: 0, scale: [1, 1, 1], castShadow: true, glow: 0.1 },
    ground: { x: 0, z: 1.65 },
    // the body's ground footprint (x ±1.33, z −1.54…1.24 on the decoded mesh, shifted by the part's z) and the porch's
    plinth: { boxes: [[-1.32, 1.32, -1.55, 1.21], [-0.58, 0.58, 1.21, 1.54]], color: '#d6cdbf' },
    remainder: 'the plinth only (w4SwapPlinth: the foundation under the body and porch where the lot falls away toward the back); the sidewalks are `plaza` surfaces, drawn by sites.ts',
    // body x ±1.34, z −1.54…1.24 and the porch |x| ≤ 0.6 to z 1.6 on the decoded mesh, shifted by the part's z −0.02
    blockers: [{ poly: box(-1.36, 1.36, -1.58, 1.24) }, { poly: box(-0.62, 0.62, 1.2, 1.6) }],
    note: 'AI (retake fitted to the lot, porch on the sidewalk, plinth behind): kokoshniks, red trim, gold domes vs a plain box',
  },
  {
    site: 'blue-heron-lake',
    model: 'sf-chinese-pavilion',
    ship: true,
    // the model's own 0.3 u floor platform on lane L's stone base (local y 0.45 = BASE; the floor deck at 0.75)
    part: { x: 0, y: 0.45, z: 0, yaw: 0, scale: [1, 1, 1], castShadow: true },
    remainder: 'the stone base (the first lathe, r 2.55 from y −0.75 to 0.45) and the two causeways; not the floor, columns, beam ring, roof or finial',
    blockers: PAVILION_COLUMNS,
    // walk-in: the roof thins as one while it stands between the camera and the player under it
    fade: { r: 2.8, y1: 4.95, procedural: false },
    note: 'AI: upturned eaves, tile ribs and finial vs a plain cone; same footprint and walk data as the procedural',
  },
];

export function w4Swap(site: string): W4SwapRow | undefined { return W4_SWAPS.find(r => r.site === site); }

/** The part's LOCAL y: a number, or the site ground (`groundAt`, lane L's `siteGround(id).at`) at the row's `ground`. */
export function w4SwapY(row: W4SwapRow, groundAt: (x: number, z: number) => number): number {
  const { y } = row.part;
  if (y !== 'ground') return y;
  const at = row.ground ?? row.part;
  return groundAt(at.x, at.z);
}

/** The D2 swap part of a row: `groundAt(x, z)` = the site's local ground height (lane L's `siteGround(id).at`). */
export function w4SwapPart(row: W4SwapRow, groundAt: (x: number, z: number) => number): LandmarkSwapPart {
  const { y, ...rest } = row.part;
  return { model: row.model, ...rest, y: typeof y === 'number' ? y : w4SwapY(row, groundAt) };
}

/** kit `box(b, x, y, z, w, h, d, color)` arguments (y = the bottom, x / z = the centre, LOCAL) for a row's plinth. */
export interface W4PlinthPiece { x: number; y: number; z: number; w: number; h: number; d: number; color: string }

/**
 * The row's plinth boxes at this site's ground: each from PLINTH_DEPTH below the lowest ground sampled under it (every
 * PLINTH_SAMPLE u) up to the part's base + PLINTH_OVERLAP; a box whose ground never falls below the base is left out.
 * Pure; called once when the site's lod 0 is built.
 */
export function w4SwapPlinth(row: W4SwapRow, groundAt: (x: number, z: number) => number): W4PlinthPiece[] {
  if (!row.plinth) return [];
  const top = w4SwapY(row, groundAt) + PLINTH_OVERLAP;
  const out: W4PlinthPiece[] = [];
  for (const [x0, x1, z0, z1] of row.plinth.boxes) {
    let low = Infinity;
    const ni = Math.max(1, Math.ceil((x1 - x0) / PLINTH_SAMPLE)), nj = Math.max(1, Math.ceil((z1 - z0) / PLINTH_SAMPLE));
    for (let i = 0; i <= ni; i++) for (let j = 0; j <= nj; j++) low = Math.min(low, groundAt(x0 + ((x1 - x0) * i) / ni, z0 + ((z1 - z0) * j) / nj));
    const bottom = low - PLINTH_DEPTH;
    if (low >= top - PLINTH_OVERLAP) continue;
    out.push({ x: (x0 + x1) / 2, y: bottom, z: (z0 + z1) / 2, w: x1 - x0, h: top - bottom, d: z1 - z0, color: row.plinth.color });
  }
  return out;
}
