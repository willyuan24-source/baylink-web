import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentReviewQueue, getReaderFreshness, parseFreshnessRows, sourceComparedAt, type FreshnessSourceRow, type ReaderFreshnessItem } from '../src/lib/content-review';

const today = '2026-10-08';
const now = Date.parse('2026-10-08T19:00:00Z');
const hours = (value: number) => now - value * 3_600_000;
const event: ReaderFreshnessItem = { kind: 'event', verifiedAt: '2026-09-29', endDate: '2026-10-31', nextDate: '2026-10-24' };
const row = (patch: Partial<FreshnessSourceRow> = {}): FreshnessSourceRow => ({ sourceId: 'source-a', status: 'unchanged', needsReview: false, lastFetchedAt: hours(6), lastReviewedAt: null, ...patch });
const state = (item: ReaderFreshnessItem, rows: FreshnessSourceRow[] | null) => getReaderFreshness(item, rows, { today, now });

test('reader states follow source state, never the review calendar', () => {
  // 9/29 is past the 7-day editor cadence, which still drives the editor queue only.
  assert.equal(contentReviewQueue([{ ...event, id: 'e', title: 'e', path: '/events/e', sourceUrls: ['https://example.com'], risk: 'time-sensitive', cadenceDays: 7 }], today)[0].status, 'due');
  const cases: { name: string; item?: ReaderFreshnessItem; rows: FreshnessSourceRow[] | null; expected: string; reason?: string }[] = [
    { name: 'API unreachable or not answered', rows: null, expected: 'ok' },
    { name: 'no registered source', rows: [], expected: 'ok' },
    { name: 'unchanged source', rows: [row()], expected: 'ok' },
    { name: 'baseline source', rows: [row({ status: 'baseline' })], expected: 'ok' },
    { name: 'change acknowledged by an editor', rows: [row({ status: 'changed', lastReviewedAt: hours(2), reviewedBy: 'editor' })], expected: 'ok' },
    { name: 'cosmetic change auto-acknowledged by triage', rows: [row({ status: 'changed', reviewedBy: 'auto-triage' })], expected: 'ok' },
    { name: 'pending change judged cosmetic', rows: [row({ status: 'changed', needsReview: true, material: false, changedAt: hours(80) })], expected: 'ok' },
    { name: 'pending material change inside the 48 h editor window', rows: [row({ status: 'changed', needsReview: true, material: true, changedAt: hours(47) })], expected: 'ok' },
    { name: 'pending material change past 48 h', rows: [row({ status: 'changed', needsReview: true, material: true, changedAt: hours(49) })], expected: 'soft', reason: 'source-changed' },
    { name: 'pending change before triage exists (no date, no materiality)', rows: [row({ status: 'changed', needsReview: true })], expected: 'soft', reason: 'source-changed' },
    { name: 'still pending after a later identical read', rows: [row({ status: 'unchanged', needsReview: true })], expected: 'soft', reason: 'source-changed' },
    { name: 'cancellation wording, even inside 48 h', rows: [row({ status: 'changed', needsReview: true, material: true, changedAt: hours(3), changeFields: ['date', 'cancel'] })], expected: 'hard' },
    { name: 'expired source is ignored', rows: [row({ status: 'expired', needsReview: true })], expected: 'ok' },
    { name: 'manual-required source, date far away', rows: [row({ status: 'manual-required', lastFetchedAt: null })], expected: 'ok' },
    { name: 'error source, date far away', rows: [row({ status: 'error' })], expected: 'ok' },
    { name: 'unread source, date near, human check recent', item: { ...event, nextDate: '2026-10-10', verifiedAt: '2026-10-01' }, rows: [row({ status: 'manual-required' })], expected: 'ok' },
    { name: 'unread source, date near, human check older than 14 days', item: { ...event, nextDate: '2026-10-10', verifiedAt: '2026-09-20' }, rows: [row({ status: 'manual-required' })], expected: 'soft', reason: 'date-near-unconfirmed' },
    { name: 'unread source, date near, no human check', item: { ...event, nextDate: '2026-10-11', verifiedAt: undefined }, rows: [row({ status: 'error' })], expected: 'soft', reason: 'date-near-unconfirmed' },
    { name: 'one readable source among unread ones, date near', item: { ...event, nextDate: '2026-10-10', verifiedAt: '2026-09-01' }, rows: [row({ status: 'manual-required' }), row({ sourceId: 'source-b' })], expected: 'ok' },
    { name: 'date near but API unreachable', item: { ...event, nextDate: '2026-10-09', verifiedAt: '2026-09-01' }, rows: null, expected: 'ok' },
    { name: 'ended item keeps the archive banner', item: { ...event, endDate: '2026-10-07' }, rows: [row({ status: 'changed', needsReview: true, changeFields: ['cancel'] })], expected: 'archived' },
    { name: 'guides never get a banner', item: { kind: 'guide', verifiedAt: '2026-06-01' }, rows: [row({ status: 'changed', needsReview: true, changeFields: ['cancel'] })], expected: 'guide' },
    { name: 'offer with a pending change', item: { kind: 'offer', verifiedAt: '2026-10-04' }, rows: [row({ status: 'changed', needsReview: true })], expected: 'soft', reason: 'source-changed' },
    { name: 'opening with an unread source and no date', item: { kind: 'opening', verifiedAt: '2026-09-01' }, rows: [row({ status: 'manual-required' })], expected: 'ok' },
  ];
  for (const value of cases) {
    const result = state(value.item || event, value.rows);
    assert.equal(result.state, value.expected, value.name);
    assert.equal(result.reason, value.reason, value.name);
  }
});

test('the earliest dated change is reported; human and automatic dates stay separate', () => {
  const result = state(event, [row({ status: 'changed', needsReview: true, changedAt: hours(60) }), row({ sourceId: 'b', status: 'changed', needsReview: true, changedAt: hours(90) })]);
  assert.equal(result.changedAt, hours(90));
  assert.equal(result.verifiedAt, '2026-09-29', 'the editor date is the human verifiedAt, never a monitor date');
  assert.equal(result.comparedAt, undefined, 'a pending change is never described as "no change"');
  assert.equal(state({ ...event, verifiedAt: '2026-10-20' }, null).verifiedAt, undefined, 'a future check date is not shown');
  assert.equal(state({ ...event, verifiedAt: '2026-02-30' }, null).verifiedAt, undefined);
  assert.equal(event.verifiedAt, '2026-09-29');
});

test('the automatic comparison date needs every active source read and matched', () => {
  assert.equal(sourceComparedAt([row({ lastFetchedAt: hours(30) }), row({ sourceId: 'b', lastFetchedAt: hours(5) }), row({ sourceId: 'c', status: 'expired', lastFetchedAt: hours(900) })], now), hours(30));
  for (const other of [row({ sourceId: 'b', status: 'manual-required' }), row({ sourceId: 'b', status: 'baseline' }), row({ sourceId: 'b', needsReview: true }), row({ sourceId: 'b', lastFetchedAt: null }), row({ sourceId: 'b', lastFetchedAt: now + 3_600_000 })]) {
    assert.equal(sourceComparedAt([row(), other], now), undefined, JSON.stringify(other));
  }
  assert.equal(sourceComparedAt([], now), undefined);
  assert.equal(sourceComparedAt(null, now), undefined);
  assert.equal(state(event, [row({ lastFetchedAt: hours(10) })]).comparedAt, hours(10));
});

test('only the documented response shape is trusted', () => {
  assert.equal(parseFreshnessRows(null), null);
  assert.equal(parseFreshnessRows({ error: 'rate limited' }), null);
  assert.equal(parseFreshnessRows('<html>'), null);
  const rows = parseFreshnessRows({ sources: [
    { sourceId: 'a', status: 'changed', needsReview: true, contentIds: ['x', 3], lastFetchedAt: 1791429866752, lastReviewedAt: null, changedAt: 'yesterday', material: 'yes', changeFields: ['cancel', 9], reviewedBy: 'editor' },
    { sourceId: 7, status: 'unchanged' },
    null,
  ] });
  assert.deepEqual(rows, [{ sourceId: 'a', status: 'changed', needsReview: true, contentIds: ['x'], lastFetchedAt: 1791429866752, lastReviewedAt: null, changedAt: null, material: null, changeFields: ['cancel'], reviewedBy: 'editor' }]);
});
