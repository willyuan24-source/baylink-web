import type { Bilingual, Vec2 } from '../core/types';
import type { TripMode } from './tripTypes';

/**
 * Wave 5 · lane N · W5-N1: `goTo()` — "带我去" from anywhere (plan sf-w5-plan.md §4.3, MF4 "Every real-world row can
 * go"). The one entry point other lanes call for a place or a point: R's event pennants, SF Today rows and EventCards,
 * D's rumours, E's treasure compass, C's lines. It plans the honest ways from where the player stands
 * (game/tripPlan planTrips with the live providers), takes the best one (or the preferred kind), closes the open panel
 * and starts the trip at once through the trip runner: BAYBAY leads and the player is carried (auto-follow, W5-N3), or
 * the pelican flies.
 *
 * This module is the HOOK and stays tiny (types + one dynamic import): importing it pulls no place data, no planner and
 * no three into the caller's chunk. The work is game/goToRun.ts (city chunk), loaded on the first call.
 *
 *   goTo({ placeId: 'coit-tower' })                           an attraction id, an SF landmark id, a place-index id
 *                                                              (`osm-…`, a station place), or an interactable id
 *   goTo({ point: { x, z }, name: { zh: '音乐节', en: … } })  any world point (snapped to walkable ground near it)
 *   goTo(t, { prefer: 'fly' })                                the pelican when it is offered (else the best way)
 *   goTo(t, { prefer: 'ground' })                             never the pelican unless nothing else reaches it
 *   goTo(t, { source: 'realsf:today' })                       who asked (analytics / DEV log; 'map' and 'ask' are the
 *                                                              map's big button and the 问 BAYBAY sheet)
 *
 * Resolves `{ ok: true, mode, seconds, placeId, name }` once the trip has started, or `{ ok: false, why }`:
 * 'district' (district mode has no trips), 'busy' (not playing, or the pelican is already flying), 'unknown' (nothing
 * by that id / no point), 'here' (already there: BAYBAY says so), 'no-way' (nothing reaches it right now).
 * Never throws; safe to call before the city chunk is in (it waits for it).
 */

export interface GoToTarget {
  /** attraction id, SF landmark id, place-index id or interactable id */
  placeId?: string;
  /** a world point (city frame, u) when there is no id */
  point?: Vec2;
  /** the name BAYBAY and the pill use (default: the place's own name; a bare point: 那里 / there) */
  name?: Bilingual;
}

export interface GoToOptions {
  /** 'fly': the pelican whenever it is offered; 'ground': any other way first. Default: the planner's 推荐. */
  prefer?: 'fly' | 'ground';
  /** the caller ('realsf:event', 'eggs:rumour', 'economy:compass', 'map', 'ask', …) */
  source?: string;
  /**
   * (W9-N4, review R§6 现实出行: "到了也没有任何回报") called once when THIS trip arrives (not when it is cancelled or
   * replaced by another trip): lane R reopens the event card there. Runs in F's title slot (a card), after the arrival.
   */
  onArrive?: () => void;
}

export type GoToFail = 'district' | 'busy' | 'unknown' | 'here' | 'no-way';

export type GoToResult =
  | { ok: true; mode: TripMode; seconds: number; placeId: string; name: Bilingual }
  | { ok: false; why: GoToFail };

/** Go there now (see the header). */
export function goTo(target: GoToTarget, opts: GoToOptions = {}): Promise<GoToResult> {
  return import('./goToRun').then(
    m => m.runGoTo(target, opts),
    (e: unknown) => { if (import.meta.env?.DEV) console.error('[opus-bay goTo]', e); return { ok: false, why: 'unknown' } as const; },
  );
}
