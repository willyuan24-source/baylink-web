import * as THREE from 'three';

/**
 * Wave 8 · lane W2 · the toy unit ball of the west side's instanced scenes (westToy.ts re-exports it). Its own module
 * (THREE only) so westSeaPose.ts can measure the drawn rock with it (W8-W2-review C1) without an import cycle.
 */

/** the rocks' sideways jitter (world/sf/westSea.ts rockBall) */
export const ROCK_JITTER = 0.18;

/**
 * The unit ball (an 80-face icosphere, diameter 1, non-indexed) with white vertex colours and the toy program's aInfo
 * (w −1); `jitter` > 0 moves every vertex sideways by a fixed ± jitter/2 of its distance from the axis (the same for the
 * copies of a vertex: still closed) and flattens the normals into facets — a rock's lumpy faces; the poles stay put.
 */
export function westBall(jitter = 0): THREE.BufferGeometry {
  const base = new THREE.IcosahedronGeometry(0.5, 1);
  const g = base.index ? base.toNonIndexed() : base;
  const pos = g.getAttribute('position') as THREE.BufferAttribute, n = pos.count;
  if (jitter > 0) {
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const h = Math.sin(Math.round(x * 997) * 12.9898 + Math.round(y * 991) * 78.233 + Math.round(z * 983) * 37.719) * 43758.5453;
      const j = 1 + jitter * (h - Math.floor(h) - 0.5);
      pos.setXYZ(i, x * j, y, z * j);
    }
    g.computeVertexNormals();
  }
  const info = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) info[i * 4 + 3] = -1;
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
  return g;
}
