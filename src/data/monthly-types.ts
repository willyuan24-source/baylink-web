export type MonthlyRegion = 'sf' | 'east-bay' | 'south-bay' | 'peninsula' | 'north-bay';
export type MonthlyEvent = {
  id: string;
  title: string;
  /** Reviewed names used for discovery; aliases do not add dates or program guarantees. */
  aliases?: string[];
  kind?: 'event' | 'performance' | 'meetup' | 'sports';
  startDate: string;
  endDate: string;
  /** Explicit confirmed days for non-continuous programs; [] means none confirmed. */
  occurrenceDates?: string[];
  dateLabel: string;
  region: MonthlyRegion;
  city: string;
  venue: string;
  category: 'culture' | 'outdoors' | 'food' | 'family';
  cost: 'free' | 'paid' | 'mixed' | 'unknown';
  costLabel: string;
  summary: string;
  plan: string[];
  audience: string[];
  officialUrl: string;
  sourceLabel: string;
  verifiedAt: string;
  imageKey: string;
  relatedGuideSlug?: string;
} & EventEditorial;

/** One confirmed day of an event; times are 24-hour "HH:MM" Bay Area local time when the source states them. */
export type EditorialSession = { date: string; start?: string; end?: string };
/** Structured admission: `free` only when entry is free, `min`/`max` in USD, `note` for a short condition. */
export type EditorialPrice = { free?: boolean; min?: number; max?: number; note?: string };
/**
 * A dated source read's state of the item, for schema, share cards and badges (the labels say it in words too):
 * `postponed` — no confirmed day yet (`occurrenceDates: []`, the original date in `dateNote`), which is not "ended";
 * `cancelled` — will not take place; `sold_out` — takes place, but nothing is on sale now.
 */
export type EditorialStatus = 'postponed' | 'cancelled' | 'sold_out';
/**
 * Reader-facing short forms and structured facts from the editorial overlay (`src/data/editorial-overlay`).
 * Every field is optional; cards and detail pages fall back to the full fields (`src/lib/event-facts.ts`).
 */
export type EventEditorial = {
  /** Card title, ≤16 display units (CJK 1, Latin ½), no colon. */
  shortTitle?: string;
  /** "Why go" line, ≤30 display units. */
  dek?: string;
  /** Confirmed days with start/end times; when present they are the event's confirmed days. */
  sessions?: EditorialSession[];
  price?: EditorialPrice;
  /** Short place for a meta line ("Baldwin Park"). */
  venueShort?: string;
  /** Street address for a map link, when the source states one. */
  address?: string;
  /** Age chip ("21+", "0–6 岁"), only from a stated age rule. */
  ageChip?: string;
  /** Up to three tips of ≤40 display units, each adding information no other shown field carries (plan, labels, summary). */
  tips?: string[];
  /** Exceptions to the regular schedule, shown on the detail page only. */
  dateNote?: string;
  /** Set only from a dated source read (`docs/source-reads-2026-10.md`). */
  status?: EditorialStatus;
  /** Optional TypeCover texture icon (`src/components/ui/TypeCover.tsx`). */
  iconKey?: string;
};

export type MonthlyPlace = {
  id: string;
  title: string;
  area: string;
  imageKey: string;
  summary: string;
  plan: string[];
  officialUrl: string;
  sourceLabel: string;
  relatedGuideSlug: string;
};
