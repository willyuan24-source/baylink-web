import type { CoverItem } from './cover';
import { eventFor, placeFor, type Stop } from './planner';
import { getGuideBySlug } from '../data/guides';
import { getGuideMedia, GUIDE_IMAGES } from '../data/guide-media';
import { SCENE3D_POSTCARD_FOR, SCENE3D_POSTCARD_IMAGES } from '../data/scene3d-postcards';

/**
 * Covers for plan stops (行程, plan T13): one honesty ladder for the planner's list and its saved days. An event offers
 * its own listing image; a place its listing image, else its guide's cover, else (San Francisco places only) its
 * 3D-world postcard. getCover() refuses AI art and theme photos on every rung, so a place whose guide cover is an
 * illustration falls through to the postcard (labelled 3D 场景插图) or to a TypeCover.
 */
export function stopCoverItem(stop: Stop): CoverItem {
  if (stop.kind === 'event') return { kind: 'event', id: stop.id, imageKey: eventFor(stop.id)?.imageKey };
  const place = placeFor(stop.id);
  const postcardKey = SCENE3D_POSTCARD_FOR[stop.id] ?? (place?.guideSlug ? SCENE3D_POSTCARD_FOR[place.guideSlug] : undefined);
  return { kind: 'place', id: stop.id, imageKey: place?.imageKey ?? (place?.guideSlug ? `guide-cover:${place.guideSlug}` : undefined), postcardKey };
}

const GUIDE_COVER = 'guide-cover:';
/**
 * The image registry for stop covers: listing images, guide covers (`guide-cover:` keys, as on My Week's saved list) and
 * the 3D postcards. Kept apart from saved-items.ts so the planner does not load the offer and new-shop catalogs for it.
 */
export function stopCoverImage(key: string) {
  if (key.startsWith(GUIDE_COVER)) { const guide = getGuideBySlug(key.slice(GUIDE_COVER.length)); return guide ? getGuideMedia(guide).cover : undefined; }
  if (Object.hasOwn(GUIDE_IMAGES, key)) return GUIDE_IMAGES[key];
  return Object.hasOwn(SCENE3D_POSTCARD_IMAGES, key) ? SCENE3D_POSTCARD_IMAGES[key] : undefined;
}

/** "10/17 周六" / "Sat 10/17" for a Pacific calendar day (zh-Hant converts the weekday at render). */
export function planDayLabel(date: string, english: boolean) {
  const day = new Date(`${date}T12:00:00Z`);
  const md = `${day.getUTCMonth() + 1}/${day.getUTCDate()}`;
  const weekday = new Intl.DateTimeFormat(english ? 'en-US' : 'zh-CN', { weekday: 'short', timeZone: 'UTC' }).format(day);
  return english ? `${weekday} ${md}` : `${md} ${weekday}`;
}
