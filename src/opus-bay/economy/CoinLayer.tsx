import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { coinGeometry, coinMaterial, makeMesh, writeCoin } from './coinMesh';
import { coinWorld, MAX_DRAWN } from './coins';

/**
 * Wave 5 · lane E · W5-E3: the coin layer, a scene system (game/systemsRegistry registerSceneSystem('e-coins')): draws
 * coinWorld.visible (+ the pops) at ≤ 30 Hz into one InstancedMesh (economy/coinMesh.ts: the disc, its material, the motion).
 */
export function CoinLayer() {
  const scene = useThree(s => s.scene);
  const ref = useRef<{ mesh: THREE.InstancedMesh; at: number } | null>(null);
  useEffect(() => {
    const geo = coinGeometry(), mat = coinMaterial();
    const mesh = makeMesh(geo, mat, MAX_DRAWN + 8);
    mesh.count = 0;
    mesh.visible = false;
    scene.add(mesh);
    ref.current = { mesh, at: -1e9 };
    return () => { mesh.removeFromParent(); geo.dispose(); mat.dispose(); mesh.dispose(); ref.current = null; };
  }, [scene]);
  useFrame(() => {
    const r = ref.current, w = coinWorld;
    if (!r) return;
    const now = performance.now();
    if (now - r.at < 33) return;
    r.at = now;
    const { mesh } = r;
    if (!w || (!w.visible.length && !w.popping.length)) { if (mesh.visible) { mesh.visible = false; mesh.count = 0; } return; }
    const t = now / 1000;
    let k = 0;
    for (const i of w.visible) { if (!w.isTaken(i)) k = writeCoin(mesh, k, w.items[i], t); }
    for (const [i, at] of w.popping) { if (k >= mesh.instanceMatrix.count) break; k = writeCoin(mesh, k, w.items[i], t, Math.min(1, (now - at) / 350)); }
    mesh.count = k;
    mesh.visible = k > 0;
    mesh.instanceMatrix.needsUpdate = true;
  });
  return null;
}
