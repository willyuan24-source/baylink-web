import { useFrame } from '@react-three/fiber';
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
import { DOWNWIND, KITE_PARTS, commitKites, kiteAt, kiteMesh, placeKite, registerKiteWarmup } from './kiteKind';
import { KITE_ID, KITE_LINES, KITE_NAME } from './kiteLines';
import { startActivity, type ActivityRun, type Tier } from './kit';
import { freeOnFoot, holdKeys, type HeldKeys } from './partc';
import { ensurePlaySounds3 } from './sounds3';

/**
 * Wave 7 · lane W2 · 放风筝 with BAYBAY (sf-w7-lead §3 W2 (2)): on the Marina Green or Crissy Field lawn, 问 BAYBAY →
 * 放风筝 (play/kiteEntry.ts, play/kiteZone.ts). The sea breeze comes and goes; the chip's gauge shows it, its band is a gust.
 *
 *   hold  (the chip's 放线 button, Space or E) lets the line out: fast in a gust, slowly (and sinking) in a lull;
 *         held longer than HOLD_MAX the kite dives (release and it recovers; hold on and it comes down)
 *   let go  the kite climbs toward the top of its arc, faster the stronger the wind
 *
 * Tiers: ● the kite is up (UP_H over your hand), ◆ ALOFT_S seconds in the air, ★ all the line out, high (the top of the
 * line). The round ends at the ★ or after ROUND_S; points = seconds aloft + 10 for the top (the kit keeps the best,
 * the notebook's 我的记录 shows it). Medals `medal:kite:1..3` through the kit (the existing prefix). BAYBAY stands
 * beside you and flies hers. Walking KITE_LEAVE u away ends it at no cost. The camera stands upwind behind you,
 * low, looking up the line (a per-frame shot, released at the end).
 *
 * Its own lazy chunk (never in GameRoot); the kites are the kite kind of play/kiteKind.ts (+1 draw call while playing).
 */

registerKiteWarmup();
ensurePlaySounds3();

export const KITE = {
  /** line (u): at the start, all of it */
  start: 2.2, max: 10,
  /** line out while holding (u/s): in a gust / a lull */
  outGust: 2.4, outCalm: 0.8,
  /** elevation (rad): the top of the arc, and where it touches down */
  eMax: 1.1, eMin: 0.1, e0: 0.45,
  /** elevation lost per second while holding (gust / lull), the dive, and the climb per second at wind w: climb·(0.4 + w) */
  sinkGust: 0.05, sinkCalm: 0.32, dive: 0.9, climb: 0.85,
  /** longest steady hold (s) before it dives */
  holdMax: 2.6,
  /** the wind: a lull around `calm`, gusts up to `gust` every 5–9 s for 2.6–3.8 s; the gauge's gust band from GUST */
  calm: 0.35, gust: 0.95,
} as const;
export const GUST = 0.65;
/** ● the kite is up: this high over your hand (u) */
export const UP_H = 3;
/** ◆ this long in the air (s) */
export const ALOFT_S = 20;
/** ★ the top of the line: all of it out and at least this high an elevation */
export const TOP_E = 0.85;
export const ROUND_S = 60;
export const KITE_LEAVE = 14;

export interface KiteState {
  t: number;
  line: number;
  e: number;
  wind: number;
  held: boolean;
  holdT: number;
  diving: boolean;
  aloft: number;
  up: boolean;
  top: boolean;
  crashes: number;
  /** the next gust's start and end (s of the round) */
  g0: number;
  g1: number;
  /** a seeded 0…1 source for the gusts (tests) */
  rand: () => number;
  /** the height over the hand (u) */
  h: number;
  ended: boolean;
}

export function newKite(rand: () => number = Math.random): KiteState {
  const g0 = 2 + rand() * 2;
  return { t: 0, line: KITE.start, e: KITE.e0, wind: KITE.calm, held: false, holdT: 0, diving: false, aloft: 0, up: false, top: false, crashes: 0, g0, g1: g0 + 2.6 + rand() * 1.2, rand, h: KITE.start * Math.sin(KITE.e0), ended: false };
}

/** The wind at time t: the lull's slow swell, the gust ramped in and out over 0.5 s. */
export function windAt(k: Pick<KiteState, 'g0' | 'g1'>, t: number): number {
  const lull = KITE.calm + 0.06 * Math.sin(t * 1.3) + 0.04 * Math.sin(t * 3.1);
  const up = Math.min(1, Math.max(0, (t - k.g0) / 0.5)), down = Math.min(1, Math.max(0, (k.g1 - t) / 0.5));
  const g = Math.min(up, down);
  return lull + (KITE.gust - lull) * g;
}

export type KiteEvent = 'dive' | 'crash' | 'up' | 'top' | 'gust' | null;

/** One step of the kite (pure; the frame system and the tests drive it). */
export function stepKite(k: KiteState, dt: number, held: boolean): KiteEvent {
  let ev: KiteEvent = null;
  k.t += dt;
  if (k.t > k.g1 + 0.5) { k.g0 = k.t + 5 + k.rand() * 4; k.g1 = k.g0 + 2.6 + k.rand() * 1.2; }
  const wasGust = k.wind >= GUST;
  k.wind = windAt(k, k.t);
  if (!wasGust && k.wind >= GUST) ev = 'gust';
  const gust = k.wind >= GUST;
  k.held = held;
  if (held) {
    k.holdT += dt;
    k.line = Math.min(KITE.max, k.line + (gust ? KITE.outGust : KITE.outCalm) * dt);
    if (!k.diving && k.holdT > KITE.holdMax) { k.diving = true; ev = 'dive'; }
    k.e -= (k.diving ? KITE.dive : gust ? KITE.sinkGust : KITE.sinkCalm) * dt;
  } else {
    k.holdT = 0;
    if (k.diving) { k.diving = false; }
    k.e = Math.min(KITE.eMax, k.e + KITE.climb * (0.4 + k.wind) * dt);
  }
  if (k.e <= KITE.eMin) {
    // it touched down: back up from a short line
    k.crashes++;
    k.diving = false; k.holdT = 0;
    k.e = KITE.e0; k.line = Math.max(KITE.start, k.line * 0.5);
    ev = 'crash';
  }
  k.h = k.line * Math.sin(k.e);
  if (k.h >= UP_H) {
    k.aloft += dt;
    if (!k.up) { k.up = true; ev = ev ?? 'up'; }
  }
  if (!k.top && k.line >= KITE.max - 1e-6 && k.e >= TOP_E) { k.top = true; ev = 'top'; }
  return ev;
}

/** The medal tier a round reached so far. */
export const kiteTier = (k: Pick<KiteState, 'up' | 'aloft' | 'top'>): 0 | Tier => (k.top && k.aloft >= ALOFT_S ? 3 : k.top ? 3 : k.aloft >= ALOFT_S ? 2 : k.up ? 1 : 0);
/** Points: a point a second aloft, ten more for the top of the line. */
export const kitePoints = (k: Pick<KiteState, 'aloft' | 'top'>): number => Math.round(k.aloft) + (k.top ? 10 : 0);

interface Live { run: ActivityRun; k: KiteState; start: { x: number; z: number }; chipHeld: boolean; endAt: number; shown: string; cam: THREE.Vector3 | null; tgt: THREE.Vector3 | null }
let live: Live | null = null;
let offFrame: (() => void) | null = null;
let offLayer: (() => void) | null = null;
let keys: HeldKeys | null = null;
let rounds = 0;

export const kiteLive = (): Readonly<KiteState> | null => live?.k ?? null;

/** 问 BAYBAY → 放风筝. */
export function startKite(rand?: () => number): boolean {
  if (live || !freeOnFoot()) return false;
  const run = startActivity({ id: KITE_ID, name: KITE_NAME, better: 'higher' }, { onStop: () => cleanup() });
  if (!run) return false;
  rounds++;
  const p = runtime.player;
  live = { run, k: newKite(rand), start: { x: p.x, z: p.z }, chipHeld: false, endAt: -1, shown: '', cam: null, tgt: null };
  // face down the wind: the kite goes up in front of you
  runtime.player.heading = Math.atan2(DOWNWIND.x, DOWNWIND.z);
  showChip({
    id: KITE_ID, title: KITE_NAME, icon: 'play', big: '0%',
    line: runtime.input.device === 'touch' ? KITE_LINES.hintTouch : KITE_LINES.hintKeys,
    status: KITE_LINES.lull,
    meter: { value: KITE.calm, lo: GUST, hi: 1 },
    hold: { label: { zh: '放线', en: 'Let out' }, set: down => { if (live) live.chipHeld = down; } },
    action: { label: { zh: '不玩了', en: 'Stop' }, run: () => { live?.run.cancel(); } },
  });
  bubble(KITE_LINES.start, 3200);
  charApi()?.emote('baybay', 'cheer', { seconds: 1.2 });
  playSound('play-go');
  flow.set({ quietUntil: performance.now() + 75000 });
  offFrame = registerFrameSystem('w2-kite', step);
  offLayer = registerSceneSystem('w2-kite', KiteLayer);
  keys = holdKeys(['Space', 'KeyE']);
  return true;
}

function say(line: Bilingual, ms = 2200) { bubble(line, ms); }

function step(dt: number) {
  const g = live;
  if (!g || !g.run.active) return;
  const p = runtime.player;
  if (Math.hypot(p.x - g.start.x, p.z - g.start.z) > KITE_LEAVE) { g.run.cancel(); return; }
  if (g.endAt >= 0) { if (g.k.t >= g.endAt) finish(g); else g.k.t += dt; return; }
  const held = g.chipHeld || !!keys?.held();
  const ev = stepKite(g.k, Math.min(dt, 0.1), held);
  if (ev === 'dive') { say(KITE_LINES.dive, 2000); playSound('play-whoosh'); }
  else if (ev === 'crash') { say(KITE_LINES.crash, 2200); const kp = kitePos(g, new THREE.Vector3()); spawnFx('dust', kp.x, heightAt(kp.x, kp.z), kp.z, { scale: 0.5 }); }
  else if (ev === 'up') { say(KITE_LINES.up, 1600); playSound('play-pop', { pitch: 1.2 }); }
  else if (ev === 'top') { say(KITE_LINES.top, 2400); playSound('play-pop', { pitch: 1.5 }); charApi()?.emote('baybay', 'cheer', { seconds: 1.4 }); g.endAt = g.k.t + 2.2; }
  if (g.endAt < 0 && g.k.t >= ROUND_S) { finish(g); return; }
  // the chip: the line out, the wind's word, the gauge
  const status = g.k.diving ? KITE_LINES.diving : g.k.wind >= GUST ? KITE_LINES.gust : KITE_LINES.lull;
  const big = `${Math.round((g.k.line / KITE.max) * 100)}%`;
  const key = `${big}|${status.en}|${Math.round(g.k.wind * 20)}`;
  if (key !== g.shown) { g.shown = key; patchChip(KITE_ID, { big, status, meter: { value: Math.min(1, g.k.wind), lo: GUST, hi: 1 } }); }
}

function finish(g: Live) {
  if (!g.run.active) return;
  const k = g.k, first = rounds === 1;
  g.run.end({
    tier: kiteTier(k), score: kitePoints(k),
    detail: { zh: `飞了 ${Math.round(k.aloft)} 秒${k.top ? ' · 线全放完' : ''}`, en: `${Math.round(k.aloft)} s aloft${k.top ? ' · all the line out' : ''}` },
    bestText: v => ({ zh: `最高 ${v} 分`, en: `Best ${v} points` }),
    again: () => { startKite(); },
  });
  if (first) setTimeout(() => bubble(KITE_LINES.done, 2600), 2600);
}

function cleanup() {
  offFrame?.(); offFrame = null;
  keys?.off(); keys = null;
  hideChip(KITE_ID);
  if (live?.cam) runtime.camera.shot = null;
  live = null;
  const off = offLayer;
  offLayer = null;
  setTimeout(() => off?.(), 50);
}

const HAND = new THREE.Vector3(), BHAND = new THREE.Vector3();
/** The player's hand (the string's end) and the kite's sail centre. */
function kitePos(g: Live, out: THREE.Vector3): THREE.Vector3 {
  const p = runtime.player;
  HAND.set(p.x + Math.sin(p.heading + 0.5) * 0.3, p.y + 1.05, p.z + Math.cos(p.heading + 0.5) * 0.3);
  const sway = Math.sin(g.k.t * 0.8) * 0.12 + (g.k.diving ? Math.sin(g.k.t * 7) * 0.35 : 0);
  return kiteAt(HAND, g.k.line, Math.max(0.05, g.k.e), sway, out);
}

/** BAYBAY beside you, across the wind, facing down it; she flies hers in a slow figure of eight. */
function driveBaybay() {
  const b = runtime.guide, p = runtime.player;
  b.state = 'idle';
  const sx = -DOWNWIND.z, sz = DOWNWIND.x;
  const hx = p.x + sx * 2.2, hz = p.z + sz * 2.2;
  b.target = Math.hypot(b.x - hx, b.z - hz) > 0.6 && canStand(hx, hz, 0.3) ? { x: hx, z: hz } : null;
  b.run = false;
  if (!b.target) b.heading = Math.atan2(DOWNWIND.x, DOWNWIND.z);
}

const SAIL = new THREE.Color('#e8483c'), TAIL = new THREE.Color('#f2c14e'), B_SAIL = new THREE.Color('#2f7fd0'), B_TAIL = new THREE.Color('#ffffff');
const kp = new THREE.Vector3(), bk = new THREE.Vector3(), camTo = new THREE.Vector3(), tgtTo = new THREE.Vector3();

/** One frame of the round's scene: BAYBAY's spot, both kites, the camera up the line (kept out of the component: the
 * hooks lint forbids mutating the memoised mesh inside it). */
export function kiteFrame(mesh: THREE.InstancedMesh, cam: THREE.Camera, time: number, dt: number, portrait: boolean) {
  const g = live;
  if (!g) { mesh.count = 0; return; }
  driveBaybay();
  kitePos(g, kp);
  let n = placeKite(mesh, 0, { anchor: HAND, kite: kp, t: time, sail: SAIL, tail: TAIL }, cam.position);
  const b = runtime.guide;
  BHAND.set(b.x + Math.sin(b.heading - 0.5) * 0.25, b.y + 0.95, b.z + Math.cos(b.heading - 0.5) * 0.25);
  kiteAt(BHAND, 8.5, 0.95 + Math.sin(time * 0.9) * 0.1, Math.sin(time * 0.45) * 0.25, bk);
  n = placeKite(mesh, n, { anchor: BHAND, kite: bk, t: time + 1.3, sail: B_SAIL, tail: B_TAIL, size: 0.9 }, cam.position);
  commitKites(mesh, n);
  // the camera: upwind behind you, low, looking up the line (portrait screens stand further off)
  const p = runtime.player, wide = portrait ? 1.35 : 1;
  const sx = -DOWNWIND.z, sz = DOWNWIND.x;
  camTo.set(p.x - DOWNWIND.x * 8.5 * wide + sx * 2.6, p.y + 2.4, p.z - DOWNWIND.z * 8.5 * wide + sz * 2.6);
  tgtTo.set(p.x, p.y + 1.4, p.z).lerp(kp, 0.5);
  if (!g.cam || !g.tgt) { g.cam = cam.position.clone(); g.tgt = new THREE.Vector3(p.x, p.y + 1.2, p.z); }
  const a = 1 - Math.exp(-dt * 2.5);
  g.cam.lerp(camTo, a); g.tgt.lerp(tgtTo, a);
  runtime.camera.shot = { position: [g.cam.x, g.cam.y, g.cam.z], target: [g.tgt.x, g.tgt.y, g.tgt.z], duration: 0.001 };
}

function KiteLayer() {
  const mesh = useMemo(() => kiteMesh(2 * KITE_PARTS), []);
  useEffect(() => () => { mesh.dispose(); }, [mesh]);
  useFrame((st, dt) => { kiteFrame(mesh, st.camera, st.clock.elapsedTime, dt, st.size.height > st.size.width); });
  return createElement('primitive', { object: mesh });
}

/** tests */
export function __resetKite() { live?.run.cancel(); live = null; rounds = 0; }
/** tests: drive a running round's hold (the chip's button) */
export function __holdKite(down: boolean) { if (live) live.chipHeld = down; }
