import { translateText, useLocale } from '../i18n/locale';
import { buildItinerary, clockLabel, planBudget, stopKey, planDetailsError } from '../lib/planner-itinerary';
import { stopTitle, type PlanDetails, type Stop } from '../lib/planner';
import type { BayBayAdmissionOverride } from '../lib/baybay-plan-handoff';

export function PlannerPlanOverview({ stops, date, details, admissionOverride }: { stops: Stop[]; date: string; details: PlanDetails; admissionOverride?: BayBayAdmissionOverride }) {
  const locale = useLocale();
  const text = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  if (!stops.length) return null;
  const timeline = buildItinerary(stops, details, date);
  const reference = admissionOverride?.active ? admissionOverride : undefined;
  const budget = planBudget(stops, details, undefined, reference);
  const invalid = planDetailsError(details);
  return <section className="planner-plan-overview" aria-label={text('当前计划概览', 'Current plan overview')}>
    <div><span className="planner-eyebrow">YOUR DAY, AT A GLANCE</span><h2>{text('这一天，已经有了轮廓', 'Your day is taking shape')}</h2><p>{date || text('日期待选', 'Choose a date')} · {stops.length} {text('站', 'stops')} · {details.partySize} {text('人', 'people')}</p></div>
    <dl><div><dt>{text('时间草稿', 'Draft schedule')}</dt><dd>{invalid ? text('请修正输入', 'Check your inputs') : `${details.startTime}–${clockLabel(timeline.end)}`}</dd></div><div><dt>{text('已知金额与预留小计', 'Known costs + allowances')}</dt><dd>{invalid ? '—' : reference && !budget.subtotal && budget.unknown.length && !reference.allAdmissionAmountsKnown ? text('费用待核算', 'Cost not yet calculated') : `$${budget.subtotal.toFixed(2)}`}</dd></div><div><dt>{text('费用待确认', 'Unpriced stops')}</dt><dd>{budget.unknown.length} {text('站', 'stops')}</dd></div></dl>
    <p>{text('停留和交通包含预留，实际路程未核对。', 'Stay and travel times include allowances; actual routes have not been checked.')}</p>
    <p>{text(`最晚结束目标：${details.finishBy}。这只是目标，实际能否赶上仍需核对。`, `Finish-by target: ${details.finishBy}. This is a target, not confirmation that the timing works.`)}</p>
    <ol>{stops.map(stop => <li key={stopKey(stop)}>{stopTitle(stop)}</li>)}</ol>
    <p className="planner-overview-note">{reference && text('门票沿用原 BayBay 来源快照，未知费用未计入。', 'Admission uses the original BayBay source snapshot; unknown costs are not included. ')}{text('费用不是完整报价；门票、预约与营业安排出发前再确认。', 'Costs are not a full quote. Recheck tickets, reservations and opening hours before visiting.')}</p>
    {budget.admissionOverBy > 0 && <p className="planner-budget-warning">{text(`已知门票超过门票预算 $${budget.admissionOverBy.toFixed(2)}。`, `Known admission exceeds the admission budget by $${budget.admissionOverBy.toFixed(2)}.`)}</p>}
    {(timeline.issues.length > 0 || budget.overBy > 0) && <p className="planner-budget-warning">{timeline.issues.length > 0 ? text(`${timeline.issues.length} 项时间安排需要调整。`, `${timeline.issues.length} timing issues need adjusting.`) : ''} {budget.overBy > 0 ? text(`已计入金额超预算 $${budget.overBy.toFixed(2)}。`, `Included costs exceed the budget by $${budget.overBy.toFixed(2)}.`) : ''}</p>}
    <button type="button" className="planner-overview-open" onClick={() => document.getElementById('outing-plan')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })}>{text('查看与修改计划 ↓', 'View and edit your plan ↓')}</button>
  </section>;
}
