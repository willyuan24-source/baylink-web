import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import { currentFreebies } from '../src/data/october-offers';
import { targetLowesOffers2026, targetLowesUpdates2026 } from '../src/data/retail-target-lowes-2026';
import { familyRetailOffers2026, familyRetailUpdates2026 } from '../src/data/retail-family-2026';
import { diningRetailOffers2026, diningRetailUpdates2026 } from '../src/data/retail-dining-2026';
import { retailPerksGuides2026 } from '../src/data/guides-retail-perks-2026';
import { getGuideBySlug } from '../src/data/guides';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { loadLocale, translateText } from '../src/i18n/locale';

const added = [...targetLowesOffers2026, ...familyRetailOffers2026, ...diningRetailOffers2026];
const patches = { ...targetLowesUpdates2026, ...familyRetailUpdates2026, ...diningRetailUpdates2026 };
const stringsIn = (value: unknown): string[] => typeof value === 'string' ? [value]
  : value && typeof value === 'object' ? Object.values(value).flatMap(stringsIn) : [];

test('reviewed retail records have unique published IDs, working local artwork and absolute date windows', () => {
  assert.equal(new Set(added.map(offer => offer.id)).size, added.length);
  for (const offer of added) {
    assert.equal(currentFreebies.filter(item => item.id === offer.id).length, 1, offer.id);
    assert.equal(offer.verifiedAt, '2026-10-04', offer.id);
    assert.equal(new URL(offer.sourceUrl).protocol, 'https:');
    assert.ok(GUIDE_IMAGES[offer.imageKey] && existsSync(`public${GUIDE_IMAGES[offer.imageKey].src}`), offer.id);
    if (offer.availability === 'dated') {
      assert.match(offer.startDate || '', /^\d{4}-\d{2}-\d{2}$/);
      assert.match(offer.endDate || '', /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(offer.startDate! <= offer.endDate!, offer.id);
    }
  }
  for (const [id, patch] of Object.entries(patches)) {
    const published = currentFreebies.find(offer => offer.id === id);
    assert.ok(published, id);
    for (const [key, value] of Object.entries(patch)) assert.deepEqual(published[key as keyof typeof published], value, `${id}:${key}`);
  }
});

test('retailer guides and offer URLs are explicitly served by production routes', () => {
  const { routes } = JSON.parse(readFileSync('vercel.json', 'utf8')) as { routes: { src?: string; dest?: string }[] };
  for (const guide of retailPerksGuides2026) {
    assert.equal(getGuideBySlug(guide.slug), guide);
    const board = guide.blocks.find(block => block.type === 'freebies');
    assert.ok(board?.type === 'freebies' && board.offers.length >= added.length);
    assert.ok(routes.some(route => route.dest === '/guides/$1.html' && new RegExp(route.src!).test(`/guides/${guide.slug}`)), guide.slug);
  }
  for (const offer of added) assert.ok(routes.some(route => route.dest === '/offers/$1.html' && new RegExp(route.src!).test(`/offers/${offer.id}`)), offer.id);
});

test('retail spending and subscription conditions remain explicit and are not classified as no-purchase', () => {
  for (const id of ['michaels-ghost-jar-oct11-2026', 'michaels-halloween-lantern-oct18-2026', 'petco-first-autoship-2026', 'petsmart-first-autoship-2026', 'auntie-annes-welcome-pretzel-2026', 'peets-birthday-drink-2026', 'crumbl-silver-birthday-2026']) {
    assert.equal(currentFreebies.find(offer => offer.id === id)?.kind, 'purchase', id);
  }
  for (const id of ['petco-first-autoship-2026', 'petsmart-first-autoship-2026']) {
    const offer = currentFreebies.find(item => item.id === id)!;
    assert.match(`${offer.requirement} ${offer.description}`, /取消/);
    assert.match(`${offer.dateLabel} ${offer.requirement}`, /收费|付费/);
  }
});

test('new retail guides and every offer field have English coverage', async () => {
  await loadLocale('en');
  for (const value of stringsIn([added, patches, retailPerksGuides2026]).filter(value => /[\u3400-\u9fff]/.test(value))) {
    assert.doesNotMatch(translateText(value, 'en'), /[\u3400-\u9fff]/, value);
  }
});
