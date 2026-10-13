import type { LocalDiscovery } from '../../data/local-discoveries';
import type { EventEditorial, MonthlyEvent } from '../../data/monthly-types';
import type { CoverAsset } from '../../lib/cover';
import type { PageMetadata } from '../../lib/seo';
import { eventShare, offerShare, openingShare, type EditorialShare } from '../../lib/editorial-share';
import { nextConfirmedEventDate } from '../../lib/event-occurrences';

/**
 * One event, offer or opening detail page as data (ENGSEC-01, RC-33): the listing with its reviewed date overrides
 * applied, its own image record, the upcoming events its rails may show and its page metadata. scripts/
 * generate-detail-records.ts writes one JSON file per detail from the same catalogs as before (build-detail.ts), so a
 * detail route loads its own record instead of importing every event, offer, opening, guide and image.
 * Type-only imports here: this module is in the detail route's bundle.
 */

/** An upcoming event a detail's rails can show: what its card prints, without plan steps or summaries. */
export type RailEvent = Pick<MonthlyEvent, 'id' | 'title' | 'startDate' | 'endDate' | 'occurrenceDates' | 'city' | 'category' | 'cost' | 'audience' | 'imageKey'>
  & Pick<EventEditorial, 'shortTitle' | 'venueShort' | 'price' | 'sessions' | 'iconKey'> & {
    /** The listing image when it can be a cover candidate (never an AI illustration); `getCover` still judges it. */
    image?: CoverAsset;
  };

export type DetailRecord = {
  item: LocalDiscovery;
  /** The listing's registry image (posters and photos; never an AI illustration). */
  image?: CoverAsset;
  /** An opening's planner place, for the action bar's "加入计划". */
  placeId?: string;
  /** Upcoming events nearby, nearest first within each group; pages filter them by the reader's own day. */
  rail: RailEvent[];
  /** Title, description and structured data for the page head (lib/discovery-metadata.ts at generation time). */
  metadata: PageMetadata;
};

export const detailKey = (kind: LocalDiscovery['kind'], id: string) => `${kind}:${id}`;

/** The share and page facts of a listing (lib/editorial-share), without the catalog. */
export const detailShare = (item: LocalDiscovery): EditorialShare =>
  item.kind === 'event' ? eventShare(item.event) : item.kind === 'offer' ? offerShare(item.offer) : openingShare(item.shop);

type Dated = Pick<MonthlyEvent, 'startDate' | 'endDate' | 'occurrenceDates'> & { sessions?: EventEditorial['sessions'] };
/** The listing's confirmed days: overlay sessions when present, else `occurrenceDates` (date overrides already applied). */
const confirmedDays = (event: Dated) => event.sessions?.length ? [...new Set(event.sessions.map(session => session.date))].sort() : event.occurrenceDates;

/** The next confirmed day on or after `today`, or null (ended, or no day confirmed). */
export function nextEventDay(event: Dated, today: string): string | null {
  const occurrenceDates = confirmedDays(event);
  const day = nextConfirmedEventDate({ startDate: event.startDate, endDate: event.endDate, occurrenceDates }, today);
  if (!day || day < event.startDate || day > event.endDate) return null;
  return occurrenceDates === undefined || occurrenceDates.includes(day) ? day : null;
}

/** No day is confirmed at all (`occurrenceDates: []`): postponed or "dates to be announced", which is not "ended". */
export const unconfirmedEvent = (event: Dated) => confirmedDays(event)?.length === 0;

const sameText = (a: string, b: string) => a.trim().toLocaleLowerCase('en-US') === b.trim().toLocaleLowerCase('en-US');

/**
 * Rail cards for the reader's day, relative to the page's event: `sameCategory` keeps its category only ("附近同类活动的
 * 下一场"); otherwise any category ("接下来可以去"). Same city first, then the region; nearest day first.
 */
export function railEvents(page: Pick<MonthlyEvent, 'category' | 'city'>, rail: readonly RailEvent[], today: string, { sameCategory, limit }: { sameCategory: boolean; limit: number }): { event: RailEvent; date: string }[] {
  const near = (event: RailEvent) => sameText(event.city, page.city);
  return rail
    .filter(event => !sameCategory || event.category === page.category)
    .flatMap(event => { const date = nextEventDay(event, today); return date ? [{ event, date }] : []; })
    .sort((a, b) => Number(!near(a.event)) - Number(!near(b.event)) || a.date.localeCompare(b.date) || a.event.id.localeCompare(b.event.id))
    .slice(0, limit);
}

/** A bucket file as written by scripts/generate-detail-records.ts: rail events once per bucket, records list their ids. */
export type DetailBucket = { events: Record<string, RailEvent>; records: Record<string, Omit<DetailRecord, 'rail'> & { rail: string[] }> };
/** The record for `key` from its bucket, rail events filled in; undefined when the bucket has no such detail. */
export function recordFromBucket(bucket: DetailBucket, key: string): DetailRecord | undefined {
  const stored = Object.hasOwn(bucket.records, key) ? bucket.records[key] : undefined;
  return stored && { ...stored, rail: stored.rail.flatMap(id => Object.hasOwn(bucket.events, id) ? [bucket.events[id]] : []) };
}
