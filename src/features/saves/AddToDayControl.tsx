import { useState } from 'react';
import { CalendarPlus, Check } from 'lucide-react';
import { useApp } from '../../app/context';
import { translateText, useLocale } from '../../i18n/locale';
import type { AddToDayPlanProps } from '../../components/AddToDayPlan';
import { readerMonthDay } from '../../lib/event-facts';
import { addToDayName, shortDay } from './add-to-day-name';
import { SaveToast } from './SaveToast';
import { prepareSaveAnnouncer } from './save-announcer';

// Styles: src/features/saves/saves.css (global; this appears on prerendered pages).

/**
 * "加入这天计划": saves the stop into that day's plan right away (a new plan when there is none yet) and confirms with
 * "已加入 10/10 计划 · 查看". Guests keep the plan in this browser; signed-in plans go to the account. Plan D19.
 * Loaded on its own by `AddToDayPlan`, which shows the same button, disabled, until this module has arrived.
 */
export default function AddToDayControl({ stop, date, title, compact, short, className, today }: AddToDayPlanProps) {
  const app = useApp();
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const [state, setState] = useState<{ status: 'idle' | 'busy' | 'done' | 'error'; message?: string; toast?: string }>({ status: 'idle' });
  // The new plan's title keeps "10/10 计划" / "Plan for 10/10" (plan-title.ts reads it in the page's language); what the
  // reader sees is US English on /en: "In your Oct 10 plan" (WEB-FIX6).
  const day = shortDay(date);
  const shownDay = locale === 'en' ? readerMonthDay(date, true) : day;
  const add = async () => {
    setState({ status: 'busy' });
    prepareSaveAnnouncer();
    try {
      // The planner and its catalog load on the first add, not with the page (route JS budgets, plan §3.0 rule 8):
      // lib/planner installs the full catalog the library checks the stop against (WEB-PLAN-DATA).
      const [{ appendToDay }] = await Promise.all([import('../../lib/planner-library'), import('../../lib/planner')]);
      const result = await appendToDay(app?.user?.id, date, stop, t(`${day} 计划`, `Plan for ${day}`), today);
      setState({ status: 'done', toast: result.alreadyThere ? t(`已在 ${day} 计划里`, `Already in your ${shownDay} plan`) : t(`已加入 ${day} 计划`, `Added to your ${shownDay} plan`) });
    } catch (error) {
      // The planner's own messages are Chinese source text (translated for zh-Hant); English gets one plain sentence.
      const reason = (error as { error?: string })?.error;
      setState({ status: 'error', message: reason && locale !== 'en' ? translateText(reason, locale) : t('暂时没能加入计划，请重试。', 'This stop could not be added. Try again.') });
    }
  };
  return <span className={['saves-day', className].filter(Boolean).join(' ')}>
    <button type="button" className="saves-add-day" data-compact={compact ? '' : undefined} aria-label={addToDayName(title, locale, state.status === 'done' ? shownDay : undefined)} disabled={state.status === 'busy'} onClick={() => void add()}>
      {state.status === 'done' ? <Check aria-hidden="true" strokeWidth={2} /> : <CalendarPlus aria-hidden="true" strokeWidth={1.75} />}
      {state.status === 'done' ? t(`已加入 ${day}`, `In your ${shownDay} plan`) : t('加入这天计划', short ? 'Add to day' : 'Add to this day’s plan')}
    </button>
    {state.status === 'error' && <span className="saves-day__error" role="alert">{state.message}</span>}
    {state.toast && <SaveToast message={state.toast} actionLabel={t('查看', 'View')} to={`/my-week#plan-${date}`} closeLabel={t('关闭提示', 'Dismiss')} onClose={() => setState(current => ({ ...current, toast: undefined }))} />}
  </span>;
}
