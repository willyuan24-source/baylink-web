import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>', { url: 'https://www.baylink.us/me' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, within } = await import('@testing-library/react');
const { ReaderFeedbackPanel, ClientErrorsPanel } = await import('../src/features/feedback/FeedbackAdminPanels');
const { api } = await import('../src/lib/api');
afterEach(cleanup);

test('reader feedback shows each row as plain text with its page template, item and filters by kind', async context => {
  const paths: string[] = [];
  context.mock.method(api, 'request', async (path: string) => {
    paths.push(path);
    return { retentionDays: 90, items: [
      { id: 'a1', kind: 'content', reason: 'wrong-time', route: '/events/:id', text: '<img src=x onerror=alert(1)>\n第二行', contact: '测试编号 T07', entity: { kind: 'event', id: 'san-francisco-fleet-week-2026' }, locale: 'zh-Hans', readingSize: 'large', release: 'a5d63fbe3e17', createdAt: '2026-10-08T20:00:00.000Z' },
    ], nextBefore: 'cursor-1' };
  });
  const view = render(<ReaderFeedbackPanel />);
  const row = await view.findByText(/第二行/);
  assert.equal(row.textContent, '<img src=x onerror=alert(1)>\n第二行', 'reader text stays text');
  assert.equal(view.container.querySelector('img'), null);
  assert.ok(view.getByText('信息有误 · 时间不对'));
  assert.equal(view.getByRole('link', { name: 'event/san-francisco-fleet-week-2026' }).getAttribute('href'), '/events/san-francisco-fleet-week-2026');
  assert.match(view.container.textContent!, /\/events\/:id/);
  fireEvent.click(within(view.getByRole('group', { name: '按类型筛选' })).getByRole('button', { name: 'BayBay' }));
  await view.findByText(/第二行/);
  assert.deepEqual(paths, ['/admin/feedback?limit=50', '/admin/feedback?limit=50&kind=baybay']);
  fireEvent.click(view.getByRole('button', { name: '加载更早的反馈' }));
  await view.findAllByText(/第二行/);
  assert.equal(paths.at(-1), '/admin/feedback?limit=50&kind=baybay&before=cursor-1');
});

test('the browser error report lists kinds, templates, releases and fingerprints, and says when it cannot load', async context => {
  let fail = false;
  context.mock.method(api, 'request', async () => {
    if (fail) throw { status: 503 };
    return { days: 30, from: '2026-09-09', through: '2026-10-08', total: 7, groupsTruncated: false,
      groups: [{ kind: 'render', route: '/guides/:slug', release: 'a5d63fbe3e17', fp: '3fa9c01b', count: 7, firstDay: '2026-10-07', lastDay: '2026-10-08' }],
      daily: [{ day: '2026-10-08', kind: 'render', count: 5 }] };
  });
  const view = render(<ClientErrorsPanel />);
  const cell = await view.findByText('3fa9c01b');
  const row = cell.closest('tr')!;
  assert.deepEqual([...row.querySelectorAll('td')].map(td => td.textContent), ['页面渲染出错', '/guides/:slug', 'a5d63fbe3e17', '3fa9c01b', '7', '2026-10-07 – 2026-10-08']);
  cleanup();
  fail = true;
  const failed = render(<ClientErrorsPanel />);
  assert.match((await failed.findByRole('alert')).textContent!, /未将缺失数据记为零/);
});
