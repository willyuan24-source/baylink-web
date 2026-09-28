import type { PoiDef, RealInfo } from '../core/types';
import PHOTO_ASSETS from '../../data/sf-landmark-photo-assets.json';
import { PHOTO_SOURCE_PAGES, POI_EXTRA_SOURCES, POI_OFFICIAL_URLS, POIS } from '../data/pois';
import { ATTRACTIONS } from '../data/sf/attractions';
import { CITY_POI_ZONES, cityPoiId, setCardLookup, type CardLookup } from '../data/sf/cityPois';
import { cardPoiId, loadPlaceCards, placeCardByPoiId, placeCardForPlace, placeCardPoi, type CardRefresh, type PlaceCard, type PlaceCardSet } from '../data/sf/placeCardTypes';
import { invalidateInteractables, registerPoiResolver } from './interactables';

/**
 * Wave 4 · lane C · W4-C5 integration: the 124 + 8 place cards in the running city (lazy: game/cityContent.ts imports
 * this module in city mode only; the card texts are two more lazy chunks behind data/sf/placeCardTypes loadPlaceCards).
 *
 *   - `openPanel('poi', 'sf:<id>')` resolves a card through interactables' POI resolver (`cardPoiId`: the place row it
 *     decorates, or its own id when it shares a row another card owns); PoiCard's place path (data/sf/cityPois
 *     placeCardTarget) opens it for its row: landmark card → district POI card → this → the generic place card
 *   - the card sits at its attraction's arrival spot (lane P's ATTRACTIONS; the card's own lat / lng projected when an
 *     attraction is missing), with the licensed photo of `photoKey` (src/data/sf-landmark-photo-assets.json, the 480 w
 *     variant, the credit as published there)
 *   - 官网 / 更多来源 / the photo's source page / the zone eyebrow go into the same tables the landmark cards use
 *   - CARD_REFRESHES patch the 10 built landmark cards that became stops: the status first among the tips, hours /
 *     cost replaced, tips appended, sources added (plan §2.5)
 */

interface PhotoAsset { id: string; srcSet?: string; src: string; credit?: string; creditEn?: string; creditUrl?: string; licenseUrl?: string }

/** The licensed photo of a `photoKey` as PoiCard shows it (the 480 w variant; credit "author / Wikimedia Commons (resized)"). */
export function cardPhoto(key: string | undefined, assets: readonly PhotoAsset[] = PHOTO_ASSETS as PhotoAsset[]): (NonNullable<RealInfo['photo']> & { page?: string }) | undefined {
  const a = key ? assets.find(x => x.id === key) : undefined;
  if (!a) return undefined;
  const small = a.srcSet?.split(',').map(s => s.trim().split(/\s+/)).find(([, w]) => w === '480w')?.[0] ?? a.src;
  const parts = (a.creditEn ?? a.credit ?? '').split('·').map(s => s.trim()).filter(Boolean);
  const author = parts[0] ?? 'Wikimedia Commons';
  const license = parts.find(p => /^(CC|Public domain)/i.test(p));
  const commons = /commons\.wikimedia\.org/.test(a.creditUrl ?? '');
  return {
    src: small,
    credit: commons ? `${author} / Wikimedia Commons (resized)` : `${author} (resized)`,
    ...(license ? { license } : {}),
    ...(a.licenseUrl ? { licenseUrl: a.licenseUrl } : {}),
    ...(a.creditUrl ? { page: a.creditUrl } : {}),
  };
}

const at = (card: PlaceCard) => {
  const a = ATTRACTIONS.find(x => x.id === card.id);
  return a ? (a.arrival ?? { x: a.x, z: a.z }) : null;
};

/** A card as the PoiDef PoiCard renders (null: no position known for it). */
export function cardPoi(card: PlaceCard): PoiDef | null {
  const p = at(card);
  if (!p) return null;
  const photo = cardPhoto(card.photoKey);
  return placeCardPoi(card, p, photo ? { src: photo.src, credit: photo.credit, ...(photo.license ? { license: photo.license } : {}), ...(photo.licenseUrl ? { licenseUrl: photo.licenseUrl } : {}) } : undefined);
}

/** A built landmark card with its wave-4 refresh (pure: returns a new PoiDef). */
export function refreshedPoi(poi: PoiDef, r: CardRefresh): PoiDef {
  const info = poi.realInfo;
  if (!info) return poi;
  const own = [...info.tips];
  const extra: typeof own = [];
  for (const { match, text } of r.replaceTips ?? []) {
    const i = own.findIndex(tip => tip.zh.includes(match));
    if (i >= 0) own[i] = text; else extra.push(text);
  }
  const tips = [...(r.status ? [r.status.text] : []), ...own, ...extra, ...(r.addTips ?? [])];
  return {
    ...poi,
    realInfo: { ...info, tips, ...(r.hours ? { hours: r.hours } : {}), ...(r.cost ? { cost: r.cost } : {}), verifiedAt: r.verifiedAt },
  };
}

/** PoiCard's place path and the attraction card ids (data/sf/cityPois CardLookup) for a loaded card set. */
export function cardLookup(set: PlaceCardSet): CardLookup {
  return {
    forPlace: place => { const c = placeCardForPlace(set, place); return c ? cardPoiId(c) : null; },
    forAttraction: id => { const c = set.byId.get(id); return c ? cardPoiId(c) : null; },
  };
}

let applied: PlaceCardSet | null = null;
const cache = new Map<string, PoiDef | null>();

/** Put the loaded cards into the card tables and the POI resolver (once per set). */
export function applyCards(set: PlaceCardSet): void {
  if (applied === set) return;
  applied = set;
  cache.clear();
  setCardLookup(cardLookup(set));
  for (const card of set.cards) {
    const id = cardPoiId(card);
    if (card.officialUrl) POI_OFFICIAL_URLS[id] = card.officialUrl;
    if (card.sources.length) POI_EXTRA_SOURCES[id] = [...card.sources];
    CITY_POI_ZONES[id] = card.zone;
    const photo = cardPhoto(card.photoKey);
    if (photo?.page) PHOTO_SOURCE_PAGES[photo.src] = photo.page;
  }
  // the built landmarks that became stops (the POIS entries are the landmark cards themselves: replace them in place)
  for (const [landmark, r] of Object.entries(set.refreshes)) {
    const id = cityPoiId(landmark);
    const i = POIS.findIndex(p => p.id === id);
    if (i < 0) continue;
    POIS[i] = refreshedPoi(POIS[i], r);
    POI_EXTRA_SOURCES[id] = [...new Set([...(POI_EXTRA_SOURCES[id] ?? []), ...r.sources])];
  }
  // the interactables hold the POI objects: rebuild them with the refreshed landmark cards
  invalidateInteractables();
}

/** The POI of a card id (`sf:<id>`), memoised. */
function resolve(id: string): PoiDef | undefined {
  if (!applied || !id.startsWith('sf:')) return undefined;
  if (!cache.has(id)) { const card = placeCardByPoiId(applied, id); cache.set(id, card ? cardPoi(card) : null); }
  return cache.get(id) ?? undefined;
}

/** City mode: load the cards, register them; returns the disposer. */
export function initCityCards(): () => void {
  let disposed = false;
  const off = registerPoiResolver(resolve);
  void loadPlaceCards().then(set => { if (!disposed) applyCards(set); }, (e: unknown) => { if (import.meta.env?.DEV) console.error('[opus-bay place cards]', e); });
  return () => { disposed = true; off(); setCardLookup(null); applied = null; };
}
