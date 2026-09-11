import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { UserData } from '../src/lib/types';
import { api } from '../src/lib/api';
import { usePendingContacts } from '../src/app/usePendingContacts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
const { render, cleanup, act } = await import('@testing-library/react');
const originalRequest = api.request;
let visibility = 'visible';
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
afterEach(() => { cleanup(); api.request = originalRequest; visibility = 'visible'; });
const user = { id: 'alice', token: 'synthetic' } as UserData;
let inboxCount: (count: number) => void;
function Harness({ currentUser = user, refreshKey = 0 }: { currentUser?: UserData | null; refreshKey?: number }) {
  const [count, update] = usePendingContacts(currentUser, refreshKey);
  React.useEffect(() => { inboxCount = update; }, [update]);
  return <output>{count}</output>;
}

test('old account and old token requests cannot populate the current contact badge', async () => {
  const requests: Array<{ resolve: (rows: unknown) => void; signal?: AbortSignal | null }> = [];
  api.request = async (_path, options) => new Promise(resolve => requests.push({ resolve, signal: options?.signal }));
  const view = render(<Harness />);
  const oldInboxCount = inboxCount;
  view.rerender(<Harness currentUser={{ ...user, token: 'new-token' }} />);
  assert.equal(requests[0].signal?.aborted, true);
  await act(async () => { requests[0].resolve({ requests: [{ id: 'old' }] }); oldInboxCount(8); });
  assert.equal(view.container.textContent, '0');
  await act(async () => { requests[1].resolve({ requests: [{ id: 'current' }, { id: 'current2' }] }); });
  assert.equal(view.container.textContent, '2');
  await act(async () => { oldInboxCount(8); });
  assert.equal(view.container.textContent, '2');
  view.rerender(<Harness currentUser={null} />);
  assert.equal(view.container.textContent, '0');
});

test('network failures preserve pending requests and retries update the confirmed count', async () => {
  let rows: unknown = { requests: [{ id: 'one' }, { id: 'two' }] };
  api.request = async () => { if (rows instanceof Error) throw rows; return rows; };
  const view = render(<Harness />);
  await act(async () => {});
  assert.equal(view.container.textContent, '2');
  rows = new Error('offline');
  await act(async () => { window.dispatchEvent(new dom.window.Event('online')); });
  assert.equal(view.container.textContent, '2');
  rows = { requests: [] };
  view.rerender(<Harness refreshKey={1} />);
  await act(async () => {});
  assert.equal(view.container.textContent, '0');
});

test('hidden pages defer requests and coalesce refreshes during a slow fetch', async () => {
  visibility = 'hidden';
  const requests: Array<(rows: unknown) => void> = [];
  api.request = async () => new Promise(resolve => requests.push(resolve));
  const view = render(<Harness />);
  assert.equal(requests.length, 0);
  visibility = 'visible';
  await act(async () => { document.dispatchEvent(new dom.window.Event('visibilitychange')); });
  await act(async () => { window.dispatchEvent(new dom.window.Event('focus')); });
  assert.equal(requests.length, 1);
  await act(async () => { requests[0]({ requests: [{ id: 'one' }] }); });
  assert.equal(requests.length, 2);
  await act(async () => { requests[1]({ requests: [] }); });
  assert.equal(view.container.textContent, '0');
});

test('a slow poll does not overwrite a newer inbox count in the same session', async () => {
  let finish: (rows: unknown) => void;
  api.request = async () => new Promise(resolve => { finish = resolve; });
  const view = render(<Harness />);
  await act(async () => { inboxCount(2); });
  await act(async () => { finish({ requests: [{ id: 'old' }] }); });
  assert.equal(view.container.textContent, '2');
});
