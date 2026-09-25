import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { BayBayModel, BenchModel, BuggyModel, LandmarkModel, TreeModel } from './SanFranciscoModels';
import { GardenDetails } from './GardenDetails';
import type { BayBayLocomotion } from './SanFranciscoModels';
import { createSfWalkerState, stepSfWalker } from './sf-walking';
import { sfCameraRelativeDirection } from './sf-movement-input';
import type { SfMovementInput } from './sf-movement-input';
import { adjustSfCamera, createSfCameraGestureGuard, observeSfCameraGestures, SF_GARDEN_CAMERA_LIMITS } from './sf-camera';
import type { SfCameraCommand } from './sf-camera';

export type GardenInput = SfMovementInput;
export type ParkGardenSceneProps = {
  input: React.MutableRefObject<GardenInput>;
  running: boolean;
  golden: boolean;
  treasureFound: boolean;
  onNearTreasure: (near: boolean) => void;
  onReady: () => void;
  onError: () => void;
  cameraCommand?: SfCameraCommand;
  locale?: string;
};

const canWalkInGarden = (x: number, z: number) => x >= -6.5 && x <= 6.5 && z >= -1.5 && z <= 5.3
  && !(x < -3.55 && x > -5.35 && z > -0.95 && z < -0.1);

const clearInput = (input: GardenInput) => { input.forward = false; input.backward = false; input.left = false; input.right = false; input.moveX = 0; input.moveY = 0; };

function Pebble({ position, scale, color }: { position: [number, number, number]; scale: [number, number, number]; color: string }) {
  return <mesh position={position} scale={scale} castShadow receiveShadow><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>;
}

function Garden(props: ParkGardenSceneProps) {
  const { camera, gl, invalidate, size } = useThree();
  const onError = props.onError;
  const player = useRef<THREE.Group>(null);
  const keyboard = useRef<GardenInput>({ forward: false, backward: false, left: false, right: false });
  const chest = useRef<THREE.Group>(null);
  const destination = useRef<THREE.Vector3 | null>(null);
  const marker = useRef<THREE.Mesh>(null);
  const lastNear = useRef(false);
  const ready = useRef(false);
  const position = useRef(new THREE.Vector3(-0.4, 0.035, 3.3));
  const walker = useRef(createSfWalkerState(-0.4, 3.3, .22));
  const motion = useRef<BayBayLocomotion>({ speed: 0, distance: 0, turn: 0 });
  const cameraForward = useRef(new THREE.Vector3());
  const controls = useRef<OrbitControlsImpl>(null);
  const cameraGesture = useMemo(() => createSfCameraGestureGuard(), []);
  const cameraMoving = useRef(false); const cameraInitialized = useRef(false);
  const desiredCamera = useRef(new THREE.Vector3()); const desiredTarget = useRef(new THREE.Vector3());
  const followTarget = useRef(new THREE.Vector3()); const followDelta = useRef(new THREE.Vector3());
  const resetCamera = useRef(() => {}); const lastCameraCommand = useRef<number | null>(null);
  const petals = useMemo(() => Array.from({ length: 64 }, (_, i) => ({
    x: -5.7 + (i % 16) * 0.72,
    z: -4.4 + Math.floor(i / 16) * 0.46,
    color: ['#f0c293', '#f4e5c0', '#e6b4a5', '#f4efd5'][i % 4],
  })), []);

  useEffect(() => {
    resetCamera.current = () => {
      const portrait = size.width / size.height < 1;
      desiredTarget.current.set(position.current.x * (portrait ? .85 : .65), 1.3, -1.8 + (position.current.z - 3.3) * .35);
      desiredCamera.current.copy(desiredTarget.current).add(new THREE.Vector3(portrait ? 3.5 : 6.2, portrait ? 7.5 : 5.7, portrait ? 24.8 : 16.6));
      cameraMoving.current = true; invalidate();
    };
    if (!cameraInitialized.current) {
      resetCamera.current();
      camera.position.copy(desiredCamera.current); controls.current?.target.copy(desiredTarget.current);
      camera.lookAt(desiredTarget.current); camera.updateProjectionMatrix();
      cameraInitialized.current = true;
    }
  }, [camera, invalidate, size.width, size.height]);
  useEffect(() => {
    const control = controls.current; const command = props.cameraCommand;
    if (!control || !command || lastCameraCommand.current === command.id) return;
    lastCameraCommand.current = command.id;
    if (command.action === 'reset') { resetCamera.current(); return; }
    const offset = camera.position.clone().sub(control.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    const next = adjustSfCamera({ azimuth: spherical.theta, polar: spherical.phi, distance: spherical.radius }, command.action, SF_GARDEN_CAMERA_LIMITS);
    desiredTarget.current.copy(control.target);
    desiredCamera.current.copy(control.target).add(offset.setFromSphericalCoords(next.distance, next.polar, next.azimuth));
    cameraMoving.current = true; invalidate();
  }, [props.cameraCommand, camera, invalidate]);
  useEffect(() => {
    const canvas = gl.domElement;
    const stopObserving = observeSfCameraGestures(canvas, cameraGesture);
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('aria-label', props.locale === 'zh-Hant' ? '使用移動控制或鍵盤跟 BAYBAY 探索花園' : props.locale === 'zh-Hans' ? '使用移动控制或键盘跟 BAYBAY 探索花园' : 'Explore the garden with BayBay using the movement controls or keyboard');
    const focus = () => canvas.focus({ preventScroll: true });
    const cancelWalk = () => { destination.current = null; };
    const lost = (event: Event) => { event.preventDefault(); if (canvas.isConnected) onError(); };
    canvas.addEventListener('pointerdown', focus);
    canvas.addEventListener('pointercancel', cancelWalk);
    canvas.addEventListener('webglcontextlost', lost);
    return () => { stopObserving(); canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('pointerdown', focus); canvas.removeEventListener('pointercancel', cancelWalk); };
  }, [gl, onError, cameraGesture, props.locale]);
  useEffect(() => {
    if (!props.running) { clearInput(props.input.current); clearInput(keyboard.current); destination.current = null; return; }
    const keyMap: Record<string, 'forward' | 'backward' | 'left' | 'right'> = { w: 'forward', ArrowUp: 'forward', s: 'backward', ArrowDown: 'backward', a: 'left', ArrowLeft: 'left', d: 'right', ArrowRight: 'right' };
    const key = (event: KeyboardEvent, down: boolean) => {
      if (down && document.activeElement !== gl.domElement && !document.activeElement?.closest('.sf-drive-controls')) return;
      if (down && event.target instanceof HTMLElement && event.target.closest('input,select,textarea,[contenteditable="true"]')) return;
      const direction = keyMap[event.key] || keyMap[event.key.toLowerCase()];
      if (!direction) return;
      event.preventDefault(); keyboard.current[direction] = down;
    };
    const down = (event: KeyboardEvent) => key(event, true);
    const up = (event: KeyboardEvent) => key(event, false);
    const clearKeyboard = () => clearInput(keyboard.current);
    const release = () => { clearKeyboard(); clearInput(props.input.current); destination.current = null; walker.current.vx = 0; walker.current.vz = 0; walker.current.speed = 0; motion.current.speed = 0; motion.current.turn = 0; };
    gl.domElement.addEventListener('blur', clearKeyboard);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', release);
    return () => { gl.domElement.removeEventListener('blur', clearKeyboard); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', release); release(); };
  }, [props.running, props.input, gl]);

  useFrame((state, delta) => {
    if (!ready.current) { ready.current = true; props.onReady(); }
    const dt = Math.min(delta, 0.05);
    const forward = props.input.current.forward || keyboard.current.forward, backward = props.input.current.backward || keyboard.current.backward;
    const left = props.input.current.left || keyboard.current.left, right = props.input.current.right || keyboard.current.right;
    camera.getWorldDirection(cameraForward.current); cameraForward.current.y = 0; cameraForward.current.normalize();
    const direction = sfCameraRelativeDirection({ forward, backward, left, right, moveX: props.input.current.moveX, moveY: props.input.current.moveY }, cameraForward.current);
    if (direction.x || direction.z) destination.current = null;
    walker.current = stepSfWalker(walker.current, direction, delta, { active: props.running, maxSpeed: 2.15, canMove: canWalkInGarden, destination: destination.current });
    const next = walker.current;
    position.current.set(next.x, .035, next.z);
    motion.current = { speed: next.speed, distance: next.distance, turn: next.turn };
    if (destination.current && Math.hypot(next.x - destination.current.x, next.z - destination.current.z) < .08) destination.current = null;
    if (player.current) player.current.rotation.y = next.heading;
    if (props.running && chest.current && !props.treasureFound) chest.current.rotation.y = Math.sin(state.clock.elapsedTime * .65) * .07;
    if (player.current) player.current.position.copy(position.current);
    const control = controls.current;
    if (control) {
      followTarget.current.set(position.current.x * (size.width / size.height < 1 ? .85 : .65), 1.3, -1.8 + (position.current.z - 3.3) * .35);
      if (cameraMoving.current) {
        followDelta.current.copy(followTarget.current).sub(desiredTarget.current);
        desiredCamera.current.add(followDelta.current); desiredTarget.current.copy(followTarget.current);
        camera.position.lerp(desiredCamera.current, 1 - Math.exp(-dt * 7));
        control.target.lerp(desiredTarget.current, 1 - Math.exp(-dt * 7)); control.update();
        if (camera.position.distanceTo(desiredCamera.current) < .025 && control.target.distanceTo(desiredTarget.current) < .025) cameraMoving.current = false;
        else invalidate();
      } else {
        followDelta.current.copy(followTarget.current).sub(control.target).multiplyScalar(1 - Math.exp(-dt * 6));
        camera.position.add(followDelta.current); control.target.add(followDelta.current); control.update();
      }
    }
    if (marker.current) {
      marker.current.visible = !!destination.current;
      if (destination.current) marker.current.position.set(destination.current.x, 0.03, destination.current.z);
    }
    const near = Math.hypot(position.current.x + 3.25, position.current.z - 0.7) < 1.7;
    if (near !== lastNear.current) { lastNear.current = near; props.onNearTreasure(near); }
  });

  return <>
    <color attach="background" args={[props.golden ? '#e7dcc4' : '#dfe9db']} />
    <fog attach="fog" args={[props.golden ? '#e7dcc4' : '#dfe9db', 24, 62]} />
    <ambientLight intensity={0.65} color="#fff0da" /><hemisphereLight args={['#fff2e2', '#829a80', 1.25]} />
    <directionalLight position={[-8, 12, 4]} intensity={2.1} color={props.golden ? '#ffdeb3' : '#fff1d8'} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} shadow-camera-far={45} shadow-normalBias={0.045} shadow-bias={-0.0004} />
    <directionalLight position={[8, 5, -6]} intensity={0.55} color="#c5dfd7" />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.11, 0]} receiveShadow><planeGeometry args={[180, 180]} /><meshStandardMaterial color="#a9bb89" roughness={1} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0.7]} receiveShadow onClick={event => {
      event.stopPropagation();
      if (props.running && event.delta < 5 && cameraGesture.allowsClick()) destination.current = new THREE.Vector3(THREE.MathUtils.clamp(event.point.x, -6.5, 6.5), 0, THREE.MathUtils.clamp(event.point.z, -1.5, 5.3));
    }}><planeGeometry args={[17, 10]} /><meshStandardMaterial color="#e4cfad" roughness={0.96} /></mesh>
    <mesh ref={marker} rotation={[-Math.PI / 2, 0, 0]} visible={false}><ringGeometry args={[0.17, 0.23, 24]} /><meshBasicMaterial color="#648f79" transparent opacity={0.65} depthWrite={false} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.019, -3.6]} receiveShadow><planeGeometry args={[16, 4.2]} /><meshStandardMaterial color="#8fa97a" roughness={1} /></mesh>
    <group position={[0.1, 0.12, -6.3]} scale={2.0}><LandmarkModel kind="park" animated={props.running} /></group>
    <group position={[5.3, 0.07, -1.0]} rotation={[0, -0.55, 0]} scale={1.4}><BuggyModel /></group>
    <group position={[-4.45, 0.08, -0.6]} scale={1.55}><BenchModel /></group>
    <group position={[6, 0.03, -2.8]} rotation={[0, -0.55, 0]} scale={1.2}><BenchModel /></group>
    {Array.from({ length: 12 }, (_, i) => <group key={i} position={[-8 + i * 1.55, 0, -9.5 - (i % 3) * 1.2]} scale={2.1 + (i % 3) * 0.35}><TreeModel variant={i % 3 === 0 ? 'cypress' : 'round'} /></group>)}
    {[[-7.4, 0, -3.2], [-8.6, 0, 1.5], [9.7, 0, -0.5], [8.6, 0, -5]].map((p, i) => <group key={i} position={p as [number, number, number]} scale={2.4 + i * 0.12}><TreeModel /></group>)}
    <group position={[-4.6, 0, -5.9]} scale={2.8}><TreeModel variant="palm" /></group>
    <group position={[4.7, 0, -6.3]} scale={2.5}><TreeModel variant="palm" /></group>
    <GardenDetails />
    {Array.from({ length: 23 }, (_, i) => <Pebble key={i} position={[-6.6 + i * 0.58, 0.13, -1.95]} scale={[0.31, 0.15, 0.2]} color="#d9d0b1" />)}
    {petals.map((p, i) => <group key={i} position={[p.x, 0.08, p.z]}><Pebble position={[0, 0.15, 0]} scale={[0.27, 0.24, 0.22]} color={i % 2 ? '#869d68' : '#95ab77'} /><Pebble position={[0.02, 0.32, 0.06]} scale={[0.085, 0.06, 0.085]} color={p.color} /></group>)}
    {[[-5.9, 0.3, 0.2], [-5.85, 0.25, 1.1], [-6, 0.3, 2.7], [6.8, 0.4, 2.8], [6.7, 0.26, 1.8], [-2.75, 0.16, -1.9]].map((p, i) => <Pebble key={i} position={p as [number, number, number]} scale={[0.65, 0.48, 0.55]} color={i % 2 ? '#91a574' : '#8a9e71'} />)}
    <group ref={player} position={[-0.4, 0.035, 3.3]} rotation={[0, 0.22, 0]}><BayBayModel scale={1.3} animated={props.running} locomotion={motion} /></group>
    <group ref={chest} position={[-3.25, 0.07, 0.7]}>
      {props.treasureFound ? <><mesh position={[0, 0.16, 0]} castShadow><boxGeometry args={[0.5, 0.3, 0.36]} /><meshStandardMaterial color="#3d8c81" roughness={0.9} /></mesh><mesh position={[0, 0.32, -0.08]} rotation={[-0.65, 0, 0]} castShadow><boxGeometry args={[0.52, 0.12, 0.38]} /><meshStandardMaterial color="#e9cc93" roughness={0.9} /></mesh></> : <>
        <Pebble position={[0, 0.06, 0]} scale={[0.34, 0.085, 0.27]} color="#a89570" />
        <mesh position={[0, 0.17, 0]} rotation={[0, 0, -0.3]}><sphereGeometry args={[0.065, 8, 6]} /><meshStandardMaterial color="#fae4a9" emissive="#f5d789" emissiveIntensity={0.5} /></mesh>
      </>}
    </group>
    <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={.09}
      minDistance={SF_GARDEN_CAMERA_LIMITS.minDistance} maxDistance={SF_GARDEN_CAMERA_LIMITS.maxDistance}
      minPolarAngle={SF_GARDEN_CAMERA_LIMITS.minPolar} maxPolarAngle={SF_GARDEN_CAMERA_LIMITS.maxPolar} rotateSpeed={.55} zoomSpeed={.7}
      onStart={() => { cameraMoving.current = false; destination.current = null; }}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }} />
  </>;
}

export default function ParkGardenScene(props: ParkGardenSceneProps) {
  return <Canvas shadows={{ type: THREE.PCFShadowMap, enabled: true }} camera={{ fov: 40, near: 0.1, far: 100 }} dpr={[1, 1.5]} frameloop={props.running ? 'always' : 'demand'} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }} style={{ touchAction: 'none' }}>
    <Garden {...props} />
  </Canvas>;
}
