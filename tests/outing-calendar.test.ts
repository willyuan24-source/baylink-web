import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOutingCalendar, canExportOutingCalendar } from '../src/lib/outing-calendar';
import { buildEventCalendar } from '../src/lib/monthly';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import type { Outing } from '../src/lib/outings';
import { selectMyWeekOutings } from '../src/features/outings/my-week-outings-model';

const now = Date.parse('2026-10-16T18:00:00Z');
const fixture = (patch: Partial<Outing> = {}): Outing => ({
  id: 'calendar-fixture', title: '一起散步', description: 'Do not export the discussion context.', eventId: null,
  date: '2026-10-17', startTime: '14:00', endTime: '16:00', city: 'Fremont', venue: 'Public entrance',
  capacity: 3, costNote: 'Do not serialize arbitrary notes.', transport: 'transit', language: 'any',
  startAt: Date.parse('2026-10-17T21:00:00Z'), endAt: Date.parse('2026-10-17T23:00:00Z'), timezone: 'America/Los_Angeles',
  status: 'open', revision: 4, planVersion: 2, host: { id: 'host', nickname: 'Private host name', verified: true }, confirmedCount: 2,
  me: { userId: 'member', role: 'member', status: 'confirmed', confirmedVersion: 2 }, createdAt: now, updatedAt: now, ...patch,
});
const unfold = (value: string) => value.replace(/\r\n /g, '');

test('only the current host or a current-version confirmed member can export an open, unended outing', () => {
  const row = fixture();
  assert.equal(canExportOutingCalendar(row, 'member', now), true);
  assert.equal(canExportOutingCalendar(fixture({ me: null }), 'host', now), true);
  assert.equal(canExportOutingCalendar(row, 'member', row.startAt + 1), true, 'an ongoing outing has not ended');
  for (const item of [fixture({ status: 'cancelled' }), fixture({ status: 'completed' }), fixture({ endAt: now }),
    fixture({ me: null }), fixture({ me: { ...row.me!, status: 'requested' } }), fixture({ me: { ...row.me!, status: 'requested', waitlisted: true } }),
    fixture({ me: { ...row.me!, status: 'left' } }), fixture({ me: { ...row.me!, status: 'removed' } }),
    fixture({ me: { ...row.me!, confirmedVersion: 1 } }), fixture({ me: { ...row.me!, confirmedVersion: 3 } }), fixture({ startAt: Number.NaN })]) {
    assert.equal(canExportOutingCalendar(item, 'member', now), false);
    assert.throws(() => buildOutingCalendar(item, 'member', now));
  }
  for (const account of [null, undefined, '', 'someone-else']) assert.equal(canExportOutingCalendar(row, account, now), false);
  assert.equal(canExportOutingCalendar(row, 'host', now), false, 'a response scoped to another account must not be exported');
});

test('calendar uses exact UTC instants across Pacific DST and keeps UID stable while SEQUENCE changes', () => {
  const before = fixture({ date: '2026-10-31', startAt: Date.parse('2026-10-31T21:00:00Z'), endAt: Date.parse('2026-10-31T23:00:00Z') });
  const after = fixture({ date: '2026-11-02', startAt: Date.parse('2026-11-02T22:00:00Z'), endAt: Date.parse('2026-11-03T00:00:00Z'), planVersion: 3, me: { ...before.me!, confirmedVersion: 3 } });
  const first = unfold(buildOutingCalendar(before, 'member', now)), next = unfold(buildOutingCalendar(after, 'member', now));
  assert.match(first, /DTSTART:20261031T210000Z\r\nDTEND:20261031T230000Z/);
  assert.match(next, /DTSTART:20261102T220000Z\r\nDTEND:20261103T000000Z/);
  assert.equal(first.match(/^UID:.+$/m)?.[0], next.match(/^UID:.+$/m)?.[0]);
  assert.match(first, /SEQUENCE:2\r\n/); assert.match(next, /SEQUENCE:3\r\n/);
  assert.equal(first.includes('VALUE=DATE'), false); assert.equal(first.includes('TZID='), false);
});

test('calendar folds UTF-8 safely, escapes text injection and includes no members or application notes', () => {
  const row = fixture({ id: 'group\r\nATTENDEE:bad@example.test', title: `公园散步🌳${'中'.repeat(60)},入口;A\\B\r\nATTENDEE:fake`,
    members: [{ userId: 'member', nickname: 'Private member', role: 'member', status: 'confirmed', confirmedVersion: 2, note: 'PRIVATE_APPLICATION_4155550123' }],
    venue: '入口, A; B\\C\r\nDESCRIPTION:injected' });
  const file = buildOutingCalendar(row, 'member', now, 'en'), content = unfold(file);
  assert.ok(file.endsWith('\r\n')); assert.equal(file.replace(/\r\n/g, '').includes('\n'), false);
  for (const line of file.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, line);
  assert.equal(content.includes('\uFFFD'), false);
  assert.match(content, /SUMMARY:.*\\,入口\\;A\\\\B\\nATTENDEE:fake/);
  assert.match(content, /UID:outing-group%0D%0AATTENDEE%3Abad%40example.test@baylink.us/);
  assert.equal((content.match(/^BEGIN:VEVENT$/gm) || []).length, 1);
  assert.equal(/^ATTENDEE:/m.test(content), false);
  for (const privateText of ['PRIVATE_APPLICATION', 'Private member', 'Private host name', row.description, row.costNote]) assert.equal(content.includes(privateText), false);
  assert.match(content, /does not update automatically/); assert.match(content, /not a ticket or booking/);
});

test('My Week uses Pacific calendar days, sorts confirmed/host arrangements and separates pending requests', () => {
  const boundary = Date.parse('2026-11-01T06:30:00Z'); // Still Oct 31 in the Bay Area.
  const member = fixture().me!;
  const item = (id: string, date: string, start: string, patch: Partial<Outing> = {}) => fixture({ id, date, startAt: Date.parse(start), endAt: Date.parse(start) + 3_600_000, ...patch });
  const rows = [
    item('last-day', '2026-11-06', '2026-11-06T23:00:00Z'),
    item('ongoing', '2026-10-31', '2026-11-01T06:00:00Z'),
    item('hosted', '2026-11-01', '2026-11-01T21:00:00Z', { host: { id: 'member', nickname: 'Me', verified: true }, me: null }),
    item('reconfirm', '2026-11-02', '2026-11-02T21:00:00Z', { me: { ...member, confirmedVersion: 1 } }),
    item('too-late', '2026-11-07', '2026-11-07T22:00:00Z'),
    item('waitlist', '2026-11-10', '2026-11-10T22:00:00Z', { me: { ...member, status: 'requested', waitlisted: true } }),
    item('request', '2026-11-01', '2026-11-01T22:00:00Z', { me: { ...member, status: 'requested' } }),
    item('cancelled', '2026-11-01', '2026-11-01T22:00:00Z', { status: 'cancelled' }),
    item('left', '2026-11-01', '2026-11-01T22:00:00Z', { me: { ...member, status: 'left' } }),
    item('other-account', '2026-11-01', '2026-11-01T22:00:00Z', { me: { ...member, userId: 'another' } }),
  ];
  const result = selectMyWeekOutings(rows, 'member', boundary);
  assert.deepEqual(result.arrangements.map(row => row.id), ['ongoing', 'hosted', 'reconfirm', 'last-day']);
  assert.deepEqual(result.requests.map(row => row.id), ['request', 'waitlist']);
});

test('a card date exports exactly one confirmed occurrence without changing the all-occurrences default', () => {
  const event = { ...MONTHLY_EVENTS[0], id: 'exact-calendar-fixture', startDate: '2026-10-01', endDate: '2026-10-31', occurrenceDates: ['2026-10-03', '2026-10-17', '2026-10-31'] };
  const file = unfold(buildEventCalendar(event, '2026-10-17'));
  assert.equal((file.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(file, /DTSTART;VALUE=DATE:20261017\r\nDTEND;VALUE=DATE:20261018/);
  assert.equal(file.includes('DTSTART;VALUE=DATE:20261003'), false);
  assert.equal((buildEventCalendar(event).match(/BEGIN:VEVENT/g) || []).length, 3);
  for (const date of ['2026-10-18', '2026-09-30', '2026-11-01', '2026-02-30', 'not-a-date']) assert.throws(() => buildEventCalendar(event, date));
  assert.throws(() => buildEventCalendar({ ...event, occurrenceDates: [] }, '2026-10-17'));
  assert.match(unfold(buildEventCalendar({ ...event, occurrenceDates: undefined }, '2026-10-17')), /DTEND;VALUE=DATE:20261018/);
});
