import { cancelDrive, driveTo, isRiding } from '../actors/moveApi';
import { emit, onEvent } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { Bilingual, DialogueNode, Vec2 } from '../core/types';
import { rideSystemFor } from '../data/transit';
import { leadTo } from './brain';
import { startTravel, travelActive } from './fastTravel';
import {
  announce, bubble, closePanel, defineNode, dialogueOpen, freeLeadArrived, playDialogue, say, setTripRunner, type TripDest, type TripRunner,
} from './flow';
import { flow } from './flowStore';
import { BAYBAY_ID, interactableById, type Interactable } from './interactables';
import { registerFrameSystem } from './systemsRegistry';
import { requestHopOff } from './transit';
import { timeLabel } from './tripText';
import { currentLeg, isArrived, legTarget, tripEvents, tripReducer, walkLeg, type TripAction } from './trips';
import type { TripLeg, TripLineLeg, TripOption, TripSource, TripState } from './tripTypes';

/**
 * Wave 4 · lane C · W4-C1: the trip runner. `flow.trip` (game/trips.ts reducer on the frozen TripState) is the state;
 * this module moves it along in the running game (city mode; loaded by game/cityContent.ts, or by the first
 * `flow.startTrip`), and registers itself with game/flow.ts (`setTripRunner`) so the main graph stays small.
 *
 * Per leg (plan §4.2 "BAYBAY leads"):
 *   walk / run   BAYBAY leads on foot (brain's lead(): wait barks, the nudge, the LeadChip); the leg ends when both
 *                are there (or the player is, carried by something else)
 *   line         BAYBAY leads to the boarding stop; there the boarding opens pre-filled ("上车 · 坐到 石镇（约 70 秒）" /
 *                "先不坐"); riding, nothing leads (the ride carries both); the ride ending at the alight stop ends the
 *                leg, a hop-off elsewhere turns the rest of the trip into a walk from there (honest, no teleport)
 *   bike / car   BAYBAY leads to the rideable; once the player is on it the autopilot (moveApi.driveTo) drives to the
 *                leg's end (steering takes over; the waypoint stays); within 10 u of it the leg ends
 *   fly          the pelican (fastTravel.startTravel) at once; landing ends the leg
 * Events (`trip` start / leg / end / cancel) come from game/trips.ts tripEvents, in order. An arrived trip stays for
 * CLEAR_AFTER_MS (the arrival moment reads it), then clears. A free lead (flow.startFreeLead) is a one-leg walking trip.
 */

/** an arrived trip is dropped this long after its end (the arrival moment and the map read it meanwhile) */
export const CLEAR_AFTER_MS = 4000;
/** the last leg's arrival radius (u): inside the attraction's 12 u arrival anchor, so the moment and the end agree */
export const END_R = 6;
/** a walk leg to a stop / station ends inside its interaction radius (transit stops: 4.2 u) */
export const STOP_R = 3.5;
/** a ride that ends this close to its alight stop ended the leg */
export const ALIGHT_R = 40;
/** a drive leg ends this close to its end point */
export const DRIVE_R = 10;

type Stage = 'lead' | 'board' | 'ride' | 'drive' | 'fly';

let legKey = '';
let stage: Stage = 'lead';
let boardOffered = '';
let rideSeen = false;
let travelSeen = false;
let driving = false;
let endedAt = 0;
/** a free lead's arrival radius (the old rule: min(interactable radius, 3.5)) */
let freeLeadR = 0;
/** Tests / QA: what the current leg is doing (lead · board · ride · drive · fly). */
export const tripStage = (): Stage => stage;

const P = (): Vec2 => ({ x: runtime.player.x, z: runtime.player.z });
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const keyOf = (t: TripState) => `${t.startedAt}:${t.leg}:${t.legs.length}`;

/** Apply an action to `flow.trip` and emit its events in order (the one writer of `flow.trip`). */
export function dispatchTrip(action: TripAction): TripState | null {
  const prev = flow.get().trip;
  const next = tripReducer(prev, action);
  if (next !== prev) flow.set({ trip: next });
  for (const e of tripEvents(prev, next, action)) emit(e);
  return next;
}

/** The destination's name for lines and the waypoint: the given name, the last leg's point, the interactable. */
function destName(t: TripState): Bilingual {
  const last = t.legs[t.legs.length - 1]?.to;
  return last?.name ?? interactableById(t.placeId)?.name ?? interactableById(`place:${t.placeId}`)?.name ?? { zh: '目的地', en: 'there' };
}

function start(option: TripOption, dest: TripDest, source: TripSource = 'map') {
  if (!option.legs.length) return;
  const legs = dest.name && option.legs.length ? withDestName(option.legs, dest.name) : option.legs;
  const opt = legs === option.legs ? option : { ...option, legs };
  if (source !== 'free-lead' && flow.get().freeLead) flow.set({ freeLead: null });
  if (flow.get().mapTarget || flow.get().freeHint) flow.set({ mapTarget: null, freeHint: null });
  if (source === 'map' || source === 'card') closePanel();
  resetLeg();
  const t = dispatchTrip({ type: 'start', placeId: dest.placeId, ...(dest.attraction ? { attraction: dest.attraction } : {}), option: opt, now: performance.now(), source });
  if (!t) return;
  const name = destName(t);
  if (source !== 'tour' && source !== 'free-lead') {
    const first = t.legs[0];
    const line = first.via === 'fly' ? { zh: `抓紧！我们飞去${name.zh}`, en: `Hold on — we fly to ${name.en}!` }
      : first.via === 'line' || t.legs.some(l => l.via === 'line') ? { zh: `跟我来！坐车去${name.zh}`, en: `Follow me — we'll ride to ${name.en}!` }
        : first.via === 'bike' || first.via === 'car' ? { zh: `先去${first.via === 'car' ? '坐上小车' : '骑上单车'}，再去${name.zh}！`, en: `First the ${first.via === 'car' ? 'toy car' : 'bike'}, then ${name.en}!` }
          : { zh: `跟我来！去${name.zh}`, en: `Follow me — to ${name.en}!` };
    bubble(line, 3000, BAYBAY_ID, 'call');
  }
  announce({ zh: `出发：${name.zh}`, en: `Heading to ${name.en}` });
  onLegStart(t);
}

/** The last leg's end carries the destination's name (lane G's pill reads `leg.to.name`). */
function withDestName(legs: TripLeg[], name: Bilingual): TripLeg[] {
  const last = legs[legs.length - 1];
  if (last.to.name) return legs;
  return [...legs.slice(0, -1), { ...last, to: { ...last.to, name } } as TripLeg];
}

function resetLeg() { legKey = ''; stage = 'lead'; boardOffered = ''; rideSeen = false; travelSeen = false; driving = false; }

/** A leg just became current: fly legs take off at once. */
function onLegStart(t: TripState) {
  const leg = currentLeg(t);
  legKey = keyOf(t);
  stage = 'lead'; boardOffered = ''; rideSeen = false; travelSeen = false; driving = false;
  if (!leg) return;
  if (leg.via === 'fly') {
    stage = 'fly';
    // off a cable car / the bus first; bikes and the car park when the move mode turns 'travel'
    if (game.get().move.mode === 'transit' || game.get().riding) requestHopOff();
    closePanel();
    if (!startTravel({ id: t.placeId, name: destName(t), x: leg.to.x, z: leg.to.z })) arrived();
  }
}

/** The current leg is done (the lead arrived, the ride ended at its stop, the drive or the flight got there). */
function arrived() {
  const t = flow.get().trip;
  if (!t || isArrived(t)) return;
  if (driving) { cancelDrive(); driving = false; }
  const next = dispatchTrip({ type: 'leg-arrived' });
  if (!next) return;
  if (isArrived(next)) { onTripEnd(next); return; }
  onLegStart(next);
  const leg = currentLeg(next);
  if (leg?.via === 'line' && next.source !== 'tour') bubble({ zh: `去车站，坐车到${leg.to.name?.zh ?? '下一站'}`, en: `To the stop — we ride to ${leg.to.name?.en ?? 'the next stop'}` }, 2800, BAYBAY_ID, 'call');
}

function onTripEnd(t: TripState) {
  endedAt = performance.now();
  if (t.source === 'free-lead') { freeLeadArrived(); return; }
  // an attraction's own arrival moment speaks for it (game/cityArrivals.ts); a plain place gets a short line
  if (t.source !== 'tour' && !t.attraction) bubble({ zh: `到啦！这里就是${destName(t).zh}`, en: `Here we are — ${destName(t).en}!` }, 3200, BAYBAY_ID, 'call');
}

/** The rest of the trip as one walk from here (a hop-off before the stop, a line that is not running). */
function walkRest(t: TripState, why?: Bilingual) {
  const last = t.legs[t.legs.length - 1].to;
  const leg = walkLeg(P(), { x: last.x, z: last.z, ...(last.place ? { place: last.place } : {}), ...(last.station ? { station: last.station } : {}), name: last.name ?? destName(t) });
  const next = dispatchTrip({ type: 'replan', option: { mode: 'walk', legs: [leg], seconds: leg.seconds } });
  if (why) bubble(why, 3200, BAYBAY_ID, 'call');
  if (next) onLegStart(next);
}

function skip() {
  const t = flow.get().trip;
  if (!t || isArrived(t)) return;
  if (t.source === 'tour') { void import('./cityTour').then(m => m.skipCityTourStop()); return; }
  if (driving) { cancelDrive(); driving = false; }
  const next = dispatchTrip({ type: 'skip-leg' });
  if (!next) return;
  if (isArrived(next)) onTripEnd(next); else onLegStart(next);
}

function replan(option: TripOption) {
  const t = flow.get().trip;
  if (!t || !option.legs.length) return;
  if (driving) { cancelDrive(); driving = false; }
  const next = dispatchTrip({ type: 'replan', option: { ...option, legs: withDestName(option.legs, destName(t)) } });
  if (next) onLegStart(next);
}

function end() {
  const t = flow.get().trip;
  if (!t) return;
  if (driving) { cancelDrive(); driving = false; }
  if (t.source === 'free-lead' && flow.get().freeLead) flow.set({ freeLead: null });
  dispatchTrip({ type: 'cancel' });
  resetLeg();
}

function freeLead(it: Pick<Interactable, 'id' | 'x' | 'z' | 'name'> & { radius?: number }) {
  const full = interactableById(it.id);
  freeLeadR = Math.min(full?.radius ?? 3.5, 3.5);
  const leg = walkLeg(P(), { x: it.x, z: it.z, place: it.id, name: it.name });
  start({ mode: 'walk', legs: [leg], seconds: leg.seconds }, { placeId: it.id.startsWith('place:') ? it.id.slice(6) : it.id, name: it.name }, 'free-lead');
}

/** Riding the leg's line right now (the HUD's ride status names the line). */
const onLine = (leg: TripLineLeg) => { const r = flow.get().ride; return !!r && (r.line === leg.line || (!r.line && leg.line === 'streetcar')); };
const mounted = (via: 'bike' | 'car') => game.get().move.mode === via && isRiding();

function objective(): (Vec2 & { id: string; name: Bilingual }) | null {
  const t = flow.get().trip;
  const leg = currentLeg(t);
  if (!t || !leg) return null;
  const underway = leg.via === 'line' ? rideSeen || onLine(leg) : leg.via === 'bike' || leg.via === 'car' ? mounted(leg.via) || driving : true;
  const p = legTarget(leg, underway ? 'underway' : 'approach');
  if (!p) return null;
  const last = t.leg === t.legs.length - 1 && (underway || leg.via === 'walk' || leg.via === 'run');
  return { x: p.x, z: p.z, id: p.station ? `transit-${p.station}` : `trip:${t.placeId}`, name: p.name ?? (last ? destName(t) : { zh: '下一站', en: 'Next stop' }) };
}

/** The guide brain on foot: lead toward the current leg's next point. */
function guide(now: number): boolean {
  const t = flow.get().trip;
  const leg = currentLeg(t);
  if (!t || !leg) return false;
  if (legKey !== keyOf(t)) onLegStart(t);
  const last = t.leg === t.legs.length - 1;
  switch (leg.via) {
    case 'walk': case 'run': {
      const r = t.source === 'free-lead' && freeLeadR ? freeLeadR : last ? END_R : STOP_R;
      leadTo(now, leg.to, r, arrived);
      return true;
    }
    case 'line':
      if (rideSeen || onLine(leg)) return false;
      leadTo(now, leg.from, STOP_R, () => offerBoarding(t, leg));
      return true;
    case 'bike': case 'car':
      if (mounted(leg.via) || driving || dist(P(), leg.from) < 3) return false;
      leadTo(now, leg.from, 2.5, () => {});
      return true;
    case 'fly':
      return false;
  }
}

/** At the boarding stop: one pre-filled question (once per arrival at the stop). */
function offerBoarding(t: TripState, leg: TripLineLeg) {
  const key = `${keyOf(t)}:${Math.round(runtime.player.x / 8)},${Math.round(runtime.player.z / 8)}`;
  if (boardOffered === key || dialogueOpen() || game.get().phase !== 'playing') return;
  boardOffered = key;
  const next = rideNodeFor(leg);
  if (!next) { walkRest(t, { zh: '这条线今天没开，我们走过去吧！', en: "That line isn't running today — let's walk!" }); return; }
  stage = 'board';
  const to = leg.to.name ?? { zh: '下一站', en: 'the next stop' };
  const ride = timeLabel(Math.max(0, leg.seconds - leg.wait));
  const choices: NonNullable<DialogueNode['choices']> = [
    { hotkey: '1', label: { zh: `上车 · 坐到 ${to.zh}（${ride.zh}）`, en: `Board · ride to ${to.en} (${ride.en})` }, next },
    { hotkey: '2', label: { zh: '先不坐', en: 'Not now' }, action: { type: 'end' } },
  ];
  playDialogue(defineNode({ id: 'flow.trip.board', speaker: 'baybay', mood: 'point', text: { zh: `车站到了！车来了我们就上，坐到 ${to.zh}。`, en: `Here's the stop! We hop on when it comes and ride to ${to.en}.` }, choices }));
}

/** The wave-4 lines (lane T's systems: `ln:` ride nodes, `transit-<stop>` station interactables). */
const W4_LINE = /^(sf-loop|n-judah|m-ocean-view)$/;
/**
 * Is the leg's line running here? A wave-4 line runs once lane T registers its station interactables; the cable cars,
 * the F-line and the ferry once their system is up (data/transit.ts rideSystemFor).
 */
export const lineRunning = (leg: Pick<TripLineLeg, 'line' | 'board'>): boolean =>
  W4_LINE.test(leg.line) ? !!interactableById(`transit-${leg.board}`) : !!rideSystemFor(leg.line);

/** The ride's dialogue node (game/transit.ts openRideNode formats), or null when the line is not running. */
export function rideNodeFor(leg: Pick<TripLineLeg, 'line' | 'board' | 'alight'>, running: (leg: Pick<TripLineLeg, 'line' | 'board'>) => boolean = lineRunning): string | null {
  const { line, board, alight } = leg;
  if (!running(leg)) return null;
  if (line === 'streetcar') return `flow.ride.fl:${board}:${alight}`;
  if (line === 'ferry') return `flow.ride.fe:${board}:${alight}`;
  // cable cars (data/transit.ts CableLine ids) keep lane F's `cc:`; the loop and the Metro take lane T's `ln:`
  return W4_LINE.test(line) ? `flow.ride.ln:${line}:${board}:${alight}` : `flow.ride.cc:${line}:${board}:${alight}`;
}

/** 10 Hz: the leg's progress that does not need BAYBAY to lead (rides, drives, flights, a carried arrival). */
function tick(now: number) {
  const t = flow.get().trip;
  if (!t) { if (legKey) resetLeg(); return; }
  if (isArrived(t)) {
    if (!endedAt) endedAt = now;
    if (now - endedAt > CLEAR_AFTER_MS && !dialogueOpen()) { dispatchTrip({ type: 'clear' }); endedAt = 0; resetLeg(); }
    return;
  }
  endedAt = 0;
  if (legKey !== keyOf(t)) onLegStart(t);
  const leg = currentLeg(t)!;
  const p = P();
  switch (leg.via) {
    case 'walk': case 'run':
      // carried there (a bike, a cable car): the brain does not lead then, so the leg ends by position
      if (game.get().move.mode !== 'foot' && game.get().move.mode !== 'photo' && dist(p, leg.to) < END_R + 2) arrived();
      return;
    case 'line': {
      if (onLine(leg)) { rideSeen = true; stage = 'ride'; return; }
      if (!rideSeen) return;
      // the ride is over: at the alight stop the leg is done; anywhere else the rest is a walk
      rideSeen = false;
      if (dist(p, leg.to) <= ALIGHT_R) arrived();
      else walkRest(t, { zh: '提前下车啦，我们走过去！', en: 'Off early — we walk from here!' });
      return;
    }
    case 'bike': case 'car': {
      if (!driving && mounted(leg.via)) {
        driving = true; stage = 'drive';
        if (!driveTo({ x: leg.to.x, z: leg.to.z })) say('这里开不过去，你来掌舵吧', "Can't drive there — you steer!", 'info', 2600);
      }
      if (dist(p, leg.to) < DRIVE_R) arrived();
      return;
    }
    case 'fly':
      if (travelActive()) { travelSeen = true; return; }
      if (travelSeen) arrived();
      return;
  }
}

let booted = false;
/** Once per page in city mode (game/cityContent.ts); returns the disposer. */
export function initTripRun(): () => void {
  if (booted) return () => {};
  booted = true;
  const runner: TripRunner = { start, skip, replan, end, arrived, freeLead, objective, guide };
  setTripRunner(runner);
  let acc = 0;
  const offFrame = registerFrameSystem('c-trips', (dt, now) => {
    if ((acc += dt) < 0.1) return;
    acc = 0;
    if (game.get().phase === 'playing') tick(now);
  });
  // a fast-travel trip that the player did not start as a fly leg moves them away: the walk would lead back, so end it
  const offEvents = onEvent(e => {
    if (e.type !== 'travel' || e.what !== 'start') return;
    const t = flow.get().trip, leg = currentLeg(t);
    if (t && leg && leg.via !== 'fly') end();
  });
  return () => { offFrame(); offEvents(); setTripRunner(null); resetLeg(); booted = false; };
}
