/** @jsxImportSource react */
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bayBayPawPose, bayBayStrideAdvance, type BayBayLocomotion } from './baybay-locomotion';
import { isOnLand, projectCoordinate, terrainHeight } from './sf-world';

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

export function CableCarModel({ tracks = true }: { tracks?: boolean }) {
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
    {tracks && <Parts pieces={[-0.32, 0.32].map(x => ({ p: [x, 0.01, 0], s: [0.035, 0.024, 2.55], c: '#8e877b' }))} />}
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
      ...[-1, 1].flatMap(side => [-1.12, -.53, .06, .65].map(z => ({ p: [side * 1.17, .53, z] as V3, s: [.045, .42, .045] as V3, c: C.ivory }))),
      ...[-1, 1].map(side => ({ p: [side * 1.17, .72, -.24] as V3, s: [.045, .04, 1.87] as V3, c: C.ivory })),
      ...[-.88, -.7, -.52, -.34].map((x, i) => ({ p: [x, .86, -.15] as V3, s: [.175, .045, .37] as V3, r: [.14, 0, 0] as V3, c: i % 2 ? C.ivory : C.rose })),
      ...[.37, .55, .73, .91].map((x, i) => ({ p: [x, .86, -.15] as V3, s: [.175, .045, .37] as V3, r: [.14, 0, 0] as V3, c: i % 2 ? C.ivory : C.teal })),
      { p: [-.83, .89, 1.03], s: [.04, 1.15, .04], c: C.darkTeal },
      { p: [-.83, 1.32, 1.03], s: [.41, .19, .055], c: C.teal },
    ]} />
    <group position={[-0.61, 0.33, -0.61]} scale={0.7}><HouseModel color={C.rose} /></group>
    <group position={[0.64, 0.33, -0.61]} scale={0.7}><HouseModel color={C.teal} /></group>
    <group position={[0, 0.33, 0.5]} scale={0.8}><SealionsModel /></group>
    <Shape geometry={SPHERE} color={C.gold} p={[-.83, 1.52, 1.03]} s={[.065, .065, .065]} />
    <ShoreBird position={[1.15, .745, .43]} turn={-1.3} />
    <group position={[1.2, .12, -1.55]} rotation={[0, -.22, 0]}>
      <Parts pieces={[{ p: [0, 0, 0], s: [.57, .085, .82], c: '#aa845b' }, { p: [0, .051, 0], s: [.46, .016, .65], c: '#bf9a6f' }]} />
      <group position={[0, .05, 0]} scale={.38}><SealionsModel /></group>
    </group>
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
      ...[-1.23, -.67, .67, 1.23].map(x => ({ p: [x, 0.78, 0], s: [0.16, 1.56, 0.25], c: C.red } as Piece)),
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
    <Parts pieces={[-1.14, 1.14].flatMap(x => [-1.08, -1.95].map(z => ({ p: [x, .75, z] as V3, s: [.035, 1.5, .035] as V3, c: '#826b4e' })))} />
    <Strokes color="#aa8d65" radius={.014} paths={[-1.08, -1.95].map(z => ({ points: [[-1.14, 1.51, z], [0, 1.38, z], [1.14, 1.51, z]] }))} />
    <Parts geometry={SPHERE} pieces={[-1.08, -1.95].flatMap(z => [-.73, -.24, .24, .73].map(x => ({ p: [x, 1.27 + Math.abs(x) * .09, z] as V3, s: [.105, .14, .105] as V3, c: '#cf7859' })))} />
    <Parts pieces={[-1.08, -1.95].flatMap(z => [-.73, -.24, .24, .73].map(x => ({ p: [x, 1.06 + Math.abs(x) * .09, z] as V3, s: [.026, .13, .026] as V3, c: C.gold })))} />
    {[-1, 1].map(side => <group key={side} position={[side * 1.48, 0, -1.49]} scale={.59} rotation={[0, side * Math.PI / 2, 0]}><HouseModel color={side < 0 ? '#d9b186' : '#b7bda0'} /></group>)}
    <Parts pieces={[{ p: [0, .012, -1.12], s: [1.16, .023, 2.1], c: '#ceb995' }, { p: [-.78, .06, .58], s: [.25, .12, .23], c: C.stone }, { p: [.78, .06, .58], s: [.25, .12, .23], c: C.stone }]} />
    <Parts geometry={SPHERE} pieces={[-.78, .78].map(x => ({ p: [x, .22, .58], s: [.12, .16, .14], c: '#c8b78e' }))} />
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

const pagodaRoof = new THREE.ConeGeometry(.5, 1, 4);
const roofHills = [[-.46, -.25, .34, .19], [.38, -.26, .37, .22], [-.4, .28, .15, .16], [.42, .27, .16, .16], [0, .37, .12, .14], [-.68, .06, .1, .11], [.67, .02, .11, .12]];
function academyRoofHeight(x: number, z: number) {
  return .51 + roofHills.reduce((sum, [cx, cz, h, radius]) => sum + h * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * radius ** 2)), 0);
}
const academyRoof = new THREE.PlaneGeometry(1.72, 1.32, 28, 22);
academyRoof.rotateX(-Math.PI / 2);
for (let i = 0; i < academyRoof.attributes.position.count; i++) {
  const positions = academyRoof.attributes.position;
  positions.setY(i, academyRoofHeight(positions.getX(i), positions.getZ(i)));
}
academyRoof.computeVertexNormals();

/** A compact garden vignette: five pagoda roofs, drum bridge and koi pond. */
function JapaneseTeaGarden() {
  const boxes: Piece[] = [
    { p: [0, .025, 0], s: [1.66, .05, 1.48], c: '#a8b58a' },
    { p: [.5, .064, .39], s: [.39, .04, .51], c: '#e4d6b7' },
  ];
  const arches: Stroke[] = [];
  for (let tier = 0; tier < 5; tier++) {
    const width = .45 - tier * .043;
    const y = .18 + tier * .225;
    boxes.push({ p: [-.38, y + .04, -.36], s: [width * .62, .14, width * .62], c: '#bc6249' });
    for (const side of [-1, 1]) boxes.push({ p: [-.38 + side * width * .25, y + .04, -.36 + width * .32], s: [.026, .17, .023], c: C.cream });
    for (const side of [-1, 1]) arches.push({ points: [[-.38 - width * .63, y + .19, -.36 + side * width * .4], [-.38 - width * .4, y + .135, -.36 + side * width * .4], [-.38 + width * .4, y + .135, -.36 + side * width * .4], [-.38 + width * .63, y + .19, -.36 + side * width * .4]], radius: .017 });
  }
  for (let i = 0; i < 12; i++) {
    const angle = .12 + i / 11 * (Math.PI - .24);
    boxes.push({ p: [.03 + Math.cos(angle) * .33, .115 + Math.sin(angle) * .26, .28], s: [.068, .042, .29], r: [0, 0, angle - Math.PI / 2], c: '#bb895b' });
  }
  for (const z of [.11, .45]) arches.push({ points: Array.from({ length: 15 }, (_, i) => {
    const angle = .1 + i / 14 * (Math.PI - .2);
    return [.03 + Math.cos(angle) * .34, .25 + Math.sin(angle) * .27, z] as V3;
  }), radius: .017 });
  return <group>
    <Parts pieces={boxes} />
    <Shape geometry={SPHERE} color="#81aaa2" p={[-.07, .057, .25]} s={[.57, .024, .38]} />
    {Array.from({ length: 5 }, (_, tier) => <Shape key={tier} geometry={pagodaRoof} color="#496854" p={[-.38, .36 + tier * .225, -.36]} s={[.64 - tier * .055, .15, .64 - tier * .055]} r={[0, Math.PI / 4, 0]} />)}
    <Shape geometry={CYLINDER} color={C.gold} p={[-.38, 1.46, -.36]} s={[.026, .35, .026]} />
    <Parts geometry={SPHERE} pieces={Array.from({ length: 5 }, (_, i) => ({ p: [-.38, 1.32 + i * .05, -.36], s: [.036 - i * .004, .014, .036 - i * .004], c: C.gold }))} />
    <Strokes paths={arches} color="#8a6245" />
    <Parts geometry={SPHERE} pieces={[
      { p: [-.45, .086, .37], s: [.075, .016, .024], r: [0, .5, 0], c: C.rose },
      { p: [.31, .086, .31], s: [.063, .016, .021], r: [0, -.45, 0], c: C.ivory },
      { p: [.48, .1, -.36], s: [.27, .11, .21], c: '#a2b48a' },
    ]} />
    <Strokes color="#765c44" radius={.035} paths={[{ points: [[.53, .1, -.45], [.48, .41, -.45], [.34, .67, -.41]], radius: .037 }, { points: [[.49, .37, -.45], [.7, .55, -.48]] }]} />
    <Parts geometry={SPHERE} pieces={[{ p: [.35, .72, -.43], s: [.29, .13, .2], c: '#809c70' }, { p: [.7, .6, -.48], s: [.19, .1, .19], c: '#91aa7b' }, { p: [.48, .9, -.4], s: [.17, .09, .16], c: '#8ca579' }]} />
    <Parts pieces={[{ p: [.55, .18, .46], s: [.07, .24, .07], c: C.stone }, { p: [.55, .34, .46], s: [.17, .12, .17], c: C.cream }, { p: [.55, .415, .46], s: [.25, .055, .25], c: C.stone }, { p: [.55, .34, .55], s: [.08, .055, .014], c: C.gold }]} />
  </group>;
}

/** Seven green roof hills and round skylights remain legible at city scale. */
function AcademyOfSciences() {
  const boxes: Piece[] = [
    { p: [0, .04, 0], s: [1.85, .08, 1.46], c: C.cream },
    { p: [0, .29, 0], s: [1.57, .43, 1.2], c: '#9cbbb1' },
    { p: [0, .5, 0], s: [1.84, .055, 1.44], c: '#d2d4ba' },
    { p: [0, .075, .82], s: [.79, .065, .2], c: C.sand },
    { p: [0, .19, .61], s: [.29, .28, .015], c: C.darkTeal },
  ];
  for (let i = -4; i <= 4; i++) boxes.push({ p: [i * .18, .29, .618], s: [.022, .4, .027], c: C.ivory });
  for (const side of [-1, 1]) for (let i = -3; i <= 3; i++) boxes.push({ p: [side * .8, .29, i * .18], s: [.025, .4, .022], c: C.ivory });
  for (const side of [-1, 1]) for (let i = -5; i <= 5; i++) boxes.push({ p: [i * .16, .543, side * .7], s: [.135, .018, .065], c: '#617e78' });
  const skylights: Piece[] = roofHills.slice(0, 2).flatMap(([x, z]) => Array.from({ length: 5 }, (_, i) => {
    const angle = i * Math.PI * 2 / 5;
    const sx = x + Math.cos(angle) * .14, sz = z + Math.sin(angle) * .14;
    return { p: [sx, academyRoofHeight(sx, sz) + .008, sz], s: [.041, .016, .041], c: '#cadfd0' };
  }));
  return <>
    <Parts pieces={boxes} />
    <mesh geometry={academyRoof} material={material('#8caa70')} castShadow receiveShadow dispose={null} />
    <Parts geometry={SPHERE} pieces={skylights} />
    <Shape geometry={hemisphere} color="#b9d5c7" p={[.04, .515, .15]} s={[.19, .15, .19]} />
    <Strokes color={C.ivory} radius={.011} paths={[0, Math.PI / 2].map(angle => ({ points: Array.from({ length: 12 }, (_, i) => {
      const a = i / 11 * Math.PI;
      return [.04 + Math.cos(a) * Math.cos(angle) * .195, .52 + Math.sin(a) * .155, .15 + Math.cos(a) * Math.sin(angle) * .195] as V3;
    }) }))} />
    <Parts pieces={[-.65, .65].map(x => ({ p: [x, .1, .8], s: [.3, .1, .14], c: '#91a97a' }))} />
  </>;
}

/** Copper-clad museum with the Hamon tower's distinctive twisting silhouette. */
function DeYoungMuseum() {
  const copper = '#aa7655';
  const boxes: Piece[] = [
    { p: [0, .035, 0], s: [1.65, .07, 1.36], c: '#cfbea0' },
    { p: [-.18, .25, 0], s: [1.15, .43, 1.13], c: copper },
    { p: [-.17, .48, 0], s: [1.23, .065, 1.22], c: '#8d644b' },
    { p: [-.22, .17, .575], s: [.47, .27, .014], c: '#4c6b60' },
    { p: [-.22, .43, .71], s: [.8, .065, .28], c: copper },
    { p: [-.22, .057, .8], s: [.76, .035, .13], c: C.cream },
  ];
  for (let layer = 0; layer < 10; layer++) boxes.push({
    p: [.48, .16 + layer * .13, -.28], s: [.37 + layer * .014, .135, .38 + layer * .008], r: [0, layer * .035, 0], c: layer % 3 === 0 ? '#ab7856' : '#a57151',
  });
  boxes.push({ p: [.48, 1.49, -.28], s: [.55, .17, .49], r: [0, .32, 0], c: '#405a52' }, { p: [.48, 1.605, -.28], s: [.6, .065, .54], r: [0, .32, 0], c: '#96694d' });
  // Tiny clay inlays suggest the perforated copper skin without textures.
  const dots: Piece[] = Array.from({ length: 45 }, (_, i) => ({
    p: [-.71 + i % 15 * .074, .17 + Math.floor(i / 15) * .09, .572], s: [.013, .014, .006], c: i % 4 ? '#81583f' : '#cfaa78',
  }));
  const towerDots: Piece[] = Array.from({ length: 48 }, (_, i) => {
    const layer = Math.floor(i / 4), y = .23 + layer * .097, angle = layer / 11 * .29;
    const x = (i % 4 - 1.5) * .068, z = .198 + layer * .004;
    return { p: [.48 + x * Math.cos(angle) + z * Math.sin(angle), y, -.28 + z * Math.cos(angle) - x * Math.sin(angle)], s: [.013, .018, .008], r: [0, angle, 0], c: '#704e3c' };
  });
  return <>
    <Parts pieces={[...boxes, ...towerDots]} />
    <Parts geometry={SPHERE} pieces={dots} />
    <Shape geometry={SPHERE} color="#859b79" p={[-.54, .14, -.61]} s={[.18, .11, .13]} />
    <Shape geometry={SPHERE} color="#556f64" p={[.61, .2, .53]} s={[.08, .18, .08]} />
  </>;
}

function ShoreBird({ position, turn = 0 }: { position: V3; turn?: number }) {
  return <group position={position} rotation={[0, turn, 0]}>
    <Parts geometry={SPHERE} pieces={[{ p: [0, .11, 0], s: [.075, .07, .13], c: C.ivory }, { p: [0, .18, .09], s: [.058, .057, .06], c: C.ivory }, { p: [-.02, .197, .135], s: [.01, .012, .008], c: C.dark }, { p: [0, .165, .166], s: [.021, .015, .051], c: C.gold }, { p: [.052, .135, -.014], s: [.03, .05, .11], c: '#b5b7a6' }]} />
    <Parts pieces={[-.027, .027].map(x => ({ p: [x, .045, .015], s: [.012, .075, .013], c: '#7d6953' }))} />
  </group>;
}

/** Long pale sand, planted dunes and small shore life along the Pacific edge. */
function CoastalBeach({ baker = false, animated = false }: { baker?: boolean; animated?: boolean }) {
  const length = baker ? 5.6 : 8;
  const angle = baker ? -.49 : -.06;
  const anchor = projectCoordinate(baker ? [-122.48316, 37.79322] : [-122.51050, 37.76915]);
  const ground = (x: number, z: number) => terrainHeight(anchor[0] + x * Math.cos(angle) + z * Math.sin(angle), anchor[1] + z * Math.cos(angle) - x * Math.sin(angle)) - terrainHeight(...anchor);
  const sandGeometry = useMemo(() => {
    const origin = projectCoordinate(baker ? [-122.48316, 37.79322] : [-122.51050, 37.76915]);
    const rotation = baker ? -.49 : -.06;
    const extent = baker ? 2.8 : 4;
    const positions: number[] = [];
    const colorValues: number[] = [];
    const dry = new THREE.Color('#e7d5b3'), wet = new THREE.Color('#cfbfa0');
    const vertex = (x: number, z: number) => {
      const wx = origin[0] + x * Math.cos(rotation) + z * Math.sin(rotation), wz = origin[1] + z * Math.cos(rotation) - x * Math.sin(rotation);
      return { x, z, wx, wz, y: terrainHeight(wx, wz) - terrainHeight(...origin) + .028, land: isOnLand(wx, wz) };
    };
    for (let z = -extent; z < extent; z += .16) for (let x = -3.8; x < 1; x += .16) {
      // Follow the real shoreline; rounded inland ends avoid a rectangular mat.
      const edge = .84 - Math.pow(Math.abs((z + .08) / extent), 6) * .95 + Math.sin(z * 2.1) * .045;
      if (x + .08 > edge) continue;
      const a = vertex(x, z), b = vertex(x + .16, z), c = vertex(x, z + .16), d = vertex(x + .16, z + .16);
      for (const triangle of [[a, c, b], [b, c, d]]) {
        if (!triangle.every(p => p.land)) continue;
        for (const p of triangle) {
          positions.push(p.x, p.y, p.z);
          const nearSea = !isOnLand(p.wx - .32, p.wz) || !isOnLand(p.wx, p.wz - .32);
          const color = nearSea ? wet : dry;
          colorValues.push(color.r, color.g, color.b);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorValues, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [baker]);
  useEffect(() => () => sandGeometry.dispose(), [sandGeometry]);
  const dunes: Piece[] = Array.from({ length: 10 }, (_, i) => {
    const x = .55 + Math.sin(i * 2) * .17, z = (i / 9 - .5) * length * .85;
    return { p: [x, .065 + ground(x, z), z], s: [.35, .13 + i % 3 * .018, .43], c: i % 2 ? '#dbc8a3' : '#decca9' };
  });
  const grass: Piece[] = Array.from({ length: 26 }, (_, i) => {
    const x = .62 + Math.sin(i * 4.3) * .24, z = (i / 25 - .5) * length * .83;
    return { p: [x, .18 + ground(x, z), z], s: [.024, .17 + i % 3 * .025, .026], r: [0, 0, -.2 + i % 5 * .1], c: i % 2 ? '#98a578' : '#afae81' };
  });
  return <group rotation={[0, baker ? -.49 : -.06, 0]}>
    <mesh geometry={sandGeometry} receiveShadow dispose={null}><meshStandardMaterial vertexColors roughness={.96} /></mesh>
    <Parts geometry={SPHERE} pieces={dunes} />
    <Parts pieces={grass} />
    <group position={[0, ground(0, 1.9), 0]}><Strokes color="#b49673" paths={[{ points: [[-.46, .08, 1.9], [-.15, .095, 1.85], [.24, .1, 1.98]], radius: .05 }, { points: [[.1, .1, 1.95], [.22, .11, 1.73]], radius: .025 }]} /></group>
    <ShoreBird position={[-.63, .046 + ground(-.63, .38), .38]} turn={-.9} />
    <ShoreBird position={[baker ? .1 : -.8, .046 + ground(baker ? .1 : -.8, -.13), -.13]} turn={.7} />
    <group position={[-.5, .051 + ground(-.5, -1.1), -1.1]} scale={.47}><CrabModel animated={animated} /></group>
    {baker && <Parts geometry={SPHERE} pieces={[{ p: [-.53, .17 + ground(-.53, -2.65), -2.65], s: [.47, .29, .47], c: '#9d9d88' }, { p: [-.05, .12 + ground(-.05, -2.8), -2.8], s: [.31, .24, .36], c: '#afb098' }]} />}
    {!baker && <Parts pieces={[{ p: [.98, .22, -.7], s: [.035, .44, .035], c: C.wood }, { p: [.98, .41, -.7], s: [.06, .22, .37], c: C.darkTeal }]} />}
  </group>;
}

function LandsEnd() {
  const rocks: Piece[] = [
    { p: [-.49, .09, -.51], s: [1.12, .29, .9], c: '#b2ac91' },
    { p: [-1.13, .01, -.7], s: [.59, .35, .61], c: '#939989' },
    { p: [.17, .075, -.68], s: [.79, .23, .63], c: '#a2a58d' },
    { p: [.26, .09, .21], s: [1.19, .12, .81], c: '#abb78b' },
  ];
  return <>
    <Parts geometry={SPHERE} pieces={rocks} />
    <Strokes color="#dbcba9" radius={.19} paths={[{ points: [[1.18, .13, .64], [.58, .16, .48], [.27, .16, .08], [-.35, .18, -.11], [-.63, .19, -.28]] }]} />
    <Parts pieces={[-.8, -.4, 0].map(x => ({ p: [x, .4, -.53], s: [.038, .45, .038], c: '#8f7656' }))} />
    <Strokes color="#a28a65" radius={.026} paths={[{ points: [[-.83, .59, -.53], [0, .59, -.53]] }, { points: [[-.83, .4, -.53], [0, .4, -.53]] }]} />
    <Strokes color="#7e6e50" paths={[{ points: [[.56, .15, -.59], [.55, .49, -.58], [.34, .86, -.51], [.16, 1.14, -.44]], radius: .085 }, { points: [[.46, .7, -.55], [.88, 1.06, -.65]], radius: .057 }, { points: [[.3, .88, -.5], [-.06, 1.03, -.47]], radius: .048 }]} />
    <Parts geometry={SPHERE} pieces={[{ p: [.12, 1.18, -.47], s: [.58, .16, .29], c: '#82966f' }, { p: [.89, 1.14, -.65], s: [.43, .14, .3], c: '#8d9f77' }, { p: [.48, 1.4, -.49], s: [.44, .13, .29], c: '#8ea278' }]} />
    <group position={[.77, .19, .14]} scale={.36}><BenchModel /></group>
    <ShoreBird position={[-.89, .22, -.72]} turn={-1.2} />
  </>;
}

export type SanFranciscoLandmarkKind = 'bridge' | 'presidio' | 'palace' | 'lombard' | 'pier' | 'alcatraz' | 'chinatown' | 'ferry' | 'park' | 'cable-car' | 'twin-peaks' | 'union-square' | 'castro' | 'skystar' | 'coit' | 'painted-ladies' | 'sutro' | 'japanese-tea-garden' | 'academy' | 'de-young' | 'ocean-beach' | 'baker-beach' | 'lands-end';

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
    case 'cable-car': return <CableCarModel />;
    case 'twin-peaks': return <TwinPeaks />;
    case 'union-square': return <UnionSquare />;
    case 'castro': return <Castro />;
    case 'skystar': return <SkyStar animated={animated} />;
    case 'coit': return <CoitTower />;
    case 'painted-ladies': return <group>{['#d6a28d', '#d8c693', '#a4b6a0', '#baafbe', '#b5c5c0', '#d5b394'].map((color, i) => <group key={color} position={[(i - 2.5) * 0.57, (5 - i) * 0.045, 0]}><HouseModel color={color} scale={0.54} variant={i} /></group>)}</group>;
    case 'sutro': return <SutroBaths />;
    case 'japanese-tea-garden': return <group scale={[1, 1.2, 1]}><JapaneseTeaGarden /></group>;
    case 'academy': return <group scale={[1, 1.65, 1]}><AcademyOfSciences /></group>;
    case 'de-young': return <group scale={[1, 1.2, 1]}><DeYoungMuseum /></group>;
    case 'ocean-beach': return <CoastalBeach animated={animated} />;
    case 'baker-beach': return <CoastalBeach baker animated={animated} />;
    case 'lands-end': return <LandsEnd />;
    default: return <HouseModel />;
  }
});
