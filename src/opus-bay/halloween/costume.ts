import { emit } from '../core/events';
import type { WearSlot } from '../data/playSave';
import { setSeasonGate, type ItemDef } from '../economy/items';
import { isPaid, subscribeLedger } from '../economy/ledger';
import { owns, wornItem } from '../economy/wallet';
import { hLine } from './lines';
import { halloweenSource } from './rewards';
import { inHalloween } from './season';
import { sayLine } from './treatRun';

/**
 * Wave 6 · lane G (W6-G3) · the Halloween costumes in the 小铺 (economy/items.ts, `season: 'halloween'`): BAYBAY's witch
 * hat and pumpkin head, the player's cat ears and ghost sheet.
 *
 * - On sale only in the season (1 Oct – 2 Nov, halloween/season.ts `inHalloween`, `?halloween=` previews too); owned ones
 *   stay on their shelf and wearable all year (the gate: economy/items.ts setSeasonGate).
 * - Try-on works like every item (the shop's preview on the real bodies); bought with coins.
 * - Putting one on (the ledger's wear): `{ type: 'halloween', what: 'costume', id }` (taking it off: id ''), BAYBAY's line
 *   for it (once a session each), and the first costume of the save pays `halloween:costume:first` (COSTUME_FIRST_COINS).
 */

export const COSTUME_FIRST_COINS = 10;
const SLOTS: readonly WearSlot[] = ['baybay-hat', 'player-hat', 'pelican'];
const LINE: Readonly<Record<string, string>> = { 'witch-hat': 'w6g-costume-witch', 'pumpkin-head': 'w6g-costume-pumpkin', 'cat-ears': 'w6g-costume-cat', 'ghost-sheet': 'w6g-costume-ghost', 'bat-wings': 'w7g-costume-bat-wings', 'pumpkin-bow': 'w8h-costume-pumpkin-bow' };
const FIRST = halloweenSource('costume:first');

const costumeIn = (slot: WearSlot): ItemDef | null => { const it = wornItem(slot); return it?.costume ? it : null; };

export function initCostumes(): () => void {
  const offGate = setSeasonGate({
    onSale: it => it.season === 'halloween' && inHalloween(),
    shown: it => it.season === 'halloween' && (inHalloween() || owns(it.id)),
  });
  const worn = new Map<WearSlot, string>(SLOTS.map(s => [s, costumeIn(s)?.id ?? '']));
  const said = new Set<string>();
  const timers: ReturnType<typeof setTimeout>[] = [];
  const offLedger = subscribeLedger(() => {
    for (const slot of SLOTS) {
      const it = costumeIn(slot);
      const id = it?.id ?? '';
      if (worn.get(slot) === id) continue;
      worn.set(slot, id);
      emit({ type: 'halloween', what: 'costume', id });
      if (!it?.costume) continue;
      const first = !isPaid(FIRST);
      const line = LINE[it.costume];
      if (!first && said.has(it.id)) continue;
      said.add(it.id);
      // after the shop's own "worn" reaction
      timers.push(setTimeout(() => {
        if (first) emit({ type: 'reward', source: FIRST, coins: COSTUME_FIRST_COINS });
        if (line) sayLine(line);
        if (first) timers.push(setTimeout(() => sayLine('w6g-costume-first'), (line ? Math.max(2600, 2000 + 70 * [...hLine(line).zh].length) : 0) + 250));
      }, 1400));
    }
  });
  return () => { offLedger(); offGate(); for (const t of timers) clearTimeout(t); };
}
