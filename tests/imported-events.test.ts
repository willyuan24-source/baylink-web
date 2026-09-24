import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_EVENT, EVENT_LIMITS, eventDraftError, importedEventCalendar, parseEventDraft, parseImportedEvents, safeEventUrl, type ImportedEvent } from '../src/lib/imported-events';

const event = (override: Partial<ImportedEvent> = {}): ImportedEvent => ({ ...EMPTY_EVENT, id: 'event-test', title: 'Weekend workshop', date: '2026-10-03', ...override });

test('AI drafts may leave uncertainty blank, while confirmed events require a title and complete real date', () => {
  assert.deepEqual(parseEventDraft({ ...EMPTY_EVENT, title: 'Unconfirmed date', extra: 'discard me' }), { ...EMPTY_EVENT, title: 'Unconfirmed date' });
  assert.match(eventDraftError({ ...EMPTY_EVENT, title: 'Unconfirmed date' }), /年份/);
  assert.match(eventDraftError({ ...EMPTY_EVENT, date: '2026-10-03' }), /名称/);
  for (const bad of [null, [], {}, { ...EMPTY_EVENT, title: 42 }, { ...EMPTY_EVENT, date: '2026-02-29' }, { ...EMPTY_EVENT, startTime: '25:15' }, { ...EMPTY_EVENT, endTime: '12:61' }, { ...EMPTY_EVENT, description: 'a'.repeat(EVENT_LIMITS.description + 1) }]) assert.equal(parseEventDraft(bad), null);
  assert.match(eventDraftError(event({ startTime: '16:00', endTime: '15:00' })), /结束时间/);
  assert.match(eventDraftError(event({ endTime: '15:00' })), /结束时间/);
  assert.equal(eventDraftError(event({ startTime: '14:00', endTime: '15:00' })), '');
});

test('saved records reject executable links, forged calendar IDs and duplicate identifiers', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,hello', '//outside.example/event', 'http://example.org/event', 'https://name:secret@example.org', 'https://example.org\r\nATTENDEE:person@example.org']) assert.equal(safeEventUrl(value), false, value);
  assert.equal(safeEventUrl('https://www.example.org/events?id=1&locale=zh'), true);
  assert.equal(safeEventUrl(''), true);
  assert.equal(parseImportedEvents([event(), event()]), null);
  assert.equal(parseImportedEvents([event({ id: 'bad\r\nBEGIN:VEVENT' })]), null);
  assert.equal(parseImportedEvents([event({ sourceUrl: 'javascript:alert(1)' })]), null);
  const records = Array.from({ length: 61 }, (_, index) => event({ id: `event-${index}` }));
  assert.equal(parseImportedEvents(records), null);
  assert.equal(parseImportedEvents(records.slice(0, 60))?.length, 60);
});

test('all-day calendar exports use exclusive following dates across month and leap boundaries', () => {
  for (const [date, next] of [['2026-10-31', '20261101'], ['2028-02-29', '20280301'], ['2026-12-31', '20270101']]) {
    const calendar = importedEventCalendar(event({ date }), new Date('2026-09-24T03:45:00Z'));
    assert.ok(calendar.includes(`DTSTART;VALUE=DATE:${date.replaceAll('-', '')}\r\n`));
    assert.ok(calendar.includes(`DTEND;VALUE=DATE:${next}\r\n`));
    assert.doesNotMatch(calendar, /VTIMEZONE|TZID=/);
    assert.match(calendar, /DTSTAMP:20260924T034500Z/);
  }
});

test('timed events preserve Bay Area wall time and include both daylight and standard timezone rules', () => {
  const calendar = importedEventCalendar(event({ date: '2026-11-05', startTime: '15:30', endTime: '17:00' }));
  assert.match(calendar, /DTSTART;TZID=America\/Los_Angeles:20261105T153000/);
  assert.match(calendar, /DTEND;TZID=America\/Los_Angeles:20261105T170000/);
  assert.match(calendar, /BEGIN:DAYLIGHT/);
  assert.match(calendar, /BEGIN:STANDARD/);
  assert.match(calendar, /TZOFFSETTO:-0700/);
  assert.match(calendar, /TZOFFSETTO:-0800/);
});

test('calendar text escapes newlines and punctuation without breaking UTF-8 line limits', () => {
  const title = '湾区亲子活动🌿'.repeat(16);
  const calendar = importedEventCalendar(event({ title, venue: 'Hall, A; B\\C', description: 'Hello\r\nEND:VEVENT\nBEGIN:VEVENT\rATTENDEE:attacker@example.org', sourceUrl: 'https://example.org/event' }));
  const unfolded = calendar.replace(/\r\n /g, '');
  assert.equal((calendar.match(/^BEGIN:VEVENT\r?$/gm) || []).length, 1);
  assert.ok(unfolded.includes(`SUMMARY:${title}\r\n`));
  assert.ok(unfolded.includes('LOCATION:Hall\\, A\\; B\\\\C\r\n'));
  assert.ok(unfolded.includes('Hello\\nEND:VEVENT\\nBEGIN:VEVENT\\nATTENDEE:attacker@example.org'));
  assert.doesNotMatch(unfolded, /\r\nATTENDEE:/);
  for (const line of calendar.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `Calendar line exceeds 75 octets: ${line}`);
  assert.throws(() => importedEventCalendar(event({ date: '2026-02-30' })), /Invalid event/);
});
