import { useMemo, useState } from 'react';
import { Clock3, Coffee, WandSparkles } from 'lucide-react';
import { useLocale } from '../i18n/locale';
import { buildOutingOptions, buildPlaceOutingOptions, type CompleteOuting } from '../lib/planner-outings';
import { buildItinerary, clockLabel, planBudget } from '../lib/planner-itinerary';
import { stopTitle, type PlanFilters, type Suggestion } from '../lib/planner';
import { plannerNoticeText } from '../lib/planner-copy';

export function PlannerOutingOptions({ suggestion, filters, message, onChoose }: { suggestion: Suggestion; filters: PlanFilters; message?: string; onChoose: (outing: CompleteOuting) => void }) {
  const options = useMemo(() => buildOutingOptions({ suggestion, filters, message }), [suggestion, filters, message]);
  return <OutingOptions options={options} onChoose={onChoose} />;
}

export function PlannerPlaceOutingOptions({ placeId, date, filters, message, onChoose }: { placeId: string; date: string; filters: PlanFilters; message?: string; onChoose: (outing: CompleteOuting) => void }) {
  const options = useMemo(() => buildPlaceOutingOptions({ placeId, date, filters, message }), [placeId, date, filters, message]);
  return <OutingOptions options={options} onChoose={onChoose} />;
}

function OutingOptions({ options, onChoose }: { options: CompleteOuting[]; onChoose: (outing: CompleteOuting) => void }) {
  const locale = useLocale();
  const text = (zh: string, en: string) => locale === 'en' ? en : zh;
  const [style, setStyle] = useState<CompleteOuting['style']>('half-day');
  const option = options.find(item => item.style === style) || options[0];
  if (!option) return <p className="planner-small-note">{text('暂时没有能同时满足已知条件的完整组合，可先加入这一站，再自行安排。', 'No complete combination meets the supported conditions yet. Start with this stop and arrange the rest yourself.')}</p>;
  const timeline = buildItinerary(option.stops, option.details, option.date);
  const budget = planBudget(option.stops, option.details);
  return <section className="planner-outing-preview" aria-label={text('搭配完整出行', 'Build a complete outing')}>
    <h4><WandSparkles size={15} />{text('连同下一站，一起安排', 'Make an outing of it')}</h4>
    {options.length > 1 && <div className="planner-outing-tabs" role="group" aria-label={text('方案时长', 'Outing length')}>{options.map(item => <button key={item.id} type="button" aria-pressed={item.id === option.id} onClick={() => setStyle(item.style)}>{item.style === 'half-day' ? text('轻松半日', 'Half day') : text('充实一天', 'Full day')}</button>)}</div>}
    <p className="planner-outing-summary"><Clock3 size={13} />{option.details.startTime}–{clockLabel(timeline.end)} · {option.stops.length} {text('站', 'stops')}</p>
    <ol className="planner-outing-route">{timeline.rows.map((row, index) => <li key={`${row.stop.kind}:${row.stop.id}`}>
      {!!row.settings.breakBeforeMinutes && <p className="planner-outing-break"><Coffee size={12} />{text('用餐 / 休息预留', 'Meal / rest buffer')} {row.settings.breakBeforeMinutes} {text('分钟 · 地点待选', 'min · choose a place')}</p>}
      <span>{clockLabel(row.start)}</span><strong>{plannerNoticeText(stopTitle(row.stop), locale === 'en')}</strong><small>{index === 0 ? text('第一站', 'First stop') : text(`交通预留 ${row.settings.travelMinutes} 分钟`, `${row.settings.travelMinutes} min travel buffer`)}</small>
    </li>)}</ol>
    <p className="planner-outing-cost">{text('已知门票起价小计', 'Known starting admission subtotal')} ${budget.admissionFloor.toFixed(2)}{budget.unknown.length > 0 ? text(` · ${budget.unknown.length} 站费用待确认`, ` · ${budget.unknown.length} unpriced stops`) : ''}</p>
    <p className="planner-small-note">{text('餐饮、交通另行预留；站间时间为可修改的安排，未查询实际路线。', 'Allow separately for meals and transport. Travel buffers are editable estimates, not checked routes.')}</p>
    {option.notices.length > 0 && <details className="planner-outing-notices"><summary>{text('方案依据与待确认事项', 'Sources and things to confirm')} ({option.notices.length})</summary><ul>{option.notices.map((notice, index) => <li key={index}>{plannerNoticeText(notice, locale === 'en')}</li>)}</ul></details>}
    <button type="button" className="planner-primary" onClick={() => onChoose(option)}>{text('采用这个完整方案', 'Use this complete outing')}</button>
  </section>;
}
