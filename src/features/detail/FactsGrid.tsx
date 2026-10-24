import { Fragment, useId, useState, type ReactNode } from 'react';
import { CalendarDays, Gift, MapPin, ShoppingBag, Store, Ticket, Users } from 'lucide-react';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText, type Locale } from '../../i18n/locale';
import type { FreebieOffer } from '../../components/FreebieBoard';
import type { MonthlyEvent } from '../../data/monthly-types';
import type { SeptemberOpening } from '../../data/september-openings';
import { displayUnits, eventPriceChip, eventWhenLine, offerKindLabel, offerValue, openingChip, readerMonthDay } from '../../lib/event-facts';
import { openingStatusNote } from '../../lib/opening-status';
import { ReaderText } from './ReaderText';
import { readerCost, readerProse } from './reader-text';
import { sessionLines } from './session-lines';
import './facts-grid.css';

/**
 * "一眼看懂" (UI9-DETAIL, content arrangement 10-19; UI9-R1-DETAIL): one card, the facts in a fixed order per kind, one per
 * row (event 何时 · 在哪 · 多少钱 · 适合, the last two side by side on a phone when 适合 is short, see EventFacts; offer
 * 有效期 · 福利 | 要不要消费 · 在哪, its two short values side by side; opening 开业 · 在哪 · 类型). Each fact: an icon and a 14 px label, then the key on line 1 at 600 (适合's list at 400) and everything
 * after it as the note at 400. The label line has one quiet right slot: 地图 ↗ on 在哪,
 * and 官方页 ↗ / 商家官网 ↗ on 何时 / 有效期 / 开业 whenever the page's primary action is not the official link (`official`).
 * Values come from structured overlay fields when present and from the listing's own labels otherwise; nothing is invented,
 * and a fact with no reader text left (reader-text.ts) is not rendered.
 */
type Cell = { key: string; icon: ReactNode; label: string; value: ReactNode; note?: ReactNode; clamp?: boolean; aside?: ReactNode };
export type FactsLink = { href: string; label: string };

/**
 * H58 / J1 P14: display units (CJK 1, other ½) of two lines of note across a phone's facts card (about 324px at the 14px
 * note size on a 390px phone; the cost fact has the whole row since UI9-R1-DETAIL). A longer cost note shows two lines
 * there, the second fading out, with 展开 on a line of its own under it (facts-grid.css); the sentence stays whole in the
 * page, for a screen reader and in the elder modes. A note just over two lines stays whole: a third line reads better than
 * a 展开 with nothing behind it. The count is an estimate for a 390 px phone: on a 414–430 px phone (a 354–364 px card) a
 * note of about 47–52 units fits two lines and still gets the fade and 展开 (nothing more behind it). Measuring the overflow
 * would need a layout read per fact, not worth it for those few notes.
 */
export const NOTE_CLAMP_UNITS = 46;

/** Catalog text as a cell value or note, or undefined when no reader text is left (readerProse). */
function readerNode(text: string | undefined, locale: Locale): ReactNode {
  return readerProse(text, locale) ? <ReaderText text={text} /> : undefined;
}

/** The label line's right slot: a quiet external link (地图, 官方页, 商家官网, 查询本地门店). */
const outLink = (link: FactsLink, map?: boolean) => <a className={map ? 'ui-more detail-fact__aside detail-map-link' : 'ui-more detail-fact__aside'} href={link.href} target="_blank" rel="noopener noreferrer">{link.label} ↗</a>;

/** One fact. A `clamp` note gets 展开 / 收起 (shown only where facts-grid.css clamps it: a phone in 标准). */
function Fact({ cell }: { cell: Cell }) {
  const { t } = useUiCopy();
  const noteId = useId();
  const [open, setOpen] = useState(false);
  const toggle = open ? t('收起', 'Less') : t('展开', 'More');
  const toggleName = t(`${toggle}：${cell.label}`, `${toggle}: ${cell.label}`);
  return <div className="detail-fact" data-fact={cell.key} data-clamp={cell.clamp ? '' : undefined} data-open={cell.clamp && open ? '' : undefined}>
    <dt>{cell.icon}<span>{cell.label}</span>{cell.aside}</dt>
    <dd><span className="detail-fact__key">{cell.value}</span>{cell.note && <small id={cell.clamp ? noteId : undefined}>{cell.note}</small>}
      {cell.clamp && cell.note && <button type="button" className="detail-fact__toggle" aria-expanded={open} aria-controls={noteId} aria-label={toggleName}
        onClick={() => setOpen(value => !value)}><span>{toggle}</span></button>}</dd>
  </div>;
}

function Facts({ cells, label }: { cells: Cell[]; label: string }) {
  return <dl className="detail-facts" aria-label={label}>
    {cells.filter(cell => (cell.value ?? '') !== '').map(cell => <Fact key={cell.key} cell={cell} />)}
  </dl>;
}

/** A cost sentence that opens by saying it is unconfirmed ("费用待核：…") under the value 费用待确认 starts at its reason. */
const UNCONFIRMED_LEAD = /^(?:费用待[核定确认]+|費用待[核定確認]+|Cost (?:to be confirmed|TBC|unconfirmed))[：:]\s*/i;

const mapLink = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

/**
 * One 何时 line that may wrap between its dates or after " · ", never inside a date run ("Oct 22–25") or a time
 * ("6:30pm–10pm"), so a separator never starts a line (WEB-FIX6).
 */
function WhenLine({ line, separator }: { line: string; separator: string }) {
  const at = line.lastIndexOf(' · ');
  const items = (at < 0 ? line : line.slice(0, at)).split(separator);
  return <>
    {items.map((item, index) => <Fragment key={index}>{index > 0 && separator}<span className="detail-fact__keep">{item}{at >= 0 && index === items.length - 1 && ' ·'}</span></Fragment>)}
    {at >= 0 && <> <span className="detail-fact__keep">{line.slice(at + 3)}</span></>}
  </>;
}

/**
 * Session days, one line per time (H58, session-lines.ts), as the note under the key: "周六 10/17、10/24、10/31 · 8:30–12:00",
 * "周四至周日 10/15–18 · 18:45–22:00", "每周六 10/17–11/28 · 9:00–13:00". At most two lines, then "另有 N 场" (天 when those
 * days have several sessions each).
 */
function SessionLines({ event, today }: { event: MonthlyEvent; today: string }) {
  const { english, t } = useUiCopy();
  const { lines, more, moreDays } = sessionLines(event, today, english);
  return <>
    {lines.map(line => <span key={line} className="detail-fact__line"><WhenLine line={line} separator={english ? ', ' : '、'} /></span>)}
    {more > 0 && <span className="detail-fact__line">{t(`另有 ${more} ${moreDays ? '天' : '场'}`, `${more} more date${more === 1 ? '' : 's'}`)}</span>}
  </>;
}

export function EventFacts({ event, today, official }: { event: MonthlyEvent; today: string; official?: FactsLink }) {
  const { t, pick, locale, english } = useUiCopy();
  const place = event.venueShort || event.venue;
  const query = [event.address || event.venue, event.city].filter(Boolean).join(', ');
  const price = eventPriceChip(event);
  const cost = readerCost(event.costLabel, event.cost, locale);
  const audience = [event.ageChip, ...event.audience].filter((value): value is string => !!value);
  const costNote = cost && cost !== (price ? pick(price.text) : '') ? (price ? cost : cost.replace(UNCONFIRMED_LEAD, '')) : undefined;
  // H58 (UI9-R1-DETAIL review): a 适合 list of up to 16 display units (two lines of half a phone's card at 400) keeps its
  // `for` cell, which facts-grid.css pairs with 多少钱 on a phone in 标准; the cost note beside it clamps from two lines of
  // that half card (22 units, the pre-R1 threshold). A longer list is `for-wide`: its own full row (J1 P14), the note on
  // the full row clamping from NOTE_CLAMP_UNITS.
  const audienceText = audience.map(value => translateText(value, locale)).join(' / ');
  const wide = !audienceText || displayUnits(audienceText) > 16;
  // The key is C's eventWhenLine as written (one date and one time style site-wide, N06). Several upcoming session days
  // follow as the note (on an ended page, all of them, so its archive keeps the whole run); a listing without sessions keeps
  // its own date line as the note while the key names no time. Whether it does is read from the zh line in every locale:
  // only a time follows " · " there (the en range chip joins its weekdays with " · " too, "Oct 22–25 · Thu–Sun").
  const whenLine = eventWhenLine(event, today), when = pick(whenLine);
  const allDays = new Set((event.sessions ?? []).map(session => session.date));
  const sessionDays = [...allDays].filter(day => day >= today).length || allDays.size;
  const dateLine = !event.sessions?.length && !whenLine.zh.includes(' · ') ? readerNode(event.dateLabel, locale) : undefined;
  const dateNote = readerNode(event.dateNote, locale);
  const whenNote = sessionDays > 1 || dateLine || dateNote ? <>
    {sessionDays > 1 && <SessionLines event={event} today={today} />}
    {dateLine && <span className="detail-fact__line">{dateLine}</span>}
    {dateNote && <span className="detail-fact__line">{dateNote}</span>}
  </> : undefined;
  const cells: Cell[] = [
    { key: 'when', icon: <CalendarDays aria-hidden="true" />, label: t('何时', 'When'), aside: official && outLink(official),
      value: <WhenLine line={when} separator={english ? ', ' : '、'} />, note: whenNote },
    { key: 'where', icon: <MapPin aria-hidden="true" />, label: t('在哪', 'Where'), aside: outLink({ href: mapLink(query), label: t('地图', 'Map') }, true),
      value: translateText(place, locale),
      note: event.address && event.address !== place ? event.address : !event.address && event.city && !place.includes(event.city) ? translateText(event.city, locale) : undefined },
    // The value is always short (免费 / 部分免费 / $8–12 / 收费, design.md §4.9): the listing's cost sentence is the note under
    // it, never a paragraph in the key. With no price at all the key says so instead of guessing.
    { key: 'cost', icon: <Ticket aria-hidden="true" />, label: t('多少钱', 'Cost'),
      value: price ? pick(price.text) : cost ? t('费用待确认', 'Cost not confirmed') : t('票价见官网', 'See the official site'),
      note: costNote, clamp: !!costNote && displayUnits(costNote) > (wide ? NOTE_CLAMP_UNITS : 22) },
  ];
  if (audienceText) cells.push({ key: wide ? 'for-wide' : 'for', icon: <Users aria-hidden="true" />, label: t('适合', 'Good for'), value: audienceText });
  return <Facts cells={cells} label={t('一眼看懂', 'At a glance')} />;
}

const PURCHASE: Record<FreebieOffer['kind'], { zh: string; en: string }> = {
  'no-purchase': { zh: '无需消费', en: 'No purchase needed' },
  reservation: { zh: '需预约或登记', en: 'Reservation or sign-up needed' },
  purchase: { zh: '需消费', en: 'Purchase required' },
  'check-terms': { zh: '条件见官方说明', en: 'See the official terms' },
};

export function OfferFacts({ offer, official }: { offer: FreebieOffer; official?: FactsLink }) {
  const { t, pick, locale } = useUiCopy();
  const value = offerValue(offer);
  const cells: Cell[] = [
    { key: 'when', icon: <CalendarDays aria-hidden="true" />, label: t('有效期', 'Valid'), value: readerNode(offer.dateLabel, locale), aside: official && outLink(official) },
    { key: 'what', icon: <Gift aria-hidden="true" />, label: t('福利', 'Benefit'), value: pick(value ?? offerKindLabel(offer)) },
    { key: 'terms', icon: <ShoppingBag aria-hidden="true" />, label: t('要不要消费', 'Purchase'), value: pick(PURCHASE[offer.kind]) },
  ];
  // A participating-store list exists only for chains; a single venue's offer has no "where" to look up (CNT-1011-06).
  if (offer.storeUrl) cells.push({ key: 'where', icon: <MapPin aria-hidden="true" />, label: t('在哪', 'Where'),
    value: t('参与门店 · 先查本地地址', 'Participating locations · check local addresses'),
    aside: outLink({ href: offer.storeUrl, label: t('查询本地门店', 'Find a location') }, true) });
  return <Facts cells={cells} label={t('一眼看懂', 'At a glance')} />;
}

/**
 * C P16: the shop's status is said once, by the status chip above the H1 (openingChip: 10/11 已开业 / 预计 11/20 开业). So
 * the 开业 key is the day itself (10/11, Oct 11; 预计 11/20 / Expected Nov 20 before it), and the status note under it keeps
 * its advice without its status word ("当天营业与订位请查商家入口。", not "已开业 · …"). A shop with no recorded day keeps
 * the chip's words as the key (即将开业, 试营业: nothing else says it). The listing's date line (hours, soft-open notes)
 * follows at 400 unless it only restates the day and the status ("9 月 9 日已开业"); 简洁显示 keeps the hours. Presentation
 * only, no data edit.
 */
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** A date line that is only "9 月 9 日已开业" / "9/9 已开业": the key and the chip say it already. */
const ONLY_OPENED = /^\s*(?:\d{1,2}\s*月\s*\d{1,2}\s*日|\d{1,2}\/\d{1,2})\s*已开业\s*$/;
/** "已开业 · 当天营业…" → "当天营业…" (after translation: "Open · Check …" → "Check …"). */
const withoutStatusWord = (note: string) => { const at = note.indexOf(' · '); return at > 0 && at <= 12 ? note.slice(at + 3) : note; };

export function OpeningFacts({ shop, today, official }: { shop: SeptemberOpening; today: string; official?: FactsLink }) {
  const { t, pick, locale, english } = useUiCopy();
  const dateLine = ONLY_OPENED.test(shop.dateLabel ?? '') ? undefined : readerNode(shop.dateLabel, locale);
  const day = shop.openedOn && DAY.test(shop.openedOn) ? shop.openedOn : undefined;
  const shown = day && readerMonthDay(day, english);
  const key = !day || !shown ? pick(openingChip(shop, today)) : day > today || shop.status === 'announced' ? t(`预计 ${shown}`, `Expected ${shown}`) : shown;
  const cells: Cell[] = [
    { key: 'when', icon: <CalendarDays aria-hidden="true" />, label: t('开业', 'Opening'), value: key, aside: official && outLink(official),
      note: <>{dateLine && <span className="detail-fact__line">{dateLine}</span>}<span className="detail-fact__line" data-simple="hide">{withoutStatusWord(translateText(openingStatusNote(shop.status), locale))}</span></> },
    { key: 'where', icon: <MapPin aria-hidden="true" />, label: t('在哪', 'Where'), value: shop.address || translateText(shop.city, locale),
      aside: outLink({ href: mapLink(`${shop.name}, ${shop.address || shop.city}`), label: t('地图', 'Map') }, true) },
    { key: 'what', icon: <Store aria-hidden="true" />, label: t('类型', 'Type'), value: translateText(shop.category, locale) },
  ];
  return <Facts cells={cells} label={t('一眼看懂', 'At a glance')} />;
}
