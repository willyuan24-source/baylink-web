import { Gamepad2 } from 'lucide-react';
import { onEvent } from '../core/events';
import { isPaid, pay, playState } from '../economy/ledger';
import { importRetry } from '../game/importRetry';
import { DEX_GAMES, dexPlayed } from '../ui/playDexData';
import { openJournal, registerAskItem, registerJournalTab } from '../ui/slots';
import { TODAY_COINS, todaySource } from './kit';

/**
 * Wave 9 · lane G · W9-G1 · the ways into the 游乐图鉴 (review 2026-10-01 R§5 #13): the journal's 游乐 tab (its body is
 * ui/PlayDex.tsx, loaded on first show) between 万圣节 (8) and 明信片 (10), counting the games played; and 问 BAYBAY →
 * 附近能玩什么？, which opens the tab on its 离你最近 block (the three nearest games, each with 带我去). play/index.ts loads
 * this chunk at init (city mode only).
 *
 * W9-G4 · 今日小游戏: the first mini-game finished each Bay day pays TODAY_COINS (play/kit.ts todaySource: the ledger's
 * `daily:<date>:4`, paid once a date) — on the kit's `play` end event, so its result card counts it.
 */

export const DEX_TAB = 'games';
export const DEX_ASK = 'play-dex-near';
/**
 * (W9-G-review G-RV-1) `play` end events that are not mini-games: 摸摸 (play/pet.ts) and a finished 看风景 sit
 * (play/sit.ts) emit one too — they must not take the day's 今日小游戏 coins (silently, with no card).
 */
export const NOT_GAMES: ReadonlySet<string> = new Set(['pet', 'sit', 'view']);

/** The tab's count: games played of all. */
export function dexCount(): string {
  const p = playState(), b = p.b ?? {};
  return `${DEX_GAMES.filter(g => dexPlayed(g, b, isPaid)).length}/${DEX_GAMES.length}`;
}

export function initDex(): () => void {
  const offTab = registerJournalTab({
    id: DEX_TAB, order: 9, label: { zh: '游乐', en: 'Play' }, icon: Gamepad2, count: dexCount,
    load: () => importRetry(() => import('../ui/PlayDex')),
  });
  const offAsk = registerAskItem({
    id: DEX_ASK, order: -16, label: { zh: '附近能玩什么？', en: 'What can I play nearby?' }, icon: Gamepad2,
    onSelect: () => { openJournal(DEX_TAB); },
  });
  const offToday = onEvent(e => {
    if (e.type === 'play' && e.what === 'end' && !NOT_GAMES.has(e.activity) && !isPaid(todaySource())) pay(todaySource(), TODAY_COINS);
  });
  return () => { offTab(); offAsk(); offToday(); };
}
