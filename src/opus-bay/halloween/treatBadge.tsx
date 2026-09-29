import { useSyncExternalStore } from 'react';
import { useT } from '../i18n';
import { isPaid, ledgerVersion, subscribeLedger } from '../economy/ledger';
import { halloweenPhase } from './season';
import { candyCount, doorsDressed } from './treat';

/**
 * Wave 6 · lane G (W6-G2) · the candy bag in the top-right pill (ui/slots registerPillBadge), next to the coins: `🍬 7`.
 * Shown while the doors are dressed (the season and the big night), and after it while the bag is not empty (until the
 * season ends). It follows the ledger (a Settings reset empties it). Styles: the coin badge's (economy/economy.css).
 */
export function CandyBadge() {
  const { t } = useT();
  useSyncExternalStore(subscribeLedger, ledgerVersion, ledgerVersion);
  const phase = halloweenPhase();
  const bag = candyCount(isPaid);
  if (phase === 'off' || (!doorsDressed(phase) && bag === 0)) return null;
  return (
    <span className="ob-coin-badge" aria-label={t(`糖果袋 ${bag} 颗`, `Candy bag: ${bag}`)} title={t('糖果袋', 'Candy bag')}>
      <span className="ob-coin-glyph" aria-hidden>🍬</span>
      <span className="ob-coin-count" aria-hidden>{bag > 999 ? '999+' : bag}</span>
    </span>
  );
}
