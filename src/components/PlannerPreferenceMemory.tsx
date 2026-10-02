import { useState } from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useLocale, translateText } from '../i18n/locale';
import type { Preferences } from '../lib/planner';

type Props = { preferences: Preferences; disabled: boolean; onSave: (value: Preferences) => unknown; signedIn: boolean };
export function PlannerPreferenceMemory(props: Props) {
  return <PreferenceSession key={String(props.preferences.admissionBudgetUsd)} {...props} />;
}
function PreferenceSession({ preferences, disabled, onSave, signedIn }: Props) {
  const locale = useLocale(), t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const [budget, setBudget] = useState(String(preferences.admissionBudgetUsd ?? ''));
  const valid = budget === '' || (Number.isFinite(Number(budget)) && Number(budget) >= 0 && Number(budget) <= 10000);
  const changed = budget !== String(preferences.admissionBudgetUsd ?? '');
  return <section className="planner-preference-memory" translate="no" aria-label={t('私人出游偏好', 'Private outing preferences')}>
    <h3><SlidersHorizontal size={16} />{t('让下次更懂你', 'A head start next time')}</h3><p>{t('仅用于你的出游建议。明确提出的新要求优先，不会显示在公开个人主页。', 'Used for your outing suggestions. New requests take priority; these preferences are not shown on your public profile.')}</p>
    <div className="planner-detail-grid"><label>{t('常用每人门票预算 $', 'Usual admission budget per person $')}<input type="number" min={0} max={10000} step="0.01" value={budget} disabled={disabled} placeholder={t('不限', 'No limit')} onChange={event => setBudget(event.target.value)} /></label><label>{t('喜欢的场地', 'Preferred setting')}<select value={preferences.setting || 'any'} disabled={disabled} onChange={event => void onSave({ ...preferences, setting: event.target.value as Preferences['setting'] })}><option value="any">{t('室内外皆可', 'Any setting')}</option><option value="indoor">{t('室内', 'Indoor')}</option><option value="outdoor">{t('户外', 'Outdoor')}</option><option value="mixed">{t('室内外结合', 'Mixed')}</option></select></label></div>
    {changed && <button type="button" disabled={disabled || !valid} onClick={() => void onSave({ ...preferences, admissionBudgetUsd: budget === '' ? null : Math.round(Number(budget) * 100) / 100 })}>{t('保存常用预算', 'Save usual budget')}</button>}
    {!valid && <p role="alert">{t('请输入 0–10000 之间的金额。', 'Enter an amount between 0 and 10000.')}</p>}
    <div className="planner-preference-footer"><small>{signedIn ? t('保存在你的账号，可随时修改或清除。', 'Saved to your account; edit or clear at any time.') : t('游客偏好仅保存在这个浏览器。', 'Guest preferences stay in this browser.')}</small><button type="button" disabled={disabled} onClick={() => { setBudget(''); void onSave({ regions: [], interests: [], travelMode: 'any', admissionBudgetUsd: null, setting: 'any' }); }}><RotateCcw size={13} />{t('清除全部出游偏好', 'Clear all outing preferences')}</button></div>
  </section>;
}
