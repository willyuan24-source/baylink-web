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
import { commitToy, registerToyWarmup, toyMesh } from './toyMesh';
import { BALL_ID, BALL_NAME } from './zones3';

/**
 * Wave 5 · lane A · beach-ball keepy-uppy (W5-A9, plan §3.2 A-toys): on the sand, 问 BAYBAY → 玩沙滩球. A big striped ball
 * floats up and drifts down; its shadow on the sand shows where. You and BAYBAY take turns: on your turn you walk under it
 * by yourself (the game steers your feet), and a tap on the shadow — desktop: a click on it, E or Space — bumps it up
 * again when it is low enough (the shadow ring turns gold then); BAYBAY bumps hers. Tapped too early nothing happens;
 * it touches the sand and the rally is over. ● 3 bumps in a row, ◆ 8, ★ 15; the best rally is kept.
 *
 * ONE InstancedMesh (play/toyMesh.ts 'beachball': the ball and a flattened copy as its shadow, +1 draw call while playing,
 * 2 × 80 triangles), own material, warmed as this chunk loads. Your feet are walked under the ball on your turn (a
 * path to where it comes down); 不玩了 or the stick ends it at no cost.
 */

registerToyWarmup('beachball');
ensurePlaySounds3();

/** The ball's float: gravity (u/s²), a bump's lift (u/s), the bump window (height over the sand, u), its size (u). */
export const BALL = { g: 5.5, lift: 6.8, lo: 0.25, hi: 1.7, r: 0.42, drift: [1.4, 3.2] as const };
export const BALL_TIERS: readonly [number, number, number] = [3, 8, 15];
export const BALL_LINES = {
  start: { zh: '我先发球！轮到你时，等影子变金色就点它～', en: 'I’ll serve! On your turn, tap the shadow when it turns gold!' },
  early: { zh: '还高着呢，等它落下来～', en: 'Still high — let it come down!' },
  drop: { zh: '哎呀，落地啦！', en: 'Oops, it landed!' },
  good: { zh: '好球！', en: 'Nice one!' },
} satisfies Record<string, Bilingual>;

type Who = 'player' | 'baybay';
interface Rally {
  run: ActivityRun;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  turn: Who;
  bumps: number;
  over: number;
  start: { x: number; z: number };
  lastEarly: number;
}
let rally: Rally | null = null;
let offFrame: (() => void) | null = null;
let offLayer: (() => void) | null = null;
let keys: HeldKeys | null = null;
let rounds = 0;

export const ballState = (): Readonly<Rally> | null => rally;

/** Where the ball comes down (on the sand at its height 0 over the ground), from its motion now. */
export function landing(pos: THREE.Vector3, vel: THREE.Vector3): { x: number; z: number; t: number } {
  const ground = heightAt(pos.x, pos.z) + BALL.r, h = pos.y - ground;
  const t = (vel.y + Math.sqrt(Math.max(0, vel.y * vel.y + 2 * BALL.g * h))) / BALL.g;
  return { x: pos.x + vel.x * t, z: pos.z + vel.z * t, t };
}
/** The ball's height over the sand under it. */
export const ballHeight = (pos: THREE.Vector3) => pos.y - (heightAt(pos.x, pos.z) + BALL.r);
/** Low enough to bump (the shadow turns gold)? */
export const bumpable = (pos: THREE.Vector3, vel: THREE.Vector3) => vel.y < 0 && ballHeight(pos) >= BALL.lo && ballHeight(pos) <= BALL.hi;

/** 问 BAYBAY → 玩沙滩球. */
export function startBall(): boolean {
  if (rally || !freeOnFoot()) return false;
  const run = startActivity({ id: BALL_ID, name: BALL_NAME, better: 'higher' }, { cancelOnMove: true, onStop: () => cleanup() });
  if (!run) return false;
  rounds++;
  const p = runtime.player, b = runtime.guide;
  rally = {
    run, pos: new THREE.Vector3(b.x, b.y + 1.2, b.z), vel: new THREE.Vector3(), turn: 'baybay', bumps: 0, over: 0, start: { x: p.x, z: p.z }, lastEarly: -Infinity,
  };
  // BAYBAY serves it over to you
  serve(rally, 'player');
  showChip({
    id: BALL_ID, title: BALL_NAME, icon: 'play', big: '0',
    line: runtime.input.device === 'touch' ? { zh: '影子变金色时点它', en: 'Tap the shadow when it turns gold' } : { zh: '影子变金色时点它，或按 E', en: 'Click the gold shadow, or press E' },
    action: { label: { zh: '不玩了', en: 'Stop' }, run: () => { rally?.run.cancel(); } },
  });
  if (rounds === 1) bubble(BALL_LINES.start, 3000);
  flow.set({ quietUntil: performance.now() + 60000 });
  offFrame = registerFrameSystem('a-play-ball', step);
  offLayer = registerSceneSystem('a-play-ball', BallLayer);
  keys = holdKeys(['KeyE', 'Space'], () => { bump('player'); });
  return true;
}

/** Send the ball up toward `to`'s side: a lift and a drift to a sand spot 1.4–3.2 u from where it is. */
function serve(r: Rally, to: Who) {
  const other = to === 'player' ? runtime.player : runtime.guide;
  const dx = other.x - r.pos.x, dz = other.z - r.pos.z, L = Math.hypot(dx, dz) || 1;
  let tx = r.pos.x, tz = r.pos.z;
  for (let k = 0; k < 8; k++) {
    const d = BALL.drift[0] + Math.random() * (BALL.drift[1] - BALL.drift[0]), a = (Math.random() - 0.5) * 1.2;
    const ux = (dx / L) * Math.cos(a) - (dz / L) * Math.sin(a), uz = (dz / L) * Math.cos(a) + (dx / L) * Math.sin(a);
    tx = r.pos.x + ux * d; tz = r.pos.z + uz * d;
    if (canStand(tx, tz, 0.5)) break;
    tx = r.pos.x; tz = r.pos.z;
  }
  r.vel.set(0, BALL.lift, 0);
  const t = landing(r.pos, r.vel).t;
  r.vel.x = (tx - r.pos.x) / t; r.vel.z = (tz - r.pos.z) / t;
  r.turn = to;
  // your turn: your feet walk you under it (once per serve: its landing does not move)
  if (to === 'player') runtime.player.pathTarget = { x: tx, z: tz };
}

/** A bump by `who` (the player's tap / E; BAYBAY's own when the ball is low over her). */
export function bump(who: Who): boolean {
  const r = rally;
  if (!r || r.over > 0 || r.turn !== who) return false;
  if (!bumpable(r.pos, r.vel)) {
    if (who === 'player' && runtime.time - r.lastEarly > 2.5 && ballHeight(r.pos) > BALL.hi) { r.lastEarly = runtime.time; bubble(BALL_LINES.early, 1400); }
    return false;
  }
  r.bumps++;
  playSound('play-pop', { pitch: 0.9 + Math.min(10, r.bumps) * 0.04 });
  spawnFx('sparkle', r.pos.x, r.pos.y, r.pos.z, { color: '#fff3b0', scale: 0.5, count: 5 });
  charApi()?.emote(who, 'cheer');
  patchChip(BALL_ID, { big: String(r.bumps) });
  if (r.bumps === BALL_TIERS[1]) bubble(BALL_LINES.good, 1400);
  serve(r, who === 'player' ? 'baybay' : 'player');
  return true;
}

function step(dt: number) {
  const r = rally;
  if (!r) return;
  if (r.over > 0) { if ((r.over -= dt) <= 0) finish(r); return; }
  r.vel.y -= BALL.g * dt;
  r.pos.addScaledVector(r.vel, dt);
  // BAYBAY bumps hers as it comes low over her
  if (r.turn === 'baybay' && bumpable(r.pos, r.vel) && ballHeight(r.pos) < 1.1 && Math.hypot(runtime.guide.x - r.pos.x, runtime.guide.z - r.pos.z) < 1.4) bump('baybay');
  if (ballHeight(r.pos) <= 0) {
    r.pos.y = heightAt(r.pos.x, r.pos.z) + BALL.r;
    r.vel.set(0, 0, 0);
    r.over = 1.2;
    runtime.player.pathTarget = null;
    spawnFx('dust', r.pos.x, r.pos.y - BALL.r, r.pos.z, { scale: 0.6 });
    bubble(BALL_LINES.drop, 1600);
  }
}

function finish(r: Rally) {
  const n = r.bumps;
  if (n === 0) { r.run.cancel(); return; }
  r.run.end({
    tier: tierFor(n, BALL_TIERS),
    score: n,
    detail: { zh: `连续颠球 ${n} 下`, en: `${n} bumps in a row` },
    bestText: v => ({ zh: `最多连续 ${v} 下！`, en: `Your best rally: ${v}!` }),
    again: () => { startBall(); },
  });
}

function cleanup() {
  offFrame?.(); offFrame = null;
  keys?.off(); keys = null;
  hideChip(BALL_ID);
  runtime.player.pathTarget = null;
  rally = null;
  const off = offLayer;
  offLayer = null;
  setTimeout(() => off?.(), 50);
}

// --- the layer: BAYBAY under hers, the ball and its shadow, a tap on the shadow ----------------------------------------

const BALL_WHITE = new THREE.Color(1, 1, 1), SHADOW = new THREE.Color('#5a4e40'), GOLD = new THREE.Color('#f2c14e');
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sc = new THREE.Vector3();

export function driveBaybay() {
  const r = rally;
  if (!r) return;
  const g = runtime.guide;
  g.state = 'idle';
  if (r.turn === 'baybay' && r.over <= 0) { const l = landing(r.pos, r.vel); g.target = { x: l.x, z: l.z }; g.run = true; }
  else { g.target = null; g.run = false; }
}

export function updateBall(mesh: THREE.InstancedMesh, time: number) {
  const r = rally;
  if (!r) { mesh.count = 0; return; }
  e.set(time * 1.3, time * 0.7, 0);
  mesh.setMatrixAt(0, m4.compose(r.pos, q.setFromEuler(e), sc.set(BALL.r * 2, BALL.r * 2, BALL.r * 2)));
  mesh.setColorAt(0, BALL_WHITE);
  // the shadow straight under it, smaller and darker as it comes down; gold on your turn once it is low enough
  const gy = heightAt(r.pos.x, r.pos.z), h = Math.max(0, r.pos.y - gy), k = Math.max(0.35, 1 - h / 6);
  mesh.setMatrixAt(1, m4.compose(pos.set(r.pos.x, gy + 0.03, r.pos.z), q.identity(), sc.set(0.95 * k, 0.02, 0.95 * k)));
  mesh.setColorAt(1, r.turn === 'player' && bumpable(r.pos, r.vel) ? GOLD : SHADOW);
  commitToy(mesh, 2);
}

function BallLayer() {
  const camera = useThree(st => st.camera), gl = useThree(st => st.gl);
  const mesh = useMemo(() => toyMesh('beachball', 'beachball', 2), []);
  useEffect(() => () => { mesh.geometry.dispose(); mesh.dispose(); }, [mesh]);
  useEffect(() => {
    const canvas = gl.domElement, v = new THREE.Vector3();
    // a tap on the shadow (or on the ball) bumps it; anywhere else the tap is the game's
    const down = (ev: PointerEvent) => {
      const r = rally;
      if (ev.target !== canvas || !r || r.turn !== 'player') return;
      const rect = canvas.getBoundingClientRect(), x = ev.clientX - rect.left, y = ev.clientY - rect.top;
      const near = (px: number, py: number, pz: number) => { v.set(px, py, pz).project(camera); return Math.hypot((v.x + 1) / 2 * rect.width - x, (1 - v.y) / 2 * rect.height - y) < 70; };
      if (near(r.pos.x, heightAt(r.pos.x, r.pos.z), r.pos.z) || near(r.pos.x, r.pos.y, r.pos.z)) { ev.preventDefault(); ev.stopPropagation(); bump('player'); }
    };
    window.addEventListener('pointerdown', down, true);
    return () => window.removeEventListener('pointerdown', down, true);
  }, [gl, camera]);
  useFrame(st => { driveBaybay(); updateBall(mesh, st.clock.elapsedTime); });
  return createElement('primitive', { object: mesh });
}

/** tests */
export function __resetBall() { rally?.run.cancel(); rally = null; rounds = 0; }
