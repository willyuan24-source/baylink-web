import type { Bilingual, PoiDef, RealInfo } from '../../core/types';
import type { SfPlaceKind } from '../../world/sf/format';
import { CITY_DATA } from './cityData';
import type * as Tables from './cityPoisData';

// W5-V3 (lane V): the landmark info records come with the city's data chunk (city mode and node only), so the 17 KB
// of card text stays out of GameRoot's chunk; W8-P2 moved the tables built from them there too (below)

/**
 * The 24 San Francisco landmark info cards (lane G2, plan G2-1). One PoiDef per SF_LANDMARK_INFO record (lane D2's
 * verified data), so the card, the E prompt, BAYBAY's pass-by bark, "附近有什么" and the map all reuse the district's
 * POI machinery. City mode only: data/pois.ts merges CITY_POIS after the district POIs (`byMode`).
 *
 * - id `sf:<landmarkId>`: `openPanel('poi', 'sf:<id>')` opens the card (ui/PoiCard.tsx), the interactable has the same id
 *   (so G1's `?at=` and "带我去" resolve it) and it never collides with a district POI id;
 * - position: D2's arrival spot (`sfLandmarkAnchor`, walkable, outside the blockers; written out in data/sf/arrivals.ts
 *   so the landmark library stays out of GameRoot, P7), radius 4; kind 'info' (never
 *   'viewpoint': that runs the Coit-only sweep), no reaction node: E opens the card;
 * - planner / guide ids are copied only when they exist in /planner-catalog.json and /baybay-guides.json (tested);
 *   a month-tagged guide (e.g. an October 2026 payment update) goes stale, so it falls back to the general SF guide;
 *   a planner place that names a different spot is dropped (Ghirardelli Square is not PIER 39);
 * - licensed photos the site already ships (src/data/sf-landmark-photo-assets.json) are reused read-only where the
 *   photo really shows the landmark; the others show the matching postcard art once it is collected;
 * - zh names follow the glossary that matches the HUD's neighbourhood labels (双峰, 马里纳区, 要塞公园, 叮当车 …).
 */

export const CITY_POI_PREFIX = 'sf:';
export const cityPoiId = (landmarkId: string) => `${CITY_POI_PREFIX}${landmarkId}`;

// ---------------------------------------------------------------------------------------------------------------
// W8-P2 (lane P; GameRoot ≤ 255 KB gzip): the landmark cards' tables come with the city's data chunk
// (data/sf/cityPoisData.ts, verbatim). Every export keeps its name here: city mode and node read the chunk's own
// values (CITY_DATA is awaited before this module evaluates); district mode — which never reads them (data/pois.ts
// `byMode`, place cards are city places) — gets empty tables and identity glossaries.
// ---------------------------------------------------------------------------------------------------------------
const T: typeof Tables | undefined = CITY_DATA?.CITY_POI_TABLES;
export const ZH_GLOSSARY: readonly (readonly [from: string, to: string])[] = T?.ZH_GLOSSARY ?? [];
export const ZH_TEXT_NAMES: readonly (readonly [from: string, to: string])[] = T?.ZH_TEXT_NAMES ?? [];
/** zh glossary on a name (Tables.glossZh) */
export const glossZh = (text: string): string => (T ? T.glossZh(text) : text);
/** A zh card sentence with the game's zh names (Tables.glossZhText) */
export const glossZhText = (text: string): string => (T ? T.glossZhText(text) : text);
/** The 24 landmark cards, in the registry's order. */
export const CITY_POIS: PoiDef[] = T?.CITY_POIS ?? [];
/** The landmark's zone label, glossed (for the card eyebrow and "附近有什么"). */
export const CITY_POI_ZONES: Record<string, Bilingual> = T?.CITY_POI_ZONES ?? {};
/** Official sites (PoiCard's 官网 button), only where D2 recorded a real official site. */
export const CITY_POI_OFFICIAL_URLS: Record<string, string> = T?.CITY_POI_OFFICIAL_URLS ?? {};
/** Secondary fact sources (PoiCard's 更多来源). */
export const CITY_POI_EXTRA_SOURCES: Record<string, string[]> = T?.CITY_POI_EXTRA_SOURCES ?? {};
/** Photo file pages keyed by photo src (PoiCard's credit link). */
export const CITY_PHOTO_SOURCE_PAGES: Record<string, string> = T?.CITY_PHOTO_SOURCE_PAGES ?? {};
/** Telescope / photo captions for the landmarks (content.subjectFact), keyed by landmark id. */
export const CITY_SUBJECT_FACTS: Record<string, { name: Bilingual; fact: Bilingual; sourceUrl: string; verifiedAt: string }> = T?.CITY_SUBJECT_FACTS ?? {};
/** What a place is, for its card (world/sf/format SfPlaceKind; place cards are city places). */
export const PLACE_KIND_NAMES: Record<SfPlaceKind, Bilingual> = T?.PLACE_KIND_NAMES ?? ({} as Record<SfPlaceKind, Bilingual>);
/** A place's name for the card title: the glossary on zh (OSM zh names are sometimes the English name). */
export const placeCardName = (name: Bilingual): Bilingual => (T ? T.placeCardName(name) : name);

/** BAYLINK's general San Francisco guide (the fallback for month-tagged guides). */
export const SF_GUIDE_SLUG = 'san-francisco-guide';
const MONTHS = /(january|february|march|april|may|june|july|august|september|october|november|december)/i;
/** A guide tied to one month or year goes stale: not linked from a permanent card. */
export const isMonthTagged = (slug: string) => MONTHS.test(slug) || /-20\d\d(-|$)/.test(slug);

type Photo = NonNullable<RealInfo['photo']>;
/**
 * Licensed photos from src/data/sf-landmark-photo-assets.json (small 480 w variants, credits as published there),
 * only where the photo shows this landmark (the Castro photo is the crosswalk, not the theatre: not reused). W5-V3 (lane
 * V): the table itself is in data/sf/cityPhotos.ts, with the city's data chunk (city mode and node only).
 */
export const CITY_PHOTOS: Record<string, Photo & { page: string }> = CITY_DATA?.CITY_PHOTOS ?? {};

/**
 * W8-P7: the district POIs in the city's words (the zh names, the English place names in their card text) come with the
 * city data chunk too (data/sf/cityPoisData.ts, verbatim). data/pois.ts builds CITY_DISTRICT_POIS with cityDistrictPoi in
 * both modes, but only the city reads them; in district mode the copy keeps the POI as written (with its own realInfo
 * object, which data/pois.ts fillPoiTexts writes into) and the zh text is left as it is.
 */
export const CITY_DISTRICT_POI_NAMES: Readonly<Record<string, string>> = T?.CITY_DISTRICT_POI_NAMES ?? {};
export const CITY_DISTRICT_TEXT_NAMES: readonly (readonly [from: string, to: string])[] = T?.CITY_DISTRICT_TEXT_NAMES ?? [];
/** A district POI's zh sentence with the city's names (CITY_DISTRICT_TEXT_NAMES); the space an English word kept goes. */
export const cityDistrictZh = (text: string): string => (T ? T.cityDistrictZh(text) : text);
/** A district POI as the city shows it (its zh name and card text in the city's words); district mode never reads it. */
export const cityDistrictPoi = (poi: PoiDef): PoiDef => (T ? T.cityDistrictPoi(poi) : { ...poi, ...(poi.realInfo ? { realInfo: { ...poi.realInfo } } : {}) });

/**
 * The 官网 a card links (wave-4 verify C1): a city card (`sf:…`) links only its own official site — the planner place's
 * link names a neighbouring page (Fort Point → the bridge's bike page, the de Young → JFK Promenade) and already has its
 * own 排进计划 button — and no 官网 at all when the landmark has none. District cards keep the planner link first.
 */
export function cardOfficialUrl(poiId: string, plannerUrl: string | undefined, official: Readonly<Record<string, string>>): string | undefined {
  if (poiId.startsWith(CITY_POI_PREFIX)) return official[poiId];
  return plannerUrl ?? official[poiId];
}

// ---------------------------------------------------------------------------------------------------------------
// City places that are not landmarks (G1's request 3): `openPanel('poi', 'sf:<placeId>')`
// ---------------------------------------------------------------------------------------------------------------

/** The fields of G1's CityPlace (data/sf/places.ts) a place card reads. */
export interface PlaceCardInput { id: string; name: Bilingual; kind: SfPlaceKind; landmark?: string; poi?: string }

/**
 * Wave 4 · lane C: the new attractions' place cards (lazy: game/cityCards.ts registers this lookup once they are in, so
 * the card texts and their loader stay out of the main graph). Answers `sf:`-prefixed POI ids.
 */
export interface CardLookup {
  /** the card a place row opens (null: the row keeps another card, or has none) */
  forPlace(place: { id: string; landmark?: string; poi?: string }): string | null;
  /** the card of an attraction id */
  forAttraction(attraction: string): string | null;
}
let cardLookup: CardLookup | null = null;
export function setCardLookup(c: CardLookup | null) { cardLookup = c; }

/**
 * What `openPanel('poi', id)` shows for a city id that is not a POI (PoiCard): a place standing for a landmark opens
 * that landmark's card, a hero place merged with a district POI opens the POI's card, a place a wave-4 card decorates
 * opens that card (once loaded), any other place gets its own place card. `id` is `sf:<placeId>`; `lookup` is G1's
 * placeById.
 */
export function placeCardTarget<P extends PlaceCardInput>(id: string | undefined, lookup: (placeId: string) => P | undefined, cards: CardLookup | null = cardLookup): { poi: string } | { place: P } | null {
  if (!id?.startsWith(CITY_POI_PREFIX)) return null;
  const place = lookup(id.slice(CITY_POI_PREFIX.length));
  if (!place) return null;
  if (place.landmark) return { poi: cityPoiId(place.landmark) };
  if (place.poi) return { poi: place.poi };
  // wave 4 (lane C): a new attraction's card (lazy, game/cityCards.ts registers its POI resolver) before the generic card
  const card = cards?.forPlace(place);
  if (card) return { poi: card };
  return { place };
}

/**
 * The card an attraction opens (lanes G and P: the arrival card's 看介绍, the map's ⓘ): its landmark card, else its
 * wave-4 place card (`cardPoiId`, lazy), else its place row's card. `sf:`-prefixed POI id for openPanel('poi', …).
 */
export function attractionCardId(a: { id: string; placeId?: string; landmarkId?: string }, cards: CardLookup | null = cardLookup): string {
  if (a.landmarkId) return cityPoiId(a.landmarkId);
  return cards?.forAttraction(a.id) ?? `${CITY_POI_PREFIX}${a.placeId ?? a.id}`;
}
