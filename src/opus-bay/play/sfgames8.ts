import { createElement, lazy, Suspense } from 'react';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { Bilingual } from '../core/types';
import { baybayHeld } from '../game/baybayHold';
import { bayParts } from '../game/bayNow';
import { bubble } from '../game/flow';
import { flow, type FlowRide } from '../game/flowStore';
import { registerInteractables, type Interactable } from '../game/interactables';
import { registerFrameSystem } from '../game/systemsRegistry';
import { registerRidePad } from '../ui/rideSlots';
import { openOverlays, registerOverlay } from '../ui/slots';
import { currentActivity } from './kit';
import { BUSK_LINES, BUSK_NAME, GRIP_LINES } from './sfgames8Lines';
import { INVITE_R, nearPlayer, PREFETCH_R, zoneInvite, zonePrefetch } from './zones';

/**
 * Wave 8 · lane M · the second set of San Francisco mini-games' zones (one small chunk play/zones3.ts loads at init,
 * city mode only): where each game is offered, BAYBAY's one invite, each game's chunk fetched before it is needed, and
 * the games' panels as lazy overlays. Nothing is drawn in the 3D world by this module.
 *
 *   grip.ts + GripPanel.tsx     the cable-car grip on a Powell St car: offered by a pad in the ride banner (GripPad.tsx)
 *                               once the car is under way; the chunks fetched while you wait for the car
 *   busk.ts + BuskPanel.tsx     play along with the street guitarist on Haight St (a tambourine) or 24th St (maracas):
 *                               a prompt beside each busker (lane L's corner figures, there in the afternoon; at other
 *                               hours BAYBAY plays his tune herself and the prompt says so)
 */

/** The overlay ids of this set's panels (lane K's BAYBAY-silence list names them). */
export const SF8_OVERLAYS = ['play-grip', 'play-busk'] as const;

// --- the buskers -----------------------------------------------------------------------------------------------------------

export interface BuskSpot {
  style: 'haight' | 'mission';
  /** the corner's frame (world/sf/landmarks haight-ashbury.ts / calle-24.ts: x, z, yaw) */
  frame: { x: number; z: number; yaw: number };
  /** the prompt in the corner's frame: on the sidewalk in front of the guitarist, by the walking line */
  local: { x: number; z: number };
  r: number;
  /** the guitarist's Bay-time window (minutes; the corner's `windows.afternoon`, pinned by the tests) */
  from: number;
  to: number;
}
/** Haight St at Ashbury: the guitarist at the corner's (1.85, −7.4) by the wall, his case toward Ashbury */
export const BUSK_HAIGHT: BuskSpot = { style: 'haight', frame: { x: -41.72, z: 763.28, yaw: (-34.8 * Math.PI) / 180 }, local: { x: 0.5, z: -7.6 }, r: 1.5, from: 11 * 60, to: 19 * 60 };
/** 24th St (Calle 24) by Balmy Alley: the guitarist under the taquería's awning at the corner's (−0.1, 3.9) */
export const BUSK_MISSION: BuskSpot = { style: 'mission', frame: { x: 452.79, z: 634.9, yaw: (50.4 * Math.PI) / 180 }, local: { x: 0.2, z: 2.7 }, r: 1.5, from: 12 * 60, to: 20 * 60 };
/** the world point of a spot (the corners' own rotation: world/sf/landmarks/kit.ts rot) */
export function buskAt(s: BuskSpot): { x: number; z: number } {
  const c = Math.cos(s.frame.yaw), n = Math.sin(s.frame.yaw);
  return { x: +(s.frame.x + s.local.x * c + s.local.z * n).toFixed(2), z: +(s.frame.z - s.local.x * n + s.local.z * c).toFixed(2) };
}
/** the guitarist is out now (Bay time) */
export function buskerOut(s: BuskSpot, parts: { hour: number; minute: number } = bayParts()): boolean {
  const m = parts.hour * 60 + parts.minute;
  return m >= s.from && m < s.to;
}

const BUSK_VERB: Bilingual = { zh: '和街头艺人合奏', en: 'Jam with the busker' };
const PRACTICE_VERB: Bilingual = { zh: '和 BAYBAY 练一曲', en: 'Practise with BAYBAY' };
function buskIt(s: BuskSpot, id: string): Interactable {
  const p = buskAt(s);
  return {
    id, source: 'activity', action: 'info', verb: BUSK_VERB, name: BUSK_NAME, x: p.x, z: p.z, radius: s.r,
    act: () => { const out = buskerOut(s); void import('./busk').then(m => { m.startBusk(s.style, out); }); },
  };
}
export const buskHaightIt = buskIt(BUSK_HAIGHT, 'play:busk-haight');
export const buskMissionIt = buskIt(BUSK_MISSION, 'play:busk-mission');
/** Every prompt of the set (tests: each on standable ground) */
export const sf8Its = (): Interactable[] => [buskHaightIt, buskMissionIt];

const POWELL = ['powell-hyde', 'powell-mason'];
const onPowell = (r: Pick<FlowRide, 'kind' | 'line'> | null) => !!r && r.kind === 'cable-car' && !!r.line && POWELL.includes(r.line);
/** The grip pad: a Powell car under way, no game panel up. */
export const gripPadVisible = (r: FlowRide) => onPowell(r) && r.stage !== 'waiting' && !openOverlays().some(o => o.id === 'play-grip');

const GripPanel = lazy(() => import('./GripPanel'));
const GripSlot = () => createElement(Suspense, { fallback: null }, createElement(GripPanel));
const GripPad = lazy(() => import('./GripPad'));
const GripPadSlot = () => createElement(Suspense, { fallback: null }, createElement(GripPad));
const BuskPanel = lazy(() => import('./BuskPanel'));
const BuskSlot = () => createElement(Suspense, { fallback: null }, createElement(BuskPanel));

/** BAYBAY's grip invite: this long into a Powell ride, once a visit (s) */
export const GRIP_INVITE_AFTER = 5;

export function initSfGames8(): () => void {
  const offs: (() => void)[] = [];
  offs.push(registerOverlay({ id: 'play-grip', Component: GripSlot }));
  offs.push(registerRidePad({ id: 'grip', order: 20, visible: gripPadVisible, Component: GripPadSlot }));
  offs.push(registerOverlay({ id: 'play-busk', Component: BuskSlot }));
  offs.push(registerInteractables('m-play-sfgames8', sf8Its));
  let acc = 0, rideT = 0, gripInvited = false;
  const played = new Set<string>();
  offs.push(registerFrameSystem('m-play-sfgames8', dt => {
    const running = currentActivity();
    if (running) played.add(running.spec.id);
    // the prompts step aside while any game runs; the verb follows the busker's hours
    for (const [it, s] of [[buskHaightIt, BUSK_HAIGHT], [buskMissionIt, BUSK_MISSION]] as const) {
      it.radius = running ? 0 : s.r;
      it.verb = buskerOut(s) ? BUSK_VERB : PRACTICE_VERB;
    }
    if ((acc += dt) < 0.25) return;
    const step = acc;
    acc = 0;
    if (game.get().worldMode !== 'city') return;
    // the grip: its chunks while you wait for (or ride) a Powell car; BAYBAY's invite a few seconds into the ride
    const ride = flow.get().ride;
    if (onPowell(ride)) {
      zonePrefetch('grip', () => Promise.all([import('./grip'), import('./GripPanel'), import('./GripPad')]));
      rideT = ride!.stage === 'waiting' ? 0 : rideT + step;
      const f = flow.get(), s = game.get();
      if (!gripInvited && rideT >= GRIP_INVITE_AFTER && !currentActivity() && !baybayHeld() && !f.bubble && !f.cinematic && !s.dialogue.nodeId && !s.photoMode && performance.now() >= f.quietUntil && runtime.move.mode === 'transit') {
        gripInvited = true;
        bubble(GRIP_LINES.invite, 3600, undefined, 'call');
      }
    } else rideT = 0;
    // the buskers: the chunks within PREFETCH_R, BAYBAY's invite once (the zones' own rate limit), not after a jam
    for (const s of [BUSK_HAIGHT, BUSK_MISSION]) {
      const p = buskAt(s);
      if (!nearPlayer(p.x, p.z, PREFETCH_R)) continue;
      zonePrefetch('busk', () => Promise.all([import('./busk'), import('./BuskPanel')]));
      if (nearPlayer(p.x, p.z, INVITE_R) && !running && !played.has('busk') && !baybayHeld()) {
        zoneInvite(`busk-${s.style}`, buskerOut(s) ? (s.style === 'mission' ? BUSK_LINES.inviteMission : BUSK_LINES.inviteHaight) : BUSK_LINES.closed);
      }
    }
  }));
  // DEV / QA: __opusBay.sfgames8 (the games' own module instances)
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    w.__opusBay = { ...(w.__opusBay ?? {}), sfgames8: { grip: () => import('./grip'), busk: () => import('./busk'), kit: () => import('./kit') } };
  }
  return () => { for (const off of offs.splice(0).reverse()) { try { off(); } catch { /* gone */ } } };
}
