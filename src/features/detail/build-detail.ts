import { localDiscoveries, type LocalDiscovery } from '../../data/local-discoveries';
import { MONTHLY_EDITION, MONTHLY_EVENTS } from '../../data/monthly-edition';
import type { MonthlyEvent } from '../../data/monthly-types';
import { EVENT_DATE_OVERRIDES } from '../../data/event-calendar-dates';
import { GUIDE_IMAGES } from '../../data/guide-media';
import { getDiscoveryMetadata } from '../../lib/discovery-metadata';
import { placeFor } from '../../lib/planner';
import { coverItemFor, getCover, type CoverAsset, type CoverKind } from '../../lib/cover';
import { COVER_TABLES, coverCandidates, type CandidateRecord, type CoverTables } from '../../lib/cover-candidates';
import { slimListingImage } from '../../lib/listing-image';
import { detailKey, detailShare, nextEventDay, type DetailRecord, type RailEvent } from './detail-record';

/**
 * Builds the per-detail records (detail-record.ts) from the full catalogs. Build-time only: scripts/
 * generate-detail-records.ts, scripts/prerender.tsx and tests import it; the app never does (the route would carry every
 * catalog again; tests/detail-route-data.test.ts walks the route's imports).
 */

/** Listings whose date is unknown to the build keep every candidate the edition still lists. */
const cutoff = MONTHLY_EDITION.checkedAt;
/**
 * Candidates kept per record: three same-category cards (live page) or four "接下来可以去" cards (ended page), and the desktop
 * column's three "附近还有" rows, with spares. An offer or an opening keeps its own eight: the page's closing photo row
 * (four) and the column's rows (three; R2 B P21 / C P17).
 */
const RAIL_SIZE = 8;
const RAIL_SAME = 5;

const withOverrides = <T extends Pick<MonthlyEvent, 'id' | 'occurrenceDates'>>(event: T): T =>
  Object.hasOwn(EVENT_DATE_OVERRIDES, event.id) ? { ...event, occurrenceDates: EVENT_DATE_OVERRIDES[event.id] } : event;

/** A registry image that may be a cover candidate: never an AI illustration on an event, offer or opening (cover.ts). */
const listingImage = (key: string): CoverAsset | undefined => {
  const image = Object.hasOwn(GUIDE_IMAGES, key) ? GUIDE_IMAGES[key] as CoverAsset : undefined;
  return image && image.kind !== 'illustration' ? image : undefined;
};

/**
 * DECISIONS 43(b) (captain 10-23): venue photos the B2 approval cleared for "cards and rows only" (items 31–33: small or
 * lettering-led) never become a detail page's hero; the hero falls to the next candidate. Rail cards may still show them.
 * The same keys are close-up-faces.ts WEAK_LEAD_SCENES on main (UI9-IMG-B2-REGISTER); R2-INT may read that set instead.
 */
export const CARDS_ONLY_PHOTOS: ReadonlySet<string> = new Set([
  'venue-smcl-brisbane-library', // Brisbane Library: 1250 × 598, too small for a hero
  'venue-smcl-atherton-library', // Atherton Library: the entrance lettering is the subject
  'venue-sjpl-calabazas-library', // Calabazas Branch: a wall of cast names fills a third of it
]);

/** The registry and candidate tables the picker reads (tests pass their own). */
export type CandidateSources = { images?: Readonly<Record<string, CoverAsset>>; tables?: CoverTables };

/**
 * UI9-IMG-A1b (DECISIONS 21/22): the picture a detail hero or rail card shows when its own image cannot be its cover: the
 * first of its candidates (② venue → ③ stock → ④ approved AI) the ladder accepts whose file the page does not show yet
 * (`claimed`), else the first it accepts. Undefined when its own image is the cover. `hero`: the detail page's hero, which
 * never takes a cards-only photo (CARDS_ONLY_PHOTOS).
 */
export function nextCandidate(kind: CoverKind, record: CandidateRecord, claimed: Set<string>, { hero = false, images = GUIDE_IMAGES as Readonly<Record<string, CoverAsset>>, tables = COVER_TABLES }: CandidateSources & { hero?: boolean } = {}): { key: string; image: CoverAsset } | undefined {
  const own = getCover({ kind, id: record.id, imageKey: record.imageKey }, { images, today: cutoff });
  // An own AI illustration is ④: the pages' listing image leaves it out (listingImage), so a stock picture comes first.
  // An own ①② picture another card on the page already shows (①② once per page) also moves on to the next candidate.
  if (own.tier !== 'type' && own.tier !== 'ai' && !claimed.has(own.image.src) && !(hero && CARDS_ONLY_PHOTOS.has(record.imageKey ?? ''))) { claimed.add(own.image.src); return undefined; }
  // An own AI illustration stays in the list: after the stock pictures (coverCandidates), the last resort before none.
  const accepted = coverCandidates(kind, record, tables).filter(key => (key !== record.imageKey || own.tier === 'ai') && !(hero && CARDS_ONLY_PHOTOS.has(key)))
    .map(key => ({ key, cover: getCover(coverItemFor(kind, { id: record.id, imageKey: key }), { images, today: cutoff }) }))
    .filter(({ cover }) => cover.tier !== 'type');
  const pick = accepted.find(({ cover }) => cover.tier !== 'type' && !claimed.has(cover.image.src)) ?? accepted[0];
  if (!pick || pick.cover.tier === 'type') return undefined;
  claimed.add(pick.cover.image.src);
  return { key: pick.key, image: slimListingImage(pick.cover.image, 'keep') };
}

const sameText = (a: string, b: string) => a.trim().toLocaleLowerCase('en-US') === b.trim().toLocaleLowerCase('en-US');

/**
 * Upcoming events near a page: its region or its city (an offer valid Bay-wide has neither, so every upcoming event is near
 * it), same category first when the page is an event (`category`), then same city, then the nearest day.
 */
function railFor(event: { id: string; category?: MonthlyEvent['category'] }, region: string | undefined, city: string, events: readonly MonthlyEvent[], claimed: Set<string> = new Set()): RailEvent[] {
  const anywhere = !region && !city;
  const candidates = [...new Map(events.map(candidate => [candidate.id, withOverrides(candidate)])).values()]
    .filter(candidate => candidate.id !== event.id && candidate.endDate >= cutoff && candidate.occurrenceDates?.length !== 0
      && (anywhere || (!!region && candidate.region === region) || sameText(candidate.city, city)));
  const rank = (candidate: MonthlyEvent) => (candidate.category === event.category ? 0 : 2) + (sameText(candidate.city, city) ? 0 : 1);
  // Same-category candidates for the live page's rail, then other nearby events for the ended page's "接下来可以去".
  const next = (candidate: MonthlyEvent) => nextEventDay(candidate, cutoff) ?? candidate.startDate;
  const sorted = candidates.sort((a, b) => rank(a) - rank(b) || next(a).localeCompare(next(b)) || a.id.localeCompare(b.id));
  const same = sorted.filter(candidate => candidate.category === event.category).slice(0, RAIL_SAME);
  const others = sorted.filter(candidate => candidate.category !== event.category).slice(0, RAIL_SIZE - same.length);
  return [...same, ...others]
    .map(candidate => {
      const next = nextCandidate('event', candidate, claimed);
      // A rail card prints no caption: its picture carries the caption's signal (UI9-IMG-A1b, listing-image.ts).
      const own = next?.image ?? listingImage(candidate.imageKey);
      const image = own && slimListingImage(own);
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
        ...(next ? { coverKey: next.key } : {}),
      };
    });
}

/** The record one detail page renders; `events` defaults to the published catalog (tests pass fixtures). */
export function buildDetailRecord(item: LocalDiscovery, events: readonly MonthlyEvent[] = MONTHLY_EVENTS): DetailRecord {
  const resolved: LocalDiscovery = item.kind === 'event' ? { kind: 'event', event: withOverrides(item.event) } : item;
  const imageKey = resolved.kind === 'event' ? resolved.event.imageKey : resolved.kind === 'offer' ? resolved.offer.imageKey : resolved.shop.imageKey;
  const own = listingImage(imageKey);
  // The page prints its hero's caption (PageCredits HeroCaption), so the record keeps it; the rights prose stays in the registry.
  const image = own && slimListingImage(own, 'keep');
  const placeId = resolved.kind === 'opening' ? placeFor(`opening-${resolved.shop.id}`)?.id : undefined;
  const claimed = new Set<string>();
  const record: CandidateRecord = resolved.kind === 'event' ? resolved.event : resolved.kind === 'offer' ? resolved.offer : resolved.shop;
  const hero = nextCandidate(resolved.kind, record, claimed, { hero: true });
  const rail = resolved.kind === 'event' ? railFor(resolved.event, resolved.event.region, resolved.event.city, events, claimed)
    : resolved.kind === 'opening' ? railFor({ id: resolved.shop.id }, resolved.shop.region, resolved.shop.city, events, claimed)
    : railFor({ id: resolved.offer.id }, resolved.offer.region, '', events, claimed);
  return { item: resolved, ...(image ? { image } : {}), ...(hero ? { hero } : {}), ...(placeId ? { placeId } : {}), rail, metadata: getDiscoveryMetadata(item) };
}

/** Every published detail, keyed `kind:id` (the id in the page URL). */
export function allDetailRecords(): Map<string, DetailRecord> {
  return new Map(localDiscoveries.map(item => [detailKey(item.kind, detailShare(item).id), buildDetailRecord(item)]));
}
