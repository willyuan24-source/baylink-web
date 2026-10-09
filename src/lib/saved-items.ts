import { eventFor, placeFor, type PlannerEvent, type PlannerPlace } from './planner';
import { getGuideBySlug, type Guide } from '../data/guides';
import { getGuideMedia, GUIDE_IMAGES, type GuideImage } from '../data/guide-media';
import { currentFreebies } from '../data/october-offers';
import { currentOpenings } from '../data/local-discoveries';
import type { FreebieOffer } from '../components/FreebieBoard';
import type { SeptemberOpening } from '../data/september-openings';
import type { CoverItem } from './cover';
import type { Copy } from './event-facts';
import type { SavedEntry } from './saves';

/**
 * Catalog lookups for the saved list (My Week). Kept apart from `saves.ts` so the save store stays light: only pages
 * that list saved items load the catalogs. Titles and meta lines are the catalog's source text (zh); the page
 * translates them, except neighbourhood posts, which are user text and never translated.
 */
export type SavedItemView = {
  entry: SavedEntry;
  title: string;
  /** In-app route; absent when the item has left the catalog (retired offer, ended listing). */
  path?: string;
  kindLabel: Copy;
  /** One line of source text: city, date or category. */
  meta?: string;
  /** For `resolveCovers`; absent for posts (they get a TypeCover). */
  cover?: CoverItem;
  event?: PlannerEvent;
  place?: PlannerPlace;
  guide?: Guide;
  offer?: FreebieOffer;
  opening?: SeptemberOpening;
  /** User text: render with translate="no". */
  userText?: boolean;
};

export const SAVED_KIND_LABELS: Record<SavedEntry['kind'], Copy> = {
  event: { zh: '活动', en: 'Event' },
  place: { zh: '地点', en: 'Place' },
  guide: { zh: '指南', en: 'Guide' },
  offer: { zh: '优惠', en: 'Offer' },
  opening: { zh: '新店', en: 'New shop' },
  post: { zh: '邻里信息', en: 'Neighborhood listing' },
};

const offersById = new Map(currentFreebies.map(offer => [offer.id, offer]));
const openingsById = new Map(currentOpenings.map(shop => [shop.id, shop]));
const GUIDE_COVER = 'guide-cover:';

/** Resolve one saved entry against today's catalogs. */
export function savedItemView(entry: SavedEntry): SavedItemView {
  const kindLabel = SAVED_KIND_LABELS[entry.kind];
  const base = { entry, kindLabel, title: entry.id };
  switch (entry.kind) {
    case 'event': {
      const event = eventFor(entry.id);
      return event ? { ...base, event, title: event.title, path: `/events/${encodeURIComponent(event.id)}`, meta: `${event.city} · ${event.dateLabel}`, cover: { kind: 'event', id: event.id, imageKey: event.imageKey } } : base;
    }
    case 'place': {
      const place = placeFor(entry.id);
      if (!place) return base;
      const path = place.path || (place.guideSlug ? `/guides/${encodeURIComponent(place.guideSlug)}` : undefined);
      return { ...base, place, title: place.title, path, meta: place.city, cover: { kind: 'place', id: place.id, imageKey: place.imageKey } };
    }
    case 'guide': {
      const guide = getGuideBySlug(entry.id);
      return guide ? { ...base, guide, title: guide.title, path: `/guides/${encodeURIComponent(guide.slug)}`, meta: guide.categoryLabel, cover: { kind: 'guide', id: guide.slug, imageKey: `${GUIDE_COVER}${guide.slug}` } } : base;
    }
    case 'offer': {
      const offer = offersById.get(entry.id);
      return offer ? { ...base, offer, title: `${offer.brand} · ${offer.title}`, path: `/offers/${encodeURIComponent(offer.id)}`, meta: offer.dateLabel, cover: { kind: 'offer', id: offer.id, imageKey: offer.imageKey } } : base;
    }
    case 'opening': {
      const opening = openingsById.get(entry.id);
      return opening ? { ...base, opening, title: opening.name, path: `/openings/${encodeURIComponent(opening.id)}`, meta: `${opening.city} · ${opening.dateLabel}`, cover: { kind: 'opening', id: opening.id, imageKey: opening.imageKey } } : base;
    }
    case 'post': {
      const post = entry.post;
      return { ...base, userText: true, title: post?.title || entry.id, path: `/posts/${encodeURIComponent(entry.id)}`, meta: [post?.category, post?.city, post?.budget].filter(Boolean).join(' · ') || undefined };
    }
  }
}

/** The image registry for saved-item covers: listing images by key, and each guide's own cover. */
export function savedCoverImage(key: string): GuideImage | undefined {
  if (key.startsWith(GUIDE_COVER)) {
    const guide = getGuideBySlug(key.slice(GUIDE_COVER.length));
    return guide ? getGuideMedia(guide).cover : undefined;
  }
  return Object.hasOwn(GUIDE_IMAGES, key) ? GUIDE_IMAGES[key] : undefined;
}
