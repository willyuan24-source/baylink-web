import * as THREE from 'three';
import { registerToyWarmup, toyMaterial } from './toyMesh';

/**
 * Wave 7 · lane W2 · the kite toy kind (Marina Green's ambient kites, play/kites.ts, and 放风筝, play/kite.ts): ONE
 * InstancedMesh kind of a unit two-sided diamond on lane A's instanced toy program ('ob-toy-inst', play/toyMesh.ts: no
 * new program), its own material instance. Every part of a kite is an instance of the same diamond, painted per
 * instance: the sail (1.0 × 1.3 u), three tail bows, and the string (a long thin diamond, turned to face the camera).
 * 4 triangles an instance, 5 instances a kite.
 */

export const KITE_KIND = 'kite';
/** instances per kite: the sail, three bows, the string */
export const KITE_PARTS = 5;

let geo: THREE.BufferGeometry | null = null;
/** A unit diamond in the local x-y plane (top (0, ½), bottom (0, −½), sides (±½, 0)), both faces, white, aInfo.w −1. */
export function diamondGeometry(): THREE.BufferGeometry {
  if (geo) return geo;
  const t = [0, 0.5, 0], l = [-0.5, 0, 0], b = [0, -0.5, 0], r = [0.5, 0, 0];
  const front = [...t, ...l, ...b, ...t, ...b, ...r];
  const back = [...t, ...b, ...l, ...t, ...r, ...b];
  const pos = new Float32Array([...front, ...back]);
  const nor = new Float32Array(36);
  for (let i = 0; i < 6; i++) nor.set([0, 0, 1], i * 3);
  for (let i = 6; i < 12; i++) nor.set([0, 0, -1], i * 3);
  const info = new Float32Array(12 * 4);
  for (let i = 0; i < 12; i++) info[i * 4 + 3] = -1;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(36).fill(1), 3));
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
  return (geo = g);
}

/** The kite kind's mesh (count 0 until the first commit); one per layer, disposed with its layer (not the shared geometry). */
export function kiteMesh(capacity: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(diamondGeometry(), toyMaterial(KITE_KIND), capacity);
  mesh.name = `a-play-${KITE_KIND}`;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.count = 0;
  const white = new THREE.Color(1, 1, 1);
  for (let i = 0; i < capacity; i++) mesh.setColorAt(i, white);
  return mesh;
}

/** Warm the kind's program set when a kite chunk loads (the returned function unregisters). */
export const registerKiteWarmup = () => registerToyWarmup(KITE_KIND);

export interface KitePose {
  /** where the string is held (a hand, a stake) */
  anchor: THREE.Vector3;
  /** the sail's centre */
  kite: THREE.Vector3;
  /** time (s) for the tail's wave */
  t: number;
  sail: THREE.Color;
  tail: THREE.Color;
  /** sail size (1 = 1.0 × 1.3 u) */
  size?: number;
}

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3();
const n = new THREE.Vector3(), up = new THREE.Vector3(), right = new THREE.Vector3(), tmp = new THREE.Vector3(), mid = new THREE.Vector3();
const axis = new THREE.Vector3(), face = new THREE.Vector3(), side = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);
const basis = new THREE.Matrix4();
const STRING = new THREE.Color('#f4f1ea');

/**
 * Write kite `k`'s KITE_PARTS instances from `first`: the sail faces the flyer (upwind) leaning back, its tail of three
 * bows waves behind, the string runs from the sail's bridle to the anchor, turned toward the camera at `cam`.
 * Returns the next free instance.
 */
export function placeKite(mesh: THREE.InstancedMesh, first: number, p: KitePose, cam: THREE.Vector3): number {
  const size = p.size ?? 1;
  // the sail's normal: toward the anchor across the ground, tipped down (the sail leans back into the wind)
  n.subVectors(p.anchor, p.kite).setY(0);
  if (n.lengthSq() < 1e-6) n.set(0, 0, 1);
  n.normalize().multiplyScalar(0.8).add(tmp.set(0, -0.6, 0)).normalize();
  up.copy(Y).addScaledVector(n, -n.y).normalize();
  right.crossVectors(up, n).normalize();
  basis.makeBasis(right, up, n);
  q.setFromRotationMatrix(basis);
  mesh.setMatrixAt(first, m4.compose(p.kite, q, s3.set(1.0 * size, 1.3 * size, 1)));
  mesh.setColorAt(first, p.sail);
  // three bows down the tail, swinging
  for (let i = 0; i < 3; i++) {
    const d = (0.75 + i * 0.38) * size, sw = Math.sin(p.t * 3.1 + i * 0.9) * (0.12 + i * 0.07) * size;
    tmp.copy(p.kite).addScaledVector(up, -d).addScaledVector(right, sw).addScaledVector(n, 0.05 * i);
    mesh.setMatrixAt(first + 1 + i, m4.compose(tmp, q, s3.set(0.26 * size, 0.2 * size, 1)));
    mesh.setColorAt(first + 1 + i, p.tail);
  }
  // the string: a long thin diamond from the bridle to the anchor, its face toward the camera
  tmp.copy(p.kite).addScaledVector(n, 0.04);
  axis.subVectors(p.anchor, tmp);
  const len = axis.length() || 1e-3;
  axis.divideScalar(len);
  mid.addVectors(p.anchor, tmp).multiplyScalar(0.5);
  face.subVectors(cam, mid);
  face.addScaledVector(axis, -face.dot(axis));
  if (face.lengthSq() < 1e-6) face.set(1, 0, 0).addScaledVector(axis, -axis.x);
  face.normalize();
  side.crossVectors(axis, face).normalize();
  basis.makeBasis(side, axis, face);
  q.setFromRotationMatrix(basis);
  // twice the length: a diamond tapers to both ends, so the middle half is the full width (the ends meet hand and bridle)
  mesh.setMatrixAt(first + 4, m4.compose(mid, q, s3.set(0.05, len * 1.02, 1)));
  mesh.setColorAt(first + 4, STRING);
  return first + KITE_PARTS;
}

/** Upload after the frame's kites. */
export function commitKites(mesh: THREE.InstancedMesh, count: number) {
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

/**
 * The Bay's prevailing wind blows from the west-north-west (the sea breeze through the Golden Gate): kites fly toward the
 * east-south-east of their flyer. City frame (core/geo projectCity: north = (−0.719, −0.695), east = (0.695, −0.719)).
 */
export const DOWNWIND = { x: 0.917, z: -0.399 } as const;

/** A kite's sail centre `line` u down the wind from `anchor` at elevation `e` (rad), swung `yawOff` rad sideways. */
export function kiteAt(anchor: THREE.Vector3, line: number, e: number, yawOff: number, out: THREE.Vector3): THREE.Vector3 {
  const c = Math.cos(yawOff), s = Math.sin(yawOff);
  const dx = DOWNWIND.x * c - DOWNWIND.z * s, dz = DOWNWIND.x * s + DOWNWIND.z * c;
  const h = Math.cos(e) * line;
  return out.set(anchor.x + dx * h, anchor.y + Math.sin(e) * line, anchor.z + dz * h);
}
