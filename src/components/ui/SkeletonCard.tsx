import './ui.css';
import { useUiCopy } from './ui-copy';

/** Same geometry as a FeedCard: the cover block, two title lines and a meta line. */
export function SkeletonCard() {
  return <div className="ui-skeleton-card" aria-hidden="true">
    <span className="ui-skeleton" data-shape="cover" />
    <span className="ui-skeleton" data-shape="line" />
    <span className="ui-skeleton" data-shape="line" data-width="short" />
    <span className="ui-skeleton" data-shape="meta" />
  </div>;
}

/** Same geometry as a RowCard. */
export function SkeletonRow() {
  return <div className="ui-row-card" aria-hidden="true">
    <span className="ui-skeleton ui-row-card__thumb" data-shape="thumb" />
    <div className="ui-row-card__body">
      <span className="ui-skeleton" data-shape="meta" />
      <span className="ui-skeleton" data-shape="line" />
      <span className="ui-skeleton" data-shape="line" data-width="short" />
    </div>
  </div>;
}

/**
 * A loading feed with fixed-height placeholders (RC-25), so nothing jumps when the cards arrive.
 * `aria-busy` plus one polite status line; the placeholders themselves are hidden from assistive tech.
 */
export function SkeletonFeed({ count = 4, rows }: { count?: number; rows?: boolean }) {
  const { t } = useUiCopy();
  const label = t('正在加载', 'Loading');
  if (rows) return <div aria-busy="true"><p className="ui-visually-hidden" role="status">{label}</p>{Array.from({ length: count }, (_, index) => <SkeletonRow key={index} />)}</div>;
  return <div className="ui-feed" aria-busy="true">
    <p className="ui-visually-hidden" role="status">{label}</p>
    <ul className="ui-feed-grid" data-layout="auto" aria-hidden="true">{Array.from({ length: count }, (_, index) => <li key={index}><SkeletonCard /></li>)}</ul>
  </div>;
}
