import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { localDiscoveries, discoveryShare } from '../src/data/local-discoveries';
import { guides } from '../src/data/guides';
import { guideShare, shareCardPath } from '../src/lib/editorial-share';
import { SITE_URL } from '../src/lib/seo';

const items = [...localDiscoveries.map(discoveryShare), ...guides.map(guideShare)];
for (const item of items) {
  const png = PNG.sync.read(await readFile(`public${shareCardPath(item)}`));
  assert.equal(png.width, 1200, item.path);
  assert.equal(png.height, 630, item.path);
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, { inversionAttempts: 'dontInvert' });
  assert.equal(decoded?.data, `${SITE_URL}${item.path}?from=card`, `QR on ${shareCardPath(item)}`);
}
console.log(`Verified ${items.length} PNG dimensions and independently decoded every direct-link QR.`);
