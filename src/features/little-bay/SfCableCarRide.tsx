/** @jsxImportSource react */
import { useEffect, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BayBayModel, CableCarModel } from './SanFranciscoModels';
import type { SfVehicleState } from './sf-driving';
import { sampleSfCableCarRide, SF_CABLE_CAR_SECONDS } from './sf-cable-car-ride';

export default function SfCableCarRide({ vehicleRef, running, onComplete }: {
  vehicleRef: MutableRefObject<SfVehicleState>; running: boolean; onComplete?: () => void;
}) {
  const body = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const complete = useRef(false);
  const callback = useRef(onComplete);
  useEffect(() => { callback.current = onComplete; }, [onComplete]);
  useFrame((_, delta) => {
    if (running && !complete.current) elapsed.current = Math.min(SF_CABLE_CAR_SECONDS, elapsed.current + Math.min(delta, .1));
    const next = sampleSfCableCarRide(elapsed.current);
    vehicleRef.current = { x: next.x, z: next.z, heading: next.heading, speed: running ? 1 : 0 };
    if (body.current) {
      body.current.position.set(next.x, next.y, next.z);
      const turn = Math.atan2(Math.sin(next.heading - body.current.rotation.y), Math.cos(next.heading - body.current.rotation.y));
      body.current.rotation.y += turn * (1 - Math.exp(-Math.min(delta, .1) * 7));
    }
    if (running && next.progress === 1 && !complete.current) { complete.current = true; callback.current?.(); }
  });
  const start = sampleSfCableCarRide(0);
  return <group ref={body} position={[start.x, start.y, start.z]} rotation={[0, start.heading, 0]}>
    <CableCarModel tracks={false} />
    <group position={[0, .43, .94]}><BayBayModel scale={.43} animated={false} /></group>
  </group>;
}
