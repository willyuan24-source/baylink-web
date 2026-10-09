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
 * The CNT editorial overlay, read when present (plan CNT-EVENTS): every field is optional, and every surface falls back
 * to today's fields without it. `sessions` and `price` feed src/lib/event-facts.ts; the rest is shown as written.
 */
export type EditorialOverlay = {
  shortTitle?: string;
  /** One line, ≤30 字: why go. */
  dek?: string;
  sessions?: { date: string; start?: string; end?: string }[];
  price?: { free?: boolean; min?: number; max?: number; note?: string };
  venueShort?: string;
  address?: string;
  /** "4 岁以上" / "全年龄". */
  ageChip?: string;
  tips?: string[];
  /** "10/18、10/25 结束时间待确认" — the part of the date that is not a session. */
  dateNote?: string;
  iconKey?: string;
};

export type IndexPlanning = Pick<PlanningFacts, 'setting' | 'admissionUsd' | 'minAge' | 'maxAge'> & {
  schedule?: PlanningSchedule;
};

/** An event as the column needs it: no summary, plan steps or long date line. `occurrenceDates` has the reviewed date overrides applied. */
export type IndexEvent = Pick<MonthlyEvent, 'id' | 'title' | 'aliases' | 'kind' | 'startDate' | 'endDate' | 'occurrenceDates' | 'region' | 'city' | 'venue'
  | 'category' | 'cost' | 'costLabel' | 'audience' | 'sourceLabel' | 'verifiedAt' | 'imageKey'> & EditorialOverlay & {
  planning?: IndexPlanning;
  location?: Pick<GeoPoint, 'lat' | 'lng' | 'precision' | 'sourceUrl'>;
  /** The calendar's schedule note for this event. */
  note?: string;
};

export type IndexOffer = Pick<FreebieOffer, 'id' | 'brand' | 'title' | 'region' | 'startDate' | 'endDate' | 'weekdays' | 'availability' | 'kind' | 'imageKey' | 'sourceLabel' | 'verifiedAt'>;
export type IndexOpening = Pick<SeptemberOpening, 'id' | 'name' | 'city' | 'region' | 'category' | 'status' | 'openingType' | 'openedOn' | 'imageKey' | 'sourceLabel' | 'verifiedAt'>;
export type IndexBulletin = Pick<RegionalBulletin, 'id' | 'region' | 'label' | 'title' | 'dateLabel' | 'sourceLabel' | 'sourceUrl' | 'verifiedAt' | 'expiresAt'>;
export type IndexImage = GuideImage;

export type EventsIndex = {
  edition: { label: string; checkedAt: string; throughDate: string; startMonth: string };
  events: IndexEvent[];
  offers: IndexOffer[];
  openings: IndexOpening[];
  bulletins: IndexBulletin[];
  images: Record<string, IndexImage>;
  /** English city name → its Chinese name (city-search-aliases), for bilingual city chips. */
  cityNames: Record<string, string>;
};

export type { MonthlyRegion };
