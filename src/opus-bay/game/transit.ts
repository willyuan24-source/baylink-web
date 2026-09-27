import { platformStop, releasePlatformStop, rider as platformRider, toWorld } from '../actors/platform';
import { emit } from '../core/events';
import { input } from '../core/input';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { canStand, nearestWalkable } from '../core/terrain';
import type { Bilingual, DialogueNode } from '../core/types';
import { DISTRICT } from '../data/district';
import { POIS } from '../data/pois';
import { noteRide } from '../data/save';
import { CABLE, type CableLine, type TransitData, activeCableSystem, cableLine, loadTransit, onTransitData, stopPos, transitData, transitStation } from '../data/transit';
import { hookText, nodeText, npcLine } from './content';
import { travelEpoch } from './fastTravel';
import { announce, bubble, completeGoal, defineNode, playDialogue, refreshLock, say, teleportPlayer } from './flow';
import { flow, type FlowRide } from './flowStore';
import { interactableById, invalidateInteractables, registerInteractables, type Interactable } from './interactables';
import { type RideState, beginLineRide, beginRide, currentRide, endRide, lineRideEta, lineRideTurning, nearestStopId, rideSeconds, sortedStops, stepRide } from './ride';

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
  if (currentRide()?.line) activeCableSystem()?.cancel();
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
  if (r.line) { leaveLineRide(r, false); return; }
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
  if (r?.line) { leaveLineRide(r, true); return; }
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
  if (it.source === 'transit' && it.refId && transitStation(it.refId)) { boardCable(it.refId); return; }
  boardStreetcar(it.refId ?? nearestStopId(it) ?? '');
}

/** flow's dialogue runner hands every `flow.ride.<rest>` node here: `<fromStop>><toStop>` (F-line) or `cc:<line>:<from>:<to>`. */
export function openRideNode(rest: string) {
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
  if (r?.line) stepCity(r, dt);
  pollTurntables(dt);
  if (!ride) return;
  if (r?.line && ride.lost) { cancelRide(); return; }
  if (r?.line) lineTick(r, ride);
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
  /** which glyph the banner shows */
  icon: 'tram' | 'cable-car' | 'ferry';
  /** stage 'waiting' text */
  waiting: Bilingual;
  /** "F 线电车 · 开往" — shown before the destination name */
  lineTo: Bilingual;
  /** destination stop / station name */
  dest: Bilingual | null;
}

/** What the HUD RideBanner shows for a ride (the hero F-line: exactly the old strings). */
export function rideLabel(ride: FlowRide): RideLabel {
  if (ride.kind === 'cable-car' && ride.line) {
    const line = cableLine(ride.line);
    const dest = transitStation(ride.to);
    const turning = ride.stage === 'waiting' && lineRideTurning();
    const eta = ride.eta ? { zh: `约 ${ride.eta} 秒`, en: ` ~${ride.eta}s` } : { zh: '', en: '' };
    return {
      icon: 'cable-car',
      waiting: turning
        ? { zh: `缆车正在转车台上掉头…按 E 帮忙推！${eta.zh}`, en: `The cable car is turning on the turntable… press E to help push!${eta.en}` }
        : { zh: `等缆车进站…${eta.zh}`, en: `Waiting for the cable car…${eta.en}` },
      lineTo: { zh: `${line?.name.zh ?? '缆车'} · 开往`, en: `${line?.name.en ?? 'Cable car'} · to` },
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
const STATION_RADIUS = 4.2;
const PUSH_RADIUS = 7;
const GRIPMAN: Bilingual = { zh: '缆车司机', en: 'Gripman' };
const rides: Record<string, number> = {};
let seenHorn = input.hornCount;
let seenInteract = input.interactCount;
let turningNear: string[] = [];
let pushedAt: string | null = null;
let pollT = 0;

const isCity = () => game.get().worldMode === 'city';
const lineName = (line: CableLine | undefined): Bilingual => line?.name ?? { zh: '缆车', en: 'Cable car' };

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
  if (!data || !station) { say('这一站暂时没有缆车', 'No cable car at this stop right now'); return; }
  const options = cableChoices(data, stationId);
  if (!options.length) { say('这一站暂时没有缆车', 'No cable car at this stop right now'); return; }
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
    id: 'flow.cablecar', speaker: 'npc', npcName: GRIPMAN, mood: 'happy',
    text: { zh: `叮叮！这里是 ${station.name.zh}。抓紧扶杆，想去哪儿？`, en: `Ding-ding! This is ${station.name.en}. Hold on tight, where to?` },
    choices,
  }));
}

/** Wait at `from` for a car of `line` toward `to`, then ride it (the car stops for you; the HUD shows the wait). */
export function rideCable(lineId: string, from: string, to: string) {
  const line = cableLine(lineId);
  const a = line?.stops.find(st => st.station === from), b = line?.stops.find(st => st.station === to);
  if (!line || !a || !b || a === b) { say('这一站暂时没有缆车', 'No cable car at this stop right now'); return; }
  const dir: 1 | -1 = b.at > a.at ? 1 : -1;
  const r = beginLineRide(lineId, from, to, dir, travelEpoch());
  if (!r) { say('缆车还没开过来，稍等一下', 'The cable cars are not running here yet, try again in a moment'); return; }
  game.set({ move: { mode: 'transit', line: lineId, spot: 'rail' }, panel: { kind: null } });
  refreshLock();
  const eta = lineRideEta();
  flow.set({ ride: { stage: 'waiting', from, to, line: lineId, kind: 'cable-car', eta: eta ? Math.max(1, Math.round(eta)) : undefined } });
  const dest = transitStation(to);
  announce({ zh: `等缆车：${line.name.zh} 开往 ${dest?.name.zh ?? ''}`, en: `Waiting for the ${line.name.en} to ${dest?.name.en ?? ''}` });
  seenInteract = input.interactCount;
}

/** Per frame while on a city line: H rings the gripman's bell; E mashes the turntable while you wait for a turning car. */
function stepCity(r: RideState, dt: number) {
  void dt;
  if (input.hornCount !== seenHorn) {
    seenHorn = input.hornCount;
    if (r.mode === 'follow') emit({ type: 'transit', what: 'bell', line: r.line!, kind: 'cable-car', strength: 1 });
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
  const line = cableLine(r.line!);
  if (tick.boarded) {
    emit({ type: 'transit', what: 'board', line: r.line!, kind: 'cable-car' });
    bubble({ zh: '上车啦！抓紧扶杆，缆车要爬坡咯', en: 'All aboard! Hold the pole, up the hill we go' }, 3200);
    announce({ zh: `上车：${lineName(line).zh}`, en: `Aboard the ${lineName(line).en}` });
  }
  if (tick.count) countRide(r);
  if (tick.arrivedAt && !tick.done) {
    const st = transitStation(tick.arrivedAt);
    if (st) announce({ zh: `到站：${st.name.zh}`, en: `Stop: ${st.name.en}` });
  }
}

/** One real stop-to-stop segment on a city line: goal, save, the `transit` ride event (real: true), once per ride. */
function countRide(r: RideState) {
  const line = r.line!;
  rides[line] = (rides[line] ?? 0) + 1;
  emit({ type: 'transit', what: 'ride', line, kind: 'cable-car', real: true });
  completeGoal('cable-car');
  noteRide(line);
}

/** Leave a city line ride: at the stop (arrived) or anywhere (hop off, "skip to stop"). Steps off beside the car. */
function leaveLineRide(r: RideState, finishing: boolean) {
  const sys = activeCableSystem();
  const st = sys?.rideStatus();
  const car = st && sys ? sys.cars[st.car] : null;
  const arrived = st?.phase === 'arrived';
  // "skip to stop" before the car got there: no car ride, just go (it never counts: not a real segment)
  const skip = finishing && !arrived && r.mode === 'follow';
  const pose = car?.pose;
  const side = platformRider.platform === r.line && platformRider.x < 0 ? -1 : 1;
  releaseStop();
  sys?.cancel();
  endRide();
  game.set({ riding: null });
  flow.set({ ride: null });
  let spot: { x: number; z: number } | null = null;
  if (skip) {
    const dest = transitStation(r.to);
    if (dest) spot = nearestWalkable({ x: dest.x, z: dest.z }, 16);
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
  emit({ type: 'transit', what: 'bell', line: r.line!, kind: 'cable-car', strength: 0.8 });
  const dest = transitStation(r.to);
  if (finishing && dest) say(`到站：${dest.name.zh}`, `Arrived: ${dest.name.en}`, 'success');
  if (r.counted && !skip) bubble(hookText('cablecarOff') ?? { zh: '叮叮！下次还坐缆车', en: 'Ding-ding! Let’s ride again soon' }, 2800);
  else if (r.mode === 'follow') bubble({ zh: '从一站坐到下一站，才算坐过缆车哦', en: 'Ride from one stop to the next and it counts as a cable-car ride' }, 3200);
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
  const sys = activeCableSystem(), data = transitData();
  if (!sys || !data) { if (turningNear.length) { turningNear = []; invalidateInteractables(); } return; }
  const p = runtime.player;
  const now = data.turntables.filter(tt => sys.turningAt(tt.id) && Math.hypot(tt.x - p.x, tt.z - p.z) < 40).map(tt => tt.id);
  if (pushedAt && !sys.turningAt(pushedAt)) {
    pushedAt = null;
    bubble({ zh: '转过来啦！我们是全城最棒的推车手', en: 'Round she goes! Best pushers in the whole city' }, 3200);
    emit({ type: 'emote', who: 'baybay', emote: 'clap' });
  }
  if (now.join() !== turningNear.join()) { turningNear = now; invalidateInteractables(); }
}

/** City cable-car stations (and the push prompt at a turning turntable) as interactables. District: none. */
export function transitInteractables(): Interactable[] {
  const data = transitData();
  if (!isCity() || !data) return [];
  const out: Interactable[] = data.stations.map(st => ({
    id: `transit-${st.id}`, source: 'transit' as const, action: 'streetcar' as const,
    verb: { zh: '坐缆车', en: 'Ride the cable car' },
    name: st.name, x: st.x, z: st.z, radius: STATION_RADIUS, refId: st.id,
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
  let offDev = () => {};
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    const api = {
      data: () => transitData(), system: () => activeCableSystem(), rideLog, board: boardCable, ride: rideCable, push: pushTurntable,
      /** QA: stand at a station (x, z) */
      station: (id: string) => transitStation(id),
      stopPos: (line: string, station: string, dir: 1 | -1) => { const l = cableLine(line); const st = l?.stops.find(s => s.station === station); return st ? stopPos(st, dir) : null; },
    };
    const put = () => { if (w.__opusBay && w.__opusBay.transit !== api) w.__opusBay.transit = api; else if (!w.__opusBay) w.__opusBay = { transit: api }; };
    put();
    const id = window.setInterval(put, 500);
    offDev = () => window.clearInterval(id);
  }
  return () => { offSource(); offData(); offDev(); };
}
