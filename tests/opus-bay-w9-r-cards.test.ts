import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 9 · lane R (W9-R6, review R§6 现实出行价值): the place cards say what the review found missing or doubtful —
 * the de Young and the Legion of Honor are free every Saturday for residents of the nine Bay Area counties (FAMSF's Free
 * Saturdays ticket pages, read 2026-10-02), and the zoo's Little Puffer runs 11:00–16:00 but stops in wet weather or for
 * maintenance (sfzoo.org/rides-more, read 2026-10-02) instead of 「目前停运」.
 */

const { PLACE_CARDS, CARD_REFRESHES } = await import('../src/opus-bay/data/sf/placeCards');
const { CARD_LIMITS, CARD_LIMITS_EN } = await import('../src/opus-bay/data/sf/placeCardTypes');

test('W9-R6 the de Young and the Legion of Honor: free Saturdays for Bay Area residents, with the FAMSF page as a source', () => {
  for (const [id, page] of [['de-young-tower', 'https://ticketing.famsf.org/events/0191859e-ae61-6e35-b2cf-55f10d95ca3c'], ['legion-of-honor', 'https://ticketing.famsf.org/events/019185a9-f777-f93c-59fc-52de9182bc57']] as const) {
    const r = CARD_REFRESHES[id];
    assert.ok(r.cost, `${id}: a cost line`);
    assert.match(r.cost!.zh, /湾区九县居民每周六免费/, r.cost!.zh);
    assert.match(r.cost!.zh, /特展另付/);
    assert.match(r.cost!.en, /Bay Area residents \(9 counties\).*every Saturday.*ID with your address/, r.cost!.en);
    assert.ok([...r.cost!.zh].length <= CARD_LIMITS.cost && r.cost!.en.length <= CARD_LIMITS_EN.cost, `${id}: within the card limits`);
    assert.ok(r.sources.includes(page), `${id}: the Free Saturdays page is a source`);
    assert.equal(r.verifiedAt, '2026-10-02');
  }
});

test('W9-R6 the zoo card: the Little Puffer’s hours and when it stops, not 「目前停运」', () => {
  const zoo = PLACE_CARDS.find(c => c.id === 'sf-zoo')!;
  const tips = zoo.tips.map(t => t.zh).join(' ');
  assert.doesNotMatch(tips, /停运/);
  assert.match(tips, /11:00–16:00.*下雨或维护时停开/);
  assert.match(zoo.tips.map(t => t.en).join(' '), /11am–4pm.*wet weather or for maintenance/);
  assert.ok(zoo.sources?.includes('https://www.sfzoo.org/rides-more/'));
});
