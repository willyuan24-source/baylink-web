import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ChipRow, CoverCredit, EmptyState, FeedGrid, FeedItem, FilterChip, useFeedLayout } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { coverItemFor, createCoverPage, resolveCovers } from '../../lib/cover';
import { isFreeToAttend } from '../../lib/monthly';
import { INDEX_OFFERS, OFFER_KINDS, coverContext, inRange, listWindow, liveOffers, regionLabel, type OfferKind } from './events-model';
import { useIndexEvents } from './events-later';
import type { IndexOffer, MonthlyRegion } from './events-index-types';
import { getMonthlyDateRange } from '../../lib/monthly';
import { OfferFeedCard } from './BoardCards';
import { offerSections, type OfferSectionId } from './board-status';
import { ImageCredits } from './ImageCredits';
import { OptionSheetFilter, RegionFilter } from './RegionFilter';
import { useBoardMode, useSetRegion } from './board-mode';
import './boards.css';
import { preloadCoverFamilies } from '../../components/ui/cover-defer';

/** EventsFrame loads this board's info-card family with the board, before its first render (UI9-IMG-A0). */
// eslint-disable-next-line react-refresh/only-export-components
export const preloadCovers = () => preloadCoverFamilies(['ticket']);

/** "再看 N 条" adds this many to a section. */
const MORE = 12;
const DEALS_GUIDE = '/guides/bay-area-freebies-deals-2026-11';
const RETAIL_GUIDE = '/guides/bay-area-retail-freebies-family-deals';
const EVERYDAY_GUIDE = '/guides/bay-area-everyday-free-perks';
const NO_EXTRA: Readonly<Record<OfferSectionId, number>> = { week: 0, later: 0, ongoing: 0 };

/**
 * 免费与优惠 (content arrangement 10-19): the filter row, then three sections by end date — 这 7 天 · 7 天以后 · 长期有效,
 * each an h2 with its count and its own 再看 N 条 — ending soonest first, photo first within a day, sold-out offers last.
 * Cards: C's 1:1 ticket or the brand's image, line 1 when, line 2 [status] · condition · brand, the source line. The weekend's
 * free events and the three guides close the page. On a phone at 大 / 特大 / 简洁 the filter row is two Sheet chips and the
 * cards are rows; 简洁 shows 3 per section (家人版 2), hides sold-out offers and keeps one guide link.
 */
export default function PerksView({ today, region }: { today: string; region: MonthlyRegion | 'all' }) {
  const { t, pick } = useUiCopy();
  const [kind, setKind] = useState<OfferKind>('all');
  const [extra, setExtra] = useState<Readonly<Record<OfferSectionId, number>>>(NO_EXTRA);
  const { layout } = useFeedLayout();
  const mode = useBoardMode();
  const setRegion = useSetRegion();
  // 简洁显示 lists no sold-out offer, so every count on the board (Sheet footers, the status line, the widen buttons) is
  // taken from the same list the sections show.
  const usable = (list: IndexOffer[]) => mode.simple ? list.filter(offer => offer.status !== 'sold_out') : list;
  const listed = useMemo(() => usable(liveOffers(INDEX_OFFERS, today, kind, region)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- usable reads mode.simple
    [today, kind, region, mode.simple]);
  const sections = useMemo(() => offerSections(listed, today), [listed, today]);
  // Phone 4 / 4 / 4, desktop 8 / 4 / 4, 简洁 3 / 3 / 3, 家人版 2 / 2 / 2 (one row of four on desktop, two 2-up rows on a phone).
  const firstSize = (id: OfferSectionId) => mode.simple ? mode.simpleSize : !mode.phone && id === 'week' ? 8 : 4;
  const shown = sections.map(section => section.offers.slice(0, firstSize(section.id) + extra[section.id]));
  const shownKey = shown.map(list => list.map(offer => offer.id).join()).join('|');
  // One cover page for the whole board, so a picture is never shown twice across the sections.
  const covers = useMemo(() => {
    const flat = shown.flat();
    const resolved = resolveCovers(flat.map(offer => coverItemFor('offer', offer)), { ...coverContext(today), page: createCoverPage() });
    return new Map(flat.map((offer, index) => [offer.id, resolved[index]]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the ids shown
  }, [shownKey, today]);
  const coded = [...covers.values()].some(cover => cover.tier === 'type');
  const weekend = getMonthlyDateRange('weekend', today);
  // The weekend is in the route's own events; on a build over two weeks old the link is left out instead of loading the rest (WEB-PERF-2).
  const weekendDays = listWindow(weekend, today);
  const { events } = useIndexEvents(weekendDays.start, weekendDays.end, false);
  const freeEvents = (events ?? []).filter(event => inRange(event, weekend, today) && isFreeToAttend(event) && (region === 'all' || event.region === region)).length;
  const kindLabel = (id: OfferKind) => pick(OFFER_KINDS.find(option => option.id === id)!.label);
  const count = (n: number) => t(`${n} 条`, `${n} ${n === 1 ? 'offer' : 'offers'}`);
  const sheetStatus = t(`显示 ${listed.length} 条`, `Show ${listed.length}`);
  const pickKind = (id: OfferKind) => { setKind(id); setExtra(NO_EXTRA); };
  const card = (offer: IndexOffer) => <OfferFeedCard offer={offer} cover={covers.get(offer.id)!} today={today} row={mode.rows} simple={mode.simple} />;

  // Empty: one primary that widens the narrower filter, with what it would show.
  const wideRegion = region !== 'all' ? usable(liveOffers(INDEX_OFFERS, today, kind, 'all')).length : 0;
  const wideKind = kind !== 'all' ? usable(liveOffers(INDEX_OFFERS, today, 'all', region)).length : 0;
  const widen = wideRegion && wideRegion >= wideKind
    ? <Button variant="primary" onClick={() => setRegion('all')}>{kind === 'all' ? t(`看整个湾区的优惠（${wideRegion}）`, `Show the whole Bay Area (${wideRegion})`) : t(`看整个湾区的${kindLabel(kind)}（${wideRegion}）`, `Show ${kindLabel(kind)} across the Bay Area (${wideRegion})`)}</Button>
    : wideKind ? <Button variant="primary" onClick={() => pickKind('all')}>{t(`看${pick(regionLabel(region))}的全部优惠（${wideKind}）`, `Show every offer in ${pick(regionLabel(region))} (${wideKind})`)}</Button>
    : undefined;

  return <div className="fb-board">
    <div className="fb-filters" data-pair={mode.roomy ? '' : undefined}>
      <RegionFilter region={region} status={sheetStatus} />
      {mode.roomy
        ? <OptionSheetFilter label={t('全部条件', 'All conditions')} title={t('按领取条件筛选', 'Filter by condition')} value={kind} status={sheetStatus}
          options={OFFER_KINDS.map(option => ({ id: option.id, label: pick(option.label) }))} onChange={pickKind} />
        : <ChipRow label={t('按领取条件筛选', 'Filter by condition')} className="fb-kinds">
          {OFFER_KINDS.map(option => <FilterChip key={option.id} selected={kind === option.id} onClick={() => pickKind(option.id)}>{pick(option.label)}</FilterChip>)}
        </ChipRow>}
    </div>
    {/* Only while a condition narrows the board (the shell's facts line already gives the whole count). */}
    <p className="fb-status" role="status" aria-live="polite">{kind !== 'all' ? `${kindLabel(kind)} · ${count(listed.length)}` : ''}</p>
    {sections.length ? <div className="fb-sections">{sections.map((section, index) => {
      const more = Math.min(MORE, section.offers.length - shown[index].length);
      const head = `fb-perks-${section.id}`;
      return <section key={section.id} className="fb-section" aria-labelledby={head}>
        <h2 id={head} className="fb-section__head">{pick(section.label)}<span className="fb-section__count"> · {count(section.offers.length)}</span></h2>
        {mode.rows
          ? <ul className="fb-rows" aria-label={pick(section.label)}>{shown[index].map(offer => <li key={offer.id}>{card(offer)}</li>)}</ul>
          : <FeedGrid label={pick(section.label)} ratio="1:1" layout={layout}>{shown[index].map(offer => <FeedItem key={offer.id}>{card(offer)}</FeedItem>)}</FeedGrid>}
        {more > 0 && <div className="ev-more"><Button variant="secondary" block onClick={() => setExtra(previous => ({ ...previous, [section.id]: previous[section.id] + MORE }))}>{t(`再看 ${more} 条`, `Show ${more} more`)}</Button></div>}
      </section>;
    })}</div> : <EmptyState headingLevel="h3" title={t('这个条件下暂时没有优惠', 'No offers match this yet')} body={t('换个条件或地区再看看。', 'Try another condition or region.')} actions={widen} />}
    {/* The coded-cover note once for the whole board, under the last section, in grid and row layouts alike (H12 / SV13-02;
        boards.css hides each grid's own copy). EVENTS' ImageCredits takes it over in INT-1. */}
    {coded && <CoverCredit />}
    <nav className="ev-end" aria-label={t('优惠指南', 'Offer guides')}>
      {!mode.simple && freeEvents > 0 && <Link className="ev-end__item" to="/events?cost=free">{t(`本周末 ${freeEvents} 场免费活动`, `${freeEvents} free ${freeEvents === 1 ? 'event' : 'events'} this weekend`)}</Link>}
      <Link className="ev-end__item" to={DEALS_GUIDE}>{t('这一期的优惠怎么领', 'How to claim this month’s offers')}</Link>
      {!mode.simple && <Link className="ev-end__item" to={RETAIL_GUIDE}>{t('按品牌查门店赠品', 'Store freebies by brand')}</Link>}
      {!mode.simple && <Link className="ev-end__item" to={EVERYDAY_GUIDE}>{t('长期有效的免费福利', 'Free perks that last')}</Link>}
    </nav>
    <ImageCredits covers={[...covers.values()]} />
  </div>;
}
