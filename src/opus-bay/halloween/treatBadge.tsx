import { useSyncExternalStore } from 'react';
import { useT } from '../i18n';
import { isPaid, ledgerVersion, subscribeLedger } from '../economy/ledger';
import { halloweenPhase } from './season';
import { candyCount, doorsDressed } from './treat';
import { onTreatNear, treatNear } from './treatNear';

/**
 * Wave 6 · lane G (W6-G2) · the candy bag in the top-right pill (ui/slots registerPillBadge), next to the coins: `🍬 7`.
 * Shown while the doors are dressed (the season and the big night), and after it while the bag is not empty (until the
 * season ends). It follows the ledger (a Settings reset empties it). Styles: the coin badge's (economy/economy.css).
 *
 * Phones (W6-G-review): the pill's badges ride on its goals line (ui/Hud.tsx `badgesBelow`, W5-F9: the pill keeps two
 * lines); a third badge overflowed it into a third line that began with a dangling "·". On a phone the bag now shows
 * only near a trick-or-treat street (treatRun.ts: a street built round the player), and there on a line of its own
 * without the separator (treatNear.ts CANDY_PHONE_CSS, injected by play.ts); the 万圣节 page and each treat's toast always show it.
 */

export function CandyBadge() {
  const { t } = useT();
  useSyncExternalStore(subscribeLedger, ledgerVersion, ledgerVersion);
  const close = useSyncExternalStore(onTreatNear, treatNear, treatNear);
  const phase = halloweenPhase();
  const bag = candyCount(isPaid);
  if (phase === 'off' || (!doorsDressed(phase) && bag === 0)) return null;
  return (
    <span className="ob-coin-badge ob-candy" data-far={close ? undefined : ''} aria-label={t(`糖果袋 ${bag} 颗`, `Candy bag: ${bag}`)} title={t('糖果袋', 'Candy bag')}>
      <span className="ob-coin-glyph" aria-hidden>🍬</span>
      <span className="ob-coin-count" aria-hidden>{bag > 999 ? '999+' : bag}</span>
    </span>
  );
}
