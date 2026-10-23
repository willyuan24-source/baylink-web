import { escapeHtml } from './seo';
import { COVER_TONES, type CoverTone } from './event-facts';

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
      // the cut never ends on a separator ("Lafayette · …")
      if (result.length === maxLines - 1) { result.push(`${line.trimEnd().replace(/\s*[·•|｜/／,，、;；:：–—-]+$/u, '')}…`); return result; }
      result.push(line.trim()); line = ''; used = 0;
    }
    line += char; used += advance;
  }
  if (line.trim()) result.push(line.trim());
  return result;
}
/** One line of " · " parts ("Sat, Oct 17 · 9am–5pm · Lafayette"): the whole parts that fit; only a first part that does
 * not fit alone is cut (…), so the line never ends on "· …". */
export function partsLine(parts: readonly string[], width: number, fontSize: number): string[] {
  const kept = parts.filter(Boolean);
  for (let count = kept.length; count > 1; count--) {
    const text = kept.slice(0, count).join(' · ');
    if (textWidth(text.replace(/\s+/g, ' ').trim(), fontSize) <= width) return [text.replace(/\s+/g, ' ').trim()];
  }
  return kept.length ? cardLines(kept[0], width, fontSize, 1) : [];
}
/** The largest size up to `max` at which `text` fits `width` on one line. */
export const fitSize = (text: string, width: number, max: number, min = 28) => Math.max(min, Math.min(max, Math.floor(width / Math.max(1, textWidth(text, 1)))));

/**
 * The token sheet's first `:root` block (src/tokens.css), read where the cards are drawn. The renderer only runs in Node
 * (scripts/generate-share-cards.ts, generate-weekly.ts and the tests; no page imports it), and resvg cannot resolve CSS
 * variables, so it reads the sheet's own declarations rather than carrying copies of them (UI9-R2 N08).
 */
function tokenSheetRoot(): string {
  type Fs = { readFileSync(path: URL, encoding: 'utf8'): string };
  const fs = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process?.getBuiltinModule?.('node:fs') as Fs | undefined;
  if (!fs) throw new Error('share-card-svg.ts draws cards in Node only: it reads src/tokens.css');
  const sheet = fs.readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');
  const start = sheet.indexOf(':root {');
  return sheet.slice(start, sheet.indexOf('\n}', start));
}
const ROOT_TOKENS = tokenSheetRoot();
/** The palette's "R G B" channels (--color-<name>-rgb); tests/token-contrast.test.ts holds the cards to the same sheet. */
export const CARD_CHANNELS: Readonly<Record<string, string>> = Object.fromEntries(
  [...ROOT_TOKENS.matchAll(/--color-([a-z0-9-]+)-rgb:\s*(\d+ \d+ \d+)\s*;/g)].map(([, name, channels]) => [name, channels]));
const token = (name: string) => {
  const channels = CARD_CHANNELS[name];
  if (!channels) throw new Error(`src/tokens.css has no --color-${name}-rgb`);
  return `#${channels.split(' ').map(value => Number(value).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
};
/** The cards' tones are the site's cover tones (event-facts.ts COVER_TONES). */
export type CardTone = CoverTone;
/**
 * Each tone's ground and ink: the sheet's one category map (--tc-<tone>-bg / -fg, "one map for covers, chips and share
 * cards"), read rather than declared again, so a card reads like the listing's own cover and follows the map when it changes.
 */
export const CARD_PALETTE: Readonly<Record<CardTone, { bg: string; fg: string }>> = Object.fromEntries(COVER_TONES.map(tone => {
  const side = (part: 'bg' | 'fg') => {
    const name = new RegExp(`--tc-${tone}-${part}:\\s*var\\(--color-([a-z0-9-]+)\\)`).exec(ROOT_TOKENS)?.[1];
    if (!name) throw new Error(`src/tokens.css has no --tc-${tone}-${part}`);
    return token(name);
  };
  return [tone, { bg: side('bg'), fg: side('fg') }];
})) as Record<CardTone, { bg: string; fg: string }>;
/** The inks, the brand and the paper of the token sheet (the share card and the weekly card). */
export const CARD_INK = { ink: token('ink'), ink2: token('ink-2'), ink3: token('ink-3'), brand: token('brand'), brandDeep: token('brand-deep'), brandTint: token('brand-tint'), paper: token('bg') } as const;
const { ink: INK, ink2: INK_2, ink3: INK_3, brand: BRAND, brandDeep: BRAND_DEEP, paper: PAPER } = CARD_INK;
const LINE = '#D9E0DA';
const WHITE = '#fff', BLACK = '#000', MINT = '#D7E9DF';

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
 * Card v2 (I18N-SEO-05): the type layout (palette, category, the big date or value; any card without a picture) on the left and on the right
 * the title, date and place, then the QR to the page in the card's own language; a card with a photo it may carry puts
 * the photo across the top instead (renderPhotoCardSvg, H45). One card per language (/share-cards/,
 * /share-cards/zh-Hant/, /share-cards/en/).
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
  /** The provenance badge: the picture's own label (示意图 for a ③ picture). */
  provenance: string;
  kindLabel: string; title: string; meta: string[]; summary?: string;
  /** Under the QR. */
  scan: string; footnote: string;
  /** The brand line's tagline in the card's language (zh: 湾区去哪、怎么办 · 有来源的中文答案; H45). */
  tagline?: string;
  /** A photo (data URI) the card may carry: a 1200 × 346 band across the top 55% of the card (H45). */
  photo?: string;
};
export type CardQr = { path: string; size: number };

const qrBlock = (qr: CardQr, x: number, y: number, size: number) => `<rect x="${x - 12}" y="${y - 12}" width="${size + 24}" height="${size + 24}" rx="14" fill="${WHITE}" stroke="${LINE}"/>
  <svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="-4 -4 ${qr.size + 8} ${qr.size + 8}" shape-rendering="crispEdges"><path fill="${BRAND_DEEP}" d="${escapeHtml(qr.path)}"/></svg>`;
export const DEFAULT_TAGLINE = 'YOUR BAY. YOUR PEOPLE.';
const brandRow = (draw: TextDrawer, logo: string, x: number, y: number, light = false, tagline = DEFAULT_TAGLINE, room = 420) => {
  // a Chinese tagline is set without letter spacing, and at a size that fits the room beside the name
  const latin = !/[⺀-￿]/u.test(tagline);
  const size = latin ? 15 : Math.min(17, Math.floor(room / Math.max(1, textWidth(tagline, 1))));
  return `<image href="${escapeHtml(logo)}" x="${x}" y="${y}" width="52" height="52"/>
  ${draw({ text: 'BAYLINK', x: x + 66, y: y + 36, size: 30, weight: 700, fill: light ? WHITE : BRAND })}
  ${draw({ text: tagline, x: x + 216, y: y + 33, size, fill: light ? MINT : INK_3, ...(latin ? { spacing: 2 } : {}) })}`;
};

/**
 * H45: a card with a photo carries it as a band across the top 55% (1200 × 346): the brand line on its top edge (on a
 * dark pill, so the tagline reads on a bright photo), the
 * photo's own label (官方图 · its source) on its bottom-left, the price sticker on its bottom-right; below, the kind, the
 * title (two lines), the date and place and the footnote, with the QR in the bottom-right corner as on every card.
 */
export const PHOTO_BAND = { width: 1200, height: 346 } as const;
/** What the photo layout draws: listing cards (renderShareCardSvg) and hub cards (renderHubCardSvg) alike. */
type PhotoCardModel = Pick<ShareCardModel, 'provenance' | 'kindLabel' | 'title' | 'meta' | 'footnote' | 'tagline' | 'sticker'> & { photo: string };
function renderPhotoCardSvg(model: PhotoCardModel, qr: CardQr, logo: string, draw: TextDrawer): string {
  const band = PHOTO_BAND.height, left = 48, right = 940;
  const title = cardLines(model.title, right - left, 42, 2);
  const titleY = 446, metaY = titleY + (title.length - 1) * 52 + 50;
  const meta = partsLine(model.meta, right - left, 24);
  const badgeWidth = Math.ceil(textWidth(model.provenance, 17)) + 28;
  // the pill under the brand line: logo and name (216), the tagline as brandRow sets it (Latin 15 + 2 spacing, CJK 17)
  const tagline = model.tagline ?? DEFAULT_TAGLINE;
  const brandPill = Math.ceil(216 + (/[⺀-￿]/u.test(tagline) ? textWidth(tagline, 17) : textWidth(tagline, 15) + 2 * tagline.length) + 36);
  const sticker = model.sticker ? (() => {
    const size = 26, width = Math.ceil(textWidth(model.sticker, size)) + 40;
    return `<rect x="${1200 - 40 - width}" y="${band - 76}" width="${width}" height="52" rx="26" fill="${WHITE}"/>${draw({ text: model.sticker, x: 1200 - 20 - width, y: band - 41, size, weight: 700, fill: INK })}`;
  })() : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAPER}"/>
  <clipPath id="band"><rect width="1200" height="${band}"/></clipPath><image href="${escapeHtml(model.photo)}" width="1200" height="${band}" preserveAspectRatio="xMidYMid slice" clip-path="url(#band)"/>
  <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BLACK}" stop-opacity=".62"/><stop offset=".42" stop-color="${BLACK}" stop-opacity="0"/><stop offset=".7" stop-color="${BLACK}" stop-opacity="0"/><stop offset="1" stop-color="${BLACK}" stop-opacity=".45"/></linearGradient><rect width="1200" height="${band}" fill="url(#shade)"/>
  <g font-family="Noto Sans SC">
  <rect x="28" y="16" width="${brandPill}" height="72" rx="16" fill="${BLACK}" opacity=".4"/>
  ${brandRow(draw, logo, 40, 26, true, model.tagline)}
  <rect x="40" y="${band - 64}" width="${badgeWidth}" height="34" rx="8" fill="${BLACK}" opacity=".55"/>
  ${draw({ text: model.provenance, x: 54, y: band - 41, size: 17, fill: WHITE })}
  ${sticker}
  ${draw({ text: model.kindLabel, x: left, y: 392, size: 22, weight: 600, fill: BRAND })}
  ${lines(draw, title, left, titleY, 42, 52, 700, INK)}
  ${lines(draw, meta, left + 2, metaY, 24, 34, 400, INK_2)}
  ${lines(draw, cardLines(model.footnote, right - left, 16, 1), left, 600, 16, 22, 400, INK_3)}
  ${qrBlock(qr, 984, 388, 168)}
  ${draw({ text: 'baylink.us', x: 1004, y: 598, size: 24, weight: 700, fill: BRAND })}
  </g></svg>`;
}

export function renderShareCardSvg(model: ShareCardModel, qr: CardQr, logo: string, draw: TextDrawer = plainText): string {
  if (model.photo) return renderPhotoCardSvg(model as ShareCardModel & { photo: string }, qr, logo, draw);
  const palette = CARD_PALETTE[model.tone];
  const coverWidth = 470, left = 520, right = 1150;
  const title = cardLines(model.title, right - left, 46, 3);
  const titleY = 210;
  const metaY = titleY + title.length * 58 + 4;
  const meta = model.meta.flatMap(line => cardLines(line, right - left, 25, 1)).slice(0, 2);
  const summaryY = metaY + meta.length * 38 + 10;
  const summaryLines = model.summary && summaryY < 360 ? cardLines(model.summary, right - left, 22, summaryY < 320 ? 2 : 1) : [];
  const bigSize = fitSize(model.big, coverWidth - 96, 128, 44);
  const fg = palette.fg;
  const cover = `<clipPath id="cover"><rect width="${coverWidth}" height="630"/></clipPath><rect width="${coverWidth}" height="630" fill="${palette.bg}"/><g clip-path="url(#cover)"><circle cx="${coverWidth - 40}" cy="120" r="190" fill="${palette.fg}" opacity=".07"/><circle cx="60" cy="600" r="120" fill="${palette.fg}" opacity=".05"/></g>`;
  const sticker = model.sticker ? (() => {
    const size = 26, width = Math.ceil(textWidth(model.sticker, size)) + 40;
    return `<rect x="48" y="512" width="${width}" height="52" rx="26" fill="${palette.fg}"/>${draw({ text: model.sticker, x: 68, y: 547, size, weight: 700, fill: WHITE })}`;
  })() : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAPER}"/>
  ${cover}
  <g font-family="Noto Sans SC">
  <rect x="40" y="40" width="${Math.ceil(textWidth(model.provenance, 17)) + 28}" height="32" rx="8" fill="${WHITE}" opacity=".82"/>
  ${draw({ text: model.provenance, x: 54, y: 62, size: 17, fill: INK_2 })}
  ${draw({ text: model.coverLabel, x: 48, y: 136, size: 30, weight: 700, fill: fg })}
  ${draw({ text: model.big, x: 44, y: 300, size: bigSize, weight: 700, fill: fg })}
  ${model.small ? draw({ text: model.small, x: 50, y: 360, size: 36, weight: 600, fill: fg }) : ''}
  ${model.note ? lines(draw, cardLines(model.note, coverWidth - 96, 28, 2), 50, 420, 28, 38, 400, fg) : ''}
  ${sticker}
  ${brandRow(draw, logo, left, 40, false, model.tagline)}
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
 * A hub's share card (I18N-SEO-03): 1200 × 630, for the home page, 活动, 指南 and the other hubs, one per language.
 * UI9-R2 N20 (DECISIONS 21, OD12): a hub card fronts a picture like every listing card — the photo layout, with the
 * picture's own label on it (示意图 for a ③ stock picture; never AI art), the hub's name, one line of what it has (`meta`)
 * and the QR. Only without a picture (the file missing; verify:share-cards fails the build then) does it fall back to
 * the brand panel: the hub's name on the brand colour, and on the right what the hub has this week (`rows`).
 */
export type HubCardModel = {
  eyebrow: string; title: string; subtitle: string; rows: { badge?: string; text: string }[]; scan: string; footnote: string; tagline?: string;
  /** The photo layout's one line under the title: whole parts that fit (partsLine). */
  meta: string[];
  /** The picture's own label, and the picture as a data URI (the 1200 × 346 band). */
  provenance?: string; photo?: string;
};
export function renderHubCardSvg(model: HubCardModel, qr: CardQr, logo: string, draw: TextDrawer = plainText): string {
  if (model.photo) {
    // DECISIONS 23: a picture is never drawn without its label
    if (!model.provenance) throw new Error(`hub card "${model.title}": a picture needs its label`);
    return renderPhotoCardSvg({ photo: model.photo, provenance: model.provenance, kindLabel: model.eyebrow, title: model.title, meta: model.meta, footnote: model.scan, tagline: model.tagline }, qr, logo, draw);
  }
  const panel = 500, left = 548, right = 1150;
  const title = cardLines(model.title, panel - 96, 54, 3);
  const subtitle = cardLines(model.subtitle, panel - 96, 24, 3);
  let y = 108;
  const rows = model.rows.slice(0, 4).map(row => {
    const badgeWidth = row.badge ? Math.ceil(textWidth(row.badge, 20)) + 28 : 0;
    const text = cardLines(row.text, right - left - (badgeWidth ? badgeWidth + 16 : 26), 26, 2);
    if (y + (text.length - 1) * 34 > 420) return '';
    const markup = `${row.badge ? `<rect x="${left}" y="${y - 26}" width="${badgeWidth}" height="36" rx="10" fill="${CARD_INK.brandTint}"/>${draw({ text: row.badge, x: left + 14, y: y - 1, size: 20, weight: 700, fill: BRAND })}` : `<circle cx="${left + 8}" cy="${y - 9}" r="6" fill="${BRAND}"/>`}
    ${lines(draw, text, left + (badgeWidth ? badgeWidth + 16 : 26), y, 26, 34, 600, INK)}`;
    y += text.length * 34 + 30;
    return markup;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAPER}"/><rect width="${panel}" height="630" fill="${BRAND_DEEP}"/>
  <clipPath id="panel"><rect width="${panel}" height="630"/></clipPath><g clip-path="url(#panel)"><circle cx="${panel - 30}" cy="90" r="210" fill="${WHITE}" opacity=".05"/><circle cx="40" cy="610" r="150" fill="${WHITE}" opacity=".04"/></g>
  <g font-family="Noto Sans SC">
  ${brandRow(draw, logo, 48, 40, true, model.tagline, 500 - 48 - 216 - 24)}
  ${draw({ text: model.eyebrow, x: 48, y: 170, size: 24, weight: 600, fill: '#BFE3CF' })}
  ${lines(draw, title, 48, 240, 54, 66, 700, WHITE)}
  ${lines(draw, subtitle, 50, 240 + title.length * 66 + 20, 24, 34, 400, MINT)}
  ${draw({ text: 'baylink.us', x: 48, y: 590, size: 30, weight: 700, fill: WHITE })}
  ${rows}
  <line x1="${left}" y1="440" x2="${right}" y2="440" stroke="${LINE}"/>
  ${qrBlock(qr, 994, 462, 146)}
  ${lines(draw, cardLines(model.scan, 400, 24, 2), left, 502, 24, 34, 600, BRAND_DEEP)}
  ${lines(draw, cardLines(model.footnote, 420, 16, 2), left, 572, 16, 22, 400, INK_3)}
  </g></svg>`;
}
