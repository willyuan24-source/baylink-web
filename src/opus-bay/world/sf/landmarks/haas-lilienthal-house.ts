import type { Vec2 } from '../../../core/types';
import { type BatchLike, CONE, CYL, M } from '../../builder';
import { LIT, NONE, box, gable, rect, worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, gfill, hipRoof } from './siteKit';
import { signBoard, site3Ground, standSpot } from './siteKit3';

/**
 * Haas-Lilienthal House (wave 4, P4 · map T3, Pacific Heights): 2007 Franklin Street, a redwood Queen Anne-Eastlake
 * house built in 1886 by architect Peter R. Schmidt for the merchant William Haas, on a deep, narrow lot: open gables,
 * many kinds of shingles and siding and "a turreted corner tower with a 'witches cap' roof". It came through the 1906
 * earthquake with slight damage (the fires stopped at Van Ness Avenue), was given to San Francisco Heritage in 1973 as
 * the city's only intact Victorian home open regularly as a museum, and became a National Trust National Treasure in
 * 2012 (Wikipedia "Haas–Lilienthal House"; haas-lilienthalhouse.org: docent tours on select days, check before going).
 *
 * Toy: the house on its OSM footprint (way 256993595) — the deep rear block under a hip roof, the front block with its
 * open gable to Franklin Street and a two-storey bay, the round corner tower with its witch's cap, the stoop and a blank
 * museum plaque (no text); body colours are a toy choice. The neighbours are the city's.
 *
 * Frame: origin (−112.97, 318.97) at the footprint's centre, yaw 144.8°: local +z faces Franklin Street (centreline
 * z ≈ 5.2, 4.4 u wide), Jackson Street is at x 6.5, Washington Street at x −7.3. Height policy (≈ 20 m to the tower's
 * cap, estimated): 6.3 u; the walls 4.3 u.
 */

const ID = 'haas-lilienthal-house';
const X0 = -112.97, Z0 = 318.97, YAW = (144.8 * Math.PI) / 180;
const g = site3Ground(ID, 16.1);

const BODY = '#b8ad99', TRIM = '#f1ece0', ROOF = '#4d5354', GLASS = '#3b4750', STOOP = '#8b7a66';
const REAR = { x0: -1.5, x1: 1.43, z0: -2.05, z1: 0.15 }, FRONT = { x0: -0.26, x1: 1.66, z0: 0.1, z1: 2.55 };
const WALL = 4.3, TOWER = { x: -0.28, z: 2.2, r: 0.62 };

function build(b: BatchLike, lod: 0 | 2) {
  const y0 = g.at(0, 1.5);
  const blk = (r: typeof REAR) => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, w: r.x1 - r.x0, d: r.z1 - r.z0 });
  const R = blk(REAR), F = blk(FRONT);
  if (lod === 2) {
    // far: one block and a hip roof over the whole footprint
    box(b, 0.08, y0 - 1.3, 0.25, 3.2, WALL + 1.3, 4.6, BODY, LIT(y0));
    hipRoof(b, 0.08, y0 + WALL, 0.25, 3.3, 4.7, 1.3, ROOF);
    return;
  }
  const info = [5, y0, -2, 0] as const;
  box(b, R.x, y0 - 1.3, R.z, R.w, WALL + 1.3, R.d, BODY, info);
  box(b, F.x, y0 - 1.3, F.z, F.w, WALL + 1.3, F.d, BODY, info);
  hipRoof(b, R.x, y0 + WALL, R.z, R.w + 0.2, R.d + 0.2, 1.1, ROOF);
  gable(b, F.x, y0 + WALL, F.z + 0.05, F.d + 0.1, F.w, 1.35, ROOF, BODY, Math.PI / 2, 0.14);
  // the corner tower with its witch's cap
  b.add(CYL(8), M(TOWER.x, y0 - 0.2, TOWER.z, 0, TOWER.r, WALL + 0.8, TOWER.r), BODY, info);
  b.add(CONE(8), M(TOWER.x, y0 + WALL + 0.6, TOWER.z, 0, TOWER.r + 0.12, 1.6, TOWER.r + 0.12), ROOF);
  // trim bands between the storeys, the front bay (two storeys) with its little roof
  for (const fy of [1.45, 2.9]) box(b, F.x, y0 + fy, F.z, F.w + 0.06, 0.1, F.d + 0.06, TRIM);
  box(b, 0.95, y0 + 0.2, FRONT.z1 + 0.2, 1.1, 2.65, 0.42, BODY);
  box(b, 0.95, y0 + 2.85, FRONT.z1 + 0.2, 1.24, 0.12, 0.54, TRIM);
  // windows: the bay's front, the tower, the gable, the rear block's exposed Franklin-side face
  for (const fy of [0.55, 1.95]) {
    box(b, 0.95, y0 + fy, FRONT.z1 + 0.42, 0.62, 0.9, 0.04, GLASS, LIT(y0));
    box(b, TOWER.x - 0.1, y0 + fy + 0.1, TOWER.z + TOWER.r - 0.02, 0.36, 0.8, 0.06, GLASS, LIT(y0));
  }
  box(b, TOWER.x - 0.1, y0 + 3.4, TOWER.z + TOWER.r - 0.02, 0.36, 0.7, 0.06, GLASS, LIT(y0));
  box(b, 0.95, y0 + 3.35, FRONT.z1 + 0.02, 0.5, 0.7, 0.04, GLASS, LIT(y0));
  for (const fy of [0.6, 2.0, 3.3]) box(b, -0.9, y0 + fy, REAR.z1 + 0.02, 0.45, 0.8, 0.04, GLASS, LIT(y0));
  // the door and its stoop (to the Franklin sidewalk), a plain plaque on two posts (no text)
  box(b, 0.3, y0 + 0.35, FRONT.z1 + 0.01, 0.5, 1.2, 0.04, '#5e3f2f', NONE);
  box(b, 0.3, y0 - 0.2, FRONT.z1 + 0.2, 0.8, 0.5, 0.35, STOOP);
  box(b, 0.3, y0 - 0.2, FRONT.z1 + 0.45, 0.8, 0.3, 0.2, STOOP);
  signBoard(b, 1.95, g.at(1.95, 2.9), 2.9, 0, 0.55, 0.4, 0.55, '#6d5b3f', '#3f3a33');
}

const BLOCKERS = [
  { poly: rect((REAR.x0 + REAR.x1) / 2, (REAR.z0 + REAR.z1) / 2, REAR.x1 - REAR.x0, REAR.z1 - REAR.z0) },
  { poly: rect((FRONT.x0 + FRONT.x1) / 2, (FRONT.z0 + FRONT.z1) / 2 + 0.1, FRONT.x1 - FRONT.x0, FRONT.z1 - FRONT.z0 + 0.25) },
  { x: TOWER.x, z: TOWER.z, r: TOWER.r },
];

/**
 * the crowd's stand spots (the tour queue) on the Franklin Street sidewalk in front of the house and its neighbours: the
 * city's sidewalk is a strip ≈ 0.5 u wide at z ≈ 3.1 with driveway cuts, the carriageway starts at z ≈ 3.3 (the early
 * record's 18 × 1.7 u strip put every spot in the traffic lanes; W4-L3-review)
 */
const QUEUE: Vec2[] = [{ x: -2.5, z: 3.1 }, { x: -1.2, z: 3.1 }, { x: 2.2, z: 3.1 }];
function ground(): SiteGroundPoly[] {
  // a paved path beside the house to the plaque
  return gfill([{ x: 1.7, z: 2.3 }, { x: 2.2, z: 2.3 }, { x: 2.2, z: 3.1 }, { x: 1.7, z: 3.1 }], GC.pavers, PAT.stone, g, 3, 0.07);
}

/** exclusion: the house's footprint (+ its stoop); Franklin Street and the neighbours stay the city's */
const EXCLUDE: Vec2[] = [{ x: -1.65, z: -2.2 }, { x: 1.8, z: -2.2 }, { x: 1.8, z: 2.2 }, { x: 2.3, z: 2.2 }, { x: 2.3, z: 2.95 }, { x: -0.95, z: 2.95 }, { x: -0.95, z: 0.25 }, { x: -1.65, z: 0.25 }];

export const haasLilienthalHouse: W4Site = {
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
  tall: [{ x: TOWER.x, z: TOWER.z, r: TOWER.r + 0.15 }],
  ground: ground(),
  lights: [{ x: 0.3, y: g.at(0.3, 2.9) + 1.8, z: 2.9, size: 1.2, color: '#ffe0b0' }],
  plaza: QUEUE.map(p => standSpot(p)),
  w4: {
    placeId: 'osm-w256993595',
    attractions: ['haas-lilienthal-house'],
    arrival: { x: 3.5, z: 3.9, heading: -2.19 },
    photo: { target: [0.2, 3, 0.8], distance: 15, elevation: 0.2, bearing: -0.35 },
    flag: { x: 0, z: -0.8, h: 30 },
    height: { realM: 20, u: 6.3, top: 7.03, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/256993595'],
    terrain: [-3, -3, 4, 4],
    ringMin: 0.7,
    notes: 'A house museum on its own narrow lot between row neighbours (they close the walk-around ring to 72 %): the crowd spots are three points on the Franklin Street sidewalk in front of it (the tour queue), never the carriageway. Paint colours are a toy choice, not a claim.',
  },
};
