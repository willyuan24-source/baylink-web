import type { MonthlyEvent, MonthlyRegion } from '../../data/monthly-types';
import type { FreebieOffer } from '../../components/FreebieBoard';
import type { SeptemberOpening } from '../../data/september-openings';
import type { GuideImage } from '../../data/guide-media';
import type { GeoPoint, PlanningFacts, PlanningSchedule } from '../../lib/planner';
import type { RegionalBulletin } from '../../data/late-september-local';

/**
 * Shapes of `src/data/generated/events-index.json` (scripts/generate-events-index.ts). Type-only imports: the index is
 * the only data the events column loads (RC-33).
 */

/**
 * The CNT editorial overlay fields a listing uses, read when present (plan CNT-EVENTS): every field is optional, and every
 * surface falls back to today's fields without it. `sessions` and `price` feed src/lib/event-facts.ts; `dek` is searched.
 * The detail-page fields (address, ageChip, tips, dateNote) are not in the index (RC-33).
 */
export type EditorialOverlay = {
  shortTitle?: string;
  /** One line, ≤30 字: why go. */
  dek?: string;
  sessions?: { date: string; start?: string; end?: string }[];
  price?: { free?: boolean; min?: number; max?: number; note?: string };
  venueShort?: string;
  iconKey?: string;
};

/**
 * The time windows a card's hours label reads (src/lib/event-facts.ts eventTimeLabel). The schedule's sourceUrl and
 * verifiedAt stay with the detail page; sessions equal to the overlay's own `sessions` are left out (generate-events-index.ts).
 */
export type IndexSchedule = Pick<PlanningSchedule, 'validFrom' | 'validThrough' | 'weekly' | 'dates' | 'sessions'>;

export type IndexPlanning = Pick<PlanningFacts, 'setting' | 'admissionUsd' | 'minAge' | 'maxAge'> & {
  schedule?: IndexSchedule;
};

/**
 * An event as the column needs it: no summary, plan steps, long date line or source label (a card's trust line reads
 * verifiedAt). The free-text `costLabel` is kept only on mixed-cost events, the one case the 免费 filter reads it
 * (isFreeToAttend); a card's price comes from cost / price / admission. `occurrenceDates` has the reviewed date overrides
 * applied.
 */
export type IndexEvent = Pick<MonthlyEvent, 'id' | 'title' | 'aliases' | 'kind' | 'startDate' | 'endDate' | 'occurrenceDates' | 'region' | 'city' | 'venue'
  | 'category' | 'cost' | 'audience' | 'verifiedAt'> & Partial<Pick<MonthlyEvent, 'costLabel' | 'imageKey'>> & EditorialOverlay & {
  planning?: IndexPlanning;
  location?: Pick<GeoPoint, 'lat' | 'lng' | 'precision' | 'sourceUrl'>;
  /** The calendar's schedule note for this event. */
  note?: string;
  /**
   * The source is a press report, not the organiser's own page (source-kind.ts, the sourceLabel test schema-org.ts uses):
   * the card says 「媒体报道 · M/D 核对」, never 官网核对 (UI-9 DECISIONS 17; UI9-EVENTS). Absent on official sources.
   */
  press?: true;
  /** The cover candidates in the owner's order when they add to `imageKey` (cover-candidates.ts listingImageKeys). */
  imageKeys?: readonly string[];
};

/** `status` comes from the editorial overlay and is only ever `sold_out` (已售罄, for the 免费与优惠 board's status chip;
 * UI9-PREP); an offer that is on sale has none. */
export type IndexOffer = Pick<FreebieOffer, 'id' | 'brand' | 'title' | 'region' | 'startDate' | 'endDate' | 'weekdays' | 'availability' | 'kind' | 'sourceLabel' | 'verifiedAt'> & Partial<Pick<FreebieOffer, 'imageKey'>> & { status?: 'sold_out'; imageKeys?: readonly string[] };
export type IndexOpening = Pick<SeptemberOpening, 'id' | 'name' | 'city' | 'region' | 'category' | 'status' | 'openingType' | 'openedOn' | 'sourceLabel' | 'verifiedAt'> & Partial<Pick<SeptemberOpening, 'imageKey'>> & { imageKeys?: readonly string[] };
export type IndexBulletin = Pick<RegionalBulletin, 'id' | 'region' | 'label' | 'title' | 'dateLabel' | 'sourceLabel' | 'sourceUrl' | 'verifiedAt' | 'expiresAt'>;
export type IndexImage = GuideImage;

export type EventsIndex = {
  edition: { label: string; checkedAt: string; throughDate: string; startMonth: string };
  /**
   * The days the route's own `events` list completely (WEB-PERF-2): every event with a day in [from, through] is in it.
   * `from` is the Monday of the build's week (the calendar's week strip), `through` 8–21 days after the build day, as many
   * as fit the first-screen cap (scripts/generate-events-index.ts). Every other event is in events-later.json.
   */
  near: { from: string; through: string };
  /** The events of the `near` days, in catalog order; the rest load with events-later.json (events-model.ts). */
  events: IndexEvent[];
  bulletins: IndexBulletin[];
  images: Record<string, IndexImage>;
  /** English city name → its Chinese name (city-search-aliases), for bilingual city chips. */
  cityNames: Record<string, string>;
  /** Days this build wrote a dated Bay Area share card for (/weekly/all-{day}.png), as the home page links it. */
  weeklyCardDays: string[];
  /**
   * Home's lead pick per day (home-catalog.json weekends[day].ids[0]) for the days this build's /events can be read on
   * (UI9-EVENTS, G15): /events never opens on the event home just led with. A day without an entry falls back to the first
   * weekend pick (weekend-lead.ts). The home catalog itself is never imported into the events chunk.
   */
  homeLeads?: Record<string, string>;
};

export type { MonthlyRegion };

/**
 * The events outside the route's `near` days (events-later.json, WEB-PERF-2), loaded when a view reaches past them: each
 * event's position in the whole catalog order (`at`, ascending), so the merged list is the catalog's own order, and the
 * images only these events use.
 */
export type EventsLater = {
  events: IndexEvent[];
  at: number[];
  images: Record<string, IndexImage>;
};

/**
 * The 免费与优惠 and 新店 boards' records (events-boards.json, UI9-IMG-A1b; captain 21:15 step 2): every live offer and new
 * shop with the pictures only they use. Split out of the route's events-index.json, so /events and /calendar carry only
 * events and their pictures; the boards' own chunks load it (events-boards.ts), Node installs it at once (events-model.ts).
 */
export type EventsBoards = {
  offers: IndexOffer[];
  openings: IndexOpening[];
  images: Record<string, IndexImage>;
};
