import assert from 'node:assert/strict';
import test, { afterEach, type TestContext } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { savedPostsKey } from '../src/lib/savedPosts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { SavedPostsPanel } = await import('../src/components/SavedPostsPanel');
const { api } = await import('../src/lib/api');
afterEach(() => { cleanup(); dom.window.localStorage.clear(); });

type Pending = { id: string; signal: AbortSignal; resolve: (title?: string) => void; reject: (status?: number) => void };
function mockLookup(t: TestContext) {
  const pending: Pending[] = [];
  let active = 0;
  let peak = 0;
  t.mock.method(api, 'request', (path: string, options: RequestInit) => {
    const id = decodeURIComponent(path.split('/').at(-1)!);
    const signal = options.signal as AbortSignal;
    assert.ok(signal);
    active += 1;
    peak = Math.max(peak, active);
    let finished = false;
    const finish = () => { if (!finished) { active -= 1; finished = true; } };
    signal.addEventListener('abort', finish, { once: true });
    // Allow late responses after abort to verify the component's generation guard,
    // independently of whether a particular fetch transport honors cancellation.
    return new Promise((resolve, reject) => pending.push({ id, signal,
      resolve: (title = `已核实 ${id}`) => { finish(); resolve({ id, title, city: '东湾', category: '租屋', budget: '$1800', type: 'provider', confirmedAt: null }); },
      reject: (status = 500) => { finish(); reject({ status }); },
    }));
  });
  return { pending, active: () => active, peak: () => peak };
}
function save(userId: string, count: number) {
  dom.window.localStorage.setItem(savedPostsKey(userId), JSON.stringify(Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`, title: `收藏快照 ${index + 1}`, city: '东湾', category: '租屋', budget: '$1800', savedAt: index,
  }))));
}
const panel = (userId = 'one') => <MemoryRouter><SavedPostsPanel userId={userId} /></MemoryRouter>;

test('loading more retains checked cards, queries each new id once, and never exceeds six concurrent lookups', async (t) => {
  save('one', 18);
  const requests = mockLookup(t);
  const view = render(panel());
  fireEvent.click(view.getByRole('button', { name: /我的收藏/ }));
  assert.equal(requests.pending.length, 6);
  await act(async () => { requests.pending.slice(0, 6).forEach(request => request.resolve()); });
  assert.equal(view.getAllByRole('link').length, 6);

  fireEvent.click(view.getByRole('button', { name: '查看更多收藏' }));
  assert.equal(requests.pending.length, 12);
  assert.ok(view.getByRole('link', { name: '已核实 p1' }), 'a checked card must stay usable while more records load');
  fireEvent.click(view.getByRole('button', { name: '查看更多收藏' }));
  assert.equal(requests.pending.length, 12, 'newly revealed items wait when six requests are active');
  assert.equal(requests.active(), 6);

  await act(async () => {
    requests.pending[6].reject();
    requests.pending.slice(7, 12).forEach(request => request.resolve());
  });
  assert.equal(requests.pending.length, 18, 'failed lookups must also release a queue slot');
  assert.equal(requests.active(), 6);
  await act(async () => { requests.pending.slice(12).forEach(request => request.resolve()); });
  assert.equal(requests.peak(), 6);
  assert.equal(new Set(requests.pending.map(request => request.id)).size, 18);
  assert.equal(view.getAllByRole('link').length, 17);
  assert.ok(view.getByText('暂时无法检查，请稍后重试。'));
  assert.ok(view.getByRole('link', { name: '已核实 p1' }));
});

test('closing cancels the old queue, reopening rechecks, and late old responses cannot overwrite current results', async (t) => {
  save('one', 12);
  const requests = mockLookup(t);
  const view = render(panel());
  const toggle = view.getByRole('button', { name: /我的收藏/ });
  fireEvent.click(toggle);
  fireEvent.click(view.getByRole('button', { name: '查看更多收藏' }));
  const old = requests.pending.slice();
  fireEvent.click(toggle);
  assert.ok(old.every(request => request.signal.aborted));
  fireEvent.click(toggle);
  assert.equal(requests.pending.length, 12);
  await act(async () => requests.pending[6].resolve('重新打开后的当前结果'));
  const countBeforeLateReplies = requests.pending.length;
  await act(async () => old.forEach(request => request.resolve('旧批次不应出现')));
  assert.equal(requests.pending.length, countBeforeLateReplies, 'an aborted session must never pump queued ids');
  assert.ok(view.getByRole('link', { name: '重新打开后的当前结果' }));
  assert.equal(view.queryByText('旧批次不应出现'), null);
  assert.equal(requests.peak(), 6);
});

test('explicit refresh and account changes start new lookups without accepting earlier account results', async (t) => {
  save('one', 2);
  save('two', 2);
  const requests = mockLookup(t);
  const view = render(panel());
  fireEvent.click(view.getByRole('button', { name: /我的收藏/ }));
  await act(async () => requests.pending[0].resolve('账号一已检查'));
  assert.ok(view.getByRole('link', { name: '账号一已检查' }));
  fireEvent.click(view.getByRole('button', { name: '重新检查状态' }));
  assert.equal(requests.pending.length, 4);
  assert.ok(requests.pending.slice(0, 2).every(request => request.signal.aborted));
  assert.equal(view.queryByRole('link', { name: '账号一已检查' }), null);

  view.rerender(panel('two'));
  assert.equal(requests.pending.length, 6);
  assert.ok(requests.pending.slice(2, 4).every(request => request.signal.aborted));
  await act(async () => requests.pending[4].resolve('账号二的当前结果'));
  await act(async () => {
    requests.pending[1].reject(403);
    requests.pending[2].resolve('账号一的过期响应');
    requests.pending[3].resolve('账号一的过期响应');
  });
  assert.ok(view.getByRole('link', { name: '账号二的当前结果' }));
  assert.equal(view.queryByText('账号一的过期响应'), null);
  assert.equal(view.queryByText('这条信息目前不可访问，可以移除收藏。'), null);
  assert.match(view.getByText(/当前账号在此浏览器的收藏/).textContent!, /打开时会重新检查/);
});
