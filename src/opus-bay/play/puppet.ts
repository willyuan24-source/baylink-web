import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Wave 5 · lane A · where the two heroes' bodies are DRAWN while an activity carries them along a line of its own (the
 * Seward slides): a pose per body, applied every frame after the actors placed them (this layer is a scene system of
 * game/systemsRegistry: mounted inside <Systems/>, its useFrame runs after Actors' in the same frame, before the render).
 *
 * Only the drawing moves: runtime.player / runtime.guide stay where the activity parked them (standable ground), so the
 * controller never finds the player inside the chutes' blocker. The activity puts them where the ride ends before it
 * lets go of the bodies. Nothing here changes the actors' own state; a body without a pose is left alone.
 */

export interface PuppetPose {
  x: number;
  y: number;
  z: number;
  /** yaw (three.js rotation.y: facing (sin h, cos h)) */
  heading: number;
  /** nose down (+) / up (−), radians, about the body's own right axis */
  pitch?: number;
  roll?: number;
}
export type PuppetWho = 'player' | 'baybay';

const poses: Record<PuppetWho, PuppetPose | null> = { player: null, baybay: null };
const NAMES: Record<PuppetWho, string> = { player: 'opus-player', baybay: 'opus-baybay' };

/** Draw `who` at `pose` from the next frame on (null: the actors place it again). */
export function setPuppet(who: PuppetWho, pose: PuppetPose | null) { poses[who] = pose ? { ...pose } : null; }
export const puppetPose = (who: PuppetWho): Readonly<PuppetPose> | null => poses[who];
export const puppetActive = () => !!(poses.player || poses.baybay);

const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const found: Record<PuppetWho, THREE.Object3D | null> = { player: null, baybay: null };

/** The body object (the player's rig mesh; BAYBAY's procedural mesh or GLB group), found once and again after a swap. */
function body(scene: THREE.Object3D, who: PuppetWho): THREE.Object3D | null {
  const cur = found[who];
  if (cur && cur.parent) return cur;
  // BAYBAY lives beside the player in the actors' root (her GLB replaces the procedural body there)
  const player = found.player?.parent ? found.player : scene.getObjectByName(NAMES.player) ?? null;
  const root = player?.parent ?? scene;
  found[who] = who === 'player' ? player : root.children.find(o => o.name === NAMES.baybay) ?? scene.getObjectByName(NAMES.baybay) ?? null;
  return found[who];
}

/** Apply the poses to a scene's bodies (the layer every frame; tests with a stub scene). */
export function applyPuppets(scene: THREE.Object3D) {
  for (const who of ['player', 'baybay'] as const) {
    const pose = poses[who];
    if (!pose) continue;
    const o = body(scene, who);
    if (!o) continue;
    o.position.set(pose.x, pose.y, pose.z);
    euler.set(pose.pitch ?? 0, pose.heading, pose.roll ?? 0, 'YXZ');
    o.quaternion.setFromEuler(euler);
  }
}

/** The scene system an activity mounts while it carries the bodies (registerSceneSystem('a-play-puppet', PuppetLayer)). */
export function PuppetLayer() {
  const scene = useThree(s => s.scene);
  useFrame(() => applyPuppets(scene));
  return null;
}

/** tests / teardown */
export function resetPuppets() { poses.player = null; poses.baybay = null; found.player = null; found.baybay = null; }
