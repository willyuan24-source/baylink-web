import { CalendarDays, Clock3, Wallet } from 'lucide-react';
import { useLocale } from '../i18n/locale';
import { buildItinerary, clockLabel, factsForStop, itineraryIcs, planBudget, settingForStop, stopKey } from '../lib/planner-itinerary';
import { stopTitle, type PlanDetails, type Stop, type StopSetting } from '../lib/planner';

export function PlannerSchedule({ stops, date, title, details, onChange, onStatus }: { stops: Stop[]; date: string; title: string; details: PlanDetails; onChange: (details: PlanDetails) => void; onStatus: (message: string) => void }) {
  const locale = useLocale();
  const text = (zh: string, en: string) => locale === 'en' ? en : zh;
  const update = (patch: Partial<PlanDetails>) => onChange({ ...details, ...patch });
  const updateStop = (stop: Stop, index: number, patch: Partial<StopSetting>) => {
    const next = { ...settingForStop(details, stop, index), ...patch };
    if (!next.fixedStartTime) delete next.fixedStartTime;
    update({ stopSettings: [...details.stopSettings.filter(item => stopKey(item) !== stopKey(stop)), next] });
  };
  const timeline = buildItinerary(stops, details, date);
  const budget = planBudget(stops, details);
  const money = (amount: number) => new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'zh-CN', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(amount);
  const exportCalendar = () => {
    try {
      const url = URL.createObjectURL(new Blob([itineraryIcs(title, date, stops, details)], { type: 'text/calendar;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `baylink-plan-${date}.ics`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      onStatus(text('已导出你的安排；日历中的时间是计划时间，请再确认官方场次。', 'Your draft schedule was exported. Confirm official session and opening times.'));
    } catch (error) { onStatus(error instanceof Error ? error.message : text('日历导出失败。', 'Calendar export failed.')); }
  };
  return <section className="planner-schedule" aria-label={text('时间与预算', 'Time and budget')}>
    <h3><Clock3 size={16} />{text('把时间排清楚', 'Make time for each stop')}</h3>
    <p className="planner-small-note">{text('这是你可修改的时间草稿。默认每站 90 分钟、站间预留 30 分钟，尚未查询实际路程或营业时间。', 'An editable draft: 90 minutes per stop and 30 minutes between stops by default. Travel and opening hours have not been checked.')}</p>
    <div className="planner-detail-grid"><label>{text('开始时间', 'Start at')}<input type="time" required value={details.startTime} onChange={event => event.target.value && update({ startTime: event.target.value })} /></label><label>{text('希望几点结束', 'Finish by')}<input type="time" required value={details.finishBy} onChange={event => event.target.value && update({ finishBy: event.target.value })} /></label></div>
    <label>{text('这份计划的交通方式', 'Transport for this plan')}<select value={details.travelMode} onChange={event => update({ travelMode: event.target.value as PlanDetails['travelMode'] })}><option value="any">{text('暂未决定', 'Undecided')}</option><option value="drive">{text('开车', 'Drive')}</option><option value="transit">{text('公共交通', 'Public transit')}</option><option value="walk">{text('步行', 'Walk')}</option></select></label>
    <ol className="planner-timeline">{timeline.rows.map(({ stop, settings, start, end, wait, late }, index) => <li key={stopKey(stop)} className={late ? 'has-conflict' : undefined}>
      <div className="planner-time-range"><span>{Number.isFinite(start) && Number.isFinite(end) ? `${clockLabel(start)}–${clockLabel(end)}` : text('请修正输入', 'Check your inputs')}</span><small>{text('计划', 'Draft')}</small></div>
      <strong>{stopTitle(stop)}</strong>
      {wait > 0 && <p className="planner-small-note">{text(`预留等候 ${wait} 分钟`, `${wait} minutes of waiting`)}</p>}
      <details><summary>{text('调整停留与交通时间', 'Adjust timing')}</summary><div className="planner-detail-grid"><label>{text('停留（分钟）', 'Stay (minutes)')}<input type="number" min={5} max={720} step={5} value={settings.durationMinutes} onChange={event => updateStop(stop, index, { durationMinutes: Number(event.target.value) })} /></label><label>{text(index === 0 ? '到首站预留（分钟）' : '到此站预留（分钟）', 'Travel buffer (minutes)')}<input type="number" min={0} max={360} step={5} value={settings.travelMinutes} onChange={event => updateStop(stop, index, { travelMinutes: Number(event.target.value) })} /></label></div><label>{text('已确认的开始时间（选填）', 'Confirmed start time (optional)')}<input type="time" value={settings.fixedStartTime || ''} onChange={event => updateStop(stop, index, { fixedStartTime: event.target.value })} /></label><a href={factsForStop(stop)?.officialUrl} target="_blank" rel="noreferrer">{text('查看官方时间与票价 ↗', 'Check official hours and tickets ↗')}</a></details>
    </li>)}</ol>
    {timeline.issues.length > 0 && <ul className="planner-conflicts" aria-label={text('需要调整的时间', 'Timing conflicts')}>{timeline.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
    <h3><Wallet size={16} />{text('看清预算缺口', 'Know what is still unpriced')}</h3>
    <div className="planner-detail-grid"><label>{text('同行总人数', 'Group size')}<input type="number" min={1} max={50} step={1} value={details.partySize} onChange={event => update({ partySize: Number(event.target.value) })} /></label><label>{text('整趟总预算 $', 'Trip budget $')}<input type="number" min={0} max={100000} step="0.01" placeholder={text('选填', 'Optional')} value={details.totalBudgetUsd ?? ''} onChange={event => update({ totalBudgetUsd: event.target.value === '' ? null : Number(event.target.value) })} /></label></div>
    <label>{text('自行预留餐饮、停车、交通等 $', 'Your allowance for food, parking and travel $')}<input type="number" min={0} max={100000} step="0.01" value={details.extraCostUsd} onChange={event => update({ extraCostUsd: Number(event.target.value) })} /></label>
    <dl className="planner-budget"><div><dt>{text('已知门票起价 × 人数', 'Published starting prices × people')}</dt><dd>{money(budget.admissionFloor)}</dd></div><div><dt>{text('你的其他费用预留', 'Your other costs')}</dt><dd>{money(details.extraCostUsd)}</dd></div><div><dt>{text('目前可计入的小计', 'Partial subtotal')}</dt><dd>{money(budget.subtotal)}</dd></div></dl>
    <p className="planner-small-note">{text('按所有人支付同一起价粗算，未计儿童优惠、税费和票档差异；不是完整报价。', 'Assumes the same starting price for each person. Child rates, fees and ticket tiers are unverified; this is not a full quote.')}</p>
    {budget.unknown.length > 0 && <p className="planner-budget-warning">{text(`还有 ${budget.unknown.length} 站费用待确认：`, `${budget.unknown.length} unpriced stops: `)}{budget.unknown.map(stopTitle).join('、')}</p>}
    {budget.overBy > 0 && <p className="planner-budget-warning" role="status">{text(`已计入金额已超预算 ${money(budget.overBy)}。`, `Already over budget by ${money(budget.overBy)}.`)}</p>}
    {stops.length > 0 && <button type="button" className="planner-calendar-export" disabled={!date || timeline.issues.length > 0} onClick={exportCalendar}><CalendarDays size={15} />{text('导出计划到日历', 'Export draft to calendar')}</button>}
  </section>;
}
