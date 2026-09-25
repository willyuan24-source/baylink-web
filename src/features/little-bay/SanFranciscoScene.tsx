import { Component, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BayBayModel, BuggyModel, CrabModel, LandmarkModel, SealionsModel } from './SanFranciscoModels';
import type { BayBayLocomotion } from './SanFranciscoModels';
import { SF_CITY_RINGS, SF_LANDMARKS, SF_MAJOR_STREET_LABELS, SF_NEIGHBORHOODS, isOnLand, nearestRoad, terrainHeight } from './sf-world';
import { containsPoint, createRoadGeometry, createShoreGeometry, createTerrainGeometry, mapHash } from './san-francisco-geometry';
import { makeSfCityScenery, makeSfShoreFoam, SF_PARK_NAMES, sfVisualRoads } from './sf-city-scenery';
import SfWorldResidents from './SfWorldResidents';
import SfCableCarRide from './SfCableCarRide';
import SfDiscoveryDecorations from './SfDiscoveryDecorations';
import type { MapPoint } from './san-francisco-geometry';
import { createSfDrivingSpawn, stepSfDirectionalVehicle, stepSfVehicle } from './sf-driving';
import type { SfDriveInput, SfVehicleState as VehicleState } from './sf-driving';
import { createSfWalkerState, stepSfWalker } from './sf-walking';
import { createSfArrivalTracker, createSfWalkingSpawn } from './sf-place-arrival';
import { sfCameraRelativeDirection, usesSfAnalogInput } from './sf-movement-input';
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
  activeDestinationId?: string;
  visitedIds?: string[];
  onResidentInteract?: (residentId: string) => void;
  rideActive?: boolean;
  onRideComplete?: () => void;
  discoveries?: Record<string, string>;
};

const EMPTY_INPUT: SfDriveInput = { forward: false, backward: false, left: false, right: false };
function onLand(point: MapPoint) { return SF_CITY_RINGS.some(ring => containsPoint(point, ring)); }
let cityScenery: ReturnType<typeof makeSfCityScenery> | undefined;

function ResidentialBlocks({ compact }: { compact: boolean }) {
  const { buildings, trees } = useMemo(() => cityScenery ??= makeSfCityScenery(), []);
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
    <instancedMesh ref={walls} args={[softBox, undefined, buildings.length]} castShadow={!compact} receiveShadow><meshStandardMaterial roughness={.96} /></instancedMesh>
    <instancedMesh ref={roofs} args={[undefined, undefined, buildings.length]} castShadow={!compact}><boxGeometry /><meshStandardMaterial roughness={.94} /></instancedMesh>
    <instancedMesh ref={eaves} args={[undefined, undefined, buildings.length]}><boxGeometry /><meshStandardMaterial color="#f4e5c7" roughness={.94} /></instancedMesh>
    <instancedMesh ref={frames} args={[undefined, undefined, buildings.length]}><boxGeometry /><meshStandardMaterial color="#f4e5c7" roughness={.94} /></instancedMesh>
    <instancedMesh ref={windows} args={[undefined, undefined, buildings.length]}><boxGeometry /><meshStandardMaterial color="#437b7c" roughness={.65} /></instancedMesh>
    <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]} castShadow={!compact}><cylinderGeometry args={[1, 1.2, 1, 5]} /><meshStandardMaterial color="#a28265" roughness={1} /></instancedMesh>
    <instancedMesh ref={canopies} args={[undefined, undefined, trees.length]} castShadow={!compact}><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial roughness={1} /></instancedMesh>
  </group>;
}

function CityGround({ onWalkTo }: { onWalkTo: (x: number, z: number) => void }) {
  const geometries = useMemo(() => {
    const roads = sfVisualRoads();
    return {
      land: createTerrainGeometry(SF_CITY_RINGS, terrainHeight), shore: createShoreGeometry(SF_CITY_RINGS, terrainHeight),
      avenues: createRoadGeometry(roads.avenues, terrainHeight, 0, .065), curbs: createRoadGeometry(roads.avenues, terrainHeight, .045, .045),
      lanes: createRoadGeometry(roads.lanes, terrainHeight, 0, .052), paths: createRoadGeometry(roads.paths, terrainHeight, 0, .057),
      parks: createTerrainGeometry(SF_NEIGHBORHOODS.filter(item => SF_PARK_NAMES.has(item.name)).flatMap(item => item.rings), terrainHeight, .025),
    };
  }, []);
  useEffect(() => () => Object.values(geometries).forEach(geometry => geometry.dispose()), [geometries]);
  return <group onClick={event => { if (event.delta < 5) { event.stopPropagation(); onWalkTo(event.point.x, event.point.z); } }}>
    <mesh geometry={geometries.land} receiveShadow><meshStandardMaterial color="#dcd7b8" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={geometries.shore}><meshStandardMaterial color="#cbbda0" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={geometries.parks} receiveShadow><meshStandardMaterial color="#aec593" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={geometries.lanes} receiveShadow><meshStandardMaterial color="#c5c8b3" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={geometries.paths} receiveShadow><meshStandardMaterial color="#d6d1ad" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={geometries.curbs} receiveShadow><meshStandardMaterial color="#eee5cb" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={geometries.avenues} receiveShadow><meshStandardMaterial color="#aebcad" roughness={1} side={THREE.DoubleSide} /></mesh>
  </group>;
}

function BayWater({ running }: { running: boolean }) {
  const foam = useRef<THREE.Group>(null);
  const waves = useRef<THREE.InstancedMesh>(null);
  const surf = useRef<THREE.InstancedMesh>(null);
  const floatingOtter = useRef<THREE.Group>(null);
  const waterTime = useRef(0);
  const shoreStrokes = useMemo(() => makeSfShoreFoam(), []);
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
  useEffect(() => {
    const object = new THREE.Object3D(); const color = new THREE.Color();
    shoreStrokes.forEach((stroke, index) => {
      object.position.set(stroke.x, -.29 + stroke.phase * .035, stroke.z);
      object.rotation.set(-Math.PI / 2, 0, -stroke.angle);
      object.scale.set(stroke.length, .055 + stroke.phase * .05, 1); object.updateMatrix();
      surf.current?.setMatrixAt(index, object.matrix);
      surf.current?.setColorAt(index, color.set(stroke.phase > .5 ? '#e7ecda' : '#c5e2d6'));
    });
    if (surf.current) {
      surf.current.instanceMatrix.needsUpdate = true;
      if (surf.current.instanceColor) surf.current.instanceColor.needsUpdate = true;
      surf.current.computeBoundingSphere();
    }
  }, [shoreStrokes]);
  useFrame((_, delta) => {
    if (!running) return;
    waterTime.current += Math.min(delta, .05);
    if (foam.current) foam.current.position.y = Math.sin(waterTime.current * .6) * .035;
    if (floatingOtter.current) {
      floatingOtter.current.position.y = -.21 + Math.sin(waterTime.current * 1.2) * .065;
      floatingOtter.current.rotation.z = Math.PI / 9 + Math.sin(waterTime.current * .8) * .07;
    }
  });
  const pier = SF_LANDMARKS.find(item => item.id === 'pier');
  const palace = SF_LANDMARKS.find(item => item.id === 'palace');
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.42, 0]} receiveShadow><planeGeometry args={[1200, 1200]} /><meshStandardMaterial color="#8dbfb9" roughness={.5} metalness={.02} /></mesh>
    <group ref={foam}>
      <instancedMesh ref={waves} args={[undefined, undefined, wavePositions.length]}>
        <planeGeometry /><meshBasicMaterial color="#d4e9dd" transparent opacity={.4} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={surf} args={[undefined, undefined, shoreStrokes.length]}>
        <planeGeometry /><meshBasicMaterial transparent opacity={.7} depthWrite={false} />
      </instancedMesh>
    </group>
    {pier && <group position={[pier.position[0] + 1.5, -.18, pier.position[1] - 2]} scale={.85}><SealionsModel /></group>}
    {pier && <group ref={floatingOtter} position={[pier.position[0] - .8, -.21, pier.position[1] - 2.5]} rotation={[0, -.3, Math.PI / 9]} scale={.4}><BayBayModel /></group>}
    {palace && <group position={[palace.position[0] + 1.8, .12, palace.position[1] - 2]} scale={.45}><CrabModel /></group>}
  </>;
}

function LandmarkMarker({ id, active, overview, destination, visited, onSelect, locale }: { id: string; active: boolean; overview: boolean; destination: boolean; visited: boolean; onSelect: (id: string) => void; locale: string }) {
  const landmark = SF_LANDMARKS.find(item => item.id === id)!;
  const { size } = useThree();
  const named = size.width >= 600 ? active || destination || (overview && (id === 'bridge' || id === 'park' || id === 'pier')) : overview && (id === 'bridge' || id === 'park');
  const name = locale === 'en' ? landmark.titleEn : landmark.title;
  const status = destination ? (locale === 'en' ? ' · Next stop' : ' · 下一站') : visited ? (locale === 'en' ? ' · Stamp collected' : ' · 已收集印章') : '';
  const compactSite = (landmark.sceneryRadius ?? 3) < 2;
  return <Html center position={[0, landmark.markerHeight ?? (id === 'academy' ? 1.35 : compactSite ? 2.1 : 3.7 * Math.min(landmark.modelScale ?? 1, 1.2)), 0]} zIndexRange={named ? [18, 16] : [15, 0]} style={{ pointerEvents: 'none' }}>
    <button type="button" onClick={() => onSelect(id)} aria-label={name + status} aria-pressed={active} title={name + status}
      className={`sf-world-marker${active ? ' is-active' : ''}`} style={{
        minWidth: 44, minHeight: 44, display: 'grid', placeItems: 'center', border: active ? '2px solid #fff8e7' : 'none', borderRadius: 30, padding: named ? '7px 13px' : 10,
        background: active ? '#296f65' : destination ? '#f8e1ad' : named ? '#fffaed' : 'transparent', color: active ? '#fff9e8' : '#30695f', pointerEvents: 'auto',
        boxShadow: active ? '0 3px 12px #314f3930' : 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'inherit',
      }}>{named ? `${destination ? '↟ ' : visited ? '✓ ' : ''}${name}` : <span style={{ display: 'grid', placeItems: 'center', width: 23, height: 23, border: '2px solid #fff8e7', background: visited ? '#dcebcf' : '#fffaed', borderRadius: '50%', boxShadow: '0 2px 6px #314f3920', fontSize: visited ? 12 : 9 }}>{visited ? '✓' : '◆'}</span>}</button>
  </Html>;
}

function DestinationBeacon({ running }: { running: boolean }) {
  const ring = useRef<THREE.Mesh>(null); const light = useRef<THREE.Mesh>(null); const time = useRef(0);
  useFrame((_, delta) => {
    if (!running) return;
    time.current += Math.min(delta, .05);
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(time.current * 2) * .035);
    if (light.current) light.current.position.y = 2.1 + Math.sin(time.current * 1.5) * .12;
  });
  return <group>
    <mesh ref={ring} position={[0, .075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.05, 1.15, 40]} /><meshBasicMaterial color="#d5a342" transparent opacity={.8} depthWrite={false} />
    </mesh>
    <mesh ref={light} position={[0, 2.1, 0]}>
      <octahedronGeometry args={[.12]} /><meshStandardMaterial color="#f9d589" emissive="#ddb24c" emissiveIntensity={.35} roughness={.75} />
    </mesh>
  </group>;
}

function Landmarks({ selectedId, onSelect, running, locale, activeDestinationId, visitedIds, rideActive }: Pick<SanFranciscoSceneProps, 'selectedId' | 'onSelect' | 'running' | 'locale' | 'activeDestinationId' | 'visitedIds' | 'rideActive'>) {
  return <group>{SF_LANDMARKS.map(landmark => <group key={landmark.id} position={[landmark.position[0], terrainHeight(...landmark.position) + .08, landmark.position[1]]}
    rotation={[0, landmark.kind === 'bridge' ? -.28 : 0, 0]}>
    {!(rideActive && landmark.id === 'cable-car') && <group scale={landmark.modelScale ?? 1}><LandmarkModel kind={landmark.id} animated={running} /></group>}
    {activeDestinationId === landmark.id && <DestinationBeacon running={running} />}
    <LandmarkMarker id={landmark.id} active={selectedId === landmark.id} overview={!selectedId} destination={activeDestinationId === landmark.id} visited={visitedIds?.includes(landmark.id) ?? false} onSelect={onSelect} locale={locale ?? 'zh'} />
  </group>)}</group>;
}

function StreetNames({ selectedId, locale }: { selectedId: string | null; locale: string }) {
  const landmark = SF_LANDMARKS.find(item => item.id === selectedId);
  if (!landmark) return null;
  return <group>{SF_MAJOR_STREET_LABELS.filter(label => {
    const distance = Math.hypot(label.point[0] - landmark.position[0], label.point[1] - landmark.position[1]);
    return distance > Math.max(3, landmark.sceneryRadius ?? 3) && distance < 16;
  }).slice(0, 4).map(label =>
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
  const arrivalTracker = useRef(createSfArrivalTracker()); const onArrival = useRef(arrivalCallback);
  const lastStreet = useRef(''); const streetCallback = useRef(onStreetChange);
  const forward = useRef(new THREE.Vector3());
  const { invalidate, gl, camera } = useThree();

  useEffect(() => { onArrival.current = arrivalCallback; }, [arrivalCallback]);
  useEffect(() => { streetCallback.current = onStreetChange; }, [onStreetChange]);
  useEffect(() => {
    const spawn = mode === 'drive' ? createSfDrivingSpawn(startId) : createSfWalkingSpawn(startId);
    const state = spawn.state;
    vehicleRef.current = state;
    walker.current = createSfWalkerState(state.x, state.z, state.heading);
    motion.current = { speed: 0, distance: 0, turn: 0 };
    arrivalTracker.current.reset(); lastStreet.current = '';
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
    gl.domElement.setAttribute('aria-label', locale === 'en' ? 'Explore with BayBay using the movement controls or keyboard' : '使用移动控制或键盘跟 BAYBAY 探索');
    gl.domElement.addEventListener('pointerdown', focusCanvas); gl.domElement.addEventListener('blur', clearKeyboard);
    gl.domElement.addEventListener('pointercancel', clear);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear); document.addEventListener('visibilitychange', clear);
    return () => { clear(); gl.domElement.removeEventListener('pointerdown', focusCanvas); gl.domElement.removeEventListener('blur', clearKeyboard); gl.domElement.removeEventListener('pointercancel', clear); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear); };
  }, [running, mode, driveInputRef, locale, vehicleRef, destinationRef, gl, invalidate]);
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, .04);
    const combined = { forward: input.current.forward || driveInputRef.current.forward, backward: input.current.backward || driveInputRef.current.backward,
      left: input.current.left || driveInputRef.current.left, right: input.current.right || driveInputRef.current.right,
      moveX: driveInputRef.current.moveX, moveY: driveInputRef.current.moveY };
    let state = vehicleRef.current;
    if (mode === 'walk') {
      camera.getWorldDirection(forward.current); forward.current.y = 0; forward.current.normalize();
      const direction = sfCameraRelativeDirection(combined, forward.current);
      if (direction.x || direction.z) destinationRef.current = null;
      walker.current = stepSfWalker(walker.current, direction, rawDelta, { active: running, maxSpeed: 2.3, canMove: isOnLand, destination: destinationRef.current });
      const next = walker.current;
      state = { x: next.x, z: next.z, heading: next.heading, speed: next.speed };
      motion.current = { speed: next.speed, distance: next.distance, turn: next.turn };
      if (destinationRef.current && Math.hypot(next.x - destinationRef.current.x, next.z - destinationRef.current.z) < .09) destinationRef.current = null;
    } else if (mode === 'drive') {
      if (usesSfAnalogInput(combined)) {
        camera.getWorldDirection(forward.current);
        state = stepSfDirectionalVehicle(state, sfCameraRelativeDirection(combined, forward.current), rawDelta, running).state;
      } else state = stepSfVehicle(state, combined, rawDelta, running).state;
    }
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
    const arrival = arrivalTracker.current.update(state.x, state.z);
    if (arrival.changed) onArrival.current?.(arrival.id);
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
        const fit = (size.width < 520 ? 1.15 : 1) * (landmark.cameraDistance ?? 15) / 15;
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

function WorldSun({ compact, golden, props, vehicleRef }: { compact: boolean; golden: boolean; props: SanFranciscoSceneProps; vehicleRef: MutableRefObject<VehicleState> }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const { scene } = useThree();
  const radius = props.mode === 'overview' && !props.selectedId ? 110 : 28;
  useEffect(() => { scene.add(target); return () => { scene.remove(target); }; }, [scene, target]);
  useEffect(() => { light.current?.shadow.camera.updateProjectionMatrix(); }, [radius]);
  useFrame(() => {
    if (!light.current) return;
    const landmark = SF_LANDMARKS.find(item => item.id === props.selectedId);
    const state = vehicleRef.current;
    const x = props.mode !== 'overview' ? state.x : landmark?.position[0] ?? 8;
    const z = props.mode !== 'overview' ? state.z : landmark?.position[1] ?? 15;
    const y = terrainHeight(x, z);
    target.position.set(x, y, z);
    light.current.position.set(x - 48, y + 75, z + 40);
    light.current.target = target;
  });
  return <directionalLight ref={light} position={[-48, 75, 40]} intensity={golden ? 1.85 : 1.7} color={golden ? '#ffdaac' : '#fff4df'} castShadow
    shadow-mapSize={[compact ? 1024 : 2048, compact ? 1024 : 2048]} shadow-camera-left={-radius} shadow-camera-right={radius}
    shadow-camera-top={radius} shadow-camera-bottom={-radius} shadow-camera-near={1} shadow-camera-far={250} shadow-bias={-.0002} shadow-normalBias={.025} />;
}

function SceneContent(props: SanFranciscoSceneProps & { compact: boolean }) {
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
    <WorldSun compact={props.compact} golden={golden} props={props} vehicleRef={vehicleRef} />
    <directionalLight position={[45, 28, -35]} intensity={.5} color="#c7e8df" />
    <BayWater running={props.running} /><CityGround onWalkTo={(x, z) => { if (cameraGesture.allowsClick() && props.running && props.mode === 'walk' && !props.rideActive && isOnLand(x, z)) destinationRef.current = { x, z }; }} /><ResidentialBlocks compact={props.compact} />
    <Landmarks selectedId={props.selectedId} onSelect={props.onSelect} running={props.running} locale={props.locale} activeDestinationId={props.activeDestinationId} visitedIds={props.visitedIds} rideActive={props.rideActive} />
    <SfDiscoveryDecorations discoveries={props.discoveries ?? {}} running={props.running} />
    <SfWorldResidents running={props.running} locale={props.locale} onInteract={props.onResidentInteract} />
    <StreetNames selectedId={props.selectedId} locale={props.locale ?? 'zh'} />
    {props.rideActive ? <SfCableCarRide vehicleRef={vehicleRef} running={props.running} onComplete={props.onRideComplete} />
      : <CityPlayer vehicleRef={vehicleRef} destinationRef={destinationRef} props={props} />}
    <CameraRig props={props} vehicleRef={vehicleRef} destinationRef={destinationRef} />
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
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse), (max-width: 720px)'); const update = () => setCompact(media.matches);
    update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  return <SceneBoundary onError={props.onError}>
    <Canvas shadows="percentage" dpr={[1, compact ? 1.25 : 1.5]}
      frameloop={props.running && (!reducedMotion || props.mode !== 'overview') ? 'always' : 'demand'}
      camera={{ position: [-5, 20, 25], near: .06, far: 1000, fov: 42 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}>
      <SceneContent {...props} compact={compact} />
    </Canvas>
  </SceneBoundary>;
}
