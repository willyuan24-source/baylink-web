import type { ReactNode } from 'react';
import './ui.css';
import './covers.css';
import './cards.css';
import { cx, useUiCopy } from './ui-copy';
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
  /**
   * false: no 没有照片的条目… line under this list. The page says it once instead (the events column's 本页图片来源,
   * UI9-EVENTS; HOME and FREE can drop their scoped CSS hides). Default true.
   */
  coverCredit?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Browse feed (D9): CSS grid in DOM order, 2 columns of 173px on a 390 phone (16 + 12 + 16), 3 at ≥768, 4 at
 * ≥1024; one column with 3:2 covers at 大/特大 text or in 简洁显示 on a phone (≤767px, the tokens.css `--feed-cols`
 * breakpoint) or in a narrow container; 2 / 3 columns at 大/特大 on tablets / desktops. Children are <FeedItem>s.
 */
export function FeedGrid({ label, layout = 'auto', single, ratio, coverCredit = true, children, className }: FeedGridProps) {
  return <div className={cx('ui-feed', className)} data-ratio={ratio} data-cover-credit="">
    <ul className="ui-feed-grid" aria-label={label} data-layout={layout} data-single={single ? '' : undefined}>{children}</ul>
    {coverCredit && <CoverCredit />}
  </div>;
}

/**
 * H12 / SV13-02: one line under a list says what a coded cover is, so its cards that credit their own source (the ✓ line)
 * need no BAYLINK 信息卡 badge each. Drawn only when the list holds such a card (ui.css :has; without :has it always shows).
 */
export function CoverCredit() {
  const { t } = useUiCopy();
  return <p className="ui-cover-credit">{t('没有照片的条目用 BAYLINK 信息卡，插画仅作装饰。', 'No photo: a BAYLINK info card; drawings are decorative.')}</p>;
}

/** One feed cell. `wide` spans the row: a guide carousel, a BayBay prompt strip or an offers rail every 6–8 cards. */
export function FeedItem({ wide, children }: { wide?: boolean; children: ReactNode }) {
  return <li className={wide ? 'ui-feed-grid__wide' : undefined}>{children}</li>;
}
