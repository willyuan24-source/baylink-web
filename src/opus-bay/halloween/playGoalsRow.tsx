import { useSyncExternalStore } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { isPaid, ledgerVersion, subscribeLedger } from '../economy/ledger';
import { useT } from '../i18n';
import { openJournal } from '../ui/slots';
import { halloweenGoals } from './progress';

/**
 * Wave 7 · lane G (W7-G8) · the Halloween block of the journal's 目标 tab in the city (ui/slots registerGoalsRow, shown in
 * the season by halloween/play.ts; the city's goals live there — the pill opens it): 万圣节目标 n/3, the three goals
 * with their counts, and 去万圣节页 (the streets, the lanterns, the postcards). The tab's own look (ob-block, ob-goals).
 */
export function HalloweenGoalsRow() {
  const { t } = useT();
  useSyncExternalStore(subscribeLedger, ledgerVersion, ledgerVersion);
  const goals = halloweenGoals(isPaid);
  const done = goals.filter(g => g.have >= g.need).length;
  return (
    <section className="ob-block ob-hw-goals-block">
      <h3 className="ob-h3"><span aria-hidden>🎃</span>{t('万圣节目标', 'Halloween goals')} · {done}/{goals.length}</h3>
      <ul className="ob-goals">
        {goals.map(g => {
          const ok = g.have >= g.need;
          return (
            <li key={g.id} className={ok ? 'is-done' : ''}>
              <span className="ob-check">{ok && <Check size={13} aria-hidden />}</span>
              <div><strong>{t(g.text)}{g.need > 1 && ` · ${g.have}/${g.need}`}</strong></div>
            </li>
          );
        })}
      </ul>
      <button type="button" className="ob-btn ob-btn-soft ob-btn-sm" onClick={() => openJournal('halloween')}>{t('万圣节页：讨糖街、南瓜灯、明信片', 'Halloween page: streets, lanterns, postcards')}<ChevronRight size={14} aria-hidden /></button>
    </section>
  );
}
