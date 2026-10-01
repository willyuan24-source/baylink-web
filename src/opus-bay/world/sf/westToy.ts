import * as THREE from 'three';
import { patchToyShader } from '../materials';
import { instancedWarmup, registerWarmup } from '../warmup';

/**
 * Wave 8 · lane W2 · the instanced toy pieces of the west side (westSea.ts: Ocean Beach / Seal Rocks; westLake.ts: the
 * boats on Blue Heron Lake). Nothing outside play/ may import play/ statically (tests/opus-bay-w5-play-acts W5-A1: play
 * stays out of GameRoot's graph), so this is play/toyMesh's recipe for a world system: ONE material instance per kind
 * on the tinted instanced toy program (customProgramCacheKey 'ob-toy-inst' — the city's trees and lamps link it
 * already: no new program), warmed when the kind's chunk loads; a unit ball painted per instance (instance colours),
 * aInfo.w −1: never dither-faded between the camera and the player.
 */

const materials = new Map<string, THREE.MeshStandardMaterial>();
/** The kind's own material on the instanced toy program. */
export function westToyMaterial(kind: string): THREE.MeshStandardMaterial {
  let m = materials.get(kind);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 });
  m.name = `w8-west-${kind}`;
  m.onBeforeCompile = shader => { patchToyShader(shader, { sway: false }); };
  m.customProgramCacheKey = () => 'ob-toy-inst';
  materials.set(kind, m);
  return m;
}

/** The kind's warm-up set (register it as its chunk loads; the returned function unregisters). */
export function registerWestWarmup(kind: string): () => void {
  return registerWarmup(`w8-west-${kind}`, () => instancedWarmup(westToyMaterial(kind), { instanceColor: true }));
}

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
