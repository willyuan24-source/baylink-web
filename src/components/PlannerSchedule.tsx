import { CalendarDays, Clock3, Wallet } from 'lucide-react';
import { translateText, useLocale } from '../i18n/locale';
import { buildItinerary, clockLabel, factsForStop, itineraryIcs, planBudget, roundPlanMoney, settingForStop, stopKey } from '../lib/planner-itinerary';
import { stopTitle, type PlanDetails, type Stop, type StopSetting } from '../lib/planner';
import { timeEvidenceLabel } from '../lib/planner-hours';
import { plannerNoticeText } from '../lib/planner-copy';
import { PlannerStopOffers } from './PlannerStopOffers';
import { PlannerTravelCheck } from './PlannerTravelCheck';
import type { BayBayAdmissionOverride } from '../lib/baybay-plan-handoff';

export function PlannerSchedule({ stops, date, title, details, admissionOverride, onChange, onStatus }: { stops: Stop[]; date: string; title: string; details: PlanDetails; admissionOverride?: BayBayAdmissionOverride; onChange: (details: PlanDetails) => void; onStatus: (message: string) => void }) {
  const locale = useLocale();
  const text = (zh: string, en: string) => locale === 'en' ? en : zh;
  const update = (patch: Partial<PlanDetails>) => onChange({ ...details, ...patch });
  const updateStop = (stop: Stop, index: number, patch: Partial<StopSetting>) => {
    const next = { ...settingForStop(details, stop, index), ...patch };
    if (!next.fixedStartTime) delete next.fixedStartTime;
    update({ stopSettings: [...details.stopSettings.filter(item => stopKey(item) !== stopKey(stop)), next] });
  };
  const timeline = buildItinerary(stops, details, date);
  const reference = admissionOverride?.active ? admissionOverride : undefined;
  const budget = planBudget(stops, details, undefined, reference);
  const updateCost = (field: keyof typeof budget.breakdown, value: number) => {
    const raw = { ...budget.breakdown, [field]: value };
    const costBreakdown = { foodUsd: roundPlanMoney(raw.foodUsd), transportUsd: roundPlanMoney(raw.transportUsd), otherUsd: roundPlanMoney(raw.otherUsd) };
    update({ costBreakdown, extraCostUsd: Math.round((costBreakdown.foodUsd + costBreakdown.transportUsd + costBreakdown.otherUsd) * 100) / 100 });
  };
  const money = (amount: number) => new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'zh-CN', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(amount);
  const exportCalendar = () => {
    try {
      const url = URL.createObjectURL(new Blob([itineraryIcs(title, date, stops, details)], { type: 'text/calendar;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `baylink-plan-${date}.ics`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      onStatus(text('已导出时间草稿与提醒；出发前仍需确认营业、场次与预约。', 'Your draft schedule and reminders were exported. Recheck hours, sessions and reservations before leaving.'));
    } catch (error) { onStatus(error instanceof Error ? error.message : text('日历导出失败。', 'Calendar export failed.')); }
  };
  return <section className="planner-schedule" aria-label={text('时间与预算', 'Time and budget')}>
    <PlannerTravelCheck stops={stops} date={date} details={details} />
    <h3><Clock3 size={16} />{text('把时间排清楚', 'Make time for each stop')}</h3>
    <p className="planner-small-note">{text('官方时间逐站标明；未收录或需重新核对的时段仍是草稿。交通与餐休是你预留的时间，不代表实际路程或预订。', 'Each stop shows its time evidence; unknown or outdated hours remain a draft. Travel and meal/rest buffers are your allowances, not live travel times or reservations.')}</p>
    <div className="planner-detail-grid"><label>{text('开始时间', 'Start at')}<input type="time" required value={details.startTime} onChange={event => event.target.value && update({ startTime: event.target.value })} /></label><label>{text('希望几点结束', 'Finish by')}<input type="time" required value={details.finishBy} onChange={event => event.target.value && update({ finishBy: event.target.value })} /></label></div>
    <label>{text('这份计划的交通方式', 'Transport for this plan')}<select value={details.travelMode} onChange={event => update({ travelMode: event.target.value as PlanDetails['travelMode'] })}><option value="any">{text('暂未决定', 'Undecided')}</option><option value="drive">{text('开车', 'Drive')}</option><option value="transit">{text('公共交通', 'Public transit')}</option><option value="walk">{text('步行', 'Walk')}</option></select></label>
    <ol className="planner-timeline">{timeline.rows.map(({ stop, settings, arrival, start, end, wait, lateByMinutes, conflicts, notices, evidence, breakStart, breakMinutes }, index) => <li key={stopKey(stop)} className={conflicts.length ? 'has-conflict' : undefined}>
      {breakMinutes > 0 && <p className="planner-time-break">{clockLabel(breakStart)}–{clockLabel(breakStart + breakMinutes)} · {settings.breakLabel === 'meal' ? text('自留餐饮时间', 'Your meal allowance') : text('自留休息时间', 'Your rest allowance')}</p>}
      <div className="planner-time-range"><span>{Number.isFinite(start) && Number.isFinite(end) ? `${clockLabel(start)}–${clockLabel(end)}` : text('请修正输入', 'Check your inputs')}</span><small>{text('计划', 'Draft')}</small></div>
      <strong>{stopTitle(stop)}</strong>
      <p className="planner-time-evidence">{timeEvidenceLabel(evidence, locale === 'en')}</p>
      {factsForStop(stop)?.planning?.programTimeUnconfirmed && <p className="planner-budget-warning">{text('主节目场次未确认；这里只核对场地开放时段。', 'The main program’s session time is unconfirmed; only the venue’s opening window is checked here.')}</p>}
      {lateByMinutes > 0 && <p className="planner-budget-warning">{text(`预计 ${clockLabel(arrival)} 到达，晚于固定开始时间 ${lateByMinutes} 分钟。`, `Expected arrival ${clockLabel(arrival)} is ${lateByMinutes} minutes after the fixed start.`)}</p>}
      {settings.travelMinutes > 0 && <p className="planner-small-note">{text(`到此站交通预留 ${settings.travelMinutes} 分钟（未计算实际路程）`, `${settings.travelMinutes} minutes reserved for travel (not a live route estimate)`)}</p>}
      {wait > 0 && <p className="planner-small-note">{text(`预留等候 ${wait} 分钟`, `${wait} minutes of waiting`)}</p>}
      <details className="planner-time-notices"><summary>{text(`时间来源与提醒（${notices.length}）`, `Time sources and reminders (${notices.length})`)}</summary>
        {evidence.sourceUrl && <p><a href={evidence.sourceUrl} target="_blank" rel="noreferrer">{text('查看时间资料来源 ↗', 'View the time source ↗')}</a>{evidence.verifiedAt && <small> · {text('核对于', 'Checked')} {evidence.verifiedAt}</small>}</p>}
        {evidence.note && <p>{plannerNoticeText(evidence.note, locale === 'en')}</p>}
        {notices.length > 0 && <ul>{notices.map((notice, i) => <li key={`${notice.code}-${i}`}>{text(notice.zh, notice.en)}</li>)}</ul>}
        {!evidence.sourceUrl && <a href={factsForStop(stop)?.officialUrl} target="_blank" rel="noreferrer">{text('前往官方确认时间 ↗', 'Check times with the official source ↗')}</a>}
      </details>
      <details><summary>{text('调整停留与交通时间', 'Adjust timing')}</summary><div className="planner-detail-grid"><label>{text('停留（分钟）', 'Stay (minutes)')}<input type="number" min={5} max={720} step={5} value={settings.durationMinutes} onChange={event => updateStop(stop, index, { durationMinutes: Number(event.target.value) })} /></label><label>{text(index === 0 ? '到首站预留（分钟）' : '到此站预留（分钟）', 'Travel buffer (minutes)')}<input type="number" min={0} max={360} step={5} value={settings.travelMinutes} onChange={event => updateStop(stop, index, { travelMinutes: Number(event.target.value) })} /></label>
        <label>{text('此站前餐休（分钟）', 'Meal/rest before this stop (minutes)')}<input type="number" min={0} max={180} step={5} value={settings.breakBeforeMinutes ?? 0} onChange={event => updateStop(stop, index, { breakBeforeMinutes: Number(event.target.value) })} /></label>
        <label>{text('餐休类型', 'Break type')}<select value={settings.breakLabel || 'rest'} onChange={event => updateStop(stop, index, { breakLabel: event.target.value as 'meal' | 'rest' })}><option value="rest">{text('休息', 'Rest')}</option><option value="meal">{text('餐饮', 'Meal')}</option></select></label>
      </div>{evidence.status === 'confirmed' && evidence.sessions.length > 1 ? <label>{text('选择官方场次', 'Choose an official session')}<select value={settings.fixedStartTime || ''} onChange={event => updateStop(stop, index, { fixedStartTime: event.target.value })}><option value="">{text('请选择已确认的场次', 'Choose your confirmed session')}</option>{evidence.sessions.map(session => <option key={session.start} value={session.start}>{session.start}{session.end ? `–${session.end}` : ''}</option>)}</select></label> : <label>{text('你的固定开始时间（选填）', 'Your fixed start time (optional)')}<input type="time" value={settings.fixedStartTime || ''} onChange={event => updateStop(stop, index, { fixedStartTime: event.target.value })} /></label>}<a href={factsForStop(stop)?.officialUrl} target="_blank" rel="noreferrer">{text('查看官方时间与票价 ↗', 'Check official hours and tickets ↗')}</a></details>
      <PlannerStopOffers stop={stop} date={date} />
    </li>)}</ol>
    {timeline.issueDetails.length > 0 && <ul className="planner-conflicts" aria-label={text('需要调整的时间', 'Timing conflicts')}>{timeline.issueDetails.map((issue, index) => <li key={`${issue.code}-${index}`}>{locale === 'en' ? stops.reduce((message, stop) => message.replace(`${stopTitle(stop)}:`, `${translateText(stopTitle(stop), locale)}:`), issue.en) : issue.zh}</li>)}</ul>}
    <h3><Wallet size={16} />{text('看清预算缺口', 'Know what is still unpriced')}</h3>
    <div className="planner-detail-grid"><label>{text('同行总人数', 'Group size')}<input type="number" min={1} max={50} step={1} value={details.partySize} onChange={event => update({ partySize: Number(event.target.value) })} /></label><label>{text('整趟总预算 $', 'Trip budget $')}<input type="number" min={0} max={100000} step="0.01" placeholder={text('选填', 'Optional')} value={details.totalBudgetUsd ?? ''} onChange={event => update({ totalBudgetUsd: event.target.value === '' ? null : Number(event.target.value) })} /></label></div>
    <div className="planner-detail-grid">
      <label>{text('餐饮预留（整组）$', 'Food allowance (whole group) $')}<input type="number" min={0} max={100000} step="0.01" value={budget.breakdown.foodUsd} onChange={event => updateCost('foodUsd', Number(event.target.value))} /></label>
      <label>{text('交通与停车预留（整组）$', 'Travel and parking (whole group) $')}<input type="number" min={0} max={100000} step="0.01" value={budget.breakdown.transportUsd} onChange={event => updateCost('transportUsd', Number(event.target.value))} /></label>
      <label>{text('其他预留（整组）$', 'Other allowance (whole group) $')}<input type="number" min={0} max={100000} step="0.01" value={budget.breakdown.otherUsd} onChange={event => updateCost('otherUsd', Number(event.target.value))} /></label>
    </div>
    <dl className="planner-budget"><div><dt>{reference ? text('BayBay 原来源已知门票小计（全组）', 'Original BayBay sourced admission subtotal (group)') : text('已知门票起价 × 人数', 'Published starting prices × people')}</dt><dd>{reference && !reference.knownTotalUsd && reference.unknownStops.length ? text('费用待核算', 'Cost not yet calculated') : money(budget.admissionFloor)}</dd></div><div><dt>{text('自行预留餐饮、停车、交通等 $', 'Your allowance for food, parking and travel $')}</dt><dd>{money(budget.extraCostUsd)}</dd></div><div><dt>{text('目前可计入的小计', 'Partial subtotal')}</dt><dd>{reference && !budget.subtotal && reference.unknownStops.length ? text('费用待核算', 'Cost not yet calculated') : money(budget.subtotal)}</dd></div></dl>
    <p className="planner-small-note">{reference ? text('沿用原日期与同行条件的来源快照；未知项目未按免费计算。快照仅限本页，保存与分享不会保留此报价。', 'Uses the source snapshot for the original date and party. Unknown items are not treated as free. This price snapshot stays on this page and is not retained when saving or sharing.') : text('按所有人支付同一起价粗算，未计儿童优惠、税费和票档差异；不是完整报价。', 'Assumes the same starting price for each person. Child rates, fees and ticket tiers are unverified; this is not a full quote.')}</p>
    {reference && <><p className="planner-small-note">{text('当日适用票价、税费、餐饮与交通仍需核实；不是完整出行总价。', 'Date-specific prices, fees, food and transport still need checking; this is not the full trip price.')}</p>{reference.unknowns.length > 0 && <ul className="planner-small-note">{reference.unknowns.map(item => <li key={item}>{item}</li>)}</ul>}</>}
    {admissionOverride && !reference && <p className="planner-budget-warning" role="status">{text('日期、地点或同行条件已变化，原 BayBay 票价快照已停用。当前改用资料起价粗算，请重新核对分龄票价。', 'The date, stops or party details changed, so the original BayBay price snapshot is no longer applied. Current costs use published starting prices; recheck age-specific rates.')}</p>}
    {budget.unknown.length > 0 && <p className="planner-budget-warning">{text(`还有 ${budget.unknown.length} 站费用待确认：`, `${budget.unknown.length} unpriced stops: `)}{budget.unknown.map(stopTitle).join('、')}</p>}
    {budget.overBy > 0 && <p className="planner-budget-warning" role="status">{text(`已计入金额已超预算 ${money(budget.overBy)}。`, `Already over budget by ${money(budget.overBy)}.`)}</p>}
    {details.constraints?.budget != null && <p className="planner-small-note">{text(details.constraints.budgetScope === 'total' ? '同行门票预算：' : '每人门票预算：', details.constraints.budgetScope === 'total' ? 'Group admission budget: ' : 'Per-person admission budget: ')}{money(details.constraints.budget)} · {text('仅核对门票；餐饮和交通分别预留。', 'Admission only; allow separately for food and travel.')}</p>}
    {budget.admissionOverBy > 0 && <p className="planner-budget-warning" role="status">{text(`已知门票超过门票预算 ${money(budget.admissionOverBy)}。`, `Known admission exceeds the admission budget by ${money(budget.admissionOverBy)}.`)}</p>}
    {stops.length > 0 && <button type="button" className="planner-calendar-export" disabled={!date || timeline.issues.length > 0} onClick={exportCalendar}><CalendarDays size={15} />{text('导出计划到日历', 'Export draft to calendar')}</button>}
  </section>;
}
