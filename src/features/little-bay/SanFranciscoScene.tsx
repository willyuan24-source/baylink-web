import { Component, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BayBayModel, BuggyModel, CrabModel, LandmarkModel, SealionsModel } from './SanFranciscoModels';
import type { BayBayLocomotion } from './SanFranciscoModels';
import { SF_CITY_RINGS, SF_LANDMARKS, SF_MAJOR_STREET_LABELS, SF_NEIGHBORHOODS, SF_ROADS, isOnLand, nearestRoad, terrainHeight } from './sf-world';
import { containsPoint, createRoadGeometry, createShoreGeometry, createTerrainGeometry, mapHash } from './san-francisco-geometry';
import type { MapPoint } from './san-francisco-geometry';
import { createSfDrivingSpawn, stepSfVehicle } from './sf-driving';
import type { SfDriveInput, SfVehicleState as VehicleState } from './sf-driving';
import { createSfWalkerState, stepSfWalker } from './sf-walking';
import { adjustSfCamera, createSfCameraGestureGuard, observeSfCameraGestures, SF_FOLLOW_CAMERA_LIMITS, SF_OVERVIEW_CAMERA_LIMITS } from './sf-camera';
import type { SfCameraCommand } from './sf-camera';

export type { SfDriveInput } from './sf-driving';
export type SanFranciscoSceneProps = {
  selectedId: string | null;
  onSelect: (id: string) => void;
  mode: 'overview' | 'walk' | 'drive';
  running: boolean;
  timeOfDay: 'day' | 'golden';
  driveInput: MutableRefObject<SfDriveInput>;
  resetToken: number;
  startId: string;
  locale?: 'en' | 'zh';
  onArrival?: (id: string | null) => void;
  onStreetChange?: (name: string) => void;
  onReady?: () => void;
  onError?: () => void;
  cameraCommand?: SfCameraCommand;
};

type Building = { x: number; z: number; y: number; angle: number; width: number; depth: number; height: number; color: string };
type CityTree = { x: number; z: number; y: number; scale: number };
const PALETTE = ['#d9b995', '#bdc8ad', '#8eb4ad', '#e5c797', '#d3a895', '#d6cfb1', '#a8beb0'];
const EMPTY_INPUT: SfDriveInput = { forward: false, backward: false, left: false, right: false };
const PARK_NAMES = new Set(['Golden Gate Park', 'Presidio', 'Lincoln Park', 'McLaren Park']);
function onLand(point: MapPoint) { return SF_CITY_RINGS.some(ring => containsPoint(point, ring)); }
function inPark(point: MapPoint) {
  return SF_NEIGHBORHOODS.some(neighborhood => PARK_NAMES.has(neighborhood.name)
    && neighborhood.rings.some(ring => containsPoint(point, ring)));
}

/** Houses use unoccupied roadside lots; these are scenery, not invented business listings. */
function makeCityScenery() {
  const buildings: Building[] = []; const trees: CityTree[] = []; const occupied = new Set<string>();
  for (const road of SF_ROADS) for (let index = 1; index < road.path.length; index++) {
    const a = road.path[index - 1]; const b = road.path[index];
    const dx = b[0] - a[0]; const dz = b[1] - a[1]; const length = Math.hypot(dx, dz);
    if (length < .55 || road.width > .95) continue;
    const angle = Math.atan2(dx, dz);
    for (let along = .35; along < length; along += .82) for (const side of [-1, 1]) {
      const offset = road.width / 2 + .43;
      const x = a[0] + dx * (along / length) + dz / length * offset * side;
      const z = a[1] + dz * (along / length) - dx / length * offset * side;
      const key = `${Math.round(x / .62)}:${Math.round(z / .62)}`;
      if (occupied.has(key) || !onLand([x, z]) || inPark([x, z])) continue;
      if (SF_LANDMARKS.some(landmark => Math.hypot(landmark.position[0] - x, landmark.position[1] - z) < (landmark.kind === 'bridge' ? 4.5 : 2.5))) continue;
      const nearby = nearestRoad(x, z);
      if (!nearby || nearby.distance < nearby.road.width / 2 + .22) continue;
      occupied.add(key);
      const random = mapHash(x, z);
      const downtown = x > 27 && z < -9 && z > -35;
      buildings.push({ x, z, y: terrainHeight(x, z), angle: angle - side * Math.PI / 2, width: .43 + random * .15, depth: .43 + random * .15,
        height: downtown ? .85 + random * 3.2 : .55 + random * .85, color: PALETTE[Math.floor(random * PALETTE.length)] });
      if (random > .72) trees.push({ x: x - dz / length * .22 * side, z: z + dx / length * .22 * side, y: terrainHeight(x, z), scale: .27 + random * .15 });
      if (buildings.length >= 8500) break;
    }
  }
  for (const neighborhood of SF_NEIGHBORHOODS.filter(item => PARK_NAMES.has(item.name))) {
    const points = neighborhood.rings.flat();
    const minX = Math.min(...points.map(p => p[0])); const maxX = Math.max(...points.map(p => p[0]));
    const minZ = Math.min(...points.map(p => p[1])); const maxZ = Math.max(...points.map(p => p[1]));
    for (let x = minX; x < maxX; x += 1.9) for (let z = minZ; z < maxZ; z += 1.9) {
      const tx = x + mapHash(x, z) * 1.1; const tz = z + mapHash(x, z, 1) * 1.1;
      if (!neighborhood.rings.some(ring => containsPoint([tx, tz], ring))) continue;
      if (SF_LANDMARKS.some(landmark => Math.hypot(landmark.position[0] - tx, landmark.position[1] - tz) < 2.8)) continue;
      const nearby = nearestRoad(tx, tz);
      if (nearby && nearby.distance < nearby.road.width / 2 + .35) continue;
      trees.push({ x: tx, z: tz, y: terrainHeight(tx, tz), scale: .7 + mapHash(x, z, 2) * .6 });
    }
  }
  return { buildings, trees };
}

let cityScenery: ReturnType<typeof makeCityScenery> | undefined;

function ResidentialBlocks() {
  const { buildings, trees } = useMemo(() => cityScenery ??= makeCityScenery(), []);
  const softBox = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 1, .065), []);
  const walls = useRef<THREE.InstancedMesh>(null); const roofs = useRef<THREE.InstancedMesh>(null);
  const windows = useRef<THREE.InstancedMesh>(null); const frames = useRef<THREE.InstancedMesh>(null);
  const eaves = useRef<THREE.InstancedMesh>(null); const trunks = useRef<THREE.InstancedMesh>(null); const canopies = useRef<THREE.InstancedMesh>(null);
  useEffect(() => () => softBox.dispose(), [softBox]);
  useEffect(() => {
    const object = new THREE.Object3D(); const color = new THREE.Color();
    buildings.forEach((building, index) => {
      object.position.set(building.x, building.y + building.height / 2 + .04, building.z);
      object.rotation.set(0, building.angle, 0); object.scale.set(building.width, building.height, building.depth); object.updateMatrix();
      walls.current?.setMatrixAt(index, object.matrix); walls.current?.setColorAt(index, color.set(building.color));
      object.position.y = building.y + building.height + .13; object.scale.set(building.width * 1.06, .2, building.depth * 1.08); object.updateMatrix();
      roofs.current?.setMatrixAt(index, object.matrix); roofs.current?.setColorAt(index, color.set(index % 4 ? '#a38773' : '#63887e'));
      object.position.y = building.y + building.height + .025; object.scale.set(building.width * 1.1, .065, building.depth * 1.12); object.updateMatrix(); eaves.current?.setMatrixAt(index, object.matrix);
      const forward = new THREE.Vector3(Math.sin(building.angle), 0, Math.cos(building.angle));
      object.position.set(building.x + forward.x * (building.depth / 2 + .012), building.y + building.height * .57, building.z + forward.z * (building.depth / 2 + .012));
      object.scale.set(building.width * .76, Math.min(.28, building.height * .34), .022); object.updateMatrix(); frames.current?.setMatrixAt(index, object.matrix);
      object.position.addScaledVector(forward, .014);
      object.scale.set(building.width * .64, Math.min(.24, building.height * .3), .015); object.updateMatrix(); windows.current?.setMatrixAt(index, object.matrix);
    });
    trees.forEach((tree, index) => {
      object.rotation.set(0, 0, 0); object.position.set(tree.x, tree.y + tree.scale * .34, tree.z);
      object.scale.set(tree.scale * .09, tree.scale * .65, tree.scale * .09); object.updateMatrix(); trunks.current?.setMatrixAt(index, object.matrix);
      object.position.y = tree.y + tree.scale * .89; object.scale.set(tree.scale * .5, tree.scale * .68, tree.scale * .46); object.updateMatrix();
      canopies.current?.setMatrixAt(index, object.matrix); canopies.current?.setColorAt(index, color.set(index % 3 ? '#87a47d' : '#adc092'));
    });
    for (const mesh of [walls, roofs, windows, frames, eaves, trunks, canopies]) if (mesh.current) {
      mesh.current.instanceMatrix.needsUpdate = true; if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
      mesh.current.computeBoundingSphere();
    }
  }, [buildings, trees]);
  return <group>
    <instancedMesh ref={walls} args={[softBox, undefined, buildings.length]} castShadow receiveShadow><meshStandardMaterial roughness={.96} /></instancedMesh>
    <instancedMesh ref={roofs} args={[undefined, undefined, buildings.length]} castShadow><boxGeometry /><meshStandardMaterial roughness={.94} /></instancedMesh>
    <instancedMesh ref={eaves} args={[undefined, undefined, buildings.length]}><boxGeometry /><meshStandardMaterial color="#f4e5c7" roughness={.94} /></instancedMesh>
    <instancedMesh ref={frames} args={[undefined, undefined, buildings.length]}><boxGeometry /><meshStandardMaterial color="#f4e5c7" roughness={.94} /></instancedMesh>
    <instancedMesh ref={windows} args={[undefined, undefined, buildings.length]}><boxGeometry /><meshStandardMaterial color="#437b7c" roughness={.65} /></instancedMesh>
    <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]} castShadow><cylinderGeometry args={[1, 1.2, 1, 5]} /><meshStandardMaterial color="#a28265" roughness={1} /></instancedMesh>
    <instancedMesh ref={canopies} args={[undefined, undefined, trees.length]} castShadow><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial roughness={1} /></instancedMesh>
  </group>;
}

function CityGround({ onWalkTo }: { onWalkTo: (x: number, z: number) => void }) {
  const geometries = useMemo(() => ({
    land: createTerrainGeometry(SF_CITY_RINGS, terrainHeight), shore: createShoreGeometry(SF_CITY_RINGS, terrainHeight),
    roads: createRoadGeometry(SF_ROADS, terrainHeight, 0, .06), curbs: createRoadGeometry(SF_ROADS, terrainHeight, .065, .04),
    parks: createTerrainGeometry(SF_NEIGHBORHOODS.filter(item => PARK_NAMES.has(item.name)).flatMap(item => item.rings), terrainHeight, .025),
  }), []);
  useEffect(() => () => Object.values(geometries).forEach(geometry => geometry.dispose()), [geometries]);
  return <group onClick={event => { if (event.delta < 5) { event.stopPropagation(); onWalkTo(event.point.x, event.point.z); } }}>
    <mesh geometry={geometries.land} receiveShadow><meshStandardMaterial color="#d5cfad" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={geometries.shore}><meshStandardMaterial color="#d2bfa0" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={geometries.parks} receiveShadow><meshStandardMaterial color="#a5bf8e" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={geometries.curbs} receiveShadow><meshStandardMaterial color="#e7dfc7" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={geometries.roads} receiveShadow><meshStandardMaterial color="#aeb7aa" roughness={1} side={THREE.DoubleSide} /></mesh>
  </group>;
}

function BayWater({ running }: { running: boolean }) {
  const foam = useRef<THREE.Group>(null);
  const waves = useRef<THREE.InstancedMesh>(null);
  const wavePositions = useMemo(() => {
    const points: [number, number, number][] = [];
    for (let x = -95; x <= 95; x += 5.8) for (let z = -95; z <= 80; z += 6.1) {
      const wx = x + mapHash(x, z) * 3; const wz = z + mapHash(x, z, 2) * 3;
      if (!onLand([wx, wz])) points.push([wx, -.38, wz]);
    }
    return points;
  }, []);
  useEffect(() => {
    const object = new THREE.Object3D();
    wavePositions.forEach((position, index) => {
      object.position.set(...position); object.rotation.set(-Math.PI / 2, 0, index % 2 * .05);
      object.scale.set(.6 + index % 4 * .3, .035, 1); object.updateMatrix(); waves.current?.setMatrixAt(index, object.matrix);
    });
    if (waves.current) { waves.current.instanceMatrix.needsUpdate = true; waves.current.computeBoundingSphere(); }
  }, [wavePositions]);
  useFrame(state => { if (foam.current && running) foam.current.position.y = Math.sin(state.clock.elapsedTime * .6) * .035; });
  const pier = SF_LANDMARKS.find(item => item.id === 'pier');
  const palace = SF_LANDMARKS.find(item => item.id === 'palace');
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.42, 0]} receiveShadow><planeGeometry args={[1200, 1200]} /><meshStandardMaterial color="#86b9b3" roughness={.44} metalness={.03} /></mesh>
    <group ref={foam}><instancedMesh ref={waves} args={[undefined, undefined, wavePositions.length]}>
      <planeGeometry /><meshBasicMaterial color="#cbe0cd" transparent opacity={.45} />
    </instancedMesh></group>
    {pier && <group position={[pier.position[0] + 1.5, -.18, pier.position[1] - 2]} scale={.85}><SealionsModel /></group>}
    {pier && <group position={[pier.position[0] - .8, -.25, pier.position[1] - 2.5]} rotation={[0, -.3, Math.PI / 9]} scale={.4}><BayBayModel /></group>}
    {palace && <group position={[palace.position[0] + 1.8, .12, palace.position[1] - 2]} scale={.45}><CrabModel /></group>}
  </>;
}

function LandmarkMarker({ id, active, overview, onSelect, locale }: { id: string; active: boolean; overview: boolean; onSelect: (id: string) => void; locale: string }) {
  const landmark = SF_LANDMARKS.find(item => item.id === id)!;
  const { size } = useThree();
  const named = active || (overview && (id === 'bridge' || id === 'park' || (id === 'pier' && size.width >= 600)));
  const name = locale === 'en' ? landmark.titleEn : landmark.title;
  return <Html center position={[0, 3.7, 0]} zIndexRange={named ? [18, 16] : [15, 0]} style={{ pointerEvents: 'none' }}>
    <button type="button" onClick={() => onSelect(id)} aria-label={locale === 'en' ? landmark.titleEn : landmark.title} aria-pressed={active} title={name}
      className={`sf-world-marker${active ? ' is-active' : ''}`} style={{
        minWidth: 44, minHeight: 44, display: 'grid', placeItems: 'center', border: active ? '2px solid #fff8e7' : 'none', borderRadius: 30, padding: named ? '7px 13px' : 10,
        background: active ? '#296f65' : named ? '#fffaed' : 'transparent', color: active ? '#fff9e8' : '#30695f', pointerEvents: 'auto',
        boxShadow: active ? '0 3px 12px #314f3930' : 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'inherit',
      }}>{named ? name : <span style={{ display: 'grid', placeItems: 'center', width: 23, height: 23, border: '2px solid #fff8e7', background: '#fffaed', borderRadius: '50%', boxShadow: '0 2px 6px #314f3920', fontSize: 9 }}>◆</span>}</button>
  </Html>;
}

function Landmarks({ selectedId, onSelect, running, locale }: Pick<SanFranciscoSceneProps, 'selectedId' | 'onSelect' | 'running' | 'locale'>) {
  return <group>{SF_LANDMARKS.map(landmark => <group key={landmark.id} position={[landmark.position[0], terrainHeight(...landmark.position) + .08, landmark.position[1]]}
    rotation={[0, landmark.kind === 'bridge' ? -.28 : 0, 0]}>
    <LandmarkModel kind={landmark.id} animated={running} />
    <LandmarkMarker id={landmark.id} active={selectedId === landmark.id} overview={!selectedId} onSelect={onSelect} locale={locale ?? 'zh'} />
  </group>)}</group>;
}

function StreetNames({ selectedId, locale }: { selectedId: string | null; locale: string }) {
  const landmark = SF_LANDMARKS.find(item => item.id === selectedId);
  if (!landmark) return null;
  return <group>{SF_MAJOR_STREET_LABELS.filter(label => Math.hypot(label.point[0] - landmark.position[0], label.point[1] - landmark.position[1]) < 16).slice(0, 4).map(label =>
    <Html key={label.name} center position={[label.point[0], terrainHeight(...label.point) + .18, label.point[1]]} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <span style={{ display: 'block', borderRadius: 5, padding: '3px 7px', color: '#5a6d5e', fontSize: 10, letterSpacing: '.06em', background: '#fff9e7b8', whiteSpace: 'nowrap', textTransform: 'uppercase' }} lang={locale}>{label.name}</span>
    </Html>)}</group>;
}

function CityPlayer({ vehicleRef, destinationRef, props }: { vehicleRef: MutableRefObject<VehicleState>; destinationRef: MutableRefObject<{ x: number; z: number } | null>; props: SanFranciscoSceneProps }) {
  const { startId, resetToken, running, mode, driveInput: driveInputRef, locale, onArrival: arrivalCallback, onStreetChange } = props;
  const group = useRef<THREE.Group>(null); const marker = useRef<THREE.Mesh>(null);
  const input = useRef<SfDriveInput>({ ...EMPTY_INPUT });
  const walker = useRef(createSfWalkerState(0, 0));
  const motion = useRef<BayBayLocomotion>({ speed: 0, distance: 0, turn: 0 });
  const lastArrival = useRef<string | null>(null); const onArrival = useRef(arrivalCallback);
  const lastStreet = useRef(''); const streetCallback = useRef(onStreetChange);
  const forward = useRef(new THREE.Vector3());
  const { invalidate, gl, camera } = useThree();

  useEffect(() => { onArrival.current = arrivalCallback; }, [arrivalCallback]);
  useEffect(() => { streetCallback.current = onStreetChange; }, [onStreetChange]);
  useEffect(() => {
    const spawn = createSfDrivingSpawn(startId);
    const island = startId === 'alcatraz' && mode !== 'drive' ? SF_LANDMARKS.find(p => p.id === 'alcatraz') : undefined;
    const state = island && isOnLand(...island.position) ? { ...spawn.state, x: island.position[0], z: island.position[1] } : spawn.state;
    vehicleRef.current = state;
    walker.current = createSfWalkerState(state.x, state.z, state.heading);
    motion.current = { speed: 0, distance: 0, turn: 0 };
    destinationRef.current = null;
    if (group.current) group.current.position.set(state.x, terrainHeight(state.x, state.z) + .09, state.z);
    invalidate();
    // Switching between walking and driving preserves the current position.
    // Only an explicit new departure or reset chooses a new spawn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken, startId, vehicleRef, destinationRef, invalidate]);
  useEffect(() => {
    const current = vehicleRef.current;
    walker.current = createSfWalkerState(current.x, current.z, current.heading);
    vehicleRef.current.speed = 0; motion.current.speed = 0; motion.current.turn = 0;
    destinationRef.current = null; input.current = { ...EMPTY_INPUT };
  }, [mode, destinationRef, vehicleRef]);
  useEffect(() => {
    input.current = { ...EMPTY_INPUT };
    if (!running || mode === 'overview') { motion.current.speed = 0; motion.current.turn = 0; destinationRef.current = null; return; }
    const clear = () => {
      input.current = { ...EMPTY_INPUT }; driveInputRef.current = { ...EMPTY_INPUT };
      vehicleRef.current.speed = 0; walker.current.vx = 0; walker.current.vz = 0;
      walker.current.speed = 0; motion.current.speed = 0; motion.current.turn = 0; destinationRef.current = null;
    };
    const clearKeyboard = () => { input.current = { ...EMPTY_INPUT }; };
    const handle = (event: KeyboardEvent, down: boolean) => {
      const element = event.target as HTMLElement | null;
      if (down && element?.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (down && document.activeElement !== gl.domElement && !document.activeElement?.closest('.sf-drive-controls')) return;
      const key = ({ w: 'forward', arrowup: 'forward', s: 'backward', arrowdown: 'backward', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right' } as const)[event.key.toLowerCase() as 'w'];
      if (key) { event.preventDefault(); input.current[key] = down; invalidate(); }
    };
    const down = (event: KeyboardEvent) => handle(event, true); const up = (event: KeyboardEvent) => handle(event, false);
    const focusCanvas = () => gl.domElement.focus({ preventScroll: true });
    gl.domElement.setAttribute('tabindex', '0');
    gl.domElement.setAttribute('aria-label', locale === 'en' ? 'Explore with BayBay using arrow keys or W A S D' : '使用方向键或 W A S D 跟 BayBay 探索');
    gl.domElement.addEventListener('pointerdown', focusCanvas); gl.domElement.addEventListener('blur', clearKeyboard);
    gl.domElement.addEventListener('pointercancel', clear);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear); document.addEventListener('visibilitychange', clear);
    return () => { clear(); gl.domElement.removeEventListener('pointerdown', focusCanvas); gl.domElement.removeEventListener('blur', clearKeyboard); gl.domElement.removeEventListener('pointercancel', clear); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear); };
  }, [running, mode, driveInputRef, locale, vehicleRef, destinationRef, gl, invalidate]);
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, .04);
    const combined = { forward: input.current.forward || driveInputRef.current.forward, backward: input.current.backward || driveInputRef.current.backward,
      left: input.current.left || driveInputRef.current.left, right: input.current.right || driveInputRef.current.right };
    let state = vehicleRef.current;
    if (mode === 'walk') {
      camera.getWorldDirection(forward.current); forward.current.y = 0; forward.current.normalize();
      const vertical = Number(combined.forward) - Number(combined.backward), horizontal = Number(combined.right) - Number(combined.left);
      if (vertical || horizontal) destinationRef.current = null;
      walker.current = stepSfWalker(walker.current, {
        x: forward.current.x * vertical - forward.current.z * horizontal,
        z: forward.current.z * vertical + forward.current.x * horizontal,
      }, rawDelta, { active: running, maxSpeed: 2.3, canMove: isOnLand, destination: destinationRef.current });
      const next = walker.current;
      state = { x: next.x, z: next.z, heading: next.heading, speed: next.speed };
      motion.current = { speed: next.speed, distance: next.distance, turn: next.turn };
      if (destinationRef.current && Math.hypot(next.x - destinationRef.current.x, next.z - destinationRef.current.z) < .09) destinationRef.current = null;
    } else if (mode === 'drive') state = stepSfVehicle(state, combined, rawDelta, running).state;
    vehicleRef.current = state;
    const streetName = nearestRoad(state.x, state.z, true).road.name;
    if (streetName !== lastStreet.current) { lastStreet.current = streetName; streetCallback.current?.(streetName); }
    if (group.current) {
      group.current.position.set(state.x, THREE.MathUtils.damp(group.current.position.y, terrainHeight(state.x, state.z) + .09, 16, dt), state.z);
      group.current.rotation.y = state.heading;
    }
    if (marker.current) {
      marker.current.visible = mode === 'walk' && !!destinationRef.current;
      if (destinationRef.current) marker.current.position.set(destinationRef.current.x, terrainHeight(destinationRef.current.x, destinationRef.current.z) + .1, destinationRef.current.z);
    }
    let arrival: string | null = null; let closest = Infinity;
    for (const landmark of SF_LANDMARKS) {
      const distance = Math.hypot(state.x - landmark.position[0], state.z - landmark.position[1]);
      if (distance < Math.max(landmark.arrivalRadius, 2.5) && distance < closest) { arrival = landmark.id; closest = distance; }
    }
    if (arrival !== lastArrival.current) { lastArrival.current = arrival; onArrival.current?.(arrival); }
  });
  return <>
    <group ref={group}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .01, 0]}><circleGeometry args={[.32, 24]} /><meshBasicMaterial color="#4b634f" transparent opacity={.16} depthWrite={false} /></mesh>
      {mode === 'drive' ? <group scale={.48}><BuggyModel /></group> : <BayBayModel scale={.8} animated={running && mode === 'walk'} locomotion={motion} />}
    </group>
    <mesh ref={marker} rotation={[-Math.PI / 2, 0, 0]} visible={false}><ringGeometry args={[.2, .28, 24]} /><meshBasicMaterial color="#397969" transparent opacity={.7} depthWrite={false} /></mesh>
  </>;
}

function CameraRig({ props, vehicleRef, destinationRef }: { props: SanFranciscoSceneProps; vehicleRef: MutableRefObject<VehicleState>; destinationRef: MutableRefObject<{ x: number; z: number } | null> }) {
  const controls = useRef<OrbitControlsImpl>(null); const moving = useRef(true);
  const desiredPosition = useRef(new THREE.Vector3()); const desiredTarget = useRef(new THREE.Vector3());
  const previous = useRef<{ mode: SanFranciscoSceneProps['mode']; reset: number; start: string } | null>(null);
  const followDelta = useRef(new THREE.Vector3()); const followTarget = useRef(new THREE.Vector3());
  const lastCameraCommand = useRef<number | null>(null);
  const { camera, invalidate, size } = useThree();
  const limits = props.mode === 'overview' ? SF_OVERVIEW_CAMERA_LIMITS : SF_FOLLOW_CAMERA_LIMITS;
  const resetCamera = useRef(() => {});
  useEffect(() => {
    resetCamera.current = () => {
      const landmark = SF_LANDMARKS.find(item => item.id === props.selectedId);
      if (props.mode !== 'overview') {
        const state = vehicleRef.current; const y = terrainHeight(state.x, state.z);
        const fit = size.width / size.height < 1 ? 1.3 : 1;
        desiredTarget.current.set(state.x, y + .65, state.z);
        desiredPosition.current.set(state.x + 4.8 * fit, y + 8 * fit, state.z + 7.8 * fit);
      } else if (landmark) {
        const y = terrainHeight(...landmark.position);
        const fit = size.width < 520 ? 1.15 : 1;
        desiredTarget.current.set(landmark.position[0], y + .5, landmark.position[1]);
        desiredPosition.current.set(landmark.position[0] + 7.5 * fit, y + 9 * fit, landmark.position[1] + 9 * fit);
      } else {
        const fit = Math.max(1, Math.min(2.2, 1.15 / (size.width / size.height)));
        desiredTarget.current.set(8, 0, 15); desiredPosition.current.set(8 + 120 * fit, 170 * fit, 15 + 138 * fit);
      }
      moving.current = true; invalidate();
    };
    const last = previous.current;
    // Walking and driving share the same orbit. Boarding never takes the camera away from the user.
    const preserveOrbit = last && last.mode !== 'overview' && props.mode !== 'overview'
      && last.reset === props.resetToken && last.start === props.startId;
    previous.current = { mode: props.mode, reset: props.resetToken, start: props.startId };
    if (!preserveOrbit) resetCamera.current();
  }, [props.selectedId, props.mode, props.resetToken, props.startId, size.width, size.height, vehicleRef, invalidate]);
  useEffect(() => {
    const control = controls.current;
    const command = props.cameraCommand;
    if (!control || !command || lastCameraCommand.current === command.id) return;
    lastCameraCommand.current = command.id;
    if (command.action === 'reset') { resetCamera.current(); return; }
    const offset = camera.position.clone().sub(control.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    const next = adjustSfCamera({ azimuth: spherical.theta, polar: spherical.phi, distance: spherical.radius }, command.action, props.mode === 'overview' ? SF_OVERVIEW_CAMERA_LIMITS : SF_FOLLOW_CAMERA_LIMITS);
    desiredTarget.current.copy(control.target);
    desiredPosition.current.copy(control.target).add(offset.setFromSphericalCoords(next.distance, next.polar, next.azimuth));
    moving.current = true; invalidate();
  }, [props.cameraCommand, props.mode, camera, invalidate]);
  useFrame((_, delta) => {
    const control = controls.current;
    if (!control) return;
    if (props.mode !== 'overview') {
      const state = vehicleRef.current; const y = terrainHeight(state.x, state.z);
      followTarget.current.set(state.x, y + .65, state.z);
      if (moving.current) {
        followDelta.current.copy(followTarget.current).sub(desiredTarget.current);
        desiredPosition.current.add(followDelta.current); desiredTarget.current.copy(followTarget.current);
      } else {
        // Translate both ends of the orbit equally: player movement preserves angle, pitch and zoom.
        followDelta.current.copy(followTarget.current).sub(control.target).multiplyScalar(1 - Math.exp(-Math.min(delta, .05) * 8));
        camera.position.add(followDelta.current); control.target.add(followDelta.current); control.update();
      }
    }
    if (moving.current) {
      camera.position.lerp(desiredPosition.current, 1 - Math.exp(-delta * 5)); control.target.lerp(desiredTarget.current, 1 - Math.exp(-delta * 5)); control.update();
      if (camera.position.distanceTo(desiredPosition.current) < .03 && control.target.distanceTo(desiredTarget.current) < .03) moving.current = false;
      else invalidate();
    }
  });
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.09} enablePan={props.mode === 'overview'}
    minDistance={limits.minDistance} maxDistance={limits.maxDistance} minPolarAngle={limits.minPolar} maxPolarAngle={limits.maxPolar} rotateSpeed={.55} zoomSpeed={.7}
    onStart={() => { moving.current = false; destinationRef.current = null; }} touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }} />;
}

function SceneContent(props: SanFranciscoSceneProps) {
  const { gl, size } = useThree(); const ready = useRef(false); const vehicleRef = useRef<VehicleState>({ x: 0, z: 0, heading: 0, speed: 0 });
  const destinationRef = useRef<{ x: number; z: number } | null>(null);
  const cameraGesture = useMemo(() => createSfCameraGestureGuard(), []);
  const golden = props.timeOfDay === 'golden';
  const onError = props.onError;
  useEffect(() => {
    const canvas = gl.domElement;
    const stopObserving = observeSfCameraGestures(canvas, cameraGesture);
    const lost = (event: Event) => { event.preventDefault(); if (canvas.isConnected) onError?.(); };
    canvas.addEventListener('webglcontextlost', lost); return () => { stopObserving(); canvas.removeEventListener('webglcontextlost', lost); };
  }, [gl, onError, cameraGesture]);
  useFrame(() => { if (!ready.current) { ready.current = true; props.onReady?.(); } });
  return <>
    <color attach="background" args={[golden ? '#e4dfc7' : '#d8e7dd']} />
    <fog attach="fog" args={[golden ? '#e4dfc7' : '#d8e7dd', size.width < 600 ? 600 : 245, 950]} />
    <ambientLight intensity={golden ? .75 : .85} color="#fff0d7" />
    <hemisphereLight args={['#fff7de', '#a0b5a4', .85]} />
    <directionalLight position={[-48, 75, 40]} intensity={golden ? 2.1 : 1.9} color={golden ? '#ffce92' : '#fff3d6'} castShadow
      shadow-mapSize={[size.width < 600 ? 1024 : 2048, size.width < 600 ? 1024 : 2048]} shadow-camera-left={-100} shadow-camera-right={100}
      shadow-camera-top={100} shadow-camera-bottom={-100} shadow-camera-near={1} shadow-camera-far={240} shadow-bias={-.0002} shadow-normalBias={.05} />
    <directionalLight position={[45, 28, -35]} intensity={.5} color="#c7e8df" />
    <BayWater running={props.running} /><CityGround onWalkTo={(x, z) => { if (cameraGesture.allowsClick() && props.running && props.mode === 'walk' && isOnLand(x, z)) destinationRef.current = { x, z }; }} /><ResidentialBlocks />
    <Landmarks selectedId={props.selectedId} onSelect={props.onSelect} running={props.running} locale={props.locale} />
    <StreetNames selectedId={props.selectedId} locale={props.locale ?? 'zh'} />
    <CityPlayer vehicleRef={vehicleRef} destinationRef={destinationRef} props={props} /><CameraRig props={props} vehicleRef={vehicleRef} destinationRef={destinationRef} />
  </>;
}

class SceneBoundary extends Component<{ children: ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function SanFranciscoScene(props: SanFranciscoSceneProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  return <SceneBoundary onError={props.onError}>
    <Canvas shadows={{ enabled: true, type: THREE.PCFShadowMap }} dpr={[1, 1.5]}
      frameloop={props.running && (!reducedMotion || props.mode !== 'overview') ? 'always' : 'demand'}
      camera={{ position: [-5, 20, 25], near: .06, far: 1000, fov: 42 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}>
      <SceneContent {...props} />
    </Canvas>
  </SceneBoundary>;
}
