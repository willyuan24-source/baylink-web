import type { Vec2 } from '../../core/types';

/**
 * Wave 6 · lane W · the North Beach corner's plain data (no three.js: scripts/opus-sf/seam-fill.mts and the tests read
 * it). World coordinates (core/geo project: the hero slab's projection, no warp this far from its ends).
 *
 * Sources (OpenStreetMap, © OpenStreetMap contributors, ODbL; the raw snapshot C:/Users/willy/opus-qa/sf-data/raw of
 * 2026-09-26, osm_base 2026-09-26T09:31Z):
 *   NB_SQUARE   way 18583270 "Washington Square Park" (leisure=park), the whole outline: Filbert St on the west side,
 *               Stockton St, Union St, Columbus Ave cutting the south corner
 *   NB_CHURCH   way 29902626 "Saints Peter and Paul Church" (amenity=place_of_worship, height=23 on the nave); its front on
 *               Filbert St faces the square across the street
 */

/** Washington Square's outline (world x, z; CCW from above) */
export const NB_SQUARE: readonly Vec2[] = [
  { x: -79.4, z: 109.76 }, { x: -76.93, z: 111.54 }, { x: -74.48, z: 111.31 }, { x: -68.39, z: 110.85 }, { x: -65.58, z: 110.59 },
  { x: -62.81, z: 106.61 }, { x: -59.66, z: 102.18 }, { x: -63.39, z: 99.41 }, { x: -69.0, z: 95.27 }, { x: -73.67, z: 101.89 },
  { x: -76.6, z: 106.09 },
];

/** the church's OSM way id (the seam fill keeps its nave, set back behind the front: NB_CHURCH_SETBACK) */
export const NB_CHURCH_OSM = 29902626;

/**
 * The church's front on Filbert St: the OSM footprint's south edge from A to B (world), its outward normal toward the
 * square. Route r1's stop and the attraction's arrival (−76.1, 100.1) lie on that line: the nave (the fill's building,
 * collision included) is set back NB_CHURCH_SETBACK u behind it, the steps and the towers' feet stand in front.
 */
export const NB_FRONT = { a: { x: -77.63, z: 102.26 }, b: { x: -75.01, z: 98.5 }, n: { x: 0.821, z: 0.571 } } as const;
export const NB_CHURCH_SETBACK = 1.6;

/** Saints Peter and Paul's footprint (world) as OSM draws it */
export const NB_CHURCH_OSM_RING: readonly Vec2[] = [
  { x: -77.63, z: 102.26 }, { x: -75.01, z: 98.5 }, { x: -75.81, z: 97.94 }, { x: -76.34, z: 97.57 }, { x: -77.14, z: 97.01 },
  { x: -80.51, z: 94.66 }, { x: -83.85, z: 99.45 }, { x: -82.72, z: 100.23 }, { x: -82.02, z: 99.22 }, { x: -79.76, z: 100.79 },
];

/** the attraction's arrival and route r1's stop in front of the church (data/sf/attractions.ts, data/sf/routes.ts) */
export const NB_CHURCH_ARRIVAL: Vec2 = { x: -76.1, z: 100.1 };

function inRing(x: number, z: number, p: readonly Vec2[]) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c; }
  return c;
}

/**
 * The district lots city mode hides for the church (their centroid inside its OSM footprint: the district's generator
 * put a plain residential box there, lot-211), like manifest.heroDropLots: world/sf/stream.ts adds them to the terrain's
 * drop set, world/sf/cityWorld.ts cuts their triangles, world/sf/hero.ts leaves them out of the far proxy. District mode
 * keeps them (the hero regression).
 */
export function nbDropLots(blocks: readonly { footprint: readonly Vec2[] }[]): number[] {
  const out: number[] = [];
  blocks.forEach((lot, i) => {
    const n = lot.footprint.length, c = lot.footprint.reduce((s, p) => ({ x: s.x + p.x / n, z: s.z + p.z / n }), { x: 0, z: 0 });
    if (inRing(c.x, c.z, NB_CHURCH_OSM_RING)) out.push(i);
  });
  return out;
}

/** the seam fill's region (scripts/opus-sf/seam-fill.mts): North Beach and upper Chinatown, west of Kearny St */
export const SEAM_REGION = { xMax: 60, zMin: 60 } as const;
