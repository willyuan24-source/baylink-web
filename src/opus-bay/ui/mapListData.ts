import type { Vec2 } from '../core/types';
import type { Attraction } from '../data/sf/attractionTypes';
import { STREET_FACTOR, autoTravelSeconds } from '../game/tripPlan';
import PHOTO_ASSETS from '../../data/sf-landmark-photo-assets.json';

/** Wave 4 · the city map list's row data (lane P, integration): walking estimates and photo thumbs. */

/**
 * The on-foot estimate of a list row: straight × 1.25 for the streets (lane G's planner rule) at the auto-travel pace
 * (W5-N4: trips carry the player, so the list says what the card's BAYBAY 带路 button says before its route lands).
 */
export const listWalkSeconds = (from: Vec2, to: Vec2) => autoTravelSeconds(Math.hypot(to.x - from.x, to.z - from.z) * STREET_FACTOR);

/** photoKey → the 480 w thumbnail of src/data/sf-landmark-photo-assets.json. */
const THUMBS: ReadonlyMap<string, string> = new Map((PHOTO_ASSETS as { id: string; src: string; srcSet?: string }[]).map(p => [p.id, p.srcSet?.split(',')[0]?.trim().split(' ')[0] || p.src]));
export const attractionThumb = (a: Pick<Attraction, 'photoKey'>): string | null => (a.photoKey ? THUMBS.get(a.photoKey) ?? null : null);

