import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import type { SiteHooks } from '../sites';
import { GLOW, NONE, box, flowerBed, lathe, pyramid, rect, vault, worldPoly } from './kit';
import type { LandmarkSwap, SfLandmark, WalkBlocker } from './index';
import { settingGround, streetStrips } from './setting';
import { GC, PAT, bench, gfill, lamp, palm } from './siteKit';

/**
 * Conservatory of Flowers (T2), Golden Gate Park: the white wood-and-glass Victorian greenhouse (1879) — central
 * bell dome with a cupola, two barrel-vaulted wings and end pavilions — facing the flower beds of Conservatory
 * Valley (local +z, yaw 52° from OSM way 30675038). Footprint 10.5 × 4.9 u (OSM). Height 15 m → H 5.5 u (dome),
 * cupola to 6 u. Glass glows softly at night (the building is lit from inside for its evening light shows).
 *
 * Setting (lane D2, D2-09): the exclusion now takes in the garden in front and the two small park sheds beside and
 * behind the greenhouse (drawn as city houses before); the garden is a lawn parterre with four flower beds either side
 * of a paved walk from Conservatory Valley's path up to the entrance, lamps at its foot, benches facing the glass and
 * two palms at the wing ends. The park paths the exclusion clips run on up to the building.
 */

const X0 = -184.21, Z0 = 852.88, YAW = (52 * Math.PI) / 180;
const WHITE = '#f6f4ee', GLASS = '#d4e4e1', GLASS_DOME = '#e6eeeb', PLINTH = '#d9d3c6';

function build(b: BatchLike, lod: 0 | 2) {
  const glow = GLOW(0.3);
  box(b, 0, -1.2, 0.1, 10.6, 1.55, 3.0, PLINTH);
  // central rotunda: octagonal glass drum, bell dome, cupola
  lathe(b, [[1.45, 0], [1.45, 2.0]], 0, 0.35, 0, GLASS, glow, 8);
  if (lod === 0) {
    lathe(b, [[1.62, 0], [1.62, 0.18]], 0, 2.3, 0, WHITE, NONE, 8);
    lathe(b, [[1.5, 0], [1.45, 0.7], [1.25, 1.35], [0.9, 1.9], [0.5, 2.3], [0.35, 2.45]], 0, 2.45, 0, GLASS_DOME, glow, 12);
    lathe(b, [[0.42, 0], [0.42, 0.45], [0.5, 0.52], [0.3, 0.8], [0.04, 1.0]], 0, 4.85, 0, WHITE, GLOW(0.5), 8);
  } else lathe(b, [[1.5, 0], [1.2, 1.4], [0.4, 2.4], [0.05, 3.4]], 0, 2.35, 0, GLASS_DOME, glow, 6);
  // wings with barrel vaults, end pavilions
  for (const sx of [-1, 1]) {
    const wx = sx * 2.4;
    box(b, wx, 0.35, 0, 2.5, 1.45, 1.5, GLASS, glow);
    vault(b, wx, 1.8, 0, 2.5, 0.78, GLASS_DOME, glow, lod === 0 ? 6 : 2, 0, lod === 0 ? WHITE : undefined);
    const px = sx * 4.42;
    box(b, px, 0.35, 0.6, 1.66, 2.05, 3.0, lod === 0 ? GLASS : WHITE, glow);
    pyramid(b, px, 2.4, 0.6, 1.9, 3.2, 1.35, GLASS_DOME, 0, glow);
    if (lod === 2) continue;
    // rear glass wing
    box(b, sx * 1.9, 0.35, -1.75, 3.4, 1.3, 1.2, GLASS, glow);
    vault(b, sx * 1.9, 1.65, -1.75, 3.4, 0.55, GLASS_DOME, glow, 4);
    // white timber framing: corner posts, eave boards, mullions on the garden side
    for (const [ox, oz] of [[-0.83, -0.9], [0.83, -0.9], [-0.83, 2.1], [0.83, 2.1]]) box(b, px + ox, 0.35, oz, 0.12, 2.1, 0.12, WHITE);
    box(b, px, 2.35, 0.6, 1.75, 0.12, 3.08, WHITE);
    for (let k = -2; k <= 2; k++) box(b, wx + k * 0.55, 0.35, 0.76, 0.07, 1.5, 0.05, WHITE);
    box(b, wx, 1.72, 0, 2.55, 0.1, 1.58, WHITE);
    for (let k = -1; k <= 1; k++) box(b, px + k * 0.5, 0.35, 2.12, 0.07, 2.05, 0.05, WHITE);
  }
  if (lod === 2) return;
  beds(b);
  // rotunda framing + entrance porch
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) / 8) * Math.PI * 2;
    box(b, Math.sin(a) * 1.42, 0.35, Math.cos(a) * 1.42, 0.1, 2.0, 0.1, WHITE, NONE, a);
  }
  box(b, 0, 0.35, 1.55, 1.2, 1.7, 0.5, WHITE, NONE);
  pyramid(b, 0, 2.05, 1.55, 1.35, 0.7, 0.55, WHITE);
}

const G = settingGround('conservatory-of-flowers');
/** the parterre: lawn either side of the entrance walk, four flower beds (x, z, w, d), lamps, benches, palms */
const LAWN: Vec2[] = [{ x: -6.1, z: 3.25 }, { x: 6.1, z: 3.25 }, { x: 6.1, z: 7.2 }, { x: -6.1, z: 7.2 }];
const WALK: Vec2[] = [{ x: -0.75, z: 2.3 }, { x: 0.75, z: 2.3 }, { x: 0.75, z: 7.35 }, { x: -0.75, z: 7.35 }];
const BED_BOXES: [number, number, number, number][] = [[-2.7, 4.35, 3.0, 1.2], [2.7, 4.35, 3.0, 1.2], [-2.7, 6.2, 3.0, 1.0], [2.7, 6.2, 3.0, 1.0]];
const LAMPS: Vec2[] = [{ x: -1.2, z: 7.0 }, { x: 1.2, z: 7.0 }];
const BENCHES: Vec2[] = [{ x: -5.3, z: 6.6 }, { x: 5.3, z: 6.6 }];
const PALMS: Vec2[] = [{ x: -6.0, z: -2.4 }, { x: 6.0, z: -2.2 }];

/** Conservatory Valley's parterre in front (the garden you photograph it from) */
function beds(b: BatchLike) {
  BED_BOXES.forEach(([x, z, w, d], i) => flowerBed(b, x, G.at(x, z) - 0.1, z, w, d, i * 3 + 1));
  for (const p of LAMPS) lamp(b, p.x, G.at(p.x, p.z), p.z);
  for (const p of BENCHES) bench(b, p.x, G.at(p.x, p.z), p.z, Math.PI);
  PALMS.forEach((p, i) => palm(b, p.x, G.at(p.x, p.z), p.z, 4.2, i));
}

/**
 * AI Conservatory (lane D2, D2-06): lane H's SAM mesh (11.77 × 6 × 6.13 u; glass night-masked) at [0.9, 1, 0.8] =
 * the OSM footprint 10.6 × 4.9 u, 6 u to the cupola, on a low white plinth that hides the base on the sloped lawn.
 * The mask's glass glows as one warm light at night (the building is lit from inside for its evening light shows).
 * Footprint measured on the decoded mesh (× the scale): wings |x| ≤ 5.3, z −1.23…0.68; entrance porch |x| ≤ 1.9 to
 * z 2.45; rear house x −2.63…4.1, z −2.45…−1.22.
 */
const AI_SCALE = [0.9, 1, 0.8] as const;

function aiRemainder(b: BatchLike) {
  box(b, 0, -1.2, -0.28, 10.9, 1.28, 2.2, PLINTH);
  box(b, 0, -1.2, 1.5, 4.1, 1.28, 2.1, PLINTH);
  beds(b);
}

const SWAP: LandmarkSwap = {
  parts: [{ model: 'sf-conservatory', x: 0, y: 0, z: 0, scale: AI_SCALE, glass: { color: '#ffe2b0', strength: 0.9 } }],
  build: aiRemainder,
  ship: true,
  note: '[0.9, 1, 0.8], glass glows at night',
};

const BEDS: WalkBlocker[] = [...BED_BOXES.map(([x, z, w, d]) => ({ poly: rect(x, z, w, d) })), ...BENCHES.map(p => ({ x: p.x, z: p.z, r: 0.45 })), ...PALMS.map(p => ({ x: p.x, z: p.z, r: 0.3 }))];
const walkBlockers = (ai: boolean): WalkBlocker[] => (ai
  ? [{ poly: rect(0, -0.28, 10.7, 2.0) }, { poly: rect(0, 1.5, 3.9, 2.0) }, { poly: rect(0.74, -1.85, 6.85, 1.3) }, ...BEDS]
  : [{ poly: rect(0, 0.1, 10.6, 3.0) }, { poly: rect(0, -1.75, 7.2, 1.3) }, ...BEDS]);

/** the building and the beds: the restored park paths stop at them */
const covered = (x: number, z: number) => (Math.abs(x) < 5.4 && z > -2.5 && z < 2.5) || BED_BOXES.some(([bx, bz, w, d]) => Math.abs(x - bx) < w / 2 + 0.2 && Math.abs(z - bz) < d / 2 + 0.2);

export const conservatoryOfFlowers: SfLandmark & SiteHooks = {
  id: 'conservatory-of-flowers',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  // the base the 'terrain' rule gave for the greenhouse's own footprint (the wider exclusion below reaches 1.3 u lower)
  base: 16.61,
  // the greenhouse, its parterre and the two park sheds (east end and behind) the city drew as houses
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -6.5, z: -4.5 }, { x: 9.3, z: -4.5 }, { x: 9.3, z: 7.5 }, { x: -6.5, z: 7.5 }]) },
  build,
  walk: { blockers: walkBlockers(SWAP.ship) },
  swap: SWAP,
  fade: { r: 5.4, y1: 6.5, box: [5.5, 2.6] },
  ground: [
    ...gfill(LAWN, GC.lawn, PAT.grass, G, 2.5, 0.02),
    ...gfill(WALK, GC.plaza, PAT.stone, G, 2.5, 0.045),
    ...streetStrips('conservatory-of-flowers', (x, z) => !covered(x, z) && !(Math.abs(x) < 0.9 && z > 2.2)),
  ],
  lights: [...LAMPS.map(p => ({ x: p.x, y: G.at(p.x, p.z) + 3.8, z: p.z, size: 1, color: '#ffd9a0' })), { x: 0, y: G.at(0, 0) + 3, z: 0, size: 2, color: '#ffe2b0' }],
  plaza: [{ poly: WALK, surface: 'plaza' }, { poly: [{ x: -6, z: 6.9 }, { x: 6, z: 6.9 }, { x: 6, z: 7.4 }, { x: -6, z: 7.4 }], surface: 'plaza' }],
};
