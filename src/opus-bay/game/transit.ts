import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { canStand, nearestWalkable } from '../core/terrain';
import type { Bilingual, DialogueNode } from '../core/types';
import { DISTRICT } from '../data/district';
import { POIS } from '../data/pois';
import { hookText, nodeText, npcLine } from './content';
import { announce, bubble, completeGoal, defineNode, playDialogue, refreshLock, say, teleportPlayer } from './flow';
import { flow, type FlowRide } from './flowStore';
import { interactableById, type Interactable } from './interactables';
import { beginRide, currentRide, endRide, nearestStopId, rideSeconds, sortedStops, stepRide } from './ride';

/**
 * Transit flow (lane F owns this file from wave 2; the day-0 commit moved the streetcar section of game/flow.ts here
 * unchanged, and flow.ts re-exports boardStreetcar / cancelRide / hopOffRide / finishRide so old imports keep working).
 *
 * Contract (docs/opus-bay/sf-w2-contracts.md §transit):
 *   boardFrom(it)            flow.performInteraction's 'streetcar' action (any station interactable) lands here
 *   openRideNode(rest)       dialogue nodes `flow.ride.<rest>` (today `<from>><to>`) land here
 *   stepTransit(dt)          per frame, called by game/Systems.tsx Ticker at the old stepRide spot
 *   rideLabel(ride)          what the HUD RideBanner shows (ui/Hud.tsx)
 *   requestHopOff()          "get off here" (today = hopOffRide; F adds the 1.2 s brake, E2 the camera side)
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
  endRide();
  game.set({ riding: null });
  flow.set({ ride: null });
  refreshLock();
}

/**
 * F17 · "提前下车": get off right here — beside the car on the nearest walkable spot, not teleported to the
 * destination. (It still counts as a ride once the car has actually moved you along.)
 */
export function hopOffRide() {
  const r = currentRide();
  if (!r) { cancelRide(); return; }
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

/** flow.performInteraction → a station interactable (action 'streetcar', source 'streetcar' or 'transit'). */
export function boardFrom(it: Interactable) {
  boardStreetcar(it.refId ?? nearestStopId(it) ?? '');
}

/** flow's dialogue runner hands every `flow.ride.<rest>` node here (today `<fromStop>><toStop>`). */
export function openRideNode(rest: string) {
  const [from, to] = rest.split('>');
  rideTo(from, to);
}

/** Per frame (game/Systems.tsx Ticker, right after stepCinema): advance the ride and keep the HUD in step. */
export function stepTransit(dt: number) {
  const ride = stepRide(dt);
  if (!ride) return;
  const current = flow.get().ride;
  if (current && (current.stage !== ride.stage || current.eta !== ride.eta)) flow.set({ ride: { ...current, stage: ride.stage, eta: ride.eta } });
  if (ride.done) finishRide();
}

/** "Get off here" (HUD button via actors/moveApi, Space / B in the car). Day 0: the old instant hop-off. */
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

/** What the HUD RideBanner shows for a ride (day 0: exactly the old F-line strings). */
export function rideLabel(ride: FlowRide): RideLabel {
  const to = DISTRICT.streetcar.stops.find(stop => stop.id === ride.to);
  return {
    icon: 'tram',
    waiting: { zh: `等电车进站…${ride.eta ? `约 ${ride.eta} 秒` : ''}`, en: `Waiting for the streetcar…${ride.eta ? ` ~${ride.eta}s` : ''}` },
    lineTo: { zh: 'F 线电车 · 开往', en: 'F-line · to' },
    dest: to ? to.name : null,
  };
}

/** City transit stations as interactables (id `transit-<stationId>`, source 'transit', action 'streetcar'). Day 0: none. */
export function transitInteractables(): Interactable[] { return []; }

/** Counted rides per line id this visit (G1's save v2 `rides`). Day 0: empty. */
export function rideLog(): Record<string, number> { return {}; }

/** Once per page (flow.initFlowListeners): register stations, event listeners, DEV hooks. Returns a disposer. */
export function initTransit(): () => void { return () => {}; }
