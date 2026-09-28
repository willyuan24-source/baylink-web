import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CBOX, M } from '../../builder';
import { worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, planter, plazaOf } from './siteKit';
import { box3, site3Ground } from './siteKit3';

/**
 * Patricia's Green (wave 4, P4 · map T3, Hayes Valley): the small central green at the north end of Octavia Boulevard,
 * made in 2005 on land freed when the earthquake-damaged Central Freeway came down, between the boulevard's two frontage
 * streets from Hayes Street to Fell Street; it shows a large artwork that changes every so often, often one from
 * Burning Man (Wikipedia "Hayes Valley, San Francisco"; Hayes Valley Neighborhood Association).
 *
 * The artwork changes, so the toy never models a piece: a plain plinth carries a generic abstract form (three tilted
 * blocks). Around it the lawn strip, benches along the green and planters at its ends. The frontage streets (their
 * ribbons cover most of the OSM green in the city's data) and the boulevard are the city's.
 *
 * Frame: origin (81.7, 497) at the green's centre, yaw −34.8°: local +x runs along the green from Hayes Street (x ≈ −6.5)
 * to Fell Street (x ≈ 6), the frontage streets run either side — Octavia Street at z 1.94 (3.6 u) and, at z −1.84, its
 * pedestrian south-west half (2.4 u) and residential north-east half (3.6 u): their ribbons cover most of the green in the
 * city's data, so the site is the open strip z −0.9…0.4 along the pedestrian half (x −4.5…−0.3).
 */

const ID = 'patricias-green';
const X0 = 81.7, Z0 = 497, YAW = (-34.8 * Math.PI) / 180;
const g = site3Ground(ID, 4.2);

const STRIP: Vec2[] = [{ x: -4.5, z: -0.9 }, { x: -0.3, z: -0.9 }, { x: -0.3, z: 0.4 }, { x: -4.5, z: 0.4 }];
/** the plinth (x) */
const PX = -2.2;
const ART = ['#d9534f', '#e8d44d', '#4f7fbf'];

function build(b: BatchLike, lod: 0 | 2) {
  const y0 = g.at(PX, -0.25);
  box3(b, PX, y0 - 0.2, -0.25, 1.1, 0.75, 1.0, '#cfc7b8');
  if (lod === 2) return;
  // a generic abstract form on the plinth (not any real artwork): three tilted blocks
  for (const [k, [h, rz]] of ([[0.9, 0.2], [0.7, -0.35], [0.55, 0.5]] as const).entries()) {
    b.add(CBOX(), M(PX - 0.2 + k * 0.2, y0 + 0.55 + 0.15 + k * 0.45, -0.25, k * 0.8, 0.35, h, 0.35, 0, rz), ART[k]);
  }
  bench(b, -3.9, g.at(-3.9, -0.25), -0.25, Math.PI / 2);
  planter(b, -0.9, g.at(-0.9, -0.25), -0.25, 0.9, 0.9);
  b.add(BOX(), M(-3.2, g.at(-3.2, 0.2) - 0.1, 0.2, 0, 0.35, 0.7, 0.35), '#4f6a5e');
}

function ground(): SiteGroundPoly[] {
  return gfill(STRIP, GC.lawn, PAT.grass, g, 2, 0.08);
}

export const patriciasGreen: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  // the open strip between the frontage streets (1.45 u off the residential side's centreline, 0.85 off the pedestrian side's)
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -4.6, z: -0.97 }, { x: -0.2, z: -0.97 }, { x: -0.2, z: -0.3 }, { x: 0.25, z: -0.3 }, { x: 0.25, z: 0.47 }, { x: -4.6, z: 0.47 }]) },
  build,
  walk: {
    blockers: [
      { poly: [{ x: PX - 0.6, z: -0.8 }, { x: PX + 0.6, z: -0.8 }, { x: PX + 0.6, z: 0.3 }, { x: PX - 0.6, z: 0.3 }] },
      { x: -0.9, z: -0.25, r: 0.5 }, { x: -3.2, z: 0.2, r: 0.2 },
    ],
  },
  ground: ground(),
  plaza: [plazaOf(STRIP, 'grass'), plazaOf([{ x: -11.0, z: -3.1 }, { x: 1.5, z: -3.1 }, { x: 1.5, z: -0.97 }, { x: -11.0, z: -0.97 }], 'pavement')],
  w4: {
    placeId: 'osm-w28015862',
    attractions: ['patricias-green'],
    arrival: { x: -2.2, z: -2.0, heading: 0 },
    photo: { target: [PX, 1.0, -0.25], distance: 10, elevation: 0.25, bearing: -2.4 },
    flag: { x: PX, z: -0.25, h: 30 },
    height: { realM: 0, u: 2.0, top: 1.98, rule: 'overlook' },
    osm: ['way/28015862'],
    terrain: [-7, -4, 7, 3],
    terrainStep: 1,
    notes: 'The changing artwork is never modelled (a generic abstract form stands for it). The crowd spots are the green and its pedestrian side.',
  },
};
