import type { Vec2 } from '../../../core/types';
import { type BatchLike, CBOX, ICO, M } from '../../builder';
import { worldPoly } from './kit';
import { FC, GC, PAT, type SiteGroundPoly, type W4Site, gfill, gstrip, lamp } from './siteKit';
import { box3, site3Ground } from './siteKit3';

/**
 * Vermont Street's crooked block (wave 4, P4 · map T3, Potrero Hill): the hairpins of Vermont Street between 20th and
 * 22nd Streets beside McKinley Square, measured more crooked than Lombard Street (sinuosity about 1.56 against 1.2) but
 * without its crowds; a residential street next to the US-101 freeway (Wikipedia "Vermont Street (San Francisco)";
 * Potrero View).
 *
 * Toy: the city draws this block as a 3.6 u ribbon over its zigzag, which merges the bends into one paved slope; the site
 * redraws it as a narrow lane on the same OSM line so the hairpins read, with a round shrub inside every bend, a blank
 * yellow warning diamond at the top (no text or arrow), and two lamps. Traffic keeps the city's line, which is the
 * lane's centre.
 *
 * Frame: origin (455.285, 505.705) at the middle of the crooked block, yaw 48.3°: local +z runs down the block from the
 * top (0, −7.82; the straight street from 20th Street comes in along x ≈ −1…0) to the bottom (0, 7.82; on to 22nd
 * Street), the bends swing between x −2.1 and 0.21; houses stand at x > 1.1, McKinley Square's slope at x < −2.7.
 */

const ID = 'vermont-street-crooked-block';
const X0 = 455.285, Z0 = 505.705, YAW = (48.3 * Math.PI) / 180;
const g = site3Ground(ID, 12.0);

/** the OSM line of the block (the city's road), top → bottom */
const PATH: Vec2[] = [[0, -7.82], [-0.25, -7.05], [-1.77, -6.59], [-2.1, -5.81], [-1.74, -5.06], [-0.4, -4.75], [0.1, -4.05], [-0.12, -3.36], [-1.76, -2.79], [-2.07, -2.02], [-1.81, -1.45], [-0.05, -0.9], [0.21, -0.5], [0.17, 0.18], [-0.1, 0.58], [-1.62, 1.02], [-1.95, 1.74], [-1.59, 2.49], [-0.25, 2.83], [0.1, 3.14], [0.16, 3.48], [0.1, 4.94], [0.05, 6.38], [0, 7.82]].map(([x, z]) => ({ x, z }));
/** the straight street on either side, a little past the exclusion (the lane meets the city's ribbon there) */
const TOP: Vec2[] = [{ x: -0.95, z: -10.42 }, { x: 0, z: -7.82 }];
const BOTTOM: Vec2[] = [{ x: -0.95, z: 6.38 }, { x: 1.22, z: 9.47 }, { x: 1.7, z: 10.1 }];
const LANE = 1.25;
/** a shrub inside every bend (left bends: inside toward +x; right bends: toward −x) */
const BENDS: Vec2[] = [{ x: -1.05, z: -5.85 }, { x: -0.9, z: -4.1 }, { x: -1.0, z: -2.05 }, { x: -0.85, z: -0.35 }, { x: -0.95, z: 1.75 }, { x: -0.95, z: 3.6 }];
const LAMPS: Vec2[] = [{ x: 0.75, z: -6.2 }, { x: -2.55, z: 0.1 }];

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    box3(b, -0.95, g.at(-0.95, 0) - 0.2, 0, 0.8, 0.8, 10, FC.treeDark);
    return;
  }
  for (const [k, p] of BENDS.entries()) {
    const y = g.at(p.x, p.z);
    b.add(ICO(0), M(p.x, y + 0.2, p.z, k, 0.34, 0.36, 0.34), k % 2 ? FC.tree : FC.treeDark, [0, 0, 0.3, 0]);
  }
  for (const l of LAMPS) lamp(b, l.x, g.at(l.x, l.z), l.z);
  // the warning diamond at the top: a yellow square turned 45° on a post, blank
  const sx = 0.72, sz = -7.6, sy = g.at(sx, sz);
  box3(b, sx, sy - 0.15, sz, 0.07, 1.6, 0.07, '#5d6662');
  b.add(CBOX(), M(sx, sy + 1.3, sz - 0.05, Math.PI, 0.42, 0.42, 0.04, 0, Math.PI / 4), '#e8c542');
}

function ground(): SiteGroundPoly[] {
  const bed = (p: Vec2) => gfill([{ x: p.x - 0.4, z: p.z - 0.35 }, { x: p.x + 0.4, z: p.z - 0.35 }, { x: p.x + 0.4, z: p.z + 0.35 }, { x: p.x - 0.4, z: p.z + 0.35 }], GC.earth, PAT.earth, g, 2, 0.09);
  return [
    ...gstrip(PATH, LANE, GC.asphalt, PAT.asphalt, g, 2, 0.065),
    ...gstrip(TOP, 2.2, GC.asphalt, PAT.asphalt, g, 2, 0.065),
    ...gstrip(BOTTOM, 2.2, GC.asphalt, PAT.asphalt, g, 2, 0.065),
    ...BENDS.flatMap(bed),
  ];
}

/** exclusion: round the block's line (the city's ribbon goes wherever its centreline is inside), clear of the houses
 *  (x > 1.1), the east sidewalk steps' line (x ≈ 0.8–0.9) and McKinley Square's lower steps (x −2.9) */
const EXCLUDE: Vec2[] = [{ x: -2.75, z: -8.5 }, { x: 0.74, z: -8.5 }, { x: 0.74, z: 8.3 }, { x: -2.75, z: 8.3 }];

export const vermontStreetCrookedBlock: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: [...BENDS.map(p => ({ x: p.x, z: p.z, r: 0.3 })), { x: 0.72, z: -7.6, r: 0.12 }] },
  ground: ground(),
  lights: LAMPS.map(l => ({ x: l.x, y: g.at(l.x, l.z) + 3.8, z: l.z, size: 1, color: '#ffd9a0' })),
  w4: {
    placeId: 'vermont-street-crooked-block',
    attractions: ['vermont-street-crooked-block'],
    arrival: { x: -0.4, z: -8.3, heading: 0 },
    photo: { target: [-0.9, 0, 0], distance: 16, elevation: 0.55, bearing: Math.PI + 0.3 },
    flag: { x: -0.9, z: 0, h: 30 },
    height: { realM: 0, u: 1.0, top: 12.08, rule: 'overlook' },
    osm: ['way/799023220'],
    terrain: [-3.5, -11, 2.5, 11],
    terrainStep: 1,
    notes: 'A residential street: no crowd spots, and the card keeps it a quiet look (next to the freeway). The lane follows the city\'s line, so the traffic stays on it.',
  },
};
