import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { registerHooks } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { AppContextValue } from '../src/app/context';
import type { Outing } from '../src/lib/outings';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/together' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, cleanup, act, fireEvent, waitFor } = await import('@testing-library/react');
const { MemoryRouter, Outlet, Route, Routes } = await import('react-router-dom');
const { default: TogetherPage } = await import('../src/pages/TogetherPage');
const { outings } = await import('../src/lib/outings');
const { publicOutingMetadata } = await import('../src/lib/outing-metadata');
const { setLocale } = await import('../src/i18n/locale');
const { configureMetadataLanguage, renderMetadataHtml, setPageMetadata } = await import('../src/lib/seo');

const item: Outing = {
  id: 'public-outing', title: '首页', description: '公开安排 </script><script>bad()</script>', eventId: null,
  date: '2026-10-17', startTime: '14:00', endTime: '16:00', startAt: Date.parse('2026-10-17T21:00:00Z'), endAt: Date.parse('2026-10-17T23:00:00Z'),
  city: 'Fremont', venue: 'Public park', capacity: 4, costNote: '各自承担费用', transport: 'walk', language: 'any',
  timezone: 'America/Los_Angeles', status: 'open', revision: 1, planVersion: 1, confirmedCount: 1,
  host: { id: 'public-host', nickname: '邻居', verified: true }, me: null,
  members: [{ userId: 'PRIVATE_MEMBER', nickname: 'PRIVATE_NICKNAME', role: 'member', status: 'requested', confirmedVersion: 1, note: 'PRIVATE_NOTE' }],
  requestCount: 99, createdAt: Date.parse('2026-10-06T01:00:00Z'), updatedAt: Date.parse('2026-10-06T02:00:00Z'),
};
const app = { user: null, blockedUserIds: [], setShowLogin() {}, openUserProfile() {}, handleToggleBlockUser() {}, showToast() {} } as unknown as AppContextValue;
const Layout = () => <Outlet context={app} />;
const page = () => <MemoryRouter initialEntries={['/together?outing=public-outing&tracking=PRIVATE_TRACKING']}><Routes><Route element={<Layout />}><Route path="/together" element={<TogetherPage />} /></Route></Routes></MemoryRouter>;
const meta = (key: string) => document.head.querySelector<HTMLMetaElement>(`meta[property="${key}"]`)?.content;
const canonical = () => document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
beforeEach(async t => { localStorage.clear(); document.head.innerHTML = ''; await setLocale('zh-Hans', false); configureMetadataLanguage('zh_CN', value => value, value => value); t.mock.method(outings, 'list', async () => ({ outings: [], nextCursor: null })); });
afterEach(() => cleanup());
after(() => { styles.deregister(); dom.window.close(); });

test('selected outing keeps the server share card while loading, then uses the existing detail response without extra reads', async t => {
  let resolve!: (value: { outing: Outing }) => void;
  const pending = new Promise<{ outing: Outing }>(yes => { resolve = yes; });
  let reads = 0;
  t.mock.method(outings, 'get', () => { reads++; return pending; });
  setPageMetadata(publicOutingMetadata(item, 'zh-Hans'));
  const view = render(page());
  assert.equal(document.title, '首页｜BAYLINK', 'the list page must not overwrite the server card');
  assert.equal(canonical(), 'https://www.baylink.us/together?outing=public-outing');
  await act(async () => { resolve({ outing: item }); });
  assert.equal(view.getByRole('heading', { level: 1 }).getAttribute('translate'), 'no');
  assert.equal(document.title, '首页｜BAYLINK');
  assert.equal(meta('og:url'), canonical());
  assert.equal(reads, 1);
  assert.doesNotMatch(document.head.innerHTML, /PRIVATE_|requestCount|members|timePoll/);
  const scripts = document.head.querySelectorAll('script');
  assert.equal(scripts.length, 1, 'user text never creates executable script elements');
  assert.equal(scripts[0].type, 'application/ld+json');
  assert.equal(scripts[0].hasAttribute('data-baylink-structured-data'), true);
  assert.doesNotMatch(scripts[0].textContent!, /</, 'JSON-LD escapes every literal opening tag');
  const event = JSON.parse(scripts[0].textContent!)[0];
  assert.equal(event.name, item.title);
  assert.equal(event.description, item.description);
  assert.equal(event.startDate, '2026-10-17T21:00:00.000Z');
  assert.equal(event.url, canonical());
});

test('switching a loaded outing language retains user text and selected canonical without refetching', async t => {
  let reads = 0;
  t.mock.method(outings, 'get', async () => { reads++; return { outing: item }; });
  const view = render(page());
  await view.findByRole('heading', { level: 1 });
  for (const [locale, prefix, ogLocale] of [['en', '/en', 'en_US'], ['zh-Hant', '/zh-Hant', 'zh_TW'], ['zh-Hans', '', 'zh_CN']] as const) {
    await act(async () => { await setLocale(locale, false); });
    configureMetadataLanguage(ogLocale, () => 'ALTERED', data => data.map(event => ({ ...event, name: 'ALTERED' })));
    assert.equal(document.title, '首页｜BAYLINK');
    assert.equal(canonical(), `https://www.baylink.us${prefix}/together?outing=public-outing`);
    assert.equal(meta('og:url'), canonical());
    assert.equal(meta('og:locale'), ogLocale);
    assert.equal(JSON.parse(document.head.querySelector('script[data-baylink-structured-data]')!.textContent!)[0].name, item.title);
    assert.equal(document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content, 'noindex, follow');
  }
  assert.equal(reads, 1, 'language changes only update metadata and visible copy');
  fireEvent.click(view.getByRole('button', { name: '返回小队' }));
  await view.findByRole('heading', { name: '一起去，有个具体的约定。' });
  assert.equal(document.title, '一起去 · 小队同行 | BAYLINK');
  assert.equal(canonical(), 'https://www.baylink.us/together');
  assert.equal(Boolean(document.head.querySelector('script[data-baylink-structured-data]')), false, 'returning to the list clears the previous Event');
});

test('a public read failure removes an obsolete successful card after the API withdraws the outing', async t => {
  let reads = 0;
  t.mock.method(outings, 'get', async () => { if (++reads === 1) return { outing: item }; throw { status: 404 }; });
  const view = render(page());
  await view.findByRole('heading', { level: 1 });
  fireEvent.click(view.getByRole('button', { name: '刷新小队' }));
  await waitFor(() => assert.equal(document.title, '这支小队暂不可访问｜BAYLINK'));
  assert.equal(Boolean(view.queryByRole('heading', { level: 1 })), false);
  assert.equal(meta('og:url'), 'https://www.baylink.us/together?outing=public-outing');
  assert.equal(Boolean(document.head.querySelector('script[data-baylink-structured-data]')), false);
});

test('public metadata excludes private fields and does not pass oversized metadata dates to toISOString', () => {
  const metadata = publicOutingMetadata({ ...item, updatedAt: 1e100 }, 'en');
  assert.doesNotMatch(JSON.stringify(metadata), /PRIVATE_|requestCount|members/);
  assert.equal('dateModified' in metadata.structuredData![0], false);
  const html = renderMetadataHtml(metadata);
  assert.match(html, /noindex, follow/);
  assert.match(html, /href="https:\/\/www.baylink.us\/en\/together\?outing=public-outing"/);
  assert.doesNotMatch(html, /<script>bad\(\)/);
});
