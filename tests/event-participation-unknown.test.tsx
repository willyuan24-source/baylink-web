import assert from 'node:assert/strict';
import test, { after, afterEach, type TestContext } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { AppContextValue } from '../src/app/context';

// H07: an event the API does not know yet (its catalog copy lags the web until the API-SYNC after a content merge) must not
// show "人数暂时无法加载 · 重试" or buttons that can only fail. The 想约人一起去？ block leaves the page instead.
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/events/x' });
const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true };
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const { render, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { localDiscoveries, discoveryShare } = await import('../src/data/local-discoveries');
const { LocalDiscoveryDetail } = await import('../src/components/LocalDiscoveryDetail');
const { buildDetailRecord } = await import('../src/features/detail/build-detail');
const { api } = await import('../src/lib/api');
const { getEventEngagement } = await import('../src/lib/event-engagement');

afterEach(() => { cleanup(); localStorage.clear(); });
after(() => {
  dom.window.close();
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const TODAY = '2026-10-13';
// One of the nine SF events the 3D world still holds (src/data/public-catalog-holdout.ts), live on TODAY.
const ID = 'sfpl-chinatown-creative-saturdays-fall-2026';
const item = localDiscoveries.find(row => row.kind === 'event' && discoveryShare(row).id === ID)!;
const app = { user: null, setShowLogin: () => {}, showToast: () => {}, openChat: () => {}, openUserProfile: () => {} } as unknown as AppContextValue;
const HEADING = { name: '想约人一起去？' };
const known = { eventId: ID, interestedCount: 0, buddyCount: 0, me: null };

function detail(t: TestContext, engagement: () => unknown) {
  let reads = 0;
  const request = async (path: string) => {
    if (path.startsWith('/events/engagement')) { reads++; return engagement(); }
    if (path.startsWith('/outings')) return { outings: [], nextCursor: null };
    throw new Error(`not used in this test: ${path}`);
  };
  t.mock.method(api, 'request', request);
  const view = render(<MemoryRouter initialEntries={[`/events/${ID}`]}><Routes><Route element={<Outlet context={app} />}>
    <Route path="/events/:id" element={<LocalDiscoveryDetail record={buildDetailRecord(item)} today={TODAY} />} />
  </Route></Routes></MemoryRouter>);
  return { view, reads: () => reads };
}
/** Plain polling with cheap DOM checks: testing-library's waitFor re-runs its query on every DOM mutation, and on this full
 * page that took minutes while the first lazy chunks loaded. */
async function until(check: () => boolean, what: string) {
  for (let tries = 0; tries < 200; tries++) {
    if (check()) return;
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
  }
  assert.fail(`timed out waiting for ${what}`);
}
const together = (view: ReturnType<typeof detail>['view']) => view.container.querySelector('#detail-together-title');
const says = (view: ReturnType<typeof detail>['view'], text: string) => (view.container.textContent || '').includes(text);

test('a 404 from the API (an event it does not know yet) removes the 一起去 block without an error', async t => {
  assert.ok(item, `${ID} is a site event`);
  const run = detail(t, () => { throw { status: 404, error: '活动不存在。' }; });
  await until(() => run.reads() > 0 && !together(run.view), 'the block to leave');
  assert.equal(run.view.queryByRole('heading', HEADING), null);
  assert.equal(run.view.queryByText('人数暂时无法加载'), null);
  assert.equal(run.view.queryByRole('button', { name: /公开想去/ }), null);
  assert.equal(run.view.queryByRole('button', { name: /^一起去/ }), null);
});

test("the API's unknown list (API-SYNC-3b) removes the block the same way", async t => {
  const run = detail(t, () => ({ events: [], unknown: [ID] }));
  await until(() => run.reads() > 0 && !together(run.view), 'the block to leave');
  assert.equal(run.view.queryByRole('heading', HEADING), null);
  assert.equal(run.view.queryByText('人数暂时无法加载'), null);
});

test('a known event keeps the block, and a real failure still offers 重试', async t => {
  let answer: () => unknown = () => ({ events: [known], unknown: [] });
  const ok = detail(t, () => answer());
  await until(() => says(ok.view, '意向不等于报名或购票。'), 'the counts line');
  assert.ok(ok.view.getByRole('heading', HEADING));
  assert.ok(ok.view.getByRole('button', { name: /公开想去/ }));
  cleanup();
  answer = () => { throw { status: 503, error: '活动报名暂不可用，请稍后重试。' }; };
  const down = detail(t, () => answer());
  await until(() => says(down.view, '人数暂时无法加载'), 'the failure line');
  assert.ok(down.view.getByRole('heading', HEADING));
  assert.ok(down.view.getByRole('button', { name: '重试' }));
});

test('the engagement read separates unknown ids from counts and rejects answers that do not add up', async t => {
  const answers: unknown[] = [
    { events: [{ ...known, eventId: 'a' }], unknown: ['b'] },
    { events: [{ ...known, eventId: 'a' }] },
    { events: [{ ...known, eventId: 'a' }], unknown: ['a', 'b'] },
    { events: [{ ...known, eventId: 'a' }], unknown: ['c'] },
    { events: [{ ...known, eventId: 'a' }], unknown: 'b' },
  ];
  t.mock.method(api, 'request', async () => {
    const answer = answers.shift() as { notFound?: boolean };
    if (answer?.notFound) throw { status: 404, error: '活动不存在。' };
    return answer;
  });
  assert.deepEqual(await getEventEngagement(['a', 'b']), { entries: [{ ...known, eventId: 'a' }], unknown: ['b'] });
  await assert.rejects(getEventEngagement(['a', 'b']), /Incomplete/, 'an id missing from both lists');
  await assert.rejects(getEventEngagement(['a', 'b']), /Incomplete/, 'an id in both lists');
  await assert.rejects(getEventEngagement(['a', 'b']), /Incomplete/, 'an id nobody asked for');
  await assert.rejects(getEventEngagement(['a', 'b']), /Invalid/);
  // Before API-SYNC-3b the API answers a whole batch with 404: that names the id only when the batch has one.
  answers.push(...Array.from({ length: 2 }, () => ({ notFound: true })));
  assert.deepEqual(await getEventEngagement(['a']), { entries: [], unknown: ['a'] });
  await assert.rejects(getEventEngagement(['a', 'b']), (error: { status?: number }) => error.status === 404);
});
