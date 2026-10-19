import assert from 'node:assert/strict';
import test from 'node:test';

// UI9-PREP: the events index carries an offer's `status` (only `sold_out`, from the editorial overlay) so the 免费与优惠
// board (UI9-FREE) can show 已售罄 without reading the full offer catalog. No data changed: the generator spreads the field.
const { INDEX_OFFERS } = await import('../src/features/events/events-model');
const { currentFreebies } = await import('../src/data/october-offers');

test('an index offer says sold_out exactly when its source offer is sold out, and nothing else', () => {
  const source = new Map(currentFreebies.map(offer => [offer.id, offer]));
  assert.ok(INDEX_OFFERS.length > 0);
  for (const offer of INDEX_OFFERS) {
    assert.ok(source.has(offer.id), offer.id);
    assert.equal(offer.status, source.get(offer.id)!.status === 'sold_out' ? 'sold_out' : undefined, offer.id);
  }
});
