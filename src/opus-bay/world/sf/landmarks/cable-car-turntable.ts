import type { BatchLike } from '../../builder';
import { GLOW, NONE, box, cyl, lathe, ngon, pyramid, rect, worldPoly } from './kit';
import type { SfLandmark } from './index';

/**
 * Powell & Market cable-car turntable (T2, OSM node 8641952045): the wooden turntable set in the brick plaza where
 * the Powell lines begin, rails running up Powell St (local −z, north), the queue railings and the little starter's
 * booth. Local +z faces Market St (yaw 52.5°). The disc (radius 3.1 u) fits the toy cable car (5.6 u long, plan
 * §6.5); lane F drives the cars and may spin a copy of the disc (TURNTABLE below gives centre + radius).
 *
 * Lane F's spinning disc (world/turntable.ts, drawn by world/transitLayer.ts 0.005 u over this one, r + 0.02): F calls
 * `setTurntableSpinner(true)` while its disc is on (false when its layer goes). The lod 0 then leaves out its static
 * disc top — deck, planks, the rails across and the pivot, which would stand still through F's turning disc or
 * z-fight with it — and draws a plain sunken deck 0.1 u lower instead (what shows beyond F's 300 u disc range).
 * world/sf/sites.ts rebuilds the lod 0 when `buildKey` changes. The far silhouette and SoloView keep the static disc.
 */

const X0 = 130.46, Z0 = 257.6, YAW = (52.5 * Math.PI) / 180;
/**
 * Base lift (lane D2, wave 3). The 'terrain' rule (the lowest ground within the exclusion's radius, 10.7 u here) finds a
 * gutter at 0.94 u and buried the disc 0.8 u under the plaza, lane F's spinning disc and the turning car with it. The
 * drawn (sunk) city ground under the apron runs 1.63–1.96 u (v1 data, measured in the city): lifted 1.0 u, the base
 * sits on the uphill side, the brick apron is flush there and stands ≤ 0.35 u proud downhill on its skirt.
 */
const BASE_LIFT = 1.0;
const R = 3.1, TOP = 0.12;
const WOOD = '#a37a52', WOOD_DARK = '#8a6443', STEEL = '#6f7479', BRICK = '#b8b2a7';

let spinner = false, spinnerKey = 0;
/** Lane F: its spinning disc is drawn at Powell & Market (true) or gone (false). The next lod-0 build follows. */
export function setTurntableSpinner(on: boolean) {
  if (on === spinner) return;
  spinner = on;
  spinnerKey++;
}
/** Is lane F's spinning disc drawn over this landmark? */
export const turntableSpinner = () => spinner;

function build(b: BatchLike, lod: 0 | 2) {
  // brick apron + steel ring + timber deck
  if (lod === 2) {
    lathe(b, [[R + 1.4, -1.0], [R + 1.4, 0.04]], 0, 0, 0, BRICK, NONE, 8);
    b.polygon(ngon(0, 0, R, 8), TOP, WOOD, NONE);
    return;
  }
  lathe(b, [[R + 1.4, -1.0], [R + 1.4, 0.04], [R + 0.18, 0.04]], 0, 0, 0, BRICK, NONE, 24);
  lathe(b, [[R + 0.18, 0], [R + 0.18, TOP], [R, TOP]], 0, 0, 0, STEEL, NONE, 24);
  if (spinner) {
    // lane F's disc turns here: only a sunken deck under it (its planks, rails and pivot are F's)
    lathe(b, [[R, TOP], [R, TOP - 0.1]], 0, 0, 0, WOOD_DARK, NONE, 24);
    b.polygon(ngon(0, 0, R, 24), TOP - 0.1, WOOD, NONE);
  } else {
    b.polygon(ngon(0, 0, R, 24), TOP, WOOD, NONE);
    for (let k = -6; k <= 6; k += 2) box(b, k * 0.23, TOP, 0, 0.18, 0.01, Math.sqrt(Math.max(0, R * R - (k * 0.23) ** 2)) * 2 - 0.1, WOOD_DARK, NONE);
    // rails across the disc, the pivot cap
    for (const x of [-0.55, 0.55]) box(b, x, TOP, 0, 0.1, 0.05, R * 2 - 0.1, STEEL, NONE);
    cyl(b, 0, TOP, 0, 0.35, 0.05, STEEL, NONE, 10);
  }
  // rails up Powell St (the slot between them)
  for (const x of [-0.55, 0.55]) box(b, x, 0.02, -R - 5.5, 0.1, 0.06, 11, STEEL, NONE);
  box(b, 0, 0.02, -R - 5.5, 0.06, 0.03, 11, '#3a3d40', NONE);
  // queue railings along the east side, starter's booth, planters with a lamp
  for (let z = -2.5; z <= 2.5; z += 1.25) box(b, R + 2.0, 0, z, 0.07, 0.95, 0.07, '#3f5a50', NONE);
  for (const y of [0.55, 0.9]) box(b, R + 2.0, y, 0, 0.05, 0.05, 5.0, '#3f5a50', NONE);
  box(b, -R - 1.2, 0, -1.4, 1.0, 1.9, 1.0, '#2f6a58', [3, 0, -2.2, 0]);
  pyramid(b, -R - 1.2, 1.9, -1.4, 1.25, 1.25, 0.45, '#7d3b2f');
  for (const z of [-2.2, 2.2]) {
    box(b, -R - 1.6, 0, z + 0.4, 1.0, 0.55, 1.0, '#cfc6b6', NONE);
    box(b, -R - 1.6, 0.55, z + 0.4, 0.8, 0.25, 0.8, '#6f9a5b', NONE);
  }
  cyl(b, R + 2.6, 0, 2.9, 0.07, 3.0, '#3f5a50', NONE, 6);
  box(b, R + 2.6, 3.0, 2.9, 0.3, 0.3, 0.3, '#fff1cf', GLOW(0.9));
}

export const cableCarTurntable: SfLandmark = {
  id: 'cable-car-turntable',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 'terrain',
  baseLift: BASE_LIFT,
  exclude: { poly: worldPoly(X0, Z0, YAW, rect(0, -2.5, 10, 14)) },
  build,
  buildKey: () => spinnerKey,
  walk: {
    blockers: [{ poly: rect(-R - 1.2, -1.4, 1.0, 1.0) }, { poly: rect(R + 2.0, 0, 0.12, 5.0) }, { poly: rect(-R - 1.6, -1.8, 1.0, 1.0) }, { poly: rect(-R - 1.6, 2.6, 1.0, 1.0) }],
    surfaces: [{ poly: ngon(0, 0, R, 16), y: TOP, surface: 'wood' }, { poly: ngon(0, 0, R + 1.4, 16), y: 0.04, surface: 'plaza' }],
  },
};

/** For the transit lane: turntable centre (local) and radius, and the rail gauge offsets. */
export const TURNTABLE = { r: R, top: TOP, rails: [-0.55, 0.55] };
