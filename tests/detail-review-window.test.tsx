import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

// W4 integration (WEB-FRESH2 × WEB-DETAIL): the detail page passes the event's live window to both source prompts, so the hard
// "可能改期或取消" box keeps to it like the soft line. No confirmed session left → no prompt (the page says it ended); an event
// still waiting for a date is live, so a material change can prompt.
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/events/x' });
const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true };
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const { render, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { localDiscoveries } = await import('../src/data/local-discoveries');
const { LocalDiscoveryDetail } = await import('../src/components/LocalDiscoveryDetail');
const { buildDetailRecord } = await import('../src/features/detail/build-detail');
const { resetSourceFreshnessCache } = await import('../src/features/source-monitor/content-review-runtime');
const { api } = await import('../src/lib/api');
const request = api.request;

afterEach(() => { cleanup(); api.request = request; resetSourceFreshnessCache(); });
after(() => {
  dom.window.close();
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const TODAY = '2026-10-20';
const base = localDiscoveries.find(row => row.kind === 'event' && row.event.id === 'san-francisco-fleet-week-2026');
assert.ok(base && base.kind === 'event');
// The listing runs to 10/31, so the review record is not archived on 10/20; only its confirmed days change (set on the built
// record, after the overlay's sessions and date overrides).
const withDays = (occurrenceDates: string[]) => {
  const record = buildDetailRecord(base);
  assert.equal(record.item.kind, 'event');
  return { ...record, item: { kind: 'event' as const, event: { ...(record.item as typeof base).event, startDate: '2026-10-01', endDate: '2026-10-31', occurrenceDates, sessions: undefined } } };
};
const materialCancel = { sources: [{ sourceId: 's', status: 'changed', needsReview: true, material: true, changeFields: ['cancel'], changedAt: Date.parse('2026-10-15T12:00:00Z'), lastFetchedAt: Date.parse('2026-10-19T12:00:00Z'), lastReviewedAt: null }] };

async function hardBox(occurrenceDates: string[]) {
  api.request = async () => materialCancel as never;
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<MemoryRouter initialEntries={['/events/san-francisco-fleet-week-2026']}><LocalDiscoveryDetail record={withDays(occurrenceDates)} today={TODAY} /></MemoryRouter>); });
  await act(async () => {});
  return view.container.querySelector('.reader-freshness-hard');
}

test('the hard source box keeps to the event’s live window on the detail page', async () => {
  assert.ok(await hardBox(['2026-10-24']), 'a session is still ahead: the box shows');
  resetSourceFreshnessCache();
  assert.equal(await hardBox(['2026-10-03', '2026-10-10']), null, 'no confirmed session left: no box');
  resetSourceFreshnessCache();
  assert.ok(await hardBox([]), 'no day confirmed yet (postponed / dates to be announced) is still live: the box shows');
});
