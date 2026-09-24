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
const { setLocale, translateText } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });

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
  await act(async () => fireEvent.click(view.getByRole('button', { name: translateText('帮我整理'), exact: true })));
  fireEvent.click(view.getByRole('button', { name: translateText('更简洁'), exact: true }));
  fireEvent.click(view.getByRole('button', { name: translateText('取消'), exact: true }));
  assert.equal(view.queryByText('BayBay 草稿预览'), null);
  fireEvent.click(view.getByRole('button', { name: translateText('帮我整理'), exact: true }));
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
  await act(async () => fireEvent.click(view.getByRole('button', { name: translateText('帮我整理'), exact: true })));
  fireEvent.click(view.getByRole('button', { name: translateText('更简洁'), exact: true }));
  fireEvent.click(view.getByRole('button', { name: '应用到表单', exact: true }));
  await act(async () => rewrite.resolve({ ok: true, draft: { ...draft, title: '迟到的改写' } }));
  assert.deepEqual(applied, [draft]);
  assert.equal(view.queryByText('BayBay 草稿预览'), null);
  assert.equal((view.getByRole('button', { name: translateText('帮我整理'), exact: true }) as HTMLButtonElement).disabled, false);
});

test('closing the post assistant prevents late request errors from showing a toast', async () => {
  const request = deferred<Response>();
  const notices: string[] = [];
  const view = render(<BayBayPostAssist postType="client" user={{ token: 'fixture-token' }}
    intent="周末想在东湾求租一间房" onApply={() => {}} showToast={message => notices.push(message)}
    requestAiAssist={() => request.promise} />);
  fireEvent.click(view.getByRole('button', { name: translateText('帮我整理'), exact: true }));
  view.unmount();
  await act(async () => request.reject(new Error('Fixture failure')));
  assert.deepEqual(notices, []);
});

test('post draft generation follows reading language while preserving an already generated draft', async () => {
  await setLocale('en', false);
  const requests: string[] = [];
  const view = render(<BayBayPostAssist postType="client" user={{ token: 'fixture-token' }}
    intent="I need a room in Fremont" onApply={() => {}} showToast={() => {}}
    requestAiAssist={async body => { requests.push(body.language); return { ok: true, draft: { ...draft, title: 'A room in Fremont' } }; }} />);
  await act(async () => fireEvent.click(view.getByRole('button', { name: translateText('帮我整理'), exact: true })));
  assert.deepEqual(requests, ['en']);
  assert.equal(view.getByText('A room in Fremont').getAttribute('translate'), 'no');
  await act(async () => { await setLocale('zh-Hant', false); });
  assert.ok(view.getByText('A room in Fremont'));
  assert.deepEqual(requests, ['en']);
  fireEvent.click(view.getByRole('button', { name: translateText('取消'), exact: true }));
  await act(async () => fireEvent.click(view.getByRole('button', { name: translateText('帮我整理'), exact: true })));
  assert.deepEqual(requests, ['en', 'zh']);
});

test('explicit bilingual output survives interface language changes and subsequent rewrites', async () => {
  const requests: string[] = [];
  const view = render(<BayBayPostAssist postType="client" user={{ token: 'fixture-token' }}
    intent="周末想在东湾求租一间房" onApply={() => {}} showToast={() => {}}
    requestAiAssist={async body => { requests.push(body.language); return { ok: true, draft }; }} />);
  fireEvent.change(view.getByRole('combobox', { name: translateText('生成语言') }), { target: { value: 'bilingual' } });
  await act(async () => fireEvent.click(view.getByRole('button', { name: translateText('帮我整理'), exact: true })));
  await act(async () => { await setLocale('en', false); });
  assert.ok(view.getByText('周末求租'));
  await act(async () => fireEvent.click(view.getByRole('button', { name: translateText('更简洁'), exact: true })));
  assert.deepEqual(requests, ['bilingual', 'bilingual']);
});

test('changing output language ignores a pending response and leaves the new language ready to generate', async () => {
  const old = deferred<Response>();
  const requests: string[] = [];
  const view = render(<BayBayPostAssist postType="client" user={{ token: 'fixture-token' }}
    intent="周末想在东湾求租一间房" onApply={() => {}} showToast={() => {}}
    requestAiAssist={async body => { requests.push(body.language); return requests.length === 1 ? old.promise : { ok: true, draft: { ...draft, title: 'Fresh English draft' } }; }} />);
  fireEvent.click(view.getByRole('button', { name: translateText('帮我整理'), exact: true }));
  fireEvent.change(view.getByRole('combobox', { name: translateText('生成语言') }), { target: { value: 'en' } });
  await act(async () => fireEvent.click(view.getByRole('button', { name: translateText('帮我整理'), exact: true })));
  await act(async () => old.resolve({ ok: true, draft: { ...draft, title: '旧语言请求的草稿' } }));
  assert.deepEqual(requests, ['zh', 'en']);
  assert.ok(view.getByText('Fresh English draft'));
  assert.equal(view.queryByText('旧语言请求的草稿'), null);
});
