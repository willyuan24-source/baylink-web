import * as THREE from 'three';
import { box, buildRig, cyl, sphere, xf, type BoneDef, type Part, type Rig, type Vec3 } from '../models';

/**
 * Procedural rideable toys, built like the characters (actors/models.ts): ONE SkinnedMesh each (one draw call + its
 * shadow), soft primitives rigidly bound to a few bones so wheels spin, the fork steers and the pedals turn with plain
 * bone rotations. Shared clay material (vertex colours + rim light). Brand palette only, no logos.
 *
 * Budgets (plan: ≤ 3 draw calls, ≤ 3k triangles per vehicle): bike ≈ 2.6k tris / 1 draw; toy car ≈ 2.9k / 1 draw;
 * the ride pelican ≈ 2.9k / 1 draw (buildPelicanRig, E2-8).
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
// The ride pelican (lane E2, wave 3, E2-8): one procedural skinned mesh that reads as a brown pelican in flight
// ---------------------------------------------------------------------------

/**
 * Brown pelican palette (toy-soft): grey-brown mantle and wings with a pale leading edge, dark primaries, a white head
 * with a straw-yellow crown, a chestnut hindneck over a cream fore-neck, a long grey-tan bill with a warm tip and the
 * dark pouch under it, dark feet tucked back under the tail.
 */
export const PELICAN_PAL = {
  mantle: '#8f8070', belly: '#6b5f53', wing: '#857767', edge: '#dccfb3', secondaries: '#6d6155', hand: '#6f6357',
  primaries: '#2f2926', head: '#f4ecdc', crown: '#f0cf6a', hindneck: '#7b4a32', foreneck: '#efe7d6', bill: '#cdb294',
  tip: '#d8744a', pouch: '#5c4a3e', eye: '#211d1c', feet: '#3a332e',
};

/**
 * Anchors in the pelican frame (+z forward, y up, +x its left; the glide sim's point is the origin, on the middle of
 * the back): the rider's rig root on the back, BAYBAY on the shoulders in front of them.
 */
export const PELICAN_SEATS = {
  rider: new THREE.Vector3(0, -0.06, -0.45),
  baybay: new THREE.Vector3(0, -0.08, 0.55),
};

/**
 * The ride pelican as it flies (E2-8): a long body, the head drawn back onto the shoulders on an S-folded neck, the
 * bill laid forward along the breast, the feet tucked back under the tail, broad wings with fingered primaries. ONE
 * SkinnedMesh (the characters' clay material: no new program) ≤ 3.5k triangles. Bones: root → body (the flap bob) →
 * head (a small counter-nod), tail, wingL / wingR (shoulders: rotation.z flaps, + = up) → tipL / tipR (the hands) —
 * the names the flap / bank code drives. Replaces the tilted standing pelican.glb + a separate wing rig (2 draws).
 */
export function buildPelicanRig(): Rig {
  const P = PELICAN_PAL, SX = 0.62, SY = -0.28, SZ = 0.2, ARM = 1.6;
  const bones: BoneDef[] = [
    { name: 'root', parent: null, pos: [0, 0, 0] },
    { name: 'body', parent: 'root', pos: [0, -0.5, 0] },
    { name: 'head', parent: 'body', pos: [0, -0.1, 1.45] },
    { name: 'tail', parent: 'body', pos: [0, -0.45, -1.55] },
    { name: 'wingL', parent: 'body', pos: [SX, SY, SZ] },
    { name: 'wingR', parent: 'body', pos: [-SX, SY, SZ] },
    { name: 'tipL', parent: 'wingL', pos: [SX + ARM, SY + 0.02, SZ - 0.12] },
    { name: 'tipR', parent: 'wingR', pos: [-SX - ARM, SY + 0.02, SZ - 0.12] },
  ];
  const e = (pos: Vec3, scale: Vec3, color: string, bone: string, rot: Vec3 = [0, 0, 0], w = 12, h = 7): Part => ({ geo: sphere(1, pos, scale, rot, w, h), color, bone });
  const wing = (s: number): Part[] => {
    const side = s > 0 ? 'L' : 'R', arm = `wing${side}`, hand = `tip${side}`;
    const x = (d: number) => s * (SX + d);
    return [
      e([x(0.95), SY, SZ], [0.98, 0.1, 0.5], P.wing, arm, [0, s * 0.05, s * 0.05], 12, 5),
      e([x(0.9), SY + 0.06, SZ + 0.26], [0.9, 0.06, 0.18], P.edge, arm, [0, s * 0.05, s * 0.05], 10, 4),
      e([x(0.85), SY - 0.012, SZ - 0.3], [0.86, 0.05, 0.22], P.secondaries, arm, [0, s * 0.1, 0], 10, 4),
      e([x(ARM + 0.5), SY + 0.01, SZ - 0.1], [0.62, 0.08, 0.36], P.hand, hand, [0, s * 0.16, 0], 10, 5),
      ...[-0.24, -0.08, 0.08, 0.24].map((dz, i): Part => e([x(ARM + 1.15 + i * 0.05), SY + 0.01, SZ - 0.2 + dz], [0.38, 0.035, 0.085], P.primaries, hand, [0, s * (0.32 + dz * 1.3), 0], 6, 3)),
    ];
  };
  const parts: Part[] = [
    // body: the mantle on top (where the riders sit), the darker belly under it
    e([0, -0.55, -0.12], [0.66, 0.5, 1.72], P.mantle, 'body', [0, 0, 0], 16, 10),
    e([0, -0.72, 0.02], [0.58, 0.38, 1.46], P.belly, 'body', [0, 0, 0], 14, 8),
    // the S-folded neck in front of the shoulders: cream fore-neck, chestnut hindneck
    e([0, -0.42, 1.18], [0.46, 0.46, 0.56], P.foreneck, 'body', [0.2, 0, 0], 12, 8),
    e([0, -0.2, 1.08], [0.24, 0.3, 0.42], P.hindneck, 'body', [0.25, 0, 0], 10, 6),
    // the head drawn back onto the neck: white, a yellow crown, dark eyes
    e([0, 0.02, 1.62], [0.3, 0.29, 0.4], P.head, 'head', [0.1, 0, 0], 12, 8),
    e([0, 0.24, 1.57], [0.2, 0.09, 0.27], P.crown, 'head', [0.1, 0, 0], 8, 5),
    ...[-1, 1].map((sx): Part => e([sx * 0.235, 0.08, 1.8], [0.055, 0.06, 0.05], P.eye, 'head', [0, 0, 0], 8, 5)),
    // the bill laid forward along the breast (flat, tapering), its warm hooked tip, the pouch under it
    { geo: cyl(0.05, 0.15, 1.75, [0, -0.08, 2.72], [Math.PI / 2 + 0.12, 0, 0], 12, [1.15, 1, 0.55]), color: P.bill, bone: 'head' },
    e([0, -0.2, 3.6], [0.085, 0.07, 0.11], P.tip, 'head', [0, 0, 0], 8, 5),
    e([0, -0.25, 2.55], [0.13, 0.12, 0.72], P.pouch, 'head', [0.12, 0, 0], 10, 6),
    // the short tail fan and the feet tucked back under it
    ...[-0.18, 0, 0.18].map((dx): Part => e([dx, -0.44, -1.78], [0.2, 0.05, 0.44], P.hand, 'tail', [0, dx * 0.8, 0], 8, 4)),
    ...[-1, 1].map((sx): Part => e([sx * 0.2, -0.86, -1.42], [0.13, 0.05, 0.32], P.feet, 'tail', [0.1, 0, 0], 8, 4)),
    ...wing(1), ...wing(-1),
  ];
  return buildRig(bones, parts, { ao: false });
}
