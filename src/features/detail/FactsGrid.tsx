import type { ReactNode } from 'react';
import { CalendarDays, Gift, MapPin, ShoppingBag, Store, Ticket, Users } from 'lucide-react';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import type { FreebieOffer } from '../../components/FreebieBoard';
import type { MonthlyEvent } from '../../data/monthly-types';
import type { SeptemberOpening } from '../../data/september-openings';
import { eventPriceChip, eventTimeLabel, offerKindLabel, offerValue, weekdayOf } from '../../lib/event-facts';
import { ReaderText } from './ReaderText';
import { readerCost } from './reader-text';

/**
 * "一眼看懂" (design.md §4.9 step 6): four facts in a 2×2 grid on a phone (one column at 大/特大 and in 简洁显示), a list in
 * the desktop column. Each cell: an icon, a 13px label, the value. Values come from structured overlay fields when present
 * (sessions, price, venueShort, address, ageChip) and from the listing's own labels otherwise; nothing is invented, so a
 * fact the source does not state is left out rather than guessed.
 */
type Cell = { key: string; icon: ReactNode; label: string; value: ReactNode; note?: ReactNode };

function Facts({ cells, label }: { cells: Cell[]; label: string }) {
  return <dl className="detail-facts" aria-label={label}>
    {cells.map(cell => <div key={cell.key} className="detail-fact" data-fact={cell.key}>
      <dt>{cell.icon}<span>{cell.label}</span></dt>
      <dd>{cell.value}{cell.note && <small>{cell.note}</small>}</dd>
    </div>)}
  </dl>;
}

const mapLink = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
const WEEKDAYS_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

/** Session days line by line: "周六 10/17 · 10–16 点". Up to four, then "另有 N 场". */
function SessionLines({ event, today }: { event: MonthlyEvent; today: string }) {
  const { english, t } = useUiCopy();
  const days = [...new Set((event.sessions ?? []).map(session => session.date))].sort();
  const upcoming = days.filter(day => day >= today);
  const shown = (upcoming.length ? upcoming : days).slice(0, 4);
  const more = (upcoming.length ? upcoming : days).length - shown.length;
  return <>
    {shown.map(day => {
      const time = eventTimeLabel(event, day, english);
      return <span key={day} className="detail-fact__line">{(english ? WEEKDAYS_EN : WEEKDAYS_ZH)[weekdayOf(day)]} {monthDay(day)}{time && ` · ${time}`}</span>;
    })}
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
      value: event.sessions?.length ? <SessionLines event={event} today={today} /> : <ReaderText text={event.dateLabel} />,
      note: event.dateNote ? <ReaderText text={event.dateNote} /> : undefined },
    { key: 'where', icon: <MapPin aria-hidden="true" />, label: t('在哪', 'Where'),
      value: <><span className="detail-fact__line">{translateText(place, locale)}</span>
        {event.address && event.address !== place && <span className="detail-fact__line detail-fact__sub">{event.address}</span>}
        {!event.address && event.city && !place.includes(event.city) && <span className="detail-fact__line detail-fact__sub">{translateText(event.city, locale)}</span>}</>,
      note: <a className="detail-map-link" href={mapLink(query)} target="_blank" rel="noopener noreferrer">{t('地图', 'Map')}</a> },
    { key: 'cost', icon: <Ticket aria-hidden="true" />, label: t('多少钱', 'Cost'),
      value: price && (price.tone !== 'paid' || !cost) ? <span className="detail-fact__line" data-tone={price.tone}>{pick(price.text)}</span> : <span className="detail-fact__line">{cost || t('票价见官网', 'See the official site')}</span>,
      note: price && price.tone !== 'paid' && cost && cost !== pick(price.text) ? cost : undefined },
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
  const { t, pick } = useUiCopy();
  const value = offerValue(offer);
  const cells: Cell[] = [
    { key: 'when', icon: <CalendarDays aria-hidden="true" />, label: t('有效期', 'Valid'), value: <ReaderText text={offer.dateLabel} /> },
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
    { key: 'when', icon: <CalendarDays aria-hidden="true" />, label: t('开业', 'Opening'), value: <ReaderText text={shop.dateLabel} /> },
    { key: 'where', icon: <MapPin aria-hidden="true" />, label: t('在哪', 'Where'),
      value: <span className="detail-fact__line">{shop.address || translateText(shop.city, locale)}</span>,
      note: <a className="detail-map-link" href={mapLink(`${shop.name}, ${shop.address || shop.city}`)} target="_blank" rel="noopener noreferrer">{t('地图', 'Map')}</a> },
    { key: 'what', icon: <Store aria-hidden="true" />, label: t('类型', 'Type'), value: translateText(shop.category, locale) },
  ];
  return <Facts cells={cells} label={t('一眼看懂', 'At a glance')} />;
}
