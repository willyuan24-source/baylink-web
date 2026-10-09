import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ChipRow, EmptyState, FeedGrid, FeedItem, FilterChip, useFeedLayout } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { createCoverPage, distinctNeighbourTones, resolveCovers } from '../../lib/cover';
import { INDEX_OPENINGS, OPENING_STATUSES, coverContext, filterOpenings, type OpeningStatus } from './events-model';
import type { MonthlyRegion } from './events-index-types';
import { OpeningFeedCard } from './EventCards';
import { ImageCredits } from './ImageCredits';

const PAGE = 12;
const OPENINGS_GUIDE = '/guides/bay-area-new-openings-2026-09';

/**
 * 新店: the shop's own image or the opening TypeCover with an honest chip ("10 月开业", "即将开业", "试营业"); opened, soft
 * openings and announcements filtered apart (a celebration date is not a first day of service).
 */
export default function OpeningsView({ today, region }: { today: string; region: MonthlyRegion | 'all' }) {
  const { t, pick } = useUiCopy();
  const [status, setStatus] = useState<OpeningStatus>('all');
  const [shown, setShown] = useState(PAGE);
  const { layout } = useFeedLayout();
  const openings = useMemo(() => filterOpenings(INDEX_OPENINGS, status, region), [status, region]);
  const visible = openings.slice(0, shown);
  const covers = useMemo(() => resolveCovers(visible.map(shop => ({ kind: 'opening' as const, id: shop.id, imageKey: shop.imageKey })), { ...coverContext(today), page: createCoverPage() }), [visible, today]);
  const tones = distinctNeighbourTones(visible.map((shop, index) => covers[index].tier === 'type' ? (shop.openingType === 'new-restaurant' ? 'food' : 'family') : null));
  const counts = Object.fromEntries(OPENING_STATUSES.map(option => [option.id, filterOpenings(INDEX_OPENINGS, option.id, region).length]));
  const more = Math.min(PAGE, openings.length - visible.length);
  return <>
    <ChipRow label={t('按开业状态筛选', 'Filter by status')} className="ev-perks-kinds">
      {OPENING_STATUSES.map(option => <FilterChip key={option.id} selected={status === option.id} count={counts[option.id]} onClick={() => { setStatus(option.id); setShown(PAGE); }}>{pick(option.label)}</FilterChip>)}
    </ChipRow>
    <p className="ev-count" role="status" aria-live="polite">{t(`${openings.length} 家 · 已开业、试营业与预告分开标注；整理自公开资料，未实地探店`, `${openings.length} shops · open, soft-opening and announced are marked apart; from public sources, not visited`)}</p>
    {visible.length ? <>
      <FeedGrid label={t('新店', 'New shops')} layout={layout}>
        {visible.map((shop, index) => <FeedItem key={shop.id}><OpeningFeedCard opening={shop} cover={covers[index]} today={today} tone={tones[index] ?? undefined} /></FeedItem>)}
      </FeedGrid>
      {more > 0 && <div className="ev-more"><Button variant="secondary" block onClick={() => setShown(count => count + PAGE)}>{t(`再看 ${more} 家`, `Show ${more} more`)}</Button></div>}
    </> : <EmptyState headingLevel="h3" title={t('这个地区暂时没有符合条件的新店', 'No new shops match this yet')} body={t('换个状态或地区再看看。', 'Try another status or region.')}
      actions={<Button variant="primary" onClick={() => setStatus('all')}>{t('看全部新店', 'See all new shops')}</Button>} />}
    <nav className="ev-end" aria-label={t('新店指南', 'New shop guide')}>
      <Link className="ev-end__item" to={OPENINGS_GUIDE}>{t('新店手册：去之前先确认开门', 'New shop guide: check they are open first')}</Link>
    </nav>
    <ImageCredits covers={covers} />
  </>;
}
