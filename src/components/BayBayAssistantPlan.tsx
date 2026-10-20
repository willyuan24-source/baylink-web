import { useId, useState } from 'react';
import { Check, CircleHelp, ExternalLink, Pencil, RefreshCw, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Disclosure } from './ui/Disclosure';
import { StatusChip } from './ui/Status';
import { translateText, useLocale } from '../i18n/locale';
import { bayBayAssistantPlanImport, type BayBayAssistantPlan, type BayBayEvidence, type BayBayPlanStop, type BayBayTaskState } from '../lib/baybay-assistant';
import { BayBayEvidenceStamp } from './BayBayEvidenceStamp';
import { stageBayBayPlanDraft } from '../lib/baybay-plan-handoff';
import { plannerWebCheckedDate } from '../lib/planner-web-search';
import { sourcedAdmissionSubtotal } from '../lib/baybay-admission-reference';
import { bayBayClock, bayBayDayLabel, bayBayDayRangeLabel, bayBayOpeningWindowsLabel, bayBayPlaceLabel, bayBayPlanTitle } from '../features/baybay/requirement-labels';
import { SmartLink } from '../features/baybay/SmartLink';
import { bayBayUsd } from '../features/baybay/money';
import { linkifyPhones } from '../lib/phone-links';

function useCopy() {
  const locale = useLocale();
  return (zh: string, en: string) => locale === 'en' && zh !== en ? en : translateText(zh, locale);
}
/**
 * The stop's title, linked to its own page: a BAYLINK page opens in the app; another site opens in a new tab, labelled
 * 官方网站 only when the api marked it the place's official page (else 外部网页), and says so to screen readers.
 */
function StopTitle({ stop, title, onNavigate }: { stop: BayBayPlanStop; title: string; onNavigate: (path: string) => void }) {
  const t = useCopy();
  if (!stop.link) return <>{title}</>;
  return <SmartLink className="baybay-plan-stop-link" href={stop.link.href} onNavigate={onNavigate}>{title}{stop.link.external && <span className="baybay-plan-stop-official"><ExternalLink aria-hidden="true" size={16} />{stop.link.official ? t('官方网站', 'Official site') : t('外部网页', 'External page')}<span className="sr-only">{t('（在新标签页打开）', ' (opens in a new tab)')}</span></span>}</SmartLink>;
}
type Requirement = { key: string; label: string; value: string; prompt: string; clear: string };
const sameSourcePage = (left: string | undefined, right: string) => {
  if (!left) return false;
  try { const a = new URL(left), b = new URL(right); return a.origin === b.origin && a.pathname.replace(/\/+$/, '') === b.pathname.replace(/\/+$/, '') && a.search === b.search; }
  catch { return false; }
};

export function BayBayRequirements({ state, disabled, onAsk }: { state: BayBayTaskState; disabled: boolean; onAsk: (message: string) => void }) {
  const t = useCopy(), locale = useLocale(), [editing, setEditing] = useState<Requirement | null>(null), [draft, setDraft] = useState('');
  const inputId = useId();
  const questionDetails = state.goal === 'information' || state.goal === 'newcomer';
  const title = questionDetails ? t('当前问题条件', 'Current question details') : t('当前安排条件', 'Current requirements');
  const rows: Requirement[] = [];
  const add = (key: string, label: string, value: string | undefined | null, prompt: string, clear: string) => { if (value) rows.push({ key, label, value, prompt, clear }); };
  const travel = state.travelMode === 'drive' ? t('开车', 'Driving') : state.travelMode === 'transit' ? t('公共交通', 'Public transit') : state.travelMode === 'walk' ? t('步行', 'Walking') : null;
  const setting = state.setting === 'indoor' ? t('室内', 'Indoors') : state.setting === 'outdoor' ? t('户外', 'Outdoors') : state.setting === 'mixed' ? t('室内与户外', 'Indoors and outdoors') : null;
  // "东湾" and "10/17 周六", never the API's own values ("east-bay", "2026-10-17"; BBL-12).
  add('city', questionDetails ? t('查询地区', 'Area') : t('目的地', 'Destination'), bayBayPlaceLabel(state, locale), t('城市改为 ', questionDetails ? 'Change city to ' : 'Change destination to '), t('城市不限', 'Any city'));
  add('date', t('日期', 'Date'), state.date ? bayBayDayLabel(state.date, locale) : bayBayDayRangeLabel(state.dateRange, locale), t('日期改为 ', 'Change date to '), t('日期不限', 'Any day'));
  add('origin', t('出发地', 'From'), state.origin, t('出发地改为 ', 'From '), t('清除出发地', 'Clear origin'));
  add('travel', t('交通', 'Travel'), travel, t('出行方式改为 ', 'Travel mode set to '), t('出行方式不限', 'Any travel mode'));
  add('party', t('同行人数', 'People'), state.partySize ? String(state.partySize) : null, t('同行总人数改为 ', 'Party size set to '), t('清除同行人数', 'Clear party size'));
  add('ages', t('孩子年龄', 'Child ages'), state.childAges?.length ? state.childAges.map(age => t(`${age} 岁`, `${age} ${age === 1 ? 'year' : 'years'}`)).join(', ') : null, t('孩子年龄改为 ', 'Child ages set to '), t('清除孩子年龄', 'Clear child ages'));
  const admissionOnlyBudget = state.freeOnly && state.budget === 0 && !state.budgetScope;
  add('budget', t('预算', 'Budget'), state.budget != null && !admissionOnlyBudget ? `$${state.budget} ${state.budgetScope === 'total' ? t('总计', 'total') : state.budgetScope === 'person' ? t('每人', 'per person') : t('范围待确认', 'scope unconfirmed')}` : null,
    state.budgetScope === 'total' ? t('总预算改为 $', 'Total budget set to $') : state.budgetScope === 'person' ? t('每人预算改为 $', 'Per person budget set to $') : t('预算改为 $', 'Budget set to $'), t('预算不限', 'No budget limit'));
  add('free', t('门票', 'Admission'), state.freeOnly ? t('只看免费', 'Free only') : null, t('门票要求改为 ', 'Change admission preference to '), t('不限免费', 'Not limited to free admission'));
  add('setting', t('场景', 'Setting'), setting, t('场景改为 ', 'Setting set to '), t('室内外不限', 'Any setting'));
  add('start', t('开始', 'Start'), state.startTime, t('开始时间改为 ', 'Start time set to '), t('清除开始时间', 'Clear start time'));
  add('finish', t('最晚结束', 'Finish by'), state.finishBy, t('最晚结束时间改为 ', 'Finish by set to '), t('清除结束时间', 'Clear finish time'));
  add('return', t('返程', 'Return'), state.returnToOrigin === true ? t('回到起点', 'Return to origin') : state.returnToOrigin === false ? t('不回起点', 'No return') : null, '', t('清除返回要求', 'Clear return requirement'));
  add('maxStops', t('最多站数', 'Stop limit'), state.maxStops ? t(`${state.maxStops} 站`, `${state.maxStops} stops`) : null, '', t('清除站数限制', 'Clear stop limit'));
  add('excluded', t('避开城市', 'Excluded cities'), state.excludedCities?.join(', '), t('排除 ', 'Not in '), t('清除排除城市', 'Clear excluded cities'));
  const editMessage = editing?.key === 'maxStops' ? t(`最多 ${draft.trim()} 站`, `At most ${draft.trim()} stops`) : draft.trim();
  const canApply = editing?.key === 'maxStops' ? /^[1-6]$/.test(draft.trim()) : draft.trim().length >= 2 && draft.trim() !== editing?.prompt.trim();
  const apply = () => { if (!disabled && canApply) { onAsk(editMessage); setEditing(null); } };
  if (!rows.length) return null;
  // 当前条件 is folded (content arrangement 10-19: it was an open block 164 px tall); its chips edit one condition each.
  return <section className="baybay-requirements" aria-label={title} translate="no"><Disclosure summary={<span>{title}<small>{t('点击修改', 'Select to edit')}</small></span>}>
    <div className="baybay-requirement-chips">{rows.map(row => <button type="button" className="ui-chip" key={row.key} disabled={disabled} aria-label={`${row.label} ${row.value}`} onClick={() => { setEditing(row); setDraft(row.key === 'maxStops' ? String(state.maxStops) : row.prompt); }}><span>{row.label}</span><strong>{row.value}</strong><Pencil aria-hidden="true" size={16} /></button>)}</div>
    {editing && <div className="baybay-requirement-editor">{editing.key === 'return' ? <div role="group" aria-label={t('修改返程', 'Edit return requirement')}>
      {[[t('回到起点', 'Return to origin'), t('返回出发地', 'Return to the origin')], [t('不回起点', 'No return'), t('不返回起点', 'Do not return to the origin')]].map(([label, message]) => <Button variant="secondary" key={message} disabled={disabled} onClick={() => { onAsk(message); setEditing(null); }}>{label}</Button>)}
    </div> : <><label htmlFor={inputId}>{t(`修改${editing.label}`, `Edit ${editing.label.toLowerCase()}`)}{editing.key === 'maxStops' && t('（1–6）', ' (1–6)')}</label>
      <input id={inputId} value={draft} inputMode={editing.key === 'maxStops' ? 'numeric' : undefined} maxLength={editing.key === 'maxStops' ? 3 : 500} disabled={disabled} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); apply(); } }} /></>}
      <div>{editing.key !== 'return' && <Button variant="primary" disabled={disabled || !canApply} onClick={apply}>{t('应用修改', 'Apply change')}</Button>}
        <Button variant="secondary" disabled={disabled} onClick={() => { onAsk(editing.clear); setEditing(null); }}>{t('清除此条件', 'Clear this requirement')}</Button><button type="button" className="ui-icon-button" onClick={() => setEditing(null)} aria-label={t('取消修改', 'Cancel edit')}><X aria-hidden="true" size={20} /></button></div>
    </div>}
  </Disclosure></section>;
}

export function BayBayAssistantPlanCard({ plan, taskState, ownerId, evidence, disabled, onAsk, onNavigate }: {
  plan: BayBayAssistantPlan; taskState?: BayBayTaskState; ownerId?: string; evidence: BayBayEvidence[]; disabled: boolean; onAsk: (message: string) => void; onNavigate: (path: string) => void;
}) {
  const t = useCopy(), locale = useLocale(), imported = bayBayAssistantPlanImport(plan), english = locale === 'en';
  const title = bayBayPlanTitle(plan.title, locale);
  const [importError, setImportError] = useState(false);
  // Notes and open questions often name the number to call ("先打 510-597-5089 预约"): tap-to-call (G27).
  const reader = (text: string) => linkifyPhones(t(text, text));
  const sourcedZeroAdmission = plan.budget.knownTotalUsd === 0 && sourcedAdmissionSubtotal(plan.stops.map(stop => stop.admissionFacts), taskState?.partySize, new Set(evidence.map(item => item.id))) === 0;
  const hasUnpricedCosts = plan.budget.unknownItems.length > 0 || !plan.stops.length || plan.stops.some(stop => stop.admissionFacts ? stop.admissionFacts.status !== 'complete' || stop.admissionFacts.knownTotalUsd === undefined : stop.admissionUsd === undefined);
  const costNotCalculated = plan.budget.knownTotalUsd === undefined || (plan.budget.knownTotalUsd === 0 && hasUnpricedCosts && !sourcedZeroAdmission);
  const totalLimit = plan.budget.scope === 'total' ? plan.budget.limitUsd : plan.budget.scope === 'person' && taskState?.partySize && plan.budget.limitUsd !== undefined ? plan.budget.limitUsd * taskState.partySize : undefined;
  const overBudget = totalLimit !== undefined && plan.budget.knownTotalUsd !== undefined && plan.budget.knownTotalUsd > totalLimit;
  const unique = (items: string[]) => [...new Set(items.map(item => item.trim()).filter(Boolean))];
  const concerns = unique([...plan.checks.filter(check => check.status === 'fail').map(check => check.message), ...plan.budget.unknownItems, ...plan.unknowns, ...plan.stops.flatMap(stop => stop.admissionFacts?.unknowns || []), ...plan.checks.filter(check => check.status === 'unknown').map(check => check.message)]);
  const allConcerns = new Set(concerns);
  const status = plan.status === 'ready' ? t('安排草案', 'Plan draft') : plan.status === 'needs_details' ? t('还需补充条件', 'More details needed') : t('部分信息待核实', 'Some details need checking');
  const sources = new Map(evidence.map(item => [item.id, item]));
  const stopIds = plan.stops.map(stop => stop.entityId || stop.id.replace(/^(?:event|place):/, ''));
  const inbound = plan.stops.map((stop, index) => plan.travelLegs?.find(leg => leg.provider === 'google-maps' && leg.status === 'estimate'
    && leg.from === (index ? stopIds[index - 1] : 'origin') && leg.to === stopIds[index] && leg.durationMinutes === stop.travelMinutes));
  const returnLeg = plan.travelLegs?.find(leg => leg.provider === 'google-maps' && leg.status === 'estimate' && leg.from === stopIds[stopIds.length - 1] && leg.to === 'origin');
  // Plan card (content arrangement 10-19): date → title → one StatusChip from C's table (安排草案 / 部分信息待核实 /
  // 还需补充条件 all take the neutral look; no amber) → the summary → the 费用 line (the subtotal is the key value) →
  // 先确认这些 in its own block → the stops → 出发前检查 → the card's one primary (带入计划页) → two follow-up chips.
  return <section className="baybay-assistant-plan" aria-label={t('BayBay 安排草案', 'BayBay plan draft')} translate="no">
    <header><small>{bayBayDayLabel(plan.date, locale) || t('日期待确认', 'Date unconfirmed')}</small><h3>{title}</h3><StatusChip className="baybay-plan-status">{status}</StatusChip></header>
    {plan.summary && <p className="baybay-plan-summary">{t(plan.summary, plan.summary)}</p>}
    <section className="baybay-plan-budget" aria-label={t('费用', 'Costs')}><p>{costNotCalculated ? <strong>{t('费用待核算', 'Cost not yet calculated')}</strong> : sourcedZeroAdmission ? <>{t('全组已知门票小计', 'Known group admission subtotal')} <strong>{bayBayUsd(0, true)}</strong></> : <>{t('全组已知费用小计', 'Known costs subtotal for the whole group')} <strong>{bayBayUsd(plan.budget.knownTotalUsd!)}</strong></>}</p>
      {plan.budget.limitUsd !== undefined && <p>{t('预算上限', 'Budget limit')} {bayBayUsd(plan.budget.limitUsd)}{` · ${plan.budget.scope === 'person' ? t('每人', 'per person') : plan.budget.scope === 'total' ? t('全组', 'whole group') : t('范围待确认', 'scope unconfirmed')}`}</p>}
      {overBudget && <p className="baybay-plan-risk" role="status">{t(`已知费用已超出全组预算 ${bayBayUsd(plan.budget.knownTotalUsd! - totalLimit!, true)}，需要调整安排。`, `Known costs already exceed the group budget by ${bayBayUsd(plan.budget.knownTotalUsd! - totalLimit!, true)}. The plan needs a change.`)}</p>}
      <small>{t('小计不代表完整出行总价；未知费用未按零元计算。', 'The subtotal is not the full trip cost; unknown costs are not counted as zero.')}{plan.stops.some(stop => stop.admissionFacts?.basis === 'catalog-snapshot') && t(' 含资料快照参考价，当日票价与适用条件仍需确认。', ' Includes catalog snapshot prices; confirm prices and eligibility for your date.')}</small>
    </section>
    {!!concerns.length && <section className="baybay-plan-key-unknowns" aria-label={t('先确认这些', 'Check these first')}><h4>{t('先确认这些', 'Check these first')}</h4><ul>{concerns.slice(0, 3).map(item => <li key={item}>{reader(item)}</li>)}</ul>{concerns.length > 3 && <small>{t(`另有 ${concerns.length - 3} 项，见下方出发前检查。`, `${concerns.length - 3} more items in “Before you go” below.`)}</small>}</section>}
    <ol className="baybay-plan-stops">{plan.stops.map((stop, index) => {
      const facts = stop.admissionFacts;
      const admissionKnown = facts ? facts.knownTotalUsd !== undefined && facts.status !== 'unknown' : stop.admissionUsd !== undefined;
      // 交通 and 门票 show only when known; every unknown merges into one 待核实 line.
      const unknown = [...inbound[index] ? [] : [t('前往本站交通时间', 'travel time to this stop')], ...admissionKnown ? [] : [t('门票费用', 'admission cost')]];
      // One citation per source page (the live L07 stop 3 listed the same page twice), each with its stamp on its own line.
      const seen = new Set<string>();
      const citations = stop.sourceIds.flatMap(id => {
        const source = sources.get(id);
        if (!source || seen.has(source.url)) return [];
        seen.add(source.url);
        const priceSource = facts?.sourceIds.includes(id) && sameSourcePage(facts.sourceUrl, source.url) && plannerWebCheckedDate(facts.checkedAt)
          ? { ...source, checkedAt: facts.checkedAt, verification: facts.basis === 'page-read' ? 'page-read' as const : 'catalog' as const } : undefined;
        return [<li key={id}><a href={source.url} target="_blank" rel="noopener noreferrer"><span><ExternalLink aria-hidden="true" size={16} />{t(source.title, source.title)}</span><BayBayEvidenceStamp source={priceSource || source} scope={priceSource ? 'admission' : undefined} /></a></li>];
      });
      const notes = unique(stop.notes).filter(note => !allConcerns.has(note)).slice(0, 2);
      const place = [stop.city, stop.date && stop.date !== plan.date ? bayBayDayLabel(stop.date, locale) || stop.date : ''].filter(Boolean).join(' · ');
      return <li key={stop.id}>
        <div className="baybay-plan-stop-heading"><span className="ui-plate baybay-plan-stop-number">{index + 1}</span><h4><StopTitle stop={stop} title={t(stop.title, stop.title)} onNavigate={onNavigate} /></h4></div>
        <dl><div className="baybay-plan-stop-when"><dt className="sr-only">{t('时间', 'Time')}</dt><dd>{stop.startTime ? `${bayBayClock(stop.startTime, english)}${stop.endTime ? `–${bayBayClock(stop.endTime, english)}` : ''}` : stop.openingWindows ? `${t('开放', 'Open')} ${bayBayOpeningWindowsLabel(stop.openingWindows, english)}` : t('待安排', 'Unscheduled')}
          {stop.durationMinutes !== undefined ? ` · ${stop.durationMinutes} ${t('分钟', 'min')}` : stop.suggestedDurationMinutes !== undefined && ` · ${t(`建议停留约 ${stop.suggestedDurationMinutes} 分钟`, `Suggested stay about ${stop.suggestedDurationMinutes} min`)}`}
          <small>{stop.startTime ? stop.timeStatus === 'verified' ? t('来源已核对的时段', 'Source-checked time') : stop.timeStatus === 'suggested' ? t('建议时段，开放与预约待核实', 'Suggested time; verify hours and booking') : t('时段待核实', 'Time unverified')
            : stop.openingWindows ? t('资料所列开放时段，到达时间待安排', 'Listed opening hours; arrival time not scheduled') : t('时段待核实', 'Time unverified')}{place && ` · ${place}`}</small>
          {stop.startTime && stop.openingWindows && <small>{t(`开放时段 ${bayBayOpeningWindowsLabel(stop.openingWindows, english)}`, `Open ${bayBayOpeningWindowsLabel(stop.openingWindows, english)}`)}</small>}</dd></div>
          {inbound[index] && <div><dt>{t('交通', 'Travel')}</dt><dd>{t(`前往本站约 ${inbound[index]!.durationMinutes} 分钟 · Google Maps 估算`, `About ${inbound[index]!.durationMinutes} min to this stop · Google Maps estimate`)}</dd></div>}
          {admissionKnown && <div><dt>{t('门票', 'Admission')}</dt><dd>{facts ? <>{t(`全组已知门票小计 ${bayBayUsd(facts.knownTotalUsd!, true)}`, `Known group admission subtotal ${bayBayUsd(facts.knownTotalUsd!, true)}`)}<small>{facts.basis === 'page-read' ? t('来源页面参考价', 'Source-page price reference') : t('资料快照参考价', 'Catalog snapshot price')}{facts.checkedAt ? ` · ${plannerWebCheckedDate(facts.checkedAt)}` : ''}</small>{facts.breakdown.map((row, i) => <small key={i}>{row.category === 'adult' ? t('成人', 'Adult') : row.category === 'child' ? t(`儿童${row.age === undefined ? '' : ` ${row.age} 岁`}`, `Child${row.age === undefined ? '' : ` age ${row.age}`}`) : row.category === 'group' ? t('全组', 'Group') : t('通用票', 'All ages')} {row.quantity} × {bayBayUsd(row.unitUsd, true)} = {bayBayUsd(row.subtotalUsd, true)}</small>)}{facts.applicability.dateStatus !== 'date-specific' && <small>{t('所选日期适用性待确认', 'Eligibility on your chosen date is unconfirmed')}</small>}{facts.applicability.feesIncluded !== true && <small>{t('附加费是否包含仍需确认', 'Check whether additional fees are included')}</small>}</> : bayBayUsd(stop.admissionUsd!)}</dd></div>}
          {unknown.length > 0 && <div className="baybay-plan-stop-unknown"><dt>{t('待核实', 'To check')}</dt><dd>{unknown.join(english ? ', ' : '、')}{facts && !admissionKnown && facts.applicability.dateStatus !== 'date-specific' && <small>{t('所选日期适用性待确认', 'Eligibility on your chosen date is unconfirmed')}</small>}</dd></div>}</dl>
        {notes.length > 0 && <ul className="baybay-plan-notes">{notes.map(note => <li key={note}>{reader(note)}</li>)}</ul>}
        {citations.length ? <ul className="baybay-plan-citations">{citations}</ul> : <p className="baybay-plan-citations-none">{t('暂无可用来源，请先核实此站。', 'No usable source; check this stop before visiting.')}</p>}
        <Button variant="quiet" className="baybay-plan-swap" disabled={disabled} onClick={() => onAsk(t(`换掉第${index + 1}站，保留其他条件。`, `Replace stop ${index + 1}, keeping my other requirements.`))} icon={<RefreshCw aria-hidden="true" size={16} />}>{t(`换掉第${index + 1}站`, `Replace stop ${index + 1}`)}</Button>
      </li>;
    })}</ol>
    {plan.returnTime && returnLeg && <p className="baybay-plan-summary">{t(`预计 ${plan.returnTime} 返回出发地 · Google Maps 估算，实际路况可能变化。`, `Estimated return to your starting point at ${bayBayClock(plan.returnTime, true)} · Google Maps estimate; actual travel conditions may change.`)}</p>}
    {(plan.checks.some(check => check.status === 'pass') || concerns.length > 3) && <Disclosure className="baybay-plan-checks" summary={t('出发前检查', 'Before you go')}><ul>{unique(plan.checks.filter(check => check.status === 'pass').map(check => check.message)).map(message => <li key={message} data-status="pass"><Check aria-hidden="true" size={16} /><span><strong>{t('已核对', 'Checked')}</strong> · {t(message, message)}</span></li>)}{concerns.slice(3).map(item => <li key={item}><CircleHelp aria-hidden="true" size={16} /><span>{reader(item)}</span></li>)}</ul></Disclosure>}
    {imported ? <div className="baybay-plan-import"><Button variant="primary" block disabled={disabled} onClick={() => { const path = stageBayBayPlanDraft({ ...plan, title }, taskState, ownerId); if (path) onNavigate(path); else setImportError(true); }}>{t(`将 ${imported.count} 个地点带入计划页`, `Open ${imported.count} places in planner`)}</Button><small>{t('将可支持的条件放入当前标签页草稿；起点、返回等限制会另列供核对。不会自动保存或预订；刷新或新标签页只能恢复链接中的日期与地点。', 'Supported requirements transfer to a draft in this tab; origin, return and other limitations remain visible for review. Nothing is saved or booked. Reloading or a new tab restores only the linked date and places.')}{imported.omitted > 0 && t(` 另有 ${imported.omitted} 站无法带入，请保留上面的来源。`, ` ${imported.omitted} other stops cannot be transferred; keep their sources above.`)}</small>{importError && <p role="alert">{t('草稿未能带入，请保留上方条件并重试。', 'The draft could not be transferred. Keep the requirements above and retry.')}</p>}</div>
      : plan.stops.length > 0 && <p className="baybay-plan-summary">{t('这些站点或日期暂不支持带入站内计划页，请保留来源并核实安排。', 'These stops or the date cannot yet be transferred to the site planner. Keep the sources and verify the arrangements.')}</p>}
    <ul className="baybay-plan-followups">{[[t('优先减少路程', 'Reduce travel'), t('保留其他条件，帮我减少站点之间的路程。', 'Keep my other requirements and reduce travel between stops.')], [t('检查费用与预约', 'Check costs and booking'), t('检查这份安排的未知费用和需要预约的项目。', 'Check unknown costs and reservation requirements for this plan.')]].map(([label, message]) => <li key={label}><button type="button" className="ui-chip" disabled={disabled} onClick={() => onAsk(message)}>{label}</button></li>)}</ul>
  </section>;
}
