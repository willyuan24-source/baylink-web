import assert from 'node:assert/strict';
import test from 'node:test';
import { getGuideBySlug } from '../src/data/guides';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { MONTHLY_EDITION, MONTHLY_EVENTS } from '../src/data/monthly-edition';
import type { MonthlyEvent } from '../src/data/monthly-types';
import { buildEventCalendar, filterMonthlyEvents, getBayAreaToday, getEventStatus, isEditionCurrent } from '../src/lib/monthly';

const event = (id: string): MonthlyEvent => {
  const found = MONTHLY_EVENTS.find(item => item.id === id);
  assert.ok(found, `Missing event ${id}`);
  return found;
};
const ids = (events: MonthlyEvent[]) => events.map(item => item.id).sort();
const unfold = (calendar: string) => calendar.replace(/\r\n[ \t]/g, '');
const field = (calendar: string, property: string) => {
  const line = unfold(calendar).split('\r\n').find(item => item.startsWith(`${property}:`));
  assert.ok(line, `Missing calendar property ${property}`);
  return line.slice(property.length + 1);
};
const decodeText = (text: string) => text.replace(/\\([nN,;\\])/g, (_, escaped: string) => /[nN]/.test(escaped) ? '\n' : escaped);

test('Bay Area dates respect UTC midnight boundaries in summer and winter', () => {
  const cases = [
    ['2026-09-01T06:59:59Z', '2026-08-31'],
    ['2026-09-01T07:00:00Z', '2026-09-01'],
    ['2026-10-01T06:59:59Z', '2026-09-30'],
    ['2026-10-01T07:00:00Z', '2026-10-01'],
    ['2026-01-01T07:59:59Z', '2025-12-31'],
    ['2026-01-01T08:00:00Z', '2026-01-01'],
  ];
  for (const [instant, expected] of cases) assert.equal(getBayAreaToday(new Date(instant)), expected, instant);
});

test('Bay Area date conversion follows the daylight saving transitions', () => {
  const cases = [
    ['2026-03-08T07:59:59Z', '2026-03-07'],
    ['2026-03-08T08:00:00Z', '2026-03-08'],
    ['2026-03-09T06:59:59Z', '2026-03-08'],
    ['2026-03-09T07:00:00Z', '2026-03-09'],
    ['2026-11-01T06:59:59Z', '2026-10-31'],
    ['2026-11-01T07:00:00Z', '2026-11-01'],
    ['2026-11-02T07:59:59Z', '2026-11-01'],
    ['2026-11-02T08:00:00Z', '2026-11-02'],
  ];
  for (const [instant, expected] of cases) assert.equal(getBayAreaToday(new Date(instant)), expected, instant);
});

test('September edition is current throughout its local month and archived after it', () => {
  assert.equal(MONTHLY_EDITION.month, '2026-09');
  assert.equal(isEditionCurrent('2026-09-01'), true);
  assert.equal(isEditionCurrent('2026-09-30'), true);
  assert.equal(isEditionCurrent('2026-08-31'), false);
  assert.equal(isEditionCurrent('2026-10-01'), false);
  assert.equal(isEditionCurrent('2027-09-08'), false);
  assert.equal(isEditionCurrent(getBayAreaToday(new Date('2026-10-01T06:59:59Z'))), true);
  assert.equal(isEditionCurrent(getBayAreaToday(new Date('2026-10-01T07:00:00Z'))), false);
});

test('activity status includes both the first and final local date', () => {
  const weekend = event('mountain-view-art-wine-2026');
  assert.equal(getEventStatus(weekend, '2026-09-11'), 'upcoming');
  assert.equal(getEventStatus(weekend, '2026-09-12'), 'ongoing');
  assert.equal(getEventStatus(weekend, '2026-09-13'), 'ongoing');
  assert.equal(getEventStatus(weekend, '2026-09-14'), 'ended');
  const oneDay = event('bark-in-the-park-san-jose-2026');
  assert.equal(getEventStatus(oneDay, '2026-09-18'), 'upcoming');
  assert.equal(getEventStatus(oneDay, '2026-09-19'), 'ongoing');
  assert.equal(getEventStatus(oneDay, '2026-09-20'), 'ended');
});

test('ended events disappear by default and can be restored for archival reading', () => {
  const selected = [event('mountain-view-art-wine-2026'), event('bark-in-the-park-san-jose-2026')];
  assert.deepEqual(ids(filterMonthlyEvents(selected, {}, '2026-09-13')), ['bark-in-the-park-san-jose-2026', 'mountain-view-art-wine-2026']);
  assert.deepEqual(ids(filterMonthlyEvents(selected, {}, '2026-09-14')), ['bark-in-the-park-san-jose-2026']);
  assert.deepEqual(filterMonthlyEvents(selected, {}, '2026-09-20'), []);
  assert.deepEqual(ids(filterMonthlyEvents(selected, { includeEnded: true }, '2026-10-01')), ids(selected));
  assert.equal(filterMonthlyEvents(MONTHLY_EVENTS, { region: 'all', cost: 'all' }, '2026-09-08').length, 9);
});

test('region and free admission filters combine while retaining separately paid food notices', () => {
  assert.deepEqual(ids(filterMonthlyEvents(MONTHLY_EVENTS, { region: 'south-bay', cost: 'free' }, '2026-09-08')), [
    'bark-in-the-park-san-jose-2026', 'mountain-view-art-wine-2026',
  ]);
  assert.deepEqual(ids(filterMonthlyEvents(MONTHLY_EVENTS, { region: 'east-bay', cost: 'free' }, '2026-09-08')), ['lafayette-art-wine-2026']);
  assert.deepEqual(filterMonthlyEvents(MONTHLY_EVENTS, { region: 'north-bay', cost: 'free' }, '2026-09-08'), []);
  assert.deepEqual(ids(filterMonthlyEvents(MONTHLY_EVENTS, { region: 'south-bay', cost: 'free' }, '2026-09-14')), ['bark-in-the-park-san-jose-2026']);
  assert.match(event('mountain-view-art-wine-2026').costLabel, /另付/);
  assert.match(event('lafayette-art-wine-2026').costLabel, /另付/);
  assert.match(event('bark-in-the-park-san-jose-2026').costLabel, /建议.*捐款/);
});

test('calendar date reminders use an exclusive end date for single and multi-day events', () => {
  const oneDay = buildEventCalendar(event('bark-in-the-park-san-jose-2026'));
  assert.equal(field(oneDay, 'DTSTART;VALUE=DATE'), '20260919');
  assert.equal(field(oneDay, 'DTEND;VALUE=DATE'), '20260920');
  const weekend = buildEventCalendar(event('mountain-view-art-wine-2026'));
  assert.equal(field(weekend, 'DTSTART;VALUE=DATE'), '20260912');
  assert.equal(field(weekend, 'DTEND;VALUE=DATE'), '20260914');
});

test('calendar end dates roll across months, years and leap days without time zone drift', () => {
  const cases = [
    ['2026-09-30', '20261001'],
    ['2026-12-31', '20270101'],
    ['2028-02-28', '20280229'],
    ['2028-02-29', '20280301'],
    ['2026-03-08', '20260309'],
    ['2026-11-01', '20261102'],
  ];
  for (const [date, expected] of cases) {
    const calendar = buildEventCalendar({ ...event('bark-in-the-park-san-jose-2026'), startDate: date, endDate: date });
    assert.equal(field(calendar, 'DTEND;VALUE=DATE'), expected, date);
  }
});

test('calendar reminders clearly avoid inventing opening hours, tickets or a busy all-day appointment', () => {
  const item = event('opera-in-the-park-2026');
  const calendar = buildEventCalendar(item);
  assert.match(decodeText(field(calendar, 'SUMMARY')), /日期提醒/);
  assert.match(decodeText(field(calendar, 'DESCRIPTION')), /不代表全天开放、预约或购票/);
  assert.equal(field(calendar, 'TRANSP'), 'TRANSPARENT');
  assert.equal(field(calendar, 'URL'), item.officialUrl);
  assert.equal(calendar.includes('DTSTART;TZID='), false);
  assert.equal(calendar.includes('DTSTART:20260913T000000'), false);
});

test('calendar uses CRLF and folds every physical line within 75 UTF-8 bytes', () => {
  const item = { ...event('bark-in-the-park-san-jose-2026'), title: '湾区活动中文🎹'.repeat(18), summary: '一起去看艺术、吃午餐，再坐车回家🌉。'.repeat(30) };
  const calendar = buildEventCalendar(item);
  assert.equal(calendar.endsWith('\r\n'), true);
  assert.equal(calendar.replace(/\r\n/g, '').includes('\n'), false);
  assert.equal(calendar.replace(/\r\n/g, '').includes('\r'), false);
  assert.ok(calendar.includes('\r\n '), 'long Chinese text must be folded');
  for (const line of calendar.split('\r\n')) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `overlong physical line: ${Buffer.byteLength(line, 'utf8')} bytes`);
    assert.equal(Buffer.from(line, 'utf8').toString('utf8'), line, 'folding must not split a surrogate pair');
  }
  assert.equal(decodeText(field(calendar, 'SUMMARY')), `${item.title}（日期提醒）`);
  assert.ok(decodeText(field(calendar, 'DESCRIPTION')).includes(item.summary));
  assert.equal(calendar.includes('\uFFFD'), false);
});

test('calendar text escaping preserves Chinese, commas, semicolons, backslashes and line breaks', () => {
  const item = { ...event('bark-in-the-park-san-jose-2026'), title: '艺术,音乐;湾区\\周末\n第二行🎹', venue: 'A, B; C\\D', summary: '第一行\r\n第二行,含分号;和反斜线\\' };
  const calendar = buildEventCalendar(item);
  assert.equal(decodeText(field(calendar, 'SUMMARY')), `${item.title}（日期提醒）`);
  assert.equal(decodeText(field(calendar, 'LOCATION')), `${item.venue}, ${item.city}`);
  assert.ok(decodeText(field(calendar, 'DESCRIPTION')).includes(item.summary.replace(/\r\n/g, '\n')));
  assert.equal(unfold(calendar).split('\r\n').filter(line => line === 'BEGIN:VEVENT').length, 1);
  assert.equal(unfold(calendar).split('\r\n').filter(line => line === 'END:VEVENT').length, 1);
});

test('the nine published activities have unique IDs, valid September dates and first-party source metadata', () => {
  const officialHosts = new Set(['gggp.org', 'www.sfopera.com', 'www.sfmta.com', 'www.moonfestival.org', 'www.portolamusicfestival.com', 'www.mvartwine.com', 'lafayettefestival.com', 'www.barksanjose.org', 'www.mvfaf.org']);
  assert.equal(MONTHLY_EVENTS.length, 9);
  assert.equal(new Set(MONTHLY_EVENTS.map(item => item.id)).size, 9);
  for (const item of MONTHLY_EVENTS) {
    assert.match(item.id, /^[a-z0-9-]+$/);
    for (const date of [item.startDate, item.endDate]) {
      assert.match(date, /^2026-09-\d{2}$/);
      assert.equal(new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10), date, `valid date: ${item.id}`);
    }
    assert.ok(item.startDate <= item.endDate, item.id);
    assert.ok(item.endDate >= MONTHLY_EDITION.checkedAt, `${item.id} was still upcoming when verified`);
    assert.equal(item.verifiedAt, MONTHLY_EDITION.checkedAt);
    const source = new URL(item.officialUrl);
    assert.equal(source.protocol, 'https:');
    assert.ok(officialHosts.has(source.hostname), `first-party host for ${item.id}`);
    assert.ok(item.sourceLabel.trim());
    assert.ok(item.title.trim() && item.summary.trim() && item.venue.trim() && item.city.trim());
    assert.equal(item.plan.length, 3);
    assert.ok(item.plan.every(step => step.trim().length > 10));
  }
});

test('published activities reference available guide images and existing related articles', () => {
  for (const item of MONTHLY_EVENTS) {
    assert.ok(GUIDE_IMAGES[item.imageKey], `${item.id} image key exists`);
    if (item.relatedGuideSlug) assert.ok(getGuideBySlug(item.relatedGuideSlug), `${item.id} related guide exists`);
    const calendar = buildEventCalendar(item);
    assert.equal(field(calendar, 'UID'), `${item.id}@baylink.us`);
    for (const line of calendar.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `${item.id} calendar line length`);
  }
});
