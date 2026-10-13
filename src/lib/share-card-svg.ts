import { escapeHtml } from './seo';

/** Advance of one character at `fontSize`: CJK full width, Latin by a rough per-letter class. */
const advanceOf = (letter: string, fontSize: number) => /[⺀-￿]/u.test(letter) ? fontSize : /[MW@]/.test(letter) ? fontSize * .86 : /[il .,:|]/.test(letter) ? fontSize * .32 : fontSize * .59;
/** Estimated width of a line of text. */
export const textWidth = (text: string, fontSize: number) => Array.from(text).reduce((total, letter) => total + advanceOf(letter, fontSize), 0);

const CLOSING = /^[，。、；：！？）」』”’…·,.;:!?)\]]$/u;
/** Keep ordinary Latin words and numbers together; CJK can wrap between full characters. */
export function cardLines(text: string, width: number, fontSize: number, maxLines: number): string[] {
  const result: string[] = []; let line = ''; let used = 0;
  const letters = text.replace(/\s+/g, ' ').trim().match(/[\p{Script=Latin}\d][\p{Script=Latin}\d'’&./-]*|\s+|./gu) || [];
  for (let index = 0; index < letters.length; index++) {
    const char = letters[index];
    const advance = textWidth(char, fontSize);
    // a closing mark never starts a line: it stays on the line it ends (slightly past the width)
    if (used + advance > width && line && !CLOSING.test(char)) {
      if (result.length === maxLines - 1) { result.push(`${line.trimEnd()}…`); return result; }
      result.push(line.trim()); line = ''; used = 0;
    }
    line += char; used += advance;
  }
  if (line.trim()) result.push(line.trim());
  return result;
}
/** The largest size up to `max` at which `text` fits `width` on one line. */
export const fitSize = (text: string, width: number, max: number, min = 28) => Math.max(min, Math.min(max, Math.floor(width / Math.max(1, textWidth(text, 1)))));

/** TypeCover palettes (src/components/ui/ui.css --tc-*), so a card reads like the listing's own cover. */
export type CardTone = 'family' | 'culture' | 'outdoors' | 'food' | 'seniors' | 'free';
export const CARD_PALETTE: Readonly<Record<CardTone, { bg: string; fg: string }>> = {
  family: { bg: '#FBF1E6', fg: '#A0562E' }, culture: { bg: '#EAF1F8', fg: '#2F5F8A' }, outdoors: { bg: '#EAF5EF', fg: '#096B54' },
  food: { bg: '#FFF4DC', fg: '#8A5A00' }, seniors: { bg: '#EDE4F3', fg: '#5B3A7A' }, free: { bg: '#E6F2EA', fg: '#1E6B43' },
};
const INK = '#162E29', INK_2 = '#3E554D', INK_3 = '#54645E', BRAND = '#096B54', BRAND_DEEP = '#123C31', PAPER = '#FBFAF6', LINE = '#D9E0DA';

export type CardText = { text: string; x: number; y: number; size: number; weight?: 400 | 600 | 700; fill: string; spacing?: number };
/**
 * Draws one line of text. The default writes <text> (tests, previews); the generator passes a drawer that outlines the
 * glyphs from the bundled Noto Sans SC, so the PNG never depends on fonts installed on the build machine.
 */
export type TextDrawer = (run: CardText) => string;
export const plainText: TextDrawer = ({ text, x, y, size, weight = 400, fill, spacing }) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}"${spacing ? ` letter-spacing="${spacing}"` : ''}>${escapeHtml(text)}</text>`;
const lines = (draw: TextDrawer, texts: string[], x: number, y: number, size: number, lineHeight: number, weight: CardText['weight'], fill: string) =>
  texts.map((text, index) => draw({ text, x, y: y + index * lineHeight, size, weight, fill })).join('');

/**
 * Card v2 (I18N-SEO-05): the cover on the left — a photo only when its rights allow promotion, else the listing's
 * TypeCover (palette, category, the big date or value) — and on the right the title, date and place, then the QR to the
 * page in the card's own language. One card per language (/share-cards/, /share-cards/zh-Hant/, /share-cards/en/).
 */
export type ShareCardModel = {
  tone: CardTone;
  /** The cover's category label ("亲子活动"). */
  coverLabel: string;
  /** The big date ("10/17") or value ("免费"); `small` beside it ("周六"). */
  big: string; small?: string;
  /** A time ("9–17 点"), a brand or a source count under the big line. */
  note?: string;
  /** The price or deadline sticker ("免费", "$5–8", "还剩 3 天"). */
  sticker?: string;
  /** The provenance badge: "BAYLINK 信息卡", or the photo's own label. */
  provenance: string;
  kindLabel: string; title: string; meta: string[]; summary?: string;
  /** Under the QR. */
  scan: string; footnote: string;
  /** A promotion-cleared photo (data URI) for the cover. */
  photo?: string;
};
export type CardQr = { path: string; size: number };

const qrBlock = (qr: CardQr, x: number, y: number, size: number) => `<rect x="${x - 12}" y="${y - 12}" width="${size + 24}" height="${size + 24}" rx="14" fill="#fff" stroke="${LINE}"/>
  <svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="-4 -4 ${qr.size + 8} ${qr.size + 8}" shape-rendering="crispEdges"><path fill="${BRAND_DEEP}" d="${escapeHtml(qr.path)}"/></svg>`;
const brandRow = (draw: TextDrawer, logo: string, x: number, y: number, light = false) => `<image href="${escapeHtml(logo)}" x="${x}" y="${y}" width="52" height="52"/>
  ${draw({ text: 'BAYLINK', x: x + 66, y: y + 36, size: 30, weight: 700, fill: light ? '#fff' : BRAND_DEEP })}
  ${draw({ text: 'YOUR BAY. YOUR PEOPLE.', x: x + 216, y: y + 33, size: 15, fill: light ? '#D7E9DF' : INK_3, spacing: 2 })}`;

export function renderShareCardSvg(model: ShareCardModel, qr: CardQr, logo: string, draw: TextDrawer = plainText): string {
  const palette = CARD_PALETTE[model.tone];
  const coverWidth = 470, left = 520, right = 1150;
  const title = cardLines(model.title, right - left, 46, 3);
  const titleY = 210;
  const metaY = titleY + title.length * 58 + 4;
  const meta = model.meta.flatMap(line => cardLines(line, right - left, 25, 1)).slice(0, 2);
  const summaryY = metaY + meta.length * 38 + 10;
  const summaryLines = model.summary && summaryY < 360 ? cardLines(model.summary, right - left, 22, summaryY < 320 ? 2 : 1) : [];
  const bigSize = fitSize(model.big, coverWidth - 96, 128, 44);
  const fg = model.photo ? '#fff' : palette.fg;
  const cover = model.photo
    ? `<clipPath id="cover"><rect width="${coverWidth}" height="630"/></clipPath><image href="${escapeHtml(model.photo)}" width="${coverWidth}" height="630" preserveAspectRatio="xMidYMid slice" clip-path="url(#cover)"/>
  <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></linearGradient><rect width="${coverWidth}" height="630" fill="url(#shade)"/>`
    : `<clipPath id="cover"><rect width="${coverWidth}" height="630"/></clipPath><rect width="${coverWidth}" height="630" fill="${palette.bg}"/><g clip-path="url(#cover)"><circle cx="${coverWidth - 40}" cy="120" r="190" fill="${palette.fg}" opacity=".07"/><circle cx="60" cy="600" r="120" fill="${palette.fg}" opacity=".05"/></g>`;
  const sticker = model.sticker ? (() => {
    const size = 26, width = Math.ceil(textWidth(model.sticker, size)) + 40;
    return `<rect x="48" y="512" width="${width}" height="52" rx="26" fill="${model.photo ? '#fff' : palette.fg}"/>${draw({ text: model.sticker, x: 68, y: 547, size, weight: 700, fill: model.photo ? INK : '#fff' })}`;
  })() : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAPER}"/>
  ${cover}
  <g font-family="Noto Sans SC">
  <rect x="40" y="40" width="${Math.ceil(textWidth(model.provenance, 17)) + 28}" height="32" rx="8" fill="${model.photo ? '#000' : '#fff'}" opacity="${model.photo ? .45 : .82}"/>
  ${draw({ text: model.provenance, x: 54, y: 62, size: 17, fill: model.photo ? '#fff' : INK_2 })}
  ${draw({ text: model.coverLabel, x: 48, y: 136, size: 30, weight: 700, fill: fg })}
  ${draw({ text: model.big, x: 44, y: 300, size: bigSize, weight: 700, fill: fg })}
  ${model.small ? draw({ text: model.small, x: 50, y: 360, size: 36, weight: 600, fill: fg }) : ''}
  ${model.note ? lines(draw, cardLines(model.note, coverWidth - 96, 28, 2), 50, 420, 28, 38, 400, fg) : ''}
  ${sticker}
  ${brandRow(draw, logo, left, 40)}
  ${draw({ text: model.kindLabel, x: left, y: 146, size: 22, weight: 600, fill: BRAND })}
  ${lines(draw, title, left, titleY, 46, 58, 700, INK)}
  ${lines(draw, meta, left + 2, metaY, 25, 38, 400, INK_2)}
  ${lines(draw, summaryLines, left + 2, summaryY, 22, 31, 400, INK_3)}
  <line x1="${left}" y1="404" x2="${right}" y2="404" stroke="${LINE}"/>
  ${qrBlock(qr, 966, 426, 172)}
  ${lines(draw, cardLines(model.scan, 400, 24, 2), left, 470, 24, 34, 600, BRAND_DEEP)}
  ${draw({ text: 'baylink.us', x: left, y: 556, size: 30, weight: 700, fill: BRAND })}
  ${lines(draw, cardLines(model.footnote, 420, 16, 2), left, 590, 16, 22, 400, INK_3)}
  </g></svg>`;
}

/**
 * A hub's share card (I18N-SEO-03): 1200 × 630, for the home page, 活动, 指南 and the other hubs, one per language. The
 * left panel names the hub on the brand colour; the right lists what the hub has this week (the weekend's picks with
 * their dates, guide topics, tools), then the QR to the hub.
 */
export type HubCardModel = { eyebrow: string; title: string; subtitle: string; rows: { badge?: string; text: string }[]; scan: string; footnote: string };
export function renderHubCardSvg(model: HubCardModel, qr: CardQr, logo: string, draw: TextDrawer = plainText): string {
  const panel = 500, left = 548, right = 1150;
  const title = cardLines(model.title, panel - 96, 54, 3);
  const subtitle = cardLines(model.subtitle, panel - 96, 24, 3);
  let y = 108;
  const rows = model.rows.slice(0, 4).map(row => {
    const badgeWidth = row.badge ? Math.ceil(textWidth(row.badge, 20)) + 28 : 0;
    const text = cardLines(row.text, right - left - (badgeWidth ? badgeWidth + 16 : 26), 26, 2);
    if (y + (text.length - 1) * 34 > 420) return '';
    const markup = `${row.badge ? `<rect x="${left}" y="${y - 26}" width="${badgeWidth}" height="36" rx="10" fill="#EAF5EF"/>${draw({ text: row.badge, x: left + 14, y: y - 1, size: 20, weight: 700, fill: BRAND })}` : `<circle cx="${left + 8}" cy="${y - 9}" r="6" fill="${BRAND}"/>`}
    ${lines(draw, text, left + (badgeWidth ? badgeWidth + 16 : 26), y, 26, 34, 600, INK)}`;
    y += text.length * 34 + 30;
    return markup;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAPER}"/><rect width="${panel}" height="630" fill="${BRAND_DEEP}"/>
  <clipPath id="panel"><rect width="${panel}" height="630"/></clipPath><g clip-path="url(#panel)"><circle cx="${panel - 30}" cy="90" r="210" fill="#fff" opacity=".05"/><circle cx="40" cy="610" r="150" fill="#fff" opacity=".04"/></g>
  <g font-family="Noto Sans SC">
  ${brandRow(draw, logo, 48, 40, true)}
  ${draw({ text: model.eyebrow, x: 48, y: 170, size: 24, weight: 600, fill: '#BFE3CF' })}
  ${lines(draw, title, 48, 240, 54, 66, 700, '#fff')}
  ${lines(draw, subtitle, 50, 240 + title.length * 66 + 20, 24, 34, 400, '#D7E9DF')}
  ${draw({ text: 'baylink.us', x: 48, y: 590, size: 30, weight: 700, fill: '#fff' })}
  ${rows}
  <line x1="${left}" y1="440" x2="${right}" y2="440" stroke="${LINE}"/>
  ${qrBlock(qr, 994, 462, 146)}
  ${lines(draw, cardLines(model.scan, 400, 24, 2), left, 502, 24, 34, 600, BRAND_DEEP)}
  ${lines(draw, cardLines(model.footnote, 420, 16, 2), left, 572, 16, 22, 400, INK_3)}
  </g></svg>`;
}
