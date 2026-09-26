import type { Locale } from '../../i18n/locale';
import { addDays, todayInBay } from '../data/catalog';
import { ASSETS, POSTCARD_ART } from '../data/assets';
import { POSTCARDS } from '../data/postcards';

const WEEK_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "今天 · 周五" / "9月27日 周六" / "Today" / "Sat, Sep 27" */
export function formatDay(day: string, locale: Locale, today = todayInBay()): string {
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  const w = date.getUTCDay(), m = date.getUTCMonth(), d = date.getUTCDate();
  const en = locale === 'en';
  if (day === today) return en ? `Today · ${WEEK_EN[w]}` : `今天 · ${WEEK_ZH[w]}`;
  if (day === addDays(today, 1)) return en ? `Tomorrow · ${WEEK_EN[w]}` : `明天 · ${WEEK_ZH[w]}`;
  return en ? `${WEEK_EN[w]}, ${MONTH_EN[m]} ${d}` : `${m + 1}月${d}日 ${WEEK_ZH[w]}`;
}

/** The real date window of a result list: "今天到下周五" / "today through next Fri" (7 days), else an explicit end date. */
export function windowLabel(today: string, days: number, locale: Locale): string {
  const end = addDays(today, days);
  const date = new Date(`${end}T12:00:00Z`);
  const w = date.getUTCDay(), m = date.getUTCMonth(), d = date.getUTCDate();
  const en = locale === 'en';
  if (days === 7) return en ? `today through next ${WEEK_EN[w]}` : `今天到下${WEEK_ZH[w]}`;
  return en ? `today through ${WEEK_EN[w]}, ${MONTH_EN[m]} ${d}` : `今天到 ${m + 1} 月 ${d} 日（${WEEK_ZH[w]}）`;
}

/** "BAYLINK 活动库 · 9 月 23 日更新" from catalog.checkedAt — the catalog is a curated snapshot, not a live feed. */
export function catalogUpdatedLabel(checkedAt: string | undefined, locale: Locale): string {
  const day = checkedAt?.slice(0, 10);
  const date = day ? new Date(`${day}T12:00:00Z`) : null;
  const en = locale === 'en';
  if (!date || Number.isNaN(date.getTime())) return en ? 'BAYLINK event catalog' : 'BAYLINK 活动库';
  return en ? `BAYLINK event catalog · updated ${MONTH_EN[date.getUTCMonth()]} ${date.getUTCDate()}` : `BAYLINK 活动库 · ${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日更新`;
}

export function shortDay(day: string, locale: Locale): { top: string; big: string; week: string; month: string } {
  const date = new Date(`${day}T12:00:00Z`);
  const w = date.getUTCDay(), m = date.getUTCMonth(), d = date.getUTCDate();
  const week = locale === 'en' ? WEEK_EN[w] : WEEK_ZH[w];
  const month = locale === 'en' ? MONTH_EN[m] : `${m + 1}月`;
  return { top: `${month} · ${week}`, big: String(d), week, month };
}

/** Join place parts, dropping empty and repeated pieces ("Pier 80 · San Francisco" + "San Francisco"). */
export function joinPlace(parts: (string | null | undefined)[]): string {
  const out: string[] = [];
  for (const part of parts) {
    const text = part?.trim();
    if (!text) continue;
    const lower = text.toLowerCase();
    if (out.some(prev => prev.toLowerCase().includes(lower))) continue;
    out.push(text);
  }
  return out.join(' · ');
}

/** Illustration for a postcard: the assets manifest first, then the content's own image. */
export function postcardImage(id: string): string | undefined {
  return ASSETS.postcards?.[id] ?? POSTCARDS.find(card => card.id === id)?.image;
}

/** Postcard illustration with a responsive srcset (600 / 1200 px) when the manifest has one. */
export function postcardArt(id: string): { src: string; srcSet?: string } | undefined {
  const art = (POSTCARD_ART as Record<string, { large: string; small: string; srcSet: string } | undefined>)[id];
  if (art) return { src: art.small, srcSet: art.srcSet };
  const src = postcardImage(id);
  return src ? { src } : undefined;
}

/**
 * Which postcard illustrates a place card that has no licensed photo. Only ids that exist in POSTCARDS are
 * returned; the card shows the art once that postcard is collected (a small reason to go find it).
 */
const POI_POSTCARD: Record<string, string> = {
  'ferry-building': 'ferry-building-dawn',
  'farmers-market': 'ferry-building-dawn',
  'weekly-board': 'ferry-building-dawn',
  pier14: 'bay-bridge-night',
  pier7: 'pier7-sunset',
  exploratorium: 'exploratorium',
  'filbert-steps': 'filbert-steps',
  'levis-plaza': 'filbert-steps',
  'coit-tower': 'coit-tower',
  'coit-murals': 'coit-tower',
  'sea-lions': 'sea-lions',
  'pier39-carousel': 'sea-lions',
  'streetcar-ferry': 'streetcar',
  'streetcar-green': 'streetcar',
  'streetcar-pier39': 'streetcar',
};
export function postcardForPoi(poiId: string | undefined): string | undefined {
  const id = poiId ? POI_POSTCARD[poiId] ?? (poiId.startsWith('streetcar') ? 'streetcar' : undefined) : undefined;
  return id && POSTCARDS.some(card => card.id === id) ? id : undefined;
}
