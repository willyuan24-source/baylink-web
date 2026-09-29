import { useLocale } from '../i18n/locale';
import { buildItinerary, clockLabel, planBudget, stopKey } from '../lib/planner-itinerary';
import { stopTitle, type PlanDetails, type Stop } from '../lib/planner';

export function PlannerPlanOverview({ stops, date, details }: { stops: Stop[]; date: string; details: PlanDetails }) {
  const locale = useLocale();
  const text = (zh: string, en: string) => locale === 'en' ? en : zh;
  if (!stops.length) return null;
  const timeline = buildItinerary(stops, details, date);
  const budget = planBudget(stops, details);
  return <section className="planner-plan-overview" aria-label={text('当前计划概览', 'Current plan overview')}>
    <div><span className="planner-eyebrow">YOUR DAY, AT A GLANCE</span><h2>{text('这一天，已经有了轮廓', 'Your day is taking shape')}</h2><p>{date || text('日期待选', 'Choose a date')} · {stops.length} {text('站', 'stops')} · {details.partySize} {text('人', 'people')}</p></div>
    <dl><div><dt>{text('计划时段', 'Planned times')}</dt><dd>{details.startTime}–{clockLabel(timeline.end)}</dd></div><div><dt>{text('已知金额与预留小计', 'Known costs + allowances')}</dt><dd>${budget.subtotal.toFixed(2)}</dd></div><div><dt>{text('费用待确认', 'Unpriced stops')}</dt><dd>{budget.unknown.length} {text('站', 'stops')}</dd></div></dl>
    <ol>{stops.map(stop => <li key={stopKey(stop)}>{stopTitle(stop)}</li>)}</ol>
    <p className="planner-overview-note">{text('费用不是完整报价；交通时间为预留。门票、预约与营业安排出发前再确认。', 'Costs are not a full quote; travel times are allowances. Recheck tickets, reservations and opening hours before visiting.')}</p>
    {(timeline.issues.length > 0 || budget.overBy > 0) && <p className="planner-budget-warning">{timeline.issues.length > 0 ? text(`${timeline.issues.length} 项时间安排需要调整。`, `${timeline.issues.length} timing issues need adjusting.`) : ''} {budget.overBy > 0 ? text(`已计入金额超预算 $${budget.overBy.toFixed(2)}。`, `Included costs exceed the budget by $${budget.overBy.toFixed(2)}.`) : ''}</p>}
    <button type="button" className="planner-overview-open" onClick={() => document.getElementById('outing-plan')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })}>{text('查看与修改计划 ↓', 'View and edit your plan ↓')}</button>
  </section>;
}
