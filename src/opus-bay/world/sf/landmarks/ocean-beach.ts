import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CONE, CYL, M } from '../../builder';
import { GLOW, box, rect, worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, gstrip, plazaOf, siteGround } from './siteKit';

/**
 * Ocean Beach (wave 4, P2 · map T2, the Ocean Beach west site): 3.5 miles of surf along the city's western edge,
 * with big sunsets (nps.gov). Here, below the Sunset Dunes promenade (the Upper Great Highway, car-free since
 * 12 April 2025) at the end of Lawton St: the plank path over the dunes, driftwood logs people sit on, dune grass and
 * a plain surf-warning post (no text; the game never suggests swimming — the currents are dangerous). The N Judah
 * terminus (Judah St & La Playa) is two blocks NORTH and lane T's.
 *
 * No fire rings here (W4-L-review): the beach's 16 fire rings stand only between Stairwells 15 and 20 (Stairwell 15 is
 * at JFK Drive, in front of the Beach Chalet), i.e. north of Lincoln Way, March–October (nps.gov "Ocean Beach Fire
 * Program"; Parks Conservancy). They belong to a record on that stretch (the report's "Not done").
 *
 * Frame: origin (−431, 1475) on the sand, yaw −32.2°: local +x runs along the coast (south-east), +z to the sea
 * (the waterline at z ≈ 4…6); the promenade footway is at z −11, Sunset Dunes at z −13…−15, the Great Highway beyond.
 */

const ID = 'ocean-beach';
const X0 = -431, Z0 = 1475, YAW = (-32.2 * Math.PI) / 180;
const g = siteGround(ID, 0.3);

/** driftwood logs on the upper beach: [x, z, heading] (length 2.4, lying along the heading) */
const LOGS: [number, number, number][] = [
  [-11.4, 0.4, 1.1], [-9.2, -0.6, 0.4], [-6.8, 2.2, 1.2], [-4.0, 0.0, -0.3], [3.2, -0.3, 0.2], [6.0, 1.6, 1.4], [8.6, 0.2, -0.5], [11.8, 1.0, 0.9],
];
const GRASS: [number, number][] = [
  [-12.0, -5.2], [-9.0, -6.8], [-6.2, -4.6], [0.6, -6.2], [3.4, -4.4], [6.8, -7.0], [9.6, -5.0], [12.6, -6.4], [-1.6, -8.2], [4.8, -8.6],
  [-10.6, -3.6], [1.8, -3.8], [11.2, -3.2], [-4.4, -7.4],
];
const PATH: Vec2[] = [{ x: -2.9, z: -9.4 }, { x: -2.9, z: -2.6 }, { x: -2.4, z: -1.2 }];
const LOG_C = '#9c8a72';

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    for (const [x, z, ry] of LOGS.slice(2, 5)) b.add(BOX(), M(x, g.at(x, z), z, ry, 0.45, 0.45, 2.4), LOG_C);
    return;
  }
  for (const [x, z, ry] of LOGS) b.add(CYL(6), M(x, g.at(x, z) + 0.28, z, ry, 0.28, 2.4, 0.28, Math.PI / 2), LOG_C);
  for (const [k, [x, z]] of GRASS.entries()) b.add(CONE(5), M(x, g.at(x, z) - 0.1, z, k, 0.6, 0.9, 0.6), k % 2 ? '#a9b57e' : '#8f9f66', [0, 0, 0.4, 0]);
  // the surf-warning post by the path (plain yellow board, no text)
  const wx = -1.4, wz = -2.8, wy = g.at(wx, wz);
  box(b, wx, wy - 0.2, wz, 0.1, 2.2, 0.1, '#5d6662');
  b.add(BOX(), M(wx, wy + 1.6, wz + 0.06, 0, 0.9, 0.7, 0.05), '#e8c14e');
  // the plank path's rope rail posts
  for (let k = 0; k < 5; k++) { const z = -9.0 + k * 1.6; for (const s of [-1, 1]) box(b, -2.9 + s * 0.95, g.at(-2.9, z) - 0.1, z, 0.08, 0.7, 0.08, '#8a6446', GLOW(0)); }
}

function ground(): SiteGroundPoly[] {
  return gstrip(PATH, 1.4, GC.deck, PAT.planks, g, 1.5, 0.12);
}

const BEACH: Vec2[] = [{ x: -14.0, z: -2.4 }, { x: 14.0, z: -1.0 }, { x: 14.0, z: 4.6 }, { x: -14.0, z: 3.4 }];

export const oceanBeach: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -14.0, z: -9.6 }, { x: 14.0, z: -9.6 }, { x: 14.0, z: 4.0 }, { x: -14.0, z: 3.4 }]) },
  build,
  walk: {
    // the logs (sit beside them, not through them)
    blockers: LOGS.map(([x, z, ry]) => ({ poly: rect(x, z, 0.5, 2.4, ry) })),
    surfaces: [{ poly: BEACH, y: 'terrain', surface: 'sand' }, { poly: [{ x: -3.6, z: -9.4 }, { x: -2.2, z: -9.4 }, { x: -2.2, z: -2.4 }, { x: -3.6, z: -2.4 }], y: 'terrain', surface: 'wood' }],
  },
  ground: ground(),
  plaza: [plazaOf(BEACH, 'sand')],
  w4: {
    placeId: 'ocean-beach',
    attractions: ['ocean-beach'],
    lod0R: 260,
    arrival: { x: -2.4, z: -1.0, heading: 0 },
    photo: { target: [0, 1, 0], distance: 26, elevation: 0.35, bearing: -2.6 },
    flag: { x: 0, z: -3.0, h: 30 },
    height: { realM: 0, u: 2.2, rule: 'ground' },
    osm: ['place ocean-beach', 'footway over the dunes at Lawton St'],
    terrain: [-16, -12, 16, 6],
    notes: 'No swimming prompts (dangerous currents). No fire rings at Lawton St: the beach fires are only between Stairwells 15 and 20 (JFK Dr to Lincoln Way). Sunset Dunes may change after Prop G (3 Nov 2026).',
  },
};
