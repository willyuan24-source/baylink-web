import { useState } from 'react';
import { WandSparkles } from 'lucide-react';
import { useLocale } from '../i18n/locale';
import { proposePlanEdit } from '../lib/planner-edit';
import { buildItinerary, clockLabel, planBudget, stopKey } from '../lib/planner-itinerary';
import { stopTitle, type PlanDetails, type Stop } from '../lib/planner';
import { plannerNoticeText } from '../lib/planner-copy';

type EditablePlan = { title: string; date: string; stops: Stop[]; details: PlanDetails };

/** A proposal is tied to the exact draft and locks from which it was calculated. */
export function PlannerPlanEdit({ current, onApply }: { current: EditablePlan; onApply: (plan: EditablePlan) => void }) {
  const locale = useLocale();
  const text = (zh: string, en: string) => locale === 'en' ? en : zh;
  const [message, setMessage] = useState('');
  const [locked, setLocked] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ basis: string; result: ReturnType<typeof proposePlanEdit> }>();
  const lockedStops = current.stops.filter(stop => locked.includes(stopKey(stop)));
  const basis = JSON.stringify({ current, lockedStops, message, locale });
  const result = preview?.basis === basis ? preview.result : undefined;
  const proposed = result?.status === 'proposal' ? result : undefined;
  const timeline = proposed && buildItinerary(proposed.nextPlan.stops, proposed.nextPlan.details, proposed.nextPlan.date);
  const budget = proposed && planBudget(proposed.nextPlan.stops, proposed.nextPlan.details);
  if (!current.stops.length) return null;
  return <section className="planner-edit-assistant" aria-label={text('一句话修改计划', 'Edit your plan in a sentence')}>
    <h3><WandSparkles size={16} />{text('一句话，调整这一天', 'Adjust your day in a sentence')}</h3>
    <p>{text('先预览改动，再决定是否采用。支持调整时间、日期、移除或替换一站。', 'Preview the changes before applying them. Adjust times or dates, remove a stop, or replace one.')}</p>
    <div className="planner-edit-examples">{[
      text('晚一小时出发', 'Start one hour later'),
      text('把第二站换成餐厅', 'Replace stop 2 with a restaurant'),
      text('移除博物馆', 'Remove museums'),
    ].map(example => <button type="button" key={example} onClick={() => { setMessage(example); setPreview(undefined); }}>{example}</button>)}</div>
    <details className="planner-edit-locks"><summary>{text('修改时保留地点与时间', 'Keep stops and their times')} ({lockedStops.length})</summary>
      {current.stops.map(stop => <label key={stopKey(stop)}><input type="checkbox" checked={locked.includes(stopKey(stop))} onChange={event => { setLocked(keys => event.target.checked ? [...keys, stopKey(stop)] : keys.filter(key => key !== stopKey(stop))); setPreview(undefined); }} />{stopTitle(stop)}</label>)}
      <p>{text('只用于这次智能修改；手动编辑仍由你决定。', 'Applies to these suggested edits; you can still change the plan manually.')}</p>
    </details>
    <form onSubmit={event => { event.preventDefault(); setPreview({ basis, result: proposePlanEdit({ current, message, lockedStops }) }); }}>
      <label>{text('想怎样修改？', 'What would you like to change?')}<textarea value={message} maxLength={300} onChange={event => setMessage(event.target.value)} placeholder={text('例如：把第二站换成餐厅', 'For example: replace stop 2 with a restaurant')} /></label>
      <button type="submit" className="planner-edit-preview-button" disabled={!message.trim()}>{text('预览修改', 'Preview changes')}</button>
    </form>
    {result?.status === 'unsupported' && <p className="planner-note" role="status">{result.reason}</p>}
    {proposed && timeline && budget && <div className="planner-edit-proposal" role="region" aria-label={text('修改预览', 'Change preview')}>
      <strong>{text('将会这样调整', 'Proposed changes')}</strong>
      <ul>{proposed.changes.map((change, index) => <li key={index}>{change}</li>)}</ul>
      <p>{proposed.nextPlan.date} · {proposed.nextPlan.details.startTime}–{clockLabel(timeline.end)}</p>
      <ol>{timeline.rows.map(row => <li key={stopKey(row.stop)}>{clockLabel(row.start)} · {stopTitle(row.stop)}</li>)}</ol>
      <p>{text('可计入的小计', 'Partial subtotal')} ${budget.subtotal.toFixed(2)}{budget.unknown.length > 0 ? text(` · ${budget.unknown.length} 站费用待确认`, ` · ${budget.unknown.length} unpriced stops`) : ''}</p>
      {proposed.issues.length > 0 && <ul className="planner-conflicts" role="alert">{proposed.issues.map((issue, index) => <li key={index}>{plannerNoticeText(issue, locale === 'en')}</li>)}</ul>}
      {proposed.warnings.length > 0 && <details><summary>{text('需要确认的事项', 'Things to confirm')} ({proposed.warnings.length})</summary><ul>{proposed.warnings.map((warning, index) => <li key={index}>{plannerNoticeText(warning, locale === 'en')}</li>)}</ul></details>}
      <div className="planner-edit-actions"><button type="button" className="planner-primary" disabled={!proposed.canApply} onClick={() => { onApply(proposed.nextPlan); setPreview(undefined); setMessage(''); }}>{text('采用修改', 'Apply changes')}</button><button type="button" onClick={() => setPreview(undefined)}>{text('取消', 'Cancel')}</button></div>
    </div>}
  </section>;
}
