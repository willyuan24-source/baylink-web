import venuePhotoFile from '../data/venue-photos.json';
import categoryPhotoFile from '../data/category-photos.json';
import aiCoverApprovalFile from '../data/ai-cover-approvals.json';
import { photoCategoryOf, type PhotoCategoryId } from './photo-category';
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

export type VenuePhotos = {
  id: string; name: string; match: string[]; records?: string[]; exclude?: string[]; imageKeys: string[]; approvedAt: string; ownerQuote: string;
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

/** A stable small number from the record id, so a record always starts its category's pictures at the same spot. */
export function idSpot(id: string, size: number): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return size ? hash % size : 0;
}

/** The record's candidates in DECISIONS 22 order, each key once. */
export function coverCandidates(kind: CoverKind, record: CandidateRecord, tables: CoverTables = COVER_TABLES): string[] {
  const keys: string[] = [];
  const add = (key?: string) => { if (key && !keys.includes(key)) keys.push(key); };
  add(record.imageKey);
  for (const venue of venuesFor(kind, record, tables.venues)) venue.imageKeys.forEach(add);
  const category = photoCategoryOf(kind, record);
  const pool = category ? tables.categories[category] ?? [] : [];
  const start = idSpot(record.id, pool.length);
  for (let i = 0; i < pool.length; i++) add(pool[(start + i) % pool.length]);
  const refs = [`${kind}:${record.id}`, ...(category ? [`category:${category}`] : [])];
  for (const approval of tables.ai) if (approval.for?.some(ref => refs.includes(ref))) add(approval.key);
  return keys;
}
