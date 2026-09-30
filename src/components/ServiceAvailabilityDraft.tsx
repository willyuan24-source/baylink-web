import { useState } from 'react';
import { WandSparkles } from 'lucide-react';
import { translateText, useLocale } from '../i18n/locale';
import { draftServiceAvailability, type AvailabilityDraft, type AvailabilityDraftSlot } from '../lib/service-availability-draft';

export function ServiceAvailabilityDraft({ onApply, disabled = false }: { onApply: (slots: AvailabilityDraftSlot[]) => void; disabled?: boolean }) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState<AvailabilityDraft | null>(null);
  const errors = {
    format: t('请按示例填写一个日期或每周安排，并使用 24 小时制。复杂安排请用下方日期选择器逐次添加。', 'Use one date or the weekly example, followed by a 24-hour time range. Add more complex schedules with the date picker below.'),
    date: t('日期不存在，请检查年月日。', 'This date does not exist. Check the year, month and day.'),
    time: t('请填写同一天内有效的起止时间，例如 09:00-12:00。', 'Enter valid start and end times within the same day, such as 09:00-12:00.'),
    weekday: t('日期和星期不一致，请核对后再生成。', 'The date and weekday do not match. Please check before continuing.'),
    past: t('这段安排已没有今天或未来的日期，请选择新的月份。', 'There are no dates left today or in the future. Choose a later month.'),
  };
  return <details className="booking-quick-draft" style={{ padding: '14px 0', borderTop: '1px solid #e6e9e5', borderBottom: '1px solid #e6e9e5' }}>
    <summary style={{ cursor: 'pointer', fontWeight: 650 }}><WandSparkles size={16} style={{ display: 'inline', marginRight: 8 }} />{t('快速生成排期草稿', 'Quick schedule draft')}</summary>
    <p style={{ fontSize: 13, margin: '10px 0' }}>{t('按固定格式整理日期，先预览，再加入待发布时段。所有时间按湾区时间。', 'Generate dates from a supported format, review them, then add them to your draft. All times are Bay Area time.')}</p>
    <label style={{ display: 'grid', gap: 6 }}>{t('输入排期', 'Schedule input')}<input disabled={disabled} value={input} maxLength={160} onChange={event => { setInput(event.target.value); setDraft(null); }} placeholder={t('本月每周六 09:00-12:00', '2026-10-17 09:00-12:00')} /></label>
    <p style={{ fontSize: 12, margin: '8px 0' }}>{t('支持：本月每周六 09:00-12:00；10月17日周六 09:00-12:00；2026-10-17 09:00-12:00。未写年份时使用当前年份。', 'Supported: YYYY-MM-DD 09:00-12:00. Chinese weekly patterns are also supported. Dates without a year use the current year.')}</p>
    <button type="button" disabled={disabled || !input.trim()} onClick={() => setDraft(draftServiceAvailability(input))}>{t('预览具体日期', 'Preview dates')}</button>
    {draft?.error && <p role="alert">{errors[draft.error]}</p>}
    {draft && !draft.error && <div role="status"><ul>{draft.slots.map(slot => <li key={slot.date}>{slot.date} · {slot.startTime}–{slot.endTime}</li>)}</ul><p style={{ fontSize: 12 }}>{t('每个日期是一整段预约，不会自动拆分；发布前仍会检查冲突和提前时间。', 'Each date is one whole appointment, not separate hourly slots. Availability and notice rules are checked when publishing.')}</p><button type="button" disabled={disabled} onClick={() => { onApply(draft.slots); setDraft(null); }}>{t('加入待发布时段', 'Add to draft slots')}</button></div>}
  </details>;
}
