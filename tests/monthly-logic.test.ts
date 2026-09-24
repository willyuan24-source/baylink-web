import assert from 'node:assert/strict';
import test from 'node:test';
import { getGuideBySlug } from '../src/data/guides';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { MONTHLY_EDITION, MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { additionalOctoberEvents } from '../src/data/october-events-extra';
import { regionalSeptemberEvents } from '../src/data/monthly-region-events';
import extraEnglish from '../src/data/october-events-extra-en.json';
import refreshedEnglish from '../src/data/autumn-refresh-events-en.json';
import type { MonthlyEvent } from '../src/data/monthly-types';
import { buildEventCalendar, filterMonthlyEvents, getBayAreaToday, getEventStatus, getMonthlyDateRange, isEditionCurrent, resolveMonthlyDateFilter } from '../src/lib/monthly';

test('nonconsecutive programs filter and export only their confirmed dates', () => {
  const item = { ...MONTHLY_EVENTS[0], startDate: '2026-10-01', endDate: '2026-10-12', occurrenceDates: ['2026-10-02', '2026-10-09'] };
  assert.equal(getEventStatus(item, '2026-10-03'), 'upcoming');
  assert.equal(getEventStatus(item, '2026-10-09'), 'ongoing');
  assert.equal(getEventStatus(item, '2026-10-10'), 'ended');
  assert.deepEqual(filterMonthlyEvents([item], { date: 'today' }, '2026-10-03'), []);
  assert.deepEqual(filterMonthlyEvents([item], { date: 'weekend' }, '2026-10-03'), []);
  assert.deepEqual(filterMonthlyEvents([item], { date: 'next7' }, '2026-10-03'), [item]);
  const ics = buildEventCalendar(item).replace(/\r\n /g, '');
  assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 2);
  assert.match(ics, /DTSTART;VALUE=DATE:20261002\r\nDTEND;VALUE=DATE:20261003/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261009\r\nDTEND;VALUE=DATE:20261010/);
  assert.equal(new Set([...ics.matchAll(/UID:([^\r]+)/g)].map(match => match[1])).size, 2);
  assert.equal(buildEventCalendar({ ...item, occurrenceDates: [] }).includes('BEGIN:VEVENT'), false);
  const weekend = { ...item, startDate: '2026-10-03', occurrenceDates: ['2026-10-03', '2026-10-10'] };
  assert.deepEqual(filterMonthlyEvents([weekend], { date: 'weekend' }, '2026-10-04'), []);
  assert.deepEqual(filterMonthlyEvents([weekend], { date: 'weekend', includeEnded: true }, '2026-10-04'), [weekend]);
});

const event = (id: string): MonthlyEvent => {
  const found = MONTHLY_EVENTS.find(item => item.id === id) || regionalSeptemberEvents.find(item => item.id === id) || (id === 'mountain-view-art-wine-2026' ? { ...MONTHLY_EVENTS[0], id, region: 'south-bay', title: '历史活动日期边界测试', startDate: '2026-09-12', endDate: '2026-09-13', costLabel: '免费入场；餐饮另付' } : undefined);
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

test('fall edition stays current across September and October, then archives', () => {
  assert.equal(MONTHLY_EDITION.month, '2026-10');
  assert.equal(isEditionCurrent('2026-09-01'), true);
  assert.equal(isEditionCurrent('2026-09-30'), true);
  assert.equal(isEditionCurrent('2026-08-31'), false);
  assert.equal(isEditionCurrent('2026-10-01'), true);
  assert.equal(isEditionCurrent('2026-10-31'), true);
  assert.equal(isEditionCurrent('2026-11-01'), false);
  assert.equal(isEditionCurrent('2027-09-08'), false);
  assert.equal(isEditionCurrent(getBayAreaToday(new Date('2026-10-01T06:59:59Z'))), true);
  assert.equal(isEditionCurrent(getBayAreaToday(new Date('2026-10-01T07:00:00Z'))), true);
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
  assert.deepEqual(ids(filterMonthlyEvents(MONTHLY_EVENTS, { region: 'all', cost: 'all' }, '2026-09-08')), ids(MONTHLY_EVENTS));
});

test('region and free admission filters combine while retaining separately paid food notices', () => {
  const base = event('mountain-view-art-wine-2026');
  const selected: MonthlyEvent[] = [
    { ...base, id: 'south-free-weekend', region: 'south-bay', cost: 'free', startDate: '2026-09-12', endDate: '2026-09-13' },
    { ...base, id: 'south-free-later', region: 'south-bay', cost: 'free', startDate: '2026-09-19', endDate: '2026-09-19' },
    { ...base, id: 'south-paid', region: 'south-bay', cost: 'paid', startDate: '2026-09-12', endDate: '2026-09-13' },
    { ...base, id: 'east-free', region: 'east-bay', cost: 'free', startDate: '2026-09-19', endDate: '2026-09-20' },
    { ...base, id: 'north-paid', region: 'north-bay', cost: 'paid', startDate: '2026-09-19', endDate: '2026-09-20' },
    { ...base, id: 'sf-free', region: 'sf', cost: 'free', startDate: '2026-09-26', endDate: '2026-09-26' },
    { ...base, id: 'sf-mixed', region: 'sf', cost: 'mixed', startDate: '2026-09-12', endDate: '2026-09-13' },
  ];
  assert.deepEqual(ids(filterMonthlyEvents(selected, { region: 'south-bay', cost: 'free' }, '2026-09-08')), ['south-free-later', 'south-free-weekend']);
  assert.deepEqual(ids(filterMonthlyEvents(selected, { region: 'east-bay', cost: 'free' }, '2026-09-08')), ['east-free']);
  assert.deepEqual(filterMonthlyEvents(selected, { region: 'north-bay', cost: 'free' }, '2026-09-08'), []);
  assert.deepEqual(ids(filterMonthlyEvents(selected, { region: 'sf', cost: 'free' }, '2026-09-09')), ['sf-free']);
  assert.deepEqual(ids(filterMonthlyEvents(selected, { region: 'sf', cost: 'mixed' }, '2026-09-09')), ['sf-mixed']);
  assert.deepEqual(ids(filterMonthlyEvents(selected, { region: 'south-bay', cost: 'free' }, '2026-09-14')), ['south-free-later']);
  assert.match(event('mountain-view-art-wine-2026').costLabel, /另付/);
  assert.match(event('lafayette-art-wine-2026').costLabel, /另付/);
  assert.match(event('bark-in-the-park-san-jose-2026').costLabel, /建议.*捐款/);
});

test('this weekend keeps the current Saturday and Sunday, including on Sunday itself', () => {
  for (const today of ['2026-09-07', '2026-09-11', '2026-09-12', '2026-09-13']) {
    assert.deepEqual(getMonthlyDateRange('weekend', today), { start: '2026-09-12', end: '2026-09-13' }, today);
  }
  assert.deepEqual(getMonthlyDateRange('weekend', '2026-09-14'), { start: '2026-09-19', end: '2026-09-20' });
  assert.deepEqual(getMonthlyDateRange('weekend', '2026-01-31'), { start: '2026-01-31', end: '2026-02-01' });
  assert.deepEqual(getMonthlyDateRange('weekend', '2026-12-31'), { start: '2027-01-02', end: '2027-01-03' });
  assert.deepEqual(getMonthlyDateRange('weekend', '2028-12-31'), { start: '2028-12-30', end: '2028-12-31' });
});

test('next seven days means today plus six calendar dates across DST, leap days and year changes', () => {
  for (const [today, end] of [
    ['2026-09-09', '2026-09-15'], ['2026-09-29', '2026-10-05'],
    ['2026-12-29', '2027-01-04'], ['2028-02-27', '2028-03-04'],
    ['2026-03-06', '2026-03-12'], ['2026-10-30', '2026-11-05'],
  ]) {
    assert.deepEqual(getMonthlyDateRange('next7', today), { start: today, end }, today);
    assert.deepEqual(getMonthlyDateRange('today', today), { start: today, end: today }, today);
  }
  assert.equal(getMonthlyDateRange('all', '2026-09-09'), null);
  for (const value of [null, undefined, '', 'unknown', 'WEEKEND']) assert.equal(resolveMonthlyDateFilter(value), 'all');
  for (const value of ['today', 'weekend', 'next7', 'september', 'october'] as const) assert.equal(resolveMonthlyDateFilter(value), value);
});

test('date filtering includes overlapping events and both endpoints, and combines all other choices', () => {
  const base = event('mountain-view-art-wine-2026');
  const make = (id: string, startDate: string, endDate = startDate, cost: MonthlyEvent['cost'] = 'free'): MonthlyEvent => ({ ...base, id, startDate, endDate, cost });
  const selected = [
    make('before', '2026-09-08'), make('first', '2026-09-09'), make('last', '2026-09-15'), make('after', '2026-09-16'),
    make('spans-window', '2026-09-01', '2026-09-30'), make('paid', '2026-09-12', '2026-09-13', 'paid'),
    make('saturday-only', '2026-09-12'), make('sunday-only', '2026-09-13'),
  ];
  assert.deepEqual(ids(filterMonthlyEvents(selected, { date: 'next7', includeEnded: true }, '2026-09-09')), ['first', 'last', 'paid', 'saturday-only', 'spans-window', 'sunday-only']);
  assert.deepEqual(ids(filterMonthlyEvents(selected, { date: 'today' }, '2026-09-15')), ['last', 'spans-window']);
  assert.deepEqual(ids(filterMonthlyEvents(selected, { date: 'weekend', region: 'south-bay', cost: 'free' }, '2026-09-13')), ['spans-window', 'sunday-only']);
  assert.deepEqual(ids(filterMonthlyEvents(selected, { date: 'weekend', region: 'south-bay', cost: 'free', includeEnded: true }, '2026-09-13')), ['saturday-only', 'spans-window', 'sunday-only']);
  assert.deepEqual(filterMonthlyEvents(selected, { date: 'weekend', region: 'sf' }, '2026-09-13'), []);
  assert.deepEqual(filterMonthlyEvents(selected, { date: 'today', includeEnded: true }, '2026-10-01'), [], 'archive visibility must not bypass an explicitly selected date');
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
  const item = event('bark-in-the-park-san-jose-2026');
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

test('published activities have unique IDs, valid fall dates and traceable source metadata', () => {
  const publishedIds = new Set(MONTHLY_EVENTS.map(item => item.id));
  for (const expectedId of [
    'portola-2026', 'redwood-oktoberfest-closing-weekend-2026',
    'pacific-coast-fog-fest-2026', 'presidio-chuseok-festival-2026', 'sonoma-farm-trails-fall-tour-2026', 'petaluma-fall-antique-faire-2026',
  ]) assert.ok(publishedIds.has(expectedId), `${expectedId} stays available as the edition grows`);
  assert.equal(publishedIds.size, MONTHLY_EVENTS.length);
  for (const item of MONTHLY_EVENTS) {
    assert.match(item.id, /^[a-z0-9-]+$/);
    for (const date of [item.startDate, item.endDate]) {
      assert.match(date, /^2026-(09|10)-\d{2}$/);
      assert.equal(new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10), date, `valid date: ${item.id}`);
    }
    assert.ok(item.startDate <= item.endDate, item.id);
    assert.match(item.verifiedAt, /^2026-09-\d{2}$/);
    assert.equal(new Date(`${item.verifiedAt}T12:00:00Z`).toISOString().slice(0, 10), item.verifiedAt, `${item.id} has a valid verification date`);
    assert.ok(item.verifiedAt <= MONTHLY_EDITION.checkedAt, `${item.id} must not claim verification after the latest edition update`);
    assert.ok(item.endDate >= item.verifiedAt, `${item.id} had not ended when verified`);
    const source = new URL(item.officialUrl);
    assert.equal(source.protocol, 'https:');
    assert.ok(source.hostname.includes('.') && !source.hostname.endsWith('example.com'), item.id);
    assert.ok(item.endDate >= MONTHLY_EDITION.checkedAt && item.endDate <= '2026-10-31', item.id);
    assert.ok(item.sourceLabel.trim());
    assert.ok(item.title.trim() && item.summary.trim() && item.venue.trim() && item.city.trim());
    assert.equal(item.plan.length, 3);
    assert.ok(item.plan.every(step => step.trim().length > 10));
  }
  assert.ok(!publishedIds.has('treasure-island-coastal-cleanup-2026'), 'ended cleanup is no longer published');
});

test('published activities reference available guide images and existing related articles', () => {
  for (const item of MONTHLY_EVENTS) {
    if (item.imageKey) assert.ok(GUIDE_IMAGES[item.imageKey], `${item.id} image key exists`);
    if (item.relatedGuideSlug) assert.ok(getGuideBySlug(item.relatedGuideSlug), `${item.id} related guide exists`);
    const calendar = buildEventCalendar(item);
    assert.equal(field(calendar, 'UID'), `${item.id}${item.occurrenceDates ? `-${item.occurrenceDates[0]}` : ''}@baylink.us`);
    for (const line of calendar.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `${item.id} calendar line length`);
  }
});

test('explicit month filters include October 31 and remove September events from October', () => {
  assert.deepEqual(getMonthlyDateRange('september', '2026-10-15'), { start: '2026-09-01', end: '2026-09-30' });
  assert.deepEqual(getMonthlyDateRange('october', '2026-09-15'), { start: '2026-10-01', end: '2026-10-31' });
  const october = filterMonthlyEvents(MONTHLY_EVENTS, { date: 'october' }, '2026-09-15');
  assert.equal(october.length, 82);
  assert.ok(october.every(item => item.endDate >= '2026-10-01' && item.startDate <= '2026-10-31'));
  assert.ok(october.some(item => item.endDate === '2026-10-31'));
  const september = filterMonthlyEvents(MONTHLY_EVENTS, { date: 'september' }, '2026-09-15');
  assert.equal(september.length, 13);
  assert.ok(september.some(item => item.id === 'novato-youth-folk-dance-2026'));
  assert.ok(!october.some(item => item.id === 'novato-youth-folk-dance-2026'));
  assert.deepEqual(ids(september.filter(item => october.some(other => other.id === item.id))), ['ai-conference-sf-2026', 'petaluma-pumpkin-patch-2026']);
  assert.ok(september.some(item => item.id === 'pyladies-snowflake-ai-data-2026'));
  assert.ok(!october.some(item => item.id === 'pyladies-snowflake-ai-data-2026'));
  assert.equal(resolveMonthlyDateFilter('october'), 'october');
  assert.ok(!MONTHLY_EVENTS.some(item => item.endDate < '2026-09-15'));
});

test('late October dates retain verified community events and respect their final days', () => {
  const lastWeek = filterMonthlyEvents(MONTHLY_EVENTS, { date: 'next7' }, '2026-10-25');
  for (const id of ['emeryville-art-exhibition-closing-2026', 'santa-rosa-pumpkins-parks-2026', 'benicia-farmers-market-final-2026', 'san-jose-avenida-altares-2026']) {
    assert.ok(lastWeek.some(item => item.id === id), id);
  }
  assert.ok(!filterMonthlyEvents(MONTHLY_EVENTS, { date: 'today' }, '2026-10-26').some(item => item.id === 'emeryville-art-exhibition-closing-2026'));
  assert.deepEqual(ids(filterMonthlyEvents(MONTHLY_EVENTS, { date: 'today' }, '2026-10-31')), [
    'palo-alto-addams-family-opening-2026', 'petaluma-pumpkin-patch-2026', 'san-jose-avenida-altares-2026', 'sf-halloween-hoopla-2026',
  ]);
  assert.deepEqual(filterMonthlyEvents(MONTHLY_EVENTS, {}, '2026-11-01'), []);
  assert.deepEqual(ids(filterMonthlyEvents(MONTHLY_EVENTS, { includeEnded: true, date: 'october' }, '2026-11-01')),
    ids(filterMonthlyEvents(MONTHLY_EVENTS, { date: 'october' }, '2026-09-15')));
  assert.deepEqual(filterMonthlyEvents(MONTHLY_EVENTS, { includeEnded: true, date: 'today' }, '2026-11-01'), [], 'archive permission cannot bypass the requested day');
});

test('new community listings retain complete English text and clearly identify any illustrative media', () => {
  assert.equal(additionalOctoberEvents.length, 14);
  const mapping: Record<string, string> = { ...extraEnglish, ...refreshedEnglish };
  const texts = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(texts) : value && typeof value === 'object' ? Object.values(value).flatMap(texts) : [];
  for (const added of additionalOctoberEvents) {
    assert.equal(MONTHLY_EVENTS.filter(item => item.id === added.id).length, 1, added.id);
    if (added.imageKey) {
      const image = GUIDE_IMAGES[added.imageKey];
      assert.ok(image, `${added.id} references registered media`);
      assert.equal(image.kind, 'illustration', `${added.id} uses a theme illustration, not an unverified event photo`);
      assert.match(image.caption, /插图|插画/);
      assert.match(image.caption, /非|不代表|虚构|示意/);
    }
    assert.equal(added.verifiedAt, added.id === 'sf-family-connections-halloween-2026' ? '2026-09-23' : '2026-09-15');
    for (const value of texts(added).filter(value => /[\u4e00-\u9fff]/.test(value))) {
      assert.ok(mapping[value], 'English mapping exists: ' + value);
      assert.doesNotMatch(mapping[value], /[\u4e00-\u9fff]/, 'English text must not retain untranslated Chinese');
    }
  }
  assert.deepEqual(new Set(additionalOctoberEvents.map(item => item.region)), new Set(['sf', 'east-bay', 'south-bay', 'peninsula', 'north-bay']));
  assert.equal(event('windsor-trick-or-treat-trail-2026').cost, 'free');
  assert.match(event('windsor-trick-or-treat-trail-2026').costLabel, /预先登记/);
  assert.equal(event('santa-rosa-halloween-howarth-2026').cost, 'paid');
  assert.equal(event('benicia-farmers-market-final-2026').cost, 'mixed');
});

test('event photos keep their actual place and outdoor movies never borrow an indoor cinema image', () => {
  const realPlaces: [string, string, RegExp][] = [
    ['san-francisco-fleet-week-2026', 'sf-wharf', /Fisherman|渔人码头/],
    ['oakland-autumn-lights-festival-2026', 'region-lake-merritt', /Lake Merritt/],
    ['half-moon-bay-pumpkin-festival-2026', 'fresh-pumpkin-parade', /Half Moon Bay|半月湾/],
  ];
  for (const [id, key, place] of realPlaces) {
    const image = GUIDE_IMAGES[event(id).imageKey];
    assert.equal(event(id).imageKey, key, `${id} keeps the verified location photo`);
    assert.equal(image.kind, 'photo');
    assert.match(`${image.alt} ${image.caption}`, place);
    assert.equal(new URL(image.creditUrl!).protocol, 'https:');
  }
  for (const id of ['fremont-finding-nemo-outdoor-movie-2026', 'piedmont-wonka-outdoor-movie-2026']) {
    const image = GUIDE_IMAGES[event(id).imageKey];
    assert.equal(event(id).imageKey, 'outdoor-cinema');
    assert.equal(image.kind, 'illustration');
    assert.match(`${image.alt} ${image.caption}`, /露天|户外/);
    assert.match(image.caption, /非|不代表|虚构|示意/);
  }
  assert.equal(event('mill-valley-film-festival-2026').imageKey, 'cinema-night');
});

test('late-month calendars preserve actual selected dates without turning a closing weekend into a month-long booking', () => {
  const exhibition = buildEventCalendar(event('emeryville-art-exhibition-closing-2026'));
  assert.equal(field(exhibition, 'DTSTART;VALUE=DATE'), '20261023');
  assert.equal(field(exhibition, 'DTEND;VALUE=DATE'), '20261026');
  const halloween = buildEventCalendar(event('san-jose-avenida-altares-2026'));
  assert.equal(field(halloween, 'DTSTART;VALUE=DATE'), '20261031');
  assert.equal(field(halloween, 'DTEND;VALUE=DATE'), '20261101');
  assert.equal(field(halloween, 'TRANSP'), 'TRANSPARENT');
  assert.ok(decodeText(field(halloween, 'DESCRIPTION')).includes(event('san-jose-avenida-altares-2026').officialUrl));
});
