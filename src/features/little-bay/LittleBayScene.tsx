/** @jsxImportSource react */
import { Component, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, OrthographicCamera, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

type Point = [number, number, number];
type Stop = { key: string; label: string; kind: 'event' | 'place' };

export type LittleBaySceneProps = {
  stops: Stop[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  running: boolean;
  timeOfDay: 'day' | 'golden';
  carriageCount: number;
  onReady?: () => void;
  onError?: () => void;
};

const GROUND = 0.47;
const TEAL = '#247e7c';
const CREAM = '#fff0d3';
const TRACK_X = 5.0;
const TRACK_Z = 3.25;
const STOP_POSITIONS: Point[] = [
  [-2.75, 2.1, -1.15], [0.1, 2.75, -1.5], [2.9, 1.8, -0.3],
  [1.75, 1.6, 1.55], [-1.5, 1.2, 1.65], [-4.65, 1.5, -0.25],
];
const COMPACT_STOP_POSITIONS: Point[] = [
  [-4.5, 1.8, -1], [-1, 3, -3], [4.5, 1.8, -0.8],
  [3, 1, 2.5], [-1, 1, 3], [-5.2, 1, 1.7],
];

function Block({ position = [0, 0, 0], size, color, rotation, round = false }: {
  position?: Point; size: Point; color: string; rotation?: Point; round?: boolean;
}) {
  return round ? (
    <RoundedBox args={size} radius={Math.min(...size) * 0.13} smoothness={2}
      position={position} rotation={rotation} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.88} />
    </RoundedBox>
  ) : (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

function Ball({ position, size, color }: { position: Point; size: Point; color: string }) {
  return <mesh position={position} scale={size} castShadow receiveShadow>
    <sphereGeometry args={[1, 12, 10]} />
    <meshStandardMaterial color={color} roughness={0.9} />
  </mesh>;
}

function Pole({ position, radius = 0.04, height, color = '#756655' }: {
  position: Point; radius?: number; height: number; color?: string;
}) {
  return <mesh position={position} castShadow receiveShadow>
    <cylinderGeometry args={[radius, radius * 1.12, height, 8]} />
    <meshStandardMaterial color={color} roughness={0.82} />
  </mesh>;
}

function Curve({ points, color, radius = 0.025 }: { points: Point[]; color: string; radius?: number }) {
  const geometry = useMemo(() => new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point))),
    Math.max(12, points.length * 3), radius, 5, false,
  ), [points, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} castShadow><meshStandardMaterial color={color} roughness={0.8} /></mesh>;
}

function Island() {
  const shape = useMemo(() => {
    const outline = new THREE.Shape();
    outline.moveTo(-6.1, 0);
    outline.bezierCurveTo(-6.5, 2.1, -4.5, 4.5, -1.8, 4.35);
    outline.bezierCurveTo(0.2, 5.05, 4.15, 4.3, 5.15, 2.7);
    outline.bezierCurveTo(6.65, 1.0, 6.25, -1.55, 4.9, -3.1);
    outline.bezierCurveTo(2.8, -4.35, 0.9, -4.65, -1.65, -4.0);
    outline.bezierCurveTo(-4.5, -4.25, -6.5, -2.3, -6.1, 0);
    return outline;
  }, []);
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.19, 0]} receiveShadow>
      <extrudeGeometry args={[shape, { depth: 0.44, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.19, bevelThickness: 0.13, curveSegments: 28 }]} />
      <meshStandardMaterial color="#dcc7a0" roughness={1} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.19, 0]} scale={[0.97, 0.97, 1]} receiveShadow>
      <extrudeGeometry args={[shape, { depth: 0.21, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.13, bevelThickness: 0.08, curveSegments: 28 }]} />
      <meshStandardMaterial color="#b6cba1" roughness={1} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND + 0.006, -0.15]} receiveShadow>
      <circleGeometry args={[1.55, 48]} />
      <meshStandardMaterial color="#e4d8ba" roughness={1} />
    </mesh>
    <Block position={[0, GROUND + 0.018, 1.22]} size={[0.9, 0.025, 2.1]} color="#e4d8ba" round />
  </>;
}

function Track() {
  const road = useMemo(() => {
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, TRACK_X + 0.42, TRACK_Z + 0.42, 0, Math.PI * 2, false, 0);
    const hole = new THREE.Path();
    hole.absellipse(0, 0, TRACK_X - 0.42, TRACK_Z - 0.42, 0, Math.PI * 2, true, 0);
    shape.holes.push(hole);
    return shape;
  }, []);
  const rails = useMemo(() => [-0.14, 0.14].map(offset => Array.from({ length: 81 }, (_, i) => {
    const angle = i / 80 * Math.PI * 2;
    return [Math.cos(angle) * (TRACK_X + offset), GROUND + 0.055, Math.sin(angle) * (TRACK_Z + offset)] as Point;
  })), []);
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND + 0.015, 0]} receiveShadow>
      <shapeGeometry args={[road, 80]} />
      <meshStandardMaterial color="#e2ceb0" roughness={1} />
    </mesh>
    {Array.from({ length: 76 }, (_, i) => {
      const angle = i / 76 * Math.PI * 2;
      return <Block key={i} position={[Math.cos(angle) * TRACK_X, GROUND + 0.031, Math.sin(angle) * TRACK_Z]}
        size={[0.4, 0.026, 0.062]} rotation={[0, -angle, 0]} color="#c1a282" />;
    })}
    {rails.map((points, i) => <Curve key={i} points={points} color="#968975" radius={0.018} />)}
  </group>;
}

function Window({ position, size = [0.28, 0.4, 0.05] }: { position: Point; size?: Point }) {
  return <group position={position}>
    <Block size={[size[0] + 0.07, size[1] + 0.07, size[2]]} color={CREAM} />
    <Block position={[0, 0, 0.027]} size={[size[0], size[1], size[2]]} color="#487f82" />
    <Block position={[0, 0, 0.058]} size={[0.025, size[1], 0.016]} color={CREAM} />
    <Block position={[0, 0.015, 0.058]} size={[size[0], 0.026, 0.016]} color={CREAM} />
  </group>;
}

function House({ position, color, width = 1.1, height = 1.35, rotation = 0, cafe = false }: {
  position: Point; color: string; width?: number; height?: number; rotation?: number; cafe?: boolean;
}) {
  const depth = 0.94;
  const roof = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2 - 0.12, 0);
    shape.lineTo(0, 0.51);
    shape.lineTo(width / 2 + 0.12, 0);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: depth + 0.2, bevelEnabled: false });
    geometry.translate(0, 0, -(depth + 0.2) / 2);
    return geometry;
  }, [width]);
  useEffect(() => () => roof.dispose(), [roof]);
  return <group position={position} rotation={[0, rotation, 0]}>
    <Block position={[0, 0.06, 0]} size={[width + 0.12, 0.12, depth + 0.16]} color="#d5c0a2" round />
    <Block position={[0, height / 2 + 0.1, 0]} size={[width, height, depth]} color={color} round />
    <mesh geometry={roof} position={[0, height + 0.1, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#b97556" roughness={0.92} />
    </mesh>
    <Block position={[width * 0.27, height + 0.52, -0.19]} size={[0.16, 0.36, 0.16]} color="#cc9473" />
    <Block position={[0, height + 0.075, depth / 2 + 0.035]} size={[width + 0.07, 0.075, 0.09]} color={CREAM} />
    <Block position={[0, 0.22, depth / 2 + 0.12]} size={[0.42, 0.12, 0.27]} color="#dbc7aa" />
    <Block position={[0, 0.45, depth / 2 + 0.029]} size={[0.27, 0.58, 0.05]} color="#466f68" round />
    <Ball position={[0.078, 0.43, depth / 2 + 0.063]} size={[0.018, 0.018, 0.018]} color="#e6bd65" />
    <Window position={[-width * 0.29, height * 0.69, depth / 2 + 0.035]} size={[0.25, 0.4, 0.045]} />
    <Window position={[width * 0.29, height * 0.69, depth / 2 + 0.035]} size={[0.25, 0.4, 0.045]} />
    <Block position={[0, height * 0.69 - 0.27, depth / 2 + 0.12]} size={[width * 0.82, 0.09, 0.2]} color="#bd815b" />
    {[0, 1, 2, 3].map(i => <Ball key={i} position={[-width * 0.3 + i * width * 0.2, height * 0.69 - 0.17, depth / 2 + 0.13]}
      size={[0.09, 0.075, 0.075]} color={i % 2 ? '#e8a396' : '#799665'} />)}
    {cafe && <group position={[0, 0.92, depth / 2 + 0.22]}>
      {Array.from({ length: 6 }, (_, i) => <Block key={i} position={[-width / 2 + (i + 0.5) * width / 6, 0, 0]}
        size={[width / 6, 0.06, 0.49]} rotation={[0.15, 0, 0]} color={i % 2 ? CREAM : '#d88665'} />)}
      <Block position={[0, -0.075, 0.245]} size={[width, 0.15, 0.035]} color="#d88665" />
    </group>}
  </group>;
}

function Tree({ position, size = 1, color = '#7f9e72', pine = false }: {
  position: Point; size?: number; color?: string; pine?: boolean;
}) {
  return <group position={position} scale={size}>
    <Pole position={[0, 0.43, 0]} height={0.86} radius={0.065} color="#907058" />
    {pine ? [0, 1, 2].map(i => <mesh key={i} position={[0, 0.67 + i * 0.34, 0]} castShadow receiveShadow>
      <coneGeometry args={[0.48 - i * 0.1, 0.79, 8]} />
      <meshStandardMaterial color={i % 2 ? '#64866a' : color} roughness={1} />
    </mesh>) : <>
      <Ball position={[0, 1.06, 0]} size={[0.49, 0.57, 0.42]} color={color} />
      <Ball position={[-0.24, 0.91, 0.11]} size={[0.32, 0.38, 0.3]} color={color} />
      <Ball position={[0.25, 1.02, -0.03]} size={[0.31, 0.39, 0.3]} color={color} />
    </>}
  </group>;
}

function Lamp({ position }: { position: Point }) {
  return <group position={position}>
    <Pole position={[0, 0.61, 0]} height={1.22} radius={0.025} color="#547e74" />
    <Block position={[0, 1.19, 0]} size={[0.23, 0.045, 0.2]} color="#547e74" round />
    <mesh position={[0, 1.08, 0]}>
      <boxGeometry args={[0.13, 0.2, 0.12]} />
      <meshStandardMaterial color="#fff2bd" emissive="#ffd28d" emissiveIntensity={0.4} roughness={0.6} />
    </mesh>
    <Pole position={[0, 0.035, 0]} height={0.07} radius={0.075} color="#547e74" />
  </group>;
}

function Bench({ position, rotation = 0 }: { position: Point; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    {[-0.25, 0.25].map(x => <Block key={x} position={[x, 0.16, 0]} size={[0.05, 0.3, 0.3]} color="#5a7968" />)}
    <Block position={[0, 0.3, 0]} size={[0.72, 0.065, 0.31]} color="#b88760" round />
    <Block position={[0, 0.51, -0.13]} size={[0.72, 0.23, 0.055]} color="#b88760" round />
  </group>;
}

function Market() {
  return <group position={[2.8, GROUND, 0.05]} rotation={[0, -0.38, 0]}>
    <Block position={[0, 0.36, 0]} size={[1.08, 0.65, 0.67]} color="#cba479" round />
    <Block position={[0, 0.74, 0]} size={[1.18, 0.1, 0.73]} color="#f7e2ba" />
    {[-0.5, 0.5].map(x => <Pole key={x} position={[x, 0.75, -0.25]} height={1.5} radius={0.028} color="#b0875d" />)}
    {Array.from({ length: 6 }, (_, i) => <Block key={i} position={[-0.6 + (i + 0.5) * 0.2, 1.4, 0]}
      size={[0.2, 0.1, 1]} rotation={[0.13, 0, 0]} color={i % 2 ? '#fbf0ce' : '#d2946c'} />)}
    {[-0.32, 0, 0.32].map((x, i) => <group key={x} position={[x, 0.83, 0.04]}>
      <Block size={[0.28, 0.1, 0.37]} color="#a67f52" />
      {[0, 1, 2].map(j => <Ball key={j} position={[(j % 2 - 0.5) * 0.1, 0.1, (j - 1) * 0.08]}
        size={[0.075, 0.072, 0.075]} color={['#d9834c', '#b7c46b', '#de9d83'][i]} />)}
    </group>)}
  </group>;
}

function Fountain() {
  return <group position={[-0.35, GROUND, 0.38]}>
    <mesh position={[0, 0.11, 0]} receiveShadow castShadow>
      <cylinderGeometry args={[0.61, 0.69, 0.22, 32]} />
      <meshStandardMaterial color="#d5c4aa" roughness={0.95} />
    </mesh>
    <mesh position={[0, 0.235, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.53, 32]} />
      <meshStandardMaterial color="#78b8b8" roughness={0.27} metalness={0.1} />
    </mesh>
    <Pole position={[0, 0.46, 0]} height={0.45} radius={0.105} color="#d9cdb4" />
    <mesh position={[0, 0.7, 0]} castShadow>
      <sphereGeometry args={[0.32, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color="#c3bba1" roughness={0.9} />
    </mesh>
    <Ball position={[0, 0.96, 0]} size={[0.09, 0.14, 0.09]} color="#83c3bf" />
  </group>;
}

function SuspensionBridge() {
  const suspension = useMemo(() => [-0.22, 0.22].map(z => [
    [-5.35, 0.65, z], [-3.05, 2.5, z], [0, 1.2, z], [3.05, 2.5, z], [5.35, 0.65, z],
  ] as Point[]), []);
  return <group position={[-0.55, 0, -5.1]} rotation={[0, -0.09, 0]}>
    <Block position={[0, 0.69, 0]} size={[10.75, 0.13, 0.63]} color="#b9664d" />
    <Block position={[0, 0.775, 0]} size={[10.7, 0.055, 0.48]} color="#d2a589" />
    {[-3.05, 3.05].map(x => <group key={x} position={[x, 0, 0]}>
      {[-0.29, 0.29].map(z => <Block key={z} position={[0, 1.29, z]} size={[0.16, 2.65, 0.14]} color="#c16e52" />)}
      {[1.25, 2.22].map(y => <Block key={y} position={[0, y, 0]} size={[0.15, 0.12, 0.72]} color="#b85c45" />)}
      <Block position={[0, 0.02, 0]} size={[0.53, 0.17, 0.95]} color="#c8c1a8" round />
    </group>)}
    {suspension.map((points, i) => <Curve key={i} points={points} color="#b7614b" radius={0.034} />)}
    {Array.from({ length: 19 }, (_, i) => {
      const x = -2.8 + i * 0.31;
      const height = 0.46 + (x / 3.05) ** 2 * 1.3;
      return [-0.23, 0.23].map(z => <Pole key={`${i}-${z}`} position={[x, 0.8 + height / 2, z]}
        height={height} radius={0.012} color="#bc745a" />);
    })}
  </group>;
}

function DockAndBoat() {
  return <group position={[-3.9, 0.13, 3.45]} rotation={[0, -0.45, 0]}>
    {Array.from({ length: 12 }, (_, i) => <Block key={i} position={[0, 0.05, i * 0.14]}
      size={[0.85, 0.1, 0.12]} color={i % 2 ? '#c49e76' : '#ccaa84'} />)}
    {[-0.38, 0.38].map(x => [0.1, 1.42].map(z => <Pole key={`${x}-${z}`} position={[x, 0.17, z]} height={0.7} radius={0.065} color="#927358" />))}
    <group position={[1.08, -0.02, 1.01]} rotation={[0, 0.15, 0]}>
      <mesh scale={[0.47, 0.25, 0.91]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#f6e7cd" roughness={0.9} />
      </mesh>
      <Block position={[0, 0.15, 0]} size={[0.56, 0.1, 1.09]} color="#d8b58a" round />
      <Block position={[0, 0.36, -0.14]} size={[0.43, 0.38, 0.47]} color={TEAL} round />
      <Block position={[0, 0.57, -0.14]} size={[0.57, 0.07, 0.6]} color={CREAM} round />
      <Block position={[0, 0.42, 0.11]} size={[0.29, 0.16, 0.025]} color="#c5dfd7" />
      <Pole position={[0, 0.92, -0.23]} height={0.7} radius={0.018} color="#7d8d7b" />
      <Block position={[0.11, 1.15, -0.23]} size={[0.21, 0.12, 0.02]} color="#e1a371" />
    </group>
  </group>;
}

function Otter() {
  return <group position={[0, 0.67, 0.35]}>
    <Ball position={[0, 0.07, 0]} size={[0.17, 0.21, 0.14]} color="#957058" />
    <Ball position={[0, 0.27, 0.01]} size={[0.2, 0.18, 0.17]} color="#957058" />
    <Ball position={[-0.165, 0.39, 0]} size={[0.06, 0.063, 0.047]} color="#957058" />
    <Ball position={[0.165, 0.39, 0]} size={[0.06, 0.063, 0.047]} color="#957058" />
    <Ball position={[0, 0.2, 0.145]} size={[0.135, 0.095, 0.053]} color="#efdbc2" />
    {[-0.078, 0.078].map(x => <Ball key={x} position={[x, 0.29, 0.155]} size={[0.02, 0.022, 0.015]} color="#293d38" />)}
    <Ball position={[0, 0.24, 0.193]} size={[0.036, 0.025, 0.02]} color="#293d38" />
    <Block position={[0, 0.08, 0.138]} size={[0.31, 0.075, 0.04]} color="#6db5a3" round />
    <Ball position={[-0.18, 0.04, 0.11]} size={[0.065, 0.12, 0.063]} color="#957058" />
    <Ball position={[0.18, 0.04, 0.11]} size={[0.065, 0.12, 0.063]} color="#957058" />
  </group>;
}

function CableCarModel({ trailer = false, color = TEAL }: { trailer?: boolean; color?: string }) {
  return <group>
    <Block position={[0, 0.13, 0]} size={[0.66, 0.17, trailer ? 0.75 : 1.13]} color="#555e51" round />
    {[-0.3, 0.3].map(x => [-0.31, 0.31].map(z => <mesh key={`${x}-${z}`} position={[x, 0.1, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.12, 0.12, 0.1, 12]} /><meshStandardMaterial color="#45574d" roughness={0.95} />
    </mesh>))}
    <Block position={[0, 0.37, 0]} size={[0.66, 0.4, trailer ? 0.74 : 1.06]} color={color} round />
    <Block position={[0, 0.57, 0]} size={[0.7, 0.055, trailer ? 0.78 : 1.1]} color={CREAM} />
    {trailer ? <>
      <Block position={[0, 0.62, -0.26]} size={[0.57, 0.2, 0.075]} color="#dfb970" round />
      <Block position={[0, 0.6, 0.22]} size={[0.57, 0.16, 0.075]} color="#dfb970" round />
      <Ball position={[0, 0.68, 0]} size={[0.18, 0.12, 0.2]} color="#e9c4a0" />
    </> : <>
      {[-0.29, 0.29].map(x => [-0.45, 0.05].map(z => <Pole key={`${x}-${z}`} position={[x, 0.83, z]} height={0.54} radius={0.023} color={CREAM} />))}
      <Block position={[0, 1.1, -0.19]} size={[0.83, 0.15, 0.99]} color={TEAL} round />
      <Block position={[0, 1.19, -0.19]} size={[0.6, 0.08, 0.55]} color="#76a58e" round />
      <Block position={[0, 0.87, -0.48]} size={[0.55, 0.34, 0.04]} color="#b3d1bc" />
      <Block position={[0, 0.87, -0.5]} size={[0.036, 0.38, 0.04]} color={CREAM} />
      <Block position={[0, 0.72, -0.12]} size={[0.48, 0.16, 0.17]} color="#c59d66" round />
      <Otter />
      <mesh position={[0, 0.42, 0.565]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.074, 0.074, 0.05, 16]} />
        <meshStandardMaterial color="#fff0ba" emissive="#f3ce7e" emissiveIntensity={0.3} />
      </mesh>
      <Block position={[0, 0.23, 0.65]} size={[0.55, 0.05, 0.24]} color="#ad9974" round />
    </>}
    <Block position={[0, 0.33, (trailer ? 0.75 : 1.06) / 2 + 0.02]} size={[0.36, 0.055, 0.027]} color="#e8c582" />
  </group>;
}

function CableCar({ running, carriageCount }: { running: boolean; carriageCount: number }) {
  const lead = useRef<THREE.Group>(null);
  const trailers = useRef<Array<THREE.Group | null>>([]);
  const angle = useRef(1.72);
  const count = Math.max(0, Math.min(3, carriageCount));
  useFrame((_, delta) => {
    if (running) angle.current += Math.min(delta, 0.05) * 0.125;
    [lead.current, ...trailers.current.slice(0, count)].forEach((car, index) => {
      if (!car) return;
      const theta = angle.current - index * 0.265;
      car.position.set(Math.cos(theta) * TRACK_X, GROUND + 0.072, Math.sin(theta) * TRACK_Z);
      car.rotation.y = Math.atan2(-TRACK_X * Math.sin(theta), TRACK_Z * Math.cos(theta));
    });
  });
  return <>
    <group ref={lead}><CableCarModel /></group>
    {Array.from({ length: count }, (_, i) => <group key={i} ref={node => { trailers.current[i] = node; }}>
      <CableCarModel trailer color={['#d49469', '#91a98a', '#d7b85f'][i]} />
    </group>)}
  </>;
}

function StopMarker({ stop, index, active, onSelect }: { stop: Stop; index: number; active: boolean; onSelect: (key: string) => void }) {
  const compact = useThree(state => state.size.width < 480);
  const position = (compact ? COMPACT_STOP_POSITIONS : STOP_POSITIONS)[index];
  return <group position={position}>
    <mesh position={[0, -0.3, 0]}>
      <cylinderGeometry args={[0.019, 0.019, 0.55, 8]} />
      <meshStandardMaterial color={active ? '#cf9056' : '#b19671'} />
    </mesh>
    <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <button type="button" onClick={() => onSelect(stop.key)} title={stop.label} aria-label={stop.label}
        aria-pressed={active} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: compact ? 0 : 7,
          padding: compact ? 0 : active ? '5px 11px 5px 5px' : 4,
          border: compact ? 'none' : '1px solid rgba(255,255,255,.85)', borderRadius: 100,
          background: compact ? 'transparent' : active ? '#236f69' : '#fff9ed',
          color: active ? '#fff9ed' : '#326b60', boxShadow: compact ? 'none' : active ? '0 5px 16px #254d4530' : '0 3px 10px #455e3928',
          cursor: 'pointer', pointerEvents: 'auto', fontFamily: 'inherit', fontSize: 11, fontWeight: 650,
          whiteSpace: 'nowrap', minWidth: 44, minHeight: 44,
          transform: active ? 'translateY(-3px)' : undefined, transition: 'background .2s, transform .2s',
        }}>
        <span style={{ display: 'grid', placeItems: 'center', width: compact ? 30 : 26, height: compact ? 30 : 26, flexShrink: 0,
          borderRadius: '50%', background: compact ? active ? '#236f69' : '#fff9ed' : active ? '#fff5d91f' : '#e4ecdc',
          border: compact ? '2px solid #fff9ed' : undefined, boxSizing: 'border-box',
          boxShadow: compact ? '0 2px 7px #455e3928' : undefined, fontSize: 12 }}>{index + 1}</span>
        {active && !compact && <span style={{ maxWidth: 133, overflow: 'hidden', textOverflow: 'ellipsis' }}>{stop.label}</span>}
      </button>
    </Html>
  </group>;
}

function Waterfront() {
  const waves = useMemo(() => [
    [[-5.8, -0.2, 4.8], [-4.8, -0.2, 5.25], [-3.4, -0.2, 5.4]],
    [[-5.1, -0.2, 5.8], [-4.2, -0.2, 6.08], [-3.2, -0.2, 6.1]],
    [[3.9, -0.2, 4.7], [4.8, -0.2, 4.25], [5.5, -0.2, 3.75]],
    [[5.4, -0.2, 4.75], [6.0, -0.2, 4.25], [6.5, -0.2, 3.7]],
    [[-7.5, -0.2, -0.4], [-7.65, -0.2, 0.45], [-7.2, -0.2, 1.1]],
  ] as Point[][], []);
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.24, 0]} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial color="#a5cec2" roughness={0.62} metalness={0.04} />
    </mesh>
    {waves.map((points, i) => <Curve key={i} points={points} color="#d0e6d6" radius={0.028} />)}
    {[[-6.3, 0.04, 1.9], [-6, 0.07, 2.3], [5.7, 0.03, 1.8], [5.8, 0, 1.2]].map((position, i) =>
      <Ball key={i} position={position as Point} size={[0.34, 0.2, 0.28]} color={i % 2 ? '#babca5' : '#c8c9ad'} />)}
  </>;
}

function SceneContent(props: LittleBaySceneProps & { reducedMotion: boolean }) {
  const { size, gl } = useThree();
  const hasReportedReady = useRef(false);
  const zoom = Math.min(size.width / 16.4, size.height / 13.0);
  const shadowSize = size.width < 640 ? 1024 : 2048;
  const golden = props.timeOfDay === 'golden';
  const onError = props.onError;
  useEffect(() => {
    const canvas = gl.domElement;
    // Reserve one-finger vertical gestures for scrolling the page on phones.
    canvas.style.setProperty('touch-action', 'pan-y');
    const lost = (event: Event) => { event.preventDefault(); onError?.(); };
    canvas.addEventListener('webglcontextlost', lost, false);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [gl, onError]);
  useFrame(() => {
    if (!hasReportedReady.current) {
      hasReportedReady.current = true;
      props.onReady?.();
    }
  });
  return <>
    <OrthographicCamera makeDefault position={[11, 12, 15]} near={0.1} far={100} zoom={zoom} />
    <color attach="background" args={[golden ? '#e6d8bc' : '#d9e8da']} />
    <fog attach="fog" args={[golden ? '#e6d8bc' : '#d9e8da', 35, 75]} />
    <ambientLight intensity={golden ? 0.9 : 1.1} color={golden ? '#ffe5bf' : '#fff3db'} />
    <hemisphereLight args={['#fff5d9', '#a6beac', 0.85]} />
    <directionalLight position={golden ? [-9, 9, 6] : [-5, 12, 7]} intensity={golden ? 3 : 2.1}
      color={golden ? '#ffc886' : '#fff5d9'} castShadow shadow-mapSize={[shadowSize, shadowSize]}
      shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10}
      shadow-camera-near={0.5} shadow-camera-far={40} shadow-bias={-0.0005} shadow-normalBias={0.03} />
    <directionalLight position={[8, 5, -8]} intensity={0.6} color="#c7e9df" />
    <Waterfront />
    <SuspensionBridge />
    <Island />
    <Track />
    <House position={[-2.5, GROUND, -1.12]} color="#7fa6a5" width={1.02} height={1.33} rotation={0.04} cafe />
    <House position={[-1.3, GROUND, -1.56]} color="#efbc94" width={1.03} height={1.65} />
    <House position={[-0.05, GROUND, -1.67]} color="#d3bb7e" width={1.1} height={1.95} />
    <House position={[1.21, GROUND, -1.49]} color="#a9bbab" width={1.08} height={1.53} rotation={-0.035} />
    <House position={[2.35, GROUND, -1.06]} color="#e6aa94" width={0.88} height={1.28} rotation={-0.17} />
    <Fountain />
    <Market />
    <DockAndBoat />
    <Bench position={[-1.63, GROUND, 0.62]} rotation={Math.PI / 2} />
    <Bench position={[0.9, GROUND, 0.28]} rotation={-Math.PI / 2} />
    <Bench position={[2.06, GROUND, 2.02]} rotation={-0.45} />
    {([
      [-4.55, 0.0, 1.2, 1.12, '#7c9b76', true], [-4.15, 0, 0.35, 0.9, '#839d79', true],
      [-4.5, 0, -1.18, 1.2, '#9aaf79', false], [-3.75, 0, -2.02, 0.82, '#c4b878', false],
      [3.45, 0, -1.4, 1.1, '#839d76', false], [4.33, 0, 0.45, 0.85, '#b8bd83', false],
      [3.5, 0, 1.48, 0.88, '#9fb582', false], [1.22, 0, 2.15, 0.74, '#d2bc7e', false],
      [-1.6, 0, 2.0, 0.76, '#91ad78', false], [-2.9, 0, 1.15, 0.93, '#b1bb80', false],
      [-2.84, 0, -3.5, 0.85, '#769373', true], [2.1, 0, -3.6, 0.92, '#829d78', true],
    ] as const).map(([x, , z, size, color, pine], i) => <Tree key={i} position={[x, GROUND, z]} size={size} color={color} pine={pine} />)}
    {[[-3.45, GROUND, 0.22], [2.55, GROUND, 1.8], [0.8, GROUND, -0.5], [-0.7, GROUND, 2.3]].map((position, i) =>
      <Lamp key={i} position={position as Point} />)}
    {Array.from({ length: 7 }, (_, i) => <group key={i} position={[-2.1 + i * 0.21, GROUND, 2.29]}>
      <Ball position={[0, 0.09, 0]} size={[0.13, 0.13, 0.11]} color={i % 2 ? '#cbb377' : '#9aad75'} />
      <Ball position={[0.02, 0.19, 0]} size={[0.038, 0.05, 0.038]} color="#e9a394" />
    </group>)}
    <CableCar running={props.running} carriageCount={props.carriageCount} />
    {props.stops.slice(0, 6).map((stop, index) => <StopMarker key={stop.key} stop={stop} index={index}
      active={stop.key === props.selectedKey} onSelect={props.onSelect} />)}
    <OrbitControls target={[0, 0.3, 0]} enablePan={false} enableZoom={false} enableDamping={!props.reducedMotion}
      minPolarAngle={0.58} maxPolarAngle={1.01} minAzimuthAngle={-0.7} maxAzimuthAngle={0.95}
      rotateSpeed={0.45} touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }} />
  </>;
}

class SceneBoundary extends Component<{ children: ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function LittleBayScene(props: LittleBaySceneProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return <SceneBoundary onError={props.onError}>
    <Canvas orthographic shadows={{ enabled: true, type: THREE.PCFShadowMap }} dpr={[1, 1.6]} frameloop={props.running ? 'always' : 'demand'}
      camera={{ position: [11, 12, 15], near: 0.1, far: 100, zoom: 45 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%', touchAction: 'pan-y' }}
      fallback={<span>Explore the places below to plan your day.</span>}>
      <SceneContent {...props} reducedMotion={reducedMotion} />
    </Canvas>
  </SceneBoundary>;
}
