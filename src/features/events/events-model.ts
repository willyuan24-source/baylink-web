import indexJson from '../../data/generated/events-index.json';
import { WEEKEND_FLAGSHIP_IDS, WEEKEND_PICKS, type WeekendPickEntry } from '../../data/weekend-picks';
import type { EventsIndex, IndexEvent, IndexOffer, IndexOpening, MonthlyRegion } from './events-index-types';
import type { Copy } from '../../lib/event-facts';
import { getCover, type CoverContext } from '../../lib/cover';
import { getMonthlyDateRange, isFreeToAttend, nextOccurrence, orderByNextDay, resolveMonthlyDateFilter, weekendDayTabs, type MonthlyDateFilter, type WeekendDayTab } from '../../lib/monthly';
import { rankWeekendFallback, selectWeekendFallback } from '../../lib/weekend-ranking';
import { isSeniorFriendly } from '../../lib/senior-friendly';
import type { MonthlyEvent } from '../../data/monthly-types';

/**
 * The events column's data and rules (plan WEB-EVENTS, design.md §4.11): one slim generated index (RC-33), the URL
 * filters, the 本周末 day tabs, the story chips and the editor's picks. Pure functions over the index, so the views,
 * the prerender and the tests all read the same answers.
 */
export const EVENTS_INDEX = indexJson as unknown as EventsIndex;
export const INDEX_EVENTS: readonly IndexEvent[] = EVENTS_INDEX.events;
export const INDEX_OFFERS: readonly IndexOffer[] = EVENTS_INDEX.offers;
export const INDEX_OPENINGS: readonly IndexOpening[] = EVENTS_INDEX.openings;

/** The cover resolver's registry: only listing images that can be covers (no AI illustrations). */
export const coverContext = (today: string): CoverContext => ({ images: EVENTS_INDEX.images, today });
/** The cover ladder's answer without page de-duplication: does this item have a real photo or official image? */
export const hasRealCover = (kind: 'event' | 'offer' | 'opening', item: { id: string; imageKey?: string }, today: string) =>
  getCover({ kind, id: item.id, imageKey: item.imageKey }, coverContext(today)).tier !== 'type';

/** M/D for trust rows and ranges ("官网核对 10/2", "10/10–11"). */
export const monthDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

export type EventsColumn = 'list' | 'perks' | 'openings' | 'calendar';
/** The column a URL shows: /calendar, `?view=perks|openings`, or the old `#monthly-perks` / `#monthly-openings` anchors. */
export function columnFor(params: URLSearchParams, hash: string, calendar: boolean): EventsColumn {
  if (calendar) return 'calendar';
  const view = params.get('view');
  if (view === 'perks' || hash === '#monthly-perks') return 'perks';
  if (view === 'openings' || hash === '#monthly-openings') return 'openings';
  return 'list';
}

// Weekdays, Sunday first (getUTCDay order), each with its English: `short` for day tabs and the range line, `char`
// for the calendar's week strip and month grid.
export const WEEKDAYS: readonly { short: Copy; char: Copy }[] = [
  { short: { zh: '周日', en: 'Sun' }, char: { zh: '日', en: 'Sun' } },
  { short: { zh: '周一', en: 'Mon' }, char: { zh: '一', en: 'Mon' } },
  { short: { zh: '周二', en: 'Tue' }, char: { zh: '二', en: 'Tue' } },
  { short: { zh: '周三', en: 'Wed' }, char: { zh: '三', en: 'Wed' } },
  { short: { zh: '周四', en: 'Thu' }, char: { zh: '四', en: 'Thu' } },
  { short: { zh: '周五', en: 'Fri' }, char: { zh: '五', en: 'Fri' } },
  { short: { zh: '周六', en: 'Sat' }, char: { zh: '六', en: 'Sat' } },
];
export const weekdayIndex = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

// Regions ------------------------------------------------------------------------------------------------------

export const REGIONS: readonly { id: MonthlyRegion; label: Copy }[] = [
  { id: 'sf', label: { zh: '旧金山', en: 'San Francisco' } },
  { id: 'east-bay', label: { zh: '东湾', en: 'East Bay' } },
  { id: 'south-bay', label: { zh: '南湾', en: 'South Bay' } },
  { id: 'peninsula', label: { zh: '半岛', en: 'Peninsula' } },
  { id: 'north-bay', label: { zh: '北湾', en: 'North Bay' } },
];
export const ALL_REGIONS: Copy = { zh: '整个湾区', en: 'All Bay Area' };
export const isRegion = (value: string | null | undefined): value is MonthlyRegion => REGIONS.some(region => region.id === value);
export const regionLabel = (id: MonthlyRegion | 'all'): Copy => REGIONS.find(region => region.id === id)?.label ?? ALL_REGIONS;
/** The reader's last region (plan §1: 地区 remembered), so the T2 path costs no extra tap the next time. */
export const REGION_KEY = 'baylink.events-region.v1';
export function readSavedRegion(): MonthlyRegion | undefined {
  try { const saved = globalThis.localStorage?.getItem(REGION_KEY); return isRegion(saved) ? saved : undefined; } catch { return undefined; }
}
export function saveRegion(region: MonthlyRegion | 'all'): void {
  try { if (region === 'all') globalThis.localStorage?.removeItem(REGION_KEY); else globalThis.localStorage?.setItem(REGION_KEY, region); } catch { /* This visit still uses it. */ }
}

// When ----------------------------------------------------------------------------------------------------------

export type EventsWhen = Exclude<MonthlyDateFilter, 'september'>;
export const WHEN_OPTIONS: readonly { id: EventsWhen; label: Copy }[] = [
  { id: 'today', label: { zh: '今天', en: 'Today' } },
  { id: 'weekend', label: { zh: '本周末', en: 'This weekend' } },
  { id: 'next7', label: { zh: '未来 7 天', en: 'Next 7 days' } },
  { id: 'october', label: { zh: '十月', en: 'October' } },
  { id: 'november', label: { zh: '十一月', en: 'November' } },
  { id: 'december', label: { zh: '十二月', en: 'December' } },
  { id: 'all', label: { zh: '全部日期', en: 'All dates' } },
];
/** `?when=` with the page default; the retired 九月回顾 reads as 全部日期. */
export const resolveWhen = (value: string | null, fallback: EventsWhen): EventsWhen => {
  if (!value) return fallback;
  const when = resolveMonthlyDateFilter(value);
  return when === 'september' ? 'all' : when;
};

// Story chips (stories row and filter sheet) ----------------------------------------------------------------------

export type EventTag = 'kids' | 'seniors' | 'outdoors' | 'shows' | 'markets' | 'pumpkin' | 'indoor';
const KIDS = /亲子|儿童|孩子|家庭|全龄|全年龄|所有年龄|少儿|幼儿|学龄|青少年|kids?|famil/i;
const SHOWS = /演出|音乐会|演唱|音乐节|戏剧|话剧|舞蹈|舞台|歌剧|交响|爵士|concert|theat|opera|symphony|dance|music|performance/i;
const MARKETS = /市集|集市|农夫|夜市|美食节|跳蚤|market|fair|bazaar|food festival/i;
const PUMPKIN = /南瓜|万圣|萬聖|丰收|豐收|玉米迷宫|harvest|pumpkin|halloween|corn maze/i;
const text = (event: IndexEvent) => [event.title, ...(event.aliases ?? [])].join(' ');
/**
 * Each story is a fact the record states: the category, the audience line, the kind, the title, or the reviewed planning
 * `setting` (下雨也行 = indoor only). Nothing is guessed from a photo. 长辈友好 is the shared rule in lib/senior-friendly.ts
 * (also the home circle's count): seniors named, or accessible, Chinese-language, library or free all-ages daytime events.
 * One label per story on the home circles and here (HOMEIA13-05): 亲子, 长辈友好.
 */
export const TAGS: readonly { id: EventTag; label: Copy; test: (event: IndexEvent) => boolean }[] = [
  { id: 'kids', label: { zh: '亲子', en: 'With kids' }, test: event => event.category === 'family' || event.audience.some(item => KIDS.test(item)) },
  { id: 'seniors', label: { zh: '长辈友好', en: 'Senior-friendly' }, test: isSeniorFriendly },
  { id: 'outdoors', label: { zh: '户外', en: 'Outdoors' }, test: event => event.category === 'outdoors' || event.planning?.setting === 'outdoor' },
  { id: 'shows', label: { zh: '演出', en: 'Shows' }, test: event => event.kind === 'performance' || SHOWS.test(text(event)) },
  { id: 'markets', label: { zh: '市集', en: 'Markets' }, test: event => event.category === 'food' || MARKETS.test(text(event)) },
  { id: 'pumpkin', label: { zh: '南瓜季', en: 'Pumpkin season' }, test: event => PUMPKIN.test(text(event)) },
  { id: 'indoor', label: { zh: '下雨也行', en: 'Rain or shine' }, test: event => event.planning?.setting === 'indoor' },
];
export const isTag = (value: string | null | undefined): value is EventTag => TAGS.some(tag => tag.id === value);
/** Old links name a category (`?category=family`); the story chips replace them. */
const CATEGORY_TAGS: Record<string, EventTag> = { family: 'kids', outdoors: 'outdoors', food: 'markets', performance: 'shows' };
const CATEGORIES = new Set(['culture', 'outdoors', 'food', 'family', 'sports', 'performance']);

// Filters -------------------------------------------------------------------------------------------------------

export type EventsFilters = {
  when: EventsWhen;
  region: MonthlyRegion | 'all';
  free: boolean;
  tag?: EventTag;
  /** A legacy `?category=` with no story chip (culture, sports). */
  category?: string;
  q: string;
};
export function readFilters(params: URLSearchParams, defaultWhen: EventsWhen, savedRegion?: MonthlyRegion): EventsFilters {
  const region = params.get('region');
  const category = params.get('category') || '';
  const tag = params.get('tag');
  return {
    when: resolveWhen(params.get('when'), defaultWhen),
    region: isRegion(region) ? region : region === 'all' ? 'all' : savedRegion ?? 'all',
    free: params.get('cost') === 'free',
    tag: isTag(tag) ? tag : CATEGORY_TAGS[category],
    category: !isTag(tag) && !CATEGORY_TAGS[category] && CATEGORIES.has(category) ? category : undefined,
    q: (params.get('q') || '').slice(0, 200).trim(),
  };
}
/** How many filters the 筛选 chip counts (the date, a story, 免费, a keyword; the region has its own chip). */
export const activeFilterCount = (filters: EventsFilters, defaultWhen: EventsWhen) =>
  Number(filters.when !== defaultWhen) + Number(!!filters.tag || !!filters.category) + Number(filters.free) + Number(!!filters.q);

const eventCategory = (event: IndexEvent) => event.kind === 'sports' || event.kind === 'performance' ? event.kind : event.category;
/** Whether an event is on any day of [start, end] that is not past. */
export function inRange(event: IndexEvent, range: { start: string; end: string } | null, today: string): boolean {
  const from = range && range.start > today ? range.start : today;
  const next = nextOccurrence(event, from);
  return !!next && (!range || next <= range.end);
}
export type SearchText = (event: IndexEvent) => string;
/** Every filter except the date range; `search` folds the keyword and the event's text the same way (search-synonyms). */
export function matchesFilters(event: IndexEvent, filters: Omit<EventsFilters, 'when'>, normalize: (value: string) => string, translate: (value: string) => string = value => value): boolean {
  if (filters.region !== 'all' && event.region !== filters.region) return false;
  if (filters.free && !isFreeToAttend(event)) return false;
  if (filters.tag && !TAGS.find(tag => tag.id === filters.tag)!.test(event)) return false;
  if (filters.category && eventCategory(event) !== filters.category) return false;
  if (filters.q) {
    const query = normalize(filters.q);
    const haystack = normalize([event.title, ...(event.aliases ?? []), event.city, event.venue, event.venueShort ?? '', event.dek ?? '', ...event.audience]
      .flatMap(value => [value, translate(value)]).join(' '));
    if (!haystack.includes(query)) return false;
  }
  return true;
}

// 本周末 -----------------------------------------------------------------------------------------------------------

export type WeekendPick = { event: IndexEvent; date: string; reason?: WeekendPickEntry['reason'] };
/**
 * The editor's picks for this weekend, then the automatic ranking (src/lib/weekend-ranking.ts) — the same rule as the
 * home page and the weekly share card, read from the slim index. `limit` 4: the 编辑精选 rail holds 3–5 covers.
 */
export function weekendPicks(events: readonly IndexEvent[], today: string, { limit = 4, picks = WEEKEND_PICKS, flagships = WEEKEND_FLAGSHIP_IDS }: { limit?: number; picks?: Readonly<Record<string, readonly WeekendPickEntry[]>>; flagships?: ReadonlySet<string> } = {}): WeekendPick[] {
  const range = getMonthlyDateRange('weekend', today)!;
  const days = [range.start, range.end].filter(day => day >= today);
  const entries = events.flatMap(event => {
    const date = days.find(day => nextOccurrence(event, day) === day);
    return date ? [{ event: event as unknown as MonthlyEvent, date }] : [];
  });
  const list = picks[range.start] ?? [];
  const chosen: WeekendPick[] = [];
  for (const { id, reason } of list) {
    const entry = entries.find(item => item.event.id === id);
    if (entry && chosen.length < limit && !chosen.some(pick => pick.event.id === id)) chosen.push({ event: entry.event as unknown as IndexEvent, date: entry.date, reason });
  }
  const hasPhoto = (imageKey: string) => Object.hasOwn(EVENTS_INDEX.images, imageKey);
  const rest = selectWeekendFallback(entries.filter(entry => !chosen.some(pick => pick.event.id === entry.event.id)), {
    weekendStart: range.start, count: limit - chosen.length, usedRegions: chosen.map(pick => pick.event.region), hasPhoto, flagships,
  });
  return [...chosen, ...rest.map(entry => ({ event: entry.event as unknown as IndexEvent, date: entry.date }))];
}

export type WeekendTabs = Record<WeekendDayTab, IndexEvent[]>;
/**
 * The weekend split into 周六 / 周日 / 整个周末都开放 (monthly.ts weekendDayTabs). Inside a tab: one-offs before
 * long-running series, then the home ranking (Chinese-language, free, family, real photo, flagship), adult-only last.
 */
export function weekendTabs(events: readonly IndexEvent[], today: string): { days: [string, string]; tabs: WeekendTabs } {
  const range = getMonthlyDateRange('weekend', today)!;
  const days: [string, string] = [range.start, range.end];
  const tabs: WeekendTabs = { sat: [], sun: [], open: [] };
  for (const event of events) for (const tab of weekendDayTabs(event, days, today)) tabs[tab].push(event);
  const rank = (list: IndexEvent[], day: string) => {
    const hasPhoto = (imageKey: string) => Object.hasOwn(EVENTS_INDEX.images, imageKey);
    const ranked = rankWeekendFallback(list.map(event => ({ event: event as unknown as MonthlyEvent, date: day })), range.start, { hasPhoto, flagships: WEEKEND_FLAGSHIP_IDS });
    return ranked.map(entry => entry.event as unknown as IndexEvent);
  };
  return { days, tabs: { sat: rank(tabs.sat, days[0]), sun: rank(tabs.sun, days[1]), open: rank(tabs.open, days[0]) } };
}
/** Saturday until it is over, then Sunday; an empty tab hands over to the next one with events. */
export function defaultDayTab(tabs: WeekendTabs, today: string, days: readonly [string, string]): WeekendDayTab {
  const order: WeekendDayTab[] = today >= days[1] ? ['sun', 'open', 'sat'] : ['sat', 'sun', 'open'];
  return order.find(tab => tabs[tab].length) ?? order[0];
}

/** Lists other than 本周末: by each event's next day, one-offs first, real photos first within ties. */
export function listEvents(events: readonly IndexEvent[], when: EventsWhen, today: string): IndexEvent[] {
  const range = getMonthlyDateRange(when, today);
  const from = range && range.start > today ? range.start : today;
  return orderByNextDay(events.filter(event => inRange(event, range, today)), from, event => hasRealCover('event', event, today));
}

// Offers and openings ------------------------------------------------------------------------------------------

export type OfferKind = 'all' | IndexOffer['kind'];
export const OFFER_KINDS: readonly { id: OfferKind; label: Copy }[] = [
  { id: 'all', label: { zh: '全部', en: 'All' } },
  { id: 'no-purchase', label: { zh: '无需购物', en: 'No purchase' } },
  { id: 'reservation', label: { zh: '需预约', en: 'Reservation' } },
  { id: 'purchase', label: { zh: '消费优惠', en: 'With purchase' } },
];
/** Live offers: dated ones ending soonest first, then the long-running ones; real images first within ties. */
export function liveOffers(offers: readonly IndexOffer[], today: string, kind: OfferKind = 'all', region: MonthlyRegion | 'all' = 'all'): IndexOffer[] {
  return offers.filter(offer => (!offer.endDate || offer.endDate >= today) && (!offer.startDate || offer.startDate <= addDaysIso(today, 45))
    && (kind === 'all' || offer.kind === kind) && (region === 'all' || !offer.region || offer.region === region))
    .map(offer => ({ offer, photo: hasRealCover('offer', offer, today) }))
    .sort((a, b) => (a.offer.endDate ?? '9999').localeCompare(b.offer.endDate ?? '9999') || Number(b.photo) - Number(a.photo) || a.offer.id.localeCompare(b.offer.id))
    .map(item => item.offer);
}
const addDaysIso = (day: string, amount: number) => new Date(Date.parse(`${day}T12:00:00Z`) + amount * 86_400_000).toISOString().slice(0, 10);

export type OpeningStatus = 'all' | IndexOpening['status'];
export const OPENING_STATUSES: readonly { id: OpeningStatus; label: Copy }[] = [
  { id: 'all', label: { zh: '全部', en: 'All' } },
  { id: 'open', label: { zh: '已开业', en: 'Open' } },
  { id: 'soft_open', label: { zh: '试营业', en: 'Soft opening' } },
  { id: 'announced', label: { zh: '预告与庆典', en: 'Coming soon' } },
];
export const filterOpenings = (openings: readonly IndexOpening[], status: OpeningStatus, region: MonthlyRegion | 'all') =>
  openings.filter(shop => (status === 'all' || shop.status === status) && (region === 'all' || shop.region === region));

/** Bulletins (交通、图书馆、生活服务的近期变动) in force today, for the folded 周末出行提醒 line. */
export const activeBulletins = (today: string, region: MonthlyRegion | 'all') =>
  EVENTS_INDEX.bulletins.filter(item => item.verifiedAt <= today && item.expiresAt >= today && (region === 'all' || item.region === region));

/**
 * The share card the page-end link opens: for the whole Bay Area the card dated today when this build wrote one (the
 * same card the home page links, RC-12), otherwise the region's build-day card.
 */
export const weeklyCardHref = (region: MonthlyRegion | 'all', today: string, days: readonly string[] = EVENTS_INDEX.weeklyCardDays ?? []) =>
  region === 'all' && days.includes(today) ? `/weekly/all-${today}.png` : `/weekly/${region}.png`;

/** Share card regions (/n/{region} → /events?region=…&from=card-…). */
export const CARD_REGIONS = ['all', 'sf', 'east-bay', 'peninsula', 'south-bay', 'north-bay'] as const;
export type CardRegion = typeof CARD_REGIONS[number];
export const cardRegionOf = (from: string | null): CardRegion | undefined => {
  const region = /^card-(.+)$/.exec(from || '')?.[1];
  return CARD_REGIONS.find(item => item === region);
};
