/** @jsxImportSource react */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createRoadGeometry, createTerrainGeometry } from './san-francisco-geometry';
import { bayHeight, type BayPoint } from './unified-bay-world';
import { makeUrbanFabric } from './urban-fabric';

type Part = { position: [number, number, number]; size: [number, number, number]; angle?: number; color: string };

function Instances({ parts, shape = 'box' }: { parts: Part[]; shape?: 'box' | 'roof' | 'tree' }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const object = new THREE.Object3D(), color = new THREE.Color();
    parts.forEach((part, index) => {
      object.position.set(...part.position); object.scale.set(...part.size);
      object.rotation.set(0, part.angle ?? 0, 0); object.updateMatrix();
      mesh.current!.setMatrixAt(index, object.matrix); mesh.current!.setColorAt(index, color.set(part.color));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [parts]);
  if (!parts.length) return null;
  return <instancedMesh ref={mesh} args={[undefined, undefined, parts.length]} receiveShadow>
    {shape === 'tree' ? <icosahedronGeometry args={[1, 1]}/> : shape === 'roof' ? <coneGeometry args={[.7071, 1, 4]}/> : <boxGeometry/>}
    <meshStandardMaterial roughness={.94}/>
  </instancedMesh>;
}

/** Persistent city silhouettes, seven instanced meshes and two merged ground meshes. No per-frame rebuilds. */
export default function UrbanFabric() {
  const scene = useMemo(() => {
    const fabric = makeUrbanFabric();
    const bodies: Part[] = [], roofs: Part[] = [], pitched: Part[] = [], windows: Part[] = [], porches: Part[] = [], trunks: Part[] = [], canopies: Part[] = [];
    for (const b of fabric.buildings) {
      const top = b.base + b.height;
      bodies.push({ position: [b.x, b.base + b.height / 2, b.z], size: [b.width, b.height, b.depth], angle: b.angle, color: b.color });
      if (b.gabled) pitched.push({ position: [b.x, top + .22, b.z], size: [b.width + .2, .44, b.depth + .2], angle: b.angle + Math.PI / 4, color: b.roof });
      else roofs.push({ position: [b.x, top + .075, b.z], size: [b.width + .15, .15, b.depth + .15], angle: b.angle, color: b.roof });
      const dx = Math.sin(b.angle) * (b.depth / 2 + .015), dz = Math.cos(b.angle) * (b.depth / 2 + .015);
      const levels = b.height > 3.2 ? 3 : b.height > 1.9 ? 2 : 1;
      for (let level = 1; level <= levels; level++) {
        windows.push({ position: [b.x + dx, b.base + b.height * level / (levels + 1), b.z + dz], size: [b.width * .62, .2, .035], angle: b.angle, color: '#628c84' });
      }
      if (!b.gabled && b.height < 2.3) {
        porches.push({ position: [b.x + dx, b.base + .57, b.z + dz], size: [b.width * .75, .1, .44], angle: b.angle, color: b.roof });
      }
    }
    fabric.trees.forEach((tree, index) => {
      trunks.push({ position: [tree.x, tree.y + .5 * tree.scale, tree.z], size: [.13, tree.scale, .13], color: '#9b8566' });
      canopies.push({ position: [tree.x, tree.y + 1.05 * tree.scale, tree.z], size: [.65 * tree.scale, .78 * tree.scale, .65 * tree.scale], color: index % 3 ? '#94b18b' : '#b0bd92' });
    });
    const gardens = fabric.gardens.map(garden => [-1, 1].flatMap((x, i) => (i ? [1, -1] : [-1, 1]).map(z => {
      const dx = x * garden.width / 2, dz = z * garden.depth / 2;
      return [garden.x + dx * Math.cos(garden.angle) + dz * Math.sin(garden.angle), garden.z - dx * Math.sin(garden.angle) + dz * Math.cos(garden.angle)] as BayPoint;
    })));
    return { bodies, roofs, pitched, windows, porches, trunks, canopies,
      streets: createRoadGeometry(fabric.streets, bayHeight, 0, .052), gardens: createTerrainGeometry(gardens, bayHeight, .048) };
  }, []);
  useEffect(() => () => { scene.streets.dispose(); scene.gardens.dispose(); }, [scene]);
  return <group>
    <mesh geometry={scene.streets}><meshStandardMaterial color="#b3bdab" roughness={1} side={THREE.DoubleSide}/></mesh>
    <mesh geometry={scene.gardens}><meshStandardMaterial color="#9caf84" roughness={1} side={THREE.DoubleSide}/></mesh>
    <Instances parts={scene.bodies}/><Instances parts={scene.roofs}/><Instances parts={scene.pitched} shape="roof"/>
    <Instances parts={scene.windows}/><Instances parts={scene.porches}/>
    <Instances parts={scene.trunks}/><Instances parts={scene.canopies} shape="tree"/>
  </group>;
}
