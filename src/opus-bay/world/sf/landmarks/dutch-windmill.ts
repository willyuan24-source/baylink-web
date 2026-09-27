import type * as THREE from 'three';
import type { BatchLike } from '../../builder';
import { LIT, NONE, box, cbox, flowerBed, lathe, rect, worldPoly } from './kit';
import type { SfLandmark } from './index';

/**
 * Dutch Windmill (T2), north-west corner of Golden Gate Park (OSM way 287921407), with the Queen Wilhelmina Tulip
 * Garden around its foot. Octagonal tapering tower, reefing stage, a thatch-dark cap and four lattice sails facing
 * the ocean (local +z = west, yaw −44°). Real: ~23 m to the cap (→ H 6.8 u), sail span 31 m. The sails are the
 * `animate` part (turning slowly about the windshaft); the far LOD carries a static cross instead.
 */

const X0 = -580.69, Z0 = 1311.93, YAW = (-44 * Math.PI) / 180;
const BODY = '#eee5d2', TRIM = '#fbf6ec', CAP = '#5d5048', SAIL = '#f2ead8', FRAME = '#8a6a4c';
const HUB_Y = 5.45, HUB_Z = 1.2, SAIL_R = 4.15;

function build(b: BatchLike, lod: 0 | 2) {
  // brick plinth, octagonal body tapering to the cap ring, reefing stage
  if (lod === 2) {
    lathe(b, [[1.5, -1.2], [0.95, 5.5]], 0, 0, 0, BODY, NONE, 6);
    lathe(b, [[1.2, 0], [0.05, 1.42]], 0, 5.1, 0, CAP, NONE, 6);
    // static sail cross for the far view
    cbox(b, 0, HUB_Y, HUB_Z, 0.5, SAIL_R * 2, 0.08, SAIL, NONE, 0, 0, Math.PI / 4);
    cbox(b, 0, HUB_Y, HUB_Z, 0.5, SAIL_R * 2, 0.08, SAIL, NONE, 0, 0, -Math.PI / 4);
    return;
  }
  lathe(b, [[1.55, -1.2], [1.55, 0.6]], 0, 0, 0, '#b9a58f', NONE, 8);
  lathe(b, [[1.38, 0], [1.2, 2.2], [0.98, 4.35], [0.92, 4.9]], 0, 0.6, 0, BODY, [5, 0.6, -7, 0], 8);
  lathe(b, [[1.2, 0], [1.25, 0.25], [0.85, 0.95], [0.35, 1.3], [0.05, 1.42]], 0, 5.1, 0, CAP, NONE, 10);
  lathe(b, [[2.05, 0], [2.05, 0.14], [1.25, 0.14]], 0, 2.55, 0, FRAME, NONE, 8);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    box(b, Math.sin(a) * 1.95, 2.69, Math.cos(a) * 1.95, 0.08, 0.55, 0.08, FRAME, NONE, a);
    box(b, Math.sin(a + Math.PI / 8) * 1.8, 3.2, Math.cos(a + Math.PI / 8) * 1.8, 1.5, 0.06, 0.06, FRAME, NONE, a + Math.PI / 8 + Math.PI / 2);
    // stage struts down to the body
    cbox(b, Math.sin(a) * 1.55, 2.2, Math.cos(a) * 1.55, 0.08, 0.95, 0.08, FRAME, NONE, a, 0.6);
  }
  // door, windows, cap ring, windshaft housing
  box(b, 0, 0.6, 1.3, 0.6, 1.1, 0.12, '#6b5140', LIT(0.6));
  for (const y of [3.3, 4.2]) box(b, 0, y, 1.08 - (y - 3.3) * 0.12, 0.34, 0.45, 0.1, '#50606a', LIT(y));
  lathe(b, [[1.05, 0], [1.05, 0.22]], 0, 4.95, 0, TRIM, NONE, 8);
  cbox(b, 0, HUB_Y, 0.75, 0.42, 0.42, 0.9, CAP);
  // tulip garden (Queen Wilhelmina) around the foot
  flowerBed(b, 2.8, 0, 2.2, 2.2, 1.0, 2);
  flowerBed(b, -2.8, 0, 2.2, 2.2, 1.0, 5);
  flowerBed(b, 3.4, 0, -1.2, 1.2, 2.4, 8, 0.4);
  flowerBed(b, -3.4, 0, -1.2, 1.2, 2.4, 11, -0.4);
}

/** Sails (animate part), authored around the hub; the update spins them about the windshaft (local z). */
function buildSails(b: BatchLike) {
  cbox(b, 0, 0, 0.05, 0.34, 0.34, 0.5, CAP);
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    const dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
    const at = (r: number, o: number) => [dx * r + px * o, dy * r + py * o] as const;
    // stock (the spar), the cloth panel on its trailing side, the lattice rails and bars
    const [sx, sy] = at(SAIL_R / 2 + 0.1, 0);
    cbox(b, sx, sy, -0.05, 0.14, SAIL_R + 0.2, 0.12, FRAME, NONE, 0, 0, a - Math.PI / 2);
    const [cx, cy] = at((SAIL_R + 0.9) / 2, 0.42);
    cbox(b, cx, cy, -0.1, 0.62, SAIL_R - 0.9, 0.03, SAIL, NONE, 0, 0, a - Math.PI / 2);
    for (const o of [0.1, 0.76]) {
      const [rx, ry] = at((SAIL_R + 0.9) / 2, o);
      cbox(b, rx, ry, -0.08, 0.06, SAIL_R - 0.85, 0.07, FRAME, NONE, 0, 0, a - Math.PI / 2);
    }
    for (let i = 0; i < 4; i++) {
      const [bx, by] = at(1.1 + i * 0.95, 0.43);
      cbox(b, bx, by, -0.08, 0.72, 0.05, 0.06, FRAME, NONE, 0, 0, a - Math.PI / 2);
    }
  }
}

export const dutchWindmill: SfLandmark = {
  id: 'dutch-windmill',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 'terrain',
  exclude: { poly: worldPoly(X0, Z0, YAW, rect(0, 0.3, 9, 6.5)) },
  build,
  animate: {
    build: buildSails,
    update(obj: THREE.Object3D, t: number) {
      obj.position.set(0, HUB_Y, HUB_Z);
      obj.rotation.set(0, 0, -t * 0.45);
    },
  },
  walk: { blockers: [{ x: 0, z: 0, r: 1.6 }, { poly: rect(2.8, 2.2, 2.2, 1.0) }, { poly: rect(-2.8, 2.2, 2.2, 1.0) }] },
};

