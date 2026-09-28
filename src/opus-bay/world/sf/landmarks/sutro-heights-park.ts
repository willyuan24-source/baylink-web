import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, plazaOf } from './siteKit';
import { box3, lowWall, site3Ground } from './siteKit3';

/**
 * Sutro Heights Park (wave 4, P4 · map T3, above the Cliff House): the garden estate Adolph Sutro bought in 1881 and
 * made into an Italian-style garden of fountains, statues and hedge mazes, open to the public from 1883; his family gave
 * it to the city in 1938, the WPA pulled the mansion down in 1939, and the 18 acres are now part of the Golden Gate
 * National Recreation Area, kept by volunteers. The gate's two lions (copies of Trafalgar Square's) and a Diana remain;
 * the Parapet, a raised stone terrace, looks down on the Cliff House, Seal Rocks, Ocean Beach and the Pacific
 * (Wikipedia "Sutro Heights Park"; NPS Lands End).
 *
 * Toy: the Parapet — its paved top on the OSM plaza, the crenellated stone wall along its seaward edge, three EMPTY
 * plinths along it (the statues are gone), two benches facing the sea. The gardens, the paths and the stairs up to it
 * are the city's.
 *
 * Frame: origin (−686.96, 1256.84) at the Parapet viewpoint (OSM node 1709352211, 13.9 over the sea in the city data),
 * yaw 0 (the city frame): the wall runs along the terrace's south-west edge (local (−2.6, 1.5) to (2.8, −0.9)); below it
 * a path (z ≈ 3, 12.2) and Point Lobos Avenue; the stairs reach the terrace at its west and east corners.
 */

const ID = 'sutro-heights-park';
const X0 = -686.96, Z0 = 1256.84, YAW = 0;
const g = site3Ground(ID, 12.5);

const STONE = '#b7ad9c', STONE_DARK = '#9e9483';
/** the terrace top (OSM plaza) and its seaward wall line */
const TOP: Vec2[] = [{ x: -2.92, z: -2.28 }, { x: -2.83, z: -1.64 }, { x: -3.55, z: -0.39 }, { x: -3.5, z: 0.4 }, { x: -2.6, z: 0.85 }, { x: -1.5, z: 0.9 }, { x: 0.0, z: 0.9 }, { x: 1.2, z: 0.6 }, { x: 2.0, z: 0.2 }, { x: 2.7, z: -0.85 }, { x: 1.58, z: -1.48 }, { x: 1.73, z: -1.97 }, { x: 2.34, z: -1.79 }, { x: 2.55, z: -2.9 }, { x: 0.57, z: -3.7 }, { x: -2.59, z: -3.5 }];
const WALL: Vec2[] = [{ x: -2.59, z: 1.46 }, { x: -1.52, z: 1.89 }, { x: -0.01, z: 1.92 }, { x: 1.35, z: 1.33 }, { x: 2.19, z: 0.53 }, { x: 2.83, z: -0.89 }];
const PLINTHS: Vec2[] = [{ x: -1.5, z: 1.1 }, { x: 0.0, z: 1.25 }, { x: 1.35, z: 0.65 }];

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    box3(b, 0, g.at(0, 1.6) - 0.4, 1.6, 5.0, 1.2, 0.4, STONE, Math.atan2(WALL[5].x - WALL[0].x, WALL[5].z - WALL[0].z) - Math.PI / 2);
    return;
  }
  // the parapet wall and its merlons
  for (let i = 0; i + 1 < WALL.length; i++) {
    const a = WALL[i], c = WALL[i + 1];
    lowWall(b, a, c, g.at(a.x, a.z), g.at(c.x, c.z), 0.55, 0.35, STONE);
    const m = { x: (a.x + c.x) / 2, z: (a.z + c.z) / 2 };
    box3(b, m.x, g.at(m.x, m.z) + 0.5, m.z, 0.42, 0.28, 0.42, STONE_DARK, Math.atan2(c.x - a.x, c.z - a.z));
  }
  // the empty plinths (their statues are gone) and two benches facing the sea
  for (const p of PLINTHS) {
    const y = g.at(p.x, p.z);
    box3(b, p.x, y - 0.1, p.z, 0.5, 0.95, 0.5, STONE);
    box3(b, p.x, y + 0.85, p.z, 0.62, 0.1, 0.62, STONE_DARK);
  }
  bench(b, -0.9, g.at(-0.9, -0.5), -0.5, 0.3);
  bench(b, 0.9, g.at(0.9, -0.8), -0.8, 0.5);
}

function ground(): SiteGroundPoly[] {
  return gfill(TOP, GC.plazaWarm, PAT.stone, g, 1.2, 0.12);
}

export const sutroHeightsPark: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  // the terrace and its wall (the stairs up to it and the gardens stay the city's)
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -3.0, z: -2.4 }, { x: -3.7, z: -0.4 }, { x: -3.65, z: 0.6 }, { x: -2.65, z: 1.75 }, { x: -1.5, z: 2.15 }, { x: 0.05, z: 2.2 }, { x: 1.5, z: 1.55 }, { x: 2.45, z: 0.65 }, { x: 3.1, z: -0.95 }, { x: 2.7, z: -3.05 }, { x: 0.57, z: -3.9 }, { x: -2.65, z: -3.7 }]) },
  build,
  walk: {
    blockers: [
      ...WALL.slice(0, -1).map((a, i) => { const c = WALL[i + 1], dx = c.x - a.x, dz = c.z - a.z, L = Math.hypot(dx, dz), nx = -dz / L * 0.2, nz = dx / L * 0.2; return { poly: [{ x: a.x - nx, z: a.z - nz }, { x: c.x - nx, z: c.z - nz }, { x: c.x + nx, z: c.z + nz }, { x: a.x + nx, z: a.z + nz }] }; }),
      ...PLINTHS.map(p => ({ x: p.x, z: p.z, r: 0.35 })),
    ],
  },
  ground: ground(),
  plaza: [plazaOf(TOP, 'plaza'), plazaOf([{ x: -5.0, z: 2.5 }, { x: 5.0, z: 2.5 }, { x: 5.0, z: 3.6 }, { x: -5.0, z: 3.6 }], 'dirt')],
  w4: {
    placeId: 'osm-w160025743',
    attractions: ['sutro-heights-park'],
    arrival: { x: -0.2, z: -2.2, heading: 0.2 },
    photo: { target: [0, 1.0, 0.5], distance: 11, elevation: 0.35, bearing: Math.PI + 0.3 },
    flag: { x: -0.4, z: -1.2, h: 30 },
    height: { realM: 0, u: 1.0, top: 2.51, rule: 'overlook' },
    osm: ['node/1709352211', 'way/160025743'],
    terrain: [-5, -5, 5, 4],
    terrainStep: 1,
    notes: 'The plinths stand empty (the statues are gone; the lions and Diana at the gate are not modelled). The crowd spots are the terrace and the path below its wall.',
  },
};
