import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import QRCode from 'qrcode';
import { create as createFont } from 'fontkit';
import { JSDOM } from 'jsdom';
import { localDiscoveries, discoveryShare } from '../src/data/local-discoveries';
import { guides } from '../src/data/guides';
import { guideShare, shareCardPath } from '../src/lib/editorial-share';
import { renderShareCardSvg } from '../src/lib/share-card-svg';
import { SITE_URL } from '../src/lib/seo';

await mkdir('public/share-cards', { recursive: true });
const fonts = await Promise.all(['Regular', 'Bold'].map(async weight => createFont(await readFile(`scripts/fonts/NotoSansSC-${weight}.ttf`))));
const logo = `data:image/png;base64,${(await readFile('public/brand/baylink-app-icon.png')).toString('base64')}`;
const items = [...localDiscoveries.map(discoveryShare), ...guides.map(guideShare)];
for (const item of items) {
  const qr = QRCode.create(`${SITE_URL}${item.path}?from=card`, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  let path = '';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (qr.modules.get(y, x)) path += `M${x} ${y}h1v1h-1z`;
  const svg = renderShareCardSvg(item, path, size, logo);
  // Outline with a reusable font instance. Parsing both full CJK fonts separately
  // for every PNG is slow and can exhaust build-worker memory.
  const dom = new JSDOM(svg, { contentType: 'image/svg+xml' });
  const document = dom.window.document;
  for (const text of document.querySelectorAll('text')) {
    const font = fonts[Number(text.getAttribute('font-weight') || 400) >= 600 ? 1 : 0];
    const scale = Number(text.getAttribute('font-size') || 16) / font.unitsPerEm;
    const x = Number(text.getAttribute('x') || 0), y = Number(text.getAttribute('y') || 0);
    const spacing = Number(text.getAttribute('letter-spacing') || 0) / scale;
    const run = font.layout(text.textContent || '');
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('fill', text.getAttribute('fill') || '#183e34');
    group.setAttribute('transform', `translate(${x},${y}) scale(${scale},${-scale})`);
    let advance = 0;
    run.glyphs.forEach((glyph, index) => {
      const position = run.positions[index];
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', glyph.path.toSVG());
      path.setAttribute('transform', `translate(${advance + position.xOffset},${position.yOffset})`);
      group.append(path); advance += position.xAdvance + spacing;
    });
    text.replaceWith(group);
  }
  const renderer = new Resvg(document.documentElement.outerHTML, { font: { loadSystemFonts: false } });
  await writeFile(`public${shareCardPath(item)}`, renderer.render().asPng());
  dom.window.close();
}
console.log(`Generated ${items.length} BAYLINK share cards with direct-link QR codes.`);
