import { useFrame, useThree } from '@react-three/fiber';
import { createElement, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { charApi } from '../actors/charApi';
import { playSound } from '../audio/hooks';
import { runtime } from '../core/runtime';
import { canStand, heightAt } from '../core/terrain';
import type { Bilingual } from '../core/types';
import { bubble } from '../game/flow';
import { flow } from '../game/flowStore';
import { registerFrameSystem, registerSceneSystem } from '../game/systemsRegistry';
import { spawnFx } from '../world/fx';
import { hideChip, patchChip, showChip } from './chip';
import { startActivity, tierFor, type ActivityRun } from './kit';
import { freeOnFoot, holdKeys, type HeldKeys } from './partc';
import { ensurePlaySounds3 } from './sounds3';
import { commitToy, placeAlong, registerToyWarmup, toyMesh, UP } from './toyMesh';
import { FRISBEE_ID, FRISBEE_NAME } from './zones3';

/**
 * Wave 5 · lane A · frisbee with BAYBAY (W5-A9, plan §3.2 A-toys: fetch / frisbee): on a lawn or a beach, 问 BAYBAY →
 * 玩飞盘. Tap the ground where to throw (desktop: click it, or E for a throw straight ahead); the frisbee sails there
 * (a spinning toy disc, 5–14 u out) and BAYBAY runs for it: there before it comes down, she catches it (a long one is 飞身接住！);
 * later, she picks it up — either way she brings it back to you. Five throws: ● one catch, ◆ three, ★ all five.
 *
 * BAYBAY is steered from this chunk's scene system (its useFrame runs after the brain's 10 Hz update, like the stair
 * race). The frisbee: ONE InstancedMesh of one disc (play/toyMesh.ts, +1 draw call while playing, 48 triangles), own
 * material, warmed as this chunk loads. The feet stay free (no lock); walking 25 u away ends it at no cost.
 */

registerToyWarmup('frisbee');
ensurePlaySounds3();

export const THROWS = 5;
export const THROW_MIN = 5, THROW_MAX = 14, THROW_KEY_DIST = 9;
/** Flight time for a throw of d u (s), and the height of its arc. */
export const flightTime = (d: number) => 0.8 + 0.07 * d;
const arcH = (d: number) => 1.4 + 0.08 * d;
/** She catches it when she is this near where it comes down, before it does. */
export const CATCH_R = 1.3;
export const LONG_CATCH = 10;
export const FRISBEE_LINES = {
  start: { zh: '点一下地面，扔到那儿！我去接～', en: 'Tap the ground to throw — I’ll fetch!' },
  caught: { zh: '接住啦！', en: 'Got it!' },
  leap: { zh: '飞身接住！', en: 'Diving catch!' },
  missed: { zh: '差一点！我去捡回来～', en: 'So close! I’ll fetch it!' },
  tooFar: { zh: '扔到那边就捡不回来啦，换个地方～', en: 'Can’t fetch it from there — pick another spot!' },
  done: { zh: '好好玩！再扔几次也行～', en: 'That was fun! Throw some more any time!' },
} satisfies Record<string, Bilingual>;

type Phase = 'ready' | 'fly' | 'fetch' | 'back';
interface Game {
  run: ActivityRun;
  phase: Phase;
  t: number;
  throws: number;
  catches: number;
  long: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  dur: number;
  dist: number;
  caught: boolean;
  start: { x: number; z: number };
}
let game0: Game | null = null;
let offFrame: (() => void) | null = null;
let offLayer: (() => void) | null = null;
let keys: HeldKeys | null = null;
let rounds = 0;

export const frisbeeState = (): Readonly<Game> | null => game0;

/** 问 BAYBAY → 玩飞盘. */
export function startFrisbee(): boolean {
  if (game0 || !freeOnFoot()) return false;
  const run = startActivity({ id: FRISBEE_ID, name: FRISBEE_NAME, better: 'higher' }, { onStop: () => cleanup() });
  if (!run) return false;
  rounds++;
  const p = runtime.player;
  game0 = { run, phase: 'ready', t: 0, throws: 0, catches: 0, long: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), dur: 1, dist: 0, caught: false, start: { x: p.x, z: p.z } };
  showChip({
    id: FRISBEE_ID, title: FRISBEE_NAME, icon: 'play', big: `0 / ${THROWS}`,
    line: runtime.input.device === 'touch' ? { zh: '点地面扔过去', en: 'Tap the ground to throw' } : { zh: '点地面扔过去，或按 E', en: 'Click the ground, or press E' },
    action: { label: { zh: '不玩了', en: 'Stop' }, run: () => { game0?.run.cancel(); } },
  });
  bubble(FRISBEE_LINES.start, 2600);
  flow.set({ quietUntil: performance.now() + 60000 });
  offFrame = registerFrameSystem('a-play-frisbee', step);
  offLayer = registerSceneSystem('a-play-frisbee', FrisbeeLayer);
  keys = holdKeys(['KeyE'], () => { keyThrow(); });
  return true;
}

/**
 * E on a keyboard: a throw THROW_KEY_DIST ahead where the camera looks (a bench or a wall there: a little to either side,
 * or shorter — never the 扔太远啦 line for a key press that had open lawn beside it).
 */
export function keyThrow(): boolean {
  const p = runtime.player, h = runtime.camera.yaw + Math.PI;
  for (const d of [THROW_KEY_DIST, 7, THROW_MIN]) for (const turn of [0, 0.35, -0.35, 0.7, -0.7]) {
    const x = p.x + Math.sin(h + turn) * d, z = p.z + Math.cos(h + turn) * d;
    if (canStand(x, z, 0.4)) return throwAt(x, z);
  }
  return throwAt(p.x + Math.sin(h) * THROW_KEY_DIST, p.z + Math.cos(h) * THROW_KEY_DIST);
}

/** Throw toward (x, z): clamped to THROW_MIN … THROW_MAX from the player; false when not ready or where she cannot go. */
export function throwAt(x: number, z: number): boolean {
  const g = game0;
  if (!g || g.phase !== 'ready') return false;
  const p = runtime.player;
  let dx = x - p.x, dz = z - p.z;
  const d0 = Math.hypot(dx, dz) || 1, d = Math.max(THROW_MIN, Math.min(THROW_MAX, d0));
  dx /= d0; dz /= d0;
  const tx = p.x + dx * d, tz = p.z + dz * d;
  if (!canStand(tx, tz, 0.4)) { bubble(FRISBEE_LINES.tooFar, 2200); return false; }
  runtime.player.heading = Math.atan2(dx, dz);
  charApi()?.emote('player', 'point');
  g.from.set(p.x + dx * 0.4, p.y + 0.9, p.z + dz * 0.4);
  g.to.set(tx, heightAt(tx, tz) + 0.08, tz);
  g.dist = d; g.dur = flightTime(d); g.t = 0; g.caught = false; g.phase = 'fly';
  g.throws++;
  playSound('play-pop', { pitch: 0.8 });
  patchChip(FRISBEE_ID, { big: `${g.throws} / ${THROWS}` });
  return true;
}

/** Where the frisbee is at time t of its flight (a toss curving a little to the side). */
export function discAt(g: Pick<Game, 'from' | 'to' | 'dur' | 'dist'>, t: number, out = new THREE.Vector3()): THREE.Vector3 {
  const k = Math.max(0, Math.min(1, t / g.dur));
  out.lerpVectors(g.from, g.to, k);
  out.y += Math.sin(k * Math.PI) * arcH(g.dist);
  const sx = -(g.to.z - g.from.z), sz = g.to.x - g.from.x, L = Math.hypot(sx, sz) || 1;
  const curve = Math.sin(k * Math.PI) * 0.12 * g.dist;
  out.x += (sx / L) * curve; out.z += (sz / L) * curve;
  return out;
}

const tmp = new THREE.Vector3();
function step(dt: number) {
  const g = game0;
  if (!g) return;
  g.t += dt;
  const p = runtime.player, b = runtime.guide;
  if (Math.hypot(p.x - g.start.x, p.z - g.start.z) > 25) { g.run.cancel(); return; }
  if (g.phase === 'fly') {
    // she is there before it comes down: a catch
    if (!g.caught && g.t > g.dur * 0.7 && Math.hypot(b.x - g.to.x, b.z - g.to.z) < CATCH_R) {
      g.caught = true; g.catches++;
      const leap = g.dist >= LONG_CATCH;
      if (leap) g.long++;
      bubble(leap ? FRISBEE_LINES.leap : FRISBEE_LINES.caught, 1600);
      charApi()?.emote('baybay', 'cheer');
      playSound('play-pop', { pitch: 1.3 });
      discAt(g, g.t, tmp);
      spawnFx('sparkle', tmp.x, tmp.y, tmp.z, { color: '#ffd27a', scale: 0.7, count: leap ? 12 : 6 });
      g.phase = 'back'; g.t = 0;
      return;
    }
    if (g.t >= g.dur) {
      spawnFx('dust', g.to.x, g.to.y, g.to.z, { scale: 0.4 });
      bubble(FRISBEE_LINES.missed, 1600);
      g.phase = 'fetch'; g.t = 0;
    }
    return;
  }
  if (g.phase === 'fetch') {
    if (Math.hypot(b.x - g.to.x, b.z - g.to.z) < 0.9 || g.t > 6) { g.phase = 'back'; g.t = 0; }
    return;
  }
  if (g.phase === 'back') {
    if (Math.hypot(b.x - p.x, b.z - p.z) < 1.8 || g.t > 8) {
      g.phase = 'ready'; g.t = 0;
      if (g.throws >= THROWS) finish(g);
    }
  }
}

function finish(g: Game) {
  const first = rounds === 1;
  g.run.end({
    tier: tierFor(g.catches, [1, 3, THROWS]),
    score: g.catches,
    detail: { zh: `接住 ${g.catches} / ${THROWS}${g.long ? ` · 飞身接 ${g.long} 次` : ''}`, en: `${g.catches} / ${THROWS} caught${g.long ? ` · ${g.long} diving` : ''}` },
    bestText: v => ({ zh: `上次接住 ${v} 个！`, en: `Last best: ${v}!` }),
    again: () => { startFrisbee(); },
  });
  if (first) setTimeout(() => bubble(FRISBEE_LINES.done, 2400), 2600);
}

function cleanup() {
  offFrame?.(); offFrame = null;
  keys?.off(); keys = null;
  hideChip(FRISBEE_ID);
  game0 = null;
  const off = offLayer;
  offLayer = null;
  setTimeout(() => off?.(), 50);
}

/** BAYBAY's target this frame (after the brain): beside you while you aim, to the landing spot, the frisbee, back to you. */
export function driveBaybay() {
  const g = game0;
  if (!g) return;
  const b = runtime.guide, p = runtime.player;
  b.state = 'idle';
  if (g.phase === 'fly' || g.phase === 'fetch') { b.target = { x: g.to.x, z: g.to.z }; b.run = true; return; }
  if (g.phase === 'back') { b.target = { x: p.x + Math.sin(p.heading + 1.2) * 1.2, z: p.z + Math.cos(p.heading + 1.2) * 1.2 }; b.run = true; return; }
  // ready: a step to your side, a little ahead, facing where you will throw
  const hx = p.x + Math.sin(p.heading + 0.9) * 1.8, hz = p.z + Math.cos(p.heading + 0.9) * 1.8;
  b.target = Math.hypot(b.x - hx, b.z - hz) > 0.6 ? { x: hx, z: hz } : null;
  b.run = false;
}

/** The disc this frame: in your hand, in the air (spinning, tilted), on the grass, in BAYBAY's mouth. */
export function updateDisc(mesh: THREE.InstancedMesh, time: number) {
  const g = game0;
  if (!g) { mesh.count = 0; return; }
  const p = runtime.player, b = runtime.guide;
  const at = new THREE.Vector3(), axis = UP.clone();
  if (g.phase === 'ready') at.set(p.x + Math.sin(p.heading - 0.6) * 0.45, p.y + 0.75, p.z + Math.cos(p.heading - 0.6) * 0.45);
  else if (g.phase === 'fly') {
    discAt(g, g.t, at);
    axis.set(Math.sin(time * 3) * 0.15, 1, Math.cos(time * 3) * 0.15).normalize();
  } else if (g.phase === 'fetch') at.copy(g.to);
  else at.set(b.x + Math.sin(b.heading) * 0.35, b.y + 0.62, b.z + Math.cos(b.heading) * 0.35);
  placeAlong(mesh, 0, at, axis, 0.58, 0.08, 0.58);
  mesh.setColorAt(0, DISC);
  commitToy(mesh, 1);
}
const DISC = new THREE.Color('#ff6b5b');

/** A tap / click on the ground: throw there (the ray from the camera down to the terrain). */
export function groundUnder(ndcX: number, ndcY: number, camera: THREE.Camera): { x: number; z: number } | null {
  const o = camera.position.clone(), d = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera).sub(o).normalize();
  for (let t = 0.5; t < 80; t += 0.25) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if (y <= heightAt(x, z)) return { x, z };
  }
  return null;
}

function FrisbeeLayer() {
  const camera = useThree(st => st.camera), gl = useThree(st => st.gl);
  const mesh = useMemo(() => toyMesh('frisbee', 'disc', 1), []);
  useEffect(() => () => { mesh.geometry.dispose(); mesh.dispose(); }, [mesh]);
  useEffect(() => {
    const canvas = gl.domElement;
    // a tap (a click without a drag) on the ground throws there, and never walks you there
    const click = (e: MouseEvent) => {
      if (e.target !== canvas || !game0 || game0.phase !== 'ready') return;
      const r = canvas.getBoundingClientRect();
      const hit = groundUnder(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1, camera);
      if (hit && throwAt(hit.x, hit.z)) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('click', click, true);
    return () => window.removeEventListener('click', click, true);
  }, [gl, camera]);
  useFrame(st => { driveBaybay(); updateDisc(mesh, st.clock.elapsedTime); });
  return createElement('primitive', { object: mesh });
}

/** tests */
export function __resetFrisbee() { game0?.run.cancel(); game0 = null; rounds = 0; }
