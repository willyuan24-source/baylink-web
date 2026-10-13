import { ArrowUpRight, CalendarPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp, type AppContextValue } from '../../app/context';
import { AddToDayPlan } from '../../components/AddToDayPlan';
import { SaveToWeek } from '../../components/SaveToWeek';
import { useUiCopy } from '../../components/ui/ui-copy';
import { recordProductEvent } from '../../lib/product-events';
import type { Favorite } from '../../lib/planner';

export type DetailActions = {
  /** The one ♡ 收藏 (WEB-SAVES' useSave), absent on an ended event. */
  favorite?: Favorite;
  /** The listing's title (catalog text), read with the ♡ and 加入这天计划 buttons. */
  title: string;
  /** "加入这天计划" for the next confirmed day of a live event. */
  day?: { stop: { kind: 'event'; id: string }; date: string; today: string };
  /** "加入行程" for an opening: a plan starting at this shop. */
  planPath?: string;
  /** The official page, opened in a new tab. */
  official: { href: string; label: string };
};

/**
 * The detail page's own action bar (plan D10, design.md §4.9): ♡ 收藏 · 加入行程 · 问 BayBay · 官方页 ↗. On a phone or a
 * tablet it is fixed at the bottom, 64 px plus the safe area, and replaces the tab bar: SiteChrome hides the tab bar on a
 * `chrome:'detail'` route once an element with the class `site-detail-actions` is on the page (WEB-SHELL2). On a desktop it
 * is the sticky card beside the article. 问 BayBay opens the assistant with this page as its "正在看" capsule.
 */
export function DetailActionBar({ actions }: { actions: DetailActions }) {
  const { t } = useUiCopy();
  const app = useApp() as AppContextValue | undefined;
  const primaryOfficial = !actions.day && !actions.planPath;
  return <div className="site-detail-actions detail-actions" role="group" aria-label={t('这一页的操作', 'Actions for this page')}>
    {actions.favorite && <div className="detail-actions__save"><SaveToWeek favorite={actions.favorite} title={actions.title} compact /></div>}
    {actions.day && <div className="detail-actions__primary" data-day={actions.day.date}><AddToDayPlan stop={actions.day.stop} date={actions.day.date} today={actions.day.today} title={actions.title} compact /></div>}
    {actions.planPath && <Link className="detail-actions__primary detail-action detail-action--primary" to={actions.planPath}><CalendarPlus aria-hidden="true" strokeWidth={1.75} />{t('加入行程', 'Add to a plan')}</Link>}
    <button type="button" className="detail-action detail-action--ask" onClick={() => app?.openBayBay()} aria-label={t('问 BayBay 这一页', 'Ask BayBay about this page')}>
      <img className="detail-action__otter" src="/brand/otter.svg" alt="" width={28} height={28} aria-hidden="true" /><span className="detail-action__ask-label">{t('问 BayBay', 'Ask BayBay')}</span><span className="detail-action__ask-short" aria-hidden="true">{t('问问', 'Ask')}</span>
    </button>
    <a className={primaryOfficial ? 'detail-actions__primary detail-action detail-action--primary' : 'detail-action detail-action--official'} href={actions.official.href} target="_blank" rel="noopener noreferrer" onClick={() => recordProductEvent('official_source_click')}>
      <span>{actions.official.label}</span><ArrowUpRight aria-hidden="true" strokeWidth={1.75} />
    </a>
  </div>;
}
