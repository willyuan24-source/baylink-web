import { useState, useSyncExternalStore } from 'react';
import { Ghost, X } from 'lucide-react';
import type { HalloweenPostcard } from '../data/sf/halloweenPostcards';
import { isPaid, ledgerVersion, subscribeLedger } from '../economy/ledger';
import { useT } from '../i18n';
import { HALLOWEEN_CARD_GATES, HALLOWEEN_CARD_ORDER, halloweenCardCount } from './playPostcards';
import './halloween.css';

/**
 * Wave 7 · lane G (W7-G1) · the 万圣节明信片 row: the four Halloween postcards, earned ones as pictures (tap for the big
 * one), the others as blanks with how to earn them. Shown on the 万圣节 page (in the season) and in the notebook's
 * 发现 page (economy/Notebook.tsx), which keeps it after 2 November when the 万圣节 tab goes away. Reads the ledger.
 */
export function HalloweenPostcardGrid({ where }: { where: 'page' | 'notebook' }) {
  const { t } = useT();
  useSyncExternalStore(subscribeLedger, ledgerVersion, ledgerVersion);
  const [big, setBig] = useState<HalloweenPostcard | null>(null);
  const got = halloweenCardCount(isPaid);
  return (
    <section className={where === 'notebook' ? 'ob-block ob-hw-cards-block' : 'ob-hw-cards-block'}>
      <h3 className={where === 'notebook' ? 'ob-h3' : 'ob-hw-h'}><Ghost size={15} aria-hidden />{t('万圣节明信片', 'Halloween postcards')}<small className="ob-nb-h-count">{got}/{HALLOWEEN_CARD_ORDER.length}</small></h3>
      <ul className="ob-nb-cards ob-hw-cards">
        {HALLOWEEN_CARD_ORDER.map((pc, i) => {
          const gate = HALLOWEEN_CARD_GATES[i];
          const on = gate.earned(isPaid);
          return (
            <li key={pc.id} className={on ? 'is-on' : ''}>
              {on ? (
                <button type="button" className="ob-nb-card" onClick={() => setBig(pc)} aria-label={t(pc.title)}>
                  <img src={pc.small} alt={t(pc.alt)} width={600} height={450} loading="lazy" decoding="async" />
                </button>
              ) : (
                <span className="ob-nb-card is-blank" aria-hidden><Ghost size={20} /></span>
              )}
              <span className="ob-nb-cap">{on ? t(pc.title) : t(gate.how)}</span>
            </li>
          );
        })}
      </ul>
      {big && (
        <div className="ob-nb-big" role="dialog" aria-modal="false" aria-label={t(big.title)}>
          <img src={big.large} alt={t(big.alt)} width={1200} height={900} decoding="async" />
          <div className="ob-nb-big-foot">
            <strong>{t(big.title)}</strong>
            <button type="button" className="ob-icon-btn" onClick={() => setBig(null)} aria-label={t('关闭', 'Close')}><X size={18} aria-hidden /></button>
          </div>
        </div>
      )}
    </section>
  );
}
