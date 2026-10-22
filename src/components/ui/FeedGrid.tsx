import type { ReactNode } from 'react';
import './ui.css';
import './covers.css';
import './cards.css';
import { cx } from './ui-copy';
import type { FeedLayout } from './feed-layout';

/** The grid / one-column switch lives in its own module (only the community board shows it); re-exported for its importers. */
export { FeedLayoutToggle } from './FeedLayoutToggle';

export type FeedGridProps = {
  /** Accessible name of the list ("本周末活动"). */
  label: string;
  /** From `useFeedLayout()`; `auto` switches to one column at 大/特大 text or in 简洁显示 on phones (≤767px) and below 340px. */
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
 * ≥1024; one column with 3:2 covers at 大/特大 text or in 简洁显示 on a phone (≤767px, the tokens.css `--feed-cols`
 * breakpoint) or in a narrow container; 2 / 3 columns at 大/特大 on tablets / desktops. Children are <FeedItem>s.
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
