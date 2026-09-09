export type MonthlyRegion = 'sf' | 'east-bay' | 'south-bay' | 'peninsula' | 'north-bay';
export type MonthlyEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  dateLabel: string;
  region: MonthlyRegion;
  city: string;
  venue: string;
  category: 'culture' | 'outdoors' | 'food' | 'family';
  cost: 'free' | 'paid' | 'mixed';
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
