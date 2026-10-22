import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import './ui.css';
import './covers.css';
import './cards.css';
import { cx } from './ui-copy';
import { SegmentedTitle } from '../SegmentedTitle';
// The card press (card-press.ts) loads after this module, off the route's first-load JS (verify:release route budgets).
if (typeof window !== 'undefined') setTimeout(() => void import('./card-press'));

export type HeroCardProps = {
  title: string;
  to: string;
  /** A 4:5 cover: `<EventCover ratio="4:5" ratioLock …/>`. */
  cover: ReactNode;
  /** Print kicker, title and fact chips on the photo (scrim); false prints them under the picture. */
  overlay: boolean;
  /** "Fremont · 东湾" */
  kicker?: string;
  /** "10/10–11 · 10–16 时", "$8–12", "4 岁以下免费" — at most three. */
  facts?: string[];
  /** The 2-line card meta (UI9-C, G18; Card.tsx): line 1 `when` (eventWhenLine), line 2 `meta` (status and place, wraps). */
  when?: ReactNode;
  meta?: ReactNode;
  /** a3 editor reason (≤20 字), shown under the card with its label. */
  reason?: { label: string; text: string };
  /** "ebparks.org · 9/29 核对" */
  trust?: ReactNode;
  save?: ReactNode;
  heading?: 'h2' | 'h3';
  className?: string;
};

/**
 * The 4:5 cover story (本周封面 / 编辑精选, design.md §4.7.1): one per feed, 358×448 at 390. With a photo the title
 * sits on the bottom scrim (white, ≥5.52:1 below 62% of the height); the whole card is one link and ♡ sits above it.
 */
export function HeroCard({ title, to, cover, overlay, kicker, facts = [], when, meta, reason, trust, save, heading = 'h2', className }: HeroCardProps) {
  const Title = heading;
  return <article className={cx('ui-hero-card', className)} data-overlay={overlay ? '' : undefined}>
    <div className="ui-hero-card__media">
      {cover}
      {overlay && <div className="ui-hero-card__scrim" aria-hidden="true" />}
      {save && <div className="ui-hero-card__save">{save}</div>}
      <div className="ui-hero-card__text">
        {overlay && kicker && <p className="ui-hero-card__kicker">{kicker}</p>}
        <Title className="ui-hero-card__title"><Link className="ui-card-link" to={to}><SegmentedTitle text={title} /></Link></Title>
        {overlay && facts.length > 0 && <ul className="ui-hero-card__facts">{facts.slice(0, 3).map(fact => <li key={fact}>{fact}</li>)}</ul>}
      </div>
    </div>
    {!overlay && when && <p className="ui-card-when">{when}</p>}
    {!overlay && meta && <p className="ui-hero-card__meta">{meta}</p>}
    {reason && <p className="ui-hero-card__reason"><strong>{reason.label}</strong> {reason.text}</p>}
    {trust && <p className="ui-hero-card__trust"><Check aria-hidden="true" strokeWidth={1.75} />{trust}</p>}
  </article>;
}

// PageHeader and PageContainer live in ./PageHeader (UI9-PREP). This re-export stays for the frozen /explore page
// (AttractionExplorer.tsx imports them from here); new code imports ./PageHeader or the ui barrel.
export { PageContainer, PageHeader, type PageHeaderProps } from './PageHeader';
