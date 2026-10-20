// UI9-NAV (review fixes): the chrome's lazy pieces fail in place (the account menu keeps its box, the Aa sheet closes with a
// toast, /about's notes stay open) instead of reaching the root error page; the page arrival (first paint, reduced motion,
// 简洁显示, a #hash, StrictMode); the toast's exit; the overlays' useExit.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import React, { StrictMode } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, HTMLDetailsElement: dom.window.HTMLDetailsElement,
  Element: dom.window.Element, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// A desktop that plays motion: no reduced motion, wide enough for the header's account tool.
let reduced = false;
let wide = true;
dom.window.matchMedia = ((query: string) => ({
  matches: query.includes('reduced-motion') ? reduced : query.includes('min-width: 1024px') ? wide : false,
  media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
})) as unknown as typeof dom.window.matchMedia;
const animated: { node: HTMLElement; keyframes: Keyframe[] }[] = [];
(dom.window.HTMLElement.prototype as unknown as { animate: unknown }).animate = function (this: HTMLElement, keyframes: Keyframe[]) { animated.push({ node: this, keyframes }); return {}; };
const { render, fireEvent, cleanup, act, waitFor } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, useNavigate } = await import('react-router-dom');
const { ChunkBoundary } = await import('../src/components/ChunkFallbacks');
const { RouteArrival } = await import('../src/app/route-arrival');
const { Toast, TOAST_EXIT_MS } = await import('../src/components/Toast');
const { useExit } = await import('../src/lib/reading-preferences');
const { SiteChrome } = await import('../src/components/SiteChrome');
afterEach(() => { cleanup(); animated.length = 0; reduced = false; wide = true; document.documentElement.removeAttribute('data-simple'); });

const noop = () => {};
const lost = () => { throw new TypeError('Failed to fetch dynamically imported module: https://www.baylink.us/assets/AccountMenu-x1.js'); };

test('a lazy chrome piece that cannot load shows its fallback and tells its owner; the page stays and a beacon is filed', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  t.mock.method(console, 'error', () => {});
  const Lost = () => lost();
  let failed = 0;
  const view = render(<div><p>page</p><ChunkBoundary fallback={<span>box</span>} onFail={() => { failed += 1; }}><Lost /></ChunkBoundary></div>);
  assert.equal(view.container.textContent, 'pagebox', 'the fallback holds the place; no error screen');
  assert.equal(failed, 1);
  const sent = () => fetch.mock.calls.filter(call => String(call.arguments[0]).endsWith('/client-errors'));
  await waitFor(() => assert.equal(sent().length, 1));
  assert.equal(JSON.parse(String((sent()[0].arguments[1] as RequestInit).body)).kind, 'chunk');
});

test('the header’s lazy pieces sit behind ChunkBoundary: account menu (its box), Aa (closes, toast), /about notes (open)', () => {
  const chrome = readFileSync('src/components/SiteChrome.tsx', 'utf8');
  assert.match(chrome, /<ChunkBoundary key=\{user\.id\} fallback=\{accountBox\}><Suspense fallback=\{accountBox\}><AccountMenu /);
  const reading = readFileSync('src/components/ReadingPreferences.tsx', 'utf8');
  assert.match(reading, /<ChunkBoundary onFail=\{\(\) => \{ setOpen\(false\); onUnavailable\?\.\(\); \}\}><Suspense fallback=\{open \? <SheetChunkFallback /);
  assert.match(readFileSync('src/app/AppLayout.tsx', 'utf8'), /onUnavailable=\{\(\) => showToast\(/);
  const about = readFileSync('src/components/AboutContent.tsx', 'utf8');
  assert.match(about, /<ChunkBoundary fallback=\{imageNotes\}><Suspense fallback=\{imageNotes\}><Disclosure /);
  assert.doesNotMatch(chrome, /onLogin/, 'the unused sign-in prop is gone (我的 → /me is the guest tool)');
});

test('the signed-in account tool loads its menu on a desktop only; a phone keeps the same-size box and no chunk', async () => {
  const user = { id: 'u1', token: 't', nickname: '小湾' } as never;
  wide = false;
  const phone = render(<MemoryRouter initialEntries={['/guides']}><SiteChrome pathname="/guides" user={user} messagesCount={0} onAsk={noop} onSearch={noop} onAccount={noop} onCreate={noop} onLogout={noop}><p>page</p></SiteChrome></MemoryRouter>);
  assert.ok(phone.container.querySelector('header .site-topbar-actions > .site-topbar-account[aria-hidden="true"]'), 'the box');
  assert.equal(phone.container.querySelector('header details.site-account-menu'), null, 'no menu chunk on a phone');
  phone.unmount();
  wide = true;
  const desktop = render(<MemoryRouter initialEntries={['/guides']}><SiteChrome pathname="/guides" user={user} messagesCount={0} onAsk={noop} onSearch={noop} onAccount={noop} onCreate={noop} onLogout={noop}><p>page</p></SiteChrome></MemoryRouter>);
  await waitFor(() => assert.ok(desktop.getByLabelText('账号菜单')));
});

function Pages({ go }: { go: (navigate: ReturnType<typeof useNavigate>) => void }) {
  const navigate = useNavigate();
  go(navigate);
  return <main id="scroll-container"><div className="site-route-progress" /><RouteArrival /><Routes><Route path="*" element={<section className="page">page</section>} /></Routes></main>;
}

test('the page arrival: never on the first paint (StrictMode too), a 4px rise after an in-app link, a fade for a #hash, none in 简洁显示 or with reduced motion', async () => {
  let navigate!: ReturnType<typeof useNavigate>;
  render(<StrictMode><MemoryRouter initialEntries={['/']}><Pages go={value => { navigate = value; }} /></MemoryRouter></StrictMode>);
  assert.equal(animated.length, 0, 'the first, prerendered paint does not animate (StrictMode’s repeated effect included)');
  await act(async () => { navigate('/events'); });
  assert.equal(animated.length, 1, 'one arrival');
  assert.ok(animated[0].node.classList.contains('page'), 'the page, never the route bar');
  assert.deepEqual(animated[0].keyframes, [{ opacity: 0, translate: '0 4px' }, { opacity: 1, translate: '0 0' }]);
  await act(async () => { navigate('/about#about-method-title'); });
  assert.deepEqual(animated[1].keyframes, [{ opacity: 0 }, { opacity: 1 }], 'a link to a place on the page only fades');
  await act(async () => { navigate('/about'); });
  assert.equal(animated.length, 2, 'the same page (a hash change) is not an arrival');
  document.documentElement.setAttribute('data-simple', '');
  await act(async () => { navigate('/guides'); });
  assert.equal(animated.length, 2, '简洁显示: none');
  document.documentElement.removeAttribute('data-simple');
  reduced = true;
  await act(async () => { navigate('/plan'); });
  assert.equal(animated.length, 2, 'reduced motion: none');
});

test('the toast leaves over TOAST_EXIT_MS (data-leaving) before it closes; at once under reduced motion', async () => {
  let closed = 0;
  const view = render(<Toast message="已保存" type="success" onClose={() => { closed += 1; }} />);
  const box = view.baseElement.querySelector<HTMLElement>('.site-toast-box')!;
  const started = Date.now();
  fireEvent.click(view.getByRole('button', { name: '关闭提示' }));
  assert.ok(box.hasAttribute('data-leaving'), 'the exit plays');
  assert.equal(closed, 0, 'still on screen while it leaves');
  await waitFor(() => assert.equal(closed, 1), { timeout: 2000 });
  assert.ok(Date.now() - started >= TOAST_EXIT_MS - 5, `closed after ${Date.now() - started}ms`);
  assert.ok(TOAST_EXIT_MS >= 120, 'N24: an exit of at least 120ms');
  view.unmount();
  reduced = true;
  let quick = 0;
  const still = render(<Toast message="已保存" type="success" onClose={() => { quick += 1; }} />);
  fireEvent.click(still.getByRole('button', { name: '关闭提示' }));
  assert.equal(quick, 1, 'reduced motion: closes at once');
});

test('useExit keeps an overlay (search, the image viewer) mounted through its 200ms exit; at once in 简洁显示', async () => {
  const seen: boolean[] = [];
  const Probe = ({ open }: { open: boolean }) => { seen.push(useExit(open)); return null; };
  const view = render(<Probe open />);
  view.rerender(<Probe open={false} />);
  assert.equal(seen.at(-1), true, 'still mounted while it leaves');
  await waitFor(() => assert.equal(seen.at(-1), false), { timeout: 2000 });
  view.unmount();
  document.documentElement.setAttribute('data-simple', '');
  seen.length = 0;
  const simple = render(<Probe open />);
  simple.rerender(<Probe open={false} />);
  await act(async () => {});
  assert.equal(seen.at(-1), false, '简洁显示: unmounted at once');
});
