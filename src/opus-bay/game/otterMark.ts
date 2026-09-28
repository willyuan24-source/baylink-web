import { useFrame } from '@react-three/fiber';
import { createElement, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { cityTerrain } from '../core/terrain';
import type { Vec2 } from '../core/types';
import { makeModelMaterial, type ModelMaterial } from '../world/modelMaterial';
import { meshWarmup, registerWarmup } from '../world/warmup';
import { registerSceneSystem } from './systemsRegistry';

/**
 * Wave 5 · lane C · W5-C7 (plan §3.5 "each resident's second favour leaves a mark: Luz paints a tiny otter in Balmy
 * Alley"): once Luz's second favour is done, a small painted board with an otter — BAYBAY, as Luz saw her — leans on
 * the alley's fence beside where Luz paints (game/residentTasks.ts loads this module then; city only).
 *
 * One plain Mesh (a 0.72 × 0.72 × 0.04 u board, 12 triangles, one draw call, no shadow cast) on its own instance of
 * D2's model material (the TOY look on a texture, like lane H2b's mural boards: world/sf/murals.ts), the otter painted
 * on a 256² canvas here (an original drawing: no real mural is copied). Shown only while the camera is within
 * OTTER_RANGE u; built once the terrain under it has streamed in. Warm-up: 'c-otter' (recipe of world/warmup.ts).
 */

/** Balmy Alley's frame (world/sf/landmarks/balmy-alley.ts: origin on the centreline, yaw 50.4°, the fences at |x| 1.64) */
const ALLEY = { x: 456.8, z: 653.4, yaw: (50.4 * Math.PI) / 180 };
/** the board in the alley's frame: against the +x fence (its face toward the alley), 1.2 u short of where Luz paints */
export const OTTER_LOCAL = { x: 1.5, z: 0.4 } as const;
export const OTTER_SIZE = 0.72;
export const OTTER_RANGE = 140;

/** alley frame → world (the site kit's convention: x' = x cos + z sin, z' = −x sin + z cos) */
export function otterSpot(): Vec2 & { yaw: number } {
  const c = Math.cos(ALLEY.yaw), s = Math.sin(ALLEY.yaw), { x, z } = OTTER_LOCAL;
  // the painted face looks toward −x of the alley frame (into the alley): its yaw is the frame's −π/2
  return { x: ALLEY.x + x * c + z * s, z: ALLEY.z - x * s + z * c, yaw: ALLEY.yaw - Math.PI / 2 };
}

/** The otter, painted on a canvas (a warm mural field, the cream otter face with its teal scarf, a small heart). */
function paintOtter(): HTMLCanvasElement {
  const S = 256, cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  if (!g) return cv;
  // the field: two warm bands and a sun, like the alley's colour fields
  g.fillStyle = '#f0ad4e'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#e8734a'; g.fillRect(0, S * 0.62, S, S * 0.38);
  g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(S * 0.8, S * 0.2, S * 0.1, 0, Math.PI * 2); g.fill();
  // ears, head
  g.fillStyle = '#f7ecd9'; g.strokeStyle = '#5b4636'; g.lineWidth = 6;
  for (const ex of [0.33, 0.67]) { g.beginPath(); g.arc(S * ex, S * 0.3, S * 0.08, 0, Math.PI * 2); g.fill(); g.stroke(); }
  g.beginPath(); g.ellipse(S * 0.5, S * 0.5, S * 0.3, S * 0.27, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  // eyes, nose, mouth, whiskers
  g.fillStyle = '#2b211b';
  for (const ex of [0.4, 0.6]) { g.beginPath(); g.arc(S * ex, S * 0.46, S * 0.03, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.ellipse(S * 0.5, S * 0.54, S * 0.045, S * 0.032, 0, 0, Math.PI * 2); g.fill();
  g.lineWidth = 4; g.strokeStyle = '#2b211b';
  g.beginPath(); g.arc(S * 0.47, S * 0.59, S * 0.03, 0.1, Math.PI - 0.4); g.stroke();
  g.beginPath(); g.arc(S * 0.53, S * 0.59, S * 0.03, 0.4, Math.PI - 0.1); g.stroke();
  g.lineWidth = 3;
  for (const [a, b] of [[-1, -0.02], [-1, 0.04], [1, -0.02], [1, 0.04]] as const) { g.beginPath(); g.moveTo(S * (0.5 + a * 0.08), S * (0.56 + b)); g.lineTo(S * (0.5 + a * 0.24), S * (0.53 + b * 2)); g.stroke(); }
  // cheeks
  g.fillStyle = 'rgba(232, 115, 74, .45)';
  for (const ex of [0.33, 0.67]) { g.beginPath(); g.arc(S * ex, S * 0.56, S * 0.04, 0, Math.PI * 2); g.fill(); }
  // the teal scarf
  g.fillStyle = '#2f8f88'; g.beginPath(); g.ellipse(S * 0.5, S * 0.8, S * 0.26, S * 0.07, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(S * 0.6, S * 0.8, S * 0.07, S * 0.14);
  // a small heart
  g.fillStyle = '#d9534f'; g.beginPath();
  const hx = S * 0.18, hy = S * 0.2, r = S * 0.035;
  g.arc(hx - r, hy, r, Math.PI, 0); g.arc(hx + r, hy, r, Math.PI, 0); g.lineTo(hx, hy + r * 2.6); g.closePath(); g.fill();
  return cv;
}

let texture: THREE.Texture | null = null;
let material: ModelMaterial | null = null;
/** the board's texture and its own material instance (made once, kept for the session: its program stays compiled) */
function otterMaterial(): ModelMaterial {
  if (material) return material;
  texture = new THREE.CanvasTexture(paintOtter());
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  material = makeModelMaterial({ map: texture, variant: 'ob-model-inst', inst: [0, 1, 0, 0.015], name: 'c-otter' });
  return material;
}
const boardGeometry = () => new THREE.BoxGeometry(OTTER_SIZE, OTTER_SIZE, 0.04);
/** the warm-up's board (kept: the set never disposes a geometry it was given) */
let warmGeo: THREE.BufferGeometry | null = null;

function boardMesh(): THREE.Mesh {
  const m = new THREE.Mesh(boardGeometry(), otterMaterial());
  m.name = 'c-otter';
  m.castShadow = false;
  m.receiveShadow = true;
  m.visible = false;
  m.matrixAutoUpdate = false;
  return m;
}

interface BoardState { placed: boolean; acc: number }
/** ≈ 2 Hz: place the board once the ground under it has streamed in; show it only while the camera is near. */
function stepBoard(mesh: THREE.Mesh, st: BoardState, camera: THREE.Camera, dt: number, spot: ReturnType<typeof otterSpot>) {
  if ((st.acc += dt) < 0.5) return;
  st.acc = 0;
  const near = Math.hypot(camera.position.x - spot.x, camera.position.z - spot.z) <= OTTER_RANGE;
  if (near && !st.placed) {
    const t = cityTerrain();
    // the chunk itself (2 u DEM), not the far DEM heightAt falls back to while it streams in
    if (!t || t.standAt(spot.x, spot.z) === -1) return;
    const y = t.heightAt(spot.x, spot.z) ?? 0;
    // standing on the ground, leaning 8° back against the fence
    mesh.position.set(spot.x, y + OTTER_SIZE / 2 + 0.06, spot.z);
    mesh.rotation.set(-0.14, spot.yaw, 0, 'YXZ');
    mesh.updateMatrix();
    st.placed = true;
  }
  mesh.visible = near && st.placed;
}

function OtterBoard() {
  const mesh = useMemo(() => boardMesh(), []);
  useEffect(() => () => { mesh.geometry.dispose(); }, [mesh]);
  const spot = useMemo(() => otterSpot(), []);
  const state = useRef<BoardState>({ placed: false, acc: 0 });
  useFrame(({ camera }, dt) => stepBoard(mesh, state.current, camera, dt, spot));
  return createElement('primitive', { object: mesh });
}

/** Show the board (Luz's second favour is done). Returns the disposer. */
export function initOtterMark(): () => void {
  const offWarm = registerWarmup('c-otter', () => meshWarmup(otterMaterial(), { geometry: (warmGeo ??= boardGeometry()), receiveShadow: true }));
  const offScene = registerSceneSystem('c-otter', OtterBoard);
  return () => { offScene(); offWarm(); };
}
