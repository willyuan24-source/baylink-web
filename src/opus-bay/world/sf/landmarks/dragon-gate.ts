import type { BatchLike } from '../../builder';
import { GLOW, NONE, SF, box, cbox, pyramid, rect, worldPoly } from './kit';
import type { SfLandmark } from './index';

/**
 * Chinatown Dragon Gate (T2) at Grant Ave & Bush St (OSM node 65328703): three openings — the street in the middle
 * (3.2 × 3.4 u, well over the 2.2 u walk-through minimum) and a sidewalk arch each side — under green-tiled
 * pagoda roofs with upturned eaves, a gold ridge with two dragons (toy blocks) and a blank plaque (no text).
 * Local +z faces south down Grant Ave (yaw 52.4° from the Grant Ave way), walking north (−z) enters Chinatown.
 */

const X0 = 81.93, Z0 = 174.7, YAW = (52.4 * Math.PI) / 180;
const STONE = '#e3ddd0', STONE_DARK = '#c9c1b2', GREEN = SF.chinaGreen, GREEN_DARK = SF.chinaGreenDark, RED = SF.chinaRed, GOLD = SF.chinaGold;
const INNER = 1.95, OUTER = 3.75, MID = 4.2, SIDE = 3.1, DEPTH = 1.1;

/** pagoda roof: a wide low hip + upturned corner flicks + a ridge beam */
function roof(b: BatchLike, x: number, y: number, w: number, d: number, lod: 0 | 2) {
  if (lod === 2) { pyramid(b, x, y, 0, w + 0.5, d + 0.7, 1.2, GREEN); return; }
  box(b, x, y, 0, w - 0.3, 0.28, d - 0.2, RED, GLOW(0.15));
  pyramid(b, x, y + 0.28, 0, w + 0.5, d + 0.7, 0.95, GREEN);
  box(b, x, y + 0.25, 0, w + 0.45, 0.12, d + 0.65, GREEN_DARK);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cbox(b, x + sx * (w / 2 + 0.2), y + 0.42, sz * (d / 2 + 0.3), 0.55, 0.12, 0.18, GREEN_DARK, NONE, 0, 0, sx * 0.55);
  box(b, x, y + 1.05, 0, w * 0.55, 0.16, 0.2, GOLD);
}

function build(b: BatchLike, lod: 0 | 2) {
  // four stone pillars on plinths (far: one block per side)
  if (lod === 2) {
    for (const sx of [-1, 1]) box(b, (sx * (INNER + OUTER)) / 2, -1.2, 0, OUTER - INNER + 0.62, SIDE + 1.2, 0.72, STONE);
    box(b, 0, MID - 0.7, 0, INNER * 2 + 0.62, 0.7, DEPTH * 0.7, STONE);
    roof(b, 0, MID, INNER * 2 + 0.9, DEPTH, lod);
    for (const sx of [-1, 1]) roof(b, sx * ((INNER + OUTER) / 2 + 0.05), SIDE, OUTER - INNER + 0.9, DEPTH * 0.9, lod);
    return;
  }
  for (const sx of [-1, 1]) {
    for (const [px, h] of [[INNER, MID], [OUTER, SIDE]] as [number, number][]) {
      box(b, sx * px, -1.2, 0, 0.62, h + 1.2, 0.72, STONE, GLOW(0.08));
      if (lod === 0) box(b, sx * px, -0.2, 0, 0.8, 0.55, 0.9, STONE_DARK);
    }
  }
  // lintels: the central span and the two side spans
  box(b, 0, MID - 0.7, 0, INNER * 2 + 0.62, 0.7, DEPTH * 0.7, STONE, GLOW(0.08));
  for (const sx of [-1, 1]) box(b, sx * ((INNER + OUTER) / 2), SIDE - 0.55, 0, OUTER - INNER + 0.62, 0.55, DEPTH * 0.65, STONE, GLOW(0.08));
  // roofs (central higher) — the silhouette
  roof(b, 0, MID, INNER * 2 + 0.9, DEPTH, lod);
  for (const sx of [-1, 1]) roof(b, sx * ((INNER + OUTER) / 2 + 0.05), SIDE, OUTER - INNER + 0.9, DEPTH * 0.9, lod);
  // red painted brackets under the eaves, blank plaque, ridge dragons and pearl, lanterns
  for (let k = -3; k <= 3; k++) box(b, k * 0.55, MID - 0.25, 0, 0.18, 0.25, DEPTH * 0.75, k % 2 ? RED : GREEN_DARK);
  cbox(b, 0, MID - 0.35, 0.42, 1.4, 0.5, 0.06, '#27466e', NONE);
  cbox(b, 0, MID - 0.35, 0.45, 1.2, 0.36, 0.02, GOLD, NONE);
  for (const sx of [-1, 1]) {
    cbox(b, sx * 0.85, MID + 1.35, 0, 0.9, 0.22, 0.16, GOLD, NONE, 0, 0, sx * 0.25);
    cbox(b, sx * 1.25, MID + 1.55, 0, 0.18, 0.4, 0.14, GOLD, NONE, 0, 0, sx * -0.4);
    // fish (chiwen) at the side-roof ridge ends
    cbox(b, sx * (OUTER + 0.35), SIDE + 1.15, 0, 0.18, 0.4, 0.14, GOLD, NONE, 0, 0, sx * 0.3);
    // guardian lions on the plinths (street side), red lanterns under the side arches
    box(b, sx * (INNER + 0.05), 0.35, 0.72, 0.42, 0.38, 0.5, '#d6cdbf');
    cbox(b, sx * (INNER + 0.05), 0.9, 0.78, 0.36, 0.32, 0.36, '#d6cdbf');
    cbox(b, sx * ((INNER + OUTER) / 2), SIDE - 0.9, 0, 0.3, 0.38, 0.3, RED, GLOW(0.9));
  }
  cbox(b, 0, MID + 1.4, 0, 0.26, 0.26, 0.26, '#f0c35a', GLOW(0.4));
}

export const dragonGate: SfLandmark = {
  id: 'dragon-gate',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 'terrain',
  exclude: { poly: worldPoly(X0, Z0, YAW, rect(0, 0, 9.0, 2.2)) },
  build,
  walk: { blockers: [INNER, OUTER].flatMap(px => [-1, 1].map(sx => ({ poly: rect(sx * px, 0, 0.8, 0.9) }))) },
};
