/**
 * W7-Q3 · a lost WebGL context. iOS Safari drops a page's GL context under memory pressure, after a long time in the
 * background, and sometimes on a back / forward-cache return (an accidental edge swipe from the stick zone and back).
 * The game used to register nothing: the canvas stayed black or frozen while the DOM HUD kept working. Much of the city
 * (batched pools, canvas textures, merged cells) does not rebuild itself cleanly, so there is no in-place restore:
 *
 *   webglcontextlost   preventDefault (three does too), the save is written now (data/save.ts flushSave), and a small
 *                      card 画面需要重新加载 · 重新载入 (location.reload()) is shown over the game
 *   pageshow           a page restored from the back / forward cache (`persisted`) or a tab made visible again checks
 *                      getContext().isContextLost() — a loss may have happened while the page was frozen
 *
 * `watchGl(gl)` is called from the Canvas's onCreated in game/GameRoot.tsx (loaded lazily there: one import() line).
 * `glHealth` is read by the ?debug=1 iOS line (ui/iosDebug.ts): losses, restores, the renderer.
 * QA (DEV or production): `gl.getContext().getExtension('WEBGL_lose_context').loseContext()` shows the card.
 */
import { getLocale } from '../../i18n/locale';
import { flushSave } from '../data/save';

/** The parts of a three WebGLRenderer this module uses. */
export interface GlLike {
  domElement: HTMLCanvasElement;
  getContext(): WebGLRenderingContext | WebGL2RenderingContext;
}

export const glHealth = {
  /** webglcontextlost events seen (plus losses found by the pageshow / visibility check) */
  losses: 0,
  restores: 0,
  lost: false,
  gl: null as GlLike | null,
};

const TEXT = {
  zh: { title: '画面需要重新加载', body: '手机把游戏的图形内存收回了。进度已经保存好。', reload: '重新载入' },
  en: { title: 'The picture needs a reload', body: 'Your phone took back the game’s graphics memory. Your progress is saved.', reload: 'Reload' },
  hant: { title: '畫面需要重新載入', body: '手機把遊戲的圖形記憶體收回了。進度已經儲存好。', reload: '重新載入' },
};

let card: HTMLElement | null = null;

function showCard(doc: Document) {
  if (card || !doc?.createElement) return;
  const locale = getLocale();
  const tx = locale === 'en' ? TEXT.en : locale === 'zh-Hant' ? TEXT.hant : TEXT.zh;
  const el = doc.createElement('div');
  el.className = 'ob-gl-lost';
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-live', 'assertive');
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
  b.addEventListener('click', () => { flushSave(); location.reload(); });
  box.append(h, p, b);
  el.append(box);
  (doc.querySelector('.ob-page') ?? doc.body).append(el);
  card = el;
  try { b.focus({ preventScroll: true }); } catch { /* ignore */ }
}

/** The context is gone: save now, show the card (once). */
export function markLost(doc: Document = document) {
  glHealth.losses++;
  if (glHealth.lost) return;
  glHealth.lost = true;
  flushSave();
  showCard(doc);
}

const isLost = (gl: GlLike) => { try { return gl.getContext().isContextLost(); } catch { return false; } };

/** Watch the renderer's canvas; returns the disposer. */
export function watchGl(gl: GlLike, win: Window = window, doc: Document = document): () => void {
  glHealth.gl = gl;
  const canvas = gl.domElement;
  // R3F forces a context loss when it disposes the renderer (≈ 500 ms after the Canvas unmounts): by then the canvas
  // has left the page — that loss is not the player's, and this watch ends with it
  const gone = () => { if (canvas.isConnected !== false) return false; off(); return true; };
  const onLost = (e: Event) => { if (gone()) return; e.preventDefault(); markLost(doc); };
  const onRestored = () => { glHealth.restores++; };
  const check = () => { if (!gone() && !glHealth.lost && isLost(gl)) markLost(doc); };
  const onShow = (e: Event) => { if ((e as PageTransitionEvent).persisted) check(); };
  const onVisible = () => { if (doc.visibilityState === 'visible') check(); };
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);
  win.addEventListener('pageshow', onShow);
  doc.addEventListener('visibilitychange', onVisible);
  const off = () => {
    canvas.removeEventListener('webglcontextlost', onLost, false);
    canvas.removeEventListener('webglcontextrestored', onRestored, false);
    win.removeEventListener('pageshow', onShow);
    doc.removeEventListener('visibilitychange', onVisible);
    if (glHealth.gl === gl) glHealth.gl = null;
  };
  return off;
}

/** Tests. */
export function resetGlHealthForTests() {
  glHealth.losses = 0; glHealth.restores = 0; glHealth.lost = false; glHealth.gl = null;
  card?.remove?.(); card = null;
}
