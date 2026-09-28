import { useEffect, useState, useSyncExternalStore } from 'react';
import { onEvent } from '../core/events';
import { useT } from '../i18n';
import { formatCoins } from './format';
import { coinsTotal, ledgerVersion, subscribeLedger } from './ledger';

/**
 * Wave 5 · lane E · W5-E4: the coin count in the top-right pill (ui/slots registerPillBadge): `明信片 3/24 · 🪙 42`.
 * At most 6 characters (the slot's rule): 42 · 999 · 1.2k · 12k · 123k. A pickup gives it a short warm pulse (none with
 * reduced motion); no toast per coin. The count follows the ledger (a Settings reset puts it back to 0). Styles:
 * economy/economy.css (loaded by economy/index.ts init, so that node can load this module).
 */

export function CoinBadge() {
  const { t } = useT();
  useSyncExternalStore(subscribeLedger, ledgerVersion, ledgerVersion);
  const total = coinsTotal();
  const [pulse, setPulse] = useState(0);
  useEffect(() => onEvent(e => { if (e.type === 'coins' && e.delta > 0) setPulse(p => p + 1); }), []);
  return (
    <span className="ob-coin-badge" data-pulse={pulse ? '' : undefined} key={pulse} aria-label={t(`金币 ${total}`, `${total} coins`)} title={t('金币', 'Coins')}>
      <span className="ob-coin-glyph" aria-hidden>🪙</span>
      <span className="ob-coin-count" aria-hidden>{formatCoins(total)}</span>
    </span>
  );
}
