import { useFrame, useThree } from '@react-three/fiber';
import { createElement, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { charApi } from '../actors/charApi';
import { playSound } from '../audio/hooks';
import { input } from '../core/input';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { canStand, heightAt } from '../core/terrain';
import type { Bilingual } from '../core/types';
import type { SewardChute, SlidePoint } from '../data/sf/sewardSlides';
import { bubble, teleportPlayer, walkTo } from '../game/flow';
import { flow } from '../game/flowStore';
import { registerFrameSystem, registerSceneSystem } from '../game/systemsRegistry';
import { spawnFx } from '../world/fx';
import { cardboardMesh, registerCardboardWarmup } from './cardboard';
import { hideChip, patchChip, showChip } from './chip';
import { startActivity, type ActivityRun, type Tier } from './kit';
import { applyPuppets, puppetPose, resetPuppets, setPuppet, type PuppetPose, type PuppetWho } from './puppet';
import { sayWhenQuiet, SLIDES, SLIDES_CLOSED_LINE, SLIDES_ID, SLIDES_NAME, SLIDES_PROMPT_R, slidesIt, slidesOpen } from './zones';

/**
 * Wave 5 · lane A · the Seward Street slides (W5-A6, plan §3.2 A-slides): on the top deck of Seward Mini Park, 滑下去
 * (phone: the contextual button; desktop: E) sits the player on a sheet of cardboard at the head of the west chute and
 * BAYBAY at the east one; 3 · 2 · 1 · 冲！ and both whoosh down side by side. Holding Hop (Space / pad B / the chip's 趴低
 * on a phone) lies back on the cardboard, as the kids do, and slides faster; BAYBAY slides at a steady pace in between,
 * so a ride lying back wins and a sitting one loses by a nose. The card: ● 好 (down the slide), ◆ 很好 (before BAYBAY),
 * ★ 太棒了 (before her and lying back nearly all the way); the best time is kept (上次你最快 2.6 秒！).
 *
 * The bodies ride their chute lines (data/sf/sewardSlides.ts, lane L3) through play/puppet.ts — only their drawing
 * moves; runtime.player waits on the deck (the chutes are a blocker) and both are put on their run-outs at the foot when
 * the ride ends. The feet are held through PlayKit's `holdLock('activity')` for the whole ride. The camera takes two
 * shots of its own (runtime.camera.shot): over the shoulders at the top, then at the foot looking up the chutes as they
 * come; the follow camera takes over at the end. Nothing here is a cinematic: the HUD stays.
 *
 * Real hours (zones.ts slidesOpen; sfrecpark.org "Seward Mini Park", checked 2026-09-28): open 10 am – 5 pm Tuesday to
 * Sunday, the park closes at sunset; "adults must be accompanied by children"; "bring a piece of cardboard and wear
 * sturdy pants". Outside the hours the prompt says 几点开？ and BAYBAY tells them.
 */

// the sleds' material is warmed as this chunk loads (zones.ts fetches it within 60 u of the deck)
registerCardboardWarmup();

const chuteOf = (id: 'west' | 'east') => SLIDES.chutes.find(c => c.id === id)!;
/** The player rides the west chute, BAYBAY the east one. */
export const PLAYER_CHUTE = chuteOf('west');
export const BAYBAY_CHUTE = chuteOf('east');

// --- the line of a ride ---------------------------------------------------------------------------------------------

export interface SlidePath { pts: SlidePoint[]; cum: number[]; len: number; /** arc length where the chute ends */ bottom: number }

/** A rider's line: on the deck at the chute head → the lip → down the chute bed → the run-out on the sidewalk. */
export function chutePath(c: SewardChute, groundAt: (x: number, z: number) => number = heightAt): SlidePath {
  const pts: SlidePoint[] = [{ ...c.start }, { ...c.top }, { ...c.bottom }, { x: c.runout.x, y: groundAt(c.runout.x, c.runout.z), z: c.runout.z }];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z));
  return { pts, cum, len: cum[cum.length - 1], bottom: cum[2] };
}

/** The point at arc length s and the line's pitch there (nose down +). */
export function pointAt(path: SlidePath, s: number): SlidePoint & { pitch: number } {
  const { pts, cum } = path;
  let i = 1;
  while (i < pts.length - 1 && s > cum[i]) i++;
  const a = pts[i - 1], b = pts[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const k = Math.max(0, Math.min(1, (s - cum[i - 1]) / seg));
  const run = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, pitch: Math.atan2(a.y - b.y, run) };
}

/**
 * The slide: a push, then gravity less the cardboard's rub (a − drag·v²) down the chute; lying back adds `tuck`. Past the
 * chute's end the rider skids to a stop on the run-out. Tuned so a sitting ride takes ≈ 3.4 s, one lying back all the
 * way ≈ 2.5 s and BAYBAY's 2.9–3.0 s (tests/opus-bay-w5-play-acts.test.ts simulates all three on the real chute).
 */
export const SLIDE_PHYS = { push: 0.8, accel: 1.5, tuck: 1.4, drag: 0.1, stop: 7, baybay: 2.05 } as const;

export interface Slider { s: number; v: number }
export function slideStep(r: Slider, dt: number, accel: number, path: SlidePath) {
  if (r.s < path.bottom) r.v = Math.max(0, r.v + (accel - SLIDE_PHYS.drag * r.v * r.v) * dt);
  else r.v = Math.max(0, r.v - SLIDE_PHYS.stop * dt);
  r.s = Math.min(path.len, r.s + r.v * dt);
}

/** Seconds from the push to the chute's end with `accelAt(t)` (tests, the gold time). */
export function slideTime(path: SlidePath, accelAt: (t: number) => number, dt = 1 / 120): number {
  const r: Slider = { s: 0, v: SLIDE_PHYS.push };
  let t = 0;
  while (r.s < path.bottom && t < 20) { slideStep(r, dt, accelAt(t), path); t += dt; }
  return t;
}

/** The medal: down the slide 1, before BAYBAY 2, before her and at most GOLD_MARGIN s slower than lying back all the way 3. */
export const GOLD_MARGIN = 0.12;
export function slideTier(time: number, baybay: number, fullTuck: number): 0 | Tier {
  if (!Number.isFinite(time)) return 0;
  if (time >= baybay) return 1;
  return time <= fullTuck + GOLD_MARGIN ? 3 : 2;
}

// --- the ride ---------------------------------------------------------------------------------------------------------

type Phase = 'hop' | 'ready' | 'slide' | 'done';
interface Rider extends Slider { who: PuppetWho; chute: SewardChute; path: SlidePath; from: PuppetPose; finish: number | null; dusted: boolean }
interface Ride {
  phase: Phase;
  t: number;
  /** seconds since 冲！ */
  clock: number;
  player: Rider;
  baybay: Rider;
  baybayAccel: number;
  tucked: boolean;
  /** the countdown beat shown last (−1: none yet) */
  beat: number;
  run: ActivityRun;
  park: { x: number; z: number };
}

export const HOP_S = 0.55;
/** the countdown: a line first, then 3 · 2 · 1 on ticks, then 冲！ */
export const READY_S = 0.9;
export const COUNT_S = 0.55;
export const DONE_S = 0.9;
/** a stuck ride never holds the player: this is far past any ride */
export const RIDE_MAX_S = 8;

let ride: Ride | null = null;
let rides = 0;
let lost = 0;
/** the phone's 趴低 (the chip's press-and-hold button) */
let touchTuck = false;
let offFrame: (() => void) | null = null;
let offLayer: (() => void) | null = null;
let offKeys: (() => void) | null = null;

/** The ride now (QA / tests). */
export const slideState = (): Readonly<Ride> | null => ride;
export const slidesActive = () => ride !== null;

export const SLIDE_LINES = {
  firstReady: { zh: '规定大人要有小朋友陪——BAYBAY 算小朋友吧？', en: 'Rule: grown-ups need a kid along. Does BAYBAY count?' },
  ready: { zh: '坐稳啦，一起滑！', en: 'Sit tight, here we go!' },
  win: { zh: '你赢啦！躺下真的更快～', en: 'You win! Lying back really is faster!' },
  loseFirst: { zh: '我先到啦！下次按住躺下试试～', en: 'Me first! Hold to lie back next time!' },
  lose: { zh: '嘿嘿，又是我先到！', en: 'Hehe, me first again!' },
  fact: { zh: '真的去滑要自带纸板，穿结实的裤子哦！', en: 'At the real slides, bring cardboard and sturdy pants!' },
} satisfies Record<string, Bilingual>;

const TUCK_LABEL: Bilingual = { zh: '按住躺下', en: 'Hold: lie back' };
const hint = (): Bilingual => runtime.input.device === 'touch'
  ? { zh: '按住「躺下」滑得更快', en: 'Hold "Lie back" to go faster' }
  : { zh: '按住 空格 躺下，滑得更快', en: 'Hold Space to lie back: faster' };

/** Where a rider sits at arc length s (a hair over the chute bed), facing down the chute, pitched with it. */
function riderPose(r: Rider): PuppetPose {
  const p = pointAt(r.path, r.s);
  return { x: p.x, y: p.y + 0.02, z: p.z, heading: r.chute.heading, pitch: r.s < r.path.bottom ? p.pitch : 0 };
}

function bodyPose(who: PuppetWho): PuppetPose {
  const b = who === 'player' ? runtime.player : runtime.guide;
  return { x: b.x, y: b.y, z: b.z, heading: b.heading };
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (k: number) => k * k * (3 - 2 * k);

/**
 * Where BAYBAY's feet wait during the ride (her body rides the east chute): a step up the deck, out of her 2.4 u talk
 * reach of the player's waiting feet, so no 和 BAYBAY 聊聊 prompt shows under the ride.
 */
function parkSpot(): { x: number; z: number } {
  const p = runtime.player;
  for (const [dx, dz] of [[1.2, 2.8], [-1.2, 2.8], [0, 3.1], [2.9, 1.2], [-2.9, 1.2], [0, 2.2]] as const) {
    if (canStand(p.x + dx, p.z + dz, 0.3)) return { x: p.x + dx, z: p.z + dz };
  }
  return { x: p.x, z: p.z };
}

/** Can a ride start now (playing on foot, nothing modal, not already riding)? */
export function canSlide(): boolean {
  const s = game.get();
  return !ride && s.phase === 'playing' && !s.dialogue.nodeId && !s.photoMode && s.riding === null && runtime.move.mode === 'foot' && !flow.get().cinematic;
}

/**
 * 滑下去: start a ride from the deck (the prompt there). Outside the real hours BAYBAY says when they open and nothing
 * starts. Returns whether a ride started.
 */
export function startSlides(opts: { ignoreHours?: boolean } = {}): boolean {
  if (!canSlide()) return false;
  if (!opts.ignoreHours && !slidesOpen()) { bubble(SLIDES_CLOSED_LINE, 4200); return false; }
  const run = startActivity({ id: SLIDES_ID, name: SLIDES_NAME, better: 'lower' }, { lock: true, onStop: how => { if (how === 'cancel') cleanup(); } });
  if (!run) return false;
  const rider = (who: PuppetWho, chute: SewardChute): Rider => ({ who, chute, path: chutePath(chute), s: 0, v: 0, from: bodyPose(who), finish: null, dusted: false });
  rides++;
  touchTuck = false;
  ride = {
    phase: 'hop', t: 0, clock: 0, player: rider('player', PLAYER_CHUTE), baybay: rider('baybay', BAYBAY_CHUTE),
    baybayAccel: SLIDE_PHYS.baybay * (0.97 + Math.random() * 0.06), tucked: false, beat: -1, run, park: parkSpot(),
  };
  const api = charApi();
  api?.emote('player', 'sit', { loop: true });
  api?.emote('baybay', 'sit', { loop: true });
  // behind and above the pair on the deck, looking down both chutes (picked from shots of the published site)
  const d = SLIDES.deck;
  runtime.camera.shot = { position: [d.x + 1.9, d.y + 4.5, d.z + 6.4], target: [d.x, d.y - 2.5, d.z - 7.6], duration: 0.9 };
  showChip({
    id: SLIDES_ID, title: SLIDES_NAME, icon: 'slide', line: hint(),
    hold: runtime.input.device === 'touch' ? { label: TUCK_LABEL, set: down => { touchTuck = down; } } : undefined,
    action: { label: { zh: '不滑了', en: 'Not now' }, run: cancelSlides },
  });
  bubble(rides === 1 ? SLIDE_LINES.firstReady : SLIDE_LINES.ready, 2600);
  // no prompt under the ride (the feet wait on the deck) and no small talk from BAYBAY's brain over it
  slidesIt.radius = 0;
  flow.set({ quietUntil: performance.now() + 9000 });
  offLayer = registerSceneSystem('a-play-slides', SlideLayer);
  offFrame = registerFrameSystem('a-play-slides', step);
  offKeys = holdMoveKeys();
  return true;
}

/**
 * During a ride the move keys and the stick are not the player's (the feet are held anyway): a held key would end the
 * sitting pose (lane F's emotes end on a move). Returns the release.
 */
function holdMoveKeys(): () => void {
  const MOVE = /^(Key[WASD]|Arrow(Up|Down|Left|Right))$/;
  for (const k of [...input.keys]) if (MOVE.test(k)) input.keys.delete(k);
  input.stick.active = false; input.stick.x = 0; input.stick.y = 0;
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {};
  const block = (e: KeyboardEvent) => { if (MOVE.test(e.code)) e.stopPropagation(); };
  window.addEventListener('keydown', block, true);
  return () => window.removeEventListener('keydown', block, true);
}

function step(dt: number) {
  const r = ride;
  if (!r) return;
  r.t += dt;
  const api = charApi();
  // BAYBAY's feet wait beside the deck (her body is on the chute): pinned, so her walk never starts under the pose
  const g = runtime.guide;
  if (r.phase !== 'done') { g.x = r.park.x; g.z = r.park.z; g.y = heightAt(r.park.x, r.park.z); g.target = null; }
  if (game.get().phase !== 'playing' || game.get().dialogue.nodeId) { r.run.cancel(); return; }

  if (r.phase === 'hop') {
    const k = smooth(Math.min(1, r.t / HOP_S));
    for (const who of ['player', 'baybay'] as const) {
      const rd = r[who], to = riderPose(rd), f = rd.from;
      setPuppet(who, {
        x: f.x + (to.x - f.x) * k, y: f.y + (to.y - f.y) * k + Math.sin(k * Math.PI) * 0.45, z: f.z + (to.z - f.z) * k,
        heading: f.heading + wrap(to.heading - f.heading) * k, pitch: 0,
      });
    }
    if (r.t >= HOP_S) {
      r.phase = 'ready'; r.t = 0;
      const s = r.player.path.pts[0];
      spawnFx('dust', s.x, s.y, s.z, { scale: 0.6 });
    }
    return;
  }

  if (r.phase === 'ready') {
    setPuppet('player', riderPose(r.player));
    setPuppet('baybay', riderPose(r.baybay));
    const beat = r.t < READY_S ? -1 : Math.floor((r.t - READY_S) / COUNT_S);
    if (beat >= 0 && beat < 3 && beat !== r.beat) {
      r.beat = beat;
      patchChip(SLIDES_ID, { big: String(3 - beat) });
      playSound('play-tick');
    }
    if (beat >= 3) {
      r.phase = 'slide'; r.t = 0;
      r.player.v = SLIDE_PHYS.push; r.baybay.v = SLIDE_PHYS.push;
      patchChip(SLIDES_ID, { big: '冲！', action: undefined });
      playSound('play-go');
      playSound('play-whoosh', { gain: 0.9 });
      // in front of the foot, above the trees there, looking up both chutes as they come
      const b = SLIDES.foot, y = PLAYER_CHUTE.bottom.y;
      runtime.camera.shot = { position: [b.x + 0.3, y + 5.4, b.z - 3.3], target: [b.x - 0.3, y + 1.9, b.z + 6.2], duration: 1.1 };
    }
    return;
  }

  if (r.phase === 'slide') {
    r.clock += dt;
    const tuck = input.jumpHeld || touchTuck;
    if (tuck !== r.tucked) {
      r.tucked = tuck;
      api?.emote('player', tuck ? 'lie' : 'sit', { loop: true });
      if (tuck) playSound('play-whoosh', { gain: 0.5 });
    }
    slideStep(r.player, dt, SLIDE_PHYS.accel + (tuck ? SLIDE_PHYS.tuck : 0), r.player.path);
    slideStep(r.baybay, dt, r.baybayAccel, r.baybay.path);
    for (const who of ['player', 'baybay'] as const) {
      const rd = r[who];
      if (rd.finish === null && rd.s >= rd.path.bottom) rd.finish = r.clock;
      if (rd.finish !== null && !rd.dusted) {
        rd.dusted = true;
        const b = rd.chute.bottom;
        spawnFx('dust', b.x, b.y, b.z, { scale: 0.9 });
      }
      setPuppet(who, riderPose(rd));
    }
    if (r.player.finish !== null && r.baybay.finish !== null && r.player.v === 0 && r.baybay.v === 0) {
      r.phase = 'done'; r.t = 0;
      const won = r.player.finish < r.baybay.finish;
      if (!won) lost++;
      bubble(won ? SLIDE_LINES.win : lost === 1 ? SLIDE_LINES.loseFirst : SLIDE_LINES.lose, 3000);
      api?.emote('baybay', won ? 'clap' : 'cheer');
      if (won) api?.emote('player', 'cheer');
      hideChip(SLIDES_ID);
    }
    if (r.clock > RIDE_MAX_S) r.run.cancel();
    return;
  }

  // done: stand up at the foot, hand the bodies back, the card
  if (r.t >= DONE_S) finish(r);
}

function finish(r: Ride) {
  const pf = r.player.finish ?? Infinity, bf = r.baybay.finish ?? Infinity;
  // the time lying back all the way would have taken (the gold mark), on this very path
  const full = slideTime(r.player.path, () => SLIDE_PHYS.accel + SLIDE_PHYS.tuck);
  const tier = slideTier(pf, bf, full);
  const n = (x: number) => x.toFixed(1);
  const first = rides === 1;
  r.run.end({
    tier,
    score: +pf.toFixed(2),
    detail: { zh: `你 ${n(pf)} 秒 · BAYBAY ${n(bf)} 秒`, en: `You ${n(pf)} s · BAYBAY ${n(bf)} s` },
    bestText: b => ({ zh: `上次你最快 ${n(b)} 秒！`, en: `Your best: ${n(b)} s!` }),
    again: againSlides,
  });
  cleanup(r);
  if (first) sayWhenQuiet(SLIDE_LINES.fact, 3400);
}

/** Put the heroes where the ride ended (on their run-outs, facing down the street) and let go of everything. */
function cleanup(done: Ride | null = ride) {
  const r = done ?? ride;
  offFrame?.(); offFrame = null;
  offKeys?.(); offKeys = null;
  hideChip(SLIDES_ID);
  touchTuck = false;
  runtime.input.jump = false;
  slidesIt.radius = SLIDES_PROMPT_R;
  if (!r) { offLayer?.(); offLayer = null; return; }
  ride = null;
  const api = charApi();
  const ended = r.phase === 'slide' || r.phase === 'done';
  if (ended) {
    const po = r.player.chute.runout, bo = r.baybay.chute.runout;
    teleportPlayer(po, r.player.chute.heading);
    const g = runtime.guide;
    g.x = bo.x + 0.4; g.z = bo.z; g.y = heightAt(bo.x + 0.4, bo.z); g.heading = r.baybay.chute.heading;
  }
  // (a cancelled ride: the feet never left the deck; BAYBAY's are beside it)
  api?.stand();
  setPuppet('player', null);
  setPuppet('baybay', null);
  runtime.camera.shot = null;
  // the layer goes a frame later, after the actors placed the bodies back (no frame with the old pose)
  const off = offLayer;
  offLayer = null;
  setTimeout(() => off?.(), 50);
}

/** 再来一次: back up to the deck (the path takes the steps beside the slides) and ride again on arrival. */
export function againSlides() {
  const s = PLAYER_CHUTE.start;
  walkTo({ x: s.x, z: s.z }, 'play:slides');
}

/** Skip / tests: stop the ride now at no cost. */
export function cancelSlides() { ride?.run.cancel(); }

// --- the layer: the bodies on the chutes and the two sheets of cardboard ---------------------------------------------

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);

/** The layer's frame: the bodies on their poses, a sheet of cardboard under each rider. */
function updateSleds(sleds: THREE.InstancedMesh, scene: THREE.Object3D) {
  applyPuppets(scene);
  let n = 0;
  if (ride) {
    for (const who of ['player', 'baybay'] as const) {
      const p = puppetPose(who);
      if (!p) continue;
      e.set(p.pitch ?? 0, p.heading, 0, 'YXZ');
      q.setFromEuler(e);
      pos.set(p.x, p.y + 0.03, p.z);
      sleds.setMatrixAt(n++, m4.compose(pos, q, one));
    }
  }
  sleds.count = n;
  sleds.instanceMatrix.needsUpdate = true;
}

function SlideLayer() {
  const scene = useThree(s => s.scene);
  const sleds = useMemo(() => cardboardMesh(2), []);
  useEffect(() => () => { sleds.geometry.dispose(); sleds.dispose(); }, [sleds]);
  useFrame(() => updateSleds(sleds, scene));
  return createElement('primitive', { object: sleds });
}

/** tests */
export function __resetSlides() { if (ride) ride.run.cancel(); ride = null; rides = 0; lost = 0; touchTuck = false; resetPuppets(); }
