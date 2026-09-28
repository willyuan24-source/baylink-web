import { createElement, lazy, Suspense } from 'react';
import { autoGliding, glideUnlocked } from '../actors/moveApi';
import { playSound } from '../audio/hooks';
import { emit, onEvent } from '../core/events';
import { input } from '../core/input';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { heightAt, inWorld } from '../core/terrain';
import type { Bilingual, Vec2 } from '../core/types';
import { faceCameraToward } from '../game/cinema';
import { bubble } from '../game/flow';
import { registerFrameSystem, registerSceneSystem } from '../game/systemsRegistry';
import { registerOverlay, openOverlay, closeOverlay } from '../ui/slots';
import { spawnFx } from '../world/fx';
import { GGB_COURSE, GGB_ID, GGB_LINES, GGB_NAME } from './ggbRings';
import { ensureResultOverlay, startActivity, tierFor, type ActivityRun } from './kit';

/**
 * Wave 5 · lane A · the first flight (W5-A5, plan §2 MF3 + §3.2 A-flight): right after the pelican unlock (lane C's
 * moment calls `startFirstFlight()`), 8 big gold rings from Coit Tower over the Ferry Building and back along the
 * Embarcadero to PIER 39, a coin in each (`reward ring:first-flight:<n>`, 3 coins, paid once per save by lane E's
 * ledger). Skippable (跳过 on the chip), ≈ 45 s of flying; the result card counts the rings (8 → 太棒了, 6 → 很好,
 * 3 → 好) and remembers the best.
 *
 * Forgiving on purpose: a ring counts when the pelican passes within CATCH_R of its centre, and each ring still ahead
 * floats to the height the player is flying at (inside its envelope: ≥ the glide's soft floor + 2 over whatever is
 * under it, ≤ +45), so a first-time flyer only has to steer. Rings missed stay missed (the run goes on). Unlocked
 * somewhere else than Coit (any viewpoint, a tour stop), the course is laid out ahead of the player instead
 * (`localCourse`). The rings render as ONE instanced draw call while the flight runs (play/rings.ts, its own chunk).
 *
 * W5-A9: the same run flies the Golden Gate rings (course 'ggb', play/ggbRings.ts): its own activity id and name, no
 * coins in the rings (its medal pays), BAYBAY's two bridge facts on the way; zones.ts starts it gliding by the bridge.
 */

export interface CourseRing { x: number; z: number; /** the glide's roof under / near it (world y; tests recompute it) */ floor: number }

/** The Coit course (city frame). Floors: max(ground, roofs within 10 u, tall structures) as the glide sees them (2026-09-28). */
export const COIT_COURSE: readonly CourseRing[] = [
  { x: -5, z: 43, floor: 24 },     // off Telegraph Hill, over the Filbert Steps
  { x: 45, z: 35, floor: 24 },     // Levi's Plaza
  { x: 100, z: 22, floor: 0 },     // the Embarcadero
  { x: 165, z: -5, floor: 24 },    // past the Ferry Building's clock tower: the turn
  { x: 120, z: -40, floor: 24 },   // back over the water, Pier 7
  { x: 35, z: -30, floor: 24 },    // Pier 15, the Exploratorium
  { x: -70, z: -45, floor: 24 },   // Pier 33
  { x: -150, z: 0, floor: 20 },    // PIER 39
];
export const FIRST_FLIGHT_ID = 'first-flight';
export const FIRST_FLIGHT_NAME: Bilingual = { zh: '第一次飞行', en: 'First flight' };
/** The chip's and the card's name for a course. */
export const flightName = (course: FlightCourse): Bilingual => (course === 'ggb' ? GGB_NAME : FIRST_FLIGHT_NAME);
export const RING_COINS = 3;
/** Ring visual radius and the catch radius (u) */
export const RING_R = 4.2;
export const CATCH_R = 8;
/** A ring floats between floor + CLEAR_MIN and floor + CLEAR_MAX (the glide's soft floor is +6, its spring below). */
export const CLEAR_MIN = 8;
export const CLEAR_MAX = 45;
/** Rings farther than this (horizontal, u) follow the flying height; nearer, they hold still. */
export const FOLLOW_FAR = 60;
/** The Coit course is used within this distance of its first ring (u); else a local course. */
export const COIT_NEAR = 320;
/** Tiers by rings: 3 → 好, 6 → 很好, 8 → 太棒了. */
export const RING_TIERS: readonly [number, number, number] = [3, 6, 8];
/** The intro waits this long for a take-off (s) or until the player walks this far (u); the flight ends after MAX_FLIGHT s. */
export const INTRO_WAIT = 60;
export const INTRO_WANDER = 50;
export const MAX_FLIGHT = 180;
export const LOCAL_STEP = 65;

export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Ring n of the first flight pays once per save, whichever course it was flown on (Coit's or a local one). */
export const ringSource = (i: number) => `ring:first-flight:${i + 1}`;

/** The height a ring sits at for a flyer at `flyY` (clamped to its envelope). */
export function ringY(floor: number, flyY: number): number {
  return Math.min(floor + CLEAR_MAX, Math.max(floor + CLEAR_MIN, flyY));
}

/**
 * A course ahead of the player where Coit is far: 8 rings LOCAL_STEP u apart on a gentle S-curve from `heading`, each
 * kept inside the model (a ring that would leave it turns the rest of the course back in, 30° at a time).
 */
export function localCourse(from: Vec2, heading: number, world: { inWorld(x: number, z: number): boolean } = { inWorld }): Vec2[] {
  const out: Vec2[] = [];
  let x = from.x, z = from.z, h = heading;
  for (let i = 0; i < 8; i++) {
    let step: Vec2 | null = null;
    for (let turn = 0; turn <= 6 && !step; turn++) {
      for (const sign of turn ? [1, -1] : [1]) {
        const a = h + 0.35 * Math.sin(i * 0.9) + sign * turn * (Math.PI / 6);
        const p = { x: x + Math.sin(a) * LOCAL_STEP, z: z + Math.cos(a) * LOCAL_STEP };
        const ahead = { x: x + Math.sin(a) * (LOCAL_STEP + 40), z: z + Math.cos(a) * (LOCAL_STEP + 40) };
        if (world.inWorld(p.x, p.z) && world.inWorld(ahead.x, ahead.z)) { step = p; h = a - 0.35 * Math.sin(i * 0.9); break; }
      }
    }
    if (!step) break;
    out.push(step);
    x = step.x; z = step.z;
  }
  return out;
}

// --- the run --------------------------------------------------------------------------------------------------------

export interface FlightRing { x: number; z: number; y: number; floor: number; got: boolean; missed: boolean }
export type FlightPhase = 'intro' | 'flying' | 'finale';
/** coit / local: the first flight (rings pay coins); ggb: the Golden Gate rings (play/ggbRings.ts: its own activity, medal only) */
export type FlightCourse = 'coit' | 'local' | 'ggb';
export interface FlightState {
  phase: FlightPhase;
  course: FlightCourse;
  rings: FlightRing[];
  /** rings passed so far */
  got: number;
  /** index of the ring to fly to next (rings.length when none is left) */
  next: number;
  /** seconds in this phase */
  t: number;
  /** the flight's glow pulse clock (s) */
  clock: number;
  /** where the player stood when the intro began */
  from: Vec2;
}

let state: FlightState | null = null;
let run: ActivityRun | null = null;
const offs: (() => void)[] = [];
const listeners = new Set<() => void>();
const changed = () => { for (const fn of [...listeners]) fn(); };

/** The running first flight (the rings layer, the chip, tests / QA). */
export const flightState = (): Readonly<FlightState> | null => state;
export const firstFlightActive = () => state !== null;
export function subscribeFlight(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }

/** The glide's roof near a point as the pelican sees it (ground; the live floor is looked up again in flight). */
type FloorOf = (x: number, z: number) => number;
let floorOf: FloorOf = (x, z) => heightAt(x, z);
/** tests / the rings chunk: a better floor (glide world roofs + tall structures) */
export function setFloorSource(fn: FloorOf | null) { floorOf = fn ?? ((x, z) => heightAt(x, z)); }

export const CHIP_OVERLAY = 'play-flight';
export const RINGS_SCENE = 'a-play-rings';

/**
 * Start the first flight (lane C's unlock moment, 再来一次, QA). Needs the pelican unlocked and the player playing on
 * foot (or already gliding). Returns false when it cannot start (nothing changes then).
 */
export function startFirstFlight(opts: { course?: FlightCourse; rings?: boolean } = {}): boolean {
  const s = game.get();
  if (state || s.phase !== 'playing' || s.dialogue.nodeId || !glideUnlocked() || autoGliding()) return false;
  const mode = runtime.move.mode;
  if (mode !== 'foot' && mode !== 'glide') return false;
  const p = runtime.player;
  const nearCoit = Math.hypot(p.x - COIT_COURSE[0].x, p.z - COIT_COURSE[0].z) <= COIT_NEAR;
  const course = opts.course ?? (nearCoit ? 'coit' : 'local');
  const ggb = course === 'ggb';
  // the Golden Gate figure-eight: flown from whichever end is nearer
  const from = mode === 'glide' ? runtime.glide : p, far = (r: Vec2) => Math.hypot(from.x - r.x, from.z - r.z);
  const pts: CourseRing[] = ggb
    ? (far(GGB_COURSE[0]) <= far(GGB_COURSE[GGB_COURSE.length - 1]) ? [...GGB_COURSE] : [...GGB_COURSE].reverse()).map(r => ({ ...r }))
    : course === 'coit'
      ? COIT_COURSE.map(r => ({ ...r }))
      : localCourse(p, runtime.camera.yaw + Math.PI).map(q => ({ ...q, floor: floorOf(q.x, q.z) }));
  if (pts.length < 4) return false;
  const startY = (mode === 'glide' ? runtime.glide.y : heightAt(p.x, p.z) + 24);
  state = {
    phase: mode === 'glide' ? 'flying' : 'intro',
    course,
    rings: pts.map(r => ({ x: r.x, z: r.z, floor: r.floor, y: ringY(r.floor, startY), got: false, missed: false })),
    got: 0,
    next: 0,
    t: 0,
    clock: 0,
    from: { x: p.x, z: p.z },
  };
  ensureResultOverlay();
  run = startActivity({ id: ggb ? GGB_ID : FIRST_FLIGHT_ID, name: flightName(course), better: 'higher' }, { onStop: teardown });
  offs.push(registerFrameSystem('a-first-flight', step));
  offs.push(onEvent(e => {
    if (!state) return;
    if (e.type === 'glide:start' && state.phase === 'intro') {
      setPhase('flying');
      // took off facing away (the camera looked elsewhere): say where the rings are, once
      const r = state.rings[state.next], g = runtime.glide;
      if (r && Math.abs(wrapAngle(Math.atan2(r.x - g.x, r.z - g.z) - g.heading)) > 1.9) bubble({ zh: '金圈在后面，我们掉个头～', en: 'The rings are behind us. Let’s turn round!' }, 3200);
    }
    if (e.type === 'glide:land' && state.phase !== 'intro') finish();
  }));
  offs.push(registerOverlay({ id: CHIP_OVERLAY, Component: FlightChipSlot }));
  openOverlay(CHIP_OVERLAY);
  void import('./rings').then(m => {
    if (!state) return;
    setFloorSource(m.glideFloor);
    offs.push(registerSceneSystem(RINGS_SCENE, m.RingsLayer));
  }, error => { if (import.meta.env?.DEV) console.error('[opus-bay play] rings', error); });
  const first = state.rings[0];
  if (state.phase === 'intro') {
    faceCameraToward(first.x, first.z, { uncapped: true, seconds: 0.9 });
    // (lane C's moment asked 先试试起飞？ already: here only which button, and what the rings are)
    const what = ggb ? { zh: '绕着桥塔穿金圈', en: 'fly the rings round the towers' } : { zh: '穿过金圈拿金币', en: 'fly through the rings for coins' };
    bubble(runtime.input.device === 'touch'
      ? { zh: `点「起飞」，${what.zh}！`, en: `Tap Take off, then ${what.en}!` }
      : { zh: `按 G 起飞，${what.zh}！`, en: `Press G to take off, then ${what.en}!` }, 4200);
  } else bubble(ggb ? GGB_LINES.go : { zh: '跟着金圈飞！', en: 'Follow the gold rings!' }, 2600);
  changed();
  return true;
}

/** The next ring's direction relative to where the camera looks (rad, + = to the left), or null. */
export function ringBearing(): number | null {
  const s = flightState();
  const r = s?.rings[s.next];
  if (!s || !r) return null;
  const from = runtime.glide.active ? runtime.glide : runtime.player;
  return wrapAngle(Math.atan2(r.x - from.x, r.z - from.z) - (runtime.camera.yaw + Math.PI));
}

/** 跳过: end without a card (no cost, nothing lost). */
export function skipFirstFlight() {
  if (!state) return;
  run?.cancel();
}

/** Take off for the player (the chip's 起飞 on phones): the same press as G / the 起飞 button. */
export function takeOffNow() {
  if (!state || state.phase !== 'intro') return;
  const first = state.rings[state.next] ?? state.rings[0];
  faceCameraToward(first.x, first.z, { uncapped: true, seconds: 0.3 });
  input.glideCount++;
}

function setPhase(phase: FlightPhase) {
  if (!state || state.phase === phase) return;
  state.phase = phase;
  state.t = 0;
  changed();
}

function catchRing(i: number) {
  const s = state;
  if (!s || !run) return;
  const r = s.rings[i];
  r.got = true;
  s.got++;
  for (let k = s.next; k < i; k++) if (!s.rings[k].got) s.rings[k].missed = true;
  s.next = i + 1;
  playSound('play-ring', { pitch: 1 + 0.07 * s.got });
  spawnFx('sparkle', r.x, r.y, r.z, { scale: 2.4, count: 18 });
  // the first flight's rings pay (lane E's slot ring:first-flight); the Golden Gate course pays by its medal only
  if (s.course !== 'ggb') emit({ type: 'reward', source: ringSource(i), coins: RING_COINS });
  if (s.next >= s.rings.length) {
    // the last ring: the card now (not after a landing somewhere past PIER 39), then fly on or land as you like
    setPhase('finale');
    const all = s.got === s.rings.length;
    finish();
    bubble(runtime.input.device === 'touch'
      ? { zh: all ? '全部穿过！点「降落」落地吧～' : '到终点啦！点「降落」落地吧～', en: all ? 'Every ring! Tap Land to come down.' : 'That’s the course! Tap Land to come down.' }
      : { zh: all ? '全部穿过！按 G 降落吧～' : '到终点啦！按 G 降落吧～', en: all ? 'Every ring! Press G to land.' : 'That’s the course! Press G to land.' }, 4000);
    return;
  } else if (s.got === 1) bubble({ zh: '漂亮！下一个金圈在前面～', en: 'Nice! The next ring is up ahead.' }, 2600);
  else if (s.course === 'ggb' && (s.got === 3 || s.got === 5)) bubble(s.got === 3 ? GGB_LINES.tower : GGB_LINES.colour, 3400);
  changed();
}

/** Per frame: rings follow the flying height while far, the catch test, the end conditions. */
export function step(dt: number) {
  const s = state;
  if (!s) return;
  s.t += dt;
  s.clock += dt;
  // a trip took the wings (lane F's scenic auto-glide: 飞过去 from the map, 带我去): the course ends at no cost, no card
  if (autoGliding()) { run?.cancel(); return; }
  const g = runtime.glide, p = runtime.player;
  if (s.phase === 'intro') {
    if (runtime.move.mode === 'glide' || g.active) { setPhase('flying'); return; }
    // walked off, got on something else, waited long enough: no flight this time (nothing lost)
    const wandered = Math.hypot(p.x - s.from.x, p.z - s.from.z) > INTRO_WANDER;
    const other = runtime.move.mode !== 'foot' && runtime.move.mode !== 'sit';
    if (s.t > INTRO_WAIT || wandered || other || game.get().phase !== 'playing') run?.cancel();
    return;
  }
  if (!g.active) {
    // on the ground again without a glide:land (a teleport, a dialogue took over): end with what was flown
    if (s.t > 1) finish();
    return;
  }
  for (let i = s.next; i < s.rings.length; i++) {
    const r = s.rings[i];
    const dh = Math.hypot(g.x - r.x, g.z - r.z);
    if (dh > FOLLOW_FAR && i <= s.next + 1) r.y += (ringY(Math.max(r.floor, floorOf(r.x, r.z)), g.y) - r.y) * Math.min(1, dt * 1.5);
    if (dh <= CATCH_R && Math.abs(g.y - r.y) <= CATCH_R) { catchRing(i); break; }
  }
  // flown well past the last ring still ahead, or out too long: the run ends
  const last = s.rings[s.rings.length - 1];
  const pastEnd = s.next < s.rings.length && s.next === s.rings.length - 1 && Math.hypot(g.x - last.x, g.z - last.z) > 160 && s.t > 20;
  if (s.t > MAX_FLIGHT || pastEnd) finish();
}

function finish() {
  const s = state;
  if (!s || !run) return;
  const got = s.got, total = s.rings.length, tier = tierFor(got, RING_TIERS, 'higher');
  // the Golden Gate rings start by themselves (gliding by the bridge): flown past without a medal they end quietly — never
  // a 再试试 card for a course the player did not ask for (review 2026-09-28)
  if (s.course === 'ggb' && tier === 0) { run.cancel(); return; }
  run.end({
    tier,
    score: got,
    detail: { zh: `穿过 ${got} / ${total} 个金圈`, en: `${got} of ${total} rings` },
    bestText: best => ({ zh: `最好成绩：${best} 个圈`, en: `Best: ${best} rings` }),
    again: () => { setTimeout(() => startFirstFlight(s.course === 'ggb' ? { course: 'ggb' } : {}), 250); },
  });
}

function teardown() {
  for (const off of offs.splice(0).reverse()) { try { off(); } catch { /* already gone */ } }
  closeOverlay(CHIP_OVERLAY);
  state = null;
  run = null;
  changed();
}

// --- the chip (lazy) ------------------------------------------------------------------------------------------------

const FlightChip = lazy(() => import('./FlightChip'));
function FlightChipSlot() {
  return createElement(Suspense, { fallback: null }, createElement(FlightChip));
}
