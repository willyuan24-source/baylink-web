import type { Bilingual, Vec2 } from '../../core/types';
import { simplifySearch } from '../../../i18n/locale';
import type { Attraction, AttractionCat, AttractionGlyph, AttractionRank } from './attractionTypes';
import type { SearchSpot } from './searchSpots';

/**
 * Wave 4 · the city map's search (lane P, W4-P9; plan sf-w4-plan.md §4.1 "Filters, legend, list, search"). Pure:
 * entries (attractions, stations, lines, the other places) are prepared once, then every keystroke ranks them.
 *
 * Ranking (lower = better): exact alias / name 0 · category word ("大学", "mall", "地铁" …) 0.5 · prefix 1 · word
 * start 2 · substring 3; then the tier bonus T1 −1.0, T2 −0.7, curated / T3 −0.6, lines −1.0 (a line answers its own
 * words first); ties by fame, then the shorter name. Results come grouped 景点 / 车站 / 线路 / 地点.
 *
 * Word start (review fix, lane P2): every word of the query starts a word of one name or alias, in order — "gate bri"
 * and "golden bridge" find the Golden Gate Bridge as a word start, "buchanan st" the F-line's Market & Buchanan stop
 * (the old rule compared the whole query, spaces included, with single words: a multi-word query never scored 2).
 *
 * Wave 9 · lane L (R§5 #11): every string is normalised through the site's simplifySearch() first, so a 繁體 query
 * (金門大橋, 博物館, 漁人碼頭, N 線 …) finds what its Simplified spelling finds; a Latin substring may not span two words
 * ("claw" is not "UC Law"); the games and the season's events are their own groups (data/sf/searchSpots.ts), shown
 * before the sights when one of them answers the query better ("螃蟹" → 捞螃蟹 at Pier 7 first, the Wharf after).
 */

export type SearchGroup = 'attraction' | 'station' | 'line' | 'place' | 'play' | 'event';
/** The fixed order (the games and events go first only when they answer better: groupHits). */
export const SEARCH_GROUPS: readonly SearchGroup[] = ['attraction', 'play', 'event', 'station', 'line', 'place'];
export const SEARCH_GROUP_NAMES: Readonly<Record<SearchGroup, Bilingual>> = {
  attraction: { zh: '景点', en: 'Sights' },
  station: { zh: '车站', en: 'Stations' },
  line: { zh: '线路', en: 'Lines' },
  place: { zh: '地点', en: 'Places' },
  play: { zh: '小游戏', en: 'Games' },
  event: { zh: '节日活动', en: 'Events' },
};

export interface SearchEntry {
  /** attraction id / station id / line id / place id */
  id: string;
  group: SearchGroup;
  name: Bilingual;
  short?: Bilingual;
  aliases?: readonly string[];
  /** attractions */
  cat?: AttractionCat;
  glyph?: AttractionGlyph;
  rank?: AttractionRank;
  fame?: number;
  /** places: the place-index kind (campus, shopping, museum …) */
  kind?: string;
  curated?: boolean;
  /** the place-index row travel goes to (attractions, places) */
  placeId?: string;
  /** station lines / a line's kind, for category words */
  lines?: readonly string[];
  /** games and events (data/sf/searchSpots.ts): the line under the name, where it is, goTo's id, the 问 BAYBAY item */
  where?: Bilingual;
  at?: Vec2;
  go?: string;
  ask?: string;
}

export type SearchMatch = 'exact' | 'category' | 'prefix' | 'word' | 'substring';
export interface SearchHit { entry: SearchEntry; score: number; match: SearchMatch }

/** NFKC, then 繁體 → 简体 (the site's simplifySearch: 金門大橋 → 金门大桥), then lower case. */
const fold = (s: string) => simplifySearch(s.normalize('NFKC')).toLowerCase();
/** Search normalisation (as data/sf/places.ts normalizeQuery): NFKC, Simplified, lower case, no spaces / punctuation. */
export const normalizeSearch = (s: string) => fold(s).replace(/[\s·.,'’()\-_/&]+/g, '');
/** The same with the word gaps kept (one space): a Latin substring must sit inside these (never across two words). */
const spacedSearch = (s: string) => fold(s).replace(/[\s·.,'’()\-_/&]+/g, ' ').trim();
const LATIN = /^[a-z0-9]+$/;

/** Category words: a query equal to one of `words` matches every entry of the category (plan §4.1 search aliases). */
export interface CategoryWords { words: readonly string[]; cats?: readonly AttractionCat[]; kinds?: readonly string[]; glyphs?: readonly AttractionGlyph[]; groups?: readonly SearchGroup[] }
export const CATEGORY_WORDS: readonly CategoryWords[] = [
  { words: ['大学', '学院', '校园', '大学校园', 'university', 'universities', 'college', 'colleges', 'campus', 'campuses', 'school'], cats: ['campus'], kinds: ['campus'] },
  { words: ['商场', '购物', '购物中心', '逛街', 'mall', 'malls', 'shopping', 'shop', 'shops'], cats: ['shopping'], kinds: ['shopping'] },
  { words: ['博物馆', '美术馆', '展览', 'museum', 'museums', 'gallery'], cats: ['museum'], kinds: ['museum'] },
  { words: ['公园', '花园', 'park', 'parks', 'garden', 'gardens'], cats: ['park'], kinds: ['park', 'garden'] },
  { words: ['观景', '观景台', '看风景', 'viewpoint', 'viewpoints', 'view', 'views', 'lookout'], cats: ['viewpoint'], kinds: ['viewpoint', 'peak'] },
  { words: ['海滩', '海边', '海岸', 'beach', 'beaches', 'coast'], cats: ['coast'], kinds: ['beach'] },
  { words: ['教堂', '寺庙', '庙', 'church', 'churches', 'temple', 'cathedral'], glyphs: ['Church'], kinds: ['religious'] },
  { words: ['动物园', '动物', 'zoo', 'animals'], glyphs: ['PawPrint'], kinds: ['zoo'] },
  { words: ['剧院', '演出', 'theatre', 'theater', 'concert'], glyphs: ['Theater'] },
  { words: ['体育', '球场', '体育场', 'stadium', 'sports', 'ballpark', 'arena'], cats: ['sports'], kinds: ['stadium'] },
  { words: ['地标', 'landmark', 'landmarks', '必看', 'must see', 'sights'], cats: ['landmark'] },
  { words: ['地铁', '轻轨', '交通', '车站', '坐车', 'metro', 'muni', 'subway', 'transit', 'station', 'stations', 'light rail'], groups: ['line', 'station'] },
];

/** The empty state's suggestions (plan §4.1: "金门大桥 · 大学 · 石镇 · N 线"). */
export const SEARCH_SUGGESTIONS: readonly Bilingual[] = [
  { zh: '金门大桥', en: 'Golden Gate' }, { zh: '大学', en: 'university' }, { zh: '石镇', en: 'Stonestown' }, { zh: 'N 线', en: 'N Judah' },
];

interface Prepared { e: SearchEntry; keys: string[]; aliases: string[]; words: string[]; phrases: string[][]; spaced: string[] }
export interface SearchIndex { readonly entries: readonly Prepared[] }

const wordsOf = (s: string) => fold(s).split(/[\s·/(),&\-–—'’]+/).filter(Boolean);

/** Every query word starts a word of `phrase`, in order (words may be skipped between them). */
function startsInOrder(phrase: readonly string[], q: readonly string[]): boolean {
  let i = 0;
  for (const w of phrase) if (w.startsWith(q[i]) && ++i === q.length) return true;
  return false;
}

/** Prepare entries once (normalised names, aliases and word starts). */
export function prepareSearch(entries: readonly SearchEntry[]): SearchIndex {
  return {
    entries: entries.map(e => {
      const names = [e.name.zh, e.name.en, ...(e.short ? [e.short.zh, e.short.en] : [])];
      const phrases = [...names, ...(e.aliases ?? [])].map(wordsOf).filter(ws => ws.length > 1);
      const spaced = [...new Set([...names, ...(e.aliases ?? [])].map(spacedSearch).filter(Boolean))];
      return { e, keys: [...new Set(names.map(normalizeSearch).filter(Boolean))], aliases: [...new Set((e.aliases ?? []).map(normalizeSearch).filter(Boolean))], words: [...new Set(names.flatMap(wordsOf))], phrases, spaced };
    }),
  };
}

function categoryHit(e: SearchEntry, c: CategoryWords): boolean {
  if (c.groups?.includes(e.group)) return true;
  if (e.group === 'attraction') return !!((e.cat && c.cats?.includes(e.cat)) || (e.glyph && c.glyphs?.includes(e.glyph)));
  if (e.group === 'place') return !!(e.kind && c.kinds?.includes(e.kind));
  return false;
}

/** The tier bonus; a game or an event that answers at all is what the player asked for (−1.5: before a T1 sight). */
const bonus = (e: SearchEntry) => (e.group === 'play' || e.group === 'event' ? -1.5 : e.group === 'line' ? -1 : e.rank === 1 ? -1 : e.rank === 2 ? -0.7 : e.rank === 3 || e.curated ? -0.6 : 0);

/** Rank the entries for `query` (pure). */
export function rankSearch(ix: SearchIndex, query: string, limit = 30): SearchHit[] {
  const q = normalizeSearch(query);
  if (!q) return [];
  const qWords = wordsOf(query);
  // a Latin query's substring stays inside the names' word gaps ("claw" is not in "uc law", "law" is); zh has no gaps
  const qSpaced = LATIN.test(q) ? spacedSearch(query) : null;
  const cats = CATEGORY_WORDS.filter(c => c.words.some(w => normalizeSearch(w) === q));
  const hits: SearchHit[] = [];
  for (const p of ix.entries) {
    let score = Infinity, match: SearchMatch = 'substring';
    const take = (s: number, m: SearchMatch) => { if (s < score) { score = s; match = m; } };
    if (p.aliases.includes(q) || p.keys.includes(q)) take(0, 'exact');
    if (cats.some(c => categoryHit(p.e, c))) take(0.5, 'category');
    if (p.keys.some(k => k.startsWith(q)) || p.aliases.some(a => a.startsWith(q))) take(1, 'prefix');
    if (qWords.length === 1 ? p.words.some(w => w.startsWith(qWords[0])) : qWords.length > 1 && p.phrases.some(ph => startsInOrder(ph, qWords))) take(2, 'word');
    if (qSpaced !== null ? p.spaced.some(k => k.includes(qSpaced)) : p.keys.some(k => k.includes(q)) || p.aliases.some(a => a.includes(q))) take(3, 'substring');
    if (score === Infinity) continue;
    hits.push({ entry: p.e, score: score + bonus(p.e), match });
  }
  return hits.sort((a, b) => a.score - b.score || (b.entry.fame ?? 0) - (a.entry.fame ?? 0) || a.entry.name.en.length - b.entry.name.en.length || (a.entry.id < b.entry.id ? -1 : 1)).slice(0, limit);
}

/**
 * Hits grouped 景点 / 小游戏 / 节日活动 / 车站 / 线路 / 地点 (empty groups dropped), each group in rank order; the games
 * and the events move before the sights when their best hit beats the sights' best ("螃蟹": 捞螃蟹 first).
 */
export function groupHits(hits: readonly SearchHit[]): { group: SearchGroup; hits: SearchHit[] }[] {
  const groups = SEARCH_GROUPS.map(group => ({ group, hits: hits.filter(h => h.entry.group === group) })).filter(g => g.hits.length > 0);
  const best = (g: SearchGroup) => groups.find(x => x.group === g)?.hits[0]?.score ?? Infinity;
  const sights = best('attraction');
  const ahead = groups.filter(g => (g.group === 'play' || g.group === 'event') && best(g.group) < sights).sort((a, b) => a.hits[0].score - b.hits[0].score);
  return [...ahead, ...groups.filter(g => !ahead.includes(g))];
}

// ---------------------------------------------------------------------------------------------------------------------
// Entry builders
// ---------------------------------------------------------------------------------------------------------------------

export const attractionEntries = (list: readonly Attraction[]): SearchEntry[] => list.map(a => ({
  id: a.id, group: 'attraction', name: a.name, ...(a.short ? { short: a.short } : {}), aliases: a.aliases ?? [], cat: a.cat, ...(a.glyph ? { glyph: a.glyph } : {}),
  rank: a.rank, fame: a.fame ?? 50, placeId: a.placeId ?? a.id, curated: true,
}));

/** Lines: their name, disc text and aliases (ui/mapLines LINE_STYLES). */
export const lineEntries = (lines: readonly { id: string; name: Bilingual; aliases?: readonly string[]; disc?: Bilingual }[]): SearchEntry[] => lines.map(l => ({
  id: l.id, group: 'line', name: l.name, aliases: [...(l.aliases ?? []), ...(l.disc ? [l.disc.zh, l.disc.en] : [])], fame: 90,
}));

/**
 * Stations (zh gloss + English sign name); `lines` lets 地铁 / muni find them; a transfer station (ui/mapLines
 * mapStations) is also found by its other stops' names (`names`: "17th Street & Castro Street" → the Castro station).
 */
export const stationEntries = (stations: readonly { id: string; name: Bilingual; lines: readonly string[]; major?: boolean; names?: readonly Bilingual[] }[]): SearchEntry[] => stations.map(s => ({
  id: s.id, group: 'station', name: s.name, lines: s.lines, fame: s.major ? 40 : 20,
  ...(s.names?.length ? { aliases: [...new Set(s.names.flatMap(n => [n.zh, n.en]))] } : {}),
}));

/** The games and the season's events (data/sf/searchSpots.ts searchSpots()). */
export const spotEntries = (spots: readonly SearchSpot[]): SearchEntry[] => spots.map(s => ({
  id: s.id, group: s.group, name: s.name, aliases: s.aliases, where: s.where, fame: s.fame ?? 60,
  ...(s.at ? { at: s.at } : {}), ...(s.go ? { go: s.go } : {}), ...(s.ask ? { ask: s.ask } : {}),
}));

/**
 * The other places of the place index: every row that no attraction decorates (`covered` = the attractions'
 * placeIds), hidden rows excluded by the caller. Curated rows rank like T3.
 */
export const placeEntries = (places: readonly { id: string; name: Bilingual; kind: string; curated?: boolean }[], covered: ReadonlySet<string>): SearchEntry[] =>
  places.filter(p => !covered.has(p.id)).map(p => ({ id: p.id, group: 'place', name: p.name, kind: p.kind, curated: !!p.curated, placeId: p.id, fame: p.curated ? 30 : 0 }));
