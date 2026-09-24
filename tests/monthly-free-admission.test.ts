import assert from 'node:assert/strict';
import test from 'node:test';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { sfSeptemberEvents } from '../src/data/monthly-sf-events';
import { verifiedSeptemberEvents } from '../src/data/september-events-update';
import { filterMonthlyEvents } from '../src/lib/monthly';

const event = (id: string) => {
  const item = [...MONTHLY_EVENTS, ...sfSeptemberEvents, ...verifiedSeptemberEvents].find(candidate => candidate.id === id);
  assert.ok(item, id);
  return item;
};

// General admission confirmed at https://newarkdays.org/faqs and
// https://petalumapumpkinpatch.com/pricing-hours/; optional activities remain paid.
test('free admission results include Newark Days and Petaluma while retaining paid-extra disclosures', () => {
  const newark = event('newark-days-2026');
  const petaluma = event('petaluma-pumpkin-patch-2026');
  assert.ok(filterMonthlyEvents([newark, petaluma], { cost: 'free', date: 'weekend', region: 'east-bay' }, '2026-09-15').includes(newark));
  assert.ok(filterMonthlyEvents(MONTHLY_EVENTS, { cost: 'free', date: 'october', region: 'north-bay' }, '2026-09-15').includes(petaluma));
  assert.match(newark.costLabel, /游乐设施、餐饮及部分项目另付/);
  assert.match(petaluma.costLabel, /基础入场和停车免费/);
  assert.match(petaluma.costLabel, /大迷宫与部分项目另付/);
  assert.match(petaluma.plan.join(' '), /买南瓜及餐饮另算/);
});

test('free admission does not include conditional-age or resident exemptions and still respects expiry', () => {
  const free = filterMonthlyEvents(MONTHLY_EVENTS, { cost: 'free' }, '2026-09-15');
  for (const id of ['flower-piano-2026', 'vacaville-learn-your-colors-run-2026']) {
    const conditional = event(id);
    assert.equal(conditional.cost, 'mixed');
    assert.ok(!free.includes(conditional), id);
  }
  const newark = event('newark-days-2026');
  assert.ok(!filterMonthlyEvents(MONTHLY_EVENTS, { cost: 'free' }, '2026-09-21').includes(newark));
  assert.ok(filterMonthlyEvents([newark], { cost: 'free', includeEnded: true }, '2026-09-21').includes(newark));
});
