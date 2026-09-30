import assert from 'node:assert/strict';
import test from 'node:test';
import { recognizeNamedEvent } from '../src/lib/named-event-search';
import { searchQuickDestinations } from '../src/lib/quick-search';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';

const id = 'foster-city-water-lantern-festival-2026';
const today = '2026-09-29';

test('verified event names find the actual Foster City event without treating their internal SF label as geography', () => {
  for (const name of ['水灯节', '水燈節', 'SF水灯节', 'SF 水灯节', 'SF的水灯节', 'SF 的水灯节', '旧金山的水灯节', '舊金山的水燈節', 'sf  水燈節', 'San Francisco Water Lantern Festival', 'SAN  FRANCISCO  WATER LANTERN FESTIVAL', 'San Francisco 水灯节', 'Foster City 水灯节', 'Foster City San Francisco Water Lantern Festival']) {
    const query = `${name} 10/3`;
    const result = searchQuickDestinations(query, 'zh-Hans', today);
    assert.deepEqual(result.events.map(event => event.id), [id], name);
    assert.ok(!result.queryInfo.cities.includes('San Francisco'), name);
    assert.equal(result.queryInfo.original, query);
    assert.equal(result.events[0].city, 'Foster City');
    assert.equal(result.offers.length + result.openings.length + result.attractions.length, 0);
  }
});

test('a recognized name does not override a separate city, excluded peninsula, date, free admission or indoor condition', () => {
  for (const query of [
    '在旧金山找水灯节 10/3', '仅限SF水灯节 10/3', '仅限SF的水灯节 10/3', '水灯节 排除半岛 10/3',
    'Water Lantern Festival outside the peninsula 10/3', '不要水灯节 10/3',
    '水灯节 10/5', '免费 SF水灯节 10/3', 'free San Francisco Water Lantern Festival 10/3',
    '室内水灯节 10/3',
  ]) assert.deepEqual(searchQuickDestinations(query, 'zh-Hans', today).events, [], query);
  assert.deepEqual(searchQuickDestinations('水灯节', 'zh-Hans', '2026-10-05').events, []);
});

test('ordinary SF requests and unrelated water phrases do not activate the curated event shortcut', () => {
  for (const query of ['SF明天有什么', 'water', 'water festival', 'San Francisco festival']) assert.deepEqual(recognizeNamedEvent(query).eventIds, [], query);
  const result = searchQuickDestinations('SF明天有什么', 'zh-Hans', today);
  assert.deepEqual(result.queryInfo.cities, ['San Francisco']);
  assert.deepEqual(result.queryInfo.dateRange, { start: '2026-09-30', end: '2026-09-30' });
  assert.ok(result.events.every(event => event.city === 'San Francisco'));
});

test('a curated alias cannot fall back to unrelated events when its canonical entry is absent', () => {
  const index = MONTHLY_EVENTS.findIndex(event => event.id === id);
  assert.ok(index >= 0);
  const [event] = MONTHLY_EVENTS.splice(index, 1);
  try {
    assert.deepEqual(searchQuickDestinations('SF水灯节 10/3', 'zh-Hans', today).events, []);
  } finally {
    MONTHLY_EVENTS.splice(index, 0, event);
  }
});
