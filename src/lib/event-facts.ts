import type { MonthlyEvent } from '../data/monthly-types';
import type { FreebieOffer } from '../components/FreebieBoard';
import type { SeptemberOpening } from '../data/september-openings';
import type { PlanningFacts } from './planner';

/**
 * Decision facts for covers, stickers and card meta lines (plan WEB-UI, design.md §4.7–4.8).
 * Pure functions over the listing record with type-only imports, so any page can use them without
 * pulling catalog data into its chunk. Structured editorial fields (the CNT overlay: `shortTitle`,
 * `venueShort`, `price`, `sessions`) win when present; otherwise the facts are parsed from today's
 * fields. A card never prints the free-text `dateLabel`; an unknown date reads "日期见详情", and
 * nothing is called free unless `cost` says so.
 */

/** One visible string in both reading languages; zh-Hant is the runtime conversion of `zh`. */
export type Copy = { zh: string; en: string };
export const pickCopy = (copy: Copy, english: boolean) => english ? copy.en : copy.zh;

type Session = { date: string; start?: string; end?: string };
/** Optional CNT overlay fields, read when present. */
export type EventOverlay = {
  shortTitle?: string;
  venueShort?: string;
  price?: { free?: boolean; min?: number; max?: number; note?: string };
  sessions?: Session[];
  iconKey?: string;
};
export type EventFactsInput = Pick<MonthlyEvent, 'id' | 'title' | 'startDate' | 'endDate' | 'occurrenceDates' | 'city' | 'category' | 'cost' | 'audience'>
  & EventOverlay & { planning?: Pick<PlanningFacts, 'admissionUsd' | 'schedule'> };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (day: string | undefined): day is string => !!day && ISO_DAY.test(day) && !Number.isNaN(Date.parse(`${day}T12:00:00Z`)) && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day;
const WEEKDAYS_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
const monthDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
const addDays = (day: string, amount: number) => new Date(Date.parse(`${day}T12:00:00Z`) + amount * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

/** Confirmed days win; `[]` means no day is confirmed, so the event occurs on none. */
export function eventOccursOnDay(event: Pick<MonthlyEvent, 'startDate' | 'endDate' | 'occurrenceDates'>, day: string): boolean {
  if (day < event.startDate || day > event.endDate) return false;
  return event.occurrenceDates === undefined || event.occurrenceDates.includes(day);
}

export type DateChip =
  | { kind: 'day'; date: string; ended: boolean }
  | { kind: 'from'; date: string }
  | { kind: 'until'; date: string }
  | { kind: 'range'; start: string; end: string }
  | { kind: 'unknown' };

/**
 * The one date a card can state honestly.
 * - `days` (the days a feed shows, e.g. the weekend) picks the first of them the event occurs on.
 * - Otherwise the next confirmed occurrence, or a single-day event's date.
 * - A run of up to a week reads "10/10–11"; a longer run "10/10 起" before it opens and "至 11/15" while it runs.
 * Malformed dates and runs with no confirmed day are `unknown` ("日期见详情").
 * Callers pass `occurrenceDates` with any date overrides already applied.
 */
export function eventDateChip(event: Pick<MonthlyEvent, 'startDate' | 'endDate' | 'occurrenceDates'> & { sessions?: Session[] }, today: string, days: readonly string[] = []): DateChip {
  if (!validDay(event.startDate) || !validDay(event.endDate) || event.endDate < event.startDate) return { kind: 'unknown' };
  const confirmed = event.sessions?.length ? event.sessions.map(session => session.date).filter(validDay) : event.occurrenceDates;
  const resolved = { ...event, occurrenceDates: confirmed };
  const shown = days.find(day => eventOccursOnDay(resolved, day));
  if (shown) return { kind: 'day', date: shown, ended: shown < today };
  if (confirmed !== undefined) {
    const sorted = [...confirmed].filter(day => day >= event.startDate && day <= event.endDate).sort();
    if (!sorted.length) return { kind: 'unknown' };
    const next = sorted.find(day => day >= today);
    return next ? { kind: 'day', date: next, ended: false } : { kind: 'day', date: sorted[sorted.length - 1], ended: true };
  }
  if (event.startDate === event.endDate) return { kind: 'day', date: event.startDate, ended: event.startDate < today };
  if (today <= event.endDate && daysBetween(event.startDate, event.endDate) <= SHORT_RUN_DAYS) return { kind: 'range', start: event.startDate, end: event.endDate };
  if (today < event.startDate) return { kind: 'from', date: event.startDate };
  if (today <= event.endDate) return { kind: 'until', date: event.endDate };
  return { kind: 'day', date: event.endDate, ended: true };
}

/** Runs up to this many days after the first one print both ends ("10/10–11"). */
const SHORT_RUN_DAYS = 6;

export type DateChipText = { big: string; small: string; smallFirst: boolean; label: string };
/** Display parts: the big numeral, its qualifier (weekday / 起 / 截止), and the one-line sticker text. */
export function formatDateChip(chip: DateChip, english: boolean): DateChipText {
  if (chip.kind === 'unknown') return { big: '', small: '', smallFirst: false, label: english ? 'See details for dates' : '日期见详情' };
  if (chip.kind === 'range') {
    const sameMonth = chip.start.slice(0, 7) === chip.end.slice(0, 7);
    const big = `${monthDay(chip.start)}–${sameMonth ? Number(chip.end.slice(8, 10)) : monthDay(chip.end)}`;
    const names = english ? WEEKDAYS_EN : WEEKDAYS_ZH;
    return { big, small: `${names[weekdayOf(chip.start)]}–${names[weekdayOf(chip.end)]}`, smallFirst: false, label: big };
  }
  const big = monthDay(chip.date);
  if (chip.kind === 'day') {
    const small = (english ? WEEKDAYS_EN : WEEKDAYS_ZH)[weekdayOf(chip.date)];
    return { big, small, smallFirst: false, label: `${small} ${big}` };
  }
  if (chip.kind === 'from') return english ? { big, small: 'From', smallFirst: true, label: `From ${big}` } : { big, small: '起', smallFirst: false, label: `${big} 起` };
  return english ? { big, small: 'Until', smallFirst: true, label: `Until ${big}` } : { big, small: '截止', smallFirst: false, label: `至 ${big}` };
}

const hour = (time: string | undefined) => /^(\d{1,2}):(\d{2})$/.exec(time || '');
type TimeSpan = { open: string; close?: string };
const span = (item?: { start?: string; end?: string }): TimeSpan | undefined => item?.start ? { open: item.start, close: item.end } : undefined;
/** "11–19 点" / "11am–7pm" for the shown day, from structured sessions or the verified schedule only. */
export function eventTimeLabel(event: Pick<EventFactsInput, 'sessions' | 'planning'>, day: string, english: boolean): string | undefined {
  const schedule = event.planning?.schedule;
  const weeklyApplies = !!schedule?.weekly && validDay(day) && (!schedule.validFrom || day >= schedule.validFrom) && (!schedule.validThrough || day <= schedule.validThrough);
  const window: TimeSpan | undefined = span(event.sessions?.find(item => item.date === day))
    ?? schedule?.dates?.[day]?.[0]
    ?? span(schedule?.sessions?.find(item => item.date === day))
    ?? (weeklyApplies ? schedule?.weekly?.[weekdayOf(day)]?.[0] : undefined);
  const a = hour(window?.open), b = hour(window?.close);
  if (!a) return undefined;
  if (english) {
    const twelve = (match: RegExpExecArray) => {
      const h = Number(match[1]), suffix = h >= 12 ? 'pm' : 'am', h12 = h % 12 || 12;
      return `${h12}${match[2] === '00' ? '' : `:${match[2]}`}${suffix}`;
    };
    return b ? `${twelve(a)}–${twelve(b)}` : `From ${twelve(a)}`;
  }
  if (a[2] === '00' && (!b || b[2] === '00')) return b ? `${Number(a[1])}–${Number(b[1])} 点` : `${Number(a[1])} 点起`;
  return b ? `${a[1]}:${a[2]}–${b[1]}:${b[2]}` : `${a[1]}:${a[2]} 起`;
}

export type PriceChip = { tone: 'free' | 'mixed' | 'price' | 'paid'; text: Copy };
const usd = (value: number) => `$${Number.isInteger(value) ? value : value.toFixed(2)}`;
/**
 * The price sticker. 免费 only when `cost` is free; 部分免费 when mixed; an amount only when a structured
 * price or the planning admission is known; an unknown cost shows nothing.
 */
export function eventPriceChip(event: Pick<EventFactsInput, 'cost' | 'price' | 'planning'>): PriceChip | null {
  if (event.cost === 'free') return { tone: 'free', text: { zh: '免费', en: 'Free' } };
  if (event.cost === 'mixed') return { tone: 'mixed', text: { zh: '部分免费', en: 'Partly free' } };
  if (event.cost !== 'paid') return null;
  const { min, max } = event.price ?? {};
  if (typeof min === 'number' && min > 0 && typeof max === 'number' && max > min) return { tone: 'price', text: { zh: `${usd(min)}–${max}`, en: `${usd(min)}–${max}` } };
  const single = typeof min === 'number' && min > 0 ? min : event.planning?.admissionUsd;
  if (typeof single === 'number' && single > 0) return { tone: 'price', text: { zh: usd(single), en: usd(single) } };
  return { tone: 'paid', text: { zh: '收费', en: 'Paid' } };
}

/** Width in CJK display units: Han and full-width count 1, everything else ½. */
export const displayUnits = (text: string) => [...text].reduce((sum, char) => sum + (/[\u3000-\u9fff\uff00-\uffef]/.test(char) ? 1 : .5), 0);

/**
 * `shortTitle` from the overlay, else the part of the title before its first separator when that part is
 * a name in its own right (≥4 units), else the full title, left to the CSS line clamp. Never cut mid-word.
 */
export function eventShortTitle(event: Pick<EventFactsInput, 'title' | 'shortTitle'>): string {
  if (event.shortTitle?.trim()) return event.shortTitle.trim();
  const title = event.title.trim();
  // A colon between two digits is a clock time ("7:30"), not a separator.
  const head = title.split(/[：:](?!\d)|(?<!\d)[：:]|[｜|]| — | – /)[0].trim();
  return head !== title && displayUnits(head) >= 4 ? head : title;
}

/** Short place for a meta line: overlay `venueShort`, else the city. */
export const eventPlace = (event: Pick<EventFactsInput, 'city' | 'venueShort'>) => event.venueShort?.trim() || event.city.trim();

export type CoverTone = 'family' | 'culture' | 'outdoors' | 'food' | 'seniors' | 'free';
export const COVER_TONES: readonly CoverTone[] = ['family', 'culture', 'outdoors', 'food', 'seniors', 'free'];
const SENIOR_AUDIENCE = /长者|长辈|老人|乐龄|樂齡|senior/i;
/** Palette family: the event category, or 长者与社区 when the audience names seniors. */
export function eventTone(event: Pick<EventFactsInput, 'category' | 'audience'>): CoverTone {
  if (event.audience?.some(item => SENIOR_AUDIENCE.test(item))) return 'seniors';
  return event.category;
}
const TONE_LABELS: Record<CoverTone, Copy> = {
  family: { zh: '亲子活动', en: 'Family' },
  culture: { zh: '文化活动', en: 'Culture' },
  outdoors: { zh: '户外活动', en: 'Outdoors' },
  food: { zh: '美食市集', en: 'Food & markets' },
  seniors: { zh: '长者与社区', en: 'Seniors & community' },
  free: { zh: '免费福利', en: 'Free perks' },
};
/** The truthful category label. A neighbour-colour rotation may change the palette, never this label. */
export const toneLabel = (tone: CoverTone): Copy => TONE_LABELS[tone];

// Offers (TypeCover family B) -------------------------------------------------------------------

export type OfferFactsInput = Pick<FreebieOffer, 'brand' | 'title' | 'endDate' | 'availability'> & Partial<Pick<FreebieOffer, 'kind'>>
  & { valueText?: string; publicBenefit?: boolean };

/**
 * Chinese discounts name the share you pay: "7 折" / "8.5 折" (one digit, tenths) and "85 折" / "95折" (two digits,
 * hundredths) are 30% / 15% / 15% / 5% off. Returns null for anything that is not a rate people write ("10 折",
 * "0 折", "85.5 折"), so the cover leads with the title instead of a guess.
 */
export function discountOff(written: string): number | null {
  const paid = Number(written);
  if (!Number.isFinite(paid)) return null;
  const share = paid < 10 ? paid * 10 : Number.isInteger(paid) && paid % 10 !== 0 ? paid : NaN;
  const off = Math.round(100 - share);
  return off > 0 && off < 100 ? off : null;
}
type ValuePattern = [RegExp, (match: RegExpMatchArray, offer: Pick<OfferFactsInput, 'kind'>) => Copy | null];
const VALUE_PATTERNS: ValuePattern[] = [
  [/买一送一|buy one,? get one/i, () => ({ zh: '买一送一', en: 'BOGO' })],
  [/半价|half[- ]price/i, () => ({ zh: '半价', en: 'Half price' })],
  // The lookbehind keeps "85 折" from reading as "5 折" and "$20 折扣" (a dollar amount) out entirely.
  [/(?<![\d.$])(\d{1,2}(?:\.\d)?)\s*折(?!扣)/, match => {
    const off = discountOff(match[1]);
    return off === null ? null : { zh: `${match[1]} 折`, en: `${off}% off` };
  }],
  // The same in Chinese numerals: 八折, 八五折, 七五折.
  [/(?<![一二三四五六七八九十])([一二三四五六七八九]{1,2})折(?!扣)/, match => {
    const off = discountOff([...match[1]].map(digit => '一二三四五六七八九'.indexOf(digit) + 1).join(''));
    return off === null ? null : { zh: match[0], en: `${off}% off` };
  }],
  [/(?<![\d.$])(\d{1,2})\s*%\s*(?:off|折扣)/i, match => ({ zh: `${match[1]}% 折扣`, en: `${match[1]}% off` })],
  // A purchase offer is free only with the order, so the headline carries the condition.
  [/免费|free/i, (_, offer) => offer.kind === 'purchase' ? { zh: '随单免费', en: 'Free with purchase' } : { zh: '免费', en: 'Free' }],
];
/** Two discounts in one title ("衣物六折、美妆七折") have no single value to headline. */
const STATED_DISCOUNT = /[\d一二三四五六七八九]\s*折(?!扣)/g;
/**
 * The benefit value shown large: overlay `valueText`, else the one value the title states plainly, else none
 * (the cover then leads with the title).
 */
export function offerValue(offer: Pick<OfferFactsInput, 'title' | 'valueText' | 'kind'>): Copy | null {
  if (offer.valueText?.trim()) return { zh: offer.valueText.trim(), en: offer.valueText.trim() };
  if ((offer.title.match(STATED_DISCOUNT)?.length ?? 0) > 1) return null;
  for (const [pattern, copy] of VALUE_PATTERNS) {
    const match = offer.title.match(pattern);
    const value = match ? copy(match, offer) : null;
    if (value) return value;
  }
  return null;
}

export type DeadlineChip = { tone: 'danger' | 'warning' | 'success' | 'neutral'; text: Copy };
/** ≤1 day left → danger "今天/明天截止"; ≤7 → warning "还剩 N 天"; ongoing → success "长期有效". */
export function offerDeadline(offer: Pick<OfferFactsInput, 'endDate' | 'availability'>, today: string): DeadlineChip | null {
  if (validDay(offer.endDate)) {
    const left = daysBetween(today, offer.endDate);
    if (left < 0) return { tone: 'neutral', text: { zh: '已结束', en: 'Ended' } };
    if (left === 0) return { tone: 'danger', text: { zh: '今天截止', en: 'Ends today' } };
    if (left === 1) return { tone: 'danger', text: { zh: '明天截止', en: 'Ends tomorrow' } };
    if (left <= 7) return { tone: 'warning', text: { zh: `还剩 ${left} 天`, en: `${left} days left` } };
    return { tone: 'neutral', text: { zh: `至 ${monthDay(offer.endDate)}`, en: `Until ${monthDay(offer.endDate)}` } };
  }
  return offer.availability === 'ongoing' ? { tone: 'success', text: { zh: '长期有效', en: 'Ongoing' } } : null;
}

const ACRONYMS = new Set(['SF', 'SJ', 'UC', 'US', 'USA', 'BART', 'IKEA', 'OMCA', 'BAMPFA', 'SFMOMA', 'SFMTA', 'SFPL', 'SJMA', 'YMCA', 'AAPI', 'USCIS', 'CVS', 'AMC', 'REI', 'KQED', 'PBS', 'NASA', 'CHM', 'AT&T', 'H&M']);
const CASED_WORDS: Record<string, string> = { LINKEDIN: 'LinkedIn', YOUTUBE: 'YouTube', IPHONE: 'iPhone', EBAY: 'eBay', 'MCDONALD’S': 'McDonald’s' };
const SMALL_WORDS = new Set(['of', 'the', 'and', 'at', 'for', 'in', 'on', 'de', 'la', 'a', 'to']);
/** Normal case for the all-caps brand names (EVT-09: 160 of 183); known acronyms stay as written. */
export function brandCase(brand: string): string {
  if (/\p{Ll}/u.test(brand) || !/\p{Lu}/u.test(brand)) return brand;
  let first = true;
  return brand.split(/(\s+|·|\/)/).map(part => {
    if (!/\p{Lu}/u.test(part)) return part;
    const isFirst = first;
    first = false;
    if (ACRONYMS.has(part)) return part;
    if (Object.hasOwn(CASED_WORDS, part)) return CASED_WORDS[part];
    const lower = part.toLocaleLowerCase('en-US');
    if (!isFirst && SMALL_WORDS.has(lower)) return lower;
    return lower.replace(/(^|[-.])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toLocaleUpperCase('en-US'));
  }).join('');
}

const PUBLIC_BRAND = /librar|museum|park|garden|county|city of|conservatory|zoo|aquarium|sfmta|bart|caltrain|state|national|district|college|university|ymca|图书馆|博物馆|公园/i;
/** Public benefits (libraries, parks, museum free days) read as 免费福利; everything else as 商家活动. */
export const isPublicBenefit = (offer: Pick<OfferFactsInput, 'brand' | 'publicBenefit'>) => offer.publicBenefit ?? PUBLIC_BRAND.test(offer.brand);
export const offerTone = (offer: Pick<OfferFactsInput, 'brand' | 'publicBenefit'>): 'free' | 'family' => isPublicBenefit(offer) ? 'free' : 'family';
export const offerKindLabel = (offer: Pick<OfferFactsInput, 'brand' | 'publicBenefit'>): Copy => isPublicBenefit(offer) ? { zh: '免费福利', en: 'Free perk' } : { zh: '商家活动', en: 'Store promotion' };

// Openings -------------------------------------------------------------------------------------

export type OpeningFactsInput = Pick<SeptemberOpening, 'status' | 'openedOn'>;
/** "10 月开业" for a shop with a recorded first day of service; "即将开业" otherwise. Never a guessed date. */
export function openingChip(opening: OpeningFactsInput, today: string): Copy {
  const opened = validDay(opening.openedOn) ? opening.openedOn : undefined;
  if (opened && opened <= today && opening.status !== 'announced') {
    const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(new Date(`${opened}T12:00:00Z`));
    return { zh: `${Number(opened.slice(5, 7))} 月开业`, en: `Opened ${month}` };
  }
  if (opened && opened > today) return { zh: `预计 ${monthDay(opened)} 开业`, en: `Opening ${monthDay(opened)}` };
  return opening.status === 'soft_open' ? { zh: '试营业', en: 'Soft opening' } : { zh: '即将开业', en: 'Opening soon' };
}

/** The Saturday and Sunday of the weekend containing or following `today` ("本周末"). */
export function upcomingWeekend(today: string): [string, string] {
  const weekday = weekdayOf(today);
  const saturday = weekday === 0 ? addDays(today, -1) : addDays(today, 6 - weekday);
  return [saturday, addDays(saturday, 1)];
}
