import type { Bilingual, PoiDef, RealInfo } from '../../core/types';
import type { SfPlaceKind } from '../../world/sf/format';
import { LANDMARK_ARRIVALS } from './arrivals';
import { SF_LANDMARK_INFO, type SfLandmarkInfo } from './landmarks';

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

/** zh glossary: the words the city's HUD labels (far.zones) and dialogue use, applied to every city card string. */
export const ZH_GLOSSARY: readonly (readonly [from: string, to: string])[] = [
  ['双子峰', '双峰'],
  ['码头区 Marina', '马里纳区'],
  ['码头区', '马里纳区'],
  ['缆车', '叮当车'],
  ['卡斯楚区', '卡斯特罗'],
  ['卡斯楚', '卡斯特罗'],
  ['Presidio', '要塞公园'],
];
export function glossZh(text: string): string {
  let out = text;
  for (const [from, to] of ZH_GLOSSARY) out = out.split(from).join(to);
  return out;
}
const gloss = (b: Bilingual): Bilingual => ({ zh: glossZh(b.zh), en: b.en });

/** BAYLINK's general San Francisco guide (the fallback for month-tagged guides). */
export const SF_GUIDE_SLUG = 'san-francisco-guide';
const MONTHS = /(january|february|march|april|may|june|july|august|september|october|november|december)/i;
/** A guide tied to one month or year goes stale: not linked from a permanent card. */
export const isMonthTagged = (slug: string) => MONTHS.test(slug) || /-20\d\d(-|$)/.test(slug);

/** Planner places D2 attached that name a neighbouring spot rather than the landmark itself. */
const PLANNER_DROP = new Set(['ghirardelli-square']);

type Photo = NonNullable<RealInfo['photo']>;
/**
 * Licensed photos from src/data/sf-landmark-photo-assets.json (small 480 w variants, credits as published there),
 * only where the photo shows this landmark (the Castro photo is the crosswalk, not the theatre: not reused).
 */
export const CITY_PHOTOS: Record<string, Photo & { page: string }> = {
  'golden-gate-bridge': { src: '/guides/attractions/sf-bridge-small.webp', credit: 'Frank Schulenburg / Wikimedia Commons (resized)', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:Golden_Gate_Bridge_as_seen_from_Battery_East.jpg' },
  'palace-of-fine-arts': { src: '/guides/attractions/sf-palace-small.webp', credit: 'Daderot / Wikimedia Commons (resized)', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en', page: 'https://commons.wikimedia.org/wiki/File:Lagoon_-_Palace_of_Fine_Arts_-_San_Francisco,_CA_-_DSC02422.jpg' },
  'dragon-gate': { src: '/guides/attractions/sf-chinatown-small.webp', credit: 'Bob B. Brown / Wikimedia Commons (resized)', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0', page: 'https://commons.wikimedia.org/wiki/File:San_Francisco_California,_February_2023_-_Dragon_Gate.jpg' },
  'conservatory-of-flowers': { src: '/guides/distinct/ggp-conservatory-small.webp', credit: 'Fastily / Wikimedia Commons (resized)', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:Exterior_of_the_Conservatory_of_Flowers_1_2016-11-13.jpg' },
  'painted-ladies': { src: '/guides/editorial/neighborhood-small.webp', credit: 'dconvertini / Wikimedia Commons (resized)', license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0', page: 'https://commons.wikimedia.org/wiki/File:Alamo_Square,_San_Francisco,_California,_USA_-_52461549392.jpg' },
  'lombard-crooked-street': { src: '/guides/sf-map/lombard-small.webp', credit: 'Mattias Hill / Wikimedia Commons (resized)', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0', page: 'https://commons.wikimedia.org/wiki/File:Lombard_street_in_San_Francisco.jpg' },
  'cable-car-turntable': { src: '/guides/sf-map/cable-car-small.webp', credit: 'JCruzTheTruth / Wikimedia Commons (resized)', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:Cable_Car_No._15,_Powell_Market_turntable,_San_Francisco_(2012).jpg' },
  'twin-peaks': { src: '/guides/sf-map/twin-peaks-small.webp', credit: 'King of Hearts / Wikimedia Commons (resized)', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', page: 'https://commons.wikimedia.org/wiki/File:San_Francisco_from_Twin_Peaks_September_2013_panorama_5_edit.jpg' },
  'sutro-baths': { src: '/guides/sf-map/sutro-small.webp', credit: 'Dietmar Rabich / Wikimedia Commons (resized)', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:San_Francisco_(CA,_USA),_Sutro_Baths_--_2022_--_3045.jpg' },
  'de-young-tower': { src: '/guides/sf-map/de-young-small.webp', credit: 'WolfmanSF / Wikimedia Commons (resized)', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', page: 'https://commons.wikimedia.org/wiki/File:De_Young_Museum_pano.jpg' },
  'city-hall': { src: '/guides/sf-map/city-hall-small.webp', credit: 'Bernard Spragg. NZ / Wikimedia Commons (resized)', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en', page: 'https://commons.wikimedia.org/wiki/File:San_Francisco_City_Hall._(37843070504).jpg' },
  'oracle-park': { src: '/guides/sf-map/oracle-park-small.webp', credit: 'Missvain / Wikimedia Commons (resized)', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en', page: 'https://commons.wikimedia.org/wiki/File:Oracle_Park_-_August_2025_-_Sarah_Stierch_-_09.jpg' },
};

function cityPoi(info: SfLandmarkInfo): PoiDef {
  const at = LANDMARK_ARRIVALS[info.id] ?? { x: 0, z: 0 };
  const photo = CITY_PHOTOS[info.id];
  const guideSlug = info.guideSlug && isMonthTagged(info.guideSlug) ? SF_GUIDE_SLUG : info.guideSlug;
  const real = info.realInfo;
  return {
    id: cityPoiId(info.id),
    name: gloss(info.name),
    position: { x: at.x, z: at.z },
    radius: 4,
    ...(info.plannerPlaceId && !PLANNER_DROP.has(info.id) ? { plannerPlaceId: info.plannerPlaceId } : {}),
    ...(guideSlug ? { guideSlug } : {}),
    interaction: { kind: 'info', verb: { zh: '看看这里的介绍卡', en: 'Read about this place' } },
    bark: gloss(info.bark),
    realInfo: {
      ...real,
      summary: gloss(real.summary),
      tips: real.tips.map(gloss),
      ...(real.hours ? { hours: gloss(real.hours) } : {}),
      ...(real.cost ? { cost: gloss(real.cost) } : {}),
      ...(photo ? { photo: { src: photo.src, credit: photo.credit, license: photo.license, licenseUrl: photo.licenseUrl } } : {}),
    },
  };
}

/** The 24 landmark cards, in the registry's order. */
export const CITY_POIS: PoiDef[] = SF_LANDMARK_INFO.map(cityPoi);

/** The landmark's zone label, glossed (for the card eyebrow and "附近有什么"). */
export const CITY_POI_ZONES: Record<string, Bilingual> = Object.fromEntries(SF_LANDMARK_INFO.map(info => [cityPoiId(info.id), gloss(info.zone)]));
/** Official sites (PoiCard's 官网 button), only where D2 recorded a real official site. */
export const CITY_POI_OFFICIAL_URLS: Record<string, string> = Object.fromEntries(SF_LANDMARK_INFO.flatMap(info => (info.officialUrl ? [[cityPoiId(info.id), info.officialUrl]] : [])));
/** Secondary fact sources (PoiCard's 更多来源). */
export const CITY_POI_EXTRA_SOURCES: Record<string, string[]> = Object.fromEntries(SF_LANDMARK_INFO.filter(info => info.sources.length).map(info => [cityPoiId(info.id), [...info.sources]]));
/** Photo file pages keyed by photo src (PoiCard's credit link). */
export const CITY_PHOTO_SOURCE_PAGES: Record<string, string> = Object.fromEntries(Object.values(CITY_PHOTOS).map(photo => [photo.src, photo.page]));
/** Telescope / photo captions for the landmarks (content.subjectFact), keyed by landmark id. */
export const CITY_SUBJECT_FACTS: Record<string, { name: Bilingual; fact: Bilingual; sourceUrl: string; verifiedAt: string }> = Object.fromEntries(
  SF_LANDMARK_INFO.map(info => [info.id, { name: gloss(info.name), fact: gloss(info.bark), sourceUrl: info.realInfo.sourceUrl, verifiedAt: info.realInfo.verifiedAt }]),
);

// ---------------------------------------------------------------------------------------------------------------
// City places that are not landmarks (G1's request 3): `openPanel('poi', 'sf:<placeId>')`
// ---------------------------------------------------------------------------------------------------------------

/** What a place is, for its card (world/sf/format SfPlaceKind). */
export const PLACE_KIND_NAMES: Record<SfPlaceKind, Bilingual> = {
  landmark: { zh: '地标', en: 'Landmark' }, bridge: { zh: '桥', en: 'Bridge' }, island: { zh: '岛', en: 'Island' },
  skyscraper: { zh: '高楼', en: 'Skyscraper' }, park: { zh: '公园', en: 'Park' }, museum: { zh: '博物馆', en: 'Museum' },
  waterfront: { zh: '海滨', en: 'Waterfront' }, transit: { zh: '交通站点', en: 'Transit stop' }, street: { zh: '街道', en: 'Street' },
  plaza: { zh: '广场', en: 'Plaza' }, civic: { zh: '公共建筑', en: 'Civic building' }, stadium: { zh: '球场', en: 'Stadium' },
  historic: { zh: '历史古迹', en: 'Historic site' }, neighbourhood: { zh: '街区', en: 'Neighbourhood' }, garden: { zh: '花园', en: 'Garden' },
  beach: { zh: '海滩', en: 'Beach' }, trail: { zh: '步道', en: 'Trail' }, hill: { zh: '山丘', en: 'Hill' }, tower: { zh: '塔', en: 'Tower' },
  water: { zh: '水域', en: 'Water' }, attraction: { zh: '景点', en: 'Attraction' }, viewpoint: { zh: '观景点', en: 'Viewpoint' },
  peak: { zh: '山顶', en: 'Peak' },
};

/** The fields of G1's CityPlace (data/sf/places.ts) a place card reads. */
export interface PlaceCardInput { id: string; name: Bilingual; kind: SfPlaceKind; landmark?: string; poi?: string }

/**
 * What `openPanel('poi', id)` shows for a city id that is not a POI (PoiCard): a place standing for a landmark opens
 * that landmark's card, a hero place merged with a district POI opens the POI's card, any other place gets its own
 * place card. `id` is `sf:<placeId>`; `lookup` is G1's placeById.
 */
export function placeCardTarget<P extends PlaceCardInput>(id: string | undefined, lookup: (placeId: string) => P | undefined): { poi: string } | { place: P } | null {
  if (!id?.startsWith(CITY_POI_PREFIX)) return null;
  const place = lookup(id.slice(CITY_POI_PREFIX.length));
  if (!place) return null;
  if (place.landmark) return { poi: cityPoiId(place.landmark) };
  if (place.poi) return { poi: place.poi };
  return { place };
}

/** A place's name for the card title: the glossary on zh (OSM zh names are sometimes the English name). */
export const placeCardName = (name: Bilingual): Bilingual => gloss(name);
