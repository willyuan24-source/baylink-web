import { translateText, useLocale } from '../i18n/locale';
import type { BayBayPlanDraft } from '../lib/baybay-plan-handoff';

export function BayBayImportedRequirements({ draft, requested }: { draft: BayBayPlanDraft | null; requested: boolean }) {
  const locale = useLocale(), t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  if (!requested) return null;
  if (!draft) return <p role="status" className="planner-budget-warning" translate="no">{t('完整 BayBay 草稿已过期，或不在当前标签页／账户中。这里只恢复链接中的地点与日期，其他条件未恢复；请回到原对话重新带入。', 'The full BayBay draft expired or belongs to another tab or account. Only linked places and the date were restored; return to the original conversation to transfer the other requirements again.')}</p>;
  const state = draft.requirements;
  const durationSummary = state.preferences?.map(preference => {
    if (preference === 'outing-duration:half-day') return t('半天（具体起止时间未确认）', 'Half a day (exact start and finish unconfirmed)');
    const hours = Number(preference.match(/:(\d+)-minutes$/u)?.[1]) / 60;
    return t(`${hours} 小时（时长偏好）`, `${hours} ${hours === 1 ? 'hour' : 'hours'} (duration preference only)`);
  }).join(' · ');
  const rows = [
    [t('日期', 'Date'), state.date || draft.date], [t('目的地', 'Destination'), state.city || state.region],
    [t('同行人数', 'People'), state.partySize], [t('孩子年龄', 'Child ages'), state.childAges?.map(age => t(`${age} 岁`, `${age} years`)).join(', ')],
    [t('原始预算', 'Original budget'), state.budget != null ? `$${state.budget} · ${state.budgetScope === 'total' ? t('全组', 'whole group') : state.budgetScope === 'person' ? t('每人', 'per person') : t('范围待确认', 'scope unconfirmed')}` : ''],
    [t('交通', 'Travel'), state.travelMode === 'transit' ? t('公共交通', 'Public transit') : state.travelMode === 'walk' ? t('步行', 'Walk') : state.travelMode === 'drive' ? t('开车', 'Drive') : ''],
    [t('出发地', 'Starting point'), state.origin], [t('开始', 'Start'), state.startTime], [t('最晚结束', 'Finish by'), state.finishBy],
    [t('返回要求', 'Return requirement'), state.returnToOrigin === false ? t('在最后一站结束，不返回起点', 'Finish at the last stop; no return to the origin') : state.returnToOrigin === true ? t('返回出发地', 'Return to the starting point') : ''],
    [t('原时长偏好', 'Original duration preference'), durationSummary],
    [t('最多站数', 'Stop limit'), state.maxStops], [t('避开城市', 'Excluded cities'), state.excludedCities?.join(', ')],
    [t('门票', 'Admission'), state.freeOnly ? t('只看免费', 'Free only') : ''], [t('场景', 'Setting'), state.setting === 'indoor' ? t('室内', 'Indoors') : state.setting === 'outdoor' ? t('户外', 'Outdoors') : state.setting === 'mixed' ? t('室内与户外', 'Indoors and outdoors') : ''],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
  const brief = [state.date || draft.date, state.partySize ? t(`${state.partySize} 人`, `${state.partySize} people`) : '', durationSummary, rows.find(([label]) => label === t('原始预算', 'Original budget'))?.[1]].filter(Boolean).join(' · ');
  return <section className="baybay-imported-requirements" aria-label={t('BayBay 原对话条件', 'Original BayBay requirements')} translate="no">
    <h3>{t('BayBay 原对话条件', 'Original BayBay requirements')}</h3>
    <p>{brief}</p>
    {durationSummary && <p>{t('时长偏好保留供核对，不会换算为确认的开始或结束时间。请在表单中选择具体时刻；默认时间不是已确认要求。', 'The duration preference is retained for review and does not establish confirmed start or finish times. Choose exact times in the form; defaults are not confirmed requirements.')}</p>}
    <p><strong>{t('路线仍需核对：', 'Routes still need checking: ')}</strong>{t('起点、返程、站数上限和排除城市不参与计划页路线计算。', 'The origin, return requirement, stop limit and excluded cities are not used in this page’s route calculations.')}</p>
    <p>{t('仅供核对的条件及原票价参考不随保存或分享；刷新或另开标签页会丢失原始草稿。尚未保存或预订。', 'Review-only requirements and the original price reference are not saved or shared. Reloading or opening another tab loses the original draft. Nothing has been saved or booked.')}</p>
    <details><summary>{t('查看全部原始条件', 'View all original requirements')}</summary>
    <p>{t('这是原对话记录，表单里的后续修改不会更新这里。当前安排以表单为准。', 'This records the original conversation and does not change when you edit the form. The form shows your current plan.')}</p>
    <dl>{rows.map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {draft.costReference.knownTotalUsd !== undefined && <p><strong>{t(`BayBay 原答复已知费用小计 $${draft.costReference.knownTotalUsd.toFixed(2)}`, `Original BayBay known-cost subtotal $${draft.costReference.knownTotalUsd.toFixed(2)}`)}</strong>{t('（不是完整出行总价）', ' (not the full trip cost)')}{draft.costReference.unknownItems.length > 0 && ` · ${draft.costReference.unknownItems.join(' ')}`}</p>}
    <p>{t('可用的分龄票价快照仅在日期、地点、人数和孩子年龄保持一致时用于本页费用核算；不随保存或分享。更改这些条件、刷新或重开已存计划后需重新核对票价。', 'Available age-specific price snapshots apply only while the date, stops, party size and child ages are unchanged. They are not saved or shared. Recheck prices after changing those conditions, reloading or reopening a saved plan.')}</p>
    <p>{t('日期、地点、可支持的人数、孩子年龄、交通和起止时间已放入草稿；明确范围的预算已换算为全组总额。尚未保存或预订。', 'The date, places, supported party size, child ages, travel mode and start/end times are in this draft. A budget with a known scope is converted to a group total. Nothing has been saved or booked.')}</p>
    <p>{t('原始预算范围只保留供核对。超过页面上限的条件及未提供的时间，请先核对表单；默认值不是已确认要求。', 'The original budget scope is retained for review only. Check any values beyond the form limits and any times you did not supply; defaults are not confirmed requirements.')}</p>
    </details>
  </section>;
}
