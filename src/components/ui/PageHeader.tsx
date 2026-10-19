import type { ReactNode } from 'react';
import './ui.css';
import './covers.css';
import './cards.css';
import { cx, useUiCopy } from './ui-copy';
import { SegmentedTitle } from '../SegmentedTitle';

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
  const { t } = useUiCopy();
  return <header className={cx('ui-page-header', className)} data-size={size}>
    {breadcrumb && <nav className="ui-page-header__crumbs" aria-label={t('当前位置', 'Breadcrumb')}>{breadcrumb}</nav>}
    <h1 className="ui-page-header__title"><SegmentedTitle text={title} /></h1>
    {lede && <p className="ui-page-header__lede">{lede}</p>}
    {actions && <div className="ui-page-header__actions">{actions}</div>}
  </header>;
}

/** wide 1216 (home, feeds) · content 960 (lists, me, messages) · reading 720 (guide prose, about, legal); gutters 16/24/32. */
export function PageContainer({ size = 'wide', children, className }: { size?: 'wide' | 'content' | 'reading'; children: ReactNode; className?: string }) {
  return <div className={cx('ui-container', className)} data-size={size}>{children}</div>;
}
