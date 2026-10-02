import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { rideCamInfo } from '../actors/cameraModes';
import { platforms, rider as platformRider, riderWorld } from '../actors/platform';
import { audioNow, playSound } from '../audio/hooks';
import { runtime } from '../core/runtime';
import { canStand } from '../core/terrain';
import { game } from '../core/store';
import type { Bilingual } from '../core/types';
import { bubble } from '../game/flow';
import { flow } from '../game/flowStore';
import { requestShutter } from '../game/photo';
import { registerFrameSystem, registerSceneSystem } from '../game/systemsRegistry';
import { RhythmJudge, startActivity, type ActivityRun, type Tier } from './kit';
import { GROOVE_SECONDS, RIFF_BAR, RIFF_BEAT, RIFF_CALLS } from './sounds2';
import { sayWhenQuiet } from './zones';

/**
 * Wave 5 · lane A · the cable-car bell riff and the lean-out photo (W5-A7, plan §3.2 A-bell). Both live on the bell pad
 * lane T's ride banner shows on a cable car once it has left the stop (BellPad.tsx through zones.ts registerRidePad).
 *
 * The riff (铃声对答): three call-and-response rounds — each round two bars at RIFF_BEAT: the gripman rings a call in the
 * first bar (a soft tick on every beat), you ring it back in the second (the pad's big bell, or H) — then GROOVE_SECONDS
 * of a swung toy-jazz groove to ring along freely. Never failed, only more or less jazzy: finishing is ● 好 at least; the
 * answers you hit (±150 ms of their beat, PlayKit's RhythmJudge on audioNow() with the player's own offset learnt from
 * the first taps) and the freestyle taps on a beat or its swung "and" make the score; ◆ from 10, ★ from 18 (of 24).
 * Hopping off (or the ride ending) stops it at no cost. During the riff H is the pad's, not lane T's gripman bell.
 *
 * The lean-out (探出身): hold the pad's button (or L) on the running board: the rider leans out over the street (on top
 * of lane F's 12° hang), the camera swings outside the car ahead of you looking back along it — the classic cable-car
 * picture — and after LEAN_SHUTTER_S held the shutter takes it (game/photo requestShutter, as photo mode's). Letting go
 * leans back and hands the camera back.
 *
 * Fact for BAYBAY (checked 2026-09-28, https://www.sfmta.com/press-releases/sfmta-announces-winners-53rd-cable-car-bell-ringing-contest):
 * the SFMTA holds a cable-car bell ringing contest in Union Square with a division for the cars' grips and conductors
 * (the 53rd was on 7 July 2016). Said without a date: the next one is not announced.
 */

export const BELL_ID = 'bell';
export const BELL_NAME: Bilingual = { zh: '缆车摇铃', en: 'Cable-car bell' };
export const ROUNDS = RIFF_CALLS.length;
export const MAX_HITS = RIFF_CALLS.reduce((s, c) => s + c.length, 0);
export const MAX_JAZZ = 12;
/** a freestyle tap within this of a beat or its swung "and" (2/3 of a beat) is jazzy */
export const JAZZ_WINDOW = 0.1;
export const TIER_AT: readonly [number, number] = [10, 18];

export const BELL_LINES = {
  start: { zh: '我先摇，你学我！', en: 'I ring, you copy!' },
  free: { zh: '随便摇！越有爵士味越好～', en: 'Ring anything! The jazzier the better!' },
  fact: { zh: '旧金山真有缆车摇铃比赛，司机们比谁摇得好听！', en: 'SF really holds a cable-car bell contest for the crews!' },
  lean: { zh: '抓稳扶杆——咔嚓！经典缆车照！', en: 'Hold the pole — snap! The classic cable-car shot!' },
} satisfies Record<string, Bilingual>;

export const JAZZ_WORDS: readonly Bilingual[] = [
  { zh: '有点爵士', en: 'a bit jazzy' }, { zh: '很爵士', en: 'very jazzy' }, { zh: '爵士大师', en: 'a jazz master' },
];

// --- the riff -------------------------------------------------------------------------------------------------------------

export type RiffPhase = 'call' | 'answer' | 'free';
interface Riff {
  run: ActivityRun;
  judge: RhythmJudge;
  round: number;
  phase: RiffPhase;
  /** the round's (or the freestyle's) start on the audio clock */
  t0: number;
  /** answer beats hit this round (indices into the round's call) */
  hitNow: Set<number>;
  hits: number;
  jazzSlots: Set<number>;
  last: { kind: 'hit' | 'early' | 'late' | 'free' | 'jazz'; at: number } | null;
}

let riff: Riff | null = null;
let riffs = 0;
let offStep: (() => void) | null = null;
const listeners = new Set<() => void>();
const changed = () => { for (const fn of [...listeners]) fn(); };
export function subscribeBell(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }

export const riffState = (): Readonly<Riff> | null => riff;
export const riffActive = () => riff !== null;

/** On a cable car, under way (the pad is offered). */
export function onCableCar(): boolean {
  const r = flow.get().ride;
  return !!r && r.kind === 'cable-car' && r.stage !== 'waiting' && game.get().move.mode === 'transit';
}

/** The call's beat times (s from the round's start) and the answers' (one bar later). */
export const callTimes = (round: number) => (RIFF_CALLS[round] ?? []).map(b => b * RIFF_BEAT);
export const answerTimes = (round: number) => (RIFF_CALLS[round] ?? []).map(b => (b + RIFF_BAR) * RIFF_BEAT);
const ROUND_S = RIFF_BAR * 2 * RIFF_BEAT;

/**
 * (W6-K1, lane A's review: the pad re-rendered every frame of the 20 s riff) What the pad draws that changes with the
 * clock alone, as one number — the phase and round, the call dots lit, the answer dots missed, the jazz count, the
 * bell's flash: the pad re-renders only when it changes; its cursor and meter move by direct style writes. -1: no riff.
 */
export function riffLook(now: number): number {
  const r = riff;
  if (!r) return -1;
  const tt = now - r.t0, beats = RIFF_CALLS[r.round] ?? [];
  let lit = 0, missed = 0;
  if (r.phase !== 'free') {
    for (let i = 0; i < beats.length; i++) {
      if (tt >= beats[i] * RIFF_BEAT) lit++;
      if (!r.hitNow.has(i) && tt > (beats[i] + RIFF_BAR) * RIFF_BEAT + 0.2) missed++;
    }
  }
  const phase = r.phase === 'call' ? 0 : r.phase === 'answer' ? 1 : 2;
  const flash = r.last && now - r.last.at < 0.18 ? 1 : 0;
  return ((((r.round * 3 + phase) * 64 + lit) * 64 + missed) * 64 + Math.min(63, r.jazzSlots.size)) * 2 + flash;
}

/** 铃声对答: start the riff (on a cable car under way). */
export function startRiff(clock: () => number = audioNow): boolean {
  if (riff || !onCableCar()) return false;
  const run = startActivity({ id: BELL_ID, name: BELL_NAME, better: 'higher' }, { onStop: how => { if (how === 'cancel') stopRiff(); } });
  if (!run) return false;
  riffs++;
  riff = { run, judge: new RhythmJudge({ clock }), round: -1, phase: 'call', t0: 0, hitNow: new Set(), hits: 0, jazzSlots: new Set(), last: null };
  nextRound(clock());
  bubble(BELL_LINES.start, 2200);
  offStep = registerFrameSystem('a-play-bell', () => stepRiff(clock()));
  changed();
  return true;
}

function nextRound(now: number) {
  const r = riff!;
  r.round++;
  r.hitNow = new Set();
  r.t0 = now;
  if (r.round < ROUNDS) { r.phase = 'call'; playSound(`play-riff-${r.round + 1}`); }
  else { r.phase = 'free'; playSound('play-groove'); bubble(BELL_LINES.free, 2600); }
  changed();
}

/** Per frame: the call bar → the answer bar → the next round … → the freestyle → the card. */
export function stepRiff(now: number) {
  const r = riff;
  if (!r) return;
  if (!onCableCar()) { r.run.cancel(); return; }
  const t = now - r.t0;
  if (r.phase === 'call' && t >= RIFF_BAR * RIFF_BEAT - 0.3) { r.phase = 'answer'; changed(); }
  else if (r.phase === 'answer' && t >= ROUND_S) nextRound(now);
  else if (r.phase === 'free' && t >= GROOVE_SECONDS) endRiff();
}

/** A tap of the bell (the pad, H): it always rings; in an answer bar it is judged, in the freestyle it may be jazzy. */
export function tapBell(at: number = riff ? riff.judge.now() : audioNow()) {
  playSound('play-bell', { pitch: 1 + (Math.random() - 0.5) * 0.02 });
  const r = riff;
  if (!r) return;
  const t = at - r.t0;
  if (r.phase === 'answer') {
    const beats = answerTimes(r.round).map((b, i) => ({ b, i })).filter(x => !r.hitNow.has(x.i));
    if (beats.length) {
      const j = r.judge.judgeNearest(beats.map(x => r.t0 + x.b), at);
      if (j.kind === 'hit' && j.beat >= 0) { r.hitNow.add(beats[j.beat].i); r.hits++; }
      r.last = { kind: j.kind, at };
    }
  } else if (r.phase === 'free' && t >= 0) {
    const third = RIFF_BEAT / 3, slot = Math.round((t - r.judge.offset) / third), d = Math.abs(t - r.judge.offset - slot * third);
    // on a beat (slot % 3 === 0) or its swung "and" (slot % 3 === 2)
    if (d <= JAZZ_WINDOW && slot % 3 !== 1) { r.jazzSlots.add(slot); r.last = { kind: 'jazz', at }; } else r.last = { kind: 'free', at };
  }
  changed();
}

export function riffScore(hits: number, jazz: number): { score: number; tier: Tier } {
  const score = Math.min(MAX_HITS, hits) + Math.min(MAX_JAZZ, jazz);
  return { score, tier: score >= TIER_AT[1] ? 3 : score >= TIER_AT[0] ? 2 : 1 };
}

function endRiff() {
  const r = riff;
  if (!r) return;
  const jazz = r.jazzSlots.size;
  const { score, tier } = riffScore(r.hits, jazz);
  const first = riffs === 1;
  stopRiff();
  r.run.end({
    tier, score,
    detail: { zh: `${score} 分：对上 ${r.hits}/${MAX_HITS} · 即兴 ${Math.min(jazz, MAX_JAZZ)} 下 · ${JAZZ_WORDS[tier - 1].zh}`, en: `${score}: ${r.hits}/${MAX_HITS} answers · ${Math.min(jazz, MAX_JAZZ)} jazzy · ${JAZZ_WORDS[tier - 1].en}` },
    bestText: b => ({ zh: `上次你得了 ${b} 分！`, en: `Your best: ${b}!` }),
    again: () => { startRiff(); },
  });
  if (first) sayWhenQuiet(BELL_LINES.fact, 3000, 4200);
}

function stopRiff() {
  offStep?.(); offStep = null;
  riff = null;
  changed();
}

/** 停 / tests: stop at no cost. */
export function cancelRiff() { riff?.run.cancel(); }

// --- the lean-out ---------------------------------------------------------------------------------------------------------

/** extra outward lean at full (rad) over lane F's hang; the shutter after this long held; eased at LEAN_RATE /s */
export const LEAN_EXTRA = (22 * Math.PI) / 180;
export const LEAN_SHUTTER_S = 1.1;
const LEAN_RATE = 5;
/** the lean camera's spots (out from the car, ahead, up), tried in order: the first over open ground */
const LEAN_CAMS: readonly (readonly [number, number, number])[] = [[2.1, 5.2, 2.0], [1.4, 6.0, 2.6], [0.8, 6.5, 3.2], [0.3, 6.0, 3.8]];

const lean = { on: false, k: 0, held: 0, shot: false, caption: '', camFrom: null as null | { p: THREE.Vector3; t: THREE.Vector3 }, camT: 0, ownShot: false };
export const leanState = (): Readonly<typeof lean> => lean;

/**
 * (W9-C5, lane C surgical — review R§6 world row: the best side shot of the ride hid behind 「行驶中按住 L」, and pressing
 * it at the stop did nothing) The lean shot comes on its own for AUTO_LEAN_S once per stretch between stops,
 * AUTO_LEAN_AFTER_S after the car pulls away (the camera outside the car looking back along it; on the running board the
 * rider leans out too) — no shutter (the photo stays the held lean's), not under reduced motion. A car standing still
 * (below CAR_MOVING u/s) re-arms it and the button is disabled there.
 */
export const AUTO_LEAN_S = 3, AUTO_LEAN_AFTER_S = 2, CAR_MOVING = 0.5;
/** the automatic lean's clock: seconds under way this stretch (−1 once it has shown), and the car moving last frame */
const auto = { t: 0, moving: false };

/** The cable car you ride is under way (not parked at a stop): the lean button's state. */
export const carMoving = (): boolean => auto.moving;

/** (W9-C5) step the automatic lean's clock: true while it shows. */
function stepAutoLean(dt: number, speed: number, held: boolean, reduced: boolean): boolean {
  const moving = speed >= CAR_MOVING;
  if (moving !== auto.moving) { auto.moving = moving; changed(); }
  if (!moving) { auto.t = 0; return false; }
  if (held || reduced || auto.t < 0) { auto.t = -1; return false; }
  auto.t += dt;
  if (auto.t >= AUTO_LEAN_AFTER_S + AUTO_LEAN_S) auto.t = -1;
  return auto.t >= AUTO_LEAN_AFTER_S;
}

/** On the running board of a cable car (lane F's rail spot on a railMirror platform)? */
export function onRunningBoard(): boolean {
  if (!onCableCar() || game.get().move.spot !== 'rail') return false;
  const p = platformRider.platform ? platforms.get(platformRider.platform) : undefined;
  return !!p && !!p.railMirror && p.live;
}

/** 探出身 pressed / released (the pad's hold button, L). `caption` is the photo's (the pad's locale). */
export function setLean(on: boolean, caption = '') {
  if (on && !onRunningBoard()) return;
  if (on && !lean.on) { lean.held = 0; lean.shot = false; lean.camFrom = null; lean.camT = 0; }
  lean.on = on;
  if (caption) lean.caption = caption;
  changed();
}

const qLean = new THREE.Quaternion(), axis = new THREE.Vector3(), camTo = new THREE.Vector3(), tgtTo = new THREE.Vector3(), camP = new THREE.Vector3(), tgtP = new THREE.Vector3();
let playerBody: THREE.Object3D | null = null;

/** The lean layer's frame (a scene system while the pad is up: after the actors placed the rider, before the render). */
export function stepLean(dt: number, scene: THREE.Object3D | null, camera: THREE.Camera | null, aspect = 1.6) {
  const held = lean.on && onRunningBoard();
  if (lean.on && !held) { lean.on = false; changed(); }
  const plat = platformRider.platform ? platforms.get(platformRider.platform) : undefined;
  // (W9-C5) a held lean waits for the car to move (the button is disabled at the stop; L held there leans out as it
  // pulls away); the automatic lean once a stretch; the body leans only on the running board
  const speed = plat && plat.live ? Math.hypot(plat.vx, plat.vz) : 0;
  const autoOn = stepAutoLean(dt, speed, held, game.get().settings.reducedMotion) && onCableCar();
  const want = (held && speed >= CAR_MOVING) || autoOn;
  lean.k = Math.max(0, Math.min(1, lean.k + (want ? dt : -dt) * LEAN_RATE));
  const feet = riderWorld();
  if (lean.k <= 0 || !plat || !feet) { releaseCamera(); return; }
  // the outward side: the running board the rider hangs on is the ride camera's side (lane F's railMirror); local +x is
  // the car's left, world (cos h, −sin h)
  const side = rideCamInfo.side, s = Math.sin(plat.heading), c = Math.cos(plat.heading);
  const ox = c * side, oz = -s * side;
  if (scene && onRunningBoard()) {
    if (!playerBody?.parent) playerBody = scene.getObjectByName('opus-player') ?? null;
    if (playerBody) {
      axis.set(oz, 0, -ox).normalize();
      qLean.setFromAxisAngle(axis, LEAN_EXTRA * smooth(lean.k));
      playerBody.quaternion.premultiply(qLean);
    }
  }
  // the camera: outside the car, ahead of the rider along the way it goes, looking back at them
  const sp = Math.hypot(plat.vx, plat.vz), fx = sp > 0.5 ? plat.vx / sp : s, fz = sp > 0.5 ? plat.vz / sp : c;
  if (want) {
    // (close to the car: the street trees stand ≈ 3–4 u out on the sidewalks); where a building or a wall stands at the
    // spot (the waiting line at Powell & Market) the camera moves in over the track, further ahead and higher; a
    // portrait screen (phones) sees less across, so the camera stands further off
    const wide = aspect < 1 ? 1.45 : 1;
    let pick: readonly [number, number, number] = LEAN_CAMS[LEAN_CAMS.length - 1];
    for (const cand of LEAN_CAMS) { if (canStand(feet.x + (ox * cand[0] + fx * cand[1]) * wide, feet.z + (oz * cand[0] + fz * cand[1]) * wide, 0.2)) { pick = cand; break; } }
    camTo.set(feet.x + (ox * pick[0] + fx * pick[1]) * wide, feet.y + pick[2] * (wide > 1 ? 1.2 : 1), feet.z + (oz * pick[0] + fz * pick[1]) * wide);
    tgtTo.set(feet.x + ox * 0.6 - fx * 1.0, feet.y + 1.1, feet.z + oz * 0.6 - fz * 1.0);
    if (!lean.camFrom && camera) lean.camFrom = { p: camera.position.clone(), t: new THREE.Vector3(feet.x, feet.y + 1, feet.z) };
    lean.camT = Math.min(1, lean.camT + dt / 0.55);
    const k = smooth(lean.camT);
    camP.copy(lean.camFrom?.p ?? camTo).lerp(camTo, k);
    tgtP.copy(lean.camFrom?.t ?? tgtTo).lerp(tgtTo, k);
    runtime.camera.shot = { position: [camP.x, camP.y, camP.z], target: [tgtP.x, tgtP.y, tgtP.z], duration: 0.001 };
    lean.ownShot = true;
    const holding = held && speed >= CAR_MOVING;
    if (holding) lean.held += dt;
    if (holding && !lean.shot && lean.held >= LEAN_SHUTTER_S && lean.k >= 0.95) {
      lean.shot = true;
      requestShutter(lean.caption || BELL_NAME.zh, 'BAYLINK');
      bubble(BELL_LINES.lean, 2600);
      changed();
    }
  } else releaseCamera();
}

function releaseCamera() {
  if (!lean.ownShot) return;
  lean.ownShot = false;
  lean.camFrom = null;
  lean.camT = 0;
  runtime.camera.shot = null;
}

const smooth = (k: number) => k * k * (3 - 2 * k);

function LeanLayer() {
  const scene = useThree(s => s.scene), camera = useThree(s => s.camera);
  const size = useThree(s => s.size);
  useFrame((_, dt) => stepLean(Math.min(dt, 0.1), scene, camera, size.width / Math.max(1, size.height)));
  return null;
}

let padUsers = 0;
let offLayer: (() => void) | null = null;
/** The pad mounted: the lean layer runs while it is up. Returns the release. */
export function mountBellPad(): () => void {
  padUsers++;
  offLayer ??= registerSceneSystem('a-play-lean', LeanLayer);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    if (--padUsers > 0) return;
    lean.on = false; lean.k = 0;
    releaseCamera();
    offLayer?.(); offLayer = null;
  };
}

/** tests */
export function __resetBell() { cancelRiff(); stopRiff(); riffs = 0; Object.assign(lean, { on: false, k: 0, held: 0, shot: false, caption: '', camFrom: null, camT: 0, ownShot: false }); Object.assign(auto, { t: 0, moving: false }); playerBody = null; }
