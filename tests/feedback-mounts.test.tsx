import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>', { url: 'https://www.baylink.us/events/san-jose-avenida-altares-2026' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement,
  Element: dom.window.Element, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Link } = await import('react-router-dom');
const { default: LocalDiscoveryPage } = await import('../src/pages/LocalDiscoveryPage');
const { default: NotFoundPage } = await import('../src/pages/NotFoundPage');
const { LoginModal } = await import('../src/features/auth/LoginModal');
const { setLocale } = await import('../src/i18n/locale');

afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });
const events = (fetch: { mock: { calls: { arguments: unknown[] }[] } }) => fetch.mock.calls
  .filter(call => String(call.arguments[0]).endsWith('/product-events')).map(call => JSON.parse(String((call.arguments[1] as RequestInit).body)));

test('an event detail counts one event_detail_open per item and offers "这条信息有误？" after the article', async context => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  const view = render(<MemoryRouter initialEntries={['/events/san-jose-avenida-altares-2026']}>
    <Link to="/offers/sephora-birthday">next item</Link>
    <Routes><Route path="/events/:id" element={<LocalDiscoveryPage kind="event" />} /><Route path="/offers/:id" element={<LocalDiscoveryPage kind="offer" />} /></Routes>
  </MemoryRouter>);
  const article = view.container.querySelector('article.local-discovery-detail')!;
  const report = await view.findByRole('button', { name: '这条信息有误？告诉我们' });
  assert.ok(article.compareDocumentPosition(report) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING, 'after the article, outside the detail component');
  assert.deepEqual(events(fetch).filter(body => body.event === 'event_detail_open').map(body => body.route), ['/events/:id']);
  dom.reconfigure({ url: 'https://www.baylink.us/offers/sephora-birthday' });
  fireEvent.click(view.getByRole('link', { name: 'next item' }));
  assert.equal(events(fetch).filter(body => body.event === 'event_detail_open').length, 2);
  assert.doesNotMatch(JSON.stringify(events(fetch)), /sephora|avenida/, 'ids never leave the browser');
  await act(async () => { await setLocale('en', false); });
  assert.ok(await view.findByRole('button', { name: 'Something wrong here? Tell us' }));
});

test('the 404 page offers feedback', async () => {
  const view = render(<MemoryRouter initialEntries={['/missing']}><NotFoundPage /></MemoryRouter>);
  assert.ok(await view.findByRole('button', { name: '反馈与报错' }));
});

test('opening the sign-in sheet counts one signup_gate', context => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  render(<LoginModal onClose={() => {}} onLogin={() => {}} showToast={() => {}} onForgotPassword={() => {}} />);
  assert.equal(events(fetch).filter(body => body.event === 'signup_gate').length, 1);
});
