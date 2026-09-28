import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { GLOW, LIT, box, cbox, rect, worldPoly } from './kit';
import { type W4Site, siteGround } from './siteKit';

/**
 * The Cathedral of Saint Mary of the Assumption (wave 4, P3 · map T3, the cathedral-hill site): the 1971 cathedral by
 * Pietro Belluschi and Pier Luigi Nervi — never I. M. Pei — whose four hyperbolic-paraboloid shells rise 190 ft from a
 * 255 ft square into a cross, the cross-shaped strips of stained glass running up between them; a white landmark seen
 * from much of the city (smcsf.org; Docomomo US; Wikipedia). An active cathedral: a quiet card, no gameplay objects.
 *
 * Toy version with exact maths: each shell is the bilinear (hyperbolic-paraboloid) surface through a low corner on
 * its pylon, the two mid-side feet of the glass strips and the top; four shells, the glass cross between them, the
 * glazed base, the golden cross on top, and the low wing on the Gough St corner (the OSM building way 7814696 is the
 * whole complex, 6.1 u: the site replaces it).
 *
 * Frame: origin (−14.85, 419.8) at the square's centre, yaw −34.8° (the footprint's edges): the roof square is
 * x, z ∈ [−5.4, 5.4], the wing x 6.1…11.3, z −7.4…7.5; Gough St runs along z −11, Cleary Ct along z 10.9, the entrance
 * steps come up from Geary on the −x side. 58 m → 12.2 u by the landmark rule.
 */

const ID = 'st-marys-cathedral';
const X0 = -14.85, Z0 = 419.8, YAW = (-34.8 * Math.PI) / 180;
const g = siteGround(ID, 12.4);

const WHITE = '#efece4', SHADE = '#dcd8ce', GLASS = '#6f8fa8', GOLD = '#d9b44a';
const A = 5.4, GAP = 0.28;
/** heights over the site's floor: the pylon corners, the glass strips' feet at mid-side, the top */
const Y_C = 1.1, Y_M = 3.4, Y_T = 11.2;

/** one shell (quadrant sx, sz): the bilinear patch C (corner) → M1 (x side) → O (top) → M2 (z side), n × n quads */
function shell(b: BatchLike, y0: number, sx: number, sz: number, n: number) {
  const C = new THREE.Vector3(sx * A, y0 + Y_C, sz * A), M1 = new THREE.Vector3(sx * A, y0 + Y_M, sz * GAP), O = new THREE.Vector3(sx * GAP, y0 + Y_T, sz * GAP), M2 = new THREE.Vector3(sx * GAP, y0 + Y_M, sz * A);
  const P = (u: number, v: number) => new THREE.Vector3()
    .addScaledVector(C, (1 - u) * (1 - v)).addScaledVector(M1, u * (1 - v)).addScaledVector(O, u * v).addScaledVector(M2, (1 - u) * v);
  const flip = sx * sz > 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const p00 = P(i / n, j / n), p10 = P((i + 1) / n, j / n), p11 = P((i + 1) / n, (j + 1) / n), p01 = P(i / n, (j + 1) / n);
    const nrm = new THREE.Vector3().subVectors(p10, p00).cross(new THREE.Vector3().subVectors(p01, p00)).normalize();
    if (nrm.y < 0) nrm.negate();
    const col = (j + i) % 2 ? WHITE : SHADE;
    if (flip) b.quad(p00, p01, p11, p10, nrm, col, GLOW(0.15));
    else b.quad(p00, p10, p11, p01, nrm, col, GLOW(0.15));
  }
}

function build(b: BatchLike, lod: 0 | 2) {
  const y0 = g.at(0, 0);
  // the glazed base under the shells, the four corner pylons
  box(b, 0, y0 - 1.0, 0, 2 * A - 0.4, Y_C + 1.0, 2 * A - 0.4, GLASS, lod === 0 ? LIT(y0) : GLOW(0.2));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    shell(b, y0, sx, sz, lod === 0 ? 4 : 1);
    if (lod === 0) box(b, sx * (A - 0.35), y0 - 0.6, sz * (A - 0.35), 0.7, Y_C + 0.7, 0.7, SHADE);
  }
  if (lod === 2) return;
  // the glass cross: four strips from the mid-side feet up to the top, and the glazing under each shell's lower edges
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    b.beam(new THREE.Vector3(dx * A, y0 + Y_M - 0.1, dz * A), new THREE.Vector3(0, y0 + Y_T, 0), 2 * GAP, 0.12, GLASS);
    // under the shells on this side: corner (low) → mid (high) → other corner, glass down to the base
    const ux = dz !== 0 ? 1 : 0, uz = dx !== 0 ? 1 : 0, cx = dx * A, cz = dz * A;
    const c1 = new THREE.Vector3(cx - ux * A, y0 + Y_C, cz - uz * A), c2 = new THREE.Vector3(cx + ux * A, y0 + Y_C, cz + uz * A), m = new THREE.Vector3(cx, y0 + Y_M, cz);
    b.tri(c1, c2, m, GLASS, LIT(y0), new THREE.Vector3(dx, 0, dz));
  }
  // the golden cross on the top
  cbox(b, 0, y0 + Y_T + 0.75, 0, 0.12, 1.5, 0.12, GOLD);
  cbox(b, 0, y0 + Y_T + 1.05, 0, 0.8, 0.12, 0.12, GOLD);
  // the low wing on the Gough St corner
  box(b, 8.7, y0 - 1.0, 0.05, 5.2, 3.6, 14.9, SHADE, LIT(y0));
}

const EXCLUDE: Vec2[] = [{ x: -6.5, z: -5.8 }, { x: 6.1, z: -5.8 }, { x: 6.1, z: -7.8 }, { x: 11.7, z: -7.8 }, { x: 11.7, z: 7.9 }, { x: 6.1, z: 7.9 }, { x: 6.1, z: 5.8 }, { x: -6.5, z: 5.8 }];

export const stMarysCathedral: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: [{ poly: rect(0, 0, 2 * A, 2 * A) }, { poly: rect(8.7, 0.05, 5.3, 15.0) }] },
  lights: [{ x: 0, y: g.at(0, 0) + Y_T - 1, z: 0, size: 2.4, color: '#fff1d6' }],
  plaza: [{ poly: [{ x: -9.6, z: -4.6 }, { x: -6.3, z: -4.6 }, { x: -6.3, z: 4.6 }, { x: -9.6, z: 4.6 }], surface: 'plaza' }],
  w4: {
    placeId: 'st-marys-cathedral',
    attractions: ['st-marys-cathedral'],
    arrival: { x: -8.0, z: 0.2, heading: Math.PI / 2 },
    photo: { target: [0, 6, 0], distance: 30, elevation: 0.2, bearing: -1.9 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 58, u: 12.2, top: 14.2, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/7814696'],
    terrain: [-11, -9, 13, 10],
    notes: 'An active cathedral: quiet card, no gameplay objects. Architects Pietro Belluschi and Pier Luigi Nervi (never I. M. Pei).',
  },
};
