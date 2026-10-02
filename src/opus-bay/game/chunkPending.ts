/**
 * W9-P4 (w8 NEXT #11, the W8 review's P-RP-5) · a part the player asked for is being loaded again.
 *
 * A panel / card / game chunk whose first load failed is retried by game/importRetry.ts for up to 1 + 3 + 8 s; until now
 * the player saw nothing at all in that time (M pressed, no map), then — lost for good — the reload card. While at least
 * one such retry runs that somebody waits for (`retryingLoud() > 0`; a quiet prefetch never counts), a small pill at the
 * top of the screen says 还在加载… / Still loading…; it goes the moment the part lands, or the reload card
 * (game/chunkLost.ts) takes over. Plain DOM in the page's chunk (OpusBayPage installs it): nothing in GameRoot's.
 */
import { getLocale } from '../../i18n/locale';
import { onRetrying } from './importRetry';

const TEXT = { zh: '还在加载，稍等一下…', hant: '還在載入，稍等一下…', en: 'Still loading — one moment…' };

type Doc = Pick<Document, 'createElement'> & { querySelector(s: string): Element | null; body: HTMLElement };

/** Install the pill (once per page); returns the uninstall. */
export function initChunkPending(doc: Doc | null = typeof document !== 'undefined' ? document : null): () => void {
  if (!doc?.createElement) return () => {};
  let pill: HTMLElement | null = null;
  const show = () => {
    if (pill) return;
    const loc = getLocale();
    const el = doc.createElement('div');
    el.className = 'ob-chunk-pending';
    el.setAttribute('role', 'status');
    el.textContent = loc === 'en' ? TEXT.en : loc === 'zh-Hant' ? TEXT.hant : TEXT.zh;
    Object.assign(el.style, {
      position: 'fixed', top: 'calc(12px + env(safe-area-inset-top, 0px))', left: '50%', transform: 'translateX(-50%)', zIndex: '60',
      padding: '8px 16px', borderRadius: '999px', background: 'rgba(255, 250, 241, .96)', color: '#1f5f59', fontWeight: '700', fontSize: '14px', lineHeight: '1.3',
      boxShadow: '0 4px 14px rgba(40, 30, 20, .18)', pointerEvents: 'none',
    });
    (doc.querySelector('.ob-page') ?? doc.body).append(el);
    pill = el;
  };
  const hide = () => { pill?.remove(); pill = null; };
  const off = onRetrying(n => { if (n > 0) show(); else hide(); });
  return () => { off(); hide(); };
}
