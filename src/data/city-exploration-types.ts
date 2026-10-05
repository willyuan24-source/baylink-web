import type { CityCurrentUpdate } from './city-current-types';

export type CityExploration = {
  city: string;
  county: string;
  summary: string;
  places: {
    name: string;
    description: string;
    url: string;
    mapQuery: string;
    scope: 'city' | 'nearby' | 'cross-boundary';
    verifiedAt?: string;
  }[];
  halfDay: string;
  arrival: string;
  residentTip: string;
  transport: string;
  checks: string;
  resources: { label: string; url: string; kind: 'city' | 'events' | 'library' | 'parks' }[];
  verifiedAt: string;
  currentUpdate?: CityCurrentUpdate;
};

export const CITY_EXPLORATION_SLUG = 'bay-area-101-city-exploration-living-guide';
export const CITY_COUNTIES = ['San Francisco', 'San Mateo', 'Santa Clara', 'Alameda', 'Contra Costa', 'Marin', 'Napa', 'Sonoma', 'Solano'] as const;
export const cityExplorationKey = (city: string) => city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const cityExplorationUrl = (city: string, locale = 'zh-Hans') => `/guides/${CITY_EXPLORATION_SLUG}?city=${cityExplorationKey(city)}${locale === 'zh-Hans' ? '' : `&lang=${encodeURIComponent(locale)}`}#city-${cityExplorationKey(city)}`;
