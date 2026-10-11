import { eventFor, placeFor, type PlannerEvent, type PlannerPlace } from './planner';
import { getGuideBySlug, type Guide } from '../data/guides';
import { getGuideMedia, GUIDE_IMAGES, type GuideImage } from '../data/guide-media';
import { currentFreebies } from '../data/october-offers';
import { currentOpenings } from '../data/local-discoveries';
import type { FreebieOffer } from '../components/FreebieBoard';
import type { SeptemberOpening } from '../data/september-openings';
import type { CoverItem } from './cover';
import { brandCase, type Copy } from './event-facts';
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
  /**
   * The meta line as separate pieces of source text (brand, city, date or category). The page translates each piece on
   * its own: the dictionaries hold the pieces, not the joined line, so a joined line would stay in Chinese on /en.
   */
  meta: string[];
  /** Pieces of the meta line written by a member (a listing's city and budget): shown as written, never translated. */
  userMeta?: string[];
  /** For `resolveCovers`; absent for posts (they get a TypeCover). */
  cover?: CoverItem;
  event?: PlannerEvent;
  place?: PlannerPlace;
  guide?: Guide;
  offer?: FreebieOffer;
  opening?: SeptemberOpening;
  /** The title is user text: shown exactly as written (no 繁體 conversion, no dictionary). */
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
  const base = { entry, kindLabel, title: entry.id, meta: [] };
  const parts = (...values: (string | undefined)[]) => values.filter((value): value is string => !!value);
  switch (entry.kind) {
    case 'event': {
      const event = eventFor(entry.id);
      return event ? { ...base, event, title: event.title, path: `/events/${encodeURIComponent(event.id)}`, meta: parts(event.city, event.dateLabel), cover: { kind: 'event', id: event.id, imageKey: event.imageKey } } : base;
    }
    case 'place': {
      const place = placeFor(entry.id);
      if (!place) return base;
      const path = place.path || (place.guideSlug ? `/guides/${encodeURIComponent(place.guideSlug)}` : undefined);
      return { ...base, place, title: place.title, path, meta: parts(place.city), cover: { kind: 'place', id: place.id, imageKey: place.imageKey } };
    }
    case 'guide': {
      const guide = getGuideBySlug(entry.id);
      return guide ? { ...base, guide, title: guide.title, path: `/guides/${encodeURIComponent(guide.slug)}`, meta: parts(guide.categoryLabel), cover: { kind: 'guide', id: guide.slug, imageKey: `${GUIDE_COVER}${guide.slug}` } } : base;
    }
    case 'offer': {
      // The deal is the title; the brand (in its display casing, "SFMTA · San Francisco") leads the meta line.
      const offer = offersById.get(entry.id);
      return offer ? { ...base, offer, title: offer.title, path: `/offers/${encodeURIComponent(offer.id)}`, meta: parts(brandCase(offer.brand), offer.dateLabel), cover: { kind: 'offer', id: offer.id, imageKey: offer.imageKey } } : base;
    }
    case 'opening': {
      const opening = openingsById.get(entry.id);
      return opening ? { ...base, opening, title: opening.name, path: `/openings/${encodeURIComponent(opening.id)}`, meta: parts(opening.city, opening.dateLabel), cover: { kind: 'opening', id: opening.id, imageKey: opening.imageKey } } : base;
    }
    case 'post': {
      const post = entry.post;
      // The category is the board's own label (translated like on the board); city and budget are the member's words.
      return { ...base, userText: true, title: post?.title || entry.id, path: `/posts/${encodeURIComponent(entry.id)}`, meta: parts(post?.category), userMeta: parts(post?.city, post?.budget) };
    }
  }
}

/**
 * Whether the item is still in the web's catalogs (a place without a page of its own still is). A pending save whose
 * item is not is no longer sent to the account (API contract, docs/planner-favorites.md: "stop retrying when the item
 * leaves the web catalog"). Posts are not catalog items.
 */
export const inWebCatalog = (view: SavedItemView) => !!(view.event || view.place || view.guide || view.offer || view.opening);

/** The image registry for saved-item covers: listing images by key, and each guide's own cover. */
export function savedCoverImage(key: string): GuideImage | undefined {
  if (key.startsWith(GUIDE_COVER)) {
    const guide = getGuideBySlug(key.slice(GUIDE_COVER.length));
    return guide ? getGuideMedia(guide).cover : undefined;
  }
  return Object.hasOwn(GUIDE_IMAGES, key) ? GUIDE_IMAGES[key] : undefined;
}
