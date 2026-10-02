import { glideUnlocked, pelicanGreet, pulseGlideButton, setGlideUnlocked } from '../actors/moveApi';
import { greetSpot } from '../actors/vehicles/pelican';
import { onEvent } from '../core/events';
import { input } from '../core/input';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { canStand, heightAt } from '../core/terrain';
import type { Bilingual, Vec2 } from '../core/types';
import { readQa } from './qa';
import { ATTRACTIONS } from '../data/sf/attractions';
import { CITY_GOAL } from '../data/sf/goals';
import { W5_PELICAN, w5Text } from '../data/sf/linesW5';
import type { ArrivalHit } from './arrival';
import { baybayHeld } from './baybayHold';
import { cinemaActive } from './cinema';
import { travelActive } from './fastTravel';
import { bubble, defineNode, dialogueOpen, goalsStepOpen, markGoalsDone, playDialogue, say, setTalkMarkSource } from './flow';
import { autoOn } from './autoTravel';
import { isArrived } from './trips';
import { PELICAN_TARGET } from './cityGoals';
import { flow } from './flowStore';
import { BAYBAY_ID } from './interactables';
import { importRetry } from './importRetry';

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
/** (W9-X) BAYBAY's fixed later line: fly whenever you like — the control is on a toast (PELICAN_LINES.laterToast) */
export const PELICAN_LATER_LINE: Bilingual = { zh: '想飞的时候，叫上鹈鹕就行～', en: 'Whenever you want to fly, just call the pelican!' };

export const PELICAN_LINES = {
  /** the toast: "解锁：随时飞！" + the take-off key of this device */
  toast: (key: Bilingual): Bilingual => ({ zh: `解锁：随时飞！${key.zh}`, en: `Unlocked: fly anytime! ${key.en}` }),
  ask: w5Text(W5_PELICAN.ask),
  yes: { zh: '试试起飞', en: "Let's fly!" },
  later: { zh: '以后再说', en: 'Maybe later' },
  go: w5Text(W5_PELICAN.go),
  /**
   * (W9-X, lane X surgical · w8 K-RC-3) BAYBAY's later line is fixed (voiced: lines match by their exact words); the
   * device's control is on the 随时飞 toast (`laterToast`), not in her words. `key` is kept for the callers' shape.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the callers' shape (the key is on the toast now)
  laterBubble: (_key?: Bilingual): Bilingual => PELICAN_LATER_LINE,
  /** the take-off control of this device, on a toast with the later line (W9-X) */
  laterToast: (key: Bilingual): Bilingual => ({ zh: `随时飞 · ${key.zh}`, en: `Fly anytime · ${key.en}` }),
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
/**
 * The moment's two-shot frames you both (mid-wave checkpoint CP-14: coming up the slope from Washington Square, the
 * player stood 3 u below Coit's summit plaza with BAYBAY on the downhill side, so the conversation camera — behind you,
 * opposite her — sat on the plaza 0.9 u above its paving and saw only the paving). The dialogue waits until she is
 * within PAIR_NEAR of you (or at most PAIR_WAIT_MS after the unlock), and while it plays she stands PAIR_GAP beside you
 * on the side that leaves the camera's side of you open: the conversation camera stands TWO_BACK behind the pair at
 * ±TWO_SWING (actors/camera.ts twoShotPose: 8 u, 2.3 u up, 25–57° off the axis; it weighs buildings, not the hill),
 * so her mark is chosen where the ground between those spots and your chest stays under the line of sight, and not
 * below your feet (the camera stands over the lower of the two: at the plaza's rim a mark down the slope dropped it to
 * the paving).
 */
export const PAIR_NEAR = 4;
export const PAIR_WAIT_MS = 9000;
export const PAIR_GAP = 1.7;
/** …and when she stands within this of that spot as the dialogue opens she is placed on it (u) */
export const PAIR_SNAP = 5;
/** the pelican glides in this long after the dialogue opens (its camera has turned to the two-shot by then) */
export const GREET_AFTER_MS = 1500;
/** the conversation camera's spots the mark keeps open (behind the pair, u; its height above the lower of the two, u) */
const TWO_BACK = 8, TWO_UP = 2.3, TWO_SWING = [0.43, 0.66, 0.99] as const;

/** Is the line from a camera at (cx, cy, cz) to the chest at (x, y, z) above the ground (samples every ≈ 0.8 u)? */
function sightClear(cx: number, cy: number, cz: number, x: number, y: number, z: number, ground: (x: number, z: number) => number): boolean {
  const n = Math.max(4, Math.ceil(Math.hypot(x - cx, z - cz) / 0.8));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (ground(cx + (x - cx) * t, cz + (z - cz) * t) > cy + (y - cy) * t - 0.5) return false;
  }
  return true;
}

/**
 * BAYBAY's spot for the moment (pure): PAIR_GAP from the player, on standable ground, where the most of the
 * conversation camera's spots (both sides, three swings) see the player's chest over the ground; ties go to the
 * direction she already stands in (then the smaller turn). Null when nothing round the player is standable.
 */
export function pelicanMark(player: Vec2, guide: Vec2, heading: number, stand: (x: number, z: number) => boolean, ground: (x: number, z: number) => number = () => 0): Vec2 | null {
  let dx = guide.x - player.x, dz = guide.z - player.z;
  const L = Math.hypot(dx, dz);
  // (she stands on top of you: to your right)
  if (L < 0.3) { dx = Math.cos(heading); dz = -Math.sin(heading); } else { dx /= L; dz /= L; }
  const py = ground(player.x, player.z);
  let best: { x: number; z: number; score: number } | null = null;
  for (const deg of [0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180]) {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const ux = dx * c - dz * s, uz = dx * s + dz * c;
    const x = player.x + ux * PAIR_GAP, z = player.z + uz * PAIR_GAP;
    if (!stand(x, z)) continue;
    const mx = (player.x + x) / 2, mz = (player.z + z) / 2, low = Math.min(py, ground(x, z));
    let blocked = 0;
    for (const sign of [1, -1]) {
      for (const swing of TWO_SWING) {
        // behind the player (−u) turned by ±swing round the pair's midpoint
        const k = Math.cos(swing), q = Math.sin(swing) * sign;
        const bx = -ux * k + uz * q, bz = -ux * q - uz * k;
        const cx = mx + bx * TWO_BACK, cz = mz + bz * TWO_BACK;
        const cy = Math.max(low + TWO_UP, ground(cx, cz) + 0.9);
        if (!sightClear(cx, cy, cz, player.x, py + 1, player.z, ground)) blocked++;
      }
    }
    // (the camera stands TWO_UP over the LOWER of the two: her mark below your feet drops it under your level — at the
    // plaza's rim it skimmed the paving; a mark a little above is fine)
    const drop = Math.max(0, py - ground(x, z)), rise = Math.max(0, ground(x, z) - py);
    const score = blocked + drop * 3 + rise * 0.5 + Math.abs(deg) / 1000;
    if (!best || score < best.score) best = { x, z, score };
    if (blocked === 0 && drop < 0.25 && rise < 0.25) break;
  }
  return best ? { x: best.x, z: best.z } : null;
}
let mark: Vec2 | null = null;

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

/**
 * Review: the goals step's 跟 BAYBAY 去找鹈鹕 lead (a carried free lead to `pelican:coit`, the summit) is still walking.
 * Coit's arrival anchor is on the Filbert Steps, a few seconds below the summit: the moment used to open there and pause
 * the lead, which then walked on under the first flight's 按 G 起飞 (the 带路中 chip and the Coit beam, then 到啦！试试「眺望
 * 海湾」 over the take-off line). The moment now waits for the lead to reach the summit (open plaza: the two-shot and
 * lane F's pelican), at most LEAD_WAIT_MS; a lead the player took over (auto-travel off) does not hold it.
 */
function leadingToPelican(): boolean {
  const t = flow.get().trip;
  return flow.get().freeLead === PELICAN_TARGET && t?.source === 'free-lead' && !isArrived(t) && autoOn();
}
/** the longest the moment waits for that lead (ms): Coit's anchor is ≈ 20 u below the summit */
export const LEAD_WAIT_MS = 15_000;

/** Nothing else on screen: the moment may play. */
function quiet(now: number, p: Pending): boolean {
  const s = game.get(), f = flow.get();
  if (now - p.since < MOMENT_MIN_MS) return false;
  const g = runtime.guide, pl = runtime.player;
  if (Math.hypot(g.x - pl.x, g.z - pl.z) > PAIR_NEAR && now - p.since < PAIR_WAIT_MS) return false;
  if (leadingToPelican() && now - p.since < LEAD_WAIT_MS) return false;
  return s.phase === 'playing' && !s.paused && !dialogueOpen() && s.panel.kind === null && !cinemaActive() && !f.cinematic && !f.arrival
    && !travelActive() && s.move.mode === 'foot' && !s.photoMode && !f.postcardReward && !f.postcardFly && !f.fishing && !goalsStepOpen() && !baybayHeld();
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
  // BAYBAY beside you for the two-shot (flow.talkMark asks setTalkMarkSource's function while the dialogue is open)
  const pl = runtime.player;
  mark = pelicanMark({ x: pl.x, z: pl.z }, { x: runtime.guide.x, z: runtime.guide.z }, pl.heading, (x, z) => canStand(x, z, 0.45), heightAt);
  // she is already there when the conversation camera picks its side (it keeps that side for the whole dialogue): a
  // step of at most PAIR_SNAP u under the cut to the two-shot; farther away she walks to it
  const g = runtime.guide;
  if (mark && Math.hypot(g.x - mark.x, g.z - mark.z) <= PAIR_SNAP) {
    g.x = mark.x; g.z = mark.z; g.y = heightAt(mark.x, mark.z); g.target = null;
    // (face to face: the two-shot looks over your shoulder at her)
    g.heading = Math.atan2(pl.x - mark.x, pl.z - mark.z);
    pl.heading = Math.atan2(mark.x - pl.x, mark.z - pl.z);
  }
  voiceFn?.(W5_PELICAN.ask.id);
  // lane F's pelicanGreet (1c27890): the brown pelican lands behind you both as the two-shot sees you, once its camera
  // has turned (it waits while the dialogue is open; 试试起飞 hands the bird to the glide)
  setTimeout(() => { if (game.get().dialogue.nodeId === ASK_NODE && greetBehind()) pelicanGreet(undefined, undefined, { seconds: 2.6 }); }, GREET_AFTER_MS);
  playDialogue(ask, () => {
    if (wantFlight) { wantFlight = false; voiceFn?.(W5_PELICAN.go.id); takeOff(); return; }
    const key = takeOffKey();
    if (bubble(PELICAN_LINES.laterBubble(key), 4200, BAYBAY_ID, 'call')) say(PELICAN_LINES.laterToast(key).zh, PELICAN_LINES.laterToast(key).en, 'info', 4200);
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
  void importRetry(() => import('../play/index')).then(m => run((m as { startFirstFlight?: () => unknown }).startFirstFlight), plain);
}

// 试试起飞 opens GO_NODE: remembered for the moment's end (module level: this module lives in the city chunk only)
onEvent(e => { if (e.type === 'dialogue' && (e.nodeId === GO_NODE || e.nodeId === ASK_NODE)) wantFlight = e.nodeId === GO_NODE; });

/** The city chunk's boot: BAYBAY's pacer for the tour's line; tick an old save's goal #1. Returns the disposer. */
export function initPelicanFirst(offer: Offer | null = null, voice: ((id: string) => void) | null = null): () => void {
  offerFn = offer;
  voiceFn = voice;
  setTalkMarkSource(nodeId => (nodeId === ASK_NODE || nodeId === GO_NODE ? mark : null));
  syncPelicanGoal();
  return () => { pending = null; wantFlight = false; offerFn = null; voiceFn = null; mark = null; setTalkMarkSource(null); };
}

/** Tests: forget the moment and lane A's starter; `offer` stands in for BAYBAY's pacer. */
export function resetPelicanForTests(starter: (() => unknown) | null = null, offer: Offer | null = null, voice: ((id: string) => void) | null = null) { pending = null; wantFlight = false; flightStarter = starter; offerFn = offer; voiceFn = voice; mark = null; }

/**
 * Will lane F's pelican land BEHIND the pair as the camera sees them? (the same greetSpot moveSystem.pelicanGreet asks,
 * with the camera's view now). Where only a spot beside the player fits — Coit's plaza rim, a stair — it stood between
 * the two-shot's lens and BAYBAY and hid her: then the moment has no landing (the toast and her question stay).
 */
export function greetBehind(): boolean {
  const p = runtime.player, g = runtime.guide, view = runtime.camera.yaw + Math.PI;
  // the two-shot looks over your shoulder toward her: its view is about you → BAYBAY. pelicanGreet places the bird by
  // runtime.camera.yaw — the FOLLOW camera's, which a framing does not move — so the two must agree (±60°)
  const two = Math.atan2(g.x - p.x, g.z - p.z);
  if (Math.abs(Math.atan2(Math.sin(view - two), Math.cos(view - two))) > GREET_AGREE) return false;
  const spot = greetSpot(p.x, p.z, heightAt(p.x, p.z), view, g, { canStand, heightAt });
  if (!spot) return false;
  const fx = Math.sin(two), fz = Math.cos(two), mx = (p.x + g.x) / 2, mz = (p.z + g.z) / 2;
  return (spot.x - mx) * fx + (spot.z - mz) * fz > GREET_BEHIND;
}
/** the follow camera's view and the two-shot's may differ by this much (rad) for the greet */
export const GREET_AGREE = 1.05;
/** how far beyond the pair (u, along the camera's view) the pelican must land */
export const GREET_BEHIND = 1.2;

/** Tests / QA: BAYBAY's mark for the moment's dialogue, if one is open. */
export const pelicanMarkNow = (): Vec2 | null => mark;

