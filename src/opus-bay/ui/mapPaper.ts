import { MAP_PAPER, type MapFrame, type PaperWidth } from '../data/mapPaper';

/**
 * Painted map loader and canvas painter (lane H2b owns this file from wave 2; plan H2b-5). The paper sits UNDER the
 * city map's vector layers (G1 keeps the coastline, streets, fog and markers on top).
 *
 *   paperWidthFor(req, phone)     the width actually shown for a requested one: phones (and tablets) stop at 2048
 *                                 (the 4096 paper decodes to 64 MB), a missing size falls back to 2048. Pure.
 *   paperUrl(width)               the file for a width (null without paper / under ?paper=0)
 *   preloadPaper(url)             fetch + decode once (cached); paperLoaded(url) says whether it is ready
 *   loadMapPaper(width)           cached Promise of the decoded image for a target pixel width (null: no paper / error)
 *   drawMapPaper(ctx, img, toPx)  canvas path: draw it under the vector layers; toPx maps world (x, z) → canvas px
 */

/**
 * Phones and tablets (they never load the 4096 paper): a phone / tablet user agent, a touch-only pointer, or a touch
 * screen no bigger than a tablet (iPadOS reports a Mac user agent with touch points).
 */
export function isPhoneLike(): boolean {
  try {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
    const mq = (q: string) => !!window.matchMedia?.(q).matches;
    if (mq('(pointer: coarse)') && !mq('(any-pointer: fine)')) return true;
    return (navigator.maxTouchPoints ?? 0) > 1 && Math.min(window.screen?.width ?? 1e4, window.screen?.height ?? 1e4) <= 1024;
  } catch {
    return false;
  }
}

export function paperWidthFor(requested: number, phone: boolean, has4096 = !!MAP_PAPER?.sizes[4096]): PaperWidth {
  const w: PaperWidth = requested > 2048 ? 4096 : requested > 1024 ? 2048 : 1024;
  return w === 4096 && (phone || !has4096) ? 2048 : w;
}

export function paperUrl(width: PaperWidth): string | null {
  if (!MAP_PAPER) return null;
  return (width === 4096 ? MAP_PAPER.sizes[4096] : width === 1024 ? MAP_PAPER.sizes[1024] : MAP_PAPER.sizes[2048]) ?? MAP_PAPER.sizes[2048];
}

const pending = new Map<string, Promise<HTMLImageElement | null>>();
const ready = new Set<string>();

export const paperLoaded = (url: string) => ready.has(url);

/** Fetch and decode a paper file once; resolves null on an error (the vector map stays). */
export function preloadPaper(url: string): Promise<HTMLImageElement | null> {
  let p = pending.get(url);
  if (!p) {
    p = new Promise<HTMLImageElement | null>(resolve => {
      if (typeof Image === 'undefined') { resolve(null); return; }
      const img = new Image();
      img.decoding = 'async';
      const done = () => { ready.add(url); resolve(img); };
      img.onload = () => { if (img.decode) img.decode().then(done, done); else done(); };
      img.onerror = () => { pending.delete(url); resolve(null); };
      img.src = url;
    });
    pending.set(url, p);
  }
  return p;
}

/** The best paper already decoded, up to `max` (the layer shows it under a sharper one that is still loading). */
export function bestLoadedPaper(max: PaperWidth): PaperWidth | null {
  for (const w of [4096, 2048, 1024] as const) {
    if (w > max) continue;
    const u = paperUrl(w);
    if (u && ready.has(u)) return w;
  }
  return null;
}

/** Decoded paper for a target pixel width (the phone cap applies). */
export function loadMapPaper(width: number): Promise<HTMLImageElement | null> {
  if (!MAP_PAPER || !(width > 0)) return Promise.resolve(null);
  const url = paperUrl(paperWidthFor(width, isPhoneLike()));
  return url ? preloadPaper(url) : Promise.resolve(null);
}

export function drawMapPaper(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, toPx: (x: number, z: number) => [number, number], frame?: MapFrame) {
  if (!img || !MAP_PAPER) return;
  const f = frame ?? MAP_PAPER.bounds;
  const [x0, y0] = toPx(f.minX, f.minZ), [x1, y1] = toPx(f.maxX, f.maxZ);
  ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0);
}
