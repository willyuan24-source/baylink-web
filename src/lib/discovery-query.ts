import type { MonthlyRegion } from '../data/monthly-types';
import sharedCityAliases from '../data/city-search-aliases.json';
import { simplifySearch } from '../i18n/locale';
import { validCalendarDay } from './event-calendar';
import { getBayAreaToday, getMonthlyDateRange } from './monthly';

export type DiscoveryIntent = 'mixed' | 'events' | 'offers' | 'openings' | 'attractions' | 'places' | 'guides';
export type DiscoveryQuery = {
  original: string;
  tokens: string[];
  intent: DiscoveryIntent;
  eventKind?: 'performance' | 'meetup' | 'sports';
  cities: string[];
  regions: MonthlyRegion[];
  dateRange?: { start: string; end: string };
  invalidDate: boolean;
  freeOnly: boolean;
  maxAdmissionUsd?: number;
  totalBudgetUsd?: number;
  admissionBudget: boolean;
  family: boolean;
  childAges: number[];
  setting?: 'indoor' | 'outdoor';
  evening: boolean;
  openingStatus?: 'soft_open' | 'announced';
  distanceRequested: boolean;
  structured: boolean;
  unsupported: ('negative-preference' | 'multiple-dates' | 'total-budget' | 'free-extras')[];
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const discoveryText = (value: string): string => simplifySearch(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const aliasPattern = (value: string) => new RegExp(`${/^[a-z0-9]/.test(value) ? '\\b' : ''}${escapeRegex(value)}${/[a-z0-9]$/.test(value) ? '\\b' : ''}`, 'g');

// Match the longest complete city name first: South San Francisco is a separate city.
const cityAliases: Record<string, string[]> = {
  'South San Francisco': ['南旧金山', '南三藩市', 'ssf'],
  'San Francisco': ['旧金山', '三藩市', 'sf'],
  'San Jose': ['圣何塞', '圣荷西'], 'Santa Clara': ['圣克拉拉'],
  'Sunnyvale': ['森尼韦尔', '桑尼维尔'], 'Cupertino': ['库比蒂诺', '库柏蒂诺'],
  'Mountain View': ['山景城'], 'Los Altos': ['洛斯阿尔托斯'], 'Los Gatos': ['洛斯加托斯'],
  'Palo Alto': ['帕洛阿尔托'], 'Menlo Park': ['门洛帕克'],
  'Redwood City': ['红木城'], 'San Mateo': ['圣马特奥'], 'Burlingame': ['伯灵格姆'],
  'Millbrae': ['密尔布瑞'], 'Half Moon Bay': ['半月湾'], 'San Bruno': ['圣布鲁诺'],
  'Oakland': ['奥克兰', '屋仑'], 'Berkeley': ['伯克利', '柏克莱'],
  'Fremont': ['弗里蒙特'], 'Richmond': ['里士满'], 'Daly City': ['戴利城'],
  'San Rafael': ['圣拉斐尔'], 'Petaluma': ['佩塔卢马'], 'Santa Rosa': ['圣罗莎'],
};
const regions: [MonthlyRegion, string[]][] = [
  ['east-bay', ['东湾', 'east bay']], ['south-bay', ['南湾', 'south bay']],
  ['north-bay', ['北湾', 'north bay']], ['peninsula', ['半岛', 'peninsula']],
];
const topics = [
  ['咖啡', '咖啡店', '咖啡馆', 'coffee shops', 'coffee shop', 'cafes', 'cafe', 'coffee'],
  ['南瓜', 'pumpkins', 'pumpkin'], ['迷宫', 'mazes', 'maze'],
  ['电影', 'movies', 'movie', 'films', 'film'], ['音乐', 'music'],
  ['博物馆', 'museums', 'museum'], ['艺术', 'arts', 'art'],
  ['甜品', 'desserts', 'dessert'], ['书店', 'bookstores', 'bookstore'],
  ['餐厅', '餐馆', '饭店', 'restaurants', 'restaurant'],
  ['净滩', 'coastal cleanup'],
];
export function normalizeDiscoveryTopic(value: string): string {
  let text = discoveryText(value);
  for (const [canonical, ...aliases] of topics) for (const alias of aliases) text = text.replace(aliasPattern(alias), canonical);
  return text;
}

export const shiftDiscoveryDay = (day: string, amount: number): string => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

/** Parse local search constraints only. This does not fetch hours, weather, prices or routes. */
export function parseDiscoveryQuery(query: string, today = getBayAreaToday(), knownCities: string[] = []): DiscoveryQuery {
  let text = discoveryText(query.trim().slice(0, 300));
  text = text.replace(/\b(?:show me|help me|i am looking for|i'm looking for|can you|could you)\b/g, ' ');
  text = text.replace(/\b(?:can|could|should)\s+(?:i|we)\s+(?:visit|go|do|find)\b/g, ' ');
  text = text.replace(/\bnew (coffee shops?|cafes?|restaurants?)\b/g, 'new openings $1').replace(/新(?:开的?)?(咖啡[店馆]|餐厅|甜品店|书店)/g, '新店 $1');
  const result: DiscoveryQuery = { original: query.trim(), tokens: [], intent: 'mixed', cities: [], regions: [], invalidDate: false, freeOnly: false, admissionBudget: false, family: false, childAges: [], evening: false, distanceRequested: false, structured: false, unsupported: [] };
  const take = (pattern: RegExp): boolean => {
    const found = pattern.test(text);
    pattern.lastIndex = 0;
    if (found) text = text.replace(pattern, ' ');
    return found;
  };
  // Negated preferences are not positive filters. Ask for a rewrite instead of guessing their inverse.
  if (take(/(?:不要|不想(?:要)?|不需要|不想去|排除|避免|别推荐|非)\s*(?:室内|户外|室外|免费|亲子|儿童)|\b(?:not|no|avoid|exclude|without|don't want|do not want)\s+(?:indoor(?:s)?|outdoor(?:s)?|free|family(?:[ -]friendly)?|kids|children)\b/g)) result.unsupported.push('negative-preference');
  if (take(/免费停车|免停车费|免费餐饮|免费食物|\bfree (?:parking|food|drinks?)\b/g)) result.unsupported.push('free-extras');
  take(/\b(?:san francisco|sf) bay area\b/g);
  const aliases = [...new Set([...Object.keys(cityAliases), ...Object.keys(sharedCityAliases), ...knownCities.flatMap(city => city.split(/\s*(?:\/|、|;|；)\s*/))])].flatMap(city =>
    [city, ...(cityAliases[city] || []), ...(sharedCityAliases[city as keyof typeof sharedCityAliases] || [])].map(alias => ({ city, alias: discoveryText(alias) })),
  ).sort((a, b) => b.alias.length - a.alias.length);
  for (const { city, alias } of aliases) if (take(aliasPattern(alias))) {
    const canonical = Object.keys(cityAliases).find(name => discoveryText(name) === discoveryText(city)) || city;
    if (!result.cities.includes(canonical)) result.cities.push(canonical);
  }
  for (const [region, aliases] of regions) for (const alias of aliases) if (take(aliasPattern(alias)) && !result.regions.includes(region)) result.regions.push(region);

  const year = Number(today.slice(0, 4));
  const day = (month: string | number, date: string | number, explicitYear = year) => `${explicitYear}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
  const setRange = (start: string, end = start) => {
    if (!validCalendarDay(start) || !validCalendarDay(end) || start > end) result.invalidDate = true;
    else if (result.unsupported.includes('multiple-dates')) return;
    else if (result.dateRange && (result.dateRange.start !== start || result.dateRange.end !== end)) {
      result.unsupported.push('multiple-dates');
      result.dateRange = undefined;
    } else result.dateRange = { start, end };
  };
  // A weekday attached to an exact date describes that day, not the next weekday
  // from today. Validate it before the ordinary date parser removes the date.
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const weekdayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const weekdaySuffix = '\\s*[,，]?\\s*[（(]?\\s*((?:周|星期)[一二三四五六日天]|(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\\b)\\s*[)）]?';
  const annotation = (dateText: string, value: string, weekday: string) => {
    const target = weekdayNames.includes(weekday) ? weekdayNames.indexOf(weekday) : ['日天', '一', '二', '三', '四', '五', '六'].findIndex(chars => chars.includes(weekday.at(-1)!));
    if (!validCalendarDay(value) || new Date(`${value}T12:00:00Z`).getUTCDay() !== target) result.invalidDate = true;
    return `${dateText} `;
  };
  text = text.replace(new RegExp(`(\\b\\d{4}-\\d{2}-\\d{2}\\b)${weekdaySuffix}`, 'g'), (_, dateText: string, weekday: string) => annotation(dateText, dateText, weekday));
  text = text.replace(new RegExp(`(\\b(20\\d{2})/(\\d{1,2})/(\\d{1,2})\\b)${weekdaySuffix}`, 'g'), (_, dateText: string, y: string, m: string, d: string, weekday: string) => annotation(dateText, day(m, d, Number(y)), weekday));
  text = text.replace(new RegExp(`(\\b(\\d{1,2})/(\\d{1,2})/(20\\d{2})\\b)${weekdaySuffix}`, 'g'), (_, dateText: string, m: string, d: string, y: string, weekday: string) => annotation(dateText, day(m, d, Number(y)), weekday));
  text = text.replace(new RegExp(`((?:(\\d{4})年)?(\\d{1,2})(?:月|/)(\\d{1,2})[日号]?)${weekdaySuffix}`, 'g'), (_, dateText: string, y: string, m: string, d: string, weekday: string) => annotation(dateText, day(m, d, y ? Number(y) : year), weekday));
  text = text.replace(new RegExp(`(\\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?)${weekdaySuffix}`, 'g'), (_, dateText: string, m: string, d: string, y: string, weekday: string) => annotation(dateText, day(months.findIndex(name => name.startsWith(m === 'sept' ? 'sep' : m)) + 1, d, y ? Number(y) : year), weekday));
  // Explicit ranges precede single dates, so 10/3–5 is not read as just 10/3.
  // Consume explicit slash-date years before the shorter month/day matcher.
  text = text.replace(/\b(20\d{2})\/(\d{1,2})\/(\d{1,2})\b/g, (_, y: string, m: string, d: string) => { setRange(day(m, d, Number(y))); return ' '; });
  text = text.replace(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g, (_, m: string, d: string, y: string) => { setRange(day(m, d, Number(y))); return ' '; });
  text = text.replace(/(\d{4}-\d{2}-\d{2})\s*(?:至|到|through|to|[-–—~])\s*(\d{4}-\d{2}-\d{2})/g, (_, start: string, end: string) => { setRange(start, end); return ' '; });
  text = text.replace(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]?\s*(?:至|到|[-–—~])\s*(?:(\d{1,2})月)?(\d{1,2})[日号]?/g, (_, y: string, m: string, d: string, m2: string, d2: string) => { setRange(day(m, d, y ? Number(y) : year), day(m2 || m, d2, y ? Number(y) : year)); return ' '; });
  text = text.replace(/\b(\d{1,2})\/(\d{1,2})\s*(?:至|到|through|to|[-–—~])\s*(?:(\d{1,2})\/)?(\d{1,2})\b/g, (_, m: string, d: string, m2: string, d2: string) => { setRange(day(m, d), day(m2 || m, d2)); return ' '; });
  text = text.replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*(?:through|to|[-–—])\s*(\d{1,2})(?:st|nd|rd|th)?)?(?:,?\s+(20\d{2}))?\b/g, (_, m: string, d: string, d2: string, y: string) => { const month = months.findIndex(name => name.startsWith(m === 'sept' ? 'sep' : m)) + 1; setRange(day(month, d, y ? Number(y) : year), day(month, d2 || d, y ? Number(y) : year)); return ' '; });
  text = text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, value => { setRange(value); return ' '; });
  text = text.replace(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]?/g, (_, y: string, m: string, d: string) => { setRange(day(m, d, y ? Number(y) : year)); return ' '; });
  text = text.replace(/\b(\d{1,2})\/(\d{1,2})\b/g, (_, m: string, d: string) => { setRange(day(m, d)); return ' '; });
  if (take(/后天|\b(?:the )?day after tomorrow\b/g)) setRange(shiftDiscoveryDay(today, 2));
  else if (take(/明天|\btomorrow\b/g)) setRange(shiftDiscoveryDay(today, 1));
  else if (take(/今天|今日|\btoday\b/g)) setRange(today);
  else if (take(/下(?:个|一)?周末|\bnext weekend\b/g)) { const range = getMonthlyDateRange('weekend', today)!; setRange(shiftDiscoveryDay(range.start, 7), shiftDiscoveryDay(range.end, 7)); }
  else if (take(/(?:这(?:个)?|本)?周末|\b(?:this )?weekend\b/g)) { const range = getMonthlyDateRange('weekend', today)!; setRange(range.start, range.end); }
  const weekDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  text = text.replace(/(?:([本这下])(?:个)?)?(?:周|星期)([一二三四五六日天])|\b(?:(this|next)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g, (_, prefix: string, zh: string, enPrefix: string, en: string) => {
    const target = zh ? (['日天', '一', '二', '三', '四', '五', '六'].findIndex(value => value.includes(zh))) : weekDays.indexOf(en);
    const current = new Date(`${today}T12:00:00Z`).getUTCDay();
    let offset = (target - current + 7) % 7;
    if (prefix === '下' || enPrefix === 'next') offset = (target || 7) - (current || 7) + 7;
    else if (prefix || enPrefix) offset = (target || 7) - (current || 7);
    setRange(shiftDiscoveryDay(today, offset)); return ' ';
  });

  result.freeOnly = take(/免费|免门票|\bfree(?: admission| entry)?\b/g);
  const totalBudget = /总预算|总共|总计|合计|一共|全程预算|\b(?:total|altogether|overall|combined)\b/.test(text);
  result.admissionBudget = /门票|入场费|\b(?:admission|tickets?)\b/.test(text);
  const money = /(?:预算|人均|每人|门票|入场费|\bbudget(?: of)?\b|\b(?:under|below|up to|at most)\b)?\s*(?:\$\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:美元|美金|\busd\b|\bdollars?\b))(?:\s*(?:以内|以下|之内|per person|each))?/g;
  text = text.replace(money, (_, usd: string, amount: string) => { result.maxAdmissionUsd = Number(usd || amount); return ' '; });
  text = text.replace(/(?:预算|人均|每人|门票|入场费)\s*(\d+(?:\.\d{1,2})?)(?:\s*(?:以内|以下))?/g, (_, amount: string) => { result.maxAdmissionUsd = Number(amount); return ' '; });
  if (result.maxAdmissionUsd !== undefined) {
    text = text.replace(/门票|入场费|每人|人均|不超过|不高于|最多|上限|总预算|总共|总计|合计|一共|全程预算|(?:[一二两三四五六七八九十\d]+)人|\b(?:admission|tickets?|budget|under|below|up to|at most|less than|per person|total|altogether|overall|combined)\b/g, ' ');
    if (totalBudget) {
      result.totalBudgetUsd = result.maxAdmissionUsd;
      result.maxAdmissionUsd = undefined;
      result.unsupported.push('total-budget');
    }
  }
  result.family = take(/亲子|带(?:孩子|小孩|娃)|儿童|小朋友|\bfamily(?:[ -]friendly)?\b|\bfamilies\b|\b(?:with )?(?:kids|children)\b/g);
  text = text.replace(/(?:带)?(\d{1,2})\s*岁(?:的)?(?:孩子|儿童|小孩)?|\b(?:aged?\s+)?(\d{1,2})[ -]year[ -]olds?\b/g, (_, zh: string, en: string) => { const age = Number(zh || en); if (age < 18) { result.childAges.push(age); result.family = true; } return ' '; });
  if (take(/室内(?!乐)|雨天|下雨|\bindoor(?:s)?\b|\brainy(?: day)?\b/g)) result.setting = 'indoor';
  else if (take(/户外|室外|\boutdoor(?:s)?\b/g)) result.setting = 'outdoor';
  result.evening = take(/晚间|晚上|今晚|夜间|\b(?:in the )?evening\b|\bat night\b|\btonight\b/g);
  if (/今晚|\btonight\b/.test(discoveryText(query)) && !result.dateRange) setRange(today);
  result.distanceRequested = take(/(?:步行|开车|驾车)\s*\d+\s*分钟(?:内|以内)?|\b\d+\s*(?:minute|min)[ -]?(?:walk|drive)\b|附近|周边|\bnear(?:by)?\b|\bwithin\b/g);

  if (/试营业|\bsoft openings?\b/.test(text)) result.openingStatus = 'soft_open';
  else if (/开业预告|\bannounced openings?\b/.test(text)) result.openingStatus = 'announced';
  if (take(/优惠|折扣|福利|\b(?:deals?|offers?|discounts?|freebies?)\b/g)) result.intent = 'offers';
  else if (take(/新(?:开(?:的)?)?店|新开业|试营业|开业预告|\bnew (?:openings?|shops?|stores?|restaurants?|cafes?)\b|\bsoft openings?\b/g)) result.intent = 'openings';
  else if (take(/攻略|指南|\bguides?\b/g)) result.intent = 'guides';
  else if (take(/景点|\battractions?\b/g)) result.intent = 'attractions';
  const performance = take(/演唱会|演出|音乐会|\b(?:concerts?|performances?|shows?)\b/g);
  const sports = take(/球赛|体育赛事|\b(?:sports?|games?|matches)\b/g);
  const meetup = take(/聚会|见面会|\bmeetups?\b/g);
  const events = take(/活动|\b(?:events?|activities)\b/g);
  const generalPlaces = take(/地方好去|好去的地方|好玩的地方|好去处|\bplaces(?:\s+to\s+(?:go|visit))?\b/g);
  const generalOuting = take(/哪里好玩|去哪(?:里|儿)?(?:玩)?|去哪里|\bthings\s+to\s+do\b/g);
  if (result.intent === 'mixed') {
    if ((events || performance || sports || meetup) && !generalPlaces && !generalOuting) result.intent = 'events';
    else if (generalPlaces && !(events || performance || sports || meetup)) result.intent = 'places';
  }
  // A coffee request concerns a place or drink budget, not admission to an
  // unrelated event whose description happens to mention refreshments.
  // Explicit event intent above still allows coffee tastings and meetups.
  if (result.intent === 'mixed' && /咖啡(?:[店馆])?|餐厅|甜品店|\b(?:coffee(?: shops?)?|cafes?|restaurants?)\b/.test(text)) result.intent = 'places';
  if (performance) result.eventKind = 'performance';
  else if (sports) result.eventKind = 'sports';
  else if (meetup) result.eventKind = 'meetup';
  text = text.replace(/[一二三四五六七八九十\d]+(?:家|个|处)|帮我|请问|麻烦|请|推荐|找(?:一)?(?:些|个|点)?|有什么|有哪些|有没有|可以|适合|想去|想要|我要|我们|和朋友|一起|看看|一下|以内|以下|湾区|去处|的|\b(?:please|help me|find|show me|recommend|looking for|i want|we want|what(?: is| are)?|some|any|something|things to do|places to (?:go|visit)|bay area|for|in|on|at|the|a|an|to|me|my|with|and|of|this)\b/g, ' ');
  result.tokens = [...new Set(normalizeDiscoveryTopic(text).split(/[\s,，。！？!?、；;：:]+/).filter(Boolean))];
  result.structured = !!(result.cities.length || result.regions.length || result.dateRange || result.invalidDate || result.freeOnly || result.maxAdmissionUsd !== undefined || result.totalBudgetUsd !== undefined || result.family || result.setting || result.evening || result.distanceRequested || result.intent !== 'mixed' || result.unsupported.length);
  return result;
}
