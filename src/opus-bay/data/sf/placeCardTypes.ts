import type { Bilingual, PoiDef, RealInfo } from '../../core/types';

/**
 * Wave 4 · lane C · the place cards of the new attractions (plan sf-w4-plan.md §2.2 "Facts", §5.6 W4-C5).
 *
 * This module is the small, eager part: types, limits, validation and the card → PoiDef conversion. The card texts
 * themselves are big and live in two lazy chunks, loaded with `loadPlaceCards()` (dynamic imports, so neither the main
 * GameRoot graph nor the city chunk pays for them until the first card, arrival or tour needs one):
 *
 *   data/sf/placeCards.ts   PLACE_CARDS: full cards for the priority 1–3 attractions of docs/opus-bay/sf-w4-attractions.json
 *                           (owner requests, tier 1, tier 2 on the lines) + CARD_REFRESHES for the 10 built landmarks
 *                           that become loop / tour stops (status notes, current hours)
 *   data/sf/placeCards2.ts  PLACE_CARDS_2: short cards for the priority 4 attractions; CURATED_CARDS: full cards for
 *                           Alcatraz, Golden Gate Park, the Presidio, Crissy Field and PIER 39 (lane P ids)
 *
 * Every card is keyed by its Attraction id (data/sf/attractionTypes.ts; = the attractions.json id). Rules (tested in
 * tests/opus-bay-sf-cards.test.ts):
 * - facts re-checked on the web on `verifiedAt` (2026-09-27); `sourceUrl` = the page the main facts come from,
 *   `sources` = the others; `officialUrl` only where the place has a real official site we opened;
 * - hours and prices are cautious ("约", "以官网为准", "出发前查官网确认"); closures and works are a `status` line;
 * - names of brands / businesses appear in card text only (never on a model), no copies of artworks are promised;
 *   pandas, the old name of UC Law SF and the Rivera mural "on show" never appear;
 * - memorials, churches and temples are `quiet` (BAYBAY speaks softly, no stamp fanfare, no gameplay objects);
 * - `bark` is BAYBAY's arrival bubble: zh ≤ 45 (bubble width, ASCII counts half), en ≤ 110.
 */

export const CARD_VERIFIED_AT = '2026-09-27';

/** The zh length limits (bubble width: CJK = 1, ASCII = 0.5, spaces 0) the card UI and bubbles are laid out for. */
export const CARD_LIMITS = { bark: 45, summary: 100, tip: 64, hours: 72, cost: 56, status: 64 } as const;
/** English limits (characters). */
export const CARD_LIMITS_EN = { bark: 110, summary: 300, tip: 170, hours: 180, cost: 150, status: 170 } as const;

/** A closure, a construction note or a change the player should know before going. */
export interface CardStatus {
  kind: 'closed' | 'works' | 'changing';
  text: Bilingual;
  /** YYYY or YYYY-MM when the state is expected to end (re-check then) */
  until?: string;
}

export interface PlaceCard {
  /** Attraction id (sf-w4-attractions.json id) */
  id: string;
  /** the place-index id the card decorates when it is not `id` itself (an existing curated / OSM row) */
  place?: string;
  /** full card (priorities 1–3) or short card (priority 4) */
  depth: 'full' | 'short';
  name: Bilingual;
  /** the neighbourhood / area eyebrow (VOICE.md glossary: 金门公园, 教会区, 日落区 …) */
  zone: Bilingual;
  /** BAYBAY's arrival bubble (the arrival moment's line; ≤ 45 zh) */
  bark: Bilingual;
  summary: Bilingual;
  /** 2–3 on a full card, 0–1 on a short card */
  tips: Bilingual[];
  hours?: Bilingual;
  cost?: Bilingual;
  status?: CardStatus;
  /** memorial / church / temple: a quiet tone */
  quiet?: boolean;
  officialUrl?: string;
  /** where the main facts come from */
  sourceUrl: string;
  /** secondary sources (at least one more on a full card) */
  sources: string[];
  /** YYYY-MM-DD the facts were checked */
  verifiedAt: string;
  lat: number;
  lng: number;
  /** BAYLINK guide slug (public/baybay-guides.json) and planner place id (public/planner-catalog.json), when one fits */
  guideSlug?: string;
  plannerPlaceId?: string;
  /** key into src/data/sf-landmark-photo-assets.json (licensed photo; PoiCard shows the -small.webp) */
  photoKey?: string;
  /**
   * `place` is a row another card owns at runtime (a modelled landmark's place, or a hero place merged with a district
   * POI: data/sf/places.ts buildPlaceIndex). The row keeps that card; this card opens as `sf:<id>` and does not claim
   * the row (japan-center on the Peace Pagoda row, the marketplace on the Ferry Building row). Tested against the
   * runtime place index in tests/opus-bay-sf-cards.test.ts.
   */
  sharesPlace?: true;
}

/** Patch for an already-built landmark card (data/sf/landmarks.ts SF_LANDMARK_INFO), applied by data/sf/cityPois.ts. */
export interface CardRefresh {
  status?: CardStatus;
  /** replaces realInfo.hours */
  hours?: Bilingual;
  /** replaces realInfo.cost */
  cost?: Bilingual;
  /** appended to realInfo.tips (after the existing ones) */
  addTips?: Bilingual[];
  sources: string[];
  verifiedAt: string;
}

/** Bubble width: CJK = 1, ASCII = 0.5, spaces 0 (the same measure as the wave-3 line tests). */
export const zhWidth = (text: string): number => [...text].reduce((sum, ch) => sum + (ch === ' ' ? 0 : ch.charCodeAt(0) < 128 ? 0.5 : 1), 0);

/** Words a card must never contain (plan §2.2 / §7 R9, R10; the attractions.json cautions). */
export const CARD_FORBIDDEN: readonly RegExp[] = [
  /panda/i, /熊猫/, /Hastings/i, /黑斯廷斯/,
  /Yoda statue/i,
];

const bilingualProblems = (b: Bilingual | undefined, what: string, zhMax: number, enMax: number): string[] => {
  if (!b) return [];
  const out: string[] = [];
  if (!b.zh?.trim() || !b.en?.trim()) out.push(`${what}: empty text`);
  if (b.zh && !/[一-鿿]/.test(b.zh)) out.push(`${what}: zh has no Chinese`);
  if (b.en && /[一-鿿]/.test(b.en)) out.push(`${what}: en has Chinese`);
  if (b.zh && zhWidth(b.zh) > zhMax) out.push(`${what}: zh ${zhWidth(b.zh)} > ${zhMax} (${b.zh})`);
  if (b.en && b.en.length > enMax) out.push(`${what}: en ${b.en.length} > ${enMax}`);
  return out;
};

/** Everything wrong with a card ([] = valid). The cards test runs it over every card. */
export function placeCardProblems(card: PlaceCard): string[] {
  const p: string[] = [];
  const at = (what: string) => `${card.id} ${what}`;
  if (!/^[a-z0-9-]+$/.test(card.id)) p.push(at('id is not kebab-case'));
  p.push(...bilingualProblems(card.name, at('name'), 40, 120));
  p.push(...bilingualProblems(card.zone, at('zone'), 24, 80));
  p.push(...bilingualProblems(card.bark, at('bark'), CARD_LIMITS.bark, CARD_LIMITS_EN.bark));
  p.push(...bilingualProblems(card.summary, at('summary'), CARD_LIMITS.summary, CARD_LIMITS_EN.summary));
  card.tips.forEach((tip, i) => p.push(...bilingualProblems(tip, at(`tip ${i}`), CARD_LIMITS.tip, CARD_LIMITS_EN.tip)));
  p.push(...bilingualProblems(card.hours, at('hours'), CARD_LIMITS.hours, CARD_LIMITS_EN.hours));
  p.push(...bilingualProblems(card.cost, at('cost'), CARD_LIMITS.cost, CARD_LIMITS_EN.cost));
  p.push(...bilingualProblems(card.status?.text, at('status'), CARD_LIMITS.status, CARD_LIMITS_EN.status));
  if (card.depth === 'full' && (card.tips.length < 1 || card.tips.length > 3)) p.push(at(`full card has ${card.tips.length} tips (1–3)`));
  if (card.depth === 'short' && card.tips.length > 1) p.push(at(`short card has ${card.tips.length} tips (0–1)`));
  if (!/^https:\/\//.test(card.sourceUrl)) p.push(at('sourceUrl is not https'));
  for (const s of card.sources) if (!/^https?:\/\//.test(s)) p.push(at(`source ${s} is not a URL`));
  if (card.sources.includes(card.sourceUrl)) p.push(at('sourceUrl repeated in sources'));
  if (card.depth === 'full' && card.sources.length < 1) p.push(at('full card needs a second source'));
  if (card.officialUrl && !/^https:\/\//.test(card.officialUrl)) p.push(at('officialUrl is not https'));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(card.verifiedAt)) p.push(at('verifiedAt is not YYYY-MM-DD'));
  if (!(card.lat > 37.6 && card.lat < 37.9 && card.lng > -122.6 && card.lng < -122.3)) p.push(at('lat / lng outside San Francisco'));
  const all = [card.name, card.zone, card.bark, card.summary, ...card.tips, card.hours, card.cost, card.status?.text]
    .filter((b): b is Bilingual => !!b).map(b => `${b.zh} ${b.en}`).join(' ');
  for (const re of CARD_FORBIDDEN) if (re.test(all)) p.push(at(`forbidden word ${re}`));
  return p;
}

/**
 * `openPanel('poi', id)` id of a card (same prefix as the landmark cards: data/sf/cityPois.ts CITY_POI_PREFIX): the
 * place row it decorates, or its own id when it has no row of its own or shares a row another card owns.
 */
export const cardPoiId = (card: Pick<PlaceCard, 'id' | 'place' | 'sharesPlace'>): string => `sf:${card.sharesPlace ? card.id : card.place ?? card.id}`;

/**
 * The card as a PoiDef, so PoiCard / "附近有什么" / the E prompt reuse the POI machinery (like cityPois.ts). `at` =
 * the attraction's arrival spot (walkable); `photo` = the licensed photo resolved from `photoKey` by the caller.
 */
export function placeCardPoi(card: PlaceCard, at: { x: number; z: number }, photo?: RealInfo['photo']): PoiDef {
  const tips = card.status ? [card.status.text, ...card.tips] : card.tips;
  return {
    id: cardPoiId(card),
    name: card.name,
    position: { x: at.x, z: at.z },
    radius: 4,
    ...(card.plannerPlaceId ? { plannerPlaceId: card.plannerPlaceId } : {}),
    ...(card.guideSlug ? { guideSlug: card.guideSlug } : {}),
    interaction: { kind: 'info', verb: { zh: '看看这里的介绍卡', en: 'Read about this place' } },
    bark: card.bark,
    realInfo: {
      summary: card.summary,
      tips,
      ...(card.hours ? { hours: card.hours } : {}),
      ...(card.cost ? { cost: card.cost } : {}),
      sourceUrl: card.sourceUrl,
      verifiedAt: card.verifiedAt,
      lat: card.lat,
      lng: card.lng,
      ...(photo ? { photo } : {}),
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Lazy loading
// ---------------------------------------------------------------------------------------------------------------

export interface PlaceCardSet {
  cards: readonly PlaceCard[];
  refreshes: Readonly<Record<string, CardRefresh>>;
  /** attraction id → card */
  byId: ReadonlyMap<string, PlaceCard>;
  /** place-index id → card (a card decorating an existing row it owns, and every card by its own id) */
  byPlace: ReadonlyMap<string, PlaceCard>;
}

/** Index a list of cards (pure; the loader and the tests use it). */
export function indexPlaceCards(cards: readonly PlaceCard[], refreshes: Readonly<Record<string, CardRefresh>> = {}): PlaceCardSet {
  const byId = new Map<string, PlaceCard>();
  const byPlace = new Map<string, PlaceCard>();
  for (const card of cards) {
    byId.set(card.id, card);
    byPlace.set(card.id, card);
    if (card.place && !card.sharesPlace) byPlace.set(card.place, card);
  }
  return { cards, refreshes, byId, byPlace };
}

/**
 * The card a place row opens, or null when the row keeps another card or has none. The integration's order in
 * data/sf/cityPois.ts placeCardTarget: the landmark card → the district POI card → this → the generic place card
 * (a row standing for a landmark or merged with a district POI never loses that card to a wave-4 card).
 */
export function placeCardForPlace(set: PlaceCardSet | null, place: { id: string; landmark?: string; poi?: string }): PlaceCard | null {
  if (!set || place.landmark || place.poi) return null;
  return set.byPlace.get(place.id) ?? null;
}

/** The card behind a `sf:<id>` POI id (`cardPoiId`), for interactables' resolver; null for other ids. */
export function placeCardByPoiId(set: PlaceCardSet | null, poiId: string): PlaceCard | null {
  if (!set || !poiId.startsWith('sf:')) return null;
  const card = set.byPlace.get(poiId.slice(3));
  return card && cardPoiId(card) === poiId ? card : null;
}

/**
 * A load-once loader that can be retried: a failed chunk import (a flaky phone network, a stale chunk hash after a
 * deploy) is not cached, so the next call tries again (the same rule as data/sf/places.ts loadPlaces).
 */
export function createCardLoader(importChunks: () => Promise<PlaceCardSet>) {
  let set: PlaceCardSet | null = null;
  let pending: Promise<PlaceCardSet> | null = null;
  return {
    load(): Promise<PlaceCardSet> {
      if (set) return Promise.resolve(set);
      pending ??= importChunks().then(
        s => { set = s; return s; },
        error => { pending = null; throw error; },
      );
      return pending;
    },
    now: (): PlaceCardSet | null => set,
  };
}

const LOADER = createCardLoader(() => Promise.all([import('./placeCards'), import('./placeCards2')])
  .then(([a, b]) => indexPlaceCards([...a.PLACE_CARDS, ...b.PLACE_CARDS_2, ...b.CURATED_CARDS], a.CARD_REFRESHES)));

/** Load both card chunks once (the city chunk calls it when city mode starts; later calls return the same set). */
export const loadPlaceCards = (): Promise<PlaceCardSet> => LOADER.load();

/** The loaded set, or null before `loadPlaceCards()` resolved (sync readers: arrival barks, PoiCard). */
export const placeCardsNow = (): PlaceCardSet | null => LOADER.now();
/** The card of an attraction id (null until loaded / unknown). */
export const placeCardNow = (id: string): PlaceCard | null => LOADER.now()?.byId.get(id) ?? null;
