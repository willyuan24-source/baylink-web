/** @jsxImportSource react */
import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

type V3 = [number, number, number];
type Detail = { position: V3; scale: V3; color: string; rotation?: V3 };

const SOFT = new THREE.SphereGeometry(1, 12, 8);
const STEM = new THREE.CylinderGeometry(0.5, 0.5, 1, 7);
const TIP = new THREE.ConeGeometry(0.5, 1, 7);
const CLAY = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 });
const LANTERN = new THREE.MeshStandardMaterial({ color: '#fff2d2', roughness: 0.52, emissive: '#f6d89e', emissiveIntensity: 0.22 });
const greens = ['#8ca270', '#96ac7b', '#819963', '#a0b585', '#8fa475'];
const bloomColors = ['#fff2d9', '#e4ab98', '#efd490', '#f8e8c8', '#d5a49b'];

function random(seed: number) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function DetailBatch({ items, geometry = SOFT, material = CLAY, castShadow = true }: {
  items: Detail[];
  geometry?: THREE.BufferGeometry;
  material?: THREE.Material;
  castShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    items.forEach((item, i) => {
      transform.position.set(...item.position);
      transform.scale.set(...item.scale);
      transform.rotation.set(...(item.rotation ?? [0, 0, 0]));
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
      mesh.setColorAt(i, color.set(item.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={castShadow} receiveShadow dispose={null} />;
}

/** Non-colliding garden dressing: ground edges, low flowers and two lanterns. */
export const GardenDetails = memo(function GardenDetails() {
  const details = useMemo(() => {
    const lawns: Detail[] = [];
    const leaves: Detail[] = [];
    const flowers: Detail[] = [];
    const stems: Detail[] = [];
    const blades: Detail[] = [];
    const stones: Detail[] = [];
    const hardware: Detail[] = [];
    const globes: Detail[] = [];

    const grassTuft = (x: number, z: number, seed: number, size = 1) => {
      for (let blade = 0; blade < 4; blade++) {
        const r = random(seed + blade * 0.89);
        const a = blade * 1.74 + seed;
        blades.push({
          position: [x + Math.cos(a) * 0.07 * size, (0.1 + r * 0.06) * size, z + Math.sin(a) * 0.07 * size],
          scale: [0.08 * size, (0.21 + r * 0.13) * size, 0.066 * size],
          rotation: [Math.cos(a) * 0.26, a, Math.sin(a) * 0.26],
          color: greens[blade % greens.length],
        });
      }
    };

    // Scalloped turf softens the rectangular walking pocket without placing
    // tall foliage in the playable x[-6.5,6.5], z[-1.5,5.3] area.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 22; i++) {
        const seed = i + (side + 2) * 33;
        const x = side * (8.47 + random(seed) * 0.22);
        const z = -4.1 + i * 0.47;
        lawns.push({ position: [x, -0.012, z], scale: [0.46 + random(seed + 1) * 0.22, 0.09, 0.4 + random(seed + 2) * 0.18], color: greens[i % greens.length] });
        grassTuft(x + side * 0.12, z, seed, 0.85 + random(seed + 3) * 0.5);
        if (i % 2 === 0) leaves.push({ position: [x + side * 0.31, 0.2, z], scale: [0.3, 0.23, 0.32], color: greens[(i + 2) % greens.length] });
      }
    }

    // Back border follows the planting strip; its central opening keeps the
    // conservatory entrance readable from both the desktop and portrait camera.
    for (let i = 0; i < 30; i++) {
      const x = -8 + i * 0.55;
      const z = -4.51 - random(i + 300) * 0.27;
      if (Math.abs(x) < 1.2) continue;
      lawns.push({ position: [x, 0.012, z], scale: [0.44, 0.13, 0.42], color: greens[i % greens.length] });
      grassTuft(x, z + 0.24, 300 + i, 0.9);
      if (i % 3 === 0) leaves.push({ position: [x, 0.26, z], scale: [0.43, 0.3, 0.37], color: greens[(i + 1) % greens.length] });
    }

    // Flowers cluster by the bench, then thin out along the far borders. The
    // low bench-side leaves are decoration, never hidden movement obstacles.
    const flowerBeds: [number, number, number][] = [
      [-5.79, -0.91, 8], [-5.9, -0.24, 7], [-6.13, 0.48, 7], [-6.2, 1.35, 6],
      [-5.52, -1.45, 6], [-4.85, -1.58, 5], [-4.02, -1.7, 5],
      [-8.31, 2.5, 4], [-8.36, 4.15, 4], [8.37, 1.15, 4], [8.4, 3.77, 4],
      [-6.67, -4.36, 4], [-3.9, -4.5, 4], [3.76, -4.45, 4], [6.32, -4.54, 4],
    ];
    flowerBeds.forEach(([cx, cz, count], bedIndex) => {
      const seed = 600 + bedIndex * 43;
      lawns.push({ position: [cx, 0.015, cz], scale: [0.37, 0.042, 0.3], color: '#91a574' });
      for (let i = 0; i < count; i++) {
        const a = i * 2.399 + random(seed) * 3;
        const spread = Math.sqrt((i + 1) / count) * 0.3;
        const x = cx + Math.cos(a) * spread;
        const z = cz + Math.sin(a) * spread;
        const height = 0.21 + random(seed + i) * 0.18;
        const size = 0.064 + random(seed + i + 1) * 0.025;
        const petalColor = bloomColors[(i + bedIndex) % bloomColors.length];
        stems.push({ position: [x, height / 2, z], scale: [0.017, height, 0.017], color: '#789064' });
        for (const side of [-1, 1]) leaves.push({
          position: [x + Math.cos(a) * side * 0.064, height * 0.44, z + Math.sin(a) * side * 0.064],
          scale: [0.084, 0.023, 0.037], rotation: [0, -a, side * 0.3], color: greens[(i + 1) % greens.length],
        });
        for (let petal = 0; petal < 5; petal++) {
          const angle = petal * Math.PI * 2 / 5;
          flowers.push({
            position: [x + Math.cos(angle) * size * 0.55, height + 0.02, z + Math.sin(angle) * size * 0.55],
            scale: [size * 0.63, size * 0.35, size * 0.5], rotation: [0, -angle, 0], color: petalColor,
          });
        }
        flowers.push({ position: [x, height + 0.044, z], scale: [size * 0.38, size * 0.27, size * 0.38], color: '#dfbe76' });
      }
    });

    [[-6.26, -0.65], [-6.33, 1.01], [-5.83, 1.73], [-5.25, -1.5], [8.35, 1.93], [-8.27, 3.39]].forEach(([x, z], i) => {
      stones.push({ position: [x, 0.11, z], scale: [0.22 + random(i) * 0.1, 0.14, 0.18], rotation: [0, i * 0.73, 0], color: i % 2 ? '#c6bda3' : '#b5ae92' });
    });

    [[-6.5, -3], [7, -3]].forEach(([x, z]) => {
      const metal = '#3c6b5b';
      hardware.push(
        { position: [x, 0.11, z], scale: [0.38, 0.22, 0.38], color: metal },
        { position: [x, 0.32, z], scale: [0.24, 0.22, 0.24], color: metal },
        { position: [x, 1.23, z], scale: [0.107, 1.75, 0.107], color: metal },
        { position: [x, 1.94, z], scale: [0.22, 0.09, 0.22], color: metal },
        { position: [x, 2.085, z], scale: [0.28, 0.065, 0.28], color: metal },
        { position: [x, 2.59, z], scale: [0.38, 0.07, 0.38], color: metal },
      );
      globes.push({ position: [x, 2.35, z], scale: [0.165, 0.235, 0.165], color: '#ffffff' });
      blades.push({ position: [x, 2.685, z], scale: [0.3, 0.15, 0.3], color: metal });
      leaves.push({ position: [x, 2.792, z], scale: [0.035, 0.062, 0.035], color: metal });
    });

    return { lawns, leaves, flowers, stems, blades, stones, hardware, globes };
  }, []);

  return <group>
    <DetailBatch items={details.lawns} castShadow={false} />
    <DetailBatch items={details.leaves} />
    <DetailBatch items={details.flowers} castShadow={false} />
    <DetailBatch items={details.stems} geometry={STEM} castShadow={false} />
    <DetailBatch items={details.blades} geometry={TIP} />
    <DetailBatch items={details.stones} />
    <DetailBatch items={details.hardware} geometry={STEM} />
    <DetailBatch items={details.globes} material={LANTERN} castShadow={false} />
  </group>;
});
