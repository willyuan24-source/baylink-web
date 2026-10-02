import { createElement } from 'react';
import { charApi } from '../actors/charApi';
import { terrainGlideWorld, type GlideWorld } from '../actors/glide';
import { LiveTall } from '../actors/glideTall';
import { playSound } from '../audio/hooks';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { heightAt } from '../core/terrain';
import type { Bilingual } from '../core/types';
import { bubble, say } from '../game/flow';
import { flow } from '../game/flowStore';
import { registerFrameSystem } from '../game/systemsRegistry';
import { useT } from '../i18n';
import { closeOverlay, openOverlay, registerOverlay, type OverlayProps } from '../ui/slots';
import { hideChip, patchChip, showChip } from './chip';
import { currentActivity, startActivity, type ActivityRun } from './kit';
import { freeOnFoot } from './partc';
import { SKYLINE_ID, SKYLINE_LINES, SKYLINE_NAME, SKYLINE_SPOTS, type SkylineSpot } from './skylineLines';
import { VIEW_SPOTS } from './viewSpots';

/**
 * Wave 7 · lane W2 · 那是什么？ the skyline quiz (sf-w7-lead §3 W2 (3)): anywhere with a view, 问 BAYBAY → 那是什么？
 * (play/kiteEntry.ts). BAYBAY points, the camera turns to a landmark that is really in line of sight from where you
 * stand (the ground's height field and every roof / tall part the glide knows, sampled along the ray), and you pick its
 * name from three; each answer adds the landmark's one-line fact. Three rounds (≈ 40 s; fewer when fewer landmarks are in
 * sight, each asked once): ● one right · ◆ two · ★ three (W9-G6: by the share — ★ all right of two or more, ◆ ≥ 2/3 or one of
 * one, ● one; the landmarks asked show at least SKY_MIN_ANGLE on screen from the round's camera) →
 * `medal:skyline:n` through the kit (points = right answers; the notebook keeps the best). With nothing in view she says
 * so and names the nearest 看风景 spot. Its own lazy chunk; the camera shot is released at the end.
 */

export const ROUNDS = 3;
/** a landmark counts from this far (u) … to this far */
export const SKY_MIN = 30, SKY_MAX = 1500;
/** the eye over the player's feet (u) */
const EYE = 1.6;
/** the pause after an answer before the next round (s), and after the last */
export const AFTER_ANSWER = 4.2;
const CARD = 'w2-skyline';

/** The ground and every roof / tall part near (x, z) (the glide's world: city blocks, landmark parts, the hero towers). */
export type Occluder = (x: number, z: number) => number;
let glideWorld: GlideWorld | null = null;
const live = new LiveTall();
/** the live occluder (exported for QA probes: the old / new askable counts) */
export function liveOccluder(): Occluder {
  glideWorld ??= terrainGlideWorld(() => live.get());
  const w = glideWorld;
  return (x, z) => Math.max(w.heightAt(x, z), w.roofAt(x, z, 0.3));
}

/**
 * Is `s` in sight from the eye at `from`: nothing along the ray (samples every 1.5 u near you, up to 12 u far off) rises
 * above it, except inside the landmark's own radius at the end.
 */
export function inSight(from: { x: number; y: number; z: number }, s: SkylineSpot, occ: Occluder): boolean {
  return scan(from, s, occ) > -9;
}

/**
 * (W9-G6) One walk along the ray to `s` (the samples above): -10 when something rises over the line to its aim point (or
 * it is too near / too far: inSight), else how tall it shows as an angle — from its top down to the highest thing in
 * front of it (the ground, roofs, tall parts; its own footprint excluded) or sea level (visibleAngle).
 */
function scan(from: { x: number; y: number; z: number }, s: SkylineSpot, occ: Occluder): number {
  const dx = s.x - from.x, dz = s.z - from.z, D = Math.hypot(dx, dz);
  if (D < SKY_MIN || D > SKY_MAX) return -10;
  const end = D - s.r - 4;
  let d = 3, block = Math.atan2(-from.y, D);
  while (d < end) {
    const k = d / D, h = occ(from.x + dx * k, from.z + dz * k);
    if (h > from.y + (s.y - from.y) * k - 0.3) return -10;
    block = Math.max(block, Math.atan2(h - from.y, d));
    d += Math.min(12, Math.max(1.5, d * 0.04));
  }
  return Math.max(0, Math.atan2(s.top - from.y, D) - block);
}

/**
 * (W9-G6) the least visible height (radians) a landmark must show to be asked: ≈ 1.7°, ≈ 28 px on a 900 px tall screen
 * (review 2026-10-01 R§6 玩法: the third question's Alcatraz, 600 u off and 14 u high, was a sliver behind the Embarcadero —
 * "Alcatraz NOT visible")
 */
export const SKY_MIN_ANGLE = 0.03;
/** (W9-G6) a bridge's long span reads at half that (from a hill the Bay Bridge is a low line, but a long one) */
export const minAngleOf = (s: SkylineSpot): number => (s.long ? SKY_MIN_ANGLE / 2 : SKY_MIN_ANGLE);

/** (W9-G6) How tall `s` shows from `from`, as an angle (0 when hidden or out of range): scan above. */
export const visibleAngle = (from: { x: number; y: number; z: number }, s: SkylineSpot, occ: Occluder): number => Math.max(0, scan(from, s, occ));

/** (W9-G6) where the camera stands for a round on `s` (behind the player, a little to the side and up: nextRound's shot) */
export function shotFrom(p: { x: number; z: number }, eyeY: number, s: { x: number; z: number }): { x: number; y: number; z: number } {
  const h = Math.atan2(s.x - p.x, s.z - p.z), dx = Math.sin(h), dz = Math.cos(h);
  return { x: p.x - dx * 3.8 - dz * 0.9, y: eyeY + 1.1, z: p.z - dz * 3.8 + dx * 0.9 };
}

/**
 * The landmarks in sight from `from`, nearest first: on a clear line from the eye and (W9-G6) from the round's camera,
 * showing at least SKY_MIN_ANGLE of their height on screen (a bridge half that).
 */
export function spotsInSight(from: { x: number; y: number; z: number }, occ: Occluder, list: readonly SkylineSpot[] = SKYLINE_SPOTS): SkylineSpot[] {
  return list.filter(s => inSight(from, s, occ) && scan(shotFrom(from, from.y, s), s, occ) >= minAngleOf(s)).sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z));
}

/**
 * (W9-G6) The medal by the share named right (review 2026-10-01 R§6 玩法: with one landmark in sight all right was only
 * ●): all right ★ once two or more were asked (one question alone is ◆: not a free ★, W7-W2-review), ≥ 2/3 ◆, one ●.
 */
export const skylineTier = (right: number, asked: number): 0 | 1 | 2 | 3 =>
  right <= 0 ? 0 : right >= asked ? (asked > 1 ? 3 : 2) : right * 3 >= asked * 2 ? 2 : 1;

/** Three names for a round: the right one and two others, in a shuffled order. */
export function choicesFor(right: SkylineSpot, rand: () => number, list: readonly SkylineSpot[] = SKYLINE_SPOTS): SkylineSpot[] {
  const others = list.filter(s => s.id !== right.id).map(s => ({ s, k: rand() })).sort((a, b) => a.k - b.k).slice(0, 2).map(e => e.s);
  return [right, ...others].map(s => ({ s, k: rand() })).sort((a, b) => a.k - b.k).map(e => e.s);
}

/** The nearest 看风景 spot (play/viewSpots) to (x, z). */
export function nearestViewSpot(x: number, z: number): { id: string; name: Bilingual; d: number } | null {
  let best: { id: string; name: Bilingual; d: number } | null = null;
  for (const v of VIEW_SPOTS) {
    if (v.retired) continue;
    const d = Math.hypot(v.x - x, v.z - z);
    if (!best || d < best.d) best = { id: v.id, name: v.name, d };
  }
  return best;
}

/** the follow-up after noView (ms) */
export const NO_VIEW_FOLLOW_MS = 3100;

/**
 * W8-K3 (lane K, surgical): after "nothing in sight" BAYBAY points at the nearest lookout — a fixed line lane X can voice
 * (SKYLINE_LINES.noViewPin), the lookout's name on a toast and on the waypoint (its `view:<id>` prompt as the map
 * target: the pin shows until you get there). Was the templated bubble 最近的观景点：<name>. False when none.
 */
export function pointNearestLookout(x: number, z: number): boolean {
  const v = nearestViewSpot(x, z);
  if (!v) return false;
  bubble(SKYLINE_LINES.noViewPin, 3200);
  say(`最近的观景点 · ${v.name.zh}`, `Nearest lookout · ${v.name.en}`, 'info', 4200);
  if (!flow.get().trip && !flow.get().freeLead) flow.set({ mapTarget: `view:${v.id}` });
  return true;
}

interface CardProps { round: number; choices: { id: string; name: Bilingual }[]; answered: string | null; right: string }
interface Live { run: ActivityRun; order: SkylineSpot[]; round: number; right: number; t: number; wait: number; answered: string | null; choices: SkylineSpot[]; rand: () => number }
let game0: Live | null = null;
let offFrame: (() => void) | null = null;
let offCard: (() => void) | null = null;

export const skylineLive = (): Readonly<Live> | null => game0;

/** 问 BAYBAY → 那是什么？ False (and her line) when nothing is in sight here. */
export function startSkyline(opts: { occ?: Occluder; rand?: () => number } = {}): boolean {
  if (game0 || !freeOnFoot() || currentActivity() || game.get().mode !== 'free') return false;
  const p = runtime.player, rand = opts.rand ?? Math.random;
  const eye = { x: p.x, y: heightAt(p.x, p.z) + EYE, z: p.z };
  const seen = spotsInSight(eye, opts.occ ?? liveOccluder());
  if (!seen.length) {
    bubble(SKYLINE_LINES.noView, 3000);
    const at = { x: p.x, z: p.z };
    setTimeout(() => pointNearestLookout(at.x, at.z), NO_VIEW_FOLLOW_MS);
    return false;
  }
  const run = startActivity({ id: SKYLINE_ID, name: SKYLINE_NAME, better: 'higher' }, { cancelOnMove: true, onStop: () => cleanup() });
  if (!run) return false;
  // the rounds: the landmarks in sight in a shuffled order, each asked once (W7-W2-review: with fewer than three in
  // sight the old order repeated them, so one landmark in view was the same question three times and a free ★)
  const pool = seen.map(s => ({ s, k: rand() })).sort((a, b) => a.k - b.k).map(e => e.s);
  const order = pool.slice(0, ROUNDS);
  game0 = { run, order, round: -1, right: 0, t: 0, wait: 0, answered: null, choices: [], rand };
  offCard = registerOverlay({ id: CARD, Component: SkylineCard });
  showChip({ id: SKYLINE_ID, icon: 'play', title: SKYLINE_NAME, big: `1 / ${order.length}`, line: { zh: '看 BAYBAY 指的方向', en: 'Look where BAYBAY points' }, action: { label: { zh: '不玩了', en: 'Stop' }, run: () => { game0?.run.cancel(); } } });
  bubble(SKYLINE_LINES.start, 2600);
  playSound('play-go');
  nextRound(game0);
  offFrame = registerFrameSystem('w2-skyline', step);
  return true;
}

function nextRound(g: Live) {
  g.round++;
  g.answered = null;
  g.wait = 0;
  const s = g.order[g.round];
  g.choices = choicesFor(s, g.rand);
  if (g.round > 0) bubble(SKYLINE_LINES.next, 1800);
  // BAYBAY turns and points; the camera looks from behind you along the line to it
  const p = runtime.player, b = runtime.guide;
  const h = Math.atan2(s.x - p.x, s.z - p.z);
  b.heading = h;
  p.heading = h;
  charApi()?.emote('baybay', 'point', { seconds: 2.4 });
  const cam = shotFrom(p, heightAt(p.x, p.z) + EYE, s);
  runtime.camera.shot = { position: [cam.x, cam.y, cam.z], target: [s.x, s.y, s.z], duration: 1.1 };
  patchChip(SKYLINE_ID, { big: `${g.round + 1} / ${g.order.length}` });
  openOverlay(CARD, cardProps(g));
}

const cardProps = (g: Live): CardProps => ({ round: g.round, choices: g.choices.map(c => ({ id: c.id, name: c.name })), answered: g.answered, right: g.order[g.round].id });

/** A tap on a name (the card, tests). */
export function answerSkyline(id: string): boolean {
  const g = game0;
  if (!g || g.answered || g.round < 0) return false;
  const s = g.order[g.round], ok = id === s.id;
  g.answered = id;
  if (ok) { g.right++; playSound('play-pop', { pitch: 1.3 }); charApi()?.emote('baybay', 'cheer', { seconds: 1.2 }); }
  else playSound('play-whoosh');
  bubble(ok ? SKYLINE_LINES.right : SKYLINE_LINES.wrong, 1300);
  setTimeout(() => { if (game0 === g && g.run.active) bubble(s.fact, 3400); }, 1300);
  openOverlay(CARD, cardProps(g));
  return true;
}

function step(dt: number) {
  const g = game0;
  if (!g || !g.run.active) return;
  g.t += dt;
  if (!g.answered) return;
  g.wait += dt;
  if (g.wait < AFTER_ANSWER) return;
  if (g.round + 1 < g.order.length) { nextRound(g); return; }
  finish(g);
}

function finish(g: Live) {
  const r = g.right;
  g.run.end({
    tier: skylineTier(r, g.order.length), score: r,
    detail: { zh: `认对 ${r} / ${g.order.length} 个地标`, en: `${r} / ${g.order.length} landmarks named` },
    bestText: v => ({ zh: `最多认对 ${v} 个`, en: `Best ${v} named` }),
    again: () => { startSkyline(); },
  });
  setTimeout(() => bubble(r === ROUNDS ? SKYLINE_LINES.allRight : SKYLINE_LINES.done, 2600), 400);
}

function cleanup() {
  offFrame?.(); offFrame = null;
  hideChip(SKYLINE_ID);
  closeOverlay(CARD);
  const off = offCard;
  offCard = null;
  setTimeout(() => off?.(), 0);
  runtime.camera.shot = null;
  game0 = null;
}

/** The three names (touch-first: big buttons over the bottom bar). */
function SkylineCard({ props }: OverlayProps) {
  const { t } = useT();
  const c = props as CardProps | undefined;
  if (!c) return null;
  return createElement('div', {
    className: 'ob-play-sky',
    style: { position: 'absolute', left: '50%', bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: 8, width: 'min(92vw, 360px)', pointerEvents: 'auto', zIndex: 30 },
  }, c.choices.map(ch => {
    const done = c.answered !== null, right = ch.id === c.right, picked = ch.id === c.answered;
    const cls = `ob-play-btn${done && right ? ' is-go' : ''}`;
    return createElement('button', {
      key: `${c.round}-${ch.id}`, type: 'button', className: cls, disabled: done,
      style: { minHeight: 48, fontSize: 17, width: '100%', opacity: done && !right && !picked ? 0.55 : 1, textDecoration: done && picked && !right ? 'line-through' : 'none' },
      onClick: () => { answerSkyline(ch.id); },
    }, t(ch.name));
  }));
}

/** tests */
export function __resetSkyline() { game0?.run.cancel(); game0 = null; }
