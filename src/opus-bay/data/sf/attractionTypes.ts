import type { Bilingual } from '../../core/types';

/**
 * Wave 4 · attraction types (FROZEN, day 0: docs/opus-bay/sf-w4-lead.md §4, plan sf-w4-plan.md §2 and §4.1).
 * Dependency-free (types + constants). Who fills what:
 * - lane P `data/sf/attractions.ts`: `ATTRACTIONS: Attraction[]` (16 T1, ≈ 45 T2, the rest T3) from
 *   docs/opus-bay/sf-w4-attractions.json + the existing landmarks / famous curated places, merged into the place index;
 *   `data/sf/extraPlaces.ts` holds the new place rows (id = the attraction id);
 * - lane L gives `flag` heights (`siteFlagTop(id)` in world/sf/landmarks/context.ts) and builds by `siteId`;
 * - lane G draws the flags (pennant in the category colour, `glyph` on it) and the arrival card;
 * - lane C writes the cards (keyed by `Attraction.id`), the arrival moments (rank 1–2) and the quiet tone;
 * - lane V paints the T1 stickers (keyed by `Attraction.id`).
 * Positions are in the world city frame (x, z in u, `projectCity`).
 */

/** Map rank = tier: 1 = T1 (16, always shown and labelled, flags), 2 = T2 (≈ 45, from s 0.3), 3 = T3. */
export const ATTRACTION_RANKS = [1, 2, 3] as const;
export type AttractionRank = (typeof ATTRACTION_RANKS)[number];

/** Map category (badge colour + glyph, filter chips). The zoo is a park (PawPrint glyph), islands are coast (Sailboat). */
export const ATTRACTION_CATS = ['landmark', 'museum', 'park', 'viewpoint', 'coast', 'campus', 'shopping', 'sports', 'culture', 'neighbourhood'] as const;
export type AttractionCat = (typeof ATTRACTION_CATS)[number];

/** lucide-react icon names used for attraction badges, flags and stickers (all exist in lucide-react 0.460). */
export const ATTRACTION_GLYPHS = [
  'Landmark', 'Palette', 'Trees', 'PawPrint', 'Mountain', 'Binoculars', 'Waves', 'Sailboat', 'GraduationCap', 'ShoppingBag',
  'Trophy', 'Church', 'Theater', 'Castle', 'Signpost',
] as const;
export type AttractionGlyph = (typeof ATTRACTION_GLYPHS)[number];

/** Category look (plan §4.1): fill / ring colour, default glyph, chip / legend name. */
export const ATTRACTION_CAT_STYLE: Readonly<Record<AttractionCat, { color: string; glyph: AttractionGlyph; name: Bilingual }>> = {
  landmark: { color: '#d8744a', glyph: 'Landmark', name: { zh: '地标', en: 'Landmarks' } },
  museum: { color: '#8a5a9c', glyph: 'Palette', name: { zh: '博物馆', en: 'Museums' } },
  park: { color: '#4f8f5b', glyph: 'Trees', name: { zh: '公园', en: 'Parks' } },
  viewpoint: { color: '#b8862f', glyph: 'Mountain', name: { zh: '观景', en: 'Views' } },
  coast: { color: '#2f8fa3', glyph: 'Waves', name: { zh: '海岸', en: 'Coast' } },
  campus: { color: '#3f5f9f', glyph: 'GraduationCap', name: { zh: '校园', en: 'Campuses' } },
  shopping: { color: '#c8577a', glyph: 'ShoppingBag', name: { zh: '购物', en: 'Shopping' } },
  sports: { color: '#e07a3a', glyph: 'Trophy', name: { zh: '体育', en: 'Sports' } },
  culture: { color: '#8a6a4a', glyph: 'Church', name: { zh: '人文', en: 'Culture' } },
  neighbourhood: { color: '#6f5f47', glyph: 'Signpost', name: { zh: '街区', en: 'Neighbourhoods' } },
};

/** The 景点 list groups (plan §4.1 tabs). */
export type AttractionArea = 'north-downtown' | 'bridge-presidio' | 'coast' | 'park-sunset' | 'twin-peaks-mission' | 'south';
export const ATTRACTION_AREAS: Readonly<Record<AttractionArea, Bilingual>> = {
  'north-downtown': { zh: '北岸与市中心', en: 'North shore & downtown' },
  'bridge-presidio': { zh: '金门大桥与要塞', en: 'Golden Gate & Presidio' },
  coast: { zh: '海岸', en: 'The coast' },
  'park-sunset': { zh: '金门公园与日落区', en: 'Golden Gate Park & the Sunset' },
  'twin-peaks-mission': { zh: '双峰·卡斯特罗·教会区', en: 'Twin Peaks · Castro · Mission' },
  south: { zh: '南区（石镇·州大·湖区）', en: 'The south (Stonestown · SF State · lakes)' },
};

/** How the site is built (plan §2.2): AI mesh, procedural toy model, plaza + card, card only, an already-built
 * landmark that becomes a stop, or card now / model later (inside the frozen hero slab). */
export const ATTRACTION_TREATMENTS = ['ai', 'proc', 'plaza', 'card', 'stop', 'defer'] as const;
export type AttractionTreatment = (typeof ATTRACTION_TREATMENTS)[number];

/** Pole-top height range of the in-world flag above the ground (u; plan §4.2: skyline + 10, clamped). */
export const ATTRACTION_FLAG_H = { min: 28, max: 70 } as const;
/** The in-world flag over an attraction: pole foot (x, z) and pole-top height `h` above the ground there (u, 28–70). */
export interface AttractionFlag { x: number; z: number; h: number }

/** A line stop near the attraction (walking distance `d` in u; `line` = TransitLine id, `stop` = TransitStop id). */
export interface AttractionStop { line: string; stop: string; d: number }

export interface Attraction {
  /** stable id (= the sf-w4-attractions.json id for the new ones; = the place id of a new extraPlaces row) */
  id: string;
  /** the place-index id this attraction decorates (an existing curated / OSM row, or its own extraPlaces row) */
  placeId?: string;
  /** full name (map name = card name) */
  name: Bilingual;
  /** map label: ≤ 5 CJK / ≤ 14 Latin characters (金门大桥, 州立大学, 石镇); the full name shows on selection */
  short?: Bilingual;
  cat: AttractionCat;
  /** glyph override (PawPrint for the zoo, Sailboat for islands, Binoculars, Theater, Castle); default = the cat's */
  glyph?: AttractionGlyph;
  rank: AttractionRank;
  /** label / list priority inside its rank: higher = more famous (0–100, default 50) */
  fame?: number;
  /** anchor (badge position), world city frame */
  x: number;
  z: number;
  /** where 跟 BAYBAY 去 ends and the arrival moment triggers (on the walking graph); absent = the anchor */
  arrival?: { x: number; z: number; heading?: number };
  /** why there is no walkable arrival (alcatraz, bay-bridge, treasure-island): the trip ends at `arrival` instead */
  offWalk?: string;
  area?: AttractionArea;
  flag?: AttractionFlag;
  /** extra search words, zh + en (大学, SFSU, 州大, 石头城, Stonestown …) */
  aliases?: string[];
  /** key into src/data/sf-landmark-photo-assets.json (licensed photo; the -small.webp for thumbs) */
  photoKey?: string;
  /** SfLandmarkInfo id when the attraction is an already-built landmark */
  landmarkId?: string;
  /** lane L's site id (one site can hold several attractions: usf-lone-mountain, music-concourse …) */
  siteId?: string;
  treatment?: AttractionTreatment;
  /** build / card priority (plan §2.3): 1 owner requests, 2 tier 1, 3 tier 2 on a line, 4 tier 3 */
  priority?: 1 | 2 | 3 | 4;
  /** nearest loop / Metro stops (≤ 200 u), nearest first */
  near?: AttractionStop[];
  officialUrl?: string;
  /** one short practical line for the card / peek card ("出发前查官网确认" style lives in the card) */
  visitNote?: Bilingual;
  /** memorials, churches, cemeteries: a quiet tone, no stamp fanfare, no gameplay objects */
  quiet?: boolean;
  /** inside the frozen hero slab: card + badge now, model later (plan §7 R1) */
  hero?: boolean;
  /** a viewpoint where BAYBAY points out the landmarks in view (Twin Peaks, Coit, de Young tower, Grand View,
   * Corona Heights, Bernal Heights) */
  panorama?: boolean;
}
