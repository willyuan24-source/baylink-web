import assert from 'node:assert/strict';
import test from 'node:test';
import { createSourceRegistry } from '../scripts/generate-source-registry';
import type { ContentReviewRecord } from '../src/lib/content-review';

const record = (id: string, sourceUrls: string[], endDate?: string): ContentReviewRecord => ({ kind: 'event', id, title: id, path: `/events/${id}`, sourceUrls, endDate, verifiedAt: '2026-10-02', risk: 'time-sensitive', cadenceDays: 7 });
test('full registry keeps existing source identities and history associations while merging shared URLs without fictitious verification', () => {
  const previous = [{ id: 'source-legacy', title: 'Original source', url: 'https://official.example/rules', kind: 'event', contentIds: ['old-event'], endDate: '2026-09-01', redirectHosts: ['www.official.example'] }];
  const result = createSourceRegistry([record('current-event', ['https://official.example/rules#tickets'], '2026-10-11'), { ...record('evergreen-guide', ['https://official.example/rules']), kind: 'guide' }], previous);
  assert.equal(result.registry.length, 1);
  assert.equal(result.registry[0].id, 'source-legacy');
  assert.deepEqual(result.registry[0].contentIds, ['current-event', 'evergreen-guide', 'old-event']);
  assert.deepEqual(result.registry[0].redirectHosts, previous[0].redirectHosts);
  assert.equal(result.registry[0].endDate, undefined, 'one expired event cannot stop a shared evergreen source');
  assert.equal(Object.hasOwn(result.registry[0], 'verifiedAt'), false);
  assert.deepEqual(result.unmonitorable, []);
});
test('a new full registry has stable distinct IDs, latest shared end dates and explicit manual-only invalid references', () => {
  const records = [record('first', ['https://official.example/date', 'http://official.example/date', 'https://user:secret@official.example/date', 'https://127.0.0.1/private'], '2026-10-10'), record('second', ['https://official.example/date', 'https://other.example/visit'], '2026-10-15')];
  const a = createSourceRegistry(records, []), b = createSourceRegistry([...records].reverse(), []);
  assert.deepEqual(a.registry.map(row => [row.id, row.url]), b.registry.map(row => [row.id, row.url]));
  assert.equal(a.registry.length, 2);
  assert.equal(a.registry.find(row => row.url.endsWith('/date'))!.endDate, '2026-10-15');
  assert.equal(a.unmonitorable.length, 3);
});
