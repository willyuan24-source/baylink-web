import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { UserData } from '../src/lib/types';
import { ABOUT_METADATA } from '../src/lib/about-metadata';
import { renderHtmlDocument, SITE_URL } from '../src/lib/seo';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: `${SITE_URL}/about` });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, StaticRouter } = await import('react-router');
await import('../src/i18n/router');
const { AboutContent } = await import('../src/components/AboutContent');
const { ProfileView } = await import('../src/features/profile/ProfileView');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');

afterEach(async () => { cleanup(); localStorage.clear(); await setLocale('zh-Hans', false); });

test('public About HTML contains readable content, contact and a usable AI fallback with canonical metadata', () => {
  const body = renderToStaticMarkup(<StaticRouter location="/about"><AboutContent /></StaticRouter>);
  const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const page = new JSDOM(renderHtmlDocument(template, ABOUT_METADATA, body));
  const doc = page.window.document;
  assert.equal(doc.querySelectorAll('h1').length, 1);
  assert.match(doc.querySelector('h1')!.textContent!, /湾区生活/);
  assert.equal(doc.querySelector('a[href^="mailto:"]')?.getAttribute('href'), 'mailto:Baylink.us@gmail.com');
  assert.ok(doc.querySelector('a[href="/tools?tool=communication"]'), 'without JavaScript, AI discovery still leads to a real tool');
  assert.equal(doc.querySelector('link[rel="canonical"]')?.getAttribute('href'), `${SITE_URL}/about`);
  assert.equal(doc.querySelector('meta[name="robots"]')?.getAttribute('content'), 'index, follow');
  const [data] = JSON.parse(doc.querySelector('script[type="application/ld+json"]')!.textContent!);
  assert.equal(data['@type'], 'AboutPage');
  assert.equal(data.url, `${SITE_URL}/about`);
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  for (const path of ['/about', '/about/']) {
    const route = config.routes.find((item: { src?: string; dest?: string }) => item.src && item.dest && new RegExp(item.src).test(path));
    assert.ok(route, `${path} must have a public HTML route`);
    assert.equal(path.replace(new RegExp(route.src), route.dest), '/about.html');
  }
  page.window.close();
});

test('About keeps its assistant action and navigation usable when switching English and Traditional Chinese', async () => {
  let opened = 0;
  const view = render(<MemoryRouter initialEntries={['/about']}><AboutContent onAskBayBay={() => { opened += 1; }} /></MemoryRouter>);
  fireEvent.click(view.getByRole('button', { name: '和 BayBay 聊聊' }));
  await act(async () => { await setLocale('en', false); });
  assert.doesNotMatch(view.container.textContent!, /[\u3400-\u9fff]/, 'all public introduction text should be translated');
  const assistantButton = view.getByRole('button');
  assert.doesNotMatch(assistantButton.textContent!, /[\u3400-\u9fff]/);
  fireEvent.click(assistantButton);
  assert.equal(opened, 2);
  assert.equal(view.getByRole('link', { name: 'Browse neighborhood listings' }).getAttribute('href'), '/#home-feed-section');
  await act(async () => { await setLocale('zh-Hant', false); });
  assert.match(view.getByRole('heading', { level: 1 }).textContent!, /灣區生活/);
  assert.equal(view.getByRole('link', { name: /Baylink.us@gmail.com/ }).getAttribute('href'), 'mailto:Baylink.us@gmail.com');
});

test('guest and signed-in About entries open the same public page without requesting the old editable content', async t => {
  const requests: string[] = [];
  t.mock.method(api, 'request', async (path: string) => { requests.push(path); return {}; });
  const user: UserData = { id: 'about-viewer', nickname: 'Neighbor', email: '', role: 'user', contactType: 'wechat', contactValue: '' };
  for (const currentUser of [null, user]) {
    const view = render(<MemoryRouter initialEntries={['/me']}><Routes>
      <Route path="/me" element={<ProfileView user={currentUser} onLogout={() => {}} onLogin={() => {}} onOpenPost={() => {}} onUpdateUser={() => {}} showToast={() => {}} onOpenBlockedUsers={() => {}} />} />
      <Route path="/about" element={<AboutContent />} />
    </Routes></MemoryRouter>);
    fireEvent.click(view.getByRole('link', { name: currentUser ? '关于我们' : '认识 BAYLINK' }));
    assert.ok(await view.findByRole('heading', { name: /湾区生活/ }));
    view.unmount();
  }
  assert.deepEqual(requests, []);
});
