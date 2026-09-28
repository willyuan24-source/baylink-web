import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, ICO, M } from '../../builder';
import { NONE, SF, box, rect, worldPoly } from './kit';
import { FC, GC, PAT, type SiteGroundPoly, type W4Site, bench, fence, gfill, hipRoof, planter, siteGround } from './siteKit';

/**
 * The San Francisco Botanical Garden's main gate (wave 4, P3 · map T3, with the Music Concourse group): 55 acres in
 * Golden Gate Park holding more than 8,000 kinds of plants; the magnolia collection flowers from January to March
 * (gggp.org). The garden itself is the city's park ground; this site is the entrance on Martin Luther King Jr Drive at
 * 9th Avenue (OSM node 7838369891, entrance=main; lane P re-anchored the place row and the arrival here): a paved
 * forecourt, two stone gate piers under a timber lintel with the gate leaves open, the low fence along the drive, the
 * ticket kiosk, magnolias in flower, benches, planters and a bike rack. No signs or lettering.
 *
 * Frame: origin (−178.3, 970.9) at the gate, yaw 140.4°: local +z faces MLK Drive (centreline z 3.3, 4.4 wide: the
 * kerb at z 1.1), +x runs along it toward 9th Avenue's side of the garden; the main path leads in toward (3.4, −8.3).
 * The San Francisco County Fair Building stands just west (its front from (2.15, −3.2) to (−13.8, −0.3), its east wall
 * from (2.1, −3.2) to (0.7, −11.1)) and stays the city's; the old kiosk (OSM way 941355659, at (2.0, −2.8), against
 * that corner) is re-drawn 2 u east of it so the path in passes between the kiosk and the building (W4-L-review: a
 * magnolia and the path's crowd spot stood inside the Fair Building, and the arrival looked straight at its wall).
 */

const ID = 'botanical-garden-gate';
const X0 = -178.3, Z0 = 970.9, YAW = (140.4 * Math.PI) / 180;
const g = siteGround(ID, 17.2);

const GATE_Z = -1.2, PIER_X = 1.4;
const KIOSK = { x: 4.0, z: -2.6, w: 1.3, d: 1.1 };
const COURT: Vec2[] = [{ x: -1.9, z: GATE_Z - 0.2 }, { x: 5.8, z: GATE_Z - 0.2 }, { x: 5.8, z: 0.95 }, { x: -1.9, z: 0.95 }];
const MAGNOLIAS: [number, number, number][] = [[5.4, -3.4, 1.1], [3.9, -4.6, 0.8], [6.4, -1.8, 0.85]];
const BLOSSOM = ['#f2c4d4', '#e9a8c0', '#f7dde6'];

function magnolia(b: BatchLike, x: number, z: number, s: number, k: number) {
  const y = g.at(x, z);
  b.add(BOX(), M(x, y - 0.2, z, 0.4, 0.2 * s, 1.9 * s, 0.2 * s), FC.trunk);
  b.add(ICO(0), M(x, y + 2.3 * s, z, k, 1.25 * s, 0.95 * s, 1.25 * s), BLOSSOM[k % 3], [0, 0, 0.3, 0]);
  b.add(ICO(0), M(x + 0.5 * s, y + 1.9 * s, z - 0.3 * s, k + 1, 0.8 * s, 0.7 * s, 0.8 * s), BLOSSOM[(k + 1) % 3], [0, 0, 0.3, 0]);
}

function build(b: BatchLike, lod: 0 | 2) {
  const gy = g.at(0, GATE_Z);
  // the gate: two stone piers, the timber lintel with its little roof
  for (const x of [-PIER_X, PIER_X]) box(b, x, gy - 0.3, GATE_Z, 0.6, lod === 0 ? 2.6 : 2.9, 0.6, SF.stoneWarm);
  if (lod === 2) return;
  box(b, 0, gy + 2.3, GATE_Z, 2 * PIER_X + 0.9, 0.32, 0.45, '#7a5a40');
  hipRoof(b, 0, gy + 2.62, GATE_Z, 2 * PIER_X + 1.2, 0.9, 0.35, '#5f6663');
  // the gate leaves, swung open against the fence line
  for (const s of [-1, 1]) b.add(BOX(), M(s * (PIER_X - 0.35), gy, GATE_Z - 0.55, 0, 0.06, 1.6, 0.9), '#3f4a47');
  // the low fence along the drive, from the piers out
  fence(b, [{ x: PIER_X + 0.3, z: GATE_Z }, { x: 6.6, z: GATE_Z }], g.at, 0.9, '#4f5a55');
  fence(b, [{ x: -PIER_X - 0.3, z: GATE_Z }, { x: -1.9, z: GATE_Z }], g.at, 0.9, '#4f5a55');
  // the ticket kiosk
  const ky = g.at(KIOSK.x, KIOSK.z);
  box(b, KIOSK.x, ky - 0.3, KIOSK.z, KIOSK.w, 2.3, KIOSK.d, '#e6d7bd', NONE);
  box(b, KIOSK.x, ky + 0.9, KIOSK.z + KIOSK.d / 2 + 0.02, KIOSK.w * 0.6, 0.6, 0.04, '#4f6a6e', [0, 0, 0, 0.6]);
  hipRoof(b, KIOSK.x, ky + 2.0, KIOSK.z, KIOSK.w + 0.4, KIOSK.d + 0.4, 0.5, '#6f5f55');
  for (const [k, [x, z, s]] of MAGNOLIAS.entries()) magnolia(b, x, z, s, k);
  bench(b, 3.9, g.at(3.9, 0.3), 0.3, Math.PI);
  bench(b, -0.9, g.at(-0.9, 0.35), 0.35, Math.PI);
  for (const x of [-PIER_X - 0.9, PIER_X + 1.1]) planter(b, x, g.at(x, GATE_Z + 0.55), GATE_Z + 0.55, 0.9, 0.6);
  // a bike rack by the kiosk
  for (const k of [-0.4, 0, 0.4]) b.add(BOX(), M(5.2 + k, g.at(5.2, 0.2) - 0.1, 0.2, 0, 0.05, 0.8, 0.5), FC.metal);
}

function ground(): SiteGroundPoly[] { return gfill(COURT, GC.pavers, PAT.stone, g, 3); }

const BLOCKERS = [
  { poly: rect(-PIER_X, GATE_Z, 0.7, 0.7) }, { poly: rect(PIER_X, GATE_Z, 0.7, 0.7) },
  { poly: [{ x: PIER_X + 0.35, z: GATE_Z - 0.08 }, { x: 6.6, z: GATE_Z - 0.08 }, { x: 6.6, z: GATE_Z + 0.08 }, { x: PIER_X + 0.35, z: GATE_Z + 0.08 }] },
  { poly: rect(KIOSK.x, KIOSK.z, KIOSK.w + 0.1, KIOSK.d + 0.1) },
];

/** exclusion: the forecourt behind the kerb, the gate, the kiosk and the first magnolias (the Fair Building stays) */
const EXCLUDE: Vec2[] = [{ x: -2.3, z: 0.95 }, { x: 5.0, z: 0.95 }, { x: 7.2, z: 0.6 }, { x: 7.2, z: -4.2 }, { x: 2.2, z: -5.4 }, { x: 0.0, z: -5.4 }, { x: -0.2, z: -3.3 }, { x: -2.3, z: -2.3 }];

export const botanicalGardenGate: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: BLOCKERS },
  ground: ground(),
  lights: [{ x: KIOSK.x, y: g.at(KIOSK.x, KIOSK.z) + 1.3, z: KIOSK.z + 0.8, size: 1.1, color: '#ffe0b0' }],
  plaza: [
    { poly: COURT, surface: 'plaza' },
    // the main path in (north of the Fair Building's front, then east of its wall, past the kiosk), and the lawn under
    // the magnolias
    { poly: [{ x: -0.6, z: GATE_Z - 0.2 }, { x: 1.0, z: GATE_Z - 0.2 }, { x: 3.2, z: -3.0 }, { x: 3.6, z: -5.4 }, { x: 2.2, z: -5.5 }, { x: 2.15, z: -3.25 }, { x: 1.9, z: -3.1 }, { x: -0.2, z: -2.7 }], surface: 'pavement' },
    { poly: [{ x: 4.3, z: -4.6 }, { x: 7.0, z: -4.2 }, { x: 7.0, z: GATE_Z - 0.4 }, { x: 4.3, z: GATE_Z - 0.4 }], surface: 'grass' },
  ],
  w4: {
    placeId: 'osm-w120480164',
    attractions: ['sf-botanical-garden'],
    // looking in along the main path (past the Fair Building's corner), not at its wall
    arrival: { x: 0.3, z: 0.1, heading: 2.68 },
    photo: { target: [1.5, 1.6, -2], distance: 13, elevation: 0.3, bearing: 0.5 },
    flag: { x: 0, z: -0.3, h: 30 },
    height: { realM: 8, u: 3.2, top: 3.6, rule: 'overlook' },
    osm: ['node/7838369891', 'way/941355659'],
    terrain: [-3, -6, 8, 2],
    terrainStep: 1,
    notes: 'The garden is the city\'s park ground (its middle is the attraction point, 60 u in); admission rules for non-residents and event dates change (lane C\'s card).',
  },
};
