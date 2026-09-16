import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { AiPostDraft } from '../src/components/BayBayPostAssist';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { BayBayPostAssist } = await import('../src/components/BayBayPostAssist');
afterEach(() => cleanup());

const draft: AiPostDraft = {
  title: '周末求租', description: '希望在东湾租一间房', category: 'rent', type: 'client',
  area: '东湾', budget: '$1800', timeInfo: '本周末', quickTags: [], safetyTip: '', coverSuggestion: '',
};
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
type Response = { ok: boolean; draft?: AiPostDraft };

test('cancelled rewrite cannot replace a newer generation or end its loading state', async () => {
  const rewrite = deferred<Response>();
  const fresh = deferred<Response>();
  let requests = 0;
  const view = render(<BayBayPostAssist postType="client" user={{ token: 'fixture-token' }}
    intent="周末想在东湾求租一间房" onApply={() => {}} showToast={() => {}}
    requestAiAssist={async () => {
      requests += 1;
      return requests === 1 ? { ok: true, draft } : requests === 2 ? rewrite.promise : fresh.promise;
    }} />);
  await act(async () => fireEvent.click(view.getByRole('button', { name: '帮我整理', exact: true })));
  fireEvent.click(view.getByRole('button', { name: '更简洁', exact: true }));
  fireEvent.click(view.getByRole('button', { name: '取消', exact: true }));
  assert.equal(view.queryByText('BayBay 草稿预览'), null);
  fireEvent.click(view.getByRole('button', { name: '帮我整理', exact: true }));
  assert.equal(requests, 3);
  await act(async () => rewrite.resolve({ ok: true, draft: { ...draft, title: '已经取消的旧稿' } }));
  assert.equal(view.queryByText('BayBay 草稿预览'), null);
  assert.equal((view.getByRole('button', { name: 'BayBay 正在整理...' }) as HTMLButtonElement).disabled, true);
  await act(async () => fresh.resolve({ ok: true, draft: { ...draft, title: '新的求租草稿' } }));
  assert.ok(view.getByText(/新的求租草稿/));
  assert.equal(view.queryByText(/已经取消的旧稿/), null);
});

test('applying the visible draft discards a pending rewrite', async () => {
  const rewrite = deferred<Response>();
  const applied: AiPostDraft[] = [];
  let requests = 0;
  const view = render(<BayBayPostAssist postType="client" user={{ token: 'fixture-token' }}
    intent="周末想在东湾求租一间房" onApply={value => applied.push(value)} showToast={() => {}}
    requestAiAssist={async () => ++requests === 1 ? { ok: true, draft } : rewrite.promise} />);
  await act(async () => fireEvent.click(view.getByRole('button', { name: '帮我整理', exact: true })));
  fireEvent.click(view.getByRole('button', { name: '更简洁', exact: true }));
  fireEvent.click(view.getByRole('button', { name: '应用到表单', exact: true }));
  await act(async () => rewrite.resolve({ ok: true, draft: { ...draft, title: '迟到的改写' } }));
  assert.deepEqual(applied, [draft]);
  assert.equal(view.queryByText('BayBay 草稿预览'), null);
  assert.equal((view.getByRole('button', { name: '帮我整理', exact: true }) as HTMLButtonElement).disabled, false);
});

test('closing the post assistant prevents late request errors from showing a toast', async () => {
  const request = deferred<Response>();
  const notices: string[] = [];
  const view = render(<BayBayPostAssist postType="client" user={{ token: 'fixture-token' }}
    intent="周末想在东湾求租一间房" onApply={() => {}} showToast={message => notices.push(message)}
    requestAiAssist={() => request.promise} />);
  fireEvent.click(view.getByRole('button', { name: '帮我整理', exact: true }));
  view.unmount();
  await act(async () => request.reject(new Error('Fixture failure')));
  assert.deepEqual(notices, []);
});
