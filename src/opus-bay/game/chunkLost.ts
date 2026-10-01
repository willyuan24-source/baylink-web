/**
 * W8-P5 · a part of the game that could not be loaded (lane P; sf-w8-lead.md §3 row P item 3).
 *
 * `game/importRetry.ts` fetches a lost lazy chunk again (1 s, 3 s, 8 s, under a new URL). When it is still lost after
 * that — the network is down, a deploy replaced the files, or one of the chunk's *shared dependencies* was the file
 * lost (Chrome then keeps that dependency's URL failed for the page's life: nothing short of a reload brings it back) —
 * the part the player asked for silently never came (a game panel, a ride, the map, BAYBAY's voice …). This card
 * says so once per page, over the game, in the GL-lost card's style (ui/glHealth.ts, the `.ob-gl-lost` classes of
 * opus-bay.css, always loaded): 有一部分没加载好 · 重新载入 (the save is written first) · 先继续玩 (closes the card).
 *
 * It is in GameRoot's chunk on purpose: when chunks are being lost, a card in a chunk of its own could be lost too.
 * GameRoot calls `initChunkLostCard()` once. QA: `window.__opusBay`-free — `showChunkLostCard()` from a test.
 */
import { getLocale } from '../../i18n/locale';
import { flushSave } from '../data/save';
import { onChunkLost } from './importRetry';

export const CHUNK_LOST_TEXT = {
  zh: { title: '有一部分没加载好', body: '网络不太稳，游戏的一部分没能下载下来。进度已经保存好，重新载入就好了。', reload: '重新载入', later: '先继续玩' },
  en: { title: 'Part of the game didn’t load', body: 'The connection dropped while a part of the game was downloading. Your progress is saved — a reload brings it back.', reload: 'Reload', later: 'Keep playing' },
  hant: { title: '有一部分沒載入好', body: '網路不太穩，遊戲的一部分沒能下載下來。進度已經儲存好，重新載入就好了。', reload: '重新載入', later: '先繼續玩' },
} as const;

let card: HTMLElement | null = null;
let shown = false;

/** Show the card (once per page; a closed card stays closed). Returns whether it was shown now. */
export function showChunkLostCard(doc: Document = document, reload: () => void = () => { location.reload(); }): boolean {
  if (shown || !doc?.createElement) return false;
  shown = true;
  const locale = getLocale();
  const tx = locale === 'en' ? CHUNK_LOST_TEXT.en : locale === 'zh-Hant' ? CHUNK_LOST_TEXT.hant : CHUNK_LOST_TEXT.zh;
  const el = doc.createElement('div');
  el.className = 'ob-gl-lost ob-chunk-lost';
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-live', 'assertive');
  el.tabIndex = -1;
  const box = doc.createElement('div');
  box.className = 'ob-gl-lost-card';
  const h = doc.createElement('p');
  h.className = 'ob-gl-lost-title';
  h.textContent = tx.title;
  const p = doc.createElement('p');
  p.className = 'ob-gl-lost-body';
  p.textContent = tx.body;
  const b = doc.createElement('button');
  b.type = 'button';
  b.className = 'ob-btn ob-btn-primary ob-gl-lost-btn';
  b.textContent = tx.reload;
  b.addEventListener('click', () => { flushSave(); reload(); });
  const later = doc.createElement('button');
  later.type = 'button';
  later.className = 'ob-btn ob-btn-ghost ob-gl-lost-btn';
  later.textContent = tx.later;
  later.addEventListener('click', () => { el.remove(); card = null; });
  box.append(h, p, b, later);
  el.append(box);
  (doc.querySelector('.ob-page') ?? doc.body).append(el);
  card = el;
  // (W8-P-review, P-RC-3) the card takes focus, not 重新载入: the game runs on under it, and core/input.ts leaves Space /
  // Enter on a focused button to the button — a jump or an interact pressed after the card appeared reloaded the page
  try { el.focus({ preventScroll: true }); } catch { /* ignore */ }
  return true;
}

/** GameRoot: show the card when a chunk is lost for good (importRetry's listeners). Returns the unsubscribe. */
export function initChunkLostCard(): () => void {
  return onChunkLost(() => { showChunkLostCard(); });
}

/** Tests. */
export function resetChunkLostForTests() { card?.remove?.(); card = null; shown = false; }
export const chunkLostCard = (): HTMLElement | null => card;
