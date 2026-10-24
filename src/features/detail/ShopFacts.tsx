import { CalendarDays, Gift, MapPin, ShoppingBag, Store } from 'lucide-react';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import type { FreebieOffer } from '../../components/FreebieBoard';
import type { SeptemberOpening } from '../../data/september-openings';
import { offerKindLabel, offerValue, openingChip, readerMonthDay } from '../../lib/event-facts';
import { openingStatusNote } from '../../lib/opening-status';
import { BenefitSteps } from './BenefitSteps';
import { mapLink, outLink, readerNode, type FactsLink } from './fact-links';
import { Facts, type Cell } from './FactsGrid';
import { PhoneLinked } from './ReaderText';
import { readerProse } from './reader-text';
import { provideShopParts } from './shop-parts';

/**
 * The offer and opening pages' own parts of the detail (FactsGrid's 一眼看懂 card for an offer and an opening, and an
 * offer's BenefitSteps), in a chunk of their own: an event page, the route most visitors open, never downloads them
 * (R2-INT12: the round-2 detail fixes put /events/:id 0.6 KiB over main). load-detail.ts loads this module with an offer's
 * or an opening's bucket and the page suspends until both are in; importing it registers the parts (shop-parts.ts), which
 * is how scripts/prerender.tsx and the tests that render an offer or an opening directly get them.
 */
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
 * its advice without its status word ("当天营业与订位请查商家入口。", not "已开业 · …"). A shop with no recorded day
 * takes the listing's date line as the key ("计划 9 月下旬 · 未公布确切日"), else the chip's words. The date line follows the
 * day at 400 without a leading day-and-status the chip and the key already say ("10/1 已开业 · 午餐周一至五" → "午餐周一至五";
 * "9 月 9 日已开业" alone → no line); 简洁显示 keeps the hours. Presentation only, no data edit: the line is cut after it is
 * translated, so /en and 繁體 read their own words. Whether it has that lead is decided on the Chinese source (as timeKey):
 * /en words it many ways ("Opened August 10 · …", "Open since Oct 1 · …"), so there it drops its words up to the first ·.
 */
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const OPENED_LEAD = /^\s*(?:(?:\d{1,2}\s*月\s*\d{1,2}\s*日|\d{1,2}\/\d{1,2})\s*已[开開][业業]|Open(?:ed| since)\s+[A-Z][a-z]+\.?\s+\d{1,2})\s*(?:·\s*|$)/;
const afterOpenedLead = (prose: string, source: string, english: boolean) => {
  if (!OPENED_LEAD.test(source)) return prose.replace(OPENED_LEAD, '').trim();
  const at = prose.indexOf('·');
  const rest = !source.replace(OPENED_LEAD, '').trim() ? '' : at >= 0 ? prose.slice(at + 1).trim() : prose.replace(OPENED_LEAD, '').trim();
  return english ? rest.charAt(0).toUpperCase() + rest.slice(1) : rest;
};
/**
 * C P16: with no day, a date label that is a time and the status ("2026 年夏季已开业", "Opened early fall 2026", "2026 年 6 月已营业
 * · 九月复核") would say the 已开业 chip's word again as the 开业 key: the key keeps the time ("2026 年夏季", "Early fall 2026").
 * Decided on the Chinese source, so every locale drops the same word.
 */
const STATUS_AFTER_TIME = /^(\d{4}\s*年[^·；;，,]*?)\s*已[开開营營][业業](?=\s*(?:·|$))/;
const EN_STATUS_BEFORE_TIME = /^Open(?:ed| since)\s+([^·;]*?\d{4})(?=\s*(?:·|$))/;
const timeKey = (prose: string, source: string) => !STATUS_AFTER_TIME.test(source) ? prose
  : prose.replace(STATUS_AFTER_TIME, '$1').replace(EN_STATUS_BEFORE_TIME, (_, time: string) => time.charAt(0).toUpperCase() + time.slice(1));

/** "已开业 · 当天营业…" → "当天营业…" (after translation: "Open · Check …" → "Check …"). */
const withoutStatusWord = (note: string) => { const at = note.indexOf(' · '); return at > 0 && at <= 12 ? note.slice(at + 3) : note; };

export function OpeningFacts({ shop, today, official }: { shop: SeptemberOpening; today: string; official?: FactsLink }) {
  const { t, pick, locale, english } = useUiCopy();
  const day = shop.openedOn && DAY.test(shop.openedOn) ? shop.openedOn : undefined;
  const shown = day ? readerMonthDay(day, english) : '';
  const ahead = !!day && (day > today || shop.status === 'announced');
  const prose = readerProse(shop.dateLabel, locale);
  const key = shown ? ahead ? t(`预计 ${shown}`, `Expected ${shown}`) : shown : prose ? <PhoneLinked text={timeKey(prose, shop.dateLabel)} /> : pick(openingChip(shop, today));
  const rest = shown ? afterOpenedLead(prose, shop.dateLabel, english) : '';
  const dateLine = rest ? <PhoneLinked text={rest} /> : undefined;
  const cells: Cell[] = [
    { key: 'when', icon: <CalendarDays aria-hidden="true" />, label: t('开业', 'Opening'), value: key, aside: official && outLink(official),
      note: <>{dateLine && <span className="detail-fact__line">{dateLine}</span>}<span className="detail-fact__line" data-simple="hide">{withoutStatusWord(translateText(openingStatusNote(shop.status), locale))}</span></> },
    { key: 'where', icon: <MapPin aria-hidden="true" />, label: t('在哪', 'Where'), value: shop.address || translateText(shop.city, locale),
      aside: outLink({ href: mapLink(`${shop.name}, ${shop.address || shop.city}`), label: t('地图', 'Map') }, true) },
    { key: 'what', icon: <Store aria-hidden="true" />, label: t('类型', 'Type'), value: translateText(shop.category, locale) },
  ];
  return <Facts cells={cells} label={t('一眼看懂', 'At a glance')} />;
}

provideShopParts({ OfferFacts, OpeningFacts, BenefitSteps });
