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
  /**
   * (checkpoint CP-1) stepping aside for a line vehicle that waits for the player: the spot and since when (ms). A car
   * standing short of someone on its track waits for good; the auto-walk pressed the player into it at the Green St stop
   * (a streetcar held 72 s, the walk gave up, 自动跟上 walked back into it).
   */
  yielding: { p: Vec2; since: number } | null;
  /**
   * (W9-N1, review R§5 #7) the no-progress watchdog: where the carried player last made progress (moved
   * AUTO_PROGRESS_U from it) and when (ms); null = not measured yet (a new leg, a begin)
   */
  anchor?: Vec2 | null;
  progressAt?: number;
  /**
   * (W9-N1) the player is getting out of a stuck spot by hand (the stick / WASD / a tap while the walk was stuck):
   * not a takeover — BAYBAY carries on once they let go (AUTO_ESCAPE_IDLE_MS)
   */
  escaping?: boolean;
}

export const AUTO_IDLE: AutoState = { on: false, issued: null, issuedAt: 0, fails: 0, legKey: '', yielding: null, anchor: null, progressAt: 0, escaping: false };

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
  /** a line vehicle has waited ≥ YIELD_AFTER_S for the player on its track: the spot to step aside to (yieldSpot) */
  yieldTo?: Vec2 | null;
  /** a line vehicle is within YIELD_CLEAR_R of the player (the stepping aside lasts until none is) */
  vehicleNear?: boolean;
}

export type AutoDecision =
  | { type: 'none' }
  /** walk to `p` (`yield`: stepping aside for a vehicle that waits — BAYBAY says so once) */
  | { type: 'issue'; p: Vec2; interact?: string; yield?: true }
  /** the player took over (stick / WASD / a tap elsewhere): auto-travel is off, the trip goes on */
  | { type: 'takeover' }
  /**
   * the auto-walk kept stopping short (`fails`) or made no progress for AUTO_STALL_MS (`stall`): off, and the trip
   * runner rescues the leg (W9-N1: a short leg is delivered under a veil, a long one gets the stuck card)
   */
  | { type: 'giveup'; why?: 'fails' | 'stall' }
  /** (W9-N1) the stick / a tap while the walk was stuck: the player gets out by hand — still on, not a takeover */
  | { type: 'escape' };

/** A re-issue waits this long after the auto-walk stopped short (ms). */
export const AUTO_RETRY_MS = 1500;
/** …and gives up after this many in one leg. */
export const AUTO_MAX_FAILS = 3;
/** The leg's target moved this far from the issued one: walk to the new one (u). */
export const AUTO_RETARGET = 1;

/**
 * (W9-N1, review R§5 #7: a tour leg stood 6 min after three silent retries) the watchdog: no progress (moving
 * AUTO_PROGRESS_U from the last spot that counted) for this long (ms) while carried and free to walk → give up and rescue
 */
export const AUTO_STALL_MS = 20000;
/** Moving this far (u) from the last progress spot counts as progress (a detour that first leads away still counts). */
export const AUTO_PROGRESS_U = 3;
/**
 * (W9-N1) The walk counts as stuck after this long without progress (ms) or after a failed re-issue: the stick or a
 * tap then is the player getting out by hand, not a takeover (the review: an escape from the Lands End shelter turned
 * BAYBAY's carrying off for the rest of the tour).
 */
export const AUTO_STUCK_MS = 5000;
/** … and BAYBAY carries on once the stick / keys have been let go this long (ms) and no walk of theirs runs. */
export const AUTO_ESCAPE_IDLE_MS = 1200;

/** A line vehicle has stood this long (s) short of the carried player on its track: step aside (CP-1). */
export const YIELD_AFTER_S = 1;
/** Stepping aside ends once no vehicle is within this of the player (u; the cars are ≤ 8.4 u long) … */
export const YIELD_CLEAR_R = 7;
/** … and no sooner than this after it began (ms) … */
export const YIELD_MIN_MS = 1500;
/** … and at the latest after this (ms): a car that stays (a long dwell) is walked past. */
export const YIELD_MAX_MS = 20000;
/**
 * How far from the waiting vehicle's axis the step aside goes (u): clear of its 1.4 u "on the track" band and of a
 * neighbouring track (the double track's centres are ≤ 3.8 u apart), so no other car waits for us there.
 */
export const YIELD_SIDE = 4.5;
/** A player further than this ahead of a vehicle's centre is clear of its nose (u; the longest half body is 4.2). */
export const YIELD_BODY_CLEAR = 5.4;
/** A step-aside spot keeps this far from every other vehicle's body axis (u: a half width ≈ 1.2 and room to stand). */
export const YIELD_OTHER_CLEAR = 2.6;
/** The half length of the body axis a vehicle's clearance is measured along (u: the longest half body). */
export const VEHICLE_HALF = 4.2;

/** Distance from `p` to a vehicle's body axis (its centre ± VEHICLE_HALF along its heading). Pure. */
export function vehicleAxisDist(p: Vec2, v: { x: number; z: number; heading: number }): number {
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading), dx = p.x - v.x, dz = p.z - v.z;
  const along = Math.max(-VEHICLE_HALF, Math.min(VEHICLE_HALF, dx * fx + dz * fz));
  return Math.hypot(dx - fx * along, dz - fz * along);
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Where to step aside for a vehicle at `car` (heading = its travel direction, world yaw: forward = (sin h, cos h)) that
 * waits for the player: straight across its axis to YIELD_SIDE from it. Pressed against its body, on the player's own
 * side first (never round its nose); clear ahead of its nose, on the side of `toward` (where the walk goes) first. The
 * other side next; null when neither is standable (the old behaviour: wait for the car).
 */
export function yieldSpot(player: Vec2, car: { x: number; z: number; heading: number }, stand: (p: Vec2) => boolean, toward?: Vec2 | null, side = YIELD_SIDE, clear: (p: Vec2) => boolean = () => true): Vec2 | null {
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  const dx = player.x - car.x, dz = player.z - car.z;
  // the lateral offset along the right normal (fz, −fx), and how far ahead of the car's centre
  const lat = dx * fz - dz * fx, along = dx * fx + dz * fz;
  let own = lat < 0 ? -1 : 1;
  if (toward && along > YIELD_BODY_CLEAR) {
    const tl = (toward.x - car.x) * fz - (toward.z - car.z) * fx;
    if (Math.abs(tl - lat) > 0.5) own = tl < lat ? -1 : 1;
  }
  // (the part-c walk on Powell St: squeezed between a waiting cable car and one at its stop on the other track, the
  // own side's spot lay beside the other car — a side clear of every other vehicle first, then any standable one)
  const spots = [own, -own].map(sgn => { const step = sgn * side - lat; return { x: player.x + fz * step, z: player.z - fx * step }; });
  return spots.find(p => stand(p) && clear(p)) ?? spots.find(stand) ?? null;
}

/** One step of auto-travel (pure): the next state and what to do. */
export function autoStep(s: AutoState, i: AutoInput): { state: AutoState; decision: AutoDecision } {
  const none = (state: AutoState = s) => ({ state, decision: { type: 'none' } as AutoDecision });
  if (!s.on) return none();
  // the player took over: a movement key / the stick since the last issue, or a walk target that is not ours —
  // (W9-N1) unless the walk was stuck: then it is the player getting out by hand, and BAYBAY carries on after
  const manual = !!s.issued && (i.manualAt > s.issuedAt || (i.pathTarget !== null && i.pathTarget !== s.issued));
  if (manual && !s.escaping) {
    const stuck = s.fails > 0 || (s.anchor != null && i.now - (s.progressAt ?? i.now) >= AUTO_STUCK_MS);
    if (!stuck || !i.want || i.legKey !== s.legKey) return { state: { ...AUTO_IDLE }, decision: { type: 'takeover' } };
    return { state: { ...s, issued: null, escaping: true, anchor: null }, decision: { type: 'escape' } };
  }
  let st = s;
  if (i.legKey !== st.legKey) st = { ...st, legKey: i.legKey, fails: 0, issued: null, yielding: null, anchor: null, escaping: false };
  if (!i.want) return none(st.issued || st.yielding || st.escaping ? { ...st, issued: null, yielding: null, escaping: false } : st);
  // (W9-N1) getting out by hand: wait until the stick / keys are let go and no walk of theirs runs, then on (afresh)
  if (st.escaping) {
    if (i.now - i.manualAt < AUTO_ESCAPE_IDLE_MS || i.pathTarget !== null || i.blocked) return none(st);
    st = { ...st, escaping: false, fails: 0, issued: null, anchor: { x: i.player.x, z: i.player.z }, progressAt: i.now };
  }
  // (W9-N1) the watchdog's clock stops while the player cannot walk (a dialogue, a panel, a ride) or steps aside
  const pause = (x: AutoState): AutoState => (x.anchor ? { ...x, progressAt: i.now } : x);
  if (i.blocked) return none(pause(st));
  // CP-1: a vehicle waits for us — step aside, let it pass, then walk on (the fails are not counted meanwhile)
  if (st.yielding) {
    const y = st.yielding, age = i.now - y.since;
    if (age < YIELD_MAX_MS && (age < YIELD_MIN_MS || i.yieldTo || i.vehicleNear)) return none(pause(st));
    st = { ...st, yielding: null };
  } else if (i.yieldTo) {
    const p = { x: i.yieldTo.x, z: i.yieldTo.z };
    return { state: { ...pause(st), issued: p, issuedAt: i.now, yielding: { p, since: i.now } }, decision: { type: 'issue', p, yield: true } };
  }
  // (W9-N1) progress: moved AUTO_PROGRESS_U from the last spot that counted; none for AUTO_STALL_MS → give up (rescue)
  if (!st.anchor || dist(i.player, st.anchor) >= AUTO_PROGRESS_U) st = { ...st, anchor: { x: i.player.x, z: i.player.z }, progressAt: i.now };
  else if (i.now - (st.progressAt ?? i.now) >= AUTO_STALL_MS && dist(i.player, i.want.p) > i.want.r) {
    return { state: { ...AUTO_IDLE }, decision: { type: 'giveup', why: 'stall' } };
  }
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
  if (st.fails + 1 > AUTO_MAX_FAILS) return { state: { ...AUTO_IDLE }, decision: { type: 'giveup', why: 'fails' } };
  return issue(st.fails + 1);
}

// ---------------------------------------------------------------------------------------------------------------
// The live state (tripRun writes, the chip / pill / waypoint read)
// ---------------------------------------------------------------------------------------------------------------

let live: AutoState = { ...AUTO_IDLE };
/**
 * (W9-N1) Why carrying last stopped: 'takeover' (the player steered), 'giveup' (stuck: the runner rescued the leg) or
 * 'end' (the trip ended / was cancelled). The Grand Tour turns its carrying off for the rest of the tour only on a
 * takeover (review R§5 #7: a stuck leg used to count as one).
 */
export type AutoEndReason = 'takeover' | 'giveup' | 'end';
let endReason: AutoEndReason | null = null;
export const autoEndReason = (): AutoEndReason | null => endReason;
export function noteAutoEnd(why: AutoEndReason) { endReason = why; }
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
export function autoBegin() { endReason = null; setAutoState({ ...AUTO_IDLE, on: true }); }
/** Stop carrying (the trip ended or was cancelled). Returns the walk target this module had set, if any. */
export function autoEnd(): Vec2 | null {
  const issued = live.issued;
  setAutoState({ ...AUTO_IDLE });
  return issued;
}
