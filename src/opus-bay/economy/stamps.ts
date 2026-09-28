import type { Bilingual } from '../core/types';
import { bitCount, bitGet, type PlaySaveV1 } from '../data/playSave';
import type { PageId } from './items';

/**
 * Wave 5 · lane E · W5-E5: the 旅行手帐 (notebook) pages as data — which stamps a page holds, when a stamp is stamped,
 * when a page is full. Pure (no game imports): economy/notebookRun.ts feeds it the live world, the tests feed fakes.
 *
 * Pages (plan sf-w5-plan.md §3.5): 印章 (the 16 must-see landmarks + six journeys), 小发现 (lane D's eggs), 看风景 (lane
 * A's view spots), then 足迹 (lane N's page, embedded; no reward). A full page pays `page:<id>` (30 金币, once per save:
 * the ledger's `page` bitset over PAGE_IDS) and gives one cosmetic the shop never sells (items.ts PAGE_ITEM).
 *
 * The 印章 page's stamps are kept in the play save's `stamp` bitset over STAMP_IDS once seen (APPEND-ONLY: an index never
 * moves), so a stamp stays even when the save later trims its oldest arrivals or a line's ride count.
 */

/** APPEND-ONLY: bit i of the play save's `page` bitset (registerRewardIds('page', PAGE_IDS)). */
export const PAGE_IDS: readonly PageId[] = ['stamps', 'finds', 'views'];
export const PAGE_COINS = 30;
export const PAGE_NAMES: Readonly<Record<PageId, Bilingual>> = {
  stamps: { zh: '印章', en: 'Stamps' },
  finds: { zh: '小发现', en: 'Finds' },
  views: { zh: '看风景', en: 'Views' },
};

export type StampGlyph = 'Landmark' | 'Sailboat' | 'Waves' | 'Signpost' | 'Castle' | 'Trees' | 'Mountain' | 'ShoppingBag' | 'GraduationCap'
  | 'Bird' | 'CableCar' | 'TramFront' | 'BusFront' | 'TrainFront';

export interface StampDef {
  /** `t1:<attraction id>` or a journey id */
  id: string;
  name: Bilingual;
  glyph: StampGlyph;
  /** ink colour (the attraction's category colour; journeys teal / coral) */
  ink: string;
  group: 'landmark' | 'journey';
  /** landmarks: the place-index ids that count as having been there (the first one is the attraction's own) */
  places?: readonly string[];
}

const bi = (zh: string, en: string): Bilingual => ({ zh, en });
const L = '#d8744a', COAST = '#2f8fa3', PARK = '#4f8f5b', VIEW = '#b8862f', SHOP = '#c8577a', CAMPUS = '#3f5f9f';
const t1 = (id: string, zh: string, en: string, glyph: StampGlyph, ink: string, places: readonly string[] = [id]): StampDef => ({ id: `t1:${id}`, name: bi(zh, en), glyph, ink, group: 'landmark', places });

/**
 * The 16 must-sees (data/sf/attractions.ts rank 1; tests/opus-bay-w5-notebook.test.ts checks ids, place ids and short
 * names against it) and the six journeys. APPEND-ONLY (bit i of `play.g.stamp`).
 */
export const STAMPS: readonly StampDef[] = [
  t1('golden-gate-bridge', '金门大桥', 'Golden Gate', 'Landmark', L, ['ggb-deck-mid']),
  // an island: its ferry landing (Pier 33) is where you can stand; circling it with the pelican (egg 11) counts too
  t1('alcatraz', '恶魔岛', 'Alcatraz', 'Sailboat', COAST, ['alcatraz', 'alcatraz-landing']),
  t1('fishermans-wharf', '渔人码头', 'The Wharf', 'Waves', COAST),
  t1('ferry-building-marketplace', '渡轮大厦', 'Ferry Building', 'Landmark', L, ['ferry-building']),
  t1('chinatown-dragon-gate', '唐人街', 'Chinatown', 'Landmark', L),
  t1('lombard-crooked', '九曲花街', 'Lombard St', 'Signpost', L),
  t1('alamo-square-painted-ladies', '彩绘女士', 'Painted Ladies', 'Landmark', L),
  t1('palace-of-fine-arts', '艺术宫', 'Palace of Fine Arts', 'Castle', L),
  t1('golden-gate-park', '金门公园', 'Golden Gate Park', 'Trees', PARK),
  t1('coit-tower', '科伊特塔', 'Coit Tower', 'Landmark', L),
  t1('twin-peaks', '双峰', 'Twin Peaks', 'Mountain', VIEW),
  t1('union-square', '联合广场', 'Union Square', 'ShoppingBag', SHOP),
  t1('city-hall', '市政厅', 'City Hall', 'Landmark', L),
  t1('sutro-baths', '苏特罗浴场', 'Sutro Baths', 'Landmark', L, ['osm-w32776540']),
  t1('sf-state-university', '州立大学', 'SF State', 'GraduationCap', CAMPUS),
  t1('stonestown-galleria', '石镇', 'Stonestown', 'ShoppingBag', SHOP),
  { id: 'pelican', name: bi('鹈鹕朋友', 'The pelican'), glyph: 'Bird', ink: '#1f8f8a', group: 'journey' },
  { id: 'golden-gate', name: bi('走过金门大桥', 'Crossed the Gate'), glyph: 'Landmark', ink: '#c0362c', group: 'journey' },
  { id: 'cable-car', name: bi('叮当车', 'Cable car'), glyph: 'CableCar', ink: '#8e2f3c', group: 'journey' },
  { id: 'f-line', name: bi('F 线电车', 'F-line'), glyph: 'TramFront', ink: '#2f8f88', group: 'journey' },
  { id: 'sightseeing', name: bi('观光巴士', 'Sightseeing bus'), glyph: 'BusFront', ink: '#e0563f', group: 'journey' },
  { id: 'metro', name: bi('地铁', 'Muni Metro'), glyph: 'TrainFront', ink: '#2f6fb0', group: 'journey' },
];
export const STAMP_IDS: readonly string[] = STAMPS.map(s => s.id);

/** What the stamps are read from (notebookRun.ts: the save, discovery, the store; tests: fakes). */
export interface StampWorld {
  /** an arrival moment was had at this attraction (save v2 `arrivals`, the paid `arrive:` source) */
  arrived(attraction: string): boolean;
  /** the place-index id was discovered (walked within 12 u) */
  discovered(placeId: string): boolean;
  /** the pelican is unlocked */
  pelican: boolean;
  /** goals done (store.goalsDone) */
  goals: ReadonlySet<string>;
  /** rides per line (save v2 `rides`) */
  rides: Readonly<Record<string, number>>;
  /** a reward source already paid (the ledger's isPaid): eggs for the Alcatraz stamp */
  paid(source: string): boolean;
}

const rode = (w: StampWorld, lines: readonly string[]) => lines.some(l => (w.rides[l] ?? 0) > 0);

/** Is this stamp's thing done in the world now (before the save remembers it)? */
export function stampLive(s: StampDef, w: StampWorld): boolean {
  if (s.group === 'landmark') {
    const id = s.id.slice(3);
    if (w.arrived(id) || (s.places ?? []).some(p => w.discovered(p))) return true;
    return id === 'alcatraz' && w.paid('egg:alcatraz-pelican-island');
  }
  switch (s.id) {
    case 'pelican': return w.pelican || w.goals.has('pelican') || w.paid('pelican:unlock');
    case 'golden-gate': return w.goals.has('golden-gate');
    case 'cable-car': return w.goals.has('cable-car') || rode(w, ['powell-hyde', 'powell-mason', 'california']);
    case 'f-line': return w.goals.has('streetcar') || rode(w, ['streetcar']);
    case 'sightseeing': return w.goals.has('sightseeing') || rode(w, ['sf-loop']);
    case 'metro': return w.goals.has('metro') || rode(w, ['n-judah', 'm-ocean-view']);
    default: return false;
  }
}

/** Stamped: remembered in the save, or done now. */
export const stamped = (p: Readonly<PlaySaveV1>, i: number, w: StampWorld | null): boolean => bitGet(p.g.stamp, i) || (!!w && !!STAMPS[i] && stampLive(STAMPS[i], w));

/** The stamp indices done in the world that the save does not remember yet (notebookRun persists them). */
export function newStamps(p: Readonly<PlaySaveV1>, w: StampWorld): number[] {
  const out: number[] = [];
  STAMPS.forEach((s, i) => { if (!bitGet(p.g.stamp, i) && stampLive(s, w)) out.push(i); });
  return out;
}

export interface PageState { id: PageId; got: number; total: number; full: boolean }

/**
 * Each page's progress. `eggIds` / `viewIds` are lanes D's and A's registered lists (the not-retired ones count);
 * `found(source)` is the ledger's isPaid (`egg:<id>`, `view:<id>`).
 */
export function pageStates(p: Readonly<PlaySaveV1>, w: StampWorld | null, eggIds: readonly string[], viewIds: readonly string[], found: (source: string) => boolean): Record<PageId, PageState> {
  const s = STAMPS.reduce((n, _, i) => n + (stamped(p, i, w) ? 1 : 0), 0);
  const e = eggIds.filter(id => found(`egg:${id}`)).length;
  const v = viewIds.filter(id => found(`view:${id}`)).length;
  const st = (id: PageId, got: number, total: number): PageState => ({ id, got, total, full: total > 0 && got >= total });
  return { stamps: st('stamps', s, STAMPS.length), finds: st('finds', e, eggIds.length), views: st('views', v, viewIds.length) };
}

/** Stamps kept in the save (the tab's count before the world is read). */
export const savedStampCount = (p: Readonly<PlaySaveV1>): number => bitCount(p.g.stamp);
