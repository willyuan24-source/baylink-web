import { useFrame, useThree } from '@react-three/fiber';
import { createElement, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { charApi } from '../actors/charApi';
import { playSound } from '../audio/hooks';
import { input } from '../core/input';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { canStand, heightAt, surfaceAt } from '../core/terrain';
import type { Bilingual } from '../core/types';
import { bubble, teleportPlayer } from '../game/flow';
import { flow } from '../game/flowStore';
import { registerFrameSystem, registerSceneSystem } from '../game/systemsRegistry';
import { spawnFx } from '../world/fx';
import { hideChip, patchChip, showChip } from './chip';
import { startActivity, type ActivityRun, type Tier } from './kit';
import { freeOnFoot, holdKeys, pinBaybay, smooth, approach, type HeldKeys } from './partc';
import { applyPuppets, setPuppet } from './puppet';
import { ensurePlaySounds3 } from './sounds3';
import { commitToy, placeAlong, placeRod, registerToyWarmup, toyMesh } from './toyMesh';
import { sayWhenQuiet } from './zones';
import { FIRE_ID, FIRE_NAME, FIRE_PROMPT_R, fireClosedLine, fireIts, fireLit, fireRingByK, type FireRing } from './zones3';

/**
 * Wave 5 · lane A · marshmallows at Ocean Beach's fire rings (W5-A9, plan §3.2 A-fire, the first should): at a ring
 * that burns (lane L's site: a toy flame in every other ring while lane R's isFireRingLit says fires may burn — 1 March
 * to 31 October, 06:00 to 21:30 Bay time), 烤棉花糖 (phone: the contextual button; desktop: E) sits the player on the
 * sand on the promenade side of the ring and BAYBAY across the fire, each with a stick and a marshmallow. HOLD to hold it
 * in the flame (E or Space; phones: the chip's 按住烤) and let go when it is golden: the colour, the chip's gauge (the
 * golden band marked) and a word (白白的 / 微微黄 / 金黄 / 焦黄) show how far it is. Too long and it catches fire:
 * 焦焦脆脆, and BAYBAY swaps — the burnt one is hers, her golden one is yours. Never failed: ● any marshmallow, ◆ golden,
 * ★ right in the middle of golden; the best 金黄度 is kept (上次最金黄 92 分！).
 *
 * The feet are held (PlayKit `holdLock('activity')`), and pushing the stick / WASD stands up at no cost. The sticks and
 * the marshmallows are ONE InstancedMesh (+1 draw call while toasting, 4 × 28 triangles), its own material instance on
 * the tinted instanced program (`ob-toy-inst` with instance colours: no new program), warmed as this chunk loads
 * (zones.ts fetches it within 60 u of the burning rings). BAYBAY is drawn at her seat through play/puppet.ts (her feet
 * wait there too, across the fire: out of her 2.4 u talk reach, so no 和 BAYBAY 聊聊 prompt over the fire).
 *
 * Facts (checked 2026-09-28): 16 rings between Stairwells 15 and 20, fires March–October, out by 9:30 pm with WATER
 * ONLY (https://www.nps.gov/articles/ocean-beach-fire-program.htm); "roast s'mores while watching the sun set over the
 * Pacific", bring your own firewood, 6 a.m.–9:30 p.m. (https://www.parksconservancy.org/parks/ocean-beach-sf-bonfire-fire-pit-san-francisco-marin-parks).
 */

// --- the toast ----------------------------------------------------------------------------------------------------------

/**
 * The toast τ: 0 white … 1 on fire. It rises only while the marshmallow is held in the flame (`rate` per s, ± `jitter`
 * per marshmallow); golden is [lo, hi], ★ within `star` of `centre`, ◆ anywhere in `great`; a release under `min` is
 * "not yet" (the round goes on). 0.55 after ≈ 2.75 s in the flame, 0.72 after 3.6 s, on fire after 5 s.
 */
export const TOAST = { rate: 0.2, jitter: 0.1, lo: 0.55, hi: 0.72, centre: 0.635, star: 0.05, great: [0.5, 0.78], min: 0.25, burn: 1 } as const;

/** The medal: 1 any marshmallow (a burnt one too), 2 golden, 3 right in the middle of golden. */
export function toastTier(tau: number, burnt: boolean): Tier {
  if (burnt || !Number.isFinite(tau)) return 1;
  if (Math.abs(tau - TOAST.centre) <= TOAST.star + 1e-9) return 3;
  return tau >= TOAST.great[0] && tau <= TOAST.great[1] ? 2 : 1;
}
/** 金黄度 0 … 100 (100 = the middle of golden); a burnt one scores nothing. */
export function toastScore(tau: number, burnt: boolean): number {
  if (burnt || !Number.isFinite(tau)) return 0;
  return Math.max(0, Math.min(100, Math.round(100 - Math.abs(tau - TOAST.centre) * 250)));
}
export function toastWord(tau: number, burnt: boolean): Bilingual {
  if (burnt) return { zh: '着火啦！', en: 'On fire!' };
  if (tau < 0.3) return { zh: '白白的', en: 'White' };
  if (tau < TOAST.great[0]) return { zh: '微微黄', en: 'Warming' };
  if (tau <= TOAST.great[1]) return { zh: '金黄', en: 'Golden' };
  return { zh: '焦黄', en: 'Toasty' };
}

const STOPS: [number, THREE.Color][] = ([[0, '#fbf7ef'], [0.3, '#f3e2bd'], [0.55, '#e9b765'], [0.635, '#dea24c'], [0.72, '#c98a3f'], [0.85, '#94602f'], [1, '#3b2b22']] as const)
  .map(([t, c]) => [t, new THREE.Color(c)]);
/** The marshmallow's colour at τ (white → cream → golden → brown → black). */
export function toastColor(tau: number, out = new THREE.Color()): THREE.Color {
  const t = Math.max(0, Math.min(1, tau));
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) { const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i]; return out.copy(ca).lerp(cb, (t - a) / (b - a || 1)); }
  }
  return out.copy(STOPS[STOPS.length - 1][1]);
}

export const FIRE_LINES = {
  first: { zh: '按住烤，变金黄就松手～', en: 'Hold it in the fire, let go when it’s golden!' },
  again: { zh: '再来一个！', en: 'Another one!' },
  notYet: { zh: '还白着呢，再烤一会儿～', en: 'Still white — a bit longer!' },
  flare: { zh: '着火啦！呼——快吹灭！', en: 'It’s on fire! Blow it out!' },
  swap: { zh: '焦焦脆脆的归我，金黄的给你！', en: 'The crispy one’s mine — have my golden one!' },
  golden: { zh: '金黄金黄的！外脆里软～', en: 'Golden! Crisp outside, gooey inside!' },
  great: { zh: '好香！颜色刚刚好～', en: 'Smells great — just right!' },
  pale: { zh: '还有点白，下次多烤一会儿～', en: 'Still pale — a bit longer next time!' },
  dark: { zh: '有点焦了，也挺香！', en: 'A bit dark, still tasty!' },
  fact: { zh: '真的来这儿要自带柴火，走前用水把火浇灭哦！', en: 'At the real rings, bring your own wood and put it out with water!' },
} satisfies Record<string, Bilingual>;

const HOLD_LABEL: Bilingual = { zh: '按住烤', en: 'Hold: toast' };
const hint = (): Bilingual => runtime.input.device === 'touch'
  ? { zh: '按住「烤」，金黄就松手', en: 'Hold "Toast", let go at golden' }
  : { zh: '按住 E 烤，金黄就松手', en: 'Hold E to toast, let go at golden' };

// --- the activity -------------------------------------------------------------------------------------------------------

type Phase = 'sit' | 'toast' | 'flare' | 'eat';
interface Seat { x: number; z: number; y: number; heading: number }
interface Stick { tau: number; dip: number }
interface Toast {
  phase: Phase;
  t: number;
  ring: FireRing;
  run: ActivityRun;
  seat: Seat;
  bSeat: Seat;
  player: Stick;
  baybay: Stick & { done: boolean };
  rate: number;
  burnt: boolean;
  armed: boolean;
  held: boolean;
  crackle: number;
  lastNudge: number;
  gauge: number;
  word: string;
  chomped: boolean;
  resat: boolean;
}

export const SIT_S = 1.0;
export const FLARE_S = 1.1;
export const EAT_S = 1.7;

let toast: Toast | null = null;
let rounds = 0;
let touchHold = false;
let offFrame: (() => void) | null = null;
let offLayer: (() => void) | null = null;
let keys: HeldKeys | null = null;

/** The round now (QA / tests). */
export const toastState = (): Readonly<Toast> | null => toast;
/** Tests / QA: hold (true) or let go (false) as the chip's 按住烤 does. */
export function setToastHold(down: boolean) { touchHold = down; }


/**
 * Where the two sit: the player on the promenade side of the ring and BAYBAY across the fire, both facing it, on open
 * sand and ≥ SEAT_GAP apart (out of her 2.4 u talk reach). Where the beach ends at the ring's surf side (the last ring
 * toward Lincoln Way), the two sit either side of it on the promenade side instead.
 */
export const SEAT_GAP = 2.55;
export function fireSeats(r: FireRing): { player: Seat; baybay: Seat } {
  // round the ring: angle 0 = toward the promenade, π = toward the surf; the first spot on open sand wins
  const at = (a: number, d: number) => ({ x: r.x + (r.ix * Math.cos(a) + r.ax * Math.sin(a)) * d, z: r.z + (r.iz * Math.cos(a) + r.az * Math.sin(a)) * d });
  const ok = (p: { x: number; z: number }) => canStand(p.x, p.z, 0.3) && surfaceAt(p.x, p.z) === 'sand';
  const pick = (angles: number[], d: number) => angles.flatMap(a => [at(a, d), at(a, d + 0.3)]).find(ok);
  const face = (p: { x: number; z: number }): Seat => ({ ...p, y: heightAt(p.x, p.z), heading: Math.atan2(r.x - p.x, r.z - p.z) });
  const D = Math.PI / 180;
  const player = pick([0, 25 * D, -25 * D, 50 * D, -50 * D], 1.45), baybay = pick([180 * D, 155 * D, 205 * D, 130 * D, 230 * D], 1.4);
  if (player && baybay && Math.hypot(player.x - baybay.x, player.z - baybay.z) >= SEAT_GAP) return { player: face(player), baybay: face(baybay) };
  const side = [[-60, 60], [-70, 70], [-50, 70], [-70, 50]].map(([a, b]) => [pick([a * D], 1.6), pick([b * D], 1.6)] as const)
    .find(([p, b]) => p && b && Math.hypot(p.x - b.x, p.z - b.z) >= SEAT_GAP);
  if (side) return { player: face(side[0]!), baybay: face(side[1]!) };
  return { player: face(player ?? at(0, 1.45)), baybay: face(baybay ?? at(Math.PI, 1.4)) };
}

/**
 * 烤棉花糖 at ring `k` (the prompt there). Outside the NPS season and hours BAYBAY says when fires are allowed and
 * nothing starts. Returns whether a round started.
 */
export function startMarshmallow(k: number, opts: { ignoreHours?: boolean } = {}): boolean {
  const ring = fireRingByK(k);
  if (!ring || toast || !freeOnFoot()) return false;
  if (!opts.ignoreHours && !fireLit()) { bubble(fireClosedLine(), 4200); return false; }
  const run = startActivity({ id: FIRE_ID, name: FIRE_NAME, better: 'higher' }, { lock: true, cancelOnMove: true, onStop: how => { if (how === 'cancel') cleanup(); } });
  if (!run) return false;
  rounds++;
  touchHold = false;
  const { player: seat, baybay: bSeat } = fireSeats(ring);
  const api = charApi();
  if (!api?.sitGround(seat)) teleportPlayer(seat, seat.heading);
  runtime.player.heading = seat.heading;
  toast = {
    phase: 'sit', t: 0, ring, run, seat, bSeat, player: { tau: 0, dip: 0 }, baybay: { tau: 0, dip: 0, done: false },
    rate: TOAST.rate * (1 - TOAST.jitter / 2 + Math.random() * TOAST.jitter), burnt: false, armed: false, held: false,
    crackle: 0, lastNudge: -Infinity, gauge: -1, word: '', chomped: false, resat: false,
  };
  pinBaybay(bSeat);
  api?.emote('baybay', 'sit', { loop: true });
  // from the side along the beach, a little inland and up (picked from shots of the published site): the pair seated
  // either side of the fire, the sticks over it, the sea and the sunset behind; further off on a portrait screen
  const y = heightAt(ring.x, ring.z), far = typeof window !== 'undefined' && window.innerHeight > window.innerWidth ? 1.35 : 1;
  runtime.camera.shot = {
    position: [ring.x + (ring.ix * 3.2 + ring.ax * 6) * far, y + 2.3 * far, ring.z + (ring.iz * 3.2 + ring.az * 6) * far],
    target: [ring.x - ring.ix * 0.3, y + 0.7, ring.z - ring.iz * 0.3], duration: 0.9,
  };
  showChip({
    id: FIRE_ID, title: FIRE_NAME, icon: 'fire', line: hint(), meter: { value: 0, lo: TOAST.lo, hi: TOAST.hi }, status: toastWord(0, false),
    hold: runtime.input.device === 'touch' ? { label: HOLD_LABEL, set: down => { touchHold = down; } } : undefined,
    action: { label: { zh: '不烤了', en: 'Not now' }, run: cancelMarshmallow },
  });
  bubble(rounds === 1 ? FIRE_LINES.first : FIRE_LINES.again, 2600);
  // no prompt over the fire while toasting, no small talk from BAYBAY's brain
  for (const it of fireIts) it.radius = 0;
  flow.set({ quietUntil: performance.now() + 12000 });
  offLayer = registerSceneSystem('a-play-marshmallow', MarshLayer);
  offFrame = registerFrameSystem('a-play-marshmallow', step);
  keys = holdKeys(['KeyE', 'Space']);
  return true;
}

function step(dt: number) {
  const s = toast;
  if (!s) return;
  s.t += dt;
  pinBaybay(s.bSeat);
  const gs = game.get();
  if (gs.phase !== 'playing' || gs.dialogue.nodeId || gs.photoMode) { s.run.cancel(); return; }
  // E / Space are the toast's while a round runs (captured: E never opens BAYBAY's menu, Space is no hop)
  const holding = !!keys?.held() || touchHold || input.jumpHeld;

  if (s.phase === 'sit') {
    // BAYBAY sits again once her feet have settled at her seat (a sit started while she was still walking ends at once)
    if (!s.resat && s.t >= 0.35) { s.resat = true; charApi()?.emote('baybay', 'sit', { loop: true }); }
    if (s.t >= SIT_S) { s.phase = 'toast'; s.t = 0; s.armed = !holding; }
    return;
  }

  if (s.phase === 'toast') {
    // a press held since the start counts once it has been let go
    if (!s.armed && !holding) s.armed = true;
    const want = s.armed && holding;
    s.player.dip = approach(s.player.dip, want ? 1 : 0, dt / 0.22);
    // it browns only while held in the flame; letting go stops it at once (what you see is what is judged)
    if (want && s.player.dip > 0.5) s.player.tau += s.rate * dt;
    // BAYBAY toasts hers to golden and takes it out
    const b = s.baybay;
    const bWant = !b.done && s.t > 0.8;
    b.dip = approach(b.dip, bWant ? 1 : 0, dt / 0.3);
    if (bWant && b.dip > 0.5) b.tau += TOAST.rate * 0.9 * dt;
    if (b.tau >= TOAST.centre) b.done = true;
    // the fire crackles under a marshmallow held in it
    if ((s.player.dip > 0.5 || b.dip > 0.5) && (s.crackle -= dt) <= 0) {
      s.crackle = 0.4 + Math.random() * 0.35;
      playSound('play-crackle', { gain: 0.55 + 0.45 * Math.min(1, s.player.tau) });
    }
    updateGauge(s);
    if (s.player.tau >= TOAST.burn) {
      s.burnt = true; s.phase = 'flare'; s.t = 0;
      playSound('play-flare');
      const m = tipOf(s, 'player');
      spawnFx('dust', m.x, m.y + 0.1, m.z, { color: '#4a4440', scale: 0.55, count: 10 });
      bubble(FIRE_LINES.flare, 2000);
      patchChip(FIRE_ID, { hold: undefined, action: undefined });
      updateGauge(s);
      return;
    }
    if (s.held && !want && s.armed) {
      if (s.player.tau >= TOAST.min) { startEat(s); return; }
      if (runtime.time - s.lastNudge > 3) { s.lastNudge = runtime.time; bubble(FIRE_LINES.notYet, 1800); }
    }
    s.held = want;
    return;
  }

  if (s.phase === 'flare') {
    s.player.dip = approach(s.player.dip, 0, dt / 0.3);
    if (s.t >= FLARE_S) startEat(s);
    return;
  }

  // eat: the marshmallows go to their eaters (a burnt one swaps: BAYBAY takes it, hers is yours)
  if (!s.chomped && s.t >= EAT_MOVE_S) {
    s.chomped = true;
    playSound('play-chomp');
    const api = charApi();
    for (const who of ['player', 'baybay'] as const) {
      const m = mouthOf(s, who);
      spawnFx('hearts', m.x, m.y + 0.35, m.z, { count: who === 'player' && !s.burnt && toastTier(s.player.tau, false) === 3 ? 6 : 3, scale: 0.7 });
    }
    api?.emote('baybay', 'clap');
  }
  if (s.t >= EAT_S) finish(s);
}

function updateGauge(s: Toast) {
  const v = Math.round(Math.min(1, s.player.tau) * 100) / 100;
  const word = toastWord(s.player.tau, s.burnt);
  if (v === s.gauge && word.zh === s.word) return;
  s.gauge = v; s.word = word.zh;
  patchChip(FIRE_ID, { meter: { value: v, lo: TOAST.lo, hi: TOAST.hi }, status: word });
}

export const EAT_MOVE_S = 0.8;

function startEat(s: Toast) {
  s.phase = 'eat'; s.t = 0;
  s.held = false;
  updateGauge(s);
  patchChip(FIRE_ID, { hold: undefined, action: undefined, line: undefined });
  const tau = s.player.tau, tier = toastTier(tau, s.burnt);
  bubble(s.burnt ? FIRE_LINES.swap : tier === 3 ? FIRE_LINES.golden : tier === 2 ? FIRE_LINES.great : tau < TOAST.lo ? FIRE_LINES.pale : FIRE_LINES.dark, 2800);
  if (tier >= 2 && !s.burnt) { const m = tipOf(s, 'player'); spawnFx('sparkle', m.x, m.y, m.z, { color: '#ffd27a', scale: 0.6, count: tier === 3 ? 12 : 6 }); }
}

function finish(s: Toast) {
  const tier = toastTier(s.player.tau, s.burnt), score = toastScore(s.player.tau, s.burnt);
  const first = rounds === 1;
  const k = s.ring.k;
  s.run.end({
    tier,
    ...(s.burnt ? {} : { score }),
    detail: s.burnt ? { zh: '焦焦脆脆 · 和 BAYBAY 换着吃', en: 'Extra crispy · swapped with BAYBAY' } : { zh: `金黄度 ${score} 分`, en: `Golden ${score} / 100` },
    bestText: b => ({ zh: `上次最金黄 ${b} 分！`, en: `Your best: ${b} / 100!` }),
    again: () => { startMarshmallow(k); },
  });
  cleanup(s);
  if (first) sayWhenQuiet(FIRE_LINES.fact, 3600);
}

/** Stand up, let go of BAYBAY and the camera, hide the chip; the layer goes a frame later. */
function cleanup(done: Toast | null = toast) {
  offFrame?.(); offFrame = null;
  keys?.off(); keys = null;
  hideChip(FIRE_ID);
  touchHold = false;
  for (const it of fireIts) it.radius = FIRE_PROMPT_R;
  if (!done && !toast) { offLayer?.(); offLayer = null; return; }
  toast = null;
  charApi()?.stand();
  setPuppet('baybay', null);
  runtime.camera.shot = null;
  const off = offLayer;
  offLayer = null;
  setTimeout(() => off?.(), 50);
}

/** 不烤了 / moving / tests: end the round now at no cost. */
export function cancelMarshmallow() { toast?.run.cancel(); }

// --- where things are -----------------------------------------------------------------------------------------------

// (every helper writes into the vector it is given: the layer runs them each frame without making objects)
const FLAME_AT = new THREE.Vector3();

/** The hand holding the stick: in front of a seated body, a little to its right. */
function handOf(s: Toast, who: 'player' | 'baybay', out = new THREE.Vector3()): THREE.Vector3 {
  const st = who === 'player' ? s.seat : s.bSeat;
  const fx = Math.sin(st.heading), fz = Math.cos(st.heading), rx = -fz, rz = fx;
  const up = who === 'player' ? 0.46 : 0.4, side = who === 'player' ? 0.12 : -0.1;
  return out.set(st.x + fx * 0.3 + rx * side, st.y + up, st.z + fz * 0.3 + rz * side);
}
/** Where a marshmallow is toasted: over the ring's middle, in the top of the flame (a hair apart, one each). */
function flameOf(s: Toast, who: 'player' | 'baybay', out = new THREE.Vector3()): THREE.Vector3 {
  const r = s.ring, side = who === 'player' ? -0.1 : 0.1;
  return out.set(r.x + r.ax * side, heightAt(r.x, r.z) + 0.64, r.z + r.az * side);
}
/** The marshmallow's point on its stick now (between out of the fire and in it). */
function tipOf(s: Toast, who: 'player' | 'baybay', out = new THREE.Vector3()): THREE.Vector3 {
  const fire = flameOf(s, who, FLAME_AT), dip = smooth(who === 'player' ? s.player.dip : s.baybay.dip);
  handOf(s, who, out).lerp(fire, 0.6);
  out.y += 0.12;
  return out.lerp(fire, dip);
}
/** In front of a seated eater's face. */
function mouthOf(s: Toast, who: 'player' | 'baybay', out = new THREE.Vector3()): THREE.Vector3 {
  const st = who === 'player' ? s.seat : s.bSeat;
  return out.set(st.x + Math.sin(st.heading) * 0.2, st.y + (who === 'player' ? 0.78 : 0.66), st.z + Math.cos(st.heading) * 0.2);
}

// --- the layer: two sticks, two marshmallows (play/toyMesh.ts: +1 draw call, 4 × 28 triangles) -------------------------

const WOOD = new THREE.Color('#8a5a34'), FLAME = new THREE.Color('#ff7a2a');
// the warm-up set: this chunk is fetched within 60 u of a burning ring, before the first round
registerToyWarmup('marshmallow');
ensurePlaySounds3();

const dir = new THREE.Vector3(), col = new THREE.Color(), HAND = new THREE.Vector3(), TIP = new THREE.Vector3(), MOUTH = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3();

/** One frame of the layer: the sticks from the hands through the marshmallows, which go to their eaters at the end. */
export function updateMarshMesh(mesh: THREE.InstancedMesh) {
  const s = toast;
  if (!s) { mesh.count = 0; return; }
  const eating = s.phase === 'eat', k = eating ? smooth(Math.min(1, s.t / EAT_MOVE_S)) : 0;
  const size = eating && s.t > EAT_MOVE_S + 0.12 ? 0 : 1;
  let n = 0;
  for (const who of ['player', 'baybay'] as const) {
    const hand = handOf(s, who, HAND), tip = tipOf(s, who, TIP);
    dir.subVectors(tip, hand).normalize();
    // the stick runs from behind the hand through the marshmallow
    placeRod(mesh, n, A.copy(hand).addScaledVector(dir, -0.22), B.copy(tip).addScaledVector(dir, 0.1), 0.035);
    mesh.setColorAt(n++, WOOD);
    // the marshmallow, skewered; at the end it goes to its eater (a burnt one swaps)
    const eater = s.burnt ? (who === 'player' ? 'baybay' : 'player') : who;
    placeAlong(mesh, n, eating ? tip.lerp(mouthOf(s, eater, MOUTH), k) : tip, dir, 0.2 * size, 0.24 * size, 0.2 * size);
    toastColor(s.burnt && who === 'player' ? 1 : who === 'player' ? s.player.tau : s.baybay.tau, col);
    // on fire: it flickers between the flame and the char until BAYBAY blows it out
    if (who === 'player' && s.phase === 'flare') col.lerp(FLAME, 0.45 + 0.4 * Math.sin(s.t * 31) * Math.sin(s.t * 13));
    mesh.setColorAt(n++, col);
  }
  commitToy(mesh, n);
}

function MarshLayer() {
  const scene = useThree(st => st.scene);
  const mesh = useMemo(() => toyMesh('marshmallow', 'cyl', 4, 0.65), []);
  useEffect(() => () => { mesh.geometry.dispose(); mesh.dispose(); }, [mesh]);
  useFrame(() => { applyPuppets(scene); updateMarshMesh(mesh); });
  return createElement('primitive', { object: mesh });
}

/** tests */
export function __resetMarshmallow() { if (toast) toast.run.cancel(); toast = null; rounds = 0; touchHold = false; }
