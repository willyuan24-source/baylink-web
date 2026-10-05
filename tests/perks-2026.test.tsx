import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { birthdayPerks2026, birthdayPerkUpdates2026 } from '../src/data/birthday-perks-2026';
import { everydayPerks2026 } from '../src/data/everyday-perks-2026';
import { currentFreebies } from '../src/data/october-offers';
import { perksGuides2026 } from '../src/data/guides-perks-2026';
import { perksPosters, PERKS_POSTER_CHECKED } from '../src/data/perks-posters';
import { getGuideBySlug } from '../src/data/guides';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { FreebieBoard } from '../src/components/FreebieBoard';
import { PerksGallery } from '../src/components/PerksGallery';
import { loadLocale, translateText } from '../src/i18n/locale';

const added = [...birthdayPerks2026, ...everydayPerks2026];
const stringsIn = (value: unknown): string[] => typeof value === 'string' ? [value]
  : value && typeof value === 'object' ? Object.values(value).flatMap(stringsIn) : [];

test('new perks and existing Sephora correction resolve once in catalogs and dedicated guides', () => {
  assert.equal(new Set(currentFreebies.map(offer => offer.id)).size, currentFreebies.length);
  for (const offer of added) {
    assert.equal(currentFreebies.filter(item => item.id === offer.id).length, 1, offer.id);
    assert.equal(offer.verifiedAt, offer.id === 'ac-library-free-printing' ? '2026-10-05' : '2026-10-04', offer.id);
    assert.equal(new URL(offer.sourceUrl).protocol, 'https:');
    assert.ok(GUIDE_IMAGES[offer.imageKey] && existsSync(`public${GUIDE_IMAGES[offer.imageKey].src}`), offer.id);
  }
  for (const [id, patch] of Object.entries(birthdayPerkUpdates2026)) {
    const offer = currentFreebies.find(item => item.id === id)!;
    assert.ok(offer);
    for (const [key, value] of Object.entries(patch)) assert.deepEqual(offer[key as keyof typeof offer], value);
  }
  for (const [index, guide] of perksGuides2026.entries()) {
    assert.equal(getGuideBySlug(guide.slug), guide);
    const block = guide.blocks.find(item => item.type === 'freebies');
    assert.ok(block?.type === 'freebies');
    if (index === 0) assert.ok(block.offers.length >= birthdayPerks2026.length + Object.keys(birthdayPerkUpdates2026).length);
    else assert.equal(block.offers.length, everydayPerks2026.length);
    assert.ok(guide.sources.every(source => new URL(source.url).protocol === 'https:'));
  }
});

test('prior-purchase birthdays do not appear as no-purchase offers and local benefits cover all five regions', () => {
  for (const id of ['roundup-starbucks-birthday-2026', 'roundup-jersey-mikes-birthday-points-2026', 'roundup-red-robin-kids-birthday-2026']) {
    assert.equal(currentFreebies.find(offer => offer.id === id)?.kind, 'purchase', id);
  }
  assert.match(currentFreebies.find(offer => offer.id === 'amc-birthday-popcorn-2026')!.requirement, /首日前 30 天/);
  assert.match(currentFreebies.find(offer => offer.id === 'tilden-little-farm-free')!.requirement, /公众喂动物已停止/);
  const printing = currentFreebies.find(offer => offer.id === 'ac-library-free-printing')!;
  assert.equal(printing.sourceUrl, 'https://aclibrary.org/faq/print-scan-fax/');
  assert.match(printing.requirement, /实体 Library Card/);
  assert.match(printing.requirement, /eCard 或无卡访客不享免费额度/);
  assert.match(printing.requirement, /10 页黑白打印.*不含复印/);
  assert.match(printing.requirement, /彩印每页 \$0\.35.*超额黑白每页 \$0\.15/);

  assert.deepEqual([...new Set(everydayPerks2026.map(offer => offer.region))].sort(), ['east-bay', 'north-bay', 'peninsula', 'sf', 'south-bay']);
  const html = renderToStaticMarkup(<FreebieBoard offers={added} today="2026-10-04" />);
  assert.match(html, /datetime="2026-10-04"/i);
});

test('social artwork has real source records, readable 4:5 dimensions and direct-guide QR codes', () => {
  for (const poster of perksPosters) {
    assert.ok(getGuideBySlug(poster.guidePath.split('/').pop()!));
    for (const card of poster.cards) {
      const source = currentFreebies.find(offer => offer.id === card.sourceId);
      assert.ok(source, card.sourceId);
      assert.equal(source.verifiedAt, PERKS_POSTER_CHECKED);
    }
    const png = PNG.sync.read(readFileSync(`public${poster.path}`));
    assert.deepEqual([png.width, png.height], [1080, 1350]);
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, { inversionAttempts: 'dontInvert' });
    assert.ok(decoded?.data.startsWith(`https://www.baylink.us${poster.guidePath}`), poster.id);
  }
});

test('gallery links provide downloads and selectable caption fallbacks without requiring login', () => {
  const html = renderToStaticMarkup(<StaticRouter><PerksGallery /></StaticRouter>);
  assert.equal((html.match(/download=/g) || []).length, perksPosters.length);
  assert.equal((html.match(/<textarea/g) || []).length, perksPosters.length);
  for (const poster of perksPosters) {
    assert.ok(html.includes(poster.guidePath));
    assert.ok(html.includes(poster.path));
  }
});

test('every new guide and offer has complete English copy including source labels', async () => {
  await loadLocale('en');
  for (const value of stringsIn([added, birthdayPerkUpdates2026, perksGuides2026, perksPosters]).filter(value => /[\u3400-\u9fff]/.test(value))) {
    assert.doesNotMatch(translateText(value, 'en'), /[\u3400-\u9fff]/, value);
  }
});
