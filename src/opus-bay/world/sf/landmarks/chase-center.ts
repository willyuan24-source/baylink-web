import * as THREE from 'three';
import type { BatchLike } from '../../builder';
import { GLOW, NONE, loftRings, worldPoly } from './kit';
import type { SfLandmark } from './index';
import { clearOf, streetStrips } from './setting';

/**
 * Chase Center (T3) in Mission Bay: the rounded-square arena wrapped in white aluminium fins over a glass base,
 * under a thin roof disc. No names or logos. OSM way 579646390 (21.7 u across, circle fit r 11.07); 38.1 m → H 9.1 u.
 */

const X0 = 491.14, Z0 = 258.99, YAW = (-33.9 * Math.PI) / 180;
const HALF = 10.5;
/** superellipse ring (n = 4): the arena's rounded-square plan */
const ring = (n: number, half: number, y: number) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  const c = Math.cos(a), s = Math.sin(a);
  const r = half / Math.pow(Math.pow(Math.abs(c), 4) + Math.pow(Math.abs(s), 4), 0.25);
  return new THREE.Vector3(c * r, y, s * r);
});

function build(b: BatchLike, lod: 0 | 2) {
  const n = lod === 0 ? 28 : 8;
  // glass base (lit lobby at night), white finned drum, roof lip and the low roof dome
  if (lod === 2) {
    loftRings(b, [ring(n, HALF, -1.2), ring(n, HALF, 8.3), ring(n, HALF - 5, 9.1)], l => (l === 0 ? '#f3f5f4' : '#c9cfd1'), NONE, '#c9cfd1');
    return;
  }
  loftRings(b, [ring(n, HALF - 0.4, -1.2), ring(n, HALF - 0.4, 2.2)], () => '#6f8c96', GLOW(0.7));
  loftRings(b, [ring(n, HALF, 2.2), ring(n, HALF, 7.9)], (_l, side) => (side % 2 ? '#d9dee0' : '#f3f5f4'), GLOW(0.05));
  loftRings(b, [ring(n, HALF + 0.35, 7.9), ring(n, HALF + 0.35, 8.3), ring(n, HALF - 1.2, 8.7), ring(n, HALF - 5, 9.1)], l => (l === 0 ? '#e9ecec' : '#c9cfd1'), NONE, '#c9cfd1');
  // vertical fins proud of the drum on every other facet
  const r0 = ring(n, HALF + 0.12, 2.2);
  for (let i = 0; i < n; i += 2) {
    const p = r0[i];
    b.add(FIN, new THREE.Matrix4().compose(new THREE.Vector3(p.x, 2.2, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(p.x, p.z)), new THREE.Vector3(0.18, 5.7, 0.5)), '#fbfcfb', NONE);
  }
}
const FIN = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

export const chaseCenter: SfLandmark = {
  id: 'chase-center',
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 'terrain',
  exclude: { poly: worldPoly(X0, Z0, YAW, ring(12, HALF + 0.8, 0).map(p => ({ x: p.x, z: p.z }))) },
  build,
  walk: { blockers: [{ poly: ring(16, HALF + 0.2, 0).map(p => ({ x: p.x, z: p.z })) }] },
  // D2-09: the plaza walks round the arena (clipped by the exclusion) run on to it
  ground: streetStrips('chase-center', clearOf([{ poly: ring(16, HALF + 0.2, 0).map(p => ({ x: p.x, z: p.z })) }])),
};
