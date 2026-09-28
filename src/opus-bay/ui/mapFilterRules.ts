import type { Bilingual } from '../core/types';
import type { Attraction, AttractionCat } from '../data/sf/attractionTypes';

/**
 * Wave 4 · the map's filter chips (lane P, W4-P8; plan sf-w4-plan.md §4.1 "Filters"). Pure rules + the remembered
 * choice (localStorage, try / catch: private windows, blocked storage and node tests just get 'all').
 *
 *   全部 · 必看★ · 博物馆 · 公园 · 观景 · 校园 · 购物 · 交通
 *   - a category chip keeps its category at full strength and dims the others to 25 % with no labels; the T1 of other
 *     categories stay (dimmed, still labelled) so the city keeps its bearings; lines dim to 30 %;
 *   - 必看 keeps the 16 T1 and dims the rest;
 *   - 交通 shows the lines and stations and the T1 only.
 */

/** (wave 5, W5-N8 · 这周: lane R's events of the next seven days; its chip shows only while there are some) */
export const MAP_FILTER_IDS = ['all', 'must', 'museum', 'park', 'viewpoint', 'campus', 'shopping', 'transit', 'week'] as const;
export type MapFilter = (typeof MAP_FILTER_IDS)[number];

export interface MapFilterDef { id: MapFilter; label: Bilingual; cat?: AttractionCat }
export const MAP_FILTERS: readonly MapFilterDef[] = [
  { id: 'all', label: { zh: '全部', en: 'All' } },
  { id: 'must', label: { zh: '必看', en: 'Must-see' } },
  { id: 'museum', label: { zh: '博物馆', en: 'Museums' }, cat: 'museum' },
  { id: 'park', label: { zh: '公园', en: 'Parks' }, cat: 'park' },
  { id: 'viewpoint', label: { zh: '观景', en: 'Views' }, cat: 'viewpoint' },
  { id: 'campus', label: { zh: '校园', en: 'Campuses' }, cat: 'campus' },
  { id: 'shopping', label: { zh: '购物', en: 'Shopping' }, cat: 'shopping' },
  { id: 'transit', label: { zh: '交通', en: 'Transit' } },
  { id: 'week', label: { zh: '这周', en: 'This week' } },
];
/** The 这周 chip's coral (lane R's event pennant colour, realsf/presence.ts EVENT_CORAL). */
export const WEEK_CORAL = '#e8705a';

/** How an attraction shows under a filter. */
export interface FilterLook { show: boolean; alpha: number; label: boolean }
/** How the lines / stations show under a filter. */
export interface FilterLines { lines: 'full' | 'dim'; stations: boolean }

export function filterAttraction(f: MapFilter, a: Pick<Attraction, 'cat' | 'rank'>): FilterLook {
  if (f === 'all') return { show: true, alpha: 1, label: true };
  if (f === 'transit') return a.rank === 1 ? { show: true, alpha: 1, label: true } : { show: false, alpha: 0, label: false };
  const keep = f === 'must' ? a.rank === 1 : MAP_FILTERS.find(d => d.id === f)?.cat === a.cat;
  if (keep) return { show: true, alpha: 1, label: true };
  return a.rank === 1 ? { show: true, alpha: 0.4, label: true } : { show: true, alpha: 0.25, label: false };
}

export function filterLines(f: MapFilter): FilterLines {
  if (f === 'all' || f === 'transit') return { lines: 'full', stations: true };
  if (f === 'must') return { lines: 'full', stations: false };
  return { lines: 'dim', stations: false };
}

/** Plain places (T4 dots, curated rows without an attraction) under a filter: only 全部 shows them. */
export const filterPlaces = (f: MapFilter) => f === 'all';

export const MAP_FILTER_KEY = 'ob-city-map-filter';

/**
 * The browser's localStorage, or null. Reading the global itself throws in some browsers when site data is blocked
 * (Chrome: "Access is denied for this document"), so it is only ever touched inside a try.
 */
function browserStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

/** The remembered chip ('all' when none, unknown or storage is unavailable). `storage` defaults to localStorage. */
export function loadMapFilter(storage?: Pick<Storage, 'getItem'> | null): MapFilter {
  try {
    const v = (storage === undefined ? browserStorage() : storage)?.getItem(MAP_FILTER_KEY);
    return (MAP_FILTER_IDS as readonly string[]).includes(v ?? '') ? (v as MapFilter) : 'all';
  } catch {
    return 'all';
  }
}

export function saveMapFilter(f: MapFilter, storage?: Pick<Storage, 'setItem'> | null): void {
  try { (storage === undefined ? browserStorage() : storage)?.setItem(MAP_FILTER_KEY, f); } catch { /* private window / blocked storage: the chip just is not remembered */ }
}
