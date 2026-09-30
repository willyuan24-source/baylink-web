import { useFrame } from '@react-three/fiber';
import { createElement, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { heightAt } from '../core/terrain';
import { registerSceneSystem } from '../game/systemsRegistry';
import { commitToy, registerToyWarmup, toyMesh } from './toyMesh';

/**
 * Wave 7 · lane M · the mini-games' little toy props in the world, so each game has something to walk up to: the claw
 * machine's cabinet against the Musée Mécanique's wall and the fortune teller's booth beside it, the crabbing kit on
 * Pier 7, the bakery's table with its animal loaves. ONE InstancedMesh of boxes painted per instance (play/toyMesh.ts: the
 * 'ob-toy-inst' program the city's trees and lamps link already — no new program), mounted only while the player is
 * within PROPS_NEAR of a group: + 1 draw call and ≈ 12 triangles a box there, nothing elsewhere.
 */

/** A box in a group's own frame (+z faces the player's side): centre, size, colour. */
type Box = readonly [cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: string];
export interface PropGroup { id: string; x: number; z: number; yaw: number; scale: number; boxes: readonly Box[] }

/** The claw machine: a dark base, a red body, the glass box with a few prizes and the claw seen through it, the marquee. */
const CABINET: readonly Box[] = [
  [0, 0.2, 0, 1.0, 0.4, 0.8, '#3b2a20'],
  [0, 0.78, 0, 0.95, 0.76, 0.76, '#c8412f'],
  [0, 0.62, 0.39, 0.3, 0.26, 0.02, '#e0a94a'],
  [0, 1.2, 0.43, 0.95, 0.08, 0.18, '#f2e3c4'],
  [0, 1.62, 0, 0.9, 0.84, 0.7, '#9fd6dc'],
  [-0.24, 1.3, 0.36, 0.2, 0.17, 0.02, '#d9542c'],
  [0.04, 1.3, 0.36, 0.2, 0.17, 0.02, '#8a5d3b'],
  [0.3, 1.3, 0.36, 0.16, 0.2, 0.02, '#e3ac5c'],
  [0.05, 1.78, 0.36, 0.06, 0.34, 0.02, '#8b8f94'],
  [0.05, 1.6, 0.36, 0.2, 0.08, 0.02, '#d6dade'],
  [0, 2.18, 0.03, 1.0, 0.32, 0.8, '#f2e3c4'],
  [0, 2.18, 0.44, 0.88, 0.12, 0.02, '#c8412f'],
];
/** The fortune teller's booth: maroon, a gold top, a window with her face and the crystal ball, the card slot. */
const BOOTH: readonly Box[] = [
  [0, 0.12, 0, 1.0, 0.24, 0.8, '#3b2a20'],
  [0, 1.12, 0, 0.9, 1.76, 0.72, '#6b2f3a'],
  [0, 1.42, 0.37, 0.64, 0.66, 0.02, '#23363b'],
  [0, 1.52, 0.39, 0.17, 0.17, 0.02, '#f1d9b8'],
  [0, 1.63, 0.395, 0.22, 0.06, 0.02, '#c34a33'],
  [0, 1.26, 0.39, 0.16, 0.14, 0.02, '#bfe6ea'],
  [0, 0.82, 0.37, 0.32, 0.05, 0.02, '#23363b'],
  [0, 2.1, 0, 1.02, 0.2, 0.82, '#e0a94a'],
];

/** Crabbing kit on Pier 7's deck by the east rail: a blue bucket with a white rim, a cooler, a folded spare hoop net. */
const CRAB_KIT: readonly Box[] = [
  [0, 0.22, 0, 0.42, 0.44, 0.42, '#3f7fbf'],
  [0, 0.45, 0, 0.46, 0.04, 0.46, '#f4efe6'],
  [0, 0.43, 0, 0.36, 0.02, 0.36, '#2c5d80'],
  [0.75, 0.2, -0.1, 0.7, 0.4, 0.42, '#f1ece1'],
  [0.75, 0.43, -0.1, 0.72, 0.06, 0.44, '#c34a33'],
  [-0.6, 0.03, 0.05, 0.9, 0.06, 0.9, '#d9b44a'],
  [-0.6, 0.07, 0.05, 0.7, 0.02, 0.7, '#e9dcc0'],
];

/** The bakery's table on the pavement: legs, a floured top, three loaves (a boule, a crab, a turtle), a sign board. */
const BAKERY: readonly Box[] = [
  [-0.55, 0.4, -0.25, 0.08, 0.8, 0.08, '#6b4a33'],
  [0.55, 0.4, -0.25, 0.08, 0.8, 0.08, '#6b4a33'],
  [-0.55, 0.4, 0.25, 0.08, 0.8, 0.08, '#6b4a33'],
  [0.55, 0.4, 0.25, 0.08, 0.8, 0.08, '#6b4a33'],
  [0, 0.84, 0, 1.3, 0.08, 0.66, '#c9955c'],
  [0, 0.885, 0, 1.2, 0.01, 0.58, '#f7efe0'],
  [-0.38, 0.97, 0, 0.36, 0.18, 0.3, '#c98545'],
  [0.08, 0.96, 0.02, 0.4, 0.14, 0.28, '#d69848'],
  [0.08, 0.96, 0.2, 0.08, 0.06, 0.1, '#d69848'],
  [0.46, 0.95, 0, 0.3, 0.12, 0.3, '#b97a3e'],
  [0.46, 0.95, 0.19, 0.1, 0.08, 0.08, '#b97a3e'],
  [0, 1.45, -0.34, 0.9, 0.36, 0.04, '#f2e3c4'],
  [0, 1.45, -0.32, 0.8, 0.08, 0.02, '#c8412f'],
];

export const PROP_GROUPS: PropGroup[] = [
  // against the Pier 45 shed's south wall (the Musée Mécanique), facing south to the claw prompt (sfgames.ts CLAW_SPOT)
  { id: 'claw', x: -202.6, z: 69.25, yaw: 0, scale: 0.9, boxes: CABINET },
  // beside it on the same wall, facing south to the fortune prompt (FORTUNE_SPOT)
  { id: 'fortune', x: -199.4, z: 69.2, yaw: 0, scale: 0.9, boxes: BOOTH },
  // Pier 7's deck, 1.3 u out along the pier from the crab prompt, next to the east rail (sfgames.ts CRAB_SPOT)
  { id: 'crab', x: 74.1, z: -25.6, yaw: -0.16, scale: 1, boxes: CRAB_KIT },
  // the bakery's table against its east wall, facing the sourdough prompt (sfgames.ts DOUGH_SPOT)
  { id: 'sourdough', x: -194.9, z: 66.4, yaw: Math.PI / 2, scale: 1, boxes: BAKERY },
];
/** Mount the props within this many u of a group; unmount beyond PROPS_FAR. */
export const PROPS_NEAR = 90, PROPS_FAR = 110;
export const propBoxCount = () => PROP_GROUPS.reduce((n, g) => n + g.boxes.length, 0);

const KIND = 'm-sfgames';
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), at = new THREE.Vector3(), c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

/** Every box's world matrix and colour (the ground under each group from the terrain). */
export function placeProps(mesh: THREE.InstancedMesh, groups: readonly PropGroup[] = PROP_GROUPS, ground: (x: number, z: number) => number = heightAt): number {
  let i = 0;
  for (const g of groups) {
    const y0 = ground(g.x, g.z), cs = Math.cos(g.yaw), sn = Math.sin(g.yaw);
    q.setFromAxisAngle(UP, g.yaw);
    for (const [cx, cy, cz, sx, sy, sz, color] of g.boxes) {
      at.set(g.x + (cx * cs + cz * sn) * g.scale, y0 + cy * g.scale, g.z + (-cx * sn + cz * cs) * g.scale);
      mesh.setMatrixAt(i, m4.compose(at, q, sc.set(sx * g.scale, sy * g.scale, sz * g.scale)));
      mesh.setColorAt(i, c.set(color));
      i++;
    }
  }
  commitToy(mesh, i);
  return i;
}

function PropLayer() {
  const mesh = useMemo(() => toyMesh(KIND, 'box', propBoxCount()), []);
  useEffect(() => () => { mesh.geometry.dispose(); mesh.dispose(); }, [mesh]);
  // placed on the first frame and again once a second for a few seconds (the terrain's chunks there may still stream in)
  const st = useRef({ placed: 0, acc: 1 });
  useFrame((_, dt) => { const s = st.current; if (s.placed < 5 && (s.acc += dt) >= 1) { s.acc = 0; s.placed++; placeProps(mesh); } });
  return createElement('primitive', { object: mesh });
}

let offLayer: (() => void) | null = null;
let offWarm: (() => void) | null = null;
/** The zones say whether the player is near a group (with hysteresis there): mount / unmount the layer. */
export function setPropsNear(on: boolean) {
  offWarm ??= registerToyWarmup(KIND);
  if (on && !offLayer) offLayer = registerSceneSystem('m-play-props', PropLayer);
  else if (!on && offLayer) { offLayer(); offLayer = null; }
}
export const propsMounted = () => !!offLayer;
