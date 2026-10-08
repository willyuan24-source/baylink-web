import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import './ui.css';
import { cx } from './ui-copy';
import { SegmentedTitle } from '../SegmentedTitle';

export type HeroCardProps = {
  title: string;
  to: string;
  /** A 4:5 cover: `<EventCover ratio="4:5" ratioLock …/>`. */
  cover: ReactNode;
  /** Print kicker, title and fact chips on the photo (scrim). Pass false for a TypeCover, which already shows them. */
  overlay: boolean;
  /** "Fremont · 东湾" */
  kicker?: string;
  /** "10/10–11 · 10–16 时", "$8–12", "4 岁以下免费" — at most three. */
  facts?: string[];
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
export function HeroCard({ title, to, cover, overlay, kicker, facts = [], reason, trust, save, heading = 'h2', className }: HeroCardProps) {
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
    {reason && <p className="ui-hero-card__reason"><strong>{reason.label}</strong> {reason.text}</p>}
    {trust && <p className="ui-hero-card__trust"><Check aria-hidden="true" strokeWidth={1.75} />{trust}</p>}
  </article>;
}

export type PageHeaderProps = {
  title: string;
  /** `display` only for home and the events column header (one per page). */
  size?: 'title' | 'display';
  breadcrumb?: ReactNode;
  /** ≤2 lines. */
  lede?: ReactNode;
  /** One primary plus an optional secondary <Button>. */
  actions?: ReactNode;
  className?: string;
};

/** Breadcrumb → H1 → lede → actions. No masthead, sticker, highlighter, two-tone H1 or gradient banner. */
export function PageHeader({ title, size = 'title', breadcrumb, lede, actions, className }: PageHeaderProps) {
  return <header className={cx('ui-page-header', className)} data-size={size}>
    {breadcrumb && <nav className="ui-page-header__crumbs" aria-label="breadcrumb">{breadcrumb}</nav>}
    <h1 className="ui-page-header__title"><SegmentedTitle text={title} /></h1>
    {lede && <p className="ui-page-header__lede">{lede}</p>}
    {actions && <div className="ui-page-header__actions">{actions}</div>}
  </header>;
}

/** wide 1216 (home, feeds) · content 960 (lists, me, messages) · reading 720 (guide prose, about, legal); gutters 16/24/32. */
export function PageContainer({ size = 'wide', children, className }: { size?: 'wide' | 'content' | 'reading'; children: ReactNode; className?: string }) {
  return <div className={cx('ui-container', className)} data-size={size}>{children}</div>;
}
