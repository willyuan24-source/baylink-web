import type { BatchLike } from '../../builder';
import { GLOW, NONE, SF, box, cbox, cyl, rect, tube } from './kit';
import * as THREE from 'three';
import type { SfLandmark } from './index';

/**
 * Twin Peaks overlook (T1 by position, tiny by design): the Christmas Tree Point viewing terrace (OSM viewpoint node
 * 599157316) cut into the slope below Eureka Peak — the whole-city reveal. The peaks themselves are terrain. Local
 * +z faces the view (downtown, world −z; yaw 180°). Ground (DEM → terrainY): 47.5 u behind the terrace, 46.0 u at its
 * front edge, 44.4 u 8 u further down, so the terrace deck sits at 47.2 with a retaining wall on the view side.
 */

const DECK = 1.2; // local; base 46.0 → world 47.2
const W = 11, D = 5.2;

function build(b: BatchLike, lod: 0 | 2) {
  // terrace slab + retaining wall dropping to the slope below
  box(b, 0, -2.4, 0.4, W, DECK + 2.4, D, '#cfc6b4', NONE);
  box(b, 0, DECK - 0.02, 0.4, W - 0.3, 0.04, D - 0.3, '#ddd3c0', NONE);
  if (lod === 2) return;
  // stone parapet along the view side and the two ends
  box(b, 0, DECK, 0.4 + D / 2 - 0.2, W, 0.75, 0.4, '#b9ab94', NONE);
  for (const sx of [-1, 1]) box(b, sx * (W / 2 - 0.2), DECK, 0.4, 0.4, 0.75, D, '#b9ab94', NONE);
  // coin binoculars, benches, a blank orientation table and the path up to Eureka Peak
  for (const x of [-3.6, 0, 3.6]) {
    cyl(b, x, DECK, 2.2, 0.08, 0.95, '#5c6b69', NONE, 6);
    cbox(b, x, DECK + 1.05, 2.25, 0.42, 0.3, 0.3, SF.chinaGreen, NONE, 0, -0.2);
  }
  for (const x of [-2, 2]) {
    box(b, x, DECK, -1.4, 1.6, 0.42, 0.5, '#9a7a55', NONE);
    box(b, x, DECK + 0.42, -1.62, 1.6, 0.45, 0.08, '#9a7a55', NONE);
  }
  box(b, -4.6, DECK, -0.6, 1.0, 0.85, 0.7, '#8f8272', NONE);
  cbox(b, -4.6, DECK + 1.0, -0.6, 1.1, 0.12, 0.8, '#efe6d3', NONE, 0, 0.35);
  // flagpole + the little summit cairn trail (steps up behind the terrace)
  tube(b, new THREE.Vector3(4.8, DECK, -1.6), new THREE.Vector3(4.8, DECK + 6.0, -1.6), 0.06, '#d9d4c8', NONE, 4);
  cbox(b, 5.25, DECK + 5.6, -1.6, 0.9, 0.55, 0.04, SF.chinaRed, NONE);
  for (let i = 0; i < 5; i++) box(b, -1.0 + i * 0.1, DECK + 0.02 + i * 0.22, -2.4 - i * 0.55, 1.4, 0.24, 0.6, '#c2b69f', NONE);
  // evening lamps at the terrace corners
  for (const sx of [-1, 1]) {
    tube(b, new THREE.Vector3(sx * (W / 2 - 0.3), DECK + 0.75, 2.8), new THREE.Vector3(sx * (W / 2 - 0.3), DECK + 2.3, 2.8), 0.05, '#3f5a50', NONE, 4);
    box(b, sx * (W / 2 - 0.3), DECK + 2.3, 2.8, 0.25, 0.25, 0.25, '#ffe2b0', GLOW(0.9));
  }
}

export const twinPeaks: SfLandmark = {
  id: 'twin-peaks',
  tier: 1,
  x: 128.86,
  z: 922.72,
  yaw: Math.PI,
  base: 46.0,
  exclude: { r: 7 },
  build,
  walk: {
    blockers: [{ poly: rect(0, 0.4 + D / 2 - 0.2, W, 0.4) }, { poly: rect(-W / 2 + 0.2, 0.4, 0.4, D) }, { poly: rect(W / 2 - 0.2, 0.4, 0.4, D) }],
    surfaces: [{ poly: rect(0, 0.4, W - 0.8, D - 0.8), y: DECK, surface: 'plaza' }],
  },
};
