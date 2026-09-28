import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { C, GLOW, LIT, NONE, box, disc, lathe, rect, worldPoly } from './kit';
import type { LandmarkSwap } from './index';
import { GC, PAT, type SiteGroundPoly, type W4Site, bench, bollard, gfill, lamp, plazaOf, siteGround, tree } from './siteKit';

/**
 * California Academy of Sciences (wave 4, P2 · map T2, the Music Concourse site): the natural-history museum,
 * aquarium, planetarium and four-storey rainforest under one roof, Renzo Piano's 2008 building on the east side of the
 * Music Concourse facing the de Young. Its signature is the 2.5-acre living roof of native plants rolling over the
 * planetarium and rainforest domes, dotted with round skylights, under a thin overhanging glass-and-steel canopy
 * (calacademy.org). No sponsor names anywhere.
 *
 * Frame: origin (−203.35, 934.9) on the building (OSM way 28695389, which the model replaces), yaw −90°: local +z faces
 * west across Music Concourse Drive to the concourse (world −x), local +x runs south (world +z). Block x −11.1…11.1,
 * z −7.15…7.15. Heights: roof ≈ 11 m → 4.9 u, the domes to +2.6 u over it.
 *
 * The procedural building is the always-shippable fallback; lane V's AI mesh (`w4.aiSlot`, H-1) swaps in through the
 * SoloView gate in the integration phase, keeping the footprint and the walk data.
 */

const ID = 'cal-academy';
const X0 = -203.35, Z0 = 934.9, YAW = -Math.PI / 2;
const g = siteGround(ID, 16.9);

const GLASS = '#a9c7cc', STEEL = '#e8e6e0', ROOF = '#8fb06a', ROOF_DARK = '#7a9c58', SKY = '#4e6a73';
const B = { x0: -11.1, x1: 11.1, z0: -7.15, z1: 7.15 }, H = 4.4;
/** the living roof's hills: [x, z, radius, height] (the planetarium dome, the rainforest dome, five small hills) */
const HILLS: [number, number, number, number][] = [[-4.6, -0.4, 3.5, 2.6], [4.4, -0.4, 3.3, 2.4], [-9.0, 3.6, 1.6, 0.8], [-9.0, -4.4, 1.6, 0.8], [9.0, 3.8, 1.7, 0.9], [9.0, -4.6, 1.7, 0.9], [0, -5.2, 1.4, 0.6]];

const top = () => g.at(0, 0) + H;

function building(b: BatchLike, lod: 0 | 2) {
  const t = top(), w = B.x1 - B.x0, d = B.z1 - B.z0;
  box(b, 0, -1.2, 0, w, t + 1.2, d, GLASS, lod === 0 ? [6, g.at(0, B.z1 + 1), -2.3, 0.25] : GLOW(0.2));
  // the roof slab and the thin canopy overhanging it on every side
  box(b, 0, t, 0, w + (lod === 0 ? 2.2 : 1.4), 0.22, d + (lod === 0 ? 2.2 : 1.4), STEEL);
  const green = (ly: number) => C(ly < 0.35 ? ROOF_DARK : ROOF);
  for (const [k, [x, z, r, h]] of HILLS.entries()) {
    if (lod === 2 && k > 1) break;
    lathe(b, [[r, 0], [r * 0.9, h * 0.35], [r * 0.62, h * 0.75], [r * 0.3, h * 0.95], [0.02, h]], x, t + 0.22, z, green, NONE, lod === 0 ? 14 : 7);
  }
  if (lod === 2) return;
  box(b, 0, t + 0.22, 0, w - 0.4, 0.08, d - 0.4, ROOF_DARK);
  // round skylights on the two domes (glowing a little at night)
  for (const [x, z, r, h] of HILLS.slice(0, 2)) {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2, rr = r * 0.5;
      disc(b, x + Math.cos(a) * rr, t + 0.22 + h * 0.62, z + Math.sin(a) * rr, 0.22, 0.05, 0, SKY, GLOW(0.5), 8);
    }
  }
  // perimeter columns carrying the canopy, the entrance on the concourse side
  for (let k = 0; k <= 10; k++) {
    const x = B.x0 - 0.8 + (k * (w + 1.6)) / 10;
    for (const z of [B.z0 - 0.8, B.z1 + 0.8]) box(b, x, g.at(x, z) - 0.2, z, 0.14, t - g.at(x, z) + 0.2, 0.14, STEEL);
  }
  const fy = g.at(0, B.z1 + 1);
  box(b, 0, fy - 0.05, B.z1 + 0.04, 4.2, 2.4, 0.08, '#5a6f73', LIT(fy));
}

/** the forecourt between the entrance and Music Concourse Drive (world x −214, local z 10.65) */
const COURT: Vec2[] = [{ x: -11.8, z: 7.2 }, { x: 11.8, z: 7.2 }, { x: 11.8, z: 9.6 }, { x: -11.8, z: 9.6 }];
const TREES: [number, number][] = [[-10.4, 8.6], [10.4, 8.6]];
const LAMPS: Vec2[] = [{ x: -5.2, z: 9.0 }, { x: 5.2, z: 9.0 }];

function forecourt(b: BatchLike) {
  for (const [k, [x, z]] of TREES.entries()) tree(b, x, g.at(x, z), z, 1.1, k + 61);
  for (const l of LAMPS) lamp(b, l.x, g.at(l.x, l.z), l.z);
  for (const x of [-7.6, 7.6]) bench(b, x, g.at(x, 8.4), 8.4, Math.PI);
  for (const x of [-2.6, -1.3, 1.3, 2.6]) bollard(b, x, g.at(x, 9.3), 9.3);
}

function build(b: BatchLike, lod: 0 | 2) {
  building(b, lod);
  if (lod === 0) forecourt(b);
}

function ground(): SiteGroundPoly[] {
  return gfill(COURT, GC.plaza, PAT.stone, g, 4);
}

const EXCLUDE: Vec2[] = [{ x: -12.2, z: -8.4 }, { x: 12.2, z: -8.4 }, { x: 12.2, z: 9.7 }, { x: -12.2, z: 9.7 }];

/**
 * Lane V's AI building (W4-L4, `sf-cal-academy`: glass hall, the thin roof slab on slim columns, the living roof with
 * its two porthole domes and five small hills; published at this block's bounds, scale 1) at the block's ground. The
 * remainder is the forecourt and a glass plinth under the model where the ground falls away. Gate: see SWAP.note.
 */
const SWAP: LandmarkSwap = {
  parts: [{ model: 'sf-cal-academy', x: 0, y: +g.at(0, 0).toFixed(2), z: 0, yaw: 0, scale: [1, 1, 1], glass: { color: '#ffe3b0', strength: 0.35 }, castShadow: true }],
  build(b) {
    box(b, 0, -1.2, 0, B.x1 - B.x0 - 0.6, g.at(0, 0) + 1.2, B.z1 - B.z0 - 0.6, GLASS);
    forecourt(b);
  },
  ship: true,
  note: 'AI (SoloView gate, golden: porthole skylights on the two domes, rolling hills, the rounded slab on slim columns) vs the procedural hills',
};

export const calAcademy: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  swap: SWAP,
  walk: {
    blockers: [{ poly: rect(0, 0, B.x1 - B.x0, B.z1 - B.z0) }, ...TREES.map(([x, z]) => ({ x, z, r: 0.3 }))],
    surfaces: [{ poly: COURT, y: 'terrain', surface: 'plaza' }],
  },
  ground: ground(),
  fade: { r: 8, y1: 7.6, box: [11.6, 7.6] },
  lights: [...LAMPS.map(l => ({ x: l.x, y: g.at(l.x, l.z) + 3.8, z: l.z, size: 1, color: '#ffd9a0' })), { x: 0, y: top() - 1, z: 8.6, size: 3, color: '#ffe8c0' }],
  plaza: [plazaOf(COURT)],
  w4: {
    placeId: 'cal-academy',
    attractions: ['cal-academy'],
    arrival: { x: 0, z: 9.0, heading: Math.PI },
    photo: { target: [0, 4, 0], distance: 36, elevation: 0.35, bearing: 0.7 },
    flag: { x: -4.6, z: -0.4, h: 30 },
    height: { realM: 25, u: 7.2, top: 8.2, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/28695389'],
    terrain: [-13, -10, 13, 11],
    aiSlot: { model: 'w4-cal-academy', id: 'sf-cal-academy', at: [0, +g.at(0, 0).toFixed(2), 0], note: 'lane V (data/sf/w4Models.ts, sf-cal-academy): living roof with the two domes and the glass canopy (H-1); ≤ 6k, ≤ 4k if the Music Concourse view is over 395k' },
  },
};

