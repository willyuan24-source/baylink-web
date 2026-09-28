import type { FrameCanvas } from '../game/photoFrames';
import type { FrameKind } from './items';

/**
 * Wave 5 · lane E · W5-E7: the photo frames (雾 · 夜 for sale, 金色时刻 and 邮戳 earned with notebook pages), painted on
 * the polaroid by lane C's frame hook (game/photoFrames.ts registerFrameDecorator; economy/wear.ts registers ours).
 *
 * Every frame paints only the card's border ring — the outer `t` of the card, clipped even-odd — so the photo, the
 * caption and the stamp in the band are never covered: t ≤ 60 % of the margin and ≤ 25 % of the band (the caption sits
 * in the band's middle third). Pure canvas 2D; the shop tiles draw a small card with the same code (drawPreview).
 */

/** The ring's thickness on a card. */
export const ringWidth = (f: Pick<FrameCanvas, 'pad' | 'band'>): number => Math.max(4, Math.min(f.pad * 0.6, f.band.h * 0.25));

function clipRing(f: FrameCanvas, t: number) {
  const { ctx, width: W, height: H } = f;
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.rect(t, t, W - 2 * t, H - 2 * t);
  ctx.clip('evenodd');
}

/** A 4-point twinkle. */
function twinkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

/** A seeded 0..1 sequence (the same frame looks the same on every photo). */
function seq(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

export function drawFrame(kind: FrameKind, f: FrameCanvas): void {
  const { ctx, width: W, height: H } = f;
  const t = ringWidth(f);
  ctx.save();
  clipRing(f, t);
  if (kind === 'fog') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#e6ecee'); g.addColorStop(1, '#b7c3c8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Karl rolling over the top edge: soft puffs
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    const r = seq(7);
    for (let x = -t; x < W + t; x += t * 1.6) {
      ctx.beginPath(); ctx.ellipse(x + r() * t * 0.6, t * (0.35 + r() * 0.3), t * (0.9 + r() * 0.5), t * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let y = t * 2; y < H - t; y += t * 2.2) {
      ctx.beginPath(); ctx.ellipse(t * 0.3, y + r() * t, t * 0.7, t * 1.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(W - t * 0.3, y + r() * t, t * 0.7, t * 1.1, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === 'golden') {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#f7d27a'); g.addColorStop(0.55, '#eea653'); g.addColorStop(1, '#d9773a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // sun rays from the top-left corner, a low sun
    ctx.strokeStyle = 'rgba(255, 244, 214, 0.55)';
    ctx.lineWidth = Math.max(1, t * 0.12);
    for (let a = 0; a < Math.PI / 2; a += Math.PI / 14) {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * W, Math.sin(a) * W); ctx.stroke();
    }
    ctx.fillStyle = '#fff1c7';
    ctx.beginPath(); ctx.arc(t * 0.55, t * 0.55, t * 0.42, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'night') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1d2742'); g.addColorStop(1, '#2d3d66');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const r = seq(23);
    ctx.fillStyle = '#f8e7a1';
    const n = Math.round((W + H) / (t * 1.3));
    for (let i = 0; i < n; i++) {
      // round the ring: a point on the perimeter, then inside the ring's width
      const u = r() * (2 * W + 2 * H), d = t * (0.2 + r() * 0.6), s = t * (0.08 + r() * 0.14);
      const [x, y] = u < W ? [u, d] : u < W + H ? [W - d, u - W] : u < 2 * W + H ? [2 * W + H - u, H - d] : [d, 2 * W + 2 * H - u];
      twinkle(ctx, x, y, s);
    }
    // a crescent moon in the top-right corner
    ctx.fillStyle = '#fbf0c4';
    ctx.beginPath(); ctx.arc(W - t * 0.5, t * 0.5, t * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d2742';
    ctx.beginPath(); ctx.arc(W - t * 0.38, t * 0.42, t * 0.3, 0, Math.PI * 2); ctx.fill();
  } else {
    // postmark: a postage stamp's red border with perforations and SAN FRANCISCO along the top
    ctx.fillStyle = '#b5553c'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fbf7ef';
    const step = Math.max(6, t * 0.55), pr = step * 0.24;
    for (let x = step / 2; x < W; x += step) { ctx.beginPath(); ctx.arc(x, 0, pr, 0, Math.PI * 2); ctx.arc(x, H, pr, 0, Math.PI * 2); ctx.fill(); }
    for (let y = step / 2; y < H; y += step) { ctx.beginPath(); ctx.arc(0, y, pr, 0, Math.PI * 2); ctx.arc(W, y, pr, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = 'rgba(251, 247, 239, 0.8)';
    ctx.lineWidth = Math.max(1, t * 0.06);
    ctx.strokeRect(t * 0.42, t * 0.42, W - t * 0.84, H - t * 0.84);
    const fs = Math.max(7, Math.round(t * 0.42));
    ctx.font = `700 ${fs}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fbf7ef';
    const label = 'SAN FRANCISCO · BAY';
    ctx.fillRect(W / 2 - ctx.measureText(label).width / 2 - fs * 0.6, t * 0.25, ctx.measureText(label).width + fs * 1.2, t * 0.5);
    ctx.fillStyle = '#b5553c';
    ctx.fillText(label, W / 2, t * 0.5 + 0.5);
  }
  ctx.restore();
}

/** A small card in the shop tile: a sky and the sea in the photo, the frame round it. */
export function drawPreview(kind: FrameKind | null, canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const pad = Math.round(W * 0.09), band = Math.round(H * 0.2);
  const photo = { x: pad, y: pad, w: W - pad * 2, h: H - pad - band };
  ctx.fillStyle = '#fbf7ef'; ctx.fillRect(0, 0, W, H);
  const sky = ctx.createLinearGradient(0, photo.y, 0, photo.y + photo.h);
  sky.addColorStop(0, '#8fc4d6'); sky.addColorStop(0.62, '#f3d9a4'); sky.addColorStop(0.63, '#3f8aa0'); sky.addColorStop(1, '#2f6f86');
  ctx.fillStyle = sky; ctx.fillRect(photo.x, photo.y, photo.w, photo.h);
  // a tiny bridge on the horizon
  ctx.fillStyle = '#c44a31';
  const hy = photo.y + photo.h * 0.62;
  for (const k of [0.3, 0.7]) ctx.fillRect(photo.x + photo.w * k - 1, hy - photo.h * 0.34, 2.2, photo.h * 0.34);
  ctx.strokeStyle = '#c44a31'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(photo.x, hy - photo.h * 0.06); ctx.quadraticCurveTo(photo.x + photo.w * 0.5, hy + photo.h * 0.02, photo.x + photo.w, hy - photo.h * 0.06); ctx.stroke();
  ctx.fillStyle = '#3b3531';
  ctx.fillRect(pad, photo.y + photo.h + band * 0.42, photo.w * 0.4, Math.max(1.5, band * 0.14));
  if (kind) drawFrame(kind, { ctx, width: W, height: H, photo, band: { x: 0, y: photo.y + photo.h, w: W, h: band }, pad, caption: '', stamp: '', at: new Date() });
}
