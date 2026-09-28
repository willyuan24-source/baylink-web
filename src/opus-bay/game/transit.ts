import { platformStop, releasePlatformStop, rider as platformRider, toWorld } from '../actors/platform';
import { emit } from '../core/events';
import { input } from '../core/input';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { canStand, nearestWalkable } from '../core/terrain';
import type { Bilingual, DialogueNode } from '../core/types';
import type { TransitKind } from '../core/events';
import { DISTRICT } from '../data/district';
import { POIS } from '../data/pois';
import { noteRide } from '../data/save';
import type { FLineStation } from '../data/fline';
import { CABLE, FERRY_ROUTES, type CableLine, type TransitData, activeCableSystem, activeFerrySystem, activeLineFleet, activeStreetcarSystem, cableLine, ferryTerminal, loadTransit, onTransitData, rideSystemFor, stopPos, transitData, transitStation, w4Kind } from '../data/transit';
import { hookFill, hookText, nodeText, npcLine } from './content';
import { travelEpoch } from './fastTravel';
import { announce, bubble, completeGoal, defineNode, openPanel, playDialogue, refreshLock, say, teleportPlayer } from './flow';
import { flow, type FlowRide } from './flowStore';
import { interactableById, invalidateInteractables, registerInteractables, type Interactable } from './interactables';
import { type RideState, beginLineRide, beginRide, currentRide, endRide, isLineRide, lineRideEta, lineRideTurning, nearestStopId, rideMinOdometer, rideSeconds, sortedStops, stepRide } from './ride';

/**
 * Transit flow (lane F owns this file from wave 2; the day-0 commit moved the streetcar section of game/flow.ts here
 * unchanged, and flow.ts re-exports boardStreetcar / cancelRide / hopOffRide / finishRide so old imports keep working).
 *
 * Contract (docs/opus-bay/sf-w2-contracts.md §transit):
 *   boardFrom(it)            flow.performInteraction's 'streetcar' action (any station interactable) lands here
 *   openRideNode(rest)       dialogue nodes `flow.ride.<rest>` (today `<from>><to>`) land here
 *   stepTransit(dt)          per frame, called by game/Systems.tsx Ticker at the old stepRide spot
 *   rideLabel(ride)          what the HUD RideBanner shows (ui/Hud.tsx)
 *   requestHopOff()          immediate hop-off for code that is not the rider (QA, a trip start); = hopOffRide. Input
 *                            (Space / B / the HUD's 提前下车) goes through E2's moveSystem brake instead (contracts §5.2)
 *   transitInteractables()   city stations (F registers them with interactables.registerInteractables in initTransit)
 *   rideLog()                rides per line id, for G1's save v2
 *   initTransit()            once per page, from flow.initFlowListeners (returns a disposer)
 */

// --- streetcar (moved verbatim from flow.ts) ---------------------------------------------------------

/** Streetcar stop: pick a destination (the F-line runs the whole waterfront). */
export function boardStreetcar(stopId: string) {
  if (!stopId) return;
  const stops = sortedStops();
  const here = stops.find(stop => stop.id === stopId);
  const others = stops.filter(stop => stop.id !== stopId);
  if (!here || others.length === 0) { say('这一站暂时没有电车', 'No streetcar at this stop right now'); return; }
  if (others.length === 1) { rideTo(stopId, others[0].id); return; }
  const choices: NonNullable<DialogueNode['choices']> = others
    .sort((a, b) => Math.abs(a.at - here.at) - Math.abs(b.at - here.at))
    .map((stop, i) => {
      const secs = Math.round(rideSeconds(stopId, stop.id));
      return { hotkey: String(i + 1), label: { zh: `去${stop.name.zh}（约 ${secs} 秒）`, en: `To ${stop.name.en} (~${secs}s)` }, next: `flow.ride.${stopId}>${stop.id}` };
    });
  choices.push({ hotkey: String(choices.length + 1), label: { zh: '先不坐了', en: 'Not now' }, action: { type: 'end' } });
  const operator = npcLine('streetcar').name ?? { zh: '电车司机', en: 'Streetcar operator' };
  playDialogue(defineNode({ id: 'flow.streetcar', speaker: 'npc', npcName: operator, mood: 'happy', text: { zh: `叮叮！这里是${here.name.zh}，想坐到哪一站？`, en: `Ding ding! This is ${here.name.en}. Where to?` }, choices }));
}

export function rideTo(stopId: string, target: string) {
  const r = beginRide(stopId, target);
  if (!r) { say('这一站暂时没有电车', 'No streetcar at this stop right now'); return; }
  game.set({ riding: 'streetcar', panel: { kind: null } });
  refreshLock();
  emit({ type: 'streetcar-bell' });
  const to = DISTRICT.streetcar.stops.find(stop => stop.id === r.to);
  flow.set({ ride: { stage: r.mode === 'wait' ? 'waiting' : 'riding', from: r.from, to: r.to } });
  const boardLine = nodeText(interactableById(`streetcar-${stopId}`)?.nodeId) ?? nodeText(POIS.find(poi => poi.interaction?.kind === 'streetcar')?.interaction.nodeId);
  if (boardLine) bubble(boardLine, 3600);
  announce({ zh: `上车：开往${to?.name.zh ?? ''}`, en: `Boarding: to ${to?.name.en ?? ''}` });
}

/** Cancel while waiting at the stop (no teleport). */
export function cancelRide() {
  releaseStop();
  const r = currentRide();
  if (isLineRide(r)) rideSystemFor(r.line)?.cancel();
  endRide();
  game.set({ riding: null });
  flow.set({ ride: null });
  refreshLock();
}

/** Contracts §5.2: ending a ride always releases a hop-off brake pending on its line (never a car holding forever). */
function releaseStop() {
  const r = currentRide();
  const line = r?.line ?? (game.get().move.mode === 'transit' ? game.get().move.line : undefined) ?? 'streetcar';
  if (platformStop(line)) releasePlatformStop(line);
}

/**
 * F17 · "提前下车": get off right here — beside the car on the nearest walkable spot, not teleported to the
 * destination. (It still counts as a ride once the car has actually moved you along.)
 */
export function hopOffRide() {
  const r = currentRide();
  if (!r) { cancelRide(); return; }
  if (isLineRide(r)) {
    // wave 4: no getting off a Metro train while any part of it is in a tunnel or under a portal hood (unless it stands
    // at a station); the ride goes on and the HUD says why (lane G's moveSystem checks rideLabel().canHopOff first)
    const hold = w4Kind(r.line) === 'light-rail' ? W4G?.w4Status(r) : null;
    if (hold && hold.canHopOff === false && !hold.station) {
      releaseStop();
      if (hold.portalWait) say('马上出隧道…', 'Coming out of the tunnel…');
      else say('隧道里不能下车', 'No getting off inside the tunnel');
      return;
    }
    leaveLineRide(r, false);
    return;
  }
  releaseStop();
  const rode = r.mode !== 'wait' && r.elapsed > 2.5;
  endRide();
  game.set({ riding: null });
  flow.set({ ride: null });
  const p = runtime.player;
  const car = r.mode === 'follow' ? runtime.streetcar : { x: p.x, z: p.z, heading: p.heading };
  // step off on the promenade side of the car
  const side = { x: car.x + Math.cos(car.heading) * 2.4, z: car.z - Math.sin(car.heading) * 2.4 };
  const spot = nearestWalkable(canStand(side.x, side.z, 0.45) ? side : { x: car.x, z: car.z }, 12) ?? { x: p.x, z: p.z };
  teleportPlayer(spot);
  runtime.guide.x = spot.x + 1.2; runtime.guide.z = spot.z + 0.8;
  emit({ type: 'streetcar-bell' });
  if (rode) completeGoal('streetcar');
  refreshLock();
}

export function finishRide() {
  const r = currentRide();
  if (isLineRide(r)) { leaveLineRide(r, true); return; }
  releaseStop();
  endRide();
  game.set({ riding: null });
  flow.set({ ride: null });
  if (r) {
    const at = DISTRICT.anchors?.[`streetcar-${r.to}`];
    if (at) teleportPlayer(at);
    const stop = DISTRICT.streetcar.stops.find(item => item.id === r.to);
    emit({ type: 'streetcar-bell' });
    if (stop) say(`到站：${stop.name.zh}`, `Arrived: ${stop.name.en}`, 'success');
    const offLine = hookText('streetcarOff');
    if (offLine) setTimeout(() => bubble(offLine, 2600), 300);
    completeGoal('streetcar');
    // BAYBAY hops off with you.
    if (at) { runtime.guide.x = at.x + 1.5; runtime.guide.z = at.z + 1; }
  }
  refreshLock();
}

// --- day-0 hooks (lane F fills them in) -----------------------------------------------------------------

/**
 * flow.performInteraction → a station interactable (action 'streetcar', source 'streetcar' or 'transit'): a city cable-car
 * station (refId = station id), a turntable push (`transit-push-<turntable>`), else the hero F-line stop.
 */
export function boardFrom(it: Interactable) {
  if (it.id.startsWith(PUSH_PREFIX)) { pushTurntable(it.refId ?? it.id.slice(PUSH_PREFIX.length)); return; }
  if (it.source === 'transit' && it.refId && ferryTerminal(it.refId)) { boardFerry(it.refId); return; }
  // wave 4: a sightseeing-loop pole or a Muni Metro kiosk / stop
  if (it.source === 'transit' && it.refId && W4G?.stationLines(it.refId).length) { W4G.boardLine(it.refId); return; }
  // city mode: the F-line to the Castro serves the hero stops and its Market Street stations
  const fl = it.refId && flineStation(it.refId) ? it.refId : it.source === 'streetcar' && activeStreetcarSystem() ? nearestStopId(it) : null;
  if (fl && flineStation(fl)) { boardFLine(fl); return; }
  if (it.source === 'transit' && it.refId && transitStation(it.refId)) { boardCable(it.refId); return; }
  boardStreetcar(it.refId ?? nearestStopId(it) ?? '');
}

/** flow's dialogue runner hands every `flow.ride.<rest>` node here: `<fromStop>><toStop>` (F-line) or `cc:<line>:<from>:<to>`. */
export function openRideNode(rest: string) {
  if (rest.startsWith('ln:')) {
    const [, line, from, to] = rest.split(':');
    if (W4G) W4G.rideLine(line, from, to); else say(...W4_NOT_READY);
    return;
  }
  if (rest.startsWith('map:')) { openLineMap(rest.slice(4)); return; }
  if (rest.startsWith('fe:')) {
    const [, from, to] = rest.split(':');
    rideFerry(from, to);
    return;
  }
  if (rest.startsWith('fl:')) {
    const [, from, to] = rest.split(':');
    rideFLine(from, to);
    return;
  }
  if (rest.startsWith('cc:')) {
    const [, line, from, to] = rest.split(':');
    rideCable(line, from, to);
    return;
  }
  const [from, to] = rest.split('>');
  rideTo(from, to);
}

/** Per frame (game/Systems.tsx Ticker, right after stepCinema): advance the ride and keep the HUD in step. */
export function stepTransit(dt: number) {
  const r = currentRide();
  const ride = stepRide(dt, travelEpoch());
  if (isLineRide(r)) stepCity(r, dt);
  pollTurntables(dt);
  if (!ride) return;
  if (isLineRide(r) && ride.lost) { cancelRide(); return; }
  if (isLineRide(r)) lineTick(r, ride);
  const current = flow.get().ride;
  // the hop-off brake (E2 requests the stop, the car brakes): the HUD says so
  const stage = ride.stage === 'riding' && platformStop(r?.line ?? 'streetcar') ? 'braking' : ride.stage;
  if (current && (current.stage !== stage || current.eta !== ride.eta)) flow.set({ ride: { ...current, stage, eta: ride.eta } });
  if (ride.done) finishRide();
}

/**
 * Immediate hop-off for callers that are not the rider (QA, G1 starting a trip while riding). Rider input (Space / B / F /
 * the HUD's 提前下车 via actors/moveApi) never lands here: E2's moveSystem brakes first (requestPlatformStop), then calls
 * hopOffRide (docs/opus-bay/sf-w2-contracts.md §5.2 "Hop-off handshake").
 */
export function requestHopOff() { hopOffRide(); }

export interface RideLabel {
  /** which glyph the banner shows (wave 4: 'bus' = the sightseeing loop, 'metro' = the Muni Metro N / M) */
  icon: 'tram' | 'cable-car' | 'ferry' | 'bus' | 'metro';
  /** stage 'waiting' text */
  waiting: Bilingual;
  /** "F 线电车 · 开往" — shown before the destination name */
  lineTo: Bilingual;
  /** destination stop / station name */
  dest: Bilingual | null;
  /**
   * Wave 4 (lane T; optional, absent = allowed): 提前下车 is possible now — false while any part of a Metro train is in a
   * tunnel or under a portal hood; `hopOffNote` says why ("隧道里不能下车" / "马上出隧道…"). Lane G's banner greys the
   * button out and its moveSystem refuses Space / B then.
   */
  canHopOff?: boolean;
  hopOffNote?: Bilingual | null;
  /** 下一站下车 is offered (bus / Metro rides under way): `requestNextStop()` */
  nextStop?: boolean;
  /**
   * (verify m5) 直接到站 may be offered while still waiting (the ferry: the boat can be 80–140 s away). finishRide() then
   * puts the rider on the destination's quay (under the veil when it has not streamed in); it never counts as a ride.
   * Lane G's banner shows the button in the waiting stage when this is set.
   */
  skipWhileWaiting?: boolean;
}

/** What the HUD RideBanner shows for a ride (the hero F-line: exactly the old strings). */
export function rideLabel(ride: FlowRide): RideLabel {
  if ((ride.kind === 'bus' || ride.kind === 'light-rail') && ride.line) {
    if (W4G) return W4G.lineLabel(ride);
    return { icon: ride.kind === 'bus' ? 'bus' : 'metro', waiting: { zh: '等车进站…', en: 'Waiting…' }, lineTo: { zh: '', en: '' }, dest: null };
  }
  if (ride.kind === 'cable-car' && ride.line) {
    const line = cableLine(ride.line);
    const dest = transitStation(ride.to);
    const turning = ride.stage === 'waiting' && lineRideTurning();
    const eta = ride.eta ? { zh: `约 ${ride.eta} 秒`, en: ` ~${ride.eta}s` } : { zh: '', en: '' };
    return {
      icon: 'cable-car',
      waiting: turning
        ? { zh: `叮当车正在转车台上掉头…按 E 帮忙推！${eta.zh}`, en: `The cable car is turning on the turntable… press E to help push!${eta.en}` }
        : { zh: `等叮当车进站…${eta.zh}`, en: `Waiting for the cable car…${eta.en}` },
      lineTo: { zh: `${lineName(line).zh} · 开往`, en: `${lineName(line).en} · to` },
      dest: dest ? dest.name : null,
    };
  }
  if (ride.kind === 'ferry' && ride.line) {
    const dest = ferryTerminal(ride.to)?.terminal;
    return {
      icon: 'ferry',
      waiting: { zh: `等渡轮靠岸…${ride.eta ? `约 ${ride.eta} 秒` : ''}`, en: `Waiting for the ferry…${ride.eta ? ` ~${ride.eta}s` : ''}` },
      lineTo: { zh: '渡轮 · 开往', en: 'Ferry · to' },
      dest: dest ? dest.name : null,
      skipWhileWaiting: true,
    };
  }
  if (ride.kind === 'streetcar' && ride.line) {
    const dest = flineStation(ride.to);
    return {
      icon: 'tram',
      waiting: { zh: `等电车进站…${ride.eta ? `约 ${ride.eta} 秒` : ''}`, en: `Waiting for the streetcar…${ride.eta ? ` ~${ride.eta}s` : ''}` },
      lineTo: { zh: 'F 线电车 · 开往', en: 'F-line · to' },
      dest: dest ? dest.name : null,
    };
  }
  const to = DISTRICT.streetcar.stops.find(stop => stop.id === ride.to);
  return {
    icon: 'tram',
    waiting: { zh: `等电车进站…${ride.eta ? `约 ${ride.eta} 秒` : ''}`, en: `Waiting for the streetcar…${ride.eta ? ` ~${ride.eta}s` : ''}` },
    lineTo: { zh: 'F 线电车 · 开往', en: 'F-line · to' },
    dest: to ? to.name : null,
  };
}

// --- city cable cars (lane F, wave 2) ---------------------------------------------------------------------

const PUSH_PREFIX = 'transit-push-';
/** the F-line's ride line = its platform id (the district's, kept in city mode) */
const FLINE = 'streetcar';
const STATION_RADIUS = 4.2;
/** wide on purpose: while a car turns, pushing wins the E prompt over BAYBAY and the station (brain: score = d / radius) */
const PUSH_RADIUS = 12;
/** zh glossary (G2): the cable cars are 叮当车 in everything the player reads; the crew's name comes from G2's NPC_LINES */
const CABLE_CAR: Bilingual = { zh: '叮当车', en: 'Cable car' };
const gripman = (): Bilingual => npcLine('gripman').name ?? { zh: '叮当车司机', en: 'Gripman' };
const NO_CAR: [string, string] = ['这一站暂时没有叮当车', 'No cable car at this stop right now'];
const rides: Record<string, number> = {};
let seenHorn = input.hornCount;
let seenInteract = input.interactCount;
let turningNear: string[] = [];
let pushedAt: string | null = null;
let pollT = 0;
let seenFLine: unknown = null;
let seenFerry: unknown = null;
let seenFleet: unknown = null;

const isCity = () => game.get().worldMode === 'city';
const lineName = (line: CableLine | undefined): Bilingual => line?.name ?? CABLE_CAR;

/** Seconds a ride from station `from` to `to` takes on `line` (cable speed, dwells at the stops in between). */
export function cableRideSeconds(line: CableLine, from: string, to: string): number {
  const a = line.stops.find(st => st.station === from), b = line.stops.find(st => st.station === to);
  if (!a || !b) return 0;
  const dwells = line.stops.filter(st => st.dwell && (st.at - a.at) * (st.at - b.at) < 0).length;
  return Math.abs(b.at - a.at) / CABLE.speed + dwells * (CABLE.dwell + 2) + 3;
}

/** Destinations offered at a station: for each line stopping here, the terminus in each direction. */
export function cableChoices(data: TransitData, stationId: string): { line: CableLine; to: string; dir: 1 | -1; seconds: number }[] {
  const out: { line: CableLine; to: string; dir: 1 | -1; seconds: number }[] = [];
  for (const line of data.lines) {
    const here = line.stops.find(st => st.station === stationId);
    if (!here) continue;
    const first = line.stops[0], last = line.stops[line.stops.length - 1];
    for (const [end, dir] of [[last, 1], [first, -1]] as const) {
      if (end.station === stationId || (end.at - here.at) * dir <= 0) continue;
      out.push({ line, to: end.station, dir, seconds: Math.round(cableRideSeconds(line, stationId, end.station)) });
    }
  }
  return out;
}

/** E at a cable-car station: the gripman asks where to (each line's terminus both ways). */
export function boardCable(stationId: string) {
  const data = transitData(), station = transitStation(stationId);
  if (!data || !station) { say(...NO_CAR); return; }
  const options = cableChoices(data, stationId);
  if (!options.length) { say(...NO_CAR); return; }
  const choices: NonNullable<DialogueNode['choices']> = options.map((o, i) => {
    const dest = transitStation(o.to)!;
    return {
      hotkey: String(i + 1),
      label: { zh: `${o.line.name.zh} · 去 ${dest.name.zh}（约 ${o.seconds} 秒）`, en: `${o.line.name.en} · to ${dest.name.en} (~${o.seconds}s)` },
      next: `flow.ride.cc:${o.line.id}:${stationId}:${o.to}`,
    };
  });
  choices.push({ hotkey: String(choices.length + 1), label: { zh: '先不坐了', en: 'Not now' }, action: { type: 'end' } });
  playDialogue(defineNode({
    id: 'flow.cablecar', speaker: 'npc', npcName: gripman(), mood: 'happy',
    text: hookFill('cablecarStation', { station: station.name })
      ?? { zh: `叮叮！这里是 ${station.name.zh}。抓紧扶杆，想去哪儿？`, en: `Ding-ding! This is ${station.name.en}. Hold on tight, where to?` },
    choices,
  }));
}

/** Wait at `from` for a car of `line` toward `to`, then ride it (the car stops for you; the HUD shows the wait). */
export function rideCable(lineId: string, from: string, to: string) {
  const line = cableLine(lineId);
  const a = line?.stops.find(st => st.station === from), b = line?.stops.find(st => st.station === to);
  if (!line || !a || !b || a === b) { say(...NO_CAR); return; }
  const dir: 1 | -1 = b.at > a.at ? 1 : -1;
  const r = beginLineRide(lineId, from, to, dir, travelEpoch());
  if (!r) { say('叮当车还没开过来，稍等一下', 'The cable cars are not running here yet, try again in a moment'); return; }
  game.set({ move: { mode: 'transit', line: lineId, spot: 'rail' }, panel: { kind: null } });
  refreshLock();
  const eta = lineRideEta();
  flow.set({ ride: { stage: 'waiting', from, to, line: lineId, kind: 'cable-car', eta: eta ? Math.max(1, Math.round(eta)) : undefined } });
  const dest = transitStation(to);
  announce({ zh: `等叮当车：${lineName(line).zh} 开往 ${dest?.name.zh ?? ''}`, en: `Waiting for the ${line.name.en} to ${dest?.name.en ?? ''}` });
  seenInteract = input.interactCount;
}

/** Per frame while on a city line: H rings the gripman's bell; E mashes the turntable while you wait for a turning car. */
function stepCity(r: RideState, dt: number) {
  void dt;
  if (input.hornCount !== seenHorn) {
    seenHorn = input.hornCount;
    if (r.mode === 'follow') {
      // wave 4: on the sightseeing bus H is the stop bell — 下一站下车 (the bus makes its next stop the rider's; ding)
      if (r.kind === 'bus' && W4G) { W4G.requestNextStop(); return; }
      if (r.kind === 'streetcar') emit({ type: 'streetcar-bell' });
      if (r.kind === 'ferry') { emit({ type: 'transit', what: 'horn', line: r.line!, kind: 'ferry', strength: 1 }); return; }
      emit({ type: 'transit', what: 'bell', line: r.line!, kind: rideKind(r), strength: 1 });
    }
  }
  if (input.interactCount !== seenInteract) {
    seenInteract = input.interactCount;
    if (r.mode === 'wait') {
      const sys = activeCableSystem(), st = sys?.rideStatus();
      const car = st ? sys!.cars[st.car] : null;
      const tt = car && car.mode === 'turn' ? sys!.turntableOf(car) : null;
      if (tt && sys!.push(tt.id)) pushedAt = tt.id;
    }
  }
}

/** The ride's per-frame news: boarding, stops, the counted segment. */
function lineTick(r: RideState, tick: NonNullable<ReturnType<typeof stepRide>>) {
  const name = rideLineName(r);
  if (tick.boarded) {
    // (the wave-4 fleet emits its own board event, with the station and the direction)
    if (!w4Kind(r.line!)) emit({ type: 'transit', what: 'board', line: r.line!, kind: rideKind(r) });
    if (W4G && w4Kind(r.line!)) { const b = W4G.boardBubble(r); if (b) bubble(b, 3600); }
    else if (r.kind === 'ferry') bubble(hookText('ferryBoard') ?? { zh: '上船啦！上层甲板风最大，看海湾最清楚', en: 'All aboard! The top deck has the breeze and the best view of the Bay' }, 3200);
    else if (r.kind === 'streetcar') bubble(hookText('streetcarBoard') ?? { zh: '上车啦！F 线的老电车，一路开过整条 Market 街', en: 'All aboard! A vintage F-line car, all the way up Market Street' }, 3200);
    else bubble(hookText('cablecarBoard') ?? { zh: '上车啦！抓紧扶杆，叮当车要爬坡咯', en: 'All aboard! Hold the pole, up the hill we go' }, 3200);
    announce({ zh: `上车：${name.zh}`, en: `Aboard the ${name.en}` });
  }
  if (tick.count) countRide(r, tick.arrivedAt);
  if (tick.arrivedAt && !tick.done) {
    const st = stationOf(r, tick.arrivedAt);
    if (st) announce({ zh: `到站：${st.name.zh}`, en: `Stop: ${st.name.en}` });
  }
}

const rideKind = (r: RideState): TransitKind => r.kind ?? 'cable-car';
/** A city ride's line name: the cable-car line, or the F-line. */
function rideLineName(r: RideState): Bilingual {
  if (r.kind === 'ferry') return FERRY_NAME;
  if (W4G && w4Kind(r.line!)) return W4G.lineShortName(r.line!);
  return r.kind === 'streetcar' ? F_LINE : lineName(cableLine(r.line!));
}
/** A station of the ride's line (cable-car station, or F-line station). */
function stationOf(r: RideState, id: string): { name: Bilingual; x: number; z: number } | undefined {
  if (r.kind === 'ferry') { const t = ferryTerminal(id)?.terminal; return t ? { name: t.name, x: t.quay.x, z: t.quay.z } : undefined; }
  if (w4Kind(r.line!)) return W4G?.stationPoint(id) ?? undefined;
  return r.kind === 'streetcar' ? flineStation(id) : transitStation(id);
}

/** One real stop-to-stop segment on a city line: goal, save, the `transit` ride event (real: true), once per ride. */
function countRide(r: RideState, station?: string | null) {
  const line = r.line!;
  rides[line] = (rides[line] ?? 0) + 1;
  if (w4Kind(line)) {
    // wave 4: the sightseeing / metro goals are lane C's (they read this event: the stop reached, the direction)
    emit({ type: 'transit', what: 'ride', line, kind: rideKind(r), real: true, ...(station ? { station } : {}), ...(w4Kind(line) === 'light-rail' && r.dir ? { dir: r.dir } : {}) });
    noteRide(line);
    return;
  }
  emit({ type: 'transit', what: 'ride', line, kind: rideKind(r), real: true });
  completeGoal(r.kind === 'streetcar' ? 'streetcar' : r.kind === 'ferry' ? 'ferry' : 'cable-car');
  noteRide(line);
}

/** The ride whose 直接到站 waits under the veil for its destination to stream in (a second tap does not start another). */
let veiledRide: RideState | null = null;

/**
 * Leave a city line ride: at the stop (arrived) or anywhere (hop off, "skip to stop"). Steps off beside the car.
 * (verify M2) 直接到站 to a stop whose ground has not streamed in (or that lies far off) waits under the veil until that part
 * of the city is walkable, then puts the rider there; "到站" is only said once the rider stands at the stop.
 */
function leaveLineRide(r: RideState, finishing: boolean, veiled = false) {
  if (!veiled && veiledRide === r) return;
  const sys = rideSystemFor(r.line!);
  const st = sys?.rideStatus();
  const car = st && sys ? sys.cars[st.car] : null;
  const arrived = st?.phase === 'arrived';
  // "skip to stop" before the car got there (aboard, or still waiting for it): no car ride, just go (it never counts,
  // except a real leg of the loop / the Metro skipped aboard: skipCounts)
  const skip = finishing && !arrived;
  const pose = car?.pose;
  // wave 4 (the loop, the N / M): under ground only at a station's kiosk; 直接到站 lands at the destination's pole /
  // kiosk; on the surface off the kerb side of the bus / train
  const w4 = W4G && w4Kind(r.line!) ? W4G.leaveSpot(r, W4G.w4Status(r), finishing) : null;
  // where a skip lands: the destination's pole / kiosk (wave 4), quay (ferry), a cable-car station's kerb spot beside the
  // track (never on the rails: the station point is the track), the F-line station
  const cableTo = skip && !w4 && rideKind(r) === 'cable-car' ? transitStation(r.to) : undefined;
  const skipTo = skip ? (w4 ? w4.spot : cableTo ? W4G?.stationBoardSpot(cableTo) ?? cableTo : stationOf(r, r.to) ?? null) : null;
  // a long 直接到站, or one to a stop the streamer has not brought in: the city streams in under a veil first (plan §3.4)
  if (skipTo && !veiled && W4G && W4G.skipNeedsVeil(skipTo)) {
    const dest = w4?.station ?? r.to;
    veiledRide = r;
    W4G.veiledSkip(skipTo, stationOf(r, dest)?.name ?? null, () => {
      if (veiledRide === r) veiledRide = null;
      if (currentRide() === r) leaveLineRide(r, true, true);
    });
    return;
  }
  if (veiledRide === r) veiledRide = null;
  const side = w4 ? w4.side : platformRider.platform === r.line && platformRider.x < 0 ? -1 : 1;
  const skipCounts = !!(w4 && skip && r.mode === 'follow' && !r.counted && W4G!.skipCounts(r, rideMinOdometer(r)));
  releaseStop();
  sys?.cancel();
  endRide();
  game.set({ riding: null });
  flow.set({ ride: null });
  let spot: { x: number; z: number } | null = null;
  if (w4?.spot) {
    spot = nearestWalkable(w4.spot, 12) ?? w4.spot;
  } else if (r.kind === 'ferry') {
    // off a boat only onto a quay: the terminal it lies at, else (hopping off at sea) the next one it would reach;
    // 直接到站 (aboard or still waiting): the destination's quay.
    // (review) Still waiting on the quay: stay there (the boat may lie at the other terminal, or be out on the Bay).
    // E2's hop-off (actors/moveSystem 'transit-alight') keeps the spot F puts the rider on here.
    const quay = finishing ? stationOf(r, r.to) : r.mode === 'follow' ? stationOf(r, st?.station ?? r.to) : undefined;
    // (E2 w3 review 1: the quay's ground may not be streamed in yet: stand on the quay point itself then)
    if (quay) spot = nearestWalkable({ x: quay.x, z: quay.z }, 16) ?? { x: quay.x, z: quay.z };
  } else if (skipTo) {
    // (verify M2) the station's ground is in (the veil above waited for it); without the lazy module to veil: the point
    spot = nearestWalkable(skipTo, 16) ?? { x: skipTo.x, z: skipTo.z };
  } else if (pose && r.mode === 'follow') {
    // off the running board on the rider's side, onto the street
    const out = toWorld(pose, side * 2.3, 0, 0.8);
    const other = toWorld(pose, -side * 2.3, 0, 0.8);
    spot = nearestWalkable(canStand(out.x, out.z, 0.45) ? out : canStand(other.x, other.z, 0.45) ? other : { x: pose.x, z: pose.z }, 12);
  }
  if (spot) {
    teleportPlayer(spot);
    runtime.guide.x = spot.x + 1.1; runtime.guide.z = spot.z + 0.7;
  }
  if (r.kind === 'streetcar') emit({ type: 'streetcar-bell' });
  if (!w4) emit({ type: 'transit', what: 'bell', line: r.line!, kind: rideKind(r), strength: 0.8 });
  const dest = stationOf(r, w4?.station && finishing ? w4.station : r.to);
  // (verify M2) only once the rider stands there: the car brought them, or they were put at the stop
  if (finishing && dest && (arrived || spot)) say(`到站：${dest.name.zh}`, `Arrived: ${dest.name.en}`, 'success');
  if (w4) {
    if (skipCounts) {
      r.counted = true;
      countRide(r, r.to);
      // lane C's sightseeing goal counts the loop stops the veil skipped (they raised no `arrive`)
      if (w4Kind(r.line!) === 'bus') W4G!.noteLoopSkip(st?.lastStation ?? r.from, r.to);
    }
    const at = w4.station ?? (finishing ? r.to : null);
    const tipped = (r.counted || finishing) && W4G!.sayHopOffTip(at);
    if (!tipped && !r.counted && r.mode === 'follow') bubble({ zh: '坐过一站再下车，才算坐过哦', en: 'Ride at least one stop and it counts as a ride' }, 3000);
  } else if (r.kind === 'ferry') {
    if (r.counted && !skip) bubble(hookText('ferryOff') ?? { zh: '到岸啦！海风吹得真舒服', en: 'Ashore! What a breeze out there' }, 2800);
  } else if (r.kind === 'streetcar') {
    if (r.counted && !skip) bubble(hookText('streetcarOff') ?? { zh: '叮叮！F 线电车，下次再坐', en: 'Ding ding! Let’s take the F-line again' }, 2800);
    else if (r.mode === 'follow') bubble({ zh: '坐到下一站再下车，才算坐过 F 线电车哦', en: 'Ride to the next stop and it counts as a streetcar ride' }, 3200);
  } else if (r.counted && !skip) bubble(hookText('cablecarOff') ?? { zh: '叮叮！下次还坐叮当车', en: 'Ding-ding! Let’s ride again soon' }, 2800);
  else if (r.mode === 'follow') bubble(hookText('cablecarCount') ?? { zh: '从一站坐到下一站，才算坐过叮当车哦', en: 'Ride from one stop to the next and it counts as a cable-car ride' }, 3200);
  refreshLock();
}

/** E on foot at a turntable while a car turns: help push it round (+14°/s a press). */
export function pushTurntable(id: string) {
  const sys = activeCableSystem();
  if (!sys?.push(id)) return;
  pushedAt = id;
  emit({ type: 'emote', who: 'player', emote: 'pickup' });
}

/** 4 Hz: offer the push prompt at turntables turning near the player; cheer when a pushed car has turned. */
function pollTurntables(dt: number) {
  if ((pollT -= dt) > 0) return;
  pollT = 0.25;
  const fl = activeStreetcarSystem(), fe = activeFerrySystem(), lf = activeLineFleet();
  if (fl !== seenFLine || fe !== seenFerry || lf !== seenFleet) { seenFLine = fl; seenFerry = fe; seenFleet = lf; invalidateInteractables(); }
  // (verify D3, lazy chunk) BAYBAY's step-aside ask; a station prompt near the player that can now stand at its kerb
  if (W4G?.pollCity(0.25)) invalidateInteractables();
  const sys = activeCableSystem(), data = transitData();
  if (!sys || !data) { if (turningNear.length) { turningNear = []; invalidateInteractables(); } return; }
  const p = runtime.player;
  const now = data.turntables.filter(tt => sys.turningAt(tt.id) && Math.hypot(tt.x - p.x, tt.z - p.z) < 40).map(tt => tt.id);
  if (pushedAt && !sys.turningAt(pushedAt)) {
    pushedAt = null;
    bubble(hookText('turntableTurned') ?? { zh: '转过来啦！我们是全城最棒的推车手', en: 'Round she goes! Best pushers in the whole city' }, 3200);
    emit({ type: 'emote', who: 'baybay', emote: 'clap' });
  }
  if (now.join() !== turningNear.join()) { turningNear = now; invalidateInteractables(); }
}

// --- the ferry (lane F, wave 3: F8) ------------------------------------------------------------------------

const FERRY_NAME: Bilingual = { zh: '渡轮', en: 'Ferry' };
const FERRY_LINE = 'ferry';

/** Seconds from ferry terminal `from` to `to` (cruising at ≈ 7 u/s on average, berthing included). */
export function ferryRideSeconds(from: string, to: string): number {
  const sys = activeFerrySystem() as unknown as { line?: { stops: { terminal: string; u: number }[]; length: number } } | null;
  const line = sys?.line;
  const a = line?.stops.find(s => s.terminal === from), b = line?.stops.find(s => s.terminal === to);
  if (!line || !a || !b) return 0;
  return ((((b.u - a.u) % line.length) + line.length) % line.length) / 7 + 8;
}

/** E at a ferry terminal (city mode, once the ferry runs): the deckhand asks where to (the time counts the wait for the boat). */
export function boardFerry(stationId: string) {
  const t = ferryTerminal(stationId);
  if (!t || !activeFerrySystem()) { say('渡轮还没来，稍等一下', 'The ferry is not running yet, try again in a moment'); return; }
  const others = t.route.terminals.filter(x => x.id !== stationId);
  const wait = Math.round(W4G?.ferryWaitSeconds(stationId) ?? 0);
  const choices: NonNullable<DialogueNode['choices']> = others.map((o, i) => {
    const secs = Math.round(ferryRideSeconds(stationId, o.id)) + wait;
    const label: Bilingual = wait >= 10
      ? { zh: `去${o.name.zh}（约 ${secs} 秒，船约 ${wait} 秒后到）`, en: `To ${o.name.en} (~${secs}s · boat in ~${wait}s)` }
      : { zh: `去${o.name.zh}（约 ${secs} 秒）`, en: `To ${o.name.en} (~${secs}s)` };
    return { hotkey: String(i + 1), label, next: `flow.ride.fe:${stationId}:${o.id}` };
  });
  choices.push({ hotkey: String(choices.length + 1), label: { zh: '先不坐了', en: 'Not now' }, action: { type: 'end' } });
  const deckhand = npcLine('deckhand').name ?? { zh: '水手', en: 'Deckhand' };
  playDialogue(defineNode({
    id: 'flow.ferry', speaker: 'npc', npcName: deckhand, mood: 'happy',
    text: { zh: `嘟——这里是${t.terminal.name.zh}。上层甲板是露天的，想去哪儿？`, en: `Toot! This is ${t.terminal.name.en}. The top deck is open air. Where to?` },
    choices,
  }));
}

/** Wait at ferry terminal `from` for the boat to `to`, then ride it (you stand on the open sun deck). */
export function rideFerry(from: string, to: string) {
  if (!ferryTerminal(from) || !ferryTerminal(to) || from === to) { say('这里没有渡轮', 'No ferry from here'); return; }
  const r = beginLineRide(FERRY_LINE, from, to, 1, travelEpoch(), 'ferry');
  if (!r) { say('渡轮还没来，稍等一下', 'The ferry is not running yet, try again in a moment'); return; }
  game.set({ move: { mode: 'transit', line: FERRY_LINE, spot: 'deck' }, panel: { kind: null } });
  refreshLock();
  const eta = lineRideEta();
  flow.set({ ride: { stage: 'waiting', from, to, line: FERRY_LINE, kind: 'ferry', eta: eta ? Math.max(1, Math.round(eta)) : undefined } });
  const dest = ferryTerminal(to)?.terminal;
  announce({ zh: `等渡轮：开往${dest?.name.zh ?? ''}`, en: `Waiting for the ferry to ${dest?.name.en ?? ''}` });
  seenInteract = input.interactCount;
}

/** The ferry terminals as interactables (the running routes' quays). */
function ferryInteractables(): Interactable[] {
  if (!activeFerrySystem()) return [];
  const out: Interactable[] = [];
  for (const route of FERRY_ROUTES) {
    if (!route.running) continue;
    for (const t of route.terminals) {
      if (out.some(o => o.refId === t.id)) continue;
      out.push({ id: `transit-${t.id}`, source: 'transit', action: 'streetcar', verb: { zh: '坐渡轮', en: 'Take the ferry' }, name: t.name, x: t.quay.x, z: t.quay.z, radius: 6, refId: t.id });
    }
  }
  return out;
}

// --- city F-line to the Castro (lane F, wave 3: F7) -------------------------------------------------------

const F_LINE: Bilingual = { zh: 'F 线电车', en: 'F-line' };
/** Destinations offered at an F-line station (besides both termini): the hero stops and a few Market highlights. */
const F_HIGHLIGHTS = ['ferry', 'f-market-stockton', 'f-market-van-ness', 'f-market-church', 'green', 'bay'];

/** An F-line station (city mode, once the line runs), by id. */
export function flineStation(id: string): FLineStation | undefined {
  return activeStreetcarSystem()?.line.stations.find(st => st.id === id);
}

/** Seconds a ride on the city F-line from `from` to `to` takes (motion at ≈ 10 u/s, the stops it makes on the way). */
export function flineRideSeconds(from: string, to: string): number {
  const sys = activeStreetcarSystem();
  const legs = sys?.legsFor(from, to);
  if (!sys || !legs) return 0;
  const L = sys.line, u0 = L.stops[legs.board].u;
  let stopped = 0;
  for (const st of L.stops) {
    const d = ((st.u - u0) % L.length + L.length) % L.length;
    if (st.dwell && d > 0.5 && d < legs.distance - 0.5) stopped += st.wait + 4;
  }
  return legs.distance / 10 + stopped + 4;
}

/** E at an F-line station (or a hero stop in city mode): the motorman asks where to. */
export function boardFLine(stationId: string) {
  const sys = activeStreetcarSystem(), here = flineStation(stationId);
  if (!sys || !here) { boardStreetcar(stationId); return; }
  const termini = sys.line.stations.filter(st => st.terminus && st.id !== stationId).map(st => st.id);
  const others = F_HIGHLIGHTS.filter(id => id !== stationId && !termini.includes(id) && flineStation(id))
    .sort((a, b) => flineRideSeconds(stationId, a) - flineRideSeconds(stationId, b)).slice(0, 4);
  const dests = [...termini, ...others].sort((a, b) => flineRideSeconds(stationId, a) - flineRideSeconds(stationId, b));
  const choices: NonNullable<DialogueNode['choices']> = dests.map((id, i) => {
    const st = flineStation(id)!, secs = Math.round(flineRideSeconds(stationId, id));
    return { hotkey: String(i + 1), label: { zh: `去${st.name.zh}（约 ${secs} 秒）`, en: `To ${st.name.en} (~${secs}s)` }, next: `flow.ride.fl:${stationId}:${id}` };
  });
  choices.push({ hotkey: String(choices.length + 1), label: { zh: '先不坐了', en: 'Not now' }, action: { type: 'end' } });
  const operator = npcLine('streetcar').name ?? { zh: '电车司机', en: 'Streetcar operator' };
  playDialogue(defineNode({
    id: 'flow.fline', speaker: 'npc', npcName: operator, mood: 'happy',
    text: { zh: `叮叮！这里是${here.name.zh}。F 线一路开到卡斯特罗，想坐到哪一站？`, en: `Ding ding! This is ${here.name.en}. The F-line runs all the way to the Castro. Where to?` },
    choices,
  }));
}

/** Wait at `from` for an F-line car toward `to`, then ride it (the car stops for you; the HUD shows the wait). */
export function rideFLine(from: string, to: string) {
  if (!flineStation(from) || !flineStation(to) || from === to) { say('这一站暂时没有电车', 'No streetcar at this stop right now'); return; }
  const r = beginLineRide(FLINE, from, to, 1, travelEpoch(), 'streetcar');
  if (!r) { say('电车还没开过来，稍等一下', 'The streetcars are not running here yet, try again in a moment'); return; }
  game.set({ move: { mode: 'transit', line: FLINE, spot: 'rail' }, panel: { kind: null } });
  refreshLock();
  emit({ type: 'streetcar-bell' });
  const eta = lineRideEta();
  flow.set({ ride: { stage: 'waiting', from, to, line: FLINE, kind: 'streetcar', eta: eta ? Math.max(1, Math.round(eta)) : undefined } });
  const dest = flineStation(to);
  announce({ zh: `等电车：F 线开往${dest?.name.zh ?? ''}`, en: `Waiting for the F-line to ${dest?.name.en ?? ''}` });
  seenInteract = input.interactCount;
}

/** The F-line's Market Street stations and the Castro terminal (the hero stops keep their district interactables). */
function flineInteractables(): Interactable[] {
  const sys = activeStreetcarSystem();
  if (!sys) return [];
  return sys.line.stations.filter(st => !st.hero).map(st => ({
    id: `transit-${st.id}`, source: 'transit' as const, action: 'streetcar' as const,
    verb: { zh: '坐 F 线电车', en: 'Ride the F-line' },
    name: st.name, x: st.x, z: st.z, radius: STATION_RADIUS, refId: st.id,
  }));
}

/** City cable-car stations (and the push prompt at a turning turntable) as interactables. District: none. */
export function transitInteractables(): Interactable[] {
  const data = transitData();
  if (!isCity()) return [];
  const out: Interactable[] = [...flineInteractables(), ...ferryInteractables(), ...(W4G?.lineInteractables() ?? [])];
  if (!data) return out;
  out.push(...data.stations.map(st => {
    const at = W4G?.stationBoardSpot(st) ?? st;
    return {
      id: `transit-${st.id}`, source: 'transit' as const, action: 'streetcar' as const,
      verb: { zh: '坐叮当车', en: 'Ride the cable car' },
      name: st.name, x: at.x, z: at.z, radius: STATION_RADIUS, refId: st.id,
    };
  }));
  for (const id of turningNear) {
    const tt = data.turntables.find(t => t.id === id);
    if (tt) out.push({ id: `${PUSH_PREFIX}${tt.id}`, source: 'transit', action: 'streetcar', verb: { zh: '帮忙推', en: 'Help push' }, name: tt.name, x: tt.x, z: tt.z, radius: PUSH_RADIUS, refId: tt.id });
  }
  return out;
}

/** Counted rides per line id this visit (G1's save v2 `rides`). */
export function rideLog(): Record<string, number> { return { ...rides }; }

/** Once per page (flow.initFlowListeners): city mode loads transit.json and registers the stations. Returns a disposer. */
export function initTransit(): () => void {
  if (!isCity()) return () => {};
  const offSource = registerInteractables('transit', transitInteractables);
  const offData = onTransitData(() => invalidateInteractables());
  void loadTransit();
  // wave 4 (lane T): the loop / Metro game code is its own chunk (the main graph keeps the stubs below)
  let offW4 = () => {};
  let disposed = false;
  void loadLineRides().then(m => { if (!disposed) offW4 = m.initLineRides(); }, () => {});
  let offDev = () => {};
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    const api = {
      data: () => transitData(), system: () => activeCableSystem(), rideLog, board: boardCable, ride: rideCable, push: pushTurntable,
      /** the city F-line: its system, E at a station, a ride between two stations */
      fline: () => activeStreetcarSystem(), boardF: boardFLine, rideF: rideFLine,
      /** the ferry: its system, E at a terminal, a ride between terminals */
      ferry: () => activeFerrySystem(), boardFerry, rideFerry,
      /** wave 4 (lane T): the loop / Metro fleet, E at a pole / kiosk, a ride, 下一站下车, the subway view */
      fleet: () => activeLineFleet(), boardLine, rideLine: (line: string, from: string, to: string) => W4G?.rideLine(line, from, to),
      nextStop: requestNextStop, subway: subwayView, stationRides, nextArrival, stationPoint: (id: string) => W4G?.stationPoint(id) ?? null,
      finish: finishRide, hopOff: hopOffRide, cancel: cancelRide,
      me: () => ({ x: +runtime.player.x.toFixed(1), z: +runtime.player.z.toFixed(1), move: game.get().move, ride: flow.get().ride, label: flow.get().ride ? rideLabel(flow.get().ride!) : null }),
      /** QA: stand at a station (x, z); where its prompt stands (beside the track once the ground there is in) */
      station: (id: string) => transitStation(id),
      kerb: (id: string, fresh = false) => { const st = transitStation(id); return st && W4G ? W4G.stationBoardSpot(st, fresh) : null; },
      stopPos: (line: string, station: string, dir: 1 | -1) => { const l = cableLine(line); const st = l?.stops.find(s => s.station === station); return st ? stopPos(st, dir) : null; },
    };
    const put = () => { if (w.__opusBay && w.__opusBay.transit !== api) w.__opusBay.transit = api; else if (!w.__opusBay) w.__opusBay = { transit: api }; };
    put();
    const id = window.setInterval(put, 500);
    offDev = () => window.clearInterval(id);
  }
  return () => { disposed = true; offSource(); offData(); offDev(); offW4(); };
}

// --- wave 4 (lane T): the sightseeing loop and the Muni Metro N / M ---------------------------------------------------

type LineRidesModule = typeof import('./lineRides');
let W4G: LineRidesModule | null = null;
let w4Loading: Promise<LineRidesModule> | null = null;
const W4_NOT_READY: [string, string] = ['车还没开过来，稍等一下', 'Not running here yet, try again in a moment'];

/** The lazy wave-4 game module (game/lineRides.ts), fetched once in city mode by initTransit. */
export function loadLineRides(): Promise<LineRidesModule> {
  w4Loading ??= import('./lineRides').then(m => { W4G = m; invalidateInteractables(); return m; }, (e: unknown) => { w4Loading = null; throw e; });
  return w4Loading;
}
/** The wave-4 game module once loaded (null in district mode / before initTransit's fetch lands). */
export const lineRides = (): LineRidesModule | null => W4G;

/**
 * Board a sightseeing-loop / Metro line at `station` (E at its pole / kiosk; lane C's trip and tour legs pass `to` for
 * the pre-filled "上车 · 坐到 …" row). Lanes C / P call this; it waits for the lazy module when needed.
 */
export function boardLine(station: string, o: { to?: string; line?: string } = {}) {
  if (W4G) { W4G.boardLine(station, o); return; }
  void loadLineRides().then(m => m.boardLine(station, o), () => say(...W4_NOT_READY));
}

/** Lane P's StationActions: the rides offered at a wave-4 station (next stops each way, ★ stops, termini, 坐一圈). */
export function stationRides(station: string): ReturnType<LineRidesModule['stationRides']> { return W4G?.stationRides(station) ?? []; }

/** Seconds until the next bus / train stops at `station` (on `line`, toward `dir`), or null. */
export function nextArrival(station: string, line?: string, dir?: 1 | -1): number | null { return W4G?.nextArrival(station, line, dir) ?? null; }

/** 下一站下车 on a bus / Metro ride (the RideBanner button; lane G). Returns the stop the ride now ends at, or null. */
export function requestNextStop(): string | null { return W4G?.requestNextStop() ?? null; }

/** The subway overlay's state (ui/LineRideLayer.tsx), null when not underground on a Metro ride. */
export function subwayView(): ReturnType<LineRidesModule['subwayView']> { return W4G?.subwayView() ?? null; }

/** 在这站下车 in the subway overlay: off at the station the train stands at (placed at its kiosk). */
export function alightHere() {
  const r = currentRide();
  if (isLineRide(r) && W4G?.w4Status(r)?.station) leaveLineRide(r, true);
}

let lineMapOpener: ((line: string) => void) | null = null;
/** Lane P: open the map on its 线路 tab with `line` highlighted (the boarding dialogue's 看线路图). */
export function setLineMapOpener(fn: ((line: string) => void) | null) { lineMapOpener = fn; }
function openLineMap(line: string) {
  if (lineMapOpener) lineMapOpener(line);
  else openPanel('map');
}
