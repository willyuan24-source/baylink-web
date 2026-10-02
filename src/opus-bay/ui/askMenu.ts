import type { Bilingual, DialogueChoice } from '../core/types';

/**
 * W9-A · the dialogue box's menus on screen (review R§6 界面与交互: "Ask 菜单 10–13 项，随位置变化，第 10 项以后没有数字热键";
 * "Esc 关不掉 BAYBAY 菜单，Space 选中第 1 项"). Pure: ui/Dialogue.tsx renders the pages and the tests read them.
 *
 *   - BAYBAY's 问 BAYBAY menu (`flow.call`, game/flow.ts openCallMenu + the lanes' registerAskItem rows) shows at most
 *     ASK_FIRST rows picked by context, then 没事，继续逛 (6 rows) and 「更多…」; the rest sit on the next page(s) with
 *     「返回」. The node's choices stay as they are (flow, the QA hooks and chooseDialogue(index) are unchanged).
 *   - Any other menu with more than MAX_ROWS choices pages the same way in its own order (the cancel row on page 1).
 *   - Every row on a page has a digit key 1…9 (≤ MAX_ROWS rows a page).
 *   - Esc / Space cancel a menu through its cancel row (the last choice that only ends the dialogue: 没事，继续逛 · 先不用 ·
 *     先不坐了 · 下次吧); a menu without one (the welcome's four ways, the week questions) cannot be cancelled.
 */

export type MenuRow = { kind: 'choice'; index: number } | { kind: 'more' } | { kind: 'back' };

/** BAYBAY's call menu (game/flow.ts openCallMenu). */
export const ASK_MENU_ID = 'flow.call';
/** choices on the call menu's first page besides the cancel row (+ 更多: "≤ 6 rows + 更多") */
export const ASK_FIRST = 5;
/** rows a page holds at most: one digit key each */
export const MAX_ROWS = 9;

export const MORE_LABEL: Bilingual = { zh: '更多…', en: 'More…' };
export const BACK_LABEL: Bilingual = { zh: '返回', en: 'Back' };

/** The menu's cancel row: the last choice that only ends the dialogue (action 'end', no next); -1 when none. */
export function cancelIndex(choices: readonly DialogueChoice[]): number {
  for (let i = choices.length - 1; i >= 0; i--) {
    const c = choices[i];
    if (c.action?.type === 'end' && !c.next) return i;
  }
  return -1;
}

/**
 * The call menu's context order (lower first): carry on with what is under way (the tour, a paused trip), the next goal,
 * a game you are standing at, the flight ticket and the lanes' new rows, around here / this week, today, the tours, the
 * small games and the map last (M opens it anyway). An ask item this table does not know (another lane's new row, e.g. 附近
 * 能玩什么) ranks 4: on page 1 while there is room.
 */
const ASK_RANK: Readonly<Record<string, number>> = {
  'n-take-me': 1, 'play-kite': 3, 'play-ball': 3, 'play-frisbee': 3, 'e-ticket': 4, 'realsf-today': 6,
  'play-skyline': 8, 'play-hide-seek': 8, 'eggs-pebbles': 8, 'play-emotes': 9, 'play-pet': 9,
};
export function askRank(c: DialogueChoice, index: number, cancel: number): number {
  const a = c.action;
  if (a?.type === 'tour-next' || (a?.type === 'end' && !c.next && index !== cancel)) return 0;
  if (c.next === 'flow.tour.skip') return 1;
  if (a?.type === 'ask') return ASK_RANK[a.id] ?? 4;
  if (c.next?.startsWith('flow.goto.')) return 2;
  if (c.next === 'flow.nearby' || a?.type === 'start-week') return 5;
  if (a?.type === 'tour-end') return 6;
  if (a?.type === 'start-tour') return 7;
  if (a?.type === 'open-map') return 9;
  return 5;
}

const rows = (ix: readonly number[]): MenuRow[] => ix.map(index => ({ kind: 'choice', index }));

/** Split `rest` into the later pages: ≤ MAX_ROWS − 2 choices + 更多 (when more remain) + 返回. */
function laterPages(rest: readonly number[]): MenuRow[][] {
  const pages: MenuRow[][] = [];
  for (let at = 0; at < rest.length;) {
    const left = rest.length - at;
    // the last page fits MAX_ROWS − 1 choices + 返回; a page with more after it, MAX_ROWS − 2 + 更多 + 返回
    const take = left <= MAX_ROWS - 1 ? left : MAX_ROWS - 2;
    const page = rows(rest.slice(at, at + take));
    at += take;
    if (at < rest.length) page.push({ kind: 'more' });
    page.push({ kind: 'back' });
    pages.push(page);
  }
  return pages;
}

/** The pages of a menu (one page when it fits). An empty list for a node without choices. */
export function menuPages(nodeId: string, choices: readonly DialogueChoice[]): MenuRow[][] {
  if (!choices.length) return [];
  const cancel = cancelIndex(choices);
  const ask = nodeId === ASK_MENU_ID;
  const all = choices.map((_, i) => i);
  const others = all.filter(i => i !== cancel);
  if (ask) others.sort((a, b) => askRank(choices[a], a, cancel) - askRank(choices[b], b, cancel) || a - b);
  const first = ask ? ASK_FIRST : MAX_ROWS - 2;
  const fits = ask ? choices.length <= ASK_FIRST + 2 : choices.length <= MAX_ROWS;
  if (fits) return [rows(ask && cancel >= 0 ? [...others, cancel] : ask ? others : all)];
  // page 1: the first rows, 更多…, then the cancel row last (where it always was)
  const page1: MenuRow[] = [...rows(others.slice(0, first)), { kind: 'more' }, ...rows(cancel >= 0 ? [cancel] : [])];
  return [page1, ...laterPages(others.slice(first))];
}
