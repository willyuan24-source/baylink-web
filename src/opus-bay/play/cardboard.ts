import * as THREE from 'three';
import { patchToyShader } from '../world/materials';
import { instancedWarmup, registerWarmup } from '../world/warmup';

/**
 * Wave 5 · lane A · the Seward slides' cardboard sleds: ONE InstancedMesh of two flat boxes (+1 draw call while a
 * ride runs, 2 × 12 triangles), under the player and BAYBAY. Its own material instance (lane V's recipe: one per object
 * kind) on the TOY instanced program without instance colours ('ob-toy-inst': the city's instanced props already link
 * it), warmed as the slides chunk loads (`registerCardboardWarmup`; zones.ts fetches it within 60 u of the deck). aInfo.w = −1:
 * never dither-faded, no glow.
 */

const CARD = new THREE.Color('#b58a57'), EDGE = new THREE.Color('#8e6a42');

let material: THREE.MeshStandardMaterial | null = null;
export function cardboardMaterial() {
  if (material) return material;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  m.name = 'a-play-cardboard';
  m.onBeforeCompile = shader => { patchToyShader(shader, { sway: false }); };
  m.customProgramCacheKey = () => 'ob-toy-inst';
  return (material = m);
}

/** A sheet of cardboard 0.5 × 0.72 u, 0.05 thick: brown on the faces, darker on the cut edges. */
export function cardboardGeometry(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(0.5, 0.05, 0.72).toNonIndexed();
  const n = g.getAttribute('position').count, nor = g.getAttribute('normal');
  const c = new Float32Array(n * 3), info = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const k = Math.abs(nor.getY(i)) > 0.5 ? CARD : EDGE;
    c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b;
    info[i * 4 + 3] = -1;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
  return g;
}

export function cardboardMesh(capacity = 2): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(cardboardGeometry(), cardboardMaterial(), capacity);
  mesh.name = 'a-play-cardboard';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.count = 0;
  return mesh;
}

/** The warm-up set (the zones chunk registers it at init; the returned function unregisters). */
export function registerCardboardWarmup(): () => void {
  return registerWarmup('a-play-cardboard', () => instancedWarmup(cardboardMaterial(), { receiveShadow: true }));
}
