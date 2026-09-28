import { useFrame, useThree } from '@react-three/fiber';
import { createElement, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { charApi } from '../actors/charApi';
import { playSound } from '../audio/hooks';
import { input } from '../core/input';
import { runtime } from '../core/runtime';
import { canStand, heightAt, surfaceAt } from '../core/terrain';
import type { Bilingual } from '../core/types';
import { bubble, teleportPlayer } from '../game/flow';
import { flow } from '../game/flowStore';
import { registerFrameSystem, registerSceneSystem } from '../game/systemsRegistry';
import { spawnFx } from '../world/fx';
import { cardboardMesh, registerCardboardWarmup } from './cardboard';
import { hideChip, patchChip, showChip } from './chip';
import { startActivity, tierFor, type ActivityRun } from './kit';
import { freeOnFoot, holdKeys, type HeldKeys } from './partc';
import { applyPuppets, setPuppet } from './puppet';
import { ensurePlaySounds2 } from './sounds2';
import { SLED, SLED_ID, SLED_NAME, SLEDDABLE, sledIt, sledOffer, SLED_PROMPT_R, slopeAt } from './zones3';

/**
 * Wave 5 · lane A · the cardboard sled on steep grass (W5-A9, plan §3.2 A-toys): standing on a grassy slope steeper than
 * 1 in 4, 滑草 (phone: the contextual button; desktop: E) sits you on a sheet of cardboard and you slide down the fall
 * line: gravity down the slope less the cardboard's rub, steer with the stick / A D, hold 跳 / Space to lean back and
 * go faster; off the grass (a path, a road) the cardboard stops you. BAYBAY runs down beside you. The card: how far
 * you slid (● 6 u, ◆ 15, ★ 30), the longest kept.
 *
 * The body is drawn on the cardboard, tipped with the slope (play/puppet.ts), while runtime.player follows it (the
 * camera and the streaming follow the player). The feet are held (PlayKit's lock); the ride ends by itself.
 * The sheet is the Seward slides' cardboard (play/cardboard.ts: the same kind of object, its warm-up).
 */

registerCardboardWarmup();
ensurePlaySounds2();



export const SLED_TIERS: readonly [number, number, number] = [6, 15, 30];

export const SLED_LINES = {
  go: { zh: '坐稳啦——冲！', en: 'Hold tight — go!' },
  far: { zh: '滑了好远！草地真滑～', en: 'What a slide! This grass is slippery!' },
  short: { zh: '嘿嘿，找个更陡的坡试试？', en: 'Hehe, try a steeper slope?' },
} satisfies Record<string, Bilingual>;

export interface Sled { x: number; z: number; vx: number; vz: number; dist: number; top: number }
/** One step of the slide (pure): down the fall line less the rub, the steer across, a stop off the grass or at a wall. */
export function sledStep(s: Sled, dt: number, steer: number, lean: boolean): 'go' | 'stop' {
  const sl = slopeAt(s.x, s.z);
  const sp = Math.hypot(s.vx, s.vz);
  const on = SLEDDABLE.has(surfaceAt(s.x, s.z) ?? '');
  const mu = (lean ? SLED.muLean : SLED.mu) * (on ? 1 : SLED.offGrass);
  let ax = SLED.g * sl.grade * sl.dx, az = SLED.g * sl.grade * sl.dz;
  if (sp > 1e-3) {
    ax -= (SLED.g * mu * s.vx) / sp; az -= (SLED.g * mu * s.vz) / sp;
    // steering: across the way you slide
    ax += (steer * SLED.steer * s.vz) / sp; az -= (steer * SLED.steer * s.vx) / sp;
  }
  const nvx = s.vx + ax * dt, nvz = s.vz + az * dt;
  // the rub never pushes you back uphill
  if (sp > 1e-3 && nvx * s.vx + nvz * s.vz < 0 && sl.grade < mu) { s.vx = 0; s.vz = 0; return 'stop'; }
  s.vx = nvx; s.vz = nvz;
  const v = Math.min(SLED.maxS, Math.hypot(s.vx, s.vz));
  if (v < 0.25 && sl.grade < mu && s.dist > 0.5) return 'stop';
  const k = v / (Math.hypot(s.vx, s.vz) || 1);
  s.vx *= k; s.vz *= k;
  const nx = s.x + s.vx * dt, nz = s.z + s.vz * dt;
  if (!canStand(nx, nz, 0.35)) return 'stop';
  s.dist += Math.hypot(nx - s.x, nz - s.z);
  s.x = nx; s.z = nz;
  s.top = Math.max(s.top, v);
  return 'go';
}

interface Ride { run: ActivityRun; s: Sled; t: number; phase: 'sit' | 'slide' | 'done' }
let ride: Ride | null = null;
let offFrame: (() => void) | null = null;
let offLayer: (() => void) | null = null;
let rounds = 0;
let touchSteer = 0;
let keys: HeldKeys | null = null;
let wasManual = false, resitAt = 0;

export const sledState = (): Readonly<Ride> | null => ride;

/** 滑草 (the prompt that follows you on a steep lawn). */
export function startSled(): boolean {
  const p = runtime.player;
  if (ride || !freeOnFoot() || !sledOffer(p.x, p.z)) return false;
  const run = startActivity({ id: SLED_ID, name: SLED_NAME, better: 'higher' }, { lock: true, onStop: () => cleanup() });
  if (!run) return false;
  rounds++;
  const sl = slopeAt(p.x, p.z);
  ride = { run, s: { x: p.x, z: p.z, vx: sl.dx * 0.8, vz: sl.dz * 0.8, dist: 0, top: 0 }, t: 0, phase: 'sit' };
  p.heading = Math.atan2(sl.dx, sl.dz);
  charApi()?.emote('player', 'sit', { loop: true });
  showChip({ id: SLED_ID, title: SLED_NAME, icon: 'slide', big: '0 u', line: runtime.input.device === 'touch' ? { zh: '摇杆转向 · 按住「跳」躺下更快', en: 'Stick to steer · hold Hop to go faster' } : { zh: 'A D 转向 · 按住 空格 更快', en: 'A D to steer · hold Space to go faster' } });
  bubble(SLED_LINES.go, 1800);
  sledIt.radius = 0;
  flow.set({ quietUntil: performance.now() + 15000 });
  offFrame = registerFrameSystem('a-play-sled', step);
  // A / D and the arrows are the sled's (captured: a held key would stand you up off the cardboard)
  keys = holdKeys(['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight']);
  offLayer = registerSceneSystem('a-play-sled', SledLayer);
  return true;
}

/** Phones: the stick steers (its x); desktop A / D arrive through runtime.input.moveX as well. */
export function setSledSteer(x: number) { touchSteer = x; }

function step(dt: number) {
  const r = ride;
  if (!r) return;
  r.t += dt;
  if (r.phase === 'sit') { if (r.t > 0.5) { r.phase = 'slide'; r.t = 0; playSound('play-whoosh', { gain: 0.7 }); } return; }
  if (r.phase === 'done') { if (r.t > 0.8) finish(r); return; }
  const kx = (keys?.isDown('KeyD') || keys?.isDown('ArrowRight') ? 1 : 0) - (keys?.isDown('KeyA') || keys?.isDown('ArrowLeft') ? 1 : 0);
  const steer = Math.max(-1, Math.min(1, kx + runtime.input.moveX + touchSteer));
  // a thumb on the stick steers too; lifting it sits you back down (a stick move ends the sit pose)
  if (wasManual && !input.manualMove && r.t > resitAt) { resitAt = r.t + 0.3; charApi()?.emote('player', 'sit', { loop: true }); }
  wasManual = input.manualMove;
  const lean = input.jumpHeld;
  const res = sledStep(r.s, Math.min(dt, 1 / 30), steer, lean);
  const p = runtime.player;
  p.x = r.s.x; p.z = r.s.z; p.y = heightAt(r.s.x, r.s.z);
  const sp = Math.hypot(r.s.vx, r.s.vz);
  if (sp > 0.3) p.heading = Math.atan2(r.s.vx, r.s.vz);
  patchChip(SLED_ID, { big: `${r.s.dist.toFixed(0)} u` });
  if (Math.random() < dt * sp * 0.6) spawnFx('dust', p.x, p.y, p.z, { scale: 0.35, color: '#9bbf73' });
  if (res === 'stop' || r.t > 20) { r.phase = 'done'; r.t = 0; spawnFx('dust', p.x, p.y, p.z, { scale: 0.7 }); }
}

function finish(r: Ride) {
  const d = r.s.dist, first = rounds === 1;
  teleportPlayer({ x: r.s.x, z: r.s.z }, runtime.player.heading);
  r.run.end({
    tier: tierFor(d, SLED_TIERS),
    score: +d.toFixed(1),
    detail: { zh: `滑了 ${d.toFixed(0)} u · 最快 ${r.s.top.toFixed(1)} u/s`, en: `${d.toFixed(0)} u slid · top ${r.s.top.toFixed(1)} u/s` },
    bestText: v => ({ zh: `最远滑过 ${v.toFixed(0)} u！`, en: `Your longest: ${v.toFixed(0)} u!` }),
  });
  bubble(d >= SLED_TIERS[1] ? SLED_LINES.far : d < SLED_TIERS[0] ? SLED_LINES.short : SLED_LINES.go, 2400);
  if (first) charApi()?.emote('baybay', 'clap');
}

function cleanup() {
  offFrame?.(); offFrame = null;
  hideChip(SLED_ID);
  keys?.off(); keys = null;
  charApi()?.stand();
  setPuppet('player', null);
  sledIt.radius = SLED_PROMPT_R;
  ride = null;
  touchSteer = 0;
  const off = offLayer;
  offLayer = null;
  setTimeout(() => off?.(), 50);
}

/** tests */
export function cancelSled() { ride?.run.cancel(); }

// --- the layer: the body tipped with the slope on the cardboard; BAYBAY running beside --------------------------------

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);

export function updateSled(mesh: THREE.InstancedMesh, scene: THREE.Object3D | null) {
  const r = ride;
  if (!r) { mesh.count = 0; setPuppet('player', null); return; }
  const p = runtime.player, h = p.heading, fx = Math.sin(h), fz = Math.cos(h);
  const pitch = Math.atan2(heightAt(p.x - fx * 0.5, p.z - fz * 0.5) - heightAt(p.x + fx * 0.5, p.z + fz * 0.5), 1);
  setPuppet('player', { x: p.x, y: p.y + 0.04, z: p.z, heading: h, pitch });
  if (scene) applyPuppets(scene);
  e.set(pitch, h, 0, 'YXZ');
  mesh.setMatrixAt(0, m4.compose(pos.set(p.x, p.y + 0.05, p.z), q.setFromEuler(e), one));
  mesh.count = 1;
  mesh.instanceMatrix.needsUpdate = true;
  // BAYBAY runs down beside you
  const g = runtime.guide;
  g.state = 'idle';
  g.target = { x: p.x + Math.cos(h) * 1.6, z: p.z - Math.sin(h) * 1.6 };
  g.run = r.phase === 'slide';
}

function SledLayer() {
  const scene = useThree(st => st.scene);
  const mesh = useMemo(() => cardboardMesh(1), []);
  useEffect(() => () => { mesh.geometry.dispose(); mesh.dispose(); }, [mesh]);
  useFrame(() => updateSled(mesh, scene));
  return createElement('primitive', { object: mesh });
}

/** tests */
export function __resetSled() { ride?.run.cancel(); ride = null; rounds = 0; }
