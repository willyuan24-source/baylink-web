import { Navigation } from 'lucide-react';
import { autoGlide, autoGliding, cancelAutoGlide, cancelDrive, driveTo, isRiding } from '../actors/moveApi';
import { emit, onEvent } from '../core/events';
import { input } from '../core/input';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { canStand, heightAt, nearestWalkable } from '../core/terrain';
import { findPath } from '../actors/nav';
import type { Bilingual, DialogueNode, Vec2 } from '../core/types';
import { ATTRACTION_INDEX } from '../data/sf/attractions';
import { activeCableSystem, activeLineFleet, activeStreetcarSystem, rideSystemFor } from '../data/transit';
import { isDiscovered } from './discovery';
import { registerAskItem } from '../ui/slots';
import {
  type AutoWant, YIELD_AFTER_S, YIELD_CLEAR_R, YIELD_OTHER_CLEAR, YIELD_SIDE, autoBegin, autoEnd, autoOn, autoState, autoStep, noteAutoEnd, setAutoState, vehicleAxisDist,
  yieldSpot,
} from './autoTravel';
import { leadStep, leadTo } from './brain';
import { startTravel, travelActive } from './fastTravel';
import { W8K_LINES } from './fixedLines';
import { isScenicLeg } from './scenicTrip';
import {
  announce, bubble, closePanel, defineNode, dialogueOpen, freeLeadArrived, playDialogue, say, setTripRunner, teleportPlayer, type TripDest, type TripRunner,
} from './flow';
import { flow } from './flowStore';
import { BAYBAY_ID, interactableById, type Interactable } from './interactables';
import { registerFrameSystem } from './systemsRegistry';
import { boardLine, requestHopOff } from './transit';
import { timeLabel } from './tripText';
import { currentLeg, isArrived, legTarget, tripEvents, tripReducer, walkLeg, type TripAction } from './trips';
import type { TripLeg, TripLineLeg, TripOption, TripSource, TripState } from './tripTypes';
import { importRetry } from './importRetry';
import { tripRouteCache } from './tripProviders';
import { TRIP_SPEED, autoTravelSeconds } from './tripPlan';
import { ATTENTION_PRIORITY, requestSlot, type SlotTicket } from './attention';
import { readSave } from '../data/save';
import { minutesLabel } from './tripText';
import { placeById } from '../data/sf/places';
import { LANDMARK_ARRIVALS } from '../data/sf/arrivals';
import { faceCameraToward } from './cinema';

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
/**
 * W5-N9: a scenic flight that landed farther than this from its leg's end (the player took the wings and landed
 * elsewhere) walks the rest with BAYBAY's line; closer (lane F's auto-glide sets down about 20 u out) it walks quietly
 */
export const FLY_END_R = 60;
/** W5-N9: the take-off of a scenic flight has this long to happen (ms), else the fast hop takes the leg */
export const GLIDE_START_MS = 1500;

type Stage = 'lead' | 'board' | 'ride' | 'drive' | 'fly';

let legKey = '';
let stage: Stage = 'lead';
let boardOffered = '';
let rideSeen = false;
let travelSeen = false;
/**
 * W5-N9: the current fly leg is flown the scenic way (lane F's `moveApi.autoGlide`): since when (ms), and how lane F's
 * auto-glide ended ('taken' = the player has the wings, 'cancelled' = before or after the take-off)
 */
let glide: { at: number; end: 'landed' | 'taken' | 'cancelled' | null } | null = null;
/** Tests / QA: a scenic flight is flying this leg. */
export const scenicGlideOn = (): boolean => glide !== null;
/** Hand a running scenic flight's wings to the player (the glide goes on under their stick) and forget it. */
function stopGlide() {
  if (!glide) return;
  glide = null;
  if (autoGliding()) cancelAutoGlide();
}
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

/** A trip that ends this close to a running Grand Tour stop's end goes to that stop (int-review: 换个方式). */
export const SAME_STOP_R = 15;

/** Does `option` (to `dest`) go where the running trip `t` goes: the same place, or an end within SAME_STOP_R? */
export function sameDestination(t: TripState, option: TripOption, dest: Pick<TripDest, 'placeId'>): boolean {
  if (dest.placeId === t.placeId) return true;
  const a = t.legs[t.legs.length - 1]?.to, b = option.legs[option.legs.length - 1]?.to;
  return !!a && !!b && Math.hypot(a.x - b.x, a.z - b.z) <= SAME_STOP_R;
}

function start(option: TripOption, dest: TripDest, source: TripSource = 'map') {
  if (!option.legs.length) return;
  // int-review: 换个方式 on a Grand Tour leg (lane G's trip card opens the map; its options, a station's ride or 跟
  // BAYBAY 去 to the same stop) goes on as the tour's trip with the new option — its dots, its lines, its arrival. A
  // new trip there used to replace it, and the tour waited for a stop that never ended.
  const cur = flow.get().trip;
  if (source !== 'tour' && source !== 'free-lead' && cur?.source === 'tour' && !isArrived(cur) && sameDestination(cur, option, dest)) {
    if (source === 'map' || source === 'card') closePanel();
    replan(option);
    return;
  }
  const legs = dest.name && option.legs.length ? withDestName(option.legs, dest.name) : option.legs;
  const opt = legs === option.legs ? option : { ...option, legs };
  if (source !== 'free-lead' && flow.get().freeLead) flow.set({ freeLead: null });
  if (flow.get().mapTarget || flow.get().freeHint) flow.set({ mapTarget: null, freeHint: null });
  if (source === 'map' || source === 'card') closePanel();
  resetLeg();
  const t = dispatchTrip({ type: 'start', placeId: dest.placeId, ...(dest.attraction ? { attraction: dest.attraction } : {}), option: opt, now: performance.now(), source });
  if (!t) return;
  // W5-N3: one tap and BAYBAY carries you (the map, a row, 问 BAYBAY, goTo, a free lead); a tour leads as before
  const was = autoEnd();
  if (was && runtime.player.pathTarget === was) runtime.player.pathTarget = null;
  if (AUTO_SOURCES.has(source)) { autoBegin(); autoTick(performance.now()); }
  const name = destName(t);
  if (source !== 'tour' && source !== 'free-lead') {
    const first = t.legs[0];
    // (a scenic flight: lane F's take-off says 抓稳，飞咯！ and how to take the wings — no third line on top)
    const ride = first.via === 'line' || t.legs.some(l => l.via === 'line');
    // (W8-K10) the city: fixed lines lane X can voice (game/fixedLines.ts W8K_LINES; the trip pill and the announce name
    // the place); the district keeps its named bubbles
    const line = isScenicLeg(first) ? null
      : game.get().worldMode === 'city'
        ? first.via === 'fly' ? W8K_LINES.tripFly : ride ? W8K_LINES.tripToStop : first.via === 'bike' ? W8K_LINES.tripBike : first.via === 'car' ? W8K_LINES.tripCar : W8K_LINES.leadGo
        : first.via === 'fly' ? { zh: `抓紧！我们飞去${name.zh}`, en: `Hold on — we fly to ${name.en}!` }
          : ride ? { zh: `跟我来！坐车去${name.zh}`, en: `Follow me — we'll ride to ${name.en}!` }
            : first.via === 'bike' || first.via === 'car' ? { zh: `先去${first.via === 'car' ? '坐上小车' : '骑上单车'}，再去${name.zh}！`, en: `First the ${first.via === 'car' ? 'toy car' : 'bike'}, then ${name.en}!` }
              : { zh: `跟我来！去${name.zh}`, en: `Follow me — to ${name.en}!` };
    if (line) bubble(line, 3000, BAYBAY_ID, 'call');
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

function resetLeg() { legKey = ''; stage = 'lead'; boardOffered = ''; rideSeen = false; travelSeen = false; driving = false; detour = null; shortChecked = ''; shortSince = 0; refined = ''; stopGlide(); }

/** A leg just became current: fly legs take off at once. */
function onLegStart(t: TripState) {
  const leg = currentLeg(t);
  legKey = keyOf(t);
  stage = 'lead'; boardOffered = ''; rideSeen = false; travelSeen = false; driving = false; detour = null;
  stopGlide();
  if (!leg) return;
  if (leg.via === 'fly') {
    stage = 'fly';
    // off a cable car / the bus first; bikes and the car park when the move mode turns 'travel'
    if (game.get().move.mode === 'transit' || game.get().riding) requestHopOff();
    closePanel();
    // W5-N9: 看风景飞过去 — lane F's auto-glide flies the way itself (a push of the stick hands the wings over); it
    // refuses outside 60–900 u or with the glide locked: then the fast hop
    if (isScenicLeg(leg)) {
      const g: NonNullable<typeof glide> = { at: performance.now(), end: null };
      if (autoGlide({ x: leg.to.x, z: leg.to.z }, { onEnd: how => { g.end = how; } })) { glide = g; return; }
    }
    flyFast(t, leg);
  }
}

/** The fast hop (飞过去): the pelican's cloud trip to the leg's end. */
function flyFast(t: TripState, leg: TripLeg) {
  if (!startTravel({ id: t.placeId, name: destName(t), x: leg.to.x, z: leg.to.z, ...firstSight(t) })) arrived();
}

/**
 * W5-N5 · a flight to an attraction not found yet is its first sight: the landing faces the landmark (its anchor) and
 * the descent frames it (game/fastTravel `look`). Discovered places land as before.
 */
export function firstSight(t: Pick<TripState, 'placeId' | 'attraction'>, discovered: (id: string) => boolean = isDiscovered): { look?: Vec2 } {
  const a = t.attraction ? ATTRACTION_INDEX.get(t.attraction) : undefined;
  if (!a || discovered(t.placeId) || discovered(a.placeId ?? a.id)) return {};
  return { look: { x: a.x, z: a.z } };
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
  // (W8-K3) a fixed line lane X can voice: the trip pill names the stop
  // (W8-K-review K-RC-1) not in the city: start() already said this very line there (W8-K10: a line on any leg), and
  // the player now stands at the stop, where the boarding question (offerBoarding / lane T's boardLine) speaks
  if (leg?.via === 'line' && next.source !== 'tour' && game.get().worldMode !== 'city') bubble(W8K_LINES.tripToStop, 2800, BAYBAY_ID, 'call');
}

/**
 * (W9-N4, w8 NEXT #8: a walk to the Jeremiah O'Brien ended facing the shed wall) the heading a trip to `placeId` ends
 * facing: the place row's arrival heading, else the landmark arrival's (`sf:<landmark>`), else null. Pure over lookups.
 */
export function arrivalHeading(placeId: string, place: (id: string) => { arrival: { heading?: number } } | undefined = placeById, landmarks: Readonly<Record<string, { heading: number }>> = LANDMARK_ARRIVALS): number | null {
  const id = placeId.replace(/^(?:place:|sf:)/, '');
  const h = place(id)?.arrival.heading ?? landmarks[id]?.heading;
  return typeof h === 'number' && Number.isFinite(h) ? h : null;
}
/** a walking trip's end turns the player (and, without an arrival moment, the camera) once the last steps are done */
let endTurn: { heading: number; look: boolean; at: Vec2 } | null = null;
function applyEndTurn() {
  const e = endTurn;
  if (!e) return;
  const pl = runtime.player;
  if (input.manualMove || game.get().move.mode !== 'foot') { endTurn = null; return; }
  if (pl.pathTarget || dist(P(), e.at) > END_R + 3) return;
  endTurn = null;
  pl.heading = e.heading;
  if (e.look) faceCameraToward(pl.x + Math.sin(e.heading) * 20, pl.z + Math.cos(e.heading) * 20, { seconds: 0.8 });
}

function onTripEnd(t: TripState) {
  endedAt = performance.now();
  // (W9-N4) on foot to the end: face the place's arrival heading once the last steps are walked (an attraction's own
  // arrival moment frames the camera itself: then only the body turns)
  const lastLeg = t.legs[t.legs.length - 1];
  const h = lastLeg && (lastLeg.via === 'walk' || lastLeg.via === 'run') ? arrivalHeading(t.placeId) : null;
  endTurn = h === null ? null : { heading: h, look: !t.attraction && t.source !== 'tour', at: { x: lastLeg.to.x, z: lastLeg.to.z } };
  // (the last few steps to the exact point finish by themselves: the walk target stays)
  autoEnd();
  if (t.source === 'free-lead') { freeLeadArrived(); return; }
  // an attraction's own arrival moment speaks for it (game/cityArrivals.ts); a plain place gets a short line
  // (W8-K3) a fixed line lane X can voice, the place's name on a toast
  if (t.source !== 'tour' && !t.attraction) {
    const name = destName(t);
    bubble(W8K_LINES.tripHere, 3200, BAYBAY_ID, 'call');
    say(`到达 · ${name.zh}`, `Arrived · ${name.en}`, 'info', 3200);
  }
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
  stopGlide();
  if (t.source === 'tour') { void importRetry(() => import('./cityTour')).then(m => m.skipCityTourStop()); return; }
  if (driving) { cancelDrive(); driving = false; }
  const next = dispatchTrip({ type: 'skip-leg' });
  if (!next) return;
  if (isArrived(next)) onTripEnd(next); else onLegStart(next);
}

function replan(option: TripOption) {
  const t = flow.get().trip;
  if (!t || !option.legs.length) return;
  if (driving) { cancelDrive(); driving = false; }
  stopGlide();
  const next = dispatchTrip({ type: 'replan', option: { ...option, legs: withDestName(option.legs, destName(t)) } });
  if (next) onLegStart(next);
}

function end() {
  const t = flow.get().trip;
  if (!t) return;
  if (driving) { cancelDrive(); driving = false; }
  // 结束: stop the auto-walk this trip set (a walk the player set stays theirs)
  const was = autoEnd();
  if (was && runtime.player.pathTarget === was) { runtime.player.pathTarget = null; runtime.player.pendingInteract = null; }
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
  // the sightseeing loop and the Metro: lane T's boarding dialogue with the pre-filled row ("上车 · 坐到 石镇（约 70 秒）")
  if (W4_LINE.test(leg.line)) { boardLine(leg.board, { to: leg.alight, line: leg.line }); return; }
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

/** the leg (key) whose walking route was asked for and answered */
let refined = '';
/**
 * (W9-N2, review R§5 #6: "步行带路时 ETA 从 9 秒涨到 25 秒") a walk leg planned on the straight-line estimate gets the A*'s
 * route once it answers (the planner's route cache): its path, length and seconds, so the pill / card / waypoint count
 * the remaining PATH (guideCity legSecondsLeft → routeRemaining), smoothed (a longer way is said once: 绕一下).
 */
function refineWalk(t: TripState, leg: TripLeg, p: Vec2) {
  const key = keyOf(t);
  if (refined === key || (leg.path && leg.path.length >= 4 && !leg.estimate)) return;
  let a: ReturnType<ReturnType<typeof tripRouteCache>['walk']>;
  try { a = tripRouteCache().walk(p, leg.to); } catch { refined = key; return; }
  if (a === undefined) return;
  refined = key;
  if (!a || !(a.length > 0) || !a.path || a.path.length < 4) return;
  const length = Math.max(a.length, Math.hypot(leg.to.x - p.x, leg.to.z - p.z));
  const seconds = autoOn() && leg.via === 'walk' ? autoTravelSeconds(length) : length / (leg.via === 'run' ? TRIP_SPEED.run : TRIP_SPEED.walk);
  dispatchTrip({ type: 'refine', leg: t.leg, patch: { path: a.path, length, seconds } });
}

/** 10 Hz: the leg's progress that does not need BAYBAY to lead (rides, drives, flights, a carried arrival). */
function tick(now: number) {
  const t = flow.get().trip;
  if (!t) { if (legKey) resetLeg(); return; }
  if (isArrived(t)) {
    applyEndTurn();
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
      if (game.get().move.mode !== 'foot' && game.get().move.mode !== 'photo' && dist(p, leg.to) < END_R + 2) { arrived(); return; }
      refineWalk(t, leg, p);
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
    case 'fly': {
      // W5-N9: a scenic flight — up while lane F's auto-glide flies or the player glides on after taking the wings;
      // back on foot, BAYBAY walks the rest (quietly from the ~20 u landing; with a line from a landing elsewhere)
      const g = glide;
      if (g) {
        if (autoGliding() || game.get().move.mode === 'glide') { travelSeen = true; return; }
        if (!travelSeen) {
          // the take-off never happened (a dialogue opened, the player was not on foot…): the fast hop
          if (g.end === 'cancelled' || now - g.at > GLIDE_START_MS) { glide = null; flyFast(t, leg); }
          return;
        }
        glide = null;
        const d = dist(p, leg.to);
        if (d <= END_R) arrived();
        else walkRest(t, d > FLY_END_R ? { zh: '就在这儿降落啦，我们走过去！', en: 'We landed here — let’s walk the rest!' } : undefined);
        return;
      }
      if (travelActive()) { travelSeen = true; return; }
      if (travelSeen) arrived();
      return;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// W5-N3 · auto-travel (game/autoTravel.ts: the state and the reducer; here the live inputs and the effects)
// ---------------------------------------------------------------------------------------------------------------

/** The trips that carry the player (the map's buttons and rows, cards / goTo, 问 BAYBAY, a panorama tag, a free lead). */
export const AUTO_SOURCES: ReadonlySet<TripSource> = new Set<TripSource>(['map', 'card', 'call', 'panorama', 'free-lead', 'qa']);
/** How close counts as "there" for an on-foot target (u); the controller walks to within 0.3 u of it. */
export const AUTO_AT_R = 2.5;
/** A start inside a blocker (a landmark footprint, a hedge) steps out to walkable ground within this first (u). */
export const STEP_OUT_R = 12;

/** The last frame a movement key / the stick was held (performance ms). */
let manualAt = -Infinity;

/**
 * Where auto-travel walks for the current leg (null: nothing to walk — riding, driving, flying): a walk / run leg's end
 * (through an elevated walkway's entry first: brain leadStep, the GGB deck), a line leg's boarding stop until the ride
 * is seen, a bike / car leg's parked vehicle (used on arrival: the mount, then the autopilot drives). A player standing
 * inside a blocker first steps out to the nearest walkable spot (plan W5-N3 "the footprint step-out").
 */
export function autoWant(leg: TripLeg, player: Vec2 & { y: number }, stand: (p: Vec2) => boolean = p => canStand(p.x, p.z), exit: (p: Vec2) => Vec2 | null = p => nearestWalkable(p, STEP_OUT_R)): AutoWant | null {
  let want: AutoWant | null = null;
  switch (leg.via) {
    case 'walk': case 'run': { const s = leadStep(leg.to, player); want = { p: { x: s.x, z: s.z }, r: AUTO_AT_R }; break; }
    case 'line': want = rideSeen || onLine(leg) ? null : { p: { x: leg.from.x, z: leg.from.z }, r: STOP_R }; break;
    case 'bike': case 'car':
      want = mounted(leg.via) || driving ? null : { p: { x: leg.from.x, z: leg.from.z }, r: AUTO_AT_R, ...(leg.vehicle && leg.vehicle !== 'ridden' ? { interact: leg.vehicle } : {}) };
      break;
    case 'fly': want = null;
  }
  if (want && !stand(player)) {
    const out = exit(player);
    if (out && Math.hypot(out.x - player.x, out.z - player.z) > 0.3) return { p: out, r: 0.8 };
  }
  return want;
}

/** A line vehicle's pose (world yaw heading) and how long it has stood short of the player on its track (s). */
export interface LineVehicle { x: number; z: number; heading: number; held: number }

/** Every running line vehicle near enough to matter (cable cars, F-line cars, the sightseeing buses, the Metro cars). */
export function lineVehicles(): LineVehicle[] {
  const out: LineVehicle[] = [];
  const add = (held: number, p: { x: number; z: number; heading: number }) => out.push({ x: p.x, z: p.z, heading: p.heading, held });
  for (const c of activeCableSystem()?.cars ?? []) add(c.held, c.pose);
  for (const c of activeStreetcarSystem()?.cars ?? []) add(c.held, c.pose);
  const fleet = activeLineFleet();
  for (const b of fleet?.bus.buses ?? []) add(b.held, b.pose);
  for (const tr of fleet?.rail.trains ?? []) for (const c of tr.cars) add(tr.held, c);
  return out;
}

/**
 * CP-1 (the mid-wave checkpoint): the carried player standing in a line vehicle's way. The one that has waited longest
 * (≥ YIELD_AFTER_S) gives the spot to step aside to; `near` = any vehicle within YIELD_CLEAR_R.
 */
export function vehicleYield(player: Vec2, vehicles: readonly LineVehicle[], toward: Vec2 | null, stand: (p: Vec2) => boolean = p => canStand(p.x, p.z)): { to: Vec2 | null; near: boolean } {
  let holder: LineVehicle | null = null, near = false;
  for (const v of vehicles) {
    if (Math.hypot(v.x - player.x, v.z - player.z) < YIELD_CLEAR_R) near = true;
    if (v.held >= YIELD_AFTER_S && (!holder || v.held > holder.held) && Math.hypot(v.x - player.x, v.z - player.z) < 24) holder = v;
  }
  const h = holder;
  const clear = (p: Vec2) => vehicles.every(v => v === h || vehicleAxisDist(p, v) >= YIELD_OTHER_CLEAR);
  return { to: h ? yieldSpot(player, h, stand, toward, YIELD_SIDE, clear) : null, near };
}

/** 10 Hz (and at a trip's start): step auto-travel and apply its decision. */
function autoTick(now: number) {
  const st = autoState();
  if (!st.on || delivering) return;
  const t = flow.get().trip, leg = currentLeg(t);
  if (!t || !leg) { autoEnd(); return; }
  const s = game.get(), f = flow.get(), pl = runtime.player;
  const blocked = s.phase !== 'playing' || !!s.dialogue.nodeId || !!s.panel.kind || !!f.cinematic || travelActive() || s.riding !== null
    || s.move.mode !== 'foot' || s.photoMode;
  const player = { x: pl.x, z: pl.z };
  // (W9-N1) 换条路 on the stuck card: the detour spot first, then the leg's own target
  if (detour && dist(player, detour) <= DETOUR_AT_R) detour = null;
  const want = detour ? { p: detour, r: DETOUR_AT_R } : autoWant(leg, pl);
  // (W9-N1) a short way that walks a long way round (the Golden Gate stop → the Welcome Center: 30 u straight, 259 u on
  // foot round the cliff) is delivered at once under the veil
  if (!blocked && want && !detour && !st.escaping && shortLegCheck(keyOf(t), player, want)) return;
  const y = blocked || !want ? { to: null, near: false } : vehicleYield(player, lineVehicles(), want.p);
  const { state, decision } = autoStep(st, {
    now, manualAt, pathTarget: pl.pathTarget, player, want, blocked, legKey: keyOf(t), yieldTo: y.to, vehicleNear: y.near,
  });
  setAutoState(state);
  if (decision.type === 'issue') {
    // (our own object: the reducer tells ours from a tap by identity)
    pl.pathTarget = decision.p;
    pl.pendingInteract = decision.interact ?? null;
    if (decision.yield) bubble({ zh: '有车来，我们先让一让～', en: 'A car is coming. Let’s step aside' }, 2600, BAYBAY_ID, 'call');
  } else if (decision.type === 'escape') {
    // (W9-N1) the player gets out of the stuck spot by hand: our walk stops, BAYBAY carries on once they let go
    if (st.issued && pl.pathTarget === st.issued) { pl.pathTarget = null; pl.pendingInteract = null; }
  } else if (decision.type === 'takeover') {
    noteAutoEnd('takeover');
  } else if (decision.type === 'giveup') {
    // (W9-N1, review R§5 #7) no silent "you steer" any more: a short way is delivered, a long one gets the stuck card
    noteAutoEnd('giveup');
    detour = null;
    if (st.issued && pl.pathTarget === st.issued) { pl.pathTarget = null; pl.pendingInteract = null; }
    rescue(t, want);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// W9-N1 · the stuck rescue (review R§5 #7: a tour leg stood 6 min after three silent retries; the SoMa leg 45 s of
// "BAYBAY 带路中", then a chip that retried the same blocked way)
// ---------------------------------------------------------------------------------------------------------------

/** A carried leg that gave up this close (u, straight) to where it walks is delivered under a veil — no card. */
export const DELIVER_R = 60;
/** 换条路: the detour spot counts as reached this close (u). */
export const DETOUR_AT_R = 2;
/** 换条路: candidate detour spots on rings this far round the player (u), 12 bearings each. */
export const DETOUR_RINGS = [10, 16, 24] as const;
/** 换条路: at most this many candidates get a path check (the local A*: a click, not a frame). */
export const DETOUR_CHECKS = 16;
/** (W9-N1) the stuck card's line (a fixed line lane X can voice; C:/Users/willy/opus-qa/w9/new-lines.md) */
export const STUCK_LINE: Bilingual = { zh: '这段路被挡住了，我们怎么走？', en: 'This way is blocked. How shall we go?' };
const STUCK_FLY: Bilingual = { zh: '飞过去', en: 'Fly there' };
const STUCK_DETOUR: Bilingual = { zh: '换条路', en: 'Try another way' };
const STUCK_SELF: Bilingual = { zh: '我自己走', en: 'I’ll walk myself' };
/** the veil's words while a short blocked way is skipped (plain DOM, not voiced) */
const DELIVER_VEIL: Bilingual = { zh: 'BAYBAY 带你绕过去…', en: 'BAYBAY takes you round…' };

let detour: Vec2 | null = null;
/** (W9-N1) a blocked way is being delivered under the veil: the carried walk waits */
let delivering = false;

/** (W9-N1) A carried on-foot way this short (u, straight) is checked against its walking route once per leg … */
export const SHORT_LEG_R = 60;
/** … and delivered at once when the route is this many times the straight line and this much longer (u), or none exists. */
export const DETOUR_K = 3;
export const DETOUR_EXTRA = 80;
/** the route check gives up waiting for the A* after this long (ms): then the leg is walked (the watchdog covers it) */
export const SHORT_LEG_WAIT_MS = 8000;

/** Deliver a short way at once (pure): `route` = the walking route's length, null = no route, undefined = not known. */
export function deliverAtOnce(straight: number, route: number | null | undefined): boolean {
  if (straight > SHORT_LEG_R || straight < AUTO_AT_R || route === undefined) return false;
  return route === null || route > Math.max(straight * DETOUR_K, straight + DETOUR_EXTRA);
}

/** the leg (key) whose short-way check is done, and since when it waits for the route */
let shortChecked = '';
let shortSince = 0;
let shortFor = '';
/** Once per leg: ask the route cache (the A* the planner uses) and deliver a short way that walks far round. True = delivering. */
function shortLegCheck(key: string, player: Vec2, want: AutoWant): boolean {
  if (shortChecked === key) return false;
  const straight = dist(player, want.p);
  if (straight > SHORT_LEG_R || straight < AUTO_AT_R) { shortChecked = key; return false; }
  const now = performance.now();
  if (!shortSince || shortFor !== key) { shortSince = now; shortFor = key; }
  let route: number | null | undefined;
  try { const a = tripRouteCache().walk(player, want.p); route = a === null ? null : a?.length; } catch { route = undefined; }
  if (route === undefined && now - shortSince < SHORT_LEG_WAIT_MS) return false;
  shortChecked = key; shortSince = 0;
  if (!deliverAtOnce(straight, route)) return false;
  deliver(want.p);
  return true;
}

/** What a give-up does with the way left (pure): within DELIVER_R → 'deliver' (veil + set down there), else 'card'. */
export function rescueKind(player: Vec2, target: Vec2, r: number = DELIVER_R): 'deliver' | 'card' {
  return dist(player, target) <= r ? 'deliver' : 'card';
}

/**
 * 换条路 (pure): a standable spot on a ring round the player (DETOUR_RINGS × 12 bearings), nearest the target first,
 * from which the local path to the target exists and to which the player can walk — the first of at most `checks`
 * candidates that pass, else null (then the way is delivered). Not the spot the player stands on (≥ the first ring).
 */
export function detourSpot(player: Vec2, target: Vec2, stand: (p: Vec2) => boolean, path: (a: Vec2, b: Vec2) => boolean, checks: number = DETOUR_CHECKS): Vec2 | null {
  const cands: Vec2[] = [];
  for (const r of DETOUR_RINGS) for (let k = 0; k < 12; k++) { const a = (k * Math.PI) / 6; cands.push({ x: player.x + Math.cos(a) * r, z: player.z + Math.sin(a) * r }); }
  let n = 0;
  for (const c of cands.filter(stand).sort((a, b) => dist(a, target) - dist(b, target))) {
    if (n++ >= checks) break;
    if (path(player, c) && path(c, target)) return c;
  }
  return null;
}

/** The local A* answers with a way (the city window's grid; a clamped answer still leads toward the goal). */
const pathOk = (a: Vec2, b: Vec2): boolean => { const r = findPath(a, b, 6); return !!r && r.points.length > 0; };

function rescue(t: TripState, want: AutoWant | null) {
  const leg = currentLeg(t);
  const target = want?.p ?? (leg ? legTarget(leg, 'approach') : null);
  if (!target) return;
  if (rescueKind(P(), target) === 'deliver') { deliver(target); return; }
  openStuckCard();
}

/** Under a veil, set the player (and BAYBAY) down at the blocked way's end on walkable ground; carrying goes on. */
function deliver(to: Vec2) {
  if (delivering) return;
  const t0 = flow.get().trip;
  const spot = nearestWalkable(to, 8) ?? to;
  delivering = true;
  const pl = runtime.player;
  if (pl.pathTarget && pl.pathTarget === autoState().issued) { pl.pathTarget = null; pl.pendingInteract = null; }
  void importRetry(() => import('./lineRides')).then(m => m.veiledSkip(spot, null, () => {
    delivering = false;
    // (the trip may have ended or changed under the veil: then nothing moves)
    const now = flow.get().trip;
    if (!now || !t0 || now.startedAt !== t0.startedAt || isArrived(now)) return;
    teleportPlayer(spot);
    runtime.guide.x = spot.x + 1.2; runtime.guide.z = spot.z + 0.8; runtime.guide.y = heightAt(runtime.guide.x, runtime.guide.z);
    if (!autoOn()) autoBegin();
    autoTick(performance.now());
  }, DELIVER_VEIL), () => { delivering = false; });
}

/** The stuck card: a BAYBAY card with three answers, in F's title slot at the top priority (game/attention.ts). */
function openStuckCard() {
  if (dialogueOpen() || game.get().phase !== 'playing') { say(STUCK_LINE.zh, STUCK_LINE.en, 'info', 4200); return; }
  const choices: NonNullable<DialogueNode['choices']> = [
    { hotkey: '1', label: STUCK_FLY, action: { type: 'ask', id: ASK_STUCK_FLY } },
    { hotkey: '2', label: STUCK_DETOUR, action: { type: 'ask', id: ASK_STUCK_DETOUR } },
    { hotkey: '3', label: STUCK_SELF, action: { type: 'end' } },
  ];
  const id = defineNode({ id: 'flow.trip.stuck', speaker: 'baybay', mood: 'thinking', text: STUCK_LINE, choices });
  showCard(id, ATTENTION_PRIORITY.stuck, () => { if (!dialogueOpen() && flow.get().trip) playDialogue(id); });
}

// ---------------------------------------------------------------------------------------------------------------
// W9-N3 · cards through F's attention arbiter (sf-w9-lead.md §4): the stuck card, the tour's resume and chapter cards
// ---------------------------------------------------------------------------------------------------------------

/** the cards asked for or on screen: the dialogue node each one opens, and whether it is up */
const cards = new Map<string, { ticket: SlotTicket | null; shown: boolean }>();

/**
 * Show a card (a dialogue node) in the title slot: `open` runs when F's arbiter grants it (at once when the slot is
 * free); the slot is released when that dialogue closes (watched at 10 Hz) or when the card was not shown in time.
 */
export function showCard(nodeId: string, priority: number, open: () => void, maxWaitMs = 15000) {
  cards.get(nodeId)?.ticket?.release();
  const entry: { ticket: SlotTicket | null; shown: boolean } = { ticket: null, shown: false };
  cards.set(nodeId, entry);
  entry.ticket = requestSlot('title', `n:${nodeId}`, {
    priority, maxWaitMs,
    onGrant: () => { entry.shown = true; open(); },
    onDrop: () => { if (cards.get(nodeId) === entry) cards.delete(nodeId); },
  });
}

/** 10 Hz: a card whose dialogue closed (or never opened: another dialogue held the screen) frees the title slot. */
function watchCards() {
  if (!cards.size) return;
  const open = game.get().dialogue.nodeId;
  for (const [nodeId, e] of cards) {
    if (!e.shown || open === nodeId) continue;
    e.ticket?.release();
    cards.delete(nodeId);
  }
}

/** (W9-N3) the resume card's line: a fixed line lane X can voice (C:/Users/willy/opus-qa/w9/new-lines.md) */
export const RESUME_LINE: Bilingual = { zh: '上次的一日游还没走完，接着走吗？', en: 'We didn’t finish the Grand Tour last time. Shall we go on?' };
/** the resume card waits this long (ms) of free play on return before it asks */
export const RESUME_AFTER_MS = 6000;
/** a Grand Tour left half way when this page loaded: offer it once (null: nothing to offer, or offered) */
let resumeOffer: { since: number } | null = null;

/**
 * "继续一日游 · 第 3 章（约 22 分钟）" (pure): the chapter of the first open stop and the minutes left, scaled to the
 * measured quote (the tour's "约 36 分钟" is the measured run, the stops keep the timing model's minutes).
 */
export function tourResumeChoice(def: { chapters: { stops: { id: string; optional?: boolean; minutes: number }[] }[]; minutes: number; modelMinutes?: number }, completed: readonly string[]): { chapter: number; minutes: number; label: Bilingual } | null {
  let chapter = -1, left = 0;
  def.chapters.forEach((c, ci) => c.stops.forEach(s => {
    if (s.optional || completed.includes(s.id)) return;
    if (chapter < 0) chapter = ci;
    left += s.minutes;
  }));
  if (chapter < 0) return null;
  const minutes = Math.max(1, Math.round(left * (def.minutes / (def.modelMinutes || def.minutes))));
  const m = minutesLabel(minutes);
  return { chapter: chapter + 1, minutes, label: { zh: `继续一日游 · 第 ${chapter + 1} 章（${m.zh}）`, en: `Resume the Grand Tour · chapter ${chapter + 1} (${m.en})` } };
}

/** 10 Hz: on return with a Grand Tour left half way, one card after RESUME_AFTER_MS of free play (never mid-tour). */
function maybeOfferResume(now: number) {
  const o = resumeOffer;
  if (!o) return;
  const s = game.get(), f = flow.get();
  if (s.tour.active) { resumeOffer = null; return; }
  const idle = s.worldMode === 'city' && s.phase === 'playing' && s.mode === 'free' && !s.dialogue.nodeId && !s.panel.kind && !f.trip && !f.cinematic && s.move.mode === 'foot';
  if (!idle) { o.since = 0; return; }
  if (!o.since) { o.since = now; return; }
  if (now - o.since < RESUME_AFTER_MS) return;
  resumeOffer = null;
  const completed = readSave()?.tours?.['sf-grand']?.completed ?? [];
  if (!completed.length) return;
  void importRetry(() => import('../data/sf/tours')).then(T => {
    const def = T.cityTour('sf-grand');
    const pick = def ? tourResumeChoice(def, completed) : null;
    if (!pick || game.get().tour.active) return;
    const id = defineNode({
      id: 'flow.tour.resume', speaker: 'baybay', mood: 'excited', text: RESUME_LINE,
      choices: [
        { hotkey: '1', label: pick.label, action: { type: 'start-tour', tourId: 'sf-grand' } },
        { hotkey: '2', label: { zh: '先自己逛逛', en: 'I’ll roam for now' }, action: { type: 'end' } },
      ],
    });
    showCard(id, ATTENTION_PRIORITY.card, () => { if (!dialogueOpen() && !game.get().tour.active) playDialogue(id); });
  }, () => { /* the tour chunk failed: nothing to offer */ });
}

const ASK_STUCK_FLY = 'n-stuck-fly';
const ASK_STUCK_DETOUR = 'n-stuck-detour';

/** 飞过去: the rest of the trip as one flight to its end (the pelican's hop; set down under a veil if it cannot fly). */
function stuckFly() {
  const t = flow.get().trip;
  if (!t || isArrived(t)) return;
  const last = t.legs[t.legs.length - 1].to;
  const from = P();
  const length = dist(from, last);
  const leg: TripLeg = { via: 'fly', from: { x: from.x, z: from.z }, to: { ...last }, place: t.placeId, seconds: 8, length };
  replan({ mode: 'fly', legs: [leg], seconds: leg.seconds });
}

/** 换条路: a detour spot BAYBAY walks to first, then on to the leg's target (no spot: the way is delivered). */
function stuckDetour() {
  const t = flow.get().trip, leg = currentLeg(t);
  if (!t || !leg) return;
  const target = autoWant(leg, runtime.player)?.p ?? legTarget(leg, 'approach');
  if (!target) return;
  const spot = detourSpot(P(), target, p => canStand(p.x, p.z, 0.6), pathOk);
  if (!spot) { deliver(target); return; }
  detour = spot;
  if (!autoOn()) autoBegin();
  autoTick(performance.now());
}

/**
 * W5-N9 · 让 BAYBAY 接着飞 (the chip while the player glides on a scenic flight's taken wings): lane F's auto-glide flies
 * on to the leg's end from where the pelican is. False: not a scenic flight, not gliding, or the glide refuses (under
 * 60 u to go: land with 降落 / G).
 */
export function resumeScenicGlide(): boolean {
  const t = flow.get().trip, leg = currentLeg(t);
  if (!t || !leg || !isScenicLeg(leg) || !glide || game.get().move.mode !== 'glide' || autoGliding()) return false;
  const g = glide;
  g.end = null;
  return autoGlide({ x: leg.to.x, z: leg.to.z }, { onEnd: how => { g.end = how; } });
}

/** 自动跟上 (the chip, 问 BAYBAY): BAYBAY carries the player again for the running trip. */
export function resumeAutoTravel(): boolean {
  const t = flow.get().trip;
  if (!t || isArrived(t) || autoOn()) return false;
  autoBegin();
  autoTick(performance.now());
  return true;
}

/** The 问 BAYBAY item "带我去 · <destination>" (visible while a trip runs without auto-travel). */
function askLabel(): Bilingual | null {
  const t = flow.get().trip;
  if (!t || isArrived(t) || t.source === 'tour' || autoOn()) return null;
  const n = destName(t);
  return { zh: `带我去 · ${n.zh}`, en: `Take me there · ${n.en}` };
}
let askText = '';
let offAsk: (() => void) | null = null;
/** (Re-)register the ask item when its words change (the slot registry: the same id replaces). */
function syncAskItem() {
  const label = askLabel();
  const text = label ? label.zh + label.en : '';
  if (text === askText) return;
  askText = text;
  offAsk?.();
  offAsk = label ? registerAskItem({ id: 'n-take-me', order: 5, label, icon: Navigation, visible: () => askLabel() !== null, onSelect: () => { resumeAutoTravel(); } }) : null;
}

let booted = false;
/** Once per page in city mode (game/cityContent.ts); returns the disposer. */
export function initTripRun(): () => void {
  if (booted) return () => {};
  booted = true;
  const runner: TripRunner = { start, skip, replan, end, arrived, freeLead, objective, guide };
  setTripRunner(runner);
  // (W9-N1) the stuck card's answers (ask actions; never listed in the 问 BAYBAY menu)
  const offStuck = [
    registerAskItem({ id: ASK_STUCK_FLY, order: 999, label: STUCK_FLY, icon: Navigation, visible: () => false, onSelect: stuckFly }),
    registerAskItem({ id: ASK_STUCK_DETOUR, order: 999, label: STUCK_DETOUR, icon: Navigation, visible: () => false, onSelect: stuckDetour }),
  ];
  let acc = 0;
  // (W9-N3) a Grand Tour the save holds half done when the city opens: one resume card on return
  try { const p = readSave()?.tours?.['sf-grand']; resumeOffer = p && p.completed.length ? { since: 0 } : null; } catch { resumeOffer = null; }
  const offFrame = registerFrameSystem('c-trips', (dt, now) => {
    // every frame: a held movement key / stick is a takeover (a quick tap must not slip between the 10 Hz steps)
    if (input.manualMove) manualAt = now;
    if ((acc += dt) < 0.1) return;
    acc = 0;
    if (game.get().phase === 'playing') { tick(now); autoTick(now); maybeOfferResume(now); }
    watchCards();
    syncAskItem();
  });
  // a fast-travel trip that the player did not start as a fly leg moves them away: the walk would lead back, so end it
  const offEvents = onEvent(e => {
    if (e.type !== 'travel' || e.what !== 'start') return;
    const t = flow.get().trip, leg = currentLeg(t);
    if (t && leg && leg.via !== 'fly') end();
  });
  return () => {
    offFrame(); offEvents(); offAsk?.(); offAsk = null; askText = ''; offStuck.forEach(off => off());
    // (W9-N3) a card still up or waiting frees F's title slot with the runner
    for (const e of cards.values()) e.ticket?.release();
    cards.clear(); resumeOffer = null;
    autoEnd(); setTripRunner(null); resetLeg(); booted = false;
  };
}
