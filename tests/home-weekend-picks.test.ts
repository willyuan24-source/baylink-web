import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import type { MonthlyEvent } from '../src/data/monthly-types';
import { MONTHLY_EVENTS as COMPLETE_EVENTS } from '../src/data/monthly-edition';
import { MONTHLY_EDITION } from '../src/data/monthly-settings';
import { WEEKEND_FLAGSHIP_IDS, WEEKEND_PICKS, type WeekendPickEntry } from '../src/data/weekend-picks';
import { HOME_WEEKENDS } from '../src/lib/home-catalog';
import { getHomeWeekend, getWeeklyCardDays, getWeeklyCardHref } from '../src/lib/home-weekend';
import { getBuildWeekend } from '../src/lib/home-weekend-build';
import { isAdultOnly, rankWeekendFallback, selectWeekendFallback } from '../src/lib/weekend-ranking';
import { addCalendarDays, eventOccursOn } from '../src/lib/event-calendar';

const CJK = /[㐀-鿿]/;
const ids = (picks: { event: MonthlyEvent }[]) => picks.map(pick => pick.event.id);
const event = (id: string, overrides: Partial<MonthlyEvent> = {}): MonthlyEvent => ({
  id, title: id, startDate: '2026-10-10', endDate: '2026-10-11', dateLabel: '10/10–10/11', region: 'sf', city: 'San Francisco', venue: 'Venue',
  category: 'culture', cost: 'paid', costLabel: '$10', summary: '', plan: [], audience: [], officialUrl: 'https://example.com/', sourceLabel: 'Official',
  verifiedAt: '2026-10-01', imageKey: 'none', ...overrides,
});

// The editor-approved list for 10/10–10/11, copied so these selection tests
// keep passing after the weekend is deleted from src/data/weekend-picks.ts.
const OCTOBER_10: Record<string, readonly WeekendPickEntry[]> = { '2026-10-10': [
  { id: 'san-francisco-fleet-week-2026', reason: { zh: '蓝天使飞越海湾，岸边免费看', en: 'Blue Angels over the Bay, free from the shore' } },
  { id: 'burlingame-mandarin-storytime-2026', reason: { zh: '普通话+英语讲故事，0–6岁', en: 'Mandarin and English stories for ages 0–6' } },
  { id: 'fremont-ardenwood-harvest-2026', reason: { zh: '收玉米、榨苹果汁，东湾农场一日', en: 'Pick corn and press cider on an East Bay farm' } },
  { id: 'sf-italian-heritage-parade-2026', reason: { zh: '从渔人码头走进 North Beach', en: "From Fisherman's Wharf into North Beach" } },
] };

test('current editor picks name real events on their weekend with short reasons', () => {
  // Past weekends are deleted each Thursday; validating only weekends from the
  // edition's review date keeps later catalog edits from failing on old entries.
  const from = addCalendarDays(MONTHLY_EDITION.checkedAt, -6);
  for (const [saturday, list] of Object.entries(WEEKEND_PICKS).filter(([saturday]) => saturday >= from)) {
    assert.equal(new Date(`${saturday}T12:00:00Z`).getUTCDay(), 6, `${saturday} is a Saturday`);
    assert.ok(list.length >= 1 && list.length <= 5, `${saturday}: 3 picks plus up to 2 standbys`);
    assert.equal(new Set(list.map(entry => entry.id)).size, list.length, `${saturday}: no repeated picks`);
    for (const { id, reason } of list) {
      const match = COMPLETE_EVENTS.find(item => item.id === id);
      assert.ok(match, `${saturday}: ${id} is in the catalog`);
      assert.ok([saturday, addCalendarDays(saturday, 1)].some(day => eventOccursOn(match, day)), `${id} occurs that weekend`);
      assert.ok(reason.zh.trim() && [...reason.zh].length <= 20, `${id}: Chinese reason has 1–20 characters`);
      assert.ok(reason.en.trim() && !CJK.test(reason.en), `${id}: English reason is plain English`);
    }
  }
  for (const id of WEEKEND_FLAGSHIP_IDS) assert.ok(COMPLETE_EVENTS.some(item => item.id === id), `flagship ${id} is in the catalog`);
});

test('before the weekend, the editor picks lead in their order with reasons', () => {
  const weekend = getHomeWeekend('2026-10-08', COMPLETE_EVENTS, { picks: OCTOBER_10 });
  assert.deepEqual(ids(weekend.picks), ['san-francisco-fleet-week-2026', 'burlingame-mandarin-storytime-2026', 'fremont-ardenwood-harvest-2026']);
  assert.deepEqual(weekend.picks.map(pick => pick.editorial?.rank), [1, 2, 3]);
  assert.deepEqual(weekend.picks.map(pick => pick.editorial?.reason), OCTOBER_10['2026-10-10'].slice(0, 3).map(entry => entry.reason));
  assert.ok(weekend.picks.every(pick => pick.date === '2026-10-10'), 'each pick shows its first remaining weekend day');
});

test('on Sunday a Saturday-only pick drops and the standby moves up', () => {
  const weekend = getHomeWeekend('2026-10-11', COMPLETE_EVENTS, { picks: OCTOBER_10 });
  assert.deepEqual(ids(weekend.picks), ['san-francisco-fleet-week-2026', 'fremont-ardenwood-harvest-2026', 'sf-italian-heritage-parade-2026']);
  assert.deepEqual(weekend.picks.map(pick => pick.editorial?.rank), [1, 3, 4]);
  assert.ok(weekend.picks.every(pick => pick.date === '2026-10-11'));
});

test('editor picks the catalog cannot show are skipped and the rest is filled automatically', () => {
  const catalog = [
    event('sf-pick'), event('peninsula-saturday', { region: 'peninsula', endDate: '2026-10-10' }), event('ended', { startDate: '2026-10-01', endDate: '2026-10-05' }),
    event('sf-other', { cost: 'free' }), event('east-fill', { region: 'east-bay' }), event('east-second', { region: 'east-bay', cost: 'unknown' }),
  ];
  const picks = { '2026-10-10': [
    { id: 'not-in-catalog', reason: { zh: '不存在', en: 'Missing' } }, { id: 'ended', reason: { zh: '已结束', en: 'Ended' } },
    { id: 'sf-pick', reason: { zh: '第一', en: 'First' } }, { id: 'sf-pick', reason: { zh: '重复', en: 'Repeat' } },
    { id: 'peninsula-saturday', reason: { zh: '周六', en: 'Saturday' } },
  ] };
  const saturday = getHomeWeekend('2026-10-08', catalog, { picks });
  assert.deepEqual(ids(saturday.picks), ['sf-pick', 'peninsula-saturday', 'east-fill'], 'the fill prefers a region not yet shown');
  assert.deepEqual(saturday.picks.map(pick => pick.editorial?.rank), [3, 5, undefined]);
  const sunday = getHomeWeekend('2026-10-11', catalog, { picks });
  assert.deepEqual(ids(sunday.picks), ['sf-pick', 'east-fill', 'sf-other']);
  assert.equal(new Set(ids(sunday.picks)).size, 3, 'no event appears twice');
  // A regional share card keeps only that region's picks.
  const eastBay = getHomeWeekend('2026-10-08', catalog.filter(item => item.region === 'east-bay'), { picks });
  assert.deepEqual(ids(eastBay.picks), ['east-fill', 'east-second']);
  assert.ok(eastBay.picks.every(pick => !pick.editorial));
});

test('the automatic ranking scores what readers value, not the end date or the alphabet', () => {
  const photos = new Set(['photo']);
  const options = { hasPhoto: (key: string) => photos.has(key), flagships: new Set<string>() };
  const entry = (item: MonthlyEvent) => ({ event: item, date: '2026-10-10' });
  const freeFamily = entry(event('zz-free-family', { cost: 'free', category: 'family', imageKey: 'photo' }));
  const paid = entry(event('aa-paid'));
  const longFestival = entry(event('mm-month-long', { startDate: '2026-10-01', endDate: '2026-10-31', cost: 'free', audience: ['亲子家庭'] }));
  const oneDay = entry(event('ab-one-day', { endDate: '2026-10-10', cost: 'mixed' }));
  const chinese = entry(event('yy-mandarin', { title: '中英双语故事时间', cost: 'unknown' }));
  const ranked = rankWeekendFallback([paid, oneDay, longFestival, chinese, freeFamily], '2026-10-10', options);
  assert.deepEqual(ids(ranked), ['zz-free-family', 'mm-month-long', 'yy-mandarin', 'ab-one-day', 'aa-paid']);
  assert.deepEqual(ids(rankWeekendFallback([...ranked].reverse(), '2026-10-10', options)), ids(ranked), 'input order does not matter');
  // Flagship events listed by editors get a boost.
  assert.equal(rankWeekendFallback([freeFamily, paid], '2026-10-10', { ...options, flagships: new Set(['aa-paid']) })[0], freeFamily);
  assert.equal(rankWeekendFallback([paid, oneDay], '2026-10-10', { ...options, flagships: new Set(['aa-paid']) })[0], paid);
  // Equal scores rotate by weekend instead of following the alphabet.
  const ties = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(id => entry(event(`tie-${id}`)));
  const weekA = ids(rankWeekendFallback(ties, '2026-10-10', options)), weekB = ids(rankWeekendFallback(ties, '2026-10-17', options));
  assert.notDeepEqual(weekA, weekB);
  assert.notDeepEqual(weekA, ids(ties));
});

test('adult-only events wait until nothing else is left, and regions vary', () => {
  const entry = (item: MonthlyEvent) => ({ event: item, date: '2026-10-10' });
  const wine = entry(event('wine-walk', { cost: 'free', imageKey: 'photo', audience: ['21岁以上品酒者'], region: 'north-bay' }));
  assert.ok(isAdultOnly(wine.event));
  assert.ok(!isAdultOnly(event('oktoberfest', { audience: ['亲子家庭', '饮酒21+'] })), 'a drinks note is not an adult-only event');
  const sf = ['one', 'two', 'three'].map(id => entry(event(`sf-${id}`, { cost: 'free', category: 'family' })));
  const east = entry(event('east-plain', { region: 'east-bay' }));
  const pick = (entries: typeof sf) => ids(selectWeekendFallback(entries, { weekendStart: '2026-10-10', count: 3, hasPhoto: key => key === 'photo' }));
  const chosen = pick([wine, ...sf, east]);
  assert.ok(!chosen.includes('wine-walk'));
  assert.ok(chosen.includes('east-plain'), 'one per region before a second from the same region');
  assert.equal(chosen.length, 3);
  assert.deepEqual(pick([wine]), ['wine-walk'], 'an adult-only event still shows when it is the only one');
  assert.deepEqual(pick([wine, east]), ['east-plain', 'wine-walk']);
  assert.deepEqual(ids(selectWeekendFallback([sf[0], east], { weekendStart: '2026-10-10', count: 1, usedRegions: ['sf'] })), ['east-plain'], 'regions already shown by editor picks count');
});

test('every home snapshot equals the build selection, so the home page and the share card agree', () => {
  const snapshots = HOME_WEEKENDS as Record<string, { ids: string[]; total: number }>;
  for (const day of Object.keys(snapshots)) assert.deepEqual(snapshots[day].ids, ids(getBuildWeekend(day, COMPLETE_EVENTS).picks), day);
});

test('the dated share card is linked only on days it is generated for', () => {
  const snapshots = { '2026-10-08': {}, '2026-10-11': {}, '2026-10-12': {}, '2026-10-20': {} };
  assert.deepEqual(getWeeklyCardDays('2026-10-08', snapshots), ['2026-10-08', '2026-10-11', '2026-10-12']);
  assert.equal(getWeeklyCardHref('2026-10-11', '2026-10-08', snapshots), '/weekly/all-2026-10-11.png');
  assert.equal(getWeeklyCardHref('2026-10-09', '2026-10-08', snapshots), '/weekly/all.png', 'no snapshot for that day');
  assert.equal(getWeeklyCardHref('2026-10-20', '2026-10-08', snapshots), '/weekly/all.png', 'outside the generated week');
  assert.equal(getWeeklyCardHref('2026-10-07', '2026-10-08', snapshots), '/weekly/all.png');
});

test('the home weekend code stays free of the full event and image catalogs', () => {
  for (const file of ['src/lib/home-weekend.ts', 'src/lib/weekend-ranking.ts', 'src/data/weekend-picks.ts', 'src/components/HomeDiscovery.tsx']) {
    const imports = [...readFileSync(file, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)].map(match => match[1]);
    for (const heavy of ['monthly-edition', 'guide-media', 'offer-media', 'home-weekend-build']) assert.ok(!imports.some(path => path.endsWith(heavy)), `${file} must not import ${heavy}`);
  }
});
