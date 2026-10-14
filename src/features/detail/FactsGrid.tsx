import type { ReactNode } from 'react';
import { CalendarDays, Gift, MapPin, ShoppingBag, Store, Ticket, Users } from 'lucide-react';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText, type Locale } from '../../i18n/locale';
import type { FreebieOffer } from '../../components/FreebieBoard';
import type { MonthlyEvent } from '../../data/monthly-types';
import type { SeptemberOpening } from '../../data/september-openings';
import { eventPriceChip, offerKindLabel, offerValue } from '../../lib/event-facts';
import { ReaderText } from './ReaderText';
import { readerCost, readerProse } from './reader-text';
import { sessionLines } from './session-lines';

/**
 * "一眼看懂" (design.md §4.9 step 6): four facts in a 2×2 grid on a phone (one column at 大/特大 and in 简洁显示), a list in
 * the desktop column. Each cell: an icon, a 13px label, the value. Values come from structured overlay fields when present
 * (sessions, price, venueShort, address, ageChip) and from the listing's own labels otherwise; nothing is invented, so a
 * fact the source does not state is left out rather than guessed. A cell whose text is all editor note (reader-text.ts) is
 * left out too: never an icon and a label over nothing.
 */
type Cell = { key: string; icon: ReactNode; label: string; value: ReactNode; note?: ReactNode };

/** Catalog text as a cell value or note, or undefined when no reader text is left (readerProse). */
function readerNode(text: string | undefined, locale: Locale): ReactNode {
  return readerProse(text, locale) ? <ReaderText text={text} /> : undefined;
}

function Facts({ cells, label }: { cells: Cell[]; label: string }) {
  return <dl className="detail-facts" aria-label={label}>
    {cells.filter(cell => cell.value !== undefined && cell.value !== null && cell.value !== '').map(cell => <div key={cell.key} className="detail-fact" data-fact={cell.key}>
      <dt>{cell.icon}<span>{cell.label}</span></dt>
      <dd>{cell.value}{cell.note && <small>{cell.note}</small>}</dd>
    </div>)}
  </dl>;
}

/** A cost sentence that opens by saying it is unconfirmed ("费用待核：…") under the value 费用待确认 starts at its reason. */
const UNCONFIRMED_LEAD = /^(?:费用待[核定确认]+|費用待[核定確認]+|Cost (?:to be confirmed|TBC|unconfirmed))[：:]\s*/i;

const mapLink = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

/**
 * Session days, one line per time (H58, session-lines.ts): "周六 10/17、10/24、10/31 · 08:30–12:00", "周四至周日 10/15–18 ·
 * 18:45–22:00", "每周六 10/17–11/28 · 9–13 点". At most two lines, then "另有 N 场", so the card ends above the phone's
 * action bar.
 */
function SessionLines({ event, today }: { event: MonthlyEvent; today: string }) {
  const { english, t } = useUiCopy();
  const { lines, more } = sessionLines(event, today, english);
  return <>
    {lines.map(line => <span key={line} className="detail-fact__line">{line}</span>)}
    {more > 0 && <span className="detail-fact__line">{t(`另有 ${more} 场`, `${more} more ${more === 1 ? 'date' : 'dates'}`)}</span>}
  </>;
}

export function EventFacts({ event, today }: { event: MonthlyEvent; today: string }) {
  const { t, pick, locale } = useUiCopy();
  const place = event.venueShort || event.venue;
  const query = [event.address || event.venue, event.city].filter(Boolean).join(', ');
  const price = eventPriceChip(event);
  const cost = readerCost(event.costLabel, event.cost, locale);
  const audience = [event.ageChip, ...event.audience].filter((value): value is string => !!value);
  const cells: Cell[] = [
    { key: 'when', icon: <CalendarDays aria-hidden="true" />, label: t('何时', 'When'),
      value: event.sessions?.length ? <SessionLines event={event} today={today} /> : readerNode(event.dateLabel, locale),
      note: readerNode(event.dateNote, locale) },
    { key: 'where', icon: <MapPin aria-hidden="true" />, label: t('在哪', 'Where'),
      value: <><span className="detail-fact__line">{translateText(place, locale)}</span>
        {event.address && event.address !== place && <span className="detail-fact__line detail-fact__sub">{event.address}</span>}
        {!event.address && event.city && !place.includes(event.city) && <span className="detail-fact__line detail-fact__sub">{translateText(event.city, locale)}</span>}</>,
      note: <a className="detail-map-link" href={mapLink(query)} target="_blank" rel="noopener noreferrer">{t('地图', 'Map')}</a> },
    // The value is always short (免费 / 部分免费 / $8–12 / 收费, design.md §4.9): the listing's cost sentence is the note under
    // it, never a bold paragraph in the value slot. With no price at all the value says so instead of guessing.
    { key: 'cost', icon: <Ticket aria-hidden="true" />, label: t('多少钱', 'Cost'),
      value: <span className="detail-fact__line" data-tone={price?.tone}>{price ? pick(price.text) : cost ? t('费用待确认', 'Cost not confirmed') : t('票价见官网', 'See the official site')}</span>,
      note: cost && cost !== (price ? pick(price.text) : '') ? (price ? cost : cost.replace(UNCONFIRMED_LEAD, '')) : undefined },
  ];
  if (audience.length) cells.push({ key: 'for', icon: <Users aria-hidden="true" />, label: t('适合', 'Good for'), value: audience.map(value => translateText(value, locale)).join(' / ') });
  return <Facts cells={cells} label={t('一眼看懂', 'At a glance')} />;
}

const PURCHASE: Record<FreebieOffer['kind'], { zh: string; en: string }> = {
  'no-purchase': { zh: '无需消费', en: 'No purchase needed' },
  reservation: { zh: '需预约或登记', en: 'Reservation or sign-up needed' },
  purchase: { zh: '需消费', en: 'Purchase required' },
  'check-terms': { zh: '条件见官方说明', en: 'See the official terms' },
};

export function OfferFacts({ offer }: { offer: FreebieOffer }) {
  const { t, pick, locale } = useUiCopy();
  const value = offerValue(offer);
  const cells: Cell[] = [
    { key: 'when', icon: <CalendarDays aria-hidden="true" />, label: t('有效期', 'Valid'), value: readerNode(offer.dateLabel, locale) },
    { key: 'what', icon: <Gift aria-hidden="true" />, label: t('福利', 'Benefit'), value: pick(value ?? offerKindLabel(offer)) },
    { key: 'terms', icon: <ShoppingBag aria-hidden="true" />, label: t('要不要消费', 'Purchase'), value: pick(PURCHASE[offer.kind]) },
  ];
  // A participating-store list exists only for chains; a single venue's offer has no "where" to look up (CNT-1011-06).
  if (offer.storeUrl) cells.push({ key: 'where', icon: <MapPin aria-hidden="true" />, label: t('在哪', 'Where'),
    value: t('参与门店 · 先查本地地址', 'Participating locations · check local addresses'),
    note: <a className="detail-map-link" href={offer.storeUrl} target="_blank" rel="noopener noreferrer">{t('查询本地门店', 'Find a location')}</a> });
  return <Facts cells={cells} label={t('一眼看懂', 'At a glance')} />;
}

export function OpeningFacts({ shop }: { shop: SeptemberOpening }) {
  const { t, locale } = useUiCopy();
  const cells: Cell[] = [
    { key: 'when', icon: <CalendarDays aria-hidden="true" />, label: t('开业', 'Opening'), value: readerNode(shop.dateLabel, locale) },
    { key: 'where', icon: <MapPin aria-hidden="true" />, label: t('在哪', 'Where'),
      value: <span className="detail-fact__line">{shop.address || translateText(shop.city, locale)}</span>,
      note: <a className="detail-map-link" href={mapLink(`${shop.name}, ${shop.address || shop.city}`)} target="_blank" rel="noopener noreferrer">{t('地图', 'Map')}</a> },
    { key: 'what', icon: <Store aria-hidden="true" />, label: t('类型', 'Type'), value: translateText(shop.category, locale) },
  ];
  return <Facts cells={cells} label={t('一眼看懂', 'At a glance')} />;
}
