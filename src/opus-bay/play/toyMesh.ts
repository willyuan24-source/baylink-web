import * as THREE from 'three';
import { patchToyShader } from '../world/materials';
import { instancedWarmup, registerWarmup } from '../world/warmup';

/**
 * Wave 5 · lane A · part c: the small props of the should activities (the marshmallow's sticks, the frisbee, the beach
 * ball, the pennants…). Each kind is ONE InstancedMesh of a unit shape painted per instance (instance colours), on the
 * tinted instanced toy program ('ob-toy-inst' with instance colours: the city's trees and lamps link it already, so no
 * new program), with its OWN material instance per kind (lane V's recipe: never shared across object kinds), warmed when
 * the kind's chunk loads (`registerToyWarmup`). aInfo.w ≤ −1: never dither-faded between the camera and the player.
 */

export type ToyShape = 'cyl' | 'box' | 'ball' | 'disc' | 'pennant';

const materials = new Map<string, THREE.MeshStandardMaterial>();
export function toyMaterial(kind: string): THREE.MeshStandardMaterial {
  let m = materials.get(kind);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 });
  m.name = `a-play-${kind}`;
  m.onBeforeCompile = shader => { patchToyShader(shader, { sway: false }); };
  m.customProgramCacheKey = () => 'ob-toy-inst';
  materials.set(kind, m);
  return m;
}

/**
 * A pennant: a pole 2 u tall standing on the origin (a dimmer grey, so the instance tint reads mostly on the flag) and
 * a two-sided triangle flag at its top pointing +x.
 */
function pennantGeometry(): THREE.BufferGeometry {
  const pole = new THREE.CylinderGeometry(0.05, 0.065, 2, 5, 1).toNonIndexed();
  pole.translate(0, 1, 0);
  const flag = new THREE.BufferGeometry();
  const a = [0.04, 1.97, 0], b = [0.04, 1.4, 0], c = [0.95, 1.7, 0];
  flag.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...a, ...b, ...c, ...a, ...c, ...b]), 3));
  flag.computeVertexNormals();
  const out = new THREE.BufferGeometry();
  const pn = pole.getAttribute('position').count, fn = 6;
  const pos = new Float32Array((pn + fn) * 3), nor = new Float32Array((pn + fn) * 3), col = new Float32Array((pn + fn) * 3);
  pos.set(pole.getAttribute('position').array as Float32Array); pos.set(flag.getAttribute('position').array as Float32Array, pn * 3);
  nor.set(pole.getAttribute('normal').array as Float32Array); nor.set(flag.getAttribute('normal').array as Float32Array, pn * 3);
  col.fill(0.55, 0, pn * 3); col.fill(1, pn * 3);
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

/**
 * A unit shape centred on the origin (height / size 1 along +y), white vertex colours (the instance colour paints it);
 * `nightGlow` 0 … 1 lights it at night only (props by a fire read in the dark).
 */
export function toyGeometry(shape: ToyShape, nightGlow = 0): THREE.BufferGeometry {
  const base = shape === 'pennant' ? pennantGeometry() : shape === 'ball' ? new THREE.IcosahedronGeometry(0.5, 1)
    : shape === 'box' ? new THREE.BoxGeometry(1, 1, 1)
      : new THREE.CylinderGeometry(0.5, 0.5, 1, shape === 'disc' ? 12 : 7, 1);
  const g = base.index ? base.toNonIndexed() : base;
  const n = g.getAttribute('position').count;
  const info = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) info[i * 4 + 3] = -1 - Math.max(0, Math.min(1, nightGlow));
  if (!g.getAttribute('color')) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
  return g;
}

export function toyMesh(kind: string, shape: ToyShape, capacity: number, nightGlow = 0): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(toyGeometry(shape, nightGlow), toyMaterial(kind), capacity);
  mesh.name = `a-play-${kind}`;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.count = 0;
  const white = new THREE.Color(1, 1, 1);
  for (let i = 0; i < capacity; i++) mesh.setColorAt(i, white);
  return mesh;
}

/** The kind's warm-up set (register it as its chunk loads; the returned function unregisters). */
export function registerToyWarmup(kind: string): () => void {
  return registerWarmup(`a-play-${kind}`, () => instancedWarmup(toyMaterial(kind), { instanceColor: true }));
}

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), mid = new THREE.Vector3(), dir = new THREE.Vector3();
export const UP = new THREE.Vector3(0, 1, 0);

/** Instance i as a rod of width w from a to b (a unit 'cyl' along +y stretched between them). */
export function placeRod(mesh: THREE.InstancedMesh, i: number, a: THREE.Vector3, b: THREE.Vector3, w: number) {
  dir.subVectors(b, a);
  const len = dir.length() || 1e-3;
  q.setFromUnitVectors(UP, dir.normalize());
  mesh.setMatrixAt(i, m4.compose(mid.addVectors(a, b).multiplyScalar(0.5), q, sc.set(w, len, w)));
}

/** Instance i at `at`, its +y along `axis` (unit), scaled (sx, sy, sz). */
export function placeAlong(mesh: THREE.InstancedMesh, i: number, at: THREE.Vector3, axis: THREE.Vector3, sx: number, sy: number, sz: number) {
  q.setFromUnitVectors(UP, axis);
  mesh.setMatrixAt(i, m4.compose(at, q, sc.set(sx, sy, sz)));
}

/** After the instances of a frame: how many to draw, and upload. */
export function commitToy(mesh: THREE.InstancedMesh, count: number) {
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}
