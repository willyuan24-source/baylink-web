import type { ComponentType } from 'react';
import type { FlowRide } from '../game/flowStore';

/**
 * Wave 5 · lane T (W5-T1, plan sf-w5-plan.md §4.3): pads other lanes put into the ride banner (ui/RideBanner.tsx) — lane
 * A's cable-car bell pad (the bell riff: call and response, then freestyle). A tiny registry with no React runtime and
 * no game code, so a lazy feature chunk registers from its `init()` without pulling the banner in; the banner renders
 * every visible pad (by `order`) on a row of its own under the line and the buttons, while the ride runs.
 *
 *   const off = registerRidePad({ id: 'bell', order: 10, visible: r => r.kind === 'cable-car' && r.stage !== 'waiting', Component: BellPad });
 *
 * `visible(ride)` is asked at each banner render (twice a second on board); the Component gets the ride. Same id again
 * replaces the pad; the returned function removes it.
 */

export interface RidePad {
  id: string;
  order: number;
  visible: (ride: FlowRide) => boolean;
  Component: ComponentType<{ ride: FlowRide }>;
}

let pads: RidePad[] = [];
const listeners = new Set<() => void>();

function changed() { for (const fn of listeners) { try { fn(); } catch { /* the listener's own */ } } }

export function registerRidePad(pad: RidePad): () => void {
  pads = [...pads.filter(p => p.id !== pad.id), pad].sort((a, b) => a.order - b.order);
  changed();
  return () => {
    if (!pads.includes(pad)) return;
    pads = pads.filter(p => p !== pad);
    changed();
  };
}

/** The registered pads, by order (a new array after each change). */
export function ridePads(): readonly RidePad[] { return pads; }

/** The pads to show for `ride` (a pad whose `visible` throws is left out). */
export function visibleRidePads(ride: FlowRide): RidePad[] {
  return pads.filter(p => { try { return p.visible(ride); } catch { return false; } });
}

/** Called on every change (the banner re-renders). */
export function subscribeRidePads(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
