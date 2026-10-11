// WEB-SHELL2: the prerendered first paint is the app's own chrome. The header, the global footer and the phone tab bar
// that scripts/prerender.tsx writes (an anonymous reader) are the markup AppLayout renders for an anonymous reader, in every
// edition (FA-07, REG-06). Also: no 邻里 feed request outside the feed pages, the footer and 更多 reach 反馈, the language
// choices are buttons with their own lang (RC-7), Aa is labelled 字号, and detail pages are marked for their action bar (D10).
import assert from 'node:assert/strict';
import test, { after, afterEach, type TestContext } from 'node:test';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.scrollTo = () => {};
const hooks = registerHooks({ load(url, context, next) {
  if (url.includes('/socket.io-client/')) return { format: 'module', shortCircuit: true, source: 'export const io = () => ({ on() { return this; }, off() { return this; }, emit() {}, disconnect() {} });' };
  return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context);
} });
const { render, cleanup, act, fireEvent, waitFor, within } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, useLocation } = await import('react-router-dom');
const { StaticRouter } = await import('react-router');
const { renderToStaticMarkup } = await import('react-dom/server');
await import('../src/i18n/router');
const { setLocale } = await import('../src/i18n/locale');
const { languagePath, languagePrefix } = await import('../src/lib/language-path');
const { default: AppLayout } = await import('../src/app/AppLayout');
const { Shell } = await import('../scripts/prerender-shell');
const { api } = await import('../src/lib/api');
after(() => { hooks.deregister(); });
afterEach(async () => { cleanup(); localStorage.clear(); await setLocale('zh-Hans', false); });

const han = /[㐀-鿿]/;
/** One serialization for both sides: the SSR string and the client DOM are re-parsed and printed by the same parser. */
const normalize = (html: string) => new JSDOM(`<body>${html}</body>`).window.document.body.innerHTML.replace(/\s+/g, ' ');
const parts = (root: ParentNode) => ({
  header: root.querySelector('header.site-topbar')!.outerHTML,
  footer: root.querySelector('footer.site-footer')!.outerHTML,
  tabs: root.querySelector('nav.site-mobile-nav')!.outerHTML,
});

function Harness() {
  const location = useLocation();
  return <Routes><Route element={<AppLayout realLocation={location} />}><Route path="*" element={<p>page</p>} /></Route></Routes>;
}
function mountApp(t: TestContext, path: string, locale: 'zh-Hans' | 'zh-Hant' | 'en' = 'zh-Hans') {
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Network forbidden in chrome tests'); });
  t.mock.method(api, 'request', async (endpoint: string) => {
    requests.push(endpoint);
    if (endpoint.startsWith('/posts?')) return { posts: [], hasMore: false };
    throw new Error(`Unexpected API call: ${endpoint}`);
  });
  const basename = languagePrefix(locale) || undefined;
  const view = render(<MemoryRouter basename={basename} initialEntries={[languagePath(path, locale)]}><Harness /></MemoryRouter>);
  return { view, requests };
}
const settle = () => act(async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setTimeout(resolve, 10)); });

for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
  test(`the prerendered chrome is the app's chrome for an anonymous reader (${locale})`, async t => {
    await setLocale(locale, false);
    for (const path of ['/', '/guides', '/events/san-francisco-fleet-week-2026', '/about']) {
      const html = renderToStaticMarkup(<StaticRouter basename={languagePrefix(locale) || undefined} location={languagePath(path, locale)}><Shell path={path}><p>body</p></Shell></StaticRouter>);
      const prerendered = parts(new JSDOM(html).window.document);
      const { view } = mountApp(t, path, locale);
      await settle();
      const app = parts(view.container);
      for (const key of ['header', 'footer', 'tabs'] as const) assert.equal(normalize(prerendered[key]), normalize(app[key]), `${path} ${key}`);
      // The prerendered <main> says which page it was rendered for (boot-main.ts keeps it on screen until the app's page renders).
      assert.equal(new JSDOM(html).window.document.querySelector('main')!.getAttribute('data-prerender-path'), path);
      assert.equal(view.container.querySelector('main')!.hasAttribute('data-prerender-path'), false);
      cleanup();
      t.mock.restoreAll();
    }
  });
}

test('the /en first paint has no Chinese outside the language choices, and every link keeps /en (verify-release, RC-7)', async () => {
  await setLocale('en', false);
  const html = renderToStaticMarkup(<StaticRouter basename="/en" location="/en/guides"><Shell path="/guides"><p>body</p></Shell></StaticRouter>);
  const doc = new JSDOM(html).window.document;
  const header = doc.querySelector('header')!;
  const choices = header.querySelector('[data-lang-switch]')!;
  assert.deepEqual([...choices.querySelectorAll('button')].map(button => button.getAttribute('lang')), ['zh-Hans', 'zh-Hant', 'en']);
  assert.equal(choices.getAttribute('translate'), 'no');
  assert.equal(choices.querySelector('summary .site-language-short')!.textContent, 'EN');
  choices.remove();
  const footer = [...doc.querySelectorAll('footer')].at(-1)!;
  for (const part of [header, footer]) {
    assert.doesNotMatch(part.textContent!, han);
    assert.doesNotMatch([...part.querySelectorAll('[aria-label]')].map(el => el.getAttribute('aria-label')).join(' '), han);
    for (const link of part.querySelectorAll('a')) assert.match(link.getAttribute('href')!, /^\/en(?:\/|$|\?)/, link.outerHTML);
  }
});

test('no 邻里 feed request outside the feed pages; the home page and a board still load it once', async t => {
  for (const path of ['/guides', '/events', '/guides/bay-area-chinese-senior-services-referral-guide', '/me', '/about']) {
    const { requests } = mountApp(t, path);
    await settle();
    assert.deepEqual(requests.filter(endpoint => endpoint.startsWith('/posts')), [], path);
    cleanup();
    t.mock.restoreAll();
  }
  for (const path of ['/', '/category/rent']) {
    const { requests } = mountApp(t, path);
    await settle();
    assert.equal(requests.filter(endpoint => endpoint.startsWith('/posts?')).length, 1, path);
    cleanup();
    t.mock.restoreAll();
  }
});

test('the global footer and 更多 open the feedback sheet; Aa is labelled 字号', async t => {
  const { view } = mountApp(t, '/guides');
  await settle();
  const footer = view.container.querySelector<HTMLElement>('footer.site-footer')!;
  assert.deepEqual([...footer.querySelectorAll('a')].map(link => link.getAttribute('href')), ['/about', '/archive', '/terms', '/privacy', '/sms-consent']);
  await act(async () => { fireEvent.click(within(footer).getByRole('button', { name: '反馈' })); await new Promise(resolve => setTimeout(resolve, 50)); });
  const sheet = await waitFor(() => within(document.body).getByRole('dialog', { name: '反馈与报错' }));
  await act(async () => { fireEvent.click(within(sheet).getByRole('button', { name: '取消' })); });
  const more = view.container.querySelector<HTMLDetailsElement>('details.site-navigation-more')!;
  more.open = true;
  await act(async () => { fireEvent.click(within(more).getByRole('button', { name: '反馈与报错' })); await new Promise(resolve => setTimeout(resolve, 50)); });
  assert.equal(more.open, false);
  const again = await waitFor(() => within(document.body).getByRole('dialog', { name: '反馈与报错' }));
  await act(async () => { fireEvent.click(within(again).getByRole('button', { name: '取消' })); });
  const aa = view.getByRole('button', { name: '字号' });
  assert.equal(aa.querySelector('.site-reading-glyph')!.textContent, 'Aa');
  assert.equal(aa.querySelector('.site-reading-glyph')!.getAttribute('aria-hidden'), 'true');
});

test('event, offer and opening pages are marked for their action bar (D10); other pages are not', async t => {
  for (const [path, chrome] of [['/events/san-francisco-fleet-week-2026', 'detail'], ['/offers/sephora-birthday', 'detail'], ['/openings/x', 'detail'], ['/guides', null], ['/', null]] as const) {
    const { view } = mountApp(t, path);
    await settle();
    assert.equal(view.container.querySelector('.site-app')!.getAttribute('data-chrome'), chrome, path);
    // The tab bar stays in the DOM: CSS hides it only once the page renders its .site-detail-actions bar.
    assert.ok(view.container.querySelector('nav.site-mobile-nav'), path);
    cleanup();
    t.mock.restoreAll();
  }
});

test('a dialog whose chunk is lost (or that crashes) closes with a message, keeps the page and files a beacon', async t => {
  const { OverlayBoundary } = await import('../src/app/OverlayHost');
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  t.mock.method(console, 'error', () => {});
  let closed = 0;
  const Lost = () => { throw new TypeError('Failed to fetch dynamically imported module: https://www.baylink.us/assets/ReportModal-x1.js'); };
  const view = render(<div><p>page</p><OverlayBoundary onFail={() => { closed += 1; }}><Lost /></OverlayBoundary></div>);
  assert.equal(closed, 1, 'the host closes the dialog and shows its toast');
  assert.equal(view.container.textContent, 'page', 'the page stays; no error screen');
  const sent = () => fetch.mock.calls.filter(call => String(call.arguments[0]).endsWith('/client-errors'));
  await waitFor(() => assert.equal(sent().length, 1));
  assert.equal(JSON.parse(String((sent()[0].arguments[1] as RequestInit).body)).kind, 'chunk');
});
