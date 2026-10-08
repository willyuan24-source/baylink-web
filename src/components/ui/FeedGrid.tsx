import type { ReactNode } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import './ui.css';
import { IconButton } from './Button';
import { cx, useUiCopy } from './ui-copy';
import type { FeedLayout } from './feed-layout';

export type FeedGridProps = {
  /** Accessible name of the list ("本周末活动"). */
  label: string;
  /** From `useFeedLayout()`; `auto` switches to one column at 大/特大 text on phones and below 340px. */
  layout?: FeedLayout;
  /** Always one column (search results, guides lists). */
  single?: boolean;
  /** Offers and posts use 1:1 covers; everything else 3:4. */
  ratio?: '3:4' | '1:1';
  children: ReactNode;
  className?: string;
};

/**
 * Browse feed (D9): CSS grid in DOM order, 2 columns of 173px on a 390 phone (16 + 12 + 16), 3 at ≥768, 4 at
 * ≥1024; one column with 3:2 covers at large text or in a narrow container. Children are <FeedItem>s.
 */
export function FeedGrid({ label, layout = 'auto', single, ratio, children, className }: FeedGridProps) {
  return <div className={cx('ui-feed', className)} data-ratio={ratio}>
    <ul className="ui-feed-grid" aria-label={label} data-layout={layout} data-single={single ? '' : undefined}>{children}</ul>
  </div>;
}

/** One feed cell. `wide` spans the row: a guide carousel, a BayBay prompt strip or an offers rail every 6–8 cards. */
export function FeedItem({ wide, children }: { wide?: boolean; children: ReactNode }) {
  return <li className={wide ? 'ui-feed-grid__wide' : undefined}>{children}</li>;
}

/** Two 44px buttons that override the automatic column choice; the choice is remembered (baylink.feed-layout.v1). */
export function FeedLayoutToggle({ effective, onChange }: { effective: Exclude<FeedLayout, 'auto'>; onChange: (layout: FeedLayout) => void }) {
  const { t } = useUiCopy();
  return <div className="ui-layout-toggle" role="group" aria-label={t('排列方式', 'Layout')}>
    <IconButton label={t('两列', 'Two columns')} aria-pressed={effective === 'grid'} onClick={() => onChange('grid')}><LayoutGrid aria-hidden="true" strokeWidth={1.75} /></IconButton>
    <IconButton label={t('单列', 'One column')} aria-pressed={effective === 'list'} onClick={() => onChange('list')}><List aria-hidden="true" strokeWidth={1.75} /></IconButton>
  </div>;
}
