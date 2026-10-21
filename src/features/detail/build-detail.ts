import { localDiscoveries, type LocalDiscovery } from '../../data/local-discoveries';
import { MONTHLY_EDITION, MONTHLY_EVENTS } from '../../data/monthly-edition';
import type { MonthlyEvent } from '../../data/monthly-types';
import { EVENT_DATE_OVERRIDES } from '../../data/event-calendar-dates';
import { GUIDE_IMAGES } from '../../data/guide-media';
import { getDiscoveryMetadata } from '../../lib/discovery-metadata';
import { placeFor } from '../../lib/planner';
import type { CoverAsset } from '../../lib/cover';
import { detailKey, detailShare, nextEventDay, type DetailRecord, type RailEvent } from './detail-record';

/**
 * Builds the per-detail records (detail-record.ts) from the full catalogs. Build-time only: scripts/
 * generate-detail-records.ts, scripts/prerender.tsx and tests import it; the app never does (the route would carry every
 * catalog again; tests/detail-route-data.test.ts walks the route's imports).
 */

/** Listings whose date is unknown to the build keep every candidate the edition still lists. */
const cutoff = MONTHLY_EDITION.checkedAt;
/** Candidates kept per record: three same-category cards (live page) or four "接下来可以去" cards (ended page), with spares. */
const RAIL_SIZE = 8;
const RAIL_SAME = 5;

const withOverrides = <T extends Pick<MonthlyEvent, 'id' | 'occurrenceDates'>>(event: T): T =>
  Object.hasOwn(EVENT_DATE_OVERRIDES, event.id) ? { ...event, occurrenceDates: EVENT_DATE_OVERRIDES[event.id] } : event;

/** A registry image that may be a cover candidate: never an AI illustration on an event, offer or opening (cover.ts). */
const listingImage = (key: string): CoverAsset | undefined => {
  const image = Object.hasOwn(GUIDE_IMAGES, key) ? GUIDE_IMAGES[key] as CoverAsset : undefined;
  return image && image.kind !== 'illustration' ? image : undefined;
};

const sameText = (a: string, b: string) => a.trim().toLocaleLowerCase('en-US') === b.trim().toLocaleLowerCase('en-US');

function railFor(event: MonthlyEvent, region: string, city: string, events: readonly MonthlyEvent[]): RailEvent[] {
  const candidates = [...new Map(events.map(candidate => [candidate.id, withOverrides(candidate)])).values()]
    .filter(candidate => candidate.id !== event.id && candidate.endDate >= cutoff && candidate.occurrenceDates?.length !== 0
      && (candidate.region === region || sameText(candidate.city, city)));
  const rank = (candidate: MonthlyEvent) => (candidate.category === event.category ? 0 : 2) + (sameText(candidate.city, city) ? 0 : 1);
  // Same-category candidates for the live page's rail, then other nearby events for the ended page's "接下来可以去".
  const next = (candidate: MonthlyEvent) => nextEventDay(candidate, cutoff) ?? candidate.startDate;
  const sorted = candidates.sort((a, b) => rank(a) - rank(b) || next(a).localeCompare(next(b)) || a.id.localeCompare(b.id));
  const same = sorted.filter(candidate => candidate.category === event.category).slice(0, RAIL_SAME);
  const others = sorted.filter(candidate => candidate.category !== event.category).slice(0, RAIL_SIZE - same.length);
  return [...same, ...others]
    .map(candidate => {
      const image = listingImage(candidate.imageKey);
      return {
        id: candidate.id, title: candidate.title, startDate: candidate.startDate, endDate: candidate.endDate,
        // A card states the day only: session days become the confirmed days, their times stay on the event's own page.
        ...(candidate.sessions?.length ? { occurrenceDates: [...new Set(candidate.sessions.map(session => session.date))].sort() } : candidate.occurrenceDates !== undefined ? { occurrenceDates: candidate.occurrenceDates } : {}),
        city: candidate.city, category: candidate.category, cost: candidate.cost,
        audience: candidate.audience, imageKey: candidate.imageKey,
        ...(candidate.shortTitle ? { shortTitle: candidate.shortTitle } : {}),
        ...(candidate.venueShort ? { venueShort: candidate.venueShort } : {}),
        ...(candidate.price ? { price: candidate.price } : {}),
        ...(candidate.iconKey ? { iconKey: candidate.iconKey } : {}),
        // The card's ✓ line (owner decisions 17 and 20): the day the source was read, and whether that source is press.
        ...(candidate.verifiedAt ? { verifiedAt: candidate.verifiedAt } : {}),
        ...(candidate.sourceLabel ? { sourceLabel: candidate.sourceLabel } : {}),
        ...(image ? { image } : {}),
      };
    });
}

/** The record one detail page renders; `events` defaults to the published catalog (tests pass fixtures). */
export function buildDetailRecord(item: LocalDiscovery, events: readonly MonthlyEvent[] = MONTHLY_EVENTS): DetailRecord {
  const resolved: LocalDiscovery = item.kind === 'event' ? { kind: 'event', event: withOverrides(item.event) } : item;
  const imageKey = resolved.kind === 'event' ? resolved.event.imageKey : resolved.kind === 'offer' ? resolved.offer.imageKey : resolved.shop.imageKey;
  const image = listingImage(imageKey);
  const placeId = resolved.kind === 'opening' ? placeFor(`opening-${resolved.shop.id}`)?.id : undefined;
  const rail = resolved.kind === 'event' ? railFor(resolved.event, resolved.event.region, resolved.event.city, events) : [];
  return { item: resolved, ...(image ? { image } : {}), ...(placeId ? { placeId } : {}), rail, metadata: getDiscoveryMetadata(item) };
}

/** Every published detail, keyed `kind:id` (the id in the page URL). */
export function allDetailRecords(): Map<string, DetailRecord> {
  return new Map(localDiscoveries.map(item => [detailKey(item.kind, detailShare(item).id), buildDetailRecord(item)]));
}
