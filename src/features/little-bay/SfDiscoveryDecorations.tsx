/** @jsxImportSource react */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SF_LANDMARKS, isOnLand, terrainHeight } from './sf-world';

function ClayBox({ position, scale, color }: { position: [number, number, number]; scale: [number, number, number]; color: string }) {
  return <mesh position={position} scale={scale} castShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={color} roughness={.9} /></mesh>;
}
function MemoryObject({ id, choice }: { id: string; choice: string }) {
  if (id === 'exploratorium') return <group>
    <ClayBox position={[0,.1,0]} scale={[.8,.2,.6]} color="#b1bca1"/>
    {['#cf836f','#95b074','#80afb9'].map((color,index)=><group key={color} position={[(index-1)*.23,.32,.14]}><mesh><cylinderGeometry args={[.075,.1,.28,10]}/><meshStandardMaterial color={color}/></mesh><mesh position={[0,.19,0]}><sphereGeometry args={[.085,10,8]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.2}/></mesh></group>)}
    <mesh position={[0,.6,-.15]}><octahedronGeometry args={[.19]}/><meshStandardMaterial color="#fff2c6" roughness={.4}/></mesh>
  </group>;
  if (id === 'salesforce') return <group><mesh position={[0,.1,0]}><cylinderGeometry args={[.3,.24,.2,12]}/><meshStandardMaterial color="#c89370"/></mesh><ClayBox position={[0,.44,0]} scale={[.04,.65,.04]} color="#65926d"/>{[-1,1].map(side=><mesh key={side} position={[side*.13,.48,0]} rotation={[0,0,side*-.7]} scale={[.16,.26,.06]}><sphereGeometry args={[1,10,8]}/><meshStandardMaterial color="#95b475"/></mesh>)}</group>;
  if (id === 'city-hall') return <group><ClayBox position={[0,.07,0]} scale={[.75,.14,.45]} color="#d6c99f"/>{[-.25,0,.25].map((x,index)=><mesh key={x} position={[x,.29+index*.06,0]}><coneGeometry args={[.12,.42+index*.12,index===1?4:12]}/><meshStandardMaterial color={['#7eaaa3','#b5a27d','#d2bf82'][index]}/></mesh>)}</group>;
  if (id === 'ocean-beach' && choice === 'castle') return <group>
    <ClayBox position={[0, .14, 0]} scale={[.7, .28, .58]} color="#ddc28a" />
    {[-.3, .3].flatMap(x => [-.23, .23].map(z => <group key={`${x}:${z}`} position={[x, 0, z]}>
      <mesh position={[0, .23, 0]} castShadow><cylinderGeometry args={[.13, .17, .46, 10]} /><meshStandardMaterial color="#e4c996" roughness={1} /></mesh>
      <mesh position={[0, .52, 0]} castShadow><coneGeometry args={[.16, .22, 10]} /><meshStandardMaterial color="#caa977" roughness={1} /></mesh>
    </group>))}<ClayBox position={[0, .65, 0]} scale={[.018, .43, .018]} color="#a47c55" /><ClayBox position={[.1, .8, 0]} scale={[.22, .13, .02]} color="#65988a" />
  </group>;
  if (id === 'park' && choice === 'picnic') return <group>
    <ClayBox position={[0, .022, 0]} scale={[1.1, .025, .82]} color="#d7917d" />
    {[-.35, 0, .35].map(x => <ClayBox key={x} position={[x, .04, 0]} scale={[.13, .008, .82]} color="#f2dfb9" />)}
    <ClayBox position={[.22, .18, -.16]} scale={[.27, .26, .23]} color="#b69565" />
    <mesh position={[-.15, .07, .13]}><cylinderGeometry args={[.16, .16, .018, 20]} /><meshStandardMaterial color="#fff6dc" roughness={.85} /></mesh>
    <mesh position={[-.15, .11, .13]}><sphereGeometry args={[.075, 12, 8]} /><meshStandardMaterial color="#c9865c" roughness={1} /></mesh>
  </group>;
  if (id === 'chinatown') return <group>
    <ClayBox position={[0, .42, 0]} scale={[.04, .84, .04]} color="#7d6950" /><ClayBox position={[.2, .86, 0]} scale={[.45, .035, .035]} color="#7d6950" />
    <mesh position={[.35, .65, 0]} scale={[.16, .21, .16]}><sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color="#c77d60" roughness={.85} /></mesh>
    <ClayBox position={[.35, .38, 0]} scale={[.018, .12, .018]} color="#d2b577" />
  </group>;
  return <group>
    <ClayBox position={[-.16, .26, 0]} scale={[.035, .5, .035]} color="#ad875d" /><ClayBox position={[.16, .26, 0]} scale={[.035, .5, .035]} color="#ad875d" />
    <ClayBox position={[0, .43, .01]} scale={[.5, .36, .05]} color="#fbefd2" />
    <ClayBox position={[0, .49, .043]} scale={[.42, .13, .008]} color={choice === 'copper' ? '#b27d57' : '#9fc4b7'} />
    <ClayBox position={[0, .34, .043]} scale={[.42, .15, .008]} color={['baker-beach', 'lands-end'].includes(id) ? '#d7bd82' : '#88a475'} />
    <mesh position={[.11, .52, .052]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.045, .045, .007, 16]} /><meshStandardMaterial color="#e2b869" roughness={.9} /></mesh>
  </group>;
}
function Discovery({ id, choice, running }: { id: string; choice: string; running: boolean }) {
  const group = useRef<THREE.Group>(null);
  const landmark = SF_LANDMARKS.find(place => place.id === id);
  useFrame((_, delta) => { if (running && group.current) group.current.scale.setScalar(THREE.MathUtils.damp(group.current.scale.x, 1, 5, Math.min(delta, .1))); });
  if (!landmark) return null;
  const candidates = id === 'exploratorium' ? [[-1.75, 1.9], [-2.1, 2.2]] : ['city-hall', 'salesforce', 'sf-state', 'stonestown', 'ucsf-parnassus', 'ucsf-mission-bay', 'oracle-park', 'transamerica'].includes(id) ? [[-1.5, 2.2], [1.5, 2.2], [0, 2.6]] : [[-1.1, 1.2], [.7, 1.3], [0, .7]];
  const offset = candidates.find(([dx, dz]) => isOnLand(landmark.position[0] + dx, landmark.position[1] + dz)) ?? [0, 0];
  const x = landmark.position[0] + offset[0], z = landmark.position[1] + offset[1];
  return <group ref={group} position={[x, terrainHeight(x, z) + .12, z]} scale={.05}><MemoryObject id={id} choice={choice} /></group>;
}
export default function SfDiscoveryDecorations({ discoveries, running }: { discoveries: Record<string, string>; running: boolean }) {
  return <group>{Object.entries(discoveries).map(([id, choice]) => <Discovery key={id} id={id} choice={choice} running={running} />)}</group>;
}
