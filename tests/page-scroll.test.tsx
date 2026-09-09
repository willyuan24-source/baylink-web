import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React, { StrictMode, useLayoutEffect } from 'react';
import {
  MemoryRouter, Outlet, Route, Routes, useLocation, useNavigate, useNavigationType,
  type Location, type NavigateFunction,
} from 'react-router-dom';
import { usePageScroll } from '../src/app/usePageScroll';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');

let scrollY = 0;
let availableHeight = 4000;
let scrollCalls: number[] = [];
const resizeCallbacks = new Set<() => void>();
const mutationCallbacks = new Set<() => void>();
class MockResizeObserver {
  constructor(private callback: () => void) {}
  observe() { resizeCallbacks.add(this.callback); }
  disconnect() { resizeCallbacks.delete(this.callback); }
}
class MockMutationObserver {
  constructor(private callback: () => void) {}
  observe() { mutationCallbacks.add(this.callback); }
  disconnect() { mutationCallbacks.delete(this.callback); }
}
Object.assign(globalThis, { ResizeObserver: MockResizeObserver, MutationObserver: MockMutationObserver });
Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY });
window.scrollTo = ((options: ScrollToOptions) => {
  const top = options.top ?? 0;
  scrollCalls.push(top);
  scrollY = Math.max(0, Math.min(top, availableHeight - 600));
}) as typeof window.scrollTo;
dom.window.HTMLElement.prototype.scrollIntoView = function () {
  window.scrollTo({ top: Number(this.dataset.top) });
};

let navigate: NavigateFunction;
let realLocation: Location;
function Layout({ location }: { location: Location }) {
  usePageScroll(location);
  return <><output data-testid="nested-action">{useNavigationType()}</output><Outlet /></>;
}
function App() {
  const location = useLocation();
  const routerNavigate = useNavigate();
  useLayoutEffect(() => { realLocation = location; navigate = routerNavigate; }, [location, routerNavigate]);
  const background = location.state?.backgroundLocation as Location | undefined;
  return <Routes location={background || location}>
    <Route element={<Layout location={location} />}>
      <Route path="*" element={<main><h2 id="guide-section-1" data-top="1200">Section one</h2><h2 id="guide-section-2" data-top="1800">Section two</h2></main>} />
    </Route>
  </Routes>;
}
const moveTo = (top: number) => { scrollY = top; fireEvent.scroll(window); };
const notifyResize = () => act(() => { [...resizeCallbacks].forEach((callback) => callback()); });
const notifyMutation = () => act(() => { [...mutationCallbacks].forEach((callback) => callback()); });
beforeEach(() => {
  scrollY = 0;
  availableHeight = 4000;
  scrollCalls = [];
  window.history.scrollRestoration = 'auto';
});
afterEach(() => { cleanup(); resizeCallbacks.clear(); mutationCallbacks.clear(); });

test('new page entries start at the top and Back/Forward restore each entry inside background Routes', () => {
  const view = render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
  moveTo(640);
  act(() => navigate('/guides'));
  assert.equal(view.getByTestId('nested-action').textContent, 'POP', 'Routes masks the real PUSH action');
  assert.equal(scrollY, 0);
  moveTo(260);
  act(() => navigate(-1));
  assert.equal(scrollY, 640);
  act(() => navigate(1));
  assert.equal(scrollY, 260);
  act(() => navigate('/guides'));
  assert.equal(scrollY, 0, 'a new entry at the same URL still starts at the top');
  assert.equal(window.history.scrollRestoration, 'manual');
  view.unmount();
  assert.equal(window.history.scrollRestoration, 'auto');
});

test('opening and closing a background post leaves the source page position untouched', () => {
  render(<MemoryRouter initialEntries={['/category/rent']}><App /></MemoryRouter>);
  moveTo(870);
  const backgroundLocation = realLocation;
  act(() => navigate('/posts/example', { state: { backgroundLocation } }));
  assert.equal(scrollY, 870);
  assert.deepEqual(scrollCalls, []);
  act(() => navigate(-1));
  assert.equal(scrollY, 870);
  assert.deepEqual(scrollCalls, []);
});

test('Back waits for lazy content to grow without replacing the saved position with a clamped one', () => {
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
  moveTo(960);
  act(() => navigate('/guides'));
  availableHeight = 800;
  act(() => navigate(-1));
  assert.equal(scrollY, 200, 'the browser initially clamps scrolling to the short placeholder');
  fireEvent.scroll(window);
  availableHeight = 4000;
  notifyResize();
  assert.equal(scrollY, 960);
  assert.equal(resizeCallbacks.size, 0, 'observers stop after restoration succeeds');
  act(() => navigate('/me'));
  act(() => navigate(-1));
  assert.equal(scrollY, 960);
});

test('user scroll intent cancels a pending lazy restoration instead of jumping later', () => {
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
  moveTo(950);
  act(() => navigate('/guides'));
  availableHeight = 800;
  act(() => navigate(-1));
  fireEvent.wheel(window);
  moveTo(80);
  availableHeight = 4000;
  notifyResize();
  assert.equal(scrollY, 80);
  assert.equal(resizeCallbacks.size, 0);
  act(() => navigate('/me'));
  act(() => navigate(-1));
  assert.equal(scrollY, 80);
});

test('native hash history entries with shared default keys reach headings and restore their own POP positions', () => {
  render(<MemoryRouter initialIndex={0} initialEntries={[
    { pathname: '/guides/example', key: 'guide-entry' },
    { pathname: '/guides/example', hash: '#guide-section-1', key: 'default' },
    { pathname: '/guides/example', hash: '#guide-section-2', key: 'default' },
  ]}><App /></MemoryRouter>);
  moveTo(450);
  act(() => navigate(1));
  assert.equal(scrollY, 1200);
  moveTo(1300);
  act(() => navigate(1));
  assert.equal(scrollY, 1800);
  act(() => navigate(-1));
  assert.equal(scrollY, 1300);
  act(() => navigate(-1));
  assert.equal(scrollY, 450);
});

test('an initial deep-link hash waits for its lazy heading under StrictMode', () => {
  render(<StrictMode><MemoryRouter initialEntries={['/guides/example#late-section']}><App /></MemoryRouter></StrictMode>);
  const heading = document.createElement('h2');
  heading.id = 'late-section';
  heading.dataset.top = '1450';
  document.querySelector('main')!.append(heading);
  notifyMutation();
  assert.equal(scrollY, 1450);
});
