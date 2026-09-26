import type { BatchLike } from '../../builder';
import { GLOW, NONE, box, flowerBed, lathe, pyramid, rect, vault, worldPoly } from './kit';
import type { SfLandmark } from './index';

/**
 * Conservatory of Flowers (T2), Golden Gate Park: the white wood-and-glass Victorian greenhouse (1879) — central
 * bell dome with a cupola, two barrel-vaulted wings and end pavilions — facing the flower beds of Conservatory
 * Valley (local +z, yaw 52° from OSM way 30675038). Footprint 10.5 × 4.9 u (OSM). Height 15 m → H 5.5 u (dome),
 * cupola to 6 u. Glass glows softly at night (the building is lit from inside for its evening light shows).
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
  // rotunda framing + entrance porch
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) / 8) * Math.PI * 2;
    box(b, Math.sin(a) * 1.42, 0.35, Math.cos(a) * 1.42, 0.1, 2.0, 0.1, WHITE, NONE, a);
  }
  box(b, 0, 0.35, 1.55, 1.2, 1.7, 0.5, WHITE, NONE);
  pyramid(b, 0, 2.05, 1.55, 1.35, 0.7, 0.55, WHITE);
  // Conservatory Valley flower beds in front (the garden you photograph it from)
  flowerBed(b, -2.6, 0, 4.6, 3.0, 1.2, 1);
  flowerBed(b, 2.6, 0, 4.6, 3.0, 1.2, 4);
  flowerBed(b, 0, 0, 6.3, 2.2, 1.0, 7);
}

export const conservatoryOfFlowers: SfLandmark = {
  id: 'conservatory-of-flowers',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 'terrain',
  exclude: { poly: worldPoly(X0, Z0, YAW, rect(0, 0.3, 11.4, 5.8)) },
  build,
  walk: { blockers: [{ poly: rect(0, 0.1, 10.6, 3.0) }, { poly: rect(0, -1.75, 7.2, 1.3) }, { poly: rect(-2.6, 4.6, 3.0, 1.2) }, { poly: rect(2.6, 4.6, 3.0, 1.2) }, { poly: rect(0, 6.3, 2.2, 1.0) }] },
};
