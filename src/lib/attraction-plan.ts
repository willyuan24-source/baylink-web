import { ATTRACTIONS, ATTRACTION_REGIONS, ATTRACTION_THEMES, type Attraction } from '../data/attractions';
import { localizedUrl, simplifySearch, translateText, type Locale } from '../i18n/locale';
import { SITE_URL } from './seo';

export const OUTING_STORAGE_KEY = 'baylink.outing-plan.v1';
export const MAX_OUTING_STOPS = 6;
const knownIds = new Set(ATTRACTIONS.map(item => item.id));
export function cleanOutingIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && knownIds.has(id)))].slice(0, MAX_OUTING_STOPS);
}
export function parseSharedOuting(value: string | null): string[] {
  return cleanOutingIds((value || '').slice(0, 1000).split(','));
}
export function loadOuting(): string[] {
  try { return cleanOutingIds(JSON.parse(localStorage.getItem(OUTING_STORAGE_KEY) || '[]')); } catch { return []; }
}
export function saveOuting(ids: string[]): boolean {
  try { localStorage.setItem(OUTING_STORAGE_KEY, JSON.stringify(cleanOutingIds(ids))); return true; } catch { return false; }
}
export const attractionMapUrl = (attraction: Attraction) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(attraction.mapQuery)}`;
export function outingShareUrl(ids: string[], locale: Locale): string {
  const url = new URL('/explore', SITE_URL);
  url.searchParams.set('plan', cleanOutingIds(ids).join(','));
  url.hash = 'outing-plan';
  return localizedUrl(url.href, locale);
}
export function outingText(ids: string[], locale: Locale): string {
  const t = (text: string) => translateText(text, locale);
  return [t('我的湾区出游清单'), ...cleanOutingIds(ids).map((id, index) => {
    const item = ATTRACTIONS.find(item => item.id === id)!;
    return `${index + 1}. ${t(item.title)} · ${item.city}\n${t('建议停留')}：${t(item.duration)}\n${t(item.note)}\n${localizedUrl(`${SITE_URL}/guides/${item.slug}`, locale)}\n${attractionMapUrl(item)}`;
  }), t('按自己的时间取舍；停留时长不含往返交通，出发前查看预约和开放公告。'), outingShareUrl(ids, locale)].join('\n\n');
}
export function filterAttractions(items: Attraction[], filters: { region?: string; theme?: string; cost?: string; query?: string; locale: Locale }): Attraction[] {
  const normalize = (text: string) => simplifySearch(text).toLocaleLowerCase();
  const tokens = normalize((filters.query || '').slice(0, 150)).split(/\s+/).filter(Boolean);
  return items.filter(item => {
    if (filters.region && filters.region !== 'all' && item.region !== filters.region) return false;
    if (filters.theme && filters.theme !== 'all' && !item.themes.some(theme => theme === filters.theme)) return false;
    if (filters.cost && filters.cost !== 'all' && item.cost !== filters.cost) return false;
    const labels = [item.title, item.city, item.note, item.mapQuery,
      ATTRACTION_REGIONS.find(region => region.id === item.region)!.label,
      ...item.themes.map(theme => ATTRACTION_THEMES.find(entry => entry.id === theme)!.label)];
    const text = normalize([...labels, ...labels.map(label => translateText(label, filters.locale))].join(' '));
    return tokens.every(token => text.includes(token));
  });
}
