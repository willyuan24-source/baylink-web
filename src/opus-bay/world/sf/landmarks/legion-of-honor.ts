import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import type { SiteHooks } from '../sites';
import { GLOW, LIT, NONE, box, cyl, lathe, pyramid, rect, worldPoly } from './kit';
import type { LandmarkSwap, SfLandmark, WalkBlocker } from './index';
import { settingGround } from './setting';
import { GC, PAT, bench, conifer, gfill, hedge, lamp } from './siteKit';

/**
 * Legion of Honor (T2) in Lincoln Park: the neoclassical museum (a 3/4-scale copy of the Paris Palais de la Légion
 * d'Honneur) — museum block with a domed portico at the back of the Court of Honor, colonnades down both sides,
 * the triumphal-arch gateway in front and The Thinker on his plinth in the court. Local +z = the gateway side
 * (yaw 176.9° from OSM relation 21115818; OSM node 2567140420 puts The Thinker at local z +4.4). Height ~20 m for
 * the dome → 5.7 u; colonnades 2.7 u.
 *
 * Setting (lane L, wave 4 — D2's "court approach"): the paved forecourt between the gateway and Legion of Honor Drive
 * (the plaza whose fountain across the drive ends the Lincoln Highway, famsf.org / Wikipedia), a lighter centre walk,
 * lawn panels with clipped cypresses and low hedges at its sides, lamps and benches; the Court of Honor is paved and
 * walkable at its floor. The base is the court floor (25.1): the lowest ground of the old exclusion (24.09) left the
 * city's grass 0.7 u over the court paving.
 */

const X0 = -663.61, Z0 = 1083.82, YAW = (176.9 * Math.PI) / 180;
const WHITE = '#f1ede4', SHADE = '#ddd6c9', BRONZE = '#4e4436';
const HALF_W = 4.2, BACK = -5.8, COURT = 0.3, FRONT = 6.5;

function build(b: BatchLike, lod: 0 | 2) {
  const lit = GLOW(0.1);
  // museum block, dome, portico
  box(b, 0, -1.2, (BACK + COURT) / 2, HALF_W * 2, 4.9, COURT - BACK, WHITE, lod === 0 ? [4, 0.4, -6.1, 0] : NONE);
  if (lod === 0) {
    box(b, 0, 3.7, (BACK + COURT) / 2, HALF_W * 2 + 0.2, 0.3, COURT - BACK + 0.2, SHADE);
    lathe(b, [[1.5, 0], [1.5, 0.6], [1.35, 1.1], [0.95, 1.6], [0.35, 1.9], [0.05, 2.0]], 0, 4.0, -2.6, '#c7cfc9', lit, 14);
  } else lathe(b, [[1.5, 0], [1.2, 1.3], [0.05, 2.0]], 0, 3.7, -2.6, WHITE, lit, 6);
  // side colonnade wings + front screen with the triumphal arch
  for (const sx of [-1, 1]) box(b, sx * (HALF_W - 0.4), -1.2, (COURT + FRONT) / 2, 0.8, 3.9, FRONT - COURT, WHITE, lit);
  if (lod === 2) { box(b, 0, -1.2, FRONT - 0.3, HALF_W * 2 - 1.6, 5.1, 0.7, WHITE, lit); return; }
  for (const sx of [-1, 1]) box(b, sx * (HALF_W - 1.5), -1.2, FRONT - 0.3, 2.3, 3.9, 0.6, WHITE, lit);
  // the gateway: two piers and an attic over a walk-through opening (1.5 × 2.8 u)
  for (const sx of [-1, 1]) box(b, sx * 1.025, -1.2, FRONT - 0.3, 0.55, 5.1, 0.8, WHITE, lit);
  box(b, 0, 2.8, FRONT - 0.3, 2.6, 1.1, 0.8, WHITE, lit);
  box(b, 0, 3.9, FRONT - 0.3, 2.9, 0.4, 1.0, SHADE);
  for (const sx of [-1, 1]) {
    // gate columns + wing colonnades facing the court
    for (const cx of [0.95, 1.25]) cyl(b, sx * cx, 0, FRONT + 0.2, 0.12, 3.6, WHITE, NONE, 6);
    for (let z = COURT + 0.6; z < FRONT - 0.8; z += 0.75) cyl(b, sx * (HALF_W - 0.95), 0, z, 0.1, 2.6, WHITE, NONE, 6);
    box(b, sx * (HALF_W - 0.75), 2.6, (COURT + FRONT) / 2, 0.8, 0.25, FRONT - COURT - 0.6, SHADE);
    for (let x = 1.6; x < HALF_W - 0.6; x += 0.7) cyl(b, sx * x, 0, FRONT + 0.05, 0.1, 2.6, WHITE, NONE, 6);
  }
  // portico of the museum (six columns + pediment) and the entrance
  for (let k = 0; k < 6; k++) cyl(b, -1.5 + k * 0.6, 0.3, COURT + 0.55, 0.14, 3.2, WHITE, lit, 6);
  box(b, 0, 3.4, COURT + 0.5, 3.8, 0.35, 1.0, SHADE);
  pyramid(b, 0, 3.75, COURT + 0.5, 3.9, 1.0, 0.8, WHITE);
  box(b, 0, 0, COURT + 0.02, 1.0, 1.8, 0.06, '#5a5047', LIT(0));
  // Court of Honor paving + The Thinker on his plinth
  box(b, 0, -0.05, (COURT + FRONT) / 2, HALF_W * 2 - 1.8, 0.08, FRONT - COURT - 0.6, '#e6dfd1');
  thinker(b, 4.4);
}

/**
 * AI Legion (lane D2, D2-15): lane H's SAM mesh (LM1-3D) cleaned to 8.8 × 5.0 × 11.6 u: the Court of Honor was
 * stretched in depth (the middle band between the gateway screen and the museum) and the gateway widened to a 1.6 u
 * passage. Shown at y 1.12 (dome 5.6 u) 0.5 u toward the gate. Measured on the decoded mesh (local, with the offset):
 * museum block z −5.3…−2.8 (|x| ≤ 4.4) with the portico to z −1.8 (|x| ≤ 1.5), colonnade wings |x| 2.5…4.25 from
 * z −2.8 to 5.0, the screen z 5.23…6.3 with the gateway |x| < 0.8. The Thinker stays procedural in the court.
 */
const AI_Z = 0.5, AI_Y = 1.12;

function thinker(b: BatchLike, z: number) {
  box(b, 0, 0, z, 0.7, 1.1, 0.7, '#cfc7b8');
  box(b, 0, 1.1, z - 0.05, 0.36, 0.3, 0.44, BRONZE);
  box(b, 0, 1.4, z - 0.12, 0.28, 0.42, 0.26, BRONZE, NONE, 0);
  box(b, 0, 1.78, z + 0.02, 0.18, 0.2, 0.2, BRONZE);
}

function aiRemainder(b: BatchLike) {
  // a stone skirt under the whole mesh (the lawn falls away on the Lincoln Park side), The Thinker in the court
  box(b, 0, -1.2, AI_Z, 8.7, 1.24, 11.5, SHADE);
  thinker(b, 3.2);
  setting(b);
}

const SWAP: LandmarkSwap = {
  parts: [{ model: 'sf-legion-of-honor', x: 0, y: 0, z: AI_Z, scale: [1, AI_Y, 1], glow: 0.1 }],
  build: aiRemainder,
  ship: true,
  note: 'court stretched, gateway 1.6 u; The Thinker procedural',
};

function blockers(ai: boolean): WalkBlocker[] {
  if (!ai) {
    return [
      { poly: rect(0, (BACK + COURT) / 2, HALF_W * 2, COURT - BACK + 0.4) },
      ...[-1, 1].map(sx => ({ poly: rect(sx * (HALF_W - 0.4), (COURT + FRONT) / 2, 0.8, FRONT - COURT) })),
      ...[-1, 1].map(sx => ({ poly: rect(sx * 2.7, FRONT - 0.3, 2.3, 0.6) })),
      ...[-1, 1].map(sx => ({ poly: rect(sx * 1.025, FRONT - 0.3, 0.55, 0.8) })),
      { x: 0, z: 4.4, r: 0.5 },
    ];
  }
  return [
    { poly: rect(0, -4.05, 8.8, 2.5) },
    { poly: rect(0, -2.3, 3.0, 1.0) },
    ...[-1, 1].map(sx => ({ poly: rect(sx * 3.375, 1.1, 1.75, 7.8) })),
    ...[-1, 1].map(sx => ({ poly: rect(sx * 2.625, 5.77, 3.55, 1.08) })),
    { x: 0, z: 3.2, r: 0.5 },
  ];
}

// ---------------------------------------------------------------------------
// setting (lane L, wave 4)
// ---------------------------------------------------------------------------

const G = settingGround('legion-of-honor');
/** the forecourt from the gateway screen (z 6.8) to the drive's kerb (z 12.7) */
const FORECOURT: Vec2[] = rect(0, 9.75, 9.2, 5.9);
const WALK: Vec2[] = rect(0, 9.75, 2.4, 5.9);
const LAWNS: Vec2[][] = [-1, 1].map(sx => rect(sx * 5.55, 9.75, 1.9, 5.9));
/** the Court of Honor between the colonnade wings and the gateway passage (walkable at the floor) */
const COURT_FLOOR: Vec2[] = rect(0, 2.25, 4.9, 7.0);
const PASSAGE: Vec2[] = rect(0, 6.3, 1.5, 1.2);
const LAMPS: Vec2[] = [{ x: -3.3, z: 7.6 }, { x: 3.3, z: 7.6 }, { x: -3.3, z: 11.9 }, { x: 3.3, z: 11.9 }];
const BENCHES: { x: number; z: number; ry: number }[] = [{ x: -3.9, z: 9.75, ry: Math.PI / 2 }, { x: 3.9, z: 9.75, ry: -Math.PI / 2 }];
const CYPRESSES: Vec2[] = [{ x: -5.55, z: 7.6 }, { x: 5.55, z: 7.6 }, { x: -5.55, z: 11.9 }, { x: 5.55, z: 11.9 }];
/** the Lincoln Highway's western end: a plain white marker post by the drive (no lettering) */
const MARKER: Vec2 = { x: 1.9, z: 12.3 };

function setting(b: BatchLike) {
  for (const p of LAMPS) lamp(b, p.x, G.at(p.x, p.z), p.z);
  for (const p of BENCHES) bench(b, p.x, G.at(p.x, p.z), p.z, p.ry);
  for (const p of CYPRESSES) conifer(b, p.x, G.at(p.x, p.z), p.z, 0.8);
  for (const sx of [-1, 1]) {
    // low hedges along the walk side of each lawn panel, a gap at the benches
    hedge(b, { x: sx * 4.6, z: 6.95 }, { x: sx * 4.6, z: 9.0 }, G.at(sx * 4.6, 8), 0.45, 0.35);
    hedge(b, { x: sx * 4.6, z: 10.5 }, { x: sx * 4.6, z: 12.6 }, G.at(sx * 4.6, 11.5), 0.45, 0.35);
  }
  box(b, MARKER.x, G.at(MARKER.x, MARKER.z) - 0.2, MARKER.z, 0.22, 1.0, 0.22, '#eeeae1');
}

export const legionOfHonor: SfLandmark & SiteHooks = {
  id: 'legion-of-honor',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  // pinned (lane L, wave 4): the 'terrain' base the renderer computed before the exclusion took in the forecourt
  base: 25.1,
  exclude: { poly: worldPoly(X0, Z0, YAW, rect(0, 3.1, 13.2, 19.4)) },
  sink: 0,
  build(b, lod) { build(b, lod); if (lod === 0) setting(b); },
  walk: {
    blockers: [
      ...blockers(SWAP.ship),
      ...BENCHES.map(p => ({ x: p.x, z: p.z, r: 0.45 })),
      ...CYPRESSES.map(p => ({ x: p.x, z: p.z, r: 0.4 })),
      { x: MARKER.x, z: MARKER.z, r: 0.2 },
    ],
    // the court and the gateway passage at the paving (the city ground under them lies up to 0.1 u lower)
    surfaces: [{ poly: COURT_FLOOR, y: 0.03, surface: 'pavement' }, { poly: PASSAGE, y: 0.03, surface: 'pavement' }],
  },
  swap: SWAP,
  // the AI complex thins as one while it stands between the camera and the player (walking into the court)
  fade: { r: 6, y1: 5.8, box: [4.5, 6.4], procedural: false },
  // D2-10: the dome over the museum block
  tall: [{ x: 0, z: -3.9, r: 1.1 }],
  ground: [
    ...gfill(WALK, GC.plaza, PAT.stone, G, 2, 0.05),
    ...[-1, 1].flatMap(sx => gfill(rect(sx * 2.9, 9.75, 3.4, 5.9), GC.pavers, PAT.stone, G, 2, 0.04)),
    ...LAWNS.flatMap(p => gfill(p, GC.lawn, PAT.grass, G, 2, 0.04)),
    // no street strips: the clipped footways ring the court under its paving, the steps end under a lawn panel
  ],
  lights: LAMPS.map(p => ({ x: p.x, y: G.at(p.x, p.z) + 3.8, z: p.z, size: 1, color: '#ffd9a0' })),
  plaza: [{ poly: FORECOURT, surface: 'pavement' }],
};

