import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { LIT, NONE, box, cyl, disc, lathe, worldPoly } from './kit';
import { type W4Site, hipRoof, siteGround } from './siteKit';

/**
 * Holy Virgin Cathedral, "Joy of All Who Sorrow" (wave 4, P3 · map T3, the geary-west site): the Russian Orthodox
 * cathedral on Geary Boulevard between 26th and 27th Avenues, whose five onion domes in gold leaf shine over the Outer
 * Richmond (Wikipedia); 125 ft to the top cross (SFGate); white with red trim since its 2015–16 repainting
 * (Orthodox Arts Journal) — facts as re-checked in lane V's report. An active cathedral: a quiet card, no gameplay
 * objects on or in it, no icons or inscriptions copied.
 *
 * Frame: origin (−493.07, 1000.05) at the centre of OSM way 286435447 (x −1.3…1.4, z −1.6…1.5, the city's 6.14 u box it
 * replaces), yaw 45°: local +z faces Geary Blvd (its north carriageway from z ≈ 1.7), the apartments of 27th Ave are
 * west (x ≤ −4.1), the neighbours east (x ≥ 1.6) and behind (z ≤ −1.7) stay city buildings. 38.1 m → 9.1 u to the top
 * cross (H = 3.2 + 0.155·h). Lane V's AI cathedral (`sf-holy-virgin`) was fitted to its concept's proportions
 * (6.1 × 6.7 u), wider than this lot: see the lane-L report (Requests).
 */

const ID = 'geary-west';
const X0 = -493.07, Z0 = 1000.05, YAW = Math.PI / 4;
const g = siteGround(ID, 10.1);

const WHITE = '#f3efe6', RED = '#b3392f', GOLD = '#d9b44a', ROOF = '#d6cfc2', DARK = '#3f3a36';
const W = 2.6, D = 3.0, CZ = -0.05, WALL = 4.2;
/** onion dome profile (radius, height), scaled per dome */
const ONION: [number, number][] = [[0.55, 0], [0.78, 0.35], [0.72, 0.72], [0.42, 1.08], [0.12, 1.38], [0.03, 1.6]];
const onion = (s: number): [number, number][] => ONION.map(([r, y]) => [r * s, y * s]);

function build(b: BatchLike, lod: 0 | 2) {
  const y0 = g.at(0, 0);
  // the body and its roof
  box(b, 0, y0 - 1.2, CZ, W, WALL + 1.2, D, WHITE, LIT(y0));
  if (lod === 2) {
    lathe(b, [[0.6, 0], [0.75, 3.0], [0.05, 4.1]], 0, y0 + WALL, CZ, GOLD, NONE, 6);
    return;
  }
  box(b, 0, y0 + WALL - 0.25, CZ, W + 0.12, 0.25, D + 0.12, RED);
  hipRoof(b, 0, y0 + WALL, CZ, W + 0.2, D + 0.2, 0.7, ROOF);
  // the rounded gable over the front (a white arch with a red rim), the door, tall windows
  const fz = CZ + D / 2;
  // (both discs sit inside the front wall's plane, so only their upper halves show above the cornice)
  disc(b, 0, y0 + WALL - 0.25, fz - 0.12, 1.05, 0.08, 0, RED, NONE, 12);
  disc(b, 0, y0 + WALL - 0.25, fz - 0.06, 0.9, 0.08, 0, WHITE, NONE, 12);
  box(b, 0, y0, fz + 0.03, 0.8, 1.6, 0.06, DARK, LIT(y0));
  disc(b, 0, y0 + 1.6, fz + 0.04, 0.4, 0.06, 0, DARK, LIT(y0), 8);
  for (const x of [-0.85, 0.85]) box(b, x, y0 + 1.1, fz + 0.03, 0.34, 1.5, 0.06, DARK, LIT(y0));
  // the central drum and dome, and four small domes at the corners, all gold with crosses
  cyl(b, 0, y0 + WALL + 0.3, CZ, 0.55, 2.1, WHITE, NONE, 8);
  box(b, 0, y0 + WALL + 2.0, CZ, 1.12, 0.14, 1.12, RED);
  lathe(b, onion(1), 0, y0 + WALL + 2.4, CZ, GOLD, NONE, 8);
  box(b, 0, y0 + WALL + 4.0, CZ, 0.06, 0.9, 0.06, GOLD);
  box(b, 0, y0 + WALL + 4.55, CZ, 0.4, 0.06, 0.06, GOLD);
  for (const [x, z] of [[-0.8, CZ - 1.0], [0.8, CZ - 1.0], [-0.8, CZ + 1.0], [0.8, CZ + 1.0]]) {
    cyl(b, x, y0 + WALL + 0.2, z, 0.28, 1.1, WHITE, NONE, 6);
    lathe(b, onion(0.5), x, y0 + WALL + 1.3, z, GOLD, NONE, 6);
    box(b, x, y0 + WALL + 2.1, z, 0.05, 0.45, 0.05, GOLD);
  }
}

/** exclusion: the cathedral's lot (the neighbours on three sides and Geary Blvd stay) */
const EXCLUDE: Vec2[] = [{ x: -1.45, z: -1.65 }, { x: 1.5, z: -1.65 }, { x: 1.5, z: 1.62 }, { x: -1.45, z: 1.62 }];

export const gearyWest: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: [{ poly: [{ x: -1.3, z: -1.55 }, { x: 1.3, z: -1.55 }, { x: 1.3, z: 1.45 }, { x: -1.3, z: 1.45 }] }] },
  lights: [{ x: 0, y: g.at(0, 0) + WALL + 3.2, z: CZ, size: 1.6, color: '#ffe2a0' }],
  plaza: [
    // the sidewalks of Geary Blvd in front of it and across the boulevard (no gameplay objects on the cathedral)
    { poly: [{ x: -5.0, z: 1.65 }, { x: 5.0, z: 1.65 }, { x: 5.0, z: 3.4 }, { x: -5.0, z: 3.4 }], surface: 'pavement' },
    { poly: [{ x: -6.0, z: 7.6 }, { x: 6.0, z: 7.6 }, { x: 6.0, z: 8.8 }, { x: -6.0, z: 8.8 }], surface: 'pavement' },
  ],
  w4: {
    placeId: 'holy-virgin-cathedral',
    attractions: ['holy-virgin-cathedral'],
    arrival: { x: 0, z: 2.6, heading: Math.PI },
    photo: { target: [0, 5, 0], distance: 22, elevation: 0.25, bearing: 0.3 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 38.1, u: 9.1, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/286435447'],
    terrain: [-4, -4, 4, 5],
    terrainStep: 1,
    aiSlot: { model: 'w4-holy-virgin', note: 'lane V (data/sf/w4Models.ts, sf-holy-virgin): five gold onion domes, white with red trim; to be re-fitted to this lot (2.6 × 3.0 u, 9.1 u to the cross), front +Z = Geary Blvd' },
    notes: 'Active cathedral: quiet card, no gameplay objects.',
  },
};
