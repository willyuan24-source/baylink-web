import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUiCopy } from '../../components/ui/ui-copy';
import type { Copy } from '../../lib/event-facts';
import type { DetailKind } from './load-detail';
import './detail-skeleton.css';

export const DETAIL_BACK: Record<DetailKind, { to: string; label: Copy }> = {
  event: { to: '/events', label: { zh: '活动', en: 'Events' } },
  offer: { to: '/events?view=perks', label: { zh: '免费与优惠', en: 'Free & deals' } },
  opening: { to: '/events?view=openings', label: { zh: '新店', en: 'New shops' } },
};

/** "‹ 活动": the page's way back, the same on the page, its skeleton and its error state. */
export function DetailBack({ kind }: { kind: DetailKind }) {
  const { t, pick } = useUiCopy();
  const back = DETAIL_BACK[kind];
  return <nav className="detail-back" aria-label={t('返回', 'Back')}><Link to={back.to}><ChevronLeft aria-hidden="true" strokeWidth={1.75} />{pick(back.label)}</Link></nav>;
}

/**
 * The detail's loading state on an in-app tap (UI9-DETAIL; the prerender paints the whole page at boot): the final geometry
 * in F's skeleton blocks, the back link, a 16:9 block, one chip, two H1 bars and a facts shell of four rows. No spinner and
 * no action bar (it arrives with the record), so nothing moves when the page replaces it.
 */
export function DetailSkeleton({ kind }: { kind: DetailKind }) {
  const { t } = useUiCopy();
  return <article className="local-discovery-detail detail-page detail-skeleton" aria-busy="true" aria-label={t('正在加载这一页', 'Loading this page')}>
    <DetailBack kind={kind} />
    <div className="detail-layout" aria-hidden="true">
      <div className="detail-main detail-main--top">
        <span className="ui-skeleton detail-skeleton__hero" />
        <div className="detail-head">
          <span className="ui-skeleton detail-skeleton__chip" />
          <span className="ui-skeleton detail-skeleton__title" />
          <span className="ui-skeleton detail-skeleton__title" data-width="short" />
        </div>
      </div>
      <div className="detail-aside"><div className="detail-facts-card">{[0, 1, 2, 3].map(row => <span key={row} className="ui-skeleton detail-skeleton__fact" />)}</div></div>
    </div>
  </article>;
}
