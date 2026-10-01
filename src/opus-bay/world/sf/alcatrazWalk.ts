import type { SurfaceKind, Vec2 } from '../../core/types';
import { ALCA_X, ALCA_Z } from './landmarks/alcatrazGround';

/**
 * Wave 8 · lane A · Alcatraz on foot (PURE: no three.js, no store). The island's walkable part, its own small walking
 * graph and the arrival, in the landmark's LOCAL frame (world/sf/landmarks/alcatraz.ts: origin ALCA_X / ALCA_Z, yaw 0,
 * base 0, so local = world − origin and a numeric surface y is world y).
 *
 * The published ground under the island (alcatrazGround.ts, a smoothed 2 u DEM) rises ≈ 0.9–1.0 u per u from the dock to
 * the cellhouse plateau, at the controller's wall grade: the drawn switchback road (OSM) lies on that slope with its legs
 * 1.5–2 u apart, too close for walkable strips of their own (the strips would merge and the walk would cut straight up
 * the hill). So the toy walk is (all of it on the drawn ground, `y: 'terrain'`, except the dock):
 *
 *   the dock        one deck at y 0.3 over the apron, the jetty and the ferry float (Alcatraz Ferry Terminal, OSM way
 *                   27999864; the quay where you wait for the boat is on the jetty)
 *   the dock road   along Building 64's water side, west to the foot of the stair
 *   the stair       a concrete stairway (drawn by alcatraz.ts) straight up the hill between Building 64's west end and
 *                   the Sally Port, ≈ 7 u up — the toy's short cut for the switchback's 1⁄4-mile climb
 *   the plateau     the cellhouse front: south of the cellhouse and the Administration Block (the main door), east to
 *                   the lighthouse's terrace (south and east of it) by the Warden's House ruin
 *
 * NPS: "the walk from the dock to the cellhouse is steep: the equivalent of a 13-story climb" — the toy's stair says
 * the same in one flight (https://www.nps.gov/alca/planyourvisit/accessibility.htm, read 2026-09-30).
 *
 *   ALCA_WALK_SURFACES     the landmark's walk.surfaces (local)
 *   ALCA_WALK_BLOCKERS     extra walk blockers on the plateau (the lighthouse, the small buildings, the Warden's House)
 *   ALCA_STAIR             the stairway (local; alcatraz.ts draws its steps)
 *   ALCA_WALK_GRAPH        the island's own walking graph (WORLD coordinates): nodes + edges, the dock node first
 *   ALCA_ARRIVAL           the arrival spot (WORLD): the cellhouse front, where the first arrival moment fires
 *   ALCA_PHOTO             the photo pose of the arrival's reveal (LOCAL, the SoloView formula)
 *   onAlcatraz(x, z)       is a WORLD point on the island (the exclusion's box)? (the take-me-back offer, the tests)
 */

export const ALCA_ORIGIN: Vec2 = { x: ALCA_X, z: ALCA_Z };
const W = (x: number, z: number): Vec2 => ({ x: +(ALCA_X + x).toFixed(2), z: +(ALCA_Z + z).toFixed(2) });

/** the dock's deck height (the drawn apron is 0.32, the float 0.25) */
export const ALCA_DOCK_Y = 0.3;

/** The stairway: centre line from its foot (on the dock road) to its top (on the plateau), width (local). */
export const ALCA_STAIR = { x: 3.2, z0: -13.0, z1: -5.2, width: 2.2, steps: 26 } as const;

/** A strip of half width `hw` along a polyline, as one quad per segment (local). */
function strip(pts: readonly [number, number][], hw: number): Vec2[][] {
  const out: Vec2[][] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az) || 1;
    // the quads overlap their neighbours by `hw` at the joints (no gaps on the bends)
    const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz * hw, nz = ux * hw, ex = ux * hw * 0.6, ez = uz * hw * 0.6;
    out.push([
      { x: ax - ex + nx, z: az - ez + nz }, { x: bx + ex + nx, z: bz + ez + nz },
      { x: bx + ex - nx, z: bz + ez - nz }, { x: ax - ex - nx, z: az - ez - nz },
    ]);
  }
  return out;
}
const R = (x: number, z: number, w: number, d: number, ry = 0): Vec2[] => {
  const c = Math.cos(ry), s = Math.sin(ry);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => { const px = (u * w) / 2, pz = (v * d) / 2; return { x: x + px * c + pz * s, z: z - px * s + pz * c }; });
};

/** the dock road: from the jetty along Building 64's water side to the stair's foot (local) */
export const ALCA_DOCK_ROAD: readonly [number, number][] = [[14.2, -15.6], [10.6, -14.4], [6.0, -13.6], [ALCA_STAIR.x, ALCA_STAIR.z0]];

/** The island's walk surfaces (local): the first listed wins where they overlap. */
export const ALCA_WALK_SURFACES: readonly { poly: Vec2[]; y: number | 'terrain'; surface: SurfaceKind }[] = [
  // the dock: the apron (alcatraz.ts dock(): rect 9.5, −16.4, 9.8 × 2.2, 0.14), the jetty out to the float, the float
  { poly: R(9.5, -16.4, 10.4, 2.6, 0.14), y: ALCA_DOCK_Y, surface: 'wood' },
  { poly: [{ x: 9.7, z: -18.2 }, { x: 17.6, z: -18.9 }, { x: 17.6, z: -15.4 }, { x: 10.2, z: -15.6 }], y: ALCA_DOCK_Y, surface: 'wood' },
  { poly: R(18.98, -18.12, 3.6, 2.1, -174 * Math.PI / 180), y: ALCA_DOCK_Y, surface: 'wood' },
  // the stairway
  { poly: R(ALCA_STAIR.x, (ALCA_STAIR.z0 - 0.6 + ALCA_STAIR.z1) / 2, ALCA_STAIR.width, ALCA_STAIR.z1 - ALCA_STAIR.z0 + 0.8), y: 'terrain', surface: 'stairs' },
  // the dock road
  ...strip(ALCA_DOCK_ROAD, 1.2).map(poly => ({ poly, y: 'terrain' as const, surface: 'pavement' as const })),
  // the plateau: the cellhouse front (south of the cellhouse and the Administration Block) and the lighthouse terrace
  {
    poly: [
      { x: 2.1, z: -6.0 }, { x: 5.0, z: -6.6 }, { x: 11.8, z: -6.7 }, { x: 11.8, z: -4.5 }, { x: 13.2, z: -4.3 }, { x: 13.2, z: -0.8 }, { x: 11.9, z: -0.8 },
      { x: 11.9, z: -2.4 }, { x: 8.1, z: -2.9 }, { x: 8.1, z: -3.45 }, { x: 2.1, z: -3.45 },
    ],
    y: 'terrain', surface: 'plaza',
  },
];

/** The lighthouse (world/backdrop.ts draws it at OSM way 99202294, 37.82625, −122.4223: local ≈ 11.0, −1.37). */
export const ALCA_LIGHTHOUSE: Vec2 = { x: 11.0, z: -1.37 };

/**
 * Walk blockers on the plateau (local) beside alcatraz.ts's own (the cellhouse, its wings, Building 64 …): the
 * lighthouse's base, the three small buildings by it and the Warden's House ruin (its oriented boxes, alcatraz.ts SMALL /
 * WARDEN: centre, length along the angle, width across, angle in degrees, maths +x → +z).
 */
export const ALCA_WALK_BLOCKERS: readonly ({ x: number; z: number; r: number } | { poly: Vec2[] })[] = [
  { x: ALCA_LIGHTHOUSE.x, z: ALCA_LIGHTHOUSE.z, r: 0.8 },
  ...([[9.19, -4.33, 0.59, 1.72, 98], [9.44, -1.26, 1.54, 2.69, 0], [12.48, -1.24, 0.63, 0.9, 94], [13.57, -5.47, 2.57, 1.8, 5]] as const)
    .map(([x, z, L, Wd, a]) => ({ poly: R(x, z, L, Wd, (-a * Math.PI) / 180) })),
];

/** The arrival spot (WORLD): the cellhouse front, before the Administration Block's main door. */
export const ALCA_ARRIVAL_LOCAL: Vec2 = { x: 6.9, z: -4.7 };
export const ALCA_ARRIVAL: Vec2 = W(ALCA_ARRIVAL_LOCAL.x, ALCA_ARRIVAL_LOCAL.z);

/**
 * The reveal's photo pose (LOCAL, the SoloView formula: target, distance, elevation, bearing): from the south-east over
 * the dock, the cellhouse with the lighthouse at its east end and the water tower beyond.
 */
export const ALCA_PHOTO = { target: [3, 7, -1] as const, distance: 46, elevation: 0.36, bearing: 2.55 } as const;

/** The island's walking graph (WORLD): the dock → the stair → the plateau; edges both ways (node indices). */
const NODES_LOCAL: readonly [number, number][] = [
  [15.6, -16.6], // 0 the quay (data/ferry ALCA_TERMINALS.island.quay)
  [14.2, -15.6], // 1 the jetty's end of the dock road
  [10.6, -14.4], // 2 under Building 64
  [6.0, -13.6], // 3 Building 64's west end
  [ALCA_STAIR.x, ALCA_STAIR.z0 + 0.3], // 4 the stair's foot
  [ALCA_STAIR.x, ALCA_STAIR.z1 - 0.3], // 5 the stair's top
  [ALCA_ARRIVAL_LOCAL.x, ALCA_ARRIVAL_LOCAL.z], // 6 the cellhouse front
  [10.6, -3.6], // 7 the lighthouse's terrace (south of it, by the Warden's House ruin)
];
const EDGES: readonly [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]];
export const ALCA_WALK_GRAPH = {
  nodes: NODES_LOCAL.map(([x, z]) => W(x, z)),
  edges: EDGES,
  /** the node the ferry's quay is (the dock) */
  dock: 0,
  /** the node of the arrival */
  arrival: 6,
  /** the places a player is sent to or stops at (the static sweep judges them; the quay is judged as a ferry quay) */
  spots: [5, 6, 7],
} as const;

/** The island's box (WORLD, the exclusion's extent + 4 u): is (x, z) on or by Alcatraz? */
export function onAlcatraz(x: number, z: number): boolean {
  const lx = x - ALCA_X, lz = z - ALCA_Z;
  return lx > -46 && lx < 42 && lz > -26 && lz < 20;
}
