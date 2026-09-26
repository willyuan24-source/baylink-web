import * as THREE from 'three';
import { type BatchLike, ICO, M, TORUS } from '../../builder';
import { GLOW, NONE, box, cbox, cyl, disc, rect, tube, worldPoly } from './kit';
import type { SfLandmark } from './index';

/**
 * Fisherman's Wharf wheel sign (T2) at Jefferson & Taylor (OSM artwork node 5455630121): a ship's wheel with a red
 * crab in its hub, on a post above a little planter island — the wharf's postcard marker. The ring band is plain
 * (no lettering, no trademark). Local +z faces south down Taylor St (yaw 55.4°). Note: the node lies 2 u inside the
 * district slab's west edge — the city lane decides whether the hero or the city owns this corner (report).
 */

const X0 = -201.14, Z0 = 74.81, YAW = (55.4 * Math.PI) / 180;
const HUB_Y = 3.1, R = 1.35;
const BLUE = '#2f6f96', WHITE = '#f6f2e8', WOOD = '#9a6a42', CRAB = '#d9573a';

function build(b: BatchLike, lod: 0 | 2) {
  // planter island + post
  box(b, 0, -1.2, 0, 2.4, 1.55, 1.5, '#cfc6b6');
  box(b, 0, 0.35, 0, 2.1, 0.15, 1.2, '#7fa65e');
  cyl(b, 0, 0.35, 0, 0.16, HUB_Y - 0.6, '#5b6b72', NONE, lod === 0 ? 8 : 4);
  // the wheel: rim ring (a flat torus), plain lettering band, 8 spokes ending in handles
  b.add(lod === 0 ? TORUS(1, 0.13, 6, 24) : TORUS(1, 0.13, 3, 8), M(0, HUB_Y, 0, 0, R, R, 1), BLUE, GLOW(0.3));
  if (lod === 0) b.add(TORUS(1, 0.07, 4, 24), M(0, HUB_Y, 0.02, 0, R - 0.28, R - 0.28, 1), WHITE, GLOW(0.3));
  disc(b, 0, HUB_Y, -0.08, R - 0.18, 0.1, 0, lod === 0 ? '#e9e2d0' : WHITE, GLOW(0.35), lod === 0 ? 20 : 8);
  if (lod === 2) return;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const d = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
    tube(b, new THREE.Vector3(0, HUB_Y, 0.05).addScaledVector(d, 0.35), new THREE.Vector3(0, HUB_Y, 0.05).addScaledVector(d, R + 0.45), 0.06, WOOD, NONE, 4);
    cbox(b, d.x * (R + 0.52), HUB_Y + d.y * (R + 0.52), 0.05, 0.14, 0.3, 0.14, WOOD, NONE, 0, 0, a - Math.PI / 2);
  }
  // crab in the hub (both faces): body, eyes, claws, legs
  for (const zf of [0.1, -0.2]) {
    const s = zf > 0 ? 1 : -1;
    b.add(ICO(1), M(0, HUB_Y, zf, 0, 0.62, 0.42, 0.18), CRAB, NONE);
    for (const sx of [-1, 1]) {
      cbox(b, sx * 0.72, HUB_Y + 0.42, zf, 0.34, 0.22, 0.12, CRAB, NONE, 0, 0, sx * 0.5);
      cbox(b, sx * 0.5, HUB_Y + 0.25, zf, 0.1, 0.35, 0.08, CRAB, NONE, 0, 0, sx * 0.9);
      for (let l = 0; l < 3; l++) cbox(b, sx * (0.62 + l * 0.05), HUB_Y - 0.12 - l * 0.13, zf, 0.4, 0.06, 0.06, CRAB, NONE, 0, 0, sx * (-0.35 - l * 0.2));
      box(b, sx * 0.14, HUB_Y + 0.36, zf + s * 0.05, 0.07, 0.12, 0.07, '#2b2522');
    }
  }
  // two bollards and a lamp for scale
  for (const sx of [-1.5, 1.5]) cyl(b, sx, 0.35, 0.95, 0.12, 0.55, '#3f5a50', NONE, 6);
}

export const fishermansWharf: SfLandmark = {
  id: 'fishermans-wharf',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 'terrain',
  exclude: { poly: worldPoly(X0, Z0, YAW, rect(0, 0, 3.2, 2.4)) },
  build,
  walk: { blockers: [{ poly: rect(0, 0, 2.4, 1.5) }] },
};
