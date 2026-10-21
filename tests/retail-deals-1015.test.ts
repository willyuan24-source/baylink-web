import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { currentFreebies } from '../src/data/october-offers';
import { dealsOffers20261015, dealsUpdates20261015 } from '../src/data/retail-deals-2026-10-15';
import { retailPerksGuides2026 } from '../src/data/guides-retail-perks-2026';
import { getGuideBySlug } from '../src/data/guides';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { offerValue } from '../src/lib/event-facts';
import { addDays, validThisWeek } from '../src/lib/offer-week';
import { offerMatchesDateRange } from '../src/lib/offer-calendar';
import { loadLocale, translateText } from '../src/i18n/locale';
import { batchVerifiedAt } from './support/editor-review-2026-10-15';

// CNT-DEALS-2: store and restaurant perks from the 2026-10-15 batch (ledger: docs/source-reads-2026-10.md).
const offer = (id: string) => {
  const found = currentFreebies.find(item => item.id === id);
  assert.ok(found, id);
  return found;
};
const REI_RUNS = ['oct21', 'nov4', 'nov18', 'dec2', 'dec16'].map(day => `rei-berkeley-hella-bae-run-${day}-2026`);
const stringsIn = (value: unknown): string[] => typeof value === 'string' ? [value]
  : value && typeof value === 'object' ? Object.values(value).flatMap(stringsIn) : [];

test('the 2026-10-15 batch publishes each new perk once, read that day, with sources, artwork and absolute dates', () => {
  assert.equal(new Set(dealsOffers20261015.map(item => item.id)).size, dealsOffers20261015.length);
  for (const item of dealsOffers20261015) {
    assert.equal(currentFreebies.filter(published => published.id === item.id).length, 1, item.id);
    assert.equal(item.verifiedAt, batchVerifiedAt(item.id, '2026-10-15'), item.id);
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

test('nothing that needs a purchase, past spending or a paid membership is filed or headlined as free', async () => {
  await loadLocale('en');
  const free = new Set(['homedepot-dump-truck-nov7-2026', 'homedepot-christmas-car-ornament-nov21-2026', 'homedepot-holiday-train-dec5-2026',
    'lego-ghost-street-stoneridge-oct25-2026', ...REI_RUNS, 'apple-union-square-free-sessions',
    'sephora-berkeley-free-sampling', 'staples-ca-recycling-fee-waiver', 'michaels-free-online-tutorials']);
  const unpublishedTerms = new Set(['85c-new-member-sea-salt-coffee', 'bjs-new-member-pizookie', 'benjerry-flavor-fanatics-birthday',
    'benihana-fwb-welcome-starter', 'elpolloloco-loco-rewards-birthday']);
  for (const item of dealsOffers20261015) {
    const expected = free.has(item.id) ? ['no-purchase', 'reservation'] : unpublishedTerms.has(item.id) ? ['check-terms'] : ['purchase'];
    assert.ok(expected.includes(item.kind), `${item.id} is ${item.kind}`);
    if (!free.has(item.id)) {
      assert.doesNotMatch(item.title, /免费|free/i, `${item.id}: the title of a conditional perk does not say free`);
      assert.doesNotMatch(translateText(item.title, 'en'), /free/i, `${item.id}: nor does its English title`);
      const short = offer(item.id).shortTitle;
      assert.ok(short && !/免费/.test(short) && !/free/i.test(translateText(short, 'en')), `${item.id}: nor its short title`);
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

test('the Berkeley community run is one dated card per published Wednesday, never every Wednesday', () => {
  const runs = REI_RUNS.map(offer);
  assert.deepEqual(runs.map(run => run.startDate), ['2026-10-21', '2026-11-04', '2026-11-18', '2026-12-02', '2026-12-16']);
  for (const run of runs) {
    assert.equal(run.endDate, run.startDate, run.id);
    assert.equal(run.weekdays, undefined, run.id);
    assert.ok(validThisWeek(run, addDays(run.startDate!, -2)), `${run.id} is listed the week it happens`);
  }
  // 10/28, 11/11, 11/25 and 12/9 are Wednesdays with no run: the board's 本周有效 and the date search skip them.
  for (const monday of ['2026-10-26', '2026-11-09', '2026-11-23', '2026-12-07']) assert.ok(runs.every(run => !validThisWeek(run, monday)), monday);
  for (const wednesday of ['2026-10-28', '2026-11-11', '2026-11-25', '2026-12-09']) assert.ok(runs.every(run => !offerMatchesDateRange(run, wednesday, wednesday)), wednesday);
  assert.ok(runs.every(run => !validThisWeek(run, '2026-12-17')), 'nothing after 12/16');
  // the text names the series without a "next run" that goes stale
  for (const run of runs) assert.doesNotMatch(run.description, /最近一场/, run.id);
});

test('a single-venue or online perk has no 参与门店 lookup', () => {
  for (const id of ['lego-ghost-street-stoneridge-oct25-2026', ...REI_RUNS, 'apple-union-square-free-sessions', 'michaels-free-online-tutorials',
    'sephora-berkeley-free-sampling']) assert.equal(offer(id).storeUrl, undefined, id);
});

test('each new perk has a short title, so English page titles name the perk and not just the brand', async () => {
  await loadLocale('en');
  const english = dealsOffers20261015.map(item => {
    const short = offer(item.id).shortTitle;
    assert.ok(short, item.id);
    const translated = translateText(short, 'en');
    assert.doesNotMatch(translated, /[㐀-鿿]/, `${item.id}: ${short}`);
    assert.ok(`${translated} | BAYLINK`.length <= 60, translated);
    return translated;
  });
  assert.equal(new Set(english).size, english.length);
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
