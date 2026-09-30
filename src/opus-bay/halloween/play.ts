import { createElement } from 'react';
import { isPaid } from '../economy/ledger';
import { openJournal, registerGoalsRow, registerJournalTab, registerPillBadge } from '../ui/slots';
import { HalloweenGoalsRow } from './playGoalsRow';
import { initCostumes } from './costume';
import { initHalloweenPostcards } from './playPostcardRun';
import { goalsDoneText } from './progress';
import { inHalloween } from './season';
import { CandyBadge } from './treatBadge';
import { injectCandyCss } from './treatNear';
import { initTreat } from './treatRun';

const PumpkinIcon = () => createElement('span', { 'aria-hidden': true, style: { fontSize: 15, lineHeight: 1 } }, '🎃');

/**
 * Wave 6 · lane G · the Halloween games (started by halloween/index.ts, city mode only, after the economy):
 *
 *   trick-or-treat   halloween/treatRun.ts — the decorated doors on six real trick-or-treat streets (treatStreets.ts,
 *                    treatDoors.ts), the 敲门 / Knock prompt, treats → coins (`halloween:door:<n>` / `night:<n>`), the
 *                    candy bag (treatBadge.tsx), BAYBAY's lines (lines.ts)
 *   costumes         halloween/costume.ts — the 小铺's witch hat, pumpkin head, cat ears and ghost sheet (economy/items.ts,
 *                    sold in season only), costume:first, BAYBAY's reactions
 *   the 万圣节 page   halloween/HalloweenPage.tsx — a Journal tab in the season: the three goals (progress.ts), the
 *                    candy bag and the streets (带我去), the pumpkins found, the costumes
 *
 *   postcards        halloween/playPostcardRun.ts (W7-G1) — the four Halloween postcards at their moments (playPostcards.ts
 *                    gates on the ledger; the `h-postcard` overlay), kept in the notebook after the season
 *
 * DEV / QA: `__opusBay.g` — `knock(n)` knocks on door n from anywhere, `look(n, out)` stands in front of it, `page()` opens the 万圣节 page, `stats()` (phase, built streets, triangles, the
 * door answering, the bag), `card(id)` opens a Halloween postcard as if just earned, `cards()` the ones waiting.
 */
export function initHalloweenPlay(): () => void {
  const treat = initTreat();
  // W7-G1: the four Halloween postcards at their moments (the ledger's gates; the `h-postcard` overlay)
  const cards = initHalloweenPostcards();
  const offs: (() => void)[] = [treat.off, cards.off, registerPillBadge({ id: 'g-candy', order: 11, Component: CandyBadge }), injectCandyCss(), initCostumes()];
  // the 万圣节 page: a Journal tab while the season lasts (after 手帐 7, before 明信片 10)
  let offTab: (() => void) | null = null;
  // W7-G8: and a Halloween block in the journal's 目标 tab (the city's goals) while the season lasts
  let offRow: (() => void) | null = null;
  const tab = () => {
    const want = inHalloween();
    if (want && !offTab) offTab = registerJournalTab({ id: 'halloween', order: 8, label: { zh: '万圣节', en: 'Halloween' }, icon: PumpkinIcon, count: () => goalsDoneText(isPaid), load: () => import('./HalloweenPage') });
    else if (!want && offTab) { offTab(); offTab = null; }
    if (want && !offRow) offRow = registerGoalsRow({ id: 'g-halloween', order: 10, Component: HalloweenGoalsRow });
    else if (!want && offRow) { offRow(); offRow = null; }
  };
  tab();
  const tabTimer = setInterval(tab, 30_000);
  offs.push(() => { clearInterval(tabTimer); offTab?.(); offTab = null; offRow?.(); offRow = null; });
  if (typeof window !== 'undefined' && (import.meta.env?.DEV || import.meta.env?.VITE_OPUS_QA === '1')) {
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    w.__opusBay = { ...(w.__opusBay ?? {}), g: { knock: treat.knock, look: treat.look, stats: treat.stats, page: () => openJournal('halloween'), card: cards.show, cards: cards.pending } };
  }
  return () => { for (const off of offs.splice(0).reverse()) off(); };
}
