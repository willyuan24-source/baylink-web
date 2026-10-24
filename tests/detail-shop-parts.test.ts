import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * R2-INT12: an offer's and an opening's own detail parts (ShopFacts.tsx: their 一眼看懂 cards and an offer's
 * BenefitSteps) are a chunk of their own, so the event page — the budgeted /events/:id route — never downloads them. The
 * record read (load-detail.ts) loads the chunk with an offer's or an opening's bucket and suspends until both are in; an
 * event's read never asks for it. This file never imports ShopFacts.tsx itself, so only the read can have loaded it.
 */
const { readDetailRecord } = await import('../src/features/detail/load-detail');
const { shopParts } = await import('../src/features/detail/shop-parts');

/** Read a detail the way the page does: retry after each thrown load until the record (or null) is in. */
async function read(kind: 'event' | 'offer' | 'opening', id: string) {
  for (let round = 0; round < 10; round++) {
    try { return readDetailRecord(kind, id); } catch (pending) {
      assert.ok(pending instanceof Promise, `${kind} ${id}: the read throws only its pending load`);
      await pending;
    }
  }
  throw new Error(`${kind} ${id} never settled`);
}

test('an event\'s record never loads the offer and opening parts; an offer\'s record waits for them', async () => {
  const event = await read('event', 'san-francisco-fleet-week-2026');
  assert.equal(event?.item.kind, 'event');
  assert.equal(shopParts(), undefined, 'reading an event leaves the shop chunk alone');
  const offer = await read('offer', 'sfmta-free-muni-seniors');
  assert.equal(offer?.item.kind, 'offer');
  const parts = shopParts();
  assert.ok(parts, 'the offer\'s read is in only with its parts');
  assert.deepEqual(Object.keys(parts).sort(), ['BenefitSteps', 'OfferFacts', 'OpeningFacts']);
});

test('the parts stay out of the detail route\'s static imports; prerender registers them before rendering', () => {
  const detail = readFileSync('src/components/LocalDiscoveryDetail.tsx', 'utf8');
  assert.doesNotMatch(detail, /from '\.\.\/features\/detail\/(?:ShopFacts|BenefitSteps)'/);
  assert.doesNotMatch(readFileSync('src/features/detail/FactsGrid.tsx', 'utf8'), /export function (?:OfferFacts|OpeningFacts)/);
  assert.match(readFileSync('src/features/detail/load-detail.ts', 'utf8'), /import\('\.\/ShopFacts'\)/);
  assert.match(readFileSync('scripts/prerender.tsx', 'utf8'), /await import\('\.\.\/src\/features\/detail\/ShopFacts'\);/);
  assert.match(readFileSync('src/features/detail/ShopFacts.tsx', 'utf8'), /^provideShopParts\(\{ OfferFacts, OpeningFacts, BenefitSteps \}\);$/m);
});
