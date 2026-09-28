import type { BatchLike } from '../../builder';
import { CONE, CYL, M } from '../../builder';
import { ngon, worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, plazaOf } from './siteKit';
import { box3, signBoard, site3Ground } from './siteKit3';

/**
 * John McLaren Park (wave 4, P4 · map T3, the south-east hills): San Francisco's fourth-largest park, 313.7 wild acres
 * named for Golden Gate Park's John McLaren in 1926, with the 2.7-mile Philosopher's Way (2013, fourteen stone "musing
 * stations" by the mason George Gonzalez), the Jerry Garcia Amphitheater (built 1970, renamed in 2005 for the musician
 * who grew up nearby) and "La Grande", the Tiffany-blue water tank of 1956 (350,000 gallons, 80 ft) that became the
 * Excelsior's unofficial landmark, seen from I-280; the SFPUC completed a seismic upgrade in 2008 (Wikipedia "John
 * McLaren Park"; SF Heritage "La Grande Water Tank"; SFGate).
 *
 * Where: La Grande is OSM way 424957085 (man_made=water_tower, height 23 m, wikidata Q118533874 "La Grande Tank";
 * Wikimedia Commons 37°43′23.17″ N 122°25′27.24″ W) on the hilltop at the park's north-western edge, ringed by its
 * service drive, with the "Watertower View" viewpoint (osm-n4265327050) beside it. W4-L3-review: the early record stood
 * on way 290539043, one of two 13 m tanks ≈ 100 u to the east in the middle of the park (ways 290539043 / 290539044, both
 * the city's), which is also where the scouting JSON's and lane P's map point for the PARK lies.
 *
 * Toy: the tall blue tank (the footprint is ≈ 10.8 m across, r 0.76 u; the toy is r 1.3 so the height policy's 7 u reads
 * as a tank, not a pipe) with its conical roof, the concrete base ring, the band under the roof and a ladder, the gravel
 * apron over the service drive, two benches facing the views over the Excelsior and a blank board. No band imagery
 * anywhere (the amphitheatre is not modelled here).
 *
 * Frame: origin (674.79, 1065.88) at the tank's centre (the OSM footprint's), yaw 0 (the city frame); the hilltop is ≈ 30.6
 * over the sea in the city data; the service drive leaves the ring to the east (x > 3), footways leave it to the north,
 * south-west and south; the viewpoint is at local (−3.6, 2.3), Ina Court's houses beyond x ≈ −7.
 */

const ID = 'mclaren-park';
const X0 = 674.79, Z0 = 1065.88, YAW = 0;
const g = site3Ground(ID, 29.8);

const BLUE = '#6fcfc8', BLUE_DARK = '#4fb0aa', STEEL = '#8d9491';
const R = 1.3, H = 7.0;
/** the apron: the gravel over the service drive's ring and the footways' ends inside the site */
const APRON_R = 3.1;
const BENCHES: [number, number][] = [[-0.55, 2.35], [0.95, 2.4]];

function build(b: BatchLike, lod: 0 | 2) {
  const y0 = g.at(0, 0);
  b.add(CYL(lod === 0 ? 14 : 5), M(0, y0 - 1.2, 0, 0, R, H + 1.2 - 0.9, R), BLUE);
  b.add(CONE(lod === 0 ? 14 : 5), M(0, y0 + H - 0.9, 0, 0, R + 0.08, 0.9, R + 0.08), BLUE_DARK);
  if (lod === 2) return;
  // the concrete base ring, the band under the roof, a ladder up the south face
  b.add(CYL(14), M(0, y0 - 0.6, 0, 0, R + 0.2, 0.85, R + 0.2), '#c9c3b6');
  b.add(CYL(14), M(0, y0 + H - 1.25, 0, 0, R + 0.06, 0.18, R + 0.06), '#e8efee');
  for (const dx of [-0.2, 0.2]) box3(b, dx, y0, R + 0.08, 0.05, H - 1.0, 0.05, STEEL);
  // two benches on the apron facing out (south-west and west: over the Excelsior), a blank board at the east drive
  for (const [a, r] of BENCHES) {
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    bench(b, x, g.at(x, z), z, a);
  }
  signBoard(b, 2.4, g.at(2.4, -1.0), -1.0, Math.PI / 2, 0.9, 0.55, 0.6, '#e2d8c0', '#5d4a38');
}

function ground(): SiteGroundPoly[] {
  return gfill(ngon(0, 0, APRON_R, 14), GC.earth, PAT.earth, g, 2.2, 0.08);
}

export const mclarenPark: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, ngon(0, 0, 3.3, 16)) },
  build,
  walk: { blockers: [{ x: 0, z: 0, r: R + 0.2 }, { x: 2.4, z: -1.0, r: 0.2 }] },
  tall: [{ x: 0, z: 0, r: R + 0.1 }],
  ground: ground(),
  plaza: [plazaOf(ngon(0, 0, 3.2, 14), 'dirt')],
  w4: {
    placeId: 'osm-w28716696',
    attractions: ['mclaren-park'],
    arrival: { x: -2.4, z: 1.3, heading: 2.07 },
    photo: { target: [0, 3.5, 0], distance: 16, elevation: 0.25, bearing: -1.0 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 24.4, u: H, top: 7.71, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/424957085'],
    terrain: [-4, -4, 4, 4],
    terrainStep: 1,
    notes: 'La Grande on its own OSM footprint (way 424957085) at the park\'s north-western edge; the two 13 m tanks in the middle of the park stay the city\'s. The park\'s map point (lane P\'s attraction x, z) and its place row stand ≈ 100 u east, in the middle of the park: the map point is the park\'s, the site is La Grande. No band imagery anywhere. The crowd spots are the gravel round the tank.',
  },
};
