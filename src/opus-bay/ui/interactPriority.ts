import type { Interactable } from '../game/interactables';

/**
 * W9-A · which of several prompts in reach E takes, in the city (review R§6 界面与交互 "E 键被抢": BAYBAY at your side or a
 * bench took E from the postcard; the claw machine's spot showed only 坐下 — verify-phone t4-claw.jpg): an activity, a
 * pickup or the tour's stop first (tier 0), then a place card, a resident, a station (1), then BAYBAY, a bench, a parked
 * ride and the follow-you 坐下 (2). The play layer installs `interactWeight` as game/interactables.ts' focusWeight (the
 * rule stays out of GameRoot's first load); game/brain.ts adds it to the distance score in the city only (the district's
 * weights never change), so within a tier the old weights still decide. Pure.
 */
export const INTERACT_TIER_GAP = 3;

export function interactTier(it: Pick<Interactable, 'id' | 'source'>, tourTarget?: string): 0 | 1 | 2 {
  if (it.id === tourTarget) return 0;
  if (it.id === 'play:sit' || it.source === 'baybay' || it.source === 'seat' || it.source === 'vehicle') return 2;
  if (it.id.startsWith('view:')) return 1;
  return it.source === 'activity' || it.source === 'find' || it.source === 'shop' || it.source === 'event' || it.source === 'postcard' ? 0 : 1;
}

/** The score added per tier: larger than any spread of the old weights inside one tier (d / r ∈ [0, 1], −0.95 … +0.2). */
export const interactWeight = (it: Pick<Interactable, 'id' | 'source'>, tourTarget?: string): number => interactTier(it, tourTarget) * INTERACT_TIER_GAP;
