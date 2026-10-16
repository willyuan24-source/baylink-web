import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { currentFreebies } from '../src/data/october-offers';
import { dealsOffers20261015, dealsUpdates20261015 } from '../src/data/retail-deals-2026-10-15';
import { retailPerksGuides2026 } from '../src/data/guides-retail-perks-2026';
import { getGuideBySlug } from '../src/data/guides';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { offerValue } from '../src/lib/event-facts';
import { validThisWeek } from '../src/lib/offer-week';
import { loadLocale, translateText } from '../src/i18n/locale';

// CNT-DEALS-2: store and restaurant perks from the 2026-10-15 batch (ledger: docs/source-reads-2026-10.md).
const offer = (id: string) => {
  const found = currentFreebies.find(item => item.id === id);
  assert.ok(found, id);
  return found;
};
const stringsIn = (value: unknown): string[] => typeof value === 'string' ? [value]
  : value && typeof value === 'object' ? Object.values(value).flatMap(stringsIn) : [];

test('the 2026-10-15 batch publishes each new perk once, read that day, with sources, artwork and absolute dates', () => {
  assert.equal(new Set(dealsOffers20261015.map(item => item.id)).size, dealsOffers20261015.length);
  for (const item of dealsOffers20261015) {
    assert.equal(currentFreebies.filter(published => published.id === item.id).length, 1, item.id);
    assert.equal(item.verifiedAt, '2026-10-15', item.id);
    assert.equal(new URL(item.sourceUrl).protocol, 'https:', item.id);
    if (item.storeUrl) assert.equal(new URL(item.storeUrl).protocol, 'https:', item.id);
    assert.ok(GUIDE_IMAGES[item.imageKey] && existsSync(`public${GUIDE_IMAGES[item.imageKey].src}`), item.id);
    if (item.availability === 'dated') {
      assert.match(item.startDate || '', /^2026-\d{2}-\d{2}$/, item.id);
      assert.ok(item.startDate! <= item.endDate!, item.id);
    } else {
      // A standing membership rule carries no invented end date.
      assert.equal(item.endDate, undefined, item.id);
    }
  }
});

test('corrections land on the published records without touching their review dates', () => {
  for (const [id, patch] of Object.entries(dealsUpdates20261015)) {
    const published = offer(id);
    for (const [key, value] of Object.entries(patch)) assert.deepEqual(published[key as keyof typeof published], value, `${id}:${key}`);
    assert.notEqual(published.verifiedAt, '2026-10-15', `${id} keeps its own verifiedAt`);
  }
  assert.match(offer('nothing-bundt-cakes-birthday-bundtlet').requirement, /16 岁及以上.*18 岁及以上/);
  assert.match(offer('chipotle-welcome-chips-guac-2026').description, /7 天内有效/);
  assert.match(offer('roundup-ulta-birthday-gift-2026').requirement, /13 岁及以上/);
  // Overlay fixes on covered offers (src/data/editorial-overlay/offers.json).
  assert.match(offer('lego-free-kids-magazine').dateLabel, /每年 5 期/);
  assert.match(offer('lego-free-kids-magazine').description, /2027 年 3 月.*2026 年 11 月/);
  assert.match(offer('homedepot-monthly-kids-workshops').description, /11\/7 Dump Truck/);
});

test('nothing that needs a purchase, past spending or a paid membership is filed or headlined as free', () => {
  const free = new Set(['homedepot-dump-truck-nov7-2026', 'homedepot-christmas-car-ornament-nov21-2026', 'homedepot-holiday-train-dec5-2026',
    'lego-ghost-street-stoneridge-oct25-2026', 'rei-berkeley-hella-bae-runs-2026', 'apple-union-square-free-sessions',
    'sephora-berkeley-free-sampling', 'staples-ca-recycling-fee-waiver', 'michaels-free-online-tutorials']);
  const unpublishedTerms = new Set(['85c-new-member-sea-salt-coffee', 'bjs-new-member-pizookie', 'benjerry-flavor-fanatics-birthday',
    'benihana-fwb-welcome-starter', 'elpolloloco-loco-rewards-birthday']);
  for (const item of dealsOffers20261015) {
    const expected = free.has(item.id) ? ['no-purchase', 'reservation'] : unpublishedTerms.has(item.id) ? ['check-terms'] : ['purchase'];
    assert.ok(expected.includes(item.kind), `${item.id} is ${item.kind}`);
    if (!free.has(item.id)) {
      assert.doesNotMatch(item.title, /免费|free/i, `${item.id}: the title of a conditional perk does not say free`);
      assert.notEqual(offerValue(item)?.zh, '免费', item.id);
    }
  }
  for (const id of ['target-circle-360-paid-monthly-gifts', 'jamba-birthday-small-smoothie', 'parisbaguette-birthday-cake-slice',
    'safeway-for-u-monthly-item', 'safeway-for-u-birthday-treat', 'redrobin-royalty-welcome-appetizer', 'noahs-welcome-bagel-with-purchase']) {
    assert.equal(offer(id).kind, 'purchase', id);
  }
  assert.match(offer('target-circle-360-paid-monthly-gifts').requirement, /付费会员.*\$10\.99.*\$99/);
  assert.match(offer('target-circle-360-paid-monthly-gifts').description, /免费的 Target Circle 会员没有/);
  assert.match(offer('staples-ca-recycling-fee-waiver').requirement, /49 英寸及以下/);
  assert.match(offer('ikea-family-new-member-20-off').requirement, /营销邮件.*邮箱验证.*最低消费/);
  assert.match(offer('michaels-makebreak-buy-base').requirement, /购买当场指定的底材/);
  assert.match(offer('ulta-alameda-million-fragrance-oct17-2026').requirement, /随购买/);
});

test('the Berkeley community run is listed on its first and third Wednesdays only through 12/16', () => {
  const run = offer('rei-berkeley-hella-bae-runs-2026');
  assert.deepEqual(run.weekdays, [3]);
  assert.ok(validThisWeek(run, '2026-10-19'), 'the week of 10/21');
  assert.ok(!validThisWeek(run, '2026-12-17'), 'nothing after 12/16');
  for (const day of ['10/21', '11/4', '11/18', '12/2', '12/16']) assert.ok(run.dateLabel.includes(day), day);
});

test('the retail directory lists the new perks and birthday perks reach the birthday guide', () => {
  const guide = retailPerksGuides2026[0];
  const board = guide.blocks.find(block => block.type === 'freebies');
  assert.ok(board?.type === 'freebies');
  for (const item of dealsOffers20261015) if (!item.endDate || item.endDate >= '2026-10-15') assert.ok(board.offers.some(listed => listed.id === item.id), item.id);
  const birthday = getGuideBySlug('bay-area-birthday-perks');
  const birthdayIds = new Set(birthday?.blocks.flatMap(block => block.type === 'freebies' ? block.offers.map(listed => listed.id) : []));
  for (const id of ['jamba-birthday-small-smoothie', 'safeway-for-u-birthday-treat', 'benihana-fwb-birthday-50', 'dunkin-birthday-triple-points']) assert.ok(birthdayIds.has(id), id);
});

test('every new or corrected string has an English translation', async () => {
  await loadLocale('en');
  const corrected = ['lego-free-kids-magazine', 'homedepot-monthly-kids-workshops'].map(id => ({ dateLabel: offer(id).dateLabel, description: offer(id).description }));
  for (const value of stringsIn([dealsOffers20261015, dealsUpdates20261015, corrected]).filter(value => /[㐀-鿿]/.test(value))) {
    assert.doesNotMatch(translateText(value, 'en'), /[㐀-鿿]/, value);
  }
});
