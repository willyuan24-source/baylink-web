import { type BatchLike, ICO, M } from '../../builder';
import { NONE, arch, box, rect, worldPoly } from './kit';
import type { SfLandmark } from './index';

/**
 * Sutro Baths ruins (T2) at Lands End: the concrete footings of the 1896 bath house — a grid of flooded basins
 * open to the Pacific (local +z, yaw −43.1°), broken wall stubs and a column row, boulders, and the sea cave
 * tunnel in the rock at the north end (local −x). Outline = OSM "Main pool house" way 32776540 (≈10 × 6.6 u).
 * The cliff behind (local −z) rises to ≈3.4 u (DEM).
 *
 * Base (lane L, wave 4 — D2's "Sutro Baths" setting): 0.9, the city's drawn ground in the ruins' hollow (0.3–0.75 u
 * over sea level in the published DEM) — at base 0 the grass covered every basin and only the rims stood out of it.
 * The foundation's seaward face now stands as the old sea wall on the beach.
 */

const X0 = -724.86, Z0 = 1247.43, YAW = (-43.1 * Math.PI) / 180;
const CONC = '#b9b2a4', CONC_DARK = '#9d968a', WATER = '#5fa3a0', ROCK = '#a0907c';
/** basins: [x, z, w, d] (local) */
const BASINS: [number, number, number, number][] = [[0.4, 0.2, 7.6, 3.6], [-4.0, 0.3, 1.2, 3.4], [2.4, -2.6, 3.4, 1.2], [-1.6, -2.6, 3.6, 1.2]];

function build(b: BatchLike, lod: 0 | 2) {
  // foundation slab
  box(b, 0, -1.4, 0, 10.4, 1.25, 7.0, CONC_DARK, NONE);
  for (const [x, z, w, d] of BASINS) {
    box(b, x, -0.15, z, w, 0.06, d, WATER, [0, 0, 0, 1.06]);
    if (lod === 2) continue;
    // low broken rims around each basin
    for (const [ox, oz, ww, dd, hh] of [[0, -d / 2, w + 0.3, 0.3, 0.55], [0, d / 2, w * 0.7, 0.3, 0.35], [-w / 2, 0, 0.3, d, 0.7], [w / 2, 0.3, 0.3, d * 0.6, 0.45]] as [number, number, number, number, number][]) box(b, x + ox, -0.2, z + oz, ww, hh + 0.2, dd, CONC, NONE);
  }
  if (lod === 2) return;
  // standing wall fragments and the column row along the back (cliff) side
  box(b, -4.6, -0.2, -2.6, 0.5, 2.1, 1.8, CONC, NONE);
  box(b, 3.9, -0.2, -2.9, 1.6, 1.5, 0.45, CONC, NONE);
  for (let k = 0; k < 6; k++) box(b, -3.2 + k * 1.2, -0.2, -3.1, 0.3, 0.6 + ((k * 37) % 5) * 0.25, 0.3, CONC, NONE);
  // stair flight down from the upper trail, seaward breakwater stubs
  for (let s = 0; s < 5; s++) box(b, 4.6, -0.2 + s * 0.4, -3.4 - s * 0.45, 1.2, 0.4, 0.45, CONC_DARK, NONE);
  for (const x of [-3.8, -0.6, 2.8]) box(b, x, -0.9, 4.2, 1.2, 0.9, 0.7, CONC_DARK, NONE);
  // rock mound at the north end with the sea-cave tunnel, boulders on the shore
  b.add(ICO(1), M(-6.4, 0.2, 0.6, 0.3, 2.2, 2.1, 2.8), ROCK, NONE);
  b.add(ICO(0), M(-6.9, 1.4, -1.2, 1.1, 1.6, 1.8, 1.7), '#8f806e', NONE);
  b.add(ICO(0), M(-5.4, 0.9, 2.6, 2.2, 1.3, 1.2, 1.4), '#b09f8a', NONE);
  arch(b, -4.52, -0.2, 0.6, 1.2, 1.6, Math.PI / 2, '#2e2a27', NONE);
  for (const [x, z, s] of [[-5.6, 3.8, 0.8], [5.4, 3.6, 0.6], [5.8, 1.0, 0.9], [-1.4, 4.6, 0.5]]) b.add(ICO(0), M(x, -0.3, z, x, s * 1.2, s, s), ROCK, NONE);
}

export const sutroBaths: SfLandmark = {
  id: 'sutro-baths',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 0.9,
  exclude: { poly: worldPoly(X0, Z0, YAW, rect(-0.5, 0.4, 13.6, 8.4)) },
  build,
  walk: {
    blockers: [...BASINS.map(([x, z, w, d]) => ({ poly: rect(x, z, w - 0.2, d - 0.2) })), { x: -6.4, z: 0.6, r: 2.2 }],
    surfaces: [{ poly: rect(0, 0, 10.4, 7.0), y: -0.15, surface: 'dirt' }],
  },
};
