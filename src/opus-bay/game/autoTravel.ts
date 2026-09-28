import type { Vec2 } from '../core/types';

/**
 * Wave 5 · lane N · W5-N3: auto-travel — one tap and BAYBAY carries you (plan sf-w5-plan.md MF4 "The big button
 * travels"). The keyboard-only lead chip of wave 4 becomes the rule on every device: a trip started from the map, a
 * card row, 问 BAYBAY or goTo() walks (and runs) the player along every on-foot part of the way by itself, leg after leg
 * (to the stop, to the parked bike, on from the stop where the ride ends), until the player takes over: any stick /
 * WASD, a tap or click on the ground (or anything else that sets its own walk target). The trip goes on, BAYBAY still
 * leads, and the chip offers 自动跟上 to hand the walking back.
 *
 * Tiny and pure on purpose: the state and `autoStep` (the persistent-follow reducer, node-tested); game/tripRun.ts
 * steps it at 10 Hz with the live inputs and applies the decision (walkTo / a line); ui/GoChip.tsx reads `autoOn()`.
 */

export interface AutoState {
  /** carrying the player (persistent across legs until a takeover, the trip's end, or giving up) */
  on: boolean;
  /** the walk target this module set (runtime.player.pathTarget, compared by identity) */
  issued: Vec2 | null;
  /** when it was set (ms) */
  issuedAt: number;
  /** re-issues after the auto-walk stopped short (a failed path) in this leg */
  fails: number;
  /** the leg the counters belong to */
  legKey: string;
}

export const AUTO_IDLE: AutoState = { on: false, issued: null, issuedAt: 0, fails: 0, legKey: '' };

/** Where auto-travel walks now: a point, the arrival radius, and an interactable to use on arrival (a parked bike). */
export interface AutoWant { p: Vec2; r: number; interact?: string }

export interface AutoInput {
  now: number;
  /** the last frame a movement key / the stick was held (ms; −Infinity: never) */
  manualAt: number;
  /** runtime.player.pathTarget right now */
  pathTarget: Vec2 | null;
  player: Vec2;
  /** the current leg's on-foot target, or null (riding, driving, flying, arrived) */
  want: AutoWant | null;
  /** the player cannot walk now (a dialogue, a panel, a cinematic, the pelican, a ride, not on foot): wait */
  blocked: boolean;
  legKey: string;
}

export type AutoDecision =
  | { type: 'none' }
  | { type: 'issue'; p: Vec2; interact?: string }
  /** the player took over (stick / WASD / a tap elsewhere): auto-travel is off, the trip goes on */
  | { type: 'takeover' }
  /** the auto-walk kept stopping short: off, BAYBAY says "这段你来走" */
  | { type: 'giveup' };

/** A re-issue waits this long after the auto-walk stopped short (ms). */
export const AUTO_RETRY_MS = 1500;
/** …and gives up after this many in one leg. */
export const AUTO_MAX_FAILS = 3;
/** The leg's target moved this far from the issued one: walk to the new one (u). */
export const AUTO_RETARGET = 1;

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);

/** One step of auto-travel (pure): the next state and what to do. */
export function autoStep(s: AutoState, i: AutoInput): { state: AutoState; decision: AutoDecision } {
  const none = (state: AutoState = s) => ({ state, decision: { type: 'none' } as AutoDecision });
  if (!s.on) return none();
  // the player took over: a movement key / the stick since the last issue, or a walk target that is not ours
  if (s.issued && (i.manualAt > s.issuedAt || (i.pathTarget !== null && i.pathTarget !== s.issued))) {
    return { state: { ...AUTO_IDLE }, decision: { type: 'takeover' } };
  }
  let st = s;
  if (i.legKey !== st.legKey) st = { ...st, legKey: i.legKey, fails: 0, issued: null };
  if (!i.want) return none(st.issued ? { ...st, issued: null } : st);
  if (i.blocked) return none(st);
  const w = i.want;
  const issue = (fails: number) => {
    const p = { x: w.p.x, z: w.p.z };
    return { state: { ...st, issued: p, issuedAt: i.now, fails }, decision: { type: 'issue', p, ...(w.interact ? { interact: w.interact } : {}) } as AutoDecision };
  };
  if (!st.issued) return dist(i.player, w.p) <= w.r ? none(st) : issue(st.fails);
  if (i.pathTarget === st.issued) return dist(st.issued, w.p) > AUTO_RETARGET ? issue(st.fails) : none(st);
  // the auto-walk ended (pathTarget cleared): a new target now (the step-out or a walkway's entry is done) → on at once;
  // there → nothing; else it stopped short (a failed path, a snag) → again after a moment, a few times
  if (dist(st.issued, w.p) > AUTO_RETARGET) return issue(st.fails);
  if (dist(i.player, w.p) <= w.r) return none(st);
  if (i.now - st.issuedAt < AUTO_RETRY_MS) return none(st);
  if (st.fails + 1 > AUTO_MAX_FAILS) return { state: { ...AUTO_IDLE }, decision: { type: 'giveup' } };
  return issue(st.fails + 1);
}

// ---------------------------------------------------------------------------------------------------------------
// The live state (tripRun writes, the chip / pill / waypoint read)
// ---------------------------------------------------------------------------------------------------------------

let live: AutoState = { ...AUTO_IDLE };
const subs = new Set<() => void>();
const notify = () => { for (const fn of subs) fn(); };

export const autoState = (): AutoState => live;
/** BAYBAY is carrying the player now. */
export const autoOn = (): boolean => live.on;
export function subscribeAuto(fn: () => void): () => void { subs.add(fn); return () => { subs.delete(fn); }; }

/** Replace the live state (tripRun); listeners hear only when `on` changes. */
export function setAutoState(next: AutoState) {
  const was = live.on;
  live = next;
  if (was !== next.on) notify();
}

/** Start carrying (a trip from the map, a row, 问 BAYBAY, goTo; 自动跟上 on the chip). */
export function autoBegin() { setAutoState({ ...AUTO_IDLE, on: true }); }
/** Stop carrying (the trip ended or was cancelled). Returns the walk target this module had set, if any. */
export function autoEnd(): Vec2 | null {
  const issued = live.issued;
  setAutoState({ ...AUTO_IDLE });
  return issued;
}
