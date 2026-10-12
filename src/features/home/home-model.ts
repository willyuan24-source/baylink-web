import type { MonthlyRegion } from '../../data/monthly-types';
import type { Copy } from '../../lib/event-facts';

/**
 * Small pure helpers for the home sections (plan WEB-HOME). The events column's equivalents live in
 * features/events/events-model.ts, which reads the full events index, so the home keeps its own few lines.
 */
export const REGION_LABELS: Readonly<Record<MonthlyRegion, Copy>> = {
  sf: { zh: '旧金山', en: 'San Francisco' },
  'east-bay': { zh: '东湾', en: 'East Bay' },
  peninsula: { zh: '半岛', en: 'Peninsula' },
  'south-bay': { zh: '南湾', en: 'South Bay' },
  'north-bay': { zh: '北湾', en: 'North Bay' },
};

/** M/D, as trust rows print it ("官网核对 10/2"). */
export const monthDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

const WEEKDAYS_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
/** "10 月 12 日 周一" / "Mon, Oct 12": the home dateline. */
export function longDate(day: string, english: boolean): string {
  const date = new Date(`${day}T12:00:00Z`);
  if (english) return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
  return `${Number(day.slice(5, 7))} 月 ${Number(day.slice(8, 10))} 日 ${WEEKDAYS_ZH[date.getUTCDay()]}`;
}

/** "10/17–18" / "10/31–11/1": a weekend's two days. */
export function weekendRange(start: string, end: string): string {
  return start.slice(0, 7) === end.slice(0, 7) ? `${monthDay(start)}–${Number(end.slice(8, 10))}` : `${monthDay(start)}–${monthDay(end)}`;
}

/**
 * A guide title's head before its first colon (≥4 characters), from the already-translated title — the same rule as the
 * guide pages' splitGuideTitle (features/guides/guide-facts.ts, which loads the guide catalog, so it is not imported here).
 */
export function guideTitleHead(title: string): string {
  return /^(.{4,}?)\s*[：:｜|]\s*.+$/su.exec(title.trim())?.[1] ?? title.trim();
}

/**
 * Guide topic names (D22) for the intent rail. The same words as src/data/guide-topics.ts GUIDE_TOPICS (a test keeps them
 * equal); that module also carries every guide's slug, which the home does not load.
 */
export const TOPIC_LABELS: Readonly<Record<string, Copy>> = {
  elders: { zh: '长辈与家属', en: 'Seniors & family' },
  health: { zh: '医疗保险', en: 'Health & insurance' },
  documents: { zh: '证件与移民', en: 'IDs & immigration' },
  housing: { zh: '住房', en: 'Housing' },
  transport: { zh: '出行', en: 'Getting around' },
  savings: { zh: '省钱福利', en: 'Savings & benefits' },
  outings: { zh: '周末出游', en: 'Weekend outings' },
};
