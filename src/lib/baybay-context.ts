import cityAliases from '../data/city-search-aliases.json';
import { CITY_EXPLORATION_SLUG, cityExplorationKey } from '../data/city-exploration-types';
import { simplifySearch } from '../i18n/locale';
import { parseDiscoveryQuery } from './discovery-query';
import { validCalendarDay } from './event-calendar';
import { getBayAreaToday } from './monthly';

export type BayBaySearchContext = { city?: string; region?: string; date?: string };
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
      excluded: /(?:不去|不要(?:去)?|别去|排除|避免|\bnot|\binstead of)\s*$/i.test(before) };
  });
}

/** Explicit reset commands only; quoted or negated mentions are not commands. */
export const isBayBayResetRequest = (message: string): boolean =>
  /^(?:(?:请|麻烦|好的|好|让我们)[，,、\s]*)?(?:重新开始|重开对话|清空对话|换个(?:话题|计划))(?:吧)?(?=$|[，,。.!！?？:：\s]|今天|明天|我)|^(?:(?:please|let['’]s)\s+)?(?:start over|start a new (?:chat|conversation)|new (?:topic|plan)|reset (?:the )?(?:chat|conversation))(?=$|[,.!?:\s])/i.test(simplifySearch(message.trim()));

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
  const mentions = bayBayLocationMentions(message);
  const destinations = mentions.filter(item => !item.origin && !item.excluded);
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
  const parsed = parseDiscoveryQuery(/出生|生日|\b(?:date of birth|dob|birthday)\b/i.test(message) ? '' : message, today, BAYBAY_CITIES);
  if (parsed.invalidDate || parsed.unsupported.includes('multiple-dates') || parsed.dateRange) {
    delete result.date;
    if (!parsed.invalidDate && parsed.dateRange && parsed.dateRange.start === parsed.dateRange.end) result.date = parsed.dateRange.start;
  }
  return result;
}
