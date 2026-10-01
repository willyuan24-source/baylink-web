import type { BatchLike } from '../builder';
import { LIT, NONE, box, gable, rect, worldPoly } from './landmarks/kit';
import type { SfLandmark } from './landmarks/index';
import { LAKE_Y } from './westLakePose';

/**
 * Wave 8 · lane W2 · the Blue Heron Lake Boathouse (T3, a plain site with no card, like Alcatraz in W7_SITES): the
 * boat-rental lodge on the lake's west shore, OSM way 120479803 ("Blue Heron Lake Boathouse & Bike Rental", 6 m) — the
 * city drew a generic two-storey house with a red roof on that lot; its exclusion drops it. The 1946–49 building is a
 * long low lodge in an "alpine chalet style" (https://en.wikipedia.org/wiki/Blue_Heron_Lake_Boathouse , read
 * 2026-09-30): plank walls under one broad roof with a gable over the entrance on the lake side (a Commons photo,
 * File:Stow_Lake_Boathouse.jpg, scratch only), a deck along the water and the boats moored below it
 * (westLakePose.MOORED). No lettering.
 *
 * Local frame: origin at the OSM rectangle's centre (−306.41, 1024.155), +x along its long side ((0.723, −0.691) in
 * world), +z toward the lake (yaw 0.763); the ground under it is 19.5–19.97 (the published DEM) and the bank drops to the
 * lake (18.29, 1.6 u down) at local z ≈ 1.5. 6 m → a low 1.5 u wall under a 1 u roof (the lodge reads long, not tall).
 */

const X0 = -306.41, Z0 = 1024.155, YAW = Math.atan2(0.691, 0.723);
export const BOATHOUSE_BASE = 19.85;
const LEN = 4.0, DEPTH = 1.5, WALL = 1.5, RISE = 0.85;
const LOG = '#6e4f37', LOG_DARK = '#5a3f2b', ROOF = '#4f5a4a', TRIM = '#efe6d2', STONE = '#8c8378', DECK = '#9b7a55', WIN = '#41505a';
/** the floating landing at the water (local y): the lake's surface + 0.12 */
const DOCK_Y = LAKE_Y - BOATHOUSE_BASE + 0.12;

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    box(b, 0, -0.6, 0, LEN, WALL + 0.6, DEPTH, LOG, NONE);
    gable(b, 0, WALL, 0, LEN, DEPTH, RISE, ROOF, LOG, 0, 0.3);
    return;
  }
  // the stone footing (down into the slope) and the plank walls with darker bands
  box(b, 0, -0.7, 0, LEN + 0.1, 0.75, DEPTH + 0.1, STONE, NONE);
  box(b, 0, 0, 0, LEN, WALL, DEPTH, LOG, NONE);
  for (const y of [0.35, 0.75, 1.15]) {
    box(b, 0, y, DEPTH / 2, LEN + 0.02, 0.06, 0.03, LOG_DARK, NONE);
    box(b, 0, y, -DEPTH / 2 - 0.02, LEN + 0.02, 0.06, 0.03, LOG_DARK, NONE);
  }
  // corner posts (the log ends) and the broad roof, overhanging over the deck on the lake side
  for (const x of [-LEN / 2, LEN / 2]) for (const z of [-DEPTH / 2, DEPTH / 2]) box(b, x, 0, z, 0.14, WALL, 0.14, LOG_DARK, NONE);
  gable(b, 0, WALL, 0, LEN, DEPTH, RISE, ROOF, LOG, 0, 0.4);
  // the entrance gable on the lake side: a cross roof over a bay, the trimmed door and its fan of windows
  box(b, 0, 0, DEPTH / 2, 1.3, WALL + 0.15, 0.5, LOG, NONE);
  gable(b, 0, WALL + 0.15, DEPTH / 2 + 0.05, 0.62, 1.3, 0.75, ROOF, TRIM, Math.PI / 2, 0.22);
  box(b, 0, 0, DEPTH / 2 + 0.26, 0.5, 0.95, 0.03, WIN, LIT(0));
  box(b, 0, 0.95, DEPTH / 2 + 0.26, 0.62, 0.08, 0.04, TRIM, NONE);
  box(b, 0, 1.15, DEPTH / 2 + 0.26, 0.45, 0.32, 0.03, WIN, LIT(1.15));
  // the café windows along the lake side (white trim; lit at night) and two at the back
  for (const x of [-1.55, -1.0, 1.0, 1.55]) {
    box(b, x, 0.55, DEPTH / 2 + 0.01, 0.42, 0.62, 0.03, WIN, LIT(0.55));
    box(b, x, 0.5, DEPTH / 2 + 0.02, 0.5, 0.05, 0.04, TRIM, NONE);
    box(b, x, 1.17, DEPTH / 2 + 0.02, 0.5, 0.05, 0.04, TRIM, NONE);
  }
  for (const x of [-1.2, 1.2]) box(b, x, 0.6, -DEPTH / 2 - 0.02, 0.4, 0.5, 0.03, WIN, LIT(0.6));
  // the deck along the water (on the bank, its edge at the drop) and its rail, open in front of the entrance
  box(b, 0.1, -0.1, 1.1, LEN + 0.6, 0.12, 0.7, DECK, NONE);
  for (const [x0, x1] of [[-2.2, -0.75], [0.75, 2.4]]) {
    box(b, (x0 + x1) / 2, 0.45, 1.42, x1 - x0, 0.06, 0.06, TRIM, NONE);
    for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 3) box(b, x, 0, 1.42, 0.06, 0.48, 0.06, TRIM, NONE);
  }
  // the floating landing at the water where the boats are moored, its posts, and the steps down from the deck
  box(b, 0.1, DOCK_Y - 0.12, 1.75, LEN + 0.6, 0.12, 0.5, DECK, NONE);
  for (const x of [-2.1, -0.7, 0.7, 2.2]) box(b, x, DOCK_Y - 0.6, 2.0, 0.1, 0.9 + (-DOCK_Y - 0.4), 0.1, LOG_DARK, NONE);
  const steps = 6;
  for (let k = 0; k < steps; k++) {
    const t = (k + 1) / (steps + 1);
    box(b, 0, -0.1 + (DOCK_Y + 0.1) * t - 0.08, 1.45 + 0.05 * k, 0.9, 0.1, 0.12, DECK, NONE);
  }
}

export const blueHeronBoathouse: SfLandmark = {
  id: 'blue-heron-boathouse',
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: BOATHOUSE_BASE,
  sink: 0,
  // the OSM lot (local x ±2.0, z ±0.7) with a margin: the city's generic house there goes; the lake path round it stays
  exclude: { poly: worldPoly(X0, Z0, YAW, rect(0.15, 0.1, 4.8, 2.2)) },
  build,
  walk: { blockers: [{ poly: rect(0, 0, LEN, DEPTH) }, { poly: rect(0, DEPTH / 2 + 0.25, 1.3, 0.5) }] },
};
