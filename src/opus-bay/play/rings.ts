import { useFrame } from '@react-three/fiber';
import { createElement, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { GLIDE, terrainGlideWorld } from '../actors/glide';
import { LiveTall } from '../actors/glideTall';
import { patchToyShader } from '../world/materials';
import { registerWarmup } from '../world/warmup';
import { flightState, RING_R } from './firstFlight';

/**
 * Wave 5 · lane A · the first flight's rings (W5-A5; the Golden Gate course's too, W5-A9, drawn without the coins: it pays
 * by its medal): ONE InstancedMesh (+1 draw call while the flight runs, 8 × 124
 * = 992 triangles), each instance a gold ring with a coin in the middle, facing along the course. The next ring glows
 * and pulses, the ones after it are dimmer, a missed one greys out, a caught one is gone (scale 0).
 *
 * Material: the TOY program of the instanced tinted props (same patch, same cache key 'ob-toy-inst', so no new shader
 * program), its own instance (one material per object kind), registered with the warm-up at this chunk's load.
 * aInfo.w = −2.3: never dither-faded between camera and player, and self-lit (glow 1.3: bright at dusk too).
 */

const GOLD = new THREE.Color('#f2c14e');
const COIN = new THREE.Color('#e0a94a');
const RIM = new THREE.Color('#fff1c9');

let material: THREE.MeshStandardMaterial | null = null;
function ringMaterial() {
  if (material) return material;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 });
  m.name = 'a-play-rings';
  m.onBeforeCompile = shader => { patchToyShader(shader, { sway: false }); };
  m.customProgramCacheKey = () => 'ob-toy-inst';
  return (material = m);
}

function paint(g: THREE.BufferGeometry, color: THREE.Color, rim?: THREE.Color): THREE.BufferGeometry {
  const n = g.getAttribute('position').count;
  const c = new Float32Array(n * 3), info = new Float32Array(n * 4);
  const nor = g.getAttribute('normal');
  for (let i = 0; i < n; i++) {
    // the ring's outer face a touch lighter: reads as gold leaf in the toy light
    const k = rim && Math.abs(nor.getZ(i)) > 0.5 ? rim : color;
    c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b;
    info[i * 4 + 3] = -2.3;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
  return g;
}

/** One ring + its coin, facing +z (the course direction after the instance's yaw). */
export function ringGeometry(): THREE.BufferGeometry {
  const torus = paint(new THREE.TorusGeometry(RING_R, 0.34, 3, 16).toNonIndexed(), GOLD, RIM);
  const coin = new THREE.CylinderGeometry(1.15, 1.15, 0.24, 7, 1).toNonIndexed();
  coin.rotateX(Math.PI / 2);
  paint(coin, COIN);
  const parts = [torus, coin];
  const merged = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color', 'aInfo'] as const) {
    const size = parts[0].getAttribute(name).itemSize;
    const total = parts.reduce((s, p) => s + p.getAttribute(name).count, 0);
    const arr = new Float32Array(total * size);
    let at = 0;
    for (const p of parts) { const a = p.getAttribute(name).array as Float32Array; arr.set(a, at); at += a.length; }
    merged.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  // the torus comes first: a draw range of its vertices shows the rings without their coins (the Golden Gate course)
  merged.userData.ringOnly = torus.getAttribute('position').count;
  for (const p of parts) p.dispose();
  return merged;
}

export function ringsMesh(capacity = 8): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(ringGeometry(), ringMaterial(), capacity);
  mesh.name = 'a-play-rings';
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.count = 0;
  return mesh;
}

registerWarmup('a-play-rings', () => {
  const m = ringsMesh(1);
  m.count = 1;
  m.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 30, 0));
  return { objects: [m], dispose: () => { m.geometry.dispose(); } };
});

// --- the live glide floor (the course's envelope while flying) --------------------------------------------------------

const live = new LiveTall();
const world = terrainGlideWorld(() => live.get());
/** The glide's floor near (x, z) right now: the ground and every roof / tall structure within its roof search + the ring. */
export function glideFloor(x: number, z: number): number {
  return Math.max(world.heightAt(x, z), world.roofAt(x, z, GLIDE.floorR + RING_R));
}

// --- the layer ---------------------------------------------------------------------------------------------------------

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();

function update(mesh: THREE.InstancedMesh) {
  const s = flightState();
  if (!s) { mesh.count = 0; return; }
  const n = Math.min(s.rings.length, mesh.instanceMatrix.count);
  for (let i = 0; i < n; i++) {
    const r = s.rings[i];
    const prev = i ? s.rings[i - 1] : { x: r.x - (s.rings[1].x - r.x), z: r.z - (s.rings[1].z - r.z) };
    q.setFromAxisAngle(up, Math.atan2(r.x - prev.x, r.z - prev.z));
    const next = i === s.next && s.phase !== 'finale';
    const k = r.got ? 0 : next ? 1.12 + 0.1 * Math.sin(s.clock * 5) : 1;
    pos.set(r.x, r.y + Math.sin(s.clock * 1.6 + i) * 0.35, r.z);
    scl.setScalar(k);
    mesh.setMatrixAt(i, m4.compose(pos, q, scl));
    const glow = r.missed ? 0.42 : next ? 1.18 + 0.2 * Math.sin(s.clock * 5) : 0.78;
    mesh.setColorAt(i, col.setRGB(glow, glow * (r.missed ? 1 : 0.98), glow * (r.missed ? 1.05 : 0.9)));
  }
  mesh.count = n;
  mesh.geometry.setDrawRange(0, s.course === 'ggb' ? (mesh.geometry.userData.ringOnly as number) : Infinity);
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

/** The scene system (game/systemsRegistry registerSceneSystem) the first flight mounts while it runs. */
export function RingsLayer() {
  const mesh = useMemo(() => ringsMesh(8), []);
  useEffect(() => () => { mesh.geometry.dispose(); mesh.dispose(); }, [mesh]);
  useFrame(() => update(mesh));
  return createElement('primitive', { object: mesh });
}
