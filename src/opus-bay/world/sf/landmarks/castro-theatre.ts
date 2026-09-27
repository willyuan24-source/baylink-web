import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import type { SiteHooks } from '../sites';
import { GLOW, LIT, NONE, SELF, arch, box, cbox, rect, worldPoly } from './kit';
import type { LandmarkSwap, SfLandmark, WalkBlocker } from './index';
import { settingGround } from './setting';
import { GC, PAT, gfill, lamp, planter } from './siteKit';

/**
 * Castro Theatre (T2), 1922: the Spanish-Colonial movie palace on Castro St — the ornate stepped facade with its
 * tall arched window, the vertical blade sign and the V-shaped marquee. Signs are generic (bulbs and colour
 * bands, no lettering). Local +z = the Castro St facade (east, yaw 140.3° from OSM way 1206216224); 21.7 m
 * (LiDAR max, the blade sign) → H 6.6 u, facade 5.3 u.
 *
 * Setting (lane D2, D2-09): OSM's theatre way is the auditorium; in the city two generic buildings stood between its
 * facade and Castro St, so the facade looked into a closed pocket and the arrival (on Castro St) faced their backs.
 * The exclusion now takes in that frontage (the two buildings drop, the neighbours stay) and it becomes the theatre's
 * forecourt onto the Castro St sidewalk: pavers, planters by the doors, two lamps; the marquee faces the street. The
 * base stays the 'terrain' base of the theatre's own footprint (8.9: the wider exclusion reaches lower ground).
 */

const X0 = 151.78, Z0 = 741.3, YAW = (140.3 * Math.PI) / 180;
const STUCCO = '#f0dfc2', ORNATE = '#e2c79c', RED = '#b8402f', BULB = '#ffe7a8';
const ZF = 3.54;

function build(b: BatchLike, lod: 0 | 2) {
  // auditorium box + raised facade block with a stepped baroque parapet
  box(b, 0, -1.2, -0.2, 4.2, 5.4, 7.0, '#e3d3b8', NONE);
  box(b, 0, -1.2, ZF - 0.35, 4.3, 6.2, 0.7, STUCCO, GLOW(0.1));
  box(b, 0, 5.0, ZF - 0.35, 2.6, 0.55, 0.7, STUCCO, GLOW(0.1));
  box(b, 0, 5.55, ZF - 0.35, 1.3, 0.45, 0.7, STUCCO, GLOW(0.1));
  // blade sign (perpendicular to the facade, over the marquee) — the far silhouette
  box(b, 0, 2.4, ZF + 0.45, 0.24, 4.3, 0.9, RED, GLOW(0.5));
  if (lod === 2) return;
  box(b, 0, 6.7, ZF + 0.45, 0.3, 0.3, 0.3, BULB, SELF(1.3));
  for (let y = 2.6; y < 6.6; y += 0.36) for (const sz of [-0.46, 0.46]) cbox(b, 0, y, ZF + 0.45 + sz, 0.28, 0.08, 0.04, BULB, SELF(1.4));
  for (const sx of [-0.14, 0.14]) box(b, sx, 2.7, ZF + 0.45, 0.02, 3.7, 0.55, '#f3e3c2', GLOW(0.8));
  // ornate facade: tall central arched window, flanking pilasters, cornice, finial urns
  arch(b, 0, 2.95, ZF + 0.02, 1.2, 1.85, 0, '#4a5a66', LIT(2.95));
  for (const sx of [-1, 1]) {
    box(b, sx * 1.45, 0.2, ZF + 0.04, 0.32, 4.7, 0.12, ORNATE, NONE);
    box(b, sx * 1.9, 4.9, ZF - 0.35, 0.3, 0.6, 0.3, ORNATE, NONE);
    arch(b, sx * 1.45, 3.4, ZF + 0.11, 0.45, 0.9, 0, '#4a5a66', LIT(3.4));
  }
  box(b, 0, 4.85, ZF + 0.04, 4.3, 0.18, 0.2, ORNATE, NONE);
  cbox(b, 0, 6.1, ZF - 0.02, 0.5, 0.25, 0.25, ORNATE, NONE);
  // V-shaped marquee (two angled panels) with bulb rows, and the lit entrance doors
  for (const sx of [-1, 1]) {
    cbox(b, sx * 0.95, 2.05, ZF + 0.8, 2.1, 0.62, 0.14, '#f5ecd8', GLOW(0.9), sx * 0.42);
    cbox(b, sx * 0.95, 2.42, ZF + 0.83, 2.14, 0.1, 0.18, RED, NONE, sx * 0.42);
    cbox(b, sx * 0.95, 1.7, ZF + 0.83, 2.14, 0.1, 0.18, RED, NONE, sx * 0.42);
  }
  box(b, 0, 1.72, ZF + 0.6, 3.4, 0.08, 1.2, '#d8c9ad', NONE);
  box(b, 0, 0, ZF + 0.02, 2.4, 1.6, 0.05, '#6b3d2f', LIT(0));
  box(b, 0, 0, ZF + 0.3, 0.8, 1.0, 0.5, '#e7d6b8', NONE);
  setting(b);
}

/**
 * AI theatre (lane D2, D2-15): lane H's SAM mesh (LM5-3D) at 4.3 × 4.36 × 5.67 u, shown at [1, 1.35, 1.3]: the facade
 * 5.9 u tall like the procedural one, 7.4 u deep, its marquee front at z 4.2 over the Castro St sidewalk (the
 * procedural V marquee reaches 4.3). Measured on the decoded mesh: the building |x| ≤ 2.15 from z −3.2 to 3.5, the
 * box office under the marquee to z 4.0 (x −1.25…1.0).
 */
const AI_Z = 0.5, AI_S = [1, 1.35, 1.3] as const;

/**
 * The AI blade sign keeps the procedural bulb rows, one column on each vertical edge (measured with rays on the decoded
 * mesh, local: y 2.36…5.83, z 3.66…4.13; the inner face at x 1.62–1.66, the outer face slants from x 1.94 at the back
 * edge to 1.81 at the front): [x, z] per column, 0.02 u proud of the face.
 */
const AI_SIGN = { y0: 2.45, y1: 5.75, cols: [[1.6, 3.68], [1.64, 4.11], [1.96, 3.68], [1.83, 4.11]] as const };

function aiRemainder(b: BatchLike) {
  setting(b);
  box(b, 0, -1.2, AI_Z - 0.1, 4.2, 1.24, 7.1, STUCCO);
  for (let y = AI_SIGN.y0; y < AI_SIGN.y1; y += 0.3) for (const [x, z] of AI_SIGN.cols) cbox(b, x, y, z, 0.04, 0.08, 0.1, BULB, SELF(1.4));
}

const SWAP: LandmarkSwap = {
  parts: [{ model: 'sf-castro-theatre', x: 0, y: 0, z: AI_Z, scale: AI_S, glow: 0.12 }],
  build: aiRemainder,
  ship: true,
  note: '[1, 1.35, 1.3]: facade 5.9 u',
};

const blockers = (ai: boolean): WalkBlocker[] => (ai
  ? [{ poly: rect(0, 0.15, 4.3, 6.7) }, { poly: rect(-0.1, 3.75, 2.3, 0.5) }]
  : [{ poly: rect(0, -0.2, 4.2, 7.0) }, { poly: rect(0, ZF + 0.3, 0.8, 0.5) }]);

// ---------------------------------------------------------------------------
// setting (D2-09)
// ---------------------------------------------------------------------------

const G = settingGround('castro-theatre');
/** the forecourt between the facade and Castro St's sidewalk (the frontage the two city buildings stood on) */
const FORECOURT: Vec2[] = [{ x: -4.9, z: 4.45 }, { x: 5.3, z: 4.45 }, { x: 5.3, z: 7.4 }, { x: -4.9, z: 7.4 }];
const LAMPS: Vec2[] = [{ x: -4.3, z: 6.9 }, { x: 4.7, z: 6.9 }];
const PLANTERS: Vec2[] = [{ x: -2.9, z: 4.95 }, { x: 2.9, z: 4.95 }];

function setting(b: BatchLike) {
  for (const p of LAMPS) lamp(b, p.x, G.at(p.x, p.z), p.z);
  for (const p of PLANTERS) planter(b, p.x, G.at(p.x, p.z), p.z, 1.4, 0.7);
}

export const castroTheatre: SfLandmark & SiteHooks = {
  id: 'castro-theatre',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 8.9,
  // the theatre + its forecourt to Castro St's kerb (the neighbours north and south keep their lots; the street tree
  // in front of the doors drops); no sink: the forecourt and the sidewalk stay at the street's level
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -2.3, z: -3.7 }, { x: 2.3, z: -3.7 }, { x: 2.3, z: 4.4 }, { x: 5.35, z: 4.4 }, { x: 5.35, z: 8.3 }, { x: -5.0, z: 8.3 }, { x: -5.0, z: 4.4 }, { x: -2.3, z: 4.4 }]) },
  sink: 0,
  build,
  walk: { blockers: [...blockers(SWAP.ship), ...PLANTERS.map(p => ({ poly: rect(p.x, p.z, 1.4, 0.7) }))] },
  ground: gfill(FORECOURT, GC.pavers, PAT.stone, G, 2.5, 0.04),
  lights: LAMPS.map(p => ({ x: p.x, y: G.at(p.x, p.z) + 3.8, z: p.z, size: 1, color: '#ffd9a0' })),
  plaza: [{ poly: FORECOURT, surface: 'pavement' }],
  swap: SWAP,
  fade: { r: 4, y1: 6.2, box: [2.3, 4.2], procedural: false },
};
