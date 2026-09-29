import { runtime } from '../../core/runtime';

/**
 * (W6-B, the skipped W5-bus review) Who a transit vehicle stops short of on its track or road — the `viewer` of the
 * cable cars (world/transitLine.ts), the F-line (world/flineSystem.ts), the loop buses (world/busSystem.ts) and the
 * Metro (world/lightRail.ts): the player on foot, **or sitting in their bike / toy car** (then at the vehicle's pose).
 * Before, only on foot counted: a bus, a streetcar, a cable car or a train drove straight through the player's toy car
 * or bike standing across (or facing) its path — the toy traffic gives the player's vehicle right of way
 * (world/sf/traffic.ts), the transit simply never saw it. `onFoot` keeps its name in the four systems' options: it
 * means "someone on the roadway to stop for" (not riding a transit vehicle, not gliding).
 */
export function roadViewer(): { x: number; z: number; onFoot: boolean } {
  const v = runtime.vehicle;
  if (v.occupied && v.kind) return { x: v.x, z: v.z, onFoot: true };
  return { x: runtime.player.x, z: runtime.player.z, onFoot: runtime.move.mode === 'foot' };
}
