import { useMemo } from 'react';
import { CalendarCheck } from 'lucide-react';
import { translateText, useLocale } from '../../i18n/locale';
import type { SavedPlan } from '../../lib/planner-core';
import { planDayLabel } from '../../lib/plan-stop-cover';
import { guestPlanDays } from './guest-plans';
import { planDisplayTitle } from '../saves/plan-title';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/States';
import { SkeletonFeed, SkeletonRow } from '../../components/ui/SkeletonCard';

/**
 * 已排的日子 before the planner catalog is in (H20, WEB-PERF-3): the days a guest saved in this browser, read straight from
 * storage, each with its date, its title and one placeholder row per stop (the rows' names and covers come with the
 * catalog), so the section has its final height from the first frame; no saved day shows the same empty state as the full
 * list. A signed-in reader's days come from the account with the workspace: skeleton rows hold their place meanwhile.
 * The full list (components/PlannerDayPlans.tsx) shares the heading and the empty state.
 */

/** 已排的日子's heading row. */
export function PlanDaysHead({ planned }: { planned: boolean }) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  return <div className="plan-section-head"><h2 id="plan-days-title">{t('已排的日子', 'Planned days')}</h2>{planned && <Button variant="text" to="/my-week#plans">{t('在我的这周查看', 'See them in My Week')}</Button>}</div>;
}

/** No upcoming day yet. */
export function PlanDaysEmpty() {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  return <EmptyState headingLevel="h3" icon={CalendarCheck} title={t('还没有排好的日子', 'No days planned yet')}
    body={t('把活动加入某一天的计划（比如在活动日历点「加入这天计划」），那一天就会出现在这里；也可以在下面挑一个地点开始。', 'Add an event to a day’s plan (for example with “Add to this day’s plan” on the events calendar) and that day appears here. Or start from a place below.')}
    actions={<Button variant="tonal" to="/calendar">{t('打开活动日历', 'Open the events calendar')}</Button>} />;
}

/** The days from storage with placeholder rows (guest), skeleton rows (signed in), or the empty state. */
export function PlanDaysPreviewBody({ signedIn, plans }: { signedIn: boolean; plans?: readonly SavedPlan[] }) {
  const locale = useLocale();
  const english = locale === 'en';
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  const shown = useMemo(() => plans ?? (signedIn ? [] : guestPlanDays()), [plans, signedIn]);
  if (signedIn) return <SkeletonFeed rows count={2} />;
  if (!shown.length) return <PlanDaysEmpty />;
  const days = [...new Set(shown.map(plan => plan.date))];
  return <div aria-busy="true">
    <p className="ui-visually-hidden" role="status">{t('正在加载', 'Loading')}</p>
    <ol className="plan-days__list">{days.map(date => <li key={date} className="plan-days__day">
      <p className="plan-days__date"><time dateTime={date}>{english ? planDayLabel(date, true) : translateText(planDayLabel(date, false), locale)}</time></p>
      {shown.filter(plan => plan.date === date).map(plan => {
        const title = planDisplayTitle(plan.title, locale);
        return <article key={plan.id} className="plan-days__plan" aria-label={title.text}>
          <div className="plan-days__plan-head"><h3 translate={title.auto ? undefined : 'no'}>{title.text}</h3></div>
          <ul className="plan-days__stops" aria-hidden="true">{plan.stops.map(stop => <li key={`${stop.kind}:${stop.id}`}><SkeletonRow /></li>)}</ul>
          <div className="plan-days__actions"><Button variant="secondary" to={`/plan?edit=${encodeURIComponent(plan.id)}`}>{t('打开这一天', 'Open this day')}</Button></div>
        </article>;
      })}
    </li>)}</ol>
  </div>;
}

/** 已排的日子 as the first thing under 行程's header, before the workspace is in. */
export function PlanDaysPreview({ signedIn }: { signedIn: boolean }) {
  const plans = useMemo(() => signedIn ? [] : guestPlanDays(), [signedIn]);
  return <section id="plan-days" className="plan-days" aria-labelledby="plan-days-title" data-testid="plan-days">
    <PlanDaysHead planned={plans.length > 0} />
    <PlanDaysPreviewBody signedIn={signedIn} plans={plans} />
  </section>;
}
