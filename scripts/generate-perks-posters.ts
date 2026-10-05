import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import { create as createFont } from 'fontkit';
import { JSDOM } from 'jsdom';
import QRCode from 'qrcode';
import { PERKS_POSTER_CHECKED, perksPosters, type PerksPosterCard, type PerksPoster } from '../src/data/perks-posters';
import { birthdayPerks2026, birthdayPerkUpdates2026 } from '../src/data/birthday-perks-2026';
import { everydayPerks2026 } from '../src/data/everyday-perks-2026';
import { targetLowesOffers2026 } from '../src/data/retail-target-lowes-2026';
import { familyRetailOffers2026 } from '../src/data/retail-family-2026';

// Original deterministic artwork, with every Chinese character outlined using
// the repository's OFL-licensed font. No runtime/system-font dependency.
const fonts = await Promise.all(['Regular', 'Bold'].map(async weight => createFont(await readFile(`scripts/fonts/NotoSansSC-${weight}.ttf`))));
const logo = `data:image/png;base64,${(await readFile('public/brand/baylink-app-icon.png')).toString('base64')}`;
const ink = '#173F36', coral = '#D36745', cream = '#F7F2E6', muted = '#5E7468';
const sources = new Map([...birthdayPerks2026, ...everydayPerks2026, ...targetLowesOffers2026, ...familyRetailOffers2026, ...Object.entries(birthdayPerkUpdates2026).map(([id, offer]) => ({ ...offer, id }))].map(offer => [offer.id, offer]));
for (const poster of perksPosters) for (const item of poster.cards) {
  const source = sources.get(item.sourceId);
  if (!source?.sourceUrl || source.verifiedAt !== PERKS_POSTER_CHECKED) throw new Error(`Missing dated official source for ${item.sourceId}`);
}
const esc = (value: string) => value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]!));
const text = (value: string, x: number, y: number, size: number, color = ink, bold = false, maxWidth?: number) => {
  const font = fonts[bold ? 1 : 0];
  const naturalWidth = font.layout(value).positions.reduce((sum: number, position: { xAdvance: number }) => sum + position.xAdvance, 0) / font.unitsPerEm * size;
  const actualSize = maxWidth && naturalWidth > maxWidth ? size * maxWidth / naturalWidth : size;
  if (actualSize < 19) throw new Error(`Poster text is too small: ${value} (${actualSize.toFixed(1)} px)`);
  return `<text x="${x}" y="${y}" font-size="${actualSize}" font-weight="${bold ? 700 : 400}" fill="${color}">${esc(value)}</text>`;
};

function icon(kind: PerksPosterCard['icon'], x: number, y: number, size: number) {
  const drawings: Record<PerksPosterCard['icon'], string> = {
    beauty: '<rect x="17" y="31" width="17" height="26" rx="3"/><path d="M20 31V13l11-5v23M41 57V25h13v32M43 25v-9h9v9"/><path d="M46 8h3m-20 32h-7"/>',
    cup: '<path d="M12 22h40l-5 36H18zM17 22l-3-9h36l-4 9M31 13V6l10-3"/><path d="M23 38h19M26 44h13"/><path d="M52 27h7v16h-9"/>',
    cake: '<path d="M8 53h49M12 49c0-16 6-25 20-25s21 9 21 25zM26 24V12h13v12M32 12c-7-6 0-11 0-11s7 7 0 11z"/><path d="M13 42c5 0 4-9 8-9s3 11 8 11 3-11 8-11 4 9 13 9"/>',
    cookie: '<circle cx="32" cy="33" r="25"/><path d="M32 10c0 6 7 11 14 11"/><circle cx="22" cy="26" r="2"/><circle cx="39" cy="34" r="2"/><circle cx="24" cy="45" r="2"/><circle cx="44" cy="46" r="2"/>',
    popcorn: '<path d="M14 24h39l-6 34H21zM23 24l3 34M34 24v34M45 24l-4 34"/><path d="M13 24c-6-8 1-15 7-13 0-11 14-12 17-4 9-9 20-1 15 7 8 0 10 8 2 11"/>',
    bread: '<path d="M12 57V30c-10-4-10-17-1-22 10-6 22-4 24-3 22-3 34 17 17 25v27z"/><path d="M20 34v15h24V34M24 15h16"/>',
    film: '<rect x="7" y="10" width="51" height="44" rx="4"/><path d="M19 10v44M47 10v44M7 22h12M7 42h12M47 22h11M47 42h11M28 22l13 10-13 10z"/>',
    farm: '<path d="M9 32L32 9l23 23v26H9zM6 32h53M24 58V40h17v18M26 22h13"/><path d="M14 40v7M49 40v7"/>',
    print: '<path d="M17 24V6h31v18M17 48H7V24h51v24H48M18 38h29v22H18z"/><path d="M25 46h15M25 52h15M47 31h3"/>',
    art: '<rect x="8" y="8" width="48" height="48" rx="2"/><path d="M16 43l13-15 9 10 7-7 5 12z"/><circle cx="43" cy="22" r="4"/>',
    seed: '<path d="M32 58V25M31 43C8 44 6 27 7 21c20-2 26 10 24 22zM32 30c-2-19 13-25 25-22 0 20-11 24-25 22zM17 59h31"/>',
    park: '<path d="M9 43l12-17h-8L29 6l15 20h-8l13 17H9zM28 43v16M49 56V34h10v22M46 56h16"/>',
    gift: '<path d="M10 29h44v29H10zM7 20h50v10H7zM28 20v38M36 20v38"/><path d="M31 20C10 23 8 5 18 5c7 0 13 15 13 15zM33 20C54 23 56 5 46 5c-7 0-13 15-13 15z"/>',
  };
  return `<g transform="translate(${x},${y}) scale(${size / 64})" fill="none" stroke="${ink}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${drawings[kind]}</g>`;
}

function qrCode(url: string, x: number, y: number) {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
  let data = '';
  for (let row = 0; row < qr.modules.size; row++) for (let col = 0; col < qr.modules.size; col++) if (qr.modules.get(row, col)) data += `M${col} ${row}h1v1h-1z`;
  return `<rect x="${x - 8}" y="${y - 8}" width="108" height="108" rx="8" fill="#FFFEF8"/><path transform="translate(${x},${y}) scale(${92 / qr.modules.size})" fill="${ink}" d="${data}"/>`;
}

function card(item: PerksPosterCard, index: number, dense: boolean) {
  const x = 58 + (index % 2) * 492, y = 405 + Math.floor(index / 2) * (dense ? 235 : 352);
  const h = dense ? 219 : 334;
  const bg = index % 3 === 0 ? '#EAF0DF' : index % 3 === 1 ? '#FBE7D9' : '#FFFCF3';
  const bodyX = x + 27;
  return `<g>
    <rect x="${x}" y="${y}" width="472" height="${h}" rx="19" fill="${bg}" stroke="#D6DCCB"/>
    ${dense ? '' : `<circle cx="${x + 405}" cy="${y + 65}" r="38" fill="#FFFEF5" opacity=".8"/>`}
    ${icon(item.icon, x + (dense ? 395 : 371), y + (dense ? 16 : 29), dense ? 47 : 66)}
    ${text(String(index + 1).padStart(2, '0'), bodyX, y + (dense ? 30 : 39), 21, coral, true)}
    ${text(item.name, bodyX, y + (dense ? 61 : 82), dense ? 23 : 27, ink, true, dense ? 355 : 336)}
    ${text(item.reward, bodyX, y + (dense ? 105 : 136), dense ? 31 : 37, ink, true, 420)}
    ${item.details.map((line, lineIndex) => text(line, bodyX, y + (dense ? 143 : 182) + lineIndex * (dense ? 28 : 31), dense ? 23 : 24, muted, false, 420)).join('')}
    <line x1="${bodyX}" y1="${y + h - 43}" x2="${x + 445}" y2="${y + h - 43}" stroke="#193F3625"/>
    ${text(item.tag, bodyX, y + h - 17, 20, item.tag.includes('消费') ? '#9B482F' : muted, true, 420)}
  </g>`;
}

function render(poster: PerksPoster, page: number) {
  const dense = poster.cards.length > 4;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
    <rect width="1080" height="1350" fill="${cream}"/>
    <path d="M795 0h285v346c-132-7-241-83-267-207z" fill="#E7ECD9"/>
    <path d="M1028 144c-63-33-130 13-108 78 16 46 74 59 100 24 28-36-10-83-41-61" fill="none" stroke="#B7C5A4" stroke-width="2"/>
    <path d="M945 297l14-26 14 26-28-18h28z" fill="${coral}" opacity=".8"/>
    <path d="M968 74l7-14 7 14-15-9h16z" fill="${coral}"/>
    <image x="58" y="44" width="51" height="51" href="${logo}"/>
    ${text('BAYLINK', 123, 83, 39, ink, true)}
    ${text('湾区生活，值得收藏', 360, 80, 22, muted)}
    <rect x="791" y="46" width="231" height="48" rx="24" fill="${ink}"/>
    ${text('2026 OCTOBER', 813, 78, 24, cream, true)}
    <line x1="58" y1="120" x2="1022" y2="120" stroke="#C8D0BE"/>
    ${text(poster.edition, 61, 162, 21, coral, true)}
    ${text(poster.headline[0], 56, 249, 77, ink, true)}
    ${text(poster.headline[1], 59, 324, 57, ink, true)}
    ${text(poster.subtitle, 61, 372, 26, muted, false, 954)}
    ${poster.cards.map((item, index) => card(item, index, dense)).join('')}
    <line x1="58" y1="1143" x2="1022" y2="1143" stroke="#BCCAB5"/>
    ${qrCode(`https://www.baylink.us${poster.guidePath}?from=perks-poster`, 66, 1171)}
    ${text('扫码看完整条件与官网来源', 186, 1193, 28, ink, true)}
    ${text(`本图核验：${PERKS_POSTER_CHECKED} · 规则与库存可能变化`, 186, 1232, 23, muted)}
    ${text('领取 / 出发前，请再次查看官方说明。', 186, 1266, 23, muted)}
    ${text('BAYLINK.US', 58, 1320, 22, ink, true)}
    ${text('SAVE A LITTLE. LIVE A LITTLE.', 270, 1320, 20, muted)}
    ${text(`${String(page + 1).padStart(2, '0')} / ${String(perksPosters.length).padStart(2, '0')}`, 910, 1320, 25, ink, true)}
  </svg>`;
}

await mkdir('public/social/perks-2026-10', { recursive: true });
for (const [index, poster] of perksPosters.entries()) {
  const dom = new JSDOM(render(poster, index), { contentType: 'image/svg+xml' });
  const document = dom.window.document;
  for (const item of document.querySelectorAll('text')) {
    const font = fonts[Number(item.getAttribute('font-weight') || 400) >= 600 ? 1 : 0];
    const scale = Number(item.getAttribute('font-size')) / font.unitsPerEm;
    const run = font.layout(item.textContent || '');
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('fill', item.getAttribute('fill') || ink);
    group.setAttribute('transform', `translate(${item.getAttribute('x')},${item.getAttribute('y')}) scale(${scale},${-scale})`);
    let advance = 0;
    run.glyphs.forEach((glyph, glyphIndex) => {
      const position = run.positions[glyphIndex];
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', glyph.path.toSVG());
      path.setAttribute('transform', `translate(${advance + position.xOffset},${position.yOffset})`);
      group.append(path); advance += position.xAdvance;
    });
    item.replaceWith(group);
  }
  const png = new Resvg(document.documentElement.outerHTML, { font: { loadSystemFonts: false } }).render().asPng();
  await writeFile(`public${poster.path}`, png);
  dom.window.close();
}
await writeFile('public/social/perks-2026-10/manifest.json', JSON.stringify({ brand: 'BAYLINK', checked: PERKS_POSTER_CHECKED, width: 1080, height: 1350, note: 'Dated editorial snapshot. Source and eligibility details live in the linked guides.', posters: perksPosters.map(poster => ({ ...poster, cards: poster.cards.map(item => ({ ...item, sourceUrl: sources.get(item.sourceId)!.sourceUrl })) })) }, null, 2));
console.log(`Generated ${perksPosters.length} original BAYLINK 1080 × 1350 social posters.`);
