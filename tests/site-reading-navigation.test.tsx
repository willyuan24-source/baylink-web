import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () { return (this.isConnected ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList; };
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { SiteMobileNavigation } = await import('../src/components/SiteMobileNavigation');
const { ReadingPreferencesButton } = await import('../src/components/ReadingPreferences');
const { getReadingSize, setReadingSize, initializeReadingSize, READING_SIZE_KEY } = await import('../src/lib/reading-preferences');
afterEach(() => { cleanup(); setReadingSize('standard'); dom.window.localStorage.clear(); });

test('calendar and personal routes have one correct tab, while BayBay opens in one action', () => {
  let asked = 0;
  const view = render(<MemoryRouter><SiteMobileNavigation pathname="/events/festival" notificationCount={3} onAsk={() => asked++} /></MemoryRouter>);
  assert.equal(view.container.querySelectorAll('a').length, 4);
  assert.equal(view.container.querySelector('[aria-current=page]')?.getAttribute('href'), '/calendar');
  fireEvent.click(view.getByRole('button', { name: '问 BayBay' })); assert.equal(asked, 1);
  assert.ok(view.getByLabelText('3 条未读消息'));
  view.rerender(<MemoryRouter><SiteMobileNavigation pathname="/messages/neighbor" notificationCount={0} onAsk={() => asked++} /></MemoryRouter>);
  assert.equal(view.container.querySelectorAll('[aria-current=page]').length, 1);
  assert.equal(view.container.querySelector('[aria-current=page]')?.getAttribute('href'), '/me');
  view.rerender(<MemoryRouter><SiteMobileNavigation pathname="/this-week" notificationCount={0} onAsk={() => asked++} /></MemoryRouter>);
  assert.equal(view.container.querySelectorAll('[aria-current=page]').length, 1);
  assert.equal(view.container.querySelector('[aria-current=page]')?.getAttribute('href'), '/calendar');
});

test('reading choices persist, initialize from a shared link, and close with restored focus', () => {
  const view = render(<ReadingPreferencesButton />);
  const trigger = view.getByRole('button', { name: '调整阅读字号' }); trigger.focus(); fireEvent.click(trigger);
  fireEvent.click(view.getByRole('button', { name: /特大/ }));
  assert.equal(getReadingSize(), 'extra-large');
  assert.equal(document.documentElement.dataset.reading, 'extra-large');
  assert.equal(dom.window.localStorage.getItem(READING_SIZE_KEY), 'extra-large');
  fireEvent.keyDown(view.getByRole('dialog'), { key: 'Escape' });
  assert.equal(view.queryByRole('dialog'), null); assert.equal(document.activeElement, trigger);
  dom.window.history.replaceState({}, '', '/?reading=large');
  act(() => initializeReadingSize());
  assert.equal(getReadingSize(), 'large');
  dom.window.history.replaceState({}, '', '/');
});

test('blocked storage still changes text size for this session', () => {
  const prototype = Object.getPrototypeOf(dom.window.localStorage);
  const original = prototype.setItem;
  prototype.setItem = () => { throw new Error('blocked'); };
  try { setReadingSize('large'); assert.equal(getReadingSize(), 'large'); assert.equal(document.documentElement.dataset.reading, 'large'); }
  finally { prototype.setItem = original; }
});
