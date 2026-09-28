import { glideUnlocked } from '../actors/moveApi';
import { cityAreaAt } from '../data/cityZones';
import type { HintSpot } from '../economy/hints';
import type { Rumour, RumourContext } from '../game/rumours';
import { inMonths, marked } from './gates';
import { TRAIL_STOPS, trailMark, WHALE_MONTHS } from './presidio';
import { EGGS, eggSpots, type EggDef } from './registry';
import { labyrinthToday } from './west';

/**
 * Wave 5 · lane D (W5-D5) · finding without pins: what lane C's rumour teller (game/rumours.ts, BAYBAY's 听说…) and
 * lane E's 寻宝罗盘 (economy/hints.ts) may point at.
 *
 *   eggRumour(ctx)      an unfound egg of the player's zone (store.area: the landmark area / DataSF neighbourhood each
 *                       spot lies in), else the nearest unfound one within RUMOUR_NEAR_U; its registry rumour (framed
 *                       听说… ≤ 45, lane C says it as it is) and the spot it points at. Lane C tells at most one per
 *                       5 minutes, never the same id twice a visit (ctx.told).
 *   eggHintSpots()      every spot where an unfound egg can be found TODAY (the humpback only April – November, the
 *                       labyrinth only on its days, the 1776 stops not yet visited): the compass picks the nearest.
 *
 * Both skip what cannot happen now (and the pelican's eggs before the glide unlocks), so a hint never sends the player
 * to nothing.
 */

/** Without a zone match, an unfound egg this near (u) may still be rumoured. */
export const RUMOUR_NEAR_U = 260;

/** The eggs only the pelican can find (a landing, a loop, a look from above): hinted once the glide is unlocked. */
export const PELICAN_EGGS: readonly string[] = ['crissy-field-dusk-landing', 'alcatraz-pelican-island', 'herons-head-from-above'];

/**
 * The spots of an egg that can be found today (empty: not today, or not yet: a pelican egg before the glide unlocks).
 * `canFly` defaults to lane F's glideUnlocked (actors/moveApi: a tiny module).
 */
export function liveSpots(e: EggDef, canFly: boolean = glideUnlocked()): { x: number; z: number }[] {
  if (!canFly && PELICAN_EGGS.includes(e.id)) return [];
  if (e.id === 'golden-gate-humpback' && !inMonths(WHALE_MONTHS)) return [];
  if (e.id === 'lands-end-labyrinth' && !labyrinthToday()) return [];
  const spots = eggSpots(e);
  if (e.id === 'sf-250-birthday-trail') return spots.filter((_, i) => !marked(trailMark(TRAIL_STOPS[i])));
  return spots;
}

const zoneCache = new Map<string, string>();
/** The area id of a spot (cached once known: the zone grid streams in with the city). */
function zoneOf(p: { x: number; z: number }): string | null {
  const k = `${p.x},${p.z}`;
  const hit = zoneCache.get(k);
  if (hit !== undefined) return hit;
  let id: string | null;
  try { id = cityAreaAt(p.x, p.z)?.id ?? null; } catch { id = null; }
  if (id) zoneCache.set(k, id);
  return id;
}

/**
 * The rumour for lane C's teller: an unfound egg in the player's zone first (nearest), else the nearest within
 * RUMOUR_NEAR_U; null when none. `found` is the ledger's view (eggs/hosts isFound); `zone` and `canFly` may be injected
 * (tests).
 */
export function eggRumour(
  ctx: RumourContext, found: (id: string) => boolean,
  o: { zone?: (p: { x: number; z: number }) => string | null; canFly?: boolean } = {},
): Rumour | null {
  const zone = o.zone ?? zoneOf, canFly = o.canFly ?? glideUnlocked();
  let best: { e: EggDef; at: { x: number; z: number }; d: number; same: boolean } | null = null;
  for (const e of EGGS) {
    if (found(e.id) || ctx.told.has(`egg:${e.id}`)) continue;
    for (const at of liveSpots(e, canFly)) {
      const d = Math.hypot(at.x - ctx.x, at.z - ctx.z);
      const same = !!ctx.zone && zone(at) === ctx.zone;
      if (!same && d > RUMOUR_NEAR_U) continue;
      if (!best || (same && !best.same) || (same === best.same && d < best.d)) best = { e, at, d, same };
    }
  }
  return best ? { id: `egg:${best.e.id}`, text: best.e.rumour, at: { x: best.at.x, z: best.at.z } } : null;
}

/** The compass's list: every live spot of every unfound egg (an egg with two spots is listed twice under its id). */
export function eggHintSpots(found: (id: string) => boolean, canFly: boolean = glideUnlocked()): HintSpot[] {
  const out: HintSpot[] = [];
  for (const e of EGGS) if (!found(e.id)) for (const p of liveSpots(e, canFly)) out.push({ id: e.id, x: p.x, z: p.z });
  return out;
}
