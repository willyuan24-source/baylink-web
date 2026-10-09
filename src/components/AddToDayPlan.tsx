import { useState } from 'react';
import { CalendarPlus, Check } from 'lucide-react';
import { useApp } from '../app/context';
import { appendToDay } from '../lib/planner-library';
import { errorText, type Stop } from '../lib/planner';
import { translateText, useLocale } from '../i18n/locale';
import { Button } from './ui/Button';
import { SaveToast } from '../features/saves/SaveToast';
import '../features/saves/saves.css';

/** "10/10" for the toast and a new plan's title. */
const shortDay = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/**
 * "加入这天计划": saves the stop into that day's plan right away (a new plan when there is none yet) and confirms with
 * "已加入 10/10 计划 · 查看". Guests keep the plan in this browser; signed-in plans go to the account. Plan D19.
 */
export function AddToDayPlan({ stop, date, title, compact, className, today }: { stop: Stop; date: string; title?: string; compact?: boolean; className?: string; /** The page's Pacific day, when it has one (calendar). */ today?: string }) {
  const app = useApp();
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const [state, setState] = useState<{ status: 'idle' | 'busy' | 'done' | 'error'; message?: string; toast?: string }>({ status: 'idle' });
  const day = shortDay(date);
  const add = async () => {
    setState({ status: 'busy' });
    try {
      const result = await appendToDay(app?.user?.id, date, stop, t(`${day} 计划`, `Plan for ${day}`), today);
      setState({ status: 'done', toast: result.alreadyThere ? t(`已在 ${day} 计划里`, `Already in your ${day} plan`) : t(`已加入 ${day} 计划`, `Added to your ${day} plan`) });
    } catch (error) {
      setState({ status: 'error', message: locale === 'en' ? 'This stop could not be added. Try again.' : translateText(errorText(error), locale) });
    }
  };
  const name = title ? `${t('加入这天计划', 'Add to this day’s plan')}${locale === 'en' ? ': ' : '：'}${translateText(title, locale)}` : undefined;
  return <>
    <Button variant="tonal" className={['saves-add-day', className].filter(Boolean).join(' ')} data-compact={compact ? '' : undefined} aria-label={name}
      disabled={state.status === 'busy'} onClick={() => void add()} icon={state.status === 'done' ? <Check aria-hidden="true" strokeWidth={2} /> : <CalendarPlus aria-hidden="true" strokeWidth={1.75} />}>
      {state.status === 'done' ? t(`已加入 ${day}`, `In your ${day} plan`) : t('加入这天计划', 'Add to this day’s plan')}
    </Button>
    {state.status === 'error' && <p className="saves-add-day__error" role="alert">{state.message}</p>}
    {state.toast && <SaveToast message={state.toast} actionLabel={t('查看', 'View')} to={`/my-week#plan-${date}`} closeLabel={t('关闭提示', 'Dismiss')} onClose={() => setState(current => ({ ...current, toast: undefined }))} />}
  </>;
}
