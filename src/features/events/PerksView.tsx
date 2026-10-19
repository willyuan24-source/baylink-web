import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ChipRow, EmptyState, FeedGrid, FeedItem, FilterChip, useFeedLayout } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { createCoverPage, distinctNeighbourTones, resolveCovers } from '../../lib/cover';
import { offerTone } from '../../lib/event-facts';
import { isFreeToAttend } from '../../lib/monthly';
import { INDEX_OFFERS, OFFER_KINDS, coverContext, inRange, listWindow, liveOffers, type OfferKind } from './events-model';
import { useIndexEvents } from './events-later';
import type { MonthlyRegion } from './events-index-types';
import { getMonthlyDateRange } from '../../lib/monthly';
import { OfferFeedCard } from './BoardCards';
import { ImageCredits } from './ImageCredits';
import { RegionFilter } from './RegionFilter';

const PAGE = 12;
const DEALS_GUIDE = '/guides/bay-area-freebies-deals-2026-11';
const RETAIL_GUIDE = '/guides/bay-area-retail-freebies-family-deals';
const EVERYDAY_GUIDE = '/guides/bay-area-everyday-free-perks';

/**
 * 免费与优惠 (design.md §4.7.5 family B): 1:1 offer covers — the brand's own image, or the value large ("免费", "7 折") on
 * the B TypeCover with the brand in normal case and a deadline sticker — ending soonest first, filtered by condition.
 */
export default function PerksView({ today, region }: { today: string; region: MonthlyRegion | 'all' }) {
  const { t, pick } = useUiCopy();
  const [kind, setKind] = useState<OfferKind>('all');
  const [shown, setShown] = useState(PAGE);
  const { layout } = useFeedLayout();
  const offers = useMemo(() => liveOffers(INDEX_OFFERS, today, kind, region), [today, kind, region]);
  const visible = offers.slice(0, shown);
  const covers = useMemo(() => resolveCovers(visible.map(offer => ({ kind: 'offer' as const, id: offer.id, imageKey: offer.imageKey })), { ...coverContext(today), page: createCoverPage() }), [visible, today]);
  const tones = distinctNeighbourTones(visible.map((offer, index) => covers[index].tier === 'type' ? offerTone(offer) : null));
  const weekend = getMonthlyDateRange('weekend', today);
  // The weekend is in the route's own events; on a build over two weeks old the link is left out instead of loading the rest (WEB-PERF-2).
  const weekendDays = listWindow(weekend, today);
  const { events } = useIndexEvents(weekendDays.start, weekendDays.end, false);
  const freeEvents = (events ?? []).filter(event => inRange(event, weekend, today) && isFreeToAttend(event) && (region === 'all' || event.region === region)).length;
  const more = Math.min(PAGE, offers.length - visible.length);
  return <>
    <div className="ev-board-filters">
      <RegionFilter region={region} status={t(`显示 ${offers.length} 条`, `Show ${offers.length}`)} />
      <ChipRow label={t('按领取条件筛选', 'Filter by condition')} className="ev-perks-kinds">
        {OFFER_KINDS.map(option => <FilterChip key={option.id} selected={kind === option.id} onClick={() => { setKind(option.id); setShown(PAGE); }}>{pick(option.label)}</FilterChip>)}
      </ChipRow>
    </div>
    <p className="ev-count" role="status" aria-live="polite">{t(`${offers.length} 条，快截止的排在前面`, `${offers.length} offers, ending soonest first`)}</p>
    {freeEvents > 0 && <Link className="ev-inline-link" to="/events?cost=free">{t(`本周末还有 ${freeEvents} 场免费活动`, `${freeEvents} free events this weekend`)}</Link>}
    {visible.length ? <>
      <FeedGrid label={t('免费与优惠', 'Free & deals')} ratio="1:1" layout={layout}>
        {visible.map((offer, index) => <FeedItem key={offer.id}><OfferFeedCard offer={offer} cover={covers[index]} today={today} tone={tones[index] ?? undefined} /></FeedItem>)}
      </FeedGrid>
      {more > 0 && <div className="ev-more"><Button variant="secondary" block onClick={() => setShown(count => count + PAGE)}>{t(`再看 ${more} 条`, `Show ${more} more`)}</Button></div>}
    </> : <EmptyState headingLevel="h3" title={t('这个条件下暂时没有优惠', 'No offers match this yet')} body={t('换个条件或地区再看看。', 'Try another condition or region.')}
      actions={<Button variant="primary" onClick={() => setKind('all')}>{t('看全部优惠', 'See all offers')}</Button>} />}
    <nav className="ev-end" aria-label={t('优惠指南', 'Offer guides')}>
      <Link className="ev-end__item" to={DEALS_GUIDE}>{t('这一期的优惠怎么领', 'How to claim this month’s offers')}</Link>
      <Link className="ev-end__item" to={RETAIL_GUIDE}>{t('按品牌查门店赠品', 'Store freebies by brand')}</Link>
      <Link className="ev-end__item" to={EVERYDAY_GUIDE}>{t('长期有效的免费福利', 'Free perks that last')}</Link>
    </nav>
    <ImageCredits covers={covers} />
  </>;
}
