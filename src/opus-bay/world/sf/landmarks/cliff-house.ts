import type { BatchLike } from '../../builder';
import { GLOW, LIT, NONE, box, cyl, pyramid, rect, worldPoly } from './kit';
import type { SfLandmark } from './index';

/**
 * Cliff House (T2) on the Point Lobos bluff above Ocean Beach: the white 1909 neoclassical block with the glassy
 * ocean-side dining room, the lower terrace and the little Camera Obscura (a building shaped like a camera). Local
 * +z faces the ocean / Seal Rocks (yaw −18.5°), outline = OSM way 168942988. 7 m → H 4.3 u. Base 4.6 (DEM under
 * the building); the terrace steps down 1.6 u toward the sea.
 */

const X0 = -710.56, Z0 = 1266.21, YAW = (-18.5 * Math.PI) / 180;
const WHITE = '#f3f0e8', TRIM = '#dcd6ca', GLASS = '#8fb0b8';

function build(b: BatchLike, lod: 0 | 2) {
  // podium on the bluff, main block, parapet
  box(b, 0, -3.2, 0, 10.0, 3.2, 4.6, '#c9bfae', NONE);
  if (lod === 2) {
    box(b, -0.4, 0, -0.3, 8.6, 4.3, 3.8, WHITE, NONE);
    box(b, 1.5, -4.5, 3.8, 7.5, 2.9, 2.9, '#c2b8a7', NONE);
    return;
  }
  box(b, -0.4, 0, -0.3, 8.6, 4.0, 3.8, WHITE, [1, 0.3, -4.4, 0]);
  box(b, -0.4, 4.0, -0.3, 8.9, 0.3, 4.1, TRIM, NONE);
  // ocean-side glass dining room
  box(b, 0.8, 0, 1.95, 7.0, 2.3, 0.9, GLASS, [6, 0.1, -9.1, 0]);
  box(b, 0.8, 2.3, 1.95, 7.3, 0.2, 1.1, WHITE, NONE);
  // lower terrace toward the sea with the Camera Obscura
  box(b, 1.5, -4.5, 3.8, 7.5, 2.9, 2.9, '#c2b8a7', NONE);
  const co = { x: 3.6, y: -1.6, z: 4.0 };
  box(b, co.x, co.y, co.z, 1.3, 1.1, 1.3, '#e9dfcb', NONE);
  pyramid(b, co.x, co.y + 1.1, co.z, 1.4, 1.4, 0.4, '#6c5a4c');
  // neoclassical dress: pilasters, a dentil cornice band, the rooftop parapet, mullions on the glass room
  for (let x = -4.4; x <= 3.61; x += 1.1) {
    box(b, x - 0.55, 0.1, 1.62, 0.18, 3.9, 0.08, TRIM, NONE);
    box(b, -4.72, 0.1, x * 0.42 - 0.3, 0.08, 3.9, 0.16, TRIM, NONE);
  }
  box(b, -0.4, 3.75, 1.62, 8.7, 0.12, 0.12, TRIM, NONE);
  for (let x = -4.4; x <= 3.9; x += 0.45) box(b, x, 3.62, 1.66, 0.14, 0.1, 0.06, TRIM, NONE);
  box(b, -0.4, 4.3, -0.3, 8.2, 0.5, 3.4, WHITE, NONE);
  for (let x = -2.5; x <= 4.3; x += 0.7) box(b, x, 0, 2.42, 0.06, 2.3, 0.05, WHITE, NONE);
  for (const x of [-3.9, -1.9, 0.1, 2.1]) box(b, x, 4.8, -0.3, 0.9, 0.5, 0.9, '#e7e1d5', NONE);
  cyl(b, co.x, co.y + 1.5, co.z, 0.28, 0.55, '#3f3a36', NONE, 8);
  box(b, co.x, co.y + 0.35, co.z + 0.66, 0.5, 0.5, 0.05, '#4a3f38', LIT(co.y));
  // front windows band, entrance canopy, terrace railings and lamps
  for (let x = -4.2; x <= 3.4; x += 1.1) box(b, x, 2.6, 1.61, 0.7, 1.0, 0.05, '#5b6f78', LIT(2.6));
  box(b, -3.2, 2.3, -2.3, 2.0, 0.15, 1.0, TRIM, NONE);
  box(b, 1.5, -1.6, 5.2, 7.5, 0.6, 0.08, '#3f5a50', NONE);
  for (const x of [-2, 1.5, 5]) {
    box(b, x, -1.6, 5.15, 0.08, 1.8, 0.08, '#3f5a50', NONE);
    box(b, x, 0.2, 5.15, 0.22, 0.22, 0.22, '#fff1cf', GLOW(0.9));
  }
}

export const cliffHouse: SfLandmark = {
  id: 'cliff-house',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 4.6,
  exclude: { poly: worldPoly(X0, Z0, YAW, rect(0.4, 0.8, 10.8, 7.2)) },
  build,
  walk: {
    blockers: [{ poly: rect(-0.4, -0.3, 8.6, 3.8) }, { poly: rect(0.8, 1.95, 7.0, 0.9) }, { poly: rect(3.6, 4.0, 1.3, 1.3) }, { poly: rect(1.5, 5.2, 7.5, 0.16) }],
    surfaces: [{ poly: rect(1.5, 3.8, 7.5, 2.9), y: -1.6, surface: 'plaza' }],
  },
};
