import venuePhotoFile from '../data/venue-photos.json';
import categoryPhotoFile from '../data/category-photos.json';
import aiCoverApprovalFile from '../data/ai-cover-approvals.json';
import { photoCategoryOf, placePhotoCategory, postPhotoCategory, type PhotoCategoryId } from './photo-category';
import type { CoverKind } from './cover';

/**
 * Build-time only (UI9-IMAGES A0): every candidate picture of one listing, in the owner's order (DECISIONS 22), for the
 * catalog generators to write as the record's `imageKeys` (from A1) and for report:covers to project with. Pure: the
 * tables are arguments with the reviewed files as defaults.
 *   ① the record's own image (`imageKey`)
 *   ② its venue's approved photos (src/data/venue-photos.json, approved once per venue)
 *   ③ its photo category's stock pictures (src/data/category-photos.json), starting at a spot fixed by the record id
 *   ④ AI illustrations the owner approved for this record or its category (src/data/ai-cover-approvals.json `for`)
 * Whether each candidate may be shown (rights, age, page de-duplication) is still cover.ts getCover's call.
 */

/**
 * One venue's photos. The approval is the owner's words in chat (`ownerQuote`, a new approval) or, for a photo already
 * approved as this venue's photo before the table existed, the repo file that records it (`approvalRecord`).
 */
export type VenuePhotos = {
  id: string; name: string; match: string[]; records?: string[]; exclude?: string[]; imageKeys: string[]; approvedAt: string;
  ownerQuote?: string; approvalRecord?: string;
};
export type CoverTables = {
  venues: readonly VenuePhotos[];
  categories: Readonly<Partial<Record<PhotoCategoryId, readonly string[]>>>;
  ai: readonly { key: string; for?: readonly string[] }[];
};

export const COVER_TABLES: CoverTables = {
  venues: (venuePhotoFile as { venues: VenuePhotos[] }).venues,
  categories: (categoryPhotoFile as { categories: Partial<Record<PhotoCategoryId, string[]>> }).categories,
  ai: (aiCoverApprovalFile as { approvals: { key: string; for?: string[] }[] }).approvals,
};

/** The fields the candidates read: the record's id and own image, and the text that names its venue. */
export type CandidateRecord = {
  id: string; imageKey?: string; title?: string; venue?: string; brand?: string; name?: string; category?: string;
  kind?: string; openingType?: string; label?: string; planning?: { setting?: string }; audience?: readonly string[];
};

/** The words that name where a record happens: an event's venue, an offer's brand and title, a new shop's name. */
const placeText = (kind: CoverKind, record: CandidateRecord) =>
  (kind === 'event' ? record.venue ?? '' : kind === 'offer' ? `${record.brand ?? ''} ${record.title ?? ''}` : kind === 'opening' ? record.name ?? '' : '').toLowerCase();

/** The venues whose approved photos serve this record. */
export function venuesFor(kind: CoverKind, record: CandidateRecord, venues: CoverTables['venues'] = COVER_TABLES.venues): VenuePhotos[] {
  const ref = `${kind}:${record.id}`;
  const text = placeText(kind, record);
  return venues.filter(venue => !venue.exclude?.includes(ref)
    && (venue.records?.includes(ref) || (!!text && venue.match.some(word => word && text.includes(word.toLowerCase())))));
}

/** Stock pictures over the image budgets' rungs (verify:images: 800 w ≤ 90 KB, 1200 w ≤ 150 KB): every other picture first. */
export const HEAVY_STOCK: ReadonlySet<string> = new Set(['stock-halloween-5']);

/**
 * Macro and texture stock (UI9-R2, round-2 judge B P15 and owner material #2): a pattern or a close-up detail with no scene
 * (candy corn, chalk, hands in soil, a stack of old books, motion blur, bokeh). Fine on a thumbnail, weak as a big picture,
 * so it is never a record's first ③ candidate while its category has a scene picture: the detail hero, a lead that falls
 * back to ③ and every other hero-size slot take the first ③ (UI9-IMAGES DECISIONS 22 order). Checked by eye on 10-23 on
 * all 233 pool pictures (lanes/UI9-R2-COVER-PICK/tools/stock-*.png); kept in code until the image registry carries a tag.
 */
export const MACRO_STOCK: ReadonlySet<string> = new Set([
  'stock-halloween-4', // candy corn filling the frame
  'stock-kids-craft-5', // chalk sticks
  'stock-kids-craft-7', // a ring of coloured pencils
  'stock-green-volunteer-1', // hands in soil
  'stock-book-sale-3', // a stack of old books
  'stock-book-sale-4', // a row of book spines
  'stock-class-workshop-2', // metal type in a tray
  'stock-classical-music-3', // a cello bow, close up
  'stock-dia-de-muertos-5', // one marigold, close up
  'stock-fun-run-3', // running legs in motion blur
  'stock-transit-4', // a painted arrow on a bike lane
  'stock-transit-6', // a passing train in motion blur
  'stock-winter-holidays-4', // out-of-focus lights
  'stock-winter-holidays-6', // a string of lights, close up
  'stock-sports-football-2', // yard lines on turf
  'stock-sports-basketball-4', // a court seen from straight above
  'stock-sports-basketball-5', // an arena in motion blur
  'stock-swap-meet-2', // a heap of puzzle pieces
  'stock-kids-play-1', // puzzle pieces on a table
  'stock-guide-documents-6', // a stack of tabbed papers
  'stock-film-1', // popcorn tubs from above
  'stock-farmers-market-4', // fruit crates from above
  'stock-ice-skating-1', // one skate, close up
]);

/** A stable small number from the record id, so a record always starts its category's pictures at the same spot. */
export function idSpot(id: string, size: number): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return size ? hash % size : 0;
}

/**
 * A category's pictures with a scene picture first (MACRO_STOCK): the first scene picture moves ahead of the macro or
 * texture pictures before it, and the rest keep their order, so the rotation keeps every picture in play for rows and
 * thumbnails.
 */
export function sceneFirst(keys: readonly string[], macro: ReadonlySet<string> = MACRO_STOCK): string[] {
  const scene = keys.findIndex(key => !macro.has(key));
  return scene <= 0 ? [...keys] : [keys[scene], ...keys.slice(0, scene), ...keys.slice(scene + 1)];
}

/**
 * The record's candidates in DECISIONS 22 order, each key once. A record's own image that is an approved AI illustration
 * (a key in ai-cover-approvals.json) is ④, not ①: it goes after the category's stock pictures (UI9-IMG-A1b; the B1b
 * review found the 204 stock pictures unused and AI covers on unrelated records while it led).
 */
export function coverCandidates(kind: CoverKind, record: CandidateRecord, tables: CoverTables = COVER_TABLES, limits: CandidateLimits = {}): string[] {
  const { stock = Infinity } = limits;
  const keys: string[] = [];
  const add = (key?: string) => { if (key && !keys.includes(key)) keys.push(key); };
  const ownIsAi = !!record.imageKey && tables.ai.some(approval => approval.key === record.imageKey);
  if (!ownIsAi) add(record.imageKey);
  for (const venue of venuesFor(kind, record, tables.venues)) venue.imageKeys.forEach(add);
  const category = photoCategoryOf(kind, record);
  const pool = category ? tables.categories[category] ?? [] : [];
  const start = (limits.start ?? idSpot(record.id, pool.length)) % (pool.length || 1);
  // A pool picture whose files miss the 800 w / 1200 w size targets goes after the others (B1b review: stock-halloween-5).
  const rotated = pool.map((_, i) => pool[(start + i) % pool.length]);
  const ordered = sceneFirst([...rotated.filter(key => !HEAVY_STOCK.has(key)), ...rotated.filter(key => HEAVY_STOCK.has(key))]);
  const shown = Math.min(pool.length, stock);
  for (let i = 0; i < shown; i++) add(ordered[i]);
  // A capped list (what a route ships) carries ④ only for a record whose category has no ③ picture.
  if (shown && stock !== Infinity) return keys;
  if (ownIsAi) add(record.imageKey);
  const refs = [`${kind}:${record.id}`, ...(category ? [`category:${category}`] : [])];
  for (const approval of tables.ai) if (approval.for?.some(ref => refs.includes(ref))) add(approval.key);
  return keys;
}

/**
 * How many ③ pictures a record carries (UI9-IMG-A1b, captain 21:15 step 3): a route's catalog ships the record's own ①, its
 * venue's ②, ROUTE_STOCK ③ pictures (rotated by id) and ④ only when its category has no ③. The home catalog keeps the
 * whole pool (owner, DECISIONS 29: the look before bytes on the home), and so does report:covers' projection.
 */
export type CandidateLimits = {
  stock?: number;
  /** Where the record starts its category's pool (default: a spot fixed by its id); categorySpots deals the spots out. */
  start?: number;
};
export const ROUTE_STOCK = 2;
/**
 * A dense category's records carry one more ③ picture (captain 10-22 02:50): halloween fills whole days on /events and
 * /calendar, and birthday perks and library cards fill the 免费与优惠 board; with two candidates each a card often had
 * nothing left but a picture shown a few cards earlier (DECISIONS 22 同页去重).
 */
export const DENSE_STOCK = 3;

/**
 * The photo categories with more than `factor` records per ③ picture in a list (UI9-IMG-A1b): their records ship
 * DENSE_STOCK candidates instead of ROUTE_STOCK.
 */
export function denseCategories(kind: CoverKind, records: readonly CandidateRecord[], tables: CoverTables = COVER_TABLES, factor = 1): Set<PhotoCategoryId> {
  const counts = new Map<PhotoCategoryId, number>();
  for (const record of records) {
    const category = photoCategoryOf(kind, record as Record<string, unknown>);
    if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return new Set([...counts].filter(([category, count]) => count > factor * (tables.categories[category]?.length ?? Infinity)).map(([category]) => category));
}

/**
 * Each record's start in its category's pool, dealt out in list order (UI9-IMG-A1b): the n-th storytime of a list starts at
 * picture n, so records of one category that a page shows side by side lead with different pictures. (A start fixed by the
 * id alone gave two neighbours the same pictures: the 同页去重 repeats report:covers counts.)
 */
export function categorySpots(kind: CoverKind, records: readonly CandidateRecord[]): Map<string, number> {
  const dealt = new Map<PhotoCategoryId, number>();
  const spots = new Map<string, number>();
  for (const record of records) {
    const category = photoCategoryOf(kind, record as Record<string, unknown>);
    if (!category) continue;
    const n = dealt.get(category) ?? 0;
    dealt.set(category, n + 1);
    spots.set(record.id, n);
  }
  return spots;
}

/**
 * The boards' records (offers and new shops: events-boards.json, which the 免费与优惠 and 新店 views load with their own
 * chunks, outside the route budgets) carry their category's whole ③ pool (UI9-R2): a board as it opens then shows no stock
 * picture twice, and one grown with 再看 none within ADJACENT_CARDS cards (measured 10-23 over 17 days: 0, was 4–5 at
 * one to four taps). A number, not Infinity, so the list stops before ④ as a capped one does.
 */
export const BOARD_STOCK = 99;

/**
 * The cap for one record: BOARD_STOCK on a board, else DENSE_STOCK in a dense category and ROUTE_STOCK otherwise (the
 * route's events); its start from categorySpots.
 */
export const routeStock = (kind: CoverKind, record: CandidateRecord, dense: ReadonlySet<PhotoCategoryId>, spots?: ReadonlyMap<string, number>): CandidateLimits => {
  const category = photoCategoryOf(kind, record as Record<string, unknown>);
  const start = spots?.get(record.id);
  const stock = kind === 'offer' || kind === 'opening' ? BOARD_STOCK : category && dense.has(category) ? DENSE_STOCK : ROUTE_STOCK;
  return { stock, ...(start !== undefined ? { start } : {}) };
};

/**
 * What a catalog generator writes for a record's pictures (UI9-IMG-A1a): `imageKey` when its own image is one the catalog
 * ships (`keep`), and `imageKeys`, its shipped candidates, only when they add to that. A record whose own key points at a
 * picture no listing may show (an unapproved AI illustration) carries no key at all, so the route pays for neither.
 */
export function listingImageKeys(kind: CoverKind, record: CandidateRecord, keep: (key: string) => boolean = () => true, tables: CoverTables = COVER_TABLES, limits: CandidateLimits = {}): { imageKey?: string; imageKeys?: string[] } {
  const keys = coverCandidates(kind, record, tables, limits).filter(keep);
  const own = record.imageKey && keep(record.imageKey) ? record.imageKey : undefined;
  // The candidates add to the own key unless they are only that key (an own approved-AI image the route cap left out of
  // `keys` makes any one ③ key a real addition).
  return { ...(own ? { imageKey: own } : {}), ...(keys.length > (own && keys.includes(own) ? 1 : 0) ? { imageKeys: keys } : {}) };
}

/**
 * A place's ③ pictures on /explore (UI9-IMG-A1b), for a place with no usable picture of its own and no 3D postcard: its
 * guide's photo category pool, never city-sights (those show real landmarks, so never on a specific place: B1b review).
 */
export function attractionStockKeys(guide: { slug: string; title: string; category?: string }, tables: CoverTables = COVER_TABLES): string[] {
  const sights = new Set(tables.categories['city-sights'] ?? []);
  const keys = coverCandidates('guide', { id: guide.slug, title: guide.title, category: guide.category }, tables).filter(key => !sights.has(key));
  if (keys.length) return keys;
  // A city guide's own pool is city-sights: the place's kind by its name (library, museum, …), else the outdoors.
  const pool = tables.categories[placePhotoCategory({ id: guide.slug, title: guide.title }) ?? 'nature-walk'] ?? [];
  const start = idSpot(guide.slug, pool.length);
  return pool.map((_, i) => pool[(start + i) % pool.length]);
}

/** A saved neighbourhood post's ③ pictures (postPhotoCategory), starting at a spot fixed by the post id. */
export function postStockKeys(post: { id: string; category?: string }, tables: CoverTables = COVER_TABLES): string[] {
  const pool = tables.categories[postPhotoCategory(post.category)] ?? [];
  const start = idSpot(post.id, pool.length);
  return pool.map((_, i) => pool[(start + i) % pool.length]);
}
