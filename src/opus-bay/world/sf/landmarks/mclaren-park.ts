import type { BatchLike } from '../../builder';
import { CONE, CYL, M } from '../../builder';
import { ngon, worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, bench, gstrip, plazaOf } from './siteKit';
import { box3, signBoard, site3Ground } from './siteKit3';

/**
 * John McLaren Park (wave 4, P4 · map T3, the south-east hills): San Francisco's fourth-largest park, 313.7 wild acres
 * named for Golden Gate Park's John McLaren in 1926, with the 2.7-mile Philosopher's Way (2013, fourteen stone "musing
 * stations" by the mason George Gonzalez), the Jerry Garcia Amphitheater (built 1970, renamed in 2005 for the musician
 * who grew up nearby) and "La Grande", the Tiffany-blue water tank of 1956 (350,000 gallons, 80 ft) that became the
 * Excelsior's unofficial landmark, seen from I-280; a 2008 seismic upgrade gave it a new steel tank (Wikipedia "John
 * McLaren Park"; SF Heritage "La Grande Water Tank"; SFGate).
 *
 * Toy: the blue tank on the OSM water tower in the park's hills (way 290539043; the city's data carries a second water
 * tower next to it, way 290539044, which stays the city's: which of the two OSM ways is La Grande is not in the data),
 * its base ring, a ladder, a gravel apron with two benches and a blank board. No band imagery at the amphitheatre (not
 * modelled here).
 *
 * Frame: origin (773.4, 1072.1) at the tank's centre, yaw 0 (the city frame); the ground falls from the west (28) to the
 * east (26.8); the park's paths pass outside r 3.6.
 */

const ID = 'mclaren-park';
const X0 = 773.4, Z0 = 1072.1, YAW = 0;
const g = site3Ground(ID, 26.8);

const BLUE = '#6fcfc8', BLUE_DARK = '#4fb0aa', STEEL = '#8d9491';
const R = 2.45, H = 7.0;

function build(b: BatchLike, lod: 0 | 2) {
  const y0 = g.at(0, 0);
  b.add(CYL(lod === 0 ? 14 : 5), M(0, y0 - 1.2, 0, 0, R, H + 1.2 - 0.9, R), BLUE);
  b.add(CONE(lod === 0 ? 14 : 5), M(0, y0 + H - 0.9, 0, 0, R + 0.08, 0.9, R + 0.08), BLUE_DARK);
  if (lod === 2) return;
  // the concrete base ring, the band under the roof, a ladder up the south face
  b.add(CYL(14), M(0, y0 - 0.6, 0, 0, R + 0.25, 0.85, R + 0.25), '#c9c3b6');
  b.add(CYL(14), M(0, y0 + H - 1.25, 0, 0, R + 0.06, 0.18, R + 0.06), '#e8efee');
  for (const dx of [-0.2, 0.2]) box3(b, dx, y0, R + 0.1, 0.05, H - 1.0, 0.05, STEEL);
  for (const [k, a] of [2.3, 3.9].entries()) {
    const r = R + 1.2, x = Math.sin(a) * r, z = Math.cos(a) * r;
    bench(b, x, g.at(x, z), z, a + (k ? 0.1 : -0.1));
  }
  signBoard(b, 0.9, g.at(0.9, R + 1.3), R + 1.3, 0, 0.9, 0.55, 0.6, '#e2d8c0', '#5d4a38');
}

function ground(): SiteGroundPoly[] {
  // the gravel apron round the base
  const ring = Array.from({ length: 17 }, (_, k) => ({ x: Math.sin((k / 16) * Math.PI * 2) * (R + 0.8), z: Math.cos((k / 16) * Math.PI * 2) * (R + 0.8) }));
  return gstrip(ring, 1.0, GC.earth, PAT.earth, g, 1.5, 0.08);
}

export const mclarenPark: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, ngon(0, 0, 4.1, 16)) },
  build,
  walk: { blockers: [{ x: 0, z: 0, r: R + 0.25 }, { x: 0.9, z: R + 1.3, r: 0.2 }] },
  tall: [{ x: 0, z: 0, r: R + 0.1 }],
  ground: ground(),
  plaza: [plazaOf(ngon(0, 0, 5.2, 16), 'grass')],
  w4: {
    placeId: 'osm-w28716696',
    attractions: ['mclaren-park'],
    arrival: { x: 3.4, z: 3.0, heading: -2.3 },
    photo: { target: [0, 3.5, 0], distance: 18, elevation: 0.2, bearing: 2.3 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 24.4, u: H, top: 7.19, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/290539043'],
    terrain: [-5, -5, 5, 5],
    terrainStep: 1,
    notes: 'La Grande is drawn on one of the two OSM water towers here (the data does not say which is it); the other stays the city\'s. No band imagery anywhere. The crowd spots are the ground round the tank.',
  },
};
