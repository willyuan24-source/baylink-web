import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import type { SiteHooks } from '../sites';
import { GLOW, NONE, SF, WIN, band, box, cyl, lathe, pyramid, rect, worldPoly } from './kit';
import type { LandmarkSwap, SfLandmark } from './index';
import { settingGround, streetStrips } from './setting';
import { flagpole, lamp, planter } from './siteKit';

/**
 * San Francisco City Hall (T1): the Beaux-Arts block with its dome, facing Civic Center Plaza (local +z = east,
 * yaw 145° from the OSM outline, relation 7261820). Footprint 17.7 × 12.2 u (OSM, 124 × 96 m at 0.14 u/m).
 * Height: dome 94 m → H = 3.2 + 0.155·94 = 17.8 u; the parts keep the real proportions at 17.8 / 94 = 0.189 u/m
 * (OSM building:part heights: wings 30–35 m, drum 40–60 m, dome to 75 m, lantern to 93 m).
 *
 * Setting (lane D2, D2-09): the exclusion was an r 11.5 circle that cut 14.5 u out of Van Ness Avenue and 10 u out of
 * Dr. Carlton B. Goodlett Place; it is now the block (the building and its porticos + 0.6 u), so both streets run
 * past unbroken, and the base stays the 'terrain' base of the old circle (3.27). On the Civic Center Plaza side: two
 * flagpoles by the east steps, lamps and hedged planters along the front.
 */

// wave 7 (lane R, sf-w7-R-realism.md #14): the real dome is dark lead-grey with gold-leaf ribs, not sage (the AI texture
// of sf-city-hall was recoloured the same way: scripts/opus-sf/assets/w7r/recolour-glb.py city-hall)
const WALL = '#e9e4d8', TRIM = '#f5f1e8', ROOF = '#bdb6a9', DOME = '#6a7176', GOLD = SF.gold;
const X = 8.86, Z0 = -5.85, Z1 = 6.35, ZC = (Z0 + Z1) / 2;
const CORNICE = 6.3;

function build(b: BatchLike, lod: 0 | 2) {
  const lit = GLOW(0.1);
  // main block + central pavilions (front + back) + corner pavilions
  box(b, 0, -1.2, ZC, X * 2, CORNICE + 1.2, Z1 - Z0, WALL, lod === 0 ? WIN(4, 0.6, 3.1) : NONE);
  box(b, 0, -1.2, ZC, 3.5, CORNICE + 1.9, 13.7, WALL, lod === 0 ? WIN(4, 0.6, 5.3) : NONE);
  if (lod === 2) {
    box(b, 0, CORNICE, ZC, 6.2, 1.6, 6.2, WALL);
    lathe(b, [[2.5, 0], [2.4, 3.3], [2.2, 4.1], [2.1, 4.8], [1.5, 6.4], [0.6, 7.3], [0.35, 8.9], [0.05, 10.0]], 0, CORNICE + 1.6, ZC, band([[4.1, SF.stone], [7.3, DOME], [99, GOLD]]), NONE, 8);
    return;
  }
  for (const sx of [-1, 1]) box(b, sx * 8.2, -1.2, ZC, 1.4, CORNICE + 1.5, Z1 - Z0 + 0.3, WALL, WIN(4, 0.6, 7.7));
  // rusticated base course, cornice, attic
  box(b, 0, 0, ZC, X * 2 + 0.1, 1.5, Z1 - Z0 + 0.1, '#ddd6c8');
  box(b, 0, CORNICE, ZC, X * 2 + 0.3, 0.3, Z1 - Z0 + 0.3, TRIM);
  box(b, 0, CORNICE + 0.3, ZC, X * 2 - 0.4, 0.45, Z1 - Z0 - 0.4, WALL);
  box(b, 0, CORNICE + 0.3, ZC, X * 2 - 1.2, 0.08, Z1 - Z0 - 1.2, ROOF);
  // the two light courts read from above as darker roof panels
  for (const sx of [-1, 1]) box(b, sx * 4.6, CORNICE + 0.36, ZC, 3.6, 0.05, 6.4, '#9e978b');
  // colonnades on the long facades (engaged columns across the upper floors) + pavilion porticos + pediments
  for (const zs of [-1, 1]) {
    const zf = zs > 0 ? Z1 : Z0;
    for (let x = -7.3; x <= 7.31; x += 0.92) {
      if (Math.abs(x) < 2.0) continue;
      box(b, x, 1.6, zf + zs * 0.12, 0.3, 4.4, 0.24, TRIM, NONE);
    }
    const zp = zs > 0 ? 6.85 : -6.84;
    for (let k = 0; k < 6; k++) cyl(b, -1.45 + k * 0.58, 1.6, zp + zs * 0.3, 0.15, 4.5, TRIM, NONE, 6);
    box(b, 0, 6.1, zp + zs * 0.25, 3.6, 0.5, 0.7, TRIM);
    // pediment: a flat triangle-ish gable over the portico
    pyramid(b, 0, CORNICE + 0.9, zp - zs * 0.1, 3.8, 1.2, 1.1, WALL);
    // front steps
    if (zs > 0) for (let s = 0; s < 3; s++) box(b, 0, s * 0.18 - 0.2, zp + 0.6 + (2 - s) * 0.35, 5.2 - s * 0.4, 0.4, 0.4, '#d9d2c4');
  }
  // rotunda podium, drum with its colonnade, dome, lantern
  const y0 = CORNICE + 1.55;
  box(b, 0, CORNICE, ZC, 6.6, 1.6, 6.6, WALL, WIN(1, CORNICE, 9.2));
  lathe(b, [[2.75, 0], [2.75, 0.55], [2.4, 0.55], [2.35, 3.2], [2.78, 3.2], [2.78, 3.6], [2.4, 3.6], [2.35, 4.0]], 0, y0, ZC, SF.stone, lit, 20);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    cyl(b, Math.sin(a) * 2.6, y0 + 0.55, ZC + Math.cos(a) * 2.6, 0.16, 2.65, TRIM, lit, 6);
  }
  lathe(b, [[2.35, 0], [2.28, 0.65], [2.05, 1.35], [1.62, 2.05], [1.05, 2.6], [0.62, 2.85]], 0, y0 + 4.0, ZC, DOME, GLOW(0.06), 20);
  lathe(b, [[2.4, 0], [2.4, 0.14]], 0, y0 + 4.0, ZC, GOLD, NONE, 20);
  lathe(b, [[0.62, 0], [0.62, 0.9], [0.78, 1.0], [0.78, 1.1], [0.5, 1.2], [0.34, 1.6], [0.14, 2.0], [0.04, 2.95]], 0, y0 + 6.85, ZC, GOLD, GLOW(0.35), 12);
  setting(b);
}

/**
 * AI City Hall (lane D2, D2-15): lane H's SAM mesh (LM8-3D) at 17.7 × 14.24 × 11.29 u, shown at [1, 1.24, 1.08] = the
 * OSM block 17.7 × 12.2 u (porticos included) and the lantern at 17.65 u, the procedural top (plan §2.3). Measured on
 * the decoded mesh: the block |x| ≤ 8.9, z −5.85…6.35 with the local offset, the porticos |x| ≤ 1.85 — inside the
 * procedural blockers, which stay as they are.
 */
const AI_S = [1, 1.24, 1.08] as const;

function aiRemainder(b: BatchLike) {
  box(b, 0, -1.2, ZC, X * 2 - 0.2, 1.24, Z1 - Z0 - 0.2, '#ddd6c8');
  setting(b);
}

const SWAP: LandmarkSwap = {
  parts: [{ model: 'sf-city-hall', x: 0, y: 0, z: ZC, scale: AI_S, castShadow: true, glow: 0.1 }],
  build: aiRemainder,
  ship: true,
  note: '[1, 1.24, 1.08] = the OSM block, lantern 17.65 u',
};

// ---------------------------------------------------------------------------
// setting (D2-09)
// ---------------------------------------------------------------------------

const G = settingGround('city-hall');
const FLAGS: Vec2[] = [{ x: -3.5, z: 7.4 }, { x: 3.5, z: 7.4 }];
const LAMPS: Vec2[] = [{ x: -5.2, z: 7.1 }, { x: 5.2, z: 7.1 }, { x: -9.3, z: 7.1 }, { x: 9.3, z: 7.1 }];
const PLANTERS: Vec2[] = [{ x: -7.25, z: 7.0 }, { x: 7.25, z: 7.0 }];

function setting(b: BatchLike) {
  FLAGS.forEach((p, i) => flagpole(b, p.x, G.at(p.x, p.z), p.z, 6.2, i ? '#2f5d8a' : '#c9473a', 0));
  for (const p of LAMPS) lamp(b, p.x, G.at(p.x, p.z), p.z);
  for (const p of PLANTERS) planter(b, p.x, G.at(p.x, p.z), p.z, 2.2, 0.8);
}

export const cityHall: SfLandmark & SiteHooks = {
  id: 'city-hall',
  tier: 1,
  x: 92.12,
  z: 418.43,
  yaw: (145 * Math.PI) / 180,
  base: 3.27,
  // the block: the building and its porticos + 0.6 u (Van Ness Avenue and Goodlett Place run past it)
  exclude: { poly: worldPoly(92.12, 418.43, (145 * Math.PI) / 180, rect(0, 0.5, 21, 15)) },
  castShadow: true,
  build,
  walk: { blockers: [{ poly: rect(0, ZC, X * 2, Z1 - Z0) }, { poly: rect(0, 0, 3.6, 13.8) }] },
  swap: SWAP,
  // the AI hall thins as one (the procedural keeps the per-fragment occlusion dither)
  fade: { r: 9, y1: 18, box: [9, 7], procedural: false },
  // D2-10: the colonnaded drum, dome and lantern (the block's roof is its blockers' top)
  tall: [{ x: 0, z: -0.6, r: 3.6 }],
  ground: streetStrips('city-hall', (x, z) => Math.abs(x) > X + 0.3 || z < Z0 - 0.3 || z > Z1 + 0.6),
  lights: LAMPS.map(p => ({ x: p.x, y: G.at(p.x, p.z) + 3.8, z: p.z, size: 1, color: '#ffd9a0' })),
  plaza: [{ poly: rect(0, 7.3, 18, 0.8), surface: 'plaza' }],
};

