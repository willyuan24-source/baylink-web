import { escapeHtml } from './seo';
import { CARD_PALETTE, cardLines, fitSize, plainText, textWidth, type CardQr, type CardTone, type TextDrawer } from './share-card-svg';

/**
 * The weekly card v2 (WEB-SHARE-SEO, I18N-SEO-05): 1080 × 1440 (3:4), the weekend's picks — the same the home page
 * shows — as a 2 × 2 grid of TypeCover tiles (or a promotion-cleared photo) with their date badges, then a QR of at
 * least 300 px to the region's always-current list. One card per language.
 */
export type WeeklyTile = { tone: CardTone; label: string; date: string; title: string; place: string; sticker?: string; pick?: string; photo?: string };
export type WeeklyCardModel = {
  eyebrow: string; range: string; weekdays: string;
  tiles: WeeklyTile[];
  /** The fourth tile when there are three picks: how many more events the list has. */
  more?: { big: string; text: string };
  empty?: string;
  scan: string; link: string; footnote: string;
};

const INK = '#1E2B26', INK_2 = '#47534E', INK_3 = '#5C645F', BRAND = '#096B54', BRAND_DEEP = '#123C31', PAPER = '#FAF6EF', LINE = '#D9E0DA';
const lines = (draw: TextDrawer, texts: string[], x: number, y: number, size: number, lineHeight: number, weight: 400 | 600 | 700, fill: string) =>
  texts.map((text, index) => draw({ text, x, y: y + index * lineHeight, size, weight, fill })).join('');
const pill = (draw: TextDrawer, text: string, x: number, y: number, size: number, background: string, color: string) => {
  const width = Math.ceil(textWidth(text, size)) + 32;
  return `<rect x="${x}" y="${y}" width="${width}" height="${size + 22}" rx="${(size + 22) / 2}" fill="${background}"/>${draw({ text, x: x + 16, y: y + size + 4, size, weight: 700, fill: color })}`;
};

export function renderWeeklyCardSvg(model: WeeklyCardModel, qr: CardQr, logo: string, draw: TextDrawer = plainText): string {
  const tileW = 468, tileH = 380, gap = 32, left = 56, top = 300;
  const rangeSize = fitSize(model.range, 620, 76, 48);
  const tiles = model.tiles.slice(0, 4).map((tile, index) => {
    const x = left + (index % 2) * (tileW + gap), y = top + Math.floor(index / 2) * (tileH + gap);
    const palette = CARD_PALETTE[tile.tone];
    const fg = tile.photo ? '#fff' : palette.fg;
    const background = tile.photo
      ? `<clipPath id="t${index}"><rect x="${x}" y="${y}" width="${tileW}" height="${tileH}" rx="24"/></clipPath><image href="${escapeHtml(tile.photo)}" x="${x}" y="${y}" width="${tileW}" height="${tileH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#t${index})"/><rect x="${x}" y="${y}" width="${tileW}" height="${tileH}" rx="24" fill="#000" opacity=".45"/>`
      : `<rect x="${x}" y="${y}" width="${tileW}" height="${tileH}" rx="24" fill="${palette.bg}"/>`;
    const title = cardLines(tile.title, tileW - 64, 34, 3);
    return `${background}
    ${draw({ text: tile.label, x: x + 32, y: y + 52, size: 24, weight: 700, fill: fg })}
    ${tile.pick ? pill(draw, tile.pick, x + tileW - 32 - Math.ceil(textWidth(tile.pick, 18)) - 32, y + 26, 18, '#fff', BRAND_DEEP) : ''}
    ${pill(draw, tile.date, x + 30, y + 78, 26, '#fff', INK)}
    ${lines(draw, title, x + 32, y + 178, 34, 44, 700, tile.photo ? '#fff' : INK)}
    ${lines(draw, cardLines(tile.place, tileW - 64, 22, 1), x + 32, y + 178 + title.length * 44 + 4, 22, 30, 400, tile.photo ? '#fff' : INK_2)}
    ${tile.sticker ? pill(draw, tile.sticker, x + 30, y + tileH - 70, 22, tile.photo ? '#fff' : palette.fg, tile.photo ? INK : '#fff') : ''}`;
  });
  if (model.tiles.length === 3 && model.more) {
    const x = left + tileW + gap, y = top + tileH + gap;
    tiles.push(`<rect x="${x}" y="${y}" width="${tileW}" height="${tileH}" rx="24" fill="#EAF5EF"/>
    ${draw({ text: model.more.big, x: x + 32, y: y + 150, size: fitSize(model.more.big, tileW - 64, 84, 40), weight: 700, fill: BRAND })}
    ${lines(draw, cardLines(model.more.text, tileW - 64, 30, 3), x + 32, y + 220, 30, 42, 600, BRAND_DEEP)}`);
  }
  const empty = !model.tiles.length && model.empty ? lines(draw, cardLines(model.empty, 968, 40, 3), left, top + 80, 40, 56, 700, INK) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440">
  <rect width="1080" height="1440" fill="${PAPER}"/>
  <g font-family="Noto Sans SC">
  <image href="${escapeHtml(logo)}" x="${left}" y="56" width="60" height="60"/>
  ${draw({ text: 'BAYLINK', x: left + 76, y: 98, size: 34, weight: 700, fill: BRAND_DEEP })}
  ${draw({ text: model.eyebrow, x: left, y: 172, size: 30, weight: 600, fill: BRAND })}
  ${draw({ text: model.range, x: left, y: 254, size: rangeSize, weight: 700, fill: INK })}
  ${draw({ text: model.weekdays, x: left + Math.ceil(textWidth(model.range, rangeSize)) + 28, y: 250, size: 30, weight: 600, fill: INK_2 })}
  ${tiles.join('')}${empty}
  <line x1="${left}" y1="1100" x2="1024" y2="1100" stroke="${LINE}"/>
  <rect x="700" y="1116" width="324" height="300" rx="20" fill="#fff" stroke="${LINE}"/>
  <svg x="712" y="1116" width="300" height="300" viewBox="-4 -4 ${qr.size + 8} ${qr.size + 8}" shape-rendering="crispEdges"><path fill="${BRAND_DEEP}" d="${escapeHtml(qr.path)}"/></svg>
  ${lines(draw, cardLines(model.scan, 600, 32, 2), left, 1176, 32, 44, 700, BRAND_DEEP)}
  ${draw({ text: model.link, x: left, y: 1290, size: 30, weight: 700, fill: BRAND })}
  ${lines(draw, cardLines(model.footnote, 600, 22, 3), left, 1346, 22, 30, 400, INK_3)}
  </g></svg>`;
}
