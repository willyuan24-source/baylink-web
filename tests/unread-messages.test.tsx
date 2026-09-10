import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { UserData } from '../src/lib/types';
import { api } from '../src/lib/api';
import { useUnreadMessages } from '../src/app/useUnreadMessages';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
const { render, cleanup, act } = await import('@testing-library/react');
const originalRequest = api.request;
let visibility = 'visible';
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
afterEach(() => { cleanup(); api.request = originalRequest; visibility = 'visible'; });
const user = { id: 'alice', token: 'synthetic' } as UserData;
function Harness({ currentUser = user }: { currentUser?: UserData | null }) {
  return <output>{useUnreadMessages(currentUser, null)}</output>;
}

test('unread totals use server counts, remain during network errors, and update after a real read', async () => {
  let rows: unknown = [{ id: 'c1', unreadCount: 3 }, { id: 'c1', unreadCount: 3 }, { id: 'c2', unreadCount: 2 }, { id: 'bad', unreadCount: -5 }];
  api.request = async () => { if (rows instanceof Error) throw rows; return rows; };
  const view = render(<Harness />);
  await act(async () => {});
  assert.equal(view.container.textContent, '5');
  rows = new Error('offline');
  await act(async () => { window.dispatchEvent(new dom.window.Event('focus')); });
  assert.equal(view.container.textContent, '5');
  rows = [{ id: 'c2', unreadCount: 1 }];
  await act(async () => { window.dispatchEvent(new dom.window.Event('baylink:messages-read')); });
  assert.equal(view.container.textContent, '1');
});

test('a previous account response cannot reveal its unread count after account switching or sign-out', async () => {
  const requests: Array<{ resolve: (rows: unknown) => void; signal?: AbortSignal | null }> = [];
  api.request = async (_path, options) => new Promise(resolve => requests.push({ resolve, signal: options?.signal }));
  const view = render(<Harness />);
  view.rerender(<Harness currentUser={{ id: 'bob', token: 'other' } as UserData} />);
  assert.equal(requests[0].signal?.aborted, true);
  await act(async () => { requests[0].resolve([{ id: 'alice-private', unreadCount: 40 }]); });
  assert.equal(view.container.textContent, '0');
  await act(async () => { requests[1].resolve([{ id: 'bob-private', unreadCount: 2 }]); });
  assert.equal(view.container.textContent, '2');
  view.rerender(<Harness currentUser={null} />);
  assert.equal(view.container.textContent, '0');
});

test('hidden pages defer fetches and read events received during a fetch queue a fresh count', async () => {
  visibility = 'hidden';
  const requests: Array<(rows: unknown) => void> = [];
  api.request = async () => new Promise(resolve => requests.push(resolve));
  const view = render(<Harness />);
  assert.equal(requests.length, 0);
  visibility = 'visible';
  await act(async () => { document.dispatchEvent(new dom.window.Event('visibilitychange')); });
  assert.equal(requests.length, 1);
  await act(async () => { window.dispatchEvent(new dom.window.Event('baylink:messages-read')); });
  assert.equal(requests.length, 1);
  await act(async () => { requests[0]([{ id: 'c', unreadCount: 7 }]); });
  assert.equal(requests.length, 2);
  await act(async () => { requests[1]([{ id: 'c', unreadCount: 0 }]); });
  assert.equal(view.container.textContent, '0');
});
