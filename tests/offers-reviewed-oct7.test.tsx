import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FreebieBoard } from '../src/components/FreebieBoard';
import { currentFreebies } from '../src/data/october-offers';
import { offerReviews20261007, offerReviewEvidence20261007 } from '../src/data/offers-reviewed-2026-10-07';
import { getContentReviewManifest } from '../src/data/content-review';
import { getBayAreaToday } from '../src/lib/monthly';
import { loadLocale, translateText } from '../src/i18n/locale';
import english from '../src/i18n/offers-reviewed-2026-10-07-en.json';

const ids = ['marin-transit-clean-air-oct7-2026', 'sf-zoo-resident-free-oct7-2026', 'target-circle-deal-days-oct6-7-2026'];
const reviewed = currentFreebies.filter(offer => ids.includes(offer.id));

test('only three existing offers receive the documented October 7 source review', () => {
  assert.deepEqual(Object.keys(offerReviews20261007), ids);
  assert.equal(reviewed.length, 3);
  const manifest = getContentReviewManifest('2026-10-07');
  for (const offer of reviewed) {
    assert.equal(offer.verifiedAt, '2026-10-07');
    assert.equal(offer.endDate, '2026-10-07');
    assert.equal(offer.startDate, offer.id.startsWith('target') ? '2026-10-06' : '2026-10-07');
    const evidence = offerReviewEvidence20261007.find(item => item.id === offer.id)!;
    assert.equal(evidence.url, offer.sourceUrl);
    assert.equal(evidence.reviewedAt, offer.verifiedAt);
    assert.ok(evidence.evidence.length > 60);
    const row = manifest.items.find(item => item.kind === 'offer' && item.id === offer.id)!;
    assert.equal(row.verifiedAt, '2026-10-07');
    assert.equal(row.status, 'scheduled');
  }
  assert.equal(currentFreebies.find(offer => offer.id === 'target-circle-new-member-oct5-2026')!.verifiedAt, '2026-10-04', 'another offer using the same source is not silently renewed');
});

test('real benefit conditions remain narrow and expiry follows Pacific date without extensions', () => {
  const [marin, zoo, target] = ids.map(id => reviewed.find(offer => offer.id === id)!);
  assert.match(marin.requirement, /本地公交.*所有乘客.*不自动包括 Golden Gate、SMART、渡轮/);
  assert.match(zoo.requirement, /仅 San Francisco 居民.*政府签发证件.*一人/);
  assert.match(zoo.description, /10:00–16:00/);
  assert.equal(target.kind, 'purchase');
  assert.match(target.requirement, /免费 Target Circle.*指定商品/);
  assert.match(target.description, /40%.*30%/);
  const lateOctober7 = getBayAreaToday(new Date('2026-10-08T06:59:59Z'));
  const startOctober8 = getBayAreaToday(new Date('2026-10-08T07:00:00Z'));
  assert.equal(lateOctober7, '2026-10-07');
  assert.equal(startOctober8, '2026-10-08');
  const current = renderToStaticMarkup(<FreebieBoard offers={reviewed} today={lateOctober7} />);
  const ended = renderToStaticMarkup(<FreebieBoard offers={reviewed} today={startOctober8} />);
  for (const id of ids) {
    assert.ok(current.includes(`id="offer-${id}"`));
    assert.ok(!ended.includes(`id="offer-${id}"`));
    assert.equal(getContentReviewManifest(startOctober8).items.find(item => item.kind === 'offer' && item.id === id)!.status, 'archived');
  }
});

test('new factual offer copy has complete English and traditional Chinese compatibility', async () => {
  const dictionary: Record<string, string> = english;
  await loadLocale('zh-Hant');
  for (const update of Object.values(offerReviews20261007)) {
    assert.ok(dictionary[update.description!]);
    assert.doesNotMatch(dictionary[update.description!], /[\u3400-\u9fff]/u);
    const traditional = translateText(update.description!, 'zh-Hant');
    assert.ok(traditional.length > 40);
    assert.notEqual(traditional, update.description);
  }
});
