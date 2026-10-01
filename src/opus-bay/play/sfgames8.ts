import { createElement, lazy, Suspense } from 'react';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { baybayHeld } from '../game/baybayHold';
import { bubble } from '../game/flow';
import { flow, type FlowRide } from '../game/flowStore';
import { registerFrameSystem } from '../game/systemsRegistry';
import { registerRidePad } from '../ui/rideSlots';
import { openOverlays, registerOverlay } from '../ui/slots';
import { currentActivity } from './kit';
import { GRIP_LINES } from './sfgames8Lines';
import { zonePrefetch } from './zones';

/**
 * Wave 8 · lane M · the second set of San Francisco mini-games' zones (one small chunk play/zones3.ts loads at init,
 * city mode only): where each game is offered, BAYBAY's one invite, each game's chunk fetched before it is needed, and
 * the games' panels as lazy overlays. Nothing is drawn in the 3D world by this module.
 *
 *   grip.ts + GripPanel.tsx     the cable-car grip on a Powell St car: offered by a pad in the ride banner (GripPad.tsx)
 *                               once the car is under way; the chunks fetched while you wait for the car
 */

/** The overlay ids of this set's panels (lane K's BAYBAY-silence list names them). */
export const SF8_OVERLAYS = ['play-grip'] as const;

const POWELL = ['powell-hyde', 'powell-mason'];
const onPowell = (r: Pick<FlowRide, 'kind' | 'line'> | null) => !!r && r.kind === 'cable-car' && !!r.line && POWELL.includes(r.line);
/** The grip pad: a Powell car under way, no game panel up. */
export const gripPadVisible = (r: FlowRide) => onPowell(r) && r.stage !== 'waiting' && !openOverlays().some(o => o.id === 'play-grip');

const GripPanel = lazy(() => import('./GripPanel'));
const GripSlot = () => createElement(Suspense, { fallback: null }, createElement(GripPanel));
const GripPad = lazy(() => import('./GripPad'));
const GripPadSlot = () => createElement(Suspense, { fallback: null }, createElement(GripPad));

/** BAYBAY's grip invite: this long into a Powell ride, once a visit (s) */
export const GRIP_INVITE_AFTER = 5;

export function initSfGames8(): () => void {
  const offs: (() => void)[] = [];
  offs.push(registerOverlay({ id: 'play-grip', Component: GripSlot }));
  offs.push(registerRidePad({ id: 'grip', order: 20, visible: gripPadVisible, Component: GripPadSlot }));
  let acc = 0, rideT = 0, gripInvited = false;
  offs.push(registerFrameSystem('m-play-sfgames8', dt => {
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
  }));
  // DEV / QA: __opusBay.sfgames8 (the games' own module instances)
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    w.__opusBay = { ...(w.__opusBay ?? {}), sfgames8: { grip: () => import('./grip'), kit: () => import('./kit') } };
  }
  return () => { for (const off of offs.splice(0).reverse()) { try { off(); } catch { /* gone */ } } };
}
