/**
 * Wave-4 AI swap rows (lane V, part 2): the verdict of the SoloView-equivalent gate for each wave-4 site that holds an
 * AI slot, and the exact `swap` lane L adds to the site record at the integration (world/sf/landmarks/<site>.ts, the
 * D2 swap API of landmarks/index.ts: `swap: { parts: [w4SwapPart(row, g.at)], build: <remainder>, ship: row.ship,
 * note: row.note }`, plus `walk.blockers` / `fade` from the row when the AI part ships).
 *
 * The gate (2026-09-27, scripts/opus-sf/assets/w4/ai-gate.{html,tsx,mjs}): the site with `swap.ship` false / true in
 * SoloView (golden hour: ¾, street, far, front, and SoloView's own 64 px thumbnail of the far view) and in the
 * streaming city (golden hour, quality high: the site's photo pose, a street view from the arrival spot, far views at
 * which the model spans ≈ 128 / 64 px). Shots: docs/opus-bay/qa/w4/V/v-gate-*.jpg; report docs/opus-bay/sf-w4-V.md
 * ("Early phase, part 2").
 *
 * Only `cal-academy` and `st-ignatius-church` are not here yet: their gate needs lane L's remainder builds (their AI
 * meshes replace part of a larger procedural site); lane L runs it in SoloView after the registration.
 *
 * Dependency-free at runtime (type imports only), so a site module can import it without joining any cycle.
 */
import type { Vec2 } from '../../core/types';
import type { LandmarkFade, LandmarkSwapPart, WalkBlocker } from '../../world/sf/landmarks/index';
import type { W4ModelId } from './w4Models';

export interface W4SwapRow {
  /** lane L's site id (world/sf/landmarks/w4list.ts); the model's `landmarkId` */
  site: string;
  model: W4ModelId;
  /** the gate's verdict: the city draws the AI part (`swap.ship`) */
  ship: boolean;
  /** the AI part in the site's LOCAL frame; `y: 'ground'` = the site's ground at the part's (x, z) (lane L's `g.at`) */
  part: Omit<LandmarkSwapPart, 'model' | 'y'> & { y: number | 'ground' };
  /** what `swap.build` (the procedural remainder drawn with the AI part) keeps of the site's lod-0 build */
  remainder: string;
  /** the site's walk blockers while the AI part ships (LOCAL; measured on the decoded GLB at this placement) */
  blockers: WalkBlocker[];
  /** the whole-landmark hero fade (TOY OB_HERO) while the AI part ships, when the site should have one */
  fade?: LandmarkFade;
  /** SoloView's QA note (`swap.note`): the gate's reason, short */
  note: string;
}

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
    // the model's origin on the ground at the lot's centre, front (the porch) +Z = Geary Blvd; 2.8 × 9.1 × 3.2 u
    part: { x: 0, y: 'ground', z: -0.02, yaw: 0, scale: [1, 1, 1], castShadow: true, glow: 0.1 },
    remainder: 'nothing: the procedural build is the cathedral alone (its sidewalks are `plaza` surfaces, drawn by sites.ts)',
    // body x ±1.34, z −1.54…1.24 and the porch |x| ≤ 0.6 to z 1.6 on the decoded mesh, shifted by the part's z −0.02
    blockers: [{ poly: box(-1.36, 1.36, -1.58, 1.24) }, { poly: box(-0.62, 0.62, 1.2, 1.6) }],
    note: 'AI (retake fitted to the lot 2.8 × 9.1 × 3.2): kokoshniks, red trim, porch and five gold domes vs a plain box',
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

/** The D2 swap part of a row: `groundAt(x, z)` = the site's local ground height (lane L's `siteGround(id).at`). */
export function w4SwapPart(row: W4SwapRow, groundAt: (x: number, z: number) => number): LandmarkSwapPart {
  const { y, ...rest } = row.part;
  return { model: row.model, ...rest, y: y === 'ground' ? groundAt(rest.x, rest.z) : y };
}
