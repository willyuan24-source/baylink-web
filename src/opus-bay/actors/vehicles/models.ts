import * as THREE from 'three';
import { box, buildRig, cyl, sphere, xf, type BoneDef, type Part, type Rig, type Vec3 } from '../models';

/**
 * Procedural rideable toys, built like the characters (actors/models.ts): ONE SkinnedMesh each (one draw call + its
 * shadow), soft primitives rigidly bound to a few bones so wheels spin, the fork steers and the pedals turn with plain
 * bone rotations. Shared clay material (vertex colours + rim light). Brand palette only, no logos.
 *
 * Budgets (plan: ≤ 3 draw calls, ≤ 3k triangles per vehicle): bike ≈ 2.6k tris / 1 draw; toy car ≈ 2.9k / 1 draw;
 * pelican wings ≈ 0.6k / 1 draw (the pelican body is the existing GLB, 2.9k, 1 draw).
 *
 * Frames: +z forward, local +x = the vehicle's left (three.js convention), y up, origin on the ground between the
 * wheels. `seats` are the anchor points the movement system puts riders on.
 */

export const PALETTE = {
  cream: '#f6ecd9',
  creamDark: '#e7d6b6',
  teal: '#2f8f88',
  tealDark: '#237169',
  terracotta: '#d8744a',
  terracottaDark: '#a9502f',
  gold: '#e0a94a',
  tire: '#3b3531',
  hub: '#fbf7ef',
  wicker: '#c9a36b',
  wickerDark: '#a8824f',
  glass: '#bfe0e0',
  ink: '#2a2623',
};

/** Frame colours for the parked bikes (teal / terracotta / gold). */
export const BIKE_LIVERIES: readonly (readonly [string, string])[] = [
  [PALETTE.teal, PALETTE.tealDark],
  [PALETTE.terracotta, PALETTE.terracottaDark],
  [PALETTE.gold, '#b9832f'],
];

const UP = new THREE.Vector3(0, 1, 0);
/** A capsule (radius r) from a to b. */
function tube(a: Vec3, b: Vec3, r: number, seg = 6): THREE.BufferGeometry {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const d = vb.clone().sub(va);
  const len = d.length();
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len), 1, seg);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
  g.applyQuaternion(q);
  const mid = va.add(vb).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

/** Low-poly ring (tyres, fenders): `radial` sides round the tube. */
const ring = (r: number, tube: number, pos: Vec3, rot: Vec3 = [0, 0, 0], arc = Math.PI * 2, seg = 16, radial = 6) => xf(new THREE.TorusGeometry(r, tube, radial, seg, arc), pos, rot);

/** Rounded box with 2 segments per side (the character helper uses 4: too many triangles for a whole car). */
function softBox(w: number, h: number, d: number, pos: Vec3, rot: Vec3 = [0, 0, 0], soft = 0.45) {
  const g = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const nx = v.x / (w / 2), ny = v.y / (h / 2), nz = v.z / (d / 2);
    const len = Math.hypot(nx, ny, nz) || 1;
    const k = 1 - soft + soft * (Math.max(Math.abs(nx), Math.abs(ny), Math.abs(nz)) / len);
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  g.computeVertexNormals();
  return xf(g, pos, rot);
}

export interface VehicleRig extends Rig {
  /** anchor points in the vehicle frame */
  seats: Record<string, THREE.Vector3>;
  wheelRadius: number;
}

// ---------------------------------------------------------------------------
// Bike: chunky toy bike, wicker front basket (BAYBAY rides in it), bell, rear rack
// ---------------------------------------------------------------------------

export const BIKE_WHEEL_R = 0.3;
const BIKE_AXLE_Z = 0.475;
/**
 * Drawn a size up from the physics bike (1.3 u, plan §6.3): the newcomer is a round 1 u-wide bean, and at 1:1 the
 * bike vanished under them. Collision keeps the plan's hull; only the model (and its seats) scale.
 */
export const BIKE_VISUAL = 1.28;
/** the toy car likewise reads a touch bigger than its 1.8 × 1.0 hull */
export const CAR_VISUAL = 1.12;

/** Scale a rig definition (parts + bones) before binding, so skinning stays exact. */
function scaled(bones: BoneDef[], parts: Part[], k: number): { bones: BoneDef[]; parts: Part[] } {
  for (const p of parts) p.geo.scale(k, k, k);
  return { bones: bones.map(b => ({ ...b, pos: [b.pos[0] * k, b.pos[1] * k, b.pos[2] * k] as Vec3 })), parts };
}

export function buildBikeRig(livery = 0): VehicleRig {
  const [frame, frameDark] = BIKE_LIVERIES[livery % BIKE_LIVERIES.length];
  const R = BIKE_WHEEL_R, AZ = BIKE_AXLE_Z;
  const head: Vec3 = [0, 0.74, 0.36], crankC: Vec3 = [0, 0.3, 0.02], seatTop: Vec3 = [0, 0.7, -0.14];
  const bones: BoneDef[] = [
    { name: 'root', parent: null, pos: [0, 0, 0] },
    { name: 'frame', parent: 'root', pos: [0, 0, 0] },
    { name: 'fork', parent: 'frame', pos: head },
    { name: 'wheelF', parent: 'fork', pos: [0, R, AZ] },
    { name: 'wheelR', parent: 'frame', pos: [0, R, -AZ] },
    { name: 'crank', parent: 'frame', pos: crankC },
  ];
  const wheel = (bone: string, z: number): Part[] => [
    { geo: ring(R - 0.055, 0.058, [0, R, z], [0, Math.PI / 2, 0], Math.PI * 2, 18), color: PALETTE.tire, bone },
    { geo: cyl(R - 0.1, R - 0.1, 0.05, [0, R, z], [0, 0, Math.PI / 2], 12), color: PALETTE.hub, bone },
    { geo: cyl(0.06, 0.06, 0.12, [0, R, z], [0, 0, Math.PI / 2], 8), color: frame, bone },
  ];
  const fender = (z: number, bone: string): Part => ({ geo: ring(R + 0.03, 0.035, [0, R, z], [0, Math.PI / 2, 0.25], Math.PI * 0.62, 8, 4), color: PALETTE.cream, bone });
  // wicker basket: an open box on the fork (floor + four walls + a gold rim)
  const bw = 0.62, bd = 0.46, bh = 0.26, bz = AZ + 0.12, by = 0.74;
  const basket: Part[] = [
    { geo: box(bw, 0.04, bd, [0, by, bz]), color: PALETTE.wickerDark, bone: 'fork' },
    { geo: box(bw, bh, 0.04, [0, by + bh / 2, bz + bd / 2]), color: PALETTE.wicker, bone: 'fork' },
    { geo: box(bw, bh, 0.04, [0, by + bh / 2, bz - bd / 2]), color: PALETTE.wicker, bone: 'fork' },
    { geo: box(0.04, bh, bd, [bw / 2, by + bh / 2, bz]), color: PALETTE.wicker, bone: 'fork' },
    { geo: box(0.04, bh, bd, [-bw / 2, by + bh / 2, bz]), color: PALETTE.wicker, bone: 'fork' },
    { geo: box(bw + 0.05, 0.035, 0.05, [0, by + bh, bz + bd / 2]), color: PALETTE.gold, bone: 'fork' },
    { geo: sphere(0.07, [0, by + 0.1, bz + bd / 2 + 0.05], [1, 1, 0.7], [0, 0, 0], 8, 5), color: '#fff4d0', bone: 'fork' },
  ];
  const parts: Part[] = [
    ...wheel('wheelF', AZ), ...wheel('wheelR', -AZ),
    fender(AZ, 'fork'), fender(-AZ, 'frame'),
    // frame tubes (chunky)
    { geo: tube(seatTop, head, 0.045), color: frame, bone: 'frame' },
    { geo: tube(crankC, [0, 0.7, 0.34], 0.052), color: frame, bone: 'frame' },
    { geo: tube(crankC, [0, 0.66, -0.13], 0.045), color: frame, bone: 'frame' },
    { geo: tube(crankC, [0, R, -AZ], 0.032), color: frameDark, bone: 'frame' },
    { geo: tube([0, 0.64, -0.13], [0, R, -AZ], 0.03), color: frameDark, bone: 'frame' },
    // chain guard
    { geo: softBox(0.06, 0.12, 0.5, [0.07, 0.3, -0.22], [0, 0, 0], 0.6), color: PALETTE.cream, bone: 'frame' },
    // saddle + post
    { geo: tube([0, 0.62, -0.13], [0, 0.7, -0.14], 0.025), color: PALETTE.ink, bone: 'frame' },
    { geo: softBox(0.24, 0.08, 0.3, [0, 0.72, -0.15], [0.06, 0, 0], 0.75), color: '#8a5a3c', bone: 'frame' },
    // rear rack
    { geo: box(0.26, 0.03, 0.34, [0, 0.66, -0.4]), color: frameDark, bone: 'frame' },
    // fork, stem, handlebar, grips, bell (all steer)
    { geo: tube(head, [0, R, AZ], 0.035), color: frame, bone: 'fork' },
    { geo: tube(head, [0, 0.95, 0.33], 0.03), color: PALETTE.ink, bone: 'fork' },
    { geo: tube([0.28, 0.97, 0.3], [-0.28, 0.97, 0.3], 0.026), color: PALETTE.ink, bone: 'fork' },
    { geo: tube([0.26, 0.97, 0.3], [0.34, 0.97, 0.3], 0.036), color: PALETTE.cream, bone: 'fork' },
    { geo: tube([-0.26, 0.97, 0.3], [-0.34, 0.97, 0.3], 0.036), color: PALETTE.cream, bone: 'fork' },
    { geo: sphere(0.05, [0.17, 1.01, 0.31], [1, 0.75, 1], [0, 0, 0], 8, 5), color: PALETTE.gold, bone: 'fork' },
    ...basket,
    // crank + pedals (turn together; toy pedals)
    { geo: cyl(0.075, 0.075, 0.06, [0, 0.3, 0.02], [0, 0, Math.PI / 2], 8), color: PALETTE.cream, bone: 'crank' },
    { geo: box(0.03, 0.26, 0.04, [0.1, 0.3, 0.02]), color: PALETTE.ink, bone: 'crank' },
    { geo: box(0.03, 0.26, 0.04, [-0.1, 0.3, 0.02]), color: PALETTE.ink, bone: 'crank' },
    { geo: box(0.12, 0.035, 0.08, [0.16, 0.43, 0.02]), color: PALETTE.ink, bone: 'crank' },
    { geo: box(0.12, 0.035, 0.08, [-0.16, 0.17, 0.02]), color: PALETTE.ink, bone: 'crank' },
  ];
  const k = BIKE_VISUAL;
  const sc = scaled(bones, parts, k);
  const rig = buildRig(sc.bones, sc.parts);
  return {
    ...rig,
    wheelRadius: R * k,
    seats: {
      // where the rider's rig root goes (the bean's bottom rests on the saddle)
      rider: new THREE.Vector3(0, 0.62, -0.17).multiplyScalar(k),
      // BAYBAY sits in the basket (scaled down, head and ears above the rim)
      basket: new THREE.Vector3(0, by + 0.02, bz).multiplyScalar(k),
      crank: new THREE.Vector3(...crankC).multiplyScalar(k),
      bars: new THREE.Vector3(0, 0.97, 0.3).multiplyScalar(k),
    },
  };
}

// ---------------------------------------------------------------------------
// Toy car: rounded open-top two-seater (BAYBAY up front, the newcomer driving from the back seat)
// ---------------------------------------------------------------------------

export const CAR_WHEEL_R = 0.24;

export function buildToyCarRig(): VehicleRig {
  const R = CAR_WHEEL_R, AX = 0.47, AZ = 0.55;
  const bones: BoneDef[] = [
    { name: 'root', parent: null, pos: [0, 0, 0] },
    { name: 'body', parent: 'root', pos: [0, R + 0.1, 0] },
    { name: 'wheelFL', parent: 'root', pos: [AX, R, AZ] },
    { name: 'wheelFR', parent: 'root', pos: [-AX, R, AZ] },
    { name: 'wheelRL', parent: 'root', pos: [AX, R, -AZ] },
    { name: 'wheelRR', parent: 'root', pos: [-AX, R, -AZ] },
    { name: 'wheel', parent: 'body', pos: [0, 0.74, -0.02] },
  ];
  const wheel = (bone: string, x: number, z: number): Part[] => [
    { geo: ring(R - 0.07, 0.075, [x, R, z], [0, Math.PI / 2, 0], Math.PI * 2, 14), color: PALETTE.tire, bone },
    { geo: cyl(R - 0.1, R - 0.1, 0.13, [x, R, z], [0, 0, Math.PI / 2], 10), color: PALETTE.gold, bone },
  ];
  // body: a soft rounded tub in terracotta with a cream belt line and two seat wells
  const parts: Part[] = [
    ...wheel('wheelFL', AX, AZ), ...wheel('wheelFR', -AX, AZ), ...wheel('wheelRL', AX, -AZ), ...wheel('wheelRR', -AX, -AZ),
    { geo: softBox(1.02, 0.36, 1.86, [0, 0.43, 0], [0, 0, 0], 0.55), color: PALETTE.terracotta, bone: 'body' },
    { geo: softBox(1.05, 0.08, 1.9, [0, 0.62, 0], [0, 0, 0], 0.5), color: PALETTE.cream, bone: 'body' },
    // bonnet hump + grille + headlights
    { geo: softBox(0.84, 0.2, 0.46, [0, 0.66, 0.66], [0.12, 0, 0], 0.7), color: PALETTE.terracotta, bone: 'body' },
    { geo: softBox(0.5, 0.16, 0.06, [0, 0.46, 0.94], [0, 0, 0], 0.5), color: PALETTE.cream, bone: 'body' },
    { geo: sphere(0.085, [0.33, 0.55, 0.9], [1, 1, 0.6], [0, 0, 0], 8, 5), color: '#fff4d0', bone: 'body' },
    { geo: sphere(0.085, [-0.33, 0.55, 0.9], [1, 1, 0.6], [0, 0, 0], 8, 5), color: '#fff4d0', bone: 'body' },
    // seat wells (dark insides) + teal seat backs
    { geo: softBox(0.8, 0.06, 0.5, [0, 0.62, 0.34], [0, 0, 0], 0.5), color: PALETTE.terracottaDark, bone: 'body' },
    { geo: softBox(0.84, 0.06, 0.58, [0, 0.62, -0.42], [0, 0, 0], 0.5), color: PALETTE.terracottaDark, bone: 'body' },
    { geo: softBox(0.78, 0.34, 0.12, [0, 0.8, 0.08], [-0.15, 0, 0], 0.6), color: PALETTE.teal, bone: 'body' },
    { geo: softBox(0.82, 0.4, 0.14, [0, 0.82, -0.72], [-0.15, 0, 0], 0.6), color: PALETTE.teal, bone: 'body' },
    // windscreen (low, glassy) + gold trim
    { geo: softBox(0.7, 0.2, 0.04, [0, 0.82, 0.5], [-0.35, 0, 0], 0.4), color: PALETTE.glass, bone: 'body' },
    { geo: box(0.74, 0.03, 0.05, [0, 0.93, 0.47], [-0.35, 0, 0]), color: PALETTE.gold, bone: 'body' },
    // tail: a round spare wheel + tail lights
    { geo: ring(0.14, 0.05, [0, 0.55, -0.99], [0, 0, 0], Math.PI * 2, 12, 5), color: PALETTE.tire, bone: 'body' },
    { geo: sphere(0.05, [0.4, 0.5, -0.93], [1, 1, 0.6], [0, 0, 0], 6, 4), color: '#e8663d', bone: 'body' },
    { geo: sphere(0.05, [-0.4, 0.5, -0.93], [1, 1, 0.6], [0, 0, 0], 6, 4), color: '#e8663d', bone: 'body' },
    // fenders over the wheels
    ...[[AX, AZ], [-AX, AZ], [AX, -AZ], [-AX, -AZ]].map(([x, z]): Part => ({ geo: xf(new THREE.SphereGeometry(0.3, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), [x * 1.02, 0.5, z], [0, 0, 0], [0.55, 0.45, 1.05]), color: PALETTE.terracotta, bone: 'body' })),
    // steering column + wheel (turns with the steering) for the back-seat driver
    { geo: tube([0, 0.62, 0.18], [0, 0.74, -0.02], 0.025), color: PALETTE.ink, bone: 'body' },
    { geo: ring(0.16, 0.025, [0, 0.74, -0.02], [-0.9, 0, 0], Math.PI * 2, 12, 4), color: PALETTE.ink, bone: 'wheel' },
    { geo: sphere(0.035, [0, 0.74, -0.02], 1, [0, 0, 0], 6, 4), color: PALETTE.gold, bone: 'wheel' },
  ];
  const k = CAR_VISUAL;
  const sc = scaled(bones, parts, k);
  const rig = buildRig(sc.bones, sc.parts);
  return {
    ...rig,
    wheelRadius: R * k,
    seats: {
      // the newcomer's rig root (torso and hat above the rim), BAYBAY in front
      driver: new THREE.Vector3(0, 0.46, -0.42).multiplyScalar(k),
      front: new THREE.Vector3(0, 0.44, 0.38).multiplyScalar(k),
      wheel: new THREE.Vector3(0, 0.74, -0.02).multiplyScalar(k),
    },
  };
}

// ---------------------------------------------------------------------------
// Pelican wings (the body is the existing pelican.glb, tilted into a glide)
// ---------------------------------------------------------------------------

export function buildWingsRig(): Rig {
  const bones: BoneDef[] = [
    { name: 'root', parent: null, pos: [0, 0, 0] },
    { name: 'wingL', parent: 'root', pos: [0.35, 0, 0] },
    { name: 'wingR', parent: 'root', pos: [-0.35, 0, 0] },
    { name: 'tipL', parent: 'wingL', pos: [1.6, 0.02, -0.12] },
    { name: 'tipR', parent: 'wingR', pos: [-1.6, 0.02, -0.12] },
  ];
  // brown pelican upper wing: grey-brown arm with a pale leading edge, a darker hand, three black "finger" primaries
  const wing = (s: number): Part[] => {
    const side = s > 0 ? 'L' : 'R';
    const arm = `wing${side}`, hand = `tip${side}`;
    return [
      { geo: sphere(1, [s * 0.98, 0, 0], [0.72, 0.07, 0.42], [0, s * 0.06, 0], 10, 5), color: '#857767', bone: arm },
      { geo: sphere(1, [s * 0.95, 0.035, 0.2], [0.66, 0.045, 0.16], [0, s * 0.06, 0], 8, 4), color: '#d9ccb0', bone: arm },
      { geo: sphere(1, [s * 0.9, -0.01, -0.28], [0.62, 0.05, 0.2], [0, s * 0.1, 0], 8, 4), color: '#6d6155', bone: arm },
      { geo: sphere(1, [s * 2.05, 0, -0.08], [0.55, 0.06, 0.33], [0, s * 0.16, 0], 8, 4), color: '#6f6357', bone: hand },
      ...[-0.18, 0, 0.18].map((dz, i): Part => ({ geo: sphere(1, [s * (2.62 + i * 0.05), 0, -0.2 + dz], [0.34, 0.035, 0.08], [0, s * (0.3 + dz * 1.2), 0], 6, 3), color: '#2f2926', bone: hand })),
    ];
  };
  return buildRig(bones, [...wing(1), ...wing(-1)], { ao: false });
}

/** Pelican GLB placement inside the glide rig: tilted into a glide (body level, beak tucked), scaled up to carry two. */
export const PELICAN_RIDE = {
  scale: 3.4,
  /** tilt about x (rad): the standing model leans forward until its back is level (beak tucked on the breast) */
  tilt: 1.2,
  /** model offset (after tilt / scale) so the middle of the back is at the rig origin */
  offset: new THREE.Vector3(0, -1.45, -1.15),
  /** shoulders (wings root) and seats in the glide frame */
  wings: new THREE.Vector3(0, -0.12, 0.35),
  rider: new THREE.Vector3(0, -0.05, -0.45),
  baybay: new THREE.Vector3(0, 0.02, 0.55),
};
