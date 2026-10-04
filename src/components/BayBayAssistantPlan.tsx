import { useId, useState } from 'react';
import { ArrowRight, Check, CircleHelp, ExternalLink, Pencil, RefreshCw, X } from 'lucide-react';
import { translateText, useLocale } from '../i18n/locale';
import { bayBayAssistantPlanImport, type BayBayAssistantPlan, type BayBayEvidence, type BayBayTaskState } from '../lib/baybay-assistant';

function useCopy() {
  const locale = useLocale();
  return (zh: string, en: string) => locale === 'en' && zh !== en ? en : translateText(zh, locale);
}
type Requirement = { key: string; label: string; value: string; prompt: string; clear: string };

export function BayBayRequirements({ state, disabled, onAsk }: { state: BayBayTaskState; disabled: boolean; onAsk: (message: string) => void }) {
  const t = useCopy(), [editing, setEditing] = useState<Requirement | null>(null), [draft, setDraft] = useState('');
  const inputId = useId();
  const rows: Requirement[] = [];
  const add = (key: string, label: string, value: string | undefined | null, prompt: string, clear: string) => { if (value) rows.push({ key, label, value, prompt, clear }); };
  const travel = state.travelMode === 'drive' ? t('开车', 'Driving') : state.travelMode === 'transit' ? t('公共交通', 'Public transit') : state.travelMode === 'walk' ? t('步行', 'Walking') : null;
  const setting = state.setting === 'indoor' ? t('室内', 'Indoors') : state.setting === 'outdoor' ? t('户外', 'Outdoors') : state.setting === 'mixed' ? t('室内与户外', 'Indoors and outdoors') : null;
  add('city', t('目的地', 'Destination'), state.city || state.region, t('城市改为 ', 'Change destination to '), t('城市不限', 'Any city'));
  add('date', t('日期', 'Date'), state.date, t('日期改为 ', 'Change date to '), t('日期不限', 'Any day'));
  add('origin', t('出发地', 'From'), state.origin, t('出发地改为 ', 'From '), t('清除出发地', 'Clear origin'));
  add('travel', t('交通', 'Travel'), travel, t('出行方式改为 ', 'Travel mode set to '), t('出行方式不限', 'Any travel mode'));
  add('party', t('同行人数', 'People'), state.partySize ? String(state.partySize) : null, t('同行总人数改为 ', 'Party size set to '), t('清除同行人数', 'Clear party size'));
  add('ages', t('孩子年龄', 'Child ages'), state.childAges?.length ? state.childAges.join(', ') : null, t('孩子年龄改为 ', 'Child ages set to '), t('清除孩子年龄', 'Clear child ages'));
  add('budget', t('预算', 'Budget'), state.budget != null ? `$${state.budget} ${state.budgetScope === 'total' ? t('总计', 'total') : state.budgetScope === 'person' ? t('每人', 'per person') : t('范围待确认', 'scope unconfirmed')}` : null,
    state.budgetScope === 'total' ? t('总预算改为 $', 'Total budget set to $') : state.budgetScope === 'person' ? t('每人预算改为 $', 'Per person budget set to $') : t('预算改为 $', 'Budget set to $'), t('预算不限', 'No budget limit'));
  add('free', t('门票', 'Admission'), state.freeOnly ? t('只看免费', 'Free only') : null, t('门票要求改为 ', 'Change admission preference to '), t('不限免费', 'Not limited to free admission'));
  add('setting', t('场景', 'Setting'), setting, t('场景改为 ', 'Setting set to '), t('室内外不限', 'Any setting'));
  add('start', t('开始', 'Start'), state.startTime, t('开始时间改为 ', 'Start time set to '), t('清除开始时间', 'Clear start time'));
  add('finish', t('最晚结束', 'Finish by'), state.finishBy, t('最晚结束时间改为 ', 'Finish by set to '), t('清除结束时间', 'Clear finish time'));
  add('excluded', t('避开城市', 'Excluded cities'), state.excludedCities?.join(', '), t('排除 ', 'Not in '), t('清除排除城市', 'Clear excluded cities'));
  if (!rows.length) return null;
  return <section className="baybay-requirements" aria-label={t('当前安排条件', 'Current requirements')} translate="no">
    <header><strong>{t('当前安排条件', 'Current requirements')}</strong><small>{t('点击修改', 'Select to edit')}</small></header>
    <div className="baybay-requirement-chips">{rows.map(row => <button type="button" key={row.key} disabled={disabled} aria-label={`${row.label} ${row.value}`} onClick={() => { setEditing(row); setDraft(row.prompt); }}><span>{row.label}</span><strong>{row.value}</strong><Pencil size={11} /></button>)}</div>
    {editing && <div className="baybay-requirement-editor"><label htmlFor={inputId}>{t(`修改${editing.label}`, `Edit ${editing.label.toLowerCase()}`)}</label>
      <input id={inputId} value={draft} maxLength={500} disabled={disabled} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && draft.trim().length >= 2 && draft.trim() !== editing.prompt.trim()) { event.preventDefault(); onAsk(draft); setEditing(null); } }} />
      <div><button type="button" disabled={disabled || draft.trim().length < 2 || draft.trim() === editing.prompt.trim()} onClick={() => { onAsk(draft); setEditing(null); }}>{t('应用修改', 'Apply change')}</button>
        <button type="button" disabled={disabled} onClick={() => { onAsk(editing.clear); setEditing(null); }}>{t('清除此条件', 'Clear this requirement')}</button><button type="button" onClick={() => setEditing(null)} aria-label={t('取消修改', 'Cancel edit')}><X size={14} /></button></div>
    </div>}
  </section>;
}

export function BayBayAssistantPlanCard({ plan, evidence, disabled, onAsk, onNavigate }: {
  plan: BayBayAssistantPlan; evidence: BayBayEvidence[]; disabled: boolean; onAsk: (message: string) => void; onNavigate: (path: string) => void;
}) {
  const t = useCopy(), imported = bayBayAssistantPlanImport(plan);
  const status = plan.status === 'ready' ? t('安排草案', 'Plan draft') : plan.status === 'needs_details' ? t('还需补充条件', 'More details needed') : t('部分信息待核实', 'Some details need checking');
  const sources = new Map(evidence.map(item => [item.id, item]));
  const stopIds = plan.stops.map(stop => stop.entityId || stop.id.replace(/^(?:event|place):/, ''));
  const inbound = plan.stops.map((stop, index) => plan.travelLegs?.find(leg => leg.provider === 'google-maps' && leg.status === 'estimate'
    && leg.from === (index ? stopIds[index - 1] : 'origin') && leg.to === stopIds[index] && leg.durationMinutes === stop.travelMinutes));
  const returnLeg = plan.travelLegs?.find(leg => leg.provider === 'google-maps' && leg.status === 'estimate' && leg.from === stopIds[stopIds.length - 1] && leg.to === 'origin');
  return <section className="baybay-assistant-plan" aria-label={t('BayBay 安排草案', 'BayBay plan draft')} translate="no">
    <header><div><small>{plan.date || t('日期待确认', 'Date unconfirmed')}</small><h3>{t(plan.title, plan.title)}</h3></div><span className={`baybay-plan-status baybay-plan-status--${plan.status}`}>{status}</span></header>
    {plan.summary && <p className="baybay-plan-summary">{t(plan.summary, plan.summary)}</p>}
    <ol className="baybay-plan-stops">{plan.stops.map((stop, index) => <li key={stop.id}>
      <div className="baybay-plan-stop-heading"><span className="baybay-plan-stop-number">{index + 1}</span><div><h4>{t(stop.title, stop.title)}</h4><small>{stop.city}{stop.date && stop.date !== plan.date ? ` · ${stop.date}` : ''}</small></div></div>
      <dl><div><dt>{t('时间', 'Time')}</dt><dd>{stop.startTime ? `${stop.startTime}${stop.endTime ? `–${stop.endTime}` : ''}` : t('待安排', 'Unscheduled')}{stop.durationMinutes !== undefined && ` · ${stop.durationMinutes} ${t('分钟', 'min')}`}<small>{stop.timeStatus === 'verified' ? t('来源已核对的时段', 'Source-checked time') : stop.timeStatus === 'suggested' ? t('建议时段，开放与预约待核实', 'Suggested time; verify hours and booking') : t('时段待核实', 'Time unverified')}</small></dd></div>
        <div><dt>{t('交通', 'Travel')}</dt><dd>{inbound[index] ? t(`前往本站约 ${inbound[index]!.durationMinutes} 分钟 · Google Maps 估算`, `About ${inbound[index]!.durationMinutes} min to this stop · Google Maps estimate`) : t('前往本站交通时间待核实', 'Travel time to this stop is unverified')}</dd></div>
        <div><dt>{t('门票参考', 'Admission reference')}</dt><dd>{stop.admissionUsd === undefined ? t('费用未知', 'Cost unknown') : `$${stop.admissionUsd}`}</dd></div></dl>
      {stop.notes.length > 0 && <ul className="baybay-plan-notes">{stop.notes.map((note, i) => <li key={i}>{t(note, note)}</li>)}</ul>}
      <div className="baybay-plan-citations">{stop.sourceIds.flatMap(id => { const source = sources.get(id); return source ? [<a key={id} href={source.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} />{t(source.title, source.title)}{source.checkedAt && <small>{t(`核对 ${source.checkedAt}`, `Checked ${source.checkedAt}`)}</small>}</a>] : []; })}{!stop.sourceIds.some(id => sources.has(id)) && <small>{t('暂无可用来源，请先核实此站。', 'No usable source; check this stop before visiting.')}</small>}</div>
      <button type="button" className="baybay-plan-swap" disabled={disabled} onClick={() => onAsk(t(`换掉第${index + 1}站，保留其他条件。`, `Replace stop ${index + 1}, keeping my other requirements.`))}><RefreshCw size={12} />{t(`换掉第${index + 1}站`, `Replace stop ${index + 1}`)}</button>
    </li>)}</ol>
    {plan.returnTime && returnLeg && <p className="baybay-plan-summary">{t(`预计 ${plan.returnTime} 返回出发地 · Google Maps 估算，实际路况可能变化。`, `Estimated return to your starting point at ${plan.returnTime} · Google Maps estimate; actual travel conditions may change.`)}</p>}
    <section className="baybay-plan-budget"><h4>{t('费用核对', 'Budget check')}</h4><p>{t('全组已知费用小计', 'Known costs subtotal for the whole group')} <strong>{plan.budget.knownTotalUsd === undefined ? t('未知', 'Unknown') : `$${plan.budget.knownTotalUsd}`}</strong></p>
      {plan.budget.limitUsd !== undefined && <p>{t('预算上限', 'Budget limit')} <strong>${plan.budget.limitUsd}</strong>{` · ${plan.budget.scope === 'person' ? t('每人', 'per person') : plan.budget.scope === 'total' ? t('全组', 'whole group') : t('范围待确认', 'scope unconfirmed')}`}</p>}
      <small>{t('小计不代表完整出行总价；未知费用未按零元计算。', 'The subtotal is not the full trip cost; unknown costs are not counted as zero.')}</small>
      {!!plan.budget.unknownItems.length && <ul>{plan.budget.unknownItems.map((item, i) => <li key={i}>{t(item, item)}</li>)}</ul>}
    </section>
    {(plan.checks.length > 0 || plan.unknowns.length > 0) && <details className="baybay-plan-checks"><summary>{t('出发前检查', 'Before you go')}</summary><ul>{plan.checks.map((check, i) => <li key={`${check.code}:${i}`} data-status={check.status}>{check.status === 'pass' ? <Check size={14} /> : <CircleHelp size={14} />}<span><strong>{check.status === 'pass' ? t('已核对', 'Checked') : check.status === 'fail' ? t('需要调整', 'Needs a change') : t('待核实', 'Unverified')}</strong> · {t(check.message, check.message)}</span></li>)}{plan.unknowns.map((unknown, i) => <li key={`unknown:${i}`}><CircleHelp size={14} /><span>{t(unknown, unknown)}</span></li>)}</ul></details>}
    {imported ? <div className="baybay-plan-import"><button type="button" disabled={disabled} onClick={() => onNavigate(imported.path)}>{t(`将 ${imported.count} 个地点带入计划页`, `Open ${imported.count} places in planner`)}<ArrowRight size={14} /></button><small>{t('仅带入站内地点与日期；时间、人数和预算请在计划页继续核对。不会自动保存或预订。', 'Only site places and the date are transferred. Recheck times, party size and budget in the planner. Nothing is saved or booked automatically.')}{imported.omitted > 0 && t(` 另有 ${imported.omitted} 站无法带入，请保留上面的来源。`, ` ${imported.omitted} other stops cannot be transferred; keep their sources above.`)}</small></div>
      : plan.stops.length > 0 && <p className="baybay-plan-summary">{t('这些站点或日期暂不支持带入站内计划页，请保留来源并核实安排。', 'These stops or the date cannot yet be transferred to the site planner. Keep the sources and verify the arrangements.')}</p>}
    <div className="baybay-plan-followups">{[[t('优先减少路程', 'Reduce travel'), t('保留其他条件，帮我减少站点之间的路程。', 'Keep my other requirements and reduce travel between stops.')], [t('检查费用与预约', 'Check costs and booking'), t('检查这份安排的未知费用和需要预约的项目。', 'Check unknown costs and reservation requirements for this plan.')]].map(([label, message]) => <button type="button" key={label} disabled={disabled} onClick={() => onAsk(message)}>{label}</button>)}</div>
  </section>;
}
