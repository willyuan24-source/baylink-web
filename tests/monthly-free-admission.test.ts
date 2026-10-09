import assert from 'node:assert/strict';
import test from 'node:test';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { sfSeptemberEvents } from '../src/data/monthly-sf-events';
import { verifiedSeptemberEvents } from '../src/data/september-events-update';
import { filterMonthlyEvents, isFreeToAttend } from '../src/lib/monthly';

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
  assert.match(petaluma.costLabel, /基础入场及停车免费/);
  assert.match(petaluma.costLabel, /日间大迷宫6岁以上\$9、5岁及以下免费/);
  assert.match(petaluma.costLabel, /周五周六夜迷宫\$13/);
  assert.match(petaluma.plan.join(' '), /其他项目、南瓜和餐饮另付/);
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

// G17 / PROD-14: an event that is free to watch with optional paid extras is in 本周末免费 (Fleet Week's airshow and
// ship tours are free; only VIP seating is sold). The price line stays on the card, so the paid parts remain visible.
test('本周末免费 includes mixed events whose published price says watching or entry is free, and nothing conditional', () => {
  const fleetWeek = event('san-francisco-fleet-week-2026');
  assert.equal(fleetWeek.cost, 'mixed');
  assert.ok(isFreeToAttend(fleetWeek));
  assert.ok(filterMonthlyEvents(MONTHLY_EVENTS, { cost: 'free', date: 'weekend' }, '2026-10-08').includes(fleetWeek));
  assert.ok(filterMonthlyEvents(MONTHLY_EVENTS, { cost: 'free', date: 'weekend', region: 'sf' }, '2026-10-10').includes(fleetWeek));
  assert.ok(!filterMonthlyEvents(MONTHLY_EVENTS, { cost: 'free', date: 'weekend' }, '2026-10-13').includes(fleetWeek), 'still respects the last day');
  for (const costLabel of ['免费入场；玻璃艺术品购买另计。', '节庆免费入场；餐饮、商品及部分周边活动另收费。', '普通入场免费、无需票；浓汤品尝/酒类品尝/VIP收费，价格以售票页为准', '活动与试吃免费；市场购物另付', '导览免费；县立停车场收费']) {
    assert.ok(isFreeToAttend({ cost: 'mixed', costLabel }), costLabel);
  }
  for (const costLabel of [
    '普通项目随植物园入场；符合条件者免费，Lounge 另票', '参考：需报名 · 6 岁以下免费，其余见市府报名页；最终价格以票页为准', '会员免费；非会员$25。',
    '预售$10、现场$15；12岁及以下免费，食品购物另付。', '入场免费 · 制作与放灯体验须购票，餐饮另付；所选日期票价待确认', '参考：活动免费 · 自备船板，租赁另付；最终价格以票页为准',
    '旅游局明确讲座/展示免费；未核到所有分项费用。', '无需票或预约；建议捐$10，零食饮品另付', '公众 $32；65+ 或外校学生 $27；Stanford 学生凭证免费', '22日须付农场门票；27日Green Friday免入场费',
    '长者免费；其他人 $10', '总体目录登记免费；采摘、购物及个别农场体验费用另计。',
  ]) assert.ok(!isFreeToAttend({ cost: 'mixed', costLabel }), costLabel);
  assert.ok(!isFreeToAttend({ cost: 'paid', costLabel: '免费入场' }));
  assert.ok(!isFreeToAttend({ cost: 'unknown', costLabel: '免费入场' }));
  for (const item of MONTHLY_EVENTS) if (item.cost === 'free') assert.ok(isFreeToAttend(item), item.id);
});
