import type { Vec2 } from '../core/types';
import type { Attraction } from '../data/sf/attractionTypes';
import PHOTO_ASSETS from '../../data/sf-landmark-photo-assets.json';

/** Wave 4 · the city map list's row data (lane P, integration): walking estimates and photo thumbs. */

/** Straight-line walking estimate for a list row (× 1.25 for the streets, 4.2 u/s: lane G's planner rule). */
export const listWalkSeconds = (from: Vec2, to: Vec2) => (Math.hypot(to.x - from.x, to.z - from.z) * 1.25) / 4.2;

/** photoKey → the 480 w thumbnail of src/data/sf-landmark-photo-assets.json. */
const THUMBS: ReadonlyMap<string, string> = new Map((PHOTO_ASSETS as { id: string; src: string; srcSet?: string }[]).map(p => [p.id, p.srcSet?.split(',')[0]?.trim().split(' ')[0] || p.src]));
export const attractionThumb = (a: Pick<Attraction, 'photoKey'>): string | null => (a.photoKey ? THUMBS.get(a.photoKey) ?? null : null);

