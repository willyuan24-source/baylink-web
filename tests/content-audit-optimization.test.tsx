import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { aiLocalEvents } from '../src/data/ai-local-events';
import { currentFreebies } from '../src/data/october-offers';
import { currentOpenings } from '../src/data/local-discoveries';
import { regionalBulletins } from '../src/data/late-september-local';
import { currentRegionalBulletins } from '../src/data/october-2026-bulletins';
import { guides } from '../src/data/guides';
import { publicServiceGuides } from '../src/data/guides-public-services';
import english from '../src/data/guides-public-services-en.json';
import { selectAiLocalEvents } from '../src/lib/ai-local';
import { editionCoverageLabel } from '../src/lib/edition-label';
import { appendPostTags, needsFairHousingReview } from '../src/lib/post-writing';
import { adRelationshipDisclosure } from '../src/lib/ad-disclosure';
import { searchGuides } from '../src/lib/guide-search';
import { contentReviewQueue, type ContentReviewRecord } from '../src/lib/content-review';
import { getContentReviewManifest } from '../src/data/content-review';
import AiLocalPage from '../src/pages/AiLocalPage';

test('AI cards use canonical reviewed rows and ended events remain accessible for archives', () => {
  const all = selectAiLocalEvents({ today: '2026-10-05', includeEnded: true });
  assert.ok(all.length >= 8);
  for (const raw of aiLocalEvents) {
    const selected = all.find(item => item.id === raw.id);
    assert.equal(selected, MONTHLY_EVENTS.find(item => item.id === raw.id), raw.id);
  }
  const current = selectAiLocalEvents({ today: '2026-10-05' });
  assert.ok(current.length < all.length);
  assert.ok(current.every(item => item.endDate >= '2026-10-05'));
  const html = renderToStaticMarkup(<StaticRouter location="/ai-in-the-bay"><AiLocalPage today="2026-10-05" /></StaticRouter>);
  assert.doesNotMatch(html, /href="https:\/\/aiweeksf.com\/calendar"/);
  assert.match(html, /href="https:\/\/www.tech-week.com\/calendar\/sf"/);
  assert.doesNotMatch(html, /2026-09-23/);
  const later = renderToStaticMarkup(<StaticRouter location="/ai-in-the-bay"><AiLocalPage today="2026-10-12" /></StaticRouter>);
  assert.doesNotMatch(later, /href="https:\/\/www.tech-week.com\/calendar\/sf"/);
});

test('period labels use the actual coverage and evergreen landing guides have no expired month', () => {
  const deal = guides.find(guide => guide.slug === 'bay-area-freebies-deals-2026-11')!;
  assert.equal(deal.editionStartDate, '2026-10-05');
  const label = editionCoverageLabel(deal, 'en');
  assert.equal(deal.editionThroughDate, '2026-11-30');
  assert.match(label, /Oct.*5.*Nov.*30.*2026/);
  assert.equal(editionCoverageLabel({ editionMonth: '2026-09' }), '2026 年 9 月');
  assert.equal(editionCoverageLabel({ editionMonth: '2026-13', editionStartDate: '2026-02-30', editionThroughDate: '2026-03-01' }), '');
  for (const guide of guides.filter(item => /first-72|first-7|first-30|first-night|home-base|first-tickets|rain.*car|car.*rain/u.test(item.slug))) assert.equal(guide.editionMonth, undefined, guide.slug);
});

test('verified factual corrections survive the final merged catalogs without invented checks', () => {
  const vta = regionalBulletins.find(item => item.id === 'south-bay-wolfe-ramp-oct2')!;
  assert.ok(vta);
  assert.match(vta.dateLabel, /6:00/);
  assert.match(vta.sourceUrl, /closes-friday-morning-oct-2-2026-600/);
  assert.equal(vta.verifiedAt, '2026-10-05');
  const restaurant = currentOpenings.find(item => item.id === 'marufuku-burlingame-announced')!;
  assert.equal(restaurant.status, 'announced');
  assert.match(restaurant.address, /225 Lorton/);
  assert.match(restaurant.summary, /10\/11.*Grand Opening/);
  assert.match(restaurant.dateLabel, /10\/11.*11:00–14:00.*17:00–21:00/);
  assert.equal(restaurant.verifiedAt, '2026-10-07');
  assert.equal(restaurant.sourceUrl, 'https://www.marufukuramen.com/burlingame');
  const museum = currentFreebies.find(item => item.id === 'famsf-bay-area-free-saturdays')!;
  assert.equal(new URL(museum.sourceUrl).hostname, 'www.famsf.org');
  assert.equal(museum.verificationStatus, 'needs-confirmation');
  assert.equal(museum.verifiedAt, '2026-10-02');
});

test('tags are idempotent and fair-housing copy is advisory, with explicit relationship metadata', () => {
  assert.equal(appendPostTags('真实描述 #包水电', ['包水电', '#包水电']), '真实描述 #包水电');
  assert.equal(appendPostTags('信息', ['pets', 'PETS', '#pets', '近车站']), '信息\n\n#pets #近车站');
  assert.equal(needsFairHousingReview('只租华人，不接受有孩家庭'), true);
  assert.equal(needsFairHousingReview('Chinese only'), true);
  assert.equal(needsFairHousingReview('两人入住；厨房共用，安静时段22点起'), false);
  assert.ok(adRelationshipDisclosure('1779339769392'));
  assert.equal(adRelationshipDisclosure('other-ad-id'), undefined);
});

test('public service guides are evergreen, source-backed and discoverable with real colloquial queries', () => {
  assert.equal(publicServiceGuides.length, 3);
  for (const guide of publicServiceGuides) {
    assert.ok(guides.includes(guide));
    assert.equal(guide.editionMonth, undefined);
    assert.ok(guide.sources.length >= 2);
    assert.ok(guide.blocks.some(block => block.type === 'template'));
    assert.ok(english[guide.title as keyof typeof english]);
    assert.ok(guide.sources.every(source => new URL(source.url).protocol === 'https:'));
  }
  for (const [query, slug] of [
    ['医保', 'bay-area-medicare-hicap-medi-cal-guide'],
    ['报税', 'bay-area-free-tax-help-vita-calfile-guide'],
    ['考驾照', 'california-driver-license-id-preparation-guide'],
    ['看病', 'bay-area-first-doctor-insurance-network-guide'],
  ]) {
    const matches = searchGuides(guides, { query });
    assert.ok(matches.some(item => item.guide.slug === slug), `${query}: ${matches.slice(0, 3).map(item => item.guide.slug)}`);
  }
});

test('review queue separates archive and scheduling from verification, covers each published item', () => {
  const row: ContentReviewRecord = { kind: 'offer', id: 'sample', title: 'sample', path: '/offers/sample', sourceUrls: ['https://example.com'], risk: 'time-sensitive', cadenceDays: 7, verifiedAt: '2026-09-28' };
  const queue = contentReviewQueue([row, { ...row, id: 'expired', endDate: '2026-10-04' }, { ...row, id: 'manual', manualReviewReason: 'Source requires review' }, { ...row, id: 'future', verifiedAt: '2026-10-06' }], '2026-10-05');
  assert.equal(queue.find(item => item.id === 'sample')?.status, 'due');
  assert.equal(queue.find(item => item.id === 'sample')?.verifiedAt, '2026-09-28');
  assert.equal(queue.find(item => item.id === 'expired')?.status, 'archived');
  assert.equal(queue[0].id, 'manual');
  assert.equal(queue.find(item => item.id === 'future')?.status, 'missing-date');
  const manifest = getContentReviewManifest('2026-10-05');
  assert.equal(manifest.items.length, MONTHLY_EVENTS.length + currentFreebies.length + currentOpenings.length + guides.length + currentRegionalBulletins.length);
  assert.equal(new Set(manifest.items.map(item => `${item.kind}:${item.id}`)).size, manifest.items.length);
  assert.equal(manifest.items.find(item => item.id === 'famsf-bay-area-free-saturdays')?.status, 'manual-review');
});
