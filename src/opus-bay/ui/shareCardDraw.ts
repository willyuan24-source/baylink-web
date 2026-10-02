import { drawQr, type QrMatrix } from '../game/photoCard';
import type { FamilyCard } from './shareCardModel';

/**
 * Wave 9 · lane S · W9-S4 — the 「约家人」 card as a vertical picture (review R§5 #8, §8 idea 5), in the site's share-card
 * style (src/lib/share-card-svg.ts: cream paper, a deep-green rounded frame, the pale-green panel with two wave lines,
 * BAYLINK, a dark pill for the label, the QR code in a white box): WeChat keeps the picture when it drops the words, and
 * a long press saves it. Pure layout (node-tested with an estimated text measure) + a painter over a 2D context.
 *
 *   layoutCard(card, measure)    every text line, box and the QR box at CARD_W wide; the height grows with the rows
 *                                (at least 4 : 5, at most MAX_H; the rows are cut, never the QR panel)
 *   paintCard(ctx, layout, qr)   paints it (no code when the qrcode chunk was lost: the address is printed anyway)
 */

export const CARD_W = 1080;
export const MIN_H = 1350;
export const MAX_H = 2160;
const M = 72;
const INNER = CARD_W - M * 2;
export const COLORS = { paper: '#f7f4eb', ink: '#183e34', green: '#174d3f', soft: '#476653', muted: '#6a7f70', panel: '#dce8cc', wave: '#b9ceb2', rule: '#d0d8c7', white: '#ffffff' } as const;
/** The card's fonts: Chinese first for a zh card; Latin first for an English one (a CJK face draws ’ “ ” full-width). */
export const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Noto Sans CJK SC", system-ui, sans-serif';
export const FONT_EN = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
export const cardFont = (locale: string): string => (locale === 'en' ? FONT_EN : FONT);

/** Width of `text` at `size` px and `weight` (the browser's measureText; tests pass an estimate). */
export type Measure = (text: string, size: number, weight: number) => number;

/** The estimate the site's card uses (src/lib/share-card-svg.ts cardLines): CJK = 1 em, narrow Latin ≈ .32, others ≈ .59. */
export const estimate: Measure = (text, size) => {
  let w = 0;
  for (const ch of Array.from(text)) w += /[\u2e80-\uffff]/u.test(ch) ? size : /[MW@]/.test(ch) ? size * 0.86 : /[il .,:|'!]/.test(ch) ? size * 0.32 : size * 0.59;
  return w;
};

/** CJK one by one, Latin by words (the spaces kept with the word before): wrap points. */
const TOKEN = /[\u2e80-\uffff]|[^\s\u2e80-\uffff]+\s*|\s+/gu;
/** Never at the start of a line (kinsoku): it hangs at the end of the line before (inside the margin). */
const NO_START = /^[、。，．,.;；:：!！?？）)》」』】〉”’·…]$/u;

/** `text` in lines of at most `width` px (each `\n` starts a line); past `max` lines the last ends with `…`. */
export function wrapLines(text: string, width: number, size: number, weight: number, max: number, measure: Measure): string[] {
  const out: string[] = [];
  const fits = (s: string) => measure(s.trimEnd(), size, weight) <= width;
  for (const para of text.split('\n')) {
    let line = '';
    for (const tok of para.match(TOKEN) ?? []) {
      if (fits(line + tok)) { line += tok; continue; }
      if (line.trim() && NO_START.test(tok.trim())) {
        // hang it (a full-width mark inks its left half: ≤ half an em past the line) or take the last character along
        if (measure((line + tok).trimEnd(), size, weight) <= width + size * 0.5) { line += tok; continue; }
        const chars = Array.from(line.trimEnd());
        if (chars.length > 1) { out.push(chars.slice(0, -1).join('')); line = chars[chars.length - 1] + tok; continue; }
      }
      if (line.trim()) { out.push(line.trimEnd()); line = ''; }
      if (fits(tok)) { line = tok.trimStart(); continue; }
      // a word wider than the line: by characters
      for (const ch of Array.from(tok)) {
        if (!fits(line + ch) && line) { out.push(line); line = ''; }
        line += ch;
      }
    }
    if (line.trim()) out.push(line.trimEnd());
  }
  if (out.length <= max) return out;
  const cut = out.slice(0, max);
  let last = cut[max - 1];
  while (last && !fits(`${last}…`)) last = Array.from(last).slice(0, -1).join('');
  cut[max - 1] = `${last}…`;
  return cut;
}

export interface TextItem { kind: 'text'; text: string; x: number; y: number; size: number; weight: number; color: string }
export interface BoxItem { kind: 'box'; x: number; y: number; w: number; h: number; r: number; fill?: string; stroke?: string; lw?: number }
export interface WaveItem { kind: 'wave'; y: number; color: string }
export type CardItem = TextItem | BoxItem | WaveItem;
export interface CardLayout { w: number; h: number; items: CardItem[]; qr: { x: number; y: number; size: number }; rowsCut: boolean; font: string }

const SIZES = { brand: 44, tag: 26, kicker: 30, title: 66, label: 28, row: 38, scan: 34, link: 40, note: 26 } as const;

/** Every line, box and the QR box of the card (y = a text's baseline). */
export function layoutCard(card: FamilyCard, measure: Measure = estimate, font: string = FONT): CardLayout {
  const items: CardItem[] = [];
  const text = (t: string, x: number, y: number, size: number, weight: number, color: string) => items.push({ kind: 'text', text: t, x, y, size, weight, color });

  // the head: the pale-green band with two waves, BAYLINK and its line, the label pill
  const headH = 300;
  items.push({ kind: 'box', x: 18, y: 18, w: CARD_W - 36, h: headH, r: 36, fill: COLORS.panel });
  items.push({ kind: 'wave', y: 150, color: COLORS.wave }, { kind: 'wave', y: 190, color: COLORS.wave });
  text('BAYLINK', M, 120, SIZES.brand, 700, COLORS.green);
  text('YOUR BAY. YOUR PEOPLE.', M + measure('BAYLINK', SIZES.brand, 700) + 24, 116, SIZES.tag, 400, COLORS.muted);
  const kick = wrapLines(card.kicker, INNER - 60, SIZES.kicker, 600, 1, measure)[0] ?? '';
  const pillW = Math.min(INNER, measure(kick, SIZES.kicker, 600) + 60);
  items.push({ kind: 'box', x: M, y: 200, w: pillW, h: 60, r: 30, fill: COLORS.green });
  text(kick, M + 30, 241, SIZES.kicker, 600, COLORS.white);

  // the title
  let y = headH + 120;
  const title = wrapLines(card.title, INNER, SIZES.title, 700, 3, measure);
  for (const line of title) { text(line, M, y, SIZES.title, 700, COLORS.green); y += 84; }
  y += 24;

  // the QR panel at the bottom: its height is fixed, the rows take what is left
  const qrSize = 340, panelPad = 40, panelH = qrSize + panelPad * 2;
  const footH = panelH + 40 + 34 + 60; // panel, gap, the note, the bottom margin
  const rowLines = card.rows.map(r => ({ label: r.label, lines: wrapLines(r.text, INNER, SIZES.row, 500, r.text.includes('\n') ? 4 : 3, measure) }));
  const rowH = (r: { label: string; lines: string[] }) => (r.label ? 44 : 0) + r.lines.length * 54 + 30;
  let need = y + 30;
  let shown = 0;
  for (const r of rowLines) { if (need + rowH(r) + footH > MAX_H) break; need += rowH(r); shown++; }
  const h = Math.max(MIN_H, Math.ceil(need + footH));

  items.push({ kind: 'box', x: M, y: y - 30, w: INNER, h: 2, r: 0, fill: COLORS.rule });
  y += 30;
  for (const r of rowLines.slice(0, shown)) {
    if (r.label) { text(r.label, M, y + 28, SIZES.label, 500, COLORS.muted); y += 44; }
    for (const line of r.lines) { text(line, M, y + 40, SIZES.row, 500, COLORS.ink); y += 54; }
    y += 30;
  }

  const panelY = h - footH;
  items.push({ kind: 'box', x: M, y: panelY, w: INNER, h: panelH, r: 28, fill: COLORS.panel });
  const qr = { x: M + panelPad, y: panelY + panelPad, size: qrSize };
  const tx = qr.x + qrSize + 44, tw = M + INNER - panelPad - tx;
  // the QR line and the address, centred beside the code
  const scan = wrapLines(card.scan, tw, SIZES.scan, 600, 3, measure);
  const blockH = scan.length * 48 + 30 + SIZES.link;
  let ty = panelY + Math.round((panelH - blockH) / 2) + SIZES.scan;
  for (const line of scan) { text(line, tx, ty, SIZES.scan, 600, COLORS.green); ty += 48; }
  text('baylink.us/opus-bay', tx, ty - 48 + 30 + SIZES.link + 8, fitSize('baylink.us/opus-bay', tw, SIZES.link, 700, measure), 700, COLORS.green);
  text(wrapLines(card.note, INNER, SIZES.note, 400, 1, measure)[0] ?? '', M, panelY + panelH + 40 + 26, SIZES.note, 400, COLORS.muted);
  items.push({ kind: 'box', x: 18, y: 18, w: CARD_W - 36, h: h - 36, r: 36, stroke: COLORS.green, lw: 4 });
  return { w: CARD_W, h, items, qr, rowsCut: shown < rowLines.length, font };
}

/** The largest size ≤ `size` at which `text` fits `width`. */
function fitSize(text: string, width: number, size: number, weight: number, measure: Measure): number {
  let s = size;
  while (s > 18 && measure(text, s, weight) > width) s -= 2;
  return s;
}

type Ctx = Pick<CanvasRenderingContext2D, 'fillStyle' | 'strokeStyle' | 'lineWidth' | 'font' | 'textBaseline' | 'fillRect' | 'fillText' | 'beginPath' | 'moveTo' | 'bezierCurveTo' | 'stroke' | 'fill'> & { roundRect?: CanvasRenderingContext2D['roundRect'] };

/** Paint the layout on a CARD_W × layout.h context; the QR code (when there is one) in a white box with whole-pixel modules. */
export function paintCard(ctx: Ctx, layout: CardLayout, qr: QrMatrix | null): void {
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, layout.w, layout.h);
  ctx.textBaseline = 'alphabetic';
  for (const it of layout.items) {
    if (it.kind === 'box') {
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function' && it.r > 0) ctx.roundRect(it.x, it.y, it.w, it.h, it.r);
      else if (it.fill) { ctx.fillStyle = it.fill; ctx.fillRect(it.x, it.y, it.w, it.h); continue; }
      if (it.fill) { ctx.fillStyle = it.fill; ctx.fill(); }
      if (it.stroke) { ctx.strokeStyle = it.stroke; ctx.lineWidth = it.lw ?? 2; ctx.stroke(); }
    } else if (it.kind === 'wave') {
      // the site card's two wave lines, across the head band
      ctx.beginPath();
      ctx.moveTo(18, it.y);
      ctx.bezierCurveTo(layout.w * 0.3, it.y - 90, layout.w * 0.55, it.y + 80, layout.w - 18, it.y - 40);
      ctx.strokeStyle = it.color; ctx.lineWidth = 3; ctx.stroke();
    } else {
      ctx.font = `${it.weight} ${it.size}px ${layout.font}`;
      ctx.fillStyle = it.color;
      ctx.fillText(it.text, it.x, it.y);
    }
  }
  // the code (game/photoCard.ts drawQr: whole-pixel modules, QR_QUIET modules of white); lost chunk = the white box only
  drawQr(ctx, qr ?? { size: 0, data: [] }, layout.qr, '#173f34');
}
