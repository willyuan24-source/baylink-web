/** @jsxImportSource react */
import { useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { MessageCircle } from 'lucide-react';
import * as THREE from 'three';
import { BayBayModel } from './SanFranciscoModels';
import { SF_LANDMARKS, terrainHeight, isOnLand } from './sf-world';
import { SF_RESIDENTS } from './sf-exploration';

const residents = SF_RESIDENTS.map(resident => ({ ...resident, hat: resident.id === 'fern' ? 'sun' : 'cap' }));

function Resident({ resident, running, locale, onInteract }: { resident: typeof residents[number]; running: boolean; locale?: string; onInteract?: (id: string) => void }) {
  const anchor = SF_LANDMARKS.find(place => place.id === resident.landmarkId);
  const [near, setNear] = useState(false);
  const lastNear = useRef(false);
  const body = useRef<THREE.Group>(null);
  const point = useRef(new THREE.Vector3());
  const offset = anchor && [[1.35, 1.1], [-1.4, .8], [0, 1.3], [0, 0]].find(([x, z]) => isOnLand(anchor.position[0] + x, anchor.position[1] + z));
  const x = (anchor?.position[0] || 0) + (offset?.[0] || 0), z = (anchor?.position[1] || 0) + (offset?.[1] || 0);
  const y = terrainHeight(x, z) + .1;
  useFrame(({ camera, clock }) => {
    point.current.set(x, y, z);
    const close = camera.position.distanceToSquared(point.current) < 24 * 24;
    if (lastNear.current !== close) { lastNear.current = close; setNear(close); }
    if (body.current && running && close) body.current.rotation.z = Math.sin(clock.elapsedTime * 1.4 + x) * .025;
  });
  if (!anchor) return null;
  return <group position={[x, y, z]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.47, 24]} /><meshStandardMaterial color="#e2d6b6" roughness={1} /></mesh>
    <group ref={body} scale={.59} rotation={[0, .6, 0]}>
      <BayBayModel animated={false} />
      <mesh position={[0, 1.38, .02]}><cylinderGeometry args={[.25, .29, .13, 16]} /><meshStandardMaterial color={resident.color} roughness={.9} /></mesh>
      <mesh position={[0, 1.33, resident.hat === 'sun' ? .01 : .12]} scale={[1, 1, resident.hat === 'sun' ? 1 : .8]}><cylinderGeometry args={[resident.hat === 'sun' ? .4 : .29, resident.hat === 'sun' ? .4 : .29, .035, 16]} /><meshStandardMaterial color={resident.hat === 'sun' ? '#d9bd87' : resident.color} roughness={.9} /></mesh>
      <mesh position={[-.28, .64, .2]} rotation={[0, 0, -.3]}><boxGeometry args={[.23, .27, .08]} /><meshStandardMaterial color={resident.color} roughness={.9} /></mesh>
    </group>
    {near && <Html center position={[0, 1.22, 0]} zIndexRange={[7, 4]}><button className="sf-resident-marker" onClick={event => { event.stopPropagation(); onInteract?.(resident.id); }} onPointerDown={event => event.stopPropagation()} aria-label={locale === 'en' ? `Meet ${resident.name}, a system resident` : `认识${resident.name}，系统居民`}><MessageCircle size={13} /><span>{resident.name}</span></button></Html>}
  </group>;
}

export default function SfWorldResidents(props: { running: boolean; locale?: string; onInteract?: (id: string) => void }) {
  return <group>{residents.map(resident => <Resident key={resident.id} resident={resident} {...props} />)}</group>;
}
