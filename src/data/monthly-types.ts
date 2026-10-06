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
