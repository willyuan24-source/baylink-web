import cityAliases from '../data/city-search-aliases.json';
import { CITY_EXPLORATION_SLUG, cityExplorationKey } from '../data/city-exploration-types';
import { simplifySearch } from '../i18n/locale';
import { parseDiscoveryQuery } from './discovery-query';
import { validCalendarDay } from './event-calendar';
import { getBayAreaToday } from './monthly';

export type BayBaySearchContext = { city?: string; region?: string; date?: string };
/** In-memory precedence only. These flags are never sent as search filters. */
export type BayBaySearchOverrides = { location?: boolean; date?: boolean };
type Location = { city?: string; region?: string; broad?: boolean };
export type BayBayLocationMention = Location & { at: number; end: number; origin: boolean; excluded: boolean };
export const BAYBAY_CITIES = Object.keys(cityAliases);
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalized = (value: string) => simplifySearch(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
const regionalAliases: [Location, string[]][] = [
  [{ region: 'east-bay' }, ['East Bay', '东湾', '東灣']], [{ region: 'south-bay' }, ['South Bay', '南湾', '南灣']],
  [{ region: 'north-bay' }, ['North Bay', '北湾', '北灣']], [{ region: 'peninsula' }, ['Peninsula', '半岛', '半島']],
  [{ broad: true }, ['SF Bay Area', 'San Francisco Bay Area', 'Bay Area', '湾区', '灣區']],
];
const entries: [string, Location][] = [
  ...BAYBAY_CITIES.flatMap(city => [city, ...(cityAliases[city as keyof typeof cityAliases] || []), ...(city === 'San Jose' ? ['San José'] : []), ...(city === 'Fremont' ? ['佛利蒙', '費利蒙'] : [])].map(alias => [alias, { city }] as [string, Location])),
  ...regionalAliases.flatMap(([location, aliases]) => aliases.map(alias => [alias, location] as [string, Location])),
];
const locations = new Map(entries.map(([alias, location]) => [normalized(alias), location]));
const pattern = entries.map(([alias]) => `${/^[a-z]/i.test(alias) ? '\\b' : ''}${escape(alias)}${/[a-z]$/i.test(alias) ? '\\b' : ''}`).sort((a, b) => b.length - a.length).join('|');

/** Match public city names only, with separate departure and destination roles. */
export function bayBayLocationMentions(message: string): BayBayLocationMention[] {
  return [...message.matchAll(new RegExp(pattern, 'giu'))].map(match => {
    const before = simplifySearch(message.slice(0, match.index)).slice(-90);
    const after = simplifySearch(message.slice(match.index! + match[0].length));
    const origin = /(?:从|住在|居住在|家在|(?:出发(?:城市|地点|地)?|起点)(?:\s*(?:改成|改为|换成|变成|是|在|到))?|\b(?:from|leaving|departing(?:\s+from)?|live in|based in|starting(?:\s+from)?|(?:origin|departure city)(?:\s+(?:is|to|changed? to|instead))?))\s*$/i.test(before)
      || /^\s*(?:出发|to\b|[-=]?>|→)/i.test(after);
    return { ...locations.get(normalized(match[0]))!, at: match.index!, end: match.index! + match[0].length, origin,
      excluded: /(?:不(?:想去|想在|去|在|是)|不要(?:去|在)?|别(?:去|在)?|排除|避免|\bnot(?:\s+(?:in|going to))?|\binstead of|\b(?:do not|don't|don’t)\s+(?:want\s+to\s+)?(?:go\s+to|visit|be\s+in))\s*$/i.test(before) };
  });
}

/** Explicit reset commands only; quoted or negated mentions are not commands. */
export const isBayBayResetRequest = (message: string): boolean =>
  /^(?:(?:请|麻烦|好的|好|让我们)[，,、\s]*)?(?:重新开始|重开对话|清空对话|换个(?:话题|计划))(?:吧)?(?=$|[，,。.!！?？:：\s]|今天|明天|我)|^(?:(?:please|let['’]s)\s+)?(?:start over|start a new (?:chat|conversation)|new (?:topic|plan)|reset (?:the )?(?:chat|conversation))(?=$|[,.!?:\s])/i.test(simplifySearch(message.trim()));

export function bayBayClearedSearchFields(message: string): BayBaySearchOverrides {
  const text = simplifySearch(message);
  return {
    location: /(?:城市|地区|区域|地点)(?:不限|不限制|随便|都(?:可以|行))|(?:不限定|不限制|不限)(?:城市|地区|区域|地点)|\bany (?:city|location|region)\b|\bno (?:city|location|region) (?:restriction|preference|limit)s?\b/i.test(text),
    date: /(?:日期|日子)(?:不限|不限制|随便|都(?:可以|行))|(?:不限定|不限制|不限)(?:日期|日子)|哪天都(?:可以|行)|任何一天|\bany (?:day|date)\b|\bno (?:date|day) (?:restriction|preference|limit)s?\b/i.test(text),
  };
}

function conditionChanges(message: string, today: string) {
  const mentions = bayBayLocationMentions(message), cleared = bayBayClearedSearchFields(message);
  const parsed = parseDiscoveryQuery(/出生|生日|\b(?:date of birth|dob|birthday)\b/i.test(message) ? '' : message, today, BAYBAY_CITIES);
  return { mentions, cleared, parsed, location: cleared.location || mentions.some(item => !item.origin), date: cleared.date || parsed.invalidDate || parsed.unsupported.includes('multiple-dates') || !!parsed.dateRange };
}

/** Explicitly cleared dimensions stay cleared across follow-ups, even on a filtered page. */
export function resolveBayBaySearchState(message: string, previous: { searchContext?: BayBaySearchContext; searchOverrides?: BayBaySearchOverrides } = {}, page: BayBaySearchContext = {}, today = getBayAreaToday()) {
  const changes = conditionChanges(message, today);
  const searchOverrides = { ...(isBayBayResetRequest(message) ? {} : previous.searchOverrides) };
  if (changes.location) searchOverrides.location = true;
  if (changes.date) searchOverrides.date = true;
  const effectivePage = { ...page };
  if (searchOverrides.location) { delete effectivePage.city; delete effectivePage.region; }
  if (searchOverrides.date) delete effectivePage.date;
  return { searchOverrides, searchContext: resolveBayBaySearchContext(message, previous.searchContext, {}, today),
    requestContext: resolveBayBaySearchContext(message, previous.searchContext, effectivePage, today) };
}

/** Only recognized public route parameters become context; arbitrary URL text never does. */
export function bayBayPageSearchContext(path: string, today = getBayAreaToday()): BayBaySearchContext {
  if (!path.startsWith('/') || path.startsWith('//') || path.length > 3000) return {};
  const url = new URL(path, 'https://www.baylink.us');
  const allowed = ['/calendar', '/this-month', '/plan', '/together', `/guides/${CITY_EXPLORATION_SLUG}`];
  if (!allowed.includes(url.pathname.replace(/\/$/, ''))) return {};
  const one = (key: string) => url.searchParams.getAll(key).length === 1 ? url.searchParams.get(key) : null;
  const context: BayBaySearchContext = {};
  const city = one('city');
  const canonical = city && BAYBAY_CITIES.find(name => normalized(name) === normalized(city) || cityExplorationKey(name) === city);
  if (canonical) context.city = canonical;
  const region = one('region');
  if (region && ['sf', 'east-bay', 'south-bay', 'north-bay', 'peninsula'].includes(region)) context.region = region;
  const date = one('date');
  if (date && validCalendarDay(date)) context.date = date;
  else if (url.pathname === '/this-month' && one('when') === 'today') context.date = today;
  return context;
}

/** Keeps only public geographic/date requirements, in memory; never derives facts from an answer. */
export function resolveBayBaySearchContext(message: string, previous: BayBaySearchContext = {}, page: BayBaySearchContext = {}, today = getBayAreaToday()): BayBaySearchContext {
  const retained = isBayBayResetRequest(message) ? {} : previous;
  const result = { ...page };
  // City and region are one location dimension; do not mix an old city with a new page region.
  if (retained.city || retained.region) { delete result.city; delete result.region; }
  Object.assign(result, retained);
  const { mentions, cleared, parsed } = conditionChanges(message, today);
  if (cleared.location) { delete result.city; delete result.region; }
  const destinations = [...new Map(mentions.filter(item => !item.origin && !item.excluded).map(item => [item.city ? `city:${item.city}` : item.region ? `region:${item.region}` : 'bay-area', item])).values()];
  if (destinations.length) {
    delete result.city; delete result.region;
    // Multiple destinations need server interpretation, never silently choose the first.
    if (destinations.length === 1) {
      if (destinations[0].city) result.city = destinations[0].city;
      if (destinations[0].region) result.region = destinations[0].region;
    }
  } else if (mentions.some(item => item.excluded && ((item.city && item.city === result.city) || (item.region && item.region === result.region)))) {
    delete result.city; delete result.region;
  }
  if (cleared.date || parsed.invalidDate || parsed.unsupported.includes('multiple-dates') || parsed.dateRange) {
    delete result.date;
    if (!parsed.invalidDate && parsed.dateRange && parsed.dateRange.start === parsed.dateRange.end) result.date = parsed.dateRange.start;
  }
  return result;
}
