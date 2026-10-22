import type { ReactNode } from 'react';
import { ArrowUpRight, CalendarPlus, Send } from 'lucide-react';
import { useApp, type AppContextValue } from '../../app/context';
import { AddToDayPlan } from '../../components/AddToDayPlan';
import { SaveToWeek } from '../../components/SaveToWeek';
import { useFamilySend } from '../../components/family-send';
import { Button } from '../../components/ui/Button';
import { useUiCopy } from '../../components/ui/ui-copy';
import { recordProductEvent } from '../../lib/product-events';
import type { Favorite } from '../../lib/planner';

/** The one primary, always last: 加入这天计划 (a live dated event), 加入计划 (an opening with a place), else the official link. */
export type DetailPrimary =
  | { kind: 'day'; stop: { kind: 'event'; id: string }; date: string; today: string }
  | { kind: 'plan'; to: string }
  | { kind: 'official'; href: string; label: string; /** Below 360 px at 大 / 特大 / 简洁显示 ("Claim", "Official"). */ short?: string };

/**
 * The detail action bar (UI9-DETAIL; lanes/UI9-DETAIL/BAR-CONTRACT.md, owner decision 18): up to three cells, 收藏 · 发家人 ·
 * 问 BayBay, then the one primary, always last. A cell that does not apply is left out, never disabled. On a phone or a
 * tablet it is fixed at the bottom (64 px + the safe area) and replaces the tab bar: SiteChrome hides the tab bar on a
 * `chrome:'detail'` route once an element with the class `site-detail-actions` is on the page (WEB-SHELL2). On a desktop it
 * is the second card of the aside, sticky to the end of the body: the primary full width, then the cells in one row.
 * Generic: guides render it with their own cells; every rule is keyed on `.site-detail-actions.detail-actions`
 * (local-discovery-detail.css).
 */
export function DetailActionBar({ cells, primary }: { cells: ReactNode; primary: ReactNode }) {
  const { t } = useUiCopy();
  return <div className="site-detail-actions detail-actions" role="group" aria-label={t('这一页的操作', 'Actions for this page')}>{cells}{primary}</div>;
}

/** ♡ 收藏 (WEB-SAVES' useSave), the shared control in the bar's cell look. */
export function SaveCell({ favorite, title }: { favorite: Favorite; title: string }) {
  return <div className="detail-actions__cell" data-cell="save"><SaveToWeek favorite={favorite} title={title} compact /></div>;
}

/**
 * 发家人 (发给家人 on a desktop): FamilyLinkButton's send, a large-text 简洁 link to this page through the phone's share sheet
 * or the clipboard; what happened is said in the app toast.
 */
export function FamilyCell({ path, title }: { path: string; title: string }) {
  const { t } = useUiCopy();
  const app = useApp() as AppContextValue | undefined;
  const send = useFamilySend(path, title);
  // The name is the label on screen plus a hidden "（大字版）" (WCAG 2.5.3: 发家人 on a phone, 发给家人 on a desktop).
  return <button type="button" className="detail-actions__cell" data-cell="family"
    onClick={() => void send().then(result => { if (result) app?.showToast(result.message, result.copied ? 'success' : 'info'); })}>
    <Send aria-hidden="true" strokeWidth={1.75} /><span data-label="phone">{t('发家人', 'Family')}</span><span data-label="desk">{t('发给家人', 'Send to family')}</span><span className="ui-visually-hidden">{t('（大字版）', ' (large text)')}</span>
  </button>;
}

/**
 * 问 BayBay: opens the assistant with this page as its "正在看" capsule. The label is 问 BayBay / Ask BayBay from 360 px in
 * every reading mode (家人版 included, UI9-R1); only a phone narrower than 360 px reads BayBay beside the otter
 * (local-discovery-detail.css), and the name always says 问 BayBay 这一页.
 */
export function AskCell() {
  const { t } = useUiCopy();
  const app = useApp() as AppContextValue | undefined;
  return <button type="button" className="detail-actions__cell" data-cell="ask" onClick={() => app?.openBayBay()} aria-label={t('问 BayBay 这一页', 'Ask BayBay about this page')}>
    <img src="/brand/otter.svg" alt="" width={24} height={24} aria-hidden="true" /><span data-label="long">{t('问 BayBay', 'Ask BayBay')}</span><span data-label="tight">BayBay</span>
  </button>;
}

/** The primary: F's primary button, one line, the icon going first where the cell is narrow (container query). */
export function PrimaryAction({ primary, title }: { primary: DetailPrimary; title: string }) {
  const { t } = useUiCopy();
  if (primary.kind === 'day') return <div className="detail-actions__primary" data-day={primary.date}><AddToDayPlan stop={primary.stop} date={primary.date} today={primary.today} title={title} compact short /></div>;
  const shared = { variant: 'primary' as const, className: 'detail-actions__primary detail-action detail-action--primary' };
  if (primary.kind === 'plan') {
    const label = t('加入计划', 'Add to a plan');
    return <Button {...shared} to={primary.to} icon={<CalendarPlus aria-hidden="true" strokeWidth={1.75} />} {...named(label, t('加入计划', 'Plan'))}><PrimaryLabel label={label} short={t('加入计划', 'Plan')} /></Button>;
  }
  return <Button {...shared} href={primary.href} target="_blank" rel="noopener noreferrer" onClick={() => recordProductEvent('official_source_click')} {...named(primary.label, primary.short)}>
    <PrimaryLabel label={primary.label} short={primary.short} /><ArrowUpRight aria-hidden="true" strokeWidth={1.75} />
  </Button>;
}

/** The full label keeps the name where a shorter one shows (the short one is part of it: "Claim" in "How to claim"). */
const named = (label: string, short?: string) => short && short !== label ? { 'aria-label': label } : {};

/** The primary's label, and where it differs, a shorter one CSS shows below 360 px at 大 / 特大 / 简洁显示, so it never wraps. */
function PrimaryLabel({ label, short }: { label: string; short?: string }) {
  if (!short || short === label) return <span>{label}</span>;
  return <><span data-label="full">{label}</span><span data-label="short">{short}</span></>;
}
