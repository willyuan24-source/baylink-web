import assert from 'node:assert/strict';
import test from 'node:test';
import { api } from '../src/lib/api';
import { getEventEngagement } from '../src/lib/event-engagement';

test('an expanded catalog stays within API batch limits and shares its cancellation signal', async t => {
  const ids = Array.from({ length: 267 }, (_, i) => `event-${i}`);
  const signal = new AbortController().signal;
  const seen: string[][] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit) => {
    assert.equal(options.signal, signal);
    const batch = new URL(path, 'https://www.baylink.us').searchParams.get('ids')!.split(',');
    assert.ok(batch.length <= 100);
    seen.push(batch);
    return { events: batch.map(eventId => ({ eventId, interestedCount: 0, buddyCount: 0, me: null })) };
  });
  const entries = await getEventEngagement(ids, signal);
  assert.deepEqual(seen.map(batch => batch.length), [100, 100, 67]);
  assert.deepEqual(seen.flat(), ids);
  assert.deepEqual(entries.map(entry => entry.eventId), ids);
});

test('one incomplete batch rejects the entire read instead of displaying partial attendance as complete', async t => {
  const ids = Array.from({ length: 201 }, (_, i) => `event-${i}`);
  t.mock.method(api, 'request', async (path: string) => {
    const batch = new URL(path, 'https://www.baylink.us').searchParams.get('ids')!.split(',');
    return { events: batch.includes('event-200') ? [] : batch.map(eventId => ({ eventId, interestedCount: 0, buddyCount: 0, me: null })) };
  });
  await assert.rejects(getEventEngagement(ids), /Incomplete/);
});
