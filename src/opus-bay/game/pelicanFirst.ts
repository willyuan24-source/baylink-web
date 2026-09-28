import { glideUnlocked, pulseGlideButton, setGlideUnlocked } from '../actors/moveApi';
import { onEvent } from '../core/events';
import { input } from '../core/input';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { Bilingual } from '../core/types';
import { readQa } from './qa';
import { ATTRACTIONS } from '../data/sf/attractions';
import { CITY_GOAL } from '../data/sf/goals';
import { W5_PELICAN, w5Text } from '../data/sf/linesW5';
import type { ArrivalHit } from './arrival';
import { cinemaActive } from './cinema';
import { travelActive } from './fastTravel';
import { bubble, defineNode, dialogueOpen, goalsStepOpen, markGoalsDone, playDialogue, say } from './flow';
import { flow } from './flowStore';
import { BAYBAY_ID } from './interactables';

/**
 * Wave 5 · lane C · W5-C2 (plan sf-w5-plan.md MF3 "the pelican first", §4.6): the pelican glide is unlocked early, and
 * the unlock is a moment. LAZY (game/cityMoments.ts, the city chunk, imports it; flow reaches it through
 * game/cityContent.ts `unlockPelican`).
 *
 *   where         the first arrival (or a return after leaving) at Coit Tower or any of the six panorama viewpoints
 *                 (lane P's ATTRACTIONS with `panorama`: Coit, Twin Peaks, the de Young tower, Bernal Heights, Corona
 *                 Heights, Grand View Park) — `unlocksAt(hit)`; the Coit viewpoint sweep (flow, E at the view); the
 *                 Grand Tour's first stop reached (game/cityTour.ts arrived: no route change)
 *   at once       moveApi.setGlideUnlocked(true) (起飞 appears, the pelican model loads, the save's `unlocked.glide` is
 *                 written by lane N's sampler), goal #1 `pelican` marked (quiet: the moment is the toast) → its
 *                 `goal` event and lane E's `reward goal:pelican` (game/rewards.ts)
 *   the moment    as soon as nothing else is on screen (no dialogue, panel, cinematic, arrival card, fast travel; on
 *                 foot): the gold toast 解锁：随时飞！(with the take-off key of this device), then —
 *                 free roam: BAYBAY 以后想去哪都能飞啦！先试试起飞？ [试试起飞 · 以后再说]; 试试起飞 hands off to lane A's
 *                 `startFirstFlight()` (play/index.ts, the rings course) when it is there, else takes off right away;
 *                 the Grand Tour: one line through BAYBAY's pacer (the tour goes on; no route change)
 *   already       a save that had the glide before wave 5: the goal is ticked quietly on load (no reward, no moment)
 *
 * The Alcatraz name line ("Alcatraz" = old Spanish for pelican) is lane D's egg 11 (the first loop round the island):
 * lane C does not say it here.
 */

export type UnlockReason = 'viewpoint' | 'sweep' | 'tour';

/** The six panorama viewpoints (Coit among them): arriving at any unlocks the pelican. */
export const PELICAN_VIEWPOINTS: ReadonlySet<string> = new Set(ATTRACTIONS.filter(a => a.panorama).map(a => a.id));

/** Does this arrival hit unlock the pelican? (pure: a panorama viewpoint's arrival anchor or its summit spot) */
export const unlocksAt = (hit: Pick<ArrivalHit, 'anchor'>): boolean => PELICAN_VIEWPOINTS.has(hit.anchor.attraction);

/** The moment's words; BAYBAY's spoken lines are lane C's frozen wave-5 set (data/sf/linesW5.ts, W5-C6: voice ids). */
export const PELICAN_LINES = {
  /** the toast: "解锁：随时飞！" + the take-off key of this device */
  toast: (key: Bilingual): Bilingual => ({ zh: `解锁：随时飞！${key.zh}`, en: `Unlocked: fly anytime! ${key.en}` }),
  ask: w5Text(W5_PELICAN.ask),
  yes: { zh: '试试起飞', en: "Let's fly!" },
  later: { zh: '以后再说', en: 'Maybe later' },
  go: w5Text(W5_PELICAN.go),
  /** (names the device's control: text only, never recorded) */
  laterBubble: (key: Bilingual): Bilingual => ({ zh: `想飞的时候${key.zh}就行～`, en: `Whenever you want to fly, just ${key.en}.` }),
  tour: w5Text(W5_PELICAN.tour),
} as const;

/** Take-off in the words of this device (= actors/moveSystem.ts keyName('glide')). */
export function takeOffKey(device = runtime.input.device): Bilingual {
  return device === 'touch' ? { zh: '点「起飞」', en: 'tap Glide' } : device === 'gamepad' ? { zh: '按 L3 起飞', en: 'press L3 to take off' } : { zh: '按 G 起飞', en: 'press G to take off' };
}

const ASK_NODE = 'pelican.moment';
const GO_NODE = 'pelican.go';
/** the moment waits at most this long for a quiet screen (ms); after it, a free-roam moment becomes a bubble */
export const MOMENT_WAIT_MS = 45_000;
/** …and at least this long after the unlock (ms): the arrival's own toast and line go first */
export const MOMENT_MIN_MS = 2200;

interface Pending { reason: UnlockReason; since: number }
let pending: Pending | null = null;
let wantFlight = false;
/** lane A's first flight, when its chunk exports it (plan §4.3: `startFirstFlight()` from play/) */
let flightStarter: (() => unknown) | null = null;

/** Tests / QA: the moment waiting, if any. */
export const pelicanPending = (): Readonly<Pending> | null => pending;

/**
 * Unlock the pelican now (a no-op when it is already unlocked or in district mode). Returns true when this call
 * unlocked it; the moment follows on the next quiet frame (`stepPelican`).
 */
export function unlockPelican(reason: UnlockReason, now = performance.now()): boolean {
  if (game.get().worldMode !== 'city') return false;
  syncPelicanGoal();
  if (glideUnlocked()) return false;
  setGlideUnlocked(true);
  // quiet: the moment is the toast (the goal event still plays its sound and lane E pays `goal:pelican`)
  markGoalsDone([CITY_GOAL.pelican], { quiet: true });
  // the Grand Tour: at once, right after the stop's own line (the tour goes on: no dialogue, no waiting)
  if (reason === 'tour' || game.get().tour.active) { tourMoment(); return true; }
  pending = { reason, since: now };
  return true;
}

/** BAYBAY's pacer (game/cityMoments.ts registers it at boot): a frozen line id (its voice once recorded) or a text. */
type Offer = (line: string | Bilingual, ttl?: number) => boolean;
let offerFn: Offer | null = null;
/** Plays a recorded clip of a frozen line with a dialogue that shows its text (game/cityMoments.ts; none: text only). */
let voiceFn: ((id: string) => void) | null = null;

/** The tour's version of the moment: the toast and one paced line, queued behind the stop's arrive line. */
function tourMoment() {
  const key = takeOffKey();
  say(PELICAN_LINES.toast(key).zh, PELICAN_LINES.toast(key).en, 'gold', 4600);
  if (!offerFn?.(W5_PELICAN.tour.id, 60)) bubble(PELICAN_LINES.tour, 4200);
}

/** A save that had the glide before wave 5 (or ?debug=1): tick goal #1 quietly — no reward, no moment. */
export function syncPelicanGoal() {
  const s = game.get();
  if (s.worldMode !== 'city' || !glideUnlocked() || s.goalsDone.includes(CITY_GOAL.pelican) || readQa().debug) return;
  game.set({ goalsDone: [...s.goalsDone, CITY_GOAL.pelican] });
}

/** Nothing else on screen: the moment may play. */
function quiet(now: number, p: Pending): boolean {
  const s = game.get(), f = flow.get();
  if (now - p.since < MOMENT_MIN_MS) return false;
  return s.phase === 'playing' && !s.paused && !dialogueOpen() && s.panel.kind === null && !cinemaActive() && !f.cinematic && !f.arrival
    && !travelActive() && s.move.mode === 'foot' && !s.photoMode && !f.postcardReward && !f.postcardFly && !f.fishing && !goalsStepOpen();
}

/** City frame system (≈ 4 Hz, game/cityMoments.ts): play the moment once the screen is free. `offer` = BAYBAY's pacer. */
export function stepPelican(now: number, offer: Offer) {
  const p = pending;
  if (!p) return;
  const inTour = game.get().tour.active || p.reason === 'tour';
  const late = now - p.since > MOMENT_WAIT_MS;
  if (!quiet(now, p) && !late) return;
  pending = null;
  const key = takeOffKey();
  say(PELICAN_LINES.toast(key).zh, PELICAN_LINES.toast(key).en, 'gold', 4600);
  if (inTour) { if (!offer(W5_PELICAN.tour.id, 60)) bubble(PELICAN_LINES.tour, 4200); return; }
  // waited too long for a quiet screen (a trip, a ride): a bubble, never a dialogue over something else
  if (late && !quiet(now, { ...p, since: -Infinity })) { bubble(PELICAN_LINES.laterBubble(key), 4200); return; }
  wantFlight = false;
  const ask = defineNode({
    id: ASK_NODE, speaker: 'baybay', mood: 'excited', text: PELICAN_LINES.ask,
    choices: [
      { hotkey: '1', label: PELICAN_LINES.yes, next: GO_NODE },
      { hotkey: '2', label: PELICAN_LINES.later, action: { type: 'end' } },
    ],
  });
  defineNode({ id: GO_NODE, speaker: 'baybay', mood: 'excited', text: PELICAN_LINES.go });
  runtime.guide.emote = 'hop';
  voiceFn?.(W5_PELICAN.ask.id);
  playDialogue(ask, () => {
    if (wantFlight) { wantFlight = false; voiceFn?.(W5_PELICAN.go.id); takeOff(); return; }
    bubble(PELICAN_LINES.laterBubble(takeOffKey()), 4200, BAYBAY_ID, 'call');
    // (phones: lane F's 起飞 pulses once more, where the line points)
    pulseGlideButton();
  }, { kind: 'two-shot', subject: null });
}

/**
 * 试试起飞: lane A's first flight (play/index.ts `startFirstFlight`, a live export while the play feature runs; it
 * resolves false when it cannot start), else — or when it refuses — a plain take-off (the 起飞 press).
 */
function takeOff() {
  const plain = () => { input.glideCount++; };
  const run = (start: (() => unknown) | undefined) => {
    if (typeof start !== 'function') { plain(); return; }
    try { void Promise.resolve(start()).then(ok => { if (ok === false) plain(); }, plain); } catch (error) { if (import.meta.env?.DEV) console.warn('[opus-bay pelican] first flight', error); plain(); }
  };
  if (flightStarter) { run(flightStarter); return; }
  void import('../play/index').then(m => run((m as { startFirstFlight?: () => unknown }).startFirstFlight), plain);
}

// 试试起飞 opens GO_NODE: remembered for the moment's end (module level: this module lives in the city chunk only)
onEvent(e => { if (e.type === 'dialogue' && (e.nodeId === GO_NODE || e.nodeId === ASK_NODE)) wantFlight = e.nodeId === GO_NODE; });

/** The city chunk's boot: BAYBAY's pacer for the tour's line; tick an old save's goal #1. Returns the disposer. */
export function initPelicanFirst(offer: Offer | null = null, voice: ((id: string) => void) | null = null): () => void {
  offerFn = offer;
  voiceFn = voice;
  syncPelicanGoal();
  return () => { pending = null; wantFlight = false; offerFn = null; voiceFn = null; };
}

/** Tests: forget the moment and lane A's starter; `offer` stands in for BAYBAY's pacer. */
export function resetPelicanForTests(starter: (() => unknown) | null = null, offer: Offer | null = null, voice: ((id: string) => void) | null = null) { pending = null; wantFlight = false; flightStarter = starter; offerFn = offer; voiceFn = voice; }

