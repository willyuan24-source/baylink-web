import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { MonthlyEvent } from '../src/data/monthly-types';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { PUBLIC_CATALOG_FILES } from '../src/data/public-catalog-holdout';
import { WEEKEND_PICKS } from '../src/data/weekend-picks';
import { addCalendarDays } from '../src/lib/event-calendar';
import { buildWeekendPicksExport, type WeekendPicksFile } from '../src/lib/weekend-picks-export';

type CatalogRow = { id: string; startDate: string; endDate: string; occurrenceDates?: string[] };
// A Windows checkout may hold the generated files with CRLF endings; the export itself writes LF.
const text = (file: string) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const exported = JSON.parse(text(PUBLIC_CATALOG_FILES.apiWeekendPicks)) as WeekendPicksFile;
const apiEvents = new Map((JSON.parse(text(PUBLIC_CATALOG_FILES.apiEvents)) as CatalogRow[]).map(row => [row.id, row]));
const planning = new Map(PLANNER_EVENTS.map(event => [event.id, event.planning]));

test('public/weekend-picks.json is the current export of src/data/weekend-picks.ts (npm run export:picks)', () => {
  assert.match(exported.generatedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(exported, buildWeekendPicksExport(exported.generatedAt, WEEKEND_PICKS, MONTHLY_EVENTS, id => planning.get(id)));
  assert.match(JSON.parse(text('package.json')).scripts.build as string, /npm run export:picks/, 'the build regenerates it');
});

test('the export carries the editor picks as written, in their order, for every weekend not yet over', () => {
  const current = Object.entries(WEEKEND_PICKS).filter(([saturday]) => addCalendarDays(saturday, 1) >= exported.generatedAt).sort(([a], [b]) => a.localeCompare(b));
  assert.deepEqual(exported.weekends.map(weekend => weekend.start), current.map(([saturday]) => saturday), 'one entry per current weekend, passed ones left out');
  for (const [saturday, list] of current) {
    const weekend = exported.weekends.find(item => item.start === saturday)!;
    const written = new Map(list.map(entry => [entry.id, entry.reason]));
    assert.deepEqual(weekend.picks.map(pick => pick.id), list.map(entry => entry.id).filter(id => weekend.picks.some(pick => pick.id === id)), `${saturday}: editor order kept`);
    assert.ok(weekend.picks.length >= Math.min(3, list.length), `${saturday}: the three shown picks are all there`);
    weekend.picks.forEach((pick, index) => {
      assert.equal(pick.kind, 'event');
      assert.equal(pick.rank, index + 1, `${saturday}/${pick.id}: rank is the editor's order`);
      assert.deepEqual({ zh: pick.reason_zh, en: pick.reason_en }, written.get(pick.id), `${saturday}/${pick.id}: reason as the editor wrote it`);
      assert.equal(typeof pick.elderFriendly, 'boolean');
    });
  }
});

test('every exported pick is an event the API catalog has, on the weekend it is listed under', () => {
  for (const { start, end, picks } of exported.weekends) {
    assert.equal(new Date(`${start}T12:00:00Z`).getUTCDay(), 6, `${start} is a Saturday`);
    assert.equal(end, addCalendarDays(start, 1), `${start}: the weekend ends on Sunday`);
    for (const pick of picks) {
      const row = apiEvents.get(pick.id);
      assert.ok(row, `${pick.id} is in public/event-catalog.json`);
      assert.ok(pick.dates.length >= 1 && pick.dates.length <= 2, `${pick.id}: one or both weekend days`);
      for (const day of pick.dates) {
        assert.ok(day === start || day === end, `${pick.id}: ${day} is within ${start}–${end}`);
        assert.ok(day >= row.startDate && day <= row.endDate && (row.occurrenceDates?.includes(day) ?? true), `${pick.id} runs on ${day}`);
      }
    }
  }
});

test('the export leaves out passed weekends and picks that are not on their weekend, and ranks what is left', () => {
  const event = (id: string, overrides: Partial<MonthlyEvent> = {}): MonthlyEvent => ({
    id, title: id, startDate: '2026-11-07', endDate: '2026-11-07', dateLabel: '11/7', region: 'sf', city: 'San Francisco', venue: 'Venue',
    category: 'culture', cost: 'paid', costLabel: '$10', summary: '', plan: [], audience: [], officialUrl: 'https://example.com/', sourceLabel: 'Official',
    verifiedAt: '2026-10-01', imageKey: 'none', ...overrides,
  });
  const reason = (zh: string) => ({ zh, en: zh });
  const events = [
    event('old', { startDate: '2026-10-31', endDate: '2026-10-31' }),
    event('saturday'),
    event('sunday', { startDate: '2026-11-08', endDate: '2026-11-08' }),
    event('later', { startDate: '2026-11-14', endDate: '2026-11-14' }),
    event('seniors', { startDate: '2026-11-07', endDate: '2026-11-08', audience: ['长者'] }),
  ];
  const file = buildWeekendPicksExport('2026-11-02', {
    '2026-10-31': [{ id: 'old', reason: reason('过期') }],
    '2026-11-07': [{ id: 'later', reason: reason('不在本周末') }, { id: 'missing', reason: reason('不在目录') }, { id: 'sunday', reason: reason('周日') },
      { id: 'saturday', reason: reason('周六') }, { id: 'seniors', reason: reason('长者') }],
  }, events);
  assert.deepEqual(file, { generatedAt: '2026-11-02', weekends: [{ start: '2026-11-07', end: '2026-11-08', picks: [
    { id: 'sunday', kind: 'event', rank: 1, dates: ['2026-11-08'], reason_zh: '周日', reason_en: '周日', elderFriendly: false },
    { id: 'saturday', kind: 'event', rank: 2, dates: ['2026-11-07'], reason_zh: '周六', reason_en: '周六', elderFriendly: false },
    { id: 'seniors', kind: 'event', rank: 3, dates: ['2026-11-07', '2026-11-08'], reason_zh: '长者', reason_en: '长者', elderFriendly: true },
  ] }] });
  // On its Sunday a weekend is still current.
  assert.deepEqual(buildWeekendPicksExport('2026-11-08', { '2026-11-07': [{ id: 'sunday', reason: reason('周日') }] }, events).weekends.map(weekend => weekend.start), ['2026-11-07']);
  assert.deepEqual(buildWeekendPicksExport('2026-11-09', { '2026-11-07': [{ id: 'sunday', reason: reason('周日') }] }, events).weekends, []);
});
