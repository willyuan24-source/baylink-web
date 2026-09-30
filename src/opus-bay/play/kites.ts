import { useFrame } from '@react-three/fiber';
import { createElement, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { heightAt } from '../core/terrain';
import { bayNow } from '../game/bayNow';
import { registerSceneSystem } from '../game/systemsRegistry';
import { U } from '../world/materials';
import { MARINA_STRIP } from './kiteEntry';
import { KITE_PARTS, commitKites, kiteAt, kiteMesh, placeKite, registerKiteWarmup } from './kiteKind';

/**
 * Wave 7 · lane W2 · Marina Green's kites (sf-w7-lead §3 W2 (2)): the lawn BAYBAY's r2 line and her arrival call "the
 * city's kite-flying lawn" had none. Four toy kites staked on strings along the lawn by day, riding the sea breeze
 * (higher and livelier in the afternoon), each a sail with a waving tail: ONE InstancedMesh of the kite kind
 * (play/kiteKind.ts, +1 draw call, 80 triangles) mounted by play/kiteEntry.ts only near the lawn by day.
 *
 * Marina Green is a kite-flying lawn with a steady bay breeze from the west, liveliest in the afternoon —
 * https://goldengatepark.com/marina-green-park.html , https://sanfranciscojeeptours.com/attractions/marina-green/
 * (read 2026-09-29).
 */

registerKiteWarmup();


interface Ambient { t: number; line: number; e: number; yaw: number; sail: THREE.Color; tail: THREE.Color; phase: number }
/** where along the lawn each kite is staked (0 … 1 from its south-east end) and how it flies */
export const AMBIENT: readonly Ambient[] = [
  { t: 0.18, line: 10.5, e: 0.95, yaw: -0.1, sail: new THREE.Color('#e8483c'), tail: new THREE.Color('#f2c14e'), phase: 0 },
  { t: 0.42, line: 12.5, e: 1.05, yaw: 0.12, sail: new THREE.Color('#2f7fd0'), tail: new THREE.Color('#ffffff'), phase: 1.7 },
  { t: 0.63, line: 9.0, e: 0.85, yaw: -0.05, sail: new THREE.Color('#f2c14e'), tail: new THREE.Color('#e8483c'), phase: 3.1 },
  { t: 0.86, line: 11.5, e: 1.0, yaw: 0.2, sail: new THREE.Color('#3fae6a'), tail: new THREE.Color('#b98ad6'), phase: 4.4 },
];

/** A stake on the lawn's midline (play/kiteEntry MARINA_STRIP, the city's park rings) at `t` (0 = its south-east end). */
export function stakeAt(t: number, out = new THREE.Vector3()): THREE.Vector3 {
  const { a, b } = MARINA_STRIP, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
  return out.set(x, heightAt(x, z) + 0.15, z);
}

/** The breeze 0.6 … 1.3 (stronger from about 13:00 to 18:00 on the game's day clock `hour`), with a slow swell. */
export function breeze(hour: number, time: number): number {
  const afternoon = hour >= 12 && hour <= 19 ? Math.sin(((hour - 12) / 7) * Math.PI) : 0;
  return 0.7 + 0.35 * afternoon + 0.12 * Math.sin(time * 0.21) + 0.06 * Math.sin(time * 0.77);
}

/** Kites show by day only: the night factor of the sky (U.uNight 0 day … 1 night) below this. */
export const KITE_NIGHT_MAX = 0.35;

const anchor = new THREE.Vector3(), at = new THREE.Vector3();

/** Pose the ambient kites for this frame; returns the instance count. */
export function poseAmbient(mesh: THREE.InstancedMesh, time: number, hour: number, cam: THREE.Vector3): number {
  if (U.uNight.value > KITE_NIGHT_MAX) return 0;
  const w = breeze(hour, time);
  let i = 0;
  for (const k of AMBIENT) {
    stakeAt(k.t, anchor);
    const bob = Math.sin(time * 0.9 + k.phase) * 0.06 + Math.sin(time * 2.3 + k.phase * 2) * 0.025 * w;
    const e = Math.min(1.25, k.e * (0.8 + 0.2 * w) + bob), yaw = k.yaw + Math.sin(time * 0.37 + k.phase) * 0.14 * w;
    kiteAt(anchor, k.line * (0.85 + 0.15 * w), e, yaw, at);
    i = placeKite(mesh, i, { anchor, kite: at, t: time + k.phase, sail: k.sail, tail: k.tail }, cam);
  }
  return i;
}

/** The scene layer (mounted near the lawn by day: play/kiteEntry.ts). */
function KitesLayer() {
  const mesh = useMemo(() => kiteMesh(AMBIENT.length * KITE_PARTS), []);
  useEffect(() => () => { mesh.dispose(); }, [mesh]);
  const clock = useMemo(() => ({ hour: 15, next: 0 }), []);
  useFrame(st => {
    const now = st.clock.elapsedTime;
    if (now >= clock.next) { clock.next = now + 5; clock.hour = bayHourNow(); }
    commitKites(mesh, poseAmbient(mesh, now, clock.hour, st.camera.position));
  });
  return createElement('primitive', { object: mesh });
}

/** The Bay clock (game/bayNow: ?date= on the dev server), hours 0 … 24 */
export function bayHourNow(): number {
  const d = bayNow();
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(d);
    return Number(parts.find(p => p.type === 'hour')?.value ?? 15) + Number(parts.find(p => p.type === 'minute')?.value ?? 0) / 60;
  } catch { return 15; }
}

/** Mount the ambient kites (returns the unmount). */
export function mountKites(): () => void {
  return registerSceneSystem('w2-kites', KitesLayer);
}
