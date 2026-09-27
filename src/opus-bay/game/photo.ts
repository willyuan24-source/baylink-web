import { emit } from '../core/events';
import { flow } from './flowStore';

/**
 * Photo mode capture. The WebGL canvas does not preserve its drawing buffer, so the shutter only raises a
 * flag; the Canvas-side system copies the frame in a microtask right after R3F renders it (same task,
 * before compositing), then frames it as a small polaroid and saves a PNG.
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
  ctx.fillStyle = '#22322f';
  ctx.font = `700 ${fontSize}px "Noto Sans SC", "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(caption, pad, h + pad + band / 2);
  ctx.font = `600 ${Math.round(fontSize * 0.7)}px "Plus Jakarta Sans", "Noto Sans SC", system-ui, sans-serif`;
  ctx.fillStyle = '#2f8f88';
  const stampWidth = ctx.measureText(stamp).width;
  ctx.fillText(stamp, out.width - pad - stampWidth, h + pad + band / 2);
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

export function downloadUrl(url: string, name: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
