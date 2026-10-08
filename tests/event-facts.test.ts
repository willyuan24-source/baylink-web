import assert from 'node:assert/strict';
import test from 'node:test';
import {
  brandCase, discountOff, displayUnits, eventDateChip, eventPlace, eventPriceChip, eventShortTitle, eventTimeLabel, eventTone, formatDateChip,
  isPublicBenefit, offerDeadline, offerValue, openingChip, upcomingWeekend,
} from '../src/lib/event-facts';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { EVENT_DATE_OVERRIDES } from '../src/data/event-calendar-dates';
import { currentFreebies } from '../src/data/october-offers';

const TODAY = '2026-10-08';
const day = { startDate: '2026-10-10', endDate: '2026-10-10' };

test('a card states one honest date: the shown day, the next session, or the open/close of a run', () => {
  assert.deepEqual(eventDateChip(day, TODAY), { kind: 'day', date: '2026-10-10', ended: false });
  assert.equal(formatDateChip(eventDateChip(day, TODAY), false).label, '周六 10/10');
  assert.equal(formatDateChip(eventDateChip(day, TODAY), true).label, 'Sat 10/10');
  const series = { startDate: '2026-10-01', endDate: '2026-10-31', occurrenceDates: ['2026-10-04', '2026-10-11', '2026-10-18'] };
  assert.deepEqual(eventDateChip(series, TODAY), { kind: 'day', date: '2026-10-11', ended: false }, 'next confirmed session');
  assert.deepEqual(eventDateChip(series, TODAY, ['2026-10-17', '2026-10-18']), { kind: 'day', date: '2026-10-18', ended: false }, 'the weekend day it occurs on');
  assert.deepEqual(eventDateChip(series, '2026-11-01'), { kind: 'day', date: '2026-10-18', ended: true });
  const run = { startDate: '2026-10-12', endDate: '2026-11-15' };
  assert.equal(formatDateChip(eventDateChip(run, TODAY), false).label, '10/12 起');
  assert.equal(formatDateChip(eventDateChip(run, TODAY), true).label, 'From 10/12');
  assert.equal(formatDateChip(eventDateChip(run, '2026-10-20'), false).label, '至 11/15');
  assert.equal(formatDateChip(eventDateChip(run, '2026-10-20'), true).label, 'Until 11/15');
  assert.deepEqual(eventDateChip(run, '2026-10-20', ['2026-10-24']), { kind: 'day', date: '2026-10-24', ended: false });
  const weekend = formatDateChip(eventDateChip({ startDate: '2026-10-10', endDate: '2026-10-11' }, TODAY), false);
  assert.deepEqual([weekend.big, weekend.small, weekend.label], ['10/10–11', '周六–周日', '10/10–11'], 'a run of up to a week prints both ends');
  assert.equal(formatDateChip(eventDateChip({ startDate: '2026-10-30', endDate: '2026-11-01' }, TODAY), true).small, 'Fri–Sun');
  assert.equal(formatDateChip(eventDateChip({ startDate: '2026-10-30', endDate: '2026-11-01' }, TODAY), true).label, '10/30–11/1');
});

test('unknown or unconfirmed dates read "日期见详情", never a guess', () => {
  for (const event of [{ startDate: '2026-10-10', endDate: '2026-10-31', occurrenceDates: [] }, { startDate: 'TBA', endDate: '2026-10-31' }, { startDate: '2026-10-31', endDate: '2026-10-01' }, { startDate: '2026-02-30', endDate: '2026-03-01' }]) {
    const chip = eventDateChip(event, TODAY);
    assert.equal(chip.kind, 'unknown', JSON.stringify(event));
    assert.equal(formatDateChip(chip, false).label, '日期见详情');
    assert.equal(formatDateChip(chip, true).label, 'See details for dates');
  }
  assert.deepEqual(eventDateChip({ ...day, occurrenceDates: undefined, sessions: [{ date: '2026-10-10', start: '11:00' }] }, TODAY), { kind: 'day', date: '2026-10-10', ended: false }, 'overlay sessions win');
});

test('every live catalog event gets a short date chip, never the free-text dateLabel', () => {
  for (const event of MONTHLY_EVENTS.filter(item => item.endDate >= TODAY)) {
    const occurrenceDates = Object.hasOwn(EVENT_DATE_OVERRIDES, event.id) ? EVENT_DATE_OVERRIDES[event.id] : event.occurrenceDates;
    const text = formatDateChip(eventDateChip({ ...event, occurrenceDates }, TODAY), false).label;
    assert.ok(text.length <= 10, `${event.id}: ${text}`);
    assert.notEqual(text, event.dateLabel);
  }
});

test('the price sticker says 免费 only when cost is free and shows nothing for an unknown cost', () => {
  assert.deepEqual(eventPriceChip({ cost: 'free' })?.text, { zh: '免费', en: 'Free' });
  assert.deepEqual(eventPriceChip({ cost: 'mixed' })?.text, { zh: '部分免费', en: 'Partly free' });
  assert.equal(eventPriceChip({ cost: 'unknown', planning: { admissionUsd: 0 } }), null);
  assert.deepEqual(eventPriceChip({ cost: 'paid', planning: { admissionUsd: 25 } })?.text, { zh: '$25', en: '$25' });
  assert.deepEqual(eventPriceChip({ cost: 'paid', price: { min: 8, max: 12 } })?.text, { zh: '$8–12', en: '$8–12' });
  assert.deepEqual(eventPriceChip({ cost: 'paid', planning: { admissionUsd: 0 } })?.text, { zh: '收费', en: 'Paid' }, 'a paid event never reads $0');
  for (const event of MONTHLY_EVENTS) {
    const chip = eventPriceChip(event);
    if (chip?.tone === 'free') assert.equal(event.cost, 'free', event.id);
  }
});

test('short titles, places, tones and session times come from structured fields only', () => {
  assert.equal(eventShortTitle({ title: 'Fleet Week 蓝天使航展：海军舰艇开放与飞行表演' }), 'Fleet Week 蓝天使航展');
  assert.equal(eventShortTitle({ title: '秋：赏枫' }), '秋：赏枫', 'a head shorter than 4 units is not a name');
  assert.equal(eventShortTitle({ title: 'Anything', shortTitle: ' 山景城啤酒节 ' }), '山景城啤酒节');
  assert.equal(eventShortTitle({ title: 'Movie Night at 7:30' }), 'Movie Night at 7:30', 'a clock time is not a separator');
  assert.equal(eventShortTitle({ title: 'Fleet Week 2026: Blue Angels' }), 'Fleet Week 2026', 'a colon after a year still separates');
  assert.equal(displayUnits('Fleet Week 蓝天使'), 8.5);
  assert.equal(eventPlace({ city: 'Berkeley' }), 'Berkeley');
  assert.equal(eventPlace({ city: 'San Jose', venueShort: '圣荷西 San Jose' }), '圣荷西 San Jose');
  assert.equal(eventTone({ category: 'culture', audience: ['长者', '家庭'] }), 'seniors');
  assert.equal(eventTone({ category: 'food', audience: ['家庭'] }), 'food');
  const planning = { schedule: { sourceUrl: 'https://example.org', verifiedAt: '2026-10-01', dates: { '2026-10-10': [{ open: '11:00', close: '19:00' }] } } };
  assert.equal(eventTimeLabel({ planning }, '2026-10-10', false), '11–19 点');
  assert.equal(eventTimeLabel({ planning }, '2026-10-10', true), '11am–7pm');
  assert.equal(eventTimeLabel({ sessions: [{ date: '2026-10-11', start: '10:30', end: '16:00' }] }, '2026-10-11', false), '10:30–16:00');
  assert.equal(eventTimeLabel({ planning }, '2026-10-11', false), undefined);
});

test('offer facts: value, deadline, normal-case brand and public benefit', () => {
  assert.deepEqual(offerValue({ title: '全家免费入园' }), { zh: '免费', en: 'Free' });
  assert.deepEqual(offerValue({ title: '会员商品 7 折' }), { zh: '7 折', en: '30% off' });
  assert.deepEqual(offerValue({ title: '咖啡买一送一' }), { zh: '买一送一', en: 'BOGO' });
  assert.equal(offerValue({ title: '生日礼物' }), null);
  assert.equal(offerValue({ title: '全场打折' }), null, 'no stated value, no headline');
  assert.equal(offerValue({ title: '满 $100 享 $20 折扣' }), null, 'a dollar amount before 折扣 is not a discount rate');
  assert.equal(offerValue({ title: '10 折' }), null, '10 折 is the full price');
  assert.equal(offerValue({ title: '指定衣物六折、美妆七折' }), null, 'two different discounts have no single headline');
});

test('discount headlines read the written rate: one digit is tenths, two digits are hundredths', () => {
  const cases: [string, string, string][] = [
    ['会员商品 7 折', '7 折', '30% off'], ['新会员首单 85 折，7 天内使用', '85 折', '15% off'], ['周四饮品85折', '85 折', '15% off'],
    ['全场 95折', '95 折', '5% off'], ['指定商品 8.5 折', '8.5 折', '15% off'], ['会员肉桂卷八折', '八折', '20% off'],
    ['首单八五折', '八五折', '15% off'], ['日间导览七五折', '七五折', '25% off'], ['单程交通费五折', '五折', '50% off'], ['Save 15% off', '15% 折扣', '15% off'],
  ];
  for (const [title, zh, en] of cases) assert.deepEqual(offerValue({ title }), { zh, en }, title);
  assert.equal(discountOff('85'), 15);
  assert.equal(discountOff('8.5'), 15);
  assert.equal(discountOff('0'), null);
});

test('free is a headline only when it is free without buying anything', () => {
  assert.deepEqual(offerValue({ title: '全家免费入园', kind: 'no-purchase' }), { zh: '免费', en: 'Free' });
  assert.deepEqual(offerValue({ title: '免费入园，需预约', kind: 'reservation' }), { zh: '免费', en: 'Free' });
  assert.deepEqual(offerValue({ title: '会员线上买早餐，普通咖啡随单免费', kind: 'purchase' }), { zh: '随单免费', en: 'Free with purchase' });
  assert.deepEqual(offerValue({ title: '周三买完整成人套餐，12 岁及以下儿童餐免费', kind: 'purchase' }), { zh: '随单免费', en: 'Free with purchase' });
});

test('no live offer headline disagrees with a rate in its id or title', () => {
  let rated = 0;
  for (const offer of currentFreebies) {
    const value = offerValue(offer);
    if (!value) continue;
    const off = /^(\d+)% off$/.exec(value.en)?.[1];
    if (off) {
      rated += 1;
      const idRate = /(\d+)-percent/.exec(offer.id)?.[1];
      if (idRate) assert.equal(off, idRate, `${offer.id}: ${value.en}`);
      const percent = /(?<![\d.$])(\d{1,2})\s*%\s*(?:off|折扣)/i.exec(offer.title)?.[1];
      if (percent) assert.equal(off, percent, `${offer.id}: ${value.en}`);
      assert.ok(offer.title.replace(/\s+/g, '').includes(value.zh.replace(/\s+|%折扣/g, '')), `${offer.id}: ${value.zh} is written in the title`);
    }
    if (value.zh === '免费') assert.notEqual(offer.kind, 'purchase', `${offer.id}: a purchase offer is never a bare 免费`);
  }
  assert.ok(rated > 0, 'the catalog has rated offers to check');
  assert.deepEqual(offerDeadline({ endDate: TODAY, availability: 'dated' }, TODAY)?.tone, 'danger');
  assert.deepEqual(offerDeadline({ endDate: '2026-10-09', availability: 'dated' }, TODAY)?.text, { zh: '明天截止', en: 'Ends tomorrow' });
  assert.deepEqual(offerDeadline({ endDate: '2026-10-11', availability: 'dated' }, TODAY)?.text, { zh: '还剩 3 天', en: '3 days left' });
  assert.equal(offerDeadline({ endDate: '2026-11-15', availability: 'dated' }, TODAY)?.tone, 'neutral');
  assert.deepEqual(offerDeadline({ availability: 'ongoing' }, TODAY)?.text, { zh: '长期有效', en: 'Ongoing' });
  assert.equal(offerDeadline({ availability: 'check-local' }, TODAY), null);
  assert.equal(brandCase('SAN JOSÉ MUSEUM OF ART'), 'San José Museum of Art');
  assert.equal(brandCase('BAMPFA · BERKELEY'), 'BAMPFA · Berkeley');
  assert.equal(brandCase('LOWE’S'), 'Lowe’s');
  assert.equal(brandCase('ASIAN ART MUSEUM · SF'), 'Asian Art Museum · SF');
  assert.equal(brandCase('Target'), 'Target', 'mixed case is left alone');
  assert.equal(isPublicBenefit({ brand: 'SAN FRANCISCO PUBLIC LIBRARY' }), true);
  assert.equal(isPublicBenefit({ brand: 'YOGURTLAND' }), false);
  assert.equal(brandCase('SFPL · LINKEDIN LEARNING'), 'SFPL · LinkedIn Learning');
  // Every all-caps brand in the catalog reads in normal case; only real acronyms keep their capitals.
  const acronyms = new Set(['IKEA', 'BAMPFA', 'OMCA', 'SFMOMA', 'SFMTA', 'AMC', 'SJC', 'SFPL']);
  for (const offer of currentFreebies.filter(item => !/\p{Ll}/u.test(item.brand))) {
    for (const word of brandCase(offer.brand).match(/\b[A-Z]{3,}\b/gu) ?? []) assert.ok(acronyms.has(word), `${offer.id}: ${brandCase(offer.brand)}`);
  }
});

test('opening chips and the weekend helper never guess a date', () => {
  assert.deepEqual(openingChip({ status: 'open', openedOn: '2026-10-02' }, TODAY), { zh: '10 月开业', en: 'Opened Oct' });
  assert.deepEqual(openingChip({ status: 'announced', openedOn: '2026-11-20' }, TODAY), { zh: '预计 11/20 开业', en: 'Opening 11/20' });
  assert.deepEqual(openingChip({ status: 'announced' }, TODAY), { zh: '即将开业', en: 'Opening soon' });
  assert.deepEqual(openingChip({ status: 'soft_open' }, TODAY), { zh: '试营业', en: 'Soft opening' });
  assert.deepEqual(upcomingWeekend('2026-10-08'), ['2026-10-10', '2026-10-11']);
  assert.deepEqual(upcomingWeekend('2026-10-10'), ['2026-10-10', '2026-10-11']);
  assert.deepEqual(upcomingWeekend('2026-10-11'), ['2026-10-10', '2026-10-11']);
});
