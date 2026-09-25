/** @jsxImportSource react */
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bayBayPawPose, bayBayStrideAdvance, type BayBayLocomotion } from './baybay-locomotion';

export type { BayBayLocomotion } from './baybay-locomotion';

type V3 = [number, number, number];
type Piece = { p: V3; s: V3; c: string; r?: V3 };
type Stroke = { points: V3[]; radius?: number };
type GroupRef = { readonly current: THREE.Group | null };

const C = {
  cream: '#f6e9ca', ivory: '#fff2dc', teal: '#398b88', darkTeal: '#285e59',
  glass: '#a4c4bd', wood: '#b98858', sand: '#decaac', fur: '#a87551',
  dark: '#3b3026', leaf: '#849669', leafLight: '#a3b681', rose: '#d49784',
  stone: '#b7a58e', red: '#bf6550', gold: '#d7aa5e', road: '#baad98',
};

// Geometry and material are shared by every district. Repeated details use one
// instanced draw per primitive, so window frames and columns stay inexpensive.
const BOX = new RoundedBoxGeometry(1, 1, 1, 2, 0.075);
const SPHERE = new THREE.SphereGeometry(1, 24, 16);
const CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const CONE = new THREE.ConeGeometry(0.5, 1, 16);
const CLAY = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.87, metalness: 0 });
const materials = new Map<string, THREE.MeshStandardMaterial>();
function material(color: string) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.87 }));
  return materials.get(color)!;
}

function Parts({ pieces, geometry = BOX }: { pieces: Piece[]; geometry?: THREE.BufferGeometry }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const object = new THREE.Object3D();
    const color = new THREE.Color();
    pieces.forEach(({ p, s, c, r = [0, 0, 0] }, index) => {
      object.position.set(...p);
      object.scale.set(...s);
      object.rotation.set(...r);
      object.updateMatrix();
      ref.current!.setMatrixAt(index, object.matrix);
      ref.current!.setColorAt(index, color.set(c));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [pieces]);
  if (!pieces.length) return null;
  return <instancedMesh ref={ref} args={[geometry, CLAY, pieces.length]} castShadow receiveShadow dispose={null} />;
}

function Shape({ geometry, color, p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0] }: {
  geometry: THREE.BufferGeometry; color: string; p?: V3; s?: V3; r?: V3;
}) {
  return <mesh geometry={geometry} material={material(color)} position={p} scale={s} rotation={r} castShadow receiveShadow dispose={null} />;
}

function Strokes({ paths, color, radius = 0.025 }: { paths: Stroke[]; color: string; radius?: number }) {
  const geometry = useMemo(() => {
    const geometries = paths.map(path => new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(path.points.map(p => new THREE.Vector3(...p))),
      Math.max(8, path.points.length * 3), path.radius ?? radius, 5, false,
    ));
    const result = mergeGeometries(geometries);
    geometries.forEach(item => item.dispose());
    return result;
  }, [paths, radius]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry ? <mesh geometry={geometry} material={material(color)} castShadow dispose={null} /> : null;
}

const hemisphere = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
const barrelRoof = new THREE.CylinderGeometry(1, 1, 1, 24, 1, false, 0, Math.PI);
const triangularScarf = new THREE.ExtrudeGeometry(new THREE.Shape([
  new THREE.Vector2(-0.19, 0.08), new THREE.Vector2(0.2, 0.08), new THREE.Vector2(-0.08, -0.17),
]), { depth: 0.03, bevelEnabled: true, bevelSegments: 2, bevelThickness: 0.012, bevelSize: 0.012, steps: 1 });
const roofGeometry = new THREE.ExtrudeGeometry(new THREE.Shape([
  new THREE.Vector2(-0.55, 0), new THREE.Vector2(0, 0.48), new THREE.Vector2(0.55, 0),
]), { depth: 1.1, bevelEnabled: true, bevelSegments: 2, bevelThickness: 0.025, bevelSize: 0.025, steps: 1 });
roofGeometry.translate(0, 0, -0.55);

function BayBayMotion({ body, leftArm, rightArm, leftPaw, rightPaw, tail, scale, locomotion }: {
  body: GroupRef; leftArm: GroupRef; rightArm: GroupRef; leftPaw: GroupRef;
  rightPaw: GroupRef; tail: GroupRef; scale: number;
  locomotion?: { readonly current: BayBayLocomotion };
}) {
  const motion = useRef({ cycle: 0, distance: null as number | null, blend: 0, lean: 0, turn: 0 });
  useFrame(({ clock }, frameDelta) => {
    const delta = Math.min(frameDelta, 0.05);
    const state = motion.current;
    const measured = locomotion?.current;
    if (!measured) {
      // The decorative passenger and other static models keep their original pose.
      body.current?.rotation.set(0, 0, Math.sin(clock.elapsedTime * 1.5) * 0.025);
      leftArm.current?.rotation.set(0, 0, -0.2 + Math.sin(clock.elapsedTime * 2.4) * 0.13);
      return;
    }
    const moved = state.distance === null ? 0 : measured.distance - state.distance;
    state.distance = measured.distance;
    // Ignore reset/teleport discontinuities. Pausing never advances the feet.
    if (moved > 0 && moved < Math.max(1, Math.abs(measured.speed) * 0.2)) {
      state.cycle += bayBayStrideAdvance(moved, scale) * (measured.speed < 0 ? -1 : 1);
    }
    const localSpeed = Math.abs(measured.speed) / Math.max(0.05, scale);
    state.blend = THREE.MathUtils.damp(state.blend, Math.min(1, localSpeed / 0.6), 12, delta);
    state.lean = THREE.MathUtils.damp(state.lean, Math.min(0.1, localSpeed * 0.035) * Math.sign(measured.speed), 8, delta);
    state.turn = THREE.MathUtils.damp(state.turn, THREE.MathUtils.clamp(measured.turn * 0.06, -0.1, 0.1), 9, delta);
    const stride = state.cycle * Math.PI * 2;
    const swing = Math.sin(stride);
    const weightShift = Math.cos(stride) * state.blend;
    const left = bayBayPawPose(state.cycle, 0);
    const right = bayBayPawPose(state.cycle, 1);
    leftPaw.current?.position.set(-0.17, 0.105 + left.lift * state.blend, 0.08 + left.travel * state.blend);
    rightPaw.current?.position.set(0.17, 0.105 + right.lift * state.blend, 0.08 + right.travel * state.blend);
    leftPaw.current?.rotation.set(-left.swing * 0.16 * state.blend, 0, 0);
    rightPaw.current?.rotation.set(-right.swing * 0.16 * state.blend, 0, 0);
    body.current?.position.set(weightShift * 0.018, (0.014 + Math.abs(swing) * 0.018) * state.blend, 0);
    body.current?.rotation.set(state.lean, -swing * 0.035 * state.blend, -weightShift * 0.038 - state.turn * state.blend);
    // Arms counterbalance the opposite leg instead of waving during locomotion.
    leftArm.current?.rotation.set(swing * 0.48 * state.blend, 0, -0.2 - Math.abs(weightShift) * 0.025);
    rightArm.current?.rotation.set(-swing * 0.48 * state.blend, 0, 0.2 + Math.abs(weightShift) * 0.025);
    tail.current?.rotation.set(Math.abs(swing) * 0.08 * state.blend, -swing * 0.13 * state.blend - state.turn * 1.5, 0);
  });
  return null;
}

function WheelMotion({ rotor, pods }: { rotor: GroupRef; pods: GroupRef }) {
  useFrame(({ clock }) => {
    const angle = clock.elapsedTime * 0.06;
    rotor.current?.rotation.set(0, 0, angle);
    if (pods.current) pods.current.children.forEach((child, i) => {
      const a = i / 12 * Math.PI * 2 + angle;
      child.position.set(Math.sin(a) * 1.18, Math.cos(a) * 1.18, 0);
    });
  });
  return null;
}

function CrabMotion({ group }: { group: GroupRef }) {
  useFrame(({ clock }) => {
    group.current?.rotation.set(0, 0, Math.sin(clock.elapsedTime * 5) * 0.025);
  });
  return null;
}

/** Warm clay sea otter from the approved concept. Faces local +Z; height 1.46. */
export const BayBayModel = memo(function BayBayModel({ scale = 1, animated = false, locomotion }: {
  scale?: number; animated?: boolean; locomotion?: { readonly current: BayBayLocomotion };
}) {
  const body = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftPaw = useRef<THREE.Group>(null);
  const rightPaw = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const spheres: Piece[] = [
    { p: [0, 0.57, 0], s: [0.31, 0.43, 0.255], c: C.fur },
    { p: [0, 0.53, 0.175], s: [0.23, 0.34, 0.102], c: C.cream },
    { p: [0, 1.13, 0.015], s: [0.335, 0.294, 0.276], c: C.fur },
    { p: [-0.295, 1.22, 0.025], s: [0.096, 0.11, 0.07], c: C.fur },
    { p: [0.295, 1.22, 0.025], s: [0.096, 0.11, 0.07], c: C.fur },
    { p: [-0.305, 1.22, 0.078], s: [0.055, 0.063, 0.02], c: '#8e5f46' },
    { p: [0.305, 1.22, 0.078], s: [0.055, 0.063, 0.02], c: '#8e5f46' },
    { p: [0, 1.047, 0.228], s: [0.247, 0.181, 0.074], c: C.cream },
    { p: [-0.123, 1.178, 0.263], s: [0.035, 0.044, 0.023], c: C.dark },
    { p: [0.123, 1.178, 0.263], s: [0.035, 0.044, 0.023], c: C.dark },
    { p: [-0.131, 1.19, 0.285], s: [0.009, 0.011, 0.005], c: '#fff9ed' },
    { p: [0.115, 1.19, 0.285], s: [0.009, 0.011, 0.005], c: '#fff9ed' },
    { p: [0, 1.09, 0.312], s: [0.061, 0.043, 0.03], c: '#594032' },
    { p: [-0.188, 1.043, 0.282], s: [0.036, 0.022, 0.006], c: '#d9a185' },
    { p: [0.188, 1.043, 0.282], s: [0.036, 0.022, 0.006], c: '#d9a185' },
    { p: [0, 0.894, 0.005], s: [0.26, 0.076, 0.231], c: C.teal },
  ];
  return <group scale={scale}>
    {(animated || locomotion) && <BayBayMotion body={body} leftArm={leftArm} rightArm={rightArm}
      leftPaw={leftPaw} rightPaw={rightPaw} tail={tail} scale={scale} locomotion={locomotion} />}
    <group ref={leftPaw} position={[-0.17, 0.105, 0.08]}>
      <Shape geometry={SPHERE} color="#936445" s={[0.13, 0.085, 0.18]} />
      <Shape geometry={SPHERE} color={C.fur} p={[0, 0.105, -0.05]} s={[0.102, 0.14, 0.11]} />
    </group>
    <group ref={rightPaw} position={[0.17, 0.105, 0.08]}>
      <Shape geometry={SPHERE} color="#936445" s={[0.13, 0.085, 0.18]} />
      <Shape geometry={SPHERE} color={C.fur} p={[0, 0.105, -0.05]} s={[0.102, 0.14, 0.11]} />
    </group>
    <group ref={body}>
      <Parts pieces={spheres} geometry={SPHERE} />
      <Shape geometry={triangularScarf} color={C.teal} p={[0, 0.847, 0.233]} />
      <group ref={leftArm} position={[-0.26, 0.71, 0]} rotation={[0, 0, -0.2]}>
        <Shape geometry={SPHERE} color={C.fur} p={[-0.035, -0.08, 0.08]} s={[0.11, 0.19, 0.115]} />
      </group>
      <group ref={rightArm} position={[0.26, 0.71, 0]} rotation={[0, 0, 0.2]}>
        <Shape geometry={SPHERE} color={C.fur} p={[0.035, -0.08, 0.08]} s={[0.11, 0.19, 0.115]} />
      </group>
      <group ref={tail} position={[0.08, 0.26, -0.18]}>
        <Strokes color={C.fur} radius={0.105} paths={[{ points: [[0, 0, 0], [0.26, -0.05, -0.12], [0.38, 0.02, -0.06], [0.4, 0.09, -0.01]] }]} />
      </group>
      <Strokes color="#795038" radius={0.008} paths={[
        { points: [[0, 1.065, 0.307], [0, 1.03, 0.312], [-0.038, 1.015, 0.302], [-0.066, 1.036, 0.294]] },
        { points: [[0, 1.03, 0.312], [0.035, 1.016, 0.303], [0.064, 1.036, 0.294]] },
        ...[-1, 1].flatMap(side => [-1, 0, 1].map(i => ({ points: [
          [side * 0.162, 1.074 + i * 0.022, 0.294],
          [side * 0.247, 1.079 + i * 0.035, 0.267],
        ] as V3[] }))),
        ...[-1, 1].map(side => ({ points: [[side * 0.085, 1.259, 0.232], [side * 0.12, 1.267, 0.23], [side * 0.145, 1.256, 0.226]] as V3[] })),
      ]} />
    </group>
  </group>;
});

/** Electric sightseeing buggy, forward local +Z; 1.4 wide × 2 long × 1.65 tall. */
export const BuggyModel = memo(function BuggyModel() {
  return <group>
    <Parts pieces={[
      { p: [0, 0.38, 0], s: [1.12, 0.22, 1.65], c: C.teal },
      { p: [0, 0.58, 0.64], s: [1.1, 0.4, 0.45], c: C.teal },
      { p: [0, 0.48, -0.65], s: [1.1, 0.3, 0.36], c: C.teal },
      { p: [0, 0.46, 0.9], s: [1.16, 0.13, 0.17], c: C.cream },
      { p: [0, 0.63, -0.19], s: [0.97, 0.13, 0.49], c: C.cream },
      { p: [0, 0.88, -0.45], s: [0.97, 0.43, 0.13], c: C.cream },
      { p: [0, 1.56, -0.04], s: [1.3, 0.13, 1.82], c: C.teal },
      ...[-1, 1].flatMap(side => [-0.66, 0.58].map(z => ({ p: [side * 0.51, 1.06, z] as V3, s: [0.055, 0.95, 0.055] as V3, c: C.cream }))),
      { p: [-0.35, 0.63, 0.888], s: [0.25, 0.13, 0.055], c: '#fff6d2' },
      { p: [0.35, 0.63, 0.888], s: [0.25, 0.13, 0.055], c: '#fff6d2' },
      { p: [0, 0.48, 1], s: [0.33, 0.12, 0.025], c: C.darkTeal },
    ]} />
    <Parts geometry={CYLINDER} pieces={[-1, 1].flatMap(side => [-0.55, 0.6].flatMap(z => [
      { p: [side * 0.57, 0.27, z] as V3, s: [0.48, 0.18, 0.48] as V3, r: [0, 0, Math.PI / 2] as V3, c: '#454741' },
      { p: [side * 0.68, 0.27, z] as V3, s: [0.28, 0.018, 0.28] as V3, r: [0, 0, Math.PI / 2] as V3, c: C.cream },
    ]))} />
    <group position={[-0.23, 0.56, -0.12]}><BayBayModel scale={0.56} /></group>
    <mesh position={[-0.23, 0.94, 0.35]} rotation={[-0.65, 0, 0]} material={material(C.darkTeal)}>
      <torusGeometry args={[0.15, 0.021, 6, 18]} />
    </mesh>
    <Parts pieces={[{ p: [-0.23, 0.75, 0.41], s: [0.04, 0.33, 0.04], r: [-0.35, 0, 0], c: C.darkTeal }]} />
  </group>;
});

export const TreeModel = memo(function TreeModel({ scale = 1, variant = 'round' }: { scale?: number; variant?: 'round' | 'cypress' | 'palm' }) {
  if (variant === 'palm') return <group scale={scale}>
    <Parts geometry={CYLINDER} pieces={[{ p: [0, 0.8, 0], s: [0.16, 1.6, 0.16], c: C.wood }]} />
    <Parts geometry={SPHERE} pieces={Array.from({ length: 7 }, (_, i) => {
      const a = i * Math.PI * 2 / 7;
      return { p: [Math.cos(a) * 0.32, 1.7, Math.sin(a) * 0.32], s: [0.16, 0.105, 0.53], r: [0.27, Math.PI / 2 - a, 0], c: i % 2 ? C.leaf : C.leafLight };
    })} />
  </group>;
  return <group scale={scale}>
    <Parts geometry={CYLINDER} pieces={[
      { p: [0, 0.5, 0], s: [0.19, 1, 0.19], c: '#a47c51' },
      { p: [0, 0.09, 0], s: [0.24, 0.18, 0.23], c: '#a47c51' },
      ...(variant === 'round' ? [
        { p: [-0.14, 0.83, 0.04], s: [0.115, 0.62, 0.115], r: [0.08, 0, 0.55], c: '#a47c51' },
        { p: [0.17, 0.88, -0.05], s: [0.105, 0.64, 0.105], r: [-0.15, 0, -0.57], c: '#a47c51' },
      ] as Piece[] : []),
    ]} />
    <Parts geometry={SPHERE} pieces={variant === 'cypress'
      ? [{ p: [0, 1.25, 0], s: [0.35, 1, 0.35], c: C.leaf }, { p: [0.04, 1.82, 0], s: [0.22, 0.49, 0.22], c: C.leafLight }]
      : [
        { p: [0, 1.21, -0.02], s: [0.48, 0.48, 0.43], c: '#839766' },
        { p: [-0.29, 1.19, 0.08], s: [0.34, 0.34, 0.34], c: '#93a675' },
        { p: [0.29, 1.27, -0.06], s: [0.33, 0.38, 0.34], c: '#8da06f' },
        { p: [-0.12, 1.52, 0.07], s: [0.31, 0.27, 0.31], c: '#9bab7b' },
        { p: [0.16, 1.48, -0.18], s: [0.28, 0.3, 0.29], c: '#8fa572' },
        { p: [-0.18, 1.2, -0.3], s: [0.27, 0.3, 0.27], c: '#8ea16e' },
        { p: [0.08, 1.13, 0.3], s: [0.3, 0.27, 0.27], c: '#94a776' },
        { p: [0.33, 1.39, 0.2], s: [0.23, 0.24, 0.23], c: '#a1b080' },
      ]} />
  </group>;
});

export const BenchModel = memo(function BenchModel() {
  return <group>
    <Parts pieces={[
      ...[-0.14, 0, 0.14].map(z => ({ p: [0, 0.38, z] as V3, s: [1.05, 0.07, 0.12] as V3, c: C.wood })),
      ...[0.58, 0.74].map(y => ({ p: [0, y, -0.2] as V3, s: [1.05, 0.13, 0.055] as V3, c: C.wood })),
      ...[-0.42, 0.42].flatMap(x => [
        { p: [x, 0.2, 0] as V3, s: [0.065, 0.4, 0.33] as V3, c: C.darkTeal },
        { p: [x, 0.57, -0.22] as V3, s: [0.065, 0.49, 0.065] as V3, c: C.darkTeal },
        { p: [x, 0.52, 0] as V3, s: [0.085, 0.07, 0.43] as V3, c: C.darkTeal },
      ]),
    ]} />
  </group>;
});

export const HouseModel = memo(function HouseModel({ color = '#d8b596', scale = 1, variant = 0 }: { color?: string; scale?: number; variant?: number }) {
  const height = 1.25 + variant % 3 * 0.17;
  return <group scale={scale}>
    <Parts pieces={[
      { p: [0, 0.075, 0], s: [1.14, 0.15, 1.13], c: C.sand },
      { p: [0, height / 2 + 0.15, 0], s: [1, height, 1], c: color },
      { p: [0, height + 0.1, 0], s: [1.13, 0.1, 1.08], c: C.ivory },
      { p: [-0.24, 0.5, 0.518], s: [0.24, 0.65, 0.055], c: C.darkTeal },
      { p: [-0.24, 0.13, 0.64], s: [0.43, 0.14, 0.31], c: C.sand },
      ...[-0.25, 0.25].flatMap(x => [
        { p: [x, height - 0.21, 0.53] as V3, s: [0.32, 0.45, 0.08] as V3, c: C.ivory },
        { p: [x, height - 0.21, 0.578] as V3, s: [0.22, 0.33, 0.027] as V3, c: C.glass },
        { p: [x, height - 0.21, 0.599] as V3, s: [0.022, 0.34, 0.014] as V3, c: C.ivory },
      ]),
      { p: [0.23, 0.52, 0.55], s: [0.34, 0.48, 0.18], c: C.ivory },
      { p: [0.23, 0.55, 0.65], s: [0.24, 0.3, 0.025], c: C.glass },
      { p: [0.34, height + 0.35, -0.23], s: [0.16, 0.45, 0.18], c: C.rose },
    ]} />
    <Shape geometry={roofGeometry} color={variant % 2 ? C.teal : '#a98270'} p={[0, height + 0.15, 0]} />
  </group>;
});

function GoldenGateBridge() {
  const deck = 0.98;
  const bars: Piece[] = [{ p: [0, deck, 0], s: [0.86, 0.18, 6.2], c: C.red }, { p: [0, deck + 0.105, 0], s: [0.59, 0.032, 6.1], c: C.road }];
  [-1.65, 1.65].forEach(z => {
    [-0.42, 0.42].forEach(x => bars.push({ p: [x, 1.67, z], s: [0.16, 3.34, 0.22], c: C.red }));
    [1.35, 2.05, 2.85, 3.18].forEach(y => bars.push({ p: [0, y, z], s: [0.88, 0.14, 0.19], c: C.red }));
    bars.push({ p: [0, 0.15, z], s: [1.16, 0.3, 0.65], c: C.stone });
  });
  const paths: Stroke[] = [];
  [-0.42, 0.42].forEach(x => {
    paths.push({ points: [[x, 1.05, -3.1], [x, 2.05, -2.3], [x, 3.13, -1.65], [x, 1.7, 0], [x, 3.13, 1.65], [x, 2.05, 2.3], [x, 1.05, 3.1]], radius: 0.044 });
    for (let i = -7; i <= 7; i++) {
      const z = i * 0.2;
      const y = 1.7 + 1.43 * (z / 1.65) ** 2;
      paths.push({ points: [[x, deck + 0.14, z], [x, y, z]], radius: 0.018 });
    }
    paths.push({ points: [[x, deck + 0.2, -3], [x, deck + 0.2, 3]], radius: 0.025 });
  });
  return <><Parts pieces={bars} /><Strokes paths={paths} color={C.red} /></>;
}

function PalaceOfFineArts() {
  const columns: Piece[] = [];
  const capitals: Piece[] = [];
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const x = Math.sin(a) * 0.85, z = Math.cos(a) * 0.85;
    columns.push({ p: [x, 1.06, z], s: [0.22, 1.75, 0.22], c: '#ddbc93' });
    [0.22, 1.89].forEach(y => capitals.push({ p: [x, y, z], s: [0.34, 0.16, 0.34], c: '#ead0aa' }));
  }
  return <>
    <Parts geometry={CYLINDER} pieces={[
      { p: [0, 0.08, 0], s: [2.45, 0.16, 2.45], c: C.sand },
      { p: [0, 1.99, 0], s: [2.26, 0.2, 2.26], c: '#d3b38b' }, ...columns,
      { p: [0, 2.18, 0], s: [1.83, 0.2, 1.83], c: '#dec49e' },
    ]} />
    <Parts pieces={capitals} />
    <Shape geometry={hemisphere} color="#b88f71" p={[0, 2.23, 0]} s={[1.02, 0.72, 1.02]} />
    <Shape geometry={SPHERE} color={C.sand} p={[0, 2.98, 0]} s={[0.13, 0.14, 0.13]} />
    <Parts geometry={CYLINDER} pieces={[{ p: [0, 0.017, 1.36], s: [2.6, 0.035, 1.15], c: '#8fb7ad' }]} />
  </>;
}

function Conservatory() {
  const frame = '#fff4dd';
  const roofGlass = '#dce2d2';
  const windowGlass = '#c5d3c5';
  const boxes: Piece[] = [
    { p: [0, 0.1, 0], s: [3.5, 0.2, 1.62], c: C.sand },
    { p: [0, 0.58, 0], s: [3.3, 0.91, 1.35], c: windowGlass },
    { p: [0, 1.06, 0], s: [3.4, 0.13, 1.43], c: frame },
    { p: [0, 0.45, 0.76], s: [0.55, 0.6, 0.14], c: frame },
    { p: [0, 0.46, 0.847], s: [0.32, 0.48, 0.025], c: windowGlass },
    { p: [0, 0.83, 0.762], s: [0.78, 0.1, 0.19], c: frame },
    { p: [0, 0.461, 0.866], s: [0.027, 0.47, 0.022], c: frame },
    { p: [0, 0.591, 0.866], s: [0.31, 0.027, 0.022], c: frame },
  ];
  for (let i = -7; i <= 7; i++) {
    [-0.695, 0.695].forEach(z => boxes.push({ p: [i * 0.221, 0.61, z], s: [0.047, 0.82, 0.049], c: frame }));
  }
  [-1, 1].forEach(side => {
    [0.18, 0.59, 0.96].forEach(y => boxes.push({ p: [0, y, side * 0.699], s: [3.3, 0.043, 0.048], c: frame }));
  });
  const paths: Stroke[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    paths.push({ points: Array.from({ length: 9 }, (_, j) => {
      const t = j / 8 * Math.PI / 2;
      return [Math.cos(angle) * Math.sin(t) * 0.735, 1.53 + Math.cos(t) * 0.82, Math.sin(angle) * Math.sin(t) * 0.735] as V3;
    }), radius: 0.026 });
    boxes.push({ p: [Math.cos(angle) * 0.735, 1.26, Math.sin(angle) * 0.735], s: [0.047, 0.55, 0.047], c: frame });
  }
  [0.23, 0.49, 0.68].forEach(height => {
    const radius = 0.739 * Math.sqrt(1 - (height / 0.82) ** 2);
    paths.push({ points: Array.from({ length: 33 }, (_, j) => {
      const angle = j / 32 * Math.PI * 2;
      return [Math.cos(angle) * radius, 1.55 + height, Math.sin(angle) * radius] as V3;
    }), radius: 0.021 });
  });
  for (let i = -6; i <= 6; i++) {
    const x = i * 0.25;
    if (Math.abs(x) < 0.62) continue;
    paths.push({ points: Array.from({ length: 9 }, (_, j) => {
      const a = j / 8 * Math.PI;
      return [x, 1.06 + Math.sin(a) * 0.45, Math.cos(a) * 0.69] as V3;
    }), radius: 0.022 });
  }
  [-0.55, 0, 0.55].forEach(z => {
    const y = 1.064 + Math.sqrt(1 - (z / 0.7) ** 2) * 0.451;
    [-1, 1].forEach(side => paths.push({ points: [[side * 0.71, y, z], [side * 1.63, y, z]], radius: 0.018 }));
  });
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    boxes.push({ p: [Math.cos(a) * 0.113, 2.58, Math.sin(a) * 0.113], s: [0.029, 0.24, 0.029], c: frame });
  }
  return <>
    <Parts pieces={boxes} />
    <Parts geometry={CYLINDER} pieces={[
      { p: [0, 1.24, 0], s: [1.47, 0.7, 1.47], c: windowGlass },
      { p: [0, 1.55, 0], s: [1.56, 0.1, 1.56], c: frame },
      { p: [0, 2.39, 0], s: [0.31, 0.1, 0.31], c: frame },
      { p: [0, 2.47, 0], s: [0.27, 0.056, 0.27], c: frame },
      { p: [0, 2.58, 0], s: [0.18, 0.23, 0.18], c: windowGlass },
      { p: [0, 2.74, 0], s: [0.33, 0.065, 0.33], c: frame },
      { p: [0, 2.94, 0], s: [0.03, 0.18, 0.03], c: frame },
    ]} />
    <Shape geometry={CONE} color={frame} p={[0, 2.826, 0]} s={[0.32, 0.145, 0.32]} />
    <Shape geometry={hemisphere} color={roofGlass} p={[0, 1.55, 0]} s={[0.73, 0.82, 0.73]} />
    {[-1.13, 1.13].map(x => <Shape key={x} geometry={barrelRoof} color={roofGlass} p={[x, 1.06, 0]} s={[0.45, 1.14, 0.69]} r={[0, 0, Math.PI / 2]} />)}
    <Strokes paths={paths} color={frame} />
    <Parts pieces={Array.from({ length: 10 }, (_, i) => ({ p: [(i - 4.5) * 0.3, 0.18, 1.04], s: [0.24, 0.17, 0.33], c: C.leaf }))} />
    <Parts geometry={SPHERE} pieces={Array.from({ length: 16 }, (_, i) => ({ p: [(i - 7.5) * 0.18, 0.33 + i % 2 * 0.06, 1.04], s: [0.075, 0.06, 0.07], c: i % 3 ? '#e8b5a1' : C.ivory }))} />
  </>;
}

function CableCar() {
  return <>
    <Parts pieces={[
      { p: [0, 0.23, 0], s: [1.02, 0.17, 1.98], c: '#6f6351' },
      { p: [0, 0.57, 0], s: [0.95, 0.48, 1.74], c: C.wood },
      { p: [0, 0.58, 0.87], s: [0.96, 0.28, 0.07], c: C.red },
      { p: [0, 0.58, -0.87], s: [0.96, 0.28, 0.07], c: C.red },
      { p: [0, 1.05, -0.2], s: [0.94, 0.58, 0.81], c: C.cream },
      { p: [0, 1.05, 0.218], s: [0.78, 0.41, 0.025], c: C.glass },
      ...[-1, 1].flatMap(side => [-0.5, -0.17, 0.13].map(z => ({ p: [side * 0.481, 1.07, z] as V3, s: [0.018, 0.38, 0.22] as V3, c: C.glass }))),
      { p: [0, 1.44, 0], s: [1.17, 0.15, 2.17], c: C.cream },
      ...[-0.43, 0.43].flatMap(x => [-0.83, 0.8].map(z => ({ p: [x, 1.02, z] as V3, s: [0.054, 0.75, 0.054] as V3, c: C.wood }))),
      { p: [0, 0.36, 1], s: [1.07, 0.11, 0.22], c: C.wood },
      { p: [0, 0.36, -1], s: [1.07, 0.11, 0.22], c: C.wood },
      { p: [0, 0.61, 0.914], s: [0.25, 0.17, 0.016], c: C.gold },
    ]} />
    <Parts geometry={CYLINDER} pieces={[-0.34, 0.34].flatMap(x => [-0.55, 0.55].map(z => ({ p: [x, 0.16, z] as V3, s: [0.28, 0.12, 0.28] as V3, r: [0, 0, Math.PI / 2] as V3, c: C.dark })))} />
    <Parts geometry={SPHERE} pieces={[{ p: [0, 0.83, 0.884], s: [0.07, 0.07, 0.04], c: '#fff8d9' }]} />
    <Parts pieces={[-0.32, 0.32].map(x => ({ p: [x, 0.01, 0], s: [0.035, 0.024, 2.55], c: '#8e877b' }))} />
  </>;
}

function SkyStar({ animated }: { animated: boolean }) {
  const rotor = useRef<THREE.Group>(null);
  const pods = useRef<THREE.Group>(null);
  const spokes: Piece[] = Array.from({ length: 12 }, (_, i) => {
    const a = i / 12 * Math.PI * 2;
    return { p: [Math.sin(a) * 0.58, Math.cos(a) * 0.58, 0], s: [0.038, 1.18, 0.035], r: [0, 0, -a], c: C.ivory };
  });
  return <>
    {animated && <WheelMotion rotor={rotor} pods={pods} />}
    <Parts pieces={[
      { p: [0, 0.07, 0], s: [2.35, 0.14, 1.15], c: C.sand },
      { p: [-0.49, 0.92, 0.12], s: [0.13, 1.92, 0.14], r: [0, 0, -0.5], c: C.ivory },
      { p: [0.49, 0.92, 0.12], s: [0.13, 1.92, 0.14], r: [0, 0, 0.5], c: C.ivory },
    ]} />
    <group position={[0, 1.74, 0]}>
      <group ref={rotor}>
        <mesh material={material(C.ivory)}><torusGeometry args={[1.18, 0.048, 6, 48]} /></mesh>
        <Parts pieces={spokes} />
        <Parts geometry={SPHERE} pieces={[{ p: [0, 0, 0.06], s: [0.16, 0.16, 0.11], c: C.gold }]} />
      </group>
      <group ref={pods}>
        {Array.from({ length: 12 }, (_, i) => {
          const a = i / 12 * Math.PI * 2;
          return <group key={i} position={[Math.sin(a) * 1.18, Math.cos(a) * 1.18, 0]}>
            <Parts pieces={[
              { p: [0, -0.12, 0], s: [0.23, 0.21, 0.3], c: i % 3 === 0 ? C.rose : C.teal },
              { p: [0, -0.05, 0.16], s: [0.14, 0.1, 0.012], c: C.glass },
              { p: [0, 0.03, 0], s: [0.26, 0.06, 0.33], c: C.ivory },
            ]} />
          </group>;
        })}
      </group>
    </group>
  </>;
}

export const SealionsModel = memo(function SealionsModel() {
  return <group>
    <Parts geometry={SPHERE} pieces={[-0.5, 0.2, 0.72].flatMap((x, i) => {
      const y = i % 2 * 0.04;
      return [
        { p: [x, 0.2 + y, 0] as V3, s: [0.25, 0.2, 0.47] as V3, c: i % 2 ? '#947354' : '#b4926b' },
        { p: [x, 0.46 + y, 0.27] as V3, s: [0.17, 0.23, 0.18] as V3, c: i % 2 ? '#947354' : '#b4926b' },
        { p: [x, 0.44 + y, 0.425] as V3, s: [0.09, 0.062, 0.07] as V3, c: '#c7aa82' },
        { p: [x - 0.06, 0.52 + y, 0.42] as V3, s: [0.014, 0.018, 0.013] as V3, c: C.dark },
        { p: [x + 0.06, 0.52 + y, 0.42] as V3, s: [0.014, 0.018, 0.013] as V3, c: C.dark },
        { p: [x - 0.2, 0.11 + y, 0.06] as V3, s: [0.19, 0.045, 0.085] as V3, r: [0, -0.5, 0] as V3, c: '#947354' },
        { p: [x + 0.2, 0.11 + y, 0.06] as V3, s: [0.19, 0.045, 0.085] as V3, r: [0, 0.5, 0] as V3, c: '#947354' },
      ];
    })} />
  </group>;
});

export const CrabModel = memo(function CrabModel({ animated = false }: { animated?: boolean }) {
  const group = useRef<THREE.Group>(null);
  return <group ref={group}>
    {animated && <CrabMotion group={group} />}
    <Parts geometry={SPHERE} pieces={[
      { p: [0, 0.13, 0], s: [0.22, 0.12, 0.16], c: C.red },
      ...[-1, 1].flatMap(side => [
        { p: [side * 0.27, 0.25, 0.17] as V3, s: [0.11, 0.11, 0.07] as V3, c: '#db8669' },
        { p: [side * 0.065, 0.26, 0.105] as V3, s: [0.024, 0.04, 0.023] as V3, c: C.dark },
      ]),
    ]} />
    <Strokes color={C.red} radius={0.018} paths={[-1, 1].flatMap(side => [-1, 0, 1].map(i => ({ points: [
      [side * 0.14, 0.11, i * 0.09], [side * 0.29, 0.1, i * 0.12], [side * 0.33, 0.015, i * 0.15],
    ] as V3[] })))} />
  </group>;
});

function Pier() {
  return <>
    <Parts pieces={[
      { p: [0, 0.22, 0], s: [2.45, 0.19, 2.65], c: C.wood },
      { p: [0, 0.32, 1.12], s: [2.35, 0.09, 0.12], c: C.cream },
      ...[-1, 1].flatMap(x => [-1, 0, 1].map(z => ({ p: [x, 0.16, z] as V3, s: [0.15, 0.6, 0.15] as V3, c: '#8e6a49' }))),
      ...Array.from({ length: 13 }, (_, i) => ({ p: [0, 0.321, (i - 6) * 0.2], s: [2.42, 0.014, 0.023], c: '#a37850' } as Piece)),
    ]} />
    <group position={[-0.61, 0.33, -0.61]} scale={0.7}><HouseModel color={C.rose} /></group>
    <group position={[0.64, 0.33, -0.61]} scale={0.7}><HouseModel color={C.teal} /></group>
    <group position={[0, 0.33, 0.5]} scale={0.8}><SealionsModel /></group>
  </>;
}

function FerryBuilding() {
  const p: Piece[] = [
    { p: [0, 0.5, 0], s: [3.4, 1, 0.96], c: '#e2c7a4' },
    { p: [0, 1.04, 0], s: [3.6, 0.16, 1.09], c: '#ad8265' },
    { p: [0, 1.56, 0], s: [0.6, 1.2, 0.62], c: C.cream },
    { p: [0, 2.24, 0], s: [0.79, 0.18, 0.8], c: C.sand },
    { p: [0, 2.42, 0], s: [0.54, 0.25, 0.54], c: C.cream },
  ];
  for (let i = -5; i <= 5; i++) p.push({ p: [i * 0.286, 0.57, 0.501], s: [0.16, 0.56, 0.025], c: C.darkTeal });
  return <>
    <Parts pieces={p} />
    <Shape geometry={CONE} color={C.teal} p={[0, 2.77, 0]} s={[0.74, 0.46, 0.74]} />
    <Parts geometry={CYLINDER} pieces={[{ p: [0, 1.84, 0.329], s: [0.37, 0.025, 0.37], r: [Math.PI / 2, 0, 0], c: C.ivory }]} />
    <Parts pieces={[{ p: [0, 1.885, 0.348], s: [0.018, 0.12, 0.02], c: C.darkTeal }, { p: [0.047, 1.84, 0.348], s: [0.11, 0.018, 0.02], c: C.darkTeal }]} />
  </>;
}

function Chinatown() {
  return <>
    <Parts pieces={[
      ...[-1.02, 0, 1.02].map(x => ({ p: [x, 0.78, 0], s: [0.2, 1.56, 0.25], c: C.red } as Piece)),
      { p: [0, 1.4, 0], s: [2.65, 0.27, 0.45], c: C.darkTeal },
      { p: [0, 1.57, 0], s: [2.85, 0.15, 0.75], c: C.teal },
      { p: [0, 1.84, 0], s: [1.14, 0.18, 0.77], c: C.teal },
      { p: [0, 1.48, 0.248], s: [0.64, 0.18, 0.025], c: C.gold },
    ]} />
    <Strokes color={C.teal} radius={0.055} paths={[
      { points: [[-1.56, 1.73, 0], [-1.25, 1.57, 0], [0, 1.62, 0], [1.25, 1.57, 0], [1.56, 1.73, 0]] },
      { points: [[-0.73, 1.99, 0], [-0.49, 1.84, 0], [0.49, 1.84, 0], [0.73, 1.99, 0]] },
    ]} />
    <Parts geometry={SPHERE} pieces={[-0.55, 0.55].map(x => ({ p: [x, 1.04, 0], s: [0.15, 0.2, 0.14], c: '#d57c59' }))} />
  </>;
}

function Castro() {
  return <>
    <group position={[0.75, 0, -0.45]}><HouseModel color="#e4b492" scale={1.15} variant={1} /></group>
    <Parts pieces={[
      { p: [-0.04, 1.52, 0.03], s: [0.3, 1.32, 0.18], c: C.red },
      ...Array.from({ length: 6 }, (_, i) => ({ p: [(i - 2.5) * 0.33, 0.024, 1.01], s: [0.32, 0.045, 0.83], c: ['#cd735f', '#daa568', '#e5ce78', '#8aa77e', '#7ba7b5', '#aa93ad'][i] } as Piece)),
      { p: [-0.06, 1.96, 0.137], s: [0.11, 0.045, 0.02], c: C.ivory },
      { p: [-0.06, 1.76, 0.137], s: [0.11, 0.045, 0.02], c: C.ivory },
      { p: [-0.06, 1.56, 0.137], s: [0.11, 0.045, 0.02], c: C.ivory },
      { p: [-0.06, 1.36, 0.137], s: [0.11, 0.045, 0.02], c: C.ivory },
      { p: [-0.06, 1.16, 0.137], s: [0.11, 0.045, 0.02], c: C.ivory },
    ]} />
    <Parts geometry={CYLINDER} pieces={[{ p: [-0.83, 0.93, -0.1], s: [0.045, 1.86, 0.045], c: C.darkTeal }]} />
    <Parts pieces={Array.from({ length: 6 }, (_, i) => ({ p: [-0.57, 1.76 - i * 0.077, -0.1], s: [0.51, 0.073, 0.025], c: ['#cd735f', '#daa568', '#e5ce78', '#8aa77e', '#7ba7b5', '#aa93ad'][i] }))} />
  </>;
}

function CoitTower() {
  return <>
    <Parts geometry={CYLINDER} pieces={[
      { p: [0, 0.065, 0], s: [1.42, 0.13, 1.42], c: C.sand },
      { p: [0, 1.24, 0], s: [0.83, 2.37, 0.83], c: C.cream },
      { p: [0, 2.47, 0], s: [0.94, 0.15, 0.94], c: C.ivory },
      ...Array.from({ length: 8 }, (_, i) => {
        const a = i * Math.PI / 4;
        return { p: [Math.sin(a) * 0.395, 1.24, Math.cos(a) * 0.395], s: [0.05, 2.2, 0.05], c: '#ead7b8' } as Piece;
      }),
    ]} />
    <Parts pieces={Array.from({ length: 8 }, (_, i) => {
      const a = i * Math.PI / 4;
      return { p: [Math.sin(a) * 0.416, 2.13, Math.cos(a) * 0.416], s: [0.13, 0.34, 0.025], r: [0, a, 0], c: C.darkTeal };
    })} />
  </>;
}

function Alcatraz() {
  return <>
    <Parts geometry={SPHERE} pieces={[{ p: [0, 0.01, 0], s: [1.8, 0.46, 1.07], c: '#afa38b' }]} />
    <Parts pieces={[
      { p: [-0.22, 0.68, 0], s: [2.22, 0.6, 0.72], c: '#d6c8ac' },
      { p: [-0.22, 1.01, 0], s: [2.36, 0.08, 0.84], c: '#ac9f86' },
      ...Array.from({ length: 8 }, (_, i) => ({ p: [-1.08 + i * 0.245, 0.75, 0.369], s: [0.105, 0.15, 0.017], c: '#788d80' } as Piece)),
    ]} />
    <Parts geometry={CYLINDER} pieces={[
      { p: [0.99, 1.02, 0.3], s: [0.24, 1.24, 0.24], c: C.ivory },
      { p: [0.99, 1.62, 0.3], s: [0.31, 0.09, 0.31], c: C.darkTeal },
    ]} />
    <Shape geometry={CONE} color={C.darkTeal} p={[0.99, 1.74, 0.3]} s={[0.35, 0.18, 0.35]} />
  </>;
}

function LombardStreet() {
  const road: V3[] = Array.from({ length: 49 }, (_, i) => {
    const t = i / 48;
    return [Math.sin(t * Math.PI * 6) * 0.64, 0.14 + (1 - t) * 1.42, (t - 0.5) * 2.6];
  });
  return <>
    <Parts pieces={[{ p: [0, 0.63, 0], s: [2.1, 0.18, 3.04], r: [0.46, 0, 0], c: C.leaf }]} />
    <Strokes color={C.road} radius={0.14} paths={[{ points: road }]} />
    <Parts geometry={SPHERE} pieces={Array.from({ length: 6 }, (_, i) => ({ p: [i % 2 ? -0.62 : 0.62, 1.4 - i * 0.21, -1.07 + i * 0.43], s: [0.25, 0.16, 0.23], c: i % 2 ? '#cca791' : '#a3af80' }))} />
    <group position={[-1.04, 0.15, 0.1]} scale={0.55}><HouseModel color={C.rose} /></group>
    <group position={[1.08, 0.73, -0.61]} scale={0.58}><HouseModel color="#dbcfa4" /></group>
  </>;
}

function TwinPeaks() {
  return <>
    <Parts geometry={SPHERE} pieces={[
      { p: [-0.59, 0.13, -0.22], s: [1.13, 1.28, 1.05], c: '#9da27a' },
      { p: [0.62, 0.05, 0.44], s: [1.05, 1.11, 0.96], c: '#acaf86' },
    ]} />
    <Strokes color={C.sand} radius={0.046} paths={[{ points: [[1.24, 0.16, 1.03], [0.91, 0.63, 0.88], [0.34, 0.87, 0.84], [0.55, 1.12, 0.46], [0.15, 1.13, 0.09], [-0.59, 1.43, -0.22]] }]} />
    <Parts geometry={CYLINDER} pieces={[{ p: [-0.59, 1.46, -0.22], s: [0.63, 0.08, 0.63], c: C.sand }, { p: [-0.63, 1.68, -0.2], s: [0.06, 0.43, 0.06], c: C.darkTeal }]} />
    <Parts pieces={[{ p: [-0.63, 1.86, -0.15], s: [0.23, 0.08, 0.1], c: C.darkTeal }]} />
  </>;
}

function UnionSquare() {
  return <>
    <Parts pieces={[
      { p: [0, 0.08, 0], s: [2.8, 0.16, 2.25], c: C.sand },
      { p: [0, 0.23, 0], s: [0.64, 0.3, 0.64], c: C.cream },
      { p: [0, 1.57, 0], s: [0.31, 0.13, 0.31], c: C.cream },
    ]} />
    <Parts geometry={CYLINDER} pieces={[{ p: [0, 0.97, 0], s: [0.17, 1.23, 0.17], c: C.ivory }]} />
    <Parts geometry={SPHERE} pieces={[{ p: [0, 1.79, 0], s: [0.08, 0.17, 0.07], c: C.gold }, { p: [0, 2.01, 0], s: [0.07, 0.07, 0.07], c: C.gold }]} />
    {[-1.01, 1.01].map(x => <group key={x} position={[x, 0.17, -0.58]} scale={0.6}><TreeModel variant="palm" /></group>)}
    <group position={[0.79, 0.17, 0.61]} scale={0.55}><BenchModel /></group>
    <group position={[-0.79, 0.17, 0.61]} scale={0.55}><BenchModel /></group>
  </>;
}

function Presidio() {
  return <>
    <Parts pieces={[
      { p: [0, 0.1, 0], s: [3.1, 0.2, 2.3], c: '#afbd8d' },
      { p: [0, 0.26, -0.6], s: [2.9, 0.22, 0.75], c: '#becba1' },
      { p: [0, 0.41, -0.92], s: [2.7, 0.16, 0.26], c: '#cbd5b5' },
      { p: [0.47, 0.74, 0], s: [1.02, 0.08, 0.76], c: C.cream },
      ...[-0.37, 0.37].map(z => ({ p: [0.47, 0.47, z] as V3, s: [0.85, 0.075, 0.16] as V3, c: C.wood })),
      ...[-0.25, 0.25].map(x => ({ p: [0.47 + x, 0.46, 0] as V3, s: [0.075, 0.59, 0.65] as V3, c: C.wood })),
    ]} />
    <group position={[-0.91, 0.2, -0.3]} scale={0.87}><TreeModel /></group>
    <group position={[0.93, 0.35, -0.93]} scale={0.54}><TreeModel /></group>
  </>;
}

function SutroBaths() {
  return <>
    <Parts pieces={[
      { p: [0, 0.07, 0], s: [2.8, 0.14, 2.2], c: '#aaa38d' },
      { p: [0, 0.15, 0], s: [2.29, 0.035, 1.69], c: '#81a69f' },
      ...[-0.8, 0, 0.8].map(z => ({ p: [0, 0.22, z] as V3, s: [2.6, 0.22, 0.11] as V3, c: '#c7b999' })),
      ...[-1.13, 0, 1.13].map(x => ({ p: [x, 0.22, 0] as V3, s: [0.11, 0.22, 1.65] as V3, c: '#c7b999' })),
    ]} />
    <Parts geometry={SPHERE} pieces={[{ p: [-1.25, 0.26, -0.85], s: [0.55, 0.46, 0.47], c: '#a29b85' }, { p: [1.31, 0.22, -0.89], s: [0.38, 0.31, 0.45], c: '#9c987f' }]} />
  </>;
}

export type SanFranciscoLandmarkKind = 'bridge' | 'presidio' | 'palace' | 'lombard' | 'pier' | 'alcatraz' | 'chinatown' | 'ferry' | 'park' | 'cable-car' | 'twin-peaks' | 'union-square' | 'castro' | 'skystar' | 'coit' | 'painted-ladies' | 'sutro';

/** All landmarks start at ground y=0. Their public-facing side is +Z. */
export const LandmarkModel = memo(function LandmarkModel({ kind, animated = false }: { kind: string; animated?: boolean }) {
  switch (kind) {
    case 'bridge': return <GoldenGateBridge />;
    case 'presidio': return <Presidio />;
    case 'palace': return <PalaceOfFineArts />;
    case 'lombard': return <LombardStreet />;
    case 'pier': return <Pier />;
    case 'alcatraz': return <Alcatraz />;
    case 'chinatown': return <Chinatown />;
    case 'ferry': return <FerryBuilding />;
    case 'park': return <Conservatory />;
    case 'cable-car': return <CableCar />;
    case 'twin-peaks': return <TwinPeaks />;
    case 'union-square': return <UnionSquare />;
    case 'castro': return <Castro />;
    case 'skystar': return <SkyStar animated={animated} />;
    case 'coit': return <CoitTower />;
    case 'painted-ladies': return <group>{['#d6a28d', '#d8c693', '#a4b6a0', '#baafbe', '#b5c5c0', '#d5b394'].map((color, i) => <group key={color} position={[(i - 2.5) * 0.57, (5 - i) * 0.045, 0]}><HouseModel color={color} scale={0.54} variant={i} /></group>)}</group>;
    case 'sutro': return <SutroBaths />;
    default: return <HouseModel />;
  }
});
