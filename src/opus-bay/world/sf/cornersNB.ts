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
export function nbDropLots(blocks: readonly { id?: string; footprint: readonly Vec2[] }[]): number[] {
  const out: number[] = [];
  blocks.forEach((lot, i) => {
    const n = lot.footprint.length, c = lot.footprint.reduce((s, p) => ({ x: s.x + p.x / n, z: s.z + p.z / n }), { x: 0, z: 0 });
    if (inRing(c.x, c.z, NB_CHURCH_OSM_RING) || (lot.id !== undefined && SEAM_DROP_LOT_IDS.includes(lot.id))) out.push(i);
  });
  return out;
}

/**
 * W7-W1: district lots city mode also hides (like lot-211), so the seam fill gives their block its real buildings:
 * lot-117, one plain 13 u office box over the whole block of Kearny, Columbus, Jackson and Washington St — the
 * Sentinel Building's flatiron at its south corner (SEAM_EXTRA_OSM; world/sf/cornersEastCut.ts dresses it).
 */
export const SEAM_DROP_LOT_IDS: readonly string[] = ['lot-117'];

/** the seam fill's North Beach region (W6-W1): North Beach and upper Chinatown, west of Kearny St */
export const SEAM_REGION = { xMax: 60, zMin: 60 } as const;

/** one rectangle of the seam fill's region (world x, z; bounds inclusive) */
export type SeamRect = { readonly id: string; readonly xMin: number; readonly xMax: number; readonly zMin: number; readonly zMax: number };

/**
 * The seam fill's regions (scripts/opus-sf/seam-fill.mts keeps a hero-owned block's building when its centroid lies in
 * one of them): North Beach (W6-W1) and the Financial District's south edge in the start view (W7-W1: Kearny St to the
 * Embarcadero, Pacific Ave down to Market / Mission St; the Ferry gate and the fidi spot look straight over it).
 */
export const SEAM_REGIONS: readonly SeamRect[] = [
  { id: 'north-beach', xMin: -Infinity, xMax: SEAM_REGION.xMax, zMin: SEAM_REGION.zMin, zMax: Infinity },
  { id: 'fidi-south', xMin: 60, xMax: 240, zMin: 15, zMax: 110 },
];

/** the region a point lies in (null when none) */
export function seamRegionAt(x: number, z: number): SeamRect | null {
  for (const r of SEAM_REGIONS) if (x >= r.xMin && x <= r.xMax && z >= r.zMin && z <= r.zMax) return r;
  return null;
}

/**
 * OSM buildings the offline build merged with a neighbour and then carved away whole, put back by the seam fill on
 * their own raw footprint (W7-W1): way 288485994, the Sentinel Building (Columbus Tower) — its thin flatiron at
 * Columbus Ave & Kearny St; world/sf/cornersEastCut.ts draws its copper-green shell and dome over it.
 */
export const SEAM_EXTRA_OSM: readonly number[] = [288485994];

/**
 * The toy Sentinel's footprint (W7-W1). OSM's flatiron (way 288485994) overlaps the district's own street ribbon by
 * 0.8 u (its centre is 1.3 u off the district's `street-kearny-1` centreline: the hand-made grid is not OSM's), so the
 * toy stands in the district's own corner: the tip where `street-kearny-1` (Columbus Ave's line) and
 * `street-jackson-0` meet, 1.75 u in from both centreline (the ribbons are 1.6 u half-wide), 4.6 u back along each
 * street, the tip rounded. The district's corner is square, so the toy's wedge is a right angle (the real one is acute).
 */
export const SENTINEL_RING: readonly Vec2[] = [
  { x: 23.44, z: 108.21 }, { x: 20.13, z: 105.88 }, { x: 26.26, z: 105.13 }, { x: 24.21, z: 108.08 }, { x: 23.84, z: 108.25 },
];
/** the rounded tip's middle (the dome stands over it) */
export const SENTINEL_TIP: Vec2 = { x: 23.83, z: 108.02 };
/** the toy Sentinel's height: OSM height 29 m → buildingH 3.2 + 0.155 · 29 (the fill row stands 0.8 u under it) */
export const SENTINEL_H = 7.7;
/** OSM way of the Sentinel Building (the fill row's id) */
export const SENTINEL_OSM = 288485994;
