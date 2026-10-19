import { openingChip, readerDayRange, readerMonthDay, weekdayOf, type Copy } from '../../lib/event-facts';
import type { StatusLook } from '../../components/ui/Status';
import type { IndexOffer, IndexOpening } from './events-index-types';

/**
 * The 免费与优惠 and 新店 boards' facts (UI9-FREE, G18 / N06 / N08): line 1 and line 2 of an offer or opening card, the one
 * status chip, the board sections and the source line. Pure functions over the index records. It imports only
 * src/lib/event-facts.ts and types: events-model.ts would pull the events index into every chunk that uses it.
 */

/** One status in C's status map (`StatusChip`, covers.css `.ui-status[data-tone]`): its look and its words. */
export type BoardStatus = { tone: StatusLook; text: Copy };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (day: string | undefined): day is string => !!day && ISO_DAY.test(day) && new Date(`${day}T12:00:00Z`).toISOString().startsWith(day);
const addDays = (day: string, amount: number) => new Date(Date.parse(`${day}T12:00:00Z`) + amount * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
const WEEKDAYS_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/**
 * Joins the parts of a meta line. The no-break space glues the dot to the word before it, so a wrapped line ends on
 * "无需购物 ·" and the next one never starts with "·" (N06); the ordinary space after it is where the line may break.
 */
export const SEP = '\u00a0· ';
/** A record's own " · " ("Muir Woods · Marin", "Poppy & Claro · San José") glued the same way, at display time only. */
export const glueSeparators = (text: string): string => text.replace(/\s+·\s+/g, SEP);

type OfferDates = Pick<IndexOffer, 'availability' | 'startDate' | 'endDate' | 'weekdays'>;

/**
 * Line 1 of an offer card: when it can be used, in the same M/D pattern as the event cards' eventWhenLine. "周日 10/25"
 * (one day), "10/24–31" (a run that has not started), "至 11/11" (a run under way), "每周三" (published weekdays; "每周三 ·
 * 11/4 起" before its first day, "每周三 · 11/4–25" when it also ends), "长期有效" (no end date), "11/4 起" (no end date,
 * not started yet), "日期以官网为准" (a 查本店 offer without dates: the 16 check-local offers). Never the free-text
 * dateLabel and never an ISO date.
 */
export function offerWhen(offer: OfferDates, today: string): Copy {
  const end = validDay(offer.endDate) ? offer.endDate : undefined;
  const start = validDay(offer.startDate) ? offer.startDate : undefined;
  const ahead = start && start > today ? start : undefined;
  if (offer.weekdays?.length) {
    const days = [...offer.weekdays].sort((a, b) => a - b);
    const every: Copy = { zh: `每${days.map(day => WEEKDAYS_ZH[day]).join('、')}`, en: `Every ${days.map(day => WEEKDAYS_EN[day]).join(' & ')}` };
    // Before its first day a weekly offer says when it starts, so "每周三" never reads as usable this week; with an end
    // date it prints the whole run ("每周三 · 11/4–25"), so the reader also sees when it stops.
    if (ahead && end) return { zh: `${every.zh}${SEP}${readerDayRange(ahead, end)}`, en: `${every.en}${SEP}${readerDayRange(ahead, end, true)}` };
    if (ahead) return { zh: `${every.zh}${SEP}${readerMonthDay(ahead)} 起`, en: `${every.en}${SEP}from ${readerMonthDay(ahead, true)}` };
    return end ? { zh: `${every.zh}${SEP}至 ${readerMonthDay(end)}`, en: `${every.en}${SEP}until ${readerMonthDay(end, true)}` } : every;
  }
  if (!end) {
    // No end date and not started yet (ongoing or 查本店 alike): its first day, as the deals board's 即将开售 does.
    if (ahead) return { zh: `${readerMonthDay(ahead)} 起`, en: `From ${readerMonthDay(ahead, true)}` };
    return offer.availability === 'ongoing' ? { zh: '长期有效', en: 'Ongoing' } : { zh: '日期以官网为准', en: 'Dates on the official site' };
  }
  if (start === end) return { zh: `${WEEKDAYS_ZH[weekdayOf(end)]} ${readerMonthDay(end)}`, en: `${WEEKDAYS_EN[weekdayOf(end)]}, ${readerMonthDay(end, true)}` };
  if (ahead) return { zh: readerDayRange(ahead, end), en: readerDayRange(ahead, end, true) };
  return { zh: `至 ${readerMonthDay(end)}`, en: `Until ${readerMonthDay(end, true)}` };
}

/**
 * The one status an offer card prints (line 2), in priority order: 已售罄; 今天截止 / 明天截止; 还剩 N 天 (7 days or fewer).
 * Urgency applies only once the offer has started: a 10/25-only offer read on 10/19 shows no chip (line 1 carries its day),
 * not "还剩 6 天". Otherwise none: the value (免费, 半价) is the cover's key fact, so no 免费 chip is printed here.
 */
export function offerChip(offer: { status?: string; startDate?: string; endDate?: string }, today: string): BoardStatus | null {
  if (offer.status === 'sold_out') return { tone: 'urgent', text: { zh: '已售罄', en: 'Sold out' } };
  if (!validDay(offer.endDate) || (validDay(offer.startDate) && offer.startDate > today)) return null;
  const left = daysBetween(today, offer.endDate);
  if (left < 0) return null;
  if (left === 0) return { tone: 'urgent', text: { zh: '今天截止', en: 'Ends today' } };
  if (left === 1) return { tone: 'urgent', text: { zh: '明天截止', en: 'Ends tomorrow' } };
  return left <= 7 ? { tone: 'soon', text: { zh: `还剩 ${left} 天`, en: `${left} days left` } } : null;
}

/** What an offer asks of you, from the record's `kind` (line 2; the deals board's kind label). */
export const OFFER_CONDITIONS: Readonly<Record<IndexOffer['kind'], Copy>> = {
  'no-purchase': { zh: '无需购物', en: 'No purchase needed' },
  reservation: { zh: '需预约', en: 'Sign-up needed' },
  purchase: { zh: '需消费', en: 'Purchase required' },
  'check-terms': { zh: '条件待核对', en: 'Terms to confirm' },
};
export const offerCondition = (offer: Pick<IndexOffer, 'kind'>): Copy => OFFER_CONDITIONS[offer.kind] ?? OFFER_CONDITIONS['check-terms'];

// Board sections ---------------------------------------------------------------------------------------------------

export type OfferSectionId = 'week' | 'later' | 'ongoing';
export const OFFER_SECTIONS: readonly { id: OfferSectionId; label: Copy }[] = [
  { id: 'week', label: { zh: '这 7 天', en: 'Next 7 days' } },
  { id: 'later', label: { zh: '7 天以后', en: 'Later' } },
  { id: 'ongoing', label: { zh: '长期有效', en: 'Ongoing' } },
];
/** 这 7 天: it ends within a week of today; 7 天以后: later; 长期有效: no end date (the 查本店 offers too). */
export function offerSection(offer: Pick<IndexOffer, 'endDate'>, today: string): OfferSectionId {
  if (!validDay(offer.endDate)) return 'ongoing';
  return offer.endDate <= addDays(today, 7) ? 'week' : 'later';
}
/**
 * The perks board's three sections, in the order the list already has (ending soonest first, then photo first), with a
 * sold-out offer moved to the end of its section. Empty sections are left out.
 */
export function offerSections<T extends Pick<IndexOffer, 'endDate' | 'status'>>(offers: readonly T[], today: string): { id: OfferSectionId; label: Copy; offers: T[] }[] {
  return OFFER_SECTIONS.map(section => {
    const items = offers.filter(offer => offerSection(offer, today) === section.id);
    return { ...section, offers: [...items.filter(offer => offer.status !== 'sold_out'), ...items.filter(offer => offer.status === 'sold_out')] };
  }).filter(section => section.offers.length);
}

export type OpeningSectionId = 'open' | 'soon';
export const OPENING_SECTIONS: readonly { id: OpeningSectionId; label: Copy }[] = [
  { id: 'open', label: { zh: '已开业', en: 'Open now' } },
  { id: 'soon', label: { zh: '即将开业', en: 'Coming soon' } },
];
/** 已开业: open and soft-open shops whose first day (if recorded) has come; 即将开业: announced, or a first day still ahead. */
export const openingSection = (opening: Pick<IndexOpening, 'status' | 'openedOn'>, today: string): OpeningSectionId =>
  opening.status === 'announced' || (validDay(opening.openedOn) && opening.openedOn > today) ? 'soon' : 'open';
/**
 * 已开业: dated first days first, newest first (Marufuku 10/11), then the rest by their check date, newest first.
 * 即将开业: the nearest announced day first, then the rest by their check date, newest first.
 */
export function openingSections<T extends Pick<IndexOpening, 'id' | 'status' | 'openedOn' | 'verifiedAt'>>(openings: readonly T[], today: string): { id: OpeningSectionId; label: Copy; openings: T[] }[] {
  const checked = (a: T, b: T) => (b.verifiedAt ?? '').localeCompare(a.verifiedAt ?? '') || a.id.localeCompare(b.id);
  const dated = (shop: T) => validDay(shop.openedOn);
  return OPENING_SECTIONS.map(section => {
    const items = openings.filter(shop => openingSection(shop, today) === section.id);
    const order = section.id === 'open'
      ? (a: T, b: T) => Number(dated(b)) - Number(dated(a)) || (dated(a) ? b.openedOn!.localeCompare(a.openedOn!) : 0) || checked(a, b)
      : (a: T, b: T) => Number(dated(b)) - Number(dated(a)) || (dated(a) ? a.openedOn!.localeCompare(b.openedOn!) : 0) || checked(a, b);
    return { ...section, openings: [...items].sort(order) };
  }).filter(section => section.openings.length);
}

// Opening facts ----------------------------------------------------------------------------------------------------

/**
 * Line 1 of an opening card: openingChip unchanged (the words DETAIL's facts and the share cards print), in C's map: a shop
 * open on a recorded or stated day takes the 已开业 look (brand tint + ✓); 试营业, 预计 … 开业 and 即将开业 are neutral.
 */
export function openingStatus(opening: Pick<IndexOpening, 'status' | 'openedOn'>, today: string): BoardStatus {
  const text = openingChip(opening, today);
  const open = opening.status === 'open' && !(validDay(opening.openedOn) && opening.openedOn > today);
  return { tone: open ? 'open' : 'neutral', text };
}

/**
 * The status word a few categories start with ("开业预告 · 社区餐酒馆", "已营业 · 澳式寿司卷", "新餐厅 · 日式晚餐"): line 1
 * already says the status, so line 2 drops it at display time (12 of 60; the data is untouched).
 */
const LEADING_STATUS = /^(?:已营业|已开业|开业预告|迁址预告|重开预告|重新开业|长期快闪预告|快闪预告|新餐厅|新概念店|新店|New restaurant|New concept|Upcoming|Open|Opening soon|Relocation preview|Reopening preview|Extended pop-up preview|Pop-up preview|Reopening|Reopened)\s*·\s*/;
/** The Chinese record or its English translation ("New restaurant · Japanese dinner" → "Japanese dinner"). */
export const openingSells = (category: string | undefined): string => (category ?? '').replace(LEADING_STATUS, '').trim();

/** When the category has no English, the opening type says what the place is. */
export const OPENING_TYPES: Readonly<Record<IndexOpening['openingType'], Copy>> = {
  'new-restaurant': { zh: '新开餐厅', en: 'New restaurant' },
  'new-store': { zh: '新店', en: 'New shop' },
  relocation: { zh: '搬新址', en: 'New location' },
  reopening: { zh: '重新开业', en: 'Reopened' },
  'extended-pop-up': { zh: '快闪店', en: 'Pop-up' },
  'opening-celebration': { zh: '开业活动', en: 'Opening celebration' },
};

// Sources ------------------------------------------------------------------------------------------------------------

/**
 * Outlets that report on openings, matched as whole words or hosts: "Eater SF" and "sf.eater.com", never "Polly Klaas
 * Community Theater" or "petalumapumpkinpatch.com". The word 报道 ("KQED 报道", "Hoodline 报道") is press too, so an
 * outlet not listed here never prints 「官网核对」. A label naming one of them and no official page of the place is press.
 */
const PRESS = /\beater\b|\bsfgate\b|\bsfist\b|\b(?:sf)?chronicle\b|san francisco standard|\bsf standard\b|(?:^|[\s·/.])patch\.com\b|\bbizjournals\b|\bnosh\b|报道/i;
/** A label that also names the place's own page or announcement ("官网", "官方", "品牌门店页", "公告") is official. */
const OFFICIAL = /官方|官网|门店页|品牌|公告|市府/;
/**
 * DECISIONS 17 (owner, 10-19): an item whose source is press, not the organiser's or the shop's own page, prints
 * 「媒体报道 · 10/7 核对」, never 「官网核对」. Read from the record's source label; no data edit.
 */
export const pressSourced = (sourceLabel: string | undefined): boolean => {
  const label = (sourceLabel ?? '').trim();
  if (/^媒体报道/.test(label)) return true;
  return PRESS.test(label) && !OFFICIAL.test(label);
};
