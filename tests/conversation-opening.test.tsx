import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { useConversationOpener } from '../src/app/useConversationOpener';
import { withConversationContext } from '../src/lib/conversation-context';
import { api } from '../src/lib/api';
import type { Conversation, UserData } from '../src/lib/types';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
const { render, cleanup, fireEvent, act } = await import('@testing-library/react');
afterEach(() => { cleanup(); localStorage.clear(); });
const user = { id: 'viewer', token: 'fixture-token' } as UserData;
function Harness({ routeKey = 'profile', onOpened, onError }: { routeKey?: string; onOpened: (conversation: Conversation) => void; onError: (error: unknown) => void }) {
  const open = useConversationOpener({ routeKey, onOpened, onError });
  return <><button onClick={() => void open({ targetId: 'first', postTitle: '海边散步' }, user)}>first</button><button onClick={() => void open({ targetId: 'second' }, user)}>second</button></>;
}

test('a late contact response cannot replace the conversation selected by the latest click', async t => {
  localStorage.setItem('currentUser', JSON.stringify(user));
  const pending: { signal: AbortSignal; resolve: (value: unknown) => void }[] = [];
  t.mock.method(api, 'request', (_path: string, options?: RequestInit) => new Promise(resolve => pending.push({ signal: options!.signal as AbortSignal, resolve })));
  const opened: Conversation[] = [];
  const view = render(<Harness onOpened={c => opened.push(c)} onError={() => assert.fail('unexpected failure')} />);
  fireEvent.click(view.getByText('first')); fireEvent.click(view.getByText('second'));
  assert.equal(pending[0].signal.aborted, true);
  await act(async () => pending[1].resolve({ id: 'second-chat', otherUser: { id: 'second', nickname: 'Second' } }));
  await act(async () => pending[0].resolve({ id: 'first-chat', otherUser: { id: 'first', nickname: 'First' } }));
  assert.deepEqual(opened.map(c => c.id), ['second-chat']);
});

test('leaving a route cancels navigation and old-session failures do not appear under a new account', async t => {
  localStorage.setItem('currentUser', JSON.stringify(user));
  const pending: { signal: AbortSignal; reject: (error: unknown) => void }[] = [];
  t.mock.method(api, 'request', (_path: string, options?: RequestInit) => new Promise((_resolve, reject) => pending.push({ signal: options!.signal as AbortSignal, reject })));
  const props = { onOpened: () => assert.fail('unexpected navigation'), onError: () => assert.fail('stale error must stay silent') };
  const view = render(<Harness {...props} />);
  fireEvent.click(view.getByText('first'));
  view.rerender(<Harness {...props} routeKey="guides" />);
  assert.equal(pending[0].signal.aborted, true);
  await act(async () => pending[0].reject(new Error('late failure')));
  fireEvent.click(view.getByText('second'));
  localStorage.setItem('currentUser', JSON.stringify({ ...user, token: 'new-session' }));
  await act(async () => pending[1].reject(new Error('old session failure')));
});

test('a new activity title never inherits the previous rental post destination', () => {
  const previous: Conversation = { id: 'chat', otherUser: { id: 'neighbor', nickname: 'Neighbor' }, updatedAt: 0, lastPostTitle: '旧房源', lastPostId: 'old-rental' };
  assert.equal(withConversationContext(previous), previous);
  assert.deepEqual(withConversationContext(previous, '一起去海边').lastPostId, undefined);
  assert.equal(withConversationContext(previous, '一起去海边').lastPostTitle, '一起去海边');
  assert.equal(withConversationContext(previous, undefined, 'new-post').lastPostTitle, undefined);
  assert.equal(withConversationContext(previous, '新房源', 'new-post').lastPostId, 'new-post');
});
