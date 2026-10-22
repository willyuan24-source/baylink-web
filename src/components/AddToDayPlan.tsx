import { lazy, Suspense } from 'react';
import { CalendarPlus } from 'lucide-react';
import type { Stop } from '../lib/planner';
import { translateText, useLocale } from '../i18n/locale';
import { addToDayName } from '../features/saves/add-to-day-name';

export type AddToDayPlanProps = {
  stop: Stop;
  date: string;
  /** The item's title (catalog source text), read with the button: "加入这天计划：…". */
  title?: string;
  compact?: boolean;
  /**
   * `icon` (UI9-R1 D7, the calendar rows and cards): a compact icon button (calendar+) whose name stays "加入这天计划：…";
   * its short visible word (加入 / Add, 已加入 / In your 10/22 plan once added) is for wide layouts and may be hidden by the
   * page (events.css hides it on phones). The default variant is unchanged.
   */
  variant?: 'icon';
  /** The detail action bar: in English the label is "Add to day" ("Add to plan" is BayBay's 加入计划; the button's name still says which day and what). */
  short?: boolean;
  className?: string;
  /** The page's Pacific day, when it has one (calendar). */
  today?: string;
};

// The control, its confirmation and the planner behind it load on their own (route JS budgets, plan §3.0 rule 8):
// the calendar shows this button on every card and does not carry them in its route bundle.
const AddToDayControl = lazy(() => import('../features/saves/AddToDayControl'));

/**
 * "加入这天计划": saves the stop into that day's plan right away and confirms with "已加入 10/10 计划 · 查看" (plan D19).
 * The implementation is `features/saves/AddToDayControl`.
 */
export function AddToDayPlan(props: AddToDayPlanProps) {
  return <Suspense fallback={<AddToDayPlaceholder {...props} />}><AddToDayControl {...props} /></Suspense>;
}

/** The same box as the control while it loads (and in prerendered HTML): a disabled button, so nothing moves when it arrives. */
function AddToDayPlaceholder({ title, compact, short, className, variant }: AddToDayPlanProps) {
  const locale = useLocale();
  return <span className={['saves-day', className].filter(Boolean).join(' ')}>
    <button type="button" className="saves-add-day" data-compact={compact ? '' : undefined} data-variant={variant} aria-label={addToDayName(title, locale)} disabled>
      <CalendarPlus aria-hidden="true" strokeWidth={1.75} />{variant === 'icon' ? <span className="saves-add-day__word">{locale === 'en' ? 'Add' : translateText('加入', locale)}</span>
        : locale === 'en' ? short ? 'Add to day' : 'Add to this day’s plan' : translateText('加入这天计划', locale)}
    </button>
  </span>;
}
