import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { getLocale } from '../../i18n/locale';
import { game, toast } from '../core/store';
import { pick } from '../i18n';
import { flow } from './flowStore';
import { decorateFrame, photoTags } from './photoFrames';

/**
 * Photo mode capture. The WebGL canvas does not preserve its drawing buffer, so the shutter only raises a
 * flag; the Canvas-side system copies the frame in a microtask right after R3F renders it (same task,
 * before compositing), then frames it as a small polaroid and saves a PNG. Wave 5: the frame decorators of
 * game/photoFrames.ts (`registerFrameDecorator`, lane E's frames) paint on the finished card before it is saved.
 * Wave 5 · W5-C7: in the city the card goes into the album on this device (game/album.ts, lazy: a JPEG and a
 * thumbnail, the shot's tags from photoFrames registerPhotoTagger) instead of a forced download — the owner's phone
 * asked "download?" at every picture; district mode still downloads the PNG, as before.
 */

let requested: null | { caption: string; stamp: string } = null;

export function requestShutter(caption: string, stamp: string) {
  requested = { caption, stamp };
  emit({ type: 'shutter' });
  flow.set(s => ({ photoFlash: s.photoFlash + 1 }));
}

/** Call from useFrame: schedules the copy right after this frame renders. */
export function consumeShutter(canvas: HTMLCanvasElement) {
  if (!requested) return;
  const job = requested;
  requested = null;
  queueMicrotask(() => {
    try { compose(canvas, job.caption, job.stamp); } catch (error) { if (import.meta.env?.DEV) console.warn('[opus-bay photo]', error); }
  });
}

function compose(source: HTMLCanvasElement, caption: string, stamp: string) {
  const maxW = 1800;
  const scale = Math.min(1, maxW / source.width);
  const w = Math.round(source.width * scale), h = Math.round(source.height * scale);
  const pad = Math.round(Math.max(18, w * 0.028));
  const band = Math.round(Math.max(70, h * 0.12));
  const out = document.createElement('canvas');
  out.width = w + pad * 2;
  out.height = h + pad + band;
  const ctx = out.getContext('2d');
  if (!ctx) return;
  // Copy the WebGL frame first (must happen in this task).
  ctx.fillStyle = '#fffaf1';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, pad, pad, w, h);
  ctx.strokeStyle = 'rgba(80, 60, 30, .12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(pad, pad, w, h);
  const fontSize = Math.round(band * 0.3);
  const stampFont = `600 ${Math.round(fontSize * 0.7)}px "Plus Jakarta Sans", "Noto Sans SC", system-ui, sans-serif`;
  ctx.font = stampFont;
  const stampWidth = ctx.measureText(stamp).width;
  // W5-C7: a portrait phone card is narrow — the caption shrinks (then ends with …) so it never runs into the stamp;
  // a caption that fits is drawn exactly as before
  const fit = fitCaption(ctx, caption, fontSize, out.width - pad * 3 - stampWidth);
  ctx.fillStyle = '#22322f';
  ctx.font = `700 ${fit.size}px "Noto Sans SC", "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(fit.text, pad, h + pad + band / 2);
  ctx.font = stampFont;
  ctx.fillStyle = '#2f8f88';
  ctx.fillText(stamp, out.width - pad - stampWidth, h + pad + band / 2);
  // wave 5 (W5-C1): the registered frame decorators paint on the finished card (lane E's shop frames)
  decorateFrame({ ctx, width: out.width, height: out.height, photo: { x: pad, y: pad, w, h }, band: { x: 0, y: h + pad, w: out.width, h: band }, pad, caption, stamp, at: new Date() });
  if (game.get().worldMode === 'city') { keepInAlbum(out, caption, stamp); return; }
  out.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const name = `opus-bay-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    const previous = flow.get().lastPhoto;
    if (previous) URL.revokeObjectURL(previous.url);
    flow.set({ lastPhoto: { url, name } });
    downloadUrl(url, name);
  }, 'image/png');
}

/** the album's thumbnail width (px): ≈ 20–40 KB as a JPEG */
export const THUMB_W = 360;
let albumToldOnce = false;

/** City: the card (JPEG .92) and a thumbnail into the album; the thumb in photo mode opens it. */
function keepInAlbum(card: HTMLCanvasElement, caption: string, stamp: string) {
  const at = Date.now(), p = runtime.player, area = game.get().area ?? '';
  const tags = photoTags({ x: p.x, z: p.z, area, at: new Date(at) });
  const tw = Math.min(THUMB_W, card.width), th = Math.round((card.height * tw) / card.width);
  const small = document.createElement('canvas');
  small.width = tw; small.height = th;
  small.getContext('2d')?.drawImage(card, 0, 0, tw, th);
  const jpeg = (c: HTMLCanvasElement, q: number) => new Promise<Blob | null>(resolve => c.toBlob(resolve, 'image/jpeg', q));
  void Promise.all([jpeg(card, 0.92), jpeg(small, 0.8)]).then(async ([full, thumb]) => {
    if (!full || !thumb) return;
    const url = URL.createObjectURL(full);
    const previous = flow.get().lastPhoto;
    if (previous) URL.revokeObjectURL(previous.url);
    const album = await import('./album').catch(() => null);
    const id = album ? await album.addPhoto(full, thumb, { at, caption, stamp, w: card.width, h: card.height, x: p.x, z: p.z, area, tags }) : null;
    // (no album — the chunk failed to load, nothing could be kept —: the download, as before)
    if (!id) { const name = `opus-bay-${new Date(at).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`; flow.set({ lastPhoto: { url, name } }); downloadUrl(url, name); return; }
    flow.set({ lastPhoto: { url, name: id, album: true } });
    const first = !albumToldOnce;
    albumToldOnce = true;
    toast(pick(first ? { zh: '已存进相册 · 点缩略图就能看', en: 'Saved to your album · tap the thumbnail to see it' } : { zh: '已存进相册', en: 'Saved to your album' }, getLocale()), 'info', first ? 3200 : 1800);
  });
}

/**
 * The caption's size and text for `room` px (the caption font at `size`): as it is when it fits; else the size shrunk
 * to fit (not below half); else, at half size, the text cut and ended with … .
 */
export function fitCaption(ctx: Pick<CanvasRenderingContext2D, 'font' | 'measureText'>, text: string, size: number, room: number): { size: number; text: string } {
  const width = (s: number, t: string) => { ctx.font = `700 ${s}px "Noto Sans SC", "Plus Jakarta Sans", system-ui, sans-serif`; return ctx.measureText(t).width; };
  const full = width(size, text);
  if (full <= room || room <= 0) return { size, text };
  const smaller = Math.max(Math.round(size / 2), Math.floor((size * room) / full));
  if (width(smaller, text) <= room) return { size: smaller, text };
  const chars = [...text];
  while (chars.length > 1 && width(smaller, `${chars.join('')}…`) > room) chars.pop();
  return { size: smaller, text: `${chars.join('').trimEnd()}…` };
}

export function downloadUrl(url: string, name: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
