import { createElement, lazy, Suspense } from 'react';
import { autoGliding, glideUnlocked } from '../actors/moveApi';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { surfaceAt } from '../core/terrain';
import type { Bilingual } from '../core/types';
import { SEWARD_SLIDES_WORLD } from '../data/sf/sewardSlides';
import { onSaveCleared } from '../data/save';
import { bayNow, bayParts } from '../game/bayNow';
import { baybayHeld } from '../game/baybayHold';
import { bubble } from '../game/flow';
import { flow } from '../game/flowStore';
import { registerInteractables, type Interactable } from '../game/interactables';
import { sunDay } from '../game/qa';
import { registerFrameSystem } from '../game/systemsRegistry';
import { registerRidePad } from '../ui/rideSlots';
import { registerOverlay } from '../ui/slots';
import { CHIP_OVERLAY } from './chip';
import { GGB_ID, GGB_INVITE_R, GGB_LINES, GGB_MID, GGB_NEAR } from './ggbRings';
import { bestOf, currentActivity, saveNumber } from './kit';
import { ensurePlaySounds2 } from './sounds2';
import { courseFoot, courseTop, STAIR_COURSES, STEPS_PER_U } from './stairCourses';
import { importRetry } from '../game/importRetry';

/**
 * Wave 5 · lane A · the activity zones (play/index.ts loads this chunk at init, city mode only): what is always there
 * while the city runs, small on purpose — the activity chip overlay, the 滑下去 / 比赛？ prompts at the Seward slides and
 * the stair courses' feet, BAYBAY's one invite when you get there, the cable car's bell pad (lane T's ride banner slot),
 * the step counter (今天 412 级), and each activity's own chunk fetched once you are within PREFETCH_R of its zone.
 *
 *   slides.ts   the Seward Street slides (W5-A6)       stairs.ts   the stair races (W5-A8)
 *   bell.ts + BellPad.tsx   the cable-car bell riff and the lean-out photo (W5-A7), loaded with the pad on a cable car
 *   zones3.ts   part c (W5-A9), its own chunk loaded at init: the should activities' zones (marshmallow.ts: the fire rings…)
 *   the Golden Gate rings (W5-A9, ggbRings.ts): gliding by the bridge starts them (firstFlight.ts, course 'ggb')
 */

export const PREFETCH_R = 60;
/** BAYBAY's invite at a zone: within this many u, at most once per zone per INVITE_GAP s. */
export const INVITE_R = 5;
export const INVITE_GAP = 180;

// --- the Seward slides' hours (Bay time) ------------------------------------------------------------------------------

export const SLIDES = SEWARD_SLIDES_WORLD;
export const SLIDES_ID = 'slides';
export const SLIDES_NAME: Bilingual = { zh: '纸板滑梯', en: 'Cardboard slides' };
export const SLIDES_CLOSED_LINE: Bilingual = { zh: '滑梯现在没开：周二到周日 10 点到 5 点再来！', en: 'The slides are closed now: come back Tue–Sun, 10 to 5!' };
export const SLIDES_INVITE_LINE: Bilingual = { zh: '滑梯！坐块纸板，一起滑下去？', en: 'Slides! Grab some cardboard and whoosh down?' };

/**
 * Open now on the Bay clock (sfrecpark.org "Seward Mini Park", checked 2026-09-28): Tuesday to Sunday 10:00–17:00, and
 * the park closes at sunset.
 */
export function slidesOpen(date: Date = bayNow()): boolean {
  const p = bayParts(date), h = SLIDES.hours;
  if (!h.days.includes(p.weekday)) return false;
  const minute = p.hour * 60 + p.minute;
  if (minute < h.open || minute >= h.close) return false;
  return date.getTime() < sunDay(p.dateKey).sunset;
}

const WEST = SLIDES.chutes.find(c => c.id === 'west') ?? SLIDES.chutes[0];
export const SLIDES_PROMPT_R = 1.8;
const SLIDE_VERB: Bilingual = { zh: '滑下去', en: 'Slide down' };
const HOURS_VERB: Bilingual = { zh: '几点开？', en: 'Opening hours' };

/** The 滑下去 prompt on the top deck, at the west chute's head (the verb says 几点开？ outside the hours). */
export const slidesIt: Interactable = {
  id: 'play:slides', source: 'activity', action: 'info', verb: SLIDE_VERB, name: SLIDES_NAME,
  x: WEST.start.x, z: WEST.start.z, radius: SLIDES_PROMPT_R,
  act: () => {
    if (!slidesOpen()) { bubble(SLIDES_CLOSED_LINE, 4200); return; }
    void importRetry(() => import('./slides')).then(m => { m.startSlides(); });
  },
};

// --- the stair courses --------------------------------------------------------------------------------------------------

export const STAIRS_VERB: Bilingual = { zh: '比赛？', en: 'Race?' };
export const STAIRS_INVITE_LINE: Bilingual = { zh: '比比谁先爬到顶？我可不会让你哦！', en: 'Race you to the top? I won\'t go easy!' };
export const stairsIts: Interactable[] = STAIR_COURSES.map(c => ({
  id: `play:stairs:${c.id}`, source: 'activity', action: 'info', verb: STAIRS_VERB,
  name: { zh: `和 BAYBAY 比爬${c.name.zh}`, en: `Race BAYBAY up the ${c.name.en}` },
  ...courseFoot(c), radius: 2.4,
  act: () => { void importRetry(() => import('./stairs')).then(m => { m.startStairRace(c.id); }); },
}));

// --- the step counter ---------------------------------------------------------------------------------------------------

/** play.b keys: the lifetime count, today's count and its Bay day (days since 1970 of the Bay date). */
export const STEP_KEYS = { total: 'steps', today: 'steps-today', day: 'steps-day' } as const;
const bayDay = (dateKey: string) => Math.round(Date.parse(`${dateKey}T00:00:00Z`) / 86400000);
/** BAYBAY says today's count when it passes one of these (at most once per MILESTONE_GAP s). */
export const STEP_MILESTONES = [100, 200, 300, 400, 500, 750, 1000, 1500, 2000, 3000];
const MILESTONE_GAP = 90;

const steps = { loaded: false, total: 0, today: 0, day: 0, unsaved: 0, lastSave: 0, lastLine: -Infinity, lastY: NaN, offStairs: 0 };

function loadSteps() {
  if (steps.loaded) return;
  steps.loaded = true;
  steps.total = Math.max(0, Math.floor(bestOf(STEP_KEYS.total) ?? 0));
  steps.day = bestOf(STEP_KEYS.day) ?? 0;
  steps.today = Math.max(0, Math.floor(bestOf(STEP_KEYS.today) ?? 0));
}
function rollDay() {
  const day = bayDay(bayParts().dateKey);
  if (day !== steps.day) { steps.day = day; steps.today = 0; }
}
/** Steps climbed today (Bay date) and ever. */
export function stepsToday(): number { loadSteps(); rollDay(); return Math.floor(steps.today); }
export function stepsTotal(): number { loadSteps(); return Math.floor(steps.total); }
function saveSteps() {
  steps.unsaved = 0;
  steps.lastSave = runtime.time;
  saveNumber(STEP_KEYS.total, Math.floor(steps.total));
  saveNumber(STEP_KEYS.today, Math.floor(steps.today));
  saveNumber(STEP_KEYS.day, steps.day);
}
/** Count `rise` u climbed on stairs; says a milestone when today's count passes one (not during an activity). */
export function addStairRise(rise: number) {
  if (!(rise > 0)) return;
  loadSteps();
  rollDay();
  const before = steps.today, n = rise * STEPS_PER_U;
  steps.today += n; steps.total += n; steps.unsaved += n;
  const passed = STEP_MILESTONES.filter(m => before < m && steps.today >= m).pop();
  const s = game.get(), f = flow.get();
  const quiet = !currentActivity() && !f.bubble && !f.cinematic && !s.dialogue.nodeId && !s.photoMode;
  if (passed && quiet && runtime.time - steps.lastLine > MILESTONE_GAP) {
    steps.lastLine = runtime.time;
    bubble(stepsLine(passed), 3400);
  }
}
export const stepsLine = (n: number): Bilingual => ({ zh: `今天爬了 ${n} 级台阶啦！`, en: `${n} steps climbed today!` });

/** The counter's frame step (4 Hz): height gained while on stairs, on foot. */
function countStep(dt: number) {
  const p = runtime.player;
  if (runtime.move.mode !== 'foot' || game.get().phase !== 'playing') { steps.lastY = NaN; return; }
  const onStairs = surfaceAt(p.x, p.z) === 'stairs';
  const dy = p.y - steps.lastY;
  // a teleport / a fall never counts; only up, and only on the stairs
  if (onStairs && dy > 0 && dy < 2.5) addStairRise(dy);
  steps.lastY = p.y;
  steps.offStairs = onStairs ? 0 : steps.offStairs + dt;
  if (steps.unsaved > 0 && (steps.offStairs > 2 || runtime.time - steps.lastSave > 12)) saveSteps();
}

/**
 * BAYBAY's line after an activity (a fact, today's steps): `delay` ms later, when nothing else talks — no dialogue, no
 * cinematic, no other bubble, no activity running (lane C's pelican moment at Coit, an arrival card); gives up after 30 s.
 */
export function sayWhenQuiet(line: Bilingual, delay: number, ms = 3600) {
  let waited = 0;
  const tryIt = () => {
    const s = game.get(), f = flow.get();
    // (W8-K4, lane K surgical) not under a play panel / card either (an egg card, the album, the Halloween postcard…)
    const busy = s.phase !== 'playing' || !!s.dialogue.nodeId || s.photoMode || !!f.cinematic || !!f.bubble || !!currentActivity() || baybayHeld();
    if (!busy) { bubble(line, ms); return; }
    if ((waited += 1500) <= 30000) setTimeout(tryIt, 1500);
  };
  setTimeout(tryIt, delay);
}

// --- the chip and the pad -----------------------------------------------------------------------------------------------

const PlayChip = lazy(() => importRetry(() => import('./PlayChip')));
const ChipSlot = () => createElement(Suspense, { fallback: null }, createElement(PlayChip));
const BellPad = lazy(() => importRetry(() => import('./BellPad')));
type PadProps = { ride: import('../game/flowStore').FlowRide };
const PadSlot = ({ ride }: PadProps) => createElement(Suspense, { fallback: null }, createElement(BellPad, { ride }));

/**
 * The bell pad rides on a cable car once it has left the stop (lane T's ride banner) — not while another game runs on
 * board (W8-M-review: lane M's grip; a tap on 铃声对答 there started the riff and so ended the grip with nothing paid).
 * 'bell' is bell.ts's BELL_ID (not imported: this chunk stays free of the riff's).
 */
export const bellPadVisible = (r: { kind?: string; stage: string }) => {
  const run = currentActivity();
  return r.kind === 'cable-car' && r.stage !== 'waiting' && (!run || run.spec.id === 'bell');
};

// --- the helpers every zone uses (zones3.ts too) ---------------------------------------------------------------------

const invited = new Map<string, number>();
const fetched = new Set<string>();
/** The player within r of (x, z). */
export const nearPlayer = (x: number, z: number, r: number) => Math.hypot(runtime.player.x - x, runtime.player.z - z) <= r;
function quiet() {
  const s = game.get(), f = flow.get();
  // (W8-K4, lane K surgical) not under a play panel / card either (an egg card, the album, the Halloween postcard…)
  return s.phase === 'playing' && !s.dialogue.nodeId && !s.photoMode && runtime.move.mode === 'foot' && !f.cinematic && !f.bubble && !currentActivity() && !baybayHeld();
}
/** BAYBAY's invite at a zone: once per INVITE_GAP s per key, only when quiet and she is near. */
export function zoneInvite(key: string, line: Bilingual) {
  if (runtime.time - (invited.get(key) ?? -Infinity) < INVITE_GAP || !quiet()) return;
  if (Math.hypot(runtime.guide.x - runtime.player.x, runtime.guide.z - runtime.player.z) > 14) return;
  invited.set(key, runtime.time);
  bubble(line, 3600, undefined, 'call');
}
/** Fetch an activity chunk once (again after a failed fetch). */
export function zonePrefetch(key: string, load: () => Promise<unknown>) { if (!fetched.has(key)) { fetched.add(key); void load().catch(() => fetched.delete(key)); } }

export function initZones(): () => void {
  const offs: (() => void)[] = [];
  // the activities' sounds (synthesized recipes: registered, nothing plays until an activity asks)
  ensurePlaySounds2();
  offs.push(registerOverlay({ id: CHIP_OVERLAY, Component: ChipSlot }));
  offs.push(registerInteractables('a-play-zones', () => [slidesIt, ...stairsIts]));
  offs.push(registerRidePad({ id: 'bell', order: 10, visible: bellPadVisible, Component: PadSlot }));
  // Settings → reset progress: the counter starts over from the fresh save (else its next save wrote the old count back);
  // leaving the city: the steps not saved yet are kept
  offs.push(onSaveCleared(__resetSteps));
  offs.push(() => { if (steps.unsaved > 0) saveSteps(); });
  // part c: the should activities' zones (the fire rings, the turntables…), their own chunk
  let off3: (() => void) | null = null, disposed = false;
  void importRetry(() => import('./zones3')).then(m => { if (!disposed) off3 = m.initZones3(); });
  offs.push(() => { disposed = true; off3?.(); });

  let acc = 0, ggbTried = false;
  offs.push(registerFrameSystem('a-play-zones', dt => {
    if ((acc += dt) < 0.25) return;
    const step = acc;
    acc = 0;
    countStep(step);
    if (game.get().worldMode !== 'city') return;
    // the slides: the verb follows the hours; the invite on the deck
    const open = slidesOpen();
    slidesIt.verb = open ? SLIDE_VERB : HOURS_VERB;
    if (nearPlayer(SLIDES.deck.x, SLIDES.deck.z, PREFETCH_R)) zonePrefetch('slides', () => importRetry(() => import('./slides')));
    if (nearPlayer(SLIDES.deck.x, SLIDES.deck.z, 3.2)) zoneInvite('slides', open ? SLIDES_INVITE_LINE : SLIDES_CLOSED_LINE);
    // the stair courses: fetch the race near either end; invite at the foot
    for (const c of STAIR_COURSES) {
      const foot = courseFoot(c), top = courseTop(c);
      if (nearPlayer(foot.x, foot.z, PREFETCH_R) || nearPlayer(top.x, top.z, PREFETCH_R)) zonePrefetch('stairs', () => importRetry(() => import('./stairs')));
      if (nearPlayer(foot.x, foot.z, INVITE_R)) zoneInvite(`stairs:${c.id}`, STAIRS_INVITE_LINE);
    }
    // the Golden Gate rings: gliding by the bridge, not all 8 flown yet — the course, once a visit; on foot, BAYBAY's invite.
    // Never on a trip the pelican flies by itself (lane F's scenic auto-glide: 飞过去 / 带我去 past the bridge — review
    // 2026-09-28: it took over the trip's line and ended in a 再试试 card at the landing)
    {
      const g = runtime.glide, todo = (bestOf(GGB_ID) ?? 0) < 8;
      if (!nearPlayer(GGB_MID.x, GGB_MID.z, 2 * GGB_NEAR)) ggbTried = false;
      if (g.active && todo && !ggbTried && !currentActivity() && !autoGliding() && Math.hypot(g.x - GGB_MID.x, g.z - GGB_MID.z) < GGB_NEAR) {
        ggbTried = true;
        void importRetry(() => import('./firstFlight')).then(m => { m.startFirstFlight({ course: 'ggb' }); });
      }
      if (todo && glideUnlocked() && nearPlayer(GGB_MID.x, GGB_MID.z, GGB_INVITE_R)) zoneInvite('ggb', GGB_LINES.invite);
    }
  }));
  return () => { for (const off of offs.splice(0).reverse()) { try { off(); } catch { /* gone */ } } };
}

/** tests: forget the counter */
export function __resetSteps() { Object.assign(steps, { loaded: false, total: 0, today: 0, day: 0, unsaved: 0, lastSave: 0, lastLine: -Infinity, lastY: NaN, offStairs: 0 }); }
