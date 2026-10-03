export type CityCurrentUpdate = {
  city: string;
  county: string;
  kind: 'dated' | 'calendar';
  headline: string;
  summary: string;
  dateLabel: string;
  sourceUrl: string;
  sourceLabel: string;
  checkedAt: string;
  imageKey: string;
};
